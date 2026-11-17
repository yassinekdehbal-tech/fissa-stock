// Fonction Edge `admin-users` — gestion des comptes réservée aux admins.
// Vérifie que l'appelant est admin (via son JWT), puis utilise la clé service_role
// pour créer / supprimer un compte ou changer un mot de passe.
//
// Création : l'identifiant saisi par l'admin est soit une adresse e-mail, soit un
// identifiant court (ex. `jean.dupont`). Supabase Auth exigeant un e-mail, un
// identifiant court reçoit une adresse technique dérivée de celle de l'admin qui
// crée le compte (`admin+jean.dupont@domaine`) : aucun e-mail n'est envoyé à la
// création, et les éventuels e-mails de réinitialisation arrivent dans la boîte
// de l'admin. L'identifiant est conservé dans `profiles.username` et sert à la
// connexion (RPC `login_email_for_username`).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

/** Messages Supabase Auth → français. */
function traduire(msg: string): string {
  if (/already (been )?registered|already exists/i.test(msg)) return 'Identifiant déjà utilisé'
  if (/Password should be at least/i.test(msg)) return 'Mot de passe trop court (6 caractères minimum)'
  if (/Unable to validate email|invalid format|invalid email/i.test(msg)) return 'Adresse e-mail invalide'
  return msg
}

/** `admin+jean.dupont@domaine` à partir de l'adresse de l'admin (tag `+` existant retiré). */
function technicalEmail(adminEmail: string, username: string): string {
  const at = adminEmail.lastIndexOf('@')
  const local = adminEmail.slice(0, at).split('+')[0]
  const domain = adminEmail.slice(at + 1)
  return `${local}+${username}@${domain}`.toLowerCase()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  // 1) Vérifier que l'appelant est authentifié ET admin
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: userData } = await caller.auth.getUser()
  if (!userData?.user) return json({ error: 'non authentifié' }, 401)
  const { data: prof } = await caller
    .from('profiles')
    .select('role, org_id')
    .eq('id', userData.user.id)
    .single()
  if (prof?.role !== 'admin') return json({ error: 'admin requis' }, 403)

  // 2) Opérations privilégiées avec la clé service_role
  const admin = createClient(url, service)
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'corps JSON invalide' }, 400)
  }

  const action = body.action as string

  if (action === 'create') {
    // `login` = identifiant court ou e-mail ; `email` conservé pour les anciens clients.
    const login = String(body.login ?? body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const name = ((body.name as string) ?? '').trim() || login
    const perms = (body.perms as Record<string, boolean>) ?? {}
    const role = (body.role as string) ?? 'user'
    if (!login || !password) return json({ error: 'Identifiant et mot de passe requis' }, 400)
    if (password.length < 6) return json({ error: 'Mot de passe trop court (6 caractères minimum)' }, 400)

    let email: string
    let username: string
    if (login.includes('@')) {
      email = login
      username = login
    } else {
      if (!USERNAME_RE.test(login)) {
        return json(
          { error: 'Identifiant invalide : lettres, chiffres, point, tiret ou underscore (2 à 32 caractères), ou une adresse e-mail' },
          400,
        )
      }
      const adminEmail = userData.user.email
      if (!adminEmail) return json({ error: "Le compte administrateur n'a pas d'adresse e-mail" }, 400)
      username = login
      email = technicalEmail(adminEmail, username)
    }

    // Unicité de l'identifiant dans l'organisation (insensible à la casse)
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('org_id', prof.org_id)
      .ilike('username', username)
      .limit(1)
    if (existing && existing.length > 0) return json({ error: 'Identifiant déjà utilisé' }, 400)

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, username },
    })
    if (error || !created?.user) return json({ error: traduire(error?.message ?? 'création impossible') }, 400)
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        name,
        username,
        role,
        perm_magasinier: !!perms.magasinier,
        perm_vendeur: !!perms.vendeur,
        perm_historique: !!perms.historique,
      })
      .eq('id', created.user.id)
    if (profileError) return json({ error: `Compte créé mais profil incomplet : ${profileError.message}` }, 500)
    return json({ ok: true, id: created.user.id, username })
  }

  if (action === 'set_password') {
    const id = String(body.id ?? '')
    const password = String(body.password ?? '')
    if (!id || !password) return json({ error: 'id et mot de passe requis' }, 400)
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) return json({ error: traduire(error.message) }, 400)
    return json({ ok: true })
  }

  if (action === 'delete') {
    const id = String(body.id ?? '')
    if (!id) return json({ error: 'id requis' }, 400)
    // Empêche un admin de se supprimer lui-même
    if (id === userData.user.id) return json({ error: 'auto-suppression interdite' }, 400)
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  return json({ error: 'action inconnue' }, 400)
})
