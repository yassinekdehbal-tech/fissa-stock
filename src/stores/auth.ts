import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useFirebase } from '@/composables/useFirebase'
import { hashPassword, checkRateLimit, recordAttempt, generateSessionToken } from '@/utils/security'
import type { User, UserPermissions } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  const sessionToken = ref<string | null>(null)
  const error = ref('')
  const loading = ref(false)

  const isAdmin = computed(() => currentUser.value?.role === 'admin')
  const isLoggedIn = computed(() => !!currentUser.value)

  function hasPerm(perm: keyof UserPermissions): boolean {
    if (!currentUser.value) return false
    if (currentUser.value.role === 'admin') return true
    return !!currentUser.value.perms?.[perm]
  }

  async function ensureAdmin() {
    const { dbRef, get: fbGet, set: fbSet } = useFirebase()
    const snap = await fbGet(dbRef('users/admin'))
    if (!snap.exists()) {
      const hashed = await hashPassword('admin123')
      await fbSet(dbRef('users/admin'), {
        id: 'admin',
        name: 'Administrateur',
        role: 'admin',
        pwd: hashed,
        hashed: true,
        perms: {}
      })
    }
  }

  async function login(id: string, pwd: string): Promise<boolean> {
    error.value = ''
    loading.value = true

    if (!id || !pwd) {
      error.value = 'Remplissez tous les champs'
      loading.value = false
      return false
    }

    const rl = checkRateLimit()
    if (rl.blocked) {
      error.value = rl.msg || 'Trop de tentatives'
      loading.value = false
      return false
    }

    try {
      const { dbRef, get: fbGet, update: fbUpdate } = useFirebase()
      const snap = await fbGet(dbRef('users'))
      const users = snap.val() || {}
      const hashedPwd = await hashPassword(pwd)

      let found: any = null
      let foundKey: string | null = null

      for (const [k, u] of Object.entries(users) as [string, any][]) {
        if (u.id !== id) continue
        if (u.hashed && u.pwd === hashedPwd) {
          found = u; foundKey = k; break
        }
        if (!u.hashed && u.pwd === pwd) {
          found = u; foundKey = k
          await fbUpdate(dbRef('users/' + k), { pwd: hashedPwd, hashed: true })
          break
        }
      }

      if (!found || !foundKey) {
        recordAttempt(false)
        error.value = 'Identifiant ou mot de passe incorrect'
        loading.value = false
        return false
      }

      recordAttempt(true)
      sessionToken.value = generateSessionToken()
      sessionStorage.setItem('fissa_session', sessionToken.value)

      currentUser.value = {
        _id: foundKey,
        id: found.id,
        name: found.name,
        role: found.role,
        pwd: '',
        hashed: true,
        perms: found.perms || {}
      }

      loading.value = false
      return true
    } catch (e) {
      error.value = 'Erreur de connexion'
      loading.value = false
      return false
    }
  }

  function logout() {
    currentUser.value = null
    sessionToken.value = null
    sessionStorage.removeItem('fissa_session')
  }

  return {
    currentUser,
    sessionToken,
    error,
    loading,
    isAdmin,
    isLoggedIn,
    hasPerm,
    ensureAdmin,
    login,
    logout
  }
})
