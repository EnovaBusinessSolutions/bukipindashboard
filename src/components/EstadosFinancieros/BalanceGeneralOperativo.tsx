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

  // Filtrar cuentas
  const cuentasActivos = cuentasFlat.filter(cuenta => 
    cuenta.codigo.startsWith("1") && cuenta.estado_financiero === "Balance General"
  );
  
  const cuentasPasivos = cuentasFlat.filter(cuenta => 
    cuenta.codigo.startsWith("2") && cuenta.estado_financiero === "Balance General"
  );

  const cuentasPatrimonio = cuentasFlat.filter(cuenta => 
    cuenta.codigo.startsWith("3") && cuenta.estado_financiero === "Balance General"
  );

  const totalActivos = cuentasActivos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalPasivos = cuentasPasivos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalPatrimonio = cuentasPatrimonio.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const utilidadEjercicio = saldosAutomaticos?.utilidad || 0;
  const totalPatrimonioConUtilidad = totalPatrimonio + utilidadEjercicio;
  const totalPasivosMasPatrimonio = totalPasivos + totalPatrimonioConUtilidad;

  const balanceCuadrado = Math.abs(totalActivos - totalPasivosMasPatrimonio) < 0.01;

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
        {/* Activos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Activos</span>
              </div>
              {cuentasActivos.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : '0.00';
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center">
                    <span className="text-sm">
                      {cuenta.codigo} - {cuenta.nombre}
                    </span>
                    <span className="font-medium text-right">
                      ${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-right text-sm">
                      {percentage}%
                    </span>
                  </div>
                );
              })}
              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-blue-600">
                  <span>Total Activos</span>
                  <span className="text-right">${totalActivos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  <span className="text-right">100.00%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pasivos y Patrimonio */}
        <div className="space-y-6">
          {/* Pasivos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Pasivos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                  <span>Cuenta</span>
                  <span className="text-right">Monto</span>
                  <span className="text-right">% Activos</span>
                </div>
                {cuentasPasivos.map((cuenta) => {
                  const saldo = obtenerSaldo(cuenta.codigo);
                  const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : '0.00';
                  return (
                    <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center">
                      <span className="text-sm">
                        {cuenta.codigo} - {cuenta.nombre}
                      </span>
                      <span className="font-medium text-right">
                        ${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-right text-sm">
                        {percentage}%
                      </span>
                    </div>
                  );
                })}
                <div className="border-t pt-2 mt-4">
                  <div className="grid grid-cols-3 gap-4 items-center font-bold text-red-600">
                    <span>Total Pasivos</span>
                    <span className="text-right">${totalPasivos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                    <span className="text-right">{totalActivos > 0 ? ((totalPasivos / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Patrimonio */}
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Patrimonio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                  <span>Cuenta</span>
                  <span className="text-right">Monto</span>
                  <span className="text-right">% Activos</span>
                </div>
                {cuentasPatrimonio.map((cuenta) => {
                  const saldo = obtenerSaldo(cuenta.codigo);
                  const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : '0.00';
                  return (
                    <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center">
                      <span className="text-sm">
                        {cuenta.codigo} - {cuenta.nombre}
                      </span>
                      <span className="font-medium text-right">
                        ${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-right text-sm">
                        {percentage}%
                      </span>
                    </div>
                  );
                })}
                {/* Utilidad del Ejercicio */}
                <div className="border-t pt-2 mt-2">
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <span className="text-sm">Utilidad del Ejercicio</span>
                    <span className={`font-medium text-right ${utilidadEjercicio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${utilidadEjercicio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-right text-sm">
                      {totalActivos > 0 ? ((utilidadEjercicio / totalActivos) * 100).toFixed(2) : '0.00'}%
                    </span>
                  </div>
                </div>
                <div className="border-t pt-2 mt-4">
                  <div className="grid grid-cols-3 gap-4 items-center font-bold text-green-600">
                    <span>Total Patrimonio</span>
                    <span className="text-right">${totalPatrimonioConUtilidad.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                    <span className="text-right">{totalActivos > 0 ? ((totalPatrimonioConUtilidad / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Pasivos + Patrimonio */}
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle>Total Pasivo + Patrimonio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 items-center font-bold text-lg">
                <span>Total</span>
                <span className="text-right">${totalPasivosMasPatrimonio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalActivos > 0 ? ((totalPasivosMasPatrimonio / totalActivos) * 100).toFixed(2) : '0.00'}%</span>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className={`text-center font-semibold ${balanceCuadrado ? 'text-green-600' : 'text-amber-600'}`}>
                  {balanceCuadrado ? (
                    '✓ Balance Cuadrado'
                  ) : (
                    `⚠ Diferencia: $${Math.abs(totalActivos - totalPasivosMasPatrimonio).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BalanceGeneralOperativo;
