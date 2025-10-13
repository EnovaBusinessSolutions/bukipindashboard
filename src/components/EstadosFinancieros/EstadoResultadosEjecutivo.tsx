import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBalanceGeneral } from "@/hooks/useBalanceGeneral";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";

const EstadoResultadosEjecutivo = () => {
  const { data: saldosAutomaticos, isLoading } = useBalanceGeneral();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const ventas = saldosAutomaticos?.ingresos || 0;
  const costoVentas = saldosAutomaticos?.costos || 0;
  const gastos = saldosAutomaticos?.gastos || 0;
  
  const utilidadBruta = ventas - costoVentas;
  const ebitda = utilidadBruta - gastos;
  const depreciaciones = 0; // Por implementar con inversiones CAPEX
  const ebit = ebitda - depreciaciones;
  const costoFinanciero = 0; // Por implementar con gastos financieros
  const utilidadAntesImpuestos = ebit - costoFinanciero;
  const impuestos = 0; // Por implementar cálculo de impuestos
  const utilidadNeta = utilidadAntesImpuestos - impuestos;

  const formatCurrency = (value: number) => {
    return `$${Math.abs(value).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
  };

  const LineItem = ({ 
    label, 
    value, 
    isHeader = false, 
    isSubtotal = false,
    isTotal = false,
    isNegative = false,
    indent = 0 
  }: { 
    label: string; 
    value: number; 
    isHeader?: boolean;
    isSubtotal?: boolean;
    isTotal?: boolean;
    isNegative?: boolean;
    indent?: number;
  }) => {
    const getColor = () => {
      if (isTotal) return value >= 0 ? "text-green-600" : "text-red-600";
      if (isSubtotal) return value >= 0 ? "text-blue-600" : "text-red-600";
      if (isNegative) return "text-orange-600";
      return "text-foreground";
    };

    const getFontWeight = () => {
      if (isTotal) return "font-bold text-xl";
      if (isSubtotal) return "font-semibold text-lg";
      if (isHeader) return "font-medium";
      return "";
    };

    return (
      <div 
        className={`flex justify-between items-center py-3 ${indent > 0 ? `ml-${indent * 4}` : ''}`}
        style={{ marginLeft: indent > 0 ? `${indent * 1}rem` : '0' }}
      >
        <span className={`${getFontWeight()} ${getColor()}`}>
          {label}
        </span>
        <span className={`${getFontWeight()} ${getColor()}`}>
          {isNegative && value !== 0 ? `(${formatCurrency(value)})` : formatCurrency(value)}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {utilidadNeta >= 0 ? (
          <TrendingUp className="h-8 w-8 text-green-600" />
        ) : (
          <TrendingDown className="h-8 w-8 text-red-600" />
        )}
        <p className="text-muted-foreground">Vista ejecutiva consolidada del período</p>
      </div>

      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-2xl">Resumen Financiero</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-1">
            {/* Ventas */}
            <LineItem label="Ventas" value={ventas} isHeader />
            <div className="border-b border-border my-2" />

            {/* Costo de Ventas */}
            <LineItem label="(-) Costo de Ventas" value={costoVentas} isNegative />
            <div className="border-b border-border my-2" />

            {/* Utilidad Bruta */}
            <LineItem label="Utilidad Bruta" value={utilidadBruta} isSubtotal />
            <div className="border-b-2 border-border my-3" />

            {/* Gastos Operativos */}
            <LineItem label="(-) Gastos Operativos" value={gastos} isNegative />
            <div className="border-b border-border my-2" />

            {/* EBITDA */}
            <LineItem 
              label="EBITDA" 
              value={ebitda} 
              isSubtotal 
            />
            <div className="border-b-2 border-border my-3" />

            {/* Depreciaciones */}
            <LineItem label="(-) Depreciaciones y Amortizaciones" value={depreciaciones} isNegative />
            <div className="border-b border-border my-2" />

            {/* EBIT */}
            <LineItem 
              label="EBIT (Utilidad Operativa)" 
              value={ebit} 
              isSubtotal 
            />
            <div className="border-b-2 border-border my-3" />

            {/* Costo Financiero */}
            <LineItem label="(-) Costo Financiero" value={costoFinanciero} isNegative />
            <div className="border-b border-border my-2" />

            {/* Utilidad Antes de Impuestos */}
            <LineItem 
              label="Utilidad Antes de Impuestos" 
              value={utilidadAntesImpuestos} 
              isSubtotal 
            />
            <div className="border-b-2 border-border my-3" />

            {/* Impuestos */}
            <LineItem label="(-) Impuestos" value={impuestos} isNegative />
            <div className="border-b-2 border-primary my-4" />

            {/* Utilidad Neta */}
            <LineItem 
              label={utilidadNeta >= 0 ? "Utilidad Neta" : "Pérdida Neta"} 
              value={utilidadNeta} 
              isTotal 
            />
          </div>

          {/* Métricas Adicionales */}
          <div className="mt-8 pt-6 border-t-2 border-border">
            <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Métricas Clave</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Margen Bruto</p>
                <p className="text-lg font-bold text-blue-600">
                  {ventas > 0 ? ((utilidadBruta / ventas) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Margen EBITDA</p>
                <p className="text-lg font-bold text-blue-600">
                  {ventas > 0 ? ((ebitda / ventas) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Margen EBIT</p>
                <p className="text-lg font-bold text-blue-600">
                  {ventas > 0 ? ((ebit / ventas) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Margen Neto</p>
                <p className={`text-lg font-bold ${utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {ventas > 0 ? ((utilidadNeta / ventas) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EstadoResultadosEjecutivo;
