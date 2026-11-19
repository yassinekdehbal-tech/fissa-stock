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
  vite: { plugins: [tailwindcss()] },
})
