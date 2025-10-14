import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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

  // Saldos automáticos a la fecha de corte
  const { data: saldosAutomaticos, isLoading: saldosAutomaticosLoading } = useQuery({
    queryKey: ["saldos-automaticos-balance-operativo", cutoffDate],
    queryFn: async () => {
      const cutoffDateStr = cutoffDate.toISOString();

      // Caja (efectivo)
      const { data: ingresosEfectivo } = await supabase
        .from('transacciones_ingresos')
        .select('monto_pagado')
        .eq('metodo_pago', 'efectivo')
        .lte('created_at', cutoffDateStr);

      const { data: egresosEfectivo } = await supabase
        .from('transacciones_egresos')
        .select('monto_pagado')
        .eq('metodo_pago', 'efectivo')
        .lte('created_at', cutoffDateStr);

      const caja = (ingresosEfectivo?.reduce((sum, t) => sum + (t.monto_pagado || 0), 0) || 0) -
                   (egresosEfectivo?.reduce((sum, t) => sum + (t.monto_pagado || 0), 0) || 0);

      // Bancos
      const { data: ingresosBanco } = await supabase
        .from('transacciones_ingresos')
        .select('monto_pagado')
        .in('metodo_pago', ['transferencia', 'tarjeta'])
        .lte('created_at', cutoffDateStr);

      const { data: egresosBanco } = await supabase
        .from('transacciones_egresos')
        .select('monto_pagado')
        .in('metodo_pago', ['transferencia', 'tarjeta', 'tarjeta-transferencia'])
        .lte('created_at', cutoffDateStr);

      const bancos = (ingresosBanco?.reduce((sum, t) => sum + (t.monto_pagado || 0), 0) || 0) -
                     (egresosBanco?.reduce((sum, t) => sum + (t.monto_pagado || 0), 0) || 0);

      // Cuentas por Cobrar
      const { data: cuentasCobrar } = await supabase
        .from('transacciones_ingresos')
        .select('monto_pendiente')
        .gt('monto_pendiente', 0)
        .lte('created_at', cutoffDateStr);

      const cuentasPorCobrar = cuentasCobrar?.reduce((sum, t) => sum + (t.monto_pendiente || 0), 0) || 0;

      // Inventario
      const { data: inventarioData } = await supabase
        .from('productos')
        .select('valor_total_inventario');

      const inventario = inventarioData?.reduce((sum, p) => sum + (p.valor_total_inventario || 0), 0) || 0;

      // Proveedores/Cuentas por Pagar
      const { data: cuentasPagar } = await supabase
        .from('transacciones_egresos')
        .select('monto_pendiente')
        .gt('monto_pendiente', 0)
        .lte('created_at', cutoffDateStr);

      const proveedores = cuentasPagar?.reduce((sum, t) => sum + (t.monto_pendiente || 0), 0) || 0;

      // Utilidad del ejercicio
      const { data: ingresosData } = await supabase
        .from('transacciones_ingresos')
        .select('monto_neto')
        .lte('created_at', cutoffDateStr);

      const ingresos = ingresosData?.reduce((sum, t) => sum + (t.monto_neto || 0), 0) || 0;

      const { data: costosData } = await supabase
        .from('transacciones_egresos')
        .select('monto_total')
        .eq('tipo_egreso', 'costo')
        .lte('created_at', cutoffDateStr);

      const costos = costosData?.reduce((sum, t) => sum + (t.monto_total || 0), 0) || 0;

      const { data: gastosData } = await supabase
        .from('transacciones_egresos')
        .select('monto_total')
        .eq('tipo_egreso', 'gasto')
        .lte('created_at', cutoffDateStr);

      const gastos = gastosData?.reduce((sum, t) => sum + (t.monto_total || 0), 0) || 0;

      const utilidad = ingresos - (costos + gastos);

      return { caja, bancos, cuentasPorCobrar, inventario, proveedores, utilidad };
    },
  });

  // Saldos de asientos contables manuales
  const { data: saldosAsientos, isLoading: saldosLoading } = useQuery({
    queryKey: ["saldos-asientos-balance-operativo", cutoffDate],
    queryFn: async () => {
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      const { data: asientos } = await supabase
        .from("asientos_contables")
        .select("id")
        .lte('fecha', cutoffDateStr);

      if (!asientos || asientos.length === 0) return {};

      const asientoIds = asientos.map(a => a.id);

      const { data, error } = await supabase
        .from("detalle_asientos")
        .select("cuenta_codigo, debe, haber")
        .in("asiento_id", asientoIds);

      if (error) throw error;

      const saldosPorCuenta: { [key: string]: SaldoCuenta } = {};

      data?.forEach((detalle) => {
        const codigo = detalle.cuenta_codigo;
        if (!saldosPorCuenta[codigo]) {
          saldosPorCuenta[codigo] = {
            cuenta_codigo: codigo,
            debe_total: 0,
            haber_total: 0,
            saldo: 0,
          };
        }
        saldosPorCuenta[codigo].debe_total += Number(detalle.debe || 0);
        saldosPorCuenta[codigo].haber_total += Number(detalle.haber || 0);
      });

      // Calcular saldos finales según naturaleza de la cuenta
      Object.values(saldosPorCuenta).forEach((cuenta) => {
        const codigo = cuenta.cuenta_codigo;
        
        if (codigo.startsWith("1")) {
          cuenta.saldo = cuenta.debe_total - cuenta.haber_total;
        } else if (codigo.startsWith("2") || codigo.startsWith("3")) {
          cuenta.saldo = cuenta.haber_total - cuenta.debe_total;
        }
      });

      return saldosPorCuenta;
    },
  });

  if (cuentasLoading || saldosLoading || saldosAutomaticosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const cuentasFlat = cuentasData?.cuentasFlat || [];

  // Función para obtener el saldo de una cuenta
  const obtenerSaldo = (codigoCuenta: string): number => {
    const saldoAsiento = saldosAsientos?.[codigoCuenta]?.saldo || 0;
    let saldoAutomatico = 0;

    if (!saldosAutomaticos) return saldoAsiento;

    switch(codigoCuenta) {
      case '1001': saldoAutomatico = saldosAutomaticos.caja; break;
      case '1002': saldoAutomatico = saldosAutomaticos.bancos; break;
      case '1003': saldoAutomatico = saldosAutomaticos.cuentasPorCobrar; break;
      case '1005': saldoAutomatico = saldosAutomaticos.inventario; break;
      case '2001': saldoAutomatico = saldosAutomaticos.proveedores; break;
    }

    return saldoAsiento + saldoAutomatico;
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
  const utilidadEjercicio = saldosAutomaticos?.utilidad || 0;
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
                if (saldo === 0) return null;
                
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
                if (saldo === 0) return null;
                
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
                if (saldo === 0) return null;
                
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
                if (saldo === 0) return null;
                
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
                if (saldo === 0) return null;
                
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
                if (saldo === 0) return null;
                
                const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : '0.00';
                
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300">
                    <span className="text-sm">{cuenta.codigo} - {cuenta.nombre}</span>
                    <span className="text-right">${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                    <span className="text-right">{percentage}%</span>
                  </div>
                );
              })}
              
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

          {/* Total Pasivo + Capital Contable */}
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
