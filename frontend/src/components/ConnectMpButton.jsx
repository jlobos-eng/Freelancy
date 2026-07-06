// ConnectMpButton — onboarding OAuth a Mercado Pago Marketplace.
// El Lancy aprieta el botón → MP abre su pantalla de autorización → al volver,
// la Edge Function mp-oauth-callback guarda el access_token + collector_id
// en profiles.
//
// Master switch: VITE_MP_ENABLED='true' habilita el flujo OAuth real.
// En cualquier otro caso, mostramos un placeholder "Próximamente" para no
// romper la UX cuando aún no tenemos credenciales MP configuradas.

import { Wallet, ExternalLink, CheckCircle2, Clock } from 'lucide-react';

const MP_ENABLED = import.meta.env.VITE_MP_ENABLED === 'true';
const MP_CLIENT_ID = import.meta.env.VITE_MP_CLIENT_ID;

export default function ConnectMpButton({ profile }) {
    const isConnected = !!profile?.mp_user_id;
    // Necesitamos AMBAS cosas para que el flujo real funcione:
    // (a) flag explícita VITE_MP_ENABLED=true, y
    // (b) un Client ID configurado.
    const isReady = MP_ENABLED && !!MP_CLIENT_ID;

    const handleConnect = () => {
        if (!isReady) return;
        const redirectUri = `${window.location.origin}/oauth/mp/callback`;
        const url = new URL('https://auth.mercadopago.com/authorization');
        url.searchParams.set('client_id', MP_CLIENT_ID);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('platform_id', 'mp');
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('state', profile?.id || '');
        window.location.href = url.toString();
    };

    // Caso 1: ya conectado
    if (isConnected) {
        return (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-3">
                <div className="bg-emerald-600 text-white p-2 rounded-xl">
                    <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <p className="font-bold text-emerald-800 dark:text-emerald-200 text-sm">Mercado Pago conectado</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Recibirás los pagos automáticamente al aprobar cada trabajo.
                    </p>
                </div>
            </div>
        );
    }

    // Caso 2: MP aún no configurado en el entorno → placeholder gris
    if (!isReady) {
        return (
            <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2">
                <div className="flex items-start gap-3">
                    <div className="bg-slate-200 dark:bg-slate-700 p-2 rounded-xl text-slate-500 dark:text-slate-400">
                        <Wallet className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                                Pagos con Mercado Pago
                            </p>
                            <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md">
                                <Clock className="w-3 h-3" />
                                Próximamente
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Estamos terminando la integración con Mercado Pago.
                            Mientras tanto, los pagos quedan registrados pero no se procesan automáticamente.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Caso 3: listo para conectar
    return (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-xl text-amber-700 dark:text-amber-300">
                    <Wallet className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <p className="font-bold text-amber-900 dark:text-amber-100 text-sm">
                        Conecta tu Mercado Pago
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                        Necesario para recibir pagos. Sólo toma 1 minuto.
                    </p>
                </div>
            </div>
            <button
                onClick={handleConnect}
                className="w-full py-3 bg-[#00B1EA] text-white font-extrabold rounded-xl shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
            >
                <ExternalLink className="w-4 h-4" /> Conectar con Mercado Pago
            </button>
        </div>
    );
}
