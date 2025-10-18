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

const FlujoEfectivoOperativo = ({ startDate, endDate, vistaColumnas }: FlujoEfectivoOperativoProps) => {
  const { data: flujoData, isLoading } = useQuery({
    queryKey: ["flujo-efectivo-operativo", startDate, endDate, vistaColumnas],
    queryFn: async () => {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Calcular saldo inicial (antes del período)
      const { data: asientosIniciales } = await supabase
        .from("detalle_asientos")
        .select("cuenta_codigo, debe, haber, asientos_contables!inner(fecha)")
        .in("cuenta_codigo", ["1001", "1002"])
        .lt("asientos_contables.fecha", startDate.toISOString().split('T')[0]);

      let saldoInicialEfectivo = 0;
      let saldoInicialBancos = 0;

      asientosIniciales?.forEach((detalle: any) => {
        const saldo = (detalle.debe || 0) - (detalle.haber || 0);
        if (detalle.cuenta_codigo === "1001") {
          saldoInicialEfectivo += saldo;
        } else if (detalle.cuenta_codigo === "1002") {
          saldoInicialBancos += saldo;
        }
      });

      // Ingresos (Actividades Operativas)
      const { data: ingresos } = await supabase
        .from("transacciones_ingresos")
        .select("monto_pagado, tipo_ingreso, metodo_pago")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const totalIngresos = ingresos?.reduce((sum, i) => sum + (i.monto_pagado || 0), 0) || 0;
      const ingresosEfectivo = ingresos?.filter(i => i.metodo_pago === "efectivo").reduce((sum, i) => sum + (i.monto_pagado || 0), 0) || 0;
      const ingresosBancos = ingresos?.filter(i => i.metodo_pago !== "efectivo" && i.monto_pagado > 0).reduce((sum, i) => sum + (i.monto_pagado || 0), 0) || 0;

      // Egresos por tipo
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("monto_pagado, tipo_egreso, metodo_pago")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const costos = egresos?.filter(e => e.tipo_egreso === "costo" || e.tipo_egreso === "compra_inventario")
        .reduce((sum, e) => sum + (e.monto_pagado || 0), 0) || 0;
      const costosEfectivo = egresos?.filter(e => (e.tipo_egreso === "costo" || e.tipo_egreso === "compra_inventario") && e.metodo_pago === "efectivo")
        .reduce((sum, e) => sum + (e.monto_pagado || 0), 0) || 0;
      const costosBancos = egresos?.filter(e => (e.tipo_egreso === "costo" || e.tipo_egreso === "compra_inventario") && e.metodo_pago !== "efectivo" && e.monto_pagado > 0)
        .reduce((sum, e) => sum + (e.monto_pagado || 0), 0) || 0;
      
      const gastos = egresos?.filter(e => e.tipo_egreso === "gasto")
        .reduce((sum, e) => sum + (e.monto_pagado || 0), 0) || 0;
      const gastosEfectivo = egresos?.filter(e => e.tipo_egreso === "gasto" && e.metodo_pago === "efectivo")
        .reduce((sum, e) => sum + (e.monto_pagado || 0), 0) || 0;
      const gastosBancos = egresos?.filter(e => e.tipo_egreso === "gasto" && e.metodo_pago !== "efectivo" && e.monto_pagado > 0)
        .reduce((sum, e) => sum + (e.monto_pagado || 0), 0) || 0;

      // Inversiones por categoría
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("monto_pagado, categoria_activo, metodo_pago")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const inversionesPorCategoria = inversiones?.reduce((acc: any, inv) => {
        const categoria = inv.categoria_activo || "otros";
        acc[categoria] = (acc[categoria] || 0) + (inv.monto_pagado || 0);
        return acc;
      }, {}) || {};

      const inversionesPorCategoriaEfectivo = inversiones?.filter(i => i.metodo_pago === "efectivo").reduce((acc: any, inv) => {
        const categoria = inv.categoria_activo || "otros";
        acc[categoria] = (acc[categoria] || 0) + (inv.monto_pagado || 0);
        return acc;
      }, {}) || {};

      const inversionesPorCategoriaBancos = inversiones?.filter(i => i.metodo_pago !== "efectivo" && i.monto_pagado > 0).reduce((acc: any, inv) => {
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
        .select("capital_pagado, metodo_pago")
        .eq("tipo_transaccion", "amortizacion")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const totalAmortizaciones = amortizaciones?.reduce((sum, a) => sum + (a.capital_pagado || 0), 0) || 0;
      const amortizacionesEfectivo = amortizaciones?.filter(a => a.metodo_pago === "efectivo").reduce((sum, a) => sum + (a.capital_pagado || 0), 0) || 0;
      const amortizacionesBancos = amortizaciones?.filter(a => a.metodo_pago !== "efectivo" && a.capital_pagado > 0).reduce((sum, a) => sum + (a.capital_pagado || 0), 0) || 0;

      // Intereses
      const { data: intereses } = await supabase
        .from("transacciones_financiamientos")
        .select("interes_pagado, metodo_pago")
        .eq("tipo_transaccion", "cargo_interes")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      const totalIntereses = intereses?.reduce((sum, i) => sum + (i.interes_pagado || 0), 0) || 0;
      const interesesEfectivo = intereses?.filter(i => i.metodo_pago === "efectivo").reduce((sum, i) => sum + (i.interes_pagado || 0), 0) || 0;
      const interesesBancos = intereses?.filter(i => i.metodo_pago !== "efectivo" && i.interes_pagado > 0).reduce((sum, i) => sum + (i.interes_pagado || 0), 0) || 0;

      return {
        saldoInicial: {
          efectivo: saldoInicialEfectivo,
          bancos: saldoInicialBancos,
          total: saldoInicialEfectivo + saldoInicialBancos
        },
        operativo: {
          ingresos: totalIngresos,
          ingresosEfectivo,
          ingresosBancos,
          costos: costos,
          costosEfectivo,
          costosBancos,
          gastos: gastos,
          gastosEfectivo,
          gastosBancos
        },
        inversion: inversionesPorCategoria,
        inversionEfectivo: inversionesPorCategoriaEfectivo,
        inversionBancos: inversionesPorCategoriaBancos,
        financiamiento: {
          disposiciones: disposiciones,
          amortizaciones: totalAmortizaciones,
          amortizacionesEfectivo,
          amortizacionesBancos,
          intereses: totalIntereses,
          interesesEfectivo,
          interesesBancos
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

  if (isLoading || !flujoData) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isDetallada = vistaColumnas === "detallada";

  // Calcular totales según la vista
  const getOperativoData = () => {
    if (isDetallada) {
      const ingresosEfectivo = flujoData.operativo?.ingresosEfectivo || 0;
      const ingresosBancos = flujoData.operativo?.ingresosBancos || 0;
      const costosEfectivo = flujoData.operativo?.costosEfectivo || 0;
      const costosBancos = flujoData.operativo?.costosBancos || 0;
      const gastosEfectivo = flujoData.operativo?.gastosEfectivo || 0;
      const gastosBancos = flujoData.operativo?.gastosBancos || 0;
      
      return {
        efectivo: ingresosEfectivo - costosEfectivo - gastosEfectivo,
        bancos: ingresosBancos - costosBancos - gastosBancos,
        total: (flujoData.operativo?.ingresos || 0) - (flujoData.operativo?.costos || 0) - (flujoData.operativo?.gastos || 0)
      };
    }
    return {
      total: (flujoData.operativo?.ingresos || 0) - (flujoData.operativo?.costos || 0) - (flujoData.operativo?.gastos || 0)
    };
  };

  const getInversionData = () => {
    if (isDetallada) {
      const totalEfectivo = -Object.values(flujoData.inversionEfectivo || {}).reduce((sum: number, val) => sum + (val as number), 0);
      const totalBancos = -Object.values(flujoData.inversionBancos || {}).reduce((sum: number, val) => sum + (val as number), 0);
      return {
        efectivo: totalEfectivo,
        bancos: totalBancos,
        total: totalEfectivo + totalBancos
      };
    }
    return {
      total: -Object.values(flujoData.inversion || {}).reduce((sum: number, val) => sum + (val as number), 0)
    };
  };

  const getFinanciamientoData = () => {
    if (isDetallada) {
      const efectivo = (flujoData.financiamiento?.disposiciones || 0) * 0.5 - 
        (flujoData.financiamiento?.amortizacionesEfectivo || 0) - 
        (flujoData.financiamiento?.interesesEfectivo || 0);
      const bancos = (flujoData.financiamiento?.disposiciones || 0) * 0.5 - 
        (flujoData.financiamiento?.amortizacionesBancos || 0) - 
        (flujoData.financiamiento?.interesesBancos || 0);
      return {
        efectivo,
        bancos,
        total: efectivo + bancos
      };
    }
    return {
      total: (flujoData.financiamiento?.disposiciones || 0) - 
        (flujoData.financiamiento?.amortizaciones || 0) - 
        (flujoData.financiamiento?.intereses || 0)
    };
  };

  const operativoData = getOperativoData();
  const inversionData = getInversionData();
  const financiamientoData = getFinanciamientoData();

  const flujoNetoTotal = (operativoData.total || 0) + (inversionData.total || 0) + (financiamientoData.total || 0);
  const saldoFinal = (flujoData.saldoInicial?.total || 0) + flujoNetoTotal;

  const renderValue = (efectivo?: number, bancos?: number, total?: number) => {
    if (isDetallada && efectivo !== undefined && bancos !== undefined) {
      return (
        <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
          <span className="font-bold">{formatCurrency(efectivo)}</span>
          <span className="font-bold">{formatCurrency(bancos)}</span>
          <span className="font-bold">{formatCurrency(total || 0)}</span>
        </div>
      );
    }
    return <span className="font-bold">{formatCurrency(total || 0)}</span>;
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Este Flujo de Efectivo muestra todas las transacciones que afectan efectivo y bancos,
          clasificadas por tipo de actividad.
        </AlertDescription>
      </Alert>

      {/* Saldo Inicial */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-blue-500/5 border-2 border-blue-500/20">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold text-foreground">Saldo Inicial de Efectivo y Bancos</span>
            {isDetallada ? (
              <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Efectivo</div>
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(flujoData.saldoInicial?.efectivo || 0)}</span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Bancos</div>
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(flujoData.saldoInicial?.bancos || 0)}</span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total</div>
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(flujoData.saldoInicial?.total || 0)}</span>
                </div>
              </div>
            ) : (
              <span className="text-2xl font-bold text-blue-600">{formatCurrency(flujoData.saldoInicial?.total || 0)}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actividades Operativas */}
      <Card>
        <CardHeader className="bg-finance-success/10">
          <CardTitle className="text-finance-success flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Actividades Operativas
            </div>
            {isDetallada && (
              <div className="grid grid-cols-3 gap-8 text-sm font-normal text-center min-w-[400px]">
                <span>Efectivo</span>
                <span>Bancos</span>
                <span>Total</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-finance-success"></div>
                <span className="font-medium">Cobros por Ventas</span>
              </div>
              {renderValue(
                flujoData.operativo?.ingresosEfectivo,
                flujoData.operativo?.ingresosBancos,
                flujoData.operativo?.ingresos
              )}
            </div>

            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive"></div>
                <span className="font-medium">Pagos por Costos</span>
              </div>
              {isDetallada ? (
                <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo?.costosEfectivo || 0)}</span>
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo?.costosBancos || 0)}</span>
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo?.costos || 0)}</span>
                </div>
              ) : (
                <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo?.costos || 0)}</span>
              )}
            </div>

            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive"></div>
                <span className="font-medium">Pagos por Gastos</span>
              </div>
              {isDetallada ? (
                <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo?.gastosEfectivo || 0)}</span>
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo?.gastosBancos || 0)}</span>
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo?.gastos || 0)}</span>
                </div>
              ) : (
                <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo?.gastos || 0)}</span>
              )}
            </div>

            <div className="border-t-2 pt-3 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Flujo Neto Operativo</span>
                {isDetallada ? (
                  <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                    <span className={`text-lg font-bold ${(operativoData.efectivo || 0) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                      {formatCurrency(operativoData.efectivo || 0)}
                    </span>
                    <span className={`text-lg font-bold ${(operativoData.bancos || 0) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                      {formatCurrency(operativoData.bancos || 0)}
                    </span>
                    <span className={`text-lg font-bold ${operativoData.total >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                      {formatCurrency(operativoData.total)}
                    </span>
                  </div>
                ) : (
                  <span className={`text-lg font-bold ${operativoData.total >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                    {formatCurrency(operativoData.total)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actividades de Inversión */}
      <Card>
        <CardHeader className="bg-blue-500/10">
          <CardTitle className="text-blue-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Actividades de Inversión
            </div>
            {isDetallada && (
              <div className="grid grid-cols-3 gap-8 text-sm font-normal text-center min-w-[400px]">
                <span>Efectivo</span>
                <span>Bancos</span>
                <span>Total</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {Object.entries(flujoData.inversion || {}).length > 0 ? (
              <>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive"></div>
                    <span className="font-medium">Inversiones en Activos</span>
                  </div>
                  {isDetallada ? (
                    <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                      <span className="font-bold text-destructive">-{formatCurrency(Math.abs(inversionData.efectivo || 0))}</span>
                      <span className="font-bold text-destructive">-{formatCurrency(Math.abs(inversionData.bancos || 0))}</span>
                      <span className="font-bold text-destructive">-{formatCurrency(Math.abs(inversionData.total))}</span>
                    </div>
                  ) : (
                    <span className="font-bold text-destructive">-{formatCurrency(Math.abs(inversionData.total))}</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No hay inversiones en este período
              </div>
            )}
            <div className="border-t-2 pt-3 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Flujo Neto de Inversión</span>
                {isDetallada ? (
                  <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                    <span className={`text-lg font-bold ${(inversionData.efectivo || 0) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                      {formatCurrency(inversionData.efectivo || 0)}
                    </span>
                    <span className={`text-lg font-bold ${(inversionData.bancos || 0) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                      {formatCurrency(inversionData.bancos || 0)}
                    </span>
                    <span className={`text-lg font-bold ${inversionData.total >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                      {formatCurrency(inversionData.total)}
                    </span>
                  </div>
                ) : (
                  <span className={`text-lg font-bold ${inversionData.total >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                    {formatCurrency(inversionData.total)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actividades de Financiamiento */}
      <Card>
        <CardHeader className="bg-purple-500/10">
          <CardTitle className="text-purple-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Actividades de Financiamiento
            </div>
            {isDetallada && (
              <div className="grid grid-cols-3 gap-8 text-sm font-normal text-center min-w-[400px]">
                <span>Efectivo</span>
                <span>Bancos</span>
                <span>Total</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {flujoData.financiamiento?.disposiciones ? (
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-finance-success"></div>
                  <span className="font-medium">Disposiciones de Crédito</span>
                </div>
                {isDetallada ? (
                  <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                    <span className="font-bold text-finance-success">{formatCurrency(flujoData.financiamiento.disposiciones * 0.5)}</span>
                    <span className="font-bold text-finance-success">{formatCurrency(flujoData.financiamiento.disposiciones * 0.5)}</span>
                    <span className="font-bold text-finance-success">{formatCurrency(flujoData.financiamiento.disposiciones)}</span>
                  </div>
                ) : (
                  <span className="font-bold text-finance-success">{formatCurrency(flujoData.financiamiento.disposiciones)}</span>
                )}
              </div>
            ) : null}

            {flujoData.financiamiento?.amortizaciones ? (
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive"></div>
                  <span className="font-medium">Pago de Capital</span>
                </div>
                {isDetallada ? (
                  <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                    <span className="font-bold text-destructive">-{formatCurrency(flujoData.financiamiento.amortizacionesEfectivo || 0)}</span>
                    <span className="font-bold text-destructive">-{formatCurrency(flujoData.financiamiento.amortizacionesBancos || 0)}</span>
                    <span className="font-bold text-destructive">-{formatCurrency(flujoData.financiamiento.amortizaciones)}</span>
                  </div>
                ) : (
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.financiamiento.amortizaciones)}</span>
                )}
              </div>
            ) : null}

            {flujoData.financiamiento?.intereses ? (
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive"></div>
                  <span className="font-medium">Pago de Intereses</span>
                </div>
                {isDetallada ? (
                  <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                    <span className="font-bold text-destructive">-{formatCurrency(flujoData.financiamiento.interesesEfectivo || 0)}</span>
                    <span className="font-bold text-destructive">-{formatCurrency(flujoData.financiamiento.interesesBancos || 0)}</span>
                    <span className="font-bold text-destructive">-{formatCurrency(flujoData.financiamiento.intereses)}</span>
                  </div>
                ) : (
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.financiamiento.intereses)}</span>
                )}
              </div>
            ) : null}

            {!flujoData.financiamiento?.disposiciones && 
             !flujoData.financiamiento?.amortizaciones && 
             !flujoData.financiamiento?.intereses && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No hay movimientos en este período
              </div>
            )}

            <div className="border-t-2 pt-3 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Flujo Neto de Financiamiento</span>
                {isDetallada ? (
                  <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                    <span className={`text-lg font-bold ${(financiamientoData.efectivo || 0) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                      {formatCurrency(financiamientoData.efectivo || 0)}
                    </span>
                    <span className={`text-lg font-bold ${(financiamientoData.bancos || 0) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                      {formatCurrency(financiamientoData.bancos || 0)}
                    </span>
                    <span className={`text-lg font-bold ${financiamientoData.total >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                      {formatCurrency(financiamientoData.total)}
                    </span>
                  </div>
                ) : (
                  <span className={`text-lg font-bold ${financiamientoData.total >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                    {formatCurrency(financiamientoData.total)}
                  </span>
                )}
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
            {isDetallada ? (
              <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Efectivo</div>
                  <span className={`text-xl font-bold ${((operativoData.efectivo || 0) + (inversionData.efectivo || 0) + (financiamientoData.efectivo || 0)) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                    {formatCurrency((operativoData.efectivo || 0) + (inversionData.efectivo || 0) + (financiamientoData.efectivo || 0))}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Bancos</div>
                  <span className={`text-xl font-bold ${((operativoData.bancos || 0) + (inversionData.bancos || 0) + (financiamientoData.bancos || 0)) >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                    {formatCurrency((operativoData.bancos || 0) + (inversionData.bancos || 0) + (financiamientoData.bancos || 0))}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total</div>
                  <span className={`text-2xl font-bold ${flujoNetoTotal >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                    {formatCurrency(flujoNetoTotal)}
                  </span>
                </div>
              </div>
            ) : (
              <span className={`text-3xl font-bold ${flujoNetoTotal >= 0 ? 'text-finance-success' : 'text-destructive'}`}>
                {formatCurrency(flujoNetoTotal)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Saldo Final */}
      <Card className="bg-gradient-to-r from-green-500/10 to-green-500/5 border-2 border-green-500/20">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold text-foreground">Saldo Final de Efectivo y Bancos</span>
            {isDetallada ? (
              <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Efectivo</div>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency((flujoData.saldoInicial?.efectivo || 0) + (operativoData.efectivo || 0) + (inversionData.efectivo || 0) + (financiamientoData.efectivo || 0))}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Bancos</div>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency((flujoData.saldoInicial?.bancos || 0) + (operativoData.bancos || 0) + (inversionData.bancos || 0) + (financiamientoData.bancos || 0))}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total</div>
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(saldoFinal)}</span>
                </div>
              </div>
            ) : (
              <span className="text-2xl font-bold text-green-600">{formatCurrency(saldoFinal)}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FlujoEfectivoOperativo;
