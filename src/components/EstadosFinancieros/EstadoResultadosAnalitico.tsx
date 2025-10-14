import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PeriodType } from "@/pages/EstadoResultados";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

interface EstadoResultadosAnaliticoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
}

interface SaldoCuenta {
  cuenta_codigo: string;
  debe_total: number;
  haber_total: number;
  saldo: number;
}

interface WaterfallData {
  name: string;
  value: number;
  displayValue: number;
  start: number;
  end: number;
  fill: string;
  isTotal: boolean;
}

const EstadoResultadosAnalitico = ({ startDate, endDate }: EstadoResultadosAnaliticoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();

  const { data: saldosAutomaticos, isLoading: saldosAutomaticosLoading } = useQuery({
    queryKey: ["saldos-automaticos-analitico", startDate, endDate],
    queryFn: async () => {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      const { data: ingresosData } = await supabase
        .from('transacciones_ingresos')
        .select('monto_neto')
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr);

      const ingresos = ingresosData?.reduce((sum, t) => sum + (t.monto_neto || 0), 0) || 0;

      const { data: costosData } = await supabase
        .from('transacciones_egresos')
        .select('monto_total')
        .eq('tipo_egreso', 'costo')
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr);

      const costos = costosData?.reduce((sum, t) => sum + (t.monto_total || 0), 0) || 0;

      const { data: gastosData } = await supabase
        .from('transacciones_egresos')
        .select('monto_total')
        .eq('tipo_egreso', 'gasto')
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr);

      const gastos = gastosData?.reduce((sum, t) => sum + (t.monto_total || 0), 0) || 0;

      return { ingresos, costos, gastos };
    },
  });

  const { data: saldosAsientos, isLoading: saldosLoading } = useQuery({
    queryKey: ["saldos-asientos-analitico", startDate, endDate],
    queryFn: async () => {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const { data: asientos } = await supabase
        .from("asientos_contables")
        .select("id")
        .gte('fecha', startDateStr)
        .lte('fecha', endDateStr);

      if (!asientos || asientos.length === 0) return {};

      const asientoIds = asientos.map(a => a.id);

      const { data, error } = await supabase
        .from("detalle_asientos")
        .select("cuenta_codigo, debe, haber")
        .in("asiento_id", asientoIds);

      if (error) throw error;

      const saldosPorCuenta: { [key: string]: SaldoCuenta } = {};

      data?.forEach((detalle) => {
        const codigo = detalle.cuenta_codigo;
        if (!saldosPorCuenta[codigo]) {
          saldosPorCuenta[codigo] = {
            cuenta_codigo: codigo,
            debe_total: 0,
            haber_total: 0,
            saldo: 0,
          };
        }
        saldosPorCuenta[codigo].debe_total += Number(detalle.debe || 0);
        saldosPorCuenta[codigo].haber_total += Number(detalle.haber || 0);
      });

      Object.values(saldosPorCuenta).forEach((cuenta) => {
        const codigo = cuenta.cuenta_codigo;
        
        if (codigo.startsWith("4")) {
          cuenta.saldo = cuenta.haber_total - cuenta.debe_total;
        } else if (codigo.startsWith("5")) {
          cuenta.saldo = cuenta.debe_total - cuenta.haber_total;
        }
      });

      return saldosPorCuenta;
    },
  });

  if (cuentasLoading || saldosLoading || saldosAutomaticosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const cuentasFlat = cuentasData?.cuentasFlat || [];

  const obtenerSaldo = (codigoCuenta: string): number => {
    const saldoAsiento = saldosAsientos?.[codigoCuenta]?.saldo || 0;
    let saldoAutomatico = 0;

    if (!saldosAutomaticos) return saldoAsiento;

    if (codigoCuenta.startsWith("4")) {
      if (codigoCuenta === "4001") {
        saldoAutomatico = saldosAutomaticos.ingresos;
      }
    } else if (codigoCuenta.startsWith("5")) {
      const codigoNum = parseInt(codigoCuenta);
      if (codigoNum >= 5001 && codigoNum <= 5099) {
        if (codigoCuenta === "5001") {
          saldoAutomatico = saldosAutomaticos.costos;
        }
      } else if (codigoNum >= 5100) {
        if (codigoCuenta === "5100") {
          saldoAutomatico = saldosAutomaticos.gastos;
        }
      }
    }

    return saldoAsiento + saldoAutomatico;
  };

  // Calcular métricas
  const cuentasIngresos = cuentasFlat.filter(cuenta => 
    cuenta.codigo.startsWith("4") && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasCostos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return codigo >= 5001 && codigo <= 5099 && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasGastosOperativos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return ((codigo >= 5100 && codigo <= 5108) || codigo === 5202 || codigo === 5203) && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasDepreciaciones = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return (codigo === 5109 || codigo === 5110) && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasCostoFinanciero = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return ((codigo >= 5111 && codigo <= 5199) || codigo === 5201) && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasImpuestos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return (codigo === 5200 || codigo >= 5204) && cuenta.estado_financiero === "Estado de Resultados";
  });

  const ventas = cuentasIngresos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const costoVentas = cuentasCostos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const gastosOperativos = cuentasGastosOperativos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const depreciaciones = cuentasDepreciaciones.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const costoFinanciero = cuentasCostoFinanciero.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const impuestos = cuentasImpuestos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);

  const utilidadBruta = ventas - costoVentas;
  const ebitda = utilidadBruta - gastosOperativos;
  const ebit = ebitda - depreciaciones;
  const utilidadAntesImpuestos = ebit - costoFinanciero;
  const utilidadNeta = utilidadAntesImpuestos - impuestos;

  // Construir datos para waterfall
  const waterfallData: WaterfallData[] = [];
  let runningTotal = 0;

  // Ventas (inicio)
  waterfallData.push({
    name: "Ventas",
    value: ventas,
    displayValue: ventas,
    start: 0,
    end: ventas,
    fill: "hsl(var(--chart-1))",
    isTotal: false
  });
  runningTotal = ventas;

  // Costo de Ventas (negativo)
  waterfallData.push({
    name: "Costo Ventas",
    value: costoVentas,
    displayValue: -costoVentas,
    start: runningTotal - costoVentas,
    end: runningTotal,
    fill: "hsl(var(--chart-5))",
    isTotal: false
  });
  runningTotal -= costoVentas;

  // Utilidad Bruta (subtotal)
  waterfallData.push({
    name: "Utilidad Bruta",
    value: utilidadBruta,
    displayValue: utilidadBruta,
    start: 0,
    end: utilidadBruta,
    fill: "hsl(var(--chart-2))",
    isTotal: true
  });

  // Gastos Operativos (negativo)
  waterfallData.push({
    name: "Gastos Op.",
    value: gastosOperativos,
    displayValue: -gastosOperativos,
    start: runningTotal - gastosOperativos,
    end: runningTotal,
    fill: "hsl(var(--chart-5))",
    isTotal: false
  });
  runningTotal -= gastosOperativos;

  // EBITDA (subtotal)
  waterfallData.push({
    name: "EBITDA",
    value: ebitda,
    displayValue: ebitda,
    start: 0,
    end: ebitda,
    fill: "hsl(var(--chart-2))",
    isTotal: true
  });

  // Depreciaciones (negativo)
  waterfallData.push({
    name: "Deprec.",
    value: depreciaciones,
    displayValue: -depreciaciones,
    start: runningTotal - depreciaciones,
    end: runningTotal,
    fill: "hsl(var(--chart-5))",
    isTotal: false
  });
  runningTotal -= depreciaciones;

  // EBIT (subtotal)
  waterfallData.push({
    name: "EBIT",
    value: ebit,
    displayValue: ebit,
    start: 0,
    end: ebit,
    fill: "hsl(var(--chart-2))",
    isTotal: true
  });

  // Costo Financiero (negativo)
  waterfallData.push({
    name: "Costo Fin.",
    value: costoFinanciero,
    displayValue: -costoFinanciero,
    start: runningTotal - costoFinanciero,
    end: runningTotal,
    fill: "hsl(var(--chart-5))",
    isTotal: false
  });
  runningTotal -= costoFinanciero;

  // Utilidad antes de Impuestos (subtotal)
  waterfallData.push({
    name: "Util. antes Imp.",
    value: utilidadAntesImpuestos,
    displayValue: utilidadAntesImpuestos,
    start: 0,
    end: utilidadAntesImpuestos,
    fill: "hsl(var(--chart-2))",
    isTotal: true
  });

  // Impuestos (negativo)
  waterfallData.push({
    name: "Impuestos",
    value: impuestos,
    displayValue: -impuestos,
    start: runningTotal - impuestos,
    end: runningTotal,
    fill: "hsl(var(--chart-5))",
    isTotal: false
  });
  runningTotal -= impuestos;

  // Utilidad Neta (final)
  waterfallData.push({
    name: "Utilidad Neta",
    value: utilidadNeta,
    displayValue: utilidadNeta,
    start: 0,
    end: utilidadNeta,
    fill: utilidadNeta >= 0 ? "hsl(var(--chart-3))" : "hsl(var(--chart-5))",
    isTotal: true
  });

  const formatCurrency = (value: number) => {
    return `$${Math.abs(value).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-1">{data.name}</p>
          <p className={`text-sm ${data.displayValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(data.displayValue)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-2xl">Gráfico de Cascada - Análisis Financiero</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visualización del flujo de ingresos a utilidad neta
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={500}>
            <BarChart
              data={waterfallData}
              margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
                className="text-xs"
              />
              <YAxis 
                tickFormatter={(value) => formatCurrency(value)}
                className="text-xs"
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={2} />
              
              {/* Barra invisible para posicionar */}
              <Bar dataKey="start" stackId="a" fill="transparent" />
              
              {/* Barra visible con valores */}
              <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Leyenda personalizada */}
          <div className="flex flex-wrap gap-4 justify-center mt-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--chart-1))" }}></div>
              <span>Ingresos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--chart-5))" }}></div>
              <span>Costos/Gastos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--chart-2))" }}></div>
              <span>Subtotales</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--chart-3))" }}></div>
              <span>Utilidad Final</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EstadoResultadosAnalitico;
