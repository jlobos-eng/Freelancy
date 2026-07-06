// Vista de billetera + historial de transacciones REALES (lee wallet_balance + transactions).
// Ahora también: cuentas bancarias + solicitudes de retiro vía RPC request_withdrawal.

import { useState, useMemo } from 'react';
import { CheckCircle2, Wallet, DollarSign, Clock, ArrowDownToLine, AlertCircle } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { SkeletonList } from '../components/SkeletonCard';
import ConnectMpButton from '../components/ConnectMpButton';
import WithdrawModal from '../components/WithdrawModal';
import WithdrawalsList from '../components/WithdrawalsList';
import useWallet from '../hooks/useWallet';
import useWithdrawals from '../hooks/useWithdrawals';
import { formatCLP } from '../utils/format';
import { WITHDRAWAL_MIN_AMOUNT } from '../utils/bancosCL';

export default function WalletView({
    myProfile,
    isLoadingData,
    onJumpToWorkerDashboard,
}) {
    const { balance, transactions, loading: walletLoading } = useWallet(myProfile?.id);
    const {
        withdrawals,
        requestWithdrawal,
        cancelWithdrawal,
        simulateProcess,
    } = useWithdrawals(myProfile?.id);

    const [showWithdraw, setShowWithdraw] = useState(false);
    const [actionError, setActionError] = useState(null);

    // Sólo mostramos transacciones donde el usuario es payee (gana dinero)
    const earnings = transactions.filter((t) => t.payee_id === myProfile?.id);

    // Razones por las que el botón de retiro podría estar bloqueado.
    // Las exponemos abajo del botón para que el user sepa exactamente qué le falta.
    const withdrawBlockReason = useMemo(() => {
        if (balance.available < WITHDRAWAL_MIN_AMOUNT) {
            return `Necesitas al menos $${formatCLP(WITHDRAWAL_MIN_AMOUNT)} disponibles para retirar.`;
        }
        return null;
    }, [balance.available]);

    const canWithdraw = !withdrawBlockReason;

    const handleRequest = async (amount, bankAccountId) => {
        return await requestWithdrawal({ amount, bankAccountId });
    };

    const handleCancel = async (id) => {
        setActionError(null);
        try {
            await cancelWithdrawal(id);
        } catch (e) {
            setActionError(e.message || String(e));
        }
    };

    const handleSimulate = async (id, forceFail) => {
        setActionError(null);
        try {
            await simulateProcess(id, forceFail);
        } catch (e) {
            setActionError(e.message || String(e));
        }
    };

    return (
        <main className="flex-1 px-6 py-8 animate-fade-in space-y-6">
            <div className="bg-emerald-700 dark:bg-emerald-900 text-white p-8 rounded-[40px] shadow-xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-600/40 dark:bg-emerald-700/50 rounded-full" />
                <p className="text-emerald-100 dark:text-emerald-200 text-sm font-medium mb-1">Saldo Disponible</p>
                <h2 className="text-4xl font-extrabold mb-2">
                    ${formatCLP(balance.available)}
                    <span className="text-lg text-emerald-200 dark:text-emerald-300 font-normal"> CLP</span>
                </h2>
                {balance.pending > 0 && (
                    <p className="text-emerald-100 dark:text-emerald-200 text-xs font-medium mb-4 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> + ${formatCLP(balance.pending)} en escrow (esperando aprobación)
                    </p>
                )}
                <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                    <div className="bg-emerald-800/40 dark:bg-emerald-950/40 rounded-xl p-2 text-center">
                        <p className="text-emerald-200">Ingresos totales</p>
                        <p className="font-bold">${formatCLP(balance.lifetime)}</p>
                    </div>
                    <div className="bg-emerald-800/40 dark:bg-emerald-950/40 rounded-xl p-2 text-center">
                        <p className="text-emerald-200">Trabajos completados</p>
                        <p className="font-bold">{balance.completed_jobs}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setShowWithdraw(true)}
                    disabled={!canWithdraw}
                    className={`w-full py-3 rounded-2xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                        canWithdraw
                            ? 'bg-white text-emerald-800 hover:bg-emerald-50 active:scale-95'
                            : 'bg-white/60 text-emerald-900/60 cursor-not-allowed'
                    }`}
                    aria-disabled={!canWithdraw}
                >
                    <ArrowDownToLine className="w-4 h-4" />
                    Transferir a mi banco
                </button>
                {withdrawBlockReason && (
                    <p className="text-[11px] text-emerald-100/90 mt-2 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        {withdrawBlockReason}
                    </p>
                )}
            </div>

            {/* Onboarding Mercado Pago */}
            <ConnectMpButton profile={myProfile} />

            {/* Mensaje de error de acciones (cancelar / simular) */}
            {actionError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{actionError}</span>
                </div>
            )}

            {/* Sección de retiros */}
            <div>
                <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <ArrowDownToLine className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Mis retiros
                </h3>
                <WithdrawalsList
                    withdrawals={withdrawals}
                    onCancel={handleCancel}
                    onSimulate={handleSimulate}
                />
            </div>

            {/* Historial de transacciones (ganancias) */}
            <div>
                <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Historial de transacciones
                </h3>

                {(walletLoading || isLoadingData) && earnings.length === 0 ? (
                    <SkeletonList count={3} variant="history" />
                ) : earnings.length === 0 ? (
                    <EmptyState
                        icon={Wallet}
                        title="Aún no tienes ganancias"
                        body="Cuando completes tu primer trabajo, aparecerá aquí con el monto liberado."
                        cta="Ver gigs disponibles"
                        onCtaClick={onJumpToWorkerDashboard}
                    />
                ) : (
                    <div className="space-y-3">
                        {earnings.map((tx) => {
                            const isReleased = tx.status === 'released';
                            const isEscrowed = tx.status === 'escrowed';
                            return (
                                <div
                                    key={tx.id}
                                    className={`p-4 rounded-2xl shadow-sm border flex items-center justify-between ${isReleased
                                        ? 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700'
                                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`p-2 rounded-xl shrink-0 ${isReleased
                                            ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                            }`}>
                                            {isReleased ? <DollarSign className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                                                {tx.gigs?.title || 'Transacción'}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase truncate">
                                                {isReleased ? 'Liberado' : isEscrowed ? 'En escrow' : tx.status}
                                            </p>
                                        </div>
                                    </div>
                                    <p className={`font-extrabold shrink-0 ml-2 ${isReleased
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-amber-700 dark:text-amber-300'
                                        }`}>
                                        +${formatCLP(tx.amount_net)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal de retiro */}
            {showWithdraw && (
                <WithdrawModal
                    profile={myProfile}
                    available={balance.available}
                    onClose={() => setShowWithdraw(false)}
                    onRequestWithdrawal={handleRequest}
                />
            )}
        </main>
    );
}
