import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Minus, Equal } from "lucide-react";

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
  const balanceFinal = data.aportaciones + data.utilidades - data.dividendos;

  const formatMonto = (value: number) => {
    return `$${Math.abs(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flujo de Capital (Formato Estado de Resultados)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Aportaciones Iniciales */}
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <Plus className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Aportaciones de Capital</p>
              <p className="text-xs text-muted-foreground">Capital social inicial</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatMonto(data.aportaciones)}
            </p>
          </div>
        </div>

        {/* Más: Utilidades */}
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <Plus className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-foreground">(+) Utilidades Acumuladas</p>
              <p className="text-xs text-muted-foreground">Ganancias del ejercicio</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatMonto(data.utilidades)}
            </p>
          </div>
        </div>

        {/* Subtotal antes de dividendos */}
        <div className="flex justify-end items-center gap-4 px-4 py-2 border-t border-dashed">
          <p className="text-sm text-muted-foreground">Subtotal:</p>
          <p className="text-xl font-semibold text-foreground">
            {formatMonto(data.aportaciones + data.utilidades)}
          </p>
        </div>

        {/* Menos: Dividendos */}
        <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
              <Minus className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-foreground">(-) Dividendos Distribuidos</p>
              <p className="text-xs text-muted-foreground">Pagos a accionistas</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              ({formatMonto(data.dividendos)})
            </p>
          </div>
        </div>

        {/* Balance Final */}
        <div className="flex items-center justify-between p-5 bg-primary/10 rounded-lg border-2 border-primary mt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Equal className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Balance Final de Capital</p>
              <p className="text-xs text-muted-foreground">Capital contable neto</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-primary">
              {formatMonto(balanceFinal)}
            </p>
          </div>
        </div>

        {/* Resumen de composición */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t">
          <div className="text-center p-3 bg-muted/50 rounded">
            <p className="text-xs text-muted-foreground">Aportaciones</p>
            <p className="text-sm font-semibold text-green-600 dark:text-green-400">
              {balanceFinal > 0 ? ((data.aportaciones / balanceFinal) * 100).toFixed(1) : 0}%
            </p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded">
            <p className="text-xs text-muted-foreground">Utilidades</p>
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {balanceFinal > 0 ? ((data.utilidades / balanceFinal) * 100).toFixed(1) : 0}%
            </p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded">
            <p className="text-xs text-muted-foreground">Distribuido</p>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              {data.aportaciones + data.utilidades > 0 
                ? ((data.dividendos / (data.aportaciones + data.utilidades)) * 100).toFixed(1) 
                : 0}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
