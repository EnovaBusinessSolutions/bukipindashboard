import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  LabelList,
} from "recharts";
import {
  Activity,
  BadgeDollarSign,
  CheckCircle2,
  CreditCard,
  Landmark,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
  Sparkles,
  Users,
  ArrowUpRight,
} from "lucide-react";

import { useFinanciamientos, type DireccionFinanciamiento } from "@/hooks/useFinanciamientos";
import { useInstitucionesFinancieras } from "@/hooks/useInstitucionesFinancieras";

type PeriodoAmortizacion = "mensual" | "anual";
type FormatoVisualizacion = "normal" | "miles" | "millones";
type TipoDeudaAcreedor = "total" | "capital" | "intereses";
type TipoGastoFinanciero = "total" | "simple" | "revolvente" | "tarjeta" | "combinada";

const COLORS = ["#14b8a6", "#0ea5e9", "#6366f1", "#22c55e", "#f59e0b", "#ef4444"];

const TYPE_COLORS: Record<string, string> = {
  simple: "#14b8a6",
  revolvente: "#0ea5e9",
  tarjeta_corporativa: "#6366f1",
  arrendamiento: "#22c55e",
  otro: "#94a3b8",
};

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const firstFinite = (...values: unknown[]) => {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

const safeDate = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const yyyyMm = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const getTipoUi = (f: any) => {
  const raw = String(f?.tipo_ui || f?.tipoUi || f?.tipo_credito || f?.tipo || "").toLowerCase();
  if (raw === "tarjeta_credito" || raw === "tarjeta_corporativa" || raw === "tarjeta") return "tarjeta_corporativa";
  if (raw === "linea_credito" || raw === "revolvente" || raw === "linea de credito") return "revolvente";
  if (raw === "credito_simple" || raw === "simple" || raw === "prestamo") return "simple";
  if (raw === "arrendamiento") return "arrendamiento";
  return raw || "otro";
};

const getTipoCreditoLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    simple: "Crédito Simple",
    arrendamiento: "Arrendamiento",
    revolvente: "Crédito Revolvente",
    tarjeta_corporativa: "Tarjeta Corporativa",
    otro: "Otro",
  };
  return labels[tipo] || tipo;
};

const getEstatus = (f: any) => String(f?.estado_ui || f?.estadoUi || f?.estatus || f?.estado || "").toLowerCase();
const getInstitucion = (f: any) => f?.institucion || f?.institucion_financiera || "Acreedor";
const getInstitucionId = (f: any) =>
  String(f?.institucion_id || f?.institucionId || f?.institucion_financiera_id || getInstitucion(f));

const getLineaTotal = (f: any) =>
  firstFinite(f?.linea_credito, f?.lineaCredito, f?.monto_total_vista, f?.montoTotalVista, f?.monto_total) ?? 0;

const getMontoOriginal = (f: any) =>
  firstFinite(f?.monto_original, f?.montoOriginal, f?.monto_total_vista, f?.montoTotalVista, f?.saldo_inicial, f?.monto_total) ?? 0;

const getSaldoCapital = (f: any) =>
  firstFinite(
    f?.saldo_capital_actual,
    f?.saldoCapitalActual,
    f?.saldo_actual_vista,
    f?.saldoActualVista,
    f?.saldo_actual
  ) ?? 0;

const getSaldoIntereses = (f: any) =>
  firstFinite(f?.saldo_intereses_actual, f?.saldoInteresesActual) ?? 0;

const getSaldoTotal = (f: any) =>
  firstFinite(
    f?.saldo_total_actual,
    f?.saldoTotalActual,
    f?.saldo_actual_vista,
    f?.saldoActualVista
  ) ?? (getSaldoCapital(f) + getSaldoIntereses(f));

const getDisponible = (f: any) => {
  const d = firstFinite(
    f?.disponible_actual,
    f?.disponibleActual,
    f?.disponible_linea,
    f?.disponibleLinea
  );
  if (d !== undefined) return Math.max(0, d);
  return Math.max(0, getLineaTotal(f) - getSaldoCapital(f));
};

const getFechaVencimiento = (f: any) => safeDate(f?.fecha_vencimiento || f?.fechaVencimiento || null);
const getTxTipo = (t: any) => String(t?.tipo || t?.tipo_transaccion || "").toLowerCase();
const getTxFinanciamientoId = (t: any) => String(t?.financingId || t?.financing_id || t?.financiamiento_id || "");
const getTxMonto = (t: any) => toNum(t?.monto, 0);
const getTxMontoIntereses = (t: any) =>
  firstFinite(t?.monto_intereses, t?.montoIntereses, t?.interes_pagado, t?.monto) ?? 0;
const getTxFecha = (t: any) => safeDate(t?.fecha || t?.created_at || t?.createdAt || null);

const KpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accentClass = "text-slate-900",
  iconWrapClass = "bg-slate-100",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  accentClass?: string;
  iconWrapClass?: string;
}) => (
  <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-5">
      <div className="space-y-1">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        <div className={`text-3xl font-semibold tracking-tight ${accentClass}`}>{value}</div>
        <CardDescription className="text-xs">{subtitle}</CardDescription>
      </div>
      <div className={`rounded-xl p-3 ${iconWrapClass}`}>
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
    </CardHeader>
  </Card>
);

const SectionTitle = ({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
}) => (
  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
    <div className="min-w-0">
      <h3 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h3>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
    {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
    {text}
  </div>
);

const formatMoneyFull = (valor: number): string =>
  `$${Number(valor || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatCompactCurrencyTick = (valor: number): string => {
  if (Math.abs(valor) >= 1_000_000) return `${(valor / 1_000_000).toFixed(1)}M`;
  if (Math.abs(valor) >= 1_000) return `${(valor / 1_000).toFixed(1)}K`;
  return Number(valor || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const PremiumKpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "from-emerald-500/20 via-white to-white",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  accent?: string;
}) => (
  <Card className="group overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_70px_rgba(15,23,42,0.1)]">
    <CardContent className="relative p-0">
      <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${accent}`} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
      <div className="relative flex items-start justify-between px-5 pb-5 pt-6">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <p className="text-[2rem] font-semibold tracking-[-0.03em] text-slate-950">{value}</p>
          <p className="max-w-[20rem] text-sm leading-5 text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-[20px] border border-white/70 bg-white/95 p-3.5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
          <Icon className="h-5 w-5 text-slate-700 transition-transform group-hover:scale-105" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const TotalLabel = (props: any) => {
  const { x = 0, y = 0, width = 0, value } = props;
  return (
    <text
      x={Number(x) + Number(width) + 10}
      y={Number(y) + 14}
      fill="#0f172a"
      fontSize={11}
      fontWeight={700}
    >
      {formatMoneyFull(Number(value || 0))}
    </text>
  );
};

const DebtorTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/98 p-4 shadow-[0_22px_50px_rgba(15,23,42,0.14)] backdrop-blur">
      <p className="text-sm font-semibold text-slate-950">{row.name}</p>
      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-5">
          <span className="text-slate-500">Capital</span>
          <span className="font-semibold text-slate-900">{formatMoneyFull(row.capital)}</span>
        </div>
        <div className="flex justify-between gap-5">
          <span className="text-slate-500">Intereses</span>
          <span className="font-semibold text-slate-900">{formatMoneyFull(row.interests)}</span>
        </div>
        <div className="flex justify-between gap-5 border-t border-slate-100 pt-2.5">
          <span className="text-slate-500">Total</span>
          <span className="font-semibold text-slate-950">{formatMoneyFull(row.total)}</span>
        </div>
      </div>
    </div>
  );
};

const RealizadoAnalyticsView = () => {
  const { financiamientos, transacciones, isLoading } = useFinanciamientos("realizado");
  const [otrosOpen, setOtrosOpen] = useState(false);
  const [page, setPage] = useState(1);

  const analytics = useMemo(() => {
    const activeFinancings = (financiamientos || []).filter(
      (f: any) => String(f?.estatus || f?.estado || "").toLowerCase() === "activo"
    );

    const debtorsMap = new Map<
      string,
      {
        id: string;
        name: string;
        capital: number;
        interests: number;
        total: number;
        loans: number;
      }
    >();

    activeFinancings.forEach((f: any) => {
      const debtorId = String(f?.deudorId || f?.deudor_id || f?.deudor_nombre || f?.nombre || "");
      const name = String(f?.deudorNombre || f?.deudor_nombre || f?.nombre || "Sin deudor");
      const capital = toNum(f?.saldo_capital_actual ?? f?.saldoCapitalActual, 0);
      const interests = toNum(f?.saldo_intereses_actual ?? f?.saldoInteresesActual, 0);
      const current = debtorsMap.get(debtorId) || {
        id: debtorId,
        name,
        capital: 0,
        interests: 0,
        total: 0,
        loans: 0,
      };
      current.capital += capital;
      current.interests += interests;
      current.total += capital + interests;
      current.loans += 1;
      debtorsMap.set(debtorId, current);
    });

    const ranked = Array.from(debtorsMap.values())
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);

    const topTen = ranked.slice(0, 10);
    const remaining = ranked.slice(10);
    const othersRow =
      remaining.length > 0
        ? {
            id: "otros",
            name: "Otros",
            capital: remaining.reduce((sum, row) => sum + row.capital, 0),
            interests: remaining.reduce((sum, row) => sum + row.interests, 0),
            total: remaining.reduce((sum, row) => sum + row.total, 0),
            loans: remaining.reduce((sum, row) => sum + row.loans, 0),
          }
        : null;

    const chartRows = [...topTen, ...(othersRow ? [othersRow] : [])];

    const totalPrestado = (financiamientos || []).reduce(
      (sum: number, f: any) => sum + toNum(f?.total_dispuesto ?? f?.totalDispuesto, 0),
      0
    );
    const totalCobradoCapital = (financiamientos || []).reduce(
      (sum: number, f: any) => sum + toNum(f?.total_amortizado_capital ?? f?.totalAmortizadoCapital, 0),
      0
    );
    const interesesGenerados = (financiamientos || []).reduce(
      (sum: number, f: any) => sum + toNum(f?.total_intereses_cargados ?? f?.totalInteresesCargados, 0),
      0
    );
    const interesesCobrados = (financiamientos || []).reduce(
      (sum: number, f: any) => sum + toNum(f?.total_intereses_pagados ?? f?.totalInteresesPagados, 0),
      0
    );
    const saldoTotalPorCobrar = (financiamientos || []).reduce(
      (sum: number, f: any) => sum + toNum(f?.saldo_total_actual ?? f?.saldoTotalActual, 0),
      0
    );

    return {
      ranked,
      topTen,
      remaining,
      chartRows,
      totalPrestado,
      totalCobradoCapital,
      interesesGenerados,
      interesesCobrados,
      saldoTotalPorCobrar,
      deudoresActivos: ranked.length,
      latestMovements: [...(transacciones || [])]
        .sort((a: any, b: any) => {
          const ad = new Date(a?.fecha || a?.createdAt || a?.created_at || 0).getTime();
          const bd = new Date(b?.fecha || b?.createdAt || b?.created_at || 0).getTime();
          return bd - ad;
        })
        .slice(0, 5),
    };
  }, [financiamientos, transacciones]);

  const totalPages = Math.max(1, Math.ceil(analytics.remaining.length / 25));
  const currentRows = analytics.remaining.slice((page - 1) * 25, page * 25);
  const chartHeight =
    analytics.chartRows.length <= 1 ? 320 : analytics.chartRows.length <= 3 ? 380 : 520;
  const topThreeShare = analytics.ranked.length
    ? ((analytics.ranked.slice(0, 3).reduce((sum, row) => sum + row.total, 0) /
        Math.max(analytics.saldoTotalPorCobrar, 1)) *
        100)
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-[28px]" />
        <Skeleton className="h-[420px] w-full rounded-[28px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[34px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_22%),linear-gradient(135deg,#ffffff_20%,#f8fafc_62%,#eef6ff_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.08)]">
        <CardContent className="relative px-6 py-7 md:px-7 md:py-8">
          <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-emerald-200/20 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-sky-200/20 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/80 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700 shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Analítica Premium
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-slate-950 md:text-[2.25rem]">
                Exposición por deudor en Préstamos Realizados
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-[15px]">
                Consolida capital e intereses por deudor, identifica concentración de riesgo y profundiza en el tramo largo del portafolio con una vista ejecutiva lista para comité.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-[18px] border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Exposición viva
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    {formatMoneyFull(analytics.saldoTotalPorCobrar)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Concentración top 3
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    {topThreeShare.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:min-w-[310px]">
              <div className="rounded-[26px] border border-white/75 bg-white/88 px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Top visible
                </p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-4xl font-semibold tracking-[-0.05em] text-slate-950">
                      {Math.min(10, analytics.topTen.length)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {analytics.remaining.length > 0
                        ? `${analytics.remaining.length} deudores adicionales en "Otros"`
                        : "Portafolio sin cola adicional"}
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-emerald-50 px-3 py-2 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Cartera viva
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-950">
                      {formatCompactCurrencyTick(analytics.saldoTotalPorCobrar)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-slate-900/90 bg-slate-950 px-5 py-4 text-white shadow-[0_22px_55px_rgba(15,23,42,0.18)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Lectura rápida
                </p>
                <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-white">
                  {analytics.ranked[0]?.name || "Sin deudores con saldo vigente"}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {analytics.ranked[0]
                    ? `${formatMoneyFull(analytics.ranked[0].total)} en exposición total`
                    : "Aún no hay exposición activa para destacar"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PremiumKpiCard title="Total prestado" value={formatMoneyFull(analytics.totalPrestado)} subtitle="Capital entregado acumulado" icon={Landmark} accent="from-emerald-500/20 via-white to-white" />
        <PremiumKpiCard title="Total cobrado capital" value={formatMoneyFull(analytics.totalCobradoCapital)} subtitle="Cobranza aplicada a principal" icon={BadgeDollarSign} accent="from-sky-500/18 via-white to-white" />
        <PremiumKpiCard title="Intereses generados" value={formatMoneyFull(analytics.interesesGenerados)} subtitle="Intereses reconocidos en cartera" icon={TrendingUp} accent="from-amber-500/20 via-white to-white" />
        <PremiumKpiCard title="Intereses cobrados" value={formatMoneyFull(analytics.interesesCobrados)} subtitle="Intereses ya materializados" icon={ArrowUpRight} accent="from-violet-500/18 via-white to-white" />
        <PremiumKpiCard title="Saldo total por cobrar" value={formatMoneyFull(analytics.saldoTotalPorCobrar)} subtitle="Exposición viva del portafolio" icon={Wallet} accent="from-rose-500/18 via-white to-white" />
        <PremiumKpiCard title="Deudores activos" value={String(analytics.deudoresActivos)} subtitle="Deudores con saldo vigente" icon={Users} accent="from-cyan-500/18 via-white to-white" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden rounded-[32px] border border-slate-200/90 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.09)]">
          <div className="h-1 w-full bg-[linear-gradient(90deg,rgba(15,118,110,0.85),rgba(245,158,11,0.85))]" />
          <CardHeader className="space-y-4 pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                  Ranking de deudores
                </CardTitle>
                <CardDescription className="mt-1">
                  Barras horizontales por exposición total. Cada barra apila capital e intereses y muestra el total directamente.
                </CardDescription>
              </div>
              {analytics.remaining.length > 0 ? (
                <Button onClick={() => setOtrosOpen(true)} className="rounded-xl">
                  Ver restantes
                </Button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Deudores visibles
                </p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                  {analytics.chartRows.length}
                </p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Saldo del ranking
                </p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                  {formatCompactCurrencyTick(
                    analytics.chartRows.reduce((sum, row) => sum + row.total, 0)
                  )}
                </p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Deudor lÃ­der
                </p>
                <p className="mt-1 truncate text-lg font-semibold tracking-[-0.03em] text-slate-950">
                  {analytics.ranked[0]?.name || "N/D"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {analytics.chartRows.length === 0 ? (
              <EmptyState text="No hay deudores con saldo vigente para mostrar." />
            ) : (
              <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-inner sm:p-5">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                    Capital + Intereses
                  </span>
                  {analytics.chartRows.length <= 3 ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Vista ampliada para baja densidad
                    </span>
                  ) : null}
                </div>
                <div style={{ height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.chartRows}
                    layout="vertical"
                    margin={{
                      top: analytics.chartRows.length <= 3 ? 22 : 12,
                      right: analytics.chartRows.length <= 3 ? 170 : 140,
                      left: analytics.chartRows.length <= 3 ? 24 : 10,
                      bottom: analytics.chartRows.length <= 3 ? 18 : 10,
                    }}
                    barCategoryGap={analytics.chartRows.length <= 3 ? 28 : 18}
                  >
                    <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => formatCompactCurrencyTick(Number(value || 0))} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={analytics.chartRows.length <= 3 ? 170 : 140} axisLine={false} tickLine={false} tick={{ fill: "#334155", fontSize: analytics.chartRows.length <= 3 ? 13 : 12 }} />
                    <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<DebtorTooltip />} />
                    <Bar dataKey="capital" stackId="exposure" fill="#0f766e" radius={[0, 0, 0, 0]} name="Capital" maxBarSize={analytics.chartRows.length <= 3 ? 44 : 26} />
                    <Bar dataKey="interests" stackId="exposure" fill="#f59e0b" radius={[0, 8, 8, 0]} name="Intereses" maxBarSize={analytics.chartRows.length <= 3 ? 44 : 26}>
                      <LabelList dataKey="total" content={<TotalLabel />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[32px] border border-slate-200/90 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.09)]">
          <div className="h-1 w-full bg-[linear-gradient(90deg,rgba(15,23,42,0.95),rgba(15,118,110,0.85))]" />
          <CardHeader className="space-y-3">
            <div className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Insight ejecutivo
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
              Lectura ejecutiva
            </CardTitle>
            <CardDescription>
              Resumen rápido del perfil de concentración y de la actividad reciente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mayor deudor</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">
                {analytics.ranked[0]?.name || "N/D"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {analytics.ranked[0] ? formatMoneyFull(analytics.ranked[0].total) : "Sin exposición activa"}
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Concentración top 3</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">
                {analytics.ranked.length ? `${topThreeShare.toFixed(1)}%` : "0.0%"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Participación de los 3 deudores con mayor exposición.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Últimos movimientos</p>
              {analytics.latestMovements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No hay movimientos recientes.
                </div>
              ) : (
                analytics.latestMovements.map((tx: any) => (
                  <div key={tx.id || tx._id} className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] px-4 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{tx.descripcion || "Movimiento"}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(tx.fecha || tx.createdAt || tx.created_at || Date.now()).toLocaleDateString("es-MX")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-slate-950">
                        {formatMoneyFull(Number(tx.monto || 0))}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={otrosOpen} onOpenChange={setOtrosOpen}>
        <DialogContent className="max-w-4xl rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.12)]">
          <DialogHeader>
            <DialogTitle>Deudores fuera del top 10</DialogTitle>
            <DialogDescription>
              Listado paginado de los deudores agrupados dentro de “Otros”.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border">
              <div className="grid grid-cols-[1.5fr_0.6fr_0.6fr_0.7fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <span>Deudor</span>
                <span className="text-right">Capital</span>
                <span className="text-right">Intereses</span>
                <span className="text-right">Total</span>
              </div>
              <div className="divide-y">
                {currentRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1.5fr_0.6fr_0.6fr_0.7fr] gap-3 px-4 py-3 text-sm">
                    <span className="font-medium text-slate-900">{row.name}</span>
                    <span className="text-right text-slate-600">{formatMoneyFull(row.capital)}</span>
                    <span className="text-right text-slate-600">{formatMoneyFull(row.interests)}</span>
                    <span className="text-right font-semibold text-slate-950">{formatMoneyFull(row.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Anterior
                </Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Siguiente
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AnalyticaFinanciamientos = ({
  direccion = "recibido",
}: {
  direccion?: DireccionFinanciamiento;
}) => {
  if (direccion === "realizado") {
    return <RealizadoAnalyticsView />;
  }

  const { financiamientos, transacciones, resumen, isLoading } = useFinanciamientos(direccion);
  const { instituciones } = useInstitucionesFinancieras();

  const [periodoAmortizacion, setPeriodoAmortizacion] = useState<PeriodoAmortizacion>("mensual");
  const [formatoVisualizacion, setFormatoVisualizacion] = useState<FormatoVisualizacion>("normal");
  const [creditoAmortizacion, setCreditoAmortizacion] = useState<string>("todos");
  const [creditoSimpleSeleccionado, setCreditoSimpleSeleccionado] = useState<string>("todos");
  const [creditoRevolventeSeleccionado, setCreditoRevolventeSeleccionado] = useState<string>("todos");
  const [periodoGastosFinancieros, setPeriodoGastosFinancieros] = useState<PeriodoAmortizacion>("mensual");
  const [tipoGastoFinanciero, setTipoGastoFinanciero] = useState<TipoGastoFinanciero>("total");
  const [tipoDeudaAcreedor, setTipoDeudaAcreedor] = useState<TipoDeudaAcreedor>("total");
  const [acreedorSeleccionado, setAcreedorSeleccionado] = useState<string | null>(null);

  const formatCompactValue = (valor: number): string => {
    if (formatoVisualizacion === "miles") return `${(valor / 1000).toFixed(1)}K`;
    if (formatoVisualizacion === "millones") return `${(valor / 1_000_000).toFixed(2)}M`;
    return valor.toLocaleString("es-MX", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
        {label ? <p className="mb-2 text-sm font-semibold text-slate-800">{label}</p> : null}
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={`${entry.name}-${index}`} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">{entry.name}</span>
              <span className="font-semibold text-slate-900">
                {formatMoneyFull(Number(entry.value || 0))}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0]?.payload;
    if (!item) return null;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
        <p className="mt-1 text-sm text-slate-500">{formatMoneyFull(Number(item.value || 0))}</p>
        <p className="text-xs text-slate-400">{Number(item.percentage || 0).toFixed(1)}% del total</p>
      </div>
    );
  };

  const financiamientosActivos = useMemo(
    () => (financiamientos || []).filter((f: any) => getEstatus(f) === "activo"),
    [financiamientos]
  );

  const tarjetasCorporativas = useMemo(
    () => financiamientosActivos.filter((f: any) => getTipoUi(f) === "tarjeta_corporativa"),
    [financiamientosActivos]
  );

  const creditosRevolventes = useMemo(
    () => financiamientosActivos.filter((f: any) => getTipoUi(f) === "revolvente"),
    [financiamientosActivos]
  );

  const creditosSimples = useMemo(
    () =>
      financiamientosActivos.filter((f: any) => {
        const tipo = getTipoUi(f);
        return tipo !== "tarjeta_corporativa" && tipo !== "revolvente";
      }),
    [financiamientosActivos]
  );

  const deudaTarjetas = useMemo(
    () => tarjetasCorporativas.reduce((sum: number, f: any) => sum + getSaldoTotal(f), 0),
    [tarjetasCorporativas]
  );

  const deudaRevolvente = useMemo(
    () => creditosRevolventes.reduce((sum: number, f: any) => sum + getSaldoTotal(f), 0),
    [creditosRevolventes]
  );

  const totalOriginalSimples = useMemo(
    () => creditosSimples.reduce((sum: number, f: any) => sum + getMontoOriginal(f), 0),
    [creditosSimples]
  );

  const deudaSimplesCapital = useMemo(
    () => creditosSimples.reduce((sum: number, f: any) => sum + getSaldoCapital(f), 0),
    [creditosSimples]
  );

  const deudaSimplesTotal = useMemo(
    () => creditosSimples.reduce((sum: number, f: any) => sum + getSaldoTotal(f), 0),
    [creditosSimples]
  );

  const totalPagadoSimples = Math.max(0, totalOriginalSimples - deudaSimplesCapital);
  const totalDeuda = toNum(
    resumen?.saldo_total_actual,
    deudaSimplesTotal + deudaTarjetas + deudaRevolvente
  );
  const porcentajePagadoGlobal = totalOriginalSimples > 0 ? (totalPagadoSimples / totalOriginalSimples) * 100 : 0;

  const creditosVencidosActivos = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return financiamientosActivos.filter((f: any) => {
      const fv = getFechaVencimiento(f);
      if (!fv) return false;
      fv.setHours(0, 0, 0, 0);
      return fv < hoy && getSaldoTotal(f) > 0;
    });
  }, [financiamientosActivos]);

  const montoVencido = useMemo(
    () => creditosVencidosActivos.reduce((sum: number, f: any) => sum + getSaldoTotal(f), 0),
    [creditosVencidosActivos]
  );

  const dataPorTipo = useMemo(() => {
    const porTipo = financiamientosActivos.reduce(
      (acc: Record<string, { tipo: string; saldo: number; count: number }>, f: any) => {
        const tipo = getTipoUi(f);
        const saldoReal = getSaldoTotal(f);
        if (!acc[tipo]) acc[tipo] = { tipo, saldo: 0, count: 0 };
        acc[tipo].saldo += saldoReal;
        acc[tipo].count += 1;
        return acc;
      },
      {}
    );

    const data = Object.values(porTipo);
    const total = data.reduce((sum, item) => sum + Number(item.saldo || 0), 0);

    return data.map((item) => ({
      name: getTipoCreditoLabel(item.tipo),
      tipo: item.tipo,
      value: Number(item.saldo || 0),
      count: item.count,
      percentage: total > 0 ? (Number(item.saldo || 0) / total) * 100 : 0,
      color: TYPE_COLORS[item.tipo] || "#94a3b8",
    }));
  }, [financiamientosActivos]);

  const creditosSimplesFiltrados = useMemo(
    () =>
      creditoSimpleSeleccionado === "todos"
        ? creditosSimples
        : creditosSimples.filter((f: any) => f.id === creditoSimpleSeleccionado),
    [creditosSimples, creditoSimpleSeleccionado]
  );

  const totalOriginalSimplesFiltrado = useMemo(
    () => creditosSimplesFiltrados.reduce((sum: number, f: any) => sum + getMontoOriginal(f), 0),
    [creditosSimplesFiltrados]
  );

  const deudaSimplesFiltradaCapital = useMemo(
    () => creditosSimplesFiltrados.reduce((sum: number, f: any) => sum + getSaldoCapital(f), 0),
    [creditosSimplesFiltrados]
  );

  const totalPagadoSimplesFiltrado = Math.max(0, totalOriginalSimplesFiltrado - deudaSimplesFiltradaCapital);

  const dataComparacionSimples = useMemo(
    () => [
      { name: "Monto original", valor: totalOriginalSimplesFiltrado, color: "#0ea5e9" },
      { name: "Pagado", valor: totalPagadoSimplesFiltrado, color: "#22c55e" },
      { name: "Pendiente", valor: deudaSimplesFiltradaCapital, color: "#ef4444" },
    ],
    [totalOriginalSimplesFiltrado, totalPagadoSimplesFiltrado, deudaSimplesFiltradaCapital]
  );

  const creditosRevolventesYTarjetas = useMemo(
    () => [...creditosRevolventes, ...tarjetasCorporativas],
    [creditosRevolventes, tarjetasCorporativas]
  );

  const creditosRevolventesFiltrados = useMemo(
    () =>
      creditoRevolventeSeleccionado === "todos"
        ? creditosRevolventesYTarjetas
        : creditosRevolventesYTarjetas.filter((f: any) => f.id === creditoRevolventeSeleccionado),
    [creditosRevolventesYTarjetas, creditoRevolventeSeleccionado]
  );

  const lineaTotal = useMemo(
    () => creditosRevolventesFiltrados.reduce((sum: number, f: any) => sum + getLineaTotal(f), 0),
    [creditosRevolventesFiltrados]
  );

  const lineaUtilizada = useMemo(
    () => creditosRevolventesFiltrados.reduce((sum: number, f: any) => sum + getSaldoCapital(f), 0),
    [creditosRevolventesFiltrados]
  );

  const lineaDisponible = Math.max(0, lineaTotal - lineaUtilizada);

  const dataUsoLinea = useMemo(
    () => [
      {
        name: "Línea consolidada",
        disponible: lineaDisponible,
        utilizado: lineaUtilizada,
      },
    ],
    [lineaDisponible, lineaUtilizada]
  );

  const acreedoresTop = useMemo(() => {
    const deudaPorInstitucion: Record<
      string,
      { total: number; capital: number; intereses: number; logo?: string; nombre: string }
    > = {};

    financiamientosActivos
      .filter((f: any) => getSaldoTotal(f) > 0)
      .forEach((f: any) => {
        const key = getInstitucionId(f);
        const institucion = (instituciones || []).find((i: any) => String(i.id) === key);
        const capitalPendiente = getSaldoCapital(f);
        const interesesPendientes = getSaldoIntereses(f);

        if (!deudaPorInstitucion[key]) {
          deudaPorInstitucion[key] = {
            total: 0,
            capital: 0,
            intereses: 0,
            logo: institucion?.logo_url || undefined,
            nombre: institucion?.nombre || getInstitucion(f),
          };
        }

        deudaPorInstitucion[key].total += getSaldoTotal(f);
        deudaPorInstitucion[key].capital += capitalPendiente;
        deudaPorInstitucion[key].intereses += interesesPendientes;
      });

    const valorOrden =
      tipoDeudaAcreedor === "total"
        ? "total"
        : tipoDeudaAcreedor === "capital"
          ? "capital"
          : "intereses";

    const acreedoresOrdenados = Object.entries(deudaPorInstitucion)
      .map(([key, data]) => ({ id: key, ...data, saldo: (data as any)[valorOrden] as number }))
      .filter((a) => a.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo);

    const total = acreedoresOrdenados.reduce((sum, a) => sum + a.saldo, 0);

    return acreedoresOrdenados.map((a, index) => ({
      ...a,
      porcentaje: total > 0 ? (a.saldo / total) * 100 : 0,
      fill: COLORS[index % COLORS.length],
    }));
  }, [financiamientosActivos, instituciones, tipoDeudaAcreedor]);

  const creditosDetalle = useMemo(() => {
    if (!acreedorSeleccionado) return [];

    const creditosDelAcreedor = financiamientosActivos
      .filter((f: any) => getSaldoTotal(f) > 0)
      .filter((f: any) => getInstitucionId(f) === acreedorSeleccionado)
      .map((f: any) => {
        const capitalPendiente = getSaldoCapital(f);
        const interesesPendientes = getSaldoIntereses(f);

        const saldo =
          tipoDeudaAcreedor === "total"
            ? getSaldoTotal(f)
            : tipoDeudaAcreedor === "capital"
              ? capitalPendiente
              : interesesPendientes;

        return {
          id: f.id,
          nombre: f.nombre,
          tipo_credito: getTipoUi(f),
          total: getSaldoTotal(f),
          capital: capitalPendiente,
          intereses: interesesPendientes,
          saldo,
        };
      })
      .filter((c) => c.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo);

    const total = creditosDelAcreedor.reduce((sum, c) => sum + c.saldo, 0);

    return creditosDelAcreedor.map((c) => ({
      ...c,
      porcentaje: total > 0 ? (c.saldo / total) * 100 : 0,
    }));
  }, [acreedorSeleccionado, financiamientosActivos, tipoDeudaAcreedor]);

  const nombreAcreedorSeleccionado = useMemo(
    () => (acreedorSeleccionado ? acreedoresTop.find((a) => a.id === acreedorSeleccionado)?.nombre || "" : ""),
    [acreedorSeleccionado, acreedoresTop]
  );

  const dataAmortizacionesFuturas = useMemo(() => {
    const hoy = new Date();
    let fechaVencimientoMaxima = new Date(hoy);

    financiamientosActivos.forEach((credito: any) => {
      const fv = getFechaVencimiento(credito);
      if (fv && fv > fechaVencimientoMaxima) fechaVencimientoMaxima = fv;
    });

    const anoInicio = hoy.getFullYear();
    const anoVencimiento = fechaVencimientoMaxima.getFullYear();
    const anosNecesarios = Math.max(1, anoVencimiento - anoInicio + 1);
    const periodos = periodoAmortizacion === "mensual" ? 12 : Math.max(5, anosNecesarios);

    const financiamientosFiltradosAmort =
      creditoAmortizacion === "todos"
        ? financiamientosActivos
        : financiamientosActivos.filter((f: any) => f.id === creditoAmortizacion);

    const data: any[] = [];
    const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    for (let i = 0; i < periodos; i++) {
      let nombrePeriodo: string;
      if (periodoAmortizacion === "mensual") {
        const mesActual = hoy.getMonth();
        const anoActual = hoy.getFullYear();
        const mesIndex = (mesActual + i) % 12;
        const anoOffset = Math.floor((mesActual + i) / 12);
        nombrePeriodo = `${mesesNombres[mesIndex]} ${anoActual + anoOffset}`;
      } else {
        nombrePeriodo = `${hoy.getFullYear() + i}`;
      }

      const periodo: any = { periodo: nombrePeriodo };
      financiamientosFiltradosAmort.forEach((f: any) => {
        periodo[f.nombre] = 0;
      });
      data.push(periodo);
    }

    financiamientosFiltradosAmort.forEach((credito: any) => {
      const tipo = getTipoUi(credito);
      const fechaVencimiento = getFechaVencimiento(credito);
      const saldoBase = getSaldoCapital(credito);

      if (!fechaVencimiento || saldoBase <= 0) return;

      if (tipo === "simple" || tipo === "arrendamiento") {
        const plazo = Math.max(1, toNum(credito?.plazo_meses ?? credito?.plazoMeses, 1));

        const txs = (transacciones || []).filter((t: any) => {
          return getTxFinanciamientoId(t) === credito.id && getTxTipo(t) === "amortizacion";
        });

        const pagosRealizados = txs.length;
        const mesesPendientesPorPagar = Math.max(0, plazo - pagosRealizados);
        const amortizacionMensual = mesesPendientesPorPagar > 0 ? saldoBase / mesesPendientesPorPagar : 0;

        if (periodoAmortizacion === "mensual") {
          const mesesAMostrar = Math.min(periodos - 1, mesesPendientesPorPagar);
          for (let i = 1; i <= mesesAMostrar; i++) data[i][credito.nombre] += amortizacionMensual;
        } else {
          const anoVenc = fechaVencimiento.getFullYear();
          const anoIni = hoy.getFullYear();
          const anosRestantes = Math.max(1, anoVenc - anoIni + 1);
          const anosAMostrar = Math.min(periodos, anosRestantes);

          const mesesRestantesAnoActual = 12 - hoy.getMonth();
          let mesesContados = 0;

          for (let i = 0; i < anosAMostrar; i++) {
            let mesesEnEsteAno: number;

            if (i === 0) mesesEnEsteAno = Math.min(mesesRestantesAnoActual, mesesPendientesPorPagar);
            else if (mesesContados + 12 <= mesesPendientesPorPagar) mesesEnEsteAno = 12;
            else mesesEnEsteAno = Math.max(0, mesesPendientesPorPagar - mesesContados);

            data[i][credito.nombre] += amortizacionMensual * mesesEnEsteAno;
            mesesContados += mesesEnEsteAno;
            if (mesesContados >= mesesPendientesPorPagar) break;
          }
        }
      } else if (tipo === "revolvente") {
        const mesesHastaVencimiento = Math.max(
          0,
          (fechaVencimiento.getFullYear() - hoy.getFullYear()) * 12 +
            (fechaVencimiento.getMonth() - hoy.getMonth())
        );

        if (periodoAmortizacion === "mensual" && mesesHastaVencimiento < periodos) {
          data[mesesHastaVencimiento][credito.nombre] += saldoBase;
        } else if (periodoAmortizacion === "anual") {
          const anosHastaVencimiento = Math.floor(mesesHastaVencimiento / 12);
          if (anosHastaVencimiento < periodos) data[anosHastaVencimiento][credito.nombre] += saldoBase;
        }
      } else if (tipo === "tarjeta_corporativa") {
        const fechaActual = new Date();
        const mesActual = fechaActual.getMonth();
        const anoActual = fechaActual.getFullYear();

        const pagosEnMesActual = (transacciones || []).filter((t: any) => {
          const ft = getTxFecha(t);
          return (
            getTxFinanciamientoId(t) === credito.id &&
            getTxTipo(t) === "amortizacion" &&
            ft &&
            ft.getMonth() === mesActual &&
            ft.getFullYear() === anoActual
          );
        });

        const indice = pagosEnMesActual.length > 0 ? 1 : 0;

        if (periodoAmortizacion === "mensual" && indice < periodos) data[indice][credito.nombre] += saldoBase;
        else if (periodoAmortizacion === "anual") data[0][credito.nombre] += saldoBase;
      }
    });

    return data;
  }, [financiamientosActivos, creditoAmortizacion, periodoAmortizacion, transacciones]);

  const nombresCreditos = useMemo(
    () =>
      (creditoAmortizacion === "todos"
        ? financiamientosActivos
        : financiamientosActivos.filter((f: any) => f.id === creditoAmortizacion)
      ).map((f: any) => f.nombre),
    [creditoAmortizacion, financiamientosActivos]
  );

  const dataGastosFinancieros = useMemo(() => {
    const byPeriod = new Map<
      string,
      { periodo: string; simple: number; revolvente: number; tarjeta: number; total: number }
    >();

    (transacciones || []).forEach((t: any) => {
      const tipo = getTxTipo(t);
      const isInterestCharge =
        tipo === "cargo_intereses" || tipo === "cargo_interes";

      if (!isInterestCharge) return;

      const fecha = getTxFecha(t);
      if (!fecha) return;

      const periodo =
        periodoGastosFinancieros === "mensual"
          ? yyyyMm(fecha)
          : String(fecha.getFullYear());

      if (!byPeriod.has(periodo)) {
        byPeriod.set(periodo, {
          periodo,
          simple: 0,
          revolvente: 0,
          tarjeta: 0,
          total: 0,
        });
      }

      const row = byPeriod.get(periodo)!;
      const financingId = getTxFinanciamientoId(t);
      const fin = financiamientos.find((f: any) => String(f.id) === financingId);
      const tipoFin = fin ? getTipoUi(fin) : "otro";
      const monto = getTxMontoIntereses(t);

      if (tipoFin === "tarjeta_corporativa") row.tarjeta += monto;
      else if (tipoFin === "revolvente") row.revolvente += monto;
      else row.simple += monto;

      row.total += monto;
    });

    const list = Array.from(byPeriod.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));

    return list.map((d) => {
      if (periodoGastosFinancieros === "mensual") {
        const [y, m] = d.periodo.split("-");
        const nombresMeses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
        return {
          ...d,
          periodoFormateado: `${nombresMeses[Math.max(0, Number(m) - 1)]} ${y}`,
        };
      }
      return { ...d, periodoFormateado: d.periodo };
    });
  }, [transacciones, financiamientos, periodoGastosFinancieros]);

  const limiteYAxis = useMemo(() => {
    if (!dataAmortizacionesFuturas.length) return 0;
    const valorMax = Math.max(
      ...dataAmortizacionesFuturas.map((p: any) =>
        nombresCreditos.reduce((sum: number, nombre: string) => sum + Number(p[nombre] || 0), 0)
      ),
      0
    );
    return valorMax * 1.2;
  }, [dataAmortizacionesFuturas, nombresCreditos]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Analítica financiera
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Vista ejecutiva del portafolio de financiamientos
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Monitorea deuda activa, concentración por acreedor, proyección de amortizaciones y evolución de intereses en una sola vista.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-500">Escala</Label>
            <Select value={formatoVisualizacion} onValueChange={(v) => setFormatoVisualizacion(v as FormatoVisualizacion)}>
              <SelectTrigger className="w-[150px] rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="miles">Miles (K)</SelectItem>
                <SelectItem value="millones">Millones (M)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Créditos activos"
          value={String(financiamientosActivos.length)}
          subtitle="Instrumentos con saldo o línea vigente"
          icon={Activity}
        />

        <KpiCard
          title="Deuda total"
          value={formatMoneyFull(totalDeuda)}
          subtitle="Saldo consolidado vigente"
          icon={TrendingDown}
          accentClass="text-rose-600"
          iconWrapClass="bg-rose-50"
        />

        <KpiCard
          title="Capital pagado"
          value={formatMoneyFull(totalPagadoSimples)}
          subtitle="Monto amortizado en créditos simples"
          icon={BadgeDollarSign}
          accentClass="text-emerald-600"
          iconWrapClass="bg-emerald-50"
        />

        <KpiCard
          title="% pagado"
          value={`${porcentajePagadoGlobal.toFixed(1)}%`}
          subtitle="Avance sobre créditos simples"
          icon={TrendingUp}
          accentClass="text-sky-600"
          iconWrapClass="bg-sky-50"
        />

        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-medium text-slate-500">Estado de vencimientos</CardTitle>
          </CardHeader>
          <CardContent>
            {creditosVencidosActivos.length === 0 ? (
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xl font-semibold text-emerald-600">Al día</div>
                  <p className="text-xs text-slate-500">Sin vencimientos activos</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-rose-50 p-3">
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <div className="text-xl font-semibold text-rose-600">
                    {creditosVencidosActivos.length} vencido{creditosVencidosActivos.length > 1 ? "s" : ""}
                  </div>
                  <p className="text-xs text-slate-500">
                    {formatMoneyFull(montoVencido)} comprometidos
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <SectionTitle
              title="Composición de deuda por tipo"
              description="Distribución del saldo activo entre créditos simples, revolventes y tarjetas."
            />
          </CardHeader>
          <CardContent>
            {dataPorTipo.length === 0 ? (
              <EmptyState text="No hay deuda activa para mostrar." />
            ) : (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dataPorTipo}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={108}
                        paddingAngle={3}
                      >
                        {dataPorTipo.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {dataPorTipo.map((item) => (
                    <div key={item.name} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <div>
                            <p className="font-medium text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">{item.count} instrumento(s)</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">{formatMoneyFull(item.value)}</p>
                          <p className="text-xs text-slate-500">{item.percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-2xl bg-slate-900 px-4 py-4 text-white">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Total consolidado</p>
                    <p className="mt-2 text-2xl font-semibold">{formatMoneyFull(totalDeuda)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <SectionTitle
              title={acreedorSeleccionado ? `Detalle · ${nombreAcreedorSeleccionado}` : "Concentración por acreedor"}
              description={
                acreedorSeleccionado
                  ? "Desglose de créditos pertenecientes al acreedor seleccionado."
                  : "Conoce qué instituciones concentran la mayor parte de la deuda."
              }
              right={
                <>
                  {acreedorSeleccionado ? (
                    <button
                      type="button"
                      onClick={() => setAcreedorSeleccionado(null)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      Volver
                    </button>
                  ) : null}

                  <Select value={tipoDeudaAcreedor} onValueChange={(v) => setTipoDeudaAcreedor(v as TipoDeudaAcreedor)}>
                    <SelectTrigger className="w-[150px] rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Deuda total</SelectItem>
                      <SelectItem value="capital">Solo capital</SelectItem>
                      <SelectItem value="intereses">Solo intereses</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              }
            />
          </CardHeader>
          <CardContent>
            {!acreedorSeleccionado ? (
              acreedoresTop.length === 0 ? (
                <EmptyState text="No hay deuda pendiente con acreedores." />
              ) : (
                <div className="space-y-4">
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={acreedoresTop.slice(0, 6)}
                        layout="vertical"
                        margin={{ top: 0, right: 18, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                        <XAxis
                          type="number"
                          tickFormatter={(v) => `$${formatCompactValue(Number(v || 0))}`}
                          stroke="#94a3b8"
                        />
                        <YAxis dataKey="nombre" type="category" width={105} stroke="#94a3b8" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="saldo" radius={[0, 10, 10, 0]}>
                          {acreedoresTop.slice(0, 6).map((entry, index) => (
                            <Cell key={`${entry.nombre}-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2">
                    {acreedoresTop.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        disabled={a.id === "otros"}
                        onClick={() => {
                          if (a.id !== "otros") setAcreedorSeleccionado(a.id);
                        }}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          a.id !== "otros"
                            ? "border-slate-200 bg-white hover:bg-slate-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {a.logo ? (
                            <img src={a.logo} alt={a.nombre} className="h-10 w-10 rounded-xl border bg-white object-contain p-1" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 text-sm font-bold text-white">
                              {a.nombre.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900">{a.nombre}</p>
                          <p className="text-xs text-slate-500">{a.porcentaje.toFixed(1)}% del total</p>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold text-slate-900">{formatMoneyFull(a.saldo)}</p>
                          <p className="text-xs text-slate-500">adeudado</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            ) : creditosDetalle.length === 0 ? (
              <EmptyState text="No hay créditos activos para este acreedor." />
            ) : (
              <div className="space-y-3">
                {creditosDetalle.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">{c.nombre}</p>
                        <p className="text-xs text-slate-500">
                          {getTipoCreditoLabel(c.tipo_credito)} · {c.porcentaje.toFixed(1)}% del acreedor
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatMoneyFull(c.saldo)}</p>
                        <p className="text-xs text-slate-500">saldo</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <SectionTitle
              title="Comportamiento · crédito simple"
              description="Comparativo visual entre monto original, capital pagado y pendiente."
              right={
                <Select value={creditoSimpleSeleccionado} onValueChange={setCreditoSimpleSeleccionado}>
                  <SelectTrigger className="w-[170px] rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {creditosSimples.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataComparacionSimples} layout="vertical" margin={{ top: 6, right: 12, left: 8, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `$${formatCompactValue(Number(v || 0))}`} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" width={110} stroke="#94a3b8" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="valor" radius={[0, 12, 12, 0]}>
                    {dataComparacionSimples.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <SectionTitle
              title="Uso de líneas revolventes y tarjetas"
              description="Capacidad total, saldo utilizado y línea disponible."
              right={
                <Select value={creditoRevolventeSeleccionado} onValueChange={setCreditoRevolventeSeleccionado}>
                  <SelectTrigger className="w-[170px] rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {creditosRevolventesYTarjetas.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          </CardHeader>
          <CardContent>
            {lineaTotal <= 0 ? (
              <EmptyState text="No hay líneas revolventes o tarjetas con capacidad registrada." />
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Uso consolidado</span>
                    <span className="font-semibold text-slate-900">
                      {lineaTotal > 0 ? ((lineaUtilizada / lineaTotal) * 100).toFixed(1) : "0.0"}% utilizado
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div className="flex h-full w-full">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${lineaTotal > 0 ? (lineaDisponible / lineaTotal) * 100 : 0}%` }}
                      />
                      <div
                        className="h-full bg-rose-500"
                        style={{ width: `${lineaTotal > 0 ? (lineaUtilizada / lineaTotal) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      Disponible: {formatMoneyFull(lineaDisponible)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      Utilizado: {formatMoneyFull(lineaUtilizada)}
                    </span>
                  </div>
                </div>

                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dataUsoLinea} margin={{ top: 12, right: 12, left: 12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis tickFormatter={(v) => `$${formatCompactValue(Number(v || 0))}`} stroke="#94a3b8" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="disponible" stackId="a" fill="#22c55e" radius={[0, 0, 10, 10]} name="Disponible" />
                      <Bar dataKey="utilizado" stackId="a" fill="#ef4444" radius={[10, 10, 0, 0]} name="Utilizado" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-4">
          <SectionTitle
            title="Proyección de amortizaciones futuras"
            description="Estimación de pagos pendientes por periodo con base en saldos y vencimientos."
            right={
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500">Crédito</Label>
                  <Select value={creditoAmortizacion} onValueChange={setCreditoAmortizacion}>
                    <SelectTrigger className="w-[170px] rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {financiamientosActivos.map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500">Periodo</Label>
                  <Select value={periodoAmortizacion} onValueChange={(v) => setPeriodoAmortizacion(v as PeriodoAmortizacion)}>
                    <SelectTrigger className="w-[120px] rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensual">Mensual</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            }
          />
        </CardHeader>
        <CardContent>
          {dataAmortizacionesFuturas.length === 0 || nombresCreditos.length === 0 ? (
            <EmptyState text="No hay proyección disponible para los créditos seleccionados." />
          ) : (
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataAmortizacionesFuturas}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="periodo" stroke="#94a3b8" />
                  <YAxis
                    domain={[0, limiteYAxis]}
                    allowDataOverflow={false}
                    tickFormatter={(v) => `$${formatCompactValue(Number(v || 0))}`}
                    stroke="#94a3b8"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />

                  {nombresCreditos.map((nombre: string, index: number) => (
                    <Bar
                      key={nombre}
                      dataKey={nombre}
                      stackId="a"
                      fill={COLORS[index % COLORS.length]}
                      radius={index === 0 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-4">
          <SectionTitle
            title="Evolución de gastos financieros"
            description="Intereses cargados a lo largo del tiempo por tipo de instrumento."
            right={
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500">Tipo</Label>
                  <Select value={tipoGastoFinanciero} onValueChange={(v) => setTipoGastoFinanciero(v as TipoGastoFinanciero)}>
                    <SelectTrigger className="w-[180px] rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total</SelectItem>
                      <SelectItem value="simple">Créditos Simples</SelectItem>
                      <SelectItem value="revolvente">Líneas Revolventes</SelectItem>
                      <SelectItem value="tarjeta">Tarjetas Corporativas</SelectItem>
                      <SelectItem value="combinada">Combinada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500">Periodo</Label>
                  <Select value={periodoGastosFinancieros} onValueChange={(v) => setPeriodoGastosFinancieros(v as PeriodoAmortizacion)}>
                    <SelectTrigger className="w-[120px] rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensual">Mensual</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            }
          />
        </CardHeader>
        <CardContent>
          {dataGastosFinancieros.length === 0 ? (
            <EmptyState text="No hay gastos financieros registrados." />
          ) : (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                {tipoGastoFinanciero === "combinada" ? (
                  <LineChart data={dataGastosFinancieros}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="periodoFormateado" stroke="#94a3b8" />
                    <YAxis tickFormatter={(v) => `$${formatCompactValue(Number(v || 0))}`} stroke="#94a3b8" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="simple" stroke="#14b8a6" strokeWidth={3} dot={{ r: 3 }} name="Créditos Simples" />
                    <Line type="monotone" dataKey="revolvente" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 3 }} name="Líneas Revolventes" />
                    <Line type="monotone" dataKey="tarjeta" stroke="#6366f1" strokeWidth={3} dot={{ r: 3 }} name="Tarjetas Corporativas" />
                  </LineChart>
                ) : tipoGastoFinanciero === "total" ? (
                  <AreaChart data={dataGastosFinancieros}>
                    <defs>
                      <linearGradient id="gastosTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="periodoFormateado" stroke="#94a3b8" />
                    <YAxis tickFormatter={(v) => `$${formatCompactValue(Number(v || 0))}`} stroke="#94a3b8" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="total" stroke="#14b8a6" fill="url(#gastosTotal)" strokeWidth={3} name="Total intereses" />
                  </AreaChart>
                ) : (
                  <AreaChart data={dataGastosFinancieros}>
                    <defs>
                      <linearGradient id="gastosSingle" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="periodoFormateado" stroke="#94a3b8" />
                    <YAxis tickFormatter={(v) => `$${formatCompactValue(Number(v || 0))}`} stroke="#94a3b8" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />

                    {tipoGastoFinanciero === "simple" && (
                      <Area type="monotone" dataKey="simple" stroke="#14b8a6" fill="url(#gastosSingle)" strokeWidth={3} name="Créditos Simples" />
                    )}
                    {tipoGastoFinanciero === "revolvente" && (
                      <Area type="monotone" dataKey="revolvente" stroke="#0ea5e9" fill="url(#gastosSingle)" strokeWidth={3} name="Líneas Revolventes" />
                    )}
                    {tipoGastoFinanciero === "tarjeta" && (
                      <Area type="monotone" dataKey="tarjeta" stroke="#6366f1" fill="url(#gastosSingle)" strokeWidth={3} name="Tarjetas Corporativas" />
                    )}
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Mix del portafolio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-teal-50 p-3">
                  <Landmark className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Créditos simples</p>
                  <p className="text-xs text-slate-500">{creditosSimples.length} activos</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-sky-50 p-3">
                  <Wallet className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Líneas revolventes</p>
                  <p className="text-xs text-slate-500">{creditosRevolventes.length} activas</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-50 p-3">
                  <CreditCard className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Tarjetas corporativas</p>
                  <p className="text-xs text-slate-500">{tarjetasCorporativas.length} activas</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Riesgo de vencimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Créditos vencidos</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{creditosVencidosActivos.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Monto comprometido</p>
              <p className="mt-2 text-2xl font-semibold text-rose-600">{formatMoneyFull(montoVencido)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Capacidad disponible</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Disponible en líneas</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">
                {formatMoneyFull(
                  [...creditosRevolventes, ...tarjetasCorporativas].reduce(
                    (sum: number, f: any) => sum + getDisponible(f),
                    0
                  )
                )}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Deuda en líneas</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatMoneyFull(deudaTarjetas + deudaRevolvente)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticaFinanciamientos;
