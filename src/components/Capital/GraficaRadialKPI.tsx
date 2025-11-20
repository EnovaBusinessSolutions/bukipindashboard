import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Calcular lo que le corresponde al accionista
  // IMPORTANTE: Los datos (aportaciones y utilidades) ya vienen proporcionales al accionista
  // No debemos aplicar el porcentaje de nuevo
  let dividendosPermitidos = capitalDisponible;
  let excedente = 0;
  let mostrarWarning = false;

  if (accionista && accionista.porcentaje_participacion > 0) {
    // Los datos ya son proporcionales, solo validamos si excedió
    dividendosPermitidos = capitalDisponible;
    excedente = dividendosDistribuidos - dividendosPermitidos;
    mostrarWarning = excedente > 0;
  } else if (dividendosDistribuidos > capitalDisponible) {
    // Si no tiene porcentaje pero ha sacado más de lo disponible
    excedente = dividendosDistribuidos - capitalDisponible;
    mostrarWarning = true;
  }

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

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20">
              <p className="text-sm text-muted-foreground mb-1">Capital Total</p>
              <p className="text-2xl font-bold text-blue-600">
                ${capitalDisponible.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Aportaciones + Utilidades
              </p>
            </div>

            {accionista && accionista.porcentaje_participacion > 0 && (
              <div className="p-4 border rounded-lg bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950/20 dark:to-cyan-900/20">
                <p className="text-sm text-muted-foreground mb-1">Le Corresponde</p>
                <p className="text-2xl font-bold text-cyan-600">
                  ${dividendosPermitidos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {accionista.porcentaje_participacion}% de participación
                </p>
              </div>
            )}

            <div className={`p-4 border rounded-lg bg-gradient-to-br ${mostrarWarning ? 'from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20' : 'from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20'}`}>
              <p className="text-sm text-muted-foreground mb-1">Distribuido</p>
              <p className={`text-2xl font-bold ${mostrarWarning ? 'text-red-600' : 'text-orange-600'}`}>
                ${dividendosDistribuidos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Total de dividendos pagados
              </p>
            </div>

            <div className={`p-4 border rounded-lg bg-gradient-to-br ${mostrarWarning ? 'from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20' : 'from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20'}`}>
              <p className="text-sm text-muted-foreground mb-1">Disponible</p>
              <p className={`text-2xl font-bold ${mostrarWarning ? 'text-red-600' : 'text-green-600'}`}>
                ${dividendosDisponibles.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {mostrarWarning ? 'Sobregiro detectado' : 'Para distribuir'}
              </p>
            </div>

            <div className="p-4 border rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20">
              <p className="text-sm text-muted-foreground mb-1">% Utilizado</p>
              <p className={`text-2xl font-bold ${mostrarWarning ? 'text-red-600' : 'text-purple-600'}`}>
                {porcentajeUsado.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Del capital disponible
              </p>
            </div>

            <div className="p-4 border rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/20 dark:to-amber-900/20">
              <p className="text-sm text-muted-foreground mb-1">% Disponible</p>
              <p className="text-2xl font-bold text-amber-600">
                {Math.max(0, 100 - porcentajeUsado).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Restante para distribuir
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
