// Fonction Edge `admin-users` — gestion des comptes réservée aux admins.
// Vérifie que l'appelant est admin (via son JWT), puis utilise la clé service_role
// pour créer / supprimer un compte ou changer un mot de passe.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
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
    .select('role')
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
    const email = String(body.email ?? '').trim()
    const password = String(body.password ?? '')
    const name = (body.name as string) ?? email
    const perms = (body.perms as Record<string, boolean>) ?? {}
    const role = (body.role as string) ?? 'user'
    if (!email || !password) return json({ error: 'email et mot de passe requis' }, 400)
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })
    if (error || !created?.user) return json({ error: error?.message ?? 'création impossible' }, 400)
    await admin
      .from('profiles')
      .update({
        name,
        role,
        perm_magasinier: !!perms.magasinier,
        perm_vendeur: !!perms.vendeur,
        perm_historique: !!perms.historique,
      })
      .eq('id', created.user.id)
    return json({ ok: true, id: created.user.id })
  }

  if (action === 'set_password') {
    const id = String(body.id ?? '')
    const password = String(body.password ?? '')
    if (!id || !password) return json({ error: 'id et mot de passe requis' }, 400)
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) return json({ error: error.message }, 400)
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
