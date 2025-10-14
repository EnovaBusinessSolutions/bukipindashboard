import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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

  // Saldos automáticos a la fecha de corte
  const { data: saldosAutomaticos, isLoading: saldosAutomaticosLoading } = useQuery({
    queryKey: ["saldos-automaticos-balance-ejecutivo", cutoffDate],
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
    queryKey: ["saldos-asientos-balance-ejecutivo", cutoffDate],
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

  const formatCurrency = (value: number) => {
    return `$${Math.abs(value).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
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

    const percentage = totalActivos > 0 ? ((value / totalActivos) * 100).toFixed(2) : '0.00';

    return (
      <div 
        className={`grid grid-cols-3 gap-4 items-center py-3 ${isSubtotal || isTotal ? 'border-t-2 border-slate-300 dark:border-slate-600 pt-4' : ''}`}
      >
        <span className={`${getFontWeight()} ${getColor()}`}>
          {label}
        </span>
        <span className={`${getFontWeight()} ${getColor()} text-right`}>
          {formatCurrency(value)}
        </span>
        <span className={`${getFontWeight()} ${getColor()} text-right`}>
          {percentage}%
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {balanceCuadrado ? (
          <Scale className="h-8 w-8 text-green-600" />
        ) : (
          <TrendingUp className="h-8 w-8 text-amber-600" />
        )}
        <p className="text-muted-foreground">
          Vista ejecutiva del balance al {cutoffDate.toLocaleDateString('es-CO')}
        </p>
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
        <Card className="border-2">
          <CardHeader className="bg-red-50 dark:bg-red-950">
            <CardTitle className="text-2xl text-red-700">Pasivo y Capital Contable</CardTitle>
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

              {/* Capital Contable */}
              <LineItem label="Capital Contable" value={totalCapitalContable} />
              <LineItem label="Utilidad del Ejercicio" value={utilidadEjercicio} />
              <LineItem label="Total Capital Contable" value={totalCapitalContableConUtilidad} isSubtotal />

              {/* Total Pasivo + Capital Contable */}
              <LineItem label="Total Pasivo + Capital Contable" value={totalPasivoMasCapital} isTotal />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Status */}
      <div className="mt-6 pt-4 border-t-2 border-slate-300 dark:border-slate-600">
        <div className={`text-center font-semibold text-lg ${balanceCuadrado ? 'text-green-600' : 'text-amber-600'}`}>
          {balanceCuadrado ? (
            '✓ Balance Cuadrado'
          ) : (
            `⚠ Diferencia: ${formatCurrency(totalActivos - totalPasivoMasCapital)}`
          )}
        </div>
      </div>
    </div>
  );
};

export default BalanceGeneralEjecutivo;
