import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type AsientoNumeroApi = {
  numero_asiento: string;
};

export const useAsientosInversionBulk = () => {
  return useQuery({
    queryKey: ["asientos-inversion-bulk"],
    queryFn: async (): Promise<Set<string>> => {
      try {
        // Trae SOLO numero_asiento para asientos de inversión
        const json = await apiFetch("/api/contabilidad/asientos?prefix=INV&fields=numero_asiento", {
          method: "GET",
        });

        const rows: AsientoNumeroApi[] = (json as any)?.data ?? json ?? [];
        if (!Array.isArray(rows) || rows.length === 0) return new Set<string>();

        // Formato esperado: INV-{uuid}...
        const inversionIds = rows
          .map((a) => (a?.numero_asiento || "").trim())
          .filter(Boolean)
          .filter((num) => num.startsWith("INV-"))
          .map((num) => num.replace(/^INV-/, "")) // quita prefijo
          .map((rest) => rest.split("-DEP-")[0]) // por si algún formato extra existe
          .map((rest) => rest.split("-")[0].includes(" ") ? rest.trim() : rest) // safety
          .filter((id) => id.length > 0);

        return new Set(inversionIds);
      } catch (err) {
        console.error("Error fetching asientos inversion bulk:", err);
        return new Set<string>();
      }
    },
  });
};
