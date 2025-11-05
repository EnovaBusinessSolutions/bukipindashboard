import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";
import { clasificarAsiento, agruparPorCategoria, calcularSaldoInicial } from "@/lib/flujoEfectivoUtils";

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
          operativo: { efectivo: 0, bancos: 0, total: 0, desglose: {} },
          inversion: { efectivo: 0, bancos: 0, total: 0, desglose: {} },
          financiamiento: { efectivo: 0, bancos: 0, total: 0, desglose: {} },
          sinDatos: true
        };
      }

      // Calcular saldo inicial usando función compartida
      const saldoInicial = await calcularSaldoInicial(supabase, startDate);

      // ============= CLASIFICAR TODOS LOS ASIENTOS DEL PERÍODO =============
      
      // Obtener todos los movimientos de efectivo/bancos con sus asientos completos
      const { data: movimientosData } = await supabase
        .from("detalle_asientos")
        .select(`
          debe, haber, cuenta_codigo,
          asientos_contables!inner(id, fecha, descripcion, detalle_asientos(cuenta_codigo, debe, haber))
        `)
        .in("cuenta_codigo", ["1001", "1002"])
        .gte("asientos_contables.fecha", startDate.toISOString().split('T')[0])
        .lte("asientos_contables.fecha", endDate.toISOString().split('T')[0]);

      const asientosProcesados = new Set();
      const clasificaciones = [];

      movimientosData?.forEach((det: any) => {
        const asientoId = det.asientos_contables?.id;
        if (asientosProcesados.has(asientoId)) return;
        asientosProcesados.add(asientoId);

        const detallesAsiento = det.asientos_contables?.detalle_asientos || [];
        const clasificacion = clasificarAsiento(detallesAsiento);
        
        if (clasificacion.categoria !== "Sin Clasificar") {
          clasificaciones.push(clasificacion);
        }
      });

      // Agrupar clasificaciones por categoría
      const { operativo, inversion, financiamiento } = agruparPorCategoria(clasificaciones);

      // Preparar desglose para OPERATIVO
      const desgloseOperativo: any = {};
      operativo.detalles.forEach(d => {
        if (!desgloseOperativo[d.subcategoria]) {
          desgloseOperativo[d.subcategoria] = { efectivo: 0, bancos: 0, total: 0 };
        }
        desgloseOperativo[d.subcategoria].efectivo += d.impactoEfectivo;
        desgloseOperativo[d.subcategoria].bancos += d.impactoBancos;
        desgloseOperativo[d.subcategoria].total += d.impactoTotal;
      });

      // Preparar desglose para INVERSIÓN
      const desgloseInversion: any = {};
      inversion.detalles.forEach(d => {
        if (!desgloseInversion[d.subcategoria]) {
          desgloseInversion[d.subcategoria] = { efectivo: 0, bancos: 0, total: 0 };
        }
        desgloseInversion[d.subcategoria].efectivo += d.impactoEfectivo;
        desgloseInversion[d.subcategoria].bancos += d.impactoBancos;
        desgloseInversion[d.subcategoria].total += d.impactoTotal;
      });

      // Preparar desglose para FINANCIAMIENTO
      const desgloseFinanciamiento: any = {};
      financiamiento.detalles.forEach(d => {
        if (!desgloseFinanciamiento[d.subcategoria]) {
          desgloseFinanciamiento[d.subcategoria] = { efectivo: 0, bancos: 0, total: 0 };
        }
        desgloseFinanciamiento[d.subcategoria].efectivo += d.impactoEfectivo;
        desgloseFinanciamiento[d.subcategoria].bancos += d.impactoBancos;
        desgloseFinanciamiento[d.subcategoria].total += d.impactoTotal;
      });

      return {
        saldoInicial,
        operativo: { ...operativo, desglose: desgloseOperativo },
        inversion: { ...inversion, desglose: desgloseInversion },
        financiamiento: { ...financiamiento, desglose: desgloseFinanciamiento }
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

  // Calcular flujo neto de cada categoría
  const flujoNetoEfectivo = flujoData.operativo.efectivo + flujoData.inversion.efectivo + flujoData.financiamiento.efectivo;
  const flujoNetoBancos = flujoData.operativo.bancos + flujoData.inversion.bancos + flujoData.financiamiento.bancos;
  const flujoNetoTotal = flujoData.operativo.total + flujoData.inversion.total + flujoData.financiamiento.total;

  const saldoFinal = {
    efectivo: flujoData.saldoInicial.efectivo + flujoNetoEfectivo,
    bancos: flujoData.saldoInicial.bancos + flujoNetoBancos,
    total: flujoData.saldoInicial.total + flujoNetoTotal
  };

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
            {/* Desglose de actividades operativas */}
            {Object.entries(flujoData.operativo.desglose).map(([concepto, valores]: [string, any]) => (
              <div key={concepto} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${valores.total >= 0 ? 'bg-finance-success' : 'bg-destructive'}`}></div>
                  <span className="font-medium">{concepto}</span>
                </div>
                {renderValue(valores.efectivo, valores.bancos, valores.total)}
              </div>
            ))}

            {/* Flujo Neto Operativo */}
            <div className="border-t-2 pt-3 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">Flujo Neto Operativo</span>
                {renderValue(flujoData.operativo.efectivo, flujoData.operativo.bancos, flujoData.operativo.total)}
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
            {Object.entries(flujoData.inversion.desglose).length > 0 ? (
              <>
                {Object.entries(flujoData.inversion.desglose).map(([concepto, valores]: [string, any]) => (
                  <div key={concepto} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${valores.total >= 0 ? 'bg-finance-success' : 'bg-destructive'}`}></div>
                      <span className="font-medium">{concepto}</span>
                    </div>
                    {renderValue(valores.efectivo, valores.bancos, valores.total)}
                  </div>
                ))}
              </>
            ) : (
              <p className="text-muted-foreground text-center py-4">No hay inversiones en este período</p>
            )}

            <div className="border-t-2 pt-3 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">Flujo Neto de Inversión</span>
                {renderValue(flujoData.inversion.efectivo, flujoData.inversion.bancos, flujoData.inversion.total)}
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
            {Object.entries(flujoData.financiamiento.desglose).length > 0 ? (
              <>
                {Object.entries(flujoData.financiamiento.desglose).map(([concepto, valores]: [string, any]) => (
                  <div key={concepto} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${valores.total >= 0 ? 'bg-finance-success' : 'bg-destructive'}`}></div>
                      <span className="font-medium">{concepto}</span>
                    </div>
                    {renderValue(valores.efectivo, valores.bancos, valores.total)}
                  </div>
                ))}
              </>
            ) : (
              <p className="text-muted-foreground text-center py-4">No hay financiamientos en este período</p>
            )}

            <div className="border-t-2 pt-3 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">Flujo Neto de Financiamiento</span>
                {renderValue(flujoData.financiamiento.efectivo, flujoData.financiamiento.bancos, flujoData.financiamiento.total)}
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
                    {formatCurrency(saldoFinal.efectivo)}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Bancos</div>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(saldoFinal.bancos)}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total</div>
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(saldoFinal.total)}</span>
                </div>
              </div>
            ) : (
              <span className="text-2xl font-bold text-green-600">{formatCurrency(saldoFinal.total)}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FlujoEfectivoOperativo;
