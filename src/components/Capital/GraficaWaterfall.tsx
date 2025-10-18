import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts";

interface WaterfallData {
  aportaciones: number;
  utilidades: number;
  dividendos: number;
}

interface GraficaWaterfallProps {
  data: WaterfallData;
  accionistaId?: string;
}

interface ChartData {
  name: string;
  value: number;
  start: number;
  fill: string;
  isTotal: boolean;
}

export const GraficaWaterfall = ({ data }: GraficaWaterfallProps) => {
  const balanceFinal = data.aportaciones + data.utilidades - data.dividendos;

  // Construir datos para waterfall - igual que EstadoResultadosAnalitico
  const waterfallData: ChartData[] = [];

  // Aportaciones (inicio - verde brillante)
  waterfallData.push({
    name: "Aportaciones",
    value: 0, // Transparente (posiciona)
    start: data.aportaciones, // Con color (visible)
    fill: "#10b981", // green-500
    isTotal: false
  });

  // Utilidades (positivo - azul)
  waterfallData.push({
    name: "(+) Utilidades",
    value: data.aportaciones, // Transparente (posiciona)
    start: data.utilidades, // Con color (visible)
    fill: "#3b82f6", // blue-500
    isTotal: false
  });

  // Subtotal (antes de dividendos - azul claro)
  const subtotal = data.aportaciones + data.utilidades;
  waterfallData.push({
    name: "= Subtotal",
    value: 0, // Transparente (posiciona)
    start: subtotal, // Con color (visible)
    fill: "#60a5fa", // blue-400
    isTotal: true
  });

  // Dividendos (negativo - rojo)
  const despuesDividendos = subtotal - data.dividendos;
  waterfallData.push({
    name: "(-) Dividendos",
    value: despuesDividendos, // Transparente (posiciona)
    start: data.dividendos, // Con color (visible)
    fill: "#ef4444", // red-500
    isTotal: false
  });

  // Balance Final (final - verde o rojo según resultado)
  waterfallData.push({
    name: "= BALANCE FINAL",
    value: 0, // Transparente (posiciona)
    start: balanceFinal, // Con color (visible)
    fill: balanceFinal >= 0 ? "#059669" : "#dc2626", // green-600 or red-600
    isTotal: true
  });

  const formatCurrency = (value: number) => {
    return `$${Math.abs(value).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const CustomTooltipWaterfall = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const chartData = payload[0].payload;
      // Para egresos, mostrar el valor como negativo en el tooltip
      const displayValue = chartData.isTotal ? chartData.start : (chartData.name.includes("(-)") ? -chartData.start : chartData.start);
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-1">{chartData.name}</p>
          <p className={`text-sm ${displayValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(displayValue)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-2">
      <CardHeader className="bg-muted/50">
        <CardTitle className="text-xl">Gráfico de Cascada - Flujo de Capital</CardTitle>
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
                <Cell key={`cell-start-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
