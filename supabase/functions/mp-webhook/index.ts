// Edge Function: mp-webhook
// POST /functions/v1/mp-webhook
//
// Mercado Pago llama esta función cuando hay eventos sobre un payment.
// Headers que envía MP:
//   x-signature: ts=...,v1=...
//   x-request-id: <uuid>
//
// Body (notification):
//   { type: 'payment', data: { id: '<payment_id>' }, action: 'payment.created' | 'payment.updated' }
//
// Flujo:
//   1. Validar firma (x-signature) — crítico, sin esto cualquiera puede falsificar pagos.
//   2. Si el evento es de payment, traer el payment desde MP API (no confiar en el body).
//   3. Buscar la transaction por external_reference.
//   4. Mapear status MP → status interno (escrowed/refunded/failed/cancelled).
//   5. Update transaction + gig.payment_status + payee.balance_pending (cacheado).
//   6. Devolver 200 SIEMPRE (MP reintenta si responde !=200).
//
// IMPORTANTE: Esta función debe tener verify_jwt=false en supabase/config.toml
// porque MP no envía JWT. La autenticación es vía x-signature.

import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getPayment, verifyWebhookSignature } from '../_shared/mercadopago.ts';

// MP payment.status → nuestro transactions.status
function mapMpStatus(mpStatus: string): string {
    switch (mpStatus) {
        case 'approved':
            return 'escrowed';
        case 'in_process':
        case 'pending':
        case 'authorized':
            return 'processing';
        case 'rejected':
        case 'cancelled':
            return 'failed';
        case 'refunded':
        case 'charged_back':
            return 'refunded';
        default:
            return 'processing';
    }
}

Deno.serve(async (req: Request) => {
    const cors = handleCors(req);
    if (cors) return cors;

    // SIEMPRE responder 200 a MP si hubo un fallo de procesamiento, salvo
    // que la firma sea inválida (ahí 401 para que MP no reintente con el mismo body).
    try {
        const url = new URL(req.url);
        const dataIdQs = url.searchParams.get('data.id');
        const typeQs = url.searchParams.get('type');

        const bodyText = await req.text();
        let body: { type?: string; data?: { id?: string | number }; action?: string } = {};
        try {
            body = bodyText ? JSON.parse(bodyText) : {};
        } catch {
            // MP a veces no manda body en notificaciones IPN viejas
        }

        const eventType = body.type || typeQs;
        const dataId = String(body.data?.id ?? dataIdQs ?? '');

        if (!eventType || !dataId) {
            console.warn('[mp-webhook] missing type or data.id', { eventType, dataId });
            return new Response('ok', { status: 200, headers: corsHeaders });
        }

        // 1) Validar firma
        const signatureValid = await verifyWebhookSignature(req, bodyText, dataId);
        if (!signatureValid) {
            console.error('[mp-webhook] invalid signature', { dataId });
            return new Response('invalid signature', { status: 401, headers: corsHeaders });
        }

        // Sólo procesamos eventos de payment por ahora
        if (eventType !== 'payment') {
            console.log('[mp-webhook] ignoring event type', eventType);
            return new Response('ok', { status: 200, headers: corsHeaders });
        }

        // 2) Traer el payment desde MP API (fuente de verdad)
        const payment = await getPayment(dataId);
        const externalRef: string | undefined = payment?.external_reference;
        const mpStatus: string = payment?.status ?? 'unknown';
        const mpStatusDetail: string | undefined = payment?.status_detail;
        const mpFee: number = Number(payment?.fee_details?.[0]?.amount ?? 0);

        if (!externalRef) {
            console.warn('[mp-webhook] payment without external_reference', payment?.id);
            return new Response('ok', { status: 200, headers: corsHeaders });
        }

        // 3) Buscar la transaction
        const admin = getSupabaseAdmin();
        const { data: tx, error: txError } = await admin
            .from('transactions')
            .select('*')
            .eq('id', externalRef)
            .single();

        if (txError || !tx) {
            console.warn('[mp-webhook] transaction not found', externalRef);
            return new Response('ok', { status: 200, headers: corsHeaders });
        }

        // 4) Mapear y actualizar
        const newStatus = mapMpStatus(mpStatus);

        // No degradar estado: si ya está released/refunded, no volvemos atrás
        const FINAL_STATES = ['released', 'refunded'];
        if (FINAL_STATES.includes(tx.status)) {
            console.log('[mp-webhook] tx already in final state, skipping', tx.id, tx.status);
            return new Response('ok', { status: 200, headers: corsHeaders });
        }

        // Si hay disputa abierta, NO marcar como escrowed (el trigger sync_dispute_to_transaction
        // ya hace esto, pero somos defensivos en este lado también).
        const finalStatus = tx.status === 'disputed' && newStatus === 'escrowed' ? 'disputed' : newStatus;

        const updates: Record<string, unknown> = {
            status: finalStatus,
            provider_payment_id: String(payment.id),
            provider_status: mpStatus,
            provider_payload: { ...payment, status_detail: mpStatusDetail },
            amount_provider_fee: mpFee || tx.amount_provider_fee,
        };

        if (finalStatus === 'escrowed' && !tx.paid_at) {
            updates.paid_at = new Date().toISOString();
        }
        if (finalStatus === 'refunded' && !tx.refunded_at) {
            updates.refunded_at = new Date().toISOString();
        }

        const { error: updateErr } = await admin
            .from('transactions')
            .update(updates)
            .eq('id', tx.id);

        if (updateErr) {
            console.error('[mp-webhook] failed to update tx', tx.id, updateErr);
            return new Response('ok', { status: 200, headers: corsHeaders });
        }

        // 5) Actualizar gig.payment_status (separado del status del trabajo)
        const gigPaymentStatus =
            finalStatus === 'escrowed' ? 'escrowed'
                : finalStatus === 'refunded' ? 'refunded'
                    : finalStatus === 'failed' ? 'requires_payment'
                        : null;

        if (gigPaymentStatus) {
            await admin
                .from('gigs')
                .update({ payment_status: gigPaymentStatus })
                .eq('id', tx.gig_id);
        }

        // 6) Actualizar saldo cacheado del worker (defensivo, la vista wallet_balance es fuente de verdad)
        if (finalStatus === 'escrowed') {
            await admin.rpc('increment_balance_pending', {
                p_user_id: tx.payee_id,
                p_amount: tx.amount_net,
            }).then(() => null).catch(() => null); // no falla si la RPC no existe
        }

        // 7) Crear notificación al cliente y al worker
        await admin.from('notifications').insert([
            {
                user_id: tx.payer_id,
                type: 'gig_completed',
                title: finalStatus === 'escrowed' ? 'Pago confirmado' : finalStatus === 'refunded' ? 'Pago reembolsado' : 'Pago actualizado',
                body: finalStatus === 'escrowed'
                    ? 'Tu pago se confirmó y está retenido hasta que apruebes el trabajo.'
                    : finalStatus === 'refunded'
                        ? 'Tu pago fue reembolsado a tu medio de pago.'
                        : `Estado del pago: ${mpStatus}`,
                gig_id: tx.gig_id,
            },
            {
                user_id: tx.payee_id,
                type: 'gig_completed',
                title: finalStatus === 'escrowed' ? 'El cliente pagó' : 'Pago actualizado',
                body: finalStatus === 'escrowed'
                    ? `El cliente confirmó el pago. Tu monto ($${tx.amount_net}) está protegido.`
                    : `Estado del pago: ${mpStatus}`,
                gig_id: tx.gig_id,
            },
        ]).then(() => null).catch((e) => console.error('[mp-webhook] notification error:', e));

        return new Response('ok', { status: 200, headers: corsHeaders });
    } catch (err) {
        console.error('[mp-webhook] unhandled error:', err);
        // Importante: 200 para evitar reintentos infinitos
        return new Response('ok', { status: 200, headers: corsHeaders });
    }
});
