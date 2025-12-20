import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts";
import { clasificarAsiento } from "@/lib/flujoEfectivoUtils";

interface FlujoEfectivoAnaliticoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  vistaColumnas: "consolidada" | "detallada";
  filtroMetodoPago: "consolidado" | "efectivo" | "bancos";
}

interface Transaccion {
  fecha: string;
  referencia: string;
  tipo: string;
  descripcion: string;
  monto: number;
  categoria: string;
  metodoPago?: string;
}

interface WaterfallData {
  name: string;
  value: number;
  start: number;
  fill: string;
  isTotal: boolean;
}

// Lo que regresa el backend (asientos con detalles)
type ApiAsiento = {
  id: string;
  numero_asiento: string;
  fecha: string; // ISO o YYYY-MM-DD
  descripcion: string;
  detalle_asientos: Array<{
    cuenta_codigo: string;
    debe: number;
    haber: number;
    descripcion?: string;
  }>;
};

type ApiResponse = {
  saldoInicial: number;
  asientos: ApiAsiento[];
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(json?.error || json?.message || `Error HTTP ${res.status}`);
  return (json?.data ?? json) as T;
}

function toYMD(d: Date) {
  return d.toISOString().split("T")[0];
}

const FlujoEfectivoAnalitico = ({ startDate, endDate, filtroMetodoPago }: FlujoEfectivoAnaliticoProps) => {
  const startStr = toYMD(startDate);
  const endStr = toYMD(endDate);

  const { data, isLoading, error } = useQuery({
    queryKey: ["flujo-efectivo-analitico", startStr, endStr, filtroMetodoPago],
    queryFn: async () => {
      const url =
        `/api/flujo-efectivo/analitico?start=${encodeURIComponent(startStr)}` +
        `&end=${encodeURIComponent(endStr)}` +
        `&metodo=${encodeURIComponent(filtroMetodoPago)}`;

      const payload = await fetchJSON<ApiResponse>(url);

      // Convertir asientos a Transaccion[] (igual que tu lógica actual)
      const trans: Transaccion[] = [];

      payload.asientos?.forEach((asiento) => {
        const detalles = asiento.detalle_asientos || [];

        // impacto en efectivo/bancos (mismo criterio que tu código actual)
        let impactoEfectivo = 0;
        let impactoBancos = 0;
        let afectaEfectivo = false;
        let afectaBancos = false;
        let metodoPago = "";

        detalles.forEach((det) => {
          if (det.cuenta_codigo === "1001") {
            afectaEfectivo = true;
            impactoEfectivo += Number(det.debe || 0) - Number(det.haber || 0);
            metodoPago = "efectivo";
          } else if (det.cuenta_codigo === "1002") {
            afectaBancos = true;
            impactoBancos += Number(det.debe || 0) - Number(det.haber || 0);
            metodoPago = "bancos";
          }
        });

        // Filtrar según método
        if (!afectaEfectivo && !afectaBancos) return;
        if (filtroMetodoPago === "efectivo" && !afectaEfectivo) return;
        if (filtroMetodoPago === "bancos" && !afectaBancos) return;

        const montoTotal = impactoEfectivo + impactoBancos;
        if (montoTotal === 0) return;

        const clasificacion = clasificarAsiento(detalles as any);
        const categoria = clasificacion.categoria === "Inversion" ? "Inversión" : clasificacion.categoria;
        const tipo = clasificacion.subcategoria || (montoTotal > 0 ? "Cobro" : "Pago");

        trans.push({
          fecha: format(new Date(asiento.fecha), "dd/MM/yyyy"),
          referencia: asiento.numero_asiento,
          tipo,
          descripcion: asiento.descripcion,
          monto: montoTotal,
          categoria,
          metodoPago
        });
      });

      return {
        saldoInicial: Number(payload.saldoInicial || 0),
        transacciones: trans,
      };
    },
  });

  const errorMsg = (error as any)?.message || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{errorMsg}</AlertDescription>
      </Alert>
    );
  }

  const saldoInicial = data?.saldoInicial || 0;
  const transacciones = data?.transacciones || [];

  if (transacciones.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No hay transacciones registradas en el período seleccionado.
          Comienza registrando transacciones para ver el análisis detallado del flujo de efectivo.
        </AlertDescription>
      </Alert>
    );
  }

  const porCategoria = {
    operativo: transacciones.filter(t => t.categoria === "Operativo"),
    inversion: transacciones.filter(t => t.categoria === "Inversión"),
    financiamiento: transacciones.filter(t => t.categoria === "Financiamiento"),
  };

  const totales = {
    operativo: porCategoria.operativo.reduce((sum, t) => sum + t.monto, 0),
    inversion: porCategoria.inversion.reduce((sum, t) => sum + t.monto, 0),
    financiamiento: porCategoria.financiamiento.reduce((sum, t) => sum + t.monto, 0),
  };

  const cobros = porCategoria.operativo.filter(t => t.monto > 0).reduce((sum, t) => sum + t.monto, 0);
  const pagos = Math.abs(porCategoria.operativo.filter(t => t.monto < 0).reduce((sum, t) => sum + t.monto, 0));
  const inversiones = Math.abs(totales.inversion);
  const nuevosCreditos = porCategoria.financiamiento.filter(t => t.monto > 0).reduce((sum, t) => sum + t.monto, 0);
  const pagosCreditos = Math.abs(porCategoria.financiamiento.filter(t => t.monto < 0).reduce((sum, t) => sum + t.monto, 0));

  const totalIngresos = cobros + nuevosCreditos;
  const totalEgresos = pagos + inversiones + pagosCreditos;

  const totalGeneral = totales.operativo + totales.inversion + totales.financiamiento;
  const saldoFinal = saldoInicial + totalGeneral;

  const waterfallData: WaterfallData[] = [];

  waterfallData.push({
    name: "Saldo Inicial",
    value: 0,
    start: saldoInicial,
    fill: "hsl(var(--chart-balance))",
    isTotal: true
  });

  const despuesOperativo = saldoInicial + totales.operativo;
  waterfallData.push({
    name: "Activ. Operativas",
    value: saldoInicial,
    start: totales.operativo,
    fill: totales.operativo >= 0 ? "hsl(var(--chart-income))" : "hsl(var(--chart-expense))",
    isTotal: false
  });

  waterfallData.push({
    name: "Subtotal Operativo",
    value: 0,
    start: despuesOperativo,
    fill: "hsl(var(--chart-balance))",
    isTotal: true
  });

  const despuesInversion = despuesOperativo + totales.inversion;
  waterfallData.push({
    name: "Activ. Inversión",
    value: despuesOperativo,
    start: totales.inversion,
    fill: totales.inversion >= 0 ? "hsl(var(--chart-income))" : "hsl(var(--chart-expense))",
    isTotal: false
  });

  waterfallData.push({
    name: "Subtotal Inversión",
    value: 0,
    start: despuesInversion,
    fill: "hsl(var(--chart-balance))",
    isTotal: true
  });

  const despuesFinanciamiento = despuesInversion + totales.financiamiento;
  waterfallData.push({
    name: "Activ. Financ.",
    value: despuesInversion,
    start: totales.financiamiento,
    fill: totales.financiamiento >= 0 ? "hsl(var(--chart-income))" : "hsl(var(--chart-expense))",
    isTotal: false
  });

  waterfallData.push({
    name: "SALDO FINAL",
    value: 0,
    start: saldoFinal,
    fill: "hsl(var(--chart-balance))",
    isTotal: true
  });

  const formatCurrency = (value: number) =>
    `$${Math.abs(value).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const CustomTooltipWaterfall = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const displayValue = d.start;
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-1">{d.name}</p>
          <p className={`text-sm ${displayValue >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(displayValue)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
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
              <YAxis
                tickFormatter={(v) => formatCurrency(v)}
                tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                width={80}
              />
              <Tooltip content={<CustomTooltipWaterfall />} />
              <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />

              <Bar dataKey="value" stackId="stack" isAnimationActive={false}>
                {waterfallData.map((_, i) => (
                  <Cell key={`cell-value-${i}`} fill="transparent" style={{ pointerEvents: "none" }} />
                ))}
              </Bar>

              <Bar
                dataKey="start"
                stackId="stack"
                radius={[6, 6, 6, 6]}
                isAnimationActive={false}
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
                  }
                }}
              >
                {waterfallData.map((entry, i) => (
                  <Cell
                    key={`cell-start-${i}`}
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
              <p className={`font-semibold text-lg ${totales.operativo >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(totales.operativo)}
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

      {/* (Tu bloque 2 Sankey se queda igual, no lo toqué) */}
      {/* ... */}
    </div>
  );
};

export default FlujoEfectivoAnalitico;
