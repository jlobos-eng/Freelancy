// Edge Function: create-mp-preference
// POST /functions/v1/create-mp-preference  { transaction_id: uuid }
// Devuelve: { init_point, preference_id, sandbox: boolean }
//
// Flujo:
//   1. Validar JWT del caller (Supabase lo hace por nosotros si verify_jwt=true).
//   2. Cargar la transaction → validar que el caller es payer_id y status es 'requires_payment'.
//   3. Cargar el gig para obtener el título/desc del item.
//   4. Llamar a MP /checkout/preferences con marketplace_fee = amount_fee.
//   5. Guardar preference_id + init_point en la transaction.
//   6. Devolver init_point al frontend para redirigir.

import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { getSupabaseAdmin, getSupabaseUser } from '../_shared/supabaseAdmin.ts';
import { createPreference } from '../_shared/mercadopago.ts';

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

        // 1) Identificar al usuario via su JWT
        const userClient = getSupabaseUser(req);
        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // 2) Cargar transaction (con admin para bypass RLS y poder validar manualmente)
        const admin = getSupabaseAdmin();
        const { data: tx, error: txError } = await admin
            .from('transactions')
            .select('*, gigs:gig_id(id, title, description)')
            .eq('id', body.transaction_id)
            .single();

        if (txError || !tx) {
            return jsonResponse({ error: 'Transaction not found' }, 404);
        }

        // Validaciones de negocio
        if (tx.payer_id !== user.id) {
            return jsonResponse({ error: 'Not the payer of this transaction' }, 403);
        }
        if (tx.status !== 'requires_payment') {
            return jsonResponse({
                error: `Transaction not payable (status: ${tx.status})`,
                current_status: tx.status,
            }, 409);
        }

        // 3) Cargar el gig para el item de checkout
        const gig = tx.gigs;
        if (!gig) {
            return jsonResponse({ error: 'Gig not found' }, 404);
        }

        // 4) URLs de retorno + webhook
        const appUrl = Deno.env.get('APP_PUBLIC_URL') || 'http://localhost:5173';
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const notificationUrl = `${supabaseUrl}/functions/v1/mp-webhook`;
        const marketplace = Deno.env.get('MP_MARKETPLACE_NAME') || 'FreelancyApp';

        // 5) Llamar a MP
        const preference = await createPreference({
            items: [{
                id: gig.id,
                title: gig.title || 'Servicio Freelancy',
                description: gig.description?.slice(0, 250) || undefined,
                quantity: 1,
                unit_price: tx.amount_gross,
                currency_id: 'CLP',
            }],
            external_reference: tx.id,
            notification_url: notificationUrl,
            back_urls: {
                success: `${appUrl}/payment/success?tx=${tx.id}`,
                failure: `${appUrl}/payment/failure?tx=${tx.id}`,
                pending: `${appUrl}/payment/pending?tx=${tx.id}`,
            },
            auto_return: 'approved',
            marketplace,
            marketplace_fee: tx.amount_fee,
            metadata: {
                transaction_id: tx.id,
                gig_id: tx.gig_id,
                payer_id: tx.payer_id,
                payee_id: tx.payee_id,
            },
        });

        // 6) Persistir preference_id + init_point
        await admin
            .from('transactions')
            .update({
                provider_preference_id: preference.id,
                init_point: preference.init_point,
                status: 'processing',
            })
            .eq('id', tx.id);

        // En desarrollo MP también devuelve sandbox_init_point — si seteamos
        // MP_USE_SANDBOX=true devolvemos ese.
        const useSandbox = Deno.env.get('MP_USE_SANDBOX') === 'true';
        const initPoint = useSandbox ? preference.sandbox_init_point : preference.init_point;

        return jsonResponse({
            init_point: initPoint,
            preference_id: preference.id,
            sandbox: useSandbox,
        });
    } catch (err) {
        console.error('[create-mp-preference] error:', err);
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
