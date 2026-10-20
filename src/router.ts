import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('./components/auth/LoginView.vue') },
    { path: '/boutique', name: 'boutique', component: () => import('./components/public/BoutiqueView.vue'), meta: { public: true } },
    { path: '/boutique/:id', name: 'boutique-piece', component: () => import('./components/public/BoutiquePieceView.vue'), meta: { public: true } },
    { path: '/confidentialite', name: 'confidentialite', component: () => import('./components/public/PrivacyView.vue'), meta: { public: true } },
    { path: '/', name: 'dashboard', component: () => import('./components/dashboard/DashboardView.vue'), meta: { requiresAuth: true, home: true } },
    { path: '/stock', name: 'stock', component: () => import('./components/stock/StockView.vue'), meta: { requiresAuth: true, title: 'Stock' } },
    { path: '/piece/:id', name: 'piece', component: () => import('./components/stock/PieceView.vue'), meta: { requiresAuth: true, title: 'Fiche produit', back: '/stock' } },
    { path: '/add', name: 'add', component: () => import('./components/stock/AddPieceView.vue'), meta: { requiresAuth: true, title: 'Ajouter une pièce', back: '/' } },
    { path: '/scanner', name: 'scanner', component: () => import('./components/scanner/ScannerView.vue'), meta: { requiresAuth: true, title: 'Scanner une commande', back: '/' } },
    { path: '/panier', name: 'panier', component: () => import('./components/cart/CartView.vue'), meta: { requiresAuth: true, title: 'Panier de sortie', back: '/scanner' } },
    { path: '/planning', name: 'planning', component: () => import('./components/planning/PlanningView.vue'), meta: { requiresAuth: true, title: 'Atelier', back: '/' } },
    { path: '/history', name: 'history', component: () => import('./components/history/HistoryView.vue'), meta: { requiresAuth: true, title: 'Historique', back: '/' } },
    { path: '/reporting', name: 'reporting', component: () => import('./components/reporting/ReportingView.vue'), meta: { requiresAuth: true, title: 'Reporting', back: '/' } },
    { path: '/caisse', name: 'caisse', component: () => import('./components/caisse/CaisseView.vue'), meta: { requiresAuth: true, title: 'Caisse', back: '/' } },
    { path: '/multidiffusion', name: 'multidiffusion', component: () => import('./components/multidiffusion/MultidiffusionView.vue'), meta: { requiresAuth: true, title: 'Multidiffusion', back: '/' } },
    { path: '/categories', name: 'categories', component: () => import('./components/stock/CategoriesView.vue'), meta: { requiresAuth: true, title: 'Catégories de pièces', back: '/profil' } },
    { path: '/profil', name: 'profil', component: () => import('./components/profile/ProfileView.vue'), meta: { requiresAuth: true, title: 'Profil', back: '/' } },
    { path: '/users', name: 'users', component: () => import('./components/users/UsersView.vue'), meta: { requiresAuth: true, title: 'Utilisateurs', back: '/' } },
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
