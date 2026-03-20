import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

type Body = {
  email?: string;
  password?: string;
  nombre?: string;
  especialidad?: string | null;
  foto_url?: string | null;
  porcentaje?: number;
  activo?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido", code: "METHOD" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(
      { error: "Configuración del servidor incompleta.", code: "CONFIG" },
      500,
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "No autorizado.", code: "UNAUTHORIZED" }, 401);
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
      { error: "Solo un administrador puede crear barberos.", code: "FORBIDDEN" },
      403,
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido.", code: "BAD_REQUEST" }, 400);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const nombre = String(body.nombre ?? "").trim();
  const especialidadRaw = body.especialidad;
  const especialidad =
    especialidadRaw == null || especialidadRaw === ""
      ? null
      : String(especialidadRaw).trim() || null;
  const foto_url =
    body.foto_url == null || body.foto_url === ""
      ? null
      : String(body.foto_url).trim() || null;

  let porcentaje = Number(body.porcentaje);
  if (!Number.isFinite(porcentaje)) porcentaje = 50;
  if (porcentaje < 0 || porcentaje > 100) {
    return json(
      { error: "La comisión debe estar entre 0 y 100.", code: "VALIDATION" },
      400,
    );
  }

  const activo = body.activo !== false;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Correo electrónico no válido.", code: "VALIDATION" }, 400);
  }
  if (password.length < 6) {
    return json(
      { error: "La contraseña debe tener al menos 6 caracteres.", code: "VALIDATION" },
      400,
    );
  }
  if (!nombre) {
    return json({ error: "El nombre es obligatorio.", code: "VALIDATION" }, 400);
  }
  if (foto_url && !/^https?:\/\//i.test(foto_url)) {
    return json(
      { error: "La foto debe ser una URL http(s).", code: "VALIDATION" },
      400,
    );
  }

  let barberoId: string | null = null;
  let newUserId: string | null = null;

  try {
    const { data: barberoRow, error: barberoErr } = await admin
      .from("barberos")
      .insert({
        nombre,
        foto_url,
        especialidad,
        porcentaje,
        cortes_realizados: 0,
        activo,
      })
      .select("id")
      .single();

    if (barberoErr) {
      console.error("insert barberos", barberoErr);
      return json(
        { error: barberoErr.message || "No se pudo crear el barbero.", code: "DB" },
        500,
      );
    }
    barberoId = barberoRow.id;

    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nombre },
    });

    if (authErr || !authData?.user) {
      await admin.from("barberos").delete().eq("id", barberoId);
      const msg = authErr?.message?.toLowerCase() ?? "";
      if (
        msg.includes("already been registered") ||
        msg.includes("already registered") ||
        msg.includes("duplicate") ||
        authErr?.status === 422
      ) {
        return json(
          { error: "Ya existe una cuenta con ese correo.", code: "EMAIL_EXISTS" },
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
      rol: "BARBERO",
      barbero_id: barberoId,
      cliente_id: null,
    });

    if (perfilInsertErr) {
      await admin.auth.admin.deleteUser(newUserId);
      await admin.from("barberos").delete().eq("id", barberoId);
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
      barbero_id: barberoId,
      message: "Barbero creado con acceso al sistema.",
    });
  } catch (e) {
    console.error("crear-barbero", e);
    if (newUserId) {
      try {
        await admin.auth.admin.deleteUser(newUserId);
      } catch {
        /* ignore */
      }
    }
    if (barberoId) {
      try {
        await admin.from("barberos").delete().eq("id", barberoId);
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
