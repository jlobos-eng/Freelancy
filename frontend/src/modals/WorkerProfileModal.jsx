// Modal con perfil público del Lancy + CTA para contratar.

import { X, Star } from 'lucide-react';
import { avatarFor } from '../utils/avatar';

export default function WorkerProfileModal({ worker, onClose, onHire }) {
    if (!worker) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl animate-zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative h-32 bg-indigo-600 dark:bg-indigo-700">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md transition-all"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-8 pb-8 -mt-12 relative z-10">
                    <div className="flex flex-col items-center text-center">
                        <img
                            src={avatarFor(worker)}
                            className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 object-cover shadow-lg mb-4 bg-white dark:bg-slate-700"
                            alt={worker.full_name || 'Lancy'}
                        />
                        <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                            {worker.full_name}
                        </h3>
                        <p className="text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-2">
                            {worker.skill || 'Multiservicios'}
                        </p>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="flex flex-col items-center">
                                <span className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                    {worker.rating ? Number(worker.rating).toFixed(1) : 'Nuevo'}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                                    Rating
                                </span>
                            </div>
                            <div className="w-px h-8 bg-slate-100 dark:bg-slate-700" />
                            <div className="flex flex-col items-center">
                                <span className="text-lg font-black text-slate-800 dark:text-slate-100">
                                    {worker.location || 'Chile'}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                                    Ubicación
                                </span>
                            </div>
                        </div>

                        <div className="w-full text-left bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl mb-6 border border-slate-100 dark:border-slate-700">
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">
                                Biografía
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
                                &ldquo;{worker.bio || 'Este Lancy prefiere que su trabajo hable por él.'}&rdquo;
                            </p>
                        </div>

                        <button
                            onClick={onHire}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all"
                        >
                            Contratar a {worker.full_name?.split(' ')[0] || 'este Lancy'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
