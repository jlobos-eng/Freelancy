// SkeletonCard — placeholders para fetchs. Dark-mode aware.

export function SkeletonCard() {
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 animate-pulse">
            <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-700 shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded w-1/2" />
            </div>
            <div className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-700" />
        </div>
    );
}

export function SkeletonGigCard() {
    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-emerald-100 dark:border-slate-700 mb-4 animate-pulse">
            <div className="w-full h-32 bg-slate-200 dark:bg-slate-700 rounded-2xl mb-4" />
            <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded w-1/3" />
                </div>
                <div className="text-right space-y-2">
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20" />
                    <div className="h-7 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg w-20" />
                </div>
            </div>
        </div>
    );
}

export function SkeletonHistoryItem() {
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3 flex-1">
                <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                    <div className="h-2 bg-slate-100 dark:bg-slate-700/60 rounded w-1/3" />
                </div>
            </div>
            <div className="h-4 bg-emerald-100 dark:bg-emerald-900/40 rounded w-20" />
        </div>
    );
}

export function SkeletonList({ count = 3, variant = 'card' }) {
    const items = Array.from({ length: count });
    const Component = variant === 'gig' ? SkeletonGigCard : variant === 'history' ? SkeletonHistoryItem : SkeletonCard;
    return (
        <div className="space-y-4">
            {items.map((_, i) => (
                <Component key={i} />
            ))}
        </div>
    );
}
