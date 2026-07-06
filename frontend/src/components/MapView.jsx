// frontend/src/components/MapView.jsx
// Mapa real con react-leaflet + tiles OpenStreetMap.
// - Pin del usuario (índigo).
// - Lancys cercanos (verde) con jitter ~200m por privacidad.
// - Solo renderiza workers que tienen lat/lng reales (nearby_workers ya filtró).
//   Si en algún render llegan workers sin geo, simplemente no aparecen en el mapa.
// - Distancia preferentemente la del backend (distance_m de PostGIS), si no, Haversine local.

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Star, MapPin, Navigation, ShieldCheck } from 'lucide-react';
import { haversineDistance, formatDistance } from '../hooks/useGeolocation';
import { avatarFor } from '../utils/avatar';
import { jitterCoord } from '../utils/geo';

// Icono custom verde para Lancys (divIcon → no depende de assets externos rotos por defecto en Leaflet+vite)
const lancyIcon = L.divIcon({
    className: 'lancy-marker',
    html: `<div style="
        background: #fff;
        border: 3px solid #10b981;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
        font-weight: 800;
        color: #059669;
        font-size: 16px;
    ">📍</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
});

// Variante con anillo azul para lancys verificados (M5.3 — Trust & Safety)
const verifiedLancyIcon = L.divIcon({
    className: 'lancy-marker lancy-marker-verified',
    html: `<div style="position: relative; width: 36px; height: 36px;">
        <div style="
            background: #fff;
            border: 3px solid #2563eb;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.45);
            font-weight: 800;
            color: #1d4ed8;
            font-size: 16px;
        ">📍</div>
        <div style="
            position: absolute;
            top: -4px;
            right: -4px;
            width: 16px;
            height: 16px;
            background: #2563eb;
            border-radius: 50%;
            border: 2px solid #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 10px;
            font-weight: 900;
        ">✓</div>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
});

// Componente auxiliar para recentar el mapa cuando cambia la posición del usuario
function RecenterOnUser({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center?.lat && center?.lng) {
            map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
        }
    }, [center?.lat, center?.lng, map]);
    return null;
}

// Ajusta el zoom del mapa para que el círculo de búsqueda encaje en pantalla
// cuando cambia el radio (en km).
//
// Calcula los bounds matemáticamente (no usa L.circle().getBounds() porque
// éste requiere el círculo montado en un map y revienta con
// "Cannot read properties of undefined (reading 'layerPointToLatLng')"
// si lo invocas sobre un círculo standalone).
function FitToRadius({ center, radiusKm }) {
    const map = useMap();
    useEffect(() => {
        if (!map || !center?.lat || !center?.lng || !radiusKm || radiusKm <= 0) return;
        // 1 grado de latitud ≈ 111.32 km. Para longitud aplicamos cos(lat).
        const latDelta = radiusKm / 111.32;
        const lngDelta = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
        const sw = L.latLng(center.lat - latDelta, center.lng - lngDelta);
        const ne = L.latLng(center.lat + latDelta, center.lng + lngDelta);
        const bounds = L.latLngBounds(sw, ne);
        try {
            map.flyToBounds(bounds, {
                padding: [40, 40],
                maxZoom: 16,
                duration: 0.6,
            });
        } catch (err) {
            // Edge case: mapa aún no listo o tamaño 0. Caer al setView simple.
            console.warn('[FitToRadius] flyToBounds failed, fallback setView', err);
            map.setView([center.lat, center.lng], map.getZoom(), { animate: false });
        }
    }, [center?.lat, center?.lng, radiusKm, map]);
    return null;
}

// Cuando el usuario está buscando, ajusta el viewport para que entren todos
// los workers filtrados (incluyendo al usuario mismo como referencia).
function FitToWorkers({ center, workers }) {
    const map = useMap();
    const ids = workers.map((w) => w.id).join(',');
    useEffect(() => {
        if (!map || !workers || workers.length === 0) return;
        const points = workers
            .filter((w) => w.lat != null && w.lng != null)
            .map((w) => L.latLng(w.lat, w.lng));
        if (center?.lat && center?.lng) points.push(L.latLng(center.lat, center.lng));
        if (points.length === 0) return;
        try {
            const bounds = L.latLngBounds(points);
            map.flyToBounds(bounds, {
                padding: [60, 60],
                maxZoom: 15,
                duration: 0.6,
            });
        } catch (err) {
            console.warn('[FitToWorkers] flyToBounds failed', err);
        }
    }, [ids, center?.lat, center?.lng, map, workers]);
    return null;
}

export default function MapView({
    userCoords,
    workers = [],
    onWorkerClick,
    initialZoom = 14,
    radiusKm,
    fitToWorkers = false,
}) {
    // Si no hay coords del usuario, fallback Santiago centro
    const center = userCoords?.lat && userCoords?.lng
        ? { lat: userCoords.lat, lng: userCoords.lng }
        : { lat: -33.4489, lng: -70.6693 };

    const centerLat = center.lat;
    const centerLng = center.lng;

    // Workers visibles: solo los que tienen lat/lng. Aplicamos jitter ~200m por id.
    // distance_m viene de PostGIS (más exacta que Haversine al pin jitterado).
    const workersWithCoords = useMemo(() => {
        return workers
            .filter((w) => w.lat != null && w.lng != null)
            .map((w) => {
                const jittered = jitterCoord(w.lat, w.lng, w.id, 200);
                const distKm = w.distance_m != null
                    ? w.distance_m / 1000
                    : haversineDistance(centerLat, centerLng, w.lat, w.lng);
                return { ...w, _coords: jittered, _distance: distKm };
            });
    }, [workers, centerLat, centerLng]);

    return (
        <div className="absolute inset-0 z-0">
            <MapContainer
                center={[center.lat, center.lng]}
                zoom={initialZoom}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                attributionControl={false}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                />

                {fitToWorkers && workers.length > 0
                    ? <FitToWorkers center={center} workers={workers} />
                    : radiusKm
                        ? <FitToRadius center={center} radiusKm={radiusKm} />
                        : <RecenterOnUser center={center} />}

                {/* Círculo del radio de búsqueda — feedback visual del slider */}
                {radiusKm > 0 && (
                    <Circle
                        center={[center.lat, center.lng]}
                        radius={radiusKm * 1000}
                        pathOptions={{
                            color: '#6366f1',
                            fillColor: '#6366f1',
                            fillOpacity: 0.06,
                            weight: 2,
                            dashArray: '6 4',
                        }}
                    />
                )}

                {/* Pin del usuario */}
                <CircleMarker
                    center={[center.lat, center.lng]}
                    radius={14}
                    pathOptions={{
                        color: '#4f46e5',
                        fillColor: '#6366f1',
                        fillOpacity: 0.9,
                        weight: 3,
                    }}
                >
                    <Popup>
                        <div className="text-sm font-bold text-slate-800 flex items-center gap-1">
                            <Navigation className="w-4 h-4 text-indigo-600" /> Tu ubicación
                        </div>
                        {userCoords?.isFallback && (
                            <div className="text-xs text-slate-500 mt-1">
                                (Ubicación aproximada — activa el GPS para mayor precisión)
                            </div>
                        )}
                    </Popup>
                </CircleMarker>

                {/* Lancys */}
                {workersWithCoords.map((worker) => {
                    const isVerified = !!worker.is_certified;
                    return (
                        <Marker
                            key={worker.id}
                            position={[worker._coords.lat, worker._coords.lng]}
                            icon={isVerified ? verifiedLancyIcon : lancyIcon}
                            eventHandlers={{
                                click: () => onWorkerClick && onWorkerClick(worker),
                            }}
                        >
                            <Popup>
                                <div className="flex items-center gap-3 min-w-[180px]">
                                    <img
                                        src={avatarFor(worker)}
                                        alt={worker.full_name}
                                        className={`w-12 h-12 rounded-full object-cover border-2 ${isVerified ? 'border-blue-500' : 'border-emerald-500'}`}
                                    />
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1">
                                            {worker.full_name}
                                            {isVerified && (
                                                <ShieldCheck
                                                    className="w-3.5 h-3.5 text-blue-600 shrink-0"
                                                    aria-label={`Verificado ${worker.cert_authority || ''}`.trim()}
                                                />
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                            {worker.rating ? Number(worker.rating).toFixed(1) : 'Nuevo'}
                                        </div>
                                        <div className={`text-xs font-bold flex items-center gap-1 mt-0.5 ${isVerified ? 'text-blue-600' : 'text-emerald-600'}`}>
                                            <MapPin className="w-3 h-3" />
                                            {formatDistance(worker._distance) || worker.location || 'Cerca'}
                                        </div>
                                    </div>
                                </div>
                                {isVerified && (
                                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-extrabold uppercase tracking-wide text-blue-700 flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3" />
                                        Trabajador verificado{worker.cert_authority ? ` · ${worker.cert_authority}` : ''}
                                    </div>
                                )}
                                {(worker.skill_name || worker.skill) && (
                                    <div className="text-xs text-slate-600 mt-2 pt-2 border-t border-slate-100">
                                        {worker.skill_name || worker.skill}
                                    </div>
                                )}
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
