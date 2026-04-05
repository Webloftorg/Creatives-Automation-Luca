import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side client with service role (for API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Client-side / public client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getAssetPublicUrl(path: string): string {
  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(path);
  return data.publicUrl;
}
