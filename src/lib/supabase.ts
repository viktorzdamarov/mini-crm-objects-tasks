import { createClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from './config'
import type { Database } from '../types/database'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
