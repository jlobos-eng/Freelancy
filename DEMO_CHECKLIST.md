# Freelancy — Checklist de demo a inversionistas

Esta guía deja la app lista para una presentación de 10 minutos sin que se vea
nada "roto", sin requerir cuentas reales en Mercado Pago, y con datos de
muestra que cuentan una historia coherente.

---

## TL;DR — para tener todo funcionando en ~30 minutos

1. Aplicar las 9 migraciones SQL en orden (sección 1).
2. Configurar 2 settings de Postgres (sección 2).
3. Crear los 7 usuarios demo en Supabase Auth (sección 3).
4. Correr el seed de datos demo (sección 4).
5. Configurar `.env` del frontend (sección 5).
6. Levantar la app (`npm run dev`).
7. Hacer un test pass del guión de demo (sección 8).

---

## 1) Migraciones SQL — orden estricto

Aplicar **una por una** desde Supabase → SQL Editor → New query → pegar →
Run. Si alguna tira error de "relation already exists", saltarla.

```
supabase/migrations/2026_04_24_gig_applications.sql
supabase/migrations/2026_04_24_notifications.sql
supabase/migrations/2026_04_25_postgis_geolocation.sql
supabase/migrations/2026_04_25_disputes.sql
supabase/migrations/2026_04_25_payments_marketplace.sql
supabase/migrations/2026_04_25_push_subscriptions.sql
supabase/migrations/2026_04_25_messages_read_state.sql
supabase/migrations/2026_04_25_addresses.sql
supabase/migrations/2026_04_25_skills_catalog.sql
supabase/migrations/2026_04_25_certifications.sql
```

Validaciones rápidas en el SQL Editor:

```sql
-- Debería devolver una versión, ej "3.4.2"
select postgis_version();

-- Debería devolver 42 skills
select count(*) from skills where is_active = true;

-- Debería devolver 9 categorías
select category, count(*) from skills group by category order by category;
```

---

## 2) Settings de Postgres (una sola vez)

Para que el trigger de notificaciones pueda llamar a Edge Functions:

```sql
alter database postgres set app.settings.supabase_url
    = 'https://<TU-PROJECT-REF>.supabase.co';
alter database postgres set app.settings.service_role_key
    = '<TU-SERVICE-ROLE-KEY>';
```

Reemplaza los valores con los reales (Settings → API → URL y service_role
secret). Estos settings se persisten entre reinicios.

---

## 3) Crear usuarios demo en Supabase Auth

Supabase → Authentication → Users → "Add user" (Create new user). Crear los
**7 usuarios** con cualquier password (recomendado: `demo123456`):

| Email                          | Rol en demo   |
|--------------------------------|---------------|
| `cliente@demo.cl`              | Cliente (tú)  |
| `mariana.electricista@demo.cl` | Lancy SEC ⭐  |
| `jorge.lobos@demo.cl`          | Lancy multi-skill |
| `carla.gasfiter@demo.cl`       | Lancy gásfiter |
| `daniel.pintor@demo.cl`        | Lancy pintor  |
| `paola.limpieza@demo.cl`       | Lancy limpieza |
| `luis.paseador@demo.cl`        | Lancy paseador |

> **Importante**: marca "Auto Confirm User" para no tener que confirmar email.

---

## 4) Seed de datos demo

Una vez creados los usuarios, correr en SQL Editor:

```
supabase/seeds/2026_demo_data.sql
```

Esto crea automáticamente: perfiles, avatares, skills (Mariana SEC verificada,
Jorge con 2 skills), direcciones reales en Santiago, ratings, y collector_id
fake de MP para que el onboarding gate no bloquee.

Validar:

```sql
select p.full_name, count(ws.id) as skills_count
from profiles p
join auth.users u on u.id = p.id
left join worker_skills ws on ws.worker_id = p.id
where u.email like '%@demo.cl'
group by p.full_name;
```

Debería devolver Mariana, Jorge (2 skills), Carla, Daniel, Paola, Luis.

---

## 5) Configurar `.env` del frontend

`frontend/.env`:

```bash
VITE_SUPABASE_URL=https://<TU-PROJECT>.supabase.co
VITE_SUPABASE_ANON_KEY=<TU-ANON-KEY>

# Mercado Pago — DEJAR APAGADO en demo
# Sin esto, el botón "Conectar MP" muestra "Próximamente" en gris.
VITE_MP_ENABLED=false

# Push notifications PWA — DEJAR APAGADO en demo
# Sin esto, el toggle "Notificaciones" en Settings muestra "no soportado"
# pero las notificaciones in-app + realtime SÍ funcionan.
# VITE_VAPID_PUBLIC_KEY=
```

---

## 6) Levantar la app localmente

```bash
cd frontend
rm -rf node_modules package-lock.json   # solo si vienes de un sandbox
npm install
npm run dev
```

Abrir `http://localhost:5173`. Si ves el dashboard cargar con los 6 Lancys en
el mapa de Santiago, está listo.

---

## 7) Lo que NO funciona en demo (y está OK)

Estas piezas existen pero requieren servicios externos que **no necesitamos
para impresionar a un inversionista**:

| Feature | Estado en demo | Mensaje al usuario |
|---|---|---|
| Pago con Mercado Pago real | ❌ | "Próximamente" en gris |
| OAuth callback MP | ❌ | Sólo si presionan el botón |
| Push notifications PWA | ❌ | Toggle dice "no soportado" |
| Webhook de pago | ❌ | N/A |
| Verificación admin de certs | ❌ | Mariana ya está pre-verificada en el seed |

Lo que **sí funciona end-to-end** sin servicios externos:

✅ Login/registro
✅ Mapa real con Leaflet + OSM (geolocalización)
✅ Postular a un gig (multi-bid competitivo)
✅ Aceptar postulación → modal de pago aparece (aunque MP esté off)
✅ Notificaciones in-app realtime (Supabase channels)
✅ Disputas con bloqueo de pago
✅ Múltiples habilidades por Lancy (Jorge)
✅ Badge "Verificado SEC" en Mariana
✅ Filtro "Sólo verificados"
✅ Direcciones estructuradas con autocomplete
✅ Pull-to-refresh
✅ Dark mode

---

## 8) Guión de demo sugerido (10 min)

### Acto 1 — Cliente busca un servicio (3 min)

1. Login como `cliente@demo.cl`.
2. Mostrar el dashboard con 6 Lancys en el mapa de Santiago.
3. Demostrar el filtro por categoría: "Electricista" → aparece sólo Mariana.
4. **Activar el toggle "Sólo verificados"** → destacar el badge azul "Verificado SEC" de Mariana.
5. Click en Mariana → ver su perfil con headline + tarifa + cert verificada.

### Acto 2 — Cliente publica un gig (2 min)

1. Botón "Publicar trabajo" → llenar título/desc/presupuesto.
2. Mostrar que la dirección se autocompleta con Nominatim.
3. Publicar. Aparece en "Tus contratos" como "Recibiendo ofertas".

### Acto 3 — Lancy postula (3 min)

1. Logout. Login como `jorge.lobos@demo.cl`.
2. **Punto clave**: en el dashboard del Lancy, mostrar que Jorge tiene 2 skills (Diseño + Paseador).
3. Ver el gig recién publicado por el cliente. Postular con monto + ETA + mensaje.
4. Hacer lo mismo con `carla.gasfiter@demo.cl` u otro para mostrar competencia.

### Acto 4 — Cliente acepta (2 min)

1. Volver a `cliente@demo.cl`.
2. **Notificación realtime**: aparece toast "Nueva postulación de Jorge".
3. Expandir las postulaciones. Ver las 2 ofertas con avatares y montos.
4. Click "Aceptar" → aparece `CheckoutModal` con desglose (gross + comisión + neto).
5. (En demo NO completar el pago — eso necesita MP real).

### Acto extra — Trust & Safety

- Mostrar el flujo de disputas: en un gig assigned, click "Reportar problema" → modal con 7 causales → enviar.
- El gig pasa a "En disputa" rojo. Demostrar que "Aprobar y Pagar" queda bloqueado.

---

## 9) Troubleshooting

**"No se ven Lancys en el mapa"**
→ El seed no corrió. Validar con `select count(*) from profiles where role='worker'`.

**"Error al postular: relation gig_applications does not exist"**
→ Falta correr la migración 2026_04_24_gig_applications.sql.

**"Error: Cannot find module @rollup/rollup-darwin-x64"**
→ `rm -rf node_modules package-lock.json && npm install` desde tu Mac.

**"Las notificaciones realtime no llegan"**
→ Verificar que la tabla `notifications` esté en la publication `supabase_realtime`.
   En SQL Editor: `select * from pg_publication_tables where pubname = 'supabase_realtime';`

**"El mapa se ve gris / sin tiles"**
→ Verificar que `import 'leaflet/dist/leaflet.css'` esté en MapView.jsx (ya está).

**"No funciona la búsqueda por skill"**
→ Necesitas las migraciones de PostGIS Y skills_catalog.

---

## 10) Después de la demo

Si los inversionistas dan luz verde:

1. **MP en producción**: crear app Marketplace en MP Developers, obtener credenciales reales, configurar webhooks, setear `VITE_MP_ENABLED=true`.
2. **VAPID keys** para push: `npx web-push generate-vapid-keys`, configurar Edge Function secrets.
3. **Borrar datos demo**:
   ```sql
   delete from profiles where id in (
     select id from auth.users where email like '%@demo.cl'
   );
   delete from auth.users where email like '%@demo.cl';
   ```
4. **Deploy a producción**: Vercel/Netlify → variables de entorno.

---

✅ Si llegaste hasta acá con todos los pasos hechos, la demo está lista.
