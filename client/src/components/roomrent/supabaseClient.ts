import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
/** Compatibility name for the existing app component; this module does not import Auth helpers. */
export const isSupabaseRoomsConfigured = isSupabaseConfigured;

let client: SupabaseClient | null = null;

/** Public browser client for the intentionally shared dataset; it never persists an Auth session. */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ก่อนเชื่อมต่อ Supabase");
  }
  client ??= createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
