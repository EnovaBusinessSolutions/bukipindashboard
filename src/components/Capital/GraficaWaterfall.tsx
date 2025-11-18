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
}

interface ChartData {
  name: string;
  value: number;
  start: number;
  fill: string;
  isTotal: boolean;
}

export const GraficaWaterfall = ({ data }: GraficaWaterfallProps) => {
  const waterfallData: ChartData[] = [];
  
  // 1. Aportaciones (inicio - verde brillante)
  waterfallData.push({
    name: "Aportaciones",
    value: 0,
    start: data.aportaciones,
    fill: "#10b981", // green-500
    isTotal: false
  });

  // 2. Utilidades Netas Años Pasados (azul/rojo según si es positivo o negativo)
  const utilidadesNetasHistoricas = data.utilidadesHistoricas - data.dividendosHistoricos;
  waterfallData.push({
    name: utilidadesNetasHistoricas >= 0 ? "(+) Utilidades Netas Históricas" : "(-) Pérdidas Netas Históricas",
    value: data.aportaciones,
    start: Math.abs(utilidadesNetasHistoricas),
    fill: utilidadesNetasHistoricas >= 0 ? "#3b82f6" : "#ef4444", // blue-500 or red-500
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

  // 4. Utilidades Acumuladas 2025
  waterfallData.push({
    name: "(+) Utilidades 2025",
    value: subtotalHistorico,
    start: data.utilidadesAnioActual,
    fill: "#3b82f6", // blue-500
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

  const formatCurrency = (value: number) => {
    return `$${Math.abs(value).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
