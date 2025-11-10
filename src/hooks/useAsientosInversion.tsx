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
  created_at: string;
  detalle_asientos: DetalleAsiento[];
}

export const useAsientosInversion = (inversionId?: string, tipoTransaccion?: string) => {
  return useQuery({
    queryKey: ["asientos-inversion", inversionId, tipoTransaccion],
    queryFn: async () => {
      if (!inversionId) return null;

      // Determinar el prefijo según el tipo de transacción
      const prefijo = (tipoTransaccion === 'baja' || tipoTransaccion === 'venta') ? 'BAJA' : 'INV';

      // Buscar TODOS los asientos que empiecen con el prefijo
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
        .like("numero_asiento", `${prefijo}-${inversionId}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching asientos:", error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Obtener nombres de cuentas para todos los asientos
      const todosLosDetalles = data.flatMap((asiento: any) => asiento.detalle_asientos || []);
      const cuentasCodigos = [...new Set(todosLosDetalles.map((d: any) => d.cuenta_codigo))];
      
      const { data: cuentas } = await supabase
        .from("cuentas")
        .select("codigo, nombre")
        .in("codigo", cuentasCodigos);

      const cuentasMap = new Map(cuentas?.map(c => [c.codigo, c.nombre]) || []);
      
      // Agregar nombres de cuentas a todos los asientos
      const asientosConCuentas = data.map((asiento: any) => ({
        ...asiento,
        detalle_asientos: asiento.detalle_asientos?.map((d: any) => ({
          ...d,
          cuenta: {
            nombre: cuentasMap.get(d.cuenta_codigo) || d.cuenta_codigo
          }
        })) || []
      }));

      return asientosConCuentas as AsientoInversion[];
    },
    enabled: !!inversionId,
  });
};
