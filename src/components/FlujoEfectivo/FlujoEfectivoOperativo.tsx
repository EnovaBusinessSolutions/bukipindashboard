import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";

interface FlujoEfectivoOperativoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  vistaColumnas: "consolidada" | "detallada";
}

const FlujoEfectivoOperativo = ({ startDate, endDate }: FlujoEfectivoOperativoProps) => {
  const { data: flujoData, isLoading } = useQuery({
    queryKey: ["flujo-efectivo-operativo", startDate, endDate],
    queryFn: async () => {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Ingresos (Actividades Operativas)
      const { data: ingresos } = await supabase
        .from("transacciones_ingresos")
        .select("monto_pagado, tipo_ingreso")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const totalIngresos = ingresos?.reduce((sum, i) => sum + (i.monto_pagado || 0), 0) || 0;

      // Egresos por tipo
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("monto_pagado, tipo_egreso")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const costos = egresos?.filter(e => e.tipo_egreso === "costo" || e.tipo_egreso === "compra_inventario")
        .reduce((sum, e) => sum + (e.monto_pagado || 0), 0) || 0;
      
      const gastos = egresos?.filter(e => e.tipo_egreso === "gasto")
        .reduce((sum, e) => sum + (e.monto_pagado || 0), 0) || 0;

      // Inversiones por categoría
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("monto_pagado, categoria_activo")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const inversionesPorCategoria = inversiones?.reduce((acc: any, inv) => {
        const categoria = inv.categoria_activo || "otros";
        acc[categoria] = (acc[categoria] || 0) + (inv.monto_pagado || 0);
        return acc;
      }, {}) || {};

      // Financiamientos - Disposiciones
      const { data: financiamientos } = await supabase
        .from("financiamientos")
        .select("saldo_inicial, tipo_credito")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const disposiciones = financiamientos?.reduce((sum, f) => sum + (f.saldo_inicial || 0), 0) || 0;

      // Amortizaciones
      const { data: amortizaciones } = await supabase
        .from("transacciones_financiamientos")
        .select("capital_pagado")
        .eq("tipo_transaccion", "amortizacion")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const totalAmortizaciones = amortizaciones?.reduce((sum, a) => sum + (a.capital_pagado || 0), 0) || 0;

      // Intereses
      const { data: intereses } = await supabase
        .from("transacciones_financiamientos")
        .select("interes_pagado")
        .eq("tipo_transaccion", "cargo_interes")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const totalIntereses = intereses?.reduce((sum, i) => sum + (i.interes_pagado || 0), 0) || 0;

      return {
        operativo: {
          ingresos: totalIngresos,
          costos: costos,
          gastos: gastos
        },
        inversion: inversionesPorCategoria,
        financiamiento: {
          disposiciones: disposiciones,
          amortizaciones: totalAmortizaciones,
          intereses: totalIntereses
        }
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const totalOperativo = (flujoData?.operativo.ingresos || 0) - (flujoData?.operativo.costos || 0) - (flujoData?.operativo.gastos || 0);
  const totalInversion = -Object.values(flujoData?.inversion || {}).reduce((sum: number, val) => sum + (val as number), 0);
  const totalFinanciamiento = (flujoData?.financiamiento.disposiciones || 0) - 
    (flujoData?.financiamiento.amortizaciones || 0) - (flujoData?.financiamiento.intereses || 0);
  const flujoNetoTotal = totalOperativo + totalInversion + totalFinanciamiento;

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Este Flujo de Efectivo muestra todas las transacciones que afectan efectivo y bancos,
          clasificadas por tipo de actividad.
        </AlertDescription>
      </Alert>

      {/* Actividades Operativas */}
      <Card>
        <CardHeader className="bg-finance-success/10">
          <CardTitle className="text-finance-success flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Actividades Operativas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-finance-success"></div>
                <span className="font-medium">Cobros por Ventas</span>
              </div>
              <span className="font-bold text-finance-success">
                {formatCurrency(flujoData?.operativo.ingresos || 0)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive"></div>
                <span className="font-medium">Pagos por Costos</span>
              </div>
              <span className="font-bold text-destructive">
                -{formatCurrency(flujoData?.operativo.costos || 0)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive"></div>
                <span className="font-medium">Pagos por Gastos</span>
              </div>
              <span className="font-bold text-destructive">
                -{formatCurrency(flujoData?.operativo.gastos || 0)}
              </span>
            </div>

            <div className="border-t-2 pt-3 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Flujo Neto Operativo</span>
                <span className={`text-lg font-bold ${totalOperativo >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                  {formatCurrency(totalOperativo)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actividades de Inversión */}
      <Card>
        <CardHeader className="bg-blue-500/10">
          <CardTitle className="text-blue-600 flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Actividades de Inversión
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {Object.entries(flujoData?.inversion || {}).length > 0 ? (
              Object.entries(flujoData?.inversion || {}).map(([categoria, monto]) => (
                <div key={categoria} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive"></div>
                    <span className="font-medium capitalize">
                      {categoria === "maquinaria" ? "Maquinaria y Equipo" :
                       categoria === "vehiculos" ? "Vehículos" :
                       categoria === "mobiliario" ? "Mobiliario" :
                       categoria === "equipo_computo" ? "Equipo de Cómputo" :
                       categoria === "otros" ? "Otros Activos" : categoria}
                    </span>
                  </div>
                  <span className="font-bold text-destructive">
                    -{formatCurrency(monto as number)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No hay inversiones en este período
              </div>
            )}
            <div className="border-t-2 pt-3 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Flujo Neto de Inversión</span>
                <span className={`text-lg font-bold ${totalInversion >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                  {formatCurrency(totalInversion)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actividades de Financiamiento */}
      <Card>
        <CardHeader className="bg-purple-500/10">
          <CardTitle className="text-purple-600 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Actividades de Financiamiento
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {flujoData?.financiamiento.disposiciones ? (
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-finance-success"></div>
                  <span className="font-medium">Disposiciones de Crédito</span>
                </div>
                <span className="font-bold text-finance-success">
                  {formatCurrency(flujoData.financiamiento.disposiciones)}
                </span>
              </div>
            ) : null}

            {flujoData?.financiamiento.amortizaciones ? (
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive"></div>
                  <span className="font-medium">Pago de Capital</span>
                </div>
                <span className="font-bold text-destructive">
                  -{formatCurrency(flujoData.financiamiento.amortizaciones)}
                </span>
              </div>
            ) : null}

            {flujoData?.financiamiento.intereses ? (
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive"></div>
                  <span className="font-medium">Pago de Intereses</span>
                </div>
                <span className="font-bold text-destructive">
                  -{formatCurrency(flujoData.financiamiento.intereses)}
                </span>
              </div>
            ) : null}

            {!flujoData?.financiamiento.disposiciones && 
             !flujoData?.financiamiento.amortizaciones && 
             !flujoData?.financiamiento.intereses && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No hay movimientos en este período
              </div>
            )}

            <div className="border-t-2 pt-3 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Flujo Neto de Financiamiento</span>
                <span className={`text-lg font-bold ${totalFinanciamiento >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                  {formatCurrency(totalFinanciamiento)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flujo Neto Total */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-foreground">Flujo Neto de Efectivo</span>
            <span className={`text-3xl font-bold ${flujoNetoTotal >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
              {formatCurrency(flujoNetoTotal)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FlujoEfectivoOperativo;
