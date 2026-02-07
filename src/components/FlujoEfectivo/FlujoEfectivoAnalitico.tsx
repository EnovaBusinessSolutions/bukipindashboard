import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { apiFetch } from "@/lib/api";

interface FlujoEfectivoAnaliticoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  vistaColumnas: "consolidada" | "detallada";
  filtroMetodoPago: "consolidado" | "efectivo" | "bancos";
}

type MoneySplit = { efectivo: number; bancos: number; total: number };

type MovimientoDetalle = {
  fecha: string | null; // YYYY-MM-DD
  tipo: "efectivo" | "bancos";
  monto: number; // neto con signo
  memo?: string;
  asientoId?: string;
  categoria?: "operativo" | "inversion" | "financiamiento";
};

type FlujoApi = {
  view?: string;
  range?: { start: string; end: string };
  saldoInicial?: MoneySplit;
  operativo?: MoneySplit;
  inversion?: MoneySplit;
  financiamiento?: MoneySplit;
  flujoNeto?: MoneySplit;
  saldoFinal?: MoneySplit;
  movimientosDetalle?: MovimientoDetalle[];
  sinDatos?: boolean;
};

type AnyJson = any;

const apiJson = async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
  const res: AnyJson = await apiFetch(url, init);
  return (res?.data ?? res) as T;
};

// YYYY-MM-DD en hora local (evita timezone issues)
function toYMDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface WaterfallData {
  name: string;
  value: number; // base (invisible)
  start: number; // barra visible
  fill: string;
  isTotal: boolean;
}

const FlujoEfectivoAnalitico = ({ startDate, endDate, filtroMetodoPago }: FlujoEfectivoAnaliticoProps) => {
  const startYMD = toYMDLocal(startDate);
  const endYMD = toYMDLocal(endDate);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["flujo-efectivo-analitico", startYMD, endYMD, filtroMetodoPago],
    queryFn: async () => {
      const payload = await apiJson<FlujoApi>(
        `/api/flujo-efectivo/analitico?start=${encodeURIComponent(startYMD)}&end=${encodeURIComponent(endYMD)}`,
        { method: "GET" }
      );

      const root = (payload as any)?.data ? (payload as any)?.data : payload;

      const saldoInicial: MoneySplit = root?.saldoInicial ?? { efectivo: 0, bancos: 0, total: 0 };
      const operativo: MoneySplit = root?.operativo ?? { efectivo: 0, bancos: 0, total: 0 };
      const inversion: MoneySplit = root?.inversion ?? { efectivo: 0, bancos: 0, total: 0 };
      const financiamiento: MoneySplit = root?.financiamiento ?? { efectivo: 0, bancos: 0, total: 0 };
      const saldoFinal: MoneySplit = root?.saldoFinal ?? {
        efectivo: saldoInicial.efectivo + operativo.efectivo + inversion.efectivo + financiamiento.efectivo,
        bancos: saldoInicial.bancos + operativo.bancos + inversion.bancos + financiamiento.bancos,
        total: saldoInicial.total + operativo.total + inversion.total + financiamiento.total,
      };

      let movimientosDetalle: MovimientoDetalle[] = Array.isArray(root?.movimientosDetalle) ? root.movimientosDetalle : [];

      // Filtro por método (por seguridad; backend manda ambos)
      movimientosDetalle = movimientosDetalle.filter((m) => {
        if (!m) return false;
        if (filtroMetodoPago === "consolidado") return true;
        return m.tipo === filtroMetodoPago;
      });

      return {
        saldoInicial,
        operativo,
        inversion,
        financiamiento,
        saldoFinal,
        movimientosDetalle,
        sinDatos: Boolean(root?.sinDatos) || movimientosDetalle.length === 0,
      };
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const formatCurrency = (value: number) =>
    `$${Math.abs(value).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const CustomTooltipWaterfall = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const displayValue = Number(d?.start) || 0;
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-1">{d?.name}</p>
          <p className={`text-sm ${displayValue >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(displayValue)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    const msg =
      (error as any)?.message ||
      "No se pudo cargar el análisis de flujo. Revisa tu sesión o el backend.";
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{msg}</AlertDescription>
      </Alert>
    );
  }

  const saldoInicial = data?.saldoInicial?.total ?? 0;
  const totOperativo = data?.operativo?.total ?? 0;
  const totInversion = data?.inversion?.total ?? 0;
  const totFin = data?.financiamiento?.total ?? 0;

  const totalGeneral = totOperativo + totInversion + totFin;
  const saldoFinal = data?.saldoFinal?.total ?? (saldoInicial + totalGeneral);

  const movimientos = data?.movimientosDetalle ?? [];

  // Para tu “Sankey visual”: lo construimos con movimientosDetalle + categoria
  const op = movimientos.filter((m) => m.categoria === "operativo");
  const inv = movimientos.filter((m) => m.categoria === "inversion");
  const fin = movimientos.filter((m) => m.categoria === "financiamiento");

  const cobros = op.filter((t) => (t.monto ?? 0) > 0).reduce((sum, t) => sum + (t.monto || 0), 0);
  const pagos = Math.abs(op.filter((t) => (t.monto ?? 0) < 0).reduce((sum, t) => sum + (t.monto || 0), 0));

  const inversiones = Math.abs(inv.reduce((sum, t) => sum + (t.monto || 0), 0));

  const nuevosCreditos = fin.filter((t) => (t.monto ?? 0) > 0).reduce((sum, t) => sum + (t.monto || 0), 0);
  const pagosCreditos = Math.abs(fin.filter((t) => (t.monto ?? 0) < 0).reduce((sum, t) => sum + (t.monto || 0), 0));

  const totalIngresos = cobros + nuevosCreditos;
  const totalEgresos = pagos + inversiones + pagosCreditos;

  // Waterfall
  const waterfallData: WaterfallData[] = [];

  waterfallData.push({
    name: "Saldo Inicial",
    value: 0,
    start: saldoInicial,
    fill: "hsl(var(--chart-balance))",
    isTotal: true,
  });

  const despuesOperativo = saldoInicial + totOperativo;
  waterfallData.push({
    name: "Activ. Operativas",
    value: saldoInicial,
    start: totOperativo,
    fill: totOperativo >= 0 ? "hsl(var(--chart-income))" : "hsl(var(--chart-expense))",
    isTotal: false,
  });

  waterfallData.push({
    name: "Subtotal Operativo",
    value: 0,
    start: despuesOperativo,
    fill: "hsl(var(--chart-balance))",
    isTotal: true,
  });

  const despuesInversion = despuesOperativo + totInversion;
  waterfallData.push({
    name: "Activ. Inversión",
    value: despuesOperativo,
    start: totInversion,
    fill: totInversion >= 0 ? "hsl(var(--chart-income))" : "hsl(var(--chart-expense))",
    isTotal: false,
  });

  waterfallData.push({
    name: "Subtotal Inversión",
    value: 0,
    start: despuesInversion,
    fill: "hsl(var(--chart-balance))",
    isTotal: true,
  });

  const despuesFinanciamiento = despuesInversion + totFin;
  waterfallData.push({
    name: "Activ. Financ.",
    value: despuesInversion,
    start: totFin,
    fill: totFin >= 0 ? "hsl(var(--chart-income))" : "hsl(var(--chart-expense))",
    isTotal: false,
  });

  waterfallData.push({
    name: "SALDO FINAL",
    value: 0,
    start: saldoFinal,
    fill: "hsl(var(--chart-balance))",
    isTotal: true,
  });

  const hayDatos = !data?.sinDatos;

  if (!hayDatos) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No hay transacciones registradas en el período seleccionado. Comienza registrando transacciones para ver el análisis detallado del flujo de efectivo.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Waterfall */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-2xl">1. Gráfico de Cascada del Flujo de Efectivo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visualización del impacto de cada categoría de actividades en el efectivo
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 60, bottom: 80 }} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }}
                interval={0}
              />
              <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} width={80} />
              <Tooltip content={<CustomTooltipWaterfall />} />
              <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />

              {/* Base invisible */}
              <Bar dataKey="value" stackId="stack" isAnimationActive={false}>
                {waterfallData.map((_, index) => (
                  <Cell key={`cell-value-${index}`} fill="transparent" style={{ pointerEvents: "none" }} />
                ))}
              </Bar>

              {/* Barra visible */}
              <Bar
                dataKey="start"
                stackId="stack"
                radius={[6, 6, 6, 6]}
                label={{
                  position: "top",
                  content: ({ x, y, width, index }: any) => {
                    const item = waterfallData[index];
                    if (!item) return null;
                    return (
                      <text
                        x={Number(x) + Number(width) / 2}
                        y={Number(y) - 5}
                        fill="hsl(var(--foreground))"
                        textAnchor="middle"
                        dominantBaseline="bottom"
                        fontSize={10}
                        fontWeight="bold"
                      >
                        {formatCurrency(item.start)}
                      </text>
                    );
                  },
                }}
              >
                {waterfallData.map((entry, index) => (
                  <Cell
                    key={`cell-start-${index}`}
                    fill={entry.fill}
                    stroke={entry.isTotal ? "#000" : "transparent"}
                    strokeWidth={entry.isTotal ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Saldo Inicial</p>
              <p className="font-semibold text-lg">{formatCurrency(saldoInicial)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Flujo Operativo</p>
              <p className={`font-semibold text-lg ${totOperativo >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(totOperativo)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Flujo Neto</p>
              <p className={`font-semibold text-lg ${totalGeneral >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(totalGeneral)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Saldo Final</p>
              <p className={`font-semibold text-lg ${saldoFinal >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(saldoFinal)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. “Sankey visual” (bloques proporcionales) */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-2xl">2. Composición de Ingresos y Egresos de Efectivo</CardTitle>
          <p className="text-sm text-muted-foreground">Desglose porcentual por naturaleza de cada flujo</p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-8 items-stretch">
            {/* Ingresos */}
            <div
              className="flex-1 transition-all duration-500 hover:scale-105"
              style={{
                minHeight: `${Math.max(200, (totalIngresos / Math.max(totalIngresos, totalEgresos || 1)) * 500)}px`,
                maxHeight: "600px",
              }}
            >
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-6 rounded-lg border-2 border-green-200 dark:border-green-800 h-full flex flex-col animate-fade-in">
                <h3 className="text-xl font-bold mb-4 text-green-800 dark:text-green-200">Ingresos de Efectivo</h3>

                <div className="flex-1 flex flex-col justify-center space-y-3">
                  <div
                    className="flex flex-col p-4 bg-white dark:bg-green-950 rounded-md transition-all duration-300 hover:shadow-lg"
                    style={{
                      height: totalIngresos > 0 ? `${(cobros / totalIngresos) * 100}%` : "50%",
                      minHeight: "60px",
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">Cobros a Clientes</span>
                      <div className="text-right">
                        <p className="font-bold text-2xl text-green-600">
                          {totalIngresos > 0 ? ((cobros / totalIngresos) * 100).toFixed(1) : "0"}%
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-auto">{formatCurrency(cobros)}</p>
                  </div>

                  <div
                    className="flex flex-col p-4 bg-white dark:bg-green-950 rounded-md transition-all duration-300 hover:shadow-lg"
                    style={{
                      height: totalIngresos > 0 ? `${(nuevosCreditos / totalIngresos) * 100}%` : "50%",
                      minHeight: "60px",
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">Nuevos Créditos</span>
                      <div className="text-right">
                        <p className="font-bold text-2xl text-green-600">
                          {totalIngresos > 0 ? ((nuevosCreditos / totalIngresos) * 100).toFixed(1) : "0"}%
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-auto">{formatCurrency(nuevosCreditos)}</p>
                  </div>
                </div>

                <div className="flex justify-between border-t-2 border-green-300 pt-3 mt-4">
                  <span className="font-bold text-lg">Total Ingresos</span>
                  <span className="font-bold text-xl text-green-700 dark:text-green-300">
                    {formatCurrency(totalIngresos)}
                  </span>
                </div>
              </div>
            </div>

            {/* Egresos */}
            <div
              className="flex-1 transition-all duration-500 hover:scale-105"
              style={{
                minHeight: `${Math.max(200, (totalEgresos / Math.max(totalIngresos || 1, totalEgresos || 1)) * 500)}px`,
                maxHeight: "600px",
              }}
            >
              <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 p-6 rounded-lg border-2 border-red-200 dark:border-red-800 h-full flex flex-col animate-fade-in">
                <h3 className="text-xl font-bold mb-4 text-red-800 dark:text-red-200">Egresos de Efectivo</h3>

                <div className="flex-1 flex flex-col justify-center space-y-3">
                  <div
                    className="flex flex-col p-4 bg-white dark:bg-red-950 rounded-md transition-all duration-300 hover:shadow-lg"
                    style={{
                      height: totalEgresos > 0 ? `${(pagos / totalEgresos) * 100}%` : "33.33%",
                      minHeight: "60px",
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">Pagos a Proveedores</span>
                      <div className="text-right">
                        <p className="font-bold text-2xl text-red-600">
                          {totalEgresos > 0 ? ((pagos / totalEgresos) * 100).toFixed(1) : "0"}%
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-auto">{formatCurrency(pagos)}</p>
                  </div>

                  <div
                    className="flex flex-col p-4 bg-white dark:bg-red-950 rounded-md transition-all duration-300 hover:shadow-lg"
                    style={{
                      height: totalEgresos > 0 ? `${(inversiones / totalEgresos) * 100}%` : "33.33%",
                      minHeight: "60px",
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">Inversiones (CAPEX)</span>
                      <div className="text-right">
                        <p className="font-bold text-2xl text-red-600">
                          {totalEgresos > 0 ? ((inversiones / totalEgresos) * 100).toFixed(1) : "0"}%
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-auto">{formatCurrency(inversiones)}</p>
                  </div>

                  <div
                    className="flex flex-col p-4 bg-white dark:bg-red-950 rounded-md transition-all duration-300 hover:shadow-lg"
                    style={{
                      height: totalEgresos > 0 ? `${(pagosCreditos / totalEgresos) * 100}%` : "33.33%",
                      minHeight: "60px",
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">Pago de Créditos</span>
                      <div className="text-right">
                        <p className="font-bold text-2xl text-red-600">
                          {totalEgresos > 0 ? ((pagosCreditos / totalEgresos) * 100).toFixed(1) : "0"}%
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-auto">{formatCurrency(pagosCreditos)}</p>
                  </div>
                </div>

                <div className="flex justify-between border-t-2 border-red-300 pt-3 mt-4">
                  <span className="font-bold text-lg">Total Egresos</span>
                  <span className="font-bold text-xl text-red-700 dark:text-red-300">
                    {formatCurrency(totalEgresos)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FlujoEfectivoAnalitico;
