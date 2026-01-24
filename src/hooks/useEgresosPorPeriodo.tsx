import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
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

const toNum = (v: any) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const toYMD = (d: Date) => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseYYYYMMDDLocal = (yyyyMmDd: string): Date | null => {
  const parts = (yyyyMmDd || "").split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m, d);
};

const normalizeArray = <T,>(json: any): T[] => {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

export const useEgresosPorPeriodo = (
  periodFilter: "diario" | "mensual" | "anual",
  tipoEgreso: "total" | "costo" | "gasto" | "costo_inventario" | "otros_gastos" | "combinada",
  fechaEspecificaDiaria?: Date,
  fechaEspecificaMensual?: Date
) => {
  // ✅ Base coherente para cada modo
  const baseDiaria = fechaEspecificaDiaria ?? new Date();
  const baseMensual = fechaEspecificaMensual ?? new Date();

  // ✅ Rango óptimo (NO siempre año completo)
  const range = useMemo(() => {
    if (periodFilter === "diario") {
      const ymd = toYMD(baseDiaria);
      return { start: ymd, end: ymd, key: `D:${ymd}` };
    }

    if (periodFilter === "mensual") {
      const y = baseMensual.getFullYear();
      const m = baseMensual.getMonth();
      const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return { start, end, key: `M:${y}-${String(m + 1).padStart(2, "0")}` };
    }

    // anual
    const year = baseMensual?.getFullYear?.() ? baseMensual.getFullYear() : new Date().getFullYear();
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    return { start, end, key: `Y:${year}` };
  }, [periodFilter, baseDiaria, baseMensual]);

  // ✅ queryKey estable (sin Date objects / sin toISOString directo)
  const queryKey = useMemo(
    () => ["egresos-por-periodo-v3", periodFilter, tipoEgreso, range.key],
    [periodFilter, tipoEgreso, range.key]
  );

  return useQuery({
    queryKey,

    queryFn: async (): Promise<DatosEvolucionSimple[] | DatosEvolucionCombinada[]> => {
      const url = `/api/contabilidad/detalle-asientos?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`;
      const json = await apiFetch(url, { method: "GET" });

      const detalles = normalizeArray<DetalleAsientoAPI>(json);

      // Helpers de filtrado por tipo (simple)
      const filtrarPorCodigo = (codigo: string): boolean => {
        if (tipoEgreso === "costo") return codigo === "5001";
        if (tipoEgreso === "costo_inventario") return codigo === "5002";
        if (tipoEgreso === "otros_gastos") return codigo === "5204";
        if (tipoEgreso === "gasto") return codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110";
        return false;
      };

      // =========================
      // COMBINADA
      // =========================
      if (tipoEgreso === "combinada") {
        if (periodFilter === "diario") {
          const todayStr = range.start;

          let costos5001 = 0;
          let gastos = 0;
          let costosInventario5002 = 0;
          let otrosGastos5204 = 0;

          for (const detalle of detalles) {
            if (detalle?.asientos_contables?.fecha !== todayStr) continue;

            const codigo = String(detalle?.cuenta_codigo ?? "");
            const monto = toNum(detalle?.debe) - toNum(detalle?.haber);

            if (codigo === "5001") costos5001 += monto;
            else if (codigo === "5002") costosInventario5002 += monto;
            else if (codigo === "5204") otrosGastos5204 += monto;
            else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") gastos += monto;
          }

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
          const y = baseMensual.getFullYear();
          const m = baseMensual.getMonth();
          const daysInMonth = new Date(y, m + 1, 0).getDate();

          const costosByDay: Record<number, number> = {};
          const gastosByDay: Record<number, number> = {};
          const costosInventarioByDay: Record<number, number> = {};
          const otrosGastosByDay: Record<number, number> = {};

          for (const detalle of detalles) {
            const fecha = parseYYYYMMDDLocal(detalle?.asientos_contables?.fecha || "");
            if (!fecha) continue;
            if (fecha.getFullYear() !== y || fecha.getMonth() !== m) continue;

            const day = fecha.getDate();
            const codigo = String(detalle?.cuenta_codigo ?? "");
            const monto = toNum(detalle?.debe) - toNum(detalle?.haber);

            if (codigo === "5001") costosByDay[day] = (costosByDay[day] || 0) + monto;
            else if (codigo === "5002") costosInventarioByDay[day] = (costosInventarioByDay[day] || 0) + monto;
            else if (codigo === "5204") otrosGastosByDay[day] = (otrosGastosByDay[day] || 0) + monto;
            else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") gastosByDay[day] = (gastosByDay[day] || 0) + monto;
          }

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
        const year = baseMensual.getFullYear();
        const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        const costosByMonth: Record<number, number> = {};
        const gastosByMonth: Record<number, number> = {};
        const costosInventarioByMonth: Record<number, number> = {};
        const otrosGastosByMonth: Record<number, number> = {};

        for (const detalle of detalles) {
          const fecha = parseYYYYMMDDLocal(detalle?.asientos_contables?.fecha || "");
          if (!fecha) continue;
          if (fecha.getFullYear() !== year) continue;

          const month = fecha.getMonth();
          const codigo = String(detalle?.cuenta_codigo ?? "");
          const monto = toNum(detalle?.debe) - toNum(detalle?.haber);

          if (codigo === "5001") costosByMonth[month] = (costosByMonth[month] || 0) + monto;
          else if (codigo === "5002") costosInventarioByMonth[month] = (costosInventarioByMonth[month] || 0) + monto;
          else if (codigo === "5204") otrosGastosByMonth[month] = (otrosGastosByMonth[month] || 0) + monto;
          else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") gastosByMonth[month] = (gastosByMonth[month] || 0) + monto;
        }

        return meses.map((mes, idx) => ({
          periodo: mes,
          costos: clamp0(costosByMonth[idx] || 0),
          gastos: clamp0(gastosByMonth[idx] || 0),
          costosInventario: clamp0(costosInventarioByMonth[idx] || 0),
          otrosGastos: clamp0(otrosGastosByMonth[idx] || 0),
        }));
      }

      // =========================
      // TOTAL (serie única)
      // =========================
      if (tipoEgreso === "total") {
        if (periodFilter === "diario") {
          const todayStr = range.start;

          let costos5001 = 0;
          let gastos = 0;
          let costosInventario5002 = 0;
          let otrosGastos5204 = 0;

          for (const detalle of detalles) {
            if (detalle?.asientos_contables?.fecha !== todayStr) continue;

            const codigo = String(detalle?.cuenta_codigo ?? "");
            const monto = toNum(detalle?.debe) - toNum(detalle?.haber);

            if (codigo === "5001") costos5001 += monto;
            else if (codigo === "5002") costosInventario5002 += monto;
            else if (codigo === "5204") otrosGastos5204 += monto;
            else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") gastos += monto;
          }

          const total = costos5001 + costosInventario5002 + gastos + otrosGastos5204;

          return [{ periodo: "Hoy", monto: clamp0(total) }];
        }

        if (periodFilter === "mensual") {
          const y = baseMensual.getFullYear();
          const m = baseMensual.getMonth();
          const daysInMonth = new Date(y, m + 1, 0).getDate();

          const costosByDay: Record<number, number> = {};
          const gastosByDay: Record<number, number> = {};
          const costosInventarioByDay: Record<number, number> = {};
          const otrosGastosByDay: Record<number, number> = {};

          for (const detalle of detalles) {
            const fecha = parseYYYYMMDDLocal(detalle?.asientos_contables?.fecha || "");
            if (!fecha) continue;
            if (fecha.getFullYear() !== y || fecha.getMonth() !== m) continue;

            const day = fecha.getDate();
            const codigo = String(detalle?.cuenta_codigo ?? "");
            const monto = toNum(detalle?.debe) - toNum(detalle?.haber);

            if (codigo === "5001") costosByDay[day] = (costosByDay[day] || 0) + monto;
            else if (codigo === "5002") costosInventarioByDay[day] = (costosInventarioByDay[day] || 0) + monto;
            else if (codigo === "5204") otrosGastosByDay[day] = (otrosGastosByDay[day] || 0) + monto;
            else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") gastosByDay[day] = (gastosByDay[day] || 0) + monto;
          }

          return Array.from({ length: Math.min(30, daysInMonth) }, (_, i) => {
            const day = i + 1;
            const costos = clamp0(costosByDay[day] || 0);
            const gastos = clamp0(gastosByDay[day] || 0);
            const costosInventario = clamp0(costosInventarioByDay[day] || 0);
            const otrosGastos = clamp0(otrosGastosByDay[day] || 0);
            const total = costos + gastos + costosInventario + otrosGastos;

            return { periodo: `Día ${day}`, monto: total };
          });
        }

        // anual
        const year = baseMensual.getFullYear();
        const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        const costosByMonth: Record<number, number> = {};
        const gastosByMonth: Record<number, number> = {};
        const costosInventarioByMonth: Record<number, number> = {};
        const otrosGastosByMonth: Record<number, number> = {};

        for (const detalle of detalles) {
          const fecha = parseYYYYMMDDLocal(detalle?.asientos_contables?.fecha || "");
          if (!fecha) continue;
          if (fecha.getFullYear() !== year) continue;

          const month = fecha.getMonth();
          const codigo = String(detalle?.cuenta_codigo ?? "");
          const monto = toNum(detalle?.debe) - toNum(detalle?.haber);

          if (codigo === "5001") costosByMonth[month] = (costosByMonth[month] || 0) + monto;
          else if (codigo === "5002") costosInventarioByMonth[month] = (costosInventarioByMonth[month] || 0) + monto;
          else if (codigo === "5204") otrosGastosByMonth[month] = (otrosGastosByMonth[month] || 0) + monto;
          else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") gastosByMonth[month] = (gastosByMonth[month] || 0) + monto;
        }

        return meses.map((mes, idx) => {
          const costos = clamp0(costosByMonth[idx] || 0);
          const gastos = clamp0(gastosByMonth[idx] || 0);
          const costosInventario = clamp0(costosInventarioByMonth[idx] || 0);
          const otrosGastos = clamp0(otrosGastosByMonth[idx] || 0);
          const total = costos + gastos + costosInventario + otrosGastos;

          return { periodo: mes, monto: total };
        });
      }

      // =========================
      // SIMPLE (serie única por tipo)
      // =========================
      if (periodFilter === "diario") {
        const todayStr = range.start;
        let total = 0;

        for (const detalle of detalles) {
          if (detalle?.asientos_contables?.fecha !== todayStr) continue;

          const codigo = String(detalle?.cuenta_codigo ?? "");
          if (!filtrarPorCodigo(codigo)) continue;

          total += toNum(detalle?.debe) - toNum(detalle?.haber);
        }

        return [{ periodo: "Hoy", monto: clamp0(total) }];
      }

      if (periodFilter === "mensual") {
        const y = baseMensual.getFullYear();
        const m = baseMensual.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const dataByDay: Record<number, number> = {};

        for (const detalle of detalles) {
          const fecha = parseYYYYMMDDLocal(detalle?.asientos_contables?.fecha || "");
          if (!fecha) continue;
          if (fecha.getFullYear() !== y || fecha.getMonth() !== m) continue;

          const codigo = String(detalle?.cuenta_codigo ?? "");
          if (!filtrarPorCodigo(codigo)) continue;

          const day = fecha.getDate();
          dataByDay[day] = (dataByDay[day] || 0) + (toNum(detalle?.debe) - toNum(detalle?.haber));
        }

        return Array.from({ length: Math.min(30, daysInMonth) }, (_, i) => ({
          periodo: `Día ${i + 1}`,
          monto: clamp0(dataByDay[i + 1] || 0),
        }));
      }

      // anual
      const year = baseMensual.getFullYear();
      const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const dataByMonth: Record<number, number> = {};

      for (const detalle of detalles) {
        const fecha = parseYYYYMMDDLocal(detalle?.asientos_contables?.fecha || "");
        if (!fecha) continue;
        if (fecha.getFullYear() !== year) continue;

        const codigo = String(detalle?.cuenta_codigo ?? "");
        if (!filtrarPorCodigo(codigo)) continue;

        const month = fecha.getMonth();
        dataByMonth[month] = (dataByMonth[month] || 0) + (toNum(detalle?.debe) - toNum(detalle?.haber));
      }

      return meses.map((mes, idx) => ({
        periodo: mes,
        monto: clamp0(dataByMonth[idx] || 0),
      }));
    },

    // ✅ v5: conserva datos previos y evita parpadeos/reloads
    placeholderData: keepPreviousData,

    // ✅ cache agresivo para panel analítica (baja recargas)
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
