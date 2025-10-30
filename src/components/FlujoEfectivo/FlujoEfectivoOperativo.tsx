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

      // Obtener todos los asientos del período
      const { data: asientos } = await supabase
        .from("asientos_contables")
        .select(`
          id,
          fecha,
          detalle_asientos(cuenta_codigo, debe, haber)
        `)
        .gte("fecha", startDate.toISOString().split('T')[0])
        .lte("fecha", endDate.toISOString().split('T')[0]);

      // Inicializar contadores
      const operativo = {
        ingresos: 0,
        ingresosEfectivo: 0,
        ingresosBancos: 0,
        costos: 0,
        costosEfectivo: 0,
        costosBancos: 0,
        gastos: 0,
        gastosEfectivo: 0,
        gastosBancos: 0
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

      // Procesar cada asiento
      asientos?.forEach((asiento: any) => {
        const detalles = asiento.detalle_asientos || [];
        
        let impactoEfectivo = 0;
        let impactoBancos = 0;
        let afectaEfectivo = false;
        let afectaBancos = false;

        // Calcular impacto en efectivo/bancos
        detalles.forEach((det: any) => {
          if (det.cuenta_codigo === "1001") {
            afectaEfectivo = true;
            impactoEfectivo += (det.debe || 0) - (det.haber || 0);
          } else if (det.cuenta_codigo === "1002") {
            afectaBancos = true;
            impactoBancos += (det.debe || 0) - (det.haber || 0);
          }
        });

        if (!afectaEfectivo && !afectaBancos) return;

        // Clasificar según contrapartidas
        detalles.forEach((det: any) => {
          const codigo = det.cuenta_codigo;
          if (codigo === "1001" || codigo === "1002") return;

          // Ingresos (4XXX)
          if (codigo.startsWith("4")) {
            const monto = Math.abs(impactoEfectivo + impactoBancos);
            operativo.ingresos += monto;
            if (afectaEfectivo) operativo.ingresosEfectivo += impactoEfectivo;
            if (afectaBancos) operativo.ingresosBancos += impactoBancos;
          }
          // Costos (5XXX)
          else if (codigo.startsWith("5")) {
            const monto = Math.abs(impactoEfectivo + impactoBancos);
            operativo.costos += monto;
            if (afectaEfectivo) operativo.costosEfectivo += Math.abs(impactoEfectivo);
            if (afectaBancos) operativo.costosBancos += Math.abs(impactoBancos);
          }
          // Gastos (6XXX)
          else if (codigo.startsWith("6")) {
            const monto = Math.abs(impactoEfectivo + impactoBancos);
            operativo.gastos += monto;
            if (afectaEfectivo) operativo.gastosEfectivo += Math.abs(impactoEfectivo);
            if (afectaBancos) operativo.gastosBancos += Math.abs(impactoBancos);
          }
          // Inversiones (1004, 15XX)
          else if (codigo === "1004" || codigo.startsWith("15")) {
            const categoria = codigo === "1004" ? "inversiones_capex" : "activos_fijos";
            const monto = Math.abs(impactoEfectivo + impactoBancos);
            inversion[categoria] = (inversion[categoria] || 0) + monto;
            if (afectaEfectivo) {
              inversionEfectivo[categoria] = (inversionEfectivo[categoria] || 0) + Math.abs(impactoEfectivo);
            }
            if (afectaBancos) {
              inversionBancos[categoria] = (inversionBancos[categoria] || 0) + Math.abs(impactoBancos);
            }
          }
          // Financiamiento
          else if (codigo.startsWith("20") || codigo.startsWith("21")) {
            // Disposiciones (aumento de pasivo = entrada de dinero)
            // Amortizaciones (disminución de pasivo = salida de dinero)
            if (impactoEfectivo + impactoBancos > 0) {
              financiamiento.disposiciones += impactoEfectivo + impactoBancos;
            } else {
              const monto = Math.abs(impactoEfectivo + impactoBancos);
              financiamiento.amortizaciones += monto;
              if (afectaEfectivo) financiamiento.amortizacionesEfectivo += Math.abs(impactoEfectivo);
              if (afectaBancos) financiamiento.amortizacionesBancos += Math.abs(impactoBancos);
            }
          }
          else if (codigo === "3001" || codigo === "3002") {
            // Capital: entrada o retiro
            if (impactoEfectivo + impactoBancos > 0) {
              financiamiento.disposiciones += impactoEfectivo + impactoBancos;
            }
          }
        });
      });

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
