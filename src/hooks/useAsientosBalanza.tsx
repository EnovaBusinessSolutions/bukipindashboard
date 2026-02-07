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

  // ✅ ALIAS CANÓNICO (para UI legacy / Operativo/Ejecutivo)
  // saldo = saldo_final (monto neto acumulado al cierre del periodo)
  saldo: number;
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

type DetalleLineAny = Record<string, any>;

function normalizeDetalleLine(row: DetalleLineAny): {
  code: string;
  debe: number;
  haber: number;
  saldo: number | null; // puede venir ya calculado
} | null {
  if (!row || typeof row !== "object") return null;

  const code = String(
    row.cuenta_codigo ??
      row.cuentaCodigo ??
      row.accountCodigo ??
      row.account_code ??
      row.codigo ??
      ""
  ).trim();

  if (!code) return null;

  // debe/haber pueden venir como debe_total/haber_total o debe/haber
  const debe = num(row.debe_total ?? row.debe ?? row.debit ?? 0, 0);
  const haber = num(row.haber_total ?? row.haber ?? row.credit ?? 0, 0);

  // saldo puede venir como saldo/saldo_final/neto/balance
  const saldoRaw =
    row.saldo ??
    row.saldo_final ??
    row.neto ??
    row.balance ??
    row.saldoFinal ??
    null;

  const saldo = saldoRaw == null ? null : num(saldoRaw, 0);

  return { code, debe, haber, saldo };
}

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
 *
 * Nota: aquí el "saldo_inicial" real no existe (no sabemos acumulado previo),
 * pero para ER (periodo) lo crítico es debe_total/haber_total.
 */
function buildSaldosFromAsientos(
  asientos: AsientoUI[]
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
          saldo: 0,
        };
      }

      agg[code].debe_total += debe;
      agg[code].haber_total += haber;

      const netoPeriodo = debe - haber;
      agg[code].saldo_final += netoPeriodo;
      agg[code].saldo = agg[code].saldo_final; // alias
    }
  }

  const saldoInicialTotal = 0;
  const saldoFinalTotal = Object.values(agg).reduce((t, x) => t + num(x.saldo_final, 0), 0);

  return { saldosPorCuenta: agg, saldoInicialTotal, saldoFinalTotal };
}

function looksUsefulForER(saldos: Record<string, SaldoCuenta>) {
  const keys = Object.keys(saldos || {});
  if (!keys.length) return false;

  const getSaldo = (k: string) => num((saldos as any)[k]?.saldo ?? (saldos as any)[k]?.saldo_final, 0);

  const has4 = keys.some((k) => String(k).startsWith("4") && getSaldo(k) !== 0);
  const has5 = keys.some((k) => String(k).startsWith("5") && getSaldo(k) !== 0);
  const has6 = keys.some((k) => String(k).startsWith("6") && getSaldo(k) !== 0);

  return has4 || has5 || has6;
}

function normalizeSaldosFast(input: any): Record<string, SaldoCuenta> {
  const obj = input && typeof input === "object" ? input : {};
  const out: Record<string, SaldoCuenta> = {};

  for (const k of Object.keys(obj)) {
    const row = (obj as any)[k];
    const code = String(row?.cuenta_codigo ?? k ?? "").trim();
    if (!code) continue;

    const saldo_inicial = num(row?.saldo_inicial ?? row?.saldoInicial ?? 0, 0);
    const debe_total = num(row?.debe_total ?? row?.debe ?? 0, 0);
    const haber_total = num(row?.haber_total ?? row?.haber ?? 0, 0);

    const saldo_final = num(
      row?.saldo_final ?? row?.saldo ?? saldo_inicial + (debe_total - haber_total),
      0
    );

    out[code] = {
      cuenta_codigo: code,
      saldo_inicial,
      debe_total,
      haber_total,
      saldo_final,
      saldo: saldo_final,
    };
  }

  return out;
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

      // Fast path si backend lo manda
      const saldosFastRaw =
        asientosPayload?.saldosPorCuenta ??
        asientosJson?.saldosPorCuenta ??
        null;

      const saldosFast = saldosFastRaw ? normalizeSaldosFast(saldosFastRaw) : {};

      const saldoInicialTotalFast = num(
        asientosPayload?.saldoInicialTotal ?? asientosJson?.saldoInicialTotal,
        0
      );

      const saldoFinalTotalFast = num(
        asientosPayload?.saldoFinalTotal ?? asientosJson?.saldoFinalTotal,
        0
      );

      const fastHasAny = saldosFast && Object.keys(saldosFast).length > 0;

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

      const detPeriodoRows: DetalleLineAny[] = Array.isArray(detPeriodoPayload)
        ? detPeriodoPayload
        : Array.isArray(detPeriodoPayload?.data)
        ? detPeriodoPayload.data
        : [];

      // ---- B) saldo inicial (acumulado previo) ----
      const endPrev = addDaysYMD(start, -1);

      const detInicialRes = await fetchJsonSafe(
        `/api/asientos/detalle?start=${encodeURIComponent("1970-01-01")}&end=${encodeURIComponent(endPrev)}`
      );

      const detInicialPayload = detInicialRes.ok ? unwrap(detInicialRes.json) : null;

      const detInicialRows: DetalleLineAny[] = Array.isArray(detInicialPayload)
        ? detInicialPayload
        : Array.isArray(detInicialPayload?.data)
        ? detInicialPayload.data
        : [];

      const saldoInicialByCuenta = new Map<string, number>();
      for (const r of detInicialRows || []) {
        const n = normalizeDetalleLine(r);
        if (!n) continue;

        // si el endpoint ya trae "saldo", úsalo; si no, neto (debe-haber)
        const saldo = n.saldo != null ? n.saldo : n.debe - n.haber;
        saldoInicialByCuenta.set(n.code, saldo);
      }

      const periodoByCuenta = new Map<string, { debe: number; haber: number }>();
      for (const r of detPeriodoRows || []) {
        const n = normalizeDetalleLine(r);
        if (!n) continue;
        periodoByCuenta.set(n.code, { debe: n.debe, haber: n.haber });
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
          saldo: saldoFinal, // ✅ alias canónico
        };

        saldoInicialTotal += saldoInicial;
        saldoFinalTotal += saldoFinal;
      }

      // ✅ Si /api/asientos/detalle NO trae 4/5/6 útiles, ER seguirá en ceros.
      // En ese caso, usamos el fallback confiable desde detalle_asientos.
      if (!looksUsefulForER(saldosPorCuentaFromDetalle)) {
        const fb = buildSaldosFromAsientos(asientos);
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
