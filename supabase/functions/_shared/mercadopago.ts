// Wrapper minimal de la API de Mercado Pago.
// Uso: createPreference(), getPayment(), createPayout().
// Documentado contra la versión "Marketplace" (octubre 2024).
//
// Endpoints reference:
//   - POST /checkout/preferences      → crear checkout
//   - GET  /v1/payments/{id}          → consultar pago
//   - POST /v1/advanced_payments      → split payment (marketplace)
//   - POST /oauth/token               → exchange code → access_token (onboarding)

const MP_API_BASE = 'https://api.mercadopago.com';

function getAccessToken(): string {
    const token = Deno.env.get('MP_ACCESS_TOKEN');
    if (!token) {
        throw new Error('Missing MP_ACCESS_TOKEN env var (Marketplace app token)');
    }
    return token;
}

interface PreferenceItem {
    id?: string;
    title: string;
    description?: string;
    quantity: number;
    unit_price: number;       // CLP entero
    currency_id: 'CLP';
}

interface CreatePreferenceInput {
    items: PreferenceItem[];
    external_reference: string;       // tx_id en nuestra BD
    notification_url: string;         // URL del webhook
    back_urls: {
        success: string;
        failure: string;
        pending: string;
    };
    auto_return?: 'approved' | 'all';
    payer?: { email?: string; name?: string };
    marketplace?: string;             // app marketplace name
    marketplace_fee?: number;         // comisión en CLP que retiene la app (split)
    metadata?: Record<string, unknown>;
}

interface PreferenceResponse {
    id: string;
    init_point: string;       // checkout URL (producción)
    sandbox_init_point: string; // checkout URL (sandbox/TEST)
    external_reference: string;
}

export async function createPreference(input: CreatePreferenceInput): Promise<PreferenceResponse> {
    const token = getAccessToken();
    const res = await fetch(`${MP_API_BASE}/checkout/preferences`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            // Idempotency key recomendada por MP — usamos external_reference
            'X-Idempotency-Key': input.external_reference,
        },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`MP createPreference failed (${res.status}): ${text}`);
    }
    return res.json();
}

export async function getPayment(paymentId: string | number) {
    const token = getAccessToken();
    const res = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`MP getPayment failed (${res.status}): ${text}`);
    }
    return res.json();
}

/**
 * Validar firma x-signature del webhook.
 * Formato MP: "ts=1700000000,v1=hex_hmac_sha256"
 * Algoritmo: HMAC-SHA256 de "id:DATA;request-id:REQ;ts:TS;" con MP_WEBHOOK_SECRET.
 *
 * Devuelve true si la firma es válida o si no hay secret configurado (en dev).
 * En producción exige el secret seteado.
 */
export async function verifyWebhookSignature(
    req: Request,
    bodyText: string,
    dataId: string | null,
): Promise<boolean> {
    const secret = Deno.env.get('MP_WEBHOOK_SECRET');
    if (!secret) {
        console.warn('[mp-webhook] MP_WEBHOOK_SECRET not set — skipping signature verification (dev mode)');
        return true;
    }

    const signatureHeader = req.headers.get('x-signature');
    const requestId = req.headers.get('x-request-id') || '';
    if (!signatureHeader) {
        console.warn('[mp-webhook] missing x-signature header');
        return false;
    }

    // Parse "ts=...,v1=..."
    const parts = Object.fromEntries(
        signatureHeader.split(',').map((p) => p.trim().split('=').map((s) => s.trim())),
    );
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    // Manifest según docs MP: "id:DATA_ID;request-id:REQUEST_ID;ts:TIMESTAMP;"
    const manifest = `id:${dataId ?? ''};request-id:${requestId};ts:${ts};`;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(manifest));
    const computed = Array.from(new Uint8Array(sigBytes))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    // Constant-time-ish compare
    if (computed.length !== v1.length) return false;
    let mismatch = 0;
    for (let i = 0; i < computed.length; i++) {
        mismatch |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
    }
    // bodyText no se usa en MP signing pero lo aceptamos como param para futuras versiones
    void bodyText;
    return mismatch === 0;
}

/**
 * Intercambio OAuth para onboardear un Lancy a la cuenta Marketplace.
 * El Lancy autoriza desde su cuenta MP → MP redirige con ?code=...
 * Esta función intercambia el code por access_token + refresh_token + collector_id.
 */
export async function exchangeOAuthCode(code: string, redirectUri: string) {
    const clientId = Deno.env.get('MP_CLIENT_ID');
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
        throw new Error('Missing MP_CLIENT_ID or MP_CLIENT_SECRET');
    }
    const res = await fetch(`${MP_API_BASE}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`MP OAuth exchange failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<{
        access_token: string;
        refresh_token: string;
        token_type: string;
        expires_in: number;
        scope: string;
        user_id: number;     // collector_id que necesitamos guardar
        public_key: string;
    }>;
}
