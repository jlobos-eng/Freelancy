// BidModal — modal de postulación competitiva del Lancy. Dark-mode aware.
// Resetea el form al cerrar para que la próxima apertura no traiga datos viejos.

import { useState, useEffect } from 'react';
import { X, DollarSign, Clock, MessageSquare, Loader2, Send } from 'lucide-react';
import { formatCLP, digitsOnly } from '../utils/format';

export default function BidModal({ gig, isOpen, onClose, onSubmit, isSubmitting }) {
    const [bidAmount, setBidAmount] = useState('');
    const [etaDays, setEtaDays] = useState('');
    const [message, setMessage] = useState('');
    const [errors, setErrors] = useState({});

    // Limpiar form al cerrarse
    useEffect(() => {
        if (!isOpen) {
            setBidAmount('');
            setEtaDays('');
            setMessage('');
            setErrors({});
        }
    }, [isOpen]);

    // Cerrar con Esc
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !isSubmitting) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen || !gig) return null;

    const validate = () => {
        const e = {};
        const amt = Number(bidAmount);
        const eta = Number(etaDays);
        if (!bidAmount || !Number.isFinite(amt) || amt <= 0) e.bidAmount = 'Ingresa un monto válido';
        else if (amt > 100_000_000) e.bidAmount = 'Monto demasiado alto';
        if (etaDays === '' || !Number.isFinite(eta) || eta < 0 || eta > 365) e.etaDays = 'Entre 0 y 365 días';
        if (message && message.length > 500) e.message = 'Máximo 500 caracteres';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validate()) return;
        await onSubmit({
            bid_amount: Number(bidAmount),
            eta_days: Number(etaDays),
            message: message.trim() || null,
        });
    };

    const handleClose = () => {
        if (isSubmitting) return;
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bid-modal-title"
            onClick={handleClose}
        >
            <div
                className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-in-bottom"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                    <div className="min-w-0 pr-3">
                        <h3 id="bid-modal-title" className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                            Postular al Gig
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{gig.title}</p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50 shrink-0"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                    </button>
                </div>

                <div className="px-6 pt-4 pb-2">
                    <div className="bg-slate-50 dark:bg-slate-700/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                                Presupuesto del cliente
                            </span>
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Referencial</span>
                        </div>
                        <div className="text-emerald-600 dark:text-emerald-400 font-extrabold text-2xl">
                            ${formatCLP(gig.budget)}
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
                    <div>
                        <label htmlFor="bid-amount" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Tu oferta (CLP)
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            <input
                                id="bid-amount"
                                type="text"
                                inputMode="numeric"
                                value={bidAmount ? formatCLP(bidAmount) : ''}
                                onChange={(e) => setBidAmount(digitsOnly(e.target.value))}
                                placeholder="Ej: 45.000"
                                aria-invalid={!!errors.bidAmount}
                                className={`w-full pl-9 pr-4 py-3 border rounded-2xl font-bold text-slate-800 dark:text-slate-100 outline-none transition-colors ${errors.bidAmount
                                        ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-emerald-500 focus:bg-emerald-50/30 dark:focus:bg-slate-700'
                                    }`}
                            />
                        </div>
                        {errors.bidAmount && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">{errors.bidAmount}</p>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            Días para terminar
                        </label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 7].map((d) => (
                                <button
                                    type="button"
                                    key={d}
                                    onClick={() => setEtaDays(String(d))}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${Number(etaDays) === d
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                            : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500'
                                        }`}
                                >
                                    {d === 1 ? 'Mismo día' : `${d} día${d > 1 ? 's' : ''}`}
                                </button>
                            ))}
                        </div>
                        <input
                            type="number"
                            min="0"
                            max="365"
                            value={etaDays}
                            onChange={(e) => setEtaDays(e.target.value)}
                            placeholder="O ingresa otro número"
                            aria-invalid={!!errors.etaDays}
                            aria-label="Días personalizados"
                            className={`mt-2 w-full px-4 py-3 border rounded-2xl font-bold text-slate-800 dark:text-slate-100 outline-none transition-colors ${errors.etaDays
                                    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-indigo-500'
                                }`}
                        />
                        {errors.etaDays && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">{errors.etaDays}</p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="bid-message" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            Mensaje al cliente <span className="text-slate-400 font-medium">(opcional)</span>
                        </label>
                        <textarea
                            id="bid-message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Cuéntale por qué eres el indicado para este trabajo..."
                            maxLength={500}
                            rows={3}
                            aria-invalid={!!errors.message}
                            className={`w-full px-4 py-3 border rounded-2xl font-medium text-slate-800 dark:text-slate-100 outline-none transition-colors resize-none ${errors.message
                                    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-amber-500'
                                }`}
                        />
                        <div className="flex justify-between items-center mt-1">
                            {errors.message ? (
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{errors.message}</p>
                            ) : (
                                <span />
                            )}
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                {message.length}/500
                            </span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-emerald-600 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-100 dark:shadow-none hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:active:scale-100"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" /> Enviando postulación...
                            </>
                        ) : (
                            <>
                                <Send className="w-5 h-5" /> Enviar postulación
                            </>
                        )}
                    </button>

                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                        El cliente recibirá tu oferta y podrá aceptarte o rechazarte. Recibirás una notificación.
                    </p>
                </form>
            </div>
        </div>
    );
}
