// Modal para que el cliente publique un nuevo gig.
//
// Orden de campos optimizado para matching:
//   1. ¿A quién necesitas? — selector del catálogo de oficios (skill_id)
//   2. ¿Qué necesitas? — título corto del trabajo
//   3. Detalles (opcional)
//   4. Tu presupuesto
//   5. Subir foto (opcional)
//
// Cuando la skill elegida tiene requires_certification=true (Electricista SEC,
// Gásfiter SEC, Masajista MINSAL, Kinesiólogo), mostramos un banner azul
// avisando al cliente que solo verá lancys verificados.

import { Plus, Briefcase, FileText, DollarSign, Camera, Loader2, X, ShieldCheck, Search } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';

export default function GigFormModal({
    isOpen,
    onOpen,
    onClose,
    gigForm,
    onChangeGigForm,
    onSubmit,
    isSubmitting,
    skillCatalog = [],
    catalogLoading = false,
}) {
    const [skillFilter, setSkillFilter] = useState('');
    const [errors, setErrors] = useState({});

    // Reset cuando se cierra/abre el modal
    useEffect(() => {
        if (isOpen) {
            setSkillFilter('');
            setErrors({});
        }
    }, [isOpen]);

    // Catálogo agrupado por categoría, filtrado por búsqueda
    const skillsByCategory = useMemo(() => {
        const q = skillFilter.trim().toLowerCase();
        const filtered = q
            ? skillCatalog.filter((s) =>
                s.name.toLowerCase().includes(q) ||
                (s.category || '').toLowerCase().includes(q) ||
                (s.cert_authority || '').toLowerCase().includes(q)
            )
            : skillCatalog;
        return filtered.reduce((acc, s) => {
            (acc[s.category] = acc[s.category] || []).push(s);
            return acc;
        }, {});
    }, [skillCatalog, skillFilter]);

    const selectedSkill = skillCatalog.find((s) => s.id === gigForm.skill_id);

    const handleSubmit = (event) => {
        event.preventDefault();
        const e = {};
        if (!gigForm.skill_id) e.skill_id = 'Selecciona el oficio que necesitas';
        if (!gigForm.title?.trim() || gigForm.title.trim().length < 4) e.title = 'Cuéntanos en una frase qué necesitas';
        if (!gigForm.budget || Number(gigForm.budget) < 1000) e.budget = 'Presupuesto mínimo $1.000';
        setErrors(e);
        if (Object.keys(e).length > 0) return;
        onSubmit(event);
    };

    return (
        <>
            <button
                onClick={onOpen}
                className="fixed bottom-28 right-6 w-16 h-16 bg-indigo-600 rounded-full shadow-2xl shadow-indigo-200 dark:shadow-indigo-900/50 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 z-30"
                aria-label="Crear nuevo trabajo"
            >
                <Plus className="w-8 h-8 stroke-[3px]" />
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] flex items-end sm:items-center justify-center animate-fade-in"
                    role="dialog"
                    aria-modal="true"
                    onClick={onClose}
                >
                    <div
                        className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 animate-slide-in-bottom max-h-[92vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                Pedir un Lancy
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600"
                                aria-label="Cerrar"
                            >
                                <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* 1) Selector de oficio (skill_id) */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">
                                    ¿A quién necesitas? *
                                </label>

                                {selectedSkill ? (
                                    /* Pill de la skill seleccionada con botón cambiar */
                                    <div className={`mt-1 p-3 rounded-2xl border flex items-center justify-between gap-3 ${selectedSkill.requires_certification
                                        ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40'
                                        : 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40'
                                        }`}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`p-2 rounded-xl shrink-0 ${selectedSkill.requires_certification
                                                ? 'bg-blue-200 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                                                : 'bg-indigo-200 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                                                }`}>
                                                {selectedSkill.requires_certification
                                                    ? <ShieldCheck className="w-4 h-4" />
                                                    : <Briefcase className="w-4 h-4" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
                                                    {selectedSkill.name}
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                    {selectedSkill.category}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onChangeGigForm({ ...gigForm, skill_id: null })}
                                            className="text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline shrink-0"
                                        >
                                            Cambiar
                                        </button>
                                    </div>
                                ) : (
                                    /* Buscador + lista agrupada por categoría */
                                    <div className="mt-1 space-y-2">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                value={skillFilter}
                                                onChange={(e) => setSkillFilter(e.target.value)}
                                                placeholder="Busca un oficio: pintor, gásfiter, niñera..."
                                                className={`w-full pl-11 pr-4 py-3 border rounded-2xl outline-none text-sm font-medium text-slate-800 dark:text-slate-100 ${errors.skill_id
                                                    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                                    : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:border-indigo-500'
                                                    }`}
                                            />
                                        </div>
                                        <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                            {catalogLoading ? (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                                                    Cargando oficios...
                                                </p>
                                            ) : Object.keys(skillsByCategory).length === 0 ? (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                                                    Sin coincidencias para “{skillFilter}”
                                                </p>
                                            ) : (
                                                Object.entries(skillsByCategory).map(([cat, items]) => (
                                                    <div key={cat}>
                                                        <p className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400 dark:text-slate-500 sticky top-0 bg-white dark:bg-slate-800">
                                                            {cat}
                                                        </p>
                                                        <ul>
                                                            {items.map((s) => (
                                                                <li key={s.id}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onChangeGigForm({ ...gigForm, skill_id: s.id })}
                                                                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 transition-colors"
                                                                    >
                                                                        <span className="font-bold flex-1 truncate">{s.name}</span>
                                                                        {s.requires_certification && (
                                                                            <span className="text-[9px] font-extrabold uppercase bg-blue-600 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                                                                                <ShieldCheck className="w-2.5 h-2.5" />
                                                                                {s.cert_authority}
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Banner cuando la skill requiere certificación */}
                                {selectedSkill?.requires_certification && (
                                    <div className="mt-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-start gap-2">
                                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed">
                                            Por seguridad, esta habilidad requiere certificación{' '}
                                            <strong>{selectedSkill.cert_authority}</strong>.
                                            Solo verás postulaciones de lancys con credencial verificada.
                                        </p>
                                    </div>
                                )}

                                {errors.skill_id && (
                                    <p className="text-xs text-red-600 mt-1 ml-1">{errors.skill_id}</p>
                                )}
                            </div>

                            {/* 2) ¿Qué necesitas? */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">
                                    ¿Qué necesitas? *
                                </label>
                                <div className="relative mt-1">
                                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={gigForm.title}
                                        onChange={(e) => onChangeGigForm({ ...gigForm, title: e.target.value })}
                                        placeholder={selectedSkill
                                            ? `Ej: ${ejemploPorSkill(selectedSkill.slug)}`
                                            : 'Ej: Arreglar fuga en lavaplatos'}
                                        className={`w-full pl-12 pr-4 py-4 border rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ${errors.title
                                            ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                            : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700'
                                            }`}
                                    />
                                </div>
                                {errors.title && (
                                    <p className="text-xs text-red-600 mt-1 ml-1">{errors.title}</p>
                                )}
                            </div>

                            {/* 3) Detalles */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">
                                    Detalles (Opcional)
                                </label>
                                <div className="relative mt-1">
                                    <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                                    <textarea
                                        value={gigForm.description}
                                        onChange={(e) => onChangeGigForm({ ...gigForm, description: e.target.value })}
                                        placeholder="Describe el problema o los materiales..."
                                        rows="3"
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 font-medium resize-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    />
                                </div>
                            </div>

                            {/* 4) Presupuesto */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">
                                    Tu Presupuesto (CLP) *
                                </label>
                                <div className="relative mt-1">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="number"
                                        min="1000"
                                        value={gigForm.budget}
                                        onChange={(e) => onChangeGigForm({ ...gigForm, budget: e.target.value })}
                                        placeholder="15000"
                                        className={`w-full pl-12 pr-4 py-4 border rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 font-medium font-mono text-lg text-slate-800 dark:text-slate-100 ${errors.budget
                                            ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                            : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700'
                                            }`}
                                    />
                                </div>
                                {errors.budget && (
                                    <p className="text-xs text-red-600 mt-1 ml-1">{errors.budget}</p>
                                )}
                            </div>

                            {/* 5) Foto */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">
                                    Subir Foto (Opcional)
                                </label>
                                <div className="relative mt-1">
                                    <label className="w-full flex items-center justify-center gap-2 py-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 border-dashed rounded-2xl cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 active:bg-indigo-100 transition-all text-slate-500 dark:text-slate-300 font-medium text-sm">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) onChangeGigForm({ ...gigForm, image: file });
                                            }}
                                        />
                                        <Camera className="w-5 h-5 text-indigo-500" />
                                        <span className="truncate px-2">
                                            {gigForm.image ? gigForm.image.name : 'Toca para elegir una foto'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none mt-4 disabled:opacity-70 flex justify-center hover:bg-indigo-700 active:scale-95 transition-all"
                            >
                                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Publicar Trabajo'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

/** Sugiere un placeholder específico según el oficio elegido. */
function ejemploPorSkill(slug) {
    const ejemplos = {
        'electricista': 'Cambiar tablero eléctrico de la cocina',
        'gasfiter': 'Arreglar fuga en lavaplatos',
        'pintor': 'Pintar living-comedor (~25 m²)',
        'carpintero': 'Construir un mueble a medida para el baño',
        'cerrajero': 'Cambiar chapa de la puerta principal',
        'jardinero': 'Cortar pasto y podar arbustos del antejardín',
        'paseador-perros': 'Pasear a mi golden retriever 1 hora cada tarde',
        'limpieza-domestica': 'Limpieza profunda de departamento 60 m²',
        'mudanza': 'Mudanza de departamento 2 ambientes',
        'fotografia': 'Sesión de fotos para mi tienda online',
        'diseno-grafico': 'Logo y tarjetas para mi nuevo emprendimiento',
        'desarrollo-web': 'Landing page para captar leads',
        'masajes': 'Masaje descontracturante a domicilio',
        'kinesiologia': 'Sesión de kinesiología post-operatoria',
        'maquillaje': 'Maquillaje para matrimonio',
        'niñera': 'Cuidar a mi hijo 2 hrs el sábado en la noche',
    };
    return ejemplos[slug] || 'Describe brevemente el trabajo';
}
