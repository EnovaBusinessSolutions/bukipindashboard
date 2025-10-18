import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

interface WaterfallData {
  aportaciones: number;
  utilidades: number;
  dividendos: number;
}

interface GraficaWaterfallProps {
  data: WaterfallData;
  accionistaId?: string;
}

export const GraficaWaterfall = ({ data }: GraficaWaterfallProps) => {
  const waterfallData = [
    {
      name: "Aportaciones",
      value: data.aportaciones,
      fill: "hsl(var(--chart-1))",
    },
    {
      name: "Utilidades",
      value: data.utilidades,
      fill: "hsl(var(--chart-2))",
    },
    {
      name: "Dividendos",
      value: -data.dividendos,
      fill: "hsl(var(--chart-3))",
    },
    {
      name: "Balance Final",
      value: data.aportaciones + data.utilidades - data.dividendos,
      fill: "hsl(var(--primary))",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flujo de Capital (Waterfall)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={waterfallData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => 
                `$${Math.abs(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
              }
            />
            <Legend />
            <Bar dataKey="value" name="Monto">
              {waterfallData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
