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

## CLI (opcional)

Si usas [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase db push   # o link + migration apply según tu flujo
```
