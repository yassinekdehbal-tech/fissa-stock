import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/main.css'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Restaure la session Supabase avant le montage de l'app
const auth = useAuthStore(pinia)
auth.init().finally(() => app.mount('#app'))
