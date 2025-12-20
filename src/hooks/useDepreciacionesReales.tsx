import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type DepreciacionesRealesResult = {
  depreciacionesPorInversion: Record<string, number>;
  periodosRegistrados: Record<string, Set<string>>;
};

export const useDepreciacionesReales = () => {
  return useQuery({
    queryKey: ["depreciaciones-reales"],
    queryFn: async (): Promise<DepreciacionesRealesResult> => {
      /**
       * Endpoint esperado:
       * GET /api/asientos/depreciaciones
       * Response (ideal):
       * { data: [{ id, numero_asiento, fecha, detalle_asientos:[{cuenta_codigo,debe,haber}] }] }
       *
       * Nota: soporta también payload plano (sin data) por compat.
       */
      try {
        const json = await apiFetch("/api/asientos/depreciaciones", { method: "GET" });
        const asientos = (json?.data ?? json ?? []) as any[];

        const depreciacionesPorInversion: Record<string, number> = {};
        const periodosRegistrados: Record<string, Set<string>> = {};

        asientos.forEach((asiento: any) => {
          // Extraer ID de inversión y período del numero_asiento: DEP-{inversionId}-YYYYMM
          const numero = String(asiento?.numero_asiento ?? "");
          const match = numero.match(/DEP-([a-f0-9-]+)-(\d{6})/i);
          if (!match) return;

          const inversionId = match[1];
          const periodoYYYYMM = match[2]; // YYYYMM

          // Sumar depreciación de cuenta 5109 (debe)
          const detalles = asiento?.detalle_asientos || [];
          const montoDepreciacion =
            detalles
              .filter((d: any) => String(d?.cuenta_codigo) === "5109")
              .reduce((sum: number, d: any) => sum + (Number(d?.debe) || 0), 0) || 0;

          depreciacionesPorInversion[inversionId] =
            (depreciacionesPorInversion[inversionId] || 0) + montoDepreciacion;

          if (!periodosRegistrados[inversionId]) {
            periodosRegistrados[inversionId] = new Set<string>();
          }
          periodosRegistrados[inversionId].add(periodoYYYYMM);
        });

        return { depreciacionesPorInversion, periodosRegistrados };
      } catch (error) {
        console.error("Error fetching depreciaciones reales:", error);
        return { depreciacionesPorInversion: {}, periodosRegistrados: {} };
      }
    },
  });
};
