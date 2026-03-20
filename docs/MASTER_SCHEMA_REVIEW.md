# Revisión: esquema «SaaS Premium» (JEC Barber Master)

Este documento revisa el esquema consolidado en `supabase/migrations/001_initial_schema.sql` y explica cómo encaja con el frontend actual.

## Lo que está muy bien

- **UUID** como PK: escala bien en multi-tenant y encaja con Supabase Auth.
- **`tsrange` + `EXCLUDE USING gist`**: evita solapes reales de tiempo (mejor que solo `UNIQUE(fecha, hora)` si todo el mundo usa el mismo huso y construyes bien el rango).
- **`cita_detalles`**: varios servicios por cita (carrito); coherente con `monto` total en `citas`.
- **Auditoría, strikes, liquidaciones, ventas de salón, bloqueos**: buen alcance de producto.
- **Vista `resumen_financiero_mensual`**: útil para admin.
- **Triggers** de rango, inventario, ausencias, bloqueo: lógica clara (revisar detalles abajo).

## Correcciones obligatorias (seguridad / coherencia)

### 1. `perfiles`: regla para `ADMIN`

Tu `CHECK` termina en `(rol = 'ADMIN')`, lo que permite un admin con `cliente_id` o `barbero_id` rellenados por error.

**Debe ser:**

```sql
(rol = 'ADMIN' AND cliente_id IS NULL AND barbero_id IS NULL)
```

### 2. RLS en `citas`: política `USING (true)`

`CREATE POLICY ... ON citas FOR SELECT USING (true)` hace que **cualquier usuario que pase otra política OR vea todas las filas** (en PostgreSQL las políticas de un mismo comando se combinan con **OR** para `USING`).

**Quita** esa política. Si necesitas “solo ver huecos ocupados” para anónimos, crea una **vista** que exponga solo `barbero_id` + `rango_tiempo` (sin cliente ni monto), con `SECURITY INVOKER` y políticas propias, o un endpoint en Spring.

### 3. `INSERT` con `WITH CHECK (true)`

Permite insertar citas arbitrarias (fraude / spam). Sustituye por reglas reales, por ejemplo:

- usuario autenticado,
- `cliente_id` coincide con `perfiles.cliente_id` del JWT,
- o reserva pública controlada por rate limit en backend.

### 4. `pg_cron`

En Supabase, **pg_cron** no siempre está habilitado en todos los planes / proyectos. Comprueba el dashboard. Si no está, ejecuta `marcar_ausencias_automaticas()` desde **Supabase Edge Function + cron**, **GitHub Actions**, o el **scheduler de Spring**.

### 5. `ventas_salon` → stock

El trigger resta stock pero no impide **stock negativo**. Añade `CHECK` post-update o `GREATEST(stock - cantidad, 0)` con regla de negocio explícita (o `RAISE EXCEPTION` si no hay stock).

### 6. Desacople con el front actual (enums y texto)

| Base de datos (tu ENUM) | UI mock actual |
|-------------------------|----------------|
| `BRONCE`, `PLATA`, `ORO` | `Bronce`, `Plata`, `Oro` |
| `PENDIENTE`, `COMPLETADA`… | `Pendiente`, `Completada`… |

El front **no** tiene que reescribirse entero: usa `src/config/dbEnums.js` + `src/utils/schemaAdapter.js` para mapear DTO ↔ pantallas.

### 7. IDs numéricos en mocks

`adminData.js` sigue con **enteros** para desarrollo sin API. Cuando conectes el back, el adaptador convierte **UUID ↔ string** en las keys de React y en los payloads.

## Archivo SQL en el repo

La versión aplicable (RLS, CHECK admin, cron comentado, trigger de stock en ventas) vive en:

`supabase/migrations/001_initial_schema.sql`

## Frontend

- Enums y helpers: `src/config/dbEnums.js`
- Mapeo API ↔ UI: `src/utils/schemaAdapter.js`
- Reserva cliente: método de pago, invitado, campos opcionales alineados al modelo `citas` + futuro `cita_detalles`
