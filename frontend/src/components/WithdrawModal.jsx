// WithdrawModal — flujo completo de "Transferir a mi banco":
//   Step 1: Si no tiene cuenta bancaria → BankAccountForm.
//   Step 2: Elegir cuenta destino (si tiene varias) + monto.
//   Step 3: Confirmación con resumen + nota de "modo simulado".
//   Step 4: Éxito → muestra el id del retiro y CTA para volver.
//
// Hace TODOS los writes vía RPC (request_withdrawal). Cero INSERT directo.

import { useState, useMemo, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, Loader2, Building2, ArrowRight, Plus, Star } from 'lucide-react';
import BankAccountForm from './BankAccountForm';
import useBankAccounts from '../hooks/useBankAccounts';
import { formatCLP } from '../utils/format';
import { BANCOS_CL_FALLBACK, TIPOS_CUENTA, WITHDRAWAL_MIN_AMOUNT, WITHDRAWAL_MAX_AMOUNT } from '../utils/bancosCL';
import { formatRut } from '../utils/rut';

const STEP_FORM = 'form';
const STEP_PICK = 'pick';
const STEP_CONFIRM = 'confirm';
const STEP_DONE = 'done';

function bankLabel(code) {
    return BANCOS_CL_FALLBACK.find((b) => b.code === code)?.name || code;
}
function accountTypeLabel(value) {
    return TIPOS_CUENTA.find((t) => t.value === value)?.label || value;
}

export default function WithdrawModal({
    profile,
    available,           // saldo disponible (CLP)
    onClose,
    onRequestWithdrawal, // (amount, bankAccountId) => Promise<id>
}) {
    const userId = profile?.id;
    const { accounts, loading, addAccount } = useBankAccounts(userId);

    const [step, setStep] = useState(loading ? STEP_PICK : STEP_PICK);
    const [selectedAccountId, setSelectedAccountId] = useState(null);
    const [amountInput, setAmountInput] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [resultId, setResultId] = useState(null);

    // Cuando cargan las cuentas, decidir si arrancamos en form o pick.
    useEffect(() => {
        if (loading) return;
        if (accounts.length === 0) {
            setStep(STEP_FORM);
        } else if (!selectedAccountId) {
            const primary = accounts.find((a) => a.is_primary) || accounts[0];
            setSelectedAccountId(primary.id);
            setStep(STEP_PICK);
        }
    }, [loading, accounts, selectedAccountId]);

    const amount = useMemo(() => {
        const n = Number(String(amountInput).replace(/\D/g, ''));
        return Number.isFinite(n) ? n : 0;
    }, [amountInput]);

    const amountError = useMemo(() => {
        if (amount === 0) return null;
        if (amount < WITHDRAWAL_MIN_AMOUNT) return `El mínimo es $${formatCLP(WITHDRAWAL_MIN_AMOUNT)}.`;
        if (amount > WITHDRAWAL_MAX_AMOUNT) return `El máximo por retiro es $${formatCLP(WITHDRAWAL_MAX_AMOUNT)}.`;
        if (amount > available) return `Excede tu saldo disponible ($${formatCLP(available)}).`;
        return null;
    }, [amount, available]);

    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

    const canConfirm = amount > 0 && !amountError && !!selectedAccountId;

    const handleAddAccount = async (payload) => {
        const created = await addAccount(payload);
        setSelectedAccountId(created.id);
        setStep(STEP_PICK);
    };

    const handleConfirm = async () => {
        if (!canConfirm) return;
        setSubmitting(true);
        setError(null);
        try {
            const id = await onRequestWithdrawal(amount, selectedAccountId);
            setResultId(id);
            setStep(STEP_DONE);
        } catch (err) {
            setError(err.message || String(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleQuickAmount = (frac) => {
        const v = Math.floor(available * frac / 1000) * 1000; // redondeo a miles
        setAmountInput(String(v));
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between z-10">
                    <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                        {step === STEP_DONE ? 'Solicitud creada' : 'Transferir a mi banco'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Banner modo simulado — siempre visible salvo en DONE */}
                    {step !== STEP_DONE && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                                <strong>Modo prueba:</strong> los retiros se registran en tu historial pero todavía no
                                se transfieren a un banco real. Pronto habilitaremos la conexión con Mercado Pago Payouts.
                            </span>
                        </div>
                    )}

                    {/* STEP: Form de cuenta nueva */}
                    {step === STEP_FORM && (
                        <BankAccountForm
                            onSubmit={handleAddAccount}
                            onCancel={accounts.length > 0 ? () => setStep(STEP_PICK) : null}
                        />
                    )}

                    {/* STEP: Pick cuenta + monto */}
                    {step === STEP_PICK && (
                        <>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Cuenta destino</span>
                                    <button
                                        onClick={() => setStep(STEP_FORM)}
                                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Agregar otra
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {accounts.map((a) => {
                                        const active = a.id === selectedAccountId;
                                        return (
                                            <button
                                                key={a.id}
                                                type="button"
                                                onClick={() => setSelectedAccountId(a.id)}
                                                className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition ${
                                                    active
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700'
                                                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                                                }`}
                                            >
                                                <Building2 className={`w-5 h-5 shrink-0 ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate flex items-center gap-1">
                                                        {bankLabel(a.bank_code)}
                                                        {a.is_primary && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                        {accountTypeLabel(a.account_type)} · ••••{a.account_number.slice(-4)}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Monto a retirar</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        Disponible: <strong className="text-emerald-600 dark:text-emerald-400">${formatCLP(available)}</strong>
                                    </span>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-lg">$</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={amountInput ? formatCLP(amount) : ''}
                                        onChange={(e) => setAmountInput(e.target.value)}
                                        placeholder="0"
                                        className={`w-full pl-8 pr-3 py-3 rounded-xl border outline-none focus:ring-2 text-2xl font-extrabold ${
                                            amountError
                                                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 focus:ring-rose-400'
                                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-emerald-500'
                                        }`}
                                    />
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {[0.25, 0.5, 1].map((f) => (
                                        <button
                                            key={f}
                                            type="button"
                                            onClick={() => handleQuickAmount(f)}
                                            disabled={available < WITHDRAWAL_MIN_AMOUNT}
                                            className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-40"
                                        >
                                            {f === 1 ? 'Todo' : `${Math.round(f * 100)}%`}
                                        </button>
                                    ))}
                                </div>
                                {amountError && (
                                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> {amountError}
                                    </p>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setStep(STEP_CONFIRM)}
                                disabled={!canConfirm}
                                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold shadow active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                Continuar <ArrowRight className="w-4 h-4" />
                            </button>
                        </>
                    )}

                    {/* STEP: Confirmación */}
                    {step === STEP_CONFIRM && selectedAccount && (
                        <>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">Monto</p>
                                    <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                                        ${formatCLP(amount)} <span className="text-base text-slate-500 font-normal">CLP</span>
                                    </p>
                                </div>
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-1.5 text-sm">
                                    <Row label="Banco" value={bankLabel(selectedAccount.bank_code)} />
                                    <Row label="Tipo" value={accountTypeLabel(selectedAccount.account_type)} />
                                    <Row label="Número" value={selectedAccount.account_number} mono />
                                    <Row label="Titular" value={selectedAccount.holder_name} />
                                    <Row label="RUT" value={formatRut(selectedAccount.holder_rut)} mono />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStep(STEP_PICK)}
                                    disabled={submitting}
                                    className="flex-1 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold active:scale-95 transition disabled:opacity-50"
                                >
                                    Atrás
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={submitting}
                                    className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold shadow active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Confirmar retiro
                                </button>
                            </div>
                        </>
                    )}

                    {/* STEP: Done */}
                    {step === STEP_DONE && (
                        <div className="text-center py-4 space-y-3">
                            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">¡Solicitud registrada!</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                                Tu retiro de <strong>${formatCLP(amount)}</strong> quedó en tu historial con estado
                                <strong> Solicitado</strong>. Cuando habilitemos los pagos reales, se procesará automáticamente.
                            </p>
                            {resultId && (
                                <p className="text-[10px] text-slate-400 font-mono">
                                    ID: {resultId}
                                </p>
                            )}
                            <button
                                onClick={onClose}
                                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold shadow active:scale-95"
                            >
                                Volver a mi billetera
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Row({ label, value, mono = false }) {
    return (
        <div className="flex justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400">{label}</span>
            <span className={`text-slate-800 dark:text-slate-200 text-right truncate ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
        </div>
    );
}
