// Edge Function: mp-oauth-callback
// POST /functions/v1/mp-oauth-callback  { code: string, state: string }
//
// Llamada por la página /oauth/mp/callback del frontend después de que
// Mercado Pago redirige al usuario con ?code=...&state=<user_id>.
//
// Flujo:
//   1. Validar JWT del caller (debe ser un usuario autenticado).
//   2. Validar que state === auth.uid() (anti-CSRF).
//   3. Hacer exchange code → tokens contra /oauth/token de MP.
//   4. Guardar tokens sensibles en `mp_credentials` (tabla solo service_role)
//      y datos no secretos (mp_user_id, mp_onboarded_at) en `profiles`.
//   5. Devolver { ok: true, mp_user_id }.
//
// IMPORTANTE: el access_token / refresh_token de MP NUNCA deben filtrarse al
// frontend. Viven en `mp_credentials`, que tiene RLS habilitado y SIN políticas
// para authenticated/anon → solo esta edge function (service_role) los toca.
// (Migración 2026_04_30_mp_credentials.sql — cierre del hallazgo C6.)

import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { getSupabaseAdmin, getSupabaseUser } from '../_shared/supabaseAdmin.ts';
import { exchangeOAuthCode } from '../_shared/mercadopago.ts';

interface RequestBody {
    code: string;
    state: string;
    redirect_uri?: string; // opcional, por si el frontend usa otro origen (ngrok, prod)
}

Deno.serve(async (req: Request) => {
    const cors = handleCors(req);
    if (cors) return cors;

    try {
        if (req.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        const body = (await req.json()) as RequestBody;
        if (!body.code || !body.state) {
            return jsonResponse({ error: 'code and state required' }, 400);
        }

        // 1) Identificar al caller via JWT
        const userClient = getSupabaseUser(req);
        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // 2) Validar state (anti-CSRF) — debe coincidir con el user_id
        if (body.state !== user.id) {
            console.warn('[mp-oauth-callback] state mismatch', {
                expected: user.id,
                got: body.state,
            });
            return jsonResponse({ error: 'Invalid state (CSRF check failed)' }, 403);
        }

        // 3) Determinar redirect_uri (debe coincidir EXACTAMENTE con el que MP recibió en el authorize)
        const appUrl = body.redirect_uri || Deno.env.get('APP_PUBLIC_URL') || 'http://localhost:5173';
        const redirectUri = body.redirect_uri ? body.redirect_uri : `${appUrl}/oauth/mp/callback`;

        // 4) Exchange code → tokens
        const tokenResponse = await exchangeOAuthCode(body.code, redirectUri);

        if (!tokenResponse.access_token || !tokenResponse.user_id) {
            console.error('[mp-oauth-callback] missing fields in MP response:', tokenResponse);
            return jsonResponse({ error: 'Invalid MP response' }, 502);
        }

        const expiresAt = new Date(Date.now() + (tokenResponse.expires_in || 21600) * 1000).toISOString();

        // 5) Guardar credenciales. Los TOKENS sensibles van a `mp_credentials`
        //    (tabla con RLS sin políticas → solo service_role la lee/escribe).
        //    En `profiles` solo dejamos datos no secretos: mp_user_id
        //    (collector_id, lo usa el frontend) y mp_onboarded_at.
        const admin = getSupabaseAdmin();

        // 5a) Tokens sensibles → mp_credentials (upsert por user_id)
        const { error: credErr } = await admin
            .from('mp_credentials')
            .upsert({
                user_id: user.id,
                mp_access_token: tokenResponse.access_token,
                mp_refresh_token: tokenResponse.refresh_token,
                mp_token_expires_at: expiresAt,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        if (credErr) {
            console.error('[mp-oauth-callback] mp_credentials upsert failed:', credErr);
            return jsonResponse({ error: 'Failed to save MP credentials' }, 500);
        }

        // 5b) Datos no secretos → profiles
        const { error: updateErr } = await admin
            .from('profiles')
            .update({
                mp_user_id: String(tokenResponse.user_id),
                mp_onboarded_at: new Date().toISOString(),
            })
            .eq('id', user.id);

        if (updateErr) {
            console.error('[mp-oauth-callback] profile update failed:', updateErr);
            return jsonResponse({ error: 'Failed to save MP profile data' }, 500);
        }

        // 6) Notificación amigable al usuario
        await admin.from('notifications').insert({
            user_id: user.id,
            type: 'gig_completed', // reusamos un tipo permitido del check
            title: 'Mercado Pago conectado',
            body: 'Ya puedes recibir pagos automáticamente al completar trabajos.',
        }).then(() => null).catch(() => null);

        return jsonResponse({
            ok: true,
            mp_user_id: String(tokenResponse.user_id),
            expires_at: expiresAt,
        });
    } catch (err) {
        console.error('[mp-oauth-callback] error:', err);
        const msg = err instanceof Error ? err.message : 'unknown error';
        return jsonResponse({ error: msg }, 500);
    }
});

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
