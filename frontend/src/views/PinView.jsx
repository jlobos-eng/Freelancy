// PinView — clave de seguridad de 4 dígitos para entrar a la app.
// MVP: cualquier PIN de 4 dígitos es válido (la auth real está en Supabase).
// Cuando exista back de PIN, esto valida contra la BD.

import { useState } from 'react';
import { LogIn, Delete } from 'lucide-react';

export default function PinView({ onNext }) {
    const [pin, setPin] = useState('');

    const handleKey = (num) => {
        if (num === '←') {
            setPin((p) => p.slice(0, -1));
            return;
        }
        if (typeof num !== 'number' || pin.length >= 4) return;
        const next = pin + num;
        setPin(next);
        if (next.length === 4) setTimeout(onNext, 300);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-600 dark:bg-indigo-800 p-6 text-white transition-colors">
            <div className="w-full max-w-md text-center">
                <div className="mb-6 flex justify-center">
                    <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
                        <LogIn className="w-10 h-10 text-white" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold mb-2">Bienvenido de nuevo</h2>
                <p className="text-white/70 mb-10">Ingresa tu clave de seguridad de 4 dígitos</p>

                <div className="flex justify-center gap-4 mb-12">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={`w-4 h-4 rounded-full border-2 border-white transition-all ${pin.length > i ? 'bg-white scale-110' : 'bg-transparent'
                                }`}
                        />
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-6 max-w-xs mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '←'].map((num, i) => (
                        <button
                            key={i}
                            onClick={() => handleKey(num)}
                            disabled={num === ''}
                            className="h-16 w-16 text-2xl font-bold rounded-full hover:bg-white/10 active:bg-white/20 transition-all flex items-center justify-center disabled:opacity-0 disabled:cursor-default"
                            aria-label={num === '←' ? 'Borrar' : typeof num === 'number' ? `Tecla ${num}` : ''}
                        >
                            {num === '←' ? <Delete className="w-6 h-6" /> : num}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
