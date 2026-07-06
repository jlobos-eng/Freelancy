// CertificationUploadModal — el lancy sube su credencial para una skill que la requiere.
//
// UX:
//   1. Selector de skill (sólo las del lancy que requieren cert).
//   2. Campo número de credencial.
//   3. Fecha de emisión y vencimiento opcionales.
//   4. Upload de archivo (PDF o imagen, max 5MB).
//   5. Submit → upload a Storage → crear cert pending.

import { useState, useEffect, useMemo } from 'react';
import { X, ShieldCheck, Upload, Loader2, Check, AlertTriangle, FileText } from 'lucide-react';

const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE_MB = 5;

export default function CertificationUploadModal({
    isOpen,
    onClose,
    onSubmit,           // async ({ skill_id, authority, credential_number, document_url, document_mime, document_size_bytes, issued_at, expires_at }) => void
    onUpload,           // async (file) => Promise<url>
    isSubmitting,
    mySkills = [],      // worker_skills_with_skill — sólo se muestran las requires_certification
}) {
    const [form, setForm] = useState(initialForm());
    const [errors, setErrors] = useState({});
    const [file, setFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setForm(initialForm());
            setErrors({});
            setFile(null);
            setUploadProgress(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !isSubmitting) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, isSubmitting, onClose]);

    // Sólo skills del lancy que requieren certificación y aún no están verified
    const eligibleSkills = useMemo(() =>
        mySkills.filter((s) => s.requires_certification && s.verification_status !== 'verified'),
        [mySkills]
    );

    const selectedSkill = eligibleSkills.find((s) => s.skill_id === form.skill_id);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!ACCEPTED_TYPES.includes(f.type)) {
            setErrors((p) => ({ ...p, file: 'Sólo PDF, PNG, JPG o WebP' }));
            return;
        }
        if (f.size > MAX_SIZE_MB * 1024 * 1024) {
            setErrors((p) => ({ ...p, file: `Máximo ${MAX_SIZE_MB} MB` }));
            return;
        }
        setFile(f);
        setErrors((p) => ({ ...p, file: undefined }));
    };

    const validate = () => {
        const e = {};
        if (!form.skill_id) e.skill_id = 'Selecciona una habilidad';
        if (!form.credential_number.trim()) e.credential_number = 'Número requerido';
        if (form.expires_at && form.issued_at && form.expires_at < form.issued_at) {
            e.expires_at = 'No puede ser antes de la emisión';
        }
        if (!file) e.file = 'Sube el documento';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validate()) return;

        try {
            setUploadProgress('uploading');
            const documentUrl = await onUpload(file);
            setUploadProgress('saving');
            await onSubmit({
                skill_id: form.skill_id,
                authority: selectedSkill?.cert_authority || 'Otro',
                credential_number: form.credential_number.trim(),
                document_url: documentUrl,
                document_mime: file.type,
                document_size_bytes: file.size,
                issued_at: form.issued_at || null,
                expires_at: form.expires_at || null,
            });
            setUploadProgress(null);
        } catch (err) {
            setUploadProgress(null);
            setErrors({ file: err?.message || 'Error al subir el archivo' });
        }
    };

    const handleClose = () => {
        if (isSubmitting || uploadProgress) return;
        onClose();
    };

    const isWorking = isSubmitting || !!uploadProgress;

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cert-modal-title"
            onClick={handleClose}
        >
            <div
                className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-slide-in-bottom"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-xl text-blue-600 dark:text-blue-400">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <h3 id="cert-modal-title" className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                            Subir certificación
                        </h3>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isWorking}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                    </button>
                </div>

                {eligibleSkills.length === 0 ? (
                    <div className="p-6 text-center">
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                            <AlertTriangle className="w-8 h-8 mx-auto text-amber-600 dark:text-amber-400 mb-2" />
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-1">
                                Sin habilidades certificables
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                Agrega primero una habilidad que requiera certificación (ej: Electricista SEC, Kinesiólogo).
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="mt-4 w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm"
                        >
                            Cerrar
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-4">
                        {/* Selector skill */}
                        <div>
                            <label htmlFor="cert-skill" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                                Habilidad a certificar *
                            </label>
                            <select
                                id="cert-skill"
                                value={form.skill_id}
                                onChange={(e) => setForm((p) => ({ ...p, skill_id: e.target.value }))}
                                className={`w-full px-3 py-2.5 border rounded-xl text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-700 outline-none ${errors.skill_id
                                    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                    : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
                                    }`}
                            >
                                <option value="">— Selecciona —</option>
                                {eligibleSkills.map((s) => (
                                    <option key={s.id} value={s.skill_id}>
                                        {s.skill_name} ({s.cert_authority})
                                    </option>
                                ))}
                            </select>
                            {errors.skill_id && <p className="text-xs text-red-600 mt-1">{errors.skill_id}</p>}
                        </div>

                        {/* Banner de autoridad */}
                        {selectedSkill && (
                            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-start gap-2">
                                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-800 dark:text-blue-200">
                                    Esta habilidad la verifica <strong>{selectedSkill.cert_authority}</strong>.
                                    Asegúrate que el documento esté legible y vigente.
                                </p>
                            </div>
                        )}

                        {/* Número credencial */}
                        <div>
                            <label htmlFor="cert-num" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                                Número de credencial *
                            </label>
                            <input
                                id="cert-num"
                                type="text"
                                value={form.credential_number}
                                onChange={(e) => setForm((p) => ({ ...p, credential_number: e.target.value }))}
                                placeholder="Ej: 12.345.678-9 o folio SEC"
                                className={`w-full px-3 py-2.5 border rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 outline-none ${errors.credential_number
                                    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-blue-500'
                                    }`}
                            />
                            {errors.credential_number && <p className="text-xs text-red-600 mt-1">{errors.credential_number}</p>}
                        </div>

                        {/* Fechas */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="cert-issued" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                                    Emisión <span className="text-slate-400 font-medium">(opcional)</span>
                                </label>
                                <input
                                    id="cert-issued"
                                    type="date"
                                    value={form.issued_at}
                                    onChange={(e) => setForm((p) => ({ ...p, issued_at: e.target.value }))}
                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="cert-expires" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                                    Vencimiento <span className="text-slate-400 font-medium">(opcional)</span>
                                </label>
                                <input
                                    id="cert-expires"
                                    type="date"
                                    value={form.expires_at}
                                    onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))}
                                    className={`w-full px-3 py-2.5 border rounded-xl text-sm text-slate-800 dark:text-slate-100 outline-none ${errors.expires_at
                                        ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-blue-500'
                                        }`}
                                />
                                {errors.expires_at && <p className="text-xs text-red-600 mt-1">{errors.expires_at}</p>}
                            </div>
                        </div>

                        {/* Upload */}
                        <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                                Documento (PDF / imagen) *
                            </label>
                            <label
                                htmlFor="cert-file"
                                className={`block border-2 border-dashed rounded-2xl p-4 cursor-pointer transition-colors ${file
                                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30'
                                    : errors.file
                                        ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30'
                                        : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-950/20'
                                    }`}
                            >
                                <input
                                    id="cert-file"
                                    type="file"
                                    accept={ACCEPTED_TYPES.join(',')}
                                    onChange={handleFileChange}
                                    className="sr-only"
                                />
                                <div className="flex items-center gap-3">
                                    {file ? (
                                        <>
                                            <FileText className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {(file.size / 1024).toFixed(0)} KB
                                                </p>
                                            </div>
                                            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">Cambiar</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-8 h-8 text-slate-400 shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Subir archivo</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">PDF o imagen, máx {MAX_SIZE_MB} MB</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </label>
                            {errors.file && <p className="text-xs text-red-600 mt-1">{errors.file}</p>}
                        </div>

                        {/* Aviso */}
                        <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                            Tu documento sólo lo verá nuestro equipo de validación. La revisión toma hasta 48 horas.
                            Si se aprueba, aparecerá un badge azul "Verificado" en tu perfil.
                        </div>

                        <button
                            type="submit"
                            disabled={isWorking}
                            className="w-full py-4 bg-blue-600 text-white font-extrabold rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {uploadProgress === 'uploading' && (<><Loader2 className="w-5 h-5 animate-spin" /> Subiendo archivo...</>)}
                            {uploadProgress === 'saving' && (<><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>)}
                            {!uploadProgress && !isSubmitting && (<><Check className="w-5 h-5" /> Enviar para verificación</>)}
                            {!uploadProgress && isSubmitting && (<><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>)}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

function initialForm() {
    return {
        skill_id: '',
        credential_number: '',
        issued_at: '',
        expires_at: '',
    };
}
