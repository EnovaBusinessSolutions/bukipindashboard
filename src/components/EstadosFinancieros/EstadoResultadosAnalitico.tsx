import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2 } from "lucide-react";
import { PeriodType } from "@/pages/EstadoResultados";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
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
  start: number;
  fill: string;
  isTotal: boolean;
}

const EstadoResultadosAnalitico = ({ startDate, endDate }: EstadoResultadosAnaliticoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();

  // Usar la misma lógica que la balanza
  const { data: asientosData, isLoading: asientosLoading } = useAsientosBalanza(startDate, endDate);

  if (cuentasLoading || asientosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const cuentasFlat = cuentasData?.cuentasFlat || [];
  const saldosPorCuenta = asientosData?.saldosPorCuenta || {};

  // Verificar si hay datos
  const hayDatos = asientosData?.movimientos && asientosData.movimientos.length > 0;

  if (!hayDatos) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center space-y-2">
            <p className="text-xl font-medium text-muted-foreground">
              No hay datos financieros registrados
            </p>
            <p className="text-sm text-muted-foreground">
              Comienza registrando transacciones para ver el estado de resultados
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Función para obtener el saldo de una cuenta desde los asientos de balanza
  const obtenerSaldo = (codigoCuenta: string): number => {
    return saldosPorCuenta[codigoCuenta]?.saldo || 0;
  };

  // Calcular métricas
  const cuentasVentas = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Ingresos por Ventas" && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasOtrosIngresos = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Otros Ingresos" && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasCostos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return codigo >= 5001 && codigo <= 5099 && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasGastosOperativos = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Gastos de Operación" && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasOtrosGastos = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Otros Gastos" && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasDepreciaciones = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return (codigo === 5109 || codigo === 5110) && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasCostoFinanciero = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return ((codigo >= 5111 && codigo <= 5199) || codigo === 5201) && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasImpuestos = cuentasFlat.filter(cuenta => {
    return cuenta.codigo.startsWith("6") && cuenta.estado_financiero === "Estado de Resultados";
  });

  const totalVentas = cuentasVentas.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalOtrosIngresos = cuentasOtrosIngresos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalIngresos = totalVentas + totalOtrosIngresos;
  const costoVentas = cuentasCostos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const gastosOperativos = cuentasGastosOperativos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const otrosGastos = cuentasOtrosGastos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const depreciaciones = cuentasDepreciaciones.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const costoFinanciero = cuentasCostoFinanciero.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const impuestos = cuentasImpuestos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);

  const utilidadBruta = totalIngresos - costoVentas;
  const ebitda = utilidadBruta - gastosOperativos - otrosGastos;
  const ebit = ebitda - depreciaciones;
  const utilidadAntesImpuestos = ebit - costoFinanciero;
  const utilidadNeta = utilidadAntesImpuestos - impuestos;

  // Construir datos para waterfall - el "start" es la barra invisible que posiciona cada elemento
  const waterfallData: WaterfallData[] = [];

  // Ventas (inicio - verde brillante)
  waterfallData.push({
    name: "Ventas",
    value: 0, // Transparente (posiciona)
    start: totalVentas, // Con color (visible)
    fill: "#10b981", // green-500
    isTotal: false
  });

  // Otros Ingresos (verde más claro)
  waterfallData.push({
    name: "(+) Otros Ingr.",
    value: totalVentas, // Transparente (posiciona desde ventas)
    start: totalOtrosIngresos, // Con color (visible)
    fill: "#34d399", // green-400
    isTotal: false
  });

  // Total Ingresos (subtotal - azul)
  waterfallData.push({
    name: "= Total Ingresos",
    value: 0, // Transparente (posiciona)
    start: totalIngresos, // Con color (visible)
    fill: "#3b82f6", // blue-500
    isTotal: true
  });

  // Costo de Ventas (negativo - rojo) - start tiene color, value transparente
  const despuesCostos = totalIngresos - costoVentas;
  waterfallData.push({
    name: "(-) Costo Ventas",
    value: despuesCostos, // Transparente (posiciona)
    start: costoVentas, // Con color (visible)
    fill: "#ef4444", // red-500
    isTotal: false
  });

  // Utilidad Bruta (subtotal - azul)
  waterfallData.push({
    name: "= Utilidad Bruta",
    value: 0, // Transparente (posiciona)
    start: utilidadBruta, // Con color (visible)
    fill: "#3b82f6", // blue-500
    isTotal: true
  });

  // Gastos Operativos (negativo - rojo)
  const despuesGastos = despuesCostos - gastosOperativos;
  waterfallData.push({
    name: "(-) Gastos Op.",
    value: despuesGastos, // Transparente (posiciona)
    start: gastosOperativos, // Con color (visible)
    fill: "#ef4444",
    isTotal: false
  });

  // Otros Gastos (negativo - rojo)
  const despuesOtrosGastos = despuesGastos - otrosGastos;
  waterfallData.push({
    name: "(-) Otros Gastos",
    value: despuesOtrosGastos, // Transparente (posiciona)
    start: otrosGastos, // Con color (visible)
    fill: "#ef4444",
    isTotal: false
  });

  // EBITDA (subtotal - azul)
  waterfallData.push({
    name: "= EBITDA",
    value: 0, // Transparente (posiciona)
    start: ebitda, // Con color (visible)
    fill: "#3b82f6", // blue-500
    isTotal: true
  });

  // Depreciaciones (negativo - rojo)
  const despuesDepreciaciones = despuesOtrosGastos - depreciaciones;
  waterfallData.push({
    name: "(-) Deprec.",
    value: despuesDepreciaciones, // Transparente (posiciona)
    start: depreciaciones, // Con color (visible)
    fill: "#ef4444",
    isTotal: false
  });

  // EBIT (subtotal - azul)
  waterfallData.push({
    name: "= EBIT",
    value: 0, // Transparente (posiciona)
    start: ebit, // Con color (visible)
    fill: "#3b82f6", // blue-500
    isTotal: true
  });

  // Costo Financiero (negativo - rojo)
  const despuesCostoFin = despuesDepreciaciones - costoFinanciero;
  waterfallData.push({
    name: "(-) Costo Fin.",
    value: despuesCostoFin, // Transparente (posiciona)
    start: costoFinanciero, // Con color (visible)
    fill: "#ef4444",
    isTotal: false
  });

  // Utilidad Antes de Impuestos (subtotal - azul)
  waterfallData.push({
    name: "= Util. A. Imp.",
    value: 0, // Transparente (posiciona)
    start: utilidadAntesImpuestos, // Con color (visible)
    fill: "#3b82f6", // blue-500
    isTotal: true
  });

  // Impuestos (negativo - rojo)
  const despuesImpuestos = despuesCostoFin - impuestos;
  waterfallData.push({
    name: "(-) Impuestos",
    value: despuesImpuestos, // Transparente (posiciona)
    start: impuestos, // Con color (visible)
    fill: "#ef4444",
    isTotal: false
  });

  // Utilidad Neta (final - verde o rojo según resultado)
  waterfallData.push({
    name: "= UTILIDAD NETA",
    value: 0, // Transparente (posiciona)
    start: utilidadNeta, // Con color (visible)
    fill: utilidadNeta >= 0 ? "#059669" : "#dc2626", // green-600 or red-600
    isTotal: true
  });

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const CustomTooltipWaterfall = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      // Para egresos, mostrar el valor como negativo en el tooltip
      const displayValue = data.isTotal ? data.start : (data.name.includes("(-)") ? -data.start : data.start);
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-1">{data.name}</p>
          <p className={`text-sm ${displayValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(displayValue)}
          </p>
        </div>
      );
    }
    return null;
  };

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
              
              <Bar dataKey="value" stackId="stack" isAnimationActive={false} legendType="none">
                {waterfallData.map((entry, index) => (
                  <Cell 
                    key={`cell-value-${index}`} 
                    fill="transparent"
                    style={{ pointerEvents: 'none' }}
                  />
                ))}
              </Bar>
              <Bar 
                dataKey="start" 
                stackId="stack" 
                radius={[6, 6, 6, 6]}
                label={{
                  position: 'top',
                  content: ({ x, y, width, value, index }: any) => {
                    const item = waterfallData[index];
                    if (!item) return null;
                    const displayValue = item.name.includes("(-)") ? -item.start : item.start;
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
                        {formatCurrency(displayValue)}
                      </text>
                    );
                  }
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
              <p className="text-muted-foreground">Ventas</p>
              <p className="font-semibold text-lg">{formatCurrency(totalVentas)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Otros Ingresos</p>
              <p className="font-semibold text-lg">{formatCurrency(totalOtrosIngresos)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Total Ingresos</p>
              <p className="font-semibold text-lg">{formatCurrency(totalIngresos)}</p>
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
    </div>
  );
};

export default EstadoResultadosAnalitico;
