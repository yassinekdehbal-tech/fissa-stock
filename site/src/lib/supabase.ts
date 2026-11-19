import { createClient } from '@supabase/supabase-js'

// Même projet Supabase que FISSA STOCK. La clé « publishable » est publique par
// nature : le site ne voit que ce que les règles RLS autorisent au rôle anon
// (pièces publiables, catégories, insertion de demandes).
const url = import.meta.env.PUBLIC_SUPABASE_URL ?? 'https://mkgxnnihcldspbedqwge.supabase.co'
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_yry1baN65W8aJxPs28bk8Q_A_LskQQq'

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
