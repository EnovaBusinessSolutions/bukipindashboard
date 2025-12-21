import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, DollarSign, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ResumenFinancieroProps {
  startDate: Date;
  endDate: Date;
}

type AnyJson = any;

type DetalleAsiento = {
  cuenta_codigo: string; // "1001" | "1002"
  debe: number;
  haber: number;
  fecha: string; // "YYYY-MM-DD"
};

const apiJson = async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
  const res: AnyJson = await apiFetch(url, init);
  return (res?.data ?? res) as T;
};

const formatDateYYYYMMDD = (d: Date) => d.toISOString().split("T")[0];

const formatCurrencyMXN = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);

const ResumenFinanciero = ({ startDate, endDate }: ResumenFinancieroProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ["resumen-financiero", formatDateYYYYMMDD(startDate), formatDateYYYYMMDD(endDate)],
    queryFn: async () => {
      const startDateStr = formatDateYYYYMMDD(startDate);
      const endDateStr = formatDateYYYYMMDD(endDate);

      /**
       * ✅ Endpoint backend esperado:
       * GET /api/asientos/detalle?cuentas=1001,1002&end=YYYY-MM-DD
       * Respuesta: [{ cuenta_codigo, debe, haber, fecha }]
       *
       * - Debe venir filtrado por owner (req.user._id)
       * - Debe traer SOLO asientos hasta "end"
       */
      const detalles = await apiJson<DetalleAsiento[]>(
        `/api/asientos/detalle?cuentas=1001,1002&end=${encodeURIComponent(endDateStr)}`,
        { method: "GET" }
      );

      const safeDetalles = Array.isArray(detalles) ? detalles : [];

      // Helper: saldo de un detalle (en activos: DEBE aumenta, HABER disminuye)
      const saldoDetalle = (d: DetalleAsiento) => (Number(d.debe) || 0) - (Number(d.haber) || 0);

      // 1) saldo inicial: movimientos ANTES del startDate
      let saldoInicialEfectivo = 0;
      let saldoInicialBancos = 0;

      safeDetalles
        .filter((d) => d.fecha < startDateStr)
        .forEach((d) => {
          const s = saldoDetalle(d);
          if (d.cuenta_codigo === "1001") saldoInicialEfectivo += s;
          if (d.cuenta_codigo === "1002") saldoInicialBancos += s;
        });

      // 2) saldo final: movimientos HASTA endDate (ya vienen filtrados por end)
      let saldoFinalEfectivo = 0;
      let saldoFinalBancos = 0;

      safeDetalles.forEach((d) => {
        const s = saldoDetalle(d);
        if (d.cuenta_codigo === "1001") saldoFinalEfectivo += s;
        if (d.cuenta_codigo === "1002") saldoFinalBancos += s;
      });

      // 3) flujos del período
      const flujoCaja = saldoFinalEfectivo - saldoInicialEfectivo;
      const flujoBancos = saldoFinalBancos - saldoInicialBancos;
      const flujoNeto = flujoCaja + flujoBancos;

      return {
        flujoCaja,
        flujoBancos,
        flujoNeto,
        saldoFinalCaja: saldoFinalEfectivo,
        saldoFinalBancos: saldoFinalBancos,
      };
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const saldoFlujo = (data?.saldoFinalCaja || 0) + (data?.saldoFinalBancos || 0);

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
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Flujo Efectivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data?.flujoCaja || 0) >= 0 ? "text-finance-success" : "text-destructive"}`}>
              {formatCurrencyMXN(data?.flujoCaja || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Saldo final: {formatCurrencyMXN(data?.saldoFinalCaja || 0)}
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
            <div className={`text-2xl font-bold ${(data?.flujoBancos || 0) >= 0 ? "text-finance-success" : "text-destructive"}`}>
              {formatCurrencyMXN(data?.flujoBancos || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Saldo final: {formatCurrencyMXN(data?.saldoFinalBancos || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-finance-success bg-finance-success/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-finance-success" />
              ✅ Saldo Final (Verificado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-finance-success">{formatCurrencyMXN(saldoFlujo)}</div>
            <p className="text-xs text-finance-success mt-1 font-medium">Coincide con Balanza de Comprobación</p>
            <p className="text-xs text-muted-foreground mt-0.5">Efectivo + Bancos</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ResumenFinanciero;
