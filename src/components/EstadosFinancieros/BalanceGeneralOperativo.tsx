import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BalanceGeneralOperativoProps {
  cutoffDate: Date;
}

interface SaldoCuenta {
  cuenta_codigo: string;
  debe_total: number;
  haber_total: number;
  saldo: number;
}

const BalanceGeneralOperativo = ({ cutoffDate }: BalanceGeneralOperativoProps) => {
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

  // Función para obtener el saldo de una cuenta desde los asientos de balanza
  const obtenerSaldo = (codigoCuenta: string): number => {
    return saldosPorCuenta[codigoCuenta]?.saldo || 0;
  };

  // Filtrar cuentas por agrupación
  const activoCirculante = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Activo Circulante" && cuenta.estado_financiero === "Balance General"
  );
  
  const activoFijo = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Activo No Circulante" && cuenta.estado_financiero === "Balance General"
  );

  const activoDiferido = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Activo Diferido" && cuenta.estado_financiero === "Balance General"
  );

  const pasivoCortoPlazo = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Pasivo Circulante" && cuenta.estado_financiero === "Balance General"
  );

  const pasivoLargoPlazo = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Pasivo No Circulante" && cuenta.estado_financiero === "Balance General"
  );

  const capitalContable = cuentasFlat.filter(cuenta => 
    cuenta.codigo.startsWith("3") && cuenta.estado_financiero === "Balance General"
  );

  // Calcular totales
  const totalActivoCirculante = activoCirculante.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalActivoFijo = activoFijo.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalActivoDiferido = activoDiferido.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalActivos = totalActivoCirculante + totalActivoFijo + totalActivoDiferido;

  const totalPasivoCortoPlazo = pasivoCortoPlazo.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalPasivoLargoPlazo = pasivoLargoPlazo.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalPasivos = totalPasivoCortoPlazo + totalPasivoLargoPlazo;

  const totalCapitalContable = capitalContable.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  
  // Calcular utilidad del ejercicio desde los saldos
  const ingresosCodigos = Object.keys(saldosPorCuenta).filter(c => c.startsWith("4"));
  const egresosCodigos = Object.keys(saldosPorCuenta).filter(c => c.startsWith("5"));
  const ingresos = ingresosCodigos.reduce((sum, c) => sum + (saldosPorCuenta[c]?.saldo || 0), 0);
  const egresos = egresosCodigos.reduce((sum, c) => sum + (saldosPorCuenta[c]?.saldo || 0), 0);
  const utilidadEjercicio = ingresos - egresos;
  
  const totalCapitalContableConUtilidad = totalCapitalContable + utilidadEjercicio;
  
  const totalPasivoMasCapital = totalPasivos + totalCapitalContableConUtilidad;

  const balanceCuadrado = Math.abs(totalActivos - totalPasivoMasCapital) < 0.01;

  return (
    <div className="space-y-6">
      {/* Alerta informativa */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Balance General al {cutoffDate.toLocaleDateString('es-CO')} - Los saldos reflejan la situación financiera a esta fecha específica.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lado Izquierdo - Activos */}
        <div className="space-y-6">
          {/* Activo Circulante */}
        <Card className="border-2">
          <CardHeader className="bg-blue-50 dark:bg-blue-950">
            <CardTitle className="text-blue-700">Activo Circulante</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
              <span>Cuenta</span>
              <span className="text-right">Saldo</span>
              <span className="text-right">% Activos</span>
            </div>

            <div className="space-y-1">
              {activoCirculante.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                
                const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : '0.00';
                
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300">
                    <span className="text-sm">{cuenta.codigo} - {cuenta.nombre}</span>
                    <span className="text-right">${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                    <span className="text-right">{percentage}%</span>
                  </div>
                );
              })}
              
              <div className="grid grid-cols-3 gap-4 items-center py-3 border-t-2 border-slate-300 dark:border-slate-600 pt-4 font-semibold text-blue-600 text-base">
                <span>Total Activo Circulante</span>
                <span className="text-right">${totalActivoCirculante.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalActivos > 0 ? ((totalActivoCirculante / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activo Fijo */}
        <Card className="border-2">
          <CardHeader className="bg-indigo-50 dark:bg-indigo-950">
            <CardTitle className="text-indigo-700">Activo Fijo</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
              <span>Cuenta</span>
              <span className="text-right">Saldo</span>
              <span className="text-right">% Activos</span>
            </div>

            <div className="space-y-1">
              {activoFijo.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                
                const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : '0.00';
                
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300">
                    <span className="text-sm">{cuenta.codigo} - {cuenta.nombre}</span>
                    <span className="text-right">${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                    <span className="text-right">{percentage}%</span>
                  </div>
                );
              })}
              
              <div className="grid grid-cols-3 gap-4 items-center py-3 border-t-2 border-slate-300 dark:border-slate-600 pt-4 font-semibold text-indigo-600 text-base">
                <span>Total Activo Fijo</span>
                <span className="text-right">${totalActivoFijo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalActivos > 0 ? ((totalActivoFijo / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activo Diferido */}
        <Card className="border-2">
          <CardHeader className="bg-cyan-50 dark:bg-cyan-950">
            <CardTitle className="text-cyan-700">Activo Diferido / Largo Plazo</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
              <span>Cuenta</span>
              <span className="text-right">Saldo</span>
              <span className="text-right">% Activos</span>
            </div>

            <div className="space-y-1">
              {activoDiferido.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                
                const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : '0.00';
                
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300">
                    <span className="text-sm">{cuenta.codigo} - {cuenta.nombre}</span>
                    <span className="text-right">${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                    <span className="text-right">{percentage}%</span>
                  </div>
                );
              })}
              
              <div className="grid grid-cols-3 gap-4 items-center py-3 border-t-2 border-slate-300 dark:border-slate-600 pt-4 font-semibold text-cyan-600 text-base">
                <span>Total Activo Diferido</span>
                <span className="text-right">${totalActivoDiferido.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalActivos > 0 ? ((totalActivoDiferido / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Total Activos */}
          <Card className="border-2 border-blue-400 dark:border-blue-500">
            <CardHeader className="bg-blue-100 dark:bg-blue-900">
              <CardTitle className="text-blue-800">Total Activo</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 items-center font-bold text-xl text-blue-800">
                <span>Total Activos</span>
                <span className="text-right">${totalActivos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">100.00%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lado Derecho - Pasivos y Capital Contable */}
        <div className="space-y-6">
          {/* Card de Pasivos */}
          <Card className="border-2">
            <CardHeader className="bg-red-50 dark:bg-red-950">
              <CardTitle className="text-xl text-red-700">Pasivo</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
          {/* Pasivo Corto Plazo */}
        <Card className="border-2">
          <CardHeader className="bg-red-50 dark:bg-red-950">
            <CardTitle className="text-red-700">Pasivo Corto Plazo</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
              <span>Cuenta</span>
              <span className="text-right">Saldo</span>
              <span className="text-right">% Activos</span>
            </div>

            <div className="space-y-1">
              {pasivoCortoPlazo.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                
                const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : '0.00';
                
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300">
                    <span className="text-sm">{cuenta.codigo} - {cuenta.nombre}</span>
                    <span className="text-right">${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                    <span className="text-right">{percentage}%</span>
                  </div>
                );
              })}
              
              <div className="grid grid-cols-3 gap-4 items-center py-3 border-t-2 border-slate-300 dark:border-slate-600 pt-4 font-semibold text-red-600 text-base">
                <span>Total Pasivo Corto Plazo</span>
                <span className="text-right">${totalPasivoCortoPlazo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalActivos > 0 ? ((totalPasivoCortoPlazo / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pasivo Largo Plazo */}
        <Card className="border-2">
          <CardHeader className="bg-orange-50 dark:bg-orange-950">
            <CardTitle className="text-orange-700">Pasivo Largo Plazo</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
              <span>Cuenta</span>
              <span className="text-right">Saldo</span>
              <span className="text-right">% Activos</span>
            </div>

            <div className="space-y-1">
              {pasivoLargoPlazo.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                
                const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : '0.00';
                
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300">
                    <span className="text-sm">{cuenta.codigo} - {cuenta.nombre}</span>
                    <span className="text-right">${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                    <span className="text-right">{percentage}%</span>
                  </div>
                );
              })}
              
              <div className="grid grid-cols-3 gap-4 items-center py-3 border-t-2 border-slate-300 dark:border-slate-600 pt-4 font-semibold text-orange-600 text-base">
                <span>Total Pasivo Largo Plazo</span>
                <span className="text-right">${totalPasivoLargoPlazo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalActivos > 0 ? ((totalPasivoLargoPlazo / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Total Pasivo */}
          <Card className="border-2 border-red-400 dark:border-red-500">
            <CardHeader className="bg-red-100 dark:bg-red-900">
              <CardTitle className="text-red-800">Total Pasivo</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 items-center font-bold text-xl text-red-800">
                <span>Total Pasivo</span>
                <span className="text-right">${totalPasivos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalActivos > 0 ? ((totalPasivos / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
              </div>
            </CardContent>
          </Card>
              </div>
            </CardContent>
          </Card>

          {/* Card de Capital Contable */}
          <Card className="border-2">
            <CardHeader className="bg-green-50 dark:bg-green-950">
              <CardTitle className="text-xl text-green-700">Capital Contable</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
          {/* Capital Contable */}
        <Card className="border-2">
          <CardHeader className="bg-green-50 dark:bg-green-950">
            <CardTitle className="text-green-700">Capital Contable</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
              <span>Cuenta</span>
              <span className="text-right">Saldo</span>
              <span className="text-right">% Activos</span>
            </div>

            <div className="space-y-1">
              {capitalContable.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                
                const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : '0.00';
                
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300">
                    <span className="text-sm">{cuenta.codigo} - {cuenta.nombre}</span>
                    <span className="text-right">${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                    <span className="text-right">{percentage}%</span>
                  </div>
                );
              })}
              
              {/* Mostrar capital social y utilidades retenidas desde transacciones automáticas */}
              <div className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300">
                <span className="text-sm font-medium">Capital Social (3001)</span>
                <span className="text-right">${obtenerSaldo("3001").toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalActivos > 0 ? ((obtenerSaldo("3001") / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300">
                <span className="text-sm font-medium">Utilidades Retenidas (3002)</span>
                <span className="text-right">${obtenerSaldo("3002").toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalActivos > 0 ? ((obtenerSaldo("3002") / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300">
                <span className="text-sm font-medium">Utilidad del Ejercicio</span>
                <span className="text-right">${utilidadEjercicio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalActivos > 0 ? ((utilidadEjercicio / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 items-center py-3 border-t-2 border-slate-300 dark:border-slate-600 pt-4 font-bold text-green-600 text-lg">
                <span>Total Capital Contable</span>
                <span className="text-right">${totalCapitalContableConUtilidad.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalActivos > 0 ? ((totalCapitalContableConUtilidad / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
              </div>
            </CardContent>
          </Card>

          {/* Card Total Pasivo + Capital Contable */}
          <Card className="border-2 border-slate-400 dark:border-slate-500">
            <CardHeader className="bg-slate-100 dark:bg-slate-800">
              <CardTitle>Total Pasivo + Capital Contable</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 items-center font-bold text-xl">
                <span>Total</span>
                <span className="text-right">${totalPasivoMasCapital.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalActivos > 0 ? ((totalPasivoMasCapital / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Balance Status */}
      <div className="mt-6 text-center">
        <div className={`font-semibold text-lg ${balanceCuadrado ? 'text-green-600' : 'text-amber-600'}`}>
          {balanceCuadrado ? (
            '✓ Balance Cuadrado'
          ) : (
            `⚠ Diferencia: $${Math.abs(totalActivos - totalPasivoMasCapital).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`
          )}
        </div>
      </div>
    </div>
  );
};

export default BalanceGeneralOperativo;
