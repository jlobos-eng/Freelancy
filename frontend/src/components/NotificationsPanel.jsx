// NotificationsPanel — drawer lateral con la lista de notificaciones.
// Dark-mode aware. Acepta dos firmas de callbacks para retrocompatibilidad:
//   - Nuevo: onMarkOneRead, onMarkAllRead
//   - Anterior: onMarkAsRead, onMarkAllAsRead

import { useEffect } from 'react';
import {
    X, Bell, BellRing, CheckCheck, Inbox,
    Send, CheckCircle2, XCircle, Clock, MessageSquare, Wallet,
} from 'lucide-react';
import EmptyState from './EmptyState';
import { formatRelative } from '../utils/format';

const TYPE_META = {
    new_application: { icon: Send, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    application_accepted: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    application_rejected: { icon: XCircle, color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
    gig_in_review: { icon: Clock, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    gig_completed: { icon: Wallet, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
    new_message: { icon: MessageSquare, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
};

export default function NotificationsPanel({
    isOpen,
    onClose,
    notifications = [],
    unreadCount = 0,
    onMarkOneRead,
    onMarkAsRead,
    onMarkAllRead,
    onMarkAllAsRead,
    onItemClick,
}) {
    // Cerrar con Esc
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const markOne = onMarkOneRead || onMarkAsRead;
    const markAll = onMarkAllRead || onMarkAllAsRead;

    return (
        <div
            className="fixed inset-0 z-[2000] flex justify-end animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-title"
        >
            <button
                aria-label="Cerrar notificaciones"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <aside className="relative bg-white dark:bg-slate-900 w-full max-w-md h-full flex flex-col shadow-2xl animate-slide-in-right border-l border-slate-100 dark:border-slate-800">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-300">
                            {unreadCount > 0 ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 id="notifications-title" className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                                Notificaciones
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                    </button>
                </div>

                {notifications.length > 0 && unreadCount > 0 && markAll && (
                    <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                        <button
                            onClick={markAll}
                            className="w-full text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 flex items-center justify-center gap-2 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                        >
                            <CheckCheck className="w-4 h-4" /> Marcar todas como leídas
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-6">
                            <EmptyState
                                icon={Inbox}
                                title="Sin notificaciones todavía"
                                body="Aquí verás cuando alguien postule a tus gigs, te acepten o haya novedades."
                                variant="soft"
                            />
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {notifications.map((n) => {
                                const meta =
                                    TYPE_META[n.type] || { icon: Bell, color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };
                                const Icon = meta.icon;
                                const unread = !n.read_at;

                                return (
                                    <li key={n.id}>
                                        <button
                                            onClick={() => {
                                                if (unread && markOne) markOne(n.id);
                                                if (onItemClick) onItemClick(n);
                                            }}
                                            className={`w-full text-left px-6 py-4 flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors ${unread ? 'bg-indigo-50/40 dark:bg-indigo-950/30' : ''
                                                }`}
                                        >
                                            <div className={`shrink-0 p-2.5 rounded-xl ${meta.color}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm leading-tight ${unread ? 'font-extrabold text-slate-800 dark:text-slate-100' : 'font-bold text-slate-600 dark:text-slate-300'}`}>
                                                        {n.title}
                                                    </p>
                                                    {unread && (
                                                        <span className="shrink-0 w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-1.5" />
                                                    )}
                                                </div>
                                                {n.body && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                                        {n.body}
                                                    </p>
                                                )}
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1.5">
                                                    {formatRelative(n.created_at)}
                                                </p>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </aside>
        </div>
    );
}
