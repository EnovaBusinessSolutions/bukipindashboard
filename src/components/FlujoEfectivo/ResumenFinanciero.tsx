import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, TrendingDown, DollarSign, CheckCircle2, AlertCircle } from "lucide-react";
import { useBalanceGeneral } from "@/hooks/useBalanceGeneral";

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

  // Query para saldos de Balanza de Comprobación
  const { data: balanzaData, isLoading: isLoadingBalanza } = useQuery({
    queryKey: ["saldos-balanza-check", endDate],
    queryFn: async () => {
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const { data } = await supabase
        .from("detalle_asientos")
        .select("cuenta_codigo, debe, haber, asientos_contables!inner(fecha)")
        .in("cuenta_codigo", ["1001", "1002"])
        .lte("asientos_contables.fecha", endDateStr);
      
      let efectivo = 0;
      let bancos = 0;
      
      data?.forEach(detalle => {
        const saldo = (detalle.debe || 0) - (detalle.haber || 0);
        if (detalle.cuenta_codigo === "1001") efectivo += saldo;
        if (detalle.cuenta_codigo === "1002") bancos += saldo;
      });
      
      return { efectivo, bancos, total: efectivo + bancos };
    }
  });

  // Query para saldos de Balance General
  const { data: balanceData, isLoading: isLoadingBalance } = useBalanceGeneral();

  // Calcular saldos y validación
  const saldoBalanza = balanzaData?.total || 0;
  const saldoBalance = (balanceData?.caja || 0) + (balanceData?.bancos || 0);
  const saldoFlujo = (data?.saldoFinalCaja || 0) + (data?.saldoFinalBancos || 0);

  // Validar que coincidan (con tolerancia de 0.01 por redondeos)
  const tolerancia = 0.01;
  const coinciden = 
    Math.abs(saldoBalanza - saldoBalance) < tolerancia &&
    Math.abs(saldoBalanza - saldoFlujo) < tolerancia &&
    Math.abs(saldoBalance - saldoFlujo) < tolerancia;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(value);
  };

  if (isLoading || isLoadingBalanza || isLoadingBalance) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {!coinciden && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Descuadre Contable Detectado</AlertTitle>
          <AlertDescription>
            <div className="space-y-1 text-xs mt-2">
              <div>Diferencia Balanza vs Balance: {formatCurrency(Math.abs(saldoBalanza - saldoBalance))}</div>
              <div>Diferencia Balanza vs Flujo: {formatCurrency(Math.abs(saldoBalanza - saldoFlujo))}</div>
              <div>Diferencia Balance vs Flujo: {formatCurrency(Math.abs(saldoBalance - saldoFlujo))}</div>
            </div>
            <p className="text-xs mt-2">
              Verifica que todos los asientos contables estén correctamente registrados y que no haya movimientos duplicados o faltantes.
            </p>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

      <Card className={coinciden ? "border-finance-success bg-finance-success/5" : "border-destructive bg-destructive/5"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {coinciden ? (
              <CheckCircle2 className="h-4 w-4 text-finance-success" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
            Validación Contable
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balanza:</span>
              <span className="font-medium">{formatCurrency(saldoBalanza)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance:</span>
              <span className="font-medium">{formatCurrency(saldoBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Flujo:</span>
              <span className="font-medium">{formatCurrency(saldoFlujo)}</span>
            </div>
          </div>
          <div className={`text-xs font-bold pt-2 border-t ${coinciden ? 'text-finance-success' : 'text-destructive'}`}>
            {coinciden ? '✅ Saldos Coinciden' : '❌ Descuadre Detectado'}
          </div>
        </CardContent>
      </Card>
      </div>
    </>
  );
};

export default ResumenFinanciero;
