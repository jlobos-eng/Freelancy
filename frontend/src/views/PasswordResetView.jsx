// PasswordResetView — handle del callback de "Olvidé mi contraseña".
//
// Flow:
//   1. Usuario pide reset desde LoginView (resetPasswordForEmail).
//   2. Recibe email con link → /auth/reset#access_token=...&type=recovery
//   3. Supabase auto-procesa el hash (detectSessionInUrl=true) y crea una
//      "recovery session" temporal: el usuario está logueado pero sólo para
//      cambiar su password.
//   4. Esta vista pide la nueva password y llama updateUser.
//   5. Tras éxito, hace signOut y redirige al login para que entre con la
//      nueva password (más limpio que dejarlo logueado con recovery session).

import { useEffect, useState } from 'react';
import { Lock, Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

export default function PasswordResetView() {
    const [status, setStatus] = useState('verifying'); // 'verifying' | 'ready' | 'success' | 'error'
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Verificar que llegamos con una recovery session válida
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!supabase) {
                setStatus('error');
                setErrorMsg('Supabase no configurado.');
                return;
            }
            // Esperar un tick para que detectSessionInUrl procese el hash
            await new Promise((r) => setTimeout(r, 200));
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (cancelled) return;
                if (error) throw error;
                if (!session) {
                    setStatus('error');
                    setErrorMsg('Link inválido o expirado. Pide un nuevo email de recuperación.');
                    return;
                }
                setStatus('ready');
            } catch (err) {
                if (cancelled) return;
                setStatus('error');
                setErrorMsg(err.message || 'Error verificando el link.');
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password.length < 6) {
            setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (password !== confirm) {
            setErrorMsg('Las contraseñas no coinciden.');
            return;
        }
        setLoading(true);
        setErrorMsg('');
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            // Cerramos la recovery session y forzamos login limpio
            await supabase.auth.signOut();
            setStatus('success');
            toast.success('Contraseña actualizada');
            // Limpiar el hash de la URL antes de redirigir
            window.history.replaceState({}, '', '/');
            setTimeout(() => { window.location.href = '/'; }, 2000);
        } catch (err) {
            setErrorMsg(err.message || 'No pudimos actualizar la contraseña.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 transition-colors">
            <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-700">
                <div className="flex justify-center mb-6">
                    <div className="bg-indigo-600 p-4 rounded-2xl">
                        <ShieldCheck className="w-10 h-10 text-white" />
                    </div>
                </div>
                <h1 className="text-2xl font-extrabold text-center text-slate-800 dark:text-slate-100 mb-2">
                    Restablecer contraseña
                </h1>

                {status === 'verifying' && (
                    <div className="text-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Verificando tu link...
                        </p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center py-4">
                        <div className="bg-red-100 dark:bg-red-900/40 p-3 rounded-2xl w-fit mx-auto mb-3">
                            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                            {errorMsg}
                        </p>
                        <button
                            onClick={() => { window.location.href = '/'; }}
                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all"
                        >
                            Volver al inicio
                        </button>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center py-4">
                        <div className="bg-emerald-100 dark:bg-emerald-900/40 p-3 rounded-2xl w-fit mx-auto mb-3">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            ¡Listo! Te redirigimos al inicio para que entres con tu nueva contraseña.
                        </p>
                    </div>
                )}

                {status === 'ready' && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Elige una contraseña nueva (mínimo 6 caracteres).
                        </p>

                        {errorMsg && (
                            <div className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 p-3 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900 text-center">
                                {errorMsg}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-200 pl-1">
                                Nueva contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-200 pl-1">
                                Repetir contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-70"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar nueva contraseña'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
