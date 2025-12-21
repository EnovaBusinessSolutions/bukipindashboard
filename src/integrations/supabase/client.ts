// bukipin-dashboard/src/integrations/supabase/client.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

function migrationError(path: string, prop?: PropertyKey) {
  const accessed = prop ? `${path}.${String(prop)}` : path;

  return new Error(
    [
      `[MIGRACIÓN] Se intentó usar Supabase (${accessed}).`,
      `Reemplaza este acceso por apiFetch() hacia el backend.`,
      ``,
      `Tip: busca en el archivo que truena y sustituye supabase.* por endpoints /api/*`,
    ].join("\n")
  );
}

/**
 * Proxy recursivo:
 * - Si alguien hace supabase.from(...), truena en el "get" mostrando "supabase.from"
 * - Si alguien intenta encadenar cosas raras, también truena con el path correcto.
 */
function makeThrowProxy(path = "supabase"): any {
  const target = function () {
    // Si alguien intenta "llamar" a supabase como función
    throw migrationError(path);
  };

  return new Proxy(target as any, {
    get(_t, prop) {
      // Algunas herramientas acceden a símbolos internos; igual queremos tronar para detectar usos.
      throw migrationError(path, prop);
    },
    apply() {
      throw migrationError(path);
    },
    set(_t, prop) {
      throw migrationError(path, prop);
    },
  });
}

export const supabase: any = makeThrowProxy("supabase");
export default supabase;
