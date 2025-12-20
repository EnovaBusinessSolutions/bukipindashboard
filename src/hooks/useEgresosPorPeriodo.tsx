import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface DatosEvolucionSimple {
  periodo: string;
  monto: number;
}

export interface DatosEvolucionCombinada {
  periodo: string;
  costos: number;
  gastos: number;
  costosInventario: number;
  otrosGastos: number;
}

// Shape mínimo que necesitamos desde backend
type DetalleAsientoAPI = {
  cuenta_codigo: string;
  debe: number | null;
  haber: number | null;
  asientos_contables: {
    fecha: string; // YYYY-MM-DD
  };
};

const clamp0 = (n: number) => Math.max(0, n);

const parseYYYYMMDDLocal = (yyyyMmDd: string): Date | null => {
  const parts = (yyyyMmDd || "").split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m, d);
};

export const useEgresosPorPeriodo = (
  periodFilter: "diario" | "mensual" | "anual",
  tipoEgreso:
    | "total"
    | "costo"
    | "gasto"
    | "costo_inventario"
    | "otros_gastos"
    | "combinada",
  fechaEspecificaDiaria?: Date,
  fechaEspecificaMensual?: Date
) => {
  return useQuery({
    queryKey: [
      "egresos-por-periodo-v2",
      periodFilter,
      tipoEgreso,
      fechaEspecificaDiaria?.toISOString(),
      fechaEspecificaMensual?.toISOString(),
    ],
    queryFn: async (): Promise<DatosEvolucionSimple[] | DatosEvolucionCombinada[]> => {
      const fechaBase = fechaEspecificaDiaria || new Date();
      const fechaMensual = fechaEspecificaMensual || new Date();

      const currentYear =
        periodFilter === "diario"
          ? fechaBase.getFullYear()
          : periodFilter === "mensual"
          ? fechaMensual.getFullYear()
          : new Date().getFullYear();

      const currentMonth = periodFilter === "mensual" ? fechaMensual.getMonth() : new Date().getMonth();

      // Traer detalles del año completo (una sola llamada)
      const start = `${currentYear}-01-01`;
      const end = `${currentYear}-12-31`;

      /**
       * Endpoint esperado:
       * GET /api/contabilidad/detalle-asientos?start=YYYY-MM-DD&end=YYYY-MM-DD
       * Devuelve { ok:true, data:[...] } o payload plano [...]
       */
      const json = await apiFetch(
        `/api/contabilidad/detalle-asientos?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { method: "GET" }
      );

      const detalles = (json?.data ?? json ?? []) as DetalleAsientoAPI[];

      // Helpers de filtrado por tipo
      const filtrarPorCodigo = (codigo: string): boolean => {
        if (tipoEgreso === "costo") return codigo === "5001";
        if (tipoEgreso === "costo_inventario") return codigo === "5002";
        if (tipoEgreso === "otros_gastos") return codigo === "5204"; // solo 5204
        if (tipoEgreso === "gasto")
          return (
            codigo.startsWith("51") &&
            codigo !== "5109" &&
            codigo !== "5110"
          ); // 51xx operativos (sin depreciaciones)
        return false;
      };

      // =========================
      // MODO COMBINADA
      // =========================
      if (tipoEgreso === "combinada") {
        if (periodFilter === "diario") {
          const todayStr = fechaBase.toISOString().split("T")[0];
          let costos5001 = 0;
          let gastos = 0;
          let costosInventario5002 = 0;
          let otrosGastos5204 = 0;

          detalles.forEach((detalle) => {
            if (detalle.asientos_contables?.fecha !== todayStr) return;

            const codigo = String(detalle.cuenta_codigo || "");
            const monto = (Number(detalle.debe) || 0) - (Number(detalle.haber) || 0);

            if (codigo === "5001") costos5001 += monto;
            else if (codigo === "5002") costosInventario5002 += monto;
            else if (codigo === "5204") otrosGastos5204 += monto;
            else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
              gastos += monto;
            }
          });

          return [
            {
              periodo: "Hoy",
              costos: clamp0(costos5001),
              gastos: clamp0(gastos),
              costosInventario: clamp0(costosInventario5002),
              otrosGastos: clamp0(otrosGastos5204),
            },
          ];
        }

        if (periodFilter === "mensual") {
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

          const costosByDay: Record<number, number> = {};
          const gastosByDay: Record<number, number> = {};
          const costosInventarioByDay: Record<number, number> = {};
          const otrosGastosByDay: Record<number, number> = {};

          detalles.forEach((detalle) => {
            const fecha = parseYYYYMMDDLocal(detalle.asientos_contables?.fecha || "");
            if (!fecha) return;
            if (fecha.getMonth() !== currentMonth || fecha.getFullYear() !== currentYear) return;

            const day = fecha.getDate();
            const codigo = String(detalle.cuenta_codigo || "");
            const monto = (Number(detalle.debe) || 0) - (Number(detalle.haber) || 0);

            if (codigo === "5001") costosByDay[day] = (costosByDay[day] || 0) + monto;
            else if (codigo === "5002")
              costosInventarioByDay[day] = (costosInventarioByDay[day] || 0) + monto;
            else if (codigo === "5204") otrosGastosByDay[day] = (otrosGastosByDay[day] || 0) + monto;
            else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
              gastosByDay[day] = (gastosByDay[day] || 0) + monto;
            }
          });

          return Array.from({ length: Math.min(30, daysInMonth) }, (_, i) => {
            const day = i + 1;
            return {
              periodo: `Día ${day}`,
              costos: clamp0(costosByDay[day] || 0),
              gastos: clamp0(gastosByDay[day] || 0),
              costosInventario: clamp0(costosInventarioByDay[day] || 0),
              otrosGastos: clamp0(otrosGastosByDay[day] || 0),
            };
          });
        }

        // anual
        const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const costosByMonth: Record<number, number> = {};
        const gastosByMonth: Record<number, number> = {};
        const costosInventarioByMonth: Record<number, number> = {};
        const otrosGastosByMonth: Record<number, number> = {};

        detalles.forEach((detalle) => {
          const fecha = parseYYYYMMDDLocal(detalle.asientos_contables?.fecha || "");
          if (!fecha) return;
          if (fecha.getFullYear() !== currentYear) return;

          const month = fecha.getMonth();
          const codigo = String(detalle.cuenta_codigo || "");
          const monto = (Number(detalle.debe) || 0) - (Number(detalle.haber) || 0);

          if (codigo === "5001") costosByMonth[month] = (costosByMonth[month] || 0) + monto;
          else if (codigo === "5002")
            costosInventarioByMonth[month] = (costosInventarioByMonth[month] || 0) + monto;
          else if (codigo === "5204") otrosGastosByMonth[month] = (otrosGastosByMonth[month] || 0) + monto;
          else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
            gastosByMonth[month] = (gastosByMonth[month] || 0) + monto;
          }
        });

        return meses.map((mes, index) => ({
          periodo: mes,
          costos: clamp0(costosByMonth[index] || 0),
          gastos: clamp0(gastosByMonth[index] || 0),
          costosInventario: clamp0(costosInventarioByMonth[index] || 0),
          otrosGastos: clamp0(otrosGastosByMonth[index] || 0),
        }));
      }

      // =========================
      // MODO TOTAL (serie única + desglose extra)
      // =========================
      if (tipoEgreso === "total") {
        if (periodFilter === "diario") {
          const todayStr = fechaBase.toISOString().split("T")[0];
          let costos5001 = 0;
          let gastos = 0;
          let costosInventario5002 = 0;
          let otrosGastos5204 = 0;

          detalles.forEach((detalle) => {
            if (detalle.asientos_contables?.fecha !== todayStr) return;

            const codigo = String(detalle.cuenta_codigo || "");
            const monto = (Number(detalle.debe) || 0) - (Number(detalle.haber) || 0);

            if (codigo === "5001") costos5001 += monto;
            else if (codigo === "5002") costosInventario5002 += monto;
            else if (codigo === "5204") otrosGastos5204 += monto;
            else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
              gastos += monto;
            }
          });

          const total = costos5001 + costosInventario5002 + gastos + otrosGastos5204;

          return [
            {
              periodo: "Hoy",
              monto: clamp0(total),
              costos: clamp0(costos5001),
              gastos: clamp0(gastos),
              costosInventario: clamp0(costosInventario5002),
              otrosGastos: clamp0(otrosGastos5204),
            },
          ] as any;
        }

        if (periodFilter === "mensual") {
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

          const costosByDay: Record<number, number> = {};
          const gastosByDay: Record<number, number> = {};
          const costosInventarioByDay: Record<number, number> = {};
          const otrosGastosByDay: Record<number, number> = {};

          detalles.forEach((detalle) => {
            const fecha = parseYYYYMMDDLocal(detalle.asientos_contables?.fecha || "");
            if (!fecha) return;

            if (fecha.getMonth() !== currentMonth || fecha.getFullYear() !== currentYear) return;

            const day = fecha.getDate();
            const codigo = String(detalle.cuenta_codigo || "");
            const monto = (Number(detalle.debe) || 0) - (Number(detalle.haber) || 0);

            // LOGGING TEMPORAL (igual que tu código)
            if (day === 9 && Math.abs(monto) > 10000) {
              console.log(
                "[🔍 DEBUG] Día 9 detectado - Cuenta:",
                codigo,
                "| Monto:",
                monto,
                "| Fecha:",
                detalle.asientos_contables?.fecha
              );
            }

            if (codigo === "5001") costosByDay[day] = (costosByDay[day] || 0) + monto;
            else if (codigo === "5002")
              costosInventarioByDay[day] = (costosInventarioByDay[day] || 0) + monto;
            else if (codigo === "5204") otrosGastosByDay[day] = (otrosGastosByDay[day] || 0) + monto;
            else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
              gastosByDay[day] = (gastosByDay[day] || 0) + monto;
            }
          });

          return Array.from({ length: Math.min(30, daysInMonth) }, (_, i) => {
            const day = i + 1;
            const costos = clamp0(costosByDay[day] || 0);
            const gastos = clamp0(gastosByDay[day] || 0);
            const costosInventario = clamp0(costosInventarioByDay[day] || 0);
            const otrosGastos = clamp0(otrosGastosByDay[day] || 0);
            const total = costos + gastos + costosInventario + otrosGastos;

            return {
              periodo: `Día ${day}`,
              monto: total,
              costos,
              gastos,
              costosInventario,
              otrosGastos,
            };
          }) as any;
        }

        // anual
        const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const costosByMonth: Record<number, number> = {};
        const gastosByMonth: Record<number, number> = {};
        const costosInventarioByMonth: Record<number, number> = {};
        const otrosGastosByMonth: Record<number, number> = {};

        detalles.forEach((detalle) => {
          const fecha = parseYYYYMMDDLocal(detalle.asientos_contables?.fecha || "");
          if (!fecha) return;
          if (fecha.getFullYear() !== currentYear) return;

          const month = fecha.getMonth();
          const codigo = String(detalle.cuenta_codigo || "");
          const monto = (Number(detalle.debe) || 0) - (Number(detalle.haber) || 0);

          if (codigo === "5001") costosByMonth[month] = (costosByMonth[month] || 0) + monto;
          else if (codigo === "5002")
            costosInventarioByMonth[month] = (costosInventarioByMonth[month] || 0) + monto;
          else if (codigo === "5204") otrosGastosByMonth[month] = (otrosGastosByMonth[month] || 0) + monto;
          else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
            gastosByMonth[month] = (gastosByMonth[month] || 0) + monto;
          }
        });

        return meses.map((mes, index) => {
          const costos = clamp0(costosByMonth[index] || 0);
          const gastos = clamp0(gastosByMonth[index] || 0);
          const costosInventario = clamp0(costosInventarioByMonth[index] || 0);
          const otrosGastos = clamp0(otrosGastosByMonth[index] || 0);
          const total = costos + gastos + costosInventario + otrosGastos;

          return {
            periodo: mes,
            monto: total,
            costos,
            gastos,
            costosInventario,
            otrosGastos,
          };
        }) as any;
      }

      // =========================
      // MODO SIMPLE (serie única)
      // =========================
      if (periodFilter === "diario") {
        const todayStr = fechaBase.toISOString().split("T")[0];
        let total = 0;

        detalles.forEach((detalle) => {
          if (detalle.asientos_contables?.fecha !== todayStr) return;
          if (!filtrarPorCodigo(String(detalle.cuenta_codigo || ""))) return;

          const monto = (Number(detalle.debe) || 0) - (Number(detalle.haber) || 0);
          total += monto;
        });

        return [{ periodo: "Hoy", monto: clamp0(total) }];
      }

      if (periodFilter === "mensual") {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const dataByDay: Record<number, number> = {};

        detalles.forEach((detalle) => {
          const fecha = parseYYYYMMDDLocal(detalle.asientos_contables?.fecha || "");
          if (!fecha) return;

          if (fecha.getMonth() !== currentMonth || fecha.getFullYear() !== currentYear) return;
          if (!filtrarPorCodigo(String(detalle.cuenta_codigo || ""))) return;

          const day = fecha.getDate();
          const monto = (Number(detalle.debe) || 0) - (Number(detalle.haber) || 0);
          dataByDay[day] = (dataByDay[day] || 0) + monto;
        });

        return Array.from({ length: Math.min(30, daysInMonth) }, (_, i) => ({
          periodo: `Día ${i + 1}`,
          monto: clamp0(dataByDay[i + 1] || 0),
        }));
      }

      // anual
      const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const dataByMonth: Record<number, number> = {};

      detalles.forEach((detalle) => {
        const fecha = parseYYYYMMDDLocal(detalle.asientos_contables?.fecha || "");
        if (!fecha) return;

        if (fecha.getFullYear() !== currentYear) return;
        if (!filtrarPorCodigo(String(detalle.cuenta_codigo || ""))) return;

        const month = fecha.getMonth();
        const monto = (Number(detalle.debe) || 0) - (Number(detalle.haber) || 0);
        dataByMonth[month] = (dataByMonth[month] || 0) + monto;
      });

      return meses.map((mes, index) => ({
        periodo: mes,
        monto: clamp0(dataByMonth[index] || 0),
      }));
    },
    staleTime: 0, // (igual que tu hook) temporal para debug
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
