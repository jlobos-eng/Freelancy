// Pantalla completa de mapa con búsqueda, radio configurable y stats.

import { useMemo, useState, useEffect, useRef } from 'react';
import { Search, Layers, MapPin, Loader2, AlertCircle, X, ShieldCheck, Star, Users } from 'lucide-react';
import MapView from '../components/MapView';
import { avatarFor } from '../utils/avatar';

const SUGGESTION_LIMIT = 6;

/** Normaliza texto para búsqueda case-insensitive y sin tildes. */
function norm(value) {
    return (value || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

function workerMatchesQuery(worker, q) {
    if (!q) return true;
    const haystack = [
        worker.full_name,
        worker.skill_name,
        worker.skill,
        worker.headline,
        worker.location,
        worker.cert_authority,
    ].map(norm).join(' | ');
    return haystack.includes(q);
}

export default function MapScreen({
    userCoords,
    geoLoading,
    geoError,
    workers,
    searchQuery,
    onChangeSearch,
    mapRadiusKm,
    onChangeRadius,
    onWorkerClick,
    onJumpToList,
}) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef(null);

    const normalizedQuery = useMemo(() => norm(searchQuery).trim(), [searchQuery]);

    const filteredWorkers = useMemo(
        () => workers.filter((w) => workerMatchesQuery(w, normalizedQuery)),
        [workers, normalizedQuery],
    );

    const suggestions = useMemo(() => {
        if (!normalizedQuery) return [];
        return filteredWorkers.slice(0, SUGGESTION_LIMIT);
    }, [filteredWorkers, normalizedQuery]);

    const hasQuery = normalizedQuery.length > 0;
    const hasNoResults = hasQuery && filteredWorkers.length === 0;

    // Cerrar sugerencias al hacer click fuera
    useEffect(() => {
        const onClickOutside = (e) => {
            if (inputRef.current && !inputRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const handlePickSuggestion = (worker) => {
        setShowSuggestions(false);
        onChangeSearch(worker.full_name || '');
        if (onWorkerClick) onWorkerClick(worker);
    };

    return (
        <main className="flex-1 relative bg-slate-200 dark:bg-slate-900 overflow-hidden animate-fade-in">
            <MapView
                userCoords={userCoords}
                workers={filteredWorkers}
                onWorkerClick={onWorkerClick}
                radiusKm={mapRadiusKm}
                initialZoom={14}
                fitToWorkers={hasQuery && filteredWorkers.length > 0}
            />

            <div className="absolute top-4 left-6 right-6 z-[1000] space-y-2" ref={inputRef}>
                <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md py-3 px-4 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 flex items-center">
                    <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
                    <input
                        type="text"
                        placeholder="Nombre, oficio o comuna..."
                        value={searchQuery}
                        onFocus={() => setShowSuggestions(true)}
                        className="flex-1 bg-transparent border-none outline-none font-medium text-sm text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 w-full"
                        onChange={(e) => {
                            onChangeSearch(e.target.value);
                            setShowSuggestions(true);
                        }}
                    />
                    {hasQuery && (
                        <button
                            type="button"
                            onClick={() => {
                                onChangeSearch('');
                                setShowSuggestions(false);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                            aria-label="Limpiar búsqueda"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Dropdown sugerencias */}
                {showSuggestions && hasQuery && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                        {suggestions.length > 0 ? (
                            <>
                                <p className="px-4 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                    {filteredWorkers.length} resultado{filteredWorkers.length === 1 ? '' : 's'}
                                </p>
                                <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                    {suggestions.map((w) => (
                                        <li key={w.id}>
                                            <button
                                                type="button"
                                                onClick={() => handlePickSuggestion(w)}
                                                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors text-left"
                                            >
                                                <img
                                                    src={avatarFor(w)}
                                                    alt=""
                                                    className={`w-9 h-9 rounded-xl object-cover bg-slate-100 dark:bg-slate-700 shrink-0 ${w.is_certified ? 'ring-2 ring-blue-500' : ''}`}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                                            {w.full_name || 'Sin nombre'}
                                                        </span>
                                                        {w.is_certified && (
                                                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                        {[w.skill_name || w.skill, w.location].filter(Boolean).join(' · ') || 'Multiservicios'}
                                                    </p>
                                                </div>
                                                {w.rating != null && (
                                                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 shrink-0">
                                                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                                        {Number(w.rating).toFixed(1)}
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                {filteredWorkers.length > SUGGESTION_LIMIT && (
                                    <button
                                        type="button"
                                        onClick={onJumpToList}
                                        className="w-full px-4 py-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors border-t border-slate-100 dark:border-slate-700"
                                    >
                                        Ver los {filteredWorkers.length} resultados en la lista →
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="px-4 py-6 text-center">
                                <Users className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                    Sin resultados
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    Prueba con otro nombre, oficio (electricista, pintor) o aumenta el radio.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {geoLoading && (
                    <div className="bg-indigo-600 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-lg flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Buscando tu ubicación...
                    </div>
                )}
                {geoError && userCoords?.isFallback && (
                    <div className="bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs font-bold py-2 px-4 rounded-xl shadow-lg flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" /> Mostrando ubicación aproximada (Santiago centro)
                    </div>
                )}
            </div>

            <div className="absolute bottom-28 left-6 right-6 z-[1000] space-y-3">
                <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Radio de búsqueda
                        </span>
                        <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                            {mapRadiusKm} km
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={mapRadiusKm}
                        onChange={(e) => onChangeRadius(Number(e.target.value))}
                        className="w-full accent-indigo-600 dark:accent-indigo-400"
                        aria-label="Radio de búsqueda en kilómetros"
                    />
                </div>

                <div className={`backdrop-blur-md p-4 rounded-3xl shadow-2xl flex items-center justify-between text-white border ${hasNoResults
                    ? 'bg-amber-900/85 dark:bg-amber-950/90 border-amber-700'
                    : 'bg-slate-900/85 dark:bg-slate-950/90 border-slate-700 dark:border-slate-800'
                    }`}>
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-300">
                            {hasQuery ? `Resultados para "${searchQuery}"` : 'Lancys en tu zona'}
                        </p>
                        <p className="text-lg font-bold flex items-center gap-2">
                            <MapPin className={`w-5 h-5 ${hasNoResults ? 'text-amber-300' : 'text-emerald-400'}`} />
                            {filteredWorkers.length} {hasNoResults ? 'sin coincidencias' : 'disponibles'}
                        </p>
                    </div>
                    <button
                        onClick={onJumpToList}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                    >
                        Ver en lista
                    </button>
                </div>
            </div>
        </main>
    );
}
