import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DetalleAsiento {
  id: string;
  cuenta_codigo: string;
  debe: number;
  haber: number;
  descripcion: string;
  cuenta?: {
    nombre: string;
  };
}

interface AsientoCapital {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string;
  created_at: string;
  detalle_asientos: DetalleAsiento[];
}

export const useAsientosCapital = (transaccionId?: string) => {
  return useQuery({
    queryKey: ["asientos-capital", transaccionId],
    queryFn: async () => {
      if (!transaccionId) return null;

      // Buscar el asiento con patrón CAP-{transaccionId}
      const { data, error } = await supabase
        .from("asientos_contables")
        .select(`
          id,
          numero_asiento,
          descripcion,
          fecha,
          created_at,
          detalle_asientos (
            id,
            cuenta_codigo,
            debe,
            haber,
            descripcion
          )
        `)
        .eq("numero_asiento", `CAP-${transaccionId}`)
        .maybeSingle();

      if (error) {
        console.error("Error fetching asiento capital:", error);
        return null;
      }

      if (!data) {
        return null;
      }

      // Obtener nombres de cuentas
      const detalles = data.detalle_asientos || [];
      const cuentasCodigos = [...new Set(detalles.map((d: any) => d.cuenta_codigo))];
      
      const { data: cuentas } = await supabase
        .from("cuentas")
        .select("codigo, nombre")
        .in("codigo", cuentasCodigos);

      const cuentasMap = new Map(cuentas?.map(c => [c.codigo, c.nombre]) || []);
      
      // Agregar nombres de cuentas
      const asientoConCuentas = {
        ...data,
        detalle_asientos: detalles.map((d: any) => ({
          ...d,
          cuenta: {
            nombre: cuentasMap.get(d.cuenta_codigo) || d.cuenta_codigo
          }
        }))
      };

      return asientoConCuentas as AsientoCapital;
    },
    enabled: !!transaccionId,
  });
};
