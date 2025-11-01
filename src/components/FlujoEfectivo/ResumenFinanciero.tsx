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
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // 1. Calcular saldo inicial de efectivo y bancos (antes del período)
      const { data: saldoInicialData } = await supabase
        .from("detalle_asientos")
        .select("cuenta_codigo, debe, haber, asientos_contables!inner(fecha)")
        .in("cuenta_codigo", ["1001", "1002"])
        .lt("asientos_contables.fecha", startDateStr);

      let saldoInicialEfectivo = 0;
      let saldoInicialBancos = 0;

      saldoInicialData?.forEach(detalle => {
        const saldo = (detalle.debe || 0) - (detalle.haber || 0);
        if (detalle.cuenta_codigo === '1001') {
          saldoInicialEfectivo += saldo;
        } else if (detalle.cuenta_codigo === '1002') {
          saldoInicialBancos += saldo;
        }
      });

      // 2. Calcular saldo final (hasta el final del período)
      const { data: saldoFinalData } = await supabase
        .from("detalle_asientos")
        .select("cuenta_codigo, debe, haber, asientos_contables!inner(fecha)")
        .in("cuenta_codigo", ["1001", "1002"])
        .lte("asientos_contables.fecha", endDateStr);

      let saldoFinalEfectivo = 0;
      let saldoFinalBancos = 0;

      saldoFinalData?.forEach(detalle => {
        const saldo = (detalle.debe || 0) - (detalle.haber || 0);
        if (detalle.cuenta_codigo === '1001') {
          saldoFinalEfectivo += saldo;
        } else if (detalle.cuenta_codigo === '1002') {
          saldoFinalBancos += saldo;
        }
      });

      // 3. Calcular flujos del período
      const flujoCaja = saldoFinalEfectivo - saldoInicialEfectivo;
      const flujoBancos = saldoFinalBancos - saldoInicialBancos;
      const flujoNeto = flujoCaja + flujoBancos;

      return {
        flujoCaja,
        flujoBancos,
        flujoNeto,
        saldoFinalCaja: saldoFinalEfectivo,
        saldoFinalBancos: saldoFinalBancos
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Flujo Efectivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${(data?.flujoCaja || 0) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
            {formatCurrency(data?.flujoCaja || 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Saldo final: {formatCurrency(data?.saldoFinalCaja || 0)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Flujo Bancos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${(data?.flujoBancos || 0) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
            {formatCurrency(data?.flujoBancos || 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Saldo final: {formatCurrency(data?.saldoFinalBancos || 0)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Flujo Neto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${(data?.flujoNeto || 0) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
            {formatCurrency(data?.flujoNeto || 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total: {formatCurrency((data?.saldoFinalCaja || 0) + (data?.saldoFinalBancos || 0))}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumenFinanciero;
