// Header global de la app — logo, campana de notificaciones, avatar.
// En modo worker el header es verde sólido (light/dark) para identidad visual fuerte.
// En modo client respeta el tema (blanco / slate-900).

import { ShieldCheck, Bell, RefreshCw } from 'lucide-react';
import NotificationsPanel from './NotificationsPanel';
import { avatarFor } from '../utils/avatar';

export default function AppHeader({
    mode,
    myProfile,
    onAvatarClick,
    onLogoClick,
    showNotifications,
    onToggleNotifications,
    notifications,
    unreadCount,
    onMarkOneRead,
    onMarkAllRead,
    onRefresh,
    isRefreshing = false,
    isLoading = false,
}) {
    const isWorker = mode === 'worker';
    // El destello inicial pasa cuando myProfile aún no llegó: el avatar muestra el
    // fallback de iniciales y luego salta al avatar real. Mientras el caller indique
    // isLoading o no haya myProfile, mostramos skeletons del lado derecho del header.
    const showSkeleton = isLoading || !myProfile;

    // Único string base; las variantes worker se eligen ANTES (no concatenamos sobre las dark del client)
    const headerBase = 'p-5 flex items-center justify-between sticky top-0 z-20 shadow-sm transition-colors duration-300';
    const headerVariant = isWorker
        ? 'bg-emerald-700 text-white border-b border-emerald-800 dark:bg-emerald-900 dark:border-emerald-950'
        : 'bg-white text-slate-800 border-b border-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800';

    const logoBadge = isWorker
        ? 'bg-white text-emerald-700 dark:bg-emerald-100 dark:text-emerald-800'
        : 'bg-indigo-600 text-white dark:bg-indigo-500';

    const bellIdle = isWorker
        ? 'text-emerald-100 hover:text-white'
        : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400';
    const bellActive = isWorker
        ? 'text-white'
        : 'text-indigo-600 dark:text-indigo-400';

    const badgeBorder = isWorker
        ? 'border-emerald-700 dark:border-emerald-900'
        : 'border-white dark:border-slate-900';

    const avatarBorder = isWorker
        ? 'border-emerald-300 hover:border-white dark:border-emerald-700'
        : 'border-indigo-200 hover:border-indigo-400 dark:border-indigo-700 dark:hover:border-indigo-500';

    return (
        <header className={`${headerBase} ${headerVariant}`}>
            <button
                type="button"
                onClick={onLogoClick}
                className="flex items-center gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-xl"
                aria-label="Ir al dashboard"
            >
                <div className={`p-2 rounded-xl transition-colors ${logoBadge}`}>
                    <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="font-extrabold text-xl tracking-tight">Freelancy</span>
            </button>

            <div className="flex items-center gap-4">
                {showSkeleton ? (
                    // Skeletons del lado derecho — match aproximado de las dimensiones reales
                    // para evitar layout shift cuando lleguen los datos.
                    <>
                        {onRefresh && (
                            <div
                                aria-hidden="true"
                                className={`w-5 h-5 rounded animate-pulse ${isWorker ? 'bg-emerald-600/40 dark:bg-emerald-800/60' : 'bg-slate-200 dark:bg-slate-700'}`}
                            />
                        )}
                        <div
                            aria-hidden="true"
                            className={`w-6 h-6 rounded animate-pulse ${isWorker ? 'bg-emerald-600/40 dark:bg-emerald-800/60' : 'bg-slate-200 dark:bg-slate-700'}`}
                        />
                        <div
                            aria-hidden="true"
                            className={`w-10 h-10 rounded-full animate-pulse ${isWorker ? 'bg-emerald-600/40 dark:bg-emerald-800/60' : 'bg-slate-200 dark:bg-slate-700'}`}
                        />
                    </>
                ) : (
                    <>
                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className={`p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg transition-colors ${bellIdle} disabled:opacity-50`}
                        aria-label={isRefreshing ? 'Actualizando...' : 'Actualizar'}
                        title="Actualizar (también podés tirar hacia abajo)"
                    >
                        <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                )}

                <div className="relative">
                    <button
                        onClick={onToggleNotifications}
                        className="relative p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg"
                        aria-label={`Notificaciones (${unreadCount} sin leer)`}
                    >
                        <Bell
                            className={`w-6 h-6 transition-colors ${showNotifications ? bellActive : bellIdle}`}
                        />
                        {unreadCount > 0 && (
                            <span
                                className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 ${badgeBorder}`}
                                aria-hidden="true"
                            >
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    <NotificationsPanel
                        isOpen={showNotifications}
                        onClose={onToggleNotifications}
                        notifications={notifications}
                        unreadCount={unreadCount}
                        onMarkOneRead={onMarkOneRead}
                        onMarkAllRead={onMarkAllRead}
                    />
                </div>

                <button
                    type="button"
                    onClick={onAvatarClick}
                    className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    aria-label="Mi perfil"
                >
                    <img
                        src={avatarFor(myProfile)}
                        className={`w-10 h-10 rounded-full border-2 bg-white cursor-pointer transition-all object-cover ${avatarBorder}`}
                        alt="Perfil"
                    />
                </button>
                    </>
                )}
            </div>
        </header>
    );
}
