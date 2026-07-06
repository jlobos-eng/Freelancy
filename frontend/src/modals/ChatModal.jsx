// Chat 1-a-1 dentro de un gig.
// Realtime se maneja arriba (App.jsx) — este componente solo presenta.

import { useEffect, useRef } from 'react';
import { ArrowRight, X } from 'lucide-react';

export default function ChatModal({
    isOpen,
    gig,
    messages = [],
    myProfileId,
    newMessage,
    onChangeMessage,
    onSendMessage,
    onClose,
}) {
    const scrollRef = useRef(null);

    // Auto-scroll al final cuando llegan mensajes
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length, isOpen]);

    if (!isOpen || !gig) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 sm:p-6 animate-fade-in"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-slate-50 dark:bg-slate-900 w-full max-w-md h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-zoom-in-95 border border-slate-200 dark:border-slate-700">
                <div className="bg-white dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                            {gig.title}
                        </h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">
                            Chat del trabajo
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600"
                        aria-label="Cerrar chat"
                    >
                        <X className="w-4 h-4 text-slate-600 dark:text-slate-200" />
                    </button>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-10">
                            No hay mensajes aún. ¡Escribe el primero!
                        </p>
                    ) : (
                        messages.map((msg) => {
                            const isMe = msg.sender_id === myProfileId;
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isMe
                                                ? 'bg-indigo-600 text-white rounded-br-sm'
                                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-sm shadow-sm'
                                            }`}
                                    >
                                        {!isMe && (
                                            <span className="text-[9px] font-bold opacity-50 block mb-1">
                                                {msg.profiles?.full_name?.split(' ')[0]}
                                            </span>
                                        )}
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <form
                    onSubmit={onSendMessage}
                    className="bg-white dark:bg-slate-800 p-3 border-t border-slate-200 dark:border-slate-700 flex gap-2"
                >
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => onChangeMessage(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 outline-none text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center"
                        aria-label="Enviar mensaje"
                    >
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
    );
}
