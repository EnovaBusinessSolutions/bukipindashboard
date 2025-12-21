// @ts-nocheck
export {}; // evita que TS trate el archivo como script global

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function handler(req: Request): Response {
  // Preflight CORS
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return new Response(
    JSON.stringify({
      ok: false,
      error:
        "[MIGRACIÓN] cancelar-transaccion-capital (Supabase Function) fue deshabilitada. Usa el endpoint del backend (/api/capital/... o /api/asientos/... ).",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// En runtime (Supabase Edge Functions) Deno existe.
// En tu proyecto TS local NO, por eso lo declaramos.
declare const Deno: any;
Deno.serve(handler);
