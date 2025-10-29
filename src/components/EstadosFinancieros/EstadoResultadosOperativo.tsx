import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";

interface EstadoResultadosOperativoProps {
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

const EstadoResultadosOperativo = ({ startDate, endDate }: EstadoResultadosOperativoProps) => {
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

  // Función para obtener el saldo de una cuenta desde los asientos de balanza
  const obtenerSaldo = (codigoCuenta: string): number => {
    return saldosPorCuenta[codigoCuenta]?.saldo || 0;
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
  
  // Filtrar cuentas de gastos operativos (5100-5108, 5202, 5203)
  const cuentasGastosOperativos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return ((codigo >= 5100 && codigo <= 5108) || codigo === 5202 || codigo === 5203) && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  // Filtrar cuentas de depreciaciones y amortizaciones (5109, 5110)
  const cuentasDepreciaciones = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return (codigo === 5109 || codigo === 5110) && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  // Filtrar cuentas de costo financiero (5111-5199, 5201)
  const cuentasCostoFinanciero = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return ((codigo >= 5111 && codigo <= 5199) || codigo === 5201) && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  // Filtrar cuentas de impuestos (5200, 5204+)
  const cuentasImpuestos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return (codigo === 5200 || codigo >= 5204) && cuenta.estado_financiero === "Estado de Resultados";
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
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ventas</span>
              </div>
              {cuentasIngresos.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center">
                    <span className="text-sm">
                      {cuenta.codigo} - {cuenta.nombre}
                    </span>
                    <span className="font-medium text-right">
                      ${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-right">
                      {totalIngresos !== 0 ? `${((saldo / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}
                    </span>
                  </div>
                );
              })}
              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-green-600">
                  <span>Total Ingresos</span>
                  <span className="text-right">${totalIngresos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  <span className="text-right">100.00%</span>
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
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ventas</span>
              </div>
              {cuentasCostos.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center">
                    <span className="text-sm">
                      {cuenta.codigo} - {cuenta.nombre}
                    </span>
                    <span className="font-medium text-right">
                      ${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-right">
                      {totalIngresos !== 0 ? `${((saldo / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}
                    </span>
                  </div>
                );
              })}
              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-orange-600">
                  <span>Total Costos</span>
                  <span className="text-right">${totalCostos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  <span className="text-right">{totalIngresos !== 0 ? `${((totalCostos / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
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
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ventas</span>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <span>Ingresos</span>
                <span className="text-right">${totalIngresos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">100.00%</span>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <span>(-) Costos de Ventas</span>
                <span className="text-right">(${totalCostos.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
                <span className="text-right">{totalIngresos !== 0 ? `(${((totalCostos / totalIngresos) * 100).toFixed(2)}%)` : '0.00%'}</span>
              </div>
              <div className="border-t pt-2 mt-4">
                <div className={`grid grid-cols-3 gap-4 items-center font-bold ${
                  utilidadBruta >= 0 ? "text-blue-600" : "text-red-600"
                }`}>
                  <span>Utilidad Bruta</span>
                  <span className="text-right">${utilidadBruta.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  <span className="text-right">{totalIngresos !== 0 ? `${((utilidadBruta / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
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
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ventas</span>
              </div>
              {cuentasGastosOperativos.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center">
                    <span className="text-sm">
                      {cuenta.codigo} - {cuenta.nombre}
                    </span>
                    <span className="font-medium text-right">
                      ${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-right">
                      {totalIngresos !== 0 ? `${((saldo / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}
                    </span>
                  </div>
                );
              })}
              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-red-600">
                  <span>Total Gastos Operativos</span>
                  <span className="text-right">${totalGastosOperativos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  <span className="text-right">{totalIngresos !== 0 ? `${((totalGastosOperativos / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
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
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ventas</span>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <span>Utilidad Bruta</span>
                <span className="text-right">${utilidadBruta.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalIngresos !== 0 ? `${((utilidadBruta / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <span>(-) Gastos Operativos</span>
                <span className="text-right">(${totalGastosOperativos.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
                <span className="text-right">{totalIngresos !== 0 ? `(${((totalGastosOperativos / totalIngresos) * 100).toFixed(2)}%)` : '0.00%'}</span>
              </div>
              <div className="border-t pt-2 mt-4">
                <div className={`grid grid-cols-3 gap-4 items-center font-bold ${
                  ebitda >= 0 ? "text-blue-600" : "text-red-600"
                }`}>
                  <span>EBITDA</span>
                  <span className="text-right">${ebitda.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  <span className="text-right">{totalIngresos !== 0 ? `${((ebitda / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
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
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ventas</span>
              </div>
              {cuentasDepreciaciones.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center">
                    <span className="text-sm">
                      {cuenta.codigo} - {cuenta.nombre}
                    </span>
                    <span className="font-medium text-right">
                      ${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-right">
                      {totalIngresos !== 0 ? `${((saldo / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}
                    </span>
                  </div>
                );
              })}
              {cuentasDepreciaciones.length === 0 && (
                <div className="text-sm text-muted-foreground col-span-3">No hay depreciaciones registradas</div>
              )}
              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-purple-600">
                  <span>Total Depreciaciones</span>
                  <span className="text-right">${totalDepreciaciones.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  <span className="text-right">{totalIngresos !== 0 ? `${((totalDepreciaciones / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
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
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ventas</span>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <span>EBITDA</span>
                <span className="text-right">${ebitda.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalIngresos !== 0 ? `${((ebitda / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <span>(-) Depreciaciones</span>
                <span className="text-right">(${totalDepreciaciones.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
                <span className="text-right">{totalIngresos !== 0 ? `(${((totalDepreciaciones / totalIngresos) * 100).toFixed(2)}%)` : '0.00%'}</span>
              </div>
              <div className="border-t pt-2 mt-4">
                <div className={`grid grid-cols-3 gap-4 items-center font-bold ${
                  ebit >= 0 ? "text-blue-600" : "text-red-600"
                }`}>
                  <span>EBIT</span>
                  <span className="text-right">${ebit.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  <span className="text-right">{totalIngresos !== 0 ? `${((ebit / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
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
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ventas</span>
              </div>
              {cuentasCostoFinanciero.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center">
                    <span className="text-sm">
                      {cuenta.codigo} - {cuenta.nombre}
                    </span>
                    <span className="font-medium text-right">
                      ${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-right">
                      {totalIngresos !== 0 ? `${((saldo / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}
                    </span>
                  </div>
                );
              })}
              {cuentasCostoFinanciero.length === 0 && (
                <div className="text-sm text-muted-foreground col-span-3">No hay costos financieros registrados</div>
              )}
              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-amber-600">
                  <span>Total Costo Financiero</span>
                  <span className="text-right">${totalCostoFinanciero.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  <span className="text-right">{totalIngresos !== 0 ? `${((totalCostoFinanciero / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
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
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ventas</span>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <span>EBIT</span>
                <span className="text-right">${ebit.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalIngresos !== 0 ? `${((ebit / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <span>(-) Costo Financiero</span>
                <span className="text-right">(${totalCostoFinanciero.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
                <span className="text-right">{totalIngresos !== 0 ? `(${((totalCostoFinanciero / totalIngresos) * 100).toFixed(2)}%)` : '0.00%'}</span>
              </div>
              <div className="border-t pt-2 mt-4">
                <div className={`grid grid-cols-3 gap-4 items-center font-bold ${
                  utilidadAntesImpuestos >= 0 ? "text-blue-600" : "text-red-600"
                }`}>
                  <span>Utilidad Antes de Impuestos</span>
                  <span className="text-right">${utilidadAntesImpuestos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  <span className="text-right">{totalIngresos !== 0 ? `${((utilidadAntesImpuestos / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
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
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ventas</span>
              </div>
              {cuentasImpuestos.map((cuenta) => {
                const saldo = obtenerSaldo(cuenta.codigo);
                return (
                  <div key={cuenta.codigo} className="grid grid-cols-3 gap-4 items-center">
                    <span className="text-sm">
                      {cuenta.codigo} - {cuenta.nombre}
                    </span>
                    <span className="font-medium text-right">
                      ${saldo.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-right">
                      {totalIngresos !== 0 ? `${((saldo / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}
                    </span>
                  </div>
                );
              })}
              {cuentasImpuestos.length === 0 && (
                <div className="text-sm text-muted-foreground col-span-3">No hay impuestos registrados</div>
              )}
              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-rose-600">
                  <span>Total Impuestos</span>
                  <span className="text-right">${totalImpuestos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  <span className="text-right">{totalIngresos !== 0 ? `${((totalImpuestos / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Utilidad Neta del Período */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className={utilidadNeta >= 0 ? "text-green-600" : "text-red-600"}>
              Utilidad Neta del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ventas</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 items-center">
                <span>Utilidad Antes de Impuestos</span>
                <span className="text-right">${utilidadAntesImpuestos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <span className="text-right">{totalIngresos !== 0 ? `${((utilidadAntesImpuestos / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 items-center">
                <span>(-) Impuestos</span>
                <span className="text-right">(${totalImpuestos.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
                <span className="text-right">{totalIngresos !== 0 ? `(${((totalImpuestos / totalIngresos) * 100).toFixed(2)}%)` : '0.00%'}</span>
              </div>
              
              <div className="border-t-2 pt-3 mt-4">
                <div className={`grid grid-cols-3 gap-4 items-center font-bold text-xl ${
                  utilidadNeta >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  <span>{utilidadNeta >= 0 ? "Utilidad Neta" : "Pérdida Neta"}</span>
                  <span className="text-right">${utilidadNeta.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                  <span className="text-right">{totalIngresos !== 0 ? `${((utilidadNeta / totalIngresos) * 100).toFixed(2)}%` : '0.00%'}</span>
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
