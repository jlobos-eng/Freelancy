// DisputeModal — modal para abrir una disputa sobre un gig.
// Reusa el lenguaje visual de BidModal (bottom-sheet, dark-mode aware,
// cierre con Esc / click en overlay).

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';

const REASONS = [
    { value: 'work_incomplete', label: 'Trabajo incompleto', body: 'El Lancy dejó la pega a medias.' },
    { value: 'no_show', label: 'No se presentó', body: 'No apareció el día acordado.' },
    { value: 'misconduct', label: 'Mala conducta', body: 'Trato inapropiado o irrespeto.' },
    { value: 'damage', label: 'Daño a propiedad', body: 'Causó un daño durante la pega.' },
    { value: 'overcharge', label: 'Cobro excesivo', body: 'Cobró más de lo acordado.' },
    { value: 'fraud', label: 'Estafa o engaño', body: 'Servicio fraudulento o falso.' },
    { value: 'other', label: 'Otro motivo', body: 'Describe el problema en detalle.' },
];

export default function DisputeModal({ gig, isOpen, onClose, onSubmit, isSubmitting }) {
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!isOpen) {
            setReason('');
            setDescription('');
            setErrors({});
        }
    }, [isOpen]);

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
        if (!reason) e.reason = 'Selecciona un motivo';
        if (description && description.length > 1000) e.description = 'Máximo 1000 caracteres';
        if (reason === 'other' && (!description || description.trim().length < 10)) {
            e.description = 'Describe el problema (mínimo 10 caracteres)';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validate()) return;
        await onSubmit({ reason, description: description.trim() || null });
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
            aria-labelledby="dispute-modal-title"
            onClick={handleClose}
        >
            <div
                className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-in-bottom"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                        <div className="bg-red-100 dark:bg-red-900/40 p-2 rounded-xl text-red-600 dark:text-red-400 shrink-0">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 id="dispute-modal-title" className="font-extrabold text-slate-800 dark:text-slate-100 text-lg leading-tight">
                                Reportar problema
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{gig.title}</p>
                        </div>
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

                {/* Aviso */}
                <div className="px-6 pt-4 pb-2">
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                            Al abrir una disputa, <strong>el pago queda en pausa</strong> hasta que se resuelva.
                            Úsala con responsabilidad — los reportes falsos pueden resultar en suspensión.
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-4">
                    {/* Motivo */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 block">
                            ¿Qué pasó?
                        </label>
                        <div className="space-y-2">
                            {REASONS.map((r) => (
                                <button
                                    type="button"
                                    key={r.value}
                                    onClick={() => setReason(r.value)}
                                    className={`w-full text-left p-3 rounded-2xl border transition-all ${reason === r.value
                                        ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 ring-2 ring-red-200 dark:ring-red-800'
                                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-red-200 dark:hover:border-red-700'
                                        }`}
                                >
                                    <div className={`text-sm font-bold ${reason === r.value ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-100'}`}>
                                        {r.label}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {r.body}
                                    </div>
                                </button>
                            ))}
                        </div>
                        {errors.reason && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">{errors.reason}</p>
                        )}
                    </div>

                    {/* Descripción */}
                    <div>
                        <label htmlFor="dispute-description" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 block">
                            Cuéntanos los detalles {reason === 'other' && <span className="text-red-600">*</span>}
                        </label>
                        <textarea
                            id="dispute-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Qué pasó, cuándo, qué intentaste para resolverlo..."
                            maxLength={1000}
                            rows={4}
                            aria-invalid={!!errors.description}
                            className={`w-full px-4 py-3 border rounded-2xl font-medium text-sm text-slate-800 dark:text-slate-100 outline-none transition-colors resize-none ${errors.description
                                ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-red-500 focus:bg-red-50/30 dark:focus:bg-slate-700'
                                }`}
                        />
                        <div className="flex justify-between items-center mt-1">
                            {errors.description ? (
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{errors.description}</p>
                            ) : <span />}
                            <span className="text-xs text-slate-400 font-medium">{description.length}/1000</span>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isSubmitting || !reason}
                        className="w-full py-4 bg-red-600 text-white font-extrabold rounded-2xl shadow-lg shadow-red-100 dark:shadow-none hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" /> Enviando reporte...
                            </>
                        ) : (
                            <>
                                <ShieldAlert className="w-5 h-5" /> Abrir disputa
                            </>
                        )}
                    </button>

                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                        Recibirás una confirmación. Nuestro equipo revisará el caso en las próximas 48 horas.
                    </p>
                </form>
            </div>
        </div>
    );
}
