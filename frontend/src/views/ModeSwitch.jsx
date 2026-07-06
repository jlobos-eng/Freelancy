// Toggle "Modo Contratar / Modo Trabajar" del dashboard.

export default function ModeSwitch({ mode, onChange }) {
    return (
        <div className="px-6 py-4">
            <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl flex relative overflow-hidden">
                <div
                    className={`absolute top-1 bottom-1 w-1/2 rounded-xl transition-all duration-300 shadow-md ${mode === 'client' ? 'left-1 bg-indigo-600' : 'left-[calc(50%-2px)] bg-emerald-600'
                        }`}
                />
                <button
                    onClick={() => onChange('client')}
                    className={`flex-1 py-2 text-sm font-bold relative z-10 transition-colors ${mode === 'client' ? 'text-white' : 'text-slate-500 dark:text-slate-300'
                        }`}
                >
                    Modo Contratar
                </button>
                <button
                    onClick={() => onChange('worker')}
                    className={`flex-1 py-2 text-sm font-bold relative z-10 transition-colors ${mode === 'worker' ? 'text-white' : 'text-slate-500 dark:text-slate-300'
                        }`}
                >
                    Modo Trabajar
                </button>
            </div>
        </div>
    );
}
