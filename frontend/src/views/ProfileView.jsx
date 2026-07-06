// Vista "Mi Perfil" — edición de datos del usuario.
// Incluye botón "Compartir mi ubicación" que escribe lat/lng a profiles
// y resuelve la comuna por reverse geocoding.

import { User, MapPin, Briefcase, Edit3, FileText, X, Loader2, Camera, Navigation, CheckCircle2, ShieldCheck, ShieldAlert, Clock, ExternalLink, Trash2, Upload } from 'lucide-react';
import { avatarFor } from '../utils/avatar';
import { formatRelative } from '../utils/format';
import AddressList from '../components/AddressList';
import SkillsList from '../components/SkillsList';

export default function ProfileView({
    profileForm,
    onChangeProfileForm,
    onSubmit,
    isSaving,
    isUploadingAvatar,
    onAvatarUpload,
    myProfile,
    onClose,
    onShareLocation,
    isSharingLocation,
    addresses = [],
    addressesLoading,
    onAddAddress,
    onEditAddress,
    onDeleteAddress,
    onSetPrimaryAddress,
    mySkills = [],
    skillsLoading,
    onAddSkill,
    onEditSkill,
    onDeleteSkill,
    onSetPrimarySkill,
    onUploadCertification,
    myCertifications = [],
    onDeleteCertification,
    onViewCertificationDoc,
}) {
    const previewProfile = { avatar_url: profileForm.avatar_url, full_name: myProfile?.full_name };
    const hasGeo = myProfile?.lat != null && myProfile?.lng != null;
    const lastSeen = myProfile?.last_seen_at ? formatRelative(myProfile.last_seen_at) : null;

    return (
        <main className="flex-1 px-6 py-8 animate-fade-in">
            <div className="p-6 rounded-3xl shadow-sm border max-w-md mx-auto bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700 transition-colors">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Mi Perfil</h2>
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col items-center mb-8">
                    <div className="relative">
                        <img
                            src={avatarFor(previewProfile)}
                            className="w-24 h-24 rounded-full border-4 border-slate-100 dark:border-slate-700 object-cover shadow-sm"
                            alt="Avatar"
                        />
                        <label className="absolute bottom-0 right-0 bg-indigo-600 p-2 rounded-full text-white border-2 border-white dark:border-slate-800 cursor-pointer hover:bg-indigo-700 hover:scale-110 transition-all shadow-md">
                            {isUploadingAvatar ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Camera className="w-4 h-4" />
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={onAvatarUpload}
                                disabled={isUploadingAvatar}
                            />
                        </label>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 font-medium">
                        Completa tus datos para operar
                    </p>
                </div>

                {/* Bloque ubicación */}
                {onShareLocation && (
                    <div
                        className={`mb-6 rounded-2xl p-4 border transition-colors ${hasGeo
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                            }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className={`p-2 rounded-xl shrink-0 ${hasGeo
                                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                    }`}>
                                    {hasGeo ? <CheckCircle2 className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                        {hasGeo ? 'Apareces en el mapa' : 'No apareces en el mapa'}
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                        {hasGeo
                                            ? `Tu ubicación está aproximada (~200 m) por privacidad${lastSeen ? ` · actualizada ${lastSeen.toLowerCase()}` : ''}.`
                                            : 'Comparte tu ubicación para que los clientes cercanos te encuentren.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onShareLocation}
                            disabled={isSharingLocation}
                            className={`mt-3 w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 disabled:active:scale-100 ${hasGeo
                                    ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                                }`}
                        >
                            {isSharingLocation ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Obteniendo ubicación...
                                </>
                            ) : (
                                <>
                                    <Navigation className="w-4 h-4" /> {hasGeo ? 'Actualizar ubicación' : 'Compartir mi ubicación'}
                                </>
                            )}
                        </button>
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-4">
                    <FormField
                        Icon={User}
                        label="Nombre Completo"
                        required
                        type="text"
                        value={profileForm.full_name}
                        onChange={(v) => onChangeProfileForm({ ...profileForm, full_name: v })}
                        placeholder="Ej: Juan Pérez"
                    />
                    {/* Sección de direcciones — reemplaza el campo plano de comuna/ciudad */}
                    {onAddAddress && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                Mis direcciones
                            </label>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-1 mb-2">
                                Agrega tu dirección completa (calle, número, depto). Puedes tener varias.
                            </p>
                            <AddressList
                                addresses={addresses}
                                isLoading={addressesLoading}
                                onAdd={onAddAddress}
                                onEdit={onEditAddress}
                                onDelete={onDeleteAddress}
                                onSetPrimary={onSetPrimaryAddress}
                            />
                        </div>
                    )}
                    {/* Habilidades — multi-skill con catálogo cerrado */}
                    {onAddSkill && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                                <Briefcase className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                Mis habilidades
                            </label>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-1 mb-2">
                                Puedes ofrecer más de una. Cada una aparece como una tarjeta independiente en tu perfil.
                            </p>
                            <SkillsList
                                skills={mySkills}
                                isLoading={skillsLoading}
                                onAdd={onAddSkill}
                                onEdit={onEditSkill}
                                onDelete={onDeleteSkill}
                                onSetPrimary={onSetPrimarySkill}
                                onUploadCertification={onUploadCertification}
                            />
                        </div>
                    )}
                    {/* Mis certificaciones — historial de credenciales subidas */}
                    {onUploadCertification && (
                        <CertificationsSection
                            certifications={myCertifications}
                            onUpload={onUploadCertification}
                            onDelete={onDeleteCertification}
                            onView={onViewCertificationDoc}
                        />
                    )}
                    <FormField
                        Icon={Edit3}
                        label="Enlace a tu foto (URL de Imagen)"
                        type="url"
                        value={profileForm.avatar_url}
                        onChange={(v) => onChangeProfileForm({ ...profileForm, avatar_url: v })}
                        placeholder="https://ejemplo.com/mifoto.jpg"
                    />

                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">
                            Sobre mí (Bio)
                        </label>
                        <div className="relative mt-1">
                            <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                            <textarea
                                value={profileForm.bio}
                                onChange={(e) => onChangeProfileForm({ ...profileForm, bio: e.target.value })}
                                placeholder="Cuéntale a tus clientes tu experiencia..."
                                rows="3"
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 font-medium resize-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none mt-4 disabled:opacity-70 flex justify-center hover:bg-indigo-700 active:scale-95 transition-all"
                    >
                        {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Guardar Perfil'}
                    </button>
                </form>
            </div>
        </main>
    );
}

function CertificationsSection({ certifications = [], onUpload, onDelete, onView }) {
    const sorted = [...certifications].sort((a, b) => {
        // pendientes primero, luego verificadas, luego rechazadas
        const order = { pending: 0, under_review: 1, verified: 2, rejected: 3, expired: 4 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });

    return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Mis certificaciones
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-1 mb-2">
                Documentos enviados para verificar tus credenciales (SEC, MINSAL, etc).
            </p>

            {sorted.length === 0 ? (
                <button
                    type="button"
                    onClick={onUpload}
                    className="w-full py-3 border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-2xl font-bold text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all flex items-center justify-center gap-2"
                >
                    <Upload className="w-4 h-4" /> Subir mi primera certificación
                </button>
            ) : (
                <div className="space-y-2">
                    {sorted.map((c) => (
                        <CertificationRow
                            key={c.id}
                            cert={c}
                            onDelete={onDelete}
                            onView={onView}
                        />
                    ))}
                    <button
                        type="button"
                        onClick={onUpload}
                        className="w-full py-2.5 border border-dashed border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-xl font-bold text-xs hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all flex items-center justify-center gap-1.5"
                    >
                        <Upload className="w-3.5 h-3.5" /> Subir otra certificación
                    </button>
                </div>
            )}
        </div>
    );
}

function CertificationRow({ cert, onDelete, onView }) {
    const skillName = cert.skills?.name || cert.authority || 'Certificación';
    const auth = cert.skills?.cert_authority || cert.authority;
    const isVerified = cert.status === 'verified';
    const isPending = cert.status === 'pending' || cert.status === 'under_review';
    const isRejected = cert.status === 'rejected';
    const isExpired = cert.status === 'expired';
    const canDelete = (isPending || isRejected) && !!onDelete;

    return (
        <div
            className={`p-3 rounded-xl border ${isVerified
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
                : isPending
                    ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
                    : isRejected
                        ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
        >
            <div className="flex items-start gap-3">
                <div className={`p-1.5 rounded-lg shrink-0 ${isVerified
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                    : isPending
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300'
                        : isRejected
                            ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                    {isVerified ? <ShieldCheck className="w-4 h-4" />
                        : isPending ? <Clock className="w-4 h-4" />
                            : <ShieldAlert className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                            {skillName}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${isVerified
                            ? 'bg-blue-600 text-white'
                            : isPending
                                ? 'bg-amber-500 text-white'
                                : isRejected
                                    ? 'bg-red-600 text-white'
                                    : 'bg-slate-500 text-white'
                            }`}>
                            {isVerified ? `Verificado ${auth || ''}`.trim()
                                : isPending ? 'En revisión'
                                    : isRejected ? 'Rechazada'
                                        : isExpired ? 'Expirada'
                                            : cert.status}
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Folio: <span className="font-mono">{cert.credential_number}</span>
                    </p>
                    {cert.expires_at && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Vence: {new Date(cert.expires_at).toLocaleDateString('es-CL')}
                        </p>
                    )}
                    {isRejected && cert.rejection_reason && (
                        <p className="text-[11px] text-red-700 dark:text-red-300 mt-1 italic">
                            Motivo: {cert.rejection_reason}
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                    {cert.document_url && (
                        <button
                            type="button"
                            onClick={() => onView ? onView(cert) : window.open(cert.document_url, '_blank', 'noopener,noreferrer')}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            aria-label="Ver documento"
                            title="Ver documento"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {canDelete && (
                        <button
                            type="button"
                            onClick={() => onDelete(cert.id)}
                            className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                            aria-label="Eliminar certificación"
                            title="Eliminar"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function FormField({ Icon, label, value, onChange, placeholder, type = 'text', required = false }) {
    return (
        <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">
                {label}
            </label>
            <div className="relative mt-1">
                <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    required={required}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
            </div>
        </div>
    );
}
