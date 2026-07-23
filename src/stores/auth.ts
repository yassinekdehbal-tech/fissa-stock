import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { ProfileRow } from '@/lib/supabase'

export type PermKey = 'magasinier' | 'vendeur' | 'historique'

/**
 * Store d'authentification — Supabase Auth (email + mot de passe).
 * Le rôle et les permissions viennent de la table `profiles`.
 * Le tout premier compte créé devient automatiquement `admin` (trigger BDD).
 */
export const useAuthStore = defineStore('auth', () => {
  const profile = ref<ProfileRow | null>(null)
  const userId = ref<string | null>(null)
  const email = ref<string | null>(null)
  const error = ref('')
  const loading = ref(false)
  const ready = ref(false)
  let initPromise: Promise<void> | null = null

  const isLoggedIn = computed(() => !!userId.value)
  const isAdmin = computed(() => profile.value?.role === 'admin')
  const currentUser = computed(() =>
    profile.value
      ? {
          id: userId.value,
          name: profile.value.name,
          role: profile.value.role,
          perms: {
            magasinier: profile.value.perm_magasinier,
            vendeur: profile.value.perm_vendeur,
            historique: profile.value.perm_historique,
          },
        }
      : null,
  )

  function hasPerm(perm: PermKey): boolean {
    if (!profile.value) return false
    if (profile.value.role === 'admin') return true
    if (perm === 'magasinier') return profile.value.perm_magasinier
    if (perm === 'vendeur') return profile.value.perm_vendeur
    if (perm === 'historique') return profile.value.perm_historique
    return false
  }

  async function loadProfile() {
    if (!userId.value) {
      profile.value = null
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId.value).single()
    profile.value = (data as ProfileRow) ?? null
  }

  async function doInit() {
    const { data } = await supabase.auth.getSession()
    userId.value = data.session?.user.id ?? null
    email.value = data.session?.user.email ?? null
    if (userId.value) await loadProfile()
    supabase.auth.onAuthStateChange((_event, session) => {
      userId.value = session?.user.id ?? null
      email.value = session?.user.email ?? null
      void loadProfile()
    })
    ready.value = true
  }

  /** Idempotent : restaure la session et charge le profil une seule fois. */
  function init() {
    if (!initPromise) initPromise = doInit()
    return initPromise
  }

  async function login(mail: string, password: string): Promise<boolean> {
    error.value = ''
    loading.value = true
    const { data, error: e } = await supabase.auth.signInWithPassword({ email: mail.trim(), password })
    if (e) {
      error.value = traduire(e.message)
      loading.value = false
      return false
    }
    userId.value = data.user?.id ?? null
    email.value = data.user?.email ?? null
    await loadProfile()
    loading.value = false
    return true
  }

  async function signUp(mail: string, password: string, name?: string): Promise<boolean> {
    error.value = ''
    loading.value = true
    const { error: e } = await supabase.auth.signUp({
      email: mail.trim(),
      password,
      options: { data: { name: name ?? mail } },
    })
    if (e) {
      error.value = traduire(e.message)
      loading.value = false
      return false
    }
    loading.value = false
    return true
  }

  async function logout() {
    await supabase.auth.signOut()
    userId.value = null
    email.value = null
    profile.value = null
  }

  /** Conservé pour compatibilité (l'admin est désormais le 1er inscrit). */
  async function ensureAdmin() {
    /* no-op */
  }

  function traduire(msg: string): string {
    if (/Invalid login credentials/i.test(msg)) return 'Email ou mot de passe incorrect'
    if (/Email not confirmed/i.test(msg)) return 'Email non confirmé — vérifiez votre boîte mail'
    if (/User already registered/i.test(msg)) return 'Un compte existe déjà avec cet email'
    return msg
  }

  return {
    profile,
    userId,
    email,
    error,
    loading,
    ready,
    isLoggedIn,
    isAdmin,
    currentUser,
    hasPerm,
    init,
    login,
    signUp,
    logout,
    ensureAdmin,
  }
})
