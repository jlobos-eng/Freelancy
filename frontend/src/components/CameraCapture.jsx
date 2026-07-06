// CameraCapture — captura de imagen con la cámara del dispositivo.
//
// - Usa getUserMedia para mostrar preview de la cámara.
// - Botón "Capturar" → snapshot a un canvas → blob JPEG.
// - Si el navegador no soporta getUserMedia o el usuario rechaza permisos,
//   fallback a <input type="file" accept="image/*" capture="environment">.
//   En móvil, capture=environment abre directo la cámara trasera.
// - facingMode 'environment' (cámara trasera) por default — ideal para cédula.
//   Para selfie pasar facingMode='user'.

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, Upload, X } from 'lucide-react';

const QUALITY = 0.85;       // JPEG quality (0..1)
const MAX_DIMENSION = 1600; // px — limitamos para no subir 10MB por foto

function blobFromCanvas(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
}

function downscaleCanvas(srcCanvas, maxDim = MAX_DIMENSION) {
    const { width, height } = srcCanvas;
    if (width <= maxDim && height <= maxDim) return srcCanvas;
    const scale = Math.min(maxDim / width, maxDim / height);
    const dst = document.createElement('canvas');
    dst.width = Math.round(width * scale);
    dst.height = Math.round(height * scale);
    dst.getContext('2d').drawImage(srcCanvas, 0, 0, dst.width, dst.height);
    return dst;
}

export default function CameraCapture({
    facingMode = 'environment',
    overlayHint = null,            // string opcional: "Encuadra la cédula"
    aspectFrame = '85/55',         // proporción aprox de la cédula chilena
    onCapture,                     // (blob, dataUrl) => void
    onCancel,
}) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const fileInputRef = useRef(null);
    const [status, setStatus] = useState('starting'); // 'starting' | 'live' | 'preview' | 'error' | 'fallback'
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewBlob, setPreviewBlob] = useState(null);
    const [error, setError] = useState(null);

    // Iniciar cámara
    const startCamera = useCallback(async () => {
        setStatus('starting');
        setError(null);
        if (!navigator.mediaDevices?.getUserMedia) {
            setStatus('fallback');
            setError('Tu navegador no soporta acceso a la cámara. Subí la foto desde tu galería.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(() => { });
            }
            setStatus('live');
        } catch (err) {
            console.error('[CameraCapture] getUserMedia error:', err);
            setStatus('fallback');
            const name = err?.name || '';
            if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
                setError('Permiso de cámara denegado. Subí la foto desde tu galería.');
            } else if (name === 'NotFoundError') {
                setError('No encontramos cámara en este dispositivo. Subí la foto desde tu galería.');
            } else {
                setError('No pudimos abrir la cámara. Subí la foto desde tu galería.');
            }
        }
    }, [facingMode]);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        startCamera();
        return () => stopCamera();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Snapshot del video a canvas
    const handleCapture = async () => {
        const video = videoRef.current;
        if (!video || video.videoWidth === 0) return;
        const c = document.createElement('canvas');
        c.width = video.videoWidth;
        c.height = video.videoHeight;
        c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
        const small = downscaleCanvas(c);
        const blob = await blobFromCanvas(small);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setPreviewBlob(blob);
        setPreviewUrl(url);
        setStatus('preview');
        stopCamera();
    };

    const handleRetake = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPreviewBlob(null);
        startCamera();
    };

    const handleConfirm = () => {
        if (!previewBlob) return;
        onCapture?.(previewBlob, previewUrl);
    };

    // Fallback: file input
    const handleFileInput = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Por favor selecciona una imagen (JPG/PNG).');
            return;
        }
        // Downscale si es muy grande
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        await new Promise((r) => { img.onload = r; img.onerror = r; });
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const small = downscaleCanvas(c);
        const blob = await blobFromCanvas(small);
        if (!blob) return;
        const previewUrl2 = URL.createObjectURL(blob);
        setPreviewBlob(blob);
        setPreviewUrl(previewUrl2);
        setStatus('preview');
    };

    return (
        <div className="relative w-full">
            {(status === 'starting' || status === 'live' || status === 'fallback') && (
                <div
                    className="relative w-full overflow-hidden rounded-3xl bg-slate-900"
                    style={{ aspectRatio: aspectFrame }}
                >
                    {status === 'live' && (
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    )}
                    {status === 'starting' && (
                        <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Iniciando cámara...
                        </div>
                    )}

                    {/* Overlay de encuadre */}
                    {overlayHint && (status === 'live' || status === 'starting') && (
                        <>
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-6 border-2 border-dashed border-white/80 rounded-2xl" />
                            </div>
                            <div className="absolute bottom-3 left-3 right-3 text-center text-white/90 text-xs font-bold drop-shadow-md">
                                {overlayHint}
                            </div>
                        </>
                    )}

                    {/* Fallback (sin cámara) */}
                    {status === 'fallback' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                            <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
                            <p className="text-white/90 text-sm mb-4">
                                {error || 'No pudimos abrir la cámara.'}
                            </p>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center gap-2 bg-white text-slate-800 px-4 py-2 rounded-xl font-bold text-sm shadow-md active:scale-95"
                            >
                                <Upload className="w-4 h-4" /> Subir foto
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture={facingMode === 'user' ? 'user' : 'environment'}
                                className="hidden"
                                onChange={handleFileInput}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Preview de la captura */}
            {status === 'preview' && previewUrl && (
                <div
                    className="relative w-full overflow-hidden rounded-3xl bg-slate-900"
                    style={{ aspectRatio: aspectFrame }}
                >
                    <img src={previewUrl} alt="Captura" className="absolute inset-0 w-full h-full object-cover" />
                </div>
            )}

            {/* Controles */}
            <div className="mt-4 flex gap-3">
                {status === 'live' && (
                    <>
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <X className="w-4 h-4" /> Cancelar
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleCapture}
                            className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Camera className="w-4 h-4" /> Capturar
                        </button>
                    </>
                )}
                {status === 'preview' && (
                    <>
                        <button
                            type="button"
                            onClick={handleRetake}
                            className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> Tomar de nuevo
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="flex-1 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Check className="w-4 h-4" /> Usar esta foto
                        </button>
                    </>
                )}
                {status === 'fallback' && onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm active:scale-95 transition-all"
                    >
                        Cancelar
                    </button>
                )}
            </div>
        </div>
    );
}
