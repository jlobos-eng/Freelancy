// LoginView — autenticación real.
// - Google OAuth (signInWithOAuth provider 'google')
// - Microsoft OAuth (provider 'azure')
// - Email + password con tabs Login/Crear cuenta + confirmación email obligatoria.
// - "Olvidé mi contraseña" → resetPasswordForEmail. La vista de set-new-password
//   vive en PasswordResetView y se monta cuando llega el callback recovery.
//
// El listener auth en App.jsx detecta la session que Supabase setea automáticamente
// gracias a detectSessionInUrl=true, así que no hay callback custom para OAuth.

import { useState, useEffect } from 'react';
import { ShieldCheck, Database, Mail, Lock, ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import { supabase } from '../services/supabase';

// URL de retorno tras OAuth o recovery — siempre el origin actual.
function getReturnUrl(suffix = '') {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${suffix}`;
}

export default function LoginView({ onNext }) {
    const [dbStatus, setDbStatus] = useState('Verificando conexión...');
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState(null); // 'google' | 'azure' | null
    const [errorMsg, setErrorMsg] = useState('');
    const [infoMsg, setInfoMsg] = useState('');
    const [pendingConfirmEmail, setPendingConfirmEmail] = useState(null); // si signUp pidió confirmar

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { error } = await supabase.auth.getSession();
                if (cancelled) return;
                if (error) throw error;
                setDbStatus('✅ Supabase Conectado');
            } catch (err) {
                if (cancelled) return;
                console.error(err);
                setDbStatus('❌ Error de conexión (.env)');
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const translateError = (msg = '') => {
        if (msg.includes('Password should be at least 6')) return 'La contraseña debe tener al menos 6 caracteres.';
        if (msg.includes('Invalid login credentials')) return 'Credenciales inválidas. Revisa correo y contraseña.';
        if (msg.includes('Email not confirmed')) return 'Debes confirmar tu correo antes de entrar. Revisa tu bandeja (y spam).';
        if (msg.includes('User already registered')) return 'Ese correo ya está registrado. Cambia a "Entrar".';
        if (msg.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos.';
        if (msg.includes('not enabled') || msg.includes('Provider is disabled')) return 'Este método aún no está habilitado en el servidor. Contacta al soporte.';
        return 'Error al acceder. Revisa tus datos.';
    };

    // ---------- OAuth (Google / Microsoft) ----------
    const handleOAuth = async (provider) => {
        if (oauthLoading) return;
        setOauthLoading(provider);
        setErrorMsg('');
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: getReturnUrl('/'),
                    // Reclamamos los scopes mínimos para tener nombre y avatar
                    scopes: provider === 'google'
                        ? 'openid email profile'
                        : 'openid email profile User.Read',
                },
            });
            // Si signInWithOAuth devuelve sin error, el browser ya está navegando
            // al provider — no hacemos nada más. Si error, mostramos.
            if (error) throw error;
        } catch (err) {
            setErrorMsg(translateError(err.message || ''));
            setOauthLoading(null);
        }
    };

    // ---------- Email/password ----------
    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        setInfoMsg('');

        if (!email.includes('@') || email.length < 5) {
            setErrorMsg('Ingresa un correo válido.');
            setLoading(false);
            return;
        }

        // Forgot: resetPasswordForEmail no requiere password
        if (authMode === 'forgot') {
            try {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: getReturnUrl('/auth/reset'),
                });
                if (error) throw error;
                setInfoMsg('Si el correo existe, te enviamos un link para restablecer tu contraseña.');
                setPassword('');
            } catch (err) {
                setErrorMsg(translateError(err.message || ''));
            } finally {
                setLoading(false);
            }
            return;
        }

        if (password.length < 6) {
            setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
            setLoading(false);
            return;
        }

        try {
            if (authMode === 'signin') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onNext();
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: getReturnUrl('/'),
                    },
                });
                if (error) throw error;
                if (!data.session) {
                    // Confirmación de email obligatoria — Supabase está configurado así.
                    setPendingConfirmEmail(email);
                    setInfoMsg(`Cuenta creada. Te enviamos un email a ${email} para confirmar tu cuenta.`);
                    setAuthMode('signin');
                    setLoading(false);
                    return;
                }
                onNext();
            }
        } catch (err) {
            setErrorMsg(translateError(err.message || ''));
        } finally {
            setLoading(false);
        }
    };

    const handleResendConfirmation = async () => {
        if (!pendingConfirmEmail) return;
        setLoading(true);
        setErrorMsg('');
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: pendingConfirmEmail,
                options: { emailRedirectTo: getReturnUrl('/') },
            });
            if (error) throw error;
            setInfoMsg('Reenviamos el email de confirmación. Revisa tu bandeja y spam.');
        } catch (err) {
            setErrorMsg(translateError(err.message || ''));
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (next) => {
        setAuthMode(next);
        setErrorMsg('');
        setInfoMsg('');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6 transition-colors">
            <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-700 transition-all duration-300">
                <div className="flex justify-center mb-8">
                    <div className="bg-indigo-600 p-4 rounded-2xl">
                        <ShieldCheck className="w-12 h-12 text-white" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-center text-slate-800 dark:text-slate-100 mb-2">
                    Freelancy
                </h1>
                <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
                    Tu confianza líquida para el trabajo flexible.
                </p>

                {!showEmailForm ? (
                    <div className="space-y-4 animate-fade-in">
                        <button
                            type="button"
                            onClick={() => handleOAuth('google')}
                            disabled={!!oauthLoading}
                            className="w-full flex items-center justify-center gap-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-60"
                        >
                            {oauthLoading === 'google'
                                ? <Loader2 className="w-5 h-5 animate-spin" />
                                : <img src="https://www.google.com/favicon.ico" alt="" className="w-5 h-5" />}
                            Continuar con Google
                        </button>
                        <button
                            type="button"
                            onClick={() => handleOAuth('azure')}
                            disabled={!!oauthLoading}
                            className="w-full flex items-center justify-center gap-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-60"
                        >
                            {oauthLoading === 'azure'
                                ? <Loader2 className="w-5 h-5 animate-spin" />
                                : <img src="https://www.microsoft.com/favicon.ico" alt="" className="w-5 h-5" />}
                            Continuar con Microsoft
                        </button>

                        {errorMsg && (
                            <div className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 p-3 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900 text-center">
                                {errorMsg}
                            </div>
                        )}

                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-medium uppercase">
                                    o
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowEmailForm(true)}
                            className="w-full flex items-center justify-center gap-3 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100 dark:shadow-none"
                        >
                            <Mail className="w-5 h-5" />
                            Ingresar con mi Correo
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleAuth} className="space-y-4 animate-fade-in">
                        {authMode !== 'forgot' && (
                            /* Tabs Entrar / Crear cuenta */
                            <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-xl flex relative">
                                <div
                                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white dark:bg-slate-900 shadow-sm transition-all duration-300 ${authMode === 'signin' ? 'left-1' : 'left-[calc(50%+0px)]'
                                        }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => switchMode('signin')}
                                    className={`flex-1 py-2 text-sm font-bold relative z-10 transition-colors ${authMode === 'signin'
                                            ? 'text-indigo-600 dark:text-indigo-300'
                                            : 'text-slate-500 dark:text-slate-300'
                                        }`}
                                >
                                    Entrar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => switchMode('signup')}
                                    className={`flex-1 py-2 text-sm font-bold relative z-10 transition-colors ${authMode === 'signup'
                                            ? 'text-indigo-600 dark:text-indigo-300'
                                            : 'text-slate-500 dark:text-slate-300'
                                        }`}
                                >
                                    Crear cuenta
                                </button>
                            </div>
                        )}

                        {authMode === 'forgot' && (
                            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 rounded-xl p-3 flex items-start gap-2">
                                <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                                    Te enviaremos un link a tu correo para restablecer tu contraseña.
                                </p>
                            </div>
                        )}

                        {errorMsg && (
                            <div className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 p-3 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900 text-center">
                                {errorMsg}
                            </div>
                        )}
                        {infoMsg && (
                            <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 p-3 rounded-xl text-sm font-medium border border-emerald-100 dark:border-emerald-900 text-center">
                                {infoMsg}
                                {pendingConfirmEmail && (
                                    <button
                                        type="button"
                                        onClick={handleResendConfirmation}
                                        disabled={loading}
                                        className="block mx-auto mt-2 text-xs font-bold underline hover:no-underline disabled:opacity-50"
                                    >
                                        Reenviar email de confirmación
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-200 pl-1">
                                Correo Electrónico
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="email"
                                    required
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ejemplo@correo.com"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                            </div>
                        </div>

                        {authMode !== 'forgot' && (
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-200 pl-1">
                                    Contraseña (Mín. 6 caracteres)
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    />
                                </div>
                                {authMode === 'signin' && (
                                    <button
                                        type="button"
                                        onClick={() => switchMode('forgot')}
                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline ml-1 mt-1"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100 dark:shadow-none mt-2 disabled:opacity-70"
                        >
                            {loading
                                ? <Loader2 className="w-5 h-5 animate-spin" />
                                : authMode === 'signin' ? 'Entrar'
                                    : authMode === 'signup' ? 'Crear cuenta'
                                        : 'Enviar link de recuperación'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (authMode === 'forgot') {
                                    switchMode('signin');
                                } else {
                                    setShowEmailForm(false);
                                    setErrorMsg('');
                                    setInfoMsg('');
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all font-medium text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" /> Volver
                        </button>
                    </form>
                )}

                <div className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 py-2 rounded-lg border border-slate-100 dark:border-slate-700">
                    <Database className="w-3 h-3 text-slate-400" />
                    {dbStatus}
                </div>
            </div>
        </div>
    );
}
