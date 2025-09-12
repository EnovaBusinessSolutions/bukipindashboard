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

const EstadoResultados = () => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();

  const { data: saldos, isLoading: saldosLoading } = useQuery({
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

      // Calcular saldos finales
      Object.values(saldosPorCuenta).forEach((cuenta) => {
        // Para cuentas de ingreso (4000-4999) y gastos (5000-5999)
        if (cuenta.cuenta_codigo.startsWith("4")) {
          cuenta.saldo = cuenta.haber_total - cuenta.debe_total; // Ingresos: Haber positivo
        } else if (cuenta.cuenta_codigo.startsWith("5")) {
          cuenta.saldo = cuenta.debe_total - cuenta.haber_total; // Gastos: Debe positivo
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
  
  // Filtrar cuentas de ingresos y gastos
  const cuentasIngresos = cuentasFlat.filter(cuenta => 
    cuenta.codigo.startsWith("4") && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasGastos = cuentasFlat.filter(cuenta => 
    cuenta.codigo.startsWith("5") && cuenta.estado_financiero === "Estado de Resultados"
  );

  const calcularTotalIngresos = () => {
    return cuentasIngresos.reduce((total, cuenta) => {
      const saldo = saldos?.[cuenta.codigo]?.saldo || 0;
      return total + saldo;
    }, 0);
  };

  const calcularTotalGastos = () => {
    return cuentasGastos.reduce((total, cuenta) => {
      const saldo = saldos?.[cuenta.codigo]?.saldo || 0;
      return total + saldo;
    }, 0);
  };

  const totalIngresos = calcularTotalIngresos();
  const totalGastos = calcularTotalGastos();
  const utilidadNeta = totalIngresos - totalGastos;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Estado de Resultados</h1>
        <p className="text-muted-foreground">Resumen de ingresos y gastos del período</p>
      </div>

      <div className="grid gap-6">
        {/* Ingresos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cuentasIngresos.map((cuenta) => {
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
                <div className="flex justify-between items-center font-bold text-green-600">
                  <span>Total Ingresos</span>
                  <span>${totalIngresos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gastos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cuentasGastos.map((cuenta) => {
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
                  <span>Total Gastos</span>
                  <span>${totalGastos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Utilidad Neta */}
        <Card>
          <CardHeader>
            <CardTitle className={utilidadNeta >= 0 ? "text-green-600" : "text-red-600"}>
              Resultado del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Total Ingresos</span>
                <span>${totalIngresos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Total Gastos</span>
                <span>(${totalGastos.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="border-t pt-2 mt-4">
                <div className={`flex justify-between items-center font-bold text-lg ${
                  utilidadNeta >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  <span>{utilidadNeta >= 0 ? "Utilidad Neta" : "Pérdida Neta"}</span>
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

export default EstadoResultados;