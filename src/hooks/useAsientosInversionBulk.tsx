import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useAsientosInversionBulk = () => {
  return useQuery({
    queryKey: ["asientos-inversion-bulk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asientos_contables")
        .select("numero_asiento")
        .like("numero_asiento", "INV-%");

      if (error) {
        console.error("Error fetching asientos:", error);
        return new Set<string>();
      }

      // Extraer IDs de inversión de los números de asiento (formato: INV-{uuid})
      const inversionIds = data
        .map(a => a.numero_asiento.replace("INV-", ""))
        .filter(id => id.length > 0);

      return new Set(inversionIds);
    },
  });
};
