// Edge Function: send-push
// POST /functions/v1/send-push  { notification_id: uuid }
//
// Llamada por:
//   - Trigger trg_notify_send_push (cuando se inserta una notification)
//   - Manualmente para reenvíos / pruebas
//
// Flujo:
//   1. Cargar la notification.
//   2. Cargar TODOS los push_subscriptions del user_id.
//   3. Para cada subscription, hacer encrypt + POST al endpoint con web-push.
//   4. Si endpoint devuelve 410 Gone → borrar la subscription (expiró).
//
// Requiere VAPID keys configuradas en Supabase Edge Functions Secrets.

import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import webpush from 'https://esm.sh/web-push@3.6.7';

interface RequestBody {
    notification_id: string;
}

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:no-reply@freelancy.cl';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
    try {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    } catch (e) {
        console.error('[send-push] failed to set VAPID details:', e);
    }
}

Deno.serve(async (req: Request) => {
    const cors = handleCors(req);
    if (cors) return cors;

    try {
        if (req.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
            console.warn('[send-push] VAPID keys not configured — skipping');
            return jsonResponse({ ok: true, skipped: 'no_vapid' });
        }

        const body = (await req.json()) as RequestBody;
        if (!body.notification_id) {
            return jsonResponse({ error: 'notification_id required' }, 400);
        }

        const admin = getSupabaseAdmin();

        // 1) Cargar notification
        const { data: notif, error: notifErr } = await admin
            .from('notifications')
            .select('*')
            .eq('id', body.notification_id)
            .single();

        if (notifErr || !notif) {
            return jsonResponse({ error: 'Notification not found' }, 404);
        }

        // 2) Cargar suscripciones del usuario
        const { data: subs, error: subsErr } = await admin
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', notif.user_id);

        if (subsErr) {
            console.error('[send-push] subs query error:', subsErr);
            return jsonResponse({ error: 'subs query failed' }, 500);
        }
        if (!subs || subs.length === 0) {
            return jsonResponse({ ok: true, sent: 0, reason: 'no_subscriptions' });
        }

        // 3) Construir payload del push
        const url = notif.gig_id
            ? `/?tab=dashboard&gig=${notif.gig_id}`
            : '/?tab=dashboard';

        const payload = JSON.stringify({
            title: notif.title || 'Freelancy',
            body: notif.body || '',
            gig_id: notif.gig_id,
            notification_id: notif.id,
            type: notif.type,
            url,
            tag: notif.gig_id || notif.id,
        });

        // 4) Enviar a cada subscription en paralelo
        const results = await Promise.allSettled(
            subs.map((s) =>
                webpush.sendNotification(
                    {
                        endpoint: s.endpoint,
                        keys: { p256dh: s.p256dh, auth: s.auth },
                    },
                    payload,
                    { TTL: 60 * 60 * 24 } // 24h
                )
            )
        );

        // 5) Cleanup endpoints inválidos (410 Gone, 404 Not Found)
        const toDelete: string[] = [];
        let sent = 0;
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
                sent += 1;
            } else {
                const reason = r.reason as { statusCode?: number; message?: string };
                if (reason?.statusCode === 410 || reason?.statusCode === 404) {
                    toDelete.push(subs[i].endpoint);
                } else {
                    console.warn('[send-push] failed to send:', reason?.message || reason);
                }
            }
        });

        if (toDelete.length > 0) {
            await admin
                .from('push_subscriptions')
                .delete()
                .in('endpoint', toDelete);
        }

        return jsonResponse({ ok: true, sent, cleaned: toDelete.length, total: subs.length });
    } catch (err) {
        console.error('[send-push] unhandled error:', err);
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
