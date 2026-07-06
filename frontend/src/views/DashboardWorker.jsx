// Dashboard "Modo Trabajar" — saldo, gigs en curso, bolsa de trabajo.

import { CheckCircle2, Briefcase, ShieldAlert, Wallet, ArrowRight, Loader2 } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { SkeletonList } from '../components/SkeletonCard';
import ChatButton from '../components/ChatButton';
import { formatCLP, formatEta } from '../utils/format';
import { CATEGORIAS, gigMatchesCategory } from '../utils/categories';
import useWallet from '../hooks/useWallet';

export default function DashboardWorker({
    myProfile,
    myActiveGigs,
    openGigs,
    myApplications,
    isLoadingData,
    onJumpToWallet,
    onCompleteGig,
    onOpenChat,
    onOpenBidModal,
    disputesByGig,
    onOpenDispute,
    selectedCategory = 'Todos',
    onChangeCategory,
    unreadByGig,
}) {
    // Saldo Protegido = transactions con status='escrowed' (el cliente ya pagó pero
    // el gig aún no se aprueba). Lo leemos de la vista wallet_balance, fuente única
    // de verdad. NO usar profiles.balance — ese es un campo legacy con valor seed.
    const { balance: wallet, loading: walletLoading } = useWallet(myProfile?.id);
    const protectedBalance = wallet.pending;
    const needsMpOnboarding = !myProfile?.mp_user_id;
    const filteredOpenGigs = openGigs.filter((g) => gigMatchesCategory(g, selectedCategory));
    const hasActiveCategory = selectedCategory && selectedCategory !== 'Todos';

    return (
        <main className="flex-1 px-6 space-y-6">
            <div className="bg-emerald-700 dark:bg-emerald-900 text-white p-8 rounded-[40px] shadow-xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-600/40 dark:bg-emerald-700/50 rounded-full" />
                <p
                    className="text-emerald-100 dark:text-emerald-200 text-sm font-medium mb-1 inline-flex items-center gap-1 cursor-help"
                    title="Plata que clientes ya pagaron por gigs en curso, en custodia hasta que aprueben tu trabajo. Cuando aprueben, pasa a Saldo Disponible (pestaña Pagos)."
                >
                    Mi Saldo Protegido
                    <span className="text-[10px] opacity-70">ⓘ</span>
                </p>
                <h2 className="text-4xl font-extrabold mb-6 flex items-baseline gap-2">
                    {walletLoading ? (
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-200" />
                    ) : (
                        <>
                            ${formatCLP(protectedBalance)}
                            <span className="text-lg text-emerald-200 dark:text-emerald-300 font-normal">CLP</span>
                        </>
                    )}
                </h2>
                <div className="flex gap-4">
                    <button
                        onClick={onJumpToWallet}
                        className="flex-1 bg-white text-emerald-800 py-3 rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-all"
                    >
                        Retirar
                    </button>
                    <button
                        onClick={onJumpToWallet}
                        className="flex-1 bg-emerald-800/40 dark:bg-emerald-700/50 text-white border border-emerald-400 dark:border-emerald-500 py-3 rounded-2xl font-bold text-sm backdrop-blur-sm active:scale-95 transition-all"
                    >
                        Historial
                    </button>
                </div>
            </div>

            {/* Onboarding gate — sin MP el Lancy no puede postular ni cobrar */}
            {needsMpOnboarding && (
                <button
                    onClick={onJumpToWallet}
                    className="w-full bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-amber-100 dark:hover:bg-amber-950/50 active:scale-[0.99] transition-all"
                >
                    <div className="bg-amber-200 dark:bg-amber-900/50 p-2.5 rounded-xl text-amber-800 dark:text-amber-200 shrink-0">
                        <Wallet className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-amber-900 dark:text-amber-100 text-sm">
                            Activa los pagos para empezar
                        </p>
                        <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                            Conecta Mercado Pago para postular a Gigs y recibir el dinero.
                        </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0" />
                </button>
            )}

            {myActiveGigs.length > 0 && (
                <div>
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Gigs en curso
                    </h3>
                    {myActiveGigs.map((gig) => {
                        const hasDispute = disputesByGig?.has(gig.id);
                        return (
                            <div
                                key={gig.id}
                                className={`p-5 rounded-3xl shadow-sm border-2 flex items-center gap-4 mb-4 relative overflow-hidden ${hasDispute
                                    ? 'bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-700'
                                    : 'bg-white border-emerald-500 dark:bg-slate-800 dark:border-emerald-600'
                                    }`}
                            >
                                <div
                                    className={`absolute top-0 left-0 w-2 h-full ${hasDispute ? 'bg-red-500'
                                        : gig.status === 'review' ? 'bg-amber-400'
                                            : 'bg-emerald-400'
                                        }`}
                                />
                                <div className="flex-1 pl-2 min-w-0">
                                    <div className="flex items-center gap-1 flex-wrap">
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">{gig.title}</h4>
                                        {hasDispute && (
                                            <span className="text-[9px] font-extrabold uppercase bg-red-600 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                <ShieldAlert className="w-2.5 h-2.5" /> En disputa
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Cliente: {gig.profiles?.full_name || 'Cliente'}
                                    </p>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2 shrink-0">
                                    <p className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                                        ${formatCLP(gig.budget)}
                                    </p>

                                    {gig.status === 'assigned' && !hasDispute ? (
                                        <button
                                            onClick={() => onCompleteGig(gig.id)}
                                            className="text-[10px] font-bold bg-emerald-600 text-white px-3 py-2 rounded-lg uppercase shadow-sm hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1"
                                        >
                                            <CheckCircle2 className="w-3 h-3" /> Terminar
                                        </button>
                                    ) : hasDispute ? (
                                        <span className="text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-1 rounded-md uppercase text-center leading-tight">
                                            En<br />disputa
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-1 rounded-md uppercase text-center leading-tight">
                                            Esperando<br />Aprobación
                                        </span>
                                    )}

                                    <ChatButton
                                        onClick={() => onOpenChat(gig)}
                                        unreadCount={unreadByGig?.get(gig.id) || 0}
                                        variant="compact"
                                    />

                                    {!hasDispute && onOpenDispute && (
                                        <button
                                            onClick={() => onOpenDispute(gig)}
                                            className="text-[10px] font-bold bg-transparent text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-800 px-2 py-1 rounded-md uppercase transition-all w-full text-center"
                                        >
                                            Reportar
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div>
                <div className="flex items-baseline justify-between mb-3 mt-6">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">
                        Gigs disponibles
                    </h3>
                    {hasActiveCategory && (
                        <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">
                            {filteredOpenGigs.length} de {openGigs.length}
                        </span>
                    )}
                </div>

                {/* Chip selector de categorías — mismo control que en DashboardClient para coherencia */}
                {onChangeCategory && (
                    <div className="flex gap-2 overflow-x-auto -mx-6 px-6 pb-3 mb-4 scrollbar-hide" role="tablist" aria-label="Filtrar gigs por categoría">
                        {CATEGORIAS.map((cat) => (
                            <button
                                key={cat}
                                role="tab"
                                aria-selected={selectedCategory === cat}
                                onClick={() => onChangeCategory(cat)}
                                className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedCategory === cat
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-600'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}

                {isLoadingData && openGigs.length === 0 ? (
                    <SkeletonList count={3} variant="gig" />
                ) : openGigs.length === 0 ? (
                    <EmptyState
                        icon={Briefcase}
                        title="No hay Gigs nuevos por ahora"
                        body="Las nuevas oportunidades aparecerán aquí en cuanto un cliente publique un trabajo en tu zona."
                        variant="dashed"
                    />
                ) : filteredOpenGigs.length === 0 ? (
                    <EmptyState
                        icon={Briefcase}
                        title={`Sin Gigs de ${selectedCategory}`}
                        body="Prueba con otra categoría o quita el filtro."
                        cta="Ver todos"
                        onCtaClick={() => onChangeCategory && onChangeCategory('Todos')}
                        variant="dashed"
                    />
                ) : (
                    filteredOpenGigs.map((gig) => {
                        const myApp = myApplications.find((a) => a.gig_id === gig.id);
                        return (
                            <div
                                key={gig.id}
                                className="p-5 rounded-3xl shadow-sm border flex flex-col gap-4 mb-4 bg-white border-emerald-100 dark:bg-slate-800 dark:border-slate-700"
                            >
                                {gig.image_url && (
                                    <img
                                        src={gig.image_url}
                                        alt="Referencia"
                                        loading="lazy"
                                        className="w-full h-40 object-cover rounded-2xl bg-slate-100 dark:bg-slate-700 shadow-inner"
                                    />
                                )}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold truncate text-slate-800 dark:text-slate-100">
                                            {gig.title}
                                        </h4>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            De: {gig.profiles?.full_name}
                                        </p>
                                        {myApp && (
                                            <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                                                Postulaste: ${formatCLP(myApp.bid_amount)} ·{' '}
                                                {formatEta(myApp.eta_days)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right flex flex-col items-end shrink-0">
                                        <p className="text-emerald-600 dark:text-emerald-400 font-extrabold mb-1">
                                            ${formatCLP(gig.budget)}
                                        </p>
                                        {myApp ? (
                                            <span
                                                className={`text-xs font-bold px-3 py-2 rounded-lg uppercase ${myApp.status === 'accepted'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                        : myApp.status === 'rejected'
                                                            ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                    }`}
                                            >
                                                {myApp.status === 'accepted'
                                                    ? 'Aceptada'
                                                    : myApp.status === 'rejected'
                                                        ? 'Rechazada'
                                                        : 'En espera'}
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => onOpenBidModal(gig)}
                                                title={needsMpOnboarding ? 'Conecta Mercado Pago para poder postular' : 'Postular a este gig'}
                                                className={`text-xs font-bold px-4 py-2 rounded-lg uppercase shadow-md transition-all ${needsMpOnboarding
                                                    ? 'bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 cursor-help'
                                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                                                    }`}
                                            >
                                                Postular
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </main>
    );
}
