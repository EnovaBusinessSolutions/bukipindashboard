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

const EstadoResultados = () => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();
  const { data: saldosAutomaticos, isLoading: saldosAutomaticosLoading } = useBalanceGeneral();

  // Saldos de asientos contables manuales
  const { data: saldosAsientos, isLoading: saldosLoading } = useQuery({
    queryKey: ["saldos-cuentas"],
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
        
        // Ingresos (4000-4999): Haber - Debe
        if (codigo.startsWith("4")) {
          cuenta.saldo = cuenta.haber_total - cuenta.debe_total;
        }
        // Costos (5001-5099): Debe - Haber
        else if (codigo.startsWith("5") && parseInt(codigo) >= 5001 && parseInt(codigo) <= 5099) {
          cuenta.saldo = cuenta.debe_total - cuenta.haber_total;
        }
        // Gastos (5100-5999): Debe - Haber
        else if (codigo.startsWith("5") && parseInt(codigo) >= 5100) {
          cuenta.saldo = cuenta.debe_total - cuenta.haber_total;
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
    if (codigoCuenta.startsWith("4")) {
      // Ingresos - usar el total de ingresos para la cuenta principal
      if (codigoCuenta === "4001") {
        saldoAutomatico = saldosAutomaticos.ingresos;
      }
    } else if (codigoCuenta.startsWith("5")) {
      const codigoNum = parseInt(codigoCuenta);
      // Costos (5001-5099)
      if (codigoNum >= 5001 && codigoNum <= 5099) {
        if (codigoCuenta === "5001") {
          saldoAutomatico = saldosAutomaticos.costos;
        }
      }
      // Gastos (5100-5999)
      else if (codigoNum >= 5100) {
        if (codigoCuenta === "5100") {
          saldoAutomatico = saldosAutomaticos.gastos;
        }
      }
    }

    return saldoAsiento + saldoAutomatico;
  };
  
  // Filtrar cuentas de ingresos
  const cuentasIngresos = cuentasFlat.filter(cuenta => 
    cuenta.codigo.startsWith("4") && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  // Filtrar cuentas de costos (5001-5099)
  const cuentasCostos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return codigo >= 5001 && codigo <= 5099 && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  // Filtrar cuentas de gastos (5100-5999)
  const cuentasGastos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return codigo >= 5100 && cuenta.estado_financiero === "Estado de Resultados";
  });

  const calcularTotalIngresos = () => {
    return cuentasIngresos.reduce((total, cuenta) => {
      const saldo = obtenerSaldo(cuenta.codigo);
      return total + saldo;
    }, 0);
  };

  const calcularTotalCostos = () => {
    return cuentasCostos.reduce((total, cuenta) => {
      const saldo = obtenerSaldo(cuenta.codigo);
      return total + saldo;
    }, 0);
  };

  const calcularTotalGastos = () => {
    return cuentasGastos.reduce((total, cuenta) => {
      const saldo = obtenerSaldo(cuenta.codigo);
      return total + saldo;
    }, 0);
  };

  const totalIngresos = calcularTotalIngresos();
  const totalCostos = calcularTotalCostos();
  const totalGastos = calcularTotalGastos();
  const utilidadBruta = totalIngresos - totalCostos;
  const utilidadNeta = utilidadBruta - totalGastos;
  
  // Utilidad del ejercicio desde transacciones automáticas (debe coincidir con Balance General)
  const utilidadEjercicio = saldosAutomaticos?.utilidad || 0;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Estado de Resultados</h1>
        <p className="text-muted-foreground">Resumen de ingresos y gastos del período</p>
      </div>

      {/* Alerta informativa */}
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Este Estado de Resultados refleja automáticamente todas las transacciones registradas: ventas, 
          costos de ventas, gastos operativos y otros gastos.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {/* Ingresos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cuentasIngresos.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
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
                <div className="flex justify-between items-center font-bold text-green-600">
                  <span>Total Ingresos</span>
                  <span>${totalIngresos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Costos de Ventas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">Costos de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cuentasCostos.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
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
                <div className="flex justify-between items-center font-bold text-orange-600">
                  <span>Total Costos</span>
                  <span>${totalCostos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Utilidad Bruta */}
        <Card>
          <CardHeader>
            <CardTitle className={utilidadBruta >= 0 ? "text-blue-600" : "text-red-600"}>
              Utilidad Bruta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Ingresos</span>
                <span>${totalIngresos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>(-) Costos de Ventas</span>
                <span>(${totalCostos.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="border-t pt-2 mt-4">
                <div className={`flex justify-between items-center font-bold ${
                  utilidadBruta >= 0 ? "text-blue-600" : "text-red-600"
                }`}>
                  <span>Utilidad Bruta</span>
                  <span>${utilidadBruta.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gastos Operativos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Gastos Operativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cuentasGastos.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
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
                  <span>Total Gastos Operativos</span>
                  <span>${totalGastos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Utilidad Neta del Período */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className={utilidadEjercicio >= 0 ? "text-green-600" : "text-red-600"}>
              Resultado del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Ingresos Totales</span>
                <span>${totalIngresos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>(-) Costos de Ventas</span>
                <span>(${totalCostos.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="flex justify-between items-center font-medium">
                <span>Utilidad Bruta</span>
                <span>${utilidadBruta.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>(-) Gastos Operativos</span>
                <span>(${totalGastos.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="border-t-2 pt-3 mt-4">
                <div className={`flex justify-between items-center font-bold text-xl ${
                  utilidadEjercicio >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  <span>{utilidadEjercicio >= 0 ? "Utilidad Neta del Ejercicio" : "Pérdida Neta del Ejercicio"}</span>
                  <span>${utilidadEjercicio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              {saldosAutomaticos && (
                <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                  Transacciones: Ingresos ${saldosAutomaticos.ingresos.toLocaleString('es-CO', { minimumFractionDigits: 2 })} - 
                  Costos ${saldosAutomaticos.costos.toLocaleString('es-CO', { minimumFractionDigits: 2 })} - 
                  Gastos ${saldosAutomaticos.gastos.toLocaleString('es-CO', { minimumFractionDigits: 2 })} = 
                  ${saldosAutomaticos.utilidad.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EstadoResultados;