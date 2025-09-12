import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface SaldoCuenta {
  cuenta_codigo: string;
  debe_total: number;
  haber_total: number;
  saldo: number;
}

const BalanceGeneral = () => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();

  const { data: saldos, isLoading: saldosLoading } = useQuery({
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
        // Ingresos (4000-4999): Haber - Debe (para utilidad del ejercicio)
        else if (codigo.startsWith("4")) {
          cuenta.saldo = cuenta.haber_total - cuenta.debe_total;
        }
        // Gastos (5000-5999): Debe - Haber (para utilidad del ejercicio)
        else if (codigo.startsWith("5")) {
          cuenta.saldo = cuenta.debe_total - cuenta.haber_total;
        }
      });

      return saldosPorCuenta;
    },
  });

  if (cuentasLoading || saldosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const cuentasFlat = cuentasData?.cuentasFlat || [];
  
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
      const saldo = saldos?.[cuenta.codigo]?.saldo || 0;
      return total + saldo;
    }, 0);
  };

  const calcularTotalPasivos = () => {
    return cuentasPasivos.reduce((total, cuenta) => {
      const saldo = saldos?.[cuenta.codigo]?.saldo || 0;
      return total + saldo;
    }, 0);
  };

  const calcularTotalPatrimonio = () => {
    return cuentasPatrimonio.reduce((total, cuenta) => {
      const saldo = saldos?.[cuenta.codigo]?.saldo || 0;
      return total + saldo;
    }, 0);
  };

  // Calcular utilidad del ejercicio (resultado del estado de resultados)
  const calcularUtilidadEjercicio = () => {
    // Filtrar cuentas de ingresos y gastos
    const cuentasIngresos = cuentasFlat.filter(cuenta => cuenta.codigo.startsWith("4"));
    const cuentasGastos = cuentasFlat.filter(cuenta => cuenta.codigo.startsWith("5"));
    
    const totalIngresos = cuentasIngresos.reduce((total, cuenta) => {
      const saldo = saldos?.[cuenta.codigo]?.saldo || 0;
      return total + saldo;
    }, 0);
    
    const totalGastos = cuentasGastos.reduce((total, cuenta) => {
      const saldo = saldos?.[cuenta.codigo]?.saldo || 0;
      return total + saldo;
    }, 0);
    
    return totalIngresos - totalGastos;
  };

  const totalActivos = calcularTotalActivos();
  const totalPasivos = calcularTotalPasivos();
  const totalPatrimonio = calcularTotalPatrimonio();
  const utilidadEjercicio = calcularUtilidadEjercicio();
  const totalPatrimonioConUtilidad = totalPatrimonio + utilidadEjercicio;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Balance General</h1>
        <p className="text-muted-foreground">Estado de la situación financiera</p>
      </div>

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
                  const saldo = saldos?.[cuenta.codigo]?.saldo || 0;
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
                  const saldo = saldos?.[cuenta.codigo]?.saldo || 0;
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
                  const saldo = saldos?.[cuenta.codigo]?.saldo || 0;
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
                {totalActivos === (totalPasivos + totalPatrimonioConUtilidad) ? (
                  <span className="text-green-600">✓ Balance cuadrado</span>
                ) : (
                  <span className="text-red-600">⚠ Balance no cuadra (diferencia: ${(totalActivos - (totalPasivos + totalPatrimonioConUtilidad)).toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BalanceGeneral;