import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { ProfileRow } from '@/lib/supabase'
import type { User, UserPermissions } from '@/types'

/**
 * Gestion des comptes — Supabase.
 * - Liste et mise à jour des rôles/permissions via la table `profiles` (RLS admin).
 * - Création / suppression de comptes via la fonction Edge `admin-users`
 *   (service_role, réservée aux admins) : impossible côté client sinon.
 * API publique conservée : `users`, `loading`, `listen`, `createUser`, `updateUser`,
 * `deleteUser`, `dispose`.
 */
export const useUsersStore = defineStore('users', () => {
  const users = ref<User[]>([])
  const loading = ref(true)
  let channel: ReturnType<typeof supabase.channel> | null = null

  function mapProfile(p: ProfileRow): User {
    return {
      _id: p.id,
      id: p.username ?? p.id,
      name: p.name ?? '',
      role: p.role,
      pwd: '',
      hashed: true,
      perms: {
        magasinier: p.perm_magasinier,
        vendeur: p.perm_vendeur,
        historique: p.perm_historique,
      },
    }
  }

  async function fetchAll() {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    users.value = ((data as ProfileRow[]) ?? []).map(mapProfile)
    loading.value = false
  }

  function listen() {
    void fetchAll()
    channel?.unsubscribe()
    channel = supabase
      .channel('profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void fetchAll())
      .subscribe()
  }

  /**
   * Appelle la fonction Edge `admin-users` et renvoie le message d'erreur
   * (français, produit par la fonction) ou `null` en cas de succès.
   */
  async function callAdmin(body: Record<string, unknown>): Promise<string | null> {
    const { data, error } = await supabase.functions.invoke('admin-users', { body })
    if (error) {
      // Réponse non-2xx : le corps JSON de la fonction contient `error`.
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        try {
          const payload = (await ctx.clone().json()) as { error?: string }
          if (payload?.error) return payload.error
        } catch {
          /* corps non JSON */
        }
      }
      return error.message || 'Erreur de communication avec le serveur'
    }
    const payload = data as { error?: string } | null
    return payload?.error ?? null
  }

  /**
   * Crée un compte employé. `login` est un identifiant court (ex. `jean.dupont`)
   * ou une adresse e-mail. Renvoie `null` si le compte est créé, sinon le message d'erreur.
   */
  async function createUser(login: string, name: string, pwd: string, perms: UserPermissions): Promise<string | null> {
    const err = await callAdmin({ action: 'create', login: login.trim(), password: pwd, name, perms, role: 'user' })
    if (err) return err
    await fetchAll()
    return null
  }

  async function updateUser(fbId: string, perms: UserPermissions, newPwd?: string): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase
      .from('profiles')
      .update({
        perm_magasinier: !!perms.magasinier,
        perm_vendeur: !!perms.vendeur,
        perm_historique: !!perms.historique,
      } as any)
      .eq('id', fbId)
    let err: string | null = null
    if (newPwd) err = await callAdmin({ action: 'set_password', id: fbId, password: newPwd })
    await fetchAll()
    return err
  }

  async function deleteUser(fbId: string): Promise<string | null> {
    const err = await callAdmin({ action: 'delete', id: fbId })
    await fetchAll()
    return err
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
  }

  return { users, loading, listen, fetchAll, createUser, updateUser, deleteUser, dispose }
})
