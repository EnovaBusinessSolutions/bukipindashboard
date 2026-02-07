// bukipin-dashboard/src/hooks/useAsientosBalanza.tsx
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
  numeroAsiento?: string;

  asiento_fecha?: string; // "YYYY-MM-DD"
  fecha?: string; // compat

  concepto?: string;
  descripcion?: string;

  detalle_asientos?: Array<{
    cuenta_codigo?: string | null;
    cuenta_nombre?: string | null;
    debe?: number | string | null;
    haber?: number | string | null;
    memo?: string | null;
  }>;

  // compat vieja
  lines?: Array<{
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

function addDaysYMD(ymd: string, deltaDays: number) {
  const parts = String(ymd).split("-");
  if (parts.length !== 3) return ymd;
  const yyyy = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10) - 1;
  const dd = parseInt(parts[2], 10);
  const dt = new Date(yyyy, mm, dd);
  dt.setDate(dt.getDate() + deltaDays);
  return format(dt, "yyyy-MM-dd");
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

type DetalleLine = {
  cuenta_codigo?: string;
  cuenta_nombre?: string;
  debe?: number | string;
  haber?: number | string;
  neto?: number | string;
  saldo?: number | string;
};

async function fetchJsonSafe(url: string) {
  try {
    const json = await apiFetch(url, { method: "GET" });
    return { ok: true as const, json };
  } catch (err: any) {
    return { ok: false as const, err };
  }
}

/**
 * Construye saldos por cuenta desde los ASIENTOS (detalle_asientos)
 * Esto es el fallback más confiable para que ER deje de salir en ceros.
 */
function buildSaldosFromAsientos(
  asientos: AsientoUI[],
  cuentasMap: Map<string, string>
): {
  saldosPorCuenta: Record<string, SaldoCuenta>;
  saldoInicialTotal: number;
  saldoFinalTotal: number;
} {
  const agg: Record<string, SaldoCuenta> = {};

  for (const a of asientos || []) {
    const lines = Array.isArray(a?.detalle_asientos)
      ? a.detalle_asientos
      : Array.isArray(a?.lines)
      ? a.lines
      : [];

    for (const l of lines) {
      const code = String(l?.cuenta_codigo ?? "").trim();
      if (!code) continue;

      const debe = num(l?.debe, 0);
      const haber = num(l?.haber, 0);

      if (!agg[code]) {
        agg[code] = {
          cuenta_codigo: code,
          saldo_inicial: 0,
          debe_total: 0,
          haber_total: 0,
          saldo_final: 0,
        };
      }

      agg[code].debe_total += debe;
      agg[code].haber_total += haber;
      agg[code].saldo_final += debe - haber; // neto del periodo
    }
  }

  // Totales (en este fallback no tenemos inicial real)
  const saldoInicialTotal = 0;
  const saldoFinalTotal = Object.values(agg).reduce((t, x) => t + num(x.saldo_final, 0), 0);

  // (Opcional) Si algún lado necesita nombres, aquí no los guardamos, pero al menos está el código.
  // El ER usa el catálogo de cuentas para nombres, así que estamos bien.

  return { saldosPorCuenta: agg, saldoInicialTotal, saldoFinalTotal };
}

function looksUsefulForER(saldos: Record<string, SaldoCuenta>) {
  const keys = Object.keys(saldos || {});
  if (!keys.length) return false;

  // Si no hay ninguna 4xxx/5xxx/6xxx, normalmente ER seguirá en cero
  const has4 = keys.some((k) => String(k).startsWith("4") && num((saldos as any)[k]?.saldo_final, 0) !== 0);
  const has5 = keys.some((k) => String(k).startsWith("5") && num((saldos as any)[k]?.saldo_final, 0) !== 0);
  const has6 = keys.some((k) => String(k).startsWith("6") && num((saldos as any)[k]?.saldo_final, 0) !== 0);

  // Si al menos trae algo de ER, lo consideramos útil
  return has4 || has5 || has6;
}

export const useAsientosBalanza = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ["asientos-balanza", toYMDLocal(startDate), toYMDLocal(endDate)],
    queryFn: async () => {
      const start = toYMDLocal(startDate);
      const end = toYMDLocal(endDate);

      // =========================
      // 1) Asientos completos (para movimientos / modal)
      // =========================
      const asientosJson = await apiFetch(
        `/api/contabilidad/asientos?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { method: "GET" }
      );
      const asientosPayload = unwrap(asientosJson);

      const asientos: AsientoUI[] =
        asientosPayload?.asientos ??
        asientosPayload?.items ??
        asientosJson?.asientos ??
        asientosJson?.items ??
        (Array.isArray(asientosPayload) ? asientosPayload : []);

      // =========================
      // 2) Cuentas (para mapear nombre si viene null)
      // =========================
      const cuentasJson = await apiFetch("/api/cuentas", { method: "GET" });
      const cuentasPayload = unwrap(cuentasJson);

      const cuentasArr: Array<{ codigo: string; nombre: string }> =
        Array.isArray(cuentasPayload?.data)
          ? (cuentasPayload.data as any)
          : Array.isArray(cuentasPayload)
          ? (cuentasPayload as any)
          : Array.isArray(cuentasJson)
          ? (cuentasJson as any)
          : Array.isArray((cuentasJson as any)?.data)
          ? ((cuentasJson as any).data as any)
          : [];

      const cuentasMap = new Map<string, string>(
        (cuentasArr || [])
          .filter((c) => c && (c as any).codigo)
          .map((c: any) => [String(c.codigo), String(c.nombre ?? "")])
      );

      // =========================
      // 3) Flatten asientos -> movimientos
      // =========================
      const movimientos: BalanzaEntry[] = [];

      for (const a of asientos || []) {
        const referencia = String(a?.numero_asiento ?? a?.numeroAsiento ?? "").trim();
        const tipo = tipoPorNumeroAsiento(referencia);
        const descripcionFinal = String(a?.concepto ?? a?.descripcion ?? "");
        const fechaYMD = String(a?.asiento_fecha ?? a?.fecha ?? "");
        const fechaFormateada = formatDMYFromYMD(fechaYMD);

        const lines = Array.isArray(a?.detalle_asientos)
          ? a.detalle_asientos
          : Array.isArray(a?.lines)
          ? a.lines
          : [];

        for (const l of lines) {
          const cuentaCodigo = String(l?.cuenta_codigo ?? "").trim();
          if (!cuentaCodigo) continue;

          const nombreLinea = String(l?.cuenta_nombre ?? "").trim();
          const cuentaNombre = nombreLinea || cuentasMap.get(cuentaCodigo) || cuentaCodigo;

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

      // =========================
      // 4) ✅ Saldos por cuenta (E2E)
      // =========================

      // Fast path si backend lo manda (raro, pero lo respetamos)
      const saldosFast: Record<string, SaldoCuenta> =
        (asientosPayload?.saldosPorCuenta as any) ??
        (asientosJson?.saldosPorCuenta as any) ??
        {};

      const saldoInicialTotalFast = num(
        asientosPayload?.saldoInicialTotal ?? asientosJson?.saldoInicialTotal,
        0
      );

      const saldoFinalTotalFast = num(
        asientosPayload?.saldoFinalTotal ?? asientosJson?.saldoFinalTotal,
        0
      );

      const fastHasAny =
        saldosFast && typeof saldosFast === "object" && Object.keys(saldosFast).length > 0;

      if (fastHasAny) {
        return {
          movimientos,
          saldosPorCuenta: saldosFast,
          saldoInicialTotal: saldoInicialTotalFast,
          saldoFinalTotal: saldoFinalTotalFast,
        };
      }

      // ---- A) periodo (si existe endpoint y trae cosas útiles) ----
      const detPeriodoRes = await fetchJsonSafe(
        `/api/asientos/detalle?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      );

      const detPeriodoPayload = detPeriodoRes.ok ? unwrap(detPeriodoRes.json) : null;
      const detPeriodoArr: DetalleLine[] = Array.isArray(detPeriodoPayload)
        ? detPeriodoPayload
        : Array.isArray(detPeriodoPayload?.data)
        ? detPeriodoPayload.data
        : Array.isArray((detPeriodoRes as any)?.json?.data)
        ? (detPeriodoRes as any).json.data
        : [];

      // ---- B) saldo inicial (acumulado previo) ----
      const endPrev = addDaysYMD(start, -1);

      const detInicialRes = await fetchJsonSafe(
        `/api/asientos/detalle?start=${encodeURIComponent("1970-01-01")}&end=${encodeURIComponent(endPrev)}`
      );

      const detInicialPayload = detInicialRes.ok ? unwrap(detInicialRes.json) : null;
      const detInicialArr: DetalleLine[] = Array.isArray(detInicialPayload)
        ? detInicialPayload
        : Array.isArray(detInicialPayload?.data)
        ? detInicialPayload.data
        : Array.isArray((detInicialRes as any)?.json?.data)
        ? (detInicialRes as any).json.data
        : [];

      const saldoInicialByCuenta = new Map<string, number>();
      for (const row of detInicialArr || []) {
        const code = String(row?.cuenta_codigo ?? "").trim();
        if (!code) continue;
        const saldo = row?.saldo != null ? num(row.saldo, 0) : num(row.debe, 0) - num(row.haber, 0);
        saldoInicialByCuenta.set(code, saldo);
      }

      const periodoByCuenta = new Map<string, { debe: number; haber: number }>();
      for (const row of detPeriodoArr || []) {
        const code = String(row?.cuenta_codigo ?? "").trim();
        if (!code) continue;
        const debe = num(row?.debe, 0);
        const haber = num(row?.haber, 0);
        periodoByCuenta.set(code, { debe, haber });
      }

      const saldosPorCuentaFromDetalle: Record<string, SaldoCuenta> = {};
      const allCodes = new Set<string>([
        ...Array.from(saldoInicialByCuenta.keys()),
        ...Array.from(periodoByCuenta.keys()),
      ]);

      let saldoInicialTotal = 0;
      let saldoFinalTotal = 0;

      for (const code of allCodes) {
        const saldoInicial = saldoInicialByCuenta.get(code) ?? 0;
        const periodo = periodoByCuenta.get(code);
        const debeTotal = periodo?.debe ?? 0;
        const haberTotal = periodo?.haber ?? 0;
        const saldoFinal = saldoInicial + (debeTotal - haberTotal);

        saldosPorCuentaFromDetalle[code] = {
          cuenta_codigo: code,
          saldo_inicial: saldoInicial,
          debe_total: debeTotal,
          haber_total: haberTotal,
          saldo_final: saldoFinal,
        };

        saldoInicialTotal += saldoInicial;
        saldoFinalTotal += saldoFinal;
      }

      // ✅ Si /api/asientos/detalle NO trae 4/5/6, entonces ER seguirá en ceros.
      // En ese caso, usamos el fallback confiable desde detalle_asientos.
      if (!looksUsefulForER(saldosPorCuentaFromDetalle)) {
        const fb = buildSaldosFromAsientos(asientos, cuentasMap);
        return {
          movimientos,
          saldosPorCuenta: fb.saldosPorCuenta,
          saldoInicialTotal: fb.saldoInicialTotal,
          saldoFinalTotal: fb.saldoFinalTotal,
        };
      }

      // Si sí sirve, usamos esta (mantiene inicial real)
      return {
        movimientos,
        saldosPorCuenta: saldosPorCuentaFromDetalle,
        saldoInicialTotal,
        saldoFinalTotal,
      };
    },
    enabled: !!startDate && !!endDate,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
