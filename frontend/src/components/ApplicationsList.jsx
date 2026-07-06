// ApplicationsList — lista ordenada de postulaciones. Dark-mode aware.
// El cliente ve cada Lancy con su oferta y puede aceptar.

import { Star, Clock, MessageSquare, CheckCircle2, Loader2, Inbox } from 'lucide-react';
import EmptyState from './EmptyState';
import { formatCLP, formatEta } from '../utils/format';
import { avatarFor } from '../utils/avatar';

function ApplicationCard({ application, onAccept, isAcceptingId }) {
    const worker = application.profiles || {};
    const isAccepting = isAcceptingId === application.id;
    const isAccepted = application.status === 'accepted';
    const isRejected = application.status === 'rejected';

    return (
        <div
            className={`p-4 rounded-2xl border transition-all ${isAccepted
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30 shadow-md shadow-emerald-100 dark:shadow-none'
                    : isRejected
                        ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-60'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-600 hover:shadow-md'
                }`}
        >
            <div className="flex items-start gap-3">
                <img
                    src={avatarFor(worker)}
                    alt={worker.full_name || 'Lancy'}
                    className={`w-12 h-12 rounded-full object-cover border-2 ${isAccepted ? 'border-emerald-500' : 'border-slate-200 dark:border-slate-600'
                        }`}
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                                    {worker.full_name || 'Lancy'}
                                </span>
                                {isAccepted && (
                                    <span className="text-[9px] font-extrabold uppercase bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                                        Aceptado
                                    </span>
                                )}
                                {isRejected && (
                                    <span className="text-[9px] font-extrabold uppercase bg-slate-400 dark:bg-slate-600 text-white px-1.5 py-0.5 rounded">
                                        Rechazado
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-0.5">
                                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                    {worker.rating ? Number(worker.rating).toFixed(1) : 'Nuevo'}
                                </span>
                                {worker.skill && (
                                    <>
                                        <span className="text-slate-300 dark:text-slate-600">·</span>
                                        <span className="truncate">{worker.skill}</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-emerald-600 dark:text-emerald-400 font-extrabold text-base leading-none">
                                ${formatCLP(application.bid_amount)}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1 flex items-center gap-1 justify-end">
                                <Clock className="w-3 h-3" />
                                {formatEta(application.eta_days)}
                            </div>
                        </div>
                    </div>

                    {application.message && (
                        <div className="mt-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                            <div className="flex items-start gap-2">
                                <MessageSquare className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {application.message}
                                </p>
                            </div>
                        </div>
                    )}

                    {!isAccepted && !isRejected && onAccept && (
                        <button
                            onClick={() => onAccept(application)}
                            disabled={isAccepting}
                            className="mt-3 w-full py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:active:scale-100"
                        >
                            {isAccepting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Aceptando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" /> Aceptar a {worker.full_name?.split(' ')[0] || 'este Lancy'}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ApplicationsList({
    applications = [],
    isLoading = false,
    onAccept,
    isAcceptingId,
}) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2].map((i) => (
                    <div
                        key={i}
                        className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 animate-pulse"
                    >
                        <div className="flex gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                                <div className="h-2 bg-slate-100 dark:bg-slate-700/60 rounded w-1/2" />
                                <div className="h-8 bg-slate-100 dark:bg-slate-700/60 rounded mt-3" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (!applications.length) {
        return (
            <EmptyState
                icon={Inbox}
                title="Aún no hay postulaciones"
                body="Los Lancys verán tu Gig en su zona y empezarán a postular pronto. Te avisaremos cuando llegue la primera."
                variant="soft"
            />
        );
    }

    const sorted = [...applications].sort((a, b) => {
        if (a.status === 'accepted') return -1;
        if (b.status === 'accepted') return 1;
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return (a.bid_amount || 0) - (b.bid_amount || 0);
    });

    return (
        <div className="space-y-3">
            {sorted.map((app) => (
                <ApplicationCard
                    key={app.id}
                    application={app}
                    onAccept={onAccept}
                    isAcceptingId={isAcceptingId}
                />
            ))}
        </div>
    );
}
