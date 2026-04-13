import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
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
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import useDashboardFinanciero from "@/hooks/useDashboardFinanciero";

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

  const [profitMetric, setProfitMetric] = useState<"utilidadNeta" | "ebitda" | "utilidadBruta">("utilidadNeta");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  };

  const formatCompactCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(Number(value || 0));
  };

  const margenMes = useMemo(() => {
    const totalIngresosMes = Number(kpis?.totalIngresosMes || 0);
    const ingresoNetoMes = Number(kpis?.ingresoNetoMes || 0);
    if (totalIngresosMes <= 0) return 0;
    return (ingresoNetoMes / totalIngresosMes) * 100;
  }, [kpis?.ingresoNetoMes, kpis?.totalIngresosMes]);

  const estadoResultadosChartData = useMemo(() => {
    return (estadoResultados?.series || []).map((item) => ({
      mes: item.mes,
      ingresos: Number(item.ingresos || 0),
      egresos: Number(item.egresos || 0),
      utilidadNeta: Number(item.utilidadNeta || 0),
      ebitda: Number(item.ebitda || 0),
      utilidadBruta: Number(item.utilidadBruta || 0),
      linea: Number(item?.[profitMetric] || 0),
    }));
  }, [estadoResultados?.series, profitMetric]);

  const flujoWaterfallData = useMemo(() => {
    return (flujo?.seriesMensuales || []).map((item) => ({
      mes: item.mes,
      neto: Number(item.neto || 0),
      acumulado: Number(item.acumulado || 0),
      fill:
        Number(item.neto || 0) >= 0
          ? "hsl(var(--success))"
          : "hsl(var(--destructive))",
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
        <div className="p-8">
          <div className="space-y-8 animate-pulse">
            <div className="h-36 rounded-2xl bg-muted/50" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-muted/50" />
              ))}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 h-[420px] rounded-2xl bg-muted/50" />
              <div className="h-[420px] rounded-2xl bg-muted/50" />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="h-[360px] rounded-2xl bg-muted/50" />
              <div className="h-[360px] rounded-2xl bg-muted/50" />
              <div className="h-[360px] rounded-2xl bg-muted/50" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
        <div className="p-8">
          <Card className="border-destructive/20 shadow-lg">
            <CardContent className="py-10 flex flex-col items-center justify-center gap-4 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <div>
                <p className="text-lg font-semibold">No pudimos cargar el dashboard</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button onClick={() => refetch()}>Reintentar</Button>
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
    icon: React.ReactNode;
    accentClass?: string;
    highlight?: boolean;
  }) => (
    <Card
      className={`group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${
        highlight
          ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground"
          : "bg-gradient-to-br from-card to-card/80"
      }`}
    >
      <div
        className={`absolute top-0 right-0 h-24 w-24 rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform ${
          highlight ? "bg-white/10" : "bg-primary/10"
        }`}
      />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardDescription className={highlight ? "text-primary-foreground/80 font-medium" : "text-muted-foreground font-medium"}>
            {title}
          </CardDescription>
          <div className={`p-2 rounded-lg ${highlight ? "bg-white/20 text-primary-foreground" : accentClass}`}>{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold mb-1 ${highlight ? "text-primary-foreground" : "text-foreground"}`}>{value}</p>
        {subtitle ? (
          <p className={`text-sm ${highlight ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{subtitle}</p>
        ) : null}
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
    icon: React.ReactNode;
  }) => (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-secondary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>Total: {formatCurrency(total)}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-foreground">{currentLabel}</span>
            <span className="text-muted-foreground">
              {formatCurrency(currentValue)} · {currentPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${Math.min(currentPct, 100)}%` }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-foreground">{overdueLabel}</span>
            <span className="text-muted-foreground">
              {formatCurrency(overdueValue)} · {overduePct.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-destructive transition-all duration-500" style={{ width: `${Math.min(overduePct, 100)}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
      <div className="p-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-accent p-8 text-primary-foreground shadow-xl">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
            <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <h1 className="text-4xl font-bold mb-2 tracking-tight">Dashboard Financiero</h1>
                <p className="text-primary-foreground/80 text-lg">
                  Resumen ejecutivo integral de tu negocio en Bukipin
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-primary-foreground/70">Ventas mes</p>
                  <p className="text-xl font-bold">{formatCurrency(kpis.ventasMes)}</p>
                </div>
                <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-primary-foreground/70">Caja total</p>
                  <p className="text-xl font-bold">{formatCurrency(kpis.caja.total)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* KPIs Top */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6">
            <MetricCardPro
              title="Ventas del Día"
              value={formatCurrency(kpis.ventasDia)}
              subtitle="Facturación registrada hoy"
              icon={<Calendar className="h-5 w-5" />}
              accentClass="bg-primary/10 text-primary"
            />

            <MetricCardPro
              title="Ventas del Mes"
              value={formatCurrency(kpis.ventasMes)}
              subtitle="Mes en curso"
              icon={<BarChart3 className="h-5 w-5" />}
              accentClass="bg-accent/20 text-accent"
            />

            <MetricCardPro
              title="Ventas del Año"
              value={formatCurrency(kpis.ventasAno)}
              subtitle="Acumulado anual"
              icon={<TrendingUp className="h-5 w-5" />}
              accentClass="bg-success/15 text-success"
            />

            <MetricCardPro
              title="Caja Total"
              value={formatCurrency(kpis.caja.total)}
              subtitle="Efectivo + bancos"
              icon={<Wallet className="h-5 w-5" />}
              accentClass="bg-primary/10 text-primary"
            />

            <MetricCardPro
              title="Efectivo"
              value={formatCurrency(kpis.caja.efectivo)}
              subtitle="Saldo en caja"
              icon={<DollarSign className="h-5 w-5" />}
              accentClass="bg-success/15 text-success"
            />

            <MetricCardPro
              title="Margen del Mes"
              value={`${margenMes.toFixed(1)}%`}
              subtitle="Ingreso neto / ingresos del mes"
              icon={<Target className="h-5 w-5" />}
              highlight
            />
          </div>

          {/* Estado de resultados + Resumen lateral */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-2 border-0 shadow-lg bg-gradient-to-br from-card to-secondary/20">
              <CardHeader className="pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Activity className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Estado de Resultados</CardTitle>
                      <CardDescription>Ingresos vs egresos con utilidad dinámica</CardDescription>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={profitMetric === "utilidadNeta" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setProfitMetric("utilidadNeta")}
                    >
                      Utilidad neta
                    </Button>
                    <Button
                      variant={profitMetric === "ebitda" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setProfitMetric("ebitda")}
                    >
                      EBITDA
                    </Button>
                    <Button
                      variant={profitMetric === "utilidadBruta" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setProfitMetric("utilidadBruta")}
                    >
                      Utilidad bruta
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={estadoResultadosChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                    <XAxis dataKey="mes" axisLine={false} tickLine={false} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatCompactCurrency(v)}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "none",
                        borderRadius: "12px",
                        boxShadow: "0 10px 40px -10px rgba(0,0,0,0.25)",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="ingresos" name="Ingresos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="egresos" name="Egresos" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="linea"
                      name={
                        profitMetric === "utilidadNeta"
                          ? "Utilidad neta"
                          : profitMetric === "ebitda"
                          ? "EBITDA"
                          : "Utilidad bruta"
                      }
                      stroke="hsl(var(--success))"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-secondary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/10">
                      <ArrowUpRight className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Ingresos Totales</CardTitle>
                      <CardDescription>Acumulado del año</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    {formatCurrency(estadoResultados.totales.ingresos)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Fuente principal para la lectura de resultados.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-secondary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-destructive/10">
                      <ArrowDownRight className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Egresos Totales</CardTitle>
                      <CardDescription>Acumulado del año</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    {formatCurrency(estadoResultados.totales.egresos)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Costos + gastos reconocidos contablemente.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-primary to-primary/90 text-primary-foreground">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/20">
                      <Sparkles className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Utilidad del Mes</CardTitle>
                      <CardDescription className="text-primary-foreground/75">
                        Basada en ingreso neto del sistema
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{formatCurrency(kpis.ingresoNetoMes)}</p>
                  <p className="text-sm text-primary-foreground/75 mt-2">
                    Descuentos del mes: {formatCurrency(kpis.descuentosMes)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Flujo + Balance + Pasivos */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-secondary/20">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Flujo acumulado</CardTitle>
                    <CardDescription>Waterfall mensual del efectivo</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={flujoWaterfallData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="mes" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "none",
                        borderRadius: "12px",
                        boxShadow: "0 10px 40px -10px rgba(0,0,0,0.25)",
                      }}
                    />
                    <Bar dataKey="neto" name="Flujo neto" radius={[6, 6, 0, 0]}>
                      {flujoWaterfallData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="acumulado"
                      name="Acumulado"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ r: 2 }}
                    />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo inicial</p>
                    <p className="text-lg font-bold">{formatCurrency(flujo.saldoInicial)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo final</p>
                    <p className="text-lg font-bold">{formatCurrency(flujo.saldoFinal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-secondary/20">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/20">
                    <Landmark className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Balance General</CardTitle>
                    <CardDescription>Estructura financiera del negocio</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {balanceStructureData.map((item) => {
                  const totalBase = Math.max(
                    Number(balanceGeneral.activos || 0) +
                      Number(balanceGeneral.pasivos || 0) +
                      Number(balanceGeneral.capital || 0),
                    1
                  );
                  const pct = (Number(item.value || 0) / totalBase) * 100;

                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium text-foreground">{item.name}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(item.value)} · {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Activos</p>
                    <p className="text-base font-bold">{formatCompactCurrency(balanceGeneral.activos)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Pasivos</p>
                    <p className="text-base font-bold">{formatCompactCurrency(balanceGeneral.pasivos)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Capital</p>
                    <p className="text-base font-bold">{formatCompactCurrency(balanceGeneral.capital)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-secondary/20">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Pasivos bancarios</CardTitle>
                    <CardDescription>Deuda, pagos y saldo pendiente</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Deuda total</p>
                    <p className="text-base font-bold">{formatCompactCurrency(pasivosBancarios.totalDeuda)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Pagado</p>
                    <p className="text-base font-bold">{formatCompactCurrency(pasivosBancarios.totalPagado)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Pendiente</p>
                    <p className="text-base font-bold">{formatCompactCurrency(pasivosBancarios.totalPendiente)}</p>
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
                        <div key={item.id} className="rounded-xl border border-border/50 bg-background/60 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-foreground">{item.institucion}</p>
                              <p className="text-sm text-muted-foreground">{item.nombre}</p>
                            </div>
                            <span className="text-xs rounded-full bg-primary/10 text-primary px-2.5 py-1">
                              {item.tipo}
                            </span>
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="text-muted-foreground">Saldo actual</span>
                              <span className="font-medium">{formatCurrency(item.saldoActual)}</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-500"
                                style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No hay financiamientos activos para mostrar.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CxC / CxP / Inventario */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <ProgressSplitCard
              title="Cuentas por Cobrar"
              total={cxc.total}
              currentLabel="Corriente"
              currentValue={cxc.corriente}
              currentPct={cxcCorrientePct}
              overdueLabel="Vencido"
              overdueValue={cxc.vencido}
              overduePct={cxcVencidoPct}
              icon={<Clock3 className="h-5 w-5" />}
            />

            <ProgressSplitCard
              title="Cuentas por Pagar"
              total={cxp.total}
              currentLabel="Corriente"
              currentValue={cxp.corriente}
              currentPct={cxpCorrientePct}
              overdueLabel="Vencido"
              overdueValue={cxp.vencido}
              overduePct={cxpVencidoPct}
              icon={<CreditCard className="h-5 w-5" />}
            />

            <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-secondary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Boxes className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Salud del inventario</CardTitle>
                    <CardDescription>Total productos: {inventario.totalProductos}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Bien
                    </span>
                    <span className="text-muted-foreground">
                      {inventario.bien} · {inventarioBienPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(inventarioBienPct, 100)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-warning" />
                      Bajo
                    </span>
                    <span className="text-muted-foreground">
                      {inventario.bajo} · {inventarioBajoPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-warning" style={{ width: `${Math.min(inventarioBajoPct, 100)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Negativo
                    </span>
                    <span className="text-muted-foreground">
                      {inventario.negativo} · {inventarioNegativoPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-destructive" style={{ width: `${Math.min(inventarioNegativoPct, 100)}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pendientes / Próximamente */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-secondary/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Radiografía del negocio</CardTitle>
                    <CardDescription>Módulo ligado a análisis financiero</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Este bloque ya quedó contemplado en el dashboard y se puede activar cuando conectemos el módulo de análisis financiero.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-warning/15 text-warning px-3 py-1.5 text-sm font-medium">
                  {pendientes.radiografiaNegocio ? "Pendiente" : "Activo"}
                </span>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-secondary/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Recomendaciones IA</CardTitle>
                    <CardDescription>Insights automáticos sobre información financiera</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    La UI queda lista para pintar recomendaciones en cuanto integremos la capa de IA.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-warning/15 text-warning px-3 py-1.5 text-sm font-medium">
                  {pendientes.recomendacionesIA ? "Pendiente" : "Activo"}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Footer mini info */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-muted-foreground">
            <p>
              Dashboard conectado al nuevo resumen financiero unificado de Bukipin.
            </p>
            <p>
              Registros cargados: {dashboard?.meta?.generatedAt ? new Date(dashboard.meta.generatedAt).toLocaleString() : "N/D"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;