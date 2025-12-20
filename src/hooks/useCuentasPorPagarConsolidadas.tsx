import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface CuentaPorPagarConsolidada {
  id: string;
  tipo_transaccion: "inventario" | "egreso" | "capex";
  proveedor_nombre: string | null;
  proveedor_telefono: string | null;
  proveedor_email: string | null;
  proveedor_rfc: string | null;
  descripcion: string;
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;
  fecha_vencimiento: string | null;
  tipo_pago: string;
  metodo_pago: string | null;
  created_at: string;

  // Campos específicos por tipo
  producto_nombre?: string;
  categoria_activo?: string;
  subcuenta_id?: string | null;
  cuenta_codigo?: string | null;
}

type AnyJson = any;

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

const safeNumber = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const daysDiff = (from: Date, to: Date) =>
  Math.floor((from.getTime() - to.getTime()) / (1000 * 60 * 60 * 24));

const fmtDayShort = (d: Date) =>
  d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });

const fmtMonthShort = (d: Date) =>
  d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });

/**
 * TS: Object.entries(...) suele degradar a [string, unknown][]
 * Este helper mantiene el tipo del value y elimina los rojos por spread.
 */
const typedEntries = <T extends Record<string, any>>(obj: T) =>
  Object.entries(obj) as Array<[keyof T & string, T[keyof T]]>;

export const useCuentasPorPagarConsolidadas = () => {
  return useQuery<CuentaPorPagarConsolidada[]>({
    queryKey: ["cuentas-por-pagar-consolidadas"],
    queryFn: async (): Promise<CuentaPorPagarConsolidada[]> => {
      const cuentasConsolidadas: CuentaPorPagarConsolidada[] = [];

      // 1) EGRESOS con saldo pendiente
      // Endpoint esperado: GET /api/transacciones/egresos?pendiente_gt=0
      const egresosJson: AnyJson = await apiFetch(
        "/api/transacciones/egresos?pendiente_gt=0",
        { method: "GET" }
      );
      const egresos = normalizeArray<any>(egresosJson);

      egresos.forEach((egreso) => {
        cuentasConsolidadas.push({
          id: egreso.id,
          tipo_transaccion: "egreso",
          proveedor_nombre: egreso.proveedor_nombre ?? null,
          proveedor_telefono: egreso.proveedor_telefono ?? null,
          proveedor_email: egreso.proveedor_email ?? null,
          proveedor_rfc: egreso.proveedor_rfc ?? null,
          descripcion: egreso.descripcion || `Egreso: ${egreso.tipo_egreso || ""}`.trim(),
          monto_total: safeNumber(egreso.monto_total),
          monto_pagado: safeNumber(egreso.monto_pagado),
          monto_pendiente: safeNumber(egreso.monto_pendiente),
          fecha_vencimiento: egreso.fecha_vencimiento ?? null,
          tipo_pago: egreso.tipo_pago,
          metodo_pago: egreso.metodo_pago ?? null,
          created_at: egreso.created_at,
          subcuenta_id: egreso.subcuenta_id ?? null,
          cuenta_codigo: egreso.cuenta_codigo ?? null,
        });
      });

      // 2) CAPEX con saldo pendiente
      // Endpoint esperado: GET /api/inversiones/capex?pendiente_gt=0
      const inversionesJson: AnyJson = await apiFetch(
        "/api/inversiones/capex?pendiente_gt=0",
        { method: "GET" }
      );
      const inversiones = normalizeArray<any>(inversionesJson);

      inversiones.forEach((inv) => {
        cuentasConsolidadas.push({
          id: inv.id,
          tipo_transaccion: "capex",
          proveedor_nombre: inv.proveedor_nombre ?? null,
          proveedor_telefono: inv.proveedor_telefono ?? null,
          proveedor_email: inv.proveedor_email ?? null,
          proveedor_rfc: inv.proveedor_rfc ?? null,
          descripcion: inv.descripcion || `CAPEX: ${inv.producto_nombre || ""}`.trim(),
          monto_total: safeNumber(inv.valor_total),
          monto_pagado: safeNumber(inv.monto_pagado),
          monto_pendiente: safeNumber(inv.monto_pendiente),
          fecha_vencimiento: inv.fecha_vencimiento ?? null,
          tipo_pago: inv.tipo_pago,
          metodo_pago: inv.metodo_pago ?? null,
          created_at: inv.created_at,
          producto_nombre: inv.producto_nombre,
          categoria_activo: inv.categoria_activo,
          subcuenta_id: inv.subcuenta_id ?? null,
          cuenta_codigo: inv.cuenta_codigo ?? null,
        });
      });

      /**
       * 3) INVENTARIO a crédito:
       * En tu código original se comenta que “inventario a crédito” debería registrarse como egreso tipo inventario.
       * Así que aquí NO metemos movimientos_inventario (porque no hay monto_pendiente real).
       */

      // Ordenar por fecha de vencimiento (las sin fecha al final)
      cuentasConsolidadas.sort((a, b) => {
        if (!a.fecha_vencimiento && !b.fecha_vencimiento) return 0;
        if (!a.fecha_vencimiento) return 1;
        if (!b.fecha_vencimiento) return -1;
        return (
          new Date(a.fecha_vencimiento).getTime() -
          new Date(b.fecha_vencimiento).getTime()
        );
      });

      return cuentasConsolidadas;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

type TipoCuenta = "egreso" | "capex";

type CuentaBase = {
  tipo: TipoCuenta;
  monto_total: number;
  monto_pendiente: number;
  proveedor_nombre: string | null;
  fecha_vencimiento?: string | null;
  created_at: string;
};

type MontoCantidad = { monto: number; cantidad: number };

type ProveedorApilado = {
  sinVencimiento: number;
  vencido1_15: number;
  vencido16_30: number;
  vencido31_60: number;
  vencido61_90: number;
  vencidoMas90: number;
  total: number;
};

export type AnalyticsCuentasPorPagarConsolidadasResult = {
  totalPendiente: number;
  totalProveedores: number;
  promedioDeuda: number;
  distribucionPorTipo: Array<{ tipo: string; monto: number; cantidad: number }>;
  cuentasPorProveedor: Array<{ proveedor: string; monto: number; cantidad: number }>;
  agingAnalysis: Array<{ rango: string; monto: number; cantidad: number }>;
  agingAnalysisDetailed: Array<{
    rango: string;
    monto: number;
    cantidad: number;
    min: number | null;
    max: number | null;
  }>;
  historicoCxP: Array<{ fecha: string; saldo: number }>;
  cxpPorProveedorApilado: Array<{ proveedor: string } & ProveedorApilado>;
  proveedoresLista: string[];
  todasCuentas: CuentaBase[];
  tendenciaMensual: { mes: string; monto: number }[];
};

export const useAnalyticsCuentasPorPagarConsolidadas = (
  periodo: "diario" | "mensual" | "anual" = "mensual"
) => {
  return useQuery<AnalyticsCuentasPorPagarConsolidadasResult>({
    queryKey: ["analytics-cuentas-por-pagar-consolidadas", periodo],
    queryFn: async () => {
      // Traer CxP base desde backend
      const egresosJson: AnyJson = await apiFetch(
        "/api/transacciones/egresos?pendiente_gt=0",
        { method: "GET" }
      );
      const egresos = normalizeArray<any>(egresosJson);

      const inversionesJson: AnyJson = await apiFetch(
        "/api/inversiones/capex?pendiente_gt=0",
        { method: "GET" }
      );
      const inversiones = normalizeArray<any>(inversionesJson);

      const todasCuentas: CuentaBase[] = [
        ...(egresos || []).map((e) => ({
          tipo: "egreso" as const,
          monto_total: safeNumber(e.monto_total),
          monto_pendiente: safeNumber(e.monto_pendiente),
          proveedor_nombre: e.proveedor_nombre ?? null,
          fecha_vencimiento: e.fecha_vencimiento ?? null,
          created_at: e.created_at,
        })),
        ...(inversiones || []).map((i) => ({
          tipo: "capex" as const,
          monto_total: safeNumber(i.valor_total),
          monto_pendiente: safeNumber(i.monto_pendiente),
          proveedor_nombre: i.proveedor_nombre ?? null,
          fecha_vencimiento: i.fecha_vencimiento ?? null,
          created_at: i.created_at,
        })),
      ];

      const today = new Date();

      // Total pendiente
      const totalPendiente = todasCuentas.reduce(
        (sum, c) => sum + safeNumber(c.monto_pendiente),
        0
      );

      // Proveedores únicos
      const totalProveedores = new Set(
        todasCuentas.map((c) => c.proveedor_nombre || "Sin nombre")
      ).size;

      // Promedio deuda
      const promedioDeuda = totalPendiente / (todasCuentas.length || 1);

      // Distribución por tipo
      const porTipo: Record<string, MontoCantidad> = todasCuentas.reduce(
        (acc, cuenta) => {
          const tipo = cuenta.tipo;
          if (!acc[tipo]) acc[tipo] = { monto: 0, cantidad: 0 };
          acc[tipo].monto += safeNumber(cuenta.monto_pendiente);
          acc[tipo].cantidad += 1;
          return acc;
        },
        {} as Record<string, MontoCantidad>
      );

      const distribucionPorTipo = typedEntries(porTipo).map(([tipo, data]) => ({
        tipo: tipo === "egreso" ? "Egresos" : "Inversiones CAPEX",
        ...data,
      }));

      // Agrupar por proveedor
      const porProveedor: Record<string, MontoCantidad> = todasCuentas.reduce(
        (acc, cuenta) => {
          const proveedor = cuenta.proveedor_nombre || "Sin nombre";
          if (!acc[proveedor]) acc[proveedor] = { monto: 0, cantidad: 0 };
          acc[proveedor].monto += safeNumber(cuenta.monto_pendiente);
          acc[proveedor].cantidad += 1;
          return acc;
        },
        {} as Record<string, MontoCantidad>
      );

      const cuentasPorProveedor = typedEntries(porProveedor)
        .map(([proveedor, data]) => ({ proveedor, ...data }))
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 10);

      // Aging (básico)
      const getDiasVenc = (c: CuentaBase) => {
        if (c.fecha_vencimiento) return daysDiff(today, new Date(c.fecha_vencimiento));
        return daysDiff(today, new Date(c.created_at));
      };

      const agingRanges = [
        { rango: "0-30 días", min: 0, max: 30 },
        { rango: "31-60 días", min: 31, max: 60 },
        { rango: "61-90 días", min: 61, max: 90 },
        { rango: "90+ días", min: 91, max: Infinity },
      ];

      const agingAnalysis = agingRanges.map((range) => {
        const cuentasEnRango = todasCuentas.filter((c) => {
          const dias = getDiasVenc(c);
          return dias >= range.min && dias <= range.max;
        });

        return {
          rango: range.rango,
          monto: cuentasEnRango.reduce((sum, c) => sum + safeNumber(c.monto_pendiente), 0),
          cantidad: cuentasEnRango.length,
        };
      });

      // Aging detallado (6 categorías)
      const agingRangesDetailed = [
        { rango: "Sin vencimiento", min: null as number | null, max: null as number | null },
        { rango: "Vencido 1-15 días", min: 1, max: 15 },
        { rango: "Vencido 16-30 días", min: 16, max: 30 },
        { rango: "Vencido 31-60 días", min: 31, max: 60 },
        { rango: "Vencido 61-90 días", min: 61, max: 90 },
        { rango: "Vencido +90 días", min: 91, max: Infinity },
      ];

      const agingAnalysisDetailed = agingRangesDetailed.map((range) => {
        const cuentasEnRango = todasCuentas.filter((c) => {
          // Caso “Sin vencimiento”: incluye sin fecha y/o que aún no vencen
          if (range.min === null && range.max === null) {
            if (!c.fecha_vencimiento) return true;
            const dias = daysDiff(today, new Date(c.fecha_vencimiento));
            return dias < 0;
          }

          if (!c.fecha_vencimiento) return false;
          const dias = daysDiff(today, new Date(c.fecha_vencimiento));
          return dias >= (range.min as number) && dias <= (range.max as number);
        });

        return {
          rango: range.rango,
          monto: cuentasEnRango.reduce((sum, c) => sum + safeNumber(c.monto_pendiente), 0),
          cantidad: cuentasEnRango.length,
          min: range.min,
          max: range.max,
        };
      });

      // Tendencia mensual (últimos 6 meses)
      const mesesPasados = 6;
      const tendenciaMensual: { mes: string; monto: number }[] = [];

      for (let i = mesesPasados - 1; i >= 0; i--) {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() - i);
        const year = fecha.getFullYear();
        const month = fecha.getMonth();

        const cuentasDelMes = todasCuentas.filter((c) => {
          const fc = new Date(c.created_at);
          return fc.getFullYear() === year && fc.getMonth() === month;
        });

        tendenciaMensual.push({
          mes: fmtMonthShort(fecha),
          monto: cuentasDelMes.reduce((sum, c) => sum + safeNumber(c.monto_pendiente), 0),
        });
      }

      /**
       * HISTÓRICO CxP por asientos (cuentas 2001/2002)
       * Endpoint esperado (backend filtra por owner):
       *   GET /api/asientos/detalle?cuentas=2001,2002
       * Respuesta: [{ debe:number, haber:number, fecha:'YYYY-MM-DD' }]
       */
      let historicoCxP: { fecha: string; saldo: number }[] = [];

      try {
        const asientosJson: AnyJson = await apiFetch(
          "/api/asientos/detalle?cuentas=2001,2002",
          { method: "GET" }
        );
        const detalles = normalizeArray<any>(asientosJson).map((x) => ({
          debe: safeNumber(x.debe),
          haber: safeNumber(x.haber),
          fecha: x.fecha, // YYYY-MM-DD
        }));

        const saldoHasta = (fechaFin: Date) => {
          const fin = new Date(fechaFin);
          fin.setHours(23, 59, 59, 999);

          // CxP: HABER aumenta, DEBE disminuye
          const saldo = detalles
            .filter((d) => new Date(d.fecha) <= fin)
            .reduce((sum, d) => sum + (d.haber - d.debe), 0);

          return Math.max(0, saldo);
        };

        if (periodo === "diario") {
          const hoy = new Date();
          hoy.setHours(23, 59, 59, 999);
          const start = new Date(hoy);
          start.setDate(start.getDate() - 6);
          start.setHours(0, 0, 0, 0);

          for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            d.setHours(23, 59, 59, 999);

            historicoCxP.push({
              fecha: fmtDayShort(d),
              saldo: saldoHasta(d),
            });
          }
        } else if (periodo === "mensual") {
          const hoy = new Date();
          const year = hoy.getFullYear();
          const month = hoy.getMonth();
          const day = hoy.getDate();

          for (let dia = 1; dia <= day; dia++) {
            const d = new Date(year, month, dia, 23, 59, 59, 999);
            historicoCxP.push({
              fecha: fmtDayShort(d),
              saldo: saldoHasta(d),
            });
          }
        } else {
          const hoy = new Date();
          const year = hoy.getFullYear();
          const mesActual = hoy.getMonth();

          for (let mes = 0; mes <= mesActual; mes++) {
            const last = new Date(year, mes + 1, 0, 23, 59, 59, 999);
            historicoCxP.push({
              fecha: fmtMonthShort(last),
              saldo: saldoHasta(last),
            });
          }
        }
      } catch {
        historicoCxP = [];
      }

      // CxP por proveedor apilado por antigüedad
      const proveedoresMap: Record<string, ProveedorApilado> = todasCuentas.reduce(
        (acc, cuenta) => {
          const proveedor = cuenta.proveedor_nombre || "Sin nombre";
          if (!acc[proveedor]) {
            acc[proveedor] = {
              sinVencimiento: 0,
              vencido1_15: 0,
              vencido16_30: 0,
              vencido31_60: 0,
              vencido61_90: 0,
              vencidoMas90: 0,
              total: 0,
            };
          }

          const monto = safeNumber(cuenta.monto_pendiente);

          let diasVenc: number | null = null;
          if (cuenta.fecha_vencimiento) {
            diasVenc = daysDiff(today, new Date(cuenta.fecha_vencimiento));
          }

          if (diasVenc === null || diasVenc < 0) acc[proveedor].sinVencimiento += monto;
          else if (diasVenc >= 1 && diasVenc <= 15) acc[proveedor].vencido1_15 += monto;
          else if (diasVenc >= 16 && diasVenc <= 30) acc[proveedor].vencido16_30 += monto;
          else if (diasVenc >= 31 && diasVenc <= 60) acc[proveedor].vencido31_60 += monto;
          else if (diasVenc >= 61 && diasVenc <= 90) acc[proveedor].vencido61_90 += monto;
          else acc[proveedor].vencidoMas90 += monto;

          acc[proveedor].total += monto;
          return acc;
        },
        {} as Record<string, ProveedorApilado>
      );

      const cxpPorProveedorApilado = typedEntries(proveedoresMap)
        .map(([proveedor, data]) => ({ proveedor, ...data }))
        .sort((a, b) => b.total - a.total);

      const proveedoresLista = Array.from(
        new Set(todasCuentas.map((c) => c.proveedor_nombre).filter(Boolean) as string[])
      ).sort();

      return {
        totalPendiente,
        totalProveedores,
        promedioDeuda,
        distribucionPorTipo,
        cuentasPorProveedor,
        agingAnalysis,
        agingAnalysisDetailed,
        historicoCxP,
        cxpPorProveedorApilado,
        proveedoresLista,
        todasCuentas,
        tendenciaMensual,
      };
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
