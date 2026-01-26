
import { createClient } from '@supabase/supabase-js';

/**
 * Accediamo alle variabili d'ambiente fornite dal sistema di build (es. Vite o Vercel).
 * Non scriviamo mai le chiavi reali qui dentro per motivi di sicurezza.
 */

const supabaseUrl = (process.env as any).VITE_SUPABASE_URL;
const supabaseAnonKey = (process.env as any).VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Attenzione: Le chiavi di Supabase non sono state trovate nelle variabili d'ambiente. " +
    "Assicurati di aver configurato VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
);
