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

      // Obtener TODOS los movimientos del período agrupados por asiento
      const { data: asientos } = await supabase
        .from("asientos_contables")
        .select(`
          id,
          fecha,
          detalle_asientos(cuenta_codigo, debe, haber)
        `)
        .gte("fecha", startDate.toISOString().split('T')[0])
        .lte("fecha", endDate.toISOString().split('T')[0]);

      // Inicializar contadores
      const operativo = { efectivo: 0, bancos: 0, total: 0 };
      const inversion = { efectivo: 0, bancos: 0, total: 0 };
      const financiamiento = { efectivo: 0, bancos: 0, total: 0 };

      // Procesar cada asiento
      asientos?.forEach((asiento: any) => {
        const detalles = asiento.detalle_asientos || [];
        
        // Verificar si el asiento afecta efectivo o bancos
        let afectaEfectivo = false;
        let afectaBancos = false;
        let impactoEfectivo = 0;
        let impactoBancos = 0;

        detalles.forEach((det: any) => {
          if (det.cuenta_codigo === "1001") {
            afectaEfectivo = true;
            impactoEfectivo += (det.debe || 0) - (det.haber || 0);
          } else if (det.cuenta_codigo === "1002") {
            afectaBancos = true;
            impactoBancos += (det.debe || 0) - (det.haber || 0);
          }
        });

        // Si no afecta efectivo ni bancos, saltar
        if (!afectaEfectivo && !afectaBancos) return;

        // Clasificar el asiento según las contrapartidas
        let categorizado = false;

        detalles.forEach((det: any) => {
          const codigo = det.cuenta_codigo;
          
          // Ignorar las cuentas de efectivo/bancos (ya las contamos)
          if (codigo === "1001" || codigo === "1002") return;

          // Clasificar según el código de cuenta
          if (codigo.startsWith("4") || codigo.startsWith("5") || codigo.startsWith("6")) {
            // Operativo
            operativo.efectivo += impactoEfectivo;
            operativo.bancos += impactoBancos;
            categorizado = true;
          } else if (codigo === "1004" || codigo.startsWith("15")) {
            // Inversión (1004 = Inversiones, 15XX = Activos Fijos)
            inversion.efectivo += impactoEfectivo;
            inversion.bancos += impactoBancos;
            categorizado = true;
          } else if (codigo.startsWith("20") || codigo.startsWith("21") || codigo === "3001" || codigo === "3002") {
            // Financiamiento (20XX-21XX = Pasivos, 3001 = Capital, 3002 = Utilidades Retenidas)
            financiamiento.efectivo += impactoEfectivo;
            financiamiento.bancos += impactoBancos;
            categorizado = true;
          }
        });

        // Si no se pudo categorizar, asumir operativo
        if (!categorizado && (afectaEfectivo || afectaBancos)) {
          operativo.efectivo += impactoEfectivo;
          operativo.bancos += impactoBancos;
        }
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
