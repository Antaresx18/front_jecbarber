# Supabase (PostgreSQL) — JEC Barber

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `migrations/001_initial_schema.sql` | Esquema único: **UUID**, `rango_tiempo` (`tstzrange`), `cita_detalles` (carrito), `auditoria_citas`, `ventas_salon`, `horarios_trabajo`, `bloqueos_agenda`, `liquidaciones`, ENUM en mayúsculas, RLS y vista `resumen_financiero_mensual`. |

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

## CLI (opcional)

Si usas [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase db push   # o link + migration apply según tu flujo
```
