// Server-side Supabase Client mit Service-Role-Key.
// Niemals im Browser-Bundle verwenden. _lib-Prefix verhindert Vercel-Routing.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  throw new Error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen in ENV gesetzt sein');
}

let client = null;

export function getSupabase() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return client;
}
