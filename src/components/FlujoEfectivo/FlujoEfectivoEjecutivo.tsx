import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";

interface FlujoEfectivoEjecutivoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  vistaColumnas: "consolidada" | "detallada";
}

const FlujoEfectivoEjecutivo = ({ startDate, endDate, vistaColumnas }: FlujoEfectivoEjecutivoProps) => {
  const { data: flujoData, isLoading } = useQuery({
    queryKey: ["flujo-efectivo-ejecutivo", startDate, endDate, vistaColumnas],
    queryFn: async () => {
      // Calcular saldo inicial (antes del período)
      const { data: saldoInicialData } = await supabase
        .from("detalle_asientos")
        .select("cuenta_codigo, debe, haber, asientos_contables!inner(fecha)")
        .in("cuenta_codigo", ["1001", "1002"])
        .lt("asientos_contables.fecha", startDate.toISOString().split('T')[0]);

      const saldoInicial = {
        efectivo: 0,
        bancos: 0,
        total: 0
      };

      saldoInicialData?.forEach(detalle => {
        const saldo = (detalle.debe || 0) - (detalle.haber || 0);
        if (detalle.cuenta_codigo === "1001") {
          saldoInicial.efectivo += saldo;
        } else if (detalle.cuenta_codigo === "1002") {
          saldoInicial.bancos += saldo;
        }
      });
      saldoInicial.total = saldoInicial.efectivo + saldoInicial.bancos;

      // Obtener TODOS los movimientos del período desde detalle_asientos
      const { data: movimientos } = await supabase
        .from("detalle_asientos")
        .select(`
          cuenta_codigo,
          debe,
          haber,
          asientos_contables!inner(fecha)
        `)
        .gte("asientos_contables.fecha", startDate.toISOString().split('T')[0])
        .lte("asientos_contables.fecha", endDate.toISOString().split('T')[0]);

      // Inicializar contadores
      const operativo = { efectivo: 0, bancos: 0, total: 0 };
      const inversion = { efectivo: 0, bancos: 0, total: 0 };
      const financiamiento = { efectivo: 0, bancos: 0, total: 0 };

      // Procesar cada movimiento
      movimientos?.forEach(mov => {
        const cuentaCodigo = mov.cuenta_codigo;
        const debe = mov.debe || 0;
        const haber = mov.haber || 0;

        // Determinar si afecta efectivo o bancos y calcular el impacto
        let impactoEfectivo = 0;
        let impactoBancos = 0;

        if (cuentaCodigo === "1001") {
          // Movimiento en Caja: debe incrementa, haber disminuye
          impactoEfectivo = debe - haber;
        } else if (cuentaCodigo === "1002") {
          // Movimiento en Bancos: debe incrementa, haber disminuye
          impactoBancos = debe - haber;
        } else {
          // Para otras cuentas, necesitamos ver la contrapartida
          // Si la cuenta tiene DEBE, significa que salió efectivo/bancos (está en el HABER de 1001/1002)
          // Si la cuenta tiene HABER, significa que entró efectivo/bancos (está en el DEBE de 1001/1002)
          
          // Clasificar por tipo de actividad según el código de cuenta
          const esOperativo = cuentaCodigo.startsWith("4") || // Ingresos
                             cuentaCodigo.startsWith("5") || // Costos
                             cuentaCodigo.startsWith("6");   // Gastos
          
          const esInversion = cuentaCodigo === "1004"; // Inversiones CAPEX
          
          const esFinanciamiento = cuentaCodigo === "2002" || // Créditos bancarios
                                  cuentaCodigo === "2003" || // Créditos de proveedores
                                  cuentaCodigo === "2004" || // Tarjetas de crédito
                                  cuentaCodigo === "3001";   // Capital social

          // Determinar el impacto (positivo = entrada de efectivo, negativo = salida)
          // Si la cuenta tiene HABER, entra efectivo (cuenta aumenta su haber = entra dinero)
          // Si la cuenta tiene DEBE, sale efectivo (cuenta aumenta su debe = sale dinero)
          let impacto = 0;
          
          if (cuentaCodigo.startsWith("4")) {
            // Ingresos: HABER en ingreso = entrada de efectivo
            impacto = haber - debe;
          } else if (cuentaCodigo.startsWith("5") || cuentaCodigo.startsWith("6")) {
            // Costos y Gastos: DEBE en gasto = salida de efectivo
            impacto = -(debe - haber);
          } else if (cuentaCodigo === "1004") {
            // Inversiones: DEBE en inversión = salida de efectivo
            impacto = -(debe - haber);
          } else if (cuentaCodigo === "2002" || cuentaCodigo === "2003" || cuentaCodigo === "2004") {
            // Créditos: HABER en pasivo = entrada de efectivo, DEBE = salida (pago)
            impacto = haber - debe;
          } else if (cuentaCodigo === "3001") {
            // Capital: HABER en capital = entrada de efectivo (aportación), DEBE = salida (retiro)
            impacto = haber - debe;
          }

          // Para simplificar, asumimos que todo va a bancos excepto que sea efectivo explícito
          // (Podríamos mejorar esto leyendo el método de pago de la transacción original)
          impactoBancos = impacto;

          // Asignar a la categoría correspondiente
          if (esOperativo) {
            operativo.bancos += impactoBancos;
          } else if (esInversion) {
            inversion.bancos += impactoBancos;
          } else if (esFinanciamiento) {
            financiamiento.bancos += impactoBancos;
          }
          
          return; // Saltar al siguiente movimiento
        }

        // Si llegamos aquí, es porque el movimiento es directamente en 1001 o 1002
        // No lo contamos dos veces - solo procesamos las contrapartidas arriba
      });

      // Calcular totales
      operativo.total = operativo.efectivo + operativo.bancos;
      inversion.total = inversion.efectivo + inversion.bancos;
      financiamiento.total = financiamiento.efectivo + financiamiento.bancos;

      const flujoNeto = {
        efectivo: operativo.efectivo + inversion.efectivo + financiamiento.efectivo,
        bancos: operativo.bancos + inversion.bancos + financiamiento.bancos,
        total: operativo.total + inversion.total + financiamiento.total
      };

      const saldoFinal = {
        efectivo: saldoInicial.efectivo + flujoNeto.efectivo,
        bancos: saldoInicial.bancos + flujoNeto.bancos,
        total: saldoInicial.total + flujoNeto.total
      };

      return {
        saldoInicial,
        operativo,
        inversion,
        financiamiento,
        flujoNeto,
        saldoFinal
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const mostrarDetalle = vistaColumnas === "detallada";

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Vista ejecutiva consolidada del flujo de efectivo por categorías principales.
        </AlertDescription>
      </Alert>

      {/* Saldo Inicial */}
      <Card className="bg-blue-50 dark:bg-blue-950">
        <CardHeader>
          <CardTitle className="text-blue-600">Saldo Inicial de Efectivo</CardTitle>
        </CardHeader>
        <CardContent>
          {mostrarDetalle ? (
            <div className="grid grid-cols-4 gap-4 font-bold text-lg">
              <span>Concepto</span>
              <span className="text-right">Efectivo</span>
              <span className="text-right">Bancos</span>
              <span className="text-right">Total</span>
              <span>Saldo Inicial</span>
              <span className="text-right text-blue-600">
                ${flujoData?.saldoInicial.efectivo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-right text-blue-600">
                ${flujoData?.saldoInicial.bancos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-right text-blue-600">
                ${flujoData?.saldoInicial.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
              <span>Saldo Inicial</span>
              <span className="text-right text-blue-600">
                ${flujoData?.saldoInicial.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actividades Operativas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-green-600">Actividades Operativas</CardTitle>
        </CardHeader>
        <CardContent>
          {mostrarDetalle ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Efectivo</span>
                <span className="text-right">Bancos</span>
                <span className="text-right">Total</span>
              </div>
              <div className="grid grid-cols-4 gap-4 items-center">
                <span>Flujo Operativo</span>
                <span className={`font-medium text-right ${flujoData?.operativo.efectivo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {flujoData?.operativo.efectivo >= 0 ? '$' : '-$'}{Math.abs(flujoData?.operativo.efectivo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <span className={`font-medium text-right ${flujoData?.operativo.bancos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {flujoData?.operativo.bancos >= 0 ? '$' : '-$'}{Math.abs(flujoData?.operativo.bancos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <span className={`font-bold text-right ${flujoData?.operativo.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {flujoData?.operativo.total >= 0 ? '$' : '-$'}{Math.abs(flujoData?.operativo.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
              <span>Efectivo Neto de Operación</span>
              <span className={`text-right ${(flujoData?.operativo.total || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${flujoData?.operativo.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actividades de Inversión */}
      <Card>
        <CardHeader>
          <CardTitle className="text-blue-600">Actividades de Inversión</CardTitle>
        </CardHeader>
        <CardContent>
          {mostrarDetalle ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Efectivo</span>
                <span className="text-right">Bancos</span>
                <span className="text-right">Total</span>
              </div>
              <div className="grid grid-cols-4 gap-4 items-center">
                <span>Flujo de Inversión</span>
                <span className={`font-medium text-right ${flujoData?.inversion.efectivo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {flujoData?.inversion.efectivo >= 0 ? '$' : '-$'}{Math.abs(flujoData?.inversion.efectivo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <span className={`font-medium text-right ${flujoData?.inversion.bancos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {flujoData?.inversion.bancos >= 0 ? '$' : '-$'}{Math.abs(flujoData?.inversion.bancos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <span className={`font-bold text-right ${flujoData?.inversion.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {flujoData?.inversion.total >= 0 ? '$' : '-$'}{Math.abs(flujoData?.inversion.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
              <span>Efectivo Neto de Inversión</span>
              <span className={`text-right ${(flujoData?.inversion.total || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${flujoData?.inversion.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actividades de Financiamiento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-purple-600">Actividades de Financiamiento</CardTitle>
        </CardHeader>
        <CardContent>
          {mostrarDetalle ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Efectivo</span>
                <span className="text-right">Bancos</span>
                <span className="text-right">Total</span>
              </div>
              <div className="grid grid-cols-4 gap-4 items-center">
                <span>Flujo Financiamiento</span>
                <span className={`font-medium text-right ${flujoData?.financiamiento.efectivo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {flujoData?.financiamiento.efectivo >= 0 ? '$' : '-$'}{Math.abs(flujoData?.financiamiento.efectivo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <span className={`font-medium text-right ${flujoData?.financiamiento.bancos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {flujoData?.financiamiento.bancos >= 0 ? '$' : '-$'}{Math.abs(flujoData?.financiamiento.bancos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <span className={`font-bold text-right ${flujoData?.financiamiento.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {flujoData?.financiamiento.total >= 0 ? '$' : '-$'}{Math.abs(flujoData?.financiamiento.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
              <span>Efectivo Neto de Financiamiento</span>
              <span className={`text-right ${(flujoData?.financiamiento.total || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${flujoData?.financiamiento.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flujo Neto */}
      <Card className="bg-purple-50 dark:bg-purple-950">
        <CardHeader>
          <CardTitle className="text-purple-600">Aumento/Disminución Neto en Efectivo</CardTitle>
        </CardHeader>
        <CardContent>
          {mostrarDetalle ? (
            <div className="grid grid-cols-4 gap-4 font-bold text-lg">
              <span>Concepto</span>
              <span className="text-right">Efectivo</span>
              <span className="text-right">Bancos</span>
              <span className="text-right">Total</span>
              <span>Flujo Neto</span>
              <span className={`text-right ${flujoData?.flujoNeto.efectivo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {flujoData?.flujoNeto.efectivo >= 0 ? '$' : '-$'}{Math.abs(flujoData?.flujoNeto.efectivo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
              <span className={`text-right ${flujoData?.flujoNeto.bancos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {flujoData?.flujoNeto.bancos >= 0 ? '$' : '-$'}{Math.abs(flujoData?.flujoNeto.bancos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
              <span className={`text-right ${flujoData?.flujoNeto.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {flujoData?.flujoNeto.total >= 0 ? '$' : '-$'}{Math.abs(flujoData?.flujoNeto.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
              <span>Flujo Neto</span>
              <span className={`text-right ${flujoData?.flujoNeto.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${flujoData?.flujoNeto.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saldo Final */}
      <Card className="bg-green-50 dark:bg-green-950">
        <CardHeader>
          <CardTitle className="text-green-600">Saldo Final de Efectivo</CardTitle>
        </CardHeader>
        <CardContent>
          {mostrarDetalle ? (
            <div className="grid grid-cols-4 gap-4 font-bold text-xl">
              <span>Concepto</span>
              <span className="text-right">Efectivo</span>
              <span className="text-right">Bancos</span>
              <span className="text-right">Total</span>
              <span>Saldo Final</span>
              <span className="text-right text-green-600">
                ${flujoData?.saldoFinal.efectivo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-right text-green-600">
                ${flujoData?.saldoFinal.bancos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-right text-green-600">
                ${flujoData?.saldoFinal.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 items-center font-bold text-xl">
              <span>Saldo Final</span>
              <span className="text-right text-green-600">
                ${flujoData?.saldoFinal.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FlujoEfectivoEjecutivo;
