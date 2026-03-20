# Supabase (PostgreSQL) — JEC Barber

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `migrations/001_initial_schema.sql` | Esquema único: **UUID**, `rango_tiempo` (`tstzrange`), `cita_detalles` (carrito), `auditoria_citas`, `ventas_salon`, `horarios_trabajo`, `bloqueos_agenda`, `liquidaciones`, ENUM en mayúsculas, RLS y vista `resumen_financiero_mensual`. |
| `migrations/003_fix_perfiles_rls_recursion.sql` | **Solo si ya ejecutaste un 001 antiguo:** corrige recursión RLS en `perfiles` (`jec_auth_is_admin`). Los 001 nuevos ya incluyen el arreglo. |
| `migrations/004_barberos_gestion_columns_rls.sql` | Columnas `foto_url`, `especialidad` en `barberos` + RLS (lectura pública, escritura solo ADMIN). Ejecutar en proyectos creados antes de este cambio. |
| `migrations/005_servicios_descripcion_rls.sql` | Columna `descripcion` en `servicios` + RLS (SELECT público, INSERT/UPDATE/DELETE solo ADMIN). Ejecutar si tu `001` no incluye ya estos cambios. |
| `migrations/006_admin_rls_operativa_ventas_citas_pro.sql` | RLS ADMIN para panel (turnos, bloqueos, ventas, inventario, pagos/gastos) + vista `citas_pro`. Ejecuta si tu proyecto ya existe y no tiene RLS/ vista. |

No hay `seed.sql` en el repo: carga datos desde **Spring Boot**, scripts SQL manuales o el panel de Supabase.

## Cómo aplicarlo en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor** → nueva query.
3. Pega y ejecuta el contenido de `migrations/001_initial_schema.sql`.
4. Revisión de decisiones y riesgos: `docs/MASTER_SCHEMA_REVIEW.md`.
5. **Usuarios admin / barberos / clientes y datos iniciales:** `docs/SUPABASE_ONBOARDING.md`.
6. En **Project Settings → Database** copia la **Connection string** para Spring Boot.

## Notas

- `perfiles` referencia `auth.users`: típico de Supabase.
- Integración front ↔ ENUM mayúsculas / UUID: `src/config/dbEnums.js` y `src/utils/schemaAdapter.js`.
- Mapa columnas ↔ JSON del front: `docs/SUPABASE_FRONT_MAP.md`.

## Edge Function `crear-barbero`

Crea un usuario en **Auth** (correo confirmado), fila en **barberos** y **perfiles** con rol `BARBERO`. Solo puede ejecutarla un usuario con `rol = 'ADMIN'` (JWT en `Authorization`).

En `config.toml` esta función tiene **`verify_jwt = false`**: el **gateway** no valida el JWT (evita 401 *Invalid JWT* con algunas claves nuevas tipo “Publishable”). La seguridad sigue en el código: `auth.getUser()` + comprobación de rol ADMIN.

La función usa `SUPABASE_URL` y `SUPABASE_ANON_KEY` (habitualmente inyectadas por Supabase) y **`SERVICE_ROLE_KEY`**: debes definirla como secret con el valor de la **service role** del proyecto:

```bash
supabase secrets set SERVICE_ROLE_KEY=tu_service_role_key
supabase functions deploy crear-barbero
```

Si desplegaste la función solo desde el **panel web**, desactiva allí la verificación JWT para `crear-barbero` (o vuelve a desplegar con CLI para que aplique `config.toml`).

El front llama: `supabase.functions.invoke('crear-barbero', { body: { email, password, nombre, especialidad } })` (sin cabeceras manuales; el cliente adjunta el JWT de la sesión).

## Edge Function `crear-cliente`

Alta de **cliente con acceso al portal**: inserta fila en `clientes`, crea usuario en **Auth** (sin `rol: CLIENTE` en metadata, para no duplicar filas con el trigger del registro público) y fila en `perfiles` con `rol = CLIENTE`. Solo **ADMIN**.

Si en el panel ves **«Failed to send a request to the Edge Function»**, la función **no está desplegada** en ese proyecto (o el nombre no coincide). Hay que desplegarla una vez.

### Despliegue con Supabase CLI (recomendado)

En la raíz del repo (donde está la carpeta `supabase/`):

1. Instala la CLI: [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Inicia sesión: `supabase login`
3. Enlaza el proyecto: `supabase link --project-ref TU_PROJECT_REF`  
   (`TU_PROJECT_REF` está en **Project Settings → General** de Supabase, p. ej. `udyrlhvfgdtmmkuozpg`).
4. Secret con la **service role** (⚠️ no la subas al repo; solo en Supabase):  
   `supabase secrets set SERVICE_ROLE_KEY=tu_service_role_key`  
   (La clave está en **Project Settings → API → service_role**.)
5. Despliega:  
   `supabase functions deploy crear-cliente`

Si ya usas `crear-barbero` con el mismo secret, basta con el paso 5 para `crear-cliente`.

En el **panel de Supabase → Edge Functions**, comprueba que exista **`crear-cliente`** y que **JWT verification** esté desactivada para esa función (o vuelve a desplegar con el `config.toml` del repo, que pone `verify_jwt = false`).

### Si no despliegas la función

En **Gestión clientes → Añadir cliente**, deja la **contraseña vacía**: solo se crea la ficha en `clientes` (agenda / citas). Eso **no** llama a la Edge Function. Para que el cliente pueda entrar en la app hace falta desplegar `crear-cliente` o que se registre solo desde el login.

Mismos secretos que `crear-barbero` (`SERVICE_ROLE_KEY` o `SUPABASE_SERVICE_ROLE_KEY` inyectada al desplegar). En `config.toml`: `verify_jwt = false`.

El panel **Gestión clientes** invoca la función solo cuando rellenas **contraseña inicial**.

### Body mínimo desde un formulario (Nombre + Correo)

```json
{ "Nombre": "Ana López", "Correo": "ana@ejemplo.com" }
```

También acepta `nombre` / `email`. Con solo esos campos se inserta en `public.clientes`. Si además envías `password` (≥ 6 caracteres), se crea usuario Auth y `perfiles` (CLIENTE).

### Opcional: avisar a Spring Boot

Secret `SPRING_CLIENTE_WEBHOOK_URL`: URL POST donde tu backend reciba `{ Nombre, Correo, clienteId }`. Opcional `SPRING_WEBHOOK_SECRET` (cabecera `X-Webhook-Secret`).

## CLI (opcional)

Si usas [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase db push   # o link + migration apply según tu flujo
```
