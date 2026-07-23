import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn('[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. Copiez .env.example vers .env.')
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export type Tables = Database['public']['Tables']
export type PieceRow = Tables['pieces']['Row'] & { notes?: string | null }
export type InterventionRow = Tables['interventions']['Row']
export type InterventionPartRow = Tables['intervention_parts']['Row']
export type ProfileRow = Tables['profiles']['Row']
