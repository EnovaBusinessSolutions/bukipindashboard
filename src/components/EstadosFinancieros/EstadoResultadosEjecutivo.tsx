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
      if (isTotal) return value >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400";
      if (isSubtotal) return value >= 0 ? "text-blue-700 dark:text-blue-400" : "text-rose-700 dark:text-rose-400";
      if (isNegative) return "text-slate-600 dark:text-slate-400";
      return "text-slate-700 dark:text-slate-300";
    };

    const getFontWeight = () => {
      if (isTotal) return "font-bold text-xl";
      if (isSubtotal) return "font-semibold text-lg";
      if (isHeader) return "font-medium";
      return "";
    };

    const percentage = ventas > 0 ? ((value / ventas) * 100).toFixed(2) : '0.00';

    return (
      <div 
        className={`grid grid-cols-3 gap-4 items-center py-3 ${isSubtotal || isTotal ? 'border-t-2 border-slate-300 dark:border-slate-600 pt-4' : ''}`}
        style={{ marginLeft: indent > 0 ? `${indent * 1}rem` : '0' }}
      >
        <span className={`${getFontWeight()} ${getColor()}`}>
          {label}
        </span>
        <span className={`${getFontWeight()} ${getColor()} text-right`}>
          {isNegative && value !== 0 ? `(${formatCurrency(value)})` : formatCurrency(value)}
        </span>
        <span className={`${getFontWeight()} ${getColor()} text-right`}>
          {isNegative && value !== 0 ? `(${percentage}%)` : `${percentage}%`}
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
            {/* Header */}
            <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
              <span>Concepto</span>
              <span className="text-right">Monto</span>
              <span className="text-right">% Ventas</span>
            </div>

            {/* Ventas */}
            <LineItem label="Ventas" value={ventas} isHeader />

            {/* Costo de Ventas */}
            <LineItem label="(-) Costo de Ventas" value={costoVentas} isNegative />

            {/* Utilidad Bruta */}
            <LineItem label="Utilidad Bruta" value={utilidadBruta} isSubtotal />

            {/* Gastos Operativos */}
            <LineItem label="(-) Gastos Operativos" value={gastos} isNegative />

            {/* EBITDA */}
            <LineItem 
              label="EBITDA" 
              value={ebitda} 
              isSubtotal 
            />

            {/* Depreciaciones */}
            <LineItem label="(-) Depreciaciones y Amortizaciones" value={depreciaciones} isNegative />

            {/* EBIT */}
            <LineItem 
              label="EBIT (Utilidad Operativa)" 
              value={ebit} 
              isSubtotal 
            />

            {/* Costo Financiero */}
            <LineItem label="(-) Costo Financiero" value={costoFinanciero} isNegative />

            {/* Utilidad Antes de Impuestos */}
            <LineItem 
              label="Utilidad Antes de Impuestos" 
              value={utilidadAntesImpuestos} 
              isSubtotal 
            />

            {/* Impuestos */}
            <LineItem label="(-) Impuestos" value={impuestos} isNegative />

            {/* Utilidad Neta */}
            <LineItem 
              label={utilidadNeta >= 0 ? "Utilidad Neta" : "Pérdida Neta"} 
              value={utilidadNeta} 
              isTotal 
            />
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

export default EstadoResultadosEjecutivo;
