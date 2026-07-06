// KycView — Verificación de identidad real.
//
// Flow (5 pasos):
//   0. Intro — explicación + botón "Empezar".
//   1. Frente cédula — captura con cámara + OCR client-side (Tesseract).
//   2. Reverso cédula — captura con cámara.
//   3. Selfie — captura con cámara frontal.
//   4. Procesando — sube imágenes + llama submit_kyc + extrae el RUT/nombre.
//   5. Resultado — approved (auto) | pending_review | rejected.
//
// Estado global: el hook useKyc lee profiles.kyc_status. Mientras no esté
// 'approved', App.jsx fuerza esta vista (gate global).
//
// Privacidad: las imágenes van a un bucket Storage privado con RLS.
// Solo el dueño y service_role pueden leerlas. Tras submit_kyc el cliente
// ya no necesita las URLs — borramos los blobs locales.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ShieldCheck, Camera, User, CheckCircle2, AlertTriangle, Loader2,
    ArrowRight, RefreshCw, Clock,
} from 'lucide-react';
import CameraCapture from '../components/CameraCapture';
import { extractIdentity, terminateOcr } from '../utils/ocr';
import { isValidRut, formatRut } from '../utils/rut';
import useKyc from '../hooks/useKyc';
import toast from 'react-hot-toast';

export default function KycView({ myProfile, onApproved, onSignOut }) {
    const userId = myProfile?.id;
    const { status, submission, submit, refresh, loading } = useKyc(userId);

    const [step, setStep] = useState('intro'); // intro|front|back|selfie|processing|result
    const [docFront, setDocFront] = useState(null);
    const [docFrontUrl, setDocFrontUrl] = useState(null);
    const [docBack, setDocBack] = useState(null);
    const [selfie, setSelfie] = useState(null);
    const [ocr, setOcr] = useState(null);          // { rut, fullName, confidence }
    const [submitError, setSubmitError] = useState(null);
    const [resultMeta, setResultMeta] = useState(null); // { autoApproved, status }
    const ocrAbortRef = useRef(false);

    // Si ya está aprobado al montar, salimos al dashboard.
    useEffect(() => {
        if (status === 'approved') {
            setStep('result');
            setTimeout(() => onApproved?.(), 1200);
        } else if (status === 'pending_review' && step === 'intro') {
            setStep('result');
        } else if (status === 'rejected' && step === 'intro') {
            setStep('result');
        }
    }, [status, onApproved, step]);

    // Limpiar Tesseract al desmontar
    useEffect(() => () => {
        ocrAbortRef.current = true;
        terminateOcr();
        if (docFrontUrl) URL.revokeObjectURL(docFrontUrl);
    }, [docFrontUrl]);

    const stepIndex = useMemo(() => {
        const order = ['intro', 'front', 'back', 'selfie', 'processing', 'result'];
        return order.indexOf(step);
    }, [step]);

    // ---------- Capturas ----------
    const handleFrontCapture = async (blob, url) => {
        setDocFront(blob);
        setDocFrontUrl(url);
        setStep('back');
        // OCR en paralelo — no bloqueamos el avance del flujo. Si termina antes
        // de que el usuario llegue a "Procesando", ya tenemos los datos.
        try {
            const result = await extractIdentity(blob);
            if (ocrAbortRef.current) return;
            // Limpiar y formatear el RUT detectado
            if (result.rut && isValidRut(result.rut)) {
                result.rut = formatRut(result.rut);
            } else {
                result.rut = null;
            }
            setOcr(result);
        } catch (err) {
            console.warn('[KYC] OCR failed:', err);
        }
    };

    const handleBackCapture = (blob) => {
        setDocBack(blob);
        setStep('selfie');
    };

    const handleSelfieCapture = async (blob) => {
        setSelfie(blob);
        setStep('processing');
        await runSubmit(blob);
    };

    const runSubmit = async (selfieBlob) => {
        setSubmitError(null);
        try {
            const res = await submit({
                docFrontBlob: docFront,
                docBackBlob: docBack,
                selfieBlob: selfieBlob || selfie,
                rut: ocr?.rut || null,
                fullName: ocr?.fullName || null,
                ocrConfidence: ocr?.confidence ?? null,
            });
            setResultMeta(res);
            setStep('result');
            if (res.autoApproved) {
                toast.success('¡Identidad verificada!');
                setTimeout(() => onApproved?.(), 1500);
            } else {
                toast('Tu identidad quedó en revisión', { icon: '⏳' });
            }
        } catch (err) {
            console.error('[KYC] submit failed:', err);
            setSubmitError(err?.message || 'Error desconocido');
            setStep('result');
        }
    };

    const handleRetry = async () => {
        setDocFront(null);
        setDocBack(null);
        setSelfie(null);
        setOcr(null);
        setResultMeta(null);
        setSubmitError(null);
        await refresh();
        setStep('intro');
    };

    // ---------- Render ----------
    return (
        <div className="flex flex-col min-h-screen bg-slate-900 dark:bg-slate-950 text-white font-sans transition-colors">
            <header className="px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-indigo-500 p-2 rounded-lg shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-bold truncate">Verificación de identidad</h3>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                            {step === 'intro' && 'Antes de empezar'}
                            {step === 'front' && 'Paso 1 de 3 · Frente cédula'}
                            {step === 'back' && 'Paso 2 de 3 · Reverso cédula'}
                            {step === 'selfie' && 'Paso 3 de 3 · Selfie'}
                            {step === 'processing' && 'Procesando...'}
                            {step === 'result' && 'Resultado'}
                        </p>
                    </div>
                </div>
                {onSignOut && step === 'intro' && (
                    <button
                        onClick={onSignOut}
                        className="text-xs font-bold text-slate-400 hover:text-white"
                    >
                        Cerrar sesión
                    </button>
                )}
            </header>

            {/* Progress bar */}
            <div className="px-6 mb-4">
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, (stepIndex / 5) * 100))}%` }}
                    />
                </div>
            </div>

            <main className="flex-1 px-6 pb-8">
                {step === 'intro' && (
                    <IntroPanel
                        loading={loading}
                        status={status}
                        onStart={() => setStep('front')}
                    />
                )}

                {step === 'front' && (
                    <CapturePanel
                        title="Tomá una foto del frente de tu cédula"
                        hint="Asegurate de que se lea bien el RUT y tu nombre"
                        facingMode="environment"
                        aspectFrame="85/55"
                        onCapture={handleFrontCapture}
                    />
                )}

                {step === 'back' && (
                    <CapturePanel
                        title="Ahora el reverso"
                        hint="Tiene que verse el número de documento y la fecha"
                        facingMode="environment"
                        aspectFrame="85/55"
                        onCapture={handleBackCapture}
                    />
                )}

                {step === 'selfie' && (
                    <CapturePanel
                        title="Por último, una selfie"
                        hint="Mirá a la cámara, sin lentes ni gorro"
                        facingMode="user"
                        aspectFrame="3/4"
                        onCapture={handleSelfieCapture}
                    />
                )}

                {step === 'processing' && (
                    <ProcessingPanel ocr={ocr} />
                )}

                {step === 'result' && (
                    <ResultPanel
                        status={status}
                        submission={submission}
                        resultMeta={resultMeta}
                        submitError={submitError}
                        onApproved={onApproved}
                        onRetry={handleRetry}
                    />
                )}
            </main>
        </div>
    );
}

// =====================================================================
// Sub-componentes
// =====================================================================

function IntroPanel({ loading, status, onStart }) {
    return (
        <div className="max-w-md mx-auto text-center pt-8">
            <div className="bg-indigo-500/20 p-6 rounded-3xl w-fit mx-auto mb-6">
                <ShieldCheck className="w-16 h-16 text-indigo-300" />
            </div>
            <h2 className="text-2xl font-extrabold mb-3">Verificá tu identidad</h2>
            <p className="text-sm text-slate-300 mb-2 leading-relaxed">
                Para que clientes y Lancys confíen entre ellos, necesitamos validar
                que sos vos. Vas a tomar 3 fotos: frente y reverso de tu cédula, y
                una selfie. Tarda menos de 2 minutos.
            </p>
            <p className="text-xs text-slate-500 mb-8">
                Tus fotos se guardan encriptadas y solo nuestro equipo de revisión
                las ve. Nunca las publicamos.
            </p>

            <div className="text-left bg-slate-800/60 rounded-2xl p-4 mb-6 space-y-2 border border-slate-700">
                <Bullet text="Tené tu cédula a mano (no carnet caducado)" />
                <Bullet text="Buena luz, evitá reflejos" />
                <Bullet text="Permití el acceso a la cámara cuando se te pida" />
            </div>

            <button
                onClick={onStart}
                disabled={loading || status === 'approved'}
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-extrabold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Empezar <ArrowRight className="w-5 h-5" /></>}
            </button>
        </div>
    );
}

function Bullet({ text }) {
    return (
        <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="text-xs text-slate-300">{text}</span>
        </div>
    );
}

function CapturePanel({ title, hint, facingMode, aspectFrame, onCapture }) {
    return (
        <div className="max-w-md mx-auto">
            <h2 className="text-xl font-extrabold mb-1">{title}</h2>
            <p className="text-sm text-slate-400 mb-4">{hint}</p>
            <CameraCapture
                facingMode={facingMode}
                aspectFrame={aspectFrame}
                overlayHint={facingMode === 'environment' ? 'Encuadrá el documento dentro del marco' : 'Centra tu rostro'}
                onCapture={onCapture}
            />
        </div>
    );
}

function ProcessingPanel({ ocr }) {
    return (
        <div className="max-w-md mx-auto text-center pt-8">
            <div className="bg-indigo-500/20 p-6 rounded-3xl w-fit mx-auto mb-6 animate-pulse">
                <Loader2 className="w-16 h-16 text-indigo-300 animate-spin" />
            </div>
            <h2 className="text-xl font-extrabold mb-2">Procesando...</h2>
            <p className="text-sm text-slate-400 mb-6">
                Subiendo tus documentos y validando los datos. No cierres la pantalla.
            </p>
            {ocr && (
                <div className="text-left bg-slate-800/60 rounded-2xl p-4 border border-slate-700 space-y-2">
                    <DataRow label="RUT detectado" value={ocr.rut || '—'} />
                    <DataRow label="Nombre detectado" value={ocr.fullName || '—'} />
                    <DataRow label="Confianza OCR" value={ocr.confidence != null ? `${Math.round(ocr.confidence * 100)}%` : '—'} />
                </div>
            )}
        </div>
    );
}

function DataRow({ label, value }) {
    return (
        <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 uppercase font-bold">{label}</span>
            <span className="text-slate-200 font-bold truncate max-w-[60%] text-right">{value}</span>
        </div>
    );
}

function ResultPanel({ status, submission, resultMeta, submitError, onApproved, onRetry }) {
    if (submitError) {
        return (
            <div className="max-w-md mx-auto text-center pt-8">
                <div className="bg-red-500/20 p-6 rounded-3xl w-fit mx-auto mb-6">
                    <AlertTriangle className="w-16 h-16 text-red-300" />
                </div>
                <h2 className="text-xl font-extrabold mb-2">Algo se rompió</h2>
                <p className="text-sm text-slate-300 mb-6">{submitError}</p>
                <button
                    onClick={onRetry}
                    className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <RefreshCw className="w-5 h-5" /> Reintentar
                </button>
            </div>
        );
    }

    if (status === 'approved') {
        return (
            <div className="max-w-md mx-auto text-center pt-8 animate-zoom-in-95">
                <div className="bg-emerald-500/20 p-6 rounded-3xl w-fit mx-auto mb-6">
                    <CheckCircle2 className="w-16 h-16 text-emerald-300" />
                </div>
                <h2 className="text-2xl font-extrabold mb-2">¡Verificado!</h2>
                <p className="text-sm text-slate-300 mb-6">
                    {resultMeta?.autoApproved
                        ? 'Tus datos coincidieron y aprobamos tu cuenta automáticamente.'
                        : 'Tu identidad ya está verificada.'}
                </p>
                <button
                    onClick={onApproved}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    Continuar a Freelancy <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        );
    }

    if (status === 'pending_review') {
        return (
            <div className="max-w-md mx-auto text-center pt-8">
                <div className="bg-amber-500/20 p-6 rounded-3xl w-fit mx-auto mb-6">
                    <Clock className="w-16 h-16 text-amber-300" />
                </div>
                <h2 className="text-xl font-extrabold mb-2">En revisión</h2>
                <p className="text-sm text-slate-300 mb-2">
                    Recibimos tus documentos. Nuestro equipo los está revisando.
                </p>
                <p className="text-xs text-slate-500 mb-6">
                    Te avisaremos en cuanto esté listo (normalmente en menos de 24 horas).
                    Mientras tanto no puedes usar la app.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="text-xs font-bold text-indigo-300 hover:text-indigo-200"
                >
                    Recargar para verificar estado
                </button>
            </div>
        );
    }

    if (status === 'rejected') {
        return (
            <div className="max-w-md mx-auto text-center pt-8">
                <div className="bg-red-500/20 p-6 rounded-3xl w-fit mx-auto mb-6">
                    <AlertTriangle className="w-16 h-16 text-red-300" />
                </div>
                <h2 className="text-xl font-extrabold mb-2">Verificación rechazada</h2>
                <p className="text-sm text-slate-300 mb-2">
                    {submission?.rejection_reason || 'Tus documentos no pudieron ser validados.'}
                </p>
                <p className="text-xs text-slate-500 mb-6">
                    Podés reintentar con fotos más claras o contactar a soporte.
                </p>
                <button
                    onClick={onRetry}
                    className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <RefreshCw className="w-5 h-5" /> Reintentar verificación
                </button>
            </div>
        );
    }

    // status='none' — fallback raro
    return (
        <div className="max-w-md mx-auto text-center pt-8">
            <p className="text-sm text-slate-300 mb-4">No se detectó ninguna verificación.</p>
            <button onClick={onRetry} className="px-5 py-2.5 bg-indigo-500 rounded-xl font-bold">
                Empezar
            </button>
        </div>
    );
}
