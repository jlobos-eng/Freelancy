// Vista de Ajustes — toggles, modo oscuro (vía ThemeContext), logout.

import { Bell, BellOff, MapPin, Moon, ShieldCheck, ArrowRight, LogOut, Sun, Loader2, Clock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import usePushSubscription from '../hooks/usePushSubscription';
import toast from 'react-hot-toast';

// Master switch: solo cuando VITE_PUSH_ENABLED='true' habilitamos el toggle de
// push real. En cualquier otro caso lo mostramos como "Próximamente" para
// evitar errores rojos cuando el setup de servidor (VAPID privada en Supabase
// secrets + Edge Function send-push deployada) aún no está hecho.
const PUSH_ENABLED = import.meta.env.VITE_PUSH_ENABLED === 'true';

function Toggle({ active, onClick, accentClass = 'bg-emerald-500', label }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            aria-label={label}
            onClick={onClick}
            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out ${active ? accentClass : 'bg-slate-300 dark:bg-slate-600'
                }`}
        >
            <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-0'
                    }`}
            />
        </button>
    );
}

function SettingRow({ Icon, iconBg, iconColor, title, subtitle, children }) {
    return (
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
                <div className={`${iconBg} p-2 rounded-xl ${iconColor} shrink-0`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                    <span className="font-bold text-slate-700 dark:text-slate-100 block text-sm">
                        {title}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{subtitle}</span>
                </div>
            </div>
            {children}
        </div>
    );
}

export default function SettingsView({
    appSettings,
    onChangeSettings,
    onLogout,
    onSupport,
}) {
    const { isDark, toggleTheme } = useTheme();
    const push = usePushSubscription();

    const handleTogglePush = async () => {
        if (!push.isSupported) {
            toast.error('Tu navegador no soporta notificaciones push.');
            return;
        }
        try {
            if (push.isSubscribed) {
                await push.unsubscribe();
                toast.success('Notificaciones desactivadas');
            } else {
                await push.subscribe();
                toast.success('¡Notificaciones activadas!');
            }
        } catch (err) {
            const msg = err?.message || 'Error desconocido';
            if (msg.includes('Permiso denegado') || push.permission === 'denied') {
                toast.error('Permiso denegado. Habilítalo desde la configuración del navegador.');
            } else {
                toast.error('Error: ' + msg);
            }
        }
    };

    return (
        <main className="flex-1 px-6 py-8 animate-fade-in">
            <h2 className="text-2xl font-extrabold mb-6 text-slate-800 dark:text-slate-100">
                Preferencias
            </h2>

            <div className="rounded-3xl shadow-sm border overflow-hidden mb-6 bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                {PUSH_ENABLED ? (
                    <SettingRow
                        Icon={push.isSubscribed ? Bell : BellOff}
                        iconBg="bg-indigo-100 dark:bg-indigo-900/50"
                        iconColor="text-indigo-600 dark:text-indigo-400"
                        title="Notificaciones Push"
                        subtitle={
                            !push.isSupported
                                ? 'No soportadas en este navegador'
                                : push.permission === 'denied'
                                    ? 'Bloqueadas — habilítalas en el navegador'
                                    : push.isSubscribed
                                        ? 'Activadas en este dispositivo'
                                        : 'Avisos de nuevas postulaciones, pagos y disputas'
                        }
                    >
                        {push.loading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                        ) : (
                            <Toggle
                                active={push.isSubscribed}
                                label={push.isSubscribed ? 'Desactivar notificaciones' : 'Activar notificaciones'}
                                onClick={handleTogglePush}
                            />
                        )}
                    </SettingRow>
                ) : (
                    /* Push aún no configurado en server. Mostramos placeholder en gris. */
                    <SettingRow
                        Icon={Bell}
                        iconBg="bg-slate-100 dark:bg-slate-700/60"
                        iconColor="text-slate-400 dark:text-slate-500"
                        title="Notificaciones Push"
                        subtitle="Próximamente — recibirás alertas de postulaciones y pagos"
                    >
                        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-md">
                            <Clock className="w-3 h-3" />
                            Próximamente
                        </span>
                    </SettingRow>
                )}

                <SettingRow
                    Icon={MapPin}
                    iconBg="bg-emerald-100 dark:bg-emerald-900/50"
                    iconColor="text-emerald-600 dark:text-emerald-400"
                    title="Usar mi Ubicación"
                    subtitle="Para aparecer en el mapa"
                >
                    <Toggle
                        active={appSettings.ubicacion}
                        label="Activar ubicación"
                        onClick={() =>
                            onChangeSettings({ ...appSettings, ubicacion: !appSettings.ubicacion })
                        }
                    />
                </SettingRow>

                <SettingRow
                    Icon={isDark ? Moon : Sun}
                    iconBg={isDark ? 'bg-indigo-900/40' : 'bg-amber-100'}
                    iconColor={isDark ? 'text-indigo-300' : 'text-amber-600'}
                    title="Modo Oscuro"
                    subtitle={isDark ? 'Activado — qué descanso' : 'Apagar las luces de la app'}
                >
                    <Toggle
                        active={isDark}
                        label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                        onClick={toggleTheme}
                        accentClass="bg-indigo-600"
                    />
                </SettingRow>

                <button
                    type="button"
                    onClick={onSupport}
                    className="w-full p-5 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors text-left"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-xl text-amber-600 dark:text-amber-400">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-100 text-sm">
                            Soporte y Ayuda
                        </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                </button>
            </div>

            <button
                onClick={onLogout}
                className="w-full flex justify-center items-center gap-2 py-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl font-bold border border-red-100 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors shadow-sm active:scale-95"
            >
                <LogOut className="w-5 h-5" /> Cerrar Sesión
            </button>

            <div className="mt-6 space-y-2">
                <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    Freelancy v0.1.0 · Hecho en Chile 🇨🇱
                </p>
                <a
                    href="https://neurostrategia.cl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-medium hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
                    aria-label="Hecho por Neurostrategia (sitio externo)"
                >
                    <span>Hecho por</span>
                    <img
                        src="/neurostrategia.png"
                        alt="Neurostrategia"
                        className="w-5 h-5 rounded-md object-cover ring-1 ring-slate-200 dark:ring-slate-700 group-hover:ring-indigo-400 transition-all"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <span className="font-bold tracking-wide">Neurostrategia</span>
                </a>
            </div>
        </main>
    );
}
