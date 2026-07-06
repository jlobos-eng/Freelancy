// SkillFormModal — agregar / editar una skill al perfil del lancy.
//
// UX:
//   1. Selector de skill agrupado por categoría (search incluido).
//   2. Headline corto opcional ("Diseño de logos y branding").
//   3. Tarifa por hora opcional (CLP).
//   4. Años de experiencia opcional.
//   5. Toggle "skill destacada" (primary).
//
// En modo edición (initial.id) el selector de skill queda bloqueado — para
// cambiar de skill, eliminar y crear nueva.

import { useState, useEffect, useMemo } from 'react';
import { X, Briefcase, DollarSign, Award, Search, Loader2, Check, Star, ShieldCheck } from 'lucide-react';
import { formatCLP, digitsOnly } from '../utils/format';

export default function SkillFormModal({
    isOpen,
    onClose,
    onSubmit,
    initial,           // worker_skill row (modo edición)
    catalog = [],
    catalogLoading,
    isSubmitting,
    excludeSkillIds = [],   // skills que el lancy ya tiene
}) {
    const [form, setForm] = useState(buildInitial(initial));
    const [search, setSearch] = useState('');
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            setForm(buildInitial(initial));
            setSearch('');
            setErrors({});
        }
    }, [isOpen, initial]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !isSubmitting) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, isSubmitting, onClose]);

    // Catálogo filtrado por búsqueda + excluyendo skills ya agregadas (modo crear)
    const grouped = useMemo(() => {
        const q = search.toLowerCase().trim();
        const excluded = new Set(initial?.id ? [] : excludeSkillIds);
        const filtered = catalog.filter((s) =>
            !excluded.has(s.id) &&
            (!q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
        );
        return filtered.reduce((acc, s) => {
            (acc[s.category] = acc[s.category] || []).push(s);
            return acc;
        }, {});
    }, [catalog, search, excludeSkillIds, initial?.id]);

    if (!isOpen) return null;

    const isEdit = !!initial?.id;
    const selectedSkill = catalog.find((s) => s.id === form.skill_id);

    const validate = () => {
        const e = {};
        if (!form.skill_id) e.skill_id = 'Selecciona una skill';
        if (form.headline && form.headline.length > 120) e.headline = 'Máximo 120 caracteres';
        const rate = Number(form.hourly_rate);
        if (form.hourly_rate && (!Number.isFinite(rate) || rate < 0 || rate > 10_000_000)) {
            e.hourly_rate = 'Tarifa inválida';
        }
        const years = Number(form.years_experience);
        if (form.years_experience !== '' && (!Number.isFinite(years) || years < 0 || years > 80)) {
            e.years_experience = 'Entre 0 y 80 años';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validate()) return;
        await onSubmit({
            id: initial?.id,
            skill_id: form.skill_id,
            headline: form.headline.trim() || null,
            hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
            years_experience: form.years_experience !== '' ? Number(form.years_experience) : null,
            is_primary: form.is_primary,
        });
    };

    const handleClose = () => {
        if (isSubmitting) return;
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="skill-modal-title"
            onClick={handleClose}
        >
            <div
                className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-slide-in-bottom"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <h3 id="skill-modal-title" className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                            {isEdit ? 'Editar habilidad' : 'Agregar habilidad'}
                        </h3>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-4">
                    {/* Selector de skill (sólo en modo crear) */}
                    {!isEdit && (
                        <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 block">
                                ¿Qué ofreces? *
                            </label>
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar habilidad o categoría..."
                                    className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="max-h-64 overflow-y-auto border border-slate-100 dark:border-slate-700 rounded-2xl divide-y divide-slate-100 dark:divide-slate-700">
                                {catalogLoading ? (
                                    <div className="p-4 text-center text-sm text-slate-500">
                                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Cargando...
                                    </div>
                                ) : Object.keys(grouped).length === 0 ? (
                                    <div className="p-4 text-center text-sm text-slate-500">
                                        Sin resultados.
                                    </div>
                                ) : (
                                    Object.entries(grouped).map(([cat, items]) => (
                                        <div key={cat}>
                                            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/40 text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 sticky top-0">
                                                {cat}
                                            </div>
                                            {items.map((s) => (
                                                <button
                                                    type="button"
                                                    key={s.id}
                                                    onClick={() => setForm((p) => ({ ...p, skill_id: s.id }))}
                                                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${form.skill_id === s.id ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                                            {s.name}
                                                        </span>
                                                        {s.requires_certification && (
                                                            <span className="text-[9px] font-extrabold uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                                <ShieldCheck className="w-2.5 h-2.5" /> {s.cert_authority || 'Cert.'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {form.skill_id === s.id && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                                                </button>
                                            ))}
                                        </div>
                                    ))
                                )}
                            </div>
                            {errors.skill_id && <p className="text-xs text-red-600 mt-1">{errors.skill_id}</p>}
                        </div>
                    )}

                    {/* En edit: mostrar la skill seleccionada como info readonly */}
                    {isEdit && selectedSkill && (
                        <div className="bg-slate-50 dark:bg-slate-700/40 rounded-2xl p-3 border border-slate-100 dark:border-slate-700 flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedSkill.name}</span>
                            <span className="text-xs text-slate-500 ml-auto">{selectedSkill.category}</span>
                        </div>
                    )}

                    {/* Headline */}
                    <div>
                        <label htmlFor="skill-headline" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                            Headline <span className="text-slate-400 font-medium">(opcional, se ve en tu tarjeta)</span>
                        </label>
                        <input
                            id="skill-headline"
                            type="text"
                            value={form.headline}
                            onChange={(e) => setForm((p) => ({ ...p, headline: e.target.value }))}
                            placeholder="Ej: Diseño de logos y branding"
                            maxLength={120}
                            className={`w-full px-3 py-2.5 border rounded-xl text-sm text-slate-800 dark:text-slate-100 outline-none ${errors.headline
                                ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-emerald-500'
                                }`}
                        />
                        <div className="text-xs text-slate-400 text-right mt-1">{form.headline.length}/120</div>
                    </div>

                    {/* Tarifa */}
                    <div>
                        <label htmlFor="skill-rate" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Tarifa por hora (CLP) <span className="text-slate-400 font-medium">(opcional)</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            <input
                                id="skill-rate"
                                type="text"
                                inputMode="numeric"
                                value={form.hourly_rate ? formatCLP(form.hourly_rate) : ''}
                                onChange={(e) => setForm((p) => ({ ...p, hourly_rate: digitsOnly(e.target.value) }))}
                                placeholder="Ej: 15.000"
                                className={`w-full pl-7 pr-3 py-2.5 border rounded-xl font-bold text-sm text-slate-800 dark:text-slate-100 outline-none ${errors.hourly_rate
                                    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-emerald-500'
                                    }`}
                            />
                        </div>
                        {errors.hourly_rate && <p className="text-xs text-red-600 mt-1">{errors.hourly_rate}</p>}
                    </div>

                    {/* Años exp */}
                    <div>
                        <label htmlFor="skill-years" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            Años de experiencia <span className="text-slate-400 font-medium">(opcional)</span>
                        </label>
                        <input
                            id="skill-years"
                            type="number"
                            min="0"
                            max="80"
                            value={form.years_experience}
                            onChange={(e) => setForm((p) => ({ ...p, years_experience: e.target.value }))}
                            placeholder="0"
                            className={`w-full px-3 py-2.5 border rounded-xl font-bold text-sm text-slate-800 dark:text-slate-100 outline-none ${errors.years_experience
                                ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-emerald-500'
                                }`}
                        />
                        {errors.years_experience && <p className="text-xs text-red-600 mt-1">{errors.years_experience}</p>}
                    </div>

                    {/* Primary toggle */}
                    <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.is_primary}
                            onChange={(e) => setForm((p) => ({ ...p, is_primary: e.target.checked }))}
                            className="w-4 h-4 accent-emerald-600"
                        />
                        <div className="flex-1">
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                <Star className="w-3.5 h-3.5" /> Habilidad destacada
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                Aparece primero en tu perfil y en el mapa.
                            </div>
                        </div>
                    </label>

                    {/* Aviso si requiere cert */}
                    {selectedSkill?.requires_certification && (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
                            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800 dark:text-amber-200">
                                Esta habilidad requiere <strong>certificación de {selectedSkill.cert_authority}</strong>.
                                Podrás subirla y verificarla más adelante.
                            </p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-emerald-600 text-white font-extrabold rounded-2xl shadow-lg hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                        ) : (
                            <><Check className="w-5 h-5" /> {isEdit ? 'Guardar cambios' : 'Agregar habilidad'}</>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

function buildInitial(initial) {
    return {
        skill_id: initial?.skill_id || '',
        headline: initial?.headline || '',
        hourly_rate: initial?.hourly_rate ? String(initial.hourly_rate) : '',
        years_experience: initial?.years_experience ?? '',
        is_primary: initial?.is_primary || false,
    };
}
