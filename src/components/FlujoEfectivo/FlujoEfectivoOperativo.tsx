import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";
import { apiFetch } from "@/lib/api";

interface FlujoEfectivoOperativoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  vistaColumnas: "consolidada" | "detallada";
}

type MoneySplit = { efectivo: number; bancos: number; total: number };
type Desglose = Record<string, MoneySplit>;

type ApiResponse = {
  saldoInicial: MoneySplit;
  operativo: MoneySplit & { desglose?: Desglose };
  inversion: MoneySplit & { desglose?: Desglose };
  financiamiento: MoneySplit & { desglose?: Desglose };
  saldoFinal?: MoneySplit;
  sinDatos?: boolean;
};

type AnyJson = any;

const apiJson = async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
  const res: AnyJson = await apiFetch(url, init);
  return (res?.data ?? res) as T;
};

// ✅ YYYY-MM-DD local (sin timezone issues)
function toYMDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeMoneySplit(v: any): MoneySplit {
  const efectivo = Number(v?.efectivo) || 0;
  const bancos = Number(v?.bancos) || 0;
  const total = Number(v?.total) || 0;
  return { efectivo, bancos, total };
}

const FlujoEfectivoOperativo = ({ startDate, endDate, vistaColumnas }: FlujoEfectivoOperativoProps) => {
  const startStr = toYMDLocal(startDate);
  const endStr = toYMDLocal(endDate);

  const { data: flujoData, isLoading, error } = useQuery({
    queryKey: ["flujo-efectivo-operativo", startStr, endStr, vistaColumnas],
    queryFn: async () => {
      const payload = await apiJson<ApiResponse>(
        `/api/flujo-efectivo/operativo?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`,
        { method: "GET" }
      );

      // Normalizar posible shape {ok:true,data:{...}}
      const root = (payload as any)?.data ? (payload as any)?.data : payload;

      const saldoInicial = safeMoneySplit(root?.saldoInicial);
      const operativo = { ...safeMoneySplit(root?.operativo), desglose: root?.operativo?.desglose ?? {} };
      const inversion = { ...safeMoneySplit(root?.inversion), desglose: root?.inversion?.desglose ?? {} };
      const financiamiento = { ...safeMoneySplit(root?.financiamiento), desglose: root?.financiamiento?.desglose ?? {} };

      // Si backend ya manda saldoFinal, lo usamos. Si no, lo calculamos.
      const flujoNetoE = operativo.efectivo + inversion.efectivo + financiamiento.efectivo;
      const flujoNetoB = operativo.bancos + inversion.bancos + financiamiento.bancos;
      const flujoNetoT = operativo.total + inversion.total + financiamiento.total;

      const saldoFinal = safeMoneySplit(
        root?.saldoFinal ?? {
          efectivo: saldoInicial.efectivo + flujoNetoE,
          bancos: saldoInicial.bancos + flujoNetoB,
          total: saldoInicial.total + flujoNetoT,
        }
      );

      const sinDatos = Boolean(root?.sinDatos);

      return { saldoInicial, operativo, inversion, financiamiento, saldoFinal, sinDatos };
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const errMsg = (error as any)?.message;
  if (errMsg) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{errMsg}</AlertDescription>
      </Alert>
    );
  }

  const hayDatos = flujoData && !flujoData.sinDatos;
  if (!hayDatos) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No hay movimientos de efectivo registrados en el período seleccionado. Comienza registrando transacciones para ver el flujo de efectivo.
        </AlertDescription>
      </Alert>
    );
  }

  const isDetallada = vistaColumnas === "detallada";

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

  const renderDesglose = (desglose?: Desglose) => {
    const entries = Object.entries(desglose || {});
    if (entries.length === 0) {
      return (
        <div className="text-sm text-muted-foreground text-center py-3">
          Desglose no disponible para este período (o el backend aún no lo envía).
        </div>
      );
    }

    entries.sort((a, b) => Math.abs((b[1]?.total || 0)) - Math.abs((a[1]?.total || 0)));

    return entries.map(([concepto, valores]) => (
      <div key={concepto} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${valores.total >= 0 ? "bg-finance-success" : "bg-destructive"}`} />
          <span className="font-medium">{concepto}</span>
        </div>
        {renderValue(valores.efectivo, valores.bancos, valores.total)}
      </div>
    ));
  };

  const saldoFinal = flujoData!.saldoFinal!;

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Flujo de Efectivo calculado desde los asientos contables (backend).</AlertDescription>
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
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(flujoData!.saldoInicial.efectivo)}</span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Bancos</div>
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(flujoData!.saldoInicial.bancos)}</span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total</div>
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(flujoData!.saldoInicial.total)}</span>
                </div>
              </div>
            ) : (
              <span className="text-2xl font-bold text-blue-600">{formatCurrency(flujoData!.saldoInicial.total)}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Operativas */}
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
            {renderDesglose(flujoData!.operativo.desglose)}
            <div className="border-t-2 pt-3 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">Flujo Neto Operativo</span>
                {renderValue(flujoData!.operativo.efectivo, flujoData!.operativo.bancos, flujoData!.operativo.total)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inversión */}
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
            {Object.keys(flujoData!.inversion.desglose || {}).length > 0 ? (
              renderDesglose(flujoData!.inversion.desglose)
            ) : (
              <p className="text-muted-foreground text-center py-4">No hay inversiones en este período</p>
            )}
            <div className="border-t-2 pt-3 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">Flujo Neto de Inversión</span>
                {renderValue(flujoData!.inversion.efectivo, flujoData!.inversion.bancos, flujoData!.inversion.total)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financiamiento */}
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
            {Object.keys(flujoData!.financiamiento.desglose || {}).length > 0 ? (
              renderDesglose(flujoData!.financiamiento.desglose)
            ) : (
              <p className="text-muted-foreground text-center py-4">No hay financiamientos en este período</p>
            )}
            <div className="border-t-2 pt-3 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">Flujo Neto de Financiamiento</span>
                {renderValue(
                  flujoData!.financiamiento.efectivo,
                  flujoData!.financiamiento.bancos,
                  flujoData!.financiamiento.total
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
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(saldoFinal.efectivo)}</span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Bancos</div>
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(saldoFinal.bancos)}</span>
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
