-- ============================================================================
-- Migration: 2026_05_06 — Índices para foreign keys sin cubrir (performance)
-- ============================================================================
-- Postgres NO crea índice automáticamente en las columnas de foreign key.
-- Sin él, los joins por esa FK y —sobre todo— los borrados en cascada del
-- padre hacen scans secuenciales. El advisor de Supabase lo marca como
-- `unindexed_foreign_keys`.
--
-- Todos son aditivos (create index if not exists) → sin riesgo ni cambio de
-- comportamiento. Varias se consultan de verdad hoy (transactions.application_id,
-- notifications.gig_id/application_id).
-- ============================================================================

create index if not exists idx_certifications_verified_by     on public.certifications(verified_by);
create index if not exists idx_certifications_worker_skill_id  on public.certifications(worker_skill_id);
create index if not exists idx_disputes_resolved_by            on public.disputes(resolved_by);
create index if not exists idx_disputes_respondent_id          on public.disputes(respondent_id);
create index if not exists idx_kyc_submissions_reviewer_id     on public.kyc_submissions(reviewer_id);
create index if not exists idx_notifications_actor_id          on public.notifications(actor_id);
create index if not exists idx_notifications_application_id    on public.notifications(application_id);
create index if not exists idx_notifications_gig_id            on public.notifications(gig_id);
create index if not exists idx_ratings_rater_id                on public.ratings(rater_id);
create index if not exists idx_support_tickets_answered_by     on public.support_tickets(answered_by);
create index if not exists idx_transactions_application_id     on public.transactions(application_id);

-- ============================================================================
-- VALIDACIÓN: volver a correr la consulta de FKs sin índice → debe dar 0 filas.
-- ============================================================================
-- FIN
