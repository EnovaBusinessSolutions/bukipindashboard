import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, Tooltip } from "recharts";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface RadialKPIProps {
  aportaciones: number;
  utilidades: number;
  dividendosDistribuidos: number;
  accionista?: {
    id: string;
    nombre: string;
    porcentaje_participacion: number;
  };
  totalAportaciones?: number;
}

export const GraficaRadialKPI = ({ 
  aportaciones, 
  utilidades, 
  dividendosDistribuidos,
  accionista,
  totalAportaciones = 0
}: RadialKPIProps) => {
  const capitalDisponible = aportaciones + utilidades;
  const dividendosDisponibles = Math.max(0, capitalDisponible - dividendosDistribuidos);
  const porcentajeUsado = capitalDisponible > 0 ? (dividendosDistribuidos / capitalDisponible) * 100 : 0;
  const porcentajeDisponible = 100 - porcentajeUsado;

  // Calcular lo que le corresponde al accionista
  let dividendosPermitidos = capitalDisponible;
  let excedente = 0;
  let mostrarWarning = false;

  if (accionista && accionista.porcentaje_participacion > 0) {
    // Si el accionista tiene un porcentaje definido, calculamos su parte
    dividendosPermitidos = capitalDisponible * (accionista.porcentaje_participacion / 100);
    excedente = dividendosDistribuidos - dividendosPermitidos;
    mostrarWarning = excedente > 0;
  } else if (dividendosDistribuidos > capitalDisponible) {
    // Si no tiene porcentaje pero ha sacado más de lo disponible
    excedente = dividendosDistribuidos - capitalDisponible;
    mostrarWarning = true;
  }

  const data = [
    {
      name: "Dividendos Distribuidos",
      value: porcentajeUsado,
      fill: mostrarWarning ? "#ef4444" : "hsl(var(--chart-3))",
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
        <CardTitle>
          Capacidad de Dividendos
          {accionista && ` - ${accionista.nombre}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Warning si ha excedido */}
          {mostrarWarning && (
            <Alert variant="destructive" className="border-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>⚠️ Dividendos Excedidos</AlertTitle>
              <AlertDescription>
                {accionista ? (
                  <>
                    <p className="font-semibold">
                      Este accionista ha distribuido <span className="text-lg">${excedente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span> más de lo que le corresponde.
                    </p>
                    <p className="text-sm mt-2">
                      Según su participación del {accionista.porcentaje_participacion}%, 
                      le corresponden máximo ${dividendosPermitidos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} 
                      pero ha distribuido ${dividendosDistribuidos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}.
                    </p>
                  </>
                ) : (
                  <p>
                    Se han distribuido ${excedente.toLocaleString('es-MX', { minimumFractionDigits: 2 })} más 
                    de lo que hay disponible en capital.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

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
            {accionista && accionista.porcentaje_participacion > 0 && (
              <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <p className="text-muted-foreground mb-1">Le Corresponde</p>
                <p className="text-lg font-bold text-blue-600">
                  ${dividendosPermitidos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  ({accionista.porcentaje_participacion}% participación)
                </p>
              </div>
            )}
            <div className="p-3 border rounded-lg">
              <p className="text-muted-foreground mb-1">Disponible</p>
              <p className={`text-lg font-bold ${mostrarWarning ? 'text-red-600' : 'text-green-600'}`}>
                ${dividendosDisponibles.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-muted-foreground mb-1">Distribuido</p>
              <p className={`text-lg font-bold ${mostrarWarning ? 'text-red-600' : 'text-orange-600'}`}>
                ${dividendosDistribuidos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-muted-foreground mb-1">% Utilizado</p>
              <p className={`text-lg font-bold ${mostrarWarning ? 'text-red-600' : ''}`}>
                {porcentajeUsado.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
