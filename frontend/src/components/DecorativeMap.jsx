// Mini mapa real (Leaflet + OpenStreetMap) en el Dashboard cliente.
//
// No interactivo: zoom/pan/drag/touch están deshabilitados a propósito para
// que el gesto del usuario pase al scroll del Dashboard. El card entero es
// un botón que lleva a la pestaña Mapa completa (ahí sí es interactivo).
//
// Privacidad: usa jitter ~200m sobre las coords de los lancys, igual que MapView.

import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Map as MapIcon } from 'lucide-react';
import { jitterCoord } from '../utils/geo';

// Pin verde simple para los lancys (mismo estilo que MapView pero más chico)
const miniLancyIcon = L.divIcon({
    className: 'mini-lancy-marker',
    html: `<div style="
        background:#fff;
        border:2px solid #10b981;
        border-radius:50%;
        width:22px;
        height:22px;
        box-shadow:0 2px 6px rgba(16,185,129,.35);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
});

const miniVerifiedIcon = L.divIcon({
    className: 'mini-verified-marker',
    html: `<div style="
        background:#fff;
        border:2px solid #2563eb;
        border-radius:50%;
        width:22px;
        height:22px;
        box-shadow:0 2px 6px rgba(37,99,235,.45);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
});

export default function DecorativeMap({ workers = [], userCoords, location, onClick }) {
    // Centro: ubicación del usuario o fallback Santiago centro
    const center = userCoords?.lat && userCoords?.lng
        ? { lat: userCoords.lat, lng: userCoords.lng }
        : { lat: -33.4489, lng: -70.6693 };

    // Workers visibles con jitter de privacidad
    const markers = useMemo(() => {
        return workers
            .filter((w) => w.lat != null && w.lng != null)
            .slice(0, 30) // tope para no saturar el mini mapa
            .map((w) => {
                const j = jitterCoord(w.lat, w.lng, w.id, 200);
                return { ...w, _coords: j };
            });
    }, [workers]);

    return (
        <button
            type="button"
            onClick={onClick}
            className="relative h-64 w-full rounded-3xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-700 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 bg-slate-200 dark:bg-slate-800"
            aria-label="Abrir mapa completo"
        >
            {/*
              Mapa real, no interactivo (todos los gestos deshabilitados).
              z-index 0 explícito en el wrapper: por defecto Leaflet inyecta
              .leaflet-container con z-index implícito 400 que se monta sobre
              cualquier modal con z-index < 400. Aislamos aquí para que el
              mapa nunca compita con modales (que viven en z-[2000]).
            */}
            <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 0 }}>
                <MapContainer
                    center={[center.lat, center.lng]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    attributionControl={false}
                    dragging={false}
                    doubleClickZoom={false}
                    scrollWheelZoom={false}
                    touchZoom={false}
                    boxZoom={false}
                    keyboard={false}
                    tap={false}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution=""
                    />

                    {/* Pin del usuario */}
                    <CircleMarker
                        center={[center.lat, center.lng]}
                        radius={9}
                        pathOptions={{
                            color: '#4f46e5',
                            fillColor: '#6366f1',
                            fillOpacity: 0.9,
                            weight: 2,
                        }}
                    />

                    {/* Lancys cercanos (sin popup, no clickeables) */}
                    {markers.map((w) => (
                        <Marker
                            key={w.id}
                            position={[w._coords.lat, w._coords.lng]}
                            icon={w.is_certified ? miniVerifiedIcon : miniLancyIcon}
                            interactive={false}
                            keyboard={false}
                        />
                    ))}
                </MapContainer>
            </div>

            {/* Overlay sutil para asegurar contraste de los chips */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-900/40 to-transparent pointer-events-none" />

            {/* Chip de ubicación abajo izq */}
            <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm flex items-center gap-2">
                <Navigation className="w-3 h-3 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                {location ? `Cerca de ${location}` : userCoords?.lat ? 'Tu ubicación' : 'Buscando ubicación...'}
            </div>

            {/* Chip "Ver mapa" abajo der (siempre visible, no solo en hover) */}
            <div className="absolute bottom-3 right-3 bg-indigo-600 text-white text-[10px] font-extrabold uppercase px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                <MapIcon className="w-3 h-3" />
                Ver mapa completo
            </div>
        </button>
    );
}
