# Freelancy — Handoff / Bitácora de trabajo · v1
**Fecha:** 7 de julio de 2026 · **Preparado para:** Jorge Lobos (Neurostrategia)

> Documento vivo. Cada tanto lo actualizamos o creamos v2. Sirve para retomar el trabajo (y para arrancar chats nuevos sin saturar memoria).

---

## 1. Qué es Freelancy
Marketplace móvil-first que trae formalidad al trabajo informal (profesionales y oficios) vía georreferenciación. Dos lados: **clientes** que publican trabajos ("gigs") y **"Lancys"** (trabajadores) que postulan. Incluye escrow de pagos, KYC, disputas, retiros bancarios, reputación y verificación de credenciales (SEC/MINSAL).

**Filosofía de trabajo de Jorge (IMPORTANTE):** abordar todo **de lo más simple/útil a lo más complejo/secundario**. Ordenar siempre las opciones así y arrancar por lo simple.

---

## 2. Stack & arquitectura
- **Frontend:** React 18 + Vite + Tailwind. SPA mobile-first. Carpeta `frontend/`. Orquestador `src/App.jsx` (~1.340 líneas, 47 useState — monolítico, pendiente de refactor). Vistas en `src/views`, modales en `src/modals`, componentes en `src/components`, hooks por dominio en `src/hooks`, utilidades en `src/utils`.
- **Backend:** Supabase — Postgres 17 + PostGIS 3.3.7, Row-Level Security en todas las tablas, 5 Edge Functions (Deno/TS) para Mercado Pago + push, Storage privado (KYC, certificaciones).
- **Pagos:** Mercado Pago Marketplace con escrow (flag `VITE_MP_ENABLED=false` hoy). Comisión app = 10% (`round(bid*0.10)`).
- **Monitoreo:** Sentry (proyecto `freelancy-web` en org neurostrategia), inerte hasta que haya `VITE_SENTRY_DSN` (ya está en `.env` local).
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — lint → test → build en cada push/PR.

**Proyecto Supabase:** nombre **Freelancy**, id `oonsztmuvruhfdghpqgd`, región us-east-2.
**Repo GitHub:** `https://github.com/jlobos-eng/Freelancy` (rama `main`, **público** — evaluar pasar a privado). Push por HTTPS con Personal Access Token (scope `repo`) guardado en el llavero de macOS.

---

## 3. Estado actual (al cierre de v1)
- **App corre local** (`cd frontend && npm run dev` → http://localhost:5173) y fue **probada end-to-end en vivo** contra la BD real. Login funciona, todo el surface principal validado (ver §5).
- **BD viva y repo SINCRONIZADOS** (antes divergían: 3 migraciones estaban sin aplicar).
- **Seguridad blindada y probada**, **dinero íntegro**, **performance optimizada**, **CI verde**.
- **NO desplegada** aún. La app es un SPA estático → se puede hostear GRATIS en Render Static Site o Vercel (el web service de $7 de Render NO es necesario para esto).
- **Etapas del roadmap:** 0 (cimientos) y 1 (seguridad) completas y verificadas. Etapa 2 (calidad/CI) hecha. Etapa 3 (arquitectura frontend) recién iniciada (tipos TS generados).

---

## 4. Todo lo que se hizo (por área)

### 4.1 Auditoría inicial
Se auditó el código y se generaron 2 entregables en la raíz: `Freelancy_Auditoria_y_Roadmap.docx` (informe formal) y `Freelancy_Roadmap_Dashboard.html` (dashboard interactivo). Diagnóstico: producto funcionalmente avanzado pero baja madurez de ingeniería. Roadmap en 6 etapas (0 cimientos → 5 escala).

### 4.2 Migraciones aplicadas a la BD viva (todas con archivo en `supabase/migrations/` + verificadas)
- `2026_04_23_0000_base_schema.sql` — **C1**: esquema base (profiles, gigs, messages, ratings) que el resto asumía preexistente. `ratings` es nueva. Habilita postgis.
- `2026_04_28_rls_hardening.sql` — **C6 (parte 1)**: eliminó políticas permisivas del MVP (rol `public`, `using true`) que exponían chats y perfiles a anónimos. Cerró acceso anónimo.
- `2026_04_29_search_path_hardening.sql` — **C2**: fijó `search_path` en 24 funciones `security definer`.
- `2026_04_30_mp_credentials.sql` — **C6 (parte 2)**: movió tokens MP a tabla `mp_credentials` (solo service_role) y los sacó de `profiles`. Cerró fuga de tokens.
- `2026_05_01_notifications_rls_fix.sql` — **C3**: quitó políticas INSERT permisivas de notifications (spoofing). Triggers security definer siguen insertando.
- `2026_05_02_views_security_invoker.sql` — vistas con `security_invoker=true` (lint security_definer_view).
- `2026_04_27_kyc.sql` y `2026_04_27_auth_profile_trigger.sql` — **estaban sin aplicar**; se aplicaron (kyc_status, is_admin, kyc_submissions, trigger que crea perfil al registrarse, bucket kyc-documents). Los 10 perfiles existentes quedaron kyc_status='approved'.
- `2026_05_03_transactions_amount_integrity.sql` — **C4**: CHECK `amount_gross = amount_fee + amount_net`.
- `2026_05_04_gigs_updated_at.sql` — **BUG CAZADO**: la base creó trigger updated_at sobre gigs pero la columna no existía → TODO UPDATE a gigs fallaba (rompía aceptar postulación/review/completar). Se agregó la columna.
- `2026_05_05_remove_legacy_balance_trigger.sql` — eliminó modelo de saldo legacy (trigger_pago_gig escribía profiles.balance, no usado). Una sola fuente de verdad: transactions/wallet_balance.
- `2026_05_06_fk_indexes.sql` — índices para 11 foreign keys sin cubrir.
- `2026_05_07_rls_initplan_optimization.sql` — 43 políticas RLS: `auth.uid()` → `(select auth.uid())` (perf a escala). Self-transforming/idempotente.
- `2026_04_26_withdrawals.sql` — **estaba sin aplicar**; se aplicó (cl_banks, bank_accounts, withdrawals, RPCs request/cancel/simulate_withdrawal, wallet_balance v2 que descuenta retiros). Retiros estaban inoperativos.
- `2026_05_08_withdrawals_followup.sql` — RLS en cl_banks + índice FK bank_accounts.bank_code.
- `2026_05_09_gig_applications_rls_cleanup.sql` — **FUGA DE PRIVACIDAD** (la halló el advisor): `applications_select` era `using(true)` → cualquier worker veía las ofertas de la competencia. Se acotó (worker propio o cliente del gig) + se quitaron policies legacy public.
- `2026_05_10_dispute_guards_search_path.sql` — search_path en los guards de disputa.

**Todos los críticos del informe (C1, C2, C3, C4, C6) cerrados y verificados.**

### 4.3 Tests
- **Unitarios (Vitest):** 33 tests sobre lógica pura de alto valor — `rut.js` (validación RUT módulo 11), `format.js` (CLP/ETA/relativo), `geo.js` (jitter de privacidad), `categories.js` (filtro marketplace), `avatar.js`. En `frontend/src/utils/__tests__/`. CI los corre.
- **Integración SQL (impersonación de roles + rollback, en `supabase/tests/`):**
  - `rls_security_checks.sql` — 7 aserciones de aislamiento RLS.
  - `money_flow_test.sql` — aceptar postulación crea la transacción con split correcto.
  - `withdrawal_flow_test.sql` — retiro descuenta del saldo disponible (45000→25000).
  - `dispute_flow_test.sql` — disputa congela el pago, bloquea completar, libera al resolver.
  Todos PASAN. Se corren pegándolos en el SQL Editor de Supabase.

### 4.4 Monitoreo, CI, TS
- Sentry cableado (`frontend/src/services/monitoring.js`, inerte sin DSN, carga @sentry/react dinámicamente). DSN en `.env` local. Proyecto `freelancy-web` creado.
- CI GitHub Actions verde (lint/test/build). Repo con git inicializado, `.gitignore` robusto, basura limpiada.
- Tipos TS generados del esquema en `frontend/src/types/database.types.ts` (eslint los ignora). Script `npm run gen:types`.

### 4.5 UX fixes
- Radio de mapa por defecto 5km→10km (a 5km salía vacío). `App.jsx:104`.

---

## 5. Validación en vivo (probado en el navegador)
Login + gate KYC ✅ · Dashboard con datos reales ✅ · Billetera/retiros (wallet_balance v2) ✅ · Mapa geoespacial PostGIS (6-7 Lancys) ✅ · Modo Trabajar ✅ · Publicar gig (verificado en BD) ✅ · Perfil completo (addresses/worker_skills/certifications/bio) ✅. Todo contra la BD endurecida, sin errores.

---

## 6. Cómo correr / operar
- **Levantar:** `cd "…/FreelancyApp/frontend" && npm run dev` → http://localhost:5173. Login con `jlobos@neurostrategia.cl` (kyc approved).
- **Tests unitarios:** `cd frontend && npm test`.
- **Tests de integración BD:** pegar los `supabase/tests/*.sql` en Supabase → SQL Editor.
- **Regenerar tipos TS:** `cd frontend && npm run gen:types` (requiere Supabase CLI logueado).
- **Git:** `git push` (token en llavero). Rama `main`.
- **`.env` (frontend):** tiene VITE_SUPABASE_URL, anon key, VITE_SENTRY_DSN. MP y Push en `false`.

---

## 7. Pendientes (de simple a complejo)
1. **Subir commit** `e82830d` (fix radio) con `git push`. *(puede que ya esté hecho)*
2. **Evaluar repo privado** (hoy público; sin secretos expuestos, pero es producto en desarrollo).
3. **Desplegar** (Render Static Site gratis o Vercel) para URL viva.
4. **Etapa 3 — refactor frontend (el foco siguiente):**
   a. Convertir utils puras a TypeScript (`rut, format, geo, categories, avatar`) + `tsconfig` + `typescript` dep + script `typecheck` (tsc --noEmit) en CI. Empezar por 1 util piloto, validar con `npm test` y app corriendo.
   b. Introducir **React Router** (hoy navegación por `step` manual en App.jsx).
   c. Descomponer `App.jsx` (extraer estado a contextos/stores por dominio).
   d. Tipar la capa de datos usando `database.types.ts` (createClient<Database>).
5. **UX menores:** en Modo Trabajar el usuario ve sus propios gigs (filtrar); afinar radio.
6. **Al activar MP:** redeploy de edge functions (mp-oauth-callback ya adaptada a mp_credentials).
7. **Drift menor:** reconciliar columnas que la migración base define pero la BD viva no tiene (profiles: email/phone/headline/created_at; gigs: category) — cosmético.
8. **Etapa 4+ (post):** MP producción, KYC real (hoy OCR en cliente), tests e2e Playwright, anti-fraude, reputación robusta.

---

## 8. Notas de seguridad para quien continúe
- El acceso a la BD viva es vía el **MCP de Supabase** (proyecto id `oonsztmuvruhfdghpqgd`). Usar `apply_migration` para DDL y `execute_sql` para lecturas/tests.
- Patrón de test seguro: impersonar roles (`set local role authenticated` + `set_config('request.jwt.claims', ...)`), envolver en subtransacción y `raise exception 'ROLLBACK_SENTINEL'` para revertir. No persiste nada.
- Tras cualquier cambio de RLS, correr `supabase/tests/rls_security_checks.sql`.
- Fijar `set search_path = public` en toda función `security definer` nueva.
- Nunca escribir contraseñas ni crear cuentas por el usuario (login lo hace él).
