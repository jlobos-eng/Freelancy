// Cliente de Supabase con SERVICE ROLE — bypassa RLS.
// Usar SOLO dentro de Edge Functions, jamás en el frontend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export function getSupabaseAdmin() {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    }
    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

/**
 * Cliente Supabase autenticado con el JWT del usuario que llamó a la función.
 * Útil cuando queremos respetar RLS (ej: validar que el caller es dueño del gig).
 */
export function getSupabaseUser(req: Request) {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !anonKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars');
    }
    const authHeader = req.headers.get('Authorization') ?? '';
    return createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
    });
}
