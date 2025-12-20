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

interface AsientoInversion {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string; // YYYY-MM-DD
  created_at: string; // ISO
  detalle_asientos: DetalleAsiento[];
}

type AsientoInversionApi = {
  id: string;
  numero_asiento: string;
  descripcion: string | null;
  fecha: string;
  created_at: string;
  detalle_asientos?: Array<{
    id: string;
    cuenta_codigo: string;
    debe: number | string | null;
    haber: number | string | null;
    descripcion: string | null;
  }>;
};

export const useAsientosInversion = (inversionId?: string, tipoTransaccion?: string) => {
  return useQuery({
    queryKey: ["asientos-inversion", inversionId, tipoTransaccion],
    queryFn: async (): Promise<AsientoInversion[] | null> => {
      if (!inversionId) return null;

      // Determinar el prefijo según el tipo de transacción
      const prefijo = tipoTransaccion === "baja" || tipoTransaccion === "venta" ? "BAJA" : "INV";

      // 1) Traer asientos por prefijo + id (INV-{id}% o BAJA-{id}%)
      const asientosJson = await apiFetch(
        `/api/contabilidad/asientos/inversion/${encodeURIComponent(inversionId)}?prefijo=${encodeURIComponent(prefijo)}`,
        { method: "GET" }
      );

      const data: AsientoInversionApi[] = (asientosJson as any)?.data ?? asientosJson ?? [];

      if (!Array.isArray(data) || data.length === 0) return null;

      // 2) Obtener códigos únicos de cuentas
      const todosLosDetalles = data.flatMap((a) => a.detalle_asientos || []);
      const cuentasCodigos = Array.from(
        new Set(todosLosDetalles.map((d) => d?.cuenta_codigo).filter(Boolean) as string[])
      );

      // 3) Cargar nombres de cuentas (solo las necesarias)
      let cuentasMap = new Map<string, string>();
      if (cuentasCodigos.length > 0) {
        const cuentasJson = await apiFetch(
          `/api/catalogos/cuentas?codes=${encodeURIComponent(cuentasCodigos.join(","))}&fields=codigo,nombre`,
          { method: "GET" }
        );
        const cuentas: Array<{ codigo: string; nombre: string }> =
          (cuentasJson as any)?.data ?? cuentasJson ?? [];
        cuentasMap = new Map(cuentas.map((c) => [c.codigo, c.nombre]));
      }

      // 4) Adjuntar nombres + normalizar números
      const asientosConCuentas: AsientoInversion[] = data.map((asiento) => ({
        id: asiento.id,
        numero_asiento: asiento.numero_asiento,
        descripcion: asiento.descripcion || "",
        fecha: asiento.fecha,
        created_at: asiento.created_at,
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

      // Si el backend no ordena, ordenamos aquí por created_at desc
      asientosConCuentas.sort((a, b) =>
        a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
      );

      return asientosConCuentas;
    },
    enabled: !!inversionId,
  });
};
