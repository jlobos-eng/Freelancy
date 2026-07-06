// Dashboard "Modo Contratar" — saludo, búsqueda, contratos del cliente, mapa decorativo, lista de Lancys.

import { Search, ArrowRight, MapPin, AlertCircle, ChevronUp, ChevronDown, ShieldCheck, Users, ShieldAlert } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { SkeletonList } from '../components/SkeletonCard';
import DecorativeMap from '../components/DecorativeMap';
import ApplicationsList from '../components/ApplicationsList';
import ChatButton from '../components/ChatButton';
import { avatarFor } from '../utils/avatar';
import { CATEGORIAS, workerMatchesCategory } from '../utils/categories';

export default function DashboardClient({
    myProfile,
    userCoords,
    workers,
    isLoadingData,
    searchQuery,
    onChangeSearch,
    selectedCategory,
    onChangeCategory,
    myClientGigs,
    applicationsByGig,
    expandedGigApps,
    onToggleExpanded,
    onAcceptApplication,
    acceptingApplicationId,
    onOpenChat,
    onApproveGig,
    onWorkerClick,
    onPublishGig,
    onJumpToMap,
    disputesByGig,
    onOpenDispute,
    unreadByGig,
    verifiedOnly = false,
    onChangeVerifiedOnly,
}) {
    const filteredWorkers = workers.filter(
        (w) =>
            workerMatchesCategory(w, selectedCategory) &&
            (w.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) &&
            (!verifiedOnly || w.is_certified === true),
    );

    return (
        <main className="flex-1 px-6 space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 underline underline-offset-8 decoration-indigo-200 dark:decoration-indigo-700">
                    Hola, {myProfile?.full_name?.split(' ')[0] || 'Lancy'} 👋
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 font-medium">
                    ¿A quién necesitas hoy?
                </p>
                <div className="relative">
                    <label htmlFor="dashboard-search" className="sr-only">Buscar Lancy o servicio</label>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        id="dashboard-search"
                        type="text"
                        value={searchQuery}
                        placeholder="Busca un servicio o nombre..."
                        className="w-full pl-12 pr-4 py-4 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border-none rounded-2xl outline-none font-medium text-sm"
                        onChange={(e) => onChangeSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mt-2">
                {CATEGORIAS.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => onChangeCategory(cat)}
                        className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedCategory === cat
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Filtro Trust & Safety: solo mostrar lancys con credencial verificada */}
            {onChangeVerifiedOnly && (
                <div className="flex items-center justify-between -mt-3 px-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <ShieldCheck className={`w-4 h-4 shrink-0 ${verifiedOnly ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                            <p className={`text-xs font-extrabold ${verifiedOnly ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                Solo verificados
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Lancys con credencial SEC, MINSAL u otra acreditación.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={verifiedOnly}
                        onClick={() => onChangeVerifiedOnly(!verifiedOnly)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${verifiedOnly ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${verifiedOnly ? 'translate-x-5' : 'translate-x-0.5'}`}
                        />
                    </button>
                </div>
            )}

            {myClientGigs.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-950/30 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900">
                    <h3 className="font-bold text-indigo-900 dark:text-indigo-200 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" /> Tus Contratos
                    </h3>
                    {myClientGigs.map((gig) => {
                        const apps = applicationsByGig[gig.id] || [];
                        const isOpenForBids = gig.status === 'open' || gig.status === 'bidding';
                        const isExpanded = expandedGigApps === gig.id;
                        const hasDispute = disputesByGig?.has(gig.id);

                        return (
                            <div
                                key={gig.id}
                                className={`p-4 rounded-2xl shadow-sm mb-3 border ${hasDispute
                                    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                                    : 'bg-white dark:bg-slate-800 border-transparent dark:border-slate-700'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {gig.title}
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {isOpenForBids
                                                ? `${apps.length} postulación${apps.length === 1 ? '' : 'es'} recibida${apps.length === 1 ? '' : 's'
                                                }`
                                                : `Lancy: ${gig.profiles?.full_name || 'Asignado'}`}
                                        </p>
                                    </div>
                                    <span
                                        className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase shrink-0 ml-2 flex items-center gap-1 ${hasDispute
                                            ? 'bg-red-600 text-white'
                                            : gig.status === 'review'
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                : isOpenForBids
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                            }`}
                                    >
                                        {hasDispute && <ShieldAlert className="w-3 h-3" />}
                                        {hasDispute
                                            ? 'En disputa'
                                            : gig.status === 'review'
                                                ? 'Requiere Revisión'
                                                : isOpenForBids
                                                    ? 'Recibiendo ofertas'
                                                    : 'En proceso'}
                                    </span>
                                </div>

                                {isOpenForBids && (
                                    <button
                                        onClick={() => onToggleExpanded(isExpanded ? null : gig.id)}
                                        className="w-full mt-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-900"
                                    >
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        {isExpanded
                                            ? 'Ocultar postulaciones'
                                            : `Ver ${apps.length} postulacion${apps.length === 1 ? '' : 'es'}`}
                                    </button>
                                )}

                                {isExpanded && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                        <ApplicationsList
                                            applications={apps}
                                            onAccept={onAcceptApplication}
                                            isAcceptingId={acceptingApplicationId}
                                        />
                                    </div>
                                )}

                                {!isOpenForBids && gig.status !== 'completed' && (
                                    <ChatButton
                                        onClick={() => onOpenChat(gig)}
                                        unreadCount={unreadByGig?.get(gig.id) || 0}
                                        variant="full"
                                    />
                                )}

                                {gig.status === 'review' && !hasDispute && (
                                    <button
                                        onClick={() => onApproveGig(gig.id, gig.worker_id)}
                                        className="w-full mt-2 bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ShieldCheck className="w-4 h-4" /> Aprobar Trabajo y Pagar
                                    </button>
                                )}

                                {gig.status === 'review' && hasDispute && (
                                    <div className="w-full mt-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-red-200 dark:border-red-800">
                                        <ShieldAlert className="w-4 h-4" /> Pago en pausa por disputa
                                    </div>
                                )}

                                {/* CTA reportar problema (sólo si no hay disputa abierta y el gig está activo o en review) */}
                                {!hasDispute && (gig.status === 'assigned' || gig.status === 'review') && onOpenDispute && (
                                    <button
                                        onClick={() => onOpenDispute(gig)}
                                        className="w-full mt-2 bg-transparent border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 py-2 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ShieldAlert className="w-4 h-4" /> Reportar problema
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <DecorativeMap
                workers={workers}
                userCoords={userCoords}
                location={myProfile?.location}
                onClick={onJumpToMap}
            />

            <div>
                <h3 className="font-bold mb-4 text-slate-800 dark:text-slate-100">Lancys disponibles</h3>
                {isLoadingData && workers.length === 0 ? (
                    <SkeletonList count={4} variant="card" />
                ) : workers.length === 0 ? (
                    <EmptyState
                        icon={Users}
                        title="Aún no hay Lancys en tu zona"
                        body="Estamos sumando talento todos los días. Vuelve pronto o publica un trabajo y te avisamos cuando alguien postule."
                        cta="Publicar un trabajo"
                        onCtaClick={onPublishGig}
                        variant="dashed"
                    />
                ) : filteredWorkers.length === 0 ? (
                    <EmptyState
                        icon={Users}
                        title="Sin resultados"
                        body="Prueba con otra categoría o limpia el buscador para ver a todos los Lancys."
                        variant="soft"
                    />
                ) : (
                    <div className="space-y-4">
                        {filteredWorkers.map((worker) => (
                            <button
                                key={worker.id}
                                type="button"
                                onClick={() => onWorkerClick(worker)}
                                className={`w-full p-4 rounded-2xl shadow-sm border flex items-center gap-4 cursor-pointer transition-colors text-left ${worker.is_certified
                                    ? 'bg-white border-blue-200 hover:border-blue-400 dark:bg-slate-800 dark:border-blue-800 dark:hover:border-blue-500'
                                    : 'bg-white border-slate-100 hover:border-indigo-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-indigo-500'
                                    }`}
                            >
                                <div className="relative shrink-0">
                                    <img
                                        src={avatarFor(worker)}
                                        className={`w-14 h-14 rounded-2xl object-cover bg-slate-100 dark:bg-slate-700 ${worker.is_certified ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-800' : ''}`}
                                        alt=""
                                    />
                                    {worker.is_certified && (
                                        <span
                                            className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1 border-2 border-white dark:border-slate-800"
                                            aria-label={`Verificado ${worker.cert_authority || ''}`.trim()}
                                        >
                                            <ShieldCheck className="w-3 h-3" />
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {worker.full_name}
                                        </h4>
                                        {worker.is_certified && (
                                            <span className="text-[9px] font-extrabold uppercase bg-blue-600 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                                                <ShieldCheck className="w-2.5 h-2.5" />
                                                Verificado{worker.cert_authority ? ` ${worker.cert_authority}` : ''}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                        <span>{worker.skill_name || worker.skill || 'Multiservicios'}</span>
                                        {worker.location && (
                                            <>
                                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                                <span className="text-indigo-500 dark:text-indigo-400 font-semibold truncate flex items-center gap-0.5">
                                                    <MapPin className="w-3 h-3" /> {worker.location}
                                                </span>
                                            </>
                                        )}
                                    </p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
