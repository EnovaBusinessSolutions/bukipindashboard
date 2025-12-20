// bukipin-dashboard/src/integrations/supabase/client.ts
export const supabase: any = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "[MIGRACIÓN] Se intentó usar Supabase. Reemplaza este acceso por apiFetch() hacia el backend."
      );
    },
  }
);
