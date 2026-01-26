
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[key] || '';
    }
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || '';
    }
  } catch (e) {
    // Silenzioso durante il build
  }
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Esportiamo un flag per far sapere all'App se la configurazione è presente
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('http') &&
  supabaseAnonKey.length > 10
);

// Inizializziamo il client in modo sicuro
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
