// EmptyState — placeholder amistoso para listas vacías. Dark-mode aware.

export default function EmptyState({
    icon: Icon,
    title,
    body,
    cta,
    onCtaClick,
    variant = 'default', // 'default' | 'dashed' | 'soft'
}) {
    const containerStyles = {
        default: 'bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm',
        dashed: 'bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-600',
        soft: 'bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700',
    }[variant];

    return (
        <div className={`text-center py-12 px-6 ${containerStyles}`}>
            {Icon && (
                <div className="flex justify-center mb-4">
                    <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-2xl">
                        <Icon className="w-10 h-10 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
                    </div>
                </div>
            )}
            {title && (
                <h4 className="font-bold text-slate-700 dark:text-slate-100 text-base mb-1">{title}</h4>
            )}
            {body && (
                <p className="text-slate-400 dark:text-slate-500 text-sm mb-4 max-w-xs mx-auto">{body}</p>
            )}
            {cta && onCtaClick && (
                <button
                    onClick={onCtaClick}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all"
                >
                    {cta}
                </button>
            )}
        </div>
    );
}
