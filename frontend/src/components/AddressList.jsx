// AddressList — render de las direcciones del usuario, con CTAs de
// agregar / editar / eliminar / marcar primary.

import { Home, MapPin, Edit3, Trash2, Plus, Star } from 'lucide-react';
import EmptyState from './EmptyState';

function formatAddressLine(a) {
    const street = [a.street, a.number].filter(Boolean).join(' ');
    const apt = a.apartment ? ` — ${a.apartment}` : '';
    return `${street}${apt}`;
}

export default function AddressList({
    addresses = [],
    onAdd,
    onEdit,
    onDelete,
    onSetPrimary,
    isLoading,
}) {
    if (!isLoading && addresses.length === 0) {
        return (
            <div className="space-y-3">
                <EmptyState
                    icon={MapPin}
                    title="Sin direcciones todavía"
                    body="Agrega al menos una dirección para publicar gigs o aparecer en el mapa."
                    cta="+ Nueva dirección"
                    onCtaClick={onAdd}
                    variant="dashed"
                />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {addresses.map((a) => (
                <div
                    key={a.id}
                    className={`p-4 rounded-2xl border transition-all ${a.is_primary
                        ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                        }`}
                >
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl shrink-0 ${a.is_primary
                            ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            }`}>
                            <Home className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                {a.label && (
                                    <span className="text-xs font-extrabold uppercase text-indigo-700 dark:text-indigo-300">
                                        {a.label}
                                    </span>
                                )}
                                {a.is_primary && (
                                    <span className="text-[9px] font-extrabold uppercase bg-indigo-600 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                        <Star className="w-2.5 h-2.5 fill-white" /> Principal
                                    </span>
                                )}
                            </div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-0.5">
                                {formatAddressLine(a)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {[a.comuna, a.city, a.region].filter(Boolean).join(', ')}
                            </p>
                            {a.instructions && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1 line-clamp-2">
                                    {a.instructions}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        {!a.is_primary && onSetPrimary && (
                            <button
                                onClick={() => onSetPrimary(a.id)}
                                className="flex-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 py-2 rounded-lg transition-all"
                            >
                                Marcar principal
                            </button>
                        )}
                        {onEdit && (
                            <button
                                onClick={() => onEdit(a)}
                                className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 py-2 rounded-lg transition-all flex items-center justify-center gap-1"
                            >
                                <Edit3 className="w-3.5 h-3.5" /> Editar
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(a.id)}
                                className="text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-2 rounded-lg transition-all"
                                aria-label="Eliminar"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            ))}

            {onAdd && (
                <button
                    onClick={onAdd}
                    className="w-full py-3 border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded-2xl font-bold text-sm hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Nueva dirección
                </button>
            )}
        </div>
    );
}
