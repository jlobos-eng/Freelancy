// CheckoutModal — modal que el cliente ve después de aceptar a un Lancy.
// Muestra el desglose (gross / fee app / neto al Lancy) y el botón "Pagar con Mercado Pago".
// Al apretarlo:
//   1. POST a /functions/v1/create-mp-preference  { transaction_id }
//   2. Si OK → redirige a init_point (checkout MP).
//   3. MP procesa → webhook actualiza la tx → realtime hace que el cliente vea "pago confirmado".

import { useState, useEffect } from 'react';
import { X, ShieldCheck, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { formatCLP } from '../utils/format';

export default function CheckoutModal({ transaction, gig, isOpen, onClose }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isOpen) {
            setError(null);
            setLoading(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !loading) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, loading, onClose]);

    if (!isOpen || !transaction) return null;

    const handlePay = async () => {
        if (!supabase) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: fnError } = await supabase.functions.invoke('create-mp-preference', {
                body: { transaction_id: transaction.id },
            });
            if (fnError) throw fnError;
            if (!data?.init_point) throw new Error('No init_point received');
            // Redirigir al checkout de MP
            window.location.href = data.init_point;
        } catch (err) {
            setError(err?.message || 'Error al iniciar el pago');
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-modal-title"
            onClick={() => !loading && onClose()}
        >
            <div
                className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-in-bottom"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                        <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 id="checkout-modal-title" className="font-extrabold text-slate-800 dark:text-slate-100 text-lg leading-tight">
                                Pago protegido
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{gig?.title || 'Tu gig'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50 shrink-0"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {/* Desglose */}
                    <div className="bg-slate-50 dark:bg-slate-700/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-300">Pago al Lancy</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                                ${formatCLP(transaction.amount_net)}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-300">Comisión Freelancy</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                                ${formatCLP(transaction.amount_fee)}
                            </span>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-600 pt-2 flex justify-between">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Total</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xl">
                                ${formatCLP(transaction.amount_gross)}
                            </span>
                        </div>
                    </div>

                    {/* Garantía */}
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3 flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
                            <strong>Tu pago queda protegido</strong> hasta que apruebes el trabajo terminado.
                            Si hay un problema, puedes abrir una disputa y el dinero queda en pausa.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-3 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-800 dark:text-red-200 leading-relaxed">{error}</p>
                        </div>
                    )}

                    <button
                        onClick={handlePay}
                        disabled={loading}
                        className="w-full py-4 bg-[#00B1EA] text-white font-extrabold rounded-2xl shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" /> Conectando con Mercado Pago...
                            </>
                        ) : (
                            <>
                                <ExternalLink className="w-5 h-5" /> Pagar con Mercado Pago
                            </>
                        )}
                    </button>

                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                        Serás redirigido a Mercado Pago para completar el pago. Aceptamos tarjetas, transferencia y todos los medios CLP.
                    </p>
                </div>
            </div>
        </div>
    );
}
