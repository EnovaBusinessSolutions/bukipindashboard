import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useDepreciacionesReales = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["depreciaciones-reales", user?.id],
    queryFn: async () => {
      if (!user?.id) return {};

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
        .eq("user_id", user.id)
        .like("numero_asiento", "DEP-%")
        .order("fecha", { ascending: false });

      if (error) {
        console.error("Error fetching depreciaciones reales:", error);
        return {};
      }

      // Agrupar depreciaciones por inversión ID
      const depreciacionesPorInversion: Record<string, number> = {};

      asientos?.forEach((asiento: any) => {
        // Extraer ID de inversión del numero_asiento: DEP-{inversionId}-YYYYMM
        const match = asiento.numero_asiento.match(/DEP-([a-f0-9-]+)-\d{6}/);
        if (!match) return;

        const inversionId = match[1];
        
        // Sumar depreciación de cuenta 5109
        const montoDepreciacion = asiento.detalle_asientos
          ?.filter((d: any) => d.cuenta_codigo === '5109')
          .reduce((sum: number, d: any) => sum + d.debe, 0) || 0;

        if (!depreciacionesPorInversion[inversionId]) {
          depreciacionesPorInversion[inversionId] = 0;
        }
        depreciacionesPorInversion[inversionId] += montoDepreciacion;
      });

      return depreciacionesPorInversion;
    },
    enabled: !!user?.id,
  });
};
