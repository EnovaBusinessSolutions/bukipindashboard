import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2, TrendingUp, Scale } from "lucide-react";

interface BalanceGeneralEjecutivoProps {
  cutoffDate: Date;
}

interface SaldoCuenta {
  cuenta_codigo: string;
  debe_total: number;
  haber_total: number;
  saldo: number;
}

const BalanceGeneralEjecutivo = ({ cutoffDate }: BalanceGeneralEjecutivoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();

  // Usar la misma lógica que la balanza
  const startDate = new Date(0); // Desde el inicio
  const { data: asientosData, isLoading: asientosLoading } = useAsientosBalanza(startDate, cutoffDate);

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
            <p className="text-xl font-medium text-muted-foreground">No hay datos financieros registrados</p>
            <p className="text-sm text-muted-foreground">
              Comienza registrando transacciones para ver el balance general
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Función para obtener el saldo de una cuenta desde los asientos de balanza
  const obtenerSaldo = (codigoCuenta: string): number => {
    return saldosPorCuenta[codigoCuenta]?.saldo || 0;
  };

  // Calcular TODOS los activos desde los saldos de la balanza (cuentas 1xxx)
  const codigosActivos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("1"));
  const totalActivos = codigosActivos.reduce((sum, codigo) => {
    const saldo = saldosPorCuenta[codigo]?.saldo || 0;
    return sum + saldo;
  }, 0);

  // Calcular TODOS los pasivos desde los saldos de la balanza (cuentas 2xxx)
  const codigosPasivos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("2"));
  const totalPasivos = codigosPasivos.reduce((sum, codigo) => {
    const saldo = saldosPorCuenta[codigo]?.saldo || 0;
    return sum + saldo;
  }, 0);

  // Calcular TODOS los capital contable desde los saldos de la balanza (cuentas 3xxx)
  const codigosCapital = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("3"));
  const totalCapitalContable = codigosCapital.reduce((sum, codigo) => {
    const saldo = saldosPorCuenta[codigo]?.saldo || 0;
    return sum + saldo;
  }, 0);

  // Calcular utilidad del ejercicio desde los saldos de la balanza (cuentas 4xxx - 5xxx - 6xxx)
  const ingresosCodigos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("4"));
  const egresosCodigos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("5"));
  const impuestosCodigos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("6"));

  const ingresos = ingresosCodigos.reduce((sum, c) => sum + (saldosPorCuenta[c]?.saldo || 0), 0);
  const egresos = egresosCodigos.reduce((sum, c) => sum + (saldosPorCuenta[c]?.saldo || 0), 0);
  const impuestos = impuestosCodigos.reduce((sum, c) => sum + (saldosPorCuenta[c]?.saldo || 0), 0);

  const utilidadEjercicio = ingresos - egresos - impuestos;

  // Desglosar activos por tipo para mostrar (ejecutivo usa totales)
  const activoCirculante = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Activo Circulante" && cuenta.estado_financiero === "Balance General"
  );

  const activoFijo = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Activo No Circulante" && cuenta.estado_financiero === "Balance General"
  );

  const activoDiferido = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Activo Diferido" && cuenta.estado_financiero === "Balance General"
  );

  const pasivoCortoPlazo = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Pasivo Circulante" && cuenta.estado_financiero === "Balance General"
  );

  const pasivoLargoPlazo = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Pasivo No Circulante" && cuenta.estado_financiero === "Balance General"
  );

  // Calcular subtotales para mostrar (solo para display, los totales ya los tenemos)
  const totalActivoCirculante = activoCirculante.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalActivoFijo = activoFijo.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalActivoDiferido = activoDiferido.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);

  const totalPasivoCortoPlazo = pasivoCortoPlazo.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalPasivoLargoPlazo = pasivoLargoPlazo.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);

  // ✅ Requerimiento: Capital Contable en 2 rubros
  const otrasCuentasCapital = totalCapitalContable;
  const totalCapitalContableConUtilidad = otrasCuentasCapital + utilidadEjercicio;

  const totalPasivoMasCapital = totalPasivos + totalCapitalContableConUtilidad;
  const balanceCuadrado = Math.abs(totalActivos - totalPasivoMasCapital) < 0.01;

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString("es-CO", { minimumFractionDigits: 2 });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const LineItem = ({
    label,
    value,
    isSubtotal = false,
    isTotal = false,
  }: {
    label: string;
    value: number;
    isSubtotal?: boolean;
    isTotal?: boolean;
  }) => {
    const getColor = () => {
      if (isTotal) return "text-emerald-700 dark:text-emerald-400";
      if (isSubtotal) return "text-blue-700 dark:text-blue-400";
      return "text-slate-700 dark:text-slate-300";
    };

    const getFontWeight = () => {
      if (isTotal) return "font-bold text-xl";
      if (isSubtotal) return "font-semibold text-lg";
      return "";
    };

    const percentage = totalActivos > 0 ? ((value / totalActivos) * 100).toFixed(2) : "0.00";

    return (
      <div
        className={`grid grid-cols-3 gap-4 items-center py-3 ${
          isSubtotal || isTotal ? "border-t-2 border-slate-300 dark:border-slate-600 pt-4" : ""
        }`}
      >
        <span className={`${getFontWeight()} ${getColor()}`}>{label}</span>
        <span className={`${getFontWeight()} ${getColor()} text-right`}>{formatCurrency(value)}</span>
        <span className={`${getFontWeight()} ${getColor()} text-right`}>{percentage}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {balanceCuadrado ? <Scale className="h-8 w-8 text-green-600" /> : <TrendingUp className="h-8 w-8 text-amber-600" />}
        <p className="text-muted-foreground">Vista ejecutiva del balance al {cutoffDate.toLocaleDateString("es-CO")}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lado Izquierdo - Activos */}
        <Card className="border-2">
          <CardHeader className="bg-blue-50 dark:bg-blue-950">
            <CardTitle className="text-2xl text-blue-700">Activos</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
                <span>Concepto</span>
                <span className="text-right">Monto</span>
                <span className="text-right">%</span>
              </div>

              {/* Activos */}
              <LineItem label="Activo Circulante" value={totalActivoCirculante} />
              <LineItem label="Activo Fijo" value={totalActivoFijo} />
              <LineItem label="Activo Diferido / Largo Plazo" value={totalActivoDiferido} />
              <LineItem label="Total Activo" value={totalActivos} isTotal />
            </div>
          </CardContent>
        </Card>

        {/* Lado Derecho - Pasivos y Capital Contable */}
        <div className="space-y-6">
          {/* Pasivos */}
          <Card className="border-2">
            <CardHeader className="bg-red-50 dark:bg-red-950">
              <CardTitle className="text-2xl text-red-700">Pasivo</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-1">
                {/* Header */}
                <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
                  <span>Concepto</span>
                  <span className="text-right">Monto</span>
                  <span className="text-right">%</span>
                </div>

                {/* Pasivos */}
                <LineItem label="Pasivo Corto Plazo" value={totalPasivoCortoPlazo} />
                <LineItem label="Pasivo Largo Plazo" value={totalPasivoLargoPlazo} />
                <LineItem label="Total Pasivo" value={totalPasivos} isSubtotal />
              </div>
            </CardContent>
          </Card>

          {/* Capital Contable */}
          <Card className="border-2">
            <CardHeader className="bg-green-50 dark:bg-green-950">
              <CardTitle className="text-2xl text-green-700">Capital Contable</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-1">
                {/* Header */}
                <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
                  <span>Concepto</span>
                  <span className="text-right">Monto</span>
                  <span className="text-right">%</span>
                </div>

                {/* ✅ SOLO 2 RUBROS */}
                <LineItem label="Utilidad del ejercicio" value={utilidadEjercicio} />
                <LineItem label="Otras cuentas de capital" value={otrasCuentasCapital} />
                <LineItem label="Total Capital Contable" value={totalCapitalContableConUtilidad} isSubtotal />
              </div>
            </CardContent>
          </Card>

          {/* Total Pasivo + Capital Contable */}
          <Card className="border-2 border-slate-400 dark:border-slate-500">
            <CardHeader className="bg-slate-100 dark:bg-slate-800">
              <CardTitle className="text-xl">Total Pasivo + Capital Contable</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-1">
                <LineItem label="Total Pasivo + Capital Contable" value={totalPasivoMasCapital} isTotal />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Balance Status */}
      <div className="mt-6 pt-4 border-t-2 border-slate-300 dark:border-slate-600">
        <div className={`text-center font-semibold text-lg ${balanceCuadrado ? "text-green-600" : "text-amber-600"}`}>
          {balanceCuadrado ? "✓ Balance Cuadrado" : `⚠ Diferencia: ${formatCurrency(totalActivos - totalPasivoMasCapital)}`}
        </div>
      </div>
    </div>
  );
};

export default BalanceGeneralEjecutivo;
