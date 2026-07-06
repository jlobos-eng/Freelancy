// WithdrawalsList — historial de retiros del usuario.
// Muestra estado, monto, banco, y permite cancelar si está 'requested'.
// En modo dev también expone botones "Simular pago / Simular falla".

import { ArrowDownToLine, CheckCircle2, Clock, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { formatCLP, formatRelative } from '../utils/format';
import { WITHDRAWAL_STATUS_LABEL, BANCOS_CL_FALLBACK } from '../utils/bancosCL';

const SHOW_SIMULATE_CONTROLS = import.meta.env.VITE_WITHDRAWAL_SIMULATE === 'true';

const STATUS_STYLES = {
    requested:  { icon: Clock,        color: 'text-amber-600 dark:text-amber-400',       bg: 'bg-amber-100 dark:bg-amber-900/40' },
    processing: { icon: Loader2,      color: 'text-sky-600 dark:text-sky-400',           bg: 'bg-sky-100 dark:bg-sky-900/40',     spin: true },
    paid:       { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400',   bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
    failed:     { icon: AlertCircle,  color: 'text-rose-600 dark:text-rose-400',         bg: 'bg-rose-100 dark:bg-rose-900/40' },
    cancelled:  { icon: XCircle,      color: 'text-slate-500 dark:text-slate-400',       bg: 'bg-slate-200 dark:bg-slate-700' },
};

function bankLabel(code) {
    return BANCOS_CL_FALLBACK.find((b) => b.code === code)?.short_name
        || BANCOS_CL_FALLBACK.find((b) => b.code === code)?.name
        || code;
}

export default function WithdrawalsList({ withdrawals, onCancel, onSimulate }) {
    if (!withdrawals || withdrawals.length === 0) {
        return (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center">
                <ArrowDownToLine className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Aún no has solicitado ningún retiro.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {withdrawals.map((w) => {
                const style = STATUS_STYLES[w.status] || STATUS_STYLES.requested;
                const Icon = style.icon;
                const snap = w.snapshot || {};
                return (
                    <div
                        key={w.id}
                        className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center justify-between gap-3"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2 rounded-xl shrink-0 ${style.bg}`}>
                                <Icon className={`w-5 h-5 ${style.color} ${style.spin ? 'animate-spin' : ''}`} />
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                                    Retiro a {bankLabel(snap.bank_code)}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">
                                    {WITHDRAWAL_STATUS_LABEL[w.status] || w.status} · {formatRelative(w.created_at)}
                                </p>
                                {w.failure_reason && (
                                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 truncate">
                                        {w.failure_reason}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className={`font-extrabold text-sm ${w.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                −${formatCLP(w.amount)}
                            </p>
                            <div className="flex gap-1 justify-end mt-1">
                                {w.status === 'requested' && onCancel && (
                                    <button
                                        onClick={() => onCancel(w.id)}
                                        className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
                                    >
                                        Cancelar
                                    </button>
                                )}
                                {SHOW_SIMULATE_CONTROLS && w.status === 'requested' && onSimulate && (
                                    <>
                                        <button
                                            onClick={() => onSimulate(w.id, false)}
                                            className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                            title="Simular pago exitoso (dev only)"
                                        >
                                            Sim ✓
                                        </button>
                                        <button
                                            onClick={() => onSimulate(w.id, true)}
                                            className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                                            title="Simular rechazo (dev only)"
                                        >
                                            Sim ✗
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
