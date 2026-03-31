import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ======================================================
// Types
// ======================================================

export interface DashboardCaja {
  efectivo: number;
  bancos: number;
  total: number;
}

export interface DashboardKpis {
  ventasDia: number;
  ventasMes: number;
  ventasAno: number;
  caja: DashboardCaja;
  descuentosMes: number;
  ingresoNetoMes: number;
  totalIngresosMes: number;
}

export interface DashboardVentas {
  ventasDelDia: number;
  ventasDelMes: number;
  ventasDelAno: number;

  descuentosDelDia: number;
  descuentosDelMes: number;
  descuentosDelAno: number;

  otrosIngresosDelDia: number;
  otrosIngresosDelMes: number;
  otrosIngresosDelAno: number;

  ingresoNetoDelDia: number;
  ingresoNetoDelMes: number;
  ingresoNetoDelAno: number;

  totalIngresosDelDia: number;
  totalIngresosDelMes: number;
  totalIngresosDelAno: number;
}

export interface DashboardEstadoResultadosSerie {
  mes: string;
  monthKey: string;
  ingresos: number;
  egresos: number;
  utilidadBruta: number;
  ebitda: number;
  utilidadNeta: number;
}

export interface DashboardEstadoResultadosTotales {
  ingresos: number;
  egresos: number;
  utilidadBruta: number;
  ebitda: number;
  utilidadNeta: number;
}

export interface DashboardEstadoResultados {
  series: DashboardEstadoResultadosSerie[];
  totales: DashboardEstadoResultadosTotales;
}

export interface DashboardFlujoSerie {
  mes: string;
  monthKey: string;
  operativo: number;
  inversion: number;
  financiamiento: number;
  neto: number;
  acumulado: number;
}

export interface DashboardFlujo {
  saldoInicial: number;
  saldoFinal: number;
  seriesMensuales: DashboardFlujoSerie[];
}

export interface DashboardBalanceEstructura {
  activoCirculante: number;
  activoNoCirculante: number;
  pasivoCirculante: number;
  pasivoNoCirculante: number;
  capitalContable: number;
}

export interface DashboardBalanceGeneral {
  activos: number;
  pasivos: number;
  capital: number;
  estructura: DashboardBalanceEstructura;
}

export interface DashboardCxC {
  total: number;
  corriente: number;
  vencido: number;
  cantidad: number;
}

export interface DashboardCxP {
  total: number;
  corriente: number;
  vencido: number;
  cantidad: number;
}

export interface DashboardInventario {
  bien: number;
  bajo: number;
  negativo: number;
  totalProductos: number;
}

export interface DashboardPasivoBancarioItem {
  id: string;
  institucion: string;
  nombre: string;
  tipo: string;
  totalContratado: number;
  saldoActual: number;
  pagado: number;
  capitalPagado: number;
  saldoCapitalActual: number;
  disponibleActual: number;
  estatus: string;
}

export interface DashboardPasivosBancarios {
  totalDeuda: number;
  totalPagado: number;
  totalPendiente: number;
  items: DashboardPasivoBancarioItem[];
}

export interface DashboardPendientes {
  radiografiaNegocio: boolean;
  recomendacionesIA: boolean;
}

export interface DashboardMeta {
  generatedAt: string | null;
  timezoneOffsetMinutes: number;
}

export interface DashboardFinancieroData {
  kpis: DashboardKpis;
  ventas: DashboardVentas;
  estadoResultados: DashboardEstadoResultados;
  flujo: DashboardFlujo;
  balanceGeneral: DashboardBalanceGeneral;
  cxc: DashboardCxC;
  cxp: DashboardCxP;
  inventario: DashboardInventario;
  pasivosBancarios: DashboardPasivosBancarios;
  pendientes: DashboardPendientes;
  meta: DashboardMeta;
}

type ApiEnvelope<T> =
  | { ok?: boolean; data?: T; message?: string }
  | T;

// ======================================================
// Helpers
// ======================================================

const unwrap = <T,>(json: ApiEnvelope<T>): T =>
  (json as any)?.data ?? (json as T);

const n = (v: any, def = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : def;
};

const asArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);

const emptyEstadoResultados = (): DashboardEstadoResultados => ({
  series: [],
  totales: {
    ingresos: 0,
    egresos: 0,
    utilidadBruta: 0,
    ebitda: 0,
    utilidadNeta: 0,
  },
});

const emptyFlujo = (): DashboardFlujo => ({
  saldoInicial: 0,
  saldoFinal: 0,
  seriesMensuales: [],
});

const EMPTY_DASHBOARD: DashboardFinancieroData = {
  kpis: {
    ventasDia: 0,
    ventasMes: 0,
    ventasAno: 0,
    caja: {
      efectivo: 0,
      bancos: 0,
      total: 0,
    },
    descuentosMes: 0,
    ingresoNetoMes: 0,
    totalIngresosMes: 0,
  },

  ventas: {
    ventasDelDia: 0,
    ventasDelMes: 0,
    ventasDelAno: 0,

    descuentosDelDia: 0,
    descuentosDelMes: 0,
    descuentosDelAno: 0,

    otrosIngresosDelDia: 0,
    otrosIngresosDelMes: 0,
    otrosIngresosDelAno: 0,

    ingresoNetoDelDia: 0,
    ingresoNetoDelMes: 0,
    ingresoNetoDelAno: 0,

    totalIngresosDelDia: 0,
    totalIngresosDelMes: 0,
    totalIngresosDelAno: 0,
  },

  estadoResultados: emptyEstadoResultados(),

  flujo: emptyFlujo(),

  balanceGeneral: {
    activos: 0,
    pasivos: 0,
    capital: 0,
    estructura: {
      activoCirculante: 0,
      activoNoCirculante: 0,
      pasivoCirculante: 0,
      pasivoNoCirculante: 0,
      capitalContable: 0,
    },
  },

  cxc: {
    total: 0,
    corriente: 0,
    vencido: 0,
    cantidad: 0,
  },

  cxp: {
    total: 0,
    corriente: 0,
    vencido: 0,
    cantidad: 0,
  },

  inventario: {
    bien: 0,
    bajo: 0,
    negativo: 0,
    totalProductos: 0,
  },

  pasivosBancarios: {
    totalDeuda: 0,
    totalPagado: 0,
    totalPendiente: 0,
    items: [],
  },

  pendientes: {
    radiografiaNegocio: true,
    recomendacionesIA: true,
  },

  meta: {
    generatedAt: null,
    timezoneOffsetMinutes: -360,
  },
};

function normalizeDashboard(raw: any): DashboardFinancieroData {
  const kpisRaw = raw?.kpis ?? {};
  const ventasRaw = raw?.ventas ?? {};
  const erRaw = raw?.estadoResultados ?? {};
  const flujoRaw = raw?.flujo ?? {};
  const balanceRaw = raw?.balanceGeneral ?? {};
  const cxcRaw = raw?.cxc ?? {};
  const cxpRaw = raw?.cxp ?? {};
  const inventarioRaw = raw?.inventario ?? {};
  const pasivosRaw = raw?.pasivosBancarios ?? {};
  const pendientesRaw = raw?.pendientes ?? {};
  const metaRaw = raw?.meta ?? {};

  return {
    kpis: {
      ventasDia: n(kpisRaw?.ventasDia),
      ventasMes: n(kpisRaw?.ventasMes),
      ventasAno: n(kpisRaw?.ventasAno),
      caja: {
        efectivo: n(kpisRaw?.caja?.efectivo),
        bancos: n(kpisRaw?.caja?.bancos),
        total: n(kpisRaw?.caja?.total),
      },
      descuentosMes: n(kpisRaw?.descuentosMes),
      ingresoNetoMes: n(kpisRaw?.ingresoNetoMes),
      totalIngresosMes: n(kpisRaw?.totalIngresosMes),
    },

    ventas: {
      ventasDelDia: n(ventasRaw?.ventasDelDia),
      ventasDelMes: n(ventasRaw?.ventasDelMes),
      ventasDelAno: n(ventasRaw?.ventasDelAno),

      descuentosDelDia: n(ventasRaw?.descuentosDelDia),
      descuentosDelMes: n(ventasRaw?.descuentosDelMes),
      descuentosDelAno: n(ventasRaw?.descuentosDelAno),

      otrosIngresosDelDia: n(ventasRaw?.otrosIngresosDelDia),
      otrosIngresosDelMes: n(ventasRaw?.otrosIngresosDelMes),
      otrosIngresosDelAno: n(ventasRaw?.otrosIngresosDelAno),

      ingresoNetoDelDia: n(ventasRaw?.ingresoNetoDelDia),
      ingresoNetoDelMes: n(ventasRaw?.ingresoNetoDelMes),
      ingresoNetoDelAno: n(ventasRaw?.ingresoNetoDelAno),

      totalIngresosDelDia: n(ventasRaw?.totalIngresosDelDia),
      totalIngresosDelMes: n(ventasRaw?.totalIngresosDelMes),
      totalIngresosDelAno: n(ventasRaw?.totalIngresosDelAno),
    },

    estadoResultados: {
      series: asArray<any>(erRaw?.series).map((item) => ({
        mes: String(item?.mes ?? ""),
        monthKey: String(item?.monthKey ?? ""),
        ingresos: n(item?.ingresos),
        egresos: n(item?.egresos),
        utilidadBruta: n(item?.utilidadBruta),
        ebitda: n(item?.ebitda),
        utilidadNeta: n(item?.utilidadNeta),
      })),
      totales: {
        ingresos: n(erRaw?.totales?.ingresos),
        egresos: n(erRaw?.totales?.egresos),
        utilidadBruta: n(erRaw?.totales?.utilidadBruta),
        ebitda: n(erRaw?.totales?.ebitda),
        utilidadNeta: n(erRaw?.totales?.utilidadNeta),
      },
    },

    flujo: {
      saldoInicial: n(flujoRaw?.saldoInicial),
      saldoFinal: n(flujoRaw?.saldoFinal),
      seriesMensuales: asArray<any>(flujoRaw?.seriesMensuales).map((item) => ({
        mes: String(item?.mes ?? ""),
        monthKey: String(item?.monthKey ?? ""),
        operativo: n(item?.operativo),
        inversion: n(item?.inversion),
        financiamiento: n(item?.financiamiento),
        neto: n(item?.neto),
        acumulado: n(item?.acumulado),
      })),
    },

    balanceGeneral: {
      activos: n(balanceRaw?.activos),
      pasivos: n(balanceRaw?.pasivos),
      capital: n(balanceRaw?.capital),
      estructura: {
        activoCirculante: n(balanceRaw?.estructura?.activoCirculante),
        activoNoCirculante: n(balanceRaw?.estructura?.activoNoCirculante),
        pasivoCirculante: n(balanceRaw?.estructura?.pasivoCirculante),
        pasivoNoCirculante: n(balanceRaw?.estructura?.pasivoNoCirculante),
        capitalContable: n(balanceRaw?.estructura?.capitalContable),
      },
    },

    cxc: {
      total: n(cxcRaw?.total),
      corriente: n(cxcRaw?.corriente),
      vencido: n(cxcRaw?.vencido),
      cantidad: n(cxcRaw?.cantidad),
    },

    cxp: {
      total: n(cxpRaw?.total),
      corriente: n(cxpRaw?.corriente),
      vencido: n(cxpRaw?.vencido),
      cantidad: n(cxpRaw?.cantidad),
    },

    inventario: {
      bien: n(inventarioRaw?.bien),
      bajo: n(inventarioRaw?.bajo),
      negativo: n(inventarioRaw?.negativo),
      totalProductos: n(inventarioRaw?.totalProductos),
    },

    pasivosBancarios: {
      totalDeuda: n(pasivosRaw?.totalDeuda),
      totalPagado: n(pasivosRaw?.totalPagado),
      totalPendiente: n(pasivosRaw?.totalPendiente),
      items: asArray<any>(pasivosRaw?.items).map((item) => ({
        id: String(item?.id ?? ""),
        institucion: String(item?.institucion ?? ""),
        nombre: String(item?.nombre ?? ""),
        tipo: String(item?.tipo ?? ""),
        totalContratado: n(item?.totalContratado),
        saldoActual: n(item?.saldoActual),
        pagado: n(item?.pagado),
        capitalPagado: n(item?.capitalPagado),
        saldoCapitalActual: n(item?.saldoCapitalActual),
        disponibleActual: n(item?.disponibleActual),
        estatus: String(item?.estatus ?? ""),
      })),
    },

    pendientes: {
      radiografiaNegocio:
        typeof pendientesRaw?.radiografiaNegocio === "boolean"
          ? pendientesRaw.radiografiaNegocio
          : true,
      recomendacionesIA:
        typeof pendientesRaw?.recomendacionesIA === "boolean"
          ? pendientesRaw.recomendacionesIA
          : true,
    },

    meta: {
      generatedAt: metaRaw?.generatedAt ? String(metaRaw.generatedAt) : null,
      timezoneOffsetMinutes: n(metaRaw?.timezoneOffsetMinutes, -360),
    },
  };
}

// ======================================================
// Hook
// ======================================================

export const useDashboardFinanciero = () => {
  const query = useQuery({
    queryKey: ["dashboard-financiero"],
    queryFn: async (): Promise<DashboardFinancieroData> => {
      const json = await apiFetch("/api/dashboard/resumen", {
        method: "GET",
      });

      const raw = unwrap<any>(json);

      if (!raw || typeof raw !== "object") {
        return EMPTY_DASHBOARD;
      }

      return normalizeDashboard(raw);
    },

    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const dashboard = query.data ?? EMPTY_DASHBOARD;

  return {
    dashboard,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,

    // aliases útiles para consumo cómodo
    kpis: dashboard.kpis,
    ventas: dashboard.ventas,
    estadoResultados: dashboard.estadoResultados,
    flujo: dashboard.flujo,
    balanceGeneral: dashboard.balanceGeneral,
    cxc: dashboard.cxc,
    cxp: dashboard.cxp,
    inventario: dashboard.inventario,
    pasivosBancarios: dashboard.pasivosBancarios,
    pendientes: dashboard.pendientes,
    meta: dashboard.meta,
  };
};

export default useDashboardFinanciero;