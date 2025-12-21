import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useInversiones } from "./useInversiones";
import type { InversionCapex } from "./useInversiones";
import { apiFetch } from "@/lib/api";

export interface TransaccionInversionCompleta {
  id: string;
  tipo: "alta" | "baja" | "venta" | "depreciacion";
  fecha: string;
  activo: string;
  categoria: string;
  monto?: number;
  descripcion?: string;
  motivo?: string;
  valor_venta?: number;
  inversion_id: string;
  inversion: InversionCapex;
  numero_asiento?: string;
  mes_ano?: string;
}

type AnyJson = any;

type AsientoDepreciacion = {
  id: string;
  numero_asiento: string;
  descripcion?: string | null;
  fecha: string; // ISO date
  detalle_asientos?: Array<{
    id?: string;
    cuenta_codigo: string;
    debe?: number;
    haber?: number;
    descripcion?: string | null;
  }>;
};

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

const toNumber = (v: any) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};

const toISODate = (d: Date) => d.toISOString().split("T")[0];

export const useTransaccionesInversionesConDepreciaciones = () => {
  const { inversiones, isLoading: loadingInversiones } = useInversiones();

  /**
   * ✅ Backend esperado:
   *   GET /api/asientos?tipo=depreciacion
   * o:
   *   GET /api/asientos/depreciacion
   *
   * Debe devolver:
   * [
   *  { id, numero_asiento, descripcion, fecha, detalle_asientos:[{cuenta_codigo,debe,haber,descripcion}] }
   * ]
   * o { ok:true, data:[...] }
   */
  const { data: asientosDepreciacion = [], isLoading: loadingAsientos } = useQuery({
    queryKey: ["asientos-depreciacion-all"],
    queryFn: async (): Promise<AsientoDepreciacion[]> => {
      // ✅ usa UN endpoint canonical (ajústalo si tu backend lo nombró distinto)
      const json: AnyJson = await apiFetch(`/api/asientos?tipo=depreciacion`, { method: "GET" });
      const rows = normalizeArray<AsientoDepreciacion>(json);

      // fallback de orden por fecha desc (por si backend no ordena)
      rows.sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")));
      return rows;
    },
    enabled: inversiones.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const transacciones = useMemo(() => {
    const resultado: TransaccionInversionCompleta[] = [];

    inversiones.forEach((inversion) => {
      // Alta
      resultado.push({
        id: `alta-${inversion.id}`,
        tipo: "alta",
        fecha: inversion.fecha_adquisicion,
        activo: inversion.producto_nombre,
        categoria: inversion.categoria_activo,
        monto: inversion.valor_total,
        descripcion: inversion.descripcion,
        inversion_id: inversion.id,
        inversion,
      });

      // Depreciaciones (si activo o dado de baja)
      if (inversion.estado === "activo" || inversion.estado === "dado_de_baja") {
        const asientosInversion =
          asientosDepreciacion?.filter((asiento) => {
            const num = asiento?.numero_asiento || "";
            return num.includes(inversion.id) && num.startsWith("DEP-");
          }) || [];

        asientosInversion.forEach((asiento) => {
          // Formato esperado: DEP-{id}-YYYYMM (pero tu código soporta variantes)
          const match = String(asiento.numero_asiento || "").match(/DEP-.+-(\d{4})(\d{2})/);
          const anio = match?.[1] ?? "";
          const mes = match?.[2] ?? "";

          // Fecha: último día del mes del periodo (si match), si no usar asiento.fecha
          const fechaDepreciacion = match
            ? new Date(parseInt(anio, 10), parseInt(mes, 10), 0) // último día del mes
            : new Date(asiento.fecha);

          // mes_ano "mes largo año"
          const mesAno = match
            ? new Date(parseInt(anio, 10), parseInt(mes, 10) - 1).toLocaleString("es-MX", {
                month: "long",
                year: "numeric",
              })
            : "";

          // Monto depreciación = suma debe de cuenta 5109
          const montoDepreciacion =
            asiento.detalle_asientos
              ?.filter((d) => String(d.cuenta_codigo) === "5109")
              .reduce((sum, d) => sum + toNumber(d.debe), 0) || 0;

          resultado.push({
            id: `dep-${asiento.id}`,
            tipo: "depreciacion",
            fecha: toISODate(fechaDepreciacion),
            activo: inversion.producto_nombre,
            categoria: inversion.categoria_activo,
            monto: montoDepreciacion,
            descripcion: asiento.descripcion ?? undefined,
            numero_asiento: asiento.numero_asiento,
            mes_ano: mesAno,
            inversion_id: inversion.id,
            inversion,
          });
        });
      }

      // Baja / Venta
      if (inversion.estado === "dado_de_baja" && inversion.fecha_baja) {
        resultado.push({
          id: `baja-${inversion.id}`,
          tipo: "baja",
          fecha: inversion.fecha_baja,
          activo: inversion.producto_nombre,
          categoria: inversion.categoria_activo,
          motivo: inversion.motivo_baja,
          inversion_id: inversion.id,
          inversion,
        });
      } else if (inversion.estado === "vendido" && inversion.fecha_baja) {
        resultado.push({
          id: `venta-${inversion.id}`,
          tipo: "venta",
          fecha: inversion.fecha_baja,
          activo: inversion.producto_nombre,
          categoria: inversion.categoria_activo,
          valor_venta: inversion.valor_venta,
          motivo: inversion.motivo_baja,
          inversion_id: inversion.id,
          inversion,
        });
      }
    });

    // Orden por fecha desc
    return resultado.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [inversiones, asientosDepreciacion]);

  return {
    transacciones,
    isLoading: loadingInversiones || loadingAsientos,
  };
};
