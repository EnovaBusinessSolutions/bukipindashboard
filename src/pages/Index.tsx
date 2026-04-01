import { useMemo, useState, type ReactNode } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Target,
  BarChart3,
  Landmark,
  Wallet,
  Boxes,
  CreditCard,
  Activity,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CircleDollarSign,
  LineChart as LineChartIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import useDashboardFinanciero from "@/hooks/useDashboardFinanciero";

type ProfitMetricKey = "utilidadNeta" | "ebitda" | "utilidadBruta";

const Index = () => {
  const {
    dashboard,
    kpis,
    estadoResultados,
    flujo,
    balanceGeneral,
    cxc,
    cxp,
    inventario,
    pasivosBancarios,
    pendientes,
    loading,
    error,
    refetch,
  } = useDashboardFinanciero();

  const [profitMetric, setProfitMetric] = useState<ProfitMetricKey>("utilidadNeta");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  };

  const formatCompactCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(Number(value || 0));
  };

  const formatPercent = (value: number) => `${Number(value || 0).toFixed(1)}%`;

  const metricMeta: Record<
    ProfitMetricKey,
    {
      label: string;
      shortLabel: string;
      color: string;
      softBg: string;
      border: string;
      glow: string;
      description: string;
    }
  > = {
    utilidadNeta: {
      label: "Utilidad neta",
      shortLabel: "UN",
      color: "#22c55e",
      softBg: "rgba(34,197,94,0.10)",
      border: "rgba(34,197,94,0.26)",
      glow: "0 0 0 1px rgba(34,197,94,0.20), 0 12px 32px rgba(34,197,94,0.10)",
      description: "Resultado final después de costos y gastos.",
    },
    ebitda: {
      label: "EBITDA",
      shortLabel: "EBITDA",
      color: "#a855f7",
      softBg: "rgba(168,85,247,0.10)",
      border: "rgba(168,85,247,0.26)",
      glow: "0 0 0 1px rgba(168,85,247,0.20), 0 12px 32px rgba(168,85,247,0.10)",
      description: "Indicador operativo antes de depreciaciones, intereses e impuestos.",
    },
    utilidadBruta: {
      label: "Utilidad bruta",
      shortLabel: "UB",
      color: "#f59e0b",
      softBg: "rgba(245,158,11,0.10)",
      border: "rgba(245,158,11,0.26)",
      glow: "0 0 0 1px rgba(245,158,11,0.20), 0 12px 32px rgba(245,158,11,0.10)",
      description: "Ingresos menos costo directo de venta.",
    },
  };

  const margenMes = useMemo(() => {
    const totalIngresosMes = Number(kpis?.totalIngresosMes || 0);
    const ingresoNetoMes = Number(kpis?.ingresoNetoMes || 0);
    if (totalIngresosMes <= 0) return 0;
    return (ingresoNetoMes / totalIngresosMes) * 100;
  }, [kpis?.ingresoNetoMes, kpis?.totalIngresosMes]);

  const margenBrutoMes = useMemo(() => {
    const ingresos = Number(kpis?.totalIngresosMes || 0);
    const utilidadBruta = Number(
      estadoResultados?.totales?.utilidadBruta ??
        estadoResultados?.series?.[estadoResultados?.series?.length - 1]?.utilidadBruta ??
        0
    );
    if (ingresos <= 0) return 0;
    return (utilidadBruta / ingresos) * 100;
  }, [kpis?.totalIngresosMes, estadoResultados?.totales?.utilidadBruta, estadoResultados?.series]);

  const estadoResultadosChartData = useMemo(() => {
    return (estadoResultados?.series || []).map((item) => {
      const ingresos = Number(item.ingresos || 0);
      const egresos = Number(item.egresos || 0);
      const utilidadNeta = Number(item.utilidadNeta || 0);
      const ebitda = Number(item.ebitda || 0);
      const utilidadBruta = Number(item.utilidadBruta || 0);

      return {
        mes: item.mes,
        ingresos,
        egresos,
        utilidadNeta,
        ebitda,
        utilidadBruta,
        linea: Number(item?.[profitMetric] || 0),
        margenLinea: ingresos > 0 ? (Number(item?.[profitMetric] || 0) / ingresos) * 100 : 0,
      };
    });
  }, [estadoResultados?.series, profitMetric]);

  const estadoResultadosMax = useMemo(() => {
    if (!estadoResultadosChartData.length) return 0;
    return Math.max(
      ...estadoResultadosChartData.flatMap((item) => [
        Number(item.ingresos || 0),
        Number(item.egresos || 0),
        Number(item.linea || 0),
      ]),
      0
    );
  }, [estadoResultadosChartData]);

  const estadoResultadosSummary = useMemo(() => {
    const ingresos = Number(estadoResultados?.totales?.ingresos || 0);
    const egresos = Number(estadoResultados?.totales?.egresos || 0);
    const utilidadNeta = Number(estadoResultados?.totales?.utilidadNeta || 0);
    const ebitda = Number(estadoResultados?.totales?.ebitda || 0);
    const utilidadBruta = Number(estadoResultados?.totales?.utilidadBruta || 0);

    return {
      ingresos,
      egresos,
      utilidadNeta,
      ebitda,
      utilidadBruta,
      selectedValue:
        profitMetric === "utilidadNeta"
          ? utilidadNeta
          : profitMetric === "ebitda"
          ? ebitda
          : utilidadBruta,
      selectedMargin:
        ingresos > 0
          ? ((profitMetric === "utilidadNeta"
              ? utilidadNeta
              : profitMetric === "ebitda"
              ? ebitda
              : utilidadBruta) /
              ingresos) *
            100
          : 0,
    };
  }, [estadoResultados?.totales, profitMetric]);

  const flujoWaterfallData = useMemo(() => {
    return (flujo?.seriesMensuales || []).map((item) => ({
      mes: item.mes,
      neto: Number(item.neto || 0),
      acumulado: Number(item.acumulado || 0),
      fill: Number(item.neto || 0) >= 0 ? "#22c55e" : "#ef4444",
    }));
  }, [flujo?.seriesMensuales]);

  const balanceStructureData = useMemo(() => {
    const estructura = balanceGeneral?.estructura;
    return [
      {
        name: "Activo circulante",
        value: Number(estructura?.activoCirculante || 0),
      },
      {
        name: "Activo no circulante",
        value: Number(estructura?.activoNoCirculante || 0),
      },
      {
        name: "Pasivo circulante",
        value: Number(estructura?.pasivoCirculante || 0),
      },
      {
        name: "Pasivo no circulante",
        value: Number(estructura?.pasivoNoCirculante || 0),
      },
      {
        name: "Capital contable",
        value: Number(estructura?.capitalContable || 0),
      },
    ];
  }, [balanceGeneral?.estructura]);

  const balanceBlocks = useMemo(() => {
    const activos = Number(balanceGeneral?.activos || 0);
    const pasivos = Number(balanceGeneral?.pasivos || 0);
    const capital = Number(balanceGeneral?.capital || 0);
    const total = Math.max(activos + pasivos + capital, 1);

    return [
      {
        label: "Activos",
        value: activos,
        pct: (activos / total) * 100,
        className:
          "from-sky-500/25 via-blue-500/20 to-cyan-500/10 border-sky-400/20 text-sky-100",
        badgeClass: "bg-sky-500/15 text-sky-300 border-sky-400/20",
      },
      {
        label: "Pasivos",
        value: pasivos,
        pct: (pasivos / total) * 100,
        className:
          "from-rose-500/25 via-red-500/20 to-orange-500/10 border-rose-400/20 text-rose-100",
        badgeClass: "bg-rose-500/15 text-rose-300 border-rose-400/20",
      },
      {
        label: "Capital",
        value: capital,
        pct: (capital / total) * 100,
        className:
          "from-emerald-500/25 via-green-500/20 to-lime-500/10 border-emerald-400/20 text-emerald-100",
        badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
      },
    ];
  }, [balanceGeneral?.activos, balanceGeneral?.pasivos, balanceGeneral?.capital]);

  const inventarioTotal = Number(inventario?.totalProductos || 0);
  const inventarioBienPct = inventarioTotal > 0 ? (Number(inventario?.bien || 0) / inventarioTotal) * 100 : 0;
  const inventarioBajoPct = inventarioTotal > 0 ? (Number(inventario?.bajo || 0) / inventarioTotal) * 100 : 0;
  const inventarioNegativoPct = inventarioTotal > 0 ? (Number(inventario?.negativo || 0) / inventarioTotal) * 100 : 0;

  const cxcTotal = Number(cxc?.total || 0);
  const cxcCorrientePct = cxcTotal > 0 ? (Number(cxc?.corriente || 0) / cxcTotal) * 100 : 0;
  const cxcVencidoPct = cxcTotal > 0 ? (Number(cxc?.vencido || 0) / cxcTotal) * 100 : 0;

  const cxpTotal = Number(cxp?.total || 0);
  const cxpCorrientePct = cxpTotal > 0 ? (Number(cxp?.corriente || 0) / cxpTotal) * 100 : 0;
  const cxpVencidoPct = cxpTotal > 0 ? (Number(cxp?.vencido || 0) / cxpTotal) * 100 : 0;

  const topPasivos = (pasivosBancarios?.items || []).slice(0, 5);

  const inventoryPieData = [
    { name: "Óptimo", value: Number(inventario?.bien || 0), color: "#22c55e" },
    { name: "Bajo", value: Number(inventario?.bajo || 0), color: "#f59e0b" },
    { name: "Negativo", value: Number(inventario?.negativo || 0), color: "#ef4444" },
  ].filter((item) => item.value > 0);

  const currentMetricMeta = metricMeta[profitMetric];

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f2d56_0%,#081426_35%,#050b14_100%)]">
        <div className="p-8">
          <div className="space-y-8 animate-pulse">
            <div className="h-36 rounded-[28px] bg-white/5" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 rounded-[24px] bg-white/5" />
              ))}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 h-[460px] rounded-[28px] bg-white/5" />
              <div className="h-[460px] rounded-[28px] bg-white/5" />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="h-[360px] rounded-[28px] bg-white/5" />
              <div className="h-[360px] rounded-[28px] bg-white/5" />
              <div className="h-[360px] rounded-[28px] bg-white/5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f2d56_0%,#081426_35%,#050b14_100%)]">
        <div className="p-8">
          <Card className="border border-red-500/20 bg-[#0b1628]/90 shadow-2xl rounded-[28px]">
            <CardContent className="py-10 flex flex-col items-center justify-center gap-4 text-center">
              <AlertTriangle className="h-10 w-10 text-red-400" />
              <div>
                <p className="text-lg font-semibold text-white">No pudimos cargar el dashboard</p>
                <p className="text-sm text-white/60 mt-1">{error}</p>
              </div>
              <Button onClick={() => refetch()} className="rounded-xl">
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const MetricCardPro = ({
    title,
    value,
    subtitle,
    icon,
    accentClass = "bg-primary/10 text-primary",
    highlight = false,
  }: {
    title: string;
    value: string;
    subtitle?: string;
    icon: ReactNode;
    accentClass?: string;
    highlight?: boolean;
  }) => (
    <Card
      className={`group relative overflow-hidden rounded-[26px] border transition-all duration-300 hover:-translate-y-1.5 ${
        highlight
          ? "border-blue-400/20 bg-gradient-to-br from-[#1d4ed8] via-[#1e40af] to-[#0f172a] shadow-[0_18px_60px_rgba(37,99,235,0.25)]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(11,20,38,0.96)_100%)] shadow-[0_18px_60px_rgba(0,0,0,0.24)]"
      }`}
    >
      <div
        className={`absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl transition-all duration-300 group-hover:scale-110 ${
          highlight ? "bg-white/10" : "bg-blue-400/10"
        }`}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardDescription className={highlight ? "text-white/75 font-medium" : "text-white/55 font-medium"}>
            {title}
          </CardDescription>
          <div className={`p-2.5 rounded-xl ${highlight ? "bg-white/12 text-white" : accentClass}`}>{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold mb-1 tracking-tight ${highlight ? "text-white" : "text-white"}`}>{value}</p>
        {subtitle ? <p className={`text-sm ${highlight ? "text-white/70" : "text-white/55"}`}>{subtitle}</p> : null}
      </CardContent>
    </Card>
  );

  const ProgressSplitCard = ({
    title,
    total,
    currentLabel,
    currentValue,
    currentPct,
    overdueLabel,
    overdueValue,
    overduePct,
    icon,
  }: {
    title: string;
    total: number;
    currentLabel: string;
    currentValue: number;
    currentPct: number;
    overdueLabel: string;
    overdueValue: number;
    overduePct: number;
    icon: ReactNode;
  }) => (
    <Card className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(11,20,38,0.96)_100%)] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-300">{icon}</div>
          <div>
            <CardTitle className="text-base text-white">{title}</CardTitle>
            <CardDescription className="text-white/55">Total: {formatCurrency(total)}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-white">{currentLabel}</span>
            <span className="text-white/55">
              {formatCurrency(currentValue)} · {currentPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
              style={{ width: `${Math.min(currentPct, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-white">{overdueLabel}</span>
            <span className="text-white/55">
              {formatCurrency(overdueValue)} · {overduePct.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-500 transition-all duration-500"
              style={{ width: `${Math.min(overduePct, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const EstadoResultadosTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
    label?: string;
  }) => {
    if (!active || !payload || !payload.length) return null;

    const itemMap = payload.reduce<Record<string, number>>((acc, item) => {
      acc[String(item.dataKey || item.name || "")] = Number(item.value || 0);
      return acc;
    }, {});

    const selectedLabel = currentMetricMeta.label;
    const selectedValue = Number(itemMap.linea ?? 0);
    const ingresos = Number(itemMap.ingresos ?? 0);

    return (
      <div className="min-w-[240px] rounded-2xl border border-white/15 bg-[#0b1324]/95 backdrop-blur-xl p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">{label}</p>
          <span
            className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: currentMetricMeta.softBg,
              borderColor: currentMetricMeta.border,
              color: currentMetricMeta.color,
            }}
          >
            {selectedLabel}
          </span>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#60a5fa]" />
              <span className="text-sm text-white/75">Ingresos</span>
            </div>
            <span className="text-sm font-semibold text-white">{formatCurrency(Number(itemMap.ingresos ?? 0))}</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#fb7185]" />
              <span className="text-sm text-white/75">Egresos</span>
            </div>
            <span className="text-sm font-semibold text-white">{formatCurrency(Number(itemMap.egresos ?? 0))}</span>
          </div>

          <div className="my-2 h-px bg-white/10" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: currentMetricMeta.color }} />
              <span className="text-sm text-white/75">{selectedLabel}</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: currentMetricMeta.color }}>
              {formatCurrency(selectedValue)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-white/45">Margen</span>
            <span className="text-xs font-medium text-white/70">
              {ingresos > 0 ? formatPercent((selectedValue / ingresos) * 100) : "0.0%"}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f2d56_0%,#081426_35%,#050b14_100%)]">
      <div className="p-6 md:p-8">
        <div className="space-y-8">
          <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(29,78,216,0.95)_0%,rgba(15,23,42,0.96)_45%,rgba(10,15,28,0.98)_100%)] p-8 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="absolute top-0 right-0 -mt-10 -mr-8 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-8 h-44 w-44 rounded-full bg-blue-300/10 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            <div className="relative flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  Resumen financiero premium
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Dashboard Financiero</h1>
                <p className="mt-2 text-base md:text-lg text-white/75">
                  Vista ejecutiva integral del negocio, diseñada para que Bukipin se sienta de nivel enterprise.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-full xl:min-w-[520px]">
                <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-md">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Ventas mes</p>
                  <p className="mt-1 text-2xl font-bold">{formatCurrency(Number(kpis?.ventasMes || 0))}</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-md">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Caja total</p>
                  <p className="mt-1 text-2xl font-bold">{formatCurrency(Number(kpis?.caja?.total || 0))}</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-md">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Margen mes</p>
                  <p className="mt-1 text-2xl font-bold">{formatPercent(margenMes)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6">
            <MetricCardPro
              title="Ventas del Día"
              value={formatCurrency(Number(kpis?.ventasDia || 0))}
              subtitle="Facturación registrada hoy"
              icon={<Calendar className="h-5 w-5" />}
              accentClass="bg-blue-500/10 text-blue-300"
            />

            <MetricCardPro
              title="Ventas del Mes"
              value={formatCurrency(Number(kpis?.ventasMes || 0))}
              subtitle="Mes en curso"
              icon={<BarChart3 className="h-5 w-5" />}
              accentClass="bg-cyan-500/10 text-cyan-300"
            />

            <MetricCardPro
              title="Ventas del Año"
              value={formatCurrency(Number(kpis?.ventasAno || 0))}
              subtitle="Acumulado anual"
              icon={<TrendingUp className="h-5 w-5" />}
              accentClass="bg-emerald-500/10 text-emerald-300"
            />

            <MetricCardPro
              title="Caja Total"
              value={formatCurrency(Number(kpis?.caja?.total || 0))}
              subtitle="Efectivo + bancos"
              icon={<Wallet className="h-5 w-5" />}
              accentClass="bg-blue-500/10 text-blue-300"
            />

            <MetricCardPro
              title="Efectivo"
              value={formatCurrency(Number(kpis?.caja?.efectivo || 0))}
              subtitle="Saldo en caja"
              icon={<DollarSign className="h-5 w-5" />}
              accentClass="bg-emerald-500/10 text-emerald-300"
            />

            <MetricCardPro
              title="Margen del Mes"
              value={formatPercent(margenMes)}
              subtitle="Ingreso neto / ingresos del mes"
              icon={<Target className="h-5 w-5" />}
              highlight
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-2 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.97)_0%,rgba(11,20,38,0.98)_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.24)] overflow-hidden">
              <CardHeader className="pb-0">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-2xl border border-blue-400/15 bg-blue-500/10 p-3 text-blue-300">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-[28px] leading-none tracking-tight text-white">
                          Estado de Resultados
                        </CardTitle>
                        <CardDescription className="mt-2 text-base text-white/60">
                          Doble barra de ingresos y egresos, combinada con línea dinámica para {currentMetricMeta.label.toLowerCase()}.
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(metricMeta) as ProfitMetricKey[]).map((key) => {
                        const meta = metricMeta[key];
                        const active = profitMetric === key;

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setProfitMetric(key)}
                            className={`group relative overflow-hidden rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                              active
                                ? "text-white scale-[1.02]"
                                : "text-white/70 hover:text-white hover:border-white/20"
                            }`}
                            style={{
                              background: active ? meta.softBg : "rgba(255,255,255,0.04)",
                              borderColor: active ? meta.border : "rgba(255,255,255,0.08)",
                              boxShadow: active ? meta.glow : "none",
                            }}
                          >
                            <span
                              className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                              style={{ backgroundColor: meta.color }}
                            />
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Total ingresos</p>
                      <p className="mt-2 text-2xl font-bold text-[#93c5fd]">
                        {formatCurrency(estadoResultadosSummary.ingresos)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Total egresos</p>
                      <p className="mt-2 text-2xl font-bold text-[#fb7185]">
                        {formatCurrency(estadoResultadosSummary.egresos)}
                      </p>
                    </div>

                    <div
                      className="rounded-2xl border p-4"
                      style={{
                        background: currentMetricMeta.softBg,
                        borderColor: currentMetricMeta.border,
                        boxShadow: currentMetricMeta.glow,
                      }}
                    >
                      <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: `${currentMetricMeta.color}` }}>
                        {currentMetricMeta.label}
                      </p>
                      <p className="mt-2 text-2xl font-bold" style={{ color: currentMetricMeta.color }}>
                        {formatCurrency(estadoResultadosSummary.selectedValue)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Margen seleccionado</p>
                      <p className="mt-2 text-2xl font-bold text-white">
                        {formatPercent(estadoResultadosSummary.selectedMargin)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                {estadoResultadosChartData.length > 0 ? (
                  <div className="relative overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-3 md:p-5">
                    <div className="pointer-events-none absolute inset-x-6 top-0 h-24 bg-gradient-to-b from-blue-400/8 to-transparent blur-2xl" />

                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#60a5fa]" />
                        Total Ingresos
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#fb7185]" />
                        Total Egresos
                      </div>
                      <div
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                        style={{
                          background: currentMetricMeta.softBg,
                          borderColor: currentMetricMeta.border,
                          color: currentMetricMeta.color,
                        }}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: currentMetricMeta.color }}
                        />
                        {currentMetricMeta.label}
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={390}>
                      <ComposedChart
                        data={estadoResultadosChartData}
                        margin={{ top: 16, right: 18, left: 4, bottom: 6 }}
                        barGap={10}
                        barCategoryGap="20%"
                      >
                        <defs>
                          <linearGradient id="incomeBarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.85} />
                          </linearGradient>
                          <linearGradient id="expenseBarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fb7185" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#e11d48" stopOpacity={0.85} />
                          </linearGradient>
                          <linearGradient id="chartPanelGlow" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="rgba(96,165,250,0.12)" />
                            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                          </linearGradient>
                        </defs>

                        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="3 5" />
                        <XAxis
                          dataKey="mes"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "rgba(255,255,255,0.60)", fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "rgba(255,255,255,0.50)", fontSize: 12 }}
                          tickFormatter={(v) => formatCompactCurrency(Number(v))}
                          width={82}
                          domain={[0, Math.max(estadoResultadosMax * 1.18, 1)]}
                        />
                        <Tooltip content={<EstadoResultadosTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />

                        <Bar
                          dataKey="ingresos"
                          name="Total Ingresos"
                          fill="url(#incomeBarGradient)"
                          radius={[12, 12, 4, 4]}
                          maxBarSize={34}
                        />
                        <Bar
                          dataKey="egresos"
                          name="Total Egresos"
                          fill="url(#expenseBarGradient)"
                          radius={[12, 12, 4, 4]}
                          maxBarSize={34}
                        />

                        <Line
                          type="monotone"
                          dataKey="linea"
                          name={currentMetricMeta.label}
                          stroke={currentMetricMeta.color}
                          strokeWidth={3.5}
                          dot={{
                            r: 4,
                            strokeWidth: 2,
                            fill: "#0b1324",
                            stroke: currentMetricMeta.color,
                          }}
                          activeDot={{
                            r: 6,
                            strokeWidth: 2,
                            fill: "#0b1324",
                            stroke: currentMetricMeta.color,
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-[0.18em]">
                          <CircleDollarSign className="h-3.5 w-3.5" />
                          Lectura
                        </div>
                        <p className="mt-2 text-sm text-white/72">
                          La línea cambia en tiempo real entre <span className="font-semibold text-white">Utilidad neta</span>,{" "}
                          <span className="font-semibold text-white">EBITDA</span> y{" "}
                          <span className="font-semibold text-white">Utilidad bruta</span>.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-[0.18em]">
                          <LineChartIcon className="h-3.5 w-3.5" />
                          Estado actual
                        </div>
                        <p className="mt-2 text-sm" style={{ color: currentMetricMeta.color }}>
                          {currentMetricMeta.description}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-[0.18em]">
                          <Target className="h-3.5 w-3.5" />
                          Margen bruto mes
                        </div>
                        <p className="mt-2 text-sm text-white/72">{formatPercent(margenBrutoMes)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[26px] border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                    <p className="text-white font-semibold">No hay datos para pintar el estado de resultados.</p>
                    <p className="mt-2 text-sm text-white/55">
                      Cuando existan ingresos y egresos suficientes, aquí se mostrará el gráfico premium combinado.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(11,20,38,0.96)_100%)] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10">
                      <ArrowUpRight className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-white">Ingresos Totales</CardTitle>
                      <CardDescription className="text-white/55">Acumulado del año</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-[#93c5fd]">
                    {formatCurrency(Number(estadoResultados?.totales?.ingresos || 0))}
                  </p>
                  <p className="text-sm text-white/55 mt-2">
                    Fuente principal para la lectura del comportamiento financiero.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(11,20,38,0.96)_100%)] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-500/10">
                      <ArrowDownRight className="h-5 w-5 text-rose-300" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-white">Egresos Totales</CardTitle>
                      <CardDescription className="text-white/55">Acumulado del año</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-[#fda4af]">
                    {formatCurrency(Number(estadoResultados?.totales?.egresos || 0))}
                  </p>
                  <p className="text-sm text-white/55 mt-2">
                    Costos y gastos reconocidos contablemente dentro del periodo.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border border-blue-400/15 bg-[linear-gradient(135deg,rgba(37,99,235,0.95)_0%,rgba(30,41,59,0.95)_100%)] text-white shadow-[0_22px_70px_rgba(37,99,235,0.22)]">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/12">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Resultado seleccionado</CardTitle>
                      <CardDescription className="text-white/70">
                        {currentMetricMeta.label} acumulada
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{formatCurrency(estadoResultadosSummary.selectedValue)}</p>
                  <p className="text-sm text-white/75 mt-2">
                    Margen actual: {formatPercent(estadoResultadosSummary.selectedMargin)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(11,20,38,0.96)_100%)] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10">
                    <TrendingUp className="h-5 w-5 text-blue-300" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white">Flujo acumulado</CardTitle>
                    <CardDescription className="text-white/55">Waterfall mensual del efectivo</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={flujoWaterfallData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="3 5" />
                    <XAxis
                      dataKey="mes"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.60)", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.50)", fontSize: 12 }}
                      tickFormatter={(v) => formatCompactCurrency(Number(v))}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: "#0b1324",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: "16px",
                        boxShadow: "0 18px 60px rgba(0,0,0,0.30)",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.85)" }}
                    />
                    <Bar dataKey="neto" name="Flujo neto" radius={[10, 10, 4, 4]} maxBarSize={32}>
                      {flujoWaterfallData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="acumulado"
                      name="Acumulado"
                      stroke="#60a5fa"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "#0b1324", stroke: "#60a5fa", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-wide text-white/45">Saldo inicial</p>
                    <p className="text-lg font-bold text-white">{formatCurrency(Number(flujo?.saldoInicial || 0))}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-wide text-white/45">Saldo final</p>
                    <p className="text-lg font-bold text-white">{formatCurrency(Number(flujo?.saldoFinal || 0))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(11,20,38,0.96)_100%)] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10">
                    <Landmark className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white">Balance General</CardTitle>
                    <CardDescription className="text-white/55">Estructura visual del negocio</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-12 gap-3 auto-rows-[132px]">
                  {balanceBlocks.map((block, index) => {
                    const cols =
                      index === 0
                        ? "col-span-12 md:col-span-7"
                        : index === 1
                        ? "col-span-12 md:col-span-5"
                        : "col-span-12";
                    return (
                      <div
                        key={block.label}
                        className={`relative overflow-hidden rounded-[24px] border bg-gradient-to-br p-5 ${cols} ${block.className}`}
                      >
                        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/8 blur-2xl" />
                        <div className="relative flex h-full flex-col justify-between">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-white/55">{block.label}</p>
                              <p className="mt-2 text-3xl font-bold text-white">{formatCompactCurrency(block.value)}</p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${block.badgeClass}`}>
                              {block.pct.toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-white/80"
                              style={{ width: `${Math.min(Math.max(block.pct, 0), 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-xs uppercase tracking-wide text-white/45">Activos</p>
                    <p className="text-base font-bold text-white">
                      {formatCompactCurrency(Number(balanceGeneral?.activos || 0))}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-xs uppercase tracking-wide text-white/45">Pasivos</p>
                    <p className="text-base font-bold text-white">
                      {formatCompactCurrency(Number(balanceGeneral?.pasivos || 0))}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-xs uppercase tracking-wide text-white/45">Capital</p>
                    <p className="text-base font-bold text-white">
                      {formatCompactCurrency(Number(balanceGeneral?.capital || 0))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(11,20,38,0.96)_100%)] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10">
                    <CreditCard className="h-5 w-5 text-blue-300" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white">Pasivos bancarios</CardTitle>
                    <CardDescription className="text-white/55">Deuda, pagos y saldo pendiente</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-xs uppercase tracking-wide text-white/45">Deuda total</p>
                    <p className="text-base font-bold text-white">
                      {formatCompactCurrency(Number(pasivosBancarios?.totalDeuda || 0))}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-xs uppercase tracking-wide text-white/45">Pagado</p>
                    <p className="text-base font-bold text-white">
                      {formatCompactCurrency(Number(pasivosBancarios?.totalPagado || 0))}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-xs uppercase tracking-wide text-white/45">Pendiente</p>
                    <p className="text-base font-bold text-white">
                      {formatCompactCurrency(Number(pasivosBancarios?.totalPendiente || 0))}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {topPasivos.length > 0 ? (
                    topPasivos.map((item) => {
                      const pct =
                        Number(item.totalContratado || 0) > 0
                          ? (Number(item.saldoActual || 0) / Number(item.totalContratado || 0)) * 100
                          : 0;

                      return (
                        <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{item.institucion}</p>
                              <p className="text-sm text-white/55">{item.nombre}</p>
                            </div>
                            <span className="text-xs rounded-full border border-blue-400/20 bg-blue-500/10 text-blue-300 px-2.5 py-1">
                              {item.tipo}
                            </span>
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="text-white/55">Saldo actual</span>
                              <span className="font-medium text-white">{formatCurrency(Number(item.saldoActual || 0))}</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-500"
                                style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/55">
                      No hay financiamientos activos para mostrar.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <ProgressSplitCard
              title="Cuentas por Cobrar"
              total={Number(cxc?.total || 0)}
              currentLabel="Corriente"
              currentValue={Number(cxc?.corriente || 0)}
              currentPct={cxcCorrientePct}
              overdueLabel="Vencido"
              overdueValue={Number(cxc?.vencido || 0)}
              overduePct={cxcVencidoPct}
              icon={<Clock3 className="h-5 w-5" />}
            />

            <ProgressSplitCard
              title="Cuentas por Pagar"
              total={Number(cxp?.total || 0)}
              currentLabel="Corriente"
              currentValue={Number(cxp?.corriente || 0)}
              currentPct={cxpCorrientePct}
              overdueLabel="Vencido"
              overdueValue={Number(cxp?.vencido || 0)}
              overduePct={cxpVencidoPct}
              icon={<CreditCard className="h-5 w-5" />}
            />

            <Card className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(11,20,38,0.96)_100%)] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10">
                    <Boxes className="h-5 w-5 text-blue-300" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-white">Salud del inventario</CardTitle>
                    <CardDescription className="text-white/55">
                      Total productos: {Number(inventario?.totalProductos || 0)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="h-[190px]">
                  {inventoryPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={inventoryPieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={72}
                          paddingAngle={4}
                          stroke="rgba(255,255,255,0.06)"
                          strokeWidth={2}
                        >
                          {inventoryPieData.map((entry, index) => (
                            <Cell key={`pie-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-white/55">
                      Sin datos de inventario
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium flex items-center gap-2 text-white">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Bien
                    </span>
                    <span className="text-white/55">
                      {Number(inventario?.bien || 0)} · {inventarioBienPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                      style={{ width: `${Math.min(inventarioBienPct, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium flex items-center gap-2 text-white">
                      <Clock3 className="h-4 w-4 text-amber-400" />
                      Bajo
                    </span>
                    <span className="text-white/55">
                      {Number(inventario?.bajo || 0)} · {inventarioBajoPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                      style={{ width: `${Math.min(inventarioBajoPct, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium flex items-center gap-2 text-white">
                      <AlertTriangle className="h-4 w-4 text-rose-400" />
                      Negativo
                    </span>
                    <span className="text-white/55">
                      {Number(inventario?.negativo || 0)} · {inventarioNegativoPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-500"
                      style={{ width: `${Math.min(inventarioNegativoPct, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(11,20,38,0.96)_100%)] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10">
                    <Sparkles className="h-5 w-5 text-blue-300" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Radiografía del negocio</CardTitle>
                    <CardDescription className="text-white/55">
                      Módulo ligado a análisis financiero
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white/55">
                    Este bloque ya quedó contemplado en el dashboard y se puede activar cuando conectemos el módulo de análisis financiero.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-amber-400/20 bg-amber-500/10 text-amber-300 px-3 py-1.5 text-sm font-medium">
                  {pendientes?.radiografiaNegocio ? "Pendiente" : "Activo"}
                </span>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(11,20,38,0.96)_100%)] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10">
                    <Sparkles className="h-5 w-5 text-blue-300" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Recomendaciones IA</CardTitle>
                    <CardDescription className="text-white/55">
                      Insights automáticos sobre información financiera
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white/55">
                    La UI queda lista para pintar recomendaciones en cuanto integremos la capa de IA.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-amber-400/20 bg-amber-500/10 text-amber-300 px-3 py-1.5 text-sm font-medium">
                  {pendientes?.recomendacionesIA ? "Pendiente" : "Activo"}
                </span>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-white/45">
            <p>Dashboard conectado al nuevo resumen financiero unificado de Bukipin.</p>
            <p>
              Registros cargados:{" "}
              {dashboard?.meta?.generatedAt ? new Date(dashboard.meta.generatedAt).toLocaleString() : "N/D"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;