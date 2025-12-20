import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface CuentaPorCobrar {
  id: string;
  cliente_nombre: string | null;
  monto_pendiente: number;
  monto_neto: number;
  monto_pagado: number;
  fecha_vencimiento: string | null;
  created_at: string;
  updated_at: string;
  descripcion: string;
  dias_vencimiento?: number | null;
}

interface AnalyticsCuentasPorCobrar {
  totalPendiente: number;
  totalClientes: number;
  promedioDeuda: number;
  cuentasPorCliente: { cliente: string; monto: number; cantidad: number }[];
  agingAnalysis: { rango: string; monto: number; cantidad: number }[];
  tendenciaMensual: { mes: string; monto: number }[];
  agingAnalysisDetailed: {
    rango: string;
    monto: number;
    cantidad: number;
    min: number | null;
    max: number | null;
  }[];
  historicoCxC: { fecha: string; saldo: number }[];
  cxcPorClienteApilado: {
    cliente: string;
    sinVencimiento: number;
    vencido1_15: number;
    vencido16_30: number;
    vencido31_60: number;
    vencido61_90: number;
    vencidoMas90: number;
    total: number;
  }[];
}

type CxCAsientoRow = {
  debe: number;
  haber: number;
  fecha: string; // ISO
};

export const useAnalyticsCuentasPorCobrar = (
  periodo: "mensual" | "anual" = "mensual",
  filtroCliente?: string
) => {
  return useQuery({
    queryKey: ["analytics-cuentas-por-cobrar", periodo, filtroCliente],
    queryFn: async (): Promise<AnalyticsCuentasPorCobrar> => {
      // 1) CxC desde ingresos (transacciones_ingresos)
      const ingresosJson = await apiFetch("/api/cxc/ingresos?pendientes=1", { method: "GET" });
      const cuentasIngresos: any[] = (ingresosJson as any)?.data ?? ingresosJson ?? [];

      // 2) CxC desde ventas de activos (inversiones_capex vendidas a crédito)
      const ventasJson = await apiFetch("/api/cxc/ventas-activos?pendientes=1", { method: "GET" });
      const ventasActivos: any[] = (ventasJson as any)?.data ?? ventasJson ?? [];

      // 3) Asientos contables de CxC para histórico real (cuenta 1003)
      const asientosJson = await apiFetch("/api/cxc/asientos?cuenta_codigo=1003", { method: "GET" });
      const asientosCxC: CxCAsientoRow[] = (asientosJson as any)?.data ?? asientosJson ?? [];

      // Transformar ventas de activos al formato CuentaPorCobrar
      const cuentasDeVentas: CuentaPorCobrar[] = (ventasActivos || []).map((venta: any) => ({
        id: venta.id,
        cliente_nombre: venta.comprador_nombre ?? venta.cliente_nombre ?? null,
        monto_pendiente: venta.monto_pendiente_venta ?? venta.monto_pendiente ?? 0,
        monto_neto: venta.valor_venta ?? venta.monto_neto ?? 0,
        monto_pagado: venta.monto_pagado_venta ?? venta.monto_pagado ?? 0,
        fecha_vencimiento: venta.fecha_vencimiento_venta ?? venta.fecha_vencimiento ?? null,
        created_at: venta.fecha_baja ?? venta.created_at,
        updated_at: venta.updated_at,
        descripcion: `Venta de activo: ${venta.producto_nombre ?? venta.descripcion ?? "Activo"}`,
        dias_vencimiento: null,
      }));

      // Transformar ingresos al formato CuentaPorCobrar (por si tu backend regresa más campos)
      const cuentasDeIngresos: CuentaPorCobrar[] = (cuentasIngresos || []).map((c: any) => ({
        id: c.id,
        cliente_nombre: c.cliente_nombre ?? null,
        monto_pendiente: c.monto_pendiente ?? 0,
        monto_neto: c.monto_neto ?? c.monto_total ?? 0,
        monto_pagado: c.monto_pagado ?? 0,
        fecha_vencimiento: c.fecha_vencimiento ?? null,
        created_at: c.created_at,
        updated_at: c.updated_at,
        descripcion: c.descripcion ?? "Ingreso",
        dias_vencimiento: null,
      }));

      // Combinar ambas fuentes
      let todasLasCuentas: CuentaPorCobrar[] = [...cuentasDeIngresos, ...cuentasDeVentas];

      // Filtro por cliente si aplica
      if (filtroCliente && filtroCliente !== "todos") {
        todasLasCuentas = todasLasCuentas.filter(
          (cuenta) => (cuenta.cliente_nombre || "Sin nombre") === filtroCliente
        );
      }

      const today = new Date();

      // Calcular días de vencimiento
      const cuentasConDias: CuentaPorCobrar[] = todasLasCuentas.map((cuenta) => {
        let diasVencimiento: number | null = null;
        if (cuenta.fecha_vencimiento) {
          const fechaVenc = new Date(cuenta.fecha_vencimiento);
          diasVencimiento = Math.floor(
            (today.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24)
          );
        }
        return { ...cuenta, dias_vencimiento: diasVencimiento };
      });

      // Métricas generales
      const totalPendiente = cuentasConDias.reduce((sum, c) => sum + (c.monto_pendiente || 0), 0);
      const clientesUnicos = new Set(cuentasConDias.map((c) => c.cliente_nombre || "Sin nombre")).size;
      const promedioDeuda = totalPendiente / (cuentasConDias.length || 1);

      // Agrupar por cliente
      const porCliente = cuentasConDias.reduce((acc, cuenta) => {
        const cliente = cuenta.cliente_nombre || "Sin nombre";
        if (!acc[cliente]) acc[cliente] = { monto: 0, cantidad: 0 };
        acc[cliente].monto += cuenta.monto_pendiente || 0;
        acc[cliente].cantidad += 1;
        return acc;
      }, {} as Record<string, { monto: number; cantidad: number }>);

      const cuentasPorCliente = Object.entries(porCliente)
        .map(([cliente, data]) => ({ cliente, ...data }))
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
        const cuentasEnRango = cuentasConDias.filter(
          (c) =>
            c.dias_vencimiento !== null &&
            (c.dias_vencimiento as number) >= range.min &&
            (c.dias_vencimiento as number) <= range.max
        );
        return {
          rango: range.rango,
          monto: cuentasEnRango.reduce((sum, c) => sum + (c.monto_pendiente || 0), 0),
          cantidad: cuentasEnRango.length,
        };
      });

      // Aging detallado
      const agingRangesDetailed = [
        { rango: "Sin vencimiento", min: null, max: null },
        { rango: "Vencido 1-15 días", min: 1, max: 15 },
        { rango: "Vencido 16-30 días", min: 16, max: 30 },
        { rango: "Vencido 31-60 días", min: 31, max: 60 },
        { rango: "Vencido 61-90 días", min: 61, max: 90 },
        { rango: "Vencido +90 días", min: 91, max: Infinity },
      ];

      const agingAnalysisDetailed = agingRangesDetailed.map((range) => {
        const cuentasEnRango = cuentasConDias.filter((c) => {
          // Sin vencimiento = sin fecha o aún no vence (dias < 0)
          if (range.min === null && range.max === null) {
            return c.dias_vencimiento === null || (c.dias_vencimiento !== null && c.dias_vencimiento < 0);
          }
          if (c.dias_vencimiento === null) return false;
          const dias = c.dias_vencimiento;
          return dias >= (range.min as number) && dias <= (range.max as number);
        });

        return {
          rango: range.rango,
          monto: cuentasEnRango.reduce((sum, c) => sum + (c.monto_pendiente || 0), 0),
          cantidad: cuentasEnRango.length,
          min: range.min,
          max: range.max === Infinity ? Infinity : range.max,
        };
      });

      // Histórico basado en asientos contables (DEBE - HABER)
      const historicoCxC: { fecha: string; saldo: number }[] = [];

      const calcularSaldoRealHastaFecha = (fecha: Date): number => {
        const fechaFin = new Date(fecha);
        fechaFin.setHours(23, 59, 59, 999);

        const asientosHastaFecha = (asientosCxC || []).filter((a) => new Date(a.fecha) <= fechaFin);
        const saldo = asientosHastaFecha.reduce((sum, a) => sum + ((a.debe || 0) - (a.haber || 0)), 0);

        return Math.max(0, saldo);
      };

      if (periodo === "mensual") {
        const hoy = new Date();
        const anio = hoy.getFullYear();
        const mes = hoy.getMonth();
        const diaActual = hoy.getDate();

        for (let dia = 1; dia <= diaActual; dia++) {
          const fechaDia = new Date(anio, mes, dia, 23, 59, 59, 999);
          const saldoCierre = calcularSaldoRealHastaFecha(fechaDia);
          historicoCxC.push({
            fecha: fechaDia.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
            saldo: Math.max(0, saldoCierre),
          });
        }
      } else {
        const hoy = new Date();
        const anioActual = hoy.getFullYear();
        const mesActual = hoy.getMonth();

        for (let mes = 0; mes <= mesActual; mes++) {
          const ultimoDiaMes = new Date(anioActual, mes + 1, 0, 23, 59, 59, 999);
          const saldoCierre = calcularSaldoRealHastaFecha(ultimoDiaMes);
          historicoCxC.push({
            fecha: ultimoDiaMes.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
            saldo: Math.max(0, saldoCierre),
          });
        }
      }

      // CxC por cliente apilado
      const clientesMap = cuentasConDias.reduce((acc, cuenta) => {
        const cliente = cuenta.cliente_nombre || "Sin nombre";
        if (!acc[cliente]) {
          acc[cliente] = {
            sinVencimiento: 0,
            vencido1_15: 0,
            vencido16_30: 0,
            vencido31_60: 0,
            vencido61_90: 0,
            vencidoMas90: 0,
            total: 0,
          };
        }

        const monto = cuenta.monto_pendiente || 0;

        if (cuenta.dias_vencimiento === null || cuenta.dias_vencimiento < 0) {
          acc[cliente].sinVencimiento += monto;
        } else {
          const dias = cuenta.dias_vencimiento;
          if (dias >= 1 && dias <= 15) acc[cliente].vencido1_15 += monto;
          else if (dias >= 16 && dias <= 30) acc[cliente].vencido16_30 += monto;
          else if (dias >= 31 && dias <= 60) acc[cliente].vencido31_60 += monto;
          else if (dias >= 61 && dias <= 90) acc[cliente].vencido61_90 += monto;
          else acc[cliente].vencidoMas90 += monto;
        }

        acc[cliente].total += monto;
        return acc;
      }, {} as Record<string, any>);

      const cxcPorClienteApilado = Object.entries(clientesMap)
        .map(([cliente, data]) => ({ cliente, ...data }))
        .sort((a, b) => b.total - a.total);

      // Tendencia mensual (últimos 6 meses) por created_at
      const mesesPasados = 6;
      const tendenciaMensual: { mes: string; monto: number }[] = [];

      for (let i = mesesPasados - 1; i >= 0; i--) {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() - i);
        const year = fecha.getFullYear();
        const month = fecha.getMonth();

        const cuentasDelMes = cuentasConDias.filter((cuenta) => {
          const fechaCuenta = new Date(cuenta.created_at);
          return fechaCuenta.getFullYear() === year && fechaCuenta.getMonth() === month;
        });

        tendenciaMensual.push({
          mes: fecha.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
          monto: cuentasDelMes.reduce((sum, c) => sum + (c.monto_pendiente || 0), 0),
        });
      }

      return {
        totalPendiente,
        totalClientes: clientesUnicos,
        promedioDeuda,
        cuentasPorCliente,
        agingAnalysis,
        tendenciaMensual,
        agingAnalysisDetailed,
        historicoCxC,
        cxcPorClienteApilado,
      };
    },
  });
};

export const useCuentasPorCobrarDetalle = () => {
  return useQuery({
    queryKey: ["cuentas-por-cobrar-detalle"],
    queryFn: async () => {
      // Detalle ya combinado en backend (recomendado)
      const json = await apiFetch("/api/cxc/detalle?pendientes=1", { method: "GET" });
      const cuentas: any[] = (json as any)?.data ?? json ?? [];

      const today = new Date();

      return cuentas.map((cuenta: any) => {
        let diasVencimiento = 0;
        let estado = "Al día";

        if (cuenta.fecha_vencimiento) {
          const fechaVenc = new Date(cuenta.fecha_vencimiento);
          diasVencimiento = Math.floor(
            (today.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (diasVencimiento > 90) estado = "Muy vencida";
          else if (diasVencimiento > 30) estado = "Vencida";
          else if (diasVencimiento >= 1) estado = "Vencida";
          else if (diasVencimiento < 0) estado = "Por vencer";
        } else {
          diasVencimiento = 0;
          estado = "Sin fecha límite";
        }

        return { ...cuenta, diasVencimiento, estado };
      });
    },
  });
};
