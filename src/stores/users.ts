import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useFirebase } from '@/composables/useFirebase'
import { hashPassword, sanitize } from '@/utils/security'
import type { User, UserPermissions } from '@/types'

export const useUsersStore = defineStore('users', () => {
  const users = ref<User[]>([])
  const loading = ref(true)
  let unsubscribe: (() => void) | null = null

  function listen() {
    const { dbRef, onValue: fbOnValue } = useFirebase()
    unsubscribe?.()
    const usersRef = dbRef('users')
    unsubscribe = fbOnValue(usersRef, (snap) => {
      const val = snap.val() || {}
      users.value = Object.entries(val).map(([id, v]) => ({ _id: id, ...(v as object) } as User))
      loading.value = false
    }) as unknown as () => void
  }

  async function createUser(id: string, name: string, pwd: string, perms: UserPermissions): Promise<boolean> {
    if (users.value.find(u => u.id === id)) return false
    const { dbRef, push: fbPush, set: fbSet } = useFirebase()
    const hashedPwd = await hashPassword(pwd)
    const r = fbPush(dbRef('users'))
    await fbSet(r, {
      id: id.toLowerCase().replace(/[^a-z0-9._-]/g, ''),
      name: sanitize(name),
      role: 'user',
      pwd: hashedPwd,
      hashed: true,
      perms
    })
    return true
  }

  async function updateUser(fbId: string, perms: UserPermissions, newPwd?: string) {
    const { dbRef, update: fbUpdate } = useFirebase()
    const data: any = { perms }
    if (newPwd) {
      data.pwd = await hashPassword(newPwd)
      data.hashed = true
    }
    await fbUpdate(dbRef('users/' + fbId), data)
  }

  async function deleteUser(fbId: string) {
    const { dbRef, remove: fbRemove } = useFirebase()
    await fbRemove(dbRef('users/' + fbId))
  }

  function dispose() {
    unsubscribe?.()
  }

  return { users, loading, listen, createUser, updateUser, deleteUser, dispose }
})
