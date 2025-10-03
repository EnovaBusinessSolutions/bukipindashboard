import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useBalanceGeneral } from "@/hooks/useBalanceGeneral";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SaldoCuenta {
  cuenta_codigo: string;
  debe_total: number;
  haber_total: number;
  saldo: number;
}

const BalanceGeneral = () => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();
  const { data: saldosAutomaticos, isLoading: saldosAutomaticosLoading } = useBalanceGeneral();

  // Saldos de asientos contables manuales
  const { data: saldosAsientos, isLoading: saldosLoading } = useQuery({
    queryKey: ["saldos-cuentas-balance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("detalle_asientos")
        .select("cuenta_codigo, debe, haber");

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
        
        // Activos (1000-1999): Debe - Haber
        if (codigo.startsWith("1")) {
          cuenta.saldo = cuenta.debe_total - cuenta.haber_total;
        }
        // Pasivos (2000-2999): Haber - Debe
        else if (codigo.startsWith("2")) {
          cuenta.saldo = cuenta.haber_total - cuenta.debe_total;
        }
        // Patrimonio (3000-3999): Haber - Debe
        else if (codigo.startsWith("3")) {
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
  
  // Función para obtener el saldo de una cuenta (combinando asientos manuales y automáticos)
  const obtenerSaldo = (codigoCuenta: string): number => {
    const saldoAsiento = saldosAsientos?.[codigoCuenta]?.saldo || 0;
    let saldoAutomatico = 0;

    if (!saldosAutomaticos) return saldoAsiento;

    // Mapear saldos automáticos a cuentas específicas
    switch(codigoCuenta) {
      case '1001': // Caja
        saldoAutomatico = saldosAutomaticos.caja;
        break;
      case '1002': // Bancos
        saldoAutomatico = saldosAutomaticos.bancos;
        break;
      case '1003': // Cuentas por Cobrar
        saldoAutomatico = saldosAutomaticos.cuentasPorCobrar;
        break;
      case '1005': // Inventario
        saldoAutomatico = saldosAutomaticos.inventario;
        break;
      case '2001': // Proveedores
        saldoAutomatico = saldosAutomaticos.proveedores;
        break;
      default:
        saldoAutomatico = 0;
    }

    return saldoAsiento + saldoAutomatico;
  };

  // Filtrar cuentas del balance general
  const cuentasActivos = cuentasFlat.filter(cuenta => 
    cuenta.codigo.startsWith("1") && cuenta.estado_financiero === "Balance General"
  );
  
  const cuentasPasivos = cuentasFlat.filter(cuenta => 
    cuenta.codigo.startsWith("2") && cuenta.estado_financiero === "Balance General"
  );

  const cuentasPatrimonio = cuentasFlat.filter(cuenta => 
    cuenta.codigo.startsWith("3") && cuenta.estado_financiero === "Balance General"
  );

  const calcularTotalActivos = () => {
    return cuentasActivos.reduce((total, cuenta) => {
      const saldo = obtenerSaldo(cuenta.codigo);
      return total + saldo;
    }, 0);
  };

  const calcularTotalPasivos = () => {
    return cuentasPasivos.reduce((total, cuenta) => {
      const saldo = obtenerSaldo(cuenta.codigo);
      return total + saldo;
    }, 0);
  };

  const calcularTotalPatrimonio = () => {
    return cuentasPatrimonio.reduce((total, cuenta) => {
      const saldo = obtenerSaldo(cuenta.codigo);
      return total + saldo;
    }, 0);
  };

  // Utilidad del ejercicio desde transacciones reales
  const utilidadEjercicio = saldosAutomaticos?.utilidad || 0;

  const totalActivos = calcularTotalActivos();
  const totalPasivos = calcularTotalPasivos();
  const totalPatrimonio = calcularTotalPatrimonio();
  const totalPatrimonioConUtilidad = totalPatrimonio + utilidadEjercicio;

  const diferencia = totalActivos - (totalPasivos + totalPatrimonioConUtilidad);
  const balanceCuadrado = Math.abs(diferencia) < 0.01; // Tolerancia de $0.01 por redondeo

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Balance General</h1>
        <p className="text-muted-foreground">Estado de la situación financiera</p>
      </div>

      {/* Alerta informativa */}
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Este Balance General refleja automáticamente todas las transacciones registradas: ingresos, egresos, 
          inventario, cuentas por cobrar/pagar, y movimientos de caja y bancos.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Activos */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-600">Activos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cuentasActivos.map((cuenta) => {
                  const saldo = obtenerSaldo(cuenta.codigo);
                  // Solo mostrar cuentas con saldo diferente de cero
                  if (saldo === 0 && !['1001', '1002', '1003', '1005'].includes(cuenta.codigo)) {
                    return null;
                  }
                  return (
                    <div key={cuenta.codigo} className="flex justify-between items-center">
                      <span className="text-sm">
                        {cuenta.codigo} - {cuenta.nombre}
                      </span>
                      <span className="font-medium">
                        ${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
                <div className="border-t pt-2 mt-4">
                  <div className="flex justify-between items-center font-bold text-blue-600">
                    <span>Total Activos</span>
                    <span>${totalActivos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pasivos y Patrimonio */}
        <div className="space-y-6">
          {/* Pasivos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Pasivos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cuentasPasivos.map((cuenta) => {
                  const saldo = obtenerSaldo(cuenta.codigo);
                  // Solo mostrar cuentas con saldo diferente de cero
                  if (saldo === 0 && cuenta.codigo !== '2001') {
                    return null;
                  }
                  return (
                    <div key={cuenta.codigo} className="flex justify-between items-center">
                      <span className="text-sm">
                        {cuenta.codigo} - {cuenta.nombre}
                      </span>
                      <span className="font-medium">
                        ${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
                <div className="border-t pt-2 mt-4">
                  <div className="flex justify-between items-center font-bold text-red-600">
                    <span>Total Pasivos</span>
                    <span>${totalPasivos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
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
                {cuentasPatrimonio.map((cuenta) => {
                  const saldo = obtenerSaldo(cuenta.codigo);
                  if (saldo === 0) return null;
                  return (
                    <div key={cuenta.codigo} className="flex justify-between items-center">
                      <span className="text-sm">
                        {cuenta.codigo} - {cuenta.nombre}
                      </span>
                      <span className="font-medium">
                        ${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
                {/* Utilidad del Ejercicio */}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Utilidad del Ejercicio</span>
                    <span className={`font-medium ${utilidadEjercicio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${utilidadEjercicio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Ingresos: ${saldosAutomaticos?.ingresos.toLocaleString('es-CO', { minimumFractionDigits: 2 })} - 
                    Costos: ${saldosAutomaticos?.costos.toLocaleString('es-CO', { minimumFractionDigits: 2 })} - 
                    Gastos: ${saldosAutomaticos?.gastos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="border-t pt-2 mt-4">
                  <div className="flex justify-between items-center font-bold text-green-600">
                    <span>Total Patrimonio</span>
                    <span>${totalPatrimonioConUtilidad.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Pasivos + Patrimonio */}
          <Card>
            <CardHeader>
              <CardTitle>Total Pasivos + Patrimonio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center font-bold text-lg">
                <span>Total</span>
                <span>${(totalPasivos + totalPatrimonioConUtilidad).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {balanceCuadrado ? (
                  <span className="text-green-600">✓ Balance cuadrado</span>
                ) : (
                  <span className="text-red-600">
                    ⚠ Balance no cuadra (diferencia: ${diferencia.toLocaleString('es-CO', { minimumFractionDigits: 2 })})
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resumen de Transacciones */}
          {saldosAutomaticos && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resumen de Transacciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Efectivo en Caja:</span>
                    <span>${saldosAutomaticos.caja.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saldo en Bancos:</span>
                    <span>${saldosAutomaticos.bancos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Por Cobrar:</span>
                    <span>${saldosAutomaticos.cuentasPorCobrar.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Por Pagar:</span>
                    <span>${saldosAutomaticos.proveedores.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default BalanceGeneral;
