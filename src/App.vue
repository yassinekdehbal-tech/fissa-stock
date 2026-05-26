<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useStockStore } from './stores/stock'
import { useHistoryStore } from './stores/history'
import { useUsersStore } from './stores/users'
import { usePlanningStore } from './stores/planning'
import AppHeader from './components/ui/AppHeader.vue'
import AppNav from './components/ui/AppNav.vue'
import ToastNotification from './components/ui/ToastNotification.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const stock = useStockStore()
const history = useHistoryStore()
const users = useUsersStore()
const planning = usePlanningStore()

onMounted(async () => {
  await auth.ensureAdmin()
  stock.listen()
  history.listen()
  users.listen()
  planning.listen()
})

watch(() => auth.isLoggedIn, (loggedIn) => {
  if (!loggedIn && route.name !== 'login') {
    router.push('/login')
  }
})

router.beforeEach((to, _from, next) => {
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    next('/login')
  } else if (to.name === 'login' && auth.isLoggedIn) {
    next('/')
  } else {
    next()
  }
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <template v-if="auth.isLoggedIn">
      <AppHeader />
      <AppNav />
      <main class="flex-1 p-5 max-w-[1200px] w-full mx-auto">
        <router-view />
      </main>
    </template>
    <template v-else>
      <router-view />
    </template>
    <ToastNotification />
  </div>
</template>
