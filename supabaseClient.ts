import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------

// 1. Vite environment variables
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("⚠️ Supabase Credentials missing! Please set them in supabaseClient.ts");
}

export const supabase = createClient(
  SUPABASE_URL || '', 
  SUPABASE_ANON_KEY || ''
);