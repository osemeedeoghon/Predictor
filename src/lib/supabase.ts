import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type ClubPredictClient = SupabaseClient<Database>;

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/**
 * Browser client using the public anon key only. All authorization is
 * enforced by Row Level Security in the database. Null when the env vars are
 * missing, in which case the app falls back to the labelled demo.
 */
export const supabase: ClubPredictClient | null =
  url && anonKey
    ? createClient<Database>(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
