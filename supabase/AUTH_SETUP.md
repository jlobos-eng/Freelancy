# Configuración de autenticación

Esta guía cubre cómo activar:
1. Confirmación obligatoria de email (sign up con email/password).
2. Reset de contraseña ("Olvidé mi contraseña").
3. Google OAuth.
4. Microsoft / Azure AD OAuth.

Todo se configura desde el **Supabase Dashboard** del proyecto. El código del
frontend ya está listo — sólo hay que pegar credenciales en los lugares
correctos.

---

## 1. URL del sitio y redirect URLs

**Authentication → URL Configuration**

Ajusta:

- **Site URL**: la URL donde corre tu app (ej. `https://app.freelancy.cl` o
  para dev `http://localhost:5173`).
- **Redirect URLs**: agregar **todas** las URLs que tu app puede usar como
  destino de OAuth y recovery. Ejemplos:
  ```
  http://localhost:5173/
  http://localhost:5173/auth/reset
  http://localhost:5173/oauth/mp/callback
  https://app.freelancy.cl/
  https://app.freelancy.cl/auth/reset
  https://app.freelancy.cl/oauth/mp/callback
  ```

> Si no agregas la URL, Supabase rechaza el redirect con `redirect_uri_mismatch`.

---

## 2. Confirmación de email obligatoria

**Authentication → Settings → Email**

Activar:
- **Enable email confirmations** = ON
- **Secure email change** = ON (recomendado)

Plantillas (Authentication → Email Templates):
- **Confirm signup**: el link debe apuntar a `{{ .SiteURL }}/`.
- **Reset password**: link debe apuntar a `{{ .SiteURL }}/auth/reset`.

> Si NO activas confirmaciones, los signups quedan logueados al instante. El
> código del frontend funciona en ambos modos, pero si decidiste confirmación
> obligatoria (recomendación) tienes que activarla acá.

---

## 3. Google OAuth

### Paso 1 — Crear el proyecto en Google Cloud Console

1. Entra a https://console.cloud.google.com
2. Crea un proyecto nuevo (o usa uno existente).
3. **APIs & Services → OAuth consent screen**:
   - User Type: **External**.
   - App name: `Freelancy`.
   - Support email: el tuyo.
   - Authorized domains: `supabase.co` (y tu dominio si tienes uno propio).
   - Scopes: deja los default (`email`, `profile`, `openid`).
   - Test users: agrega tu email mientras esté en modo Testing. Cuando publiques (modo Production) lo puedes quitar.

### Paso 2 — Crear credenciales OAuth

**APIs & Services → Credentials → Create Credentials → OAuth Client ID**

- Application type: **Web application**.
- Name: `Freelancy Web`.
- Authorized JavaScript origins:
  ```
  http://localhost:5173
  https://app.freelancy.cl
  https://<tu-proyecto>.supabase.co
  ```
- Authorized redirect URIs (lo más importante):
  ```
  https://<tu-proyecto>.supabase.co/auth/v1/callback
  ```
  Esa URL la copias **literalmente desde el dashboard de Supabase** en
  `Authentication → Providers → Google → Callback URL`.

Al crear, te dan **Client ID** y **Client Secret**.

### Paso 3 — Pegar en Supabase

**Authentication → Providers → Google**

- Enable Google = ON.
- Client ID: el de Google.
- Client Secret: el de Google.
- Save.

### Paso 4 — Probar

Abre la app, click en "Continuar con Google". Deberías ver la pantalla de
consentimiento, elegir cuenta, y volver a la app ya logueado.

---

## 4. Microsoft / Azure AD OAuth

Supabase llama a este provider **`azure`** (nombre histórico). Funciona con
cuentas personales (`@outlook.com`, `@hotmail.com`) y de empresa (Azure AD).

### Paso 1 — Registrar la app en Azure

1. Entra a https://portal.azure.com → **Azure Active Directory** →
   **App registrations** → **New registration**.
2. Name: `Freelancy`.
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
4. Redirect URI:
   - Platform: **Web**.
   - URI: `https://<tu-proyecto>.supabase.co/auth/v1/callback` (idéntica a la de Google, es la callback de Supabase).
5. Register.

### Paso 2 — Crear el secret

En la app que creaste:
- **Certificates & secrets → Client secrets → New client secret**.
- Description: `Supabase`.
- Expires: 24 meses (o lo que quieras, recordando rotarlo).
- Copia el **Value** (NO el Secret ID — el Value es la parte secreta y se
  muestra una sola vez).

Anota también el **Application (client) ID** que aparece en la página overview.

### Paso 3 — Permisos opcionales

**API permissions**:
- Por default ya tiene `User.Read` (suficiente para email + nombre).
- Si quieres avatar de Microsoft Graph, agrega `User.Read` con consentimiento explícito (ya viene).

### Paso 4 — Pegar en Supabase

**Authentication → Providers → Azure (Microsoft)**

- Enable = ON.
- Application (client) ID: el de Azure.
- Secret Value: el secret que copiaste.
- Azure Tenant URL: `https://login.microsoftonline.com/common` (para aceptar cualquier cuenta personal o empresarial).
- Save.

---

## 5. Trigger de creación automática de perfil

La migration `2026_04_27_auth_profile_trigger.sql` crea una función
`handle_new_user()` que se dispara después de cada INSERT en `auth.users`.

Esto cubre los 4 casos:
- Sign up con email/password.
- Login con Google (primer ingreso).
- Login con Microsoft (primer ingreso).
- Magic link (primer ingreso).

La función intenta tomar `full_name` y `avatar_url` de los metadatos del
provider. Si falla, usa la parte antes del `@` del email como nombre.

### Aplicarla

```bash
# Si tienes Supabase CLI:
supabase db push

# O copiar y pegar en SQL Editor del dashboard.
```

### Verificar

```sql
select trigger_name, event_object_schema, event_object_table
from information_schema.triggers
where trigger_name = 'on_auth_user_created';
```

Debería retornar 1 row.

---

## 6. Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `redirect_uri_mismatch` | URL no está en Authorized Redirect URIs del provider | Agregarla en Google Cloud / Azure Portal |
| `Provider is disabled` al hacer click en Google/Microsoft | Toggle OFF en Supabase | Activar en Authentication → Providers |
| Login con OAuth funciona pero no aparece row en `profiles` | Trigger no aplicado | Correr `2026_04_27_auth_profile_trigger.sql` |
| `Email not confirmed` aunque ya hizo click | Plantilla de email apunta a la URL incorrecta | Revisar `{{ .SiteURL }}` en la plantilla |
| Reset password redirect a 404 | `/auth/reset` no está en Redirect URLs autorizadas | Agregarla en Auth → URL Configuration |
| El nombre del usuario llega vacío | Algunos providers no devuelven `full_name` en el primer login | El trigger usa `split_part(email, '@', 1)` como fallback |

---

## 7. Variables de entorno del frontend

No hay nuevas. El frontend ya usa:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Las URLs de redirect se calculan dinámicamente con `window.location.origin`,
así que la misma build sirve para localhost y producción.
