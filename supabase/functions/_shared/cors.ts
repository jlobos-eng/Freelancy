// CORS headers compartidos por todas las Edge Functions del proyecto.
// Permitir cualquier origen autenticado vía Supabase JWT está OK porque la
// autorización real la hace el SUPABASE_ANON_KEY + JWT del usuario.

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function handleCors(req: Request): Response | null {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    return null;
}
