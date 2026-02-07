import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api";

interface FlujoEfectivoEjecutivoProps {
  startDate: Date;
  endDate: Date;
  periodType: "diario" | "mensual" | "anual"; // no se usa aquí, pero dejamos compat
  vistaColumnas: "consolidada" | "detallada";
}

type MoneySplit = { efectivo: number; bancos: number; total: number };

type ApiResponseFull = {
  saldoInicial: MoneySplit;
  operativo: MoneySplit;
  inversion: MoneySplit;
  financiamiento: MoneySplit;
  flujoNeto: MoneySplit;
  saldoFinal: MoneySplit;
  sinDatos?: boolean;
};

type ApiResponseSimple = {
  // shape que ya tienes en backend/flujoEfectivo.js
  saldoInicial?: MoneySplit;
  movimientos?: MoneySplit;
  saldoFinal?: MoneySplit;

  efectivo?: { saldoInicial: number; entradas: number; salidas: number; saldoFinal: number };
  bancos?: { saldoInicial: number; entradas: number; salidas: number; saldoFinal: number };
  consolidado?: { saldoFinal: number; verificado?: boolean };

  sinDatos?: boolean;
};

type AnyResp = ApiResponseFull | ApiResponseSimple;

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ✅ Evita toISOString() (timezone). YYYY-MM-DD local
function toYMDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res: any = await apiFetch(url, { method: "GET" });
  return (res?.data ?? res) as T;
}

function normalizeToFull(d: AnyResp | null | undefined): ApiResponseFull {
  // Si ya viene completo (tiene operativo/inversion/etc.)
  const maybeFull = d as any;
  const hasFull =
    maybeFull &&
    typeof maybeFull === "object" &&
    maybeFull.saldoInicial &&
    maybeFull.saldoFinal &&
    maybeFull.operativo &&
    maybeFull.inversion &&
    maybeFull.financiamiento &&
    maybeFull.flujoNeto;

  if (hasFull) {
    // aseguramos numéricos
    const clean = (x: any): MoneySplit => ({
      efectivo: num(x?.efectivo),
      bancos: num(x?.bancos),
      total: num(x?.total),
    });
    return {
      saldoInicial: clean(maybeFull.saldoInicial),
      operativo: clean(maybeFull.operativo),
      inversion: clean(maybeFull.inversion),
      financiamiento: clean(maybeFull.financiamiento),
      flujoNeto: clean(maybeFull.flujoNeto),
      saldoFinal: clean(maybeFull.saldoFinal),
      sinDatos: !!maybeFull.sinDatos,
    };
  }

  // Si viene el shape simple del backend, construimos un "full" compatible:
  const s = (d ?? {}) as ApiResponseSimple;

  const saldoIniE = num(s?.saldoInicial?.efectivo ?? s?.efectivo?.saldoInicial);
  const saldoIniB = num(s?.saldoInicial?.bancos ?? s?.bancos?.saldoInicial);
  const saldoIniT = num(s?.saldoInicial?.total) || (saldoIniE + saldoIniB);

  const saldoFinE = num(s?.saldoFinal?.efectivo ?? s?.efectivo?.saldoFinal);
  const saldoFinB = num(s?.saldoFinal?.bancos ?? s?.bancos?.saldoFinal);
  const saldoFinT = num(s?.saldoFinal?.total) || (saldoFinE + saldoFinB);

  // flujo neto = saldo final - saldo inicial
  const flujoE = saldoFinE - saldoIniE;
  const flujoB = saldoFinB - saldoIniB;
  const flujoT = saldoFinT - saldoIniT;

  // Mientras backend no clasifique, dejamos categorías en 0
  const zero: MoneySplit = { efectivo: 0, bancos: 0, total: 0 };

  // Si quieres, de forma temporal puedes mapear TODO el flujo a "operativo":
  // const operativo: MoneySplit = { efectivo: flujoE, bancos: flujoB, total: flujoT };
  // y dejar inversion/financiamiento en 0.
  // Por ahora lo dejo en 0 para no inventar clasificación.
  const operativo = zero;
  const inversion = zero;
  const financiamiento = zero;

  return {
    saldoInicial: { efectivo: saldoIniE, bancos: saldoIniB, total: saldoIniT },
    operativo,
    inversion,
    financiamiento,
    flujoNeto: { efectivo: flujoE, bancos: flujoB, total: flujoT },
    saldoFinal: { efectivo: saldoFinE, bancos: saldoFinB, total: saldoFinT },
    sinDatos: !!s?.sinDatos,
  };
}

const FlujoEfectivoEjecutivo = ({ startDate, endDate, vistaColumnas }: FlujoEfectivoEjecutivoProps) => {
  const startStr = toYMDLocal(startDate);
  const endStr = toYMDLocal(endDate);

  const { data: flujoDataRaw, isLoading, error } = useQuery({
    queryKey: ["flujo-efectivo-ejecutivo", startStr, endStr, vistaColumnas],
    queryFn: async () => {
      const url =
        `/api/flujo-efectivo/ejecutivo?start=${encodeURIComponent(startStr)}` +
        `&end=${encodeURIComponent(endStr)}`;
      return fetchJSON<AnyResp>(url);
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

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

  const flujoData = normalizeToFull(flujoDataRaw);

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

  const mostrarDetalle = vistaColumnas === "detallada";

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Vista ejecutiva consolidada del flujo de efectivo por categorías principales.
        </AlertDescription>
      </Alert>

      {/* Saldo Inicial */}
      <Card className="bg-blue-50 dark:bg-blue-950">
        <CardHeader>
          <CardTitle className="text-blue-600">Saldo Inicial de Efectivo</CardTitle>
        </CardHeader>
        <CardContent>
          {mostrarDetalle ? (
            <div className="grid grid-cols-4 gap-4 font-bold text-lg">
              <span>Concepto</span>
              <span className="text-right">Efectivo</span>
              <span className="text-right">Bancos</span>
              <span className="text-right">Total</span>

              <span>Saldo Inicial</span>
              <span className="text-right text-blue-600">
                ${flujoData.saldoInicial.efectivo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-right text-blue-600">
                ${flujoData.saldoInicial.bancos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-right text-blue-600">
                ${flujoData.saldoInicial.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
              <span>Saldo Inicial</span>
              <span className="text-right text-blue-600">
                ${flujoData.saldoInicial.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operativo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-green-600">Actividades Operativas</CardTitle>
        </CardHeader>
        <CardContent>
          {mostrarDetalle ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Efectivo</span>
                <span className="text-right">Bancos</span>
                <span className="text-right">Total</span>
              </div>
              <div className="grid grid-cols-4 gap-4 items-center">
                <span>Flujo Operativo</span>
                <span className={`font-medium text-right ${flujoData.operativo.efectivo >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {flujoData.operativo.efectivo >= 0 ? "$" : "-$"}
                  {Math.abs(flujoData.operativo.efectivo).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
                <span className={`font-medium text-right ${flujoData.operativo.bancos >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {flujoData.operativo.bancos >= 0 ? "$" : "-$"}
                  {Math.abs(flujoData.operativo.bancos).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
                <span className={`font-bold text-right ${flujoData.operativo.total >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {flujoData.operativo.total >= 0 ? "$" : "-$"}
                  {Math.abs(flujoData.operativo.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
              <span>Efectivo Neto de Operación</span>
              <span className={`text-right ${flujoData.operativo.total >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${flujoData.operativo.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inversión */}
      <Card>
        <CardHeader>
          <CardTitle className="text-blue-600">Actividades de Inversión</CardTitle>
        </CardHeader>
        <CardContent>
          {mostrarDetalle ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Efectivo</span>
                <span className="text-right">Bancos</span>
                <span className="text-right">Total</span>
              </div>
              <div className="grid grid-cols-4 gap-4 items-center">
                <span>Flujo de Inversión</span>
                <span className={`font-medium text-right ${flujoData.inversion.efectivo >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {flujoData.inversion.efectivo >= 0 ? "$" : "-$"}
                  {Math.abs(flujoData.inversion.efectivo).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
                <span className={`font-medium text-right ${flujoData.inversion.bancos >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {flujoData.inversion.bancos >= 0 ? "$" : "-$"}
                  {Math.abs(flujoData.inversion.bancos).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
                <span className={`font-bold text-right ${flujoData.inversion.total >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {flujoData.inversion.total >= 0 ? "$" : "-$"}
                  {Math.abs(flujoData.inversion.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
              <span>Efectivo Neto de Inversión</span>
              <span className={`text-right ${flujoData.inversion.total >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${flujoData.inversion.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financiamiento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-purple-600">Actividades de Financiamiento</CardTitle>
        </CardHeader>
        <CardContent>
          {mostrarDetalle ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Efectivo</span>
                <span className="text-right">Bancos</span>
                <span className="text-right">Total</span>
              </div>
              <div className="grid grid-cols-4 gap-4 items-center">
                <span>Flujo Financiamiento</span>
                <span className={`font-medium text-right ${flujoData.financiamiento.efectivo >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {flujoData.financiamiento.efectivo >= 0 ? "$" : "-$"}
                  {Math.abs(flujoData.financiamiento.efectivo).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
                <span className={`font-medium text-right ${flujoData.financiamiento.bancos >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {flujoData.financiamiento.bancos >= 0 ? "$" : "-$"}
                  {Math.abs(flujoData.financiamiento.bancos).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
                <span className={`font-bold text-right ${flujoData.financiamiento.total >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {flujoData.financiamiento.total >= 0 ? "$" : "-$"}
                  {Math.abs(flujoData.financiamiento.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
              <span>Efectivo Neto de Financiamiento</span>
              <span className={`text-right ${flujoData.financiamiento.total >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${flujoData.financiamiento.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flujo Neto */}
      <Card className="bg-purple-50 dark:bg-purple-950">
        <CardHeader>
          <CardTitle className="text-purple-600">Aumento/Disminución Neto en Efectivo</CardTitle>
        </CardHeader>
        <CardContent>
          {mostrarDetalle ? (
            <div className="grid grid-cols-4 gap-4 font-bold text-lg">
              <span>Concepto</span>
              <span className="text-right">Efectivo</span>
              <span className="text-right">Bancos</span>
              <span className="text-right">Total</span>

              <span>Flujo Neto</span>
              <span className={`text-right ${flujoData.flujoNeto.efectivo >= 0 ? "text-green-600" : "text-red-600"}`}>
                {flujoData.flujoNeto.efectivo >= 0 ? "$" : "-$"}
                {Math.abs(flujoData.flujoNeto.efectivo).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
              <span className={`text-right ${flujoData.flujoNeto.bancos >= 0 ? "text-green-600" : "text-red-600"}`}>
                {flujoData.flujoNeto.bancos >= 0 ? "$" : "-$"}
                {Math.abs(flujoData.flujoNeto.bancos).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
              <span className={`text-right ${flujoData.flujoNeto.total >= 0 ? "text-green-600" : "text-red-600"}`}>
                {flujoData.flujoNeto.total >= 0 ? "$" : "-$"}
                {Math.abs(flujoData.flujoNeto.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 items-center font-bold text-lg">
              <span>Flujo Neto</span>
              <span className={`text-right ${flujoData.flujoNeto.total >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${flujoData.flujoNeto.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saldo Final */}
      <Card className="bg-green-50 dark:bg-green-950">
        <CardHeader>
          <CardTitle className="text-green-600">Saldo Final de Efectivo</CardTitle>
        </CardHeader>
        <CardContent>
          {mostrarDetalle ? (
            <div className="grid grid-cols-4 gap-4 font-bold text-xl">
              <span>Concepto</span>
              <span className="text-right">Efectivo</span>
              <span className="text-right">Bancos</span>
              <span className="text-right">Total</span>

              <span>Saldo Final</span>
              <span className="text-right text-green-600">
                ${flujoData.saldoFinal.efectivo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-right text-green-600">
                ${flujoData.saldoFinal.bancos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-right text-green-600">
                ${flujoData.saldoFinal.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 items-center font-bold text-xl">
              <span>Saldo Final</span>
              <span className="text-right text-green-600">
                ${flujoData.saldoFinal.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FlujoEfectivoEjecutivo;
