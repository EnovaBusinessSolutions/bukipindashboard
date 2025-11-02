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
      // PRIMERO: Verificar si existen asientos contables en TODO el sistema
      const { data: existenAsientos, count } = await supabase
        .from("asientos_contables")
        .select("*", { count: 'exact', head: true });

      // Si no hay ningún asiento contable, retornar estructura vacía
      if (!count || count === 0) {
        return {
          saldoInicial: { efectivo: 0, bancos: 0, total: 0 },
          operativo: { efectivo: 0, bancos: 0, total: 0 },
          inversion: { efectivo: 0, bancos: 0, total: 0 },
          financiamiento: { efectivo: 0, bancos: 0, total: 0 },
          flujoNeto: { efectivo: 0, bancos: 0, total: 0 },
          saldoFinal: { efectivo: 0, bancos: 0, total: 0 },
          sinDatos: true
        };
      }

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

      // ============= CLASIFICAR MOVIMIENTOS POR ACTIVIDAD =============
      
      // Obtener todos los movimientos de efectivo/bancos con sus asientos completos
      const { data: movimientosData } = await supabase
        .from("detalle_asientos")
        .select(`
          debe, haber, cuenta_codigo,
          asientos_contables!inner(id, fecha, detalle_asientos(cuenta_codigo, debe, haber))
        `)
        .in("cuenta_codigo", ["1001", "1002"])
        .gte("asientos_contables.fecha", startDate.toISOString().split('T')[0])
        .lte("asientos_contables.fecha", endDate.toISOString().split('T')[0]);

      let operativoEfectivo = 0;
      let operativoBancos = 0;
      let inversionEfectivo = 0;
      let inversionBancos = 0;
      let financiamientoEfectivo = 0;
      let financiamientoBancos = 0;

      const asientosProcesados = new Set();

      movimientosData?.forEach((det: any) => {
        const asientoId = det.asientos_contables?.id;
        if (asientosProcesados.has(asientoId)) return;
        asientosProcesados.add(asientoId);

        const detallesAsiento = det.asientos_contables?.detalle_asientos || [];
        
        // Calcular impacto en efectivo y bancos
        let impactoEfectivo = 0;
        let impactoBancos = 0;
        
        detallesAsiento.forEach((d: any) => {
          if (d.cuenta_codigo === "1001") {
            impactoEfectivo += (d.debe || 0) - (d.haber || 0);
          } else if (d.cuenta_codigo === "1002") {
            impactoBancos += (d.debe || 0) - (d.haber || 0);
          }
        });

        // Clasificar según las contrapartidas
        let esOperativo = false;
        let esInversion = false;
        let esFinanciamiento = false;

        detallesAsiento.forEach((d: any) => {
          const codigo = d.cuenta_codigo;
          if (codigo === "1001" || codigo === "1002") return;

          // OPERATIVO: 4XXX, 1003, 1004, 1005, 1006, 5XXX, 6XXX, 2001-2006, 1007, 1008
          if (codigo?.startsWith("4") || codigo?.startsWith("5") || codigo?.startsWith("6") ||
              ["1003", "1004", "1005", "1006", "2001", "2002", "2003", "2004", "2005", "2006", "1007", "1008"].includes(codigo)) {
            esOperativo = true;
          }
          // INVERSIÓN: 12XX, 13XX
          else if ((codigo?.startsWith("12") && parseInt(codigo) >= 1201) || codigo?.startsWith("13")) {
            esInversion = true;
          }
          // FINANCIAMIENTO: 20XX, 21XX, 3001, 3002, 3003
          else if (codigo?.startsWith("20") || codigo?.startsWith("21") || ["3001", "3002", "3003"].includes(codigo)) {
            esFinanciamiento = true;
          }
        });

        // Asignar a la categoría correspondiente
        if (esOperativo) {
          operativoEfectivo += impactoEfectivo;
          operativoBancos += impactoBancos;
        } else if (esInversion) {
          inversionEfectivo += impactoEfectivo;
          inversionBancos += impactoBancos;
        } else if (esFinanciamiento) {
          financiamientoEfectivo += impactoEfectivo;
          financiamientoBancos += impactoBancos;
        }
      });

      const operativo = { 
        efectivo: operativoEfectivo, 
        bancos: operativoBancos, 
        total: operativoEfectivo + operativoBancos 
      };
      const inversion = { 
        efectivo: inversionEfectivo, 
        bancos: inversionBancos, 
        total: inversionEfectivo + inversionBancos 
      };
      const financiamiento = { 
        efectivo: financiamientoEfectivo, 
        bancos: financiamientoBancos, 
        total: financiamientoEfectivo + financiamientoBancos 
      };

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

  // Verificar si hay datos - si sinDatos es true, no hay asientos contables en el sistema
  const hayDatos = flujoData && !flujoData.sinDatos;

  if (!hayDatos) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No hay movimientos de efectivo registrados en el período seleccionado. 
          Comienza registrando transacciones para ver el flujo de efectivo.
        </AlertDescription>
      </Alert>
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
