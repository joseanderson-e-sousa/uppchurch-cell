import "server-only";
import { createClient } from "@supabase/supabase-js";

// Never reuse the session client: this client bypasses RLS and has no cookies.
// Callers must authorize the current pastor before constructing it.
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuração administrativa indisponível.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
