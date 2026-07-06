// ChatButton — botón "Chat" / "Abrir Chat" con badge de mensajes no leídos.
// Uniformiza el comportamiento entre DashboardClient y DashboardWorker.
//
// Props:
//   onClick: () => void
//   unreadCount: number
//   variant: 'compact' (worker, vertical) | 'full' (cliente, horizontal)
//   label: override del texto

export default function ChatButton({
    onClick,
    unreadCount = 0,
    variant = 'compact',
    label,
}) {
    const hasUnread = unreadCount > 0;
    const display = unreadCount > 9 ? '9+' : String(unreadCount);

    const text = label || (variant === 'full' ? 'Abrir Chat' : 'Chat');

    if (variant === 'full') {
        return (
            <button
                onClick={onClick}
                className="relative w-full mt-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
            >
                {text}
                {hasUnread && (
                    <span
                        aria-label={`${unreadCount} mensaje${unreadCount === 1 ? '' : 's'} sin leer`}
                        className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-extrabold"
                    >
                        {display}
                    </span>
                )}
            </button>
        );
    }

    return (
        <button
            onClick={onClick}
            className="relative text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg uppercase shadow-sm hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all w-full text-center mt-1"
        >
            {text}
            {hasUnread && (
                <span
                    aria-label={`${unreadCount} mensaje${unreadCount === 1 ? '' : 's'} sin leer`}
                    className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold border-2 border-white dark:border-slate-800"
                >
                    {display}
                </span>
            )}
        </button>
    );
}
