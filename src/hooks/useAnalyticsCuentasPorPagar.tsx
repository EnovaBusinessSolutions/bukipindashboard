import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface CuentaPorPagar {
  id: string;
  proveedor_nombre: string | null;
  monto_pendiente: number;
  fecha_vencimiento: string | null;
  created_at: string;
  descripcion: string;
  dias_vencimiento?: number;
}

interface AnalyticsCuentasPorPagar {
  totalPendiente: number;
  totalProveedores: number;
  promedioDeuda: number;
  cuentasPorProveedor: { proveedor: string; monto: number; cantidad: number }[];
  agingAnalysis: { rango: string; monto: number; cantidad: number }[];
  tendenciaMensual: { mes: string; monto: number }[];
  agingAnalysisDetailed: {
    rango: string;
    monto: number;
    cantidad: number;
    min: number | null;
    max: number | null;
  }[];
  historicoCxP: { fecha: string; saldo: number }[];
  cxpPorProveedorApilado: {
    proveedor: string;
    sinVencimiento: number;
    vencido1_15: number;
    vencido16_30: number;
    vencido31_60: number;
    vencido61_90: number;
    vencidoMas90: number;
    total: number;
  }[];
}

type CxPAsientoRow = {
  debe: number;
  haber: number;
  fecha: string; // ISO
  cuenta_codigo: string; // "2001" | "2002"
};

export const useAnalyticsCuentasPorPagar = (
  periodo: "mensual" | "anual" = "mensual",
  filtroProveedor?: string
) => {
  return useQuery({
    queryKey: ["analytics-cuentas-por-pagar", periodo, filtroProveedor],
    queryFn: async (): Promise<AnalyticsCuentasPorPagar> => {
      // 1) CxP de egresos pendientes
      const egresosJson = await apiFetch("/api/cxp/egresos?pendientes=1", { method: "GET" });
      const cuentasEgresos: any[] = (egresosJson as any)?.data ?? egresosJson ?? [];

      // 2) CxP de inversiones CAPEX compradas a crédito (monto_pendiente > 0)
      const invJson = await apiFetch("/api/cxp/inversiones?pendientes=1", { method: "GET" });
      const cuentasInversiones: any[] = (invJson as any)?.data ?? invJson ?? [];

      // 3) Asientos contables para histórico real (cuentas 2001 y 2002)
      const asientosJson = await apiFetch("/api/cxp/asientos?cuentas=2001,2002", { method: "GET" });
      const asientos: CxPAsientoRow[] = (asientosJson as any)?.data ?? asientosJson ?? [];

      // Unificar ambas fuentes a un formato común CuentaPorPagar
      const cuentas: CuentaPorPagar[] = [
        ...(cuentasEgresos || []).map((e: any) => ({
          id: e.id,
          proveedor_nombre: e.proveedor_nombre ?? null,
          monto_pendiente: e.monto_pendiente ?? 0,
          fecha_vencimiento: e.fecha_vencimiento ?? null,
          created_at: e.created_at,
          descripcion: e.descripcion ?? "Egreso",
        })),
        ...(cuentasInversiones || []).map((inv: any) => ({
          id: inv.id,
          proveedor_nombre: inv.proveedor_nombre ?? null,
          monto_pendiente: inv.monto_pendiente ?? 0,
          fecha_vencimiento: inv.fecha_vencimiento ?? null,
          created_at: inv.created_at,
          descripcion: inv.producto_nombre ?? inv.descripcion ?? "Inversión CAPEX",
        })),
      ];

      const today = new Date();

      // Calcular días de vencimiento (si no hay fecha_vencimiento, usar created_at)
      const cuentasConDias: CuentaPorPagar[] = cuentas.map((cuenta) => {
        let diasVencimiento = 0;

        if (cuenta.fecha_vencimiento) {
          const fechaVenc = new Date(cuenta.fecha_vencimiento);
          diasVencimiento = Math.floor(
            (today.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24)
          );
        } else {
          const fechaCreacion = new Date(cuenta.created_at);
          diasVencimiento = Math.floor(
            (today.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        return { ...cuenta, dias_vencimiento: diasVencimiento };
      });

      // Aplicar filtro de proveedor a nivel dataset (para que TODO se calcule correctamente)
      let cuentasFiltradas = cuentasConDias;
      if (filtroProveedor && filtroProveedor !== "todos") {
        cuentasFiltradas = cuentasConDias.filter(
          (c) => (c.proveedor_nombre || "Sin nombre") === filtroProveedor
        );
      }

      // Métricas generales
      const totalPendiente = cuentasFiltradas.reduce((sum, c) => sum + (c.monto_pendiente || 0), 0);
      const proveedoresUnicos = new Set(cuentasFiltradas.map((c) => c.proveedor_nombre || "Sin nombre")).size;
      const promedioDeuda = totalPendiente / (cuentasFiltradas.length || 1);

      // Agrupar por proveedor
      const porProveedor = cuentasFiltradas.reduce((acc, cuenta) => {
        const proveedor = cuenta.proveedor_nombre || "Sin nombre";
        if (!acc[proveedor]) acc[proveedor] = { monto: 0, cantidad: 0 };
        acc[proveedor].monto += cuenta.monto_pendiente || 0;
        acc[proveedor].cantidad += 1;
        return acc;
      }, {} as Record<string, { monto: number; cantidad: number }>);

      const cuentasPorProveedor = Object.entries(porProveedor)
        .map(([proveedor, data]) => ({ proveedor, ...data }))
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 10);

      // Aging simple
      const agingRanges = [
        { rango: "0-30 días", min: 0, max: 30 },
        { rango: "31-60 días", min: 31, max: 60 },
        { rango: "61-90 días", min: 61, max: 90 },
        { rango: "90+ días", min: 91, max: Infinity },
      ];

      const agingAnalysis = agingRanges.map((range) => {
        const cuentasEnRango = cuentasFiltradas.filter((c) => {
          const dias = c.dias_vencimiento || 0;
          return dias >= range.min && dias <= range.max;
        });
        return {
          rango: range.rango,
          monto: cuentasEnRango.reduce((sum, c) => sum + (c.monto_pendiente || 0), 0),
          cantidad: cuentasEnRango.length,
        };
      });

      // Tendencia (últimos 6 meses) por created_at
      const mesesPasados = 6;
      const tendenciaMensual: { mes: string; monto: number }[] = [];

      for (let i = mesesPasados - 1; i >= 0; i--) {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() - i);
        const year = fecha.getFullYear();
        const month = fecha.getMonth();

        const cuentasDelMes = cuentasFiltradas.filter((cuenta) => {
          const fechaCuenta = new Date(cuenta.created_at);
          return fechaCuenta.getFullYear() === year && fechaCuenta.getMonth() === month;
        });

        tendenciaMensual.push({
          mes: fecha.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
          monto: cuentasDelMes.reduce((sum, c) => sum + (c.monto_pendiente || 0), 0),
        });
      }

      // Aging detallado (6 categorías)
      const agingRangesDetailed = [
        { rango: "Sin vencimiento", min: null, max: 0 },
        { rango: "Vencido 1-15 días", min: 1, max: 15 },
        { rango: "Vencido 16-30 días", min: 16, max: 30 },
        { rango: "Vencido 31-60 días", min: 31, max: 60 },
        { rango: "Vencido 61-90 días", min: 61, max: 90 },
        { rango: "Vencido +90 días", min: 91, max: null },
      ];

      const agingAnalysisDetailed = agingRangesDetailed.map((range) => {
        const cuentasEnRango = cuentasFiltradas.filter((c) => {
          const dias = c.dias_vencimiento || 0;
          if (range.min === null) return dias <= (range.max ?? 0);
          if (range.max === null) return dias >= range.min;
          return dias >= range.min && dias <= range.max;
        });

        return {
          rango: range.rango,
          monto: cuentasEnRango.reduce((sum, c) => sum + (c.monto_pendiente || 0), 0),
          cantidad: cuentasEnRango.length,
          min: range.min,
          max: range.max,
        };
      });

      // Histórico CxP REAL (HABER - DEBE) para cuentas 2001 y 2002
      // Nota: NO aplico filtroProveedor aquí porque el histórico viene del mayor contable (global).
      const historicoCxP: { fecha: string; saldo: number }[] = [];

      const calcularSaldoCxPHastaFecha = (fecha: Date) => {
        const fechaFin = new Date(fecha);
        fechaFin.setHours(23, 59, 59, 999);

        const asientosHastaFecha = (asientos || []).filter((a) => new Date(a.fecha) <= fechaFin);
        const saldo = asientosHastaFecha.reduce(
          (sum, a) => sum + ((a.haber || 0) - (a.debe || 0)),
          0
        );
        return saldo;
      };

      if (periodo === "mensual") {
        // Últimos 30 días
        for (let i = 29; i >= 0; i--) {
          const fecha = new Date();
          fecha.setDate(fecha.getDate() - i);
          const fechaStr = fecha.toLocaleDateString("es-ES", { day: "numeric", month: "short" });

          const saldo = calcularSaldoCxPHastaFecha(fecha);
          historicoCxP.push({ fecha: fechaStr, saldo });
        }
      } else {
        // Últimos 12 meses
        for (let i = 11; i >= 0; i--) {
          const fecha = new Date();
          fecha.setMonth(fecha.getMonth() - i);
          const fechaStr = fecha.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });

          // cierre de mes
          const cierreMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59, 999);
          const saldo = calcularSaldoCxPHastaFecha(cierreMes);
          historicoCxP.push({ fecha: fechaStr, saldo });
        }
      }

      // CxP por proveedor apilado (antigüedad) - top 10
      const proveedoresUnique = Array.from(
        new Set(cuentasFiltradas.map((c) => c.proveedor_nombre || "Sin nombre"))
      );

      const cxpPorProveedorApilado = proveedoresUnique
        .map((proveedor) => {
          const cuentasProveedor = cuentasFiltradas.filter(
            (c) => (c.proveedor_nombre || "Sin nombre") === proveedor
          );

          const sinVencimiento = cuentasProveedor
            .filter((c) => (c.dias_vencimiento || 0) <= 0)
            .reduce((sum, c) => sum + (c.monto_pendiente || 0), 0);

          const vencido1_15 = cuentasProveedor
            .filter((c) => {
              const dias = c.dias_vencimiento || 0;
              return dias >= 1 && dias <= 15;
            })
            .reduce((sum, c) => sum + (c.monto_pendiente || 0), 0);

          const vencido16_30 = cuentasProveedor
            .filter((c) => {
              const dias = c.dias_vencimiento || 0;
              return dias >= 16 && dias <= 30;
            })
            .reduce((sum, c) => sum + (c.monto_pendiente || 0), 0);

          const vencido31_60 = cuentasProveedor
            .filter((c) => {
              const dias = c.dias_vencimiento || 0;
              return dias >= 31 && dias <= 60;
            })
            .reduce((sum, c) => sum + (c.monto_pendiente || 0), 0);

          const vencido61_90 = cuentasProveedor
            .filter((c) => {
              const dias = c.dias_vencimiento || 0;
              return dias >= 61 && dias <= 90;
            })
            .reduce((sum, c) => sum + (c.monto_pendiente || 0), 0);

          const vencidoMas90 = cuentasProveedor
            .filter((c) => (c.dias_vencimiento || 0) >= 91)
            .reduce((sum, c) => sum + (c.monto_pendiente || 0), 0);

          const total =
            sinVencimiento + vencido1_15 + vencido16_30 + vencido31_60 + vencido61_90 + vencidoMas90;

          return {
            proveedor,
            sinVencimiento,
            vencido1_15,
            vencido16_30,
            vencido31_60,
            vencido61_90,
            vencidoMas90,
            total,
          };
        })
        .filter((p) => p.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      return {
        totalPendiente,
        totalProveedores: proveedoresUnicos,
        promedioDeuda,
        cuentasPorProveedor,
        agingAnalysis,
        tendenciaMensual,
        agingAnalysisDetailed,
        historicoCxP,
        cxpPorProveedorApilado,
      };
    },
  });
};

export const useCuentasPorPagarDetalle = () => {
  return useQuery({
    queryKey: ["cuentas-por-pagar-detalle"],
    queryFn: async () => {
      // Detalle combinado recomendado desde backend
      const json = await apiFetch("/api/cxp/detalle?pendientes=1", { method: "GET" });
      const data: any[] = (json as any)?.data ?? json ?? [];

      const today = new Date();

      return (data || []).map((cuenta: any) => {
        let diasVencimiento = 0;
        let estado = "Al día";

        if (cuenta.fecha_vencimiento) {
          const fechaVenc = new Date(cuenta.fecha_vencimiento);
          diasVencimiento = Math.floor(
            (today.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (diasVencimiento > 90) estado = "Muy vencida";
          else if (diasVencimiento > 30) estado = "Vencida";
          else if (diasVencimiento > 0) estado = "Por vencer";
        } else {
          const fechaCreacion = new Date(cuenta.created_at);
          diasVencimiento = Math.floor(
            (today.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24)
          );
          estado = "Sin fecha límite";
        }

        return {
          ...cuenta,
          diasVencimiento,
          estado,
        };
      });
    },
  });
};
