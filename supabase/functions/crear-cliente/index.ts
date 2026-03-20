import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Edge Function: crear-cliente
 *
 * Body JSON (flexible, mayúsculas/minúsculas):
 * - Nombre | nombre (obligatorio)
 * - Correo | correo | email (obligatorio)
 * - password | contraseña (opcional): si viene y tiene ≥6 caracteres, crea usuario Auth + fila en perfiles (CLIENTE)
 *
 * Seguridad: Bearer JWT obligatorio; solo usuarios con rol ADMIN en public.perfiles.
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Lee claves en distintos formatos (formulario en español o API en inglés). */
function pickString(
  raw: Record<string, unknown>,
  keys: string[],
): string {
  for (const k of keys) {
    const v = raw[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
    const lower = Object.keys(raw).find((x) => x.toLowerCase() === k.toLowerCase());
    if (lower != null) {
      const vv = raw[lower];
      if (vv != null && String(vv).trim() !== "") return String(vv).trim();
    }
  }
  return "";
}

/** Opcional: notificar a Spring Boot tras insertar en Supabase. Define el secret SPRING_CLIENTE_WEBHOOK_URL con la URL del endpoint (POST JSON). */
async function notifySpringBootIfConfigured(payload: {
  cliente_id: string;
  nombre: string;
  email: string;
}): Promise<void> {
  const url = Deno.env.get("SPRING_CLIENTE_WEBHOOK_URL")?.trim();
  if (!url) return;
  const secret = Deno.env.get("SPRING_WEBHOOK_SECRET")?.trim();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (secret) headers["X-Webhook-Secret"] = secret;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        Nombre: payload.nombre,
        Correo: payload.email,
        clienteId: payload.cliente_id,
      }),
    });
    if (!res.ok) {
      console.warn("SPRING_CLIENTE_WEBHOOK_URL respondió", res.status, await res.text());
    }
  } catch (e) {
    console.warn("notifySpringBootIfConfigured", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido", code: "METHOD" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(
      {
        error:
          "Configuración incompleta (SUPABASE_URL, SUPABASE_ANON_KEY y SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY).",
        code: "CONFIG",
      },
      500,
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Falta Authorization: Bearer <access_token>", code: "UNAUTHORIZED" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: caller },
    error: callerErr,
  } = await userClient.auth.getUser();

  if (callerErr || !caller) {
    return json({ error: "Sesión inválida.", code: "UNAUTHORIZED" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: perfilAdmin, error: perfilErr } = await admin
    .from("perfiles")
    .select("rol")
    .eq("id", caller.id)
    .maybeSingle();

  if (perfilErr || perfilAdmin?.rol !== "ADMIN") {
    return json(
      { error: "Solo un administrador puede crear clientes.", code: "FORBIDDEN" },
      403,
    );
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "JSON inválido.", code: "BAD_REQUEST" }, 400);
  }

  const nombre = pickString(raw, ["Nombre", "nombre", "name", "full_name"]);
  const emailRaw = pickString(raw, ["Correo", "correo", "email", "Email"]);
  const email = emailRaw.toLowerCase();
  const password = pickString(raw, ["password", "contraseña", "Password", "Contraseña"]);

  const telefonoRaw = pickString(raw, ["telefono", "teléfono", "Telefono", "phone"]);
  const telefono = telefonoRaw === "" ? null : telefonoRaw;
  const notas = pickString(raw, ["notas", "Notas"]);

  let rango = pickString(raw, ["rango", "Rango"]).toUpperCase() || "BRONCE";
  if (!["BRONCE", "PLATA", "ORO"].includes(rango)) rango = "BRONCE";

  let proximos = Number(raw["proximos"] ?? raw["Proximos"]);
  if (!Number.isFinite(proximos) || proximos < 1) proximos = 5;

  let cortes = Number(raw["cortes"] ?? raw["Cortes"]);
  if (!Number.isFinite(cortes) || cortes < 0) cortes = 0;

  let ausencias = Number(raw["ausencias"] ?? raw["Ausencias"]);
  if (!Number.isFinite(ausencias) || ausencias < 0) ausencias = 0;

  const activo = raw["activo"] !== false && raw["Activo"] !== false;

  if (!nombre) {
    return json({ error: "El campo Nombre es obligatorio.", code: "VALIDATION" }, 400);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "El campo Correo es obligatorio y debe ser un email válido.", code: "VALIDATION" }, 400);
  }

  const withPortalAccess = password.length >= 6;

  if (password.length > 0 && password.length < 6) {
    return json(
      { error: "Si indicas contraseña, debe tener al menos 6 caracteres.", code: "VALIDATION" },
      400,
    );
  }

  let clienteId: string | null = null;
  let newUserId: string | null = null;

  try {
    const { data: clienteRow, error: clienteErr } = await admin
      .from("clientes")
      .insert({
        nombre,
        email,
        telefono,
        notas,
        rango,
        proximos,
        cortes,
        ausencias,
        activo,
      })
      .select("id")
      .single();

    if (clienteErr) {
      console.error("insert clientes", clienteErr);
      const msg = clienteErr.message?.toLowerCase() ?? "";
      if (msg.includes("duplicate") || clienteErr.code === "23505") {
        return json(
          { error: "Ya existe un cliente con ese correo.", code: "EMAIL_EXISTS" },
          409,
        );
      }
      return json(
        { error: clienteErr.message || "No se pudo insertar en clientes.", code: "DB" },
        500,
      );
    }
    clienteId = clienteRow.id;

    await notifySpringBootIfConfigured({
      cliente_id: clienteId,
      nombre,
      email,
    });

    if (!withPortalAccess) {
      return json({
        ok: true,
        cliente_id: clienteId,
        message: "Cliente registrado en la base de datos (sin acceso al portal).",
      });
    }

    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nombre },
    });

    if (authErr || !authData?.user) {
      await admin.from("clientes").delete().eq("id", clienteId);
      const msg = authErr?.message?.toLowerCase() ?? "";
      if (
        msg.includes("already been registered") ||
        msg.includes("already registered") ||
        msg.includes("duplicate") ||
        authErr?.status === 422
      ) {
        return json(
          { error: "Ya existe una cuenta Auth con ese correo.", code: "AUTH_EMAIL_EXISTS" },
          409,
        );
      }
      console.error("createUser", authErr);
      return json(
        { error: authErr?.message || "No se pudo crear el usuario.", code: "AUTH" },
        400,
      );
    }

    newUserId = authData.user.id;

    const { error: perfilInsertErr } = await admin.from("perfiles").insert({
      id: newUserId,
      rol: "CLIENTE",
      cliente_id: clienteId,
      barbero_id: null,
    });

    if (perfilInsertErr) {
      await admin.auth.admin.deleteUser(newUserId);
      await admin.from("clientes").delete().eq("id", clienteId);
      console.error("insert perfiles", perfilInsertErr);
      return json(
        {
          error: perfilInsertErr.message || "No se pudo vincular el perfil.",
          code: "DB",
        },
        500,
      );
    }

    return json({
      ok: true,
      user_id: newUserId,
      cliente_id: clienteId,
      message: "Cliente creado con acceso al área «Cliente» (mismo correo y contraseña).",
    });
  } catch (e) {
    console.error("crear-cliente", e);
    if (newUserId) {
      try {
        await admin.auth.admin.deleteUser(newUserId);
      } catch {
        /* ignore */
      }
    }
    if (clienteId) {
      try {
        await admin.from("clientes").delete().eq("id", clienteId);
      } catch {
        /* ignore */
      }
    }
    return json(
      { error: e instanceof Error ? e.message : "Error interno.", code: "INTERNAL" },
      500,
    );
  }
});
