// @ts-nocheck
export {}; // evita errores de "archivo global" en TS

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function handler(req: Request): Response {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return new Response(
    JSON.stringify({
      ok: false,
      error:
        "[MIGRACIÓN] cancelar-egreso (Supabase Function) fue deshabilitada. Usa el endpoint del backend (/api/egresos/... o /api/cxp/...).",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// En Supabase Edge Functions existe globalThis.Deno en runtime.
// En tu proyecto Vite/TS NO existe, por eso lo declaramos como "any".
declare const Deno: any;

Deno.serve(handler);
