// @ts-nocheck
export {}; // evita redeclaraciones en el scope global

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function handler(req: Request): Response {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return new Response(
    JSON.stringify({
      ok: false,
      error:
        "[MIGRACIÓN] registrar-egreso (Supabase Function) fue deshabilitada. Usa el endpoint del backend (por ejemplo POST /api/egresos).",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// En runtime (Supabase Edge Functions) Deno sí existe.
// En tu TS local no, por eso solo lo declaramos.
declare const Deno: any;
Deno.serve(handler);
