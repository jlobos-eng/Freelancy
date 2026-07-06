-- =====================================================================
-- DEPRECATED — esta migration fue reemplazada por:
--   2026_04_25_postgis_geolocation.sql
--
-- Se dejó vacía a propósito. Si la corres no hace nada.
-- Si tu entorno ya la había corrido antes, las funciones legacy
-- nearby_workers(double precision, double precision, double precision, integer)
-- y update_my_location(double precision, double precision)
-- se eliminan abajo para evitar overloads ambiguos.
-- =====================================================================

-- Limpieza idempotente de versiones legacy (no falla si no existen)
DROP FUNCTION IF EXISTS public.nearby_workers(double precision, double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.update_my_location(double precision, double precision);

-- Nada más. Continúa con 2026_04_25_postgis_geolocation.sql.
