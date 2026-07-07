// App.jsx — orquestador slim.
// Auth + data + estado global + composición de vistas. La UI vive en /views, /modals, /components.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { supabase } from './services/supabase';
import { useTheme } from './context/ThemeContext';
import { reverseGeocode } from './utils/geo';

// Auth steps
import LoginView from './views/LoginView';
import PinView from './views/PinView';
import KycView from './views/KycView';

// Dashboard
import AppHeader from './components/AppHeader';
import PullToRefreshContainer from './components/PullToRefreshContainer';
import BottomNav from './components/BottomNav';
import ModeSwitch from './views/ModeSwitch';
import DashboardClient from './views/DashboardClient';
import DashboardWorker from './views/DashboardWorker';
import ProfileView from './views/ProfileView';
import WalletView from './views/WalletView';
import SettingsView from './views/SettingsView';
import MapScreen from './views/MapScreen';

// Modales
import BidModal from './components/BidModal';
import DisputeModal from './components/DisputeModal';
import CheckoutModal from './components/CheckoutModal';
import RatingModal from './modals/RatingModal';
import ChatModal from './modals/ChatModal';
import GigFormModal from './modals/GigFormModal';
import WorkerProfileModal from './modals/WorkerProfileModal';

// Hooks
import useGeolocation from './hooks/useGeolocation';
import useNotifications from './hooks/useNotifications';
import useDisputes from './hooks/useDisputes';
import useUnreadMessages from './hooks/useUnreadMessages';
import useAddresses from './hooks/useAddresses';
import AddressFormModal from './components/AddressFormModal';
import useSkillCatalog from './hooks/useSkillCatalog';
import useMySkills from './hooks/useMySkills';
import SkillFormModal from './components/SkillFormModal';
import useMyCertifications from './hooks/useMyCertifications';
import CertificationUploadModal from './components/CertificationUploadModal';
import useSupportTickets from './hooks/useSupportTickets';
import SupportModal from './modals/SupportModal';

// Toaster con estilo que respira con el tema (dark/light)
function buildToastOptions(isDark) {
    const bg = isDark ? '#1e293b' : '#ffffff';
    const color = isDark ? '#f1f5f9' : '#1e293b';
    const border = isDark ? '1px solid #334155' : '1px solid #e2e8f0';
    return {
        duration: 3500,
        style: {
            borderRadius: '14px',
            background: bg,
            color,
            border,
            fontWeight: 600,
            fontSize: '14px',
            padding: '12px 16px',
            boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(15,23,42,0.08)',
        },
        success: { iconTheme: { primary: '#10b981', secondary: isDark ? '#0f172a' : '#ffffff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: isDark ? '#0f172a' : '#ffffff' } },
    };
}

export default function App() {
    const { isDark } = useTheme();

    // ---- Estado global -----------------------------------------------------
    const [step, setStep] = useState('login');
    const [mode, setMode] = useState('client');
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const [myProfile, setMyProfile] = useState(null);
    const [selectedWorker, setSelectedWorker] = useState(null);
    const [workers, setWorkers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    // appSettings persistido en localStorage. Si el usuario apaga "ubicacion",
    // dejamos de auto-actualizar su pin y de pedirle ubicación al inicio.
    const [appSettings, setAppSettings] = useState(() => {
        try {
            const raw = window.localStorage.getItem('freelancy-settings');
            if (raw) return { notificaciones: true, ubicacion: true, ...JSON.parse(raw) };
        } catch { /* ignore */ }
        return { notificaciones: true, ubicacion: true };
    });
    useEffect(() => {
        try { window.localStorage.setItem('freelancy-settings', JSON.stringify(appSettings)); } catch { /* ignore */ }
    }, [appSettings]);

    // Default 10 km: con 5 km el mapa aparecía vacío para usuarios cuyos Lancys
    // cercanos están en comunas a >5 km. 10 km da un radio urbano razonable
    // que muestra resultados de entrada.
    const [mapRadiusKm, setMapRadiusKm] = useState(10);
    // Trust & Safety: filtro "sólo verificados" en el dashboard del cliente
    const [verifiedOnly, setVerifiedOnly] = useState(false);
    const [isSharingLocation, setIsSharingLocation] = useState(false);

    const { coords: userCoords, loading: geoLoading, error: geoError, requestLocation } = useGeolocation({
        autoFetch: appSettings.ubicacion,
    });

    // Notificaciones realtime — el hook regresa markAsRead/markAllAsRead;
    // aquí los aliasamos a las props que espera NotificationsPanel.
    const [showNotifications, setShowNotifications] = useState(false);
    const {
        notifications,
        unreadCount,
        markAsRead: markNotificationRead,
        markAllAsRead: markAllNotificationsRead,
        refresh: refreshNotifications,
    } = useNotifications(myProfile?.id, {
        onNew: (notif) => {
            const emoji =
                notif.type === 'new_application' ? '💼'
                    : notif.type === 'application_accepted' ? '🎉'
                        : notif.type === 'gig_in_review' ? '⏳'
                            : notif.type === 'gig_completed' ? '💰'
                                : '🔔';
            toast(`${emoji} ${notif.title}`, { duration: 5000 });
        },
    });

    // Gigs
    const [openGigs, setOpenGigs] = useState([]);
    const [myActiveGigs, setMyActiveGigs] = useState([]);
    const [myClientGigs, setMyClientGigs] = useState([]);
    const [myHistoryGigs, setMyHistoryGigs] = useState([]);

    // Modales y formularios
    const [showGigForm, setShowGigForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [bidModal, setBidModal] = useState({ show: false, gig: null });
    const [isSubmittingBid, setIsSubmittingBid] = useState(false);
    const [myApplications, setMyApplications] = useState([]);
    const [applicationsByGig, setApplicationsByGig] = useState({});
    const [acceptingApplicationId, setAcceptingApplicationId] = useState(null);
    const [expandedGigApps, setExpandedGigApps] = useState(null);
    const [gigForm, setGigForm] = useState({ skill_id: null, title: '', description: '', budget: '', image: null });

    const [profileForm, setProfileForm] = useState({ full_name: '', skill: '', avatar_url: '', location: '', bio: '' });
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [ratingModal, setRatingModal] = useState({ show: false, gigId: null, workerId: null, stars: 5 });
    const [chatModal, setChatModal] = useState({ show: false, gig: null, messages: [] });

    // Disputas
    const [disputeModal, setDisputeModal] = useState({ show: false, gig: null });
    const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

    // Checkout (pago)
    const [checkoutModal, setCheckoutModal] = useState({ show: false, transaction: null, gig: null });

    // IDs de gigs en los que participo (para que useDisputes filtre)
    const allMyGigIds = useMemo(() => {
        const ids = new Set();
        myActiveGigs.forEach(g => ids.add(g.id));
        myClientGigs.forEach(g => ids.add(g.id));
        myHistoryGigs.forEach(g => ids.add(g.id));
        return Array.from(ids);
    }, [myActiveGigs, myClientGigs, myHistoryGigs]);

    const { openByGig: disputesByGig, refresh: refreshDisputes } = useDisputes(myProfile?.id, allMyGigIds);
    const { unreadByGig, markGigRead: markChatRead, refresh: refreshUnread } = useUnreadMessages(myProfile?.id, allMyGigIds);
    const {
        addresses,
        loading: addressesLoading,
        createAddress,
        updateAddress,
        deleteAddress,
        setPrimary: setPrimaryAddress,
    } = useAddresses(myProfile?.id);
    const [addressModal, setAddressModal] = useState({ show: false, initial: null });
    const [isSubmittingAddress, setIsSubmittingAddress] = useState(false);

    // Catálogo de skills + skills del lancy
    const { skills: skillCatalog, loading: catalogLoading } = useSkillCatalog();
    const {
        mySkills,
        loading: mySkillsLoading,
        addSkill,
        updateSkill,
        deleteSkill,
        setPrimarySkill,
    } = useMySkills(myProfile?.id);
    const [skillModal, setSkillModal] = useState({ show: false, initial: null });
    const [isSubmittingSkill, setIsSubmittingSkill] = useState(false);

    // Certificaciones (M5.3)
    const {
        certifications: myCertifications,
        uploadDocument: uploadCertDocument,
        submitCertification,
        deleteCertification,
    } = useMyCertifications(myProfile?.id);
    const [certModal, setCertModal] = useState(false);
    const [isSubmittingCert, setIsSubmittingCert] = useState(false);

    // Soporte y Ayuda — tickets persistidos en support_tickets
    const {
        tickets: supportTickets,
        createTicket: createSupportTicket,
    } = useSupportTickets(myProfile?.id);
    const [supportModal, setSupportModal] = useState(false);
    const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);

    // ---- Helpers -----------------------------------------------------------

    const fetchMyProfile = useCallback(async (userId) => {
        if (!supabase) return;
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (!error && data) {
            setMyProfile(data);
            setProfileForm({
                full_name: data.full_name || '',
                skill: data.skill || '',
                avatar_url: data.avatar_url || '',
                location: data.location || '',
                bio: data.bio || '',
            });
        }
    }, []);

    // Re-fetch del dashboard. Estable mientras no cambie myProfile.id o radio/coords.
    const myProfileId = myProfile?.id;
    const userLat = userCoords?.lat;
    const userLng = userCoords?.lng;
    const fetchData = useCallback(async () => {
        if (!supabase) return;
        setIsLoadingData(true);
        try {
            // Workers: si tenemos coords del usuario y una categoría seleccionada,
            // usamos nearby_workers_by_skill (filtra por skill_slug + radio).
            // Si no hay categoría → nearby_workers (todos en radio).
            // Si no hay coords → fallback a todos los workers.
            if (userLat != null && userLng != null) {
                // Si hay categoría no-Todos, intentamos traducirla a skill_slug
                const slug = (selectedCategory && selectedCategory !== 'Todos')
                    ? skillCatalog.find((s) => s.name === selectedCategory)?.slug
                    : null;

                if (slug) {
                    const { data: nearbyBySkill, error: nbsErr } = await supabase.rpc('nearby_workers_by_skill', {
                        p_lat: userLat,
                        p_lng: userLng,
                        p_radius_km: mapRadiusKm,
                        p_skill_slug: slug,
                        p_limit: 100,
                    });
                    if (!nbsErr && nearbyBySkill) {
                        setWorkers(nearbyBySkill);
                    } else {
                        // Fallback al RPC anterior si la migración M5.2 no corrió
                        const { data: nearby } = await supabase.rpc('nearby_workers', {
                            p_lat: userLat, p_lng: userLng, p_radius_km: mapRadiusKm, p_limit: 100,
                        });
                        if (nearby) setWorkers(nearby);
                    }
                } else {
                    const { data: nearby, error: nearbyErr } = await supabase.rpc('nearby_workers', {
                        p_lat: userLat,
                        p_lng: userLng,
                        p_radius_km: mapRadiusKm,
                        p_limit: 100,
                    });
                    if (!nearbyErr && nearby) {
                        setWorkers(nearby);
                    } else {
                        const { data: wData } = await supabase.from('profiles').select('*').eq('role', 'worker');
                        if (wData) setWorkers(wData);
                    }
                }
            } else {
                const { data: wData } = await supabase.from('profiles').select('*').eq('role', 'worker');
                if (wData) setWorkers(wData);
            }

            // Enriquecer workers con flag is_certified + cert_authority leyendo
            // verified_workers_per_skill. Los RPC nearby_workers (sin skill) y el
            // fallback a `profiles` no devuelven esa info, así que la mergeamos
            // localmente para que el filtro "Solo verificados" funcione siempre.
            try {
                const { data: verifiedRows } = await supabase
                    .from('verified_workers_per_skill')
                    .select('worker_id, cert_authority');
                if (verifiedRows && verifiedRows.length > 0) {
                    const byWorker = new Map();
                    verifiedRows.forEach((r) => {
                        if (!byWorker.has(r.worker_id)) byWorker.set(r.worker_id, r.cert_authority);
                    });
                    setWorkers((prev) => prev.map((w) => byWorker.has(w.id)
                        ? { ...w, is_certified: true, cert_authority: w.cert_authority || byWorker.get(w.id) }
                        : w
                    ));
                }
            } catch (err) {
                // verified_workers_per_skill puede no existir en setups antiguos — no romper.
                console.warn('[verified_workers_per_skill] not available:', err?.message);
            }

            const { data: gData } = await supabase
                .from('gigs')
                .select('*, profiles:client_id(full_name, avatar_url)')
                .eq('status', 'open')
                .order('created_at', { ascending: false });
            if (gData) setOpenGigs(gData);

            if (!myProfileId) return;

            const { data: activeWorkerData } = await supabase
                .from('gigs')
                .select('*, profiles:client_id(full_name)')
                .eq('worker_id', myProfileId)
                .in('status', ['assigned', 'review']);
            if (activeWorkerData) setMyActiveGigs(activeWorkerData);

            const { data: myRequestsData } = await supabase
                .from('gigs')
                .select('*, profiles:worker_id(full_name, avatar_url, rating)')
                .eq('client_id', myProfileId)
                .in('status', ['open', 'bidding', 'assigned', 'review']);
            if (myRequestsData) setMyClientGigs(myRequestsData);

            const { data: historyData } = await supabase
                .from('gigs')
                .select('*, profiles:client_id(full_name)')
                .eq('worker_id', myProfileId)
                .eq('status', 'completed')
                .order('created_at', { ascending: false });
            if (historyData) setMyHistoryGigs(historyData);

            const { data: myAppsData } = await supabase
                .from('gig_applications')
                .select('id, gig_id, status, bid_amount, eta_days')
                .eq('worker_id', myProfileId);
            if (myAppsData) setMyApplications(myAppsData);

            if (myRequestsData?.length) {
                const myGigIds = myRequestsData.map((g) => g.id);
                const { data: receivedApps } = await supabase
                    .from('gig_applications')
                    .select('*, profiles:worker_id(id, full_name, avatar_url, rating, skill)')
                    .in('gig_id', myGigIds)
                    .order('created_at', { ascending: true });
                if (receivedApps) {
                    const grouped = receivedApps.reduce((acc, app) => {
                        (acc[app.gig_id] = acc[app.gig_id] || []).push(app);
                        return acc;
                    }, {});
                    setApplicationsByGig(grouped);
                } else {
                    setApplicationsByGig({});
                }
            } else {
                setApplicationsByGig({});
            }
        } finally {
            setIsLoadingData(false);
        }
    }, [myProfileId, userLat, userLng, mapRadiusKm, selectedCategory, skillCatalog]);

    /**
     * Refresh manual: trae datos del dashboard + notificaciones + disputas
     * + contadores de mensajes en paralelo. Lo invocan el botón header y
     * el pull-to-refresh.
     */
    const handleManualRefresh = useCallback(async () => {
        if (isManualRefreshing) return;
        setIsManualRefreshing(true);
        try {
            await Promise.allSettled([
                fetchData(),
                refreshNotifications && refreshNotifications(),
                refreshDisputes && refreshDisputes(),
                refreshUnread && refreshUnread(),
            ]);
        } finally {
            setIsManualRefreshing(false);
        }
    }, [isManualRefreshing, fetchData, refreshNotifications, refreshDisputes, refreshUnread]);

    const fetchMessages = useCallback(async (gigId) => {
        if (!supabase || !gigId) return;
        const { data } = await supabase
            .from('messages')
            .select('*, profiles:sender_id(full_name)')
            .eq('gig_id', gigId)
            .order('created_at', { ascending: true });
        if (data) setChatModal((prev) => ({ ...prev, messages: data }));
    }, []);

    // ---- Effects ----------------------------------------------------------

    // Sesión inicial + listener
    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        let mounted = true;

        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (mounted && session) {
                await fetchMyProfile(session.user.id);
                setStep('pin');
            }
            if (mounted) setLoading(false);
        })();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            if (session) {
                fetchMyProfile(session.user.id);
            } else {
                setStep('login');
                setMyProfile(null);
            }
        });

        return () => {
            mounted = false;
            subscription?.unsubscribe();
        };
    }, [fetchMyProfile]);

    // Cargar datos cuando estamos en dashboard
    useEffect(() => {
        if (step === 'dashboard') fetchData();
    }, [step, fetchData]);

    // Chat realtime — un canal por gig abierto.
    // Append manual del payload en lugar de re-fetch para evitar round-trips por mensaje.
    useEffect(() => {
        if (!supabase || !chatModal.show || !chatModal.gig) return;

        const gigId = chatModal.gig.id;
        const channel = supabase
            .channel(`chat-${gigId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `gig_id=eq.${gigId}` },
                (payload) => {
                    setChatModal((prev) => {
                        // Evitar duplicar si ya estaba (envío optimista)
                        if (prev.messages.some((m) => m.id === payload.new.id)) return prev;
                        return { ...prev, messages: [...prev.messages, payload.new] };
                    });
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chatModal.show, chatModal.gig]);

    // ---- Handlers ---------------------------------------------------------

    const handleAvatarUpload = async (event) => {
        if (!supabase || !myProfile) return;
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Por favor selecciona un archivo de imagen válido.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('La imagen no puede pesar más de 5 MB.');
            return;
        }

        const toastId = toast.loading('Subiendo foto...');
        try {
            setIsUploadingAvatar(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `avatar-${myProfile.id}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            setProfileForm((prev) => ({ ...prev, avatar_url: publicUrl }));
            toast.success('Foto cargada', { id: toastId });
        } catch (error) {
            toast.error('Error subiendo foto: ' + error.message, { id: toastId });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        if (!supabase || !myProfile) return;
        setIsSavingProfile(true);

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: profileForm.full_name,
                skill: profileForm.skill,
                avatar_url: profileForm.avatar_url,
                location: profileForm.location,
                bio: profileForm.bio,
            })
            .eq('id', myProfile.id);

        setIsSavingProfile(false);

        if (!error) {
            await fetchMyProfile(myProfile.id);
            await fetchData();
            toast.success('¡Perfil actualizado con éxito!');
        } else {
            toast.error('Error al actualizar el perfil: ' + error.message);
        }
    };

    const handleCreateGig = async (e) => {
        e.preventDefault();
        if (!supabase || !myProfile?.id) {
            toast.error('Error de perfil.');
            return;
        }

        const budgetNum = parseFloat(gigForm.budget);
        if (!Number.isFinite(budgetNum) || budgetNum < 1000) {
            toast.error('El presupuesto debe ser un número mayor o igual a $1.000.');
            return;
        }
        if (!gigForm.skill_id) {
            toast.error('Selecciona el oficio que necesitas.');
            return;
        }

        const toastId = toast.loading('Publicando trabajo...');
        setIsSubmitting(true);
        try {
            let image_url = null;

            if (gigForm.image) {
                if (!gigForm.image.type?.startsWith('image/')) {
                    throw new Error('El archivo adjunto no es una imagen válida.');
                }
                if (gigForm.image.size > 5 * 1024 * 1024) {
                    throw new Error('La imagen no puede pesar más de 5 MB.');
                }
                const fileExt = gigForm.image.name.split('.').pop();
                const fileName = `${myProfile.id}-${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage.from('gig-images').upload(fileName, gigForm.image);
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage.from('gig-images').getPublicUrl(fileName);
                image_url = publicUrl;
            }

            const { error } = await supabase.from('gigs').insert([{
                client_id: myProfile.id,
                skill_id: gigForm.skill_id,
                title: gigForm.title,
                description: gigForm.description,
                budget: budgetNum,
                image_url,
                status: 'open',
            }]);

            if (error) throw error;

            closeGigForm();
            await fetchData();
            toast.success('¡Trabajo publicado!', { id: toastId });
        } catch (error) {
            toast.error('Error: ' + error.message, { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeGigForm = () => {
        setShowGigForm(false);
        setGigForm({ skill_id: null, title: '', description: '', budget: '', image: null });
    };

    const handleOpenBidModal = (gig) => {
        if (!myProfile) return;

        // Gate: el Lancy debe tener Mercado Pago conectado para poder cobrar.
        // Si no, lo mandamos a la billetera con un toast accionable.
        if (!myProfile.mp_user_id) {
            toast(
                (t) => (
                    <span className="flex items-center gap-2">
                        <span>Conecta Mercado Pago para postular y cobrar.</span>
                        <button
                            onClick={() => {
                                toast.dismiss(t.id);
                                setActiveTab('wallet');
                            }}
                            className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-700"
                        >
                            Conectar
                        </button>
                    </span>
                ),
                { icon: '💳', duration: 6000 },
            );
            return;
        }

        const already = myApplications.find((a) => a.gig_id === gig.id);
        if (already) {
            toast(
                `Ya postulaste a este gig por $${new Intl.NumberFormat('es-CL').format(already.bid_amount)}`,
                { icon: 'ℹ️' },
            );
            return;
        }
        setBidModal({ show: true, gig });
    };

    const handleSubmitBid = async ({ bid_amount, eta_days, message }) => {
        if (!supabase || !myProfile || !bidModal.gig) return;
        setIsSubmittingBid(true);
        const toastId = toast.loading('Enviando tu postulación...');
        try {
            const { data, error } = await supabase
                .from('gig_applications')
                .insert([{
                    gig_id: bidModal.gig.id,
                    worker_id: myProfile.id,
                    bid_amount,
                    eta_days,
                    message,
                    status: 'pending',
                }])
                .select()
                .single();

            if (error) throw error;

            // best-effort: mover gig a 'bidding' si seguía 'open'
            await supabase.from('gigs')
                .update({ status: 'bidding' })
                .eq('id', bidModal.gig.id)
                .eq('status', 'open');

            setMyApplications((prev) => [...prev, data]);
            setBidModal({ show: false, gig: null });
            toast.success('¡Postulación enviada! El cliente verá tu oferta.', { id: toastId });
        } catch (error) {
            const msg = error?.message?.includes('duplicate')
                ? 'Ya postulaste a este Gig.'
                : 'Error al enviar postulación: ' + (error?.message || 'desconocido');
            toast.error(msg, { id: toastId });
        } finally {
            setIsSubmittingBid(false);
        }
    };

    const handleAcceptApplication = async (application) => {
        if (!supabase || !myProfile) return;
        setAcceptingApplicationId(application.id);
        const toastId = toast.loading('Aceptando postulación...');
        try {
            // RPC v2 — crea la transaction y devuelve su id. Fallback a v1 si la BD aún no migró.
            let txId = null;
            const { data: txIdData, error: rpcV2Err } = await supabase
                .rpc('accept_application_v2', { application_id: application.id });

            if (!rpcV2Err && txIdData) {
                txId = txIdData;
            } else {
                // Fallback v1 (sin pago) — útil mientras la migración M3.1 no está aplicada.
                const { error: rpcV1Err } = await supabase.rpc('accept_application', { application_id: application.id });
                if (rpcV1Err) throw rpcV1Err;
            }

            await fetchData();

            if (txId) {
                // Cargar la tx recién creada y abrir CheckoutModal
                const { data: tx } = await supabase
                    .from('transactions')
                    .select('*, gigs:gig_id(id, title, description)')
                    .eq('id', txId)
                    .single();
                if (tx) {
                    setCheckoutModal({ show: true, transaction: tx, gig: tx.gigs });
                    toast.success('¡Lancy aceptado! Procede a pagar para iniciar el trabajo.', { id: toastId });
                } else {
                    toast.success('¡Lancy aceptado!', { id: toastId });
                }
            } else {
                toast.success('¡Lancy aceptado! Ya pueden coordinarse por chat.', { id: toastId });
            }
        } catch (error) {
            toast.error('Error: ' + (error?.message || 'desconocido'), { id: toastId });
        } finally {
            setAcceptingApplicationId(null);
        }
    };

    const handleCompleteGig = async (gigId) => {
        if (!supabase) return;
        const { error } = await supabase.from('gigs').update({ status: 'review' }).eq('id', gigId);
        if (!error) {
            await fetchData();
            toast.success('Trabajo enviado a revisión del cliente.');
        } else {
            toast.error('Error al actualizar: ' + error.message);
        }
    };

    const handleApproveGig = (gigId, workerId) => {
        // Bloqueo cliente-side (la BD también bloquea con trigger, pero esto evita el round-trip).
        if (disputesByGig.has(gigId)) {
            toast.error('No se puede aprobar: hay una disputa abierta sobre este Gig.');
            return;
        }
        setRatingModal({ show: true, gigId, workerId, stars: 5 });
    };

    // ----- Disputas -----
    const handleOpenDisputeModal = (gig) => {
        if (!gig) return;
        if (disputesByGig.has(gig.id)) {
            toast('Ya hay una disputa abierta sobre este Gig.', { icon: 'ℹ️' });
            return;
        }
        setDisputeModal({ show: true, gig });
    };

    const handleSubmitDispute = async ({ reason, description }) => {
        if (!supabase || !disputeModal.gig) return;
        setIsSubmittingDispute(true);
        const toastId = toast.loading('Enviando reporte...');
        try {
            const { error } = await supabase.rpc('open_dispute', {
                p_gig_id: disputeModal.gig.id,
                p_reason: reason,
                p_description: description,
                p_evidence_urls: null,
            });
            if (error) throw error;
            await refreshDisputes();
            setDisputeModal({ show: false, gig: null });
            toast.success('Disputa abierta. El pago queda en pausa.', { id: toastId });
        } catch (err) {
            toast.error('Error: ' + (err?.message || 'desconocido'), { id: toastId });
        } finally {
            setIsSubmittingDispute(false);
        }
    };

    const submitRatingAndApprove = async () => {
        if (!supabase) return;
        await supabase
            .from('gigs')
            .update({ status: 'completed', rating: ratingModal.stars })
            .eq('id', ratingModal.gigId);

        const { data: workerGigs } = await supabase
            .from('gigs')
            .select('rating')
            .eq('worker_id', ratingModal.workerId)
            .not('rating', 'is', null);

        if (workerGigs && workerGigs.length > 0) {
            const sum = workerGigs.reduce((acc, curr) => acc + (curr.rating || 0), 0);
            const newAvg = Number((sum / workerGigs.length).toFixed(1));
            await supabase.from('profiles').update({ rating: newAvg }).eq('id', ratingModal.workerId);
        }

        setRatingModal({ show: false, gigId: null, workerId: null, stars: 5 });
        await fetchData();
        toast.success('¡Pago liberado y calificación enviada!', { icon: '⭐' });
    };

    const handleOpenChat = (gig) => {
        setChatModal({ show: true, gig, messages: [] });
        fetchMessages(gig.id);
        // Optimistic: limpiar contador local. Server-side: marcar mensajes como leídos.
        // Si la BD aún no tiene la migración 2026_04_25_messages_read_state, la RPC
        // devolverá error pero no bloqueamos el chat.
        markChatRead(gig.id);
        if (supabase) {
            supabase.rpc('mark_messages_read', { p_gig_id: gig.id })
                .then(() => null)
                .catch(() => null);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!supabase || !myProfile || !chatModal.gig) return;
        const content = newMessage.trim();
        if (!content) return;

        // Limpiar input antes para sensación instantánea
        setNewMessage('');

        const { error } = await supabase.from('messages').insert([{
            gig_id: chatModal.gig.id,
            sender_id: myProfile.id,
            content,
        }]);

        if (error) {
            toast.error('No pudimos enviar el mensaje: ' + error.message);
            setNewMessage(content); // restaurar si falla
        }
        // El canal realtime hará el append automáticamente.
    };

    const handleLogout = async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
    };

    /**
     * Comparte la ubicación actual con la BD:
     *  1. Pide GPS al navegador.
     *  2. Resuelve la comuna por reverse geocoding (best-effort).
     *  3. Llama a la RPC update_my_location (atómica + setea last_seen_at + sharing=true).
     *  4. Refresca el perfil local.
     */
    // ---- Direcciones --------------------------------------------------
    const handleOpenAddressModal = (initial = null) => {
        setAddressModal({ show: true, initial });
    };

    const handleSubmitAddress = async (input) => {
        setIsSubmittingAddress(true);
        const toastId = toast.loading(input.id ? 'Guardando dirección...' : 'Creando dirección...');
        try {
            if (input.id) {
                await updateAddress(input.id, {
                    label: input.label || null,
                    street: input.street,
                    number: input.number || null,
                    apartment: input.apartment || null,
                    comuna: input.comuna,
                    city: input.city || input.comuna,
                    region: input.region,
                    country: input.country || 'CL',
                    postal_code: input.postal_code || null,
                    instructions: input.instructions || null,
                    lat: input.lat,
                    lng: input.lng,
                    is_primary: input.is_primary,
                });
            } else {
                await createAddress(input);
            }
            setAddressModal({ show: false, initial: null });
            toast.success('Dirección guardada', { id: toastId });
        } catch (err) {
            toast.error('Error: ' + (err?.message || 'desconocido'), { id: toastId });
        } finally {
            setIsSubmittingAddress(false);
        }
    };

    const handleDeleteAddress = async (id) => {
        if (!window.confirm('¿Eliminar esta dirección?')) return;
        try {
            await deleteAddress(id);
            toast.success('Dirección eliminada');
        } catch (err) {
            toast.error('Error: ' + (err?.message || 'desconocido'));
        }
    };

    // ---- Skills (M5.2) -------------------------------------------------
    const handleOpenSkillModal = (initial = null) => {
        setSkillModal({ show: true, initial });
    };

    const handleSubmitSkill = async (input) => {
        setIsSubmittingSkill(true);
        const toastId = toast.loading(input.id ? 'Guardando habilidad...' : 'Agregando habilidad...');
        try {
            if (input.id) {
                await updateSkill(input.id, {
                    headline: input.headline,
                    hourly_rate: input.hourly_rate,
                    years_experience: input.years_experience,
                    is_primary: input.is_primary,
                });
            } else {
                await addSkill(input);
            }
            setSkillModal({ show: false, initial: null });
            toast.success('Habilidad guardada', { id: toastId });
        } catch (err) {
            const msg = err?.message?.includes('duplicate')
                ? 'Ya tienes esta habilidad agregada.'
                : 'Error: ' + (err?.message || 'desconocido');
            toast.error(msg, { id: toastId });
        } finally {
            setIsSubmittingSkill(false);
        }
    };

    const handleDeleteSkill = async (id) => {
        if (!window.confirm('¿Eliminar esta habilidad?')) return;
        try {
            await deleteSkill(id);
            toast.success('Habilidad eliminada');
        } catch (err) {
            toast.error('Error: ' + (err?.message || 'desconocido'));
        }
    };

    // ---- Certificaciones (M5.3) ---------------------------------------
    const handleSubmitCertification = async (input) => {
        setIsSubmittingCert(true);
        const toastId = toast.loading('Enviando certificación...');
        try {
            await submitCertification(input);
            setCertModal(false);
            toast.success('Certificación enviada — la revisaremos en 48h', { id: toastId });
        } catch (err) {
            const msg = err?.message?.includes('Bucket not found')
                ? 'El bucket de certificaciones no está configurado. Contacta al admin.'
                : err?.message || 'Error desconocido';
            toast.error(msg, { id: toastId });
        } finally {
            setIsSubmittingCert(false);
        }
    };

    const handleShareLocation = useCallback(async () => {
        if (!supabase || !myProfile) return;
        if (isSharingLocation) return;
        setIsSharingLocation(true);
        const toastId = toast.loading('Obteniendo tu ubicación...');
        try {
            const next = await requestLocation();
            if (!next || next.isFallback) {
                toast.error('No pudimos obtener tu ubicación. Revisa los permisos del navegador.', { id: toastId });
                return;
            }

            // Reverse geocode en paralelo a la escritura inicial — si falla, no bloqueamos.
            // Usamos siempre la RPC update_my_location (no UPDATE directo) para aprovechar
            // su validación de bounds y mantener last_seen_at consistente.
            const [comuna] = await Promise.all([
                reverseGeocode(next.lat, next.lng).catch(() => null),
                supabase.rpc('update_my_location', { p_lat: next.lat, p_lng: next.lng }),
            ]);

            // Si hay comuna detectada y el usuario no tenía location escrita, la guardamos
            if (comuna && !myProfile.location) {
                await supabase.rpc('update_my_location', {
                    p_lat: next.lat,
                    p_lng: next.lng,
                    p_location: comuna,
                });
                setProfileForm((prev) => ({ ...prev, location: comuna }));
            }

            await fetchMyProfile(myProfile.id);
            await fetchData();
            toast.success(comuna ? `Ubicación compartida (${comuna})` : 'Ubicación compartida', { id: toastId });
        } catch (err) {
            toast.error('Error: ' + (err?.message || 'desconocido'), { id: toastId });
        } finally {
            setIsSharingLocation(false);
        }
    }, [myProfile, isSharingLocation, requestLocation, fetchMyProfile, fetchData]);

    // Auto-update best-effort: si el toggle "ubicacion" está activo y entramos
    // al dashboard con coords frescas, sincronizamos en background sin toast.
    // No usamos requestLocation acá — solo escribimos lo que ya tenemos.
    useEffect(() => {
        if (!supabase || !myProfile || step !== 'dashboard') return;
        if (!appSettings.ubicacion) return;
        if (!userCoords || userCoords.isFallback) return;
        // Throttle ligero: si el last_seen_at es de hace < 5 min, no escribimos.
        if (myProfile.last_seen_at) {
            const last = new Date(myProfile.last_seen_at).getTime();
            if (Date.now() - last < 5 * 60_000) return;
        }
        supabase.rpc('update_my_location', { p_lat: userCoords.lat, p_lng: userCoords.lng })
            .then(({ error }) => { if (!error) fetchMyProfile(myProfile.id); });
    }, [step, appSettings.ubicacion, userCoords, myProfile, fetchMyProfile]);

    const handleHireWorker = () => {
        setSelectedWorker(null);
        setShowGigForm(true);
    };

    const handleSupport = () => {
        setSupportModal(true);
    };

    const handleCreateSupportTicket = async (payload) => {
        setIsSubmittingTicket(true);
        try {
            await createSupportTicket(payload);
            toast.success('Ticket enviado. Te avisaremos cuando respondan.', { icon: '📩' });
        } catch (err) {
            console.error('[createSupportTicket]', err);
            toast.error('No pudimos enviar tu ticket: ' + (err?.message || 'error desconocido'));
            throw err;
        } finally {
            setIsSubmittingTicket(false);
        }
    };

    /** Snapshot de contexto que adjuntamos a cada ticket para ayudar al debug. */
    const supportContext = useMemo(() => ({
        tab: activeTab,
        mode,
        gig_id: chatModal?.gig?.id || null,
    }), [activeTab, mode, chatModal]);

    // Tema dinámico del wrapper principal según el modo (cliente vs worker)
    const wrapperBg = useMemo(() => {
        if (isDark) return 'bg-slate-950 text-slate-100';
        if (mode === 'worker') return 'bg-emerald-50 text-slate-800';
        return 'bg-slate-50 text-slate-800';
    }, [isDark, mode]);

    const toastOptions = useMemo(() => buildToastOptions(isDark), [isDark]);

    // ---- Render -----------------------------------------------------------

    if (!supabase) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
                <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                    Configuración incompleta
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                    Faltan las variables <code className="font-mono">VITE_SUPABASE_URL</code> o{' '}
                    <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>. Revisa tu archivo{' '}
                    <code className="font-mono">.env</code> y reinicia el servidor.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400" />
            </div>
        );
    }

    if (step === 'login') return <LoginView onNext={() => setStep('pin')} />;
    if (step === 'pin') return <PinView onNext={() => setStep('dashboard')} />; if (step === 'kyc') return <KycView onNext={() => setStep('dashboard')} />;

    return (
        <div className={`flex flex-col min-h-screen font-sans transition-colors duration-300 ${wrapperBg} pb-24`}>
            <Toaster position="top-center" toastOptions={toastOptions} />

            <AppHeader
                mode={mode}
                myProfile={myProfile}
                onAvatarClick={() => setActiveTab('profile')}
                onLogoClick={() => setActiveTab('dashboard')}
                showNotifications={showNotifications}
                onToggleNotifications={() => setShowNotifications((s) => !s)}
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkOneRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onRefresh={activeTab === 'dashboard' ? handleManualRefresh : null}
                isRefreshing={isManualRefreshing}
                isLoading={loading || !myProfile}
            />

            {activeTab === 'profile' && (
                <ProfileView
                    profileForm={profileForm}
                    onChangeProfileForm={setProfileForm}
                    onSubmit={handleUpdateProfile}
                    isSaving={isSavingProfile}
                    isUploadingAvatar={isUploadingAvatar}
                    onAvatarUpload={handleAvatarUpload}
                    myProfile={myProfile}
                    onClose={() => setActiveTab('dashboard')}
                    onShareLocation={handleShareLocation}
                    isSharingLocation={isSharingLocation}
                    addresses={addresses}
                    addressesLoading={addressesLoading}
                    onAddAddress={() => handleOpenAddressModal(null)}
                    onEditAddress={(a) => handleOpenAddressModal(a)}
                    onDeleteAddress={handleDeleteAddress}
                    onSetPrimaryAddress={setPrimaryAddress}
                    mySkills={mySkills}
                    skillsLoading={mySkillsLoading}
                    onAddSkill={() => handleOpenSkillModal(null)}
                    onEditSkill={(s) => handleOpenSkillModal(s)}
                    onDeleteSkill={handleDeleteSkill}
                    onSetPrimarySkill={setPrimarySkill}
                    onUploadCertification={() => setCertModal(true)}
                    myCertifications={myCertifications}
                    onDeleteCertification={async (id) => {
                        try {
                            await deleteCertification(id);
                        } catch (err) {
                            console.error('[deleteCertification]', err);
                            alert('No se pudo eliminar la certificación.');
                        }
                    }}
                    onViewCertificationDoc={async (cert) => {
                        // Si ya es URL absoluta (signed url cacheado), abrir directo;
                        // si es solo el path interno, generar signed URL al vuelo.
                        if (!cert?.document_url) return;
                        const url = cert.document_url;
                        if (/^https?:\/\//i.test(url)) {
                            window.open(url, '_blank', 'noopener,noreferrer');
                            return;
                        }
                        try {
                            const { data, error } = await supabase.storage
                                .from('certifications')
                                .createSignedUrl(url, 60 * 5);
                            if (!error && data?.signedUrl) {
                                window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
                            }
                        } catch (err) {
                            console.error('[signedUrl]', err);
                        }
                    }}
                />
            )}

            {activeTab === 'wallet' && (
                <WalletView
                    myProfile={myProfile}
                    myHistoryGigs={myHistoryGigs}
                    isLoadingData={isLoadingData}
                    onJumpToWorkerDashboard={() => {
                        setMode('worker');
                        setActiveTab('dashboard');
                    }}
                />
            )}

            {activeTab === 'settings' && (
                <SettingsView
                    appSettings={appSettings}
                    onChangeSettings={setAppSettings}
                    onLogout={handleLogout}
                    onSupport={handleSupport}
                />
            )}

            {activeTab === 'map' && (
                <MapScreen
                    userCoords={userCoords}
                    geoLoading={geoLoading}
                    geoError={geoError}
                    workers={workers}
                    searchQuery={searchQuery}
                    onChangeSearch={setSearchQuery}
                    mapRadiusKm={mapRadiusKm}
                    onChangeRadius={setMapRadiusKm}
                    onWorkerClick={setSelectedWorker}
                    onJumpToList={() => setActiveTab('dashboard')}
                />
            )}

            {activeTab === 'dashboard' && (
                <PullToRefreshContainer onRefresh={handleManualRefresh} className="flex-1">
                    <ModeSwitch mode={mode} onChange={setMode} />
                    {mode === 'client' ? (
                        <DashboardClient
                            myProfile={myProfile}
                            userCoords={userCoords}
                            workers={workers}
                            isLoadingData={isLoadingData}
                            searchQuery={searchQuery}
                            onChangeSearch={setSearchQuery}
                            selectedCategory={selectedCategory}
                            onChangeCategory={setSelectedCategory}
                            myClientGigs={myClientGigs}
                            applicationsByGig={applicationsByGig}
                            expandedGigApps={expandedGigApps}
                            onToggleExpanded={setExpandedGigApps}
                            onAcceptApplication={handleAcceptApplication}
                            acceptingApplicationId={acceptingApplicationId}
                            onOpenChat={handleOpenChat}
                            onApproveGig={handleApproveGig}
                            onWorkerClick={setSelectedWorker}
                            onPublishGig={() => setShowGigForm(true)}
                            onJumpToMap={() => setActiveTab('map')}
                            disputesByGig={disputesByGig}
                            onOpenDispute={handleOpenDisputeModal}
                            unreadByGig={unreadByGig}
                            verifiedOnly={verifiedOnly}
                            onChangeVerifiedOnly={setVerifiedOnly}
                        />
                    ) : (
                        <DashboardWorker
                            myProfile={myProfile}
                            myActiveGigs={myActiveGigs}
                            openGigs={openGigs}
                            myApplications={myApplications}
                            isLoadingData={isLoadingData}
                            onJumpToWallet={() => setActiveTab('wallet')}
                            onCompleteGig={handleCompleteGig}
                            onOpenChat={handleOpenChat}
                            onOpenBidModal={handleOpenBidModal}
                            disputesByGig={disputesByGig}
                            onOpenDispute={handleOpenDisputeModal}
                            selectedCategory={selectedCategory}
                            onChangeCategory={setSelectedCategory}
                            unreadByGig={unreadByGig}
                        />
                    )}
                </PullToRefreshContainer>
            )}

            {/* ---- Modales globales ---- */}
            <BidModal
                isOpen={bidModal.show}
                gig={bidModal.gig}
                onClose={() => setBidModal({ show: false, gig: null })}
                onSubmit={handleSubmitBid}
                isSubmitting={isSubmittingBid}
            />

            <DisputeModal
                isOpen={disputeModal.show}
                gig={disputeModal.gig}
                onClose={() => setDisputeModal({ show: false, gig: null })}
                onSubmit={handleSubmitDispute}
                isSubmitting={isSubmittingDispute}
            />

            <CheckoutModal
                isOpen={checkoutModal.show}
                transaction={checkoutModal.transaction}
                gig={checkoutModal.gig}
                onClose={() => setCheckoutModal({ show: false, transaction: null, gig: null })}
            />

            <AddressFormModal
                isOpen={addressModal.show}
                initial={addressModal.initial}
                onClose={() => setAddressModal({ show: false, initial: null })}
                onSubmit={handleSubmitAddress}
                isSubmitting={isSubmittingAddress}
            />

            <SkillFormModal
                isOpen={skillModal.show}
                initial={skillModal.initial}
                onClose={() => setSkillModal({ show: false, initial: null })}
                onSubmit={handleSubmitSkill}
                isSubmitting={isSubmittingSkill}
                catalog={skillCatalog}
                catalogLoading={catalogLoading}
                excludeSkillIds={mySkills.map((s) => s.skill_id)}
            />

            <CertificationUploadModal
                isOpen={certModal}
                onClose={() => setCertModal(false)}
                onUpload={uploadCertDocument}
                onSubmit={handleSubmitCertification}
                isSubmitting={isSubmittingCert}
                mySkills={mySkills}
            />

            <SupportModal
                isOpen={supportModal}
                onClose={() => setSupportModal(false)}
                tickets={supportTickets}
                isSubmitting={isSubmittingTicket}
                onCreateTicket={handleCreateSupportTicket}
                contextSnapshot={supportContext}
            />

            <RatingModal
                isOpen={ratingModal.show}
                stars={ratingModal.stars}
                onChangeStars={(s) => setRatingModal({ ...ratingModal, stars: s })}
                onSubmit={submitRatingAndApprove}
                onClose={() => setRatingModal({ show: false, gigId: null, workerId: null, stars: 5 })}
            />

            <ChatModal
                isOpen={chatModal.show}
                gig={chatModal.gig}
                messages={chatModal.messages}
                myProfileId={myProfile?.id}
                newMessage={newMessage}
                onChangeMessage={setNewMessage}
                onSendMessage={handleSendMessage}
                onClose={() => setChatModal({ show: false, gig: null, messages: [] })}
            />

            {mode === 'client' && activeTab === 'dashboard' && (
                <GigFormModal
                    isOpen={showGigForm}
                    onOpen={() => setShowGigForm(true)}
                    onClose={closeGigForm}
                    gigForm={gigForm}
                    onChangeGigForm={setGigForm}
                    onSubmit={handleCreateGig}
                    isSubmitting={isSubmitting}
                    skillCatalog={skillCatalog}
                    catalogLoading={catalogLoading}
                />
            )}

            <WorkerProfileModal
                worker={selectedWorker}
                onClose={() => setSelectedWorker(null)}
                onHire={handleHireWorker}
            />

            <BottomNav activeTab={activeTab} mode={mode} onChange={setActiveTab} />
        </div>
    );
}
