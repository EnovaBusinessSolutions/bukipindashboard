import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface ResumenFinancieroProps {
  startDate: Date;
  endDate: Date;
}

const ResumenFinanciero = ({ startDate, endDate }: ResumenFinancieroProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ["resumen-financiero", startDate, endDate],
    queryFn: async () => {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Obtener ventas (ingresos)
      const { data: ingresos } = await supabase
        .from("transacciones_ingresos")
        .select("monto_neto, monto_pagado")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const ventas = ingresos?.reduce((sum, i) => sum + (i.monto_neto || 0), 0) || 0;
      const cobrado = ingresos?.reduce((sum, i) => sum + (i.monto_pagado || 0), 0) || 0;

      // Obtener costos y gastos
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("tipo_egreso, monto_total, monto_pagado")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const costos = egresos?.filter(e => e.tipo_egreso === "costo" || e.tipo_egreso === "compra_inventario")
        .reduce((sum, e) => sum + (e.monto_total || 0), 0) || 0;
      
      const gastos = egresos?.filter(e => e.tipo_egreso === "gasto")
        .reduce((sum, e) => sum + (e.monto_total || 0), 0) || 0;

      const egresosTotal = egresos?.reduce((sum, e) => sum + (e.monto_pagado || 0), 0) || 0;

      // Obtener inversiones
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("monto_pagado")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const inversionesTotal = inversiones?.reduce((sum, i) => sum + (i.monto_pagado || 0), 0) || 0;

      // Obtener financiamientos
      const { data: financiamientos } = await supabase
        .from("financiamientos")
        .select("saldo_inicial")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const financiamientosRecibidos = financiamientos?.reduce((sum, f) => sum + (f.saldo_inicial || 0), 0) || 0;

      const { data: amortizaciones } = await supabase
        .from("transacciones_financiamientos")
        .select("capital_pagado, interes_pagado, metodo_pago")
        .in("tipo_transaccion", ["amortizacion", "cargo_interes"])
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const amortizacionesTotal = amortizaciones?.reduce((sum, a) => 
        sum + (a.capital_pagado || 0) + (a.interes_pagado || 0), 0) || 0;

      const utilidad = ventas - costos - gastos;
      const flujoNeto = cobrado - egresosTotal - inversionesTotal + financiamientosRecibidos - amortizacionesTotal;

      return {
        ventas,
        cobrado,
        costos,
        gastos,
        utilidad,
        inversiones: inversionesTotal,
        financiamientos: financiamientosRecibidos,
        amortizaciones: amortizacionesTotal,
        flujoNeto
      };
    }
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
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Ventas Totales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{formatCurrency(data?.ventas || 0)}</div>
          <p className="text-xs text-muted-foreground mt-1">Cobrado: {formatCurrency(data?.cobrado || 0)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Costos y Gastos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{formatCurrency((data?.costos || 0) + (data?.gastos || 0))}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Costos: {formatCurrency(data?.costos || 0)} | Gastos: {formatCurrency(data?.gastos || 0)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Utilidad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${(data?.utilidad || 0) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
            {formatCurrency(data?.utilidad || 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Ventas - Costos - Gastos</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Flujo Neto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${(data?.flujoNeto || 0) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
            {formatCurrency(data?.flujoNeto || 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Efectivo + Bancos</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumenFinanciero;
