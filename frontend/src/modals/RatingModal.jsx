// Modal para calificar al Lancy y liberar el pago.

import { Star } from 'lucide-react';

export default function RatingModal({ isOpen, stars, onChangeStars, onSubmit, onClose }) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[40px] p-8 text-center shadow-2xl animate-zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    ¡Trabajo Terminado!
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    ¿Qué te pareció el servicio del Lancy?
                </p>

                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onClick={() => onChangeStars(star)}
                            aria-label={`${star} estrellas`}
                            className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        >
                            <Star
                                className={`w-10 h-10 cursor-pointer transition-all hover:scale-110 ${star <= stars
                                        ? 'text-amber-400 fill-amber-400'
                                        : 'text-slate-200 dark:text-slate-600 fill-slate-50 dark:fill-slate-700'
                                    }`}
                            />
                        </button>
                    ))}
                </div>

                <button
                    onClick={onSubmit}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all"
                >
                    Calificar y Liberar Pago
                </button>
            </div>
        </div>
    );
}
