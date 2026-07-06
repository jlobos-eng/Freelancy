// Navegación inferior fija — 4 tabs.
// El color activo cambia según el modo (cliente=indigo, worker=emerald).

import { Layers, MapPin, Wallet, Settings } from 'lucide-react';

const TABS = [
    { id: 'dashboard', label: 'Dashboard', Icon: Layers },
    { id: 'map', label: 'Mapa', Icon: MapPin },
    { id: 'wallet', label: 'Pagos', Icon: Wallet },
    { id: 'settings', label: 'Ajustes', Icon: Settings },
];

export default function BottomNav({ activeTab, mode, onChange }) {
    return (
        <nav className="fixed bottom-0 w-full backdrop-blur-xl flex justify-around items-center py-5 z-20 transition-colors duration-300 bg-white/80 dark:bg-slate-950/90 border-t border-slate-100 dark:border-slate-800">
            {TABS.map((tab) => {
                const TabIcon = tab.Icon;
                const isActive = activeTab === tab.id;
                const activeColor = mode === 'client' ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400';
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`flex flex-col items-center gap-1 transition-colors ${isActive ? activeColor : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <TabIcon className="w-6 h-6" />
                        <span className="text-[10px] font-bold">{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
