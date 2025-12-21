// @ts-nocheck
export {}; // evita errores de "archivo global" en TS

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function handler(req: Request): Response {
  // Preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Deshabilitada por migración
  return new Response(
    JSON.stringify({
      ok: false,
      error:
        "[MIGRACIÓN] cancelar-ingreso (Supabase Function) fue deshabilitada. Usa el endpoint del backend (/api/ingresos/... o /api/cxc/... ).",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// En Supabase Edge Functions sí existe globalThis.Deno.
// En tu TS local NO, por eso lo declaramos.
declare const Deno: any;
Deno.serve(handler);
