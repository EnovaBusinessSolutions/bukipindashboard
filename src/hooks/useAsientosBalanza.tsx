import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";

interface BalanzaEntry {
  fecha: string; // dd/MM/yyyy
  tipo: string;
  descripcion: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: number;
  haber: number;
  referencia: string; // numero_asiento
}

interface SaldoCuenta {
  cuenta_codigo: string;
  // ✅ NUEVO (E2E real)
  saldo_inicial: number;
  // ✅ Periodo
  debe_total: number;
  haber_total: number;
  // ✅ NUEVO (E2E real)
  saldo_final: number;
}

type AsientoUI = {
  id?: string;
  _id?: any;

  numero_asiento?: string;
  asiento_fecha?: string; // "YYYY-MM-DD"
  concepto?: string;

  detalle_asientos?: Array<{
    cuenta_codigo?: string | null;
    cuenta_nombre?: string | null;
    debe?: number | string | null;
    haber?: number | string | null;
    memo?: string | null;
  }>;
};

function num(v: any, def = 0) {
  if (v == null) return def;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : def;
}

function toYMDLocal(d: Date) {
  // IMPORTANT: evita toISOString (UTC shift)
  return format(d, "yyyy-MM-dd");
}

function formatDMYFromYMD(ymd?: string) {
  if (!ymd) return "";
  const parts = String(ymd).split("-");
  if (parts.length !== 3) return "";
  const yyyy = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10) - 1;
  const dd = parseInt(parts[2], 10);
  const dt = new Date(yyyy, mm, dd);
  return format(dt, "dd/MM/yyyy");
}

function tipoPorNumeroAsiento(numeroAsiento: string) {
  const n = numeroAsiento || "";
  if (n.startsWith("ING-")) return "Ingreso";
  if (n.startsWith("EGR-")) return "Egreso";
  if (n.startsWith("INV-")) return "Inversión";
  if (n.startsWith("CAP-")) return "Capital";
  if (n.startsWith("FIN-")) return "Financiamiento";
  if (n.startsWith("IMP-") || n.startsWith("ISR-")) return "Impuesto";
  if (n.startsWith("COB-")) return "Cobro";
  if (n.startsWith("PAG-CXP-")) return "Pago CxP";
  if (n.startsWith("PAG-")) return "Pago";
  if (n.startsWith("DEP-")) return "Depreciación";
  return "Otro";
}

// Normalizador para endpoints estilo Bukipin: {ok:true,data} o payload plano
function unwrap(json: any) {
  return json?.data ?? json;
}

export const useAsientosBalanza = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ["asientos-balanza", toYMDLocal(startDate), toYMDLocal(endDate)],
    queryFn: async () => {
      const start = toYMDLocal(startDate);
      const end = toYMDLocal(endDate);

      // 1) Traer asientos completos (backend: /api/contabilidad/asientos)
      const asientosJson = await apiFetch(
        `/api/contabilidad/asientos?start=${encodeURIComponent(
          start
        )}&end=${encodeURIComponent(end)}`,
        { method: "GET" }
      );
      const asientosPayload = unwrap(asientosJson);

      // Soportar: {asientos}, {items}, array plano
      const asientos: AsientoUI[] =
        asientosPayload?.asientos ??
        asientosPayload?.items ??
        asientosJson?.asientos ??
        asientosJson?.items ??
        (Array.isArray(asientosPayload) ? asientosPayload : []);

      // 2) Traer cuentas (para mapear nombre si viene null)
      // Tu endpoint real es /api/cuentas y suele responder:
      //  - [{...}]
      //  - { ok:true, data:[{...}] }
      const cuentasJson = await apiFetch("/api/cuentas", { method: "GET" });
      const cuentasPayload = unwrap(cuentasJson);

      const cuentasArr: Array<{ codigo: string; nombre: string }> =
        Array.isArray(cuentasPayload)
          ? cuentasPayload
          : Array.isArray(cuentasJson)
          ? (cuentasJson as any)
          : [];

      const cuentasMap = new Map<string, string>(
        (cuentasArr || [])
          .filter((c) => c && (c as any).codigo)
          .map((c: any) => [String(c.codigo), String(c.nombre ?? "")])
      );

      // 3) Flatten asientos -> movimientos (para "filas afectadas" + modal)
      const movimientos: BalanzaEntry[] = [];

      for (const a of asientos || []) {
        const referencia = String(a?.numero_asiento ?? "").trim();
        const tipo = tipoPorNumeroAsiento(referencia);
        const descripcionFinal = String(a?.concepto ?? "");
        const fechaFormateada = formatDMYFromYMD(a?.asiento_fecha);

        const lines = Array.isArray(a?.detalle_asientos)
          ? a.detalle_asientos
          : [];

        for (const l of lines) {
          const cuentaCodigo = String(l?.cuenta_codigo ?? "").trim();
          if (!cuentaCodigo) continue;

          const nombreLinea = String(l?.cuenta_nombre ?? "").trim();
          const cuentaNombre =
            nombreLinea || cuentasMap.get(cuentaCodigo) || cuentaCodigo;

          movimientos.push({
            fecha: fechaFormateada,
            tipo,
            descripcion: descripcionFinal,
            cuenta_codigo: cuentaCodigo,
            cuenta_nombre: cuentaNombre,
            debe: num(l?.debe, 0),
            haber: num(l?.haber, 0),
            referencia,
          });
        }
      }

      // 4) ✅ Saldos por cuenta (AHORA VIENEN DEL BACKEND)
      // Backend nuevo entrega:
      // - data.saldosPorCuenta
      // - data.saldoInicialTotal
      // - data.saldoFinalTotal
      const saldosPorCuenta: Record<string, SaldoCuenta> =
        (asientosPayload?.saldosPorCuenta as any) ??
        (asientosJson?.saldosPorCuenta as any) ??
        {};

      const saldoInicialTotal = num(
        asientosPayload?.saldoInicialTotal ?? asientosJson?.saldoInicialTotal,
        0
      );

      const saldoFinalTotal = num(
        asientosPayload?.saldoFinalTotal ?? asientosJson?.saldoFinalTotal,
        0
      );

      return { movimientos, saldosPorCuenta, saldoInicialTotal, saldoFinalTotal };
    },
    enabled: !!startDate && !!endDate,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
