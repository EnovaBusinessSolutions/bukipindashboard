import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";

interface FlujoEfectivoOperativoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
}

interface Transaccion {
  tipo: string;
  descripcion: string;
  monto: number;
  fecha: string;
  categoria: 'operativo' | 'inversion' | 'financiamiento';
}

const FlujoEfectivoOperativo = ({ startDate, endDate }: FlujoEfectivoOperativoProps) => {
  const { data: flujoData, isLoading } = useQuery({
    queryKey: ["flujo-efectivo-operativo", startDate, endDate],
    queryFn: async () => {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();
      const transacciones: Transaccion[] = [];

      // Ingresos (Actividades Operativas)
      const { data: ingresos } = await supabase
        .from("transacciones_ingresos")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      ingresos?.forEach(ingreso => {
        if (ingreso.monto_pagado > 0) {
          transacciones.push({
            tipo: "Ingreso",
            descripcion: ingreso.descripcion,
            monto: ingreso.monto_pagado,
            fecha: ingreso.created_at,
            categoria: 'operativo'
          });
        }
      });

      // Egresos (Actividades Operativas)
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      egresos?.forEach(egreso => {
        if (egreso.monto_pagado > 0) {
          transacciones.push({
            tipo: "Egreso",
            descripcion: egreso.descripcion,
            monto: -egreso.monto_pagado,
            fecha: egreso.created_at,
            categoria: 'operativo'
          });
        }
      });

      // Inversiones (Actividades de Inversión)
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      inversiones?.forEach(inversion => {
        if (inversion.monto_pagado > 0) {
          transacciones.push({
            tipo: "Inversión",
            descripcion: inversion.producto_nombre,
            monto: -inversion.monto_pagado,
            fecha: inversion.created_at,
            categoria: 'inversion'
          });
        }
      });

      // Financiamientos - Disposiciones (Actividades de Financiamiento)
      const { data: financiamientos } = await supabase
        .from("financiamientos")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      financiamientos?.forEach(financiamiento => {
        if (financiamiento.saldo_inicial > 0) {
          transacciones.push({
            tipo: "Disposición Financiamiento",
            descripcion: financiamiento.nombre,
            monto: financiamiento.saldo_inicial,
            fecha: financiamiento.created_at,
            categoria: 'financiamiento'
          });
        }
      });

      // Financiamientos - Amortizaciones (Actividades de Financiamiento)
      const { data: amortizaciones } = await supabase
        .from("transacciones_financiamientos")
        .select("*, financiamientos(nombre)")
        .eq("tipo_transaccion", "amortizacion")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      amortizaciones?.forEach(amort => {
        transacciones.push({
          tipo: "Amortización",
          descripcion: (amort.financiamientos as any)?.nombre || amort.descripcion || "Amortización",
          monto: -(amort.capital_pagado || 0),
          fecha: amort.created_at,
          categoria: 'financiamiento'
        });
      });

      // Financiamientos - Intereses (Actividades de Financiamiento)
      const { data: intereses } = await supabase
        .from("transacciones_financiamientos")
        .select("*, financiamientos(nombre)")
        .eq("tipo_transaccion", "cargo_interes")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      intereses?.forEach(interes => {
        transacciones.push({
          tipo: "Interés Financiero",
          descripcion: (interes.financiamientos as any)?.nombre || interes.descripcion || "Interés",
          monto: -(interes.interes_pagado || 0),
          fecha: interes.created_at,
          categoria: 'financiamiento'
        });
      });

      return transacciones;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const transaccionesOperativas = flujoData?.filter(t => t.categoria === 'operativo') || [];
  const transaccionesInversion = flujoData?.filter(t => t.categoria === 'inversion') || [];
  const transaccionesFinanciamiento = flujoData?.filter(t => t.categoria === 'financiamiento') || [];

  const totalOperativo = transaccionesOperativas.reduce((sum, t) => sum + t.monto, 0);
  const totalInversion = transaccionesInversion.reduce((sum, t) => sum + t.monto, 0);
  const totalFinanciamiento = transaccionesFinanciamiento.reduce((sum, t) => sum + t.monto, 0);
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
        <CardHeader>
          <CardTitle className="text-green-600">Actividades Operativas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4 pb-2 border-b font-semibold text-sm">
              <span>Concepto</span>
              <span className="text-right">Monto</span>
            </div>
            {transaccionesOperativas.map((trans, index) => (
              <div key={index} className="grid grid-cols-2 gap-4 items-center">
                <span className="text-sm">{trans.descripcion}</span>
                <span className={`font-medium text-right ${trans.monto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${Math.abs(trans.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
            <div className="border-t pt-2 mt-4">
              <div className="grid grid-cols-2 gap-4 items-center font-bold">
                <span>Flujo Neto Operativo</span>
                <span className={`text-right ${totalOperativo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totalOperativo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
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
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4 pb-2 border-b font-semibold text-sm">
              <span>Concepto</span>
              <span className="text-right">Monto</span>
            </div>
            {transaccionesInversion.length > 0 ? (
              transaccionesInversion.map((trans, index) => (
                <div key={index} className="grid grid-cols-2 gap-4 items-center">
                  <span className="text-sm">{trans.descripcion}</span>
                  <span className={`font-medium text-right ${trans.monto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${Math.abs(trans.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No hay movimientos en este período
              </div>
            )}
            <div className="border-t pt-2 mt-4">
              <div className="grid grid-cols-2 gap-4 items-center font-bold">
                <span>Flujo Neto de Inversión</span>
                <span className={`text-right ${totalInversion >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totalInversion.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
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
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4 pb-2 border-b font-semibold text-sm">
              <span>Concepto</span>
              <span className="text-right">Monto</span>
            </div>
            {transaccionesFinanciamiento.length > 0 ? (
              transaccionesFinanciamiento.map((trans, index) => (
                <div key={index} className="grid grid-cols-2 gap-4 items-center">
                  <span className="text-sm">{trans.descripcion}</span>
                  <span className={`font-medium text-right ${trans.monto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${Math.abs(trans.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No hay movimientos en este período
              </div>
            )}
            <div className="border-t pt-2 mt-4">
              <div className="grid grid-cols-2 gap-4 items-center font-bold">
                <span>Flujo Neto de Financiamiento</span>
                <span className={`text-right ${totalFinanciamiento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totalFinanciamiento.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
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
            <span className="text-2xl font-bold">Flujo Neto de Efectivo</span>
            <span className={`text-2xl font-bold text-right ${flujoNetoTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${flujoNetoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FlujoEfectivoOperativo;
