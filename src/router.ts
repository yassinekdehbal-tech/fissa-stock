import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('./components/auth/LoginView.vue') },
    { path: '/', name: 'dashboard', component: () => import('./components/dashboard/DashboardView.vue'), meta: { requiresAuth: true } },
    { path: '/stock', name: 'stock', component: () => import('./components/stock/StockView.vue'), meta: { requiresAuth: true } },
    { path: '/add', name: 'add', component: () => import('./components/stock/AddPieceView.vue'), meta: { requiresAuth: true } },
    { path: '/scanner', name: 'scanner', component: () => import('./components/scanner/ScannerView.vue'), meta: { requiresAuth: true } },
    { path: '/history', name: 'history', component: () => import('./components/history/HistoryView.vue'), meta: { requiresAuth: true } },
    { path: '/reporting', name: 'reporting', component: () => import('./components/reporting/ReportingView.vue'), meta: { requiresAuth: true } },
    { path: '/caisse', name: 'caisse', component: () => import('./components/caisse/CaisseView.vue'), meta: { requiresAuth: true } },
    { path: '/users', name: 'users', component: () => import('./components/users/UsersView.vue'), meta: { requiresAuth: true } },
  ]
})

export default router
