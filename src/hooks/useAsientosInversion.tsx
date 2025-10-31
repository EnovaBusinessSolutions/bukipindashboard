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

interface AsientoInversion {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string;
  detalle_asientos: DetalleAsiento[];
}

export const useAsientosInversion = (inversionId?: string) => {
  return useQuery({
    queryKey: ["asientos-inversion", inversionId],
    queryFn: async () => {
      if (!inversionId) return null;

      const numeroAsiento = `INV-${inversionId}`;

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
        .eq("numero_asiento", numeroAsiento)
        .single();

      if (error) {
        console.error("Error fetching asiento:", error);
        return null;
      }

      // Obtener nombres de cuentas
      if (data?.detalle_asientos) {
        const cuentasCodigos = data.detalle_asientos.map((d: any) => d.cuenta_codigo);
        const { data: cuentas } = await supabase
          .from("cuentas")
          .select("codigo, nombre")
          .in("codigo", cuentasCodigos);

        const cuentasMap = new Map(cuentas?.map(c => [c.codigo, c.nombre]) || []);
        
        data.detalle_asientos = data.detalle_asientos.map((d: any) => ({
          ...d,
          cuenta: {
            nombre: cuentasMap.get(d.cuenta_codigo) || d.cuenta_codigo
          }
        }));
      }

      return data as AsientoInversion;
    },
    enabled: !!inversionId,
  });
};
