// OAuthCallback — vista que recibe la redirección de Mercado Pago tras el OAuth.
// Lee ?code=...&state=... de la URL, llama a la Edge Function mp-oauth-callback,
// muestra estado y luego redirige al wallet con un toast.
//
// Estados visuales:
//   - 'processing' → spinner + "Conectando con Mercado Pago..."
//   - 'success'    → check verde + redirect automático en 2s
//   - 'error'      → icono rojo + mensaje + botón "Volver al inicio"

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

export default function OAuthCallback() {
    const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const params = new URLSearchParams(window.location.search);
                const code = params.get('code');
                const state = params.get('state');
                const mpError = params.get('error');

                if (mpError) {
                    throw new Error(`Mercado Pago: ${params.get('error_description') || mpError}`);
                }
                if (!code || !state) {
                    throw new Error('Faltan parámetros (code/state) en el callback');
                }
                if (!supabase) {
                    throw new Error('Supabase no configurado');
                }

                // Asegurar que el usuario esté logueado (la session debería estar viva
                // porque MP no nos saca del navegador, sólo redirige).
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    throw new Error('Sesión expirada — vuelve a iniciar sesión y reintenta');
                }

                // Llamar a la Edge Function (envía el JWT automáticamente)
                const { data, error: fnError } = await supabase.functions.invoke('mp-oauth-callback', {
                    body: {
                        code,
                        state,
                        redirect_uri: `${window.location.origin}/oauth/mp/callback`,
                    },
                });

                if (fnError) throw fnError;
                if (!data?.ok) throw new Error(data?.error || 'Respuesta inesperada del servidor');

                if (cancelled) return;
                setStatus('success');
                toast.success('¡Mercado Pago conectado!');

                // Redirigir al wallet después de 2s (o al dashboard si no hay wallet)
                setTimeout(() => {
                    if (!cancelled) {
                        window.history.replaceState({}, '', '/?tab=wallet');
                        window.location.href = '/?tab=wallet';
                    }
                }, 2000);
            } catch (err) {
                if (cancelled) return;
                setError(err?.message || 'Error desconocido');
                setStatus('error');
                toast.error('No se pudo conectar Mercado Pago');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-8 max-w-md w-full text-center">
                {status === 'processing' && (
                    <>
                        <div className="mx-auto bg-indigo-100 dark:bg-indigo-900/40 p-4 rounded-2xl w-fit mb-4">
                            <Loader2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin" />
                        </div>
                        <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">
                            Conectando con Mercado Pago...
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Estamos guardando tus credenciales de forma segura. No cierres esta ventana.
                        </p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/40 p-4 rounded-2xl w-fit mb-4">
                            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">
                            ¡Listo!
                        </h1>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
                            Mercado Pago quedó conectado a tu cuenta Freelancy.
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 flex items-center justify-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Recibirás los pagos automáticamente al aprobar cada trabajo.
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            Redirigiendo a tu billetera...
                        </p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="mx-auto bg-red-100 dark:bg-red-900/40 p-4 rounded-2xl w-fit mb-4">
                            <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
                        </div>
                        <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">
                            No pudimos conectar
                        </h1>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                            {error || 'Hubo un problema durante el proceso.'}
                        </p>
                        <button
                            onClick={() => { window.location.href = '/'; }}
                            className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-md hover:bg-indigo-700 active:scale-95 transition-all"
                        >
                            Volver al inicio <ArrowRight className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
