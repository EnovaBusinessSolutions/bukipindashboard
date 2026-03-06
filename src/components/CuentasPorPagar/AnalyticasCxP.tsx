import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  DollarSign,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAnalyticsCuentasPorPagar, useCuentasPorPagarDetalle } from "@/hooks/useAnalyticsCuentasPorPagar";

type FormatoNumeros = "normal" | "miles" | "millones";
type PeriodoHistorico = "mensual" | "anual";
type CuentaFiltro = "proveedores" | "acreedores";
type TipoProveedorFiltro = "todos" | "inventario" | "capex" | "operativos";

type RawRow = Record<string, unknown>;

type NormalizedCxPItem = {
  id: string;
  proveedor: string;
  categoria: "inventario" | "capex" | "operativos" | "acreedores";
  montoPendiente: number;
  montoPagado: number;
  montoTotal: number;
  fecha: Date | null;
  fechaVencimiento: Date | null;
};

type AgingBucketKey =
  | "sinVencimiento"
  | "vencido1_15"
  | "vencido16_30"
  | "vencido31_60"
  | "vencido61_90"
  | "vencidoMas90";

type AgingChartRow = {
  key: AgingBucketKey;
  rango: string;
  monto: number;
  cantidad: number;
  min: number | null;
  max: number | null;
};

type HistoricoRow = {
  fecha: string;
  saldo: number;
};

type ProveedorStackRow = {
  proveedor: string;
  sinVencimiento: number;
  vencido1_15: number;
  vencido16_30: number;
  vencido31_60: number;
  vencido61_90: number;
  vencidoMas90: number;
  total: number;
};

const COLORS: Record<AgingBucketKey, string> = {
  sinVencimiento: "hsl(var(--chart-1))",
  vencido1_15: "hsl(var(--chart-2))",
  vencido16_30: "hsl(var(--chart-3))",
  vencido31_60: "hsl(var(--chart-4))",
  vencido61_90: "hsl(var(--chart-5))",
  vencidoMas90: "hsl(var(--destructive))",
};

function asRecord(value: unknown): RawRow | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawRow) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[$,\s]/g, "").trim();
      if (!cleaned) continue;
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function pickDate(...values: unknown[]): Date | null {
  for (const value of values) {
    if (!value) continue;
    const d = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDays(from: Date, to: Date): number {
  const ms = startOfDay(from).getTime() - startOfDay(to).getTime();
  return Math.floor(ms / 86400000);
}

function formatDateLabel(date: Date, periodo: PeriodoHistorico): string {
  if (periodo === "anual") return String(date.getFullYear());
  return date.toLocaleDateString("es-MX", {
    month: "short",
    year: "2-digit",
  });
}

function getPeriodKey(date: Date, periodo: PeriodoHistorico): string {
  if (periodo === "anual") return `${date.getFullYear()}`;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function bucketFromDaysPastDue(days: number | null): AgingBucketKey {
  if (days === null || days <= 0) return "sinVencimiento";
  if (days <= 15) return "vencido1_15";
  if (days <= 30) return "vencido16_30";
  if (days <= 60) return "vencido31_60";
  if (days <= 90) return "vencido61_90";
  return "vencidoMas90";
}

function extractFacturasDeep(value: unknown): RawRow[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractFacturasDeep(item));
  }

  const obj = asRecord(value);
  if (!obj) return [];

  const proveedores = asArray(obj.proveedores);
  if (proveedores.length) {
    return proveedores.flatMap((prov) => {
      const provObj = asRecord(prov);
      if (!provObj) return [];
      const facturas = asArray(provObj.facturas);
      if (facturas.length) {
        return facturas.map((f) => {
          const row = asRecord(f) || {};
          return {
            ...row,
            proveedor_nombre: pickString(
              row.proveedor_nombre,
              provObj.nombre,
              provObj.proveedor_nombre,
              provObj.proveedor
            ),
            proveedor_email: pickString(row.proveedor_email, provObj.email),
            proveedor_telefono: pickString(row.proveedor_telefono, provObj.telefono),
          };
        });
      }
      return [];
    });
  }

  const directFacturas = asArray(obj.facturas);
  if (directFacturas.length) {
    return directFacturas.map((f) => asRecord(f) || {});
  }

  const data = asArray(obj.data);
  if (data.length) return extractFacturasDeep(data);

  const items = asArray(obj.items);
  if (items.length) return extractFacturasDeep(items);

  const detalle = asArray(obj.detalle);
  if (detalle.length) return extractFacturasDeep(detalle);

  const rows = asArray(obj.rows);
  if (rows.length) return extractFacturasDeep(rows);

  if (
    "monto_pendiente" in obj ||
    "montoPendiente" in obj ||
    "total_pendiente" in obj ||
    "totalPendiente" in obj ||
    "proveedor" in obj ||
    "proveedor_nombre" in obj
  ) {
    return [obj];
  }

  return [];
}

function normalizeCategoria(row: RawRow): "inventario" | "capex" | "operativos" | "acreedores" {
  const cuentaObj = asRecord(row.cuenta);
  const proveedorObj = asRecord(row.proveedor);

  const bag = [
    row.tipo,
    row.subtipo,
    row.categoria,
    row.category,
    row.tipo_adeudo,
    row.tipoAdeudo,
    row.tipo_egreso,
    row.tipoEgreso,
    row.source,
    row.fuente,
    row.cuenta_codigo,
    row.cuentaCodigo,
    row.cuenta_id,
    row.cuentaId,
    row.codigo_cuenta,
    row.codigoCuenta,
    row.accountCode,
    row.account_code,
    row.accountCodigo,
    row.account_codigo,
    row.descripcion,
    row.description,
    cuentaObj?.codigo,
    cuentaObj?.code,
    cuentaObj?.nombre,
    cuentaObj?.name,
    proveedorObj?.categoria,
  ]
    .map((x) => String(x || "").toLowerCase())
    .join(" ");

  if (
    bag.includes("acreedores diversos") ||
    bag.includes("acreedores") ||
    bag.includes("2003") ||
    bag.includes("otros gastos") ||
    bag.includes("otro gasto")
  ) {
    return "acreedores";
  }

  if (bag.includes("capex") || bag.includes("inversion")) {
    return "capex";
  }

  if (bag.includes("inventario") || bag.includes("producto inventariado") || bag.includes("compra invent")) {
    return "inventario";
  }

  return "operativos";
}

function normalizeDetalleRows(detalle: unknown): NormalizedCxPItem[] {
  const rawRows = extractFacturasDeep(detalle);

  return rawRows.map((row, index) => {
    const proveedorObj = asRecord(row.proveedor);
    const montoPendiente = pickNumber(
      row.monto_pendiente,
      row.montoPendiente,
      row.saldo_pendiente,
      row.saldoPendiente,
      row.total_pendiente,
      row.totalPendiente,
      row.pendiente
    );
    const montoPagado = pickNumber(
      row.monto_pagado,
      row.montoPagado,
      row.pagado,
      row.total_pagado,
      row.totalPagado
    );
    const montoTotal = pickNumber(
      row.monto_total,
      row.montoTotal,
      row.total,
      row.importe,
      montoPendiente + montoPagado
    );

    return {
      id: pickString(row.id, row._id, row.facturaId, row.transaccionId, `cxp-${index}`),
      proveedor: pickString(
        row.proveedor_nombre,
        row.proveedor,
        row.nombre_proveedor,
        row.nombreProveedor,
        proveedorObj?.nombre,
        proveedorObj?.name,
        "Sin proveedor"
      ),
      categoria: normalizeCategoria(row),
      montoPendiente,
      montoPagado,
      montoTotal,
      fecha: pickDate(
        row.created_at,
        row.createdAt,
        row.fecha,
        row.fecha_registro,
        row.fechaRegistro
      ),
      fechaVencimiento: pickDate(
        row.fecha_vencimiento,
        row.fechaVencimiento,
        row.fecha_limite,
        row.fechaLimite,
        row.dueDate
      ),
    };
  });
}

function getAgingRows(items: NormalizedCxPItem[]): AgingChartRow[] {
  const today = new Date();

  const base: AgingChartRow[] = [
    { key: "sinVencimiento", rango: "Sin vencimiento", monto: 0, cantidad: 0, min: null, max: null },
    { key: "vencido1_15", rango: "Vencidas 1-15 días", monto: 0, cantidad: 0, min: 1, max: 15 },
    { key: "vencido16_30", rango: "Vencidas 16-30 días", monto: 0, cantidad: 0, min: 16, max: 30 },
    { key: "vencido31_60", rango: "Vencidas 31-60 días", monto: 0, cantidad: 0, min: 31, max: 60 },
    { key: "vencido61_90", rango: "Vencidas 61-90 días", monto: 0, cantidad: 0, min: 61, max: 90 },
    { key: "vencidoMas90", rango: "Vencidas +90 días", monto: 0, cantidad: 0, min: 91, max: null },
  ];

  const byKey = Object.fromEntries(base.map((row) => [row.key, row])) as Record<AgingBucketKey, AgingChartRow>;

  items.forEach((item) => {
    if (item.montoPendiente <= 0) return;
    const days = item.fechaVencimiento ? diffDays(today, item.fechaVencimiento) : null;
    const bucket = bucketFromDaysPastDue(days);
    byKey[bucket].monto += item.montoPendiente;
    byKey[bucket].cantidad += 1;
  });

  return base;
}

function getHistoricoRows(items: NormalizedCxPItem[], periodo: PeriodoHistorico): HistoricoRow[] {
  const map = new Map<string, { total: number; date: Date }>();

  items.forEach((item) => {
    if (item.montoPendiente <= 0) return;
    const baseDate = item.fecha || item.fechaVencimiento;
    if (!baseDate) return;

    const key = getPeriodKey(baseDate, periodo);
    const current = map.get(key);

    if (current) {
      current.total += item.montoPendiente;
    } else {
      map.set(key, { total: item.montoPendiente, date: baseDate });
    }
  });

  return Array.from(map.entries())
    .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
    .map(([, value]) => ({
      fecha: formatDateLabel(value.date, periodo),
      saldo: value.total,
    }));
}

function getProveedorStackRows(items: NormalizedCxPItem[]): ProveedorStackRow[] {
  const today = new Date();
  const map = new Map<string, ProveedorStackRow>();

  items.forEach((item) => {
    if (item.montoPendiente <= 0) return;

    const proveedor = item.proveedor || "Sin proveedor";
    const days = item.fechaVencimiento ? diffDays(today, item.fechaVencimiento) : null;
    const bucket = bucketFromDaysPastDue(days);

    const current =
      map.get(proveedor) ||
      {
        proveedor,
        sinVencimiento: 0,
        vencido1_15: 0,
        vencido16_30: 0,
        vencido31_60: 0,
        vencido61_90: 0,
        vencidoMas90: 0,
        total: 0,
      };

    current[bucket] += item.montoPendiente;
    current.total += item.montoPendiente;
    map.set(proveedor, current);
  });

  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function niceMax(values: number[]): number {
  const max = Math.max(...values, 0);
  if (max <= 0) return 100;
  return Math.ceil(max * 1.15);
}

export default function AnalyticasCxP() {
  const [formatoNumeros, setFormatoNumeros] = useState<FormatoNumeros>("normal");
  const [decimales, setDecimales] = useState<0 | 1 | 2>(2);
  const [periodoHistorico, setPeriodoHistorico] = useState<PeriodoHistorico>("mensual");
  const [cuentaFiltro, setCuentaFiltro] = useState<CuentaFiltro>("proveedores");
  const [tipoProveedorFiltro, setTipoProveedorFiltro] = useState<TipoProveedorFiltro>("todos");
  const [filtroProveedorGrafica, setFiltroProveedorGrafica] = useState<string>("todos");

  const { data: analytics, isLoading } = useAnalyticsCuentasPorPagar(periodoHistorico, "todos");
  const { data: detalle } = useCuentasPorPagarDetalle();

  const analyticsRow = useMemo(() => asRecord(analytics as unknown), [analytics]);

  const detalleNormalizado = useMemo(() => normalizeDetalleRows(detalle), [detalle]);

  const detalleFiltrado = useMemo(() => {
    let rows = [...detalleNormalizado];

    rows = rows.filter((row) => {
      if (cuentaFiltro === "acreedores") return row.categoria === "acreedores";
      return row.categoria !== "acreedores";
    });

    if (cuentaFiltro === "proveedores" && tipoProveedorFiltro !== "todos") {
      rows = rows.filter((row) => row.categoria === tipoProveedorFiltro);
    }

    return rows;
  }, [detalleNormalizado, cuentaFiltro, tipoProveedorFiltro]);

  const proveedoresUnicos = useMemo(() => {
    return Array.from(new Set(detalleFiltrado.map((row) => row.proveedor).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [detalleFiltrado]);

  const detalleProveedorGrafica = useMemo(() => {
    if (filtroProveedorGrafica === "todos") return detalleFiltrado;
    return detalleFiltrado.filter((row) => row.proveedor === filtroProveedorGrafica);
  }, [detalleFiltrado, filtroProveedorGrafica]);

  const agingDataLocal = useMemo(() => getAgingRows(detalleFiltrado), [detalleFiltrado]);
  const historicoLocal = useMemo(
    () => getHistoricoRows(detalleFiltrado, periodoHistorico),
    [detalleFiltrado, periodoHistorico]
  );
  const proveedorStackLocal = useMemo(() => getProveedorStackRows(detalleFiltrado), [detalleFiltrado]);
  const agingProveedorLocal = useMemo(
    () => getAgingRows(detalleProveedorGrafica),
    [detalleProveedorGrafica]
  );

  const hasLocalData = detalleFiltrado.length > 0;

  const totalPendiente = hasLocalData
    ? detalleFiltrado.reduce((sum, item) => sum + item.montoPendiente, 0)
    : pickNumber(analyticsRow?.totalPendiente);

  const totalEntidades = hasLocalData
    ? new Set(detalleFiltrado.map((item) => item.proveedor)).size
    : pickNumber(analyticsRow?.totalProveedores);

  const promedioDeuda = totalEntidades > 0 ? totalPendiente / totalEntidades : 0;

  const agingData = hasLocalData
    ? agingDataLocal
    : (asArray(analyticsRow?.agingAnalysisDetailed) as AgingChartRow[]);

  const historicoCxP = hasLocalData
    ? historicoLocal
    : (asArray(analyticsRow?.historicoCxP) as HistoricoRow[]);

  const cxpPorProveedorApilado = hasLocalData
    ? proveedorStackLocal
    : (asArray(analyticsRow?.cxpPorProveedorApilado) as ProveedorStackRow[]);

  const agingByProveedor = hasLocalData
    ? agingProveedorLocal
    : (asArray(analyticsRow?.agingAnalysisDetailed) as AgingChartRow[]);

  const cuentasVencidas = agingData
    .filter((row) => row.min !== null && row.min > 0)
    .reduce((sum, row) => sum + row.cantidad, 0);

  const nombreEntidad = cuentaFiltro === "acreedores" ? "acreedor" : "proveedor";
  const nombreEntidadPlural = cuentaFiltro === "acreedores" ? "acreedores" : "proveedores";

  const formatValue = (valor: number | undefined | null): string => {
    const n = typeof valor === "number" ? valor : 0;

    let finalValue = n;
    let suffix = "";

    if (formatoNumeros === "miles") {
      finalValue = n / 1000;
      suffix = "K";
    } else if (formatoNumeros === "millones") {
      finalValue = n / 1000000;
      suffix = "M";
    }

    return `$${finalValue.toLocaleString("en-US", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })}${suffix}`;
  };

  const formatAxis = (valor: number): string => {
    const n = Number(valor || 0);
    if (formatoNumeros === "millones") return `${(n / 1000000).toFixed(0)}M`;
    if (formatoNumeros === "miles") return `${(n / 1000).toFixed(0)}K`;
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  };

  const maxAging = niceMax(agingData.map((row) => row.monto));
  const maxHistorico = niceMax(historicoCxP.map((row) => row.saldo));
  const maxProveedor = niceMax(cxpPorProveedorApilado.map((row) => row.total));
  const maxProveedorAging = niceMax(agingByProveedor.map((row) => row.monto));

  if (isLoading && !detalle) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[180px] w-full rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[380px] w-full rounded-3xl" />
        <Skeleton className="h-[380px] w-full rounded-3xl" />
      </div>
    );
  }

  if (!hasLocalData && !analytics) {
    return (
      <Card className="rounded-3xl border-dashed">
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">No hay datos de cuentas por pagar disponibles.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[28px] border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-xl">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <Badge className="w-fit rounded-full border-white/15 bg-white/10 px-3 py-1 text-white hover:bg-white/10">
                Analítica financiera CxP
              </Badge>
              <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Analíticas de Cuentas por Pagar</h2>
                <p className="max-w-3xl text-sm text-slate-200 md:text-base">
                  Visualiza el comportamiento de tus adeudos con {nombreEntidadPlural}, identifica saldos vencidos y
                  analiza la concentración del pasivo por cuenta y tipo.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[660px]">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Cuenta</div>
                <div className="mt-2">
                  <Select value={cuentaFiltro} onValueChange={(v) => setCuentaFiltro(v as CuentaFiltro)}>
                    <SelectTrigger className="h-10 border-white/10 bg-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proveedores">Proveedores</SelectItem>
                      <SelectItem value="acreedores">Acreedores diversos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Tipo</div>
                <div className="mt-2">
                  <Select
                    value={tipoProveedorFiltro}
                    onValueChange={(v) => setTipoProveedorFiltro(v as TipoProveedorFiltro)}
                    disabled={cuentaFiltro === "acreedores"}
                  >
                    <SelectTrigger className="h-10 border-white/10 bg-white/10 text-white disabled:opacity-60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="inventario">Inventario</SelectItem>
                      <SelectItem value="capex">CAPEX</SelectItem>
                      <SelectItem value="operativos">Egresos operativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Escala</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Select value={formatoNumeros} onValueChange={(v) => setFormatoNumeros(v as FormatoNumeros)}>
                    <SelectTrigger className="h-10 border-white/10 bg-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="miles">Miles</SelectItem>
                      <SelectItem value="millones">Millones</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={String(decimales)} onValueChange={(v) => setDecimales(Number(v) as 0 | 1 | 2)}>
                    <SelectTrigger className="h-10 border-white/10 bg-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 dec</SelectItem>
                      <SelectItem value="1">1 dec</SelectItem>
                      <SelectItem value="2">2 dec</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-100 hover:bg-emerald-500/15">
              {cuentaFiltro === "acreedores" ? "Cuenta contable: Acreedores diversos" : "Cuenta contable: Proveedores"}
            </Badge>
            {cuentaFiltro === "proveedores" && (
              <Badge className="rounded-full bg-sky-500/15 px-3 py-1 text-sky-100 hover:bg-sky-500/15">
                Vista: {tipoProveedorFiltro === "todos" ? "Proveedores total" : tipoProveedorFiltro}
              </Badge>
            )}
            <Badge className="rounded-full bg-white/10 px-3 py-1 text-slate-100 hover:bg-white/10">
              {totalEntidades} {nombreEntidadPlural} activos
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="rounded-3xl border-0 shadow-sm ring-1 ring-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total por Pagar</CardTitle>
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{formatValue(totalPendiente)}</div>
            <p className="mt-2 text-xs text-muted-foreground">Saldo total pendiente del segmento filtrado</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm ring-1 ring-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Total {cuentaFiltro === "acreedores" ? "Acreedores" : "Proveedores"}
              </CardTitle>
              <div className="rounded-xl bg-sky-500/10 p-2 text-sky-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{totalEntidades}</div>
            <p className="mt-2 text-xs text-muted-foreground">{nombreEntidadPlural} con saldo o historial visible</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm ring-1 ring-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Promedio por {cuentaFiltro === "acreedores" ? "Acreedor" : "Proveedor"}</CardTitle>
              <div className="rounded-xl bg-violet-500/10 p-2 text-violet-600">
                <Target className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{formatValue(promedioDeuda)}</div>
            <p className="mt-2 text-xs text-muted-foreground">Deuda promedio del grupo seleccionado</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-destructive/25 shadow-sm bg-destructive/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Cuentas Vencidas</CardTitle>
              <div className="rounded-xl bg-destructive/10 p-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-destructive">{cuentasVencidas}</div>
            <p className="mt-2 text-xs text-muted-foreground">Registros que requieren atención prioritaria</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm ring-1 ring-border/60 bg-gradient-to-br from-slate-50 to-slate-100/80 dark:from-slate-900 dark:to-slate-900/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Resumen de vista</CardTitle>
              <div className="rounded-xl bg-slate-900/10 p-2 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                <WalletCards className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm font-semibold">
              {cuentaFiltro === "acreedores"
                ? "Acreedores diversos"
                : tipoProveedorFiltro === "todos"
                ? "Proveedores total"
                : tipoProveedorFiltro === "inventario"
                ? "Compras de inventario"
                : tipoProveedorFiltro === "capex"
                ? "Inversiones CAPEX"
                : "Egresos operativos"}
            </div>
            <p className="text-xs text-muted-foreground">
              Gráficas alineadas al segmento activo y al documento funcional.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[28px] border-0 shadow-sm ring-1 ring-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl tracking-tight">Antigüedad de Cuentas por Pagar</CardTitle>
            <CardDescription>Distribución del saldo por días de vencimiento</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={agingData} barGap={18}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-muted/40" />
                <XAxis dataKey="rango" tick={{ fontSize: 12 }} angle={-22} textAnchor="end" height={72} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={formatAxis} width={70} domain={[0, maxAging]} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.18)" }}
                  formatter={(value: number) => [formatValue(value), "Monto"]}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--background))",
                    boxShadow: "0 12px 32px rgba(0,0,0,.08)",
                  }}
                />
                <Bar dataKey="monto" radius={[12, 12, 0, 0]} maxBarSize={72}>
                  {agingData.map((row) => (
                    <Cell key={row.key} fill={COLORS[row.key]} />
                  ))}
                  <LabelList
                    dataKey="monto"
                    position="top"
                    formatter={(value: number) => formatAxis(value)}
                    className="fill-foreground text-[11px] font-medium"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 shadow-sm ring-1 ring-border/60">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl tracking-tight">Histórico de Cuentas por Pagar</CardTitle>
                <CardDescription>Evolución del saldo en el tiempo</CardDescription>
              </div>

              <Select value={periodoHistorico} onValueChange={(v) => setPeriodoHistorico(v as PeriodoHistorico)}>
                <SelectTrigger className="w-[150px] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={360}>
              <AreaChart data={historicoCxP}>
                <defs>
                  <linearGradient id="cxpSaldoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-muted/40" />
                <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={formatAxis} width={70} domain={[0, maxHistorico]} />
                <Tooltip
                  formatter={(value: number) => [formatValue(value), "Saldo"]}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--background))",
                    boxShadow: "0 12px 32px rgba(0,0,0,.08)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  fill="url(#cxpSaldoGradient)"
                  activeDot={{ r: 6 }}
                >
                  <LabelList
                    dataKey="saldo"
                    position="top"
                    formatter={(value: number) => formatAxis(value)}
                    className="fill-foreground text-[11px] font-medium"
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[28px] border-0 shadow-sm ring-1 ring-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl tracking-tight">
              Cuentas por Pagar por {cuentaFiltro === "acreedores" ? "Acreedor" : "Proveedor"}
            </CardTitle>
            <CardDescription>Desglose apilado por antigüedad de saldos</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="mb-4 flex flex-wrap gap-2">
              {(
                [
                  ["sinVencimiento", "Sin vencimiento"],
                  ["vencido1_15", "1-15 días"],
                  ["vencido16_30", "16-30 días"],
                  ["vencido31_60", "31-60 días"],
                  ["vencido61_90", "61-90 días"],
                  ["vencidoMas90", "+90 días"],
                ] as Array<[AgingBucketKey, string]>
              ).map(([key, label]) => (
                <div
                  key={key}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[key] }} />
                  {label}
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={cxpPorProveedorApilado} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid strokeDasharray="4 4" horizontal={false} className="stroke-muted/40" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={formatAxis} domain={[0, maxProveedor]} />
                <YAxis
                  type="category"
                  dataKey="proveedor"
                  width={150}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => [formatValue(value), "Monto"]}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--background))",
                    boxShadow: "0 12px 32px rgba(0,0,0,.08)",
                  }}
                />
                <Legend />
                <Bar dataKey="sinVencimiento" stackId="a" fill={COLORS.sinVencimiento} name="Sin vencimiento" radius={[0, 0, 0, 0]} />
                <Bar dataKey="vencido1_15" stackId="a" fill={COLORS.vencido1_15} name="1-15 días" />
                <Bar dataKey="vencido16_30" stackId="a" fill={COLORS.vencido16_30} name="16-30 días" />
                <Bar dataKey="vencido31_60" stackId="a" fill={COLORS.vencido31_60} name="31-60 días" />
                <Bar dataKey="vencido61_90" stackId="a" fill={COLORS.vencido61_90} name="61-90 días" />
                <Bar dataKey="vencidoMas90" stackId="a" fill={COLORS.vencidoMas90} name="+90 días" />
                <Bar dataKey="total" fill="transparent" legendType="none">
                  <LabelList
                    dataKey="total"
                    position="right"
                    formatter={(value: number) => formatValue(value)}
                    className="fill-foreground text-[11px] font-semibold"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 shadow-sm ring-1 ring-border/60">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl tracking-tight">
                  Vencimientos por {cuentaFiltro === "acreedores" ? "Acreedor" : "Proveedor"}
                </CardTitle>
                <CardDescription>
                  Antigüedad del saldo del {filtroProveedorGrafica === "todos" ? `${nombreEntidad} seleccionado` : nombreEntidad}
                </CardDescription>
              </div>

              <Select
                value={filtroProveedorGrafica}
                onValueChange={setFiltroProveedorGrafica}
              >
                <SelectTrigger className="w-[260px] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">
                    Todos los {nombreEntidadPlural}
                  </SelectItem>
                  {proveedoresUnicos.map((proveedor) => (
                    <SelectItem key={proveedor} value={proveedor}>
                      {proveedor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={agingByProveedor} barGap={18}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-muted/40" />
                <XAxis dataKey="rango" tick={{ fontSize: 12 }} angle={-22} textAnchor="end" height={72} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={formatAxis} width={70} domain={[0, maxProveedorAging]} />
                <Tooltip
                  formatter={(value: number) => [formatValue(value), "Monto"]}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--background))",
                    boxShadow: "0 12px 32px rgba(0,0,0,.08)",
                  }}
                />
                <Bar dataKey="monto" radius={[12, 12, 0, 0]} maxBarSize={72}>
                  {agingByProveedor.map((row) => (
                    <Cell key={`${row.key}-proveedor`} fill={COLORS[row.key]} />
                  ))}
                  <LabelList
                    dataKey="monto"
                    position="top"
                    formatter={(value: number) => formatAxis(value)}
                    className="fill-foreground text-[11px] font-medium"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {!hasLocalData && (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-5">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                La vista está usando el hook de analytics como respaldo. Cuando el detalle completo esté presente,
                esta pantalla se recalculará localmente con los filtros de cuenta y tipo sin depender de datos agregados.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}