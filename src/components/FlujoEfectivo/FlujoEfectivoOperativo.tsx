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
      // PRIMERO: Verificar si existen asientos contables en TODO el sistema
      const { data: existenAsientos, count } = await supabase
        .from("asientos_contables")
        .select("*", { count: 'exact', head: true });

      // Si no hay ningún asiento contable, retornar estructura vacía
      if (!count || count === 0) {
        return {
          saldoInicial: { efectivo: 0, bancos: 0, total: 0 },
          operativo: {
            ingresos: 0,
            ingresosEfectivo: 0,
            ingresosBancos: 0,
            costos: 0,
            costosEfectivo: 0,
            costosBancos: 0,
            gastos: 0,
            gastosEfectivo: 0,
            gastosBancos: 0
          },
          inversion: {},
          inversionEfectivo: {},
          inversionBancos: {},
          financiamiento: {
            disposiciones: 0,
            amortizaciones: 0,
            amortizacionesEfectivo: 0,
            amortizacionesBancos: 0,
            intereses: 0,
            interesesEfectivo: 0,
            interesesBancos: 0
          },
          sinDatos: true
        };
      }

      // Calcular saldo inicial
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

      // Calcular movimiento neto en efectivo durante el período
      const { data: movimientosEfectivo } = await supabase
        .from("detalle_asientos")
        .select("debe, haber, asientos_contables!inner(fecha)")
        .eq("cuenta_codigo", "1001")
        .gte("asientos_contables.fecha", startDate.toISOString().split('T')[0])
        .lte("asientos_contables.fecha", endDate.toISOString().split('T')[0]);

      let flujoEfectivo = 0;
      movimientosEfectivo?.forEach(mov => {
        flujoEfectivo += (mov.debe || 0) - (mov.haber || 0);
      });

      // Calcular movimiento neto en bancos durante el período
      const { data: movimientosBancos } = await supabase
        .from("detalle_asientos")
        .select("debe, haber, asientos_contables!inner(fecha)")
        .eq("cuenta_codigo", "1002")
        .gte("asientos_contables.fecha", startDate.toISOString().split('T')[0])
        .lte("asientos_contables.fecha", endDate.toISOString().split('T')[0]);

      let flujoBancos = 0;
      movimientosBancos?.forEach(mov => {
        flujoBancos += (mov.debe || 0) - (mov.haber || 0);
      });

      // ============= CALCULAR ACTIVIDADES OPERATIVAS DETALLADAMENTE =============
      
      // 1. INGRESOS: Cobros por ventas (cuenta 4XXX genera DEBE en efectivo/bancos)
      const { data: ingresosData } = await supabase
        .from("detalle_asientos")
        .select(`
          debe, haber, cuenta_codigo,
          asientos_contables!inner(id, fecha, detalle_asientos(cuenta_codigo, debe, haber))
        `)
        .in("cuenta_codigo", ["1001", "1002"])
        .gte("asientos_contables.fecha", startDate.toISOString().split('T')[0])
        .lte("asientos_contables.fecha", endDate.toISOString().split('T')[0]);

      let ingresosEfectivo = 0;
      let ingresosBancos = 0;

      // Procesar ingresos: cuando 1001/1002 tiene DEBE y la contrapartida es 4XXX (ingreso)
      const asientosIngreso = new Set();
      ingresosData?.forEach((det: any) => {
        const debeEfectivo = det.cuenta_codigo === "1001" ? (det.debe || 0) : 0;
        const debeBancos = det.cuenta_codigo === "1002" ? (det.debe || 0) : 0;
        
        if (debeEfectivo > 0 || debeBancos > 0) {
          // Verificar si la contrapartida es ingreso (4XXX)
          const asientoId = det.asientos_contables?.id;
          if (asientoId && !asientosIngreso.has(asientoId)) {
            const detallesAsiento = det.asientos_contables?.detalle_asientos || [];
            const tieneIngreso = detallesAsiento.some((d: any) => d.cuenta_codigo?.startsWith("4") && (d.haber || 0) > 0);
            
            if (tieneIngreso) {
              ingresosEfectivo += debeEfectivo;
              ingresosBancos += debeBancos;
              asientosIngreso.add(asientoId);
            }
          }
        }
      });

      // 2. COSTOS: Compras de inventario (1005, 1006) y costo de ventas (5001)
      const { data: costosData } = await supabase
        .from("detalle_asientos")
        .select(`
          debe, haber, cuenta_codigo,
          asientos_contables!inner(id, fecha, detalle_asientos(cuenta_codigo, debe, haber))
        `)
        .in("cuenta_codigo", ["1001", "1002"])
        .gte("asientos_contables.fecha", startDate.toISOString().split('T')[0])
        .lte("asientos_contables.fecha", endDate.toISOString().split('T')[0]);

      let costosEfectivo = 0;
      let costosBancos = 0;

      // Procesar costos: cuando 1001/1002 tiene HABER y contrapartida es 1005, 1006, o 5001
      const asientosCosto = new Set();
      costosData?.forEach((det: any) => {
        const haberEfectivo = det.cuenta_codigo === "1001" ? (det.haber || 0) : 0;
        const haberBancos = det.cuenta_codigo === "1002" ? (det.haber || 0) : 0;
        
        if (haberEfectivo > 0 || haberBancos > 0) {
          const asientoId = det.asientos_contables?.id;
          if (asientoId && !asientosCosto.has(asientoId)) {
            const detallesAsiento = det.asientos_contables?.detalle_asientos || [];
            const tieneCosto = detallesAsiento.some((d: any) => 
              (["1005", "1006", "5001"].includes(d.cuenta_codigo) && (d.debe || 0) > 0)
            );
            
            if (tieneCosto) {
              costosEfectivo += haberEfectivo;
              costosBancos += haberBancos;
              asientosCosto.add(asientoId);
            }
          }
        }
      });

      // 3. GASTOS: Pagos por gastos operativos (51XX, 6XXX) y proveedores (2001-2006)
      const { data: gastosData } = await supabase
        .from("detalle_asientos")
        .select(`
          debe, haber, cuenta_codigo,
          asientos_contables!inner(id, fecha, detalle_asientos(cuenta_codigo, debe, haber))
        `)
        .in("cuenta_codigo", ["1001", "1002"])
        .gte("asientos_contables.fecha", startDate.toISOString().split('T')[0])
        .lte("asientos_contables.fecha", endDate.toISOString().split('T')[0]);

      let gastosEfectivo = 0;
      let gastosBancos = 0;

      // Procesar gastos: cuando 1001/1002 tiene HABER y contrapartida es gasto (51XX, 6XXX, 2001-2006)
      const asientosGasto = new Set();
      gastosData?.forEach((det: any) => {
        const haberEfectivo = det.cuenta_codigo === "1001" ? (det.haber || 0) : 0;
        const haberBancos = det.cuenta_codigo === "1002" ? (det.haber || 0) : 0;
        
        if (haberEfectivo > 0 || haberBancos > 0) {
          const asientoId = det.asientos_contables?.id;
          // Evitar duplicados con costos
          if (asientoId && !asientosGasto.has(asientoId) && !asientosCosto.has(asientoId)) {
            const detallesAsiento = det.asientos_contables?.detalle_asientos || [];
            const tieneGasto = detallesAsiento.some((d: any) => {
              const codigo = d.cuenta_codigo;
              return (
                (codigo?.startsWith("51") || codigo?.startsWith("6") || 
                 ["2001", "2002", "2003", "2004", "2005", "2006", "1007", "1008"].includes(codigo)) &&
                (d.debe || 0) > 0
              );
            });
            
            if (tieneGasto) {
              gastosEfectivo += haberEfectivo;
              gastosBancos += haberBancos;
              asientosGasto.add(asientoId);
            }
          }
        }
      });

      const operativo = {
        ingresos: ingresosEfectivo + ingresosBancos,
        ingresosEfectivo: ingresosEfectivo,
        ingresosBancos: ingresosBancos,
        costos: costosEfectivo + costosBancos,
        costosEfectivo: costosEfectivo,
        costosBancos: costosBancos,
        gastos: gastosEfectivo + gastosBancos,
        gastosEfectivo: gastosEfectivo,
        gastosBancos: gastosBancos
      };

      const inversion: any = {};
      const inversionEfectivo: any = {};
      const inversionBancos: any = {};

      const financiamiento = {
        disposiciones: 0,
        amortizaciones: 0,
        amortizacionesEfectivo: 0,
        amortizacionesBancos: 0,
        intereses: 0,
        interesesEfectivo: 0,
        interesesBancos: 0
      };

      return {
        saldoInicial,
        operativo,
        inversion,
        inversionEfectivo,
        inversionBancos,
        financiamiento
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

  const isDetallada = vistaColumnas === "detallada";

  const getOperativoData = () => {
    if (isDetallada) {
      return {
        efectivo: flujoData.operativo.ingresosEfectivo - flujoData.operativo.costosEfectivo - flujoData.operativo.gastosEfectivo,
        bancos: flujoData.operativo.ingresosBancos - flujoData.operativo.costosBancos - flujoData.operativo.gastosBancos,
        total: flujoData.operativo.ingresos - flujoData.operativo.costos - flujoData.operativo.gastos
      };
    }
    return {
      total: flujoData.operativo.ingresos - flujoData.operativo.costos - flujoData.operativo.gastos
    };
  };

  const getInversionData = () => {
    if (isDetallada) {
      const totalEfectivo = -Object.values(flujoData.inversionEfectivo).reduce((sum: number, val) => sum + (val as number), 0);
      const totalBancos = -Object.values(flujoData.inversionBancos).reduce((sum: number, val) => sum + (val as number), 0);
      return {
        efectivo: totalEfectivo,
        bancos: totalBancos,
        total: totalEfectivo + totalBancos
      };
    }
    return {
      total: -Object.values(flujoData.inversion).reduce((sum: number, val) => sum + (val as number), 0)
    };
  };

  const getFinanciamientoData = () => {
    if (isDetallada) {
      const disposicionesEfectivo = flujoData.financiamiento.disposiciones * 0.3;
      const disposicionesBancos = flujoData.financiamiento.disposiciones * 0.7;
      return {
        efectivo: disposicionesEfectivo - flujoData.financiamiento.amortizacionesEfectivo - flujoData.financiamiento.interesesEfectivo,
        bancos: disposicionesBancos - flujoData.financiamiento.amortizacionesBancos - flujoData.financiamiento.interesesBancos,
        total: flujoData.financiamiento.disposiciones - flujoData.financiamiento.amortizaciones - flujoData.financiamiento.intereses
      };
    }
    return {
      total: flujoData.financiamiento.disposiciones - flujoData.financiamiento.amortizaciones - flujoData.financiamiento.intereses
    };
  };

  const operativoData = getOperativoData();
  const inversionData = getInversionData();
  const financiamientoData = getFinanciamientoData();

  const flujoNetoTotal = (operativoData.total || 0) + (inversionData.total || 0) + (financiamientoData.total || 0);
  const saldoFinal = flujoData.saldoInicial.total + flujoNetoTotal;

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
          Flujo de Efectivo calculado desde los asientos contables (detalle_asientos).
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
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(flujoData.saldoInicial.efectivo)}</span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Bancos</div>
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(flujoData.saldoInicial.bancos)}</span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total</div>
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(flujoData.saldoInicial.total)}</span>
                </div>
              </div>
            ) : (
              <span className="text-2xl font-bold text-blue-600">{formatCurrency(flujoData.saldoInicial.total)}</span>
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
                flujoData.operativo.ingresosEfectivo,
                flujoData.operativo.ingresosBancos,
                flujoData.operativo.ingresos
              )}
            </div>

            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive"></div>
                <span className="font-medium">Pagos por Costos</span>
              </div>
              {isDetallada ? (
                <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo.costosEfectivo)}</span>
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo.costosBancos)}</span>
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo.costos)}</span>
                </div>
              ) : (
                <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo.costos)}</span>
              )}
            </div>

            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive"></div>
                <span className="font-medium">Pagos por Gastos</span>
              </div>
              {isDetallada ? (
                <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo.gastosEfectivo)}</span>
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo.gastosBancos)}</span>
                  <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo.gastos)}</span>
                </div>
              ) : (
                <span className="font-bold text-destructive">-{formatCurrency(flujoData.operativo.gastos)}</span>
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
            {Object.keys(flujoData.inversion).length > 0 ? (
              Object.entries(flujoData.inversion).map(([categoria, valor]) => (
                <div key={categoria} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium capitalize">{categoria.replace('_', ' ')}</span>
                  {isDetallada ? (
                    <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                      <span className="font-bold text-destructive">
                        -{formatCurrency(flujoData.inversionEfectivo[categoria] || 0)}
                      </span>
                      <span className="font-bold text-destructive">
                        -{formatCurrency(flujoData.inversionBancos[categoria] || 0)}
                      </span>
                      <span className="font-bold text-destructive">-{formatCurrency(valor as number)}</span>
                    </div>
                  ) : (
                    <span className="font-bold text-destructive">-{formatCurrency(valor as number)}</span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-4">No hay inversiones en este período</p>
            )}

            <div className="border-t-2 pt-3 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Flujo Neto de Inversión</span>
                {isDetallada ? (
                  <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                    <span className="text-lg font-bold text-destructive">
                      {formatCurrency(inversionData.efectivo || 0)}
                    </span>
                    <span className="text-lg font-bold text-destructive">
                      {formatCurrency(inversionData.bancos || 0)}
                    </span>
                    <span className="text-lg font-bold text-destructive">
                      {formatCurrency(inversionData.total)}
                    </span>
                  </div>
                ) : (
                  <span className="text-lg font-bold text-destructive">
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
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="font-medium">Disposiciones de Crédito</span>
              <span className="font-bold text-finance-success">
                {formatCurrency(flujoData.financiamiento.disposiciones)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="font-medium">Pagos de Capital</span>
              {isDetallada ? (
                <div className="grid grid-cols-3 gap-8 text-center min-w-[400px]">
                  <span className="font-bold text-destructive">
                    -{formatCurrency(flujoData.financiamiento.amortizacionesEfectivo)}
                  </span>
                  <span className="font-bold text-destructive">
                    -{formatCurrency(flujoData.financiamiento.amortizacionesBancos)}
                  </span>
                  <span className="font-bold text-destructive">
                    -{formatCurrency(flujoData.financiamiento.amortizaciones)}
                  </span>
                </div>
              ) : (
                <span className="font-bold text-destructive">
                  -{formatCurrency(flujoData.financiamiento.amortizaciones)}
                </span>
              )}
            </div>

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
                    {formatCurrency(flujoData.saldoInicial.efectivo + (operativoData.efectivo || 0) + (inversionData.efectivo || 0) + (financiamientoData.efectivo || 0))}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Bancos</div>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(flujoData.saldoInicial.bancos + (operativoData.bancos || 0) + (inversionData.bancos || 0) + (financiamientoData.bancos || 0))}
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
