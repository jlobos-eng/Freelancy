// frontend/src/services/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Evitamos que la app explote si las variables vienen vacías o inválidas
const isValidUrl = typeof supabaseUrl === 'string' && supabaseUrl.startsWith('http');
const hasKey = typeof supabaseAnonKey === 'string' && supabaseAnonKey.length > 0;

if (!isValidUrl || !hasKey) {
    console.error(
        '🚨 Supabase: faltan variables de entorno. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env y reinicia el servidor.'
    );
}

// Si la configuración no es válida exponemos null; App.jsx muestra una pantalla de error clara.
export const supabase = (isValidUrl && hasKey)
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    })
    : null;
