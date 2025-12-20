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

interface AsientoCapital {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string; // "YYYY-MM-DD"
  created_at: string;
  detalle_asientos: DetalleAsiento[];
}

type AsientoCapitalApi = {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string;
  created_at: string;
  detalle_asientos: Array<{
    id: string;
    cuenta_codigo: string;
    debe: number | string | null;
    haber: number | string | null;
    descripcion: string | null;
  }>;
};

export const useAsientosCapital = (transaccionId?: string) => {
  return useQuery({
    queryKey: ["asientos-capital", transaccionId],
    queryFn: async (): Promise<AsientoCapital | null> => {
      if (!transaccionId) return null;

      // 1) Traer el asiento CAP-{transaccionId} (ya incluye detalle_asientos)
      // Backend recomendado: resolver todo con populate/lookup.
      const asientoJson = await apiFetch(
        `/api/contabilidad/asientos/capital/${encodeURIComponent(transaccionId)}`,
        { method: "GET" }
      );

      const asiento: AsientoCapitalApi | null = (asientoJson as any)?.data ?? asientoJson ?? null;
      if (!asiento) return null;

      // 2) Resolver nombres de cuentas para los códigos usados
      const detalles = asiento.detalle_asientos || [];
      const codigos = Array.from(new Set(detalles.map((d) => d.cuenta_codigo).filter(Boolean)));

      if (codigos.length === 0) {
        return {
          ...asiento,
          detalle_asientos: [],
        } as AsientoCapital;
      }

      // Endpoint catálogo (puede aceptar filter por codigos)
      const cuentasJson = await apiFetch(
        `/api/catalogos/cuentas?codes=${encodeURIComponent(codigos.join(","))}&fields=codigo,nombre`,
        { method: "GET" }
      );

      const cuentas: Array<{ codigo: string; nombre: string }> =
        (cuentasJson as any)?.data ?? cuentasJson ?? [];

      const cuentasMap = new Map(cuentas.map((c) => [c.codigo, c.nombre]));

      // 3) Adjuntar nombre de cuenta a cada detalle
      const asientoConCuentas: AsientoCapital = {
        id: asiento.id,
        numero_asiento: asiento.numero_asiento,
        descripcion: asiento.descripcion,
        fecha: asiento.fecha,
        created_at: asiento.created_at,
        detalle_asientos: detalles.map((d) => ({
          id: d.id,
          cuenta_codigo: d.cuenta_codigo,
          debe: Number(d.debe) || 0,
          haber: Number(d.haber) || 0,
          descripcion: d.descripcion || "",
          cuenta: {
            nombre: cuentasMap.get(d.cuenta_codigo) || d.cuenta_codigo,
          },
        })),
      };

      return asientoConCuentas;
    },
    enabled: !!transaccionId,
  });
};
