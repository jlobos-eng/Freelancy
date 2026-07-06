// SkillsList — render de las skills del lancy con CTAs editar/eliminar/marcar primary.

import { Briefcase, Edit3, Trash2, Plus, Star, ShieldCheck, ShieldAlert, Clock, Award, Upload } from 'lucide-react';
import EmptyState from './EmptyState';
import { formatCLP } from '../utils/format';

export default function SkillsList({
    skills = [],
    onAdd,
    onEdit,
    onDelete,
    onSetPrimary,
    onUploadCertification,
    isLoading,
}) {
    if (!isLoading && skills.length === 0) {
        return (
            <EmptyState
                icon={Briefcase}
                title="Sin habilidades aún"
                body="Agrega al menos una habilidad para que los clientes puedan encontrarte."
                cta="+ Agregar habilidad"
                onCtaClick={onAdd}
                variant="dashed"
            />
        );
    }

    return (
        <div className="space-y-3">
            {skills.map((s) => (
                <div
                    key={s.id}
                    className={`p-4 rounded-2xl border ${s.is_primary
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                        }`}
                >
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl shrink-0 ${s.is_primary
                            ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            }`}>
                            <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                                    {s.skill_name}
                                </span>
                                {s.is_primary && (
                                    <span className="text-[9px] font-extrabold uppercase bg-emerald-600 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                        <Star className="w-2.5 h-2.5 fill-white" /> Destacada
                                    </span>
                                )}
                                {s.requires_certification && (
                                    s.verification_status === 'verified' ? (
                                        <span className="text-[9px] font-extrabold uppercase bg-blue-600 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                            <ShieldCheck className="w-2.5 h-2.5" /> Verificado {s.cert_authority}
                                        </span>
                                    ) : s.verification_status === 'pending' ? (
                                        <span className="text-[9px] font-extrabold uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                            <Clock className="w-2.5 h-2.5" /> En revisión
                                        </span>
                                    ) : s.verification_status === 'rejected' ? (
                                        <span className="text-[9px] font-extrabold uppercase bg-red-600 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                            <ShieldAlert className="w-2.5 h-2.5" /> Rechazada
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-extrabold uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                            <ShieldAlert className="w-2.5 h-2.5" /> Sin certificar {s.cert_authority}
                                        </span>
                                    )
                                )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.skill_category}</p>
                            {s.headline && (
                                <p className="text-sm text-slate-700 dark:text-slate-200 mt-1.5 line-clamp-2">
                                    {s.headline}
                                </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                {s.hourly_rate && (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        ${formatCLP(s.hourly_rate)}/hr
                                    </span>
                                )}
                                {s.years_experience > 0 && (
                                    <span className="flex items-center gap-0.5">
                                        <Award className="w-3 h-3" /> {s.years_experience} {s.years_experience === 1 ? 'año' : 'años'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* CTA para subir certificación si la skill la requiere y no está verificada */}
                    {s.requires_certification && s.verification_status !== 'verified' && s.verification_status !== 'pending' && onUploadCertification && (
                        <button
                            onClick={onUploadCertification}
                            className="w-full mt-3 py-2 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                            <Upload className="w-3.5 h-3.5" /> Subir certificación {s.cert_authority}
                        </button>
                    )}

                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        {!s.is_primary && onSetPrimary && (
                            <button
                                onClick={() => onSetPrimary(s.id)}
                                className="flex-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 py-2 rounded-lg transition-all"
                            >
                                Destacar
                            </button>
                        )}
                        {onEdit && (
                            <button
                                onClick={() => onEdit(s)}
                                className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 py-2 rounded-lg transition-all flex items-center justify-center gap-1"
                            >
                                <Edit3 className="w-3.5 h-3.5" /> Editar
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(s.id)}
                                className="text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-2 rounded-lg transition-all"
                                aria-label="Eliminar"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            ))}

            {onAdd && (
                <button
                    onClick={onAdd}
                    className="w-full py-3 border-2 border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-2xl font-bold text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Agregar habilidad
                </button>
            )}
        </div>
    );
}
