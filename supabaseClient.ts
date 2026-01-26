
import { createClient } from '@supabase/supabase-js';

/**
 * Per la pubblicazione (Production), utilizziamo le variabili d'ambiente.
 * Se stai usando Vite, queste devono iniziare con VITE_.
 * Se le variabili non sono impostate (sviluppo locale), usiamo i valori di default come fallback.
 */


// Fix: Property 'env' does not exist on type 'ImportMeta'. Accessing via process.env as per environment guidelines.
const supabaseUrl = (process.env as any).VITE_SUPABASE_URL || 'https://pbmcfupdbtorbnrbicda.supabase.co';
const supabaseAnonKey = (process.env as any).VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBibWNmdXBkYnRvcmJucmJpY2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODM2ODAsImV4cCI6MjA4MDE1OTY4MH0.fVYTn2iDfaL1KL6iglXckP6gCgFJu9P8sN1YrwL_ZOA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
