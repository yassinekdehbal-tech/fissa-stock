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
   * Crée un compte employé. `id` doit être un **email** (identifiant de connexion).
   * Passe par la fonction Edge sécurisée (service_role). Retourne false en cas d'échec.
   */
  async function createUser(id: string, name: string, pwd: string, perms: UserPermissions): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'create', email: id.trim(), password: pwd, name, perms, role: 'user' },
    })
    if (error || (data as { error?: string })?.error) return false
    await fetchAll()
    return true
  }

  async function updateUser(fbId: string, perms: UserPermissions, newPwd?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase
      .from('profiles')
      .update({
        perm_magasinier: !!perms.magasinier,
        perm_vendeur: !!perms.vendeur,
        perm_historique: !!perms.historique,
      } as any)
      .eq('id', fbId)
    if (newPwd) {
      await supabase.functions.invoke('admin-users', {
        body: { action: 'set_password', id: fbId, password: newPwd },
      })
    }
    await fetchAll()
  }

  async function deleteUser(fbId: string) {
    await supabase.functions.invoke('admin-users', { body: { action: 'delete', id: fbId } })
    await fetchAll()
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
  }

  return { users, loading, listen, fetchAll, createUser, updateUser, deleteUser, dispose }
})
