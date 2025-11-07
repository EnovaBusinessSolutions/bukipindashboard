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

interface AsientoDepreciacion {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string;
  detalle_asientos: DetalleAsiento[];
}

export const useAsientosDepreciacion = (inversionId?: string) => {
  return useQuery({
    queryKey: ["asientos-depreciacion", inversionId],
    queryFn: async () => {
      if (!inversionId) return [];

      // Buscar asientos que coincidan con el patrón DEP-{inversionId}-
      const numeroAsientoPattern = `DEP-${inversionId}-%`;

      const { data, error } = await supabase
        .from("asientos_contables")
        .select(`
          id,
          numero_asiento,
          descripcion,
          fecha,
          detalle_asientos (
            id,
            cuenta_codigo,
            debe,
            haber,
            descripcion
          )
        `)
        .like("numero_asiento", numeroAsientoPattern)
        .order("fecha", { ascending: false });

      if (error) {
        console.error("Error fetching asientos depreciacion:", error);
        return [];
      }

      // Obtener nombres de cuentas para todos los asientos
      if (data && data.length > 0) {
        const cuentasCodigos = new Set<string>();
        data.forEach((asiento: any) => {
          asiento.detalle_asientos?.forEach((d: any) => {
            cuentasCodigos.add(d.cuenta_codigo);
          });
        });

        const { data: cuentas } = await supabase
          .from("cuentas")
          .select("codigo, nombre")
          .in("codigo", Array.from(cuentasCodigos));

        const cuentasMap = new Map(cuentas?.map(c => [c.codigo, c.nombre]) || []);
        
        // Agregar nombres de cuentas a cada detalle
        data.forEach((asiento: any) => {
          if (asiento.detalle_asientos) {
            asiento.detalle_asientos = asiento.detalle_asientos.map((d: any) => ({
              ...d,
              cuenta: {
                nombre: cuentasMap.get(d.cuenta_codigo) || d.cuenta_codigo
              }
            }));
          }
        });
      }

      return data as AsientoDepreciacion[];
    },
    enabled: !!inversionId,
  });
};
