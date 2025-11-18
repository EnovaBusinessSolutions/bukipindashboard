import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts";

interface WaterfallData {
  aportaciones: number;
  utilidadesHistoricas: number;
  dividendosHistoricos: number;
  utilidadesAnioActual: number;
  dividendosAnioActual: number;
}

interface GraficaWaterfallProps {
  data: WaterfallData;
  accionistaId?: string;
  accionistaNombre?: string;
}

interface ChartData {
  name: string;
  value: number;
  start: number;
  fill: string;
  isTotal: boolean;
}

export const GraficaWaterfall = ({ data, accionistaId, accionistaNombre }: GraficaWaterfallProps) => {
  const waterfallData: ChartData[] = [];
  
  // 1. Aportaciones (inicio - verde brillante)
  waterfallData.push({
    name: "Aportaciones",
    value: 0,
    start: data.aportaciones,
    fill: "#10b981", // green-500
    isTotal: false
  });

  // 2. Utilidades Netas Años Pasados (verde/rojo según si es positivo o negativo)
  const utilidadesNetasHistoricas = data.utilidadesHistoricas - data.dividendosHistoricos;
  const esGananciaHistorica = utilidadesNetasHistoricas >= 0;
  waterfallData.push({
    name: esGananciaHistorica ? "(+) Utilidades Netas Históricas" : "(-) Pérdidas Netas Históricas",
    value: esGananciaHistorica ? data.aportaciones : data.aportaciones + utilidadesNetasHistoricas,
    start: Math.abs(utilidadesNetasHistoricas),
    fill: esGananciaHistorica ? "#10b981" : "#ef4444", // green-500 or red-500
    isTotal: false
  });

  // 3. Subtotal Histórico
  const subtotalHistorico = data.aportaciones + utilidadesNetasHistoricas;
  waterfallData.push({
    name: "= Capital Histórico",
    value: 0,
    start: subtotalHistorico,
    fill: "#60a5fa", // blue-400
    isTotal: true
  });

  // 4. Utilidades Acumuladas 2025 - Color dinámico según ganancia/pérdida
  const esGanancia2025 = data.utilidadesAnioActual >= 0;
  waterfallData.push({
    name: esGanancia2025 ? "(+) Utilidades 2025" : "(-) Pérdidas 2025",
    value: esGanancia2025 ? subtotalHistorico : subtotalHistorico + data.utilidadesAnioActual,
    start: Math.abs(data.utilidadesAnioActual),
    fill: esGanancia2025 ? "#10b981" : "#ef4444", // green-500 si ganancia, red-500 si pérdida
    isTotal: false
  });

  // 5. Subtotal antes de Dividendos 2025
  const subtotalAntesDividendos = subtotalHistorico + data.utilidadesAnioActual;
  waterfallData.push({
    name: "= Subtotal 2025",
    value: 0,
    start: subtotalAntesDividendos,
    fill: "#60a5fa", // blue-400
    isTotal: true
  });

  // 6. Dividendos 2025
  const despuesDividendos2025 = subtotalAntesDividendos - data.dividendosAnioActual;
  waterfallData.push({
    name: "(-) Dividendos 2025",
    value: despuesDividendos2025,
    start: data.dividendosAnioActual,
    fill: "#ef4444", // red-500
    isTotal: false
  });

  // 7. Balance Final
  const balanceFinal = despuesDividendos2025;
  waterfallData.push({
    name: "= BALANCE FINAL",
    value: 0,
    start: balanceFinal,
    fill: balanceFinal >= 0 ? "#059669" : "#dc2626", // green-600 or red-600
    isTotal: true
  });

  const formatCurrency = (value: number, showSign: boolean = false) => {
    const absValue = Math.abs(value);
    const formatted = `$${absValue.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    return showSign && value < 0 ? `-${formatted}` : formatted;
  };

  const CustomTooltipWaterfall = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const chartData = payload[0].payload;
      const displayValue = chartData.isTotal 
        ? chartData.start 
        : (chartData.name.includes("(-)") || chartData.name.includes("Pérdidas") ? -chartData.start : chartData.start);
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-1">{chartData.name}</p>
          <p className={`text-sm ${displayValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(displayValue, true)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Calcular el valor mínimo para ajustar el eje Y
  const calcularValorMinimo = () => {
    const valores: number[] = [];
    
    waterfallData.forEach(item => {
      if (item.isTotal) {
        valores.push(item.start);
      } else {
        valores.push(item.value);
        valores.push(item.value + item.start);
      }
    });
    
    return Math.min(...valores, 0);
  };

  const minValue = calcularValorMinimo();
  // Si hay valores negativos, agregar 10% de margen inferior
  const yAxisDomain: [number | 'auto', number | 'auto'] = minValue < 0 
    ? [minValue * 1.1, 'auto'] 
    : ['auto', 'auto'];

  return (
    <Card className="border-2">
      <CardHeader className="bg-muted/50">
        <CardTitle className="text-xl">
          Gráfico de Cascada - {
            accionistaId && accionistaId !== "all" && accionistaId !== "inactivos"
              ? `Capital de ${accionistaNombre || "Accionista"}`
              : accionistaId === "inactivos"
                ? "Capital de Socios Inactivos"
                : "Flujo de Capital Consolidado"
          }
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Visualización del flujo de capital desde aportaciones hasta balance final
        </p>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={450}>
          <BarChart
            data={waterfallData}
            margin={{ top: 20, right: 30, left: 60, bottom: 80 }}
            barGap={8}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 500 }}
              interval={0}
            />
            <YAxis 
              domain={yAxisDomain}
              tickFormatter={(value) => formatCurrency(value)}
              tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
              width={80}
            />
            <Tooltip content={<CustomTooltipWaterfall />} />
            <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />
            
            {/* Barra invisible para posicionar */}
            <Bar dataKey="value" stackId="stack" isAnimationActive={false} legendType="none">
              {waterfallData.map((entry, index) => (
                <Cell 
                  key={`cell-value-${index}`} 
                  fill="transparent"
                  style={{ pointerEvents: 'none' }}
                />
              ))}
            </Bar>
            
            {/* Barra visible con colores */}
            <Bar 
              dataKey="start" 
              stackId="stack" 
              radius={[6, 6, 6, 6]}
              label={{
                position: 'top',
                content: ({ x, y, width, value, index, height }: any) => {
                  const item = waterfallData[index];
                  if (!item) return null;
                  
                  // Determinar si es negativo basándose en el nombre o tipo
                  const esNegativo = item.name.includes("(-)") || 
                                     item.name.includes("Pérdidas") || 
                                     (item.isTotal && item.start < 0);
                  
                  // Para subtotales, usar el valor tal cual (ya tiene el signo correcto)
                  // Para barras normales, aplicar signo negativo si corresponde
                  const displayValue = item.isTotal 
                    ? item.start 
                    : (esNegativo ? -item.start : item.start);
                  
                  // Calcular posición Y según si es negativo o positivo
                  // Para subtotales negativos, necesitamos un cálculo especial
                  let labelY;
                  if (item.isTotal && item.start < 0) {
                    // Subtotal negativo: queremos la etiqueta debajo del final de la barra
                    labelY = Number(y) + Number(height) + 20;
                  } else if (esNegativo) {
                    // Barra negativa normal
                    labelY = Number(y) + Number(height) + 15;
                  } else {
                    // Barra positiva: etiqueta arriba
                    labelY = Number(y) - 5;
                  }
                  
                  const dominantBaseline = esNegativo ? "hanging" : "bottom";
                  
                  return (
                    <text
                      x={Number(x) + Number(width) / 2}
                      y={labelY}
                      fill="hsl(var(--foreground))"
                      textAnchor="middle"
                      dominantBaseline={dominantBaseline}
                      fontSize={10}
                      fontWeight="bold"
                    >
                      {formatCurrency(displayValue, true)}
                    </text>
                  );
                }
              }}
            >
              {waterfallData.map((entry, index) => (
                <Cell key={`cell-start-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
