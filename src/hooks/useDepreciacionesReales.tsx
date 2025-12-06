import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDepreciacionesReales = () => {
  return useQuery({
    queryKey: ["depreciaciones-reales"],
    queryFn: async () => {
      // Obtener TODOS los asientos de depreciación DEP-*
      const { data: asientos, error } = await supabase
        .from("asientos_contables")
        .select(`
          id,
          numero_asiento,
          fecha,
          detalle_asientos (
            cuenta_codigo,
            debe,
            haber
          )
        `)
        .like("numero_asiento", "DEP-%")
        .order("fecha", { ascending: false });

      if (error) {
        console.error("Error fetching depreciaciones reales:", error);
        return {};
      }

      // Agrupar depreciaciones por inversión ID y períodos registrados
      const depreciacionesPorInversion: Record<string, number> = {};
      const periodosRegistrados: Record<string, Set<string>> = {};

      asientos?.forEach((asiento: any) => {
        // Extraer ID de inversión y período del numero_asiento: DEP-{inversionId}-YYYYMM
        const match = asiento.numero_asiento.match(/DEP-([a-f0-9-]+)-(\d{6})/);
        if (!match) return;

        const inversionId = match[1];
        const periodoYYYYMM = match[2]; // YYYYMM
        
        // Sumar depreciación de cuenta 5109
        const montoDepreciacion = asiento.detalle_asientos
          ?.filter((d: any) => d.cuenta_codigo === '5109')
          .reduce((sum: number, d: any) => sum + d.debe, 0) || 0;

        if (!depreciacionesPorInversion[inversionId]) {
          depreciacionesPorInversion[inversionId] = 0;
        }
        depreciacionesPorInversion[inversionId] += montoDepreciacion;

        // Registrar el período como depreciado
        if (!periodosRegistrados[inversionId]) {
          periodosRegistrados[inversionId] = new Set();
        }
        periodosRegistrados[inversionId].add(periodoYYYYMM);
      });

      return { depreciacionesPorInversion, periodosRegistrados };
    },
  });
};
