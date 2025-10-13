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

const EstadoResultadosOperativo = () => {
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
  
  // Filtrar cuentas de gastos operativos (5100-5108)
  const cuentasGastosOperativos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return codigo >= 5100 && codigo <= 5108 && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  // Filtrar cuentas de depreciaciones y amortizaciones (5109)
  const cuentasDepreciaciones = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return codigo === 5109 && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  // Filtrar cuentas de costo financiero (5110-5199)
  const cuentasCostoFinanciero = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return codigo >= 5110 && codigo <= 5199 && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  // Filtrar cuentas de impuestos (5200-5999)
  const cuentasImpuestos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return codigo >= 5200 && cuenta.estado_financiero === "Estado de Resultados";
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

  const calcularTotalGastosOperativos = () => {
    return cuentasGastosOperativos.reduce((total, cuenta) => {
      const saldo = obtenerSaldo(cuenta.codigo);
      return total + saldo;
    }, 0);
  };

  const calcularTotalDepreciaciones = () => {
    return cuentasDepreciaciones.reduce((total, cuenta) => {
      const saldo = obtenerSaldo(cuenta.codigo);
      return total + saldo;
    }, 0);
  };

  const calcularTotalCostoFinanciero = () => {
    return cuentasCostoFinanciero.reduce((total, cuenta) => {
      const saldo = obtenerSaldo(cuenta.codigo);
      return total + saldo;
    }, 0);
  };

  const calcularTotalImpuestos = () => {
    return cuentasImpuestos.reduce((total, cuenta) => {
      const saldo = obtenerSaldo(cuenta.codigo);
      return total + saldo;
    }, 0);
  };

  const totalIngresos = calcularTotalIngresos();
  const totalCostos = calcularTotalCostos();
  const totalGastosOperativos = calcularTotalGastosOperativos();
  const totalDepreciaciones = calcularTotalDepreciaciones();
  const totalCostoFinanciero = calcularTotalCostoFinanciero();
  const totalImpuestos = calcularTotalImpuestos();
  
  const utilidadBruta = totalIngresos - totalCostos;
  const ebitda = utilidadBruta - totalGastosOperativos;
  const ebit = ebitda - totalDepreciaciones;
  const utilidadAntesImpuestos = ebit - totalCostoFinanciero;
  const utilidadNeta = utilidadAntesImpuestos - totalImpuestos;
  
  // Utilidad del ejercicio desde transacciones automáticas (debe coincidir con Balance General)
  const utilidadEjercicio = saldosAutomaticos?.utilidad || 0;

  return (
    <div className="space-y-6">
      {/* Alerta informativa */}
      <Alert>
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
              {cuentasGastosOperativos.map((cuenta) => {
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
                  <span>${totalGastosOperativos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* EBITDA */}
        <Card>
          <CardHeader>
            <CardTitle className={ebitda >= 0 ? "text-blue-600" : "text-red-600"}>
              EBITDA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Utilidad Bruta</span>
                <span>${utilidadBruta.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>(-) Gastos Operativos</span>
                <span>(${totalGastosOperativos.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="border-t pt-2 mt-4">
                <div className={`flex justify-between items-center font-bold ${
                  ebitda >= 0 ? "text-blue-600" : "text-red-600"
                }`}>
                  <span>EBITDA</span>
                  <span>${ebitda.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Depreciaciones y Amortizaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="text-purple-600">Depreciaciones y Amortizaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cuentasDepreciaciones.map((cuenta) => {
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
              {cuentasDepreciaciones.length === 0 && (
                <div className="text-sm text-muted-foreground">No hay depreciaciones registradas</div>
              )}
              <div className="border-t pt-2 mt-4">
                <div className="flex justify-between items-center font-bold text-purple-600">
                  <span>Total Depreciaciones</span>
                  <span>${totalDepreciaciones.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* EBIT */}
        <Card>
          <CardHeader>
            <CardTitle className={ebit >= 0 ? "text-blue-600" : "text-red-600"}>
              EBIT (Utilidad Operativa)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>EBITDA</span>
                <span>${ebitda.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>(-) Depreciaciones</span>
                <span>(${totalDepreciaciones.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="border-t pt-2 mt-4">
                <div className={`flex justify-between items-center font-bold ${
                  ebit >= 0 ? "text-blue-600" : "text-red-600"
                }`}>
                  <span>EBIT</span>
                  <span>${ebit.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Costo Financiero */}
        <Card>
          <CardHeader>
            <CardTitle className="text-amber-600">Costo Financiero</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cuentasCostoFinanciero.map((cuenta) => {
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
              {cuentasCostoFinanciero.length === 0 && (
                <div className="text-sm text-muted-foreground">No hay costos financieros registrados</div>
              )}
              <div className="border-t pt-2 mt-4">
                <div className="flex justify-between items-center font-bold text-amber-600">
                  <span>Total Costo Financiero</span>
                  <span>${totalCostoFinanciero.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Utilidad Antes de Impuestos */}
        <Card>
          <CardHeader>
            <CardTitle className={utilidadAntesImpuestos >= 0 ? "text-blue-600" : "text-red-600"}>
              Utilidad Antes de Impuestos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>EBIT</span>
                <span>${ebit.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>(-) Costo Financiero</span>
                <span>(${totalCostoFinanciero.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="border-t pt-2 mt-4">
                <div className={`flex justify-between items-center font-bold ${
                  utilidadAntesImpuestos >= 0 ? "text-blue-600" : "text-red-600"
                }`}>
                  <span>Utilidad Antes de Impuestos</span>
                  <span>${utilidadAntesImpuestos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Impuestos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-rose-600">Impuestos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cuentasImpuestos.map((cuenta) => {
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
              {cuentasImpuestos.length === 0 && (
                <div className="text-sm text-muted-foreground">No hay impuestos registrados</div>
              )}
              <div className="border-t pt-2 mt-4">
                <div className="flex justify-between items-center font-bold text-rose-600">
                  <span>Total Impuestos</span>
                  <span>${totalImpuestos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Utilidad Neta del Período */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className={utilidadNeta >= 0 ? "text-green-600" : "text-red-600"}>
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
                <span>(${totalGastosOperativos.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="flex justify-between items-center font-medium">
                <span>EBITDA</span>
                <span>${ebitda.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>(-) Depreciaciones</span>
                <span>(${totalDepreciaciones.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="flex justify-between items-center font-medium">
                <span>EBIT</span>
                <span>${ebit.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>(-) Costo Financiero</span>
                <span>(${totalCostoFinanciero.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="flex justify-between items-center font-medium">
                <span>Utilidad Antes de Impuestos</span>
                <span>${utilidadAntesImpuestos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>(-) Impuestos</span>
                <span>(${totalImpuestos.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="border-t-2 pt-3 mt-4">
                <div className={`flex justify-between items-center font-bold text-xl ${
                  utilidadNeta >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  <span>{utilidadNeta >= 0 ? "Utilidad Neta del Ejercicio" : "Pérdida Neta del Ejercicio"}</span>
                  <span>${utilidadNeta.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EstadoResultadosOperativo;
