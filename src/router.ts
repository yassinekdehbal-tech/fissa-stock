import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('./components/auth/LoginView.vue') },
    { path: '/', name: 'dashboard', component: () => import('./components/dashboard/DashboardView.vue'), meta: { requiresAuth: true } },
    { path: '/stock', name: 'stock', component: () => import('./components/stock/StockView.vue'), meta: { requiresAuth: true } },
    { path: '/add', name: 'add', component: () => import('./components/stock/AddPieceView.vue'), meta: { requiresAuth: true } },
    { path: '/scanner', name: 'scanner', component: () => import('./components/scanner/ScannerView.vue'), meta: { requiresAuth: true } },
    { path: '/panier', name: 'panier', component: () => import('./components/cart/CartView.vue'), meta: { requiresAuth: true } },
    { path: '/planning', name: 'planning', component: () => import('./components/planning/PlanningView.vue'), meta: { requiresAuth: true } },
    { path: '/history', name: 'history', component: () => import('./components/history/HistoryView.vue'), meta: { requiresAuth: true } },
    { path: '/reporting', name: 'reporting', component: () => import('./components/reporting/ReportingView.vue'), meta: { requiresAuth: true } },
    { path: '/caisse', name: 'caisse', component: () => import('./components/caisse/CaisseView.vue'), meta: { requiresAuth: true } },
    { path: '/users', name: 'users', component: () => import('./components/users/UsersView.vue'), meta: { requiresAuth: true } },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  if (to.meta.requiresAuth && !auth.isLoggedIn) return { name: 'login' }
  if (to.name === 'login' && auth.isLoggedIn) return { name: 'dashboard' }
  return true
})

export default router
