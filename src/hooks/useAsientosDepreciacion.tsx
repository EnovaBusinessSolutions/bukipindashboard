import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

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
  fecha: string; // YYYY-MM-DD
  detalle_asientos: DetalleAsiento[];
}

type AsientoDepreciacionApi = {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string;
  detalle_asientos?: Array<{
    id: string;
    cuenta_codigo: string;
    debe: number | string | null;
    haber: number | string | null;
    descripcion: string | null;
  }>;
};

export const useAsientosDepreciacion = (inversionId?: string) => {
  return useQuery({
    queryKey: ["asientos-depreciacion", inversionId],
    queryFn: async (): Promise<AsientoDepreciacion[]> => {
      if (!inversionId) return [];

      // 1) Traer asientos DEP-{inversionId}-* con detalles
      // (Backend recomendado: ya filtra por owner=req.user._id)
      const asientosJson = await apiFetch(
        `/api/contabilidad/asientos/depreciacion/${encodeURIComponent(inversionId)}`,
        { method: "GET" }
      );

      const asientos: AsientoDepreciacionApi[] =
        (asientosJson as any)?.data ?? asientosJson ?? [];

      if (!Array.isArray(asientos) || asientos.length === 0) return [];

      // 2) Recolectar códigos únicos de cuentas
      const codigosSet = new Set<string>();
      for (const asiento of asientos) {
        for (const d of asiento.detalle_asientos || []) {
          if (d?.cuenta_codigo) codigosSet.add(d.cuenta_codigo);
        }
      }
      const codigos = Array.from(codigosSet);

      // 3) Cargar catálogo de cuentas (solo las necesarias)
      let cuentasMap = new Map<string, string>();
      if (codigos.length > 0) {
        const cuentasJson = await apiFetch(
          `/api/catalogos/cuentas?codes=${encodeURIComponent(codigos.join(","))}&fields=codigo,nombre`,
          { method: "GET" }
        );

        const cuentas: Array<{ codigo: string; nombre: string }> =
          (cuentasJson as any)?.data ?? cuentasJson ?? [];

        cuentasMap = new Map(cuentas.map((c) => [c.codigo, c.nombre]));
      }

      // 4) Adjuntar nombre de cuenta y normalizar números
      const normalizados: AsientoDepreciacion[] = asientos.map((asiento) => ({
        id: asiento.id,
        numero_asiento: asiento.numero_asiento,
        descripcion: asiento.descripcion,
        fecha: asiento.fecha,
        detalle_asientos: (asiento.detalle_asientos || []).map((d) => ({
          id: d.id,
          cuenta_codigo: d.cuenta_codigo,
          debe: Number(d.debe) || 0,
          haber: Number(d.haber) || 0,
          descripcion: d.descripcion || "",
          cuenta: {
            nombre: cuentasMap.get(d.cuenta_codigo) || d.cuenta_codigo,
          },
        })),
      }));

      // Si el backend no ordena, aseguramos orden por fecha desc aquí:
      normalizados.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

      return normalizados;
    },
    enabled: !!inversionId,
  });
};
