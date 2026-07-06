// BankAccountForm — agregar una cuenta bancaria chilena.
// Valida RUT con módulo 11 client-side (mismo algoritmo que el backend).
// Se usa dentro del WithdrawModal cuando el user no tiene cuentas registradas.

import { useState, useMemo } from 'react';
import { Building2, AlertCircle, Loader2 } from 'lucide-react';
import { isValidRut, formatRut, cleanRut } from '../utils/rut';
import { BANCOS_CL_FALLBACK, TIPOS_CUENTA } from '../utils/bancosCL';

export default function BankAccountForm({ onSubmit, onCancel, defaultEmail = '' }) {
    const [holderName, setHolderName] = useState('');
    const [holderRut, setHolderRut] = useState('');
    const [bankCode, setBankCode] = useState('012'); // BancoEstado por default
    const [accountType, setAccountType] = useState('corriente');
    const [accountNumber, setAccountNumber] = useState('');
    const [contactEmail, setContactEmail] = useState(defaultEmail);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const rutValid = useMemo(() => holderRut === '' || isValidRut(holderRut), [holderRut]);

    const canSubmit =
        holderName.trim().length >= 3 &&
        isValidRut(holderRut) &&
        bankCode &&
        accountType &&
        accountNumber.trim().length >= 4 &&
        !submitting;

    const handleRutBlur = () => {
        if (holderRut && isValidRut(holderRut)) {
            setHolderRut(formatRut(holderRut));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            await onSubmit({
                holder_name: holderName.trim(),
                holder_rut: cleanRut(holderRut),
                bank_code: bankCode,
                account_type: accountType,
                account_number: accountNumber.trim(),
                contact_email: contactEmail.trim() || null,
            });
        } catch (err) {
            setError(err.message || String(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 mb-2">
                <Building2 className="w-5 h-5" />
                <h3 className="font-bold">Datos de tu cuenta bancaria</h3>
            </div>

            {/* Nombre del titular */}
            <label className="block">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Nombre del titular</span>
                <input
                    type="text"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    placeholder="Ej: Juan Pérez González"
                    className="mt-1 w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                    autoComplete="name"
                    required
                />
            </label>

            {/* RUT */}
            <label className="block">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">RUT del titular</span>
                <input
                    type="text"
                    value={holderRut}
                    onChange={(e) => setHolderRut(e.target.value)}
                    onBlur={handleRutBlur}
                    placeholder="12.345.678-9"
                    className={`mt-1 w-full p-3 rounded-xl border outline-none focus:ring-2 ${
                        !rutValid
                            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 focus:ring-rose-400'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-emerald-500'
                    }`}
                    inputMode="text"
                    required
                />
                {!rutValid && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> RUT inválido. Verifica el dígito verificador.
                    </span>
                )}
            </label>

            {/* Banco */}
            <label className="block">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Banco</span>
                <select
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    className="mt-1 w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                >
                    {BANCOS_CL_FALLBACK.map((b) => (
                        <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                </select>
            </label>

            {/* Tipo de cuenta */}
            <label className="block">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Tipo de cuenta</span>
                <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="mt-1 w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                >
                    {TIPOS_CUENTA.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
            </label>

            {/* Número de cuenta */}
            <label className="block">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Número de cuenta</span>
                <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ''))}
                    placeholder="Sólo dígitos / letras según el banco"
                    className="mt-1 w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    inputMode="text"
                    required
                />
            </label>

            {/* Email contacto */}
            <label className="block">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                    Email para notificaciones <span className="text-slate-400 normal-case font-normal">(opcional)</span>
                </span>
                <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="mt-1 w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                    autoComplete="email"
                />
            </label>

            {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <div className="flex gap-2 pt-2">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm active:scale-95 transition disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                )}
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Guardar cuenta
                </button>
            </div>
        </form>
    );
}
