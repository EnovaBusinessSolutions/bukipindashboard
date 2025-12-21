import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface ResumenPeriodo {
  costosVenta5001: number; // Costos de Venta (5001)
  costosVenta5002: number; // Costos de Venta Inventario (5002)
  gastos: number; // Gastos (51XX, 5202, 5203)
  otrosGastos: number; // Otros Gastos (6XXX) -> (en tu lógica actual: 5202/5203/5204)
  total: number;
}

interface ResumenEgresos {
  dia: ResumenPeriodo;
  mes: ResumenPeriodo;
  anio: ResumenPeriodo;
}

type AnyJson = any;

type DetalleAsiento = {
  cuenta_codigo: string;
  debe?: number | string | null;
  haber?: number | string | null;
  fecha: string; // "YYYY-MM-DD"
};

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

const safeNumber = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const useResumenEgresosPorPeriodo = () => {
  return useQuery<ResumenEgresos>({
    queryKey: ["resumen-egresos-periodo"],
    queryFn: async (): Promise<ResumenEgresos> => {
      const today = new Date();
      const todayStr = ymd(today);
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      /**
       * ✅ Backend requerido (E2E):
       * GET /api/asientos/detalle?from=YYYY-01-01&to=YYYY-12-31
       *
       * Respuesta esperada:
       *  - Array plano o { data: Array }
       *  - Cada item: { cuenta_codigo, debe, haber, fecha }
       *
       * Importante: backend filtra por owner:req.user._id
       */
      const from = `${currentYear}-01-01`;
      const to = `${currentYear}-12-31`;

      const detallesJson: AnyJson = await apiFetch(
        `/api/asientos/detalle?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { method: "GET" }
      );

      const detallesAnio = normalizeArray<DetalleAsiento>(detallesJson);

      // Helper para clasificar por período
      const clasificarPorPeriodo = (
        detalles: DetalleAsiento[],
        filtroFecha: (fecha: string) => boolean
      ): ResumenPeriodo => {
        let costosVenta5001 = 0;
        let costosVenta5002 = 0;
        let gastos = 0;
        let otrosGastos = 0;

        for (const detalle of detalles) {
          const fecha = detalle.fecha;
          if (!fecha || !filtroFecha(fecha)) continue;

          const codigo = String(detalle.cuenta_codigo || "");
          if (!codigo) continue;

          const debe = safeNumber(detalle.debe);
          const haber = safeNumber(detalle.haber);

          // En resultados: normalmente DEBE incrementa gasto/costo, HABER lo reduce.
          // Se conserva tu lógica original:
          const monto = debe - haber;

          if (codigo === "5001") {
            costosVenta5001 += monto;
          } else if (codigo === "5002") {
            costosVenta5002 += monto;
          } else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
            // Gastos operativos 51XX excluyendo depreciaciones (5109, 5110)
            gastos += monto;
          } else if (codigo === "5202" || codigo === "5203" || codigo === "5204") {
            // Otros gastos (según tu regla actual)
            otrosGastos += monto;
          }
        }

        const total = costosVenta5001 + costosVenta5002 + gastos + otrosGastos;

        // Mantengo tu comportamiento: nunca negativos
        return {
          costosVenta5001: Math.max(0, costosVenta5001),
          costosVenta5002: Math.max(0, costosVenta5002),
          gastos: Math.max(0, gastos),
          otrosGastos: Math.max(0, otrosGastos),
          total: Math.max(0, total),
        };
      };

      // Día
      const resumenDia = clasificarPorPeriodo(detallesAnio, (fecha) => fecha === todayStr);

      // Mes
      const resumenMes = clasificarPorPeriodo(detallesAnio, (fecha) => {
        // fecha viene "YYYY-MM-DD" -> Date lo interpreta como UTC; para mes/año está bien.
        const d = new Date(fecha);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      // Año
      const resumenAnio = clasificarPorPeriodo(detallesAnio, (fecha) => {
        return new Date(fecha).getFullYear() === currentYear;
      });

      return { dia: resumenDia, mes: resumenMes, anio: resumenAnio };
    },
    staleTime: 2 * 60 * 1000, // 2 min
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
