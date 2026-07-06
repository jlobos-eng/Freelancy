// PullToRefreshContainer — wrapper que añade pull-to-refresh nativo a sus children.
//
// Diseño:
//   - NO crea un contenedor scrolleable propio. El scroll lo maneja el wrapper
//     raíz de la app (<div min-h-screen>) o el <body>, así la rueda del mouse
//     y el touch funcionan en CUALQUIER zona de la pantalla, no solo dentro
//     de este wrapper. Esto era el bug: con overflow-y-auto interno, el
//     cursor tenía que estar sobre el div hijo para scrollear.
//   - El indicador "pull" se renderiza fixed arriba (con translateY ligado al
//     pullDistance) en lugar de ocupar espacio del flow.
//   - El hook usePullToRefresh ahora escucha en `window` y lee `window.scrollY`
//     para detectar "estoy en top" — funciona aunque el scroll lo maneje el body.
//
// Uso:
//   <PullToRefreshContainer onRefresh={fetchData}>
//     <DashboardClient ... />
//   </PullToRefreshContainer>

import { RefreshCw, ArrowDown } from 'lucide-react';
import usePullToRefresh from '../hooks/usePullToRefresh';

export default function PullToRefreshContainer({ onRefresh, children, className = '' }) {
    const { pullDistance, isRefreshing, threshold } = usePullToRefresh(onRefresh);
    const progress = Math.min(1, pullDistance / threshold);
    const ready = pullDistance >= threshold;

    return (
        <div className={`relative ${className}`}>
            {/* Indicador fixed para que aparezca sobre el contenido sin desplazarlo */}
            {(pullDistance > 0 || isRefreshing) && (
                <div
                    aria-hidden="true"
                    className="fixed left-0 right-0 top-0 flex items-start justify-center pointer-events-none z-[1500] pt-4 transition-opacity"
                    style={{ opacity: progress || (isRefreshing ? 1 : 0) }}
                >
                    {isRefreshing ? (
                        <div className="bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg">
                            <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                        </div>
                    ) : (
                        <div
                            className="bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg transition-transform"
                            style={{ transform: `rotate(${progress * 180}deg)` }}
                        >
                            <ArrowDown className={`w-5 h-5 ${ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        </div>
                    )}
                </div>
            )}

            {/* Children sin overflow propio: el scroll lo maneja el wrapper raíz */}
            <div
                style={{
                    transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none',
                    transition: pullDistance === 0 ? 'transform 200ms ease-out' : 'none',
                }}
            >
                {children}
            </div>
        </div>
    );
}
