import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, Tooltip } from "recharts";

interface RadialKPIProps {
  aportaciones: number;
  utilidades: number;
  dividendosDistribuidos: number;
}

export const GraficaRadialKPI = ({ aportaciones, utilidades, dividendosDistribuidos }: RadialKPIProps) => {
  const capitalDisponible = aportaciones + utilidades;
  const dividendosDisponibles = Math.max(0, capitalDisponible - dividendosDistribuidos);
  const porcentajeUsado = capitalDisponible > 0 ? (dividendosDistribuidos / capitalDisponible) * 100 : 0;
  const porcentajeDisponible = 100 - porcentajeUsado;

  const data = [
    {
      name: "Dividendos Distribuidos",
      value: porcentajeUsado,
      fill: "hsl(var(--chart-3))",
    },
    {
      name: "Disponible para Dividendos",
      value: porcentajeDisponible,
      fill: "hsl(var(--chart-1))",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capacidad de Dividendos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={300}>
            <RadialBarChart 
              cx="50%" 
              cy="50%" 
              innerRadius="30%" 
              outerRadius="90%" 
              barSize={20} 
              data={data}
            >
              <RadialBar
                background
                dataKey="value"
                label={{ position: 'insideStart', fill: '#fff' }}
              />
              <Legend 
                iconSize={10}
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
              />
              <Tooltip 
                formatter={(value: number) => `${value.toFixed(1)}%`}
              />
            </RadialBarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 border rounded-lg">
              <p className="text-muted-foreground mb-1">Capital Total</p>
              <p className="text-lg font-bold">
                ${capitalDisponible.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-muted-foreground mb-1">Disponible</p>
              <p className="text-lg font-bold text-green-600">
                ${dividendosDisponibles.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-muted-foreground mb-1">Distribuido</p>
              <p className="text-lg font-bold text-red-600">
                ${dividendosDistribuidos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-muted-foreground mb-1">% Utilizado</p>
              <p className="text-lg font-bold">
                {porcentajeUsado.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
