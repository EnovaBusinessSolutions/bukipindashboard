import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, DollarSign, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ResumenFinancieroProps {
  startDate: Date;
  endDate: Date;
}

type AnyJson = any;

type FlujoEfectivoApiResponse = {
  ok: boolean;
  data: {
    range: { start: string; end: string };
    efectivo: {
      saldoInicial: number;
      entradas: number;
      salidas: number;
      saldoFinal: number;
    };
    bancos: {
      saldoInicial: number;
      entradas: number;
      salidas: number;
      saldoFinal: number;
    };
    consolidado: {
      saldoFinal: number;
      verificado: boolean;
    };
    movimientos?: Array<{
      fecha: string | null;
      tipo: "efectivo" | "bancos";
      monto: number;
      memo?: string;
      asientoId?: string;
    }>;
  };
};

const apiJson = async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
  const res: AnyJson = await apiFetch(url, init);
  return (res?.data ?? res) as T;
};

// ✅ Evita toISOString() (timezone issues). Construye YYYY-MM-DD en hora local.
const toYMDLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatCurrencyMXN = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const ResumenFinanciero = ({ startDate, endDate }: ResumenFinancieroProps) => {
  const startYMD = toYMDLocal(startDate);
  const endYMD = toYMDLocal(endDate);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["flujo-efectivo-resumen", startYMD, endYMD],
    queryFn: async () => {
  const raw = await apiJson<any>(
    `/api/flujo-efectivo?start=${encodeURIComponent(startYMD)}&end=${encodeURIComponent(endYMD)}`,
    { method: "GET" }
  );

  // raw puede ser {ok:true,data:{...}} o directamente {...}
  const d = raw?.data ?? raw ?? {};

  // ✅ Preferimos el shape nuevo si existe
  const saldoFinalTotal =
    Number(d?.saldoFinal?.total) ||
    (Number(d?.efectivo?.saldoFinal) || 0) + (Number(d?.bancos?.saldoFinal) || 0);

  const saldoInicialCaja = Number(d?.saldoInicial?.efectivo ?? d?.efectivo?.saldoInicial ?? 0) || 0;
  const saldoInicialBancos = Number(d?.saldoInicial?.bancos ?? d?.bancos?.saldoInicial ?? 0) || 0;

  const saldoFinalCaja = Number(d?.saldoFinal?.efectivo ?? d?.efectivo?.saldoFinal ?? 0) || 0;
  const saldoFinalBancos = Number(d?.saldoFinal?.bancos ?? d?.bancos?.saldoFinal ?? 0) || 0;

  const flujoCaja = saldoFinalCaja - saldoInicialCaja;
  const flujoBancos = saldoFinalBancos - saldoInicialBancos;

  const verificado =
    typeof d?.consolidado?.verificado === "boolean"
      ? d.consolidado.verificado
      : true;

  return {
    flujoCaja,
    flujoBancos,
    flujoNeto: flujoCaja + flujoBancos,
    saldoFinalCaja,
    saldoFinalBancos,
    saldoFlujo: saldoFinalTotal,
    verificado,
  };
},
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-sm text-destructive font-medium">Error al cargar Flujo de Efectivo</div>
          <div className="text-xs text-muted-foreground mt-1">
            Revisa que exista el endpoint <code>/api/flujo-efectivo</code> y que la sesión esté activa (cookies).
          </div>
        </CardContent>
      </Card>
    );
  }

  const caja = data?.flujoCaja ?? 0;
  const bancos = data?.flujoBancos ?? 0;
  const saldoFinalCaja = data?.saldoFinalCaja ?? 0;
  const saldoFinalBancos = data?.saldoFinalBancos ?? 0;
  const saldoFinal = data?.saldoFlujo ?? 0;
  const verificado = data?.verificado ?? true;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Flujo Efectivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${caja >= 0 ? "text-finance-success" : "text-destructive"}`}>
            {formatCurrencyMXN(caja)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Saldo final: {formatCurrencyMXN(saldoFinalCaja)}</p>
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
          <div className={`text-2xl font-bold ${bancos >= 0 ? "text-finance-success" : "text-destructive"}`}>
            {formatCurrencyMXN(bancos)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Saldo final: {formatCurrencyMXN(saldoFinalBancos)}</p>
        </CardContent>
      </Card>

      <Card className={verificado ? "border-finance-success bg-finance-success/5" : "border-muted"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className={`h-4 w-4 ${verificado ? "text-finance-success" : "text-muted-foreground"}`} />
            {verificado ? "✅ Saldo Final (Verificado)" : "Saldo Final"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${verificado ? "text-finance-success" : "text-foreground"}`}>
            {formatCurrencyMXN(saldoFinal)}
          </div>
          {verificado ? (
            <>
              <p className="text-xs text-finance-success mt-1 font-medium">Coincide con Balanza de Comprobación</p>
              <p className="text-xs text-muted-foreground mt-0.5">Efectivo + Bancos</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Efectivo + Bancos</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumenFinanciero;
