
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key] || '';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Esportiamo un flag per far sapere all'App se la configurazione è presente
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

// Inizializziamo il client solo se i dati sono validi, altrimenti passiamo stringhe vuote
// (L'App gestirà l'errore visivamente tramite il flag isSupabaseConfigured)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);
