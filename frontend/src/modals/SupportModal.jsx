// SupportModal — Soporte y Ayuda.
//
// Tres secciones, navegables por tabs:
//   1. FAQs  — preguntas frecuentes colapsables.
//   2. Nuevo ticket — formulario que persiste a public.support_tickets.
//   3. Mi historial — lista de tickets enviados con respuesta del equipo.
//
// Atajos rápidos abajo: WhatsApp + email (configurables vía .env).

import { useEffect, useState } from 'react';
import {
    X, ShieldCheck, HelpCircle, Send, Loader2, Check, AlertTriangle,
    MessageCircle, Mail, ChevronDown, ChevronUp, Bug, CreditCard, UserCog, MessageSquare, Clock, FileText,
} from 'lucide-react';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'soporte@neurostrategia.cl';
// Formato internacional sin '+' ni espacios para wa.me, ej '56912345678'.
const SUPPORT_WHATSAPP = import.meta.env.VITE_SUPPORT_WHATSAPP || '';

const TICKET_TYPES = [
    { value: 'bug', label: 'Algo no funciona', Icon: Bug, color: 'text-red-600' },
    { value: 'payment', label: 'Problema con pagos', Icon: CreditCard, color: 'text-emerald-600' },
    { value: 'account', label: 'Cuenta o login', Icon: UserCog, color: 'text-indigo-600' },
    { value: 'question', label: 'Pregunta general', Icon: MessageSquare, color: 'text-amber-600' },
    { value: 'other', label: 'Otro', Icon: HelpCircle, color: 'text-slate-500' },
];

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Baja', desc: 'No es urgente' },
    { value: 'normal', label: 'Normal', desc: 'Esta semana' },
    { value: 'high', label: 'Alta', desc: 'Bloquea mi uso' },
];

const FAQS = [
    {
        q: '¿Cómo me pagan los gigs que completo?',
        a: 'Cuando el cliente aprueba el trabajo, el pago se libera a tu billetera. Puedes retirar a tu cuenta vía Mercado Pago desde la pestaña Wallet.',
    },
    {
        q: '¿Cómo subo mi certificación SEC, MINSAL u otra?',
        a: 'Ve a Mi Perfil → sección Certificaciones → Subir mi primera certificación. Adjunta el documento (PDF o imagen, máx 5 MB), número de credencial y fecha de vencimiento. El equipo revisa en hasta 48 hrs.',
    },
    {
        q: '¿Por qué no aparezco en el mapa?',
        a: 'Necesitas (1) tener rol "worker", (2) compartir tu ubicación desde Mi Perfil → "Compartir mi ubicación", (3) tener al menos una habilidad agregada en tu perfil.',
    },
    {
        q: 'Tengo un problema con un cliente o lancy. ¿Qué hago?',
        a: 'Si el gig está activo, abre una disputa desde Tus Contratos → "Reportar problema". El pago queda en pausa hasta que se resuelva. Para casos graves, abre un ticket aquí con tipo "Otro".',
    },
    {
        q: '¿Cómo elimino mi cuenta?',
        a: 'Por ahora, abre un ticket con tipo "Cuenta o login" pidiendo eliminación. El equipo procesa la solicitud en 7 días hábiles cumpliendo la Ley 19.628 de Datos Personales.',
    },
];

function ticketTypeMeta(value) {
    return TICKET_TYPES.find((t) => t.value === value) || TICKET_TYPES[TICKET_TYPES.length - 1];
}

function statusBadge(status) {
    switch (status) {
        case 'open':
            return { label: 'Abierto', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
        case 'in_progress':
            return { label: 'En revisión', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' };
        case 'answered':
            return { label: 'Respondido', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
        case 'closed':
            return { label: 'Cerrado', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' };
        default:
            return { label: status, className: 'bg-slate-100 text-slate-600' };
    }
}

export default function SupportModal({
    isOpen,
    onClose,
    tickets = [],
    isSubmitting,
    onCreateTicket,    // async (payload) => void
    contextSnapshot,   // { tab, mode, gig_id } u objeto vacío
}) {
    const [activeTab, setActiveTab] = useState('new'); // 'new' | 'faqs' | 'history'
    const [form, setForm] = useState(initialForm());
    const [errors, setErrors] = useState({});
    const [success, setSuccess] = useState(false);
    const [openFaq, setOpenFaq] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setForm(initialForm());
            setErrors({});
            setSuccess(false);
            setOpenFaq(null);
            // si ya tiene tickets, abrir en historial; si no, en nuevo
            setActiveTab(tickets.length > 0 ? 'new' : 'new');
        }
    }, [isOpen, tickets.length]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !isSubmitting) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen) return null;

    const validate = () => {
        const e = {};
        if (!form.type) e.type = 'Selecciona un tipo';
        if (!form.subject.trim() || form.subject.trim().length < 4) e.subject = 'Mínimo 4 caracteres';
        if (!form.description.trim() || form.description.trim().length < 10) e.description = 'Cuéntanos un poco más (mín 10 caracteres)';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validate()) return;
        try {
            await onCreateTicket({
                type: form.type,
                priority: form.priority,
                subject: form.subject,
                description: form.description,
                context: contextSnapshot || {},
            });
            setSuccess(true);
            setForm(initialForm());
            // ir al historial para ver el recién creado
            setTimeout(() => {
                setSuccess(false);
                setActiveTab('history');
            }, 1200);
        } catch (err) {
            setErrors({ submit: err?.message || 'No pudimos enviar tu ticket. Intenta de nuevo.' });
        }
    };

    const waLink = SUPPORT_WHATSAPP
        ? `https://wa.me/${SUPPORT_WHATSAPP.replace(/[^\d]/g, '')}`
        : null;
    const mailLink = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Soporte Freelancy')}`;

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-modal-title"
            onClick={() => !isSubmitting && onClose()}
        >
            <div
                className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-slide-in-bottom"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-xl text-amber-600 dark:text-amber-400">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <h3 id="support-modal-title" className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                            Soporte y Ayuda
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 pt-4 flex gap-2 border-b border-slate-100 dark:border-slate-700">
                    <TabButton active={activeTab === 'new'} onClick={() => setActiveTab('new')} label="Nuevo ticket" Icon={Send} />
                    <TabButton active={activeTab === 'faqs'} onClick={() => setActiveTab('faqs')} label="FAQs" Icon={HelpCircle} />
                    <TabButton
                        active={activeTab === 'history'}
                        onClick={() => setActiveTab('history')}
                        label={`Historial${tickets.length ? ` (${tickets.length})` : ''}`}
                        Icon={FileText}
                    />
                </div>

                {/* Tab content */}
                <div className="px-6 pb-6 pt-4">
                    {activeTab === 'new' && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {success && (
                                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-emerald-800 dark:text-emerald-200 font-bold">
                                        ¡Ticket enviado! Te avisaremos cuando el equipo responda.
                                    </p>
                                </div>
                            )}

                            {/* Type */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 block">
                                    ¿Qué tipo de problema es? *
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {TICKET_TYPES.map(({ value, label, Icon, color }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setForm((p) => ({ ...p, type: value }))}
                                            className={`p-3 rounded-xl border text-left transition-all ${form.type === value
                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-500'
                                                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                                                }`}
                                        >
                                            <Icon className={`w-4 h-4 ${color} dark:opacity-90 mb-1`} />
                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{label}</p>
                                        </button>
                                    ))}
                                </div>
                                {errors.type && <p className="text-xs text-red-600 mt-1">{errors.type}</p>}
                            </div>

                            {/* Priority */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 block">
                                    Urgencia
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {PRIORITY_OPTIONS.map(({ value, label, desc }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setForm((p) => ({ ...p, priority: value }))}
                                            className={`px-2 py-2 rounded-lg border text-center transition-all ${form.priority === value
                                                ? value === 'high'
                                                    ? 'border-red-400 bg-red-50 dark:bg-red-950/40 dark:border-red-700'
                                                    : value === 'low'
                                                        ? 'border-slate-400 bg-slate-100 dark:bg-slate-700 dark:border-slate-500'
                                                        : 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-500'
                                                : 'border-slate-200 dark:border-slate-600'
                                                }`}
                                        >
                                            <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">{label}</p>
                                            <p className="text-[9px] text-slate-500 dark:text-slate-400">{desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Subject */}
                            <div>
                                <label htmlFor="ticket-subject" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                                    Asunto *
                                </label>
                                <input
                                    id="ticket-subject"
                                    type="text"
                                    value={form.subject}
                                    onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                                    placeholder="Resumen breve (ej: 'No puedo retirar mi saldo')"
                                    maxLength={120}
                                    className={`w-full px-3 py-2.5 border rounded-xl text-sm text-slate-800 dark:text-slate-100 outline-none ${errors.subject
                                        ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-indigo-500'
                                        }`}
                                />
                                {errors.subject && <p className="text-xs text-red-600 mt-1">{errors.subject}</p>}
                            </div>

                            {/* Description */}
                            <div>
                                <label htmlFor="ticket-desc" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                                    Descripción *
                                </label>
                                <textarea
                                    id="ticket-desc"
                                    rows="4"
                                    value={form.description}
                                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                                    placeholder="Cuéntanos qué pasó, qué esperabas que pasara y cualquier detalle útil (fechas, montos, etc.)"
                                    maxLength={1500}
                                    className={`w-full px-3 py-2.5 border rounded-xl text-sm text-slate-800 dark:text-slate-100 outline-none resize-none ${errors.description
                                        ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                                        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-indigo-500'
                                        }`}
                                />
                                <div className="flex justify-between items-center mt-1">
                                    {errors.description ? (
                                        <p className="text-xs text-red-600">{errors.description}</p>
                                    ) : <span />}
                                    <span className="text-[10px] text-slate-400">{form.description.length}/1500</span>
                                </div>
                            </div>

                            {errors.submit && (
                                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700 dark:text-red-200">{errors.submit}</p>
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 bg-indigo-600 text-white font-extrabold rounded-2xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                                ) : (
                                    <><Send className="w-5 h-5" /> Enviar ticket</>
                                )}
                            </button>

                            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
                                Adjuntamos automáticamente versión de la app, navegador y la pantalla en la que estás
                                para ayudarnos a resolverlo más rápido. No incluimos contraseñas.
                            </p>

                            {/* Atajos */}
                            <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-2">
                                <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 dark:text-slate-500 text-center">
                                    O contáctanos directo
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {waLink && (
                                        <a
                                            href={waLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold"
                                        >
                                            <MessageCircle className="w-4 h-4" /> WhatsApp
                                        </a>
                                    )}
                                    <a
                                        href={mailLink}
                                        className={`flex items-center justify-center gap-2 py-2.5 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold ${!waLink ? 'col-span-2' : ''}`}
                                    >
                                        <Mail className="w-4 h-4" /> Email
                                    </a>
                                </div>
                            </div>
                        </form>
                    )}

                    {activeTab === 'faqs' && (
                        <div className="space-y-2">
                            {FAQS.map((faq, idx) => (
                                <div
                                    key={idx}
                                    className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                        className="w-full px-4 py-3 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 text-left"
                                    >
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                {faq.q}
                                            </span>
                                        </div>
                                        {openFaq === idx
                                            ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                                            : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                                    </button>
                                    {openFaq === idx && (
                                        <div className="px-4 pb-3 pl-10 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                            {faq.a}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => setActiveTab('new')}
                                className="w-full mt-3 py-3 border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold text-sm hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all flex items-center justify-center gap-2"
                            >
                                <Send className="w-4 h-4" /> Mi pregunta no está aquí
                            </button>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        tickets.length === 0 ? (
                            <div className="text-center py-10">
                                <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    Aún no has enviado tickets
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                    Cuando crees uno, lo verás aquí con la respuesta del equipo.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('new')}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
                                >
                                    <Send className="w-3.5 h-3.5" /> Crear ticket
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {tickets.map((t) => <TicketRow key={t.id} ticket={t} />)}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, label, Icon }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${active
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    );
}

function TicketRow({ ticket }) {
    const meta = ticketTypeMeta(ticket.type);
    const badge = statusBadge(ticket.status);
    const TypeIcon = meta.Icon;

    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800">
            <div className="flex items-start gap-3">
                <div className={`p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 ${meta.color} shrink-0`}>
                    <TypeIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
                            {ticket.subject}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${badge.className}`}>
                            {badge.label}
                        </span>
                        {ticket.priority === 'high' && (
                            <span className="text-[9px] font-extrabold uppercase bg-red-600 text-white px-1.5 py-0.5 rounded">
                                Alta
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ticket.created_at).toLocaleString('es-CL', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap">
                        {ticket.description}
                    </p>
                    {ticket.admin_response && (
                        <div className="mt-3 bg-emerald-50 dark:bg-emerald-950/30 border-l-2 border-emerald-500 px-3 py-2 rounded-r-lg">
                            <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 flex items-center gap-1 mb-1">
                                <ShieldCheck className="w-3 h-3" /> Equipo Freelancy
                            </p>
                            <p className="text-xs text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap leading-relaxed">
                                {ticket.admin_response}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function initialForm() {
    return {
        type: '',
        priority: 'normal',
        subject: '',
        description: '',
    };
}
