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

      // OBTENER TODO DESDE ASIENTOS CONTABLES - ÚNICA FUENTE DE VERDAD
      const { data: detalles } = await supabase
        .from("detalle_asientos")
        .select("cuenta_codigo, debe, haber, asientos_contables!inner(fecha)")
        .gte("asientos_contables.fecha", startDateStr)
        .lte("asientos_contables.fecha", endDateStr);

      // Calcular totales por tipo de cuenta desde los asientos
      let ingresos = 0;
      let costos = 0;
      let gastos = 0;
      let efectivoFinal = 0;
      let bancosFinal = 0;

      detalles?.forEach(detalle => {
        const codigo = detalle.cuenta_codigo;
        const saldo = (detalle.debe || 0) - (detalle.haber || 0);
        
        // Ingresos (cuentas 4xxx) - naturaleza acreedora
        if (codigo.startsWith('4')) {
          ingresos += Math.abs(saldo);
        }
        // Costos (cuentas 5001-5099) - naturaleza deudora
        else if (codigo.startsWith('5') && parseInt(codigo) >= 5001 && parseInt(codigo) <= 5099) {
          costos += Math.abs(saldo);
        }
        // Gastos (cuentas 5100+) - naturaleza deudora
        else if (codigo.startsWith('5') && parseInt(codigo) >= 5100) {
          gastos += Math.abs(saldo);
        }
        // Efectivo (1001)
        else if (codigo === '1001') {
          efectivoFinal += saldo;
        }
        // Bancos (1002)
        else if (codigo === '1002') {
          bancosFinal += saldo;
        }
      });

      // Calcular saldo inicial de efectivo y bancos (antes del período)
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

      const utilidad = ingresos - costos - gastos;
      const flujoNeto = (efectivoFinal + bancosFinal) - (saldoInicialEfectivo + saldoInicialBancos);

      return {
        ventas: ingresos,
        cobrado: ingresos, // En el período todo lo registrado cuenta como cobrado
        costos,
        gastos,
        utilidad,
        inversiones: 0, // Ya no se calcula desde tablas separadas
        financiamientos: 0, // Ya no se calcula desde tablas separadas
        amortizaciones: 0, // Ya no se calcula desde tablas separadas
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
