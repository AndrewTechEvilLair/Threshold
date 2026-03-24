import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bcbssntzilaethvadbkk.supabase.co'
const supabaseAnonKey = 'sb_publishable_cfPFjcEQ1Vy8rp-V_RojSQ_YEJyiptC'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
