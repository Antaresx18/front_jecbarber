# Onboarding: usuarios, barberos y datos en Supabase

Tu esquema enlaza **Auth** (`auth.users`) con **`public.perfiles`** (rol + `cliente_id` o `barbero_id`). Los barberos y clientes son filas en **`barberos`** y **`clientes`**; el usuario de Supabase Auth solo “apunta” a una de esas filas (o es admin sin puntero).

## Orden recomendado

1. Ejecutar **`supabase/migrations/001_initial_schema.sql`** si aún no lo hiciste.
2. Crear **catálogo** en tablas públicas: `barberos`, `servicios`, `clientes` (sin depender de Auth).
3. En **Authentication → Users**, crear usuarios (email + contraseña) o invitaciones.
4. Copiar el **UUID** de cada usuario (columna **User UID** en el listado).
5. Insertar filas en **`public.perfiles`** con ese UUID, el `rol` y el FK correcto.

### Reglas de `perfiles` (CHECK)

| `rol`     | `cliente_id` | `barbero_id` |
|-----------|--------------|--------------|
| `ADMIN`   | `NULL`       | `NULL`       |
| `BARBERO` | `NULL`       | obligatorio (UUID de `barberos`) |
| `CLIENTE` | obligatorio (UUID de `clientes`) | `NULL` |

---

## 1) Barberos, servicios y clientes (SQL Editor o Table Editor)

Puedes usar **Table Editor** en el dashboard o pegar en **SQL Editor**:

```sql
-- Barberos
INSERT INTO public.barberos (nombre, porcentaje, cortes_realizados, activo)
VALUES ('Kevin Barbero', 50.00, 0, true)
RETURNING id, nombre;

-- Servicios (duración: intervalo)
INSERT INTO public.servicios (nombre, precio, duracion, activo)
VALUES
  ('Corte VIP', 25.00, INTERVAL '45 minutes', true),
  ('Barba', 15.00, INTERVAL '30 minutes', true);

-- Clientes
INSERT INTO public.clientes (nombre, email, rango, cortes, proximos, notas)
VALUES
  ('Jorge Cliente', 'jorge@ejemplo.com', 'PLATA', 0, 5, '')
RETURNING id, nombre;
```

Anota los **UUID** que devuelve `RETURNING id` si los vas a usar en `perfiles`.

---

## 2) Usuario administrador

1. **Authentication → Users → Add user**  
   - Email + contraseña, o “Send magic link” según prefieras.  
2. Copia el **User UID** (UUID).
3. En **SQL Editor**:

```sql
INSERT INTO public.perfiles (id, rol)
VALUES ('PEGA_AQUI_EL_UUID_DE_AUTH_USERS', 'ADMIN');
```

No pongas `cliente_id` ni `barbero_id` (deben ser `NULL` para admin).

---

## 3) Usuario barbero

1. Asegúrate de tener la fila en **`barberos`** y su `id` (UUID).
2. Crea el usuario en **Authentication** (email del barbero).
3. Copia su **User UID**.

```sql
INSERT INTO public.perfiles (id, rol, barbero_id)
VALUES (
  'UUID_DEL_USUARIO_AUTH',
  'BARBERO',
  'UUID_DE_LA_FILA_EN_public.barberos'
);
```

---

## 4) Usuario cliente

1. Fila en **`clientes`** con su `id`.
2. Usuario en **Authentication**.
3. Perfil:

```sql
INSERT INTO public.perfiles (id, rol, cliente_id)
VALUES (
  'UUID_DEL_USUARIO_AUTH',
  'CLIENTE',
  'UUID_DE_LA_FILA_EN_public.clientes'
);
```

---

## 5) Citas (cuando toque)

Las citas exigen `barbero_id`, `rango_tiempo` (`tstzrange`), y **cliente o invitado** (`cliente_id` o `nombre_invitado`). Lo habitual es construir el rango en UTC, por ejemplo:

```sql
INSERT INTO public.citas (
  barbero_id,
  cliente_id,
  rango_tiempo,
  pedido_cliente,
  estado,
  monto,
  metodo_pago
)
VALUES (
  'uuid-barbero',
  'uuid-cliente',
  tstzrange(
    '2026-03-20 15:00:00+00'::timestamptz,
    '2026-03-20 15:45:00+00'::timestamptz,
    '[)'
  ),
  'Fade bajo',
  'PENDIENTE',
  25.00,
  'EFECTIVO'
);
```

(Las líneas del carrito van en **`cita_detalles`** si usas varios servicios por cita.)

---

## Tu front React hoy

- La página **`/`** lista **`barberos`** con el cliente Supabase (`src/supabase.js`).
- **`/login`** usa **Supabase Auth** (`signInWithPassword`) y lee **`perfiles`** para el rol; redirige a `/admin`, `/barbero` o `/cliente`.

Si el usuario existe en **Authentication** pero **no** tiene fila en **`perfiles`**, verá un error y la sesión se cierra.

---

## Si algo falla por RLS

Las políticas RLS están en **`citas`**, **`perfiles`** y **`auditoria_citas`**. La tabla **`barberos`** no tiene RLS en la migración actual, así que el **anon key** desde el front puede hacer `SELECT` en `barberos` sin usuario logueado. Si más adelante añades RLS a más tablas, revisa políticas para `anon` / usuarios autenticados.
