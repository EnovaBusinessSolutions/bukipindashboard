import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PeriodType } from "@/pages/EstadoResultados";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
  PieChart, Pie, Legend, Funnel, FunnelChart, LabelList
} from "recharts";

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

  // Construir datos para waterfall - el "start" es la barra invisible que posiciona cada elemento
  const waterfallData: WaterfallData[] = [];

  // Ventas (inicio - verde brillante)
  waterfallData.push({
    name: "Ventas",
    value: ventas,
    displayValue: ventas,
    start: 0,
    end: ventas,
    fill: "#10b981", // green-500
    isTotal: false
  });

  // Costo de Ventas (negativo - rojo) - start es donde termina después de restar
  const despuesCostos = ventas - costoVentas;
  waterfallData.push({
    name: "(-) Costo Ventas",
    value: costoVentas,
    displayValue: -costoVentas,
    start: despuesCostos,
    end: ventas,
    fill: "#ef4444", // red-500
    isTotal: false
  });

  // Gastos Operativos (negativo - rojo)
  const despuesGastos = despuesCostos - gastosOperativos;
  waterfallData.push({
    name: "(-) Gastos Op.",
    value: gastosOperativos,
    displayValue: -gastosOperativos,
    start: despuesGastos,
    end: despuesCostos,
    fill: "#ef4444",
    isTotal: false
  });

  // Depreciaciones (negativo - rojo)
  const despuesDepreciaciones = despuesGastos - depreciaciones;
  waterfallData.push({
    name: "(-) Deprec.",
    value: depreciaciones,
    displayValue: -depreciaciones,
    start: despuesDepreciaciones,
    end: despuesGastos,
    fill: "#ef4444",
    isTotal: false
  });

  // Costo Financiero (negativo - rojo)
  const despuesCostoFin = despuesDepreciaciones - costoFinanciero;
  waterfallData.push({
    name: "(-) Costo Fin.",
    value: costoFinanciero,
    displayValue: -costoFinanciero,
    start: despuesCostoFin,
    end: despuesDepreciaciones,
    fill: "#ef4444",
    isTotal: false
  });

  // Impuestos (negativo - rojo)
  const despuesImpuestos = despuesCostoFin - impuestos;
  waterfallData.push({
    name: "(-) Impuestos",
    value: impuestos,
    displayValue: -impuestos,
    start: despuesImpuestos,
    end: despuesCostoFin,
    fill: "#ef4444",
    isTotal: false
  });

  // Utilidad Neta (final - verde o rojo según resultado)
  waterfallData.push({
    name: "= UTILIDAD NETA",
    value: utilidadNeta,
    displayValue: utilidadNeta,
    start: 0,
    end: utilidadNeta,
    fill: utilidadNeta >= 0 ? "#059669" : "#dc2626", // green-600 or red-600
    isTotal: true
  });

  const formatCurrency = (value: number) => {
    return `$${Math.abs(value).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const CustomTooltipWaterfall = ({ active, payload }: any) => {
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

  const CustomTooltipBar = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-1">{data.name}</p>
          <p className={`text-sm font-semibold ${data.valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(data.valor)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Datos para gráfico de barras horizontales
  const simpleData = [
    { name: 'Ventas', valor: ventas, tipo: 'positivo' },
    { name: 'Costo Ventas', valor: -costoVentas, tipo: 'negativo' },
    { name: 'Util. Bruta', valor: utilidadBruta, tipo: 'subtotal' },
    { name: 'Gastos Op.', valor: -gastosOperativos, tipo: 'negativo' },
    { name: 'EBITDA', valor: ebitda, tipo: 'subtotal' },
    { name: 'Deprec.', valor: -depreciaciones, tipo: 'negativo' },
    { name: 'EBIT', valor: ebit, tipo: 'subtotal' },
    { name: 'Costo Fin.', valor: -costoFinanciero, tipo: 'negativo' },
    { name: 'Util. A. Imp.', valor: utilidadAntesImpuestos, tipo: 'subtotal' },
    { name: 'Impuestos', valor: -impuestos, tipo: 'negativo' },
    { name: 'UTILIDAD NETA', valor: utilidadNeta, tipo: 'final' },
  ];

  // Datos para Funnel Chart (solo valores positivos descendentes) - Paleta armónica
  const funnelData = [
    { name: 'Ventas', value: ventas, fill: '#3b82f6' },
    { name: 'Utilidad Bruta', value: utilidadBruta, fill: '#6366f1' },
    { name: 'EBITDA', value: ebitda, fill: '#8b5cf6' },
    { name: 'EBIT', value: ebit, fill: '#a855f7' },
    { name: 'Util. Antes Imp.', value: utilidadAntesImpuestos, fill: '#c026d3' },
    { name: 'Utilidad Neta', value: Math.max(0, utilidadNeta), fill: utilidadNeta >= 0 ? '#d946ef' : '#dc2626' },
  ];

  // Datos para Donut Chart - Ingresos, Egresos desglosados y Utilidad Neta
  const pieData = [
    { name: 'Ingresos', value: ventas, fill: '#10b981', category: 'ingreso' },
    { name: 'Costo de Ventas', value: costoVentas, fill: '#ef4444', category: 'egreso' },
    { name: 'Gastos Operativos', value: gastosOperativos, fill: '#f97316', category: 'egreso' },
    { name: 'Depreciaciones', value: depreciaciones, fill: '#f59e0b', category: 'egreso' },
    { name: 'Costo Financiero', value: costoFinanciero, fill: '#eab308', category: 'egreso' },
    { name: 'Impuestos', value: impuestos, fill: '#84cc16', category: 'egreso' },
    { name: 'Utilidad Neta', value: Math.max(0, utilidadNeta), fill: '#06b6d4', category: 'resultado' },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-8">
      {/* 1. Gráfico de Cascada */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-2xl">1. Gráfico de Cascada (Waterfall Chart)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visualización del flujo de ingresos a utilidad neta - Formato Ejecutivo
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={550}>
            <BarChart
              data={waterfallData}
              margin={{ top: 20, right: 30, left: 60, bottom: 100 }}
              barGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={120}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 500 }}
                interval={0}
              />
              <YAxis 
                tickFormatter={(value) => formatCurrency(value)}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                width={80}
              />
              <Tooltip content={<CustomTooltipWaterfall />} />
              <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />
              
              <Bar dataKey="start" stackId="stack" fill="transparent" />
              <Bar 
                dataKey="value" 
                stackId="stack" 
                radius={[6, 6, 6, 6]}
                label={{
                  position: 'top',
                  formatter: (value: number) => formatCurrency(Math.abs(value)),
                  fill: 'hsl(var(--foreground))',
                  fontSize: 10,
                  fontWeight: 'bold'
                }}
              >
                {waterfallData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
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
              <p className="text-muted-foreground">Ventas</p>
              <p className="font-semibold text-lg">{formatCurrency(ventas)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Utilidad Bruta</p>
              <p className="font-semibold text-lg">{formatCurrency(utilidadBruta)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">EBITDA</p>
              <p className="font-semibold text-lg">{formatCurrency(ebitda)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Utilidad Neta</p>
              <p className={`font-semibold text-lg ${utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(utilidadNeta)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Barras Horizontales */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-2xl">2. Barras Horizontales (Horizontal Bar Chart)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Comparación clara de ingresos, costos, gastos y resultados - Formato Ejecutivo
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={600}>
            <BarChart
              data={simpleData}
              layout="vertical"
              margin={{ top: 20, right: 100, left: 120, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis 
                type="number" 
                tickFormatter={(value) => formatCurrency(value)}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
              />
              <YAxis 
                type="category" 
                dataKey="name"
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                width={110}
              />
              <Tooltip content={<CustomTooltipBar />} />
              <ReferenceLine x={0} stroke="#374151" strokeWidth={2} />
              <Bar 
                dataKey="valor" 
                radius={[0, 8, 8, 0]}
                label={{
                  position: 'right',
                  formatter: (value: number) => formatCurrency(value),
                  fill: 'hsl(var(--foreground))',
                  fontSize: 11,
                  fontWeight: 600
                }}
              >
                {simpleData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={
                      entry.tipo === 'positivo' ? '#10b981' :
                      entry.tipo === 'negativo' ? '#ef4444' :
                      entry.tipo === 'subtotal' ? '#3b82f6' :
                      entry.valor >= 0 ? '#059669' : '#dc2626'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 3. Funnel Chart */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-2xl">3. Gráfico de Embudo (Funnel Chart)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visualización del flujo de conversión desde ventas hasta utilidad neta - Formato Ejecutivo
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={500}>
            <FunnelChart>
              <Tooltip content={<CustomTooltipBar />} />
              <Funnel
                dataKey="value"
                data={funnelData}
                isAnimationActive
              >
                <LabelList 
                  position="right" 
                  fill="hsl(var(--foreground))"
                  stroke="none"
                  fontSize={12}
                  fontWeight={600}
                  content={({ x, y, width, height, value, index }: any) => {
                    const item = funnelData[index];
                    if (!item) return null;
                    return (
                      <text
                        x={Number(x) + Number(width) + 10}
                        y={Number(y) + Number(height) / 2}
                        fill="hsl(var(--foreground))"
                        textAnchor="start"
                        dominantBaseline="middle"
                        fontSize={12}
                        fontWeight={600}
                      >
                        {`${item.name}: ${formatCurrency(value)}`}
                      </text>
                    );
                  }}
                />
                {funnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 4. Donut Chart */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-2xl">4. Gráfica de Dona (Donut Chart)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Distribución de Ingresos, Egresos y Utilidad Neta - Formato Ejecutivo
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={550}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={{
                  stroke: 'hsl(var(--foreground))',
                  strokeWidth: 1,
                }}
                label={({ name, percent, value }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={180}
                innerRadius={110}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={2}
                stroke="hsl(var(--background))"
                strokeWidth={3}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  padding: '12px'
                }}
                itemStyle={{
                  color: 'hsl(var(--foreground))',
                  fontWeight: 500
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={60}
                iconType="circle"
                formatter={(value, entry: any) => (
                  <span style={{ 
                    color: 'hsl(var(--foreground))',
                    fontWeight: 500,
                    fontSize: '13px'
                  }}>
                    {value}
                  </span>
                )}
                wrapperStyle={{
                  paddingTop: '20px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1 p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
              <p className="text-sm text-muted-foreground font-medium">Total Ingresos</p>
              <p className="font-bold text-xl text-green-600">{formatCurrency(ventas)}</p>
            </div>
            <div className="space-y-1 p-4 rounded-lg bg-red-50 dark:bg-red-950/20">
              <p className="text-sm text-muted-foreground font-medium">Total Egresos</p>
              <p className="font-bold text-xl text-red-600">{formatCurrency(costoVentas + gastosOperativos + depreciaciones + costoFinanciero + impuestos)}</p>
            </div>
            <div className="space-y-1 p-4 rounded-lg bg-cyan-50 dark:bg-cyan-950/20">
              <p className="text-sm text-muted-foreground font-medium">Utilidad Neta</p>
              <p className={`font-bold text-xl ${utilidadNeta >= 0 ? 'text-cyan-600' : 'text-red-600'}`}>
                {formatCurrency(utilidadNeta)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EstadoResultadosAnalitico;
