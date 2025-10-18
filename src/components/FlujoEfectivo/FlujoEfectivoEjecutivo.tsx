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
}

const FlujoEfectivoEjecutivo = ({ startDate, endDate }: FlujoEfectivoEjecutivoProps) => {
  const { data: flujoData, isLoading } = useQuery({
    queryKey: ["flujo-efectivo-ejecutivo", startDate, endDate],
    queryFn: async () => {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Actividades Operativas
      const { data: ingresos } = await supabase
        .from("transacciones_ingresos")
        .select("monto_pagado")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("monto_pagado")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const totalIngresos = ingresos?.reduce((sum, i) => sum + (i.monto_pagado || 0), 0) || 0;
      const totalEgresos = egresos?.reduce((sum, e) => sum + (e.monto_pagado || 0), 0) || 0;
      const flujoOperativo = totalIngresos - totalEgresos;

      // Actividades de Inversión
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("monto_pagado")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const totalInversiones = inversiones?.reduce((sum, i) => sum + (i.monto_pagado || 0), 0) || 0;
      const flujoInversion = -totalInversiones;

      // Actividades de Financiamiento
      const { data: financiamientos } = await supabase
        .from("financiamientos")
        .select("saldo_inicial")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const { data: amortizaciones } = await supabase
        .from("transacciones_financiamientos")
        .select("capital_pagado, interes_pagado")
        .in("tipo_transaccion", ["amortizacion", "cargo_interes"])
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const totalDisposiciones = financiamientos?.reduce((sum, f) => sum + (f.saldo_inicial || 0), 0) || 0;
      const totalPagos = amortizaciones?.reduce((sum, a) => sum + (a.capital_pagado || 0) + (a.interes_pagado || 0), 0) || 0;
      const flujoFinanciamiento = totalDisposiciones - totalPagos;

      const flujoNetoTotal = flujoOperativo + flujoInversion + flujoFinanciamiento;

      return {
        operativo: {
          ingresos: totalIngresos,
          egresos: totalEgresos,
          neto: flujoOperativo
        },
        inversion: {
          inversiones: totalInversiones,
          neto: flujoInversion
        },
        financiamiento: {
          disposiciones: totalDisposiciones,
          pagos: totalPagos,
          neto: flujoFinanciamiento
        },
        flujoNetoTotal
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

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Vista ejecutiva consolidada del flujo de efectivo por categorías principales.
        </AlertDescription>
      </Alert>

      {/* Actividades Operativas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-green-600">Actividades Operativas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 items-center">
              <span>Cobros de clientes</span>
              <span className="font-medium text-right text-green-600">
                ${flujoData?.operativo.ingresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 items-center">
              <span>Pagos a proveedores y empleados</span>
              <span className="font-medium text-right text-red-600">
                (${flujoData?.operativo.egresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })})
              </span>
            </div>
            <div className="border-t pt-3 mt-3">
              <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
                <span>Efectivo Neto de Operación</span>
                <span className={`text-right ${(flujoData?.operativo.neto || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${flujoData?.operativo.neto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actividades de Inversión */}
      <Card>
        <CardHeader>
          <CardTitle className="text-blue-600">Actividades de Inversión</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 items-center">
              <span>Adquisición de activos fijos</span>
              <span className="font-medium text-right text-red-600">
                (${flujoData?.inversion.inversiones.toLocaleString('es-MX', { minimumFractionDigits: 2 })})
              </span>
            </div>
            <div className="border-t pt-3 mt-3">
              <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
                <span>Efectivo Neto de Inversión</span>
                <span className={`text-right ${(flujoData?.inversion.neto || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${flujoData?.inversion.neto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actividades de Financiamiento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-purple-600">Actividades de Financiamiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 items-center">
              <span>Obtención de préstamos</span>
              <span className="font-medium text-right text-green-600">
                ${flujoData?.financiamiento.disposiciones.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 items-center">
              <span>Pago de préstamos e intereses</span>
              <span className="font-medium text-right text-red-600">
                (${flujoData?.financiamiento.pagos.toLocaleString('es-MX', { minimumFractionDigits: 2 })})
              </span>
            </div>
            <div className="border-t pt-3 mt-3">
              <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
                <span>Efectivo Neto de Financiamiento</span>
                <span className={`text-right ${(flujoData?.financiamiento.neto || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${flujoData?.financiamiento.neto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flujo Neto Total */}
      <Card className="bg-primary/5">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 items-center">
            <span className="text-2xl font-bold">Aumento/Disminución Neto en Efectivo</span>
            <span className={`text-2xl font-bold text-right ${(flujoData?.flujoNetoTotal || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${flujoData?.flujoNetoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FlujoEfectivoEjecutivo;
