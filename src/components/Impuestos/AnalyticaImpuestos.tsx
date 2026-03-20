import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useUtilidadAntesImpuestos } from "@/hooks/useUtilidadAntesImpuestos";
import { useEstadoResultadosMensual } from "@/hooks/useEstadoResultadosMensual";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  TrendingUp,
  ChevronDown,
  Sparkles,
  BarChart3,
  CalendarRange,
  Scale,
  ReceiptText,
  Landmark,
  ArrowRightLeft,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface DatosGrafica {
  periodo: string;
  calculado: number;
  registrado: number;
  diferencia: number;
}

type TxImpuesto = {
  ano: number;
  mes: number; // 1-12
  isr_calculado: number | string;
  isr_real: number | string;
};

export const AnalyticaImpuestos = () => {
  const currentYear = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;
  const [anoSeleccionado, setAnoSeleccionado] = useState<number>(currentYear);
  const [tipoVista, setTipoVista] = useState<"mensual" | "anual">("mensual");
  const [datos, setDatos] = useState<DatosGrafica[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasaISR] = useState<string>("30");

  const { data: utilidadMesActual } = useUtilidadAntesImpuestos(
    tipoVista === "mensual" && anoSeleccionado === currentYear ? mesActual : 0,
    anoSeleccionado
  );

  const { data: resultadosAnuales } = useEstadoResultadosMensual(currentYear);

  useEffect(() => {
    let intervalId: any = null;
    let cancelled = false;

    const toNumber = (v: any) => {
      const n = Number(v ?? 0);
      return Number.isFinite(n) ? n : 0;
    };

    const fetchDatos = async () => {
      setLoading(true);

      try {
        if (tipoVista === "mensual") {
          const json = await apiFetch(`/api/impuestos/transacciones?year=${anoSeleccionado}`);
          const payload = (json?.data ?? json) as { transacciones?: TxImpuesto[] } | TxImpuesto[];
          const transacciones: TxImpuesto[] = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.transacciones)
              ? payload.transacciones
              : [];

          const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

          const datosCompletos = meses.map((mes, index) => {
            const mesNumero = index + 1;

            if (mesNumero === mesActual && anoSeleccionado === currentYear && utilidadMesActual) {
              const utilidadActual = toNumber((utilidadMesActual as any)?.utilidadAntesImpuestos);
              const isrCalculadoActual = utilidadActual > 0 ? (utilidadActual * parseFloat(tasaISR)) / 100 : 0;

              const transaccionesMes = (transacciones || []).filter((t) => Number(t.mes) === mesNumero);
              const isrRegistrado = transaccionesMes.reduce((sum, t) => sum + toNumber(t.isr_real), 0);

              return {
                periodo: mes,
                calculado: isrCalculadoActual,
                registrado: isrRegistrado,
                diferencia: isrRegistrado - isrCalculadoActual,
              };
            }

            if (mesNumero < mesActual || anoSeleccionado < currentYear) {
              const transaccionesMes = (transacciones || []).filter((t) => Number(t.mes) === mesNumero);

              if (transaccionesMes.length === 0) {
                return { periodo: mes, calculado: 0, registrado: 0, diferencia: 0 };
              }

              const calculadoMes = toNumber(transaccionesMes[0]?.isr_calculado);
              const registradoMes = transaccionesMes.reduce((sum, t) => sum + toNumber(t.isr_real), 0);

              return {
                periodo: mes,
                calculado: calculadoMes,
                registrado: registradoMes,
                diferencia: registradoMes - calculadoMes,
              };
            }

            return { periodo: mes, calculado: 0, registrado: 0, diferencia: 0 };
          });

          if (!cancelled) setDatos(datosCompletos);
        } else {
          const startYear = currentYear - 4;
          const endYear = currentYear;

          const json = await apiFetch(`/api/impuestos/transacciones?startYear=${startYear}&endYear=${endYear}`);
          const payload = (json?.data ?? json) as { transacciones?: TxImpuesto[] } | TxImpuesto[];
          const transacciones: TxImpuesto[] = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.transacciones)
              ? payload.transacciones
              : [];

          let isrCalculadoAnoActual = 0;
          let isrRegistradoAnoActual = 0;

          if (resultadosAnuales) {
            const utilidadAcumuladaAnual = (resultadosAnuales as any[])
              .slice(0, mesActual)
              .reduce((sum, mes) => sum + toNumber(mes.utilidadAntesImpuestos), 0);

            isrCalculadoAnoActual = utilidadAcumuladaAnual > 0 ? (utilidadAcumuladaAnual * parseFloat(tasaISR)) / 100 : 0;
          }

          isrRegistradoAnoActual = (transacciones || [])
            .filter((t) => Number(t.ano) === currentYear)
            .reduce((sum, t) => sum + toNumber(t.isr_real), 0);

          const anosAnteriores = (transacciones || []).filter((t) => Number(t.ano) < currentYear);

    const agrupadoPorAno = anosAnteriores.reduce((acc, t) => {
            const ano = Number(t.ano);
            if (!acc[ano]) {
              acc[ano] = {
                calculado: 0,
                registrado: 0,
                mesesContados: new Set<number>(),
              };
            }

            const mes = Number(t.mes);
            if (!acc[ano].mesesContados.has(mes)) {
              acc[ano].calculado += toNumber(t.isr_calculado);
              acc[ano].mesesContados.add(mes);
            }

            acc[ano].registrado += toNumber(t.isr_real);
            return acc;
          }, {} as Record<number, { calculado: number; registrado: number; mesesContados: Set<number> }>);

          const datosFormateados: DatosGrafica[] = Object.entries(agrupadoPorAno).map(([ano, valores]) => ({
            periodo: ano,
            calculado: valores.calculado,
            registrado: valores.registrado,
            diferencia: valores.registrado - valores.calculado,
          })) as any;

          datosFormateados.push({
            periodo: currentYear.toString(),
            calculado: isrCalculadoAnoActual,
            registrado: isrRegistradoAnoActual,
            diferencia: isrRegistradoAnoActual - isrCalculadoAnoActual,
          });

          datosFormateados.sort((a, b) => parseInt(a.periodo) - parseInt(b.periodo));

          if (!cancelled) setDatos(datosFormateados);
        }
      } catch (err) {
        console.error("Error fetching datos:", err);
        if (!cancelled) setDatos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDatos();

    if ((tipoVista === "mensual" && anoSeleccionado === currentYear) || tipoVista === "anual") {
      intervalId = setInterval(fetchDatos, 60_000);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [anoSeleccionado, tipoVista, currentYear, mesActual, utilidadMesActual, resultadosAnuales, tasaISR]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totales =
    tipoVista === "mensual"
      ? datos.reduce(
          (acc, d) => ({
            calculado: acc.calculado + d.calculado,
            registrado: acc.registrado + d.registrado,
            diferencia: acc.registrado + d.registrado - (acc.calculado + d.calculado),
          }),
          { calculado: 0, registrado: 0, diferencia: 0 }
        )
      : datos.find((d) => d.periodo === anoSeleccionado.toString()) || { calculado: 0, registrado: 0, diferencia: 0 };

  const promedioDiferencia = datos.length > 0 ? totales.diferencia / datos.length : 0;

  const valorMaximo =
    datos.length > 0 ? Math.max(...datos.map((d) => Math.max(d.calculado, d.registrado, Math.abs(d.diferencia)))) : 0;
  const limiteYAxis = Math.ceil(valorMaximo * 1.2);

  const colorDiferencia =
    totales.diferencia > 0 ? "text-red-600" : totales.diferencia < 0 ? "text-emerald-600" : "text-slate-900";

  const colorPromedio =
    promedioDiferencia > 0 ? "text-red-600" : promedioDiferencia < 0 ? "text-emerald-600" : "text-slate-900";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-cyan-50/70 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.10),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_24%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/70 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <Sparkles className="h-3.5 w-3.5" />
              Analítica fiscal premium
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Inteligencia visual del comportamiento del ISR
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-[15px]">
                Compara ISR calculado contra ISR registrado, detecta desviaciones y analiza el comportamiento mensual o
                anual con una visual mucho más ejecutiva, clara y premium.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <CalendarRange className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Vista</span>
              </div>
              <p className="text-lg font-semibold text-slate-900 capitalize">{tipoVista}</p>
              <p className="mt-1 text-xs text-slate-500">
                {tipoVista === "mensual" ? `Ejercicio ${anoSeleccionado}` : "Últimos 5 años"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Puntos</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">{datos.length}</p>
              <p className="mt-1 text-xs text-slate-500">elementos analizados</p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <Scale className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Tasa ISR</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">{tasaISR}%</p>
              <p className="mt-1 text-xs text-slate-500">base de cálculo actual</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controles */}
      <Card className="overflow-hidden rounded-3xl border-slate-200/70 bg-white/95 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500" />
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <ArrowRightLeft className="h-5 w-5 text-cyan-600" />
            Configuración de vista
          </CardTitle>
          <CardDescription className="text-slate-600">
            Selecciona el tipo de análisis y el ejercicio a consultar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tipo-vista" className="text-[13px] font-semibold text-slate-700">
              Tipo de Vista
            </Label>
            <Select value={tipoVista} onValueChange={(value) => setTipoVista(value as "mensual" | "anual")}>
              <SelectTrigger
                id="tipo-vista"
                className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 text-slate-800 shadow-sm transition-all hover:border-cyan-300 focus:ring-2 focus:ring-cyan-500/20"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-200">
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoVista === "mensual" && (
            <div className="space-y-2">
              <Label htmlFor="ano" className="text-[13px] font-semibold text-slate-700">
                Año
              </Label>
              <Select value={anoSeleccionado.toString()} onValueChange={(value) => setAnoSeleccionado(parseInt(value))}>
                <SelectTrigger
                  id="ano"
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 text-slate-800 shadow-sm transition-all hover:border-cyan-300 focus:ring-2 focus:ring-cyan-500/20"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200">
                  {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Métricas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="overflow-hidden rounded-3xl border-slate-200/70 bg-gradient-to-br from-white via-white to-cyan-50/70 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-35px_rgba(6,182,212,0.35)]">
          <CardHeader className="pb-3">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700 ring-1 ring-cyan-200">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div className="rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                Calculado
              </div>
            </div>
            <CardDescription className="text-slate-600">
              Total Calculado {tipoVista === "mensual" ? anoSeleccionado : ""}
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(totales.calculado)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-slate-200/70 bg-gradient-to-br from-white via-white to-violet-50/70 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-35px_rgba(139,92,246,0.35)]">
          <CardHeader className="pb-3">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl bg-violet-100 p-3 text-violet-700 ring-1 ring-violet-200">
                <Landmark className="h-5 w-5" />
              </div>
              <div className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                Registrado
              </div>
            </div>
            <CardDescription className="text-slate-600">
              Total Registrado {tipoVista === "mensual" ? anoSeleccionado : ""}
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(totales.registrado)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-slate-200/70 bg-gradient-to-br from-white via-white to-slate-50 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-35px_rgba(15,23,42,0.25)]">
          <CardHeader className="pb-3">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 ring-1 ring-slate-200">
                <Scale className="h-5 w-5" />
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                Diferencia
              </div>
            </div>
            <CardDescription className="text-slate-600">
              Diferencia Total {tipoVista === "mensual" ? anoSeleccionado : ""}
            </CardDescription>
            <CardTitle className={`text-2xl font-bold tracking-tight ${colorDiferencia}`}>
              {totales.diferencia > 0 ? "+" : ""}
              {formatCurrency(totales.diferencia)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-slate-200/70 bg-gradient-to-br from-white via-white to-emerald-50/70 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-35px_rgba(16,185,129,0.35)]">
          <CardHeader className="pb-3">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700 ring-1 ring-emerald-200">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Promedio
              </div>
            </div>
            <CardDescription className="text-slate-600">Promedio de Diferencia</CardDescription>
            <CardTitle className={`text-2xl font-bold tracking-tight ${colorPromedio}`}>
              {promedioDiferencia > 0 ? "+" : ""}
              {formatCurrency(promedioDiferencia)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Gráfica */}
      <Card className="overflow-hidden rounded-3xl border-slate-200/70 bg-white/95 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-slate-900 via-cyan-600 to-emerald-500" />
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <TrendingUp className="h-5 w-5 text-cyan-600" />
            Comparativa ISR Calculado vs Registrado
          </CardTitle>
          <CardDescription className="text-slate-600">
            Análisis histórico {tipoVista === "mensual" ? `del año ${anoSeleccionado}` : "de los últimos 5 años"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-sm text-slate-500">
              Cargando datos...
            </div>
          ) : datos.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 text-center">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-500">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-slate-800">No hay datos disponibles para el período seleccionado</p>
                <p className="mt-1 text-sm text-slate-500">
                  Cuando existan registros fiscales aparecerá aquí la comparativa analítica.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50/70 p-3 md:p-4">
              <ResponsiveContainer width="100%" height={420}>
                <ComposedChart data={datos} margin={{ top: 28, right: 20, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.25)" />
                  <XAxis
                    dataKey="periodo"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={{ stroke: "rgba(148,163,184,0.35)" }}
                    tickLine={{ stroke: "rgba(148,163,184,0.35)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={{ stroke: "rgba(148,163,184,0.35)" }}
                    tickLine={{ stroke: "rgba(148,163,184,0.35)" }}
                    domain={[0, limiteYAxis]}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid rgba(226,232,240,0.9)",
                      borderRadius: "16px",
                      boxShadow: "0 20px 50px -30px rgba(15,23,42,0.35)",
                      color: "#0f172a",
                    }}
                    labelStyle={{ color: "#0f172a", fontWeight: 700 }}
                    itemStyle={{ color: "#334155" }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "10px" }} />
                  <Bar
                    dataKey="calculado"
                    name="ISR Calculado"
                    fill="hsl(var(--chart-1))"
                    radius={[10, 10, 0, 0]}
                    maxBarSize={42}
                    label={{
                      position: "top",
                      fill: "#64748b",
                      fontSize: 11,
                      formatter: (value: number) => `$${formatNumber(value)}`,
                    }}
                  />
                  <Bar
                    dataKey="registrado"
                    name="ISR Registrado"
                    fill="hsl(var(--chart-2))"
                    radius={[10, 10, 0, 0]}
                    maxBarSize={42}
                    label={{
                      position: "top",
                      fill: "#64748b",
                      fontSize: 11,
                      formatter: (value: number) => `$${formatNumber(value)}`,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="diferencia"
                    name="Diferencia"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--destructive))", r: 4.5 }}
                    activeDot={{ r: 6 }}
                    label={{
                      position: "top",
                      fill: "#475569",
                      fontSize: 11,
                      formatter: (value: number) => `$${formatNumber(value)}`,
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Análisis de Diferencias */}
      {datos.length > 0 && (
        <Card className="overflow-hidden rounded-3xl border-slate-200/70 bg-white/95 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)]">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-slate-900" />
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Scale className="h-5 w-5 text-emerald-600" />
              Análisis de Diferencias
            </CardTitle>
            <CardDescription className="text-slate-600">
              Detalle de las variaciones entre ISR calculado y registrado.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="group w-full rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 text-left shadow-sm transition-all hover:border-cyan-200 hover:bg-slate-50/80">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                        Resumen Total
                      </span>
                      <span className="rounded-full bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-700">
                        Calculado: {formatCurrency(totales.calculado)}
                      </span>
                      <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
                        Registrado: {formatCurrency(totales.registrado)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${
                          totales.diferencia > 0
                            ? "bg-red-50 text-red-700"
                            : totales.diferencia < 0
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        Diferencia: {totales.diferencia > 0 ? "+" : ""}
                        {formatCurrency(totales.diferencia)}
                      </span>
                    </div>

                    <ChevronDown className="h-5 w-5 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-4 space-y-3">
                {datos.map((d, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition-colors hover:border-cyan-200 hover:bg-cyan-50/30 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{d.periodo}</p>
                      <p className="text-xs text-slate-500">Periodo analizado</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                      <span className="rounded-full bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
                        Calculado: {formatCurrency(d.calculado)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
                        Registrado: {formatCurrency(d.registrado)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold shadow-sm ${
                          d.diferencia > 0
                            ? "bg-red-50 text-red-700"
                            : d.diferencia < 0
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {d.diferencia > 0 ? "+" : ""}
                        {formatCurrency(d.diferencia)}
                      </span>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}
    </div>
  );
};