# Mapa Base de datos (Supabase) ↔ Frontend JEC Barber

Alinea **PostgreSQL** (`001_initial_schema.sql`) con lo que espera el React mock (`adminData.js`, `domain.js`) y con los DTO que expondrá Spring Boot.

> **Modelo:** UUID, `rango_tiempo` (`tstzrange`), ENUM en mayúsculas (`PENDIENTE`, `BRONCE`…). Usa `src/config/dbEnums.js` y `src/utils/schemaAdapter.js` para mapear API ↔ UI. Revisión técnica: `docs/MASTER_SCHEMA_REVIEW.md`.

## Convención

| Capa | Estilo |
|------|--------|
| PostgreSQL | `snake_case` |
| JSON al front (recomendado) | `camelCase` como en el mock actual |

El backend puede mapear en DTOs (MapStruct, records, etc.).

---

## Tablas y equivalencias

### `clientes`

| Columna | Tipo | Front (ClienteRecord / sesión) |
|---------|------|--------------------------------|
| `id` | UUID | `id`, `clienteId` (string en API; mocks locales pueden seguir con enteros hasta integrar) |
| `nombre` | VARCHAR | `nombre` |
| `email`, `telefono` | VARCHAR nullable | login / contacto |
| `rango` | `rango_cliente_enum` | `rango` (`Bronce` \| `Plata` \| `Oro`) vía `dbEnums` |
| `cortes`, `proximos`, `ausencias` | INT | `cortes`, `proximos`, (ausencias: campo extra en BD) |
| `notas` | TEXT | `notas` |
| `activo` | BOOLEAN | útil en API; el mock no siempre lo usa |

### `barberos`

| Columna | Front |
|---------|--------|
| `id` | UUID → `id`, `barberoId` |
| `nombre` | `nombre` / `barberoNombre` en citas |
| `porcentaje` | comisión % |
| `cortes_realizados` | `cortesRealizados` |
| `activo` | útil en API |

### `servicios`

| Columna | Front |
|---------|--------|
| `id` | UUID → `id` |
| `nombre` | `nombre` |
| `precio` | `precio` |
| `duracion` | INTERVAL → minutos en JSON (ej. 30) |
| `activo` | `activo` |

### `citas`

Una fila = una reserva; el **horario** va en `rango_tiempo`, no en columnas `fecha`/`hora` separadas.

| Columna | Tipo | Front (vía `citaApiToUi`) |
|---------|------|---------------------------|
| `id` | UUID | `id` |
| `rango_tiempo` | TSTZRANGE | se proyecta a `fecha` + `hora` (12h) para listas actuales |
| `cliente_id` | UUID nullable | `clienteId` |
| `nombre_invitado` | VARCHAR nullable | `nombreInvitado` (si no hay `cliente_id`) |
| `barbero_id` | UUID | `barberoId` |
| `pedido_cliente`, `notas` | TEXT | `pedidoCliente`, `notas` |
| `estado` | `estado_cita_enum` | `PENDIENTE`… → `Pendiente`… |
| `monto`, `comision_monto`, `propina` | NUMERIC | `monto`, `comisionMonto`, `propina` |
| `metodo_pago` | `metodo_pago_enum` | `metodoPago` |

**Líneas del carrito:** tabla `cita_detalles` (`servicio_id`, `precio_cobrado`). El DTO enriquecido puede incluir `cita_detalles` o un nombre de servicio agregado para la lista.

```sql
-- Idea de proyección para el admin (joins + rango)
SELECT c.*, cl.nombre AS cliente_nombre, b.nombre AS barbero_nombre
FROM citas c
LEFT JOIN clientes cl ON cl.id = c.cliente_id
JOIN barberos b ON b.id = c.barbero_id;
```

- **Resumen “hoy”:** filtrar por `lower(rango_tiempo)::date = :hoy` (ajustar zona horaria según producto).
- **Agenda barbero (14 días):** `barbero_id = ?` y solape de `rango_tiempo` con el rango de fechas deseado (`&&` con `tstzrange`).
- **Historial:** citas con fin de rango en el pasado o `estado` distinto de `PENDIENTE`, según reglas de negocio.

**Crear cita desde API:** construir `rango_tiempo` como `[inicio, fin)` en UTC (ver `buildTstzRangeLiteral` en `schemaAdapter.js`).

### `cita_detalles`

| Columna | Uso |
|---------|-----|
| `cita_id`, `servicio_id` | FK |
| `precio_cobrado` | precio aplicado en esa línea |

### `auditoria_citas`

Registro de alertas (reversiones de completada, reducción de monto). Solo admin en RLS; Spring con rol de servicio puede leer todo.

### `inventario_salon`

| Columna | Front `INITIAL_INVENTARIO` |
|---------|----------------------------|
| `id` | UUID |
| `nombre`, `precio`, `stock`, `stock_minimo` | igual concepto que mock |

### `ventas_salon`

Descuenta stock vía trigger (`producto_id` → `inventario_salon`).

### `inventario_barbero`

| Columna | Front |
|---------|--------|
| `barbero_id` | `barberoId` |
| `nombre`, `stock`, `stock_minimo` | como mock |

### `gastos`

| Columna | Front |
|---------|--------|
| `concepto`, `monto`, `categoria`, `fecha` | como mock |

### `liquidaciones`, `horarios_trabajo`, `bloqueos_agenda`

Tablas de operación (pagos a barberos, franjas laborales, días libres). Los bloqueos disparan cancelación automática de citas `PENDIENTE` solapadas.

### `perfiles` (Supabase Auth)

| Columna | Uso |
|---------|-----|
| `id` | UUID = `auth.users.id` |
| `rol` | `ADMIN` \| `BARBERO` \| `CLIENTE` |
| `cliente_id` / `barbero_id` | según rol (CHECK en esquema) |

Sin Supabase Auth al inicio: puedes omitir esta tabla en el flujo solo-Spring y añadirla cuando sincronices con `auth.users`.

### Vista `resumen_financiero_mensual`

KPI mensual (cortes, ingresos brutos, comisiones, gastos, utilidad). Útil para sustituir parte de `INITIAL_STATS` cuando haya datos reales.

---

## KPIs que hoy son mock (`INITIAL_STATS`)

`ingresosTotales`, `cortesMesActual`, etc.: calcular en SQL o en Java a partir de `citas` completadas, `ventas_salon` y la vista anterior.

## CSV / exportaciones

Alinear columnas con `adminExports.js`; `rango_cliente` desde join `clientes.rango` (ENUM → texto UI si hace falta).

## Reservas desde la app cliente

Demo en `sessionStorage`. Producción: `POST` con `cliente_id` del JWT, `barbero_id`, `rango_tiempo`, líneas en `cita_detalles`, `monto` total coherente, `estado = PENDIENTE`, etc.

---

## Row Level Security (RLS)

Políticas por rol (`ADMIN`, `BARBERO`, `CLIENTE`) en `perfiles`, `citas` y `auditoria_citas`. Spring con **service role** o rol que bypass RLS según tu configuración. Si el front hablara directo a Supabase con anon key, habría que revisar cada política.
