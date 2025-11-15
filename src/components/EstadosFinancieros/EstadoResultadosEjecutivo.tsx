import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { PeriodType } from "@/pages/EstadoResultados";

interface EstadoResultadosEjecutivoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
}

interface SaldoCuenta {
  cuenta_codigo: string;
  debe_total: number;
  haber_total: number;
  saldo: number;
}

const EstadoResultadosEjecutivo = ({ startDate, endDate }: EstadoResultadosEjecutivoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();

  // Usar la misma lógica que la balanza
  const { data: asientosData, isLoading: asientosLoading } = useAsientosBalanza(startDate, endDate);

  if (cuentasLoading || asientosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const cuentasFlat = cuentasData?.cuentasFlat || [];
  const saldosPorCuenta = asientosData?.saldosPorCuenta || {};

  // Verificar si hay datos
  const hayDatos = asientosData?.movimientos && asientosData.movimientos.length > 0;

  if (!hayDatos) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center space-y-2">
            <p className="text-xl font-medium text-muted-foreground">
              No hay datos financieros registrados
            </p>
            <p className="text-sm text-muted-foreground">
              Comienza registrando transacciones para ver el estado de resultados
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Función para obtener el saldo de una cuenta desde los asientos de balanza
  const obtenerSaldo = (codigoCuenta: string): number => {
    const saldo = saldosPorCuenta[codigoCuenta]?.saldo || 0;
    const primerDigito = codigoCuenta.charAt(0);
    
    // Cuenta 4003: Descuentos sobre Ventas (contra-cuenta de ingresos con naturaleza DEUDORA)
    // Si el saldo es DEUDOR (positivo), debe RESTAR de los ingresos, por lo que lo invertimos
    if (codigoCuenta === "4003") {
      return -Math.abs(saldo); // Siempre negativo para restar de ingresos
    }
    
    // Cuentas acreedoras (Pasivos, Capital, Ingresos) - convertir a positivo
    if (["2", "3", "4"].includes(primerDigito)) {
      return Math.abs(saldo);
    }
    
    // Cuentas deudoras (Activos, Costos, Gastos) - mantener como está
    return saldo;
  };

  // Filtrar y calcular totales
  const cuentasVentas = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Ingresos por Ventas" && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasOtrosIngresos = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Otros Ingresos" && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasCostos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return codigo >= 5001 && codigo <= 5099 && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasGastosOperativos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return cuenta.subgrupo === "Gastos de Operación" && 
           cuenta.estado_financiero === "Estado de Resultados" &&
           codigo !== 5109 && codigo !== 5110; // Excluir depreciaciones
  });
  
  const cuentasOtrosGastos = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Otros Gastos" && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasDepreciaciones = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return (codigo === 5109 || codigo === 5110) && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasCostoFinanciero = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return ((codigo >= 5111 && codigo <= 5199) || codigo === 5201) && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasImpuestos = cuentasFlat.filter(cuenta => {
    return cuenta.codigo.startsWith("6") && cuenta.estado_financiero === "Estado de Resultados";
  });

  const totalVentas = cuentasVentas.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalOtrosIngresos = cuentasOtrosIngresos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalIngresos = totalVentas + totalOtrosIngresos;
  const costoVentas = cuentasCostos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const gastosOperativos = cuentasGastosOperativos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const otrosGastos = cuentasOtrosGastos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const utilidadBruta = totalIngresos - costoVentas;
  const ebitda = utilidadBruta - gastosOperativos - otrosGastos;
  const depreciaciones = cuentasDepreciaciones.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const ebit = ebitda - depreciaciones;
  const costoFinanciero = cuentasCostoFinanciero.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const utilidadAntesImpuestos = ebit - costoFinanciero;
  const impuestos = cuentasImpuestos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const utilidadNeta = utilidadAntesImpuestos - impuestos;

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString('es-CO', { minimumFractionDigits: 2 });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
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

    const percentage = totalIngresos > 0 ? ((value / totalIngresos) * 100).toFixed(2) : '0.00';

    return (
      <div 
        className={`grid grid-cols-3 gap-4 items-center py-3 ${isSubtotal || isTotal ? 'border-t-2 border-slate-300 dark:border-slate-600 pt-4' : ''}`}
        style={{ marginLeft: indent > 0 ? `${indent * 1}rem` : '0' }}
      >
        <span className={`${getFontWeight()} ${getColor()}`}>
          {label}
        </span>
        <span className={`${getFontWeight()} ${getColor()} text-right`}>
          {formatCurrency(value)}
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
              <span className="text-right">% Ingresos</span>
            </div>

            {/* Ventas */}
            <LineItem label="Ventas" value={totalVentas} isHeader />

            {/* Otros Ingresos */}
            <LineItem label="(+) Otros Ingresos" value={totalOtrosIngresos} isHeader />

            {/* Total Ingresos */}
            <LineItem label="Total Ingresos" value={totalIngresos} isSubtotal />

            {/* Costo de Ventas */}
            <LineItem label="(-) Costo de Ventas" value={costoVentas} isNegative />

            {/* Utilidad Bruta */}
            <LineItem label="Utilidad Bruta" value={utilidadBruta} isSubtotal />

            {/* Gastos Operativos */}
            <LineItem label="(-) Gastos Operativos" value={gastosOperativos} isNegative />

            {/* Otros Gastos */}
            <LineItem label="(-) Otros Gastos" value={otrosGastos} isNegative />

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
