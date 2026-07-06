// AddressFormModal — crear / editar una dirección estructurada.
//
// UX:
//   - Campo "Buscar dirección" con autocomplete via Nominatim (debounced 400ms).
//   - Al seleccionar un resultado se rellenan los campos. El usuario puede
//     ajustar manualmente cualquier campo.
//   - Campos obligatorios: street, number, comuna, region.
//   - Apartment, instructions y label son opcionales.
//   - Si el usuario escribe sin seleccionar autocomplete, se geocodifica al
//     guardar (forward geocode con `${street} ${number}, ${comuna}`).

import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Loader2, Check, Home } from 'lucide-react';
import { searchAddresses } from '../utils/geo';

const LABELS = ['Casa', 'Oficina', 'Otro'];

export default function AddressFormModal({
    isOpen,
    onClose,
    onSubmit,
    initial,        // si se pasa, modo edición
    isSubmitting,
}) {
    const [form, setForm] = useState(buildInitial(initial));
    const [errors, setErrors] = useState({});
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const abortRef = useRef(null);
    const debounceRef = useRef(null);

    // Reset al abrir/cerrar
    useEffect(() => {
        if (isOpen) {
            setForm(buildInitial(initial));
            setErrors({});
            setQuery('');
            setResults([]);
        } else {
            setShowSuggestions(false);
        }
    }, [isOpen, initial]);

    // Cerrar con Esc
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !isSubmitting) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, isSubmitting, onClose]);

    // Autocomplete debounced
    useEffect(() => {
        if (!query || query.length < 3) {
            setResults([]);
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            if (abortRef.current) abortRef.current.abort();
            abortRef.current = new AbortController();
            setSearching(true);
            try {
                const r = await searchAddresses(query, { limit: 6, signal: abortRef.current.signal });
                setResults(r);
            } finally {
                setSearching(false);
            }
        }, 400);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    if (!isOpen) return null;

    const handleSelectSuggestion = (suggestion) => {
        const c = suggestion.components || {};
        setForm((prev) => ({
            ...prev,
            street: c.street || prev.street,
            number: c.number || prev.number,
            comuna: c.comuna || prev.comuna,
            city: c.city || c.comuna || prev.city,
            region: c.region || prev.region,
            country: c.country || prev.country,
            postal_code: c.postal_code || prev.postal_code,
            lat: suggestion.lat,
            lng: suggestion.lng,
        }));
        setQuery('');
        setResults([]);
        setShowSuggestions(false);
    };

    const validate = () => {
        const e = {};
        if (!form.street?.trim()) e.street = 'Calle requerida';
        if (!form.number?.trim()) e.number = 'Número requerido';
        if (!form.comuna?.trim()) e.comuna = 'Comuna requerida';
        if (!form.region?.trim()) e.region = 'Región requerida';
        if (form.instructions && form.instructions.length > 300) e.instructions = 'Máximo 300 caracteres';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validate()) return;

        let { lat, lng } = form;

        // Si el usuario escribió manualmente sin seleccionar suggestion,
        // intentamos geocodificar antes de guardar.
        if (lat == null || lng == null) {
            const q = `${form.street} ${form.number}, ${form.comuna}, Chile`;
            const r = await searchAddresses(q, { limit: 1 });
            if (r[0]) {
                lat = r[0].lat;
                lng = r[0].lng;
            }
        }

        await onSubmit({
            ...form,
            city: form.city || form.comuna,
            lat,
            lng,
        });
    };

    const handleClose = () => {
        if (isSubmitting) return;
        onClose();
    };

    const updateField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value, lat: null, lng: null }));
        // Si el usuario edita manualmente después de seleccionar autocomplete,
        // invalidamos las coords para que se regeocodifiquen al guardar.
    };

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="address-modal-title"
            onClick={handleClose}
        >
            <div
                className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-slide-in-bottom"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded-xl text-indigo-600 dark:text-indigo-300 shrink-0">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <h3 id="address-modal-title" className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                            {initial?.id ? 'Editar dirección' : 'Nueva dirección'}
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
                    {/* Autocomplete */}
                    <div className="relative">
                        <label htmlFor="address-search" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 block">
                            Buscar dirección <span className="text-slate-400 font-medium">(o llena los campos abajo)</span>
                        </label>
                        <div className="relative">
                            <input
                                id="address-search"
                                type="text"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                                onFocus={() => setShowSuggestions(true)}
                                placeholder="Ej: Av. Apoquindo 3000, Las Condes"
                                className="w-full px-4 py-3 pr-10 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-2xl font-medium text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                            />
                            {searching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-indigo-500" />
                            )}
                        </div>
                        {showSuggestions && results.length > 0 && (
                            <ul className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl shadow-xl z-20 max-h-60 overflow-y-auto">
                                {results.map((r, i) => (
                                    <li key={`${r.lat}-${r.lng}-${i}`}>
                                        <button
                                            type="button"
                                            onClick={() => handleSelectSuggestion(r)}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
                                        >
                                            <p className="text-sm text-slate-800 dark:text-slate-100 font-medium line-clamp-1">{r.display}</p>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                                                {r.components.comuna} · {r.components.region}
                                            </p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Calle + Número */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label htmlFor="addr-street" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Calle *</label>
                            <input
                                id="addr-street"
                                type="text"
                                value={form.street}
                                onChange={(e) => updateField('street', e.target.value)}
                                placeholder="Av. Apoquindo"
                                className={`w-full px-3 py-2.5 border rounded-xl font-medium text-sm text-slate-800 dark:text-slate-100 outline-none ${errors.street
                                    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-indigo-500'
                                    }`}
                            />
                            {errors.street && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.street}</p>}
                        </div>
                        <div>
                            <label htmlFor="addr-number" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Número *</label>
                            <input
                                id="addr-number"
                                type="text"
                                value={form.number}
                                onChange={(e) => updateField('number', e.target.value)}
                                placeholder="3000"
                                className={`w-full px-3 py-2.5 border rounded-xl font-medium text-sm text-slate-800 dark:text-slate-100 outline-none ${errors.number
                                    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-indigo-500'
                                    }`}
                            />
                            {errors.number && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.number}</p>}
                        </div>
                    </div>

                    {/* Departamento */}
                    <div>
                        <label htmlFor="addr-apt" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                            Depto / Casa <span className="text-slate-400 font-medium">(opcional)</span>
                        </label>
                        <input
                            id="addr-apt"
                            type="text"
                            value={form.apartment}
                            onChange={(e) => updateField('apartment', e.target.value)}
                            placeholder="Depto 502 / Casa B"
                            className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                        />
                    </div>

                    {/* Comuna + Ciudad */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="addr-comuna" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Comuna *</label>
                            <input
                                id="addr-comuna"
                                type="text"
                                value={form.comuna}
                                onChange={(e) => updateField('comuna', e.target.value)}
                                placeholder="Las Condes"
                                className={`w-full px-3 py-2.5 border rounded-xl font-medium text-sm text-slate-800 dark:text-slate-100 outline-none ${errors.comuna
                                    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-indigo-500'
                                    }`}
                            />
                            {errors.comuna && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.comuna}</p>}
                        </div>
                        <div>
                            <label htmlFor="addr-city" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Ciudad</label>
                            <input
                                id="addr-city"
                                type="text"
                                value={form.city}
                                onChange={(e) => updateField('city', e.target.value)}
                                placeholder="Santiago"
                                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Región */}
                    <div>
                        <label htmlFor="addr-region" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Región *</label>
                        <input
                            id="addr-region"
                            type="text"
                            value={form.region}
                            onChange={(e) => updateField('region', e.target.value)}
                            placeholder="Región Metropolitana"
                            className={`w-full px-3 py-2.5 border rounded-xl font-medium text-sm text-slate-800 dark:text-slate-100 outline-none ${errors.region
                                ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-indigo-500'
                                }`}
                        />
                        {errors.region && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.region}</p>}
                    </div>

                    {/* Etiqueta */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 block">
                            Etiqueta <span className="text-slate-400 font-medium">(opcional)</span>
                        </label>
                        <div className="flex gap-2">
                            {LABELS.map((l) => (
                                <button
                                    type="button"
                                    key={l}
                                    onClick={() => setForm((p) => ({ ...p, label: p.label === l ? '' : l }))}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${form.label === l
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500'
                                        }`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Instrucciones */}
                    <div>
                        <label htmlFor="addr-instr" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                            Indicaciones para llegar <span className="text-slate-400 font-medium">(opcional)</span>
                        </label>
                        <textarea
                            id="addr-instr"
                            value={form.instructions}
                            onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
                            maxLength={300}
                            rows={2}
                            placeholder="Edificio rojo, portón al lado del banco. Tocar timbre 502."
                            className={`w-full px-3 py-2.5 border rounded-xl font-medium text-sm text-slate-800 dark:text-slate-100 outline-none resize-none ${errors.instructions
                                ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-indigo-500'
                                }`}
                        />
                        <div className="flex justify-between items-center mt-1">
                            {errors.instructions ? (
                                <p className="text-xs text-red-600 dark:text-red-400">{errors.instructions}</p>
                            ) : <span />}
                            <span className="text-xs text-slate-400">{form.instructions.length}/300</span>
                        </div>
                    </div>

                    {/* Primary toggle */}
                    <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.is_primary}
                            onChange={(e) => setForm((p) => ({ ...p, is_primary: e.target.checked }))}
                            className="w-4 h-4 accent-indigo-600"
                        />
                        <div className="flex-1">
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                <Home className="w-3.5 h-3.5" /> Marcar como dirección principal
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                Se usará por defecto en gigs y en tu perfil público.
                            </div>
                        </div>
                    </label>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-indigo-600 text-white font-extrabold rounded-2xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                        ) : (
                            <><Check className="w-5 h-5" /> Guardar dirección</>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

function buildInitial(initial) {
    return {
        id: initial?.id || null,
        label: initial?.label || '',
        street: initial?.street || '',
        number: initial?.number || '',
        apartment: initial?.apartment || '',
        comuna: initial?.comuna || '',
        city: initial?.city || '',
        region: initial?.region || '',
        country: initial?.country || 'CL',
        postal_code: initial?.postal_code || '',
        instructions: initial?.instructions || '',
        is_primary: initial?.is_primary || false,
        lat: initial?.lat ?? null,
        lng: initial?.lng ?? null,
    };
}
