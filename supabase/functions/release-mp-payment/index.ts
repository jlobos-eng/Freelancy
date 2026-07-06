// Edge Function: release-mp-payment
// POST /functions/v1/release-mp-payment  { transaction_id: uuid }
//
// Libera el pago al worker cuando el cliente aprueba el gig.
// Esta función se llama DESPUÉS de que el gig pase a status='completed'
// (el trigger guard_completion_payment ya validó que la tx esté escrowed).
//
// Para Mercado Pago Marketplace en Chile el split AUTOMÁTICO requiere
// usar /v1/advanced_payments al momento del checkout. Como en M3.2 usamos
// el flujo simple de /checkout/preferences con marketplace_fee, MP retiene
// la comisión automáticamente. Esta función entonces sólo:
//   1. Marca la transaction como 'released' en nuestra BD.
//   2. Acredita el saldo en wallet_balance (la vista lo recalcula sola).
//   3. Notifica al worker que el pago se liberó.
//
// NOTA: cuando migremos a Advanced Payments con cuentas separadas por Lancy
// (necesario para split en tiempo real con onboarding completo), esta función
// llamará a POST /v1/advanced_payments/{id}/disbursements/{disb_id}/refunds para
// el flujo de refund parcial; o no hará nada si MP ya disbursó al collector_id.

import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { getSupabaseAdmin, getSupabaseUser } from '../_shared/supabaseAdmin.ts';

interface RequestBody {
    transaction_id: string;
}

Deno.serve(async (req: Request) => {
    const cors = handleCors(req);
    if (cors) return cors;

    try {
        if (req.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }
        const body = (await req.json()) as RequestBody;
        if (!body.transaction_id) {
            return jsonResponse({ error: 'transaction_id required' }, 400);
        }

        // Identificar al caller
        const userClient = getSupabaseUser(req);
        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const admin = getSupabaseAdmin();
        const { data: tx, error: txError } = await admin
            .from('transactions')
            .select('*, gigs:gig_id(status, client_id)')
            .eq('id', body.transaction_id)
            .single();

        if (txError || !tx) {
            return jsonResponse({ error: 'Transaction not found' }, 404);
        }

        // Sólo el cliente (payer) puede liberar
        if (tx.payer_id !== user.id) {
            return jsonResponse({ error: 'Only payer can release' }, 403);
        }

        // Validaciones
        if (tx.status !== 'escrowed') {
            return jsonResponse({
                error: `Cannot release: tx is ${tx.status} (must be escrowed)`,
            }, 409);
        }
        if (tx.gigs?.status !== 'completed') {
            return jsonResponse({
                error: 'Gig must be completed first',
            }, 409);
        }

        // Marcar como released
        const { error: updErr } = await admin
            .from('transactions')
            .update({
                status: 'released',
                released_at: new Date().toISOString(),
            })
            .eq('id', tx.id);

        if (updErr) throw updErr;

        // Update gig.payment_status (el trigger guard_completion_payment ya lo hizo,
        // pero somos defensivos)
        await admin.from('gigs').update({ payment_status: 'released' }).eq('id', tx.gig_id);

        // Notificación al worker
        await admin.from('notifications').insert({
            user_id: tx.payee_id,
            type: 'gig_completed',
            title: '¡Pago liberado!',
            body: `Recibiste $${new Intl.NumberFormat('es-CL').format(tx.amount_net)} CLP. Disponible para retirar.`,
            gig_id: tx.gig_id,
        }).then(() => null).catch((e) => console.error('[release-mp-payment] notif:', e));

        return jsonResponse({ ok: true, status: 'released' });
    } catch (err) {
        console.error('[release-mp-payment] error:', err);
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
