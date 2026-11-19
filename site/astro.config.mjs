import { defineConfig } from 'astro/config'
import vercel from '@astrojs/vercel'
import tailwindcss from '@tailwindcss/vite'

// Portail public FISSA GROUPE. Rendu côté serveur sur Vercel : chaque pièce
// publiable du stock devient une page HTML indexable, à jour en permanence.
export default defineConfig({
  site: 'https://fissagroupe.fr',
  output: 'server',
  adapter: vercel(),
  trailingSlash: 'never',
  // Le contrôle d'origine intégré compare à une URL interne derrière Vercel et
  // refuse les vrais envois de formulaire : la vérification est faite dans
  // src/pages/api/lead.ts (Origin/Referer contre l'hôte réel de la requête).
  security: { checkOrigin: false },
  vite: { plugins: [tailwindcss()] },
})
