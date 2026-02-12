// bukipin-dashboard/src/hooks/useAsientosBalanza.tsx
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";

interface BalanzaEntry {
  fecha: string; 
  tipo: string;
  descripcion: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: number;
  haber: number;
  referencia: string; 
}

interface SaldoCuenta {
  cuenta_codigo: string;

  
  cuenta_nombre?: string;
  estado_financiero?: string | null;

  
  saldo_inicial: number;

  
  debe_total: number;
  haber_total: number;

  
  saldo_final: number;

  
  saldo: number;
}

type AsientoUI = {
  id?: string;
  _id?: any;

  numero_asiento?: string;
  numeroAsiento?: string;

  asiento_fecha?: string; 
  fecha?: string; 

  concepto?: string;
  descripcion?: string;

  detalle_asientos?: Array<{
    
    cuenta_codigo?: string | null;
    cuentaCodigo?: string | null;
    accountCodigo?: string | null;
    codigo?: string | null;
    account_code?: string | null;

    cuenta_nombre?: string | null;
    cuentaNombre?: string | null;
    accountNombre?: string | null;
    nombre?: string | null;

    debe?: number | string | null;
    haber?: number | string | null;
    debit?: number | string | null;
    credit?: number | string | null;

    memo?: string | null;
    descripcion?: string | null;
  }>;

  // compat vieja
  lines?: Array<{
    cuenta_codigo?: string | null;
    cuentaCodigo?: string | null;
    accountCodigo?: string | null;
    codigo?: string | null;
    account_code?: string | null;

    cuenta_nombre?: string | null;
    cuentaNombre?: string | null;
    accountNombre?: string | null;
    nombre?: string | null;

    debe?: number | string | null;
    haber?: number | string | null;
    debit?: number | string | null;
    credit?: number | string | null;

    memo?: string | null;
    descripcion?: string | null;
  }>;
};

type DetalleLine = {
  cuenta_codigo?: string;
  cuenta_nombre?: string;
  debe?: number | string;
  haber?: number | string;
  neto?: number | string;
  saldo?: number | string;
  estado_financiero?: string | null;
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

function normalizeCode(code: any) {
  return String(code ?? "").trim();
}

function pickLineCodigo(line: any) {
  const codigo =
    line?.cuenta_codigo ??
    line?.cuentaCodigo ??
    line?.accountCodigo ??
    line?.codigo ??
    line?.account_code ??
    "";
  return normalizeCode(codigo);
}

function pickLineNombre(line: any) {
  const nombre =
    line?.cuenta_nombre ??
    line?.cuentaNombre ??
    line?.accountNombre ??
    line?.nombre ??
    "";
  return normalizeCode(nombre);
}

function pickDebeHaber(line: any) {
  // compat: debe/haber o debit/credit
  const debe = num(line?.debe ?? line?.debit ?? 0, 0);
  const haber = num(line?.haber ?? line?.credit ?? 0, 0);
  return { debe, haber };
}

function getParentCandidates(code: string) {
  const c = normalizeCode(code);
  if (!c) return [];

  const parents: string[] = [];

  const dash = c.indexOf("-");
  const dot = c.indexOf(".");
  const slash = c.indexOf("/");

  const sepIdx = Math.max(dash, dot, slash);
  if (sepIdx > 0) parents.push(c.slice(0, sepIdx));

  // fallback clásico: primer 4 dígitos
  if (c.length > 4) parents.push(c.slice(0, 4));

  return Array.from(new Set(parents)).filter(Boolean);
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

async function fetchJsonSafe(url: string) {
  try {
    const json = await apiFetch(url, { method: "GET" });
    return { ok: true as const, json };
  } catch (err: any) {
    return { ok: false as const, err };
  }
}

function looksUsefulForER(saldos: Record<string, SaldoCuenta>) {
  const keys = Object.keys(saldos || {});
  if (!keys.length) return false;

  // Si no hay ninguna 4xxx/5xxx/6xxx con saldo != 0, ER suele quedar en ceros
  const has4 = keys.some((k) => String(k).startsWith("4") && num((saldos as any)[k]?.saldo, 0) !== 0);
  const has5 = keys.some((k) => String(k).startsWith("5") && num((saldos as any)[k]?.saldo, 0) !== 0);
  const has6 = keys.some((k) => String(k).startsWith("6") && num((saldos as any)[k]?.saldo, 0) !== 0);

  return has4 || has5 || has6;
}

/**
 * Construye saldos por cuenta desde los ASIENTOS (detalle_asientos) para el PERIODO.
 * ✅ Esto es lo más confiable para capturar SUBCUENTAS, porque vienen en las líneas del asiento.
 */
function buildPeriodoFromAsientos(asientos: AsientoUI[]) {
  const agg = new Map<string, { debe: number; haber: number; cuenta_nombre?: string }>();

  for (const a of asientos || []) {
    const lines = Array.isArray(a?.detalle_asientos)
      ? a.detalle_asientos
      : Array.isArray(a?.lines)
      ? a.lines
      : [];

    for (const l of lines) {
      const code = pickLineCodigo(l);
      if (!code) continue;

      const { debe, haber } = pickDebeHaber(l);
      const nombreLinea = pickLineNombre(l);

      const cur = agg.get(code) || { debe: 0, haber: 0, cuenta_nombre: undefined };
      cur.debe += debe;
      cur.haber += haber;
      if (!cur.cuenta_nombre && nombreLinea) cur.cuenta_nombre = nombreLinea;
      agg.set(code, cur);
    }
  }

  return agg;
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
        (asientosJson as any)?.asientos ??
        (asientosJson as any)?.items ??
        (Array.isArray(asientosPayload) ? asientosPayload : []);

      // =========================
      // 2) Cuentas (para mapear nombre si viene null)
      // =========================
      const cuentasJson = await apiFetch("/api/cuentas", { method: "GET" });
      const cuentasPayload = unwrap(cuentasJson);

      const cuentasArr: Array<{ codigo: string; nombre: string; estado_financiero?: string | null }> =
        Array.isArray(cuentasPayload?.data)
          ? (cuentasPayload.data as any)
          : Array.isArray(cuentasPayload)
          ? (cuentasPayload as any)
          : Array.isArray(cuentasJson)
          ? (cuentasJson as any)
          : Array.isArray((cuentasJson as any)?.data)
          ? ((cuentasJson as any).data as any)
          : [];

      const cuentasMap = new Map<string, { nombre: string; estado_financiero?: string | null }>(
        (cuentasArr || [])
          .filter((c) => c && (c as any).codigo)
          .map((c: any) => [
            normalizeCode(c.codigo),
            { nombre: String(c.nombre ?? ""), estado_financiero: c.estado_financiero ?? null },
          ])
      );

      const resolveCuentaMeta = (codigo: string, nombreFromLine?: string) => {
        const code = normalizeCode(codigo);
        if (!code) return { nombre: "", estado_financiero: null as string | null };

        // 1) nombre directo de la línea
        const nLine = normalizeCode(nombreFromLine);
        if (nLine) {
          const direct = cuentasMap.get(code);
          return { nombre: nLine, estado_financiero: direct?.estado_financiero ?? null };
        }

        // 2) match exacto en catálogo
        const exact = cuentasMap.get(code);
        if (exact?.nombre) return { nombre: exact.nombre, estado_financiero: exact.estado_financiero ?? null };

        // 3) fallback a código padre (para subcuentas 5101-01 -> 5101)
        for (const parent of getParentCandidates(code)) {
          const p = cuentasMap.get(parent);
          if (p?.nombre) return { nombre: p.nombre, estado_financiero: p.estado_financiero ?? null };
        }

        // 4) último fallback
        return { nombre: code, estado_financiero: null as string | null };
      };

      // =========================
      // 3) Flatten asientos -> movimientos
      // =========================
      const movimientos: BalanzaEntry[] = [];

      for (const a of asientos || []) {
        const referencia = normalizeCode(a?.numero_asiento ?? a?.numeroAsiento);
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
          const cuentaCodigo = pickLineCodigo(l);
          if (!cuentaCodigo) continue;

          const meta = resolveCuentaMeta(cuentaCodigo, pickLineNombre(l));
          const { debe, haber } = pickDebeHaber(l);

          movimientos.push({
            fecha: fechaFormateada,
            tipo,
            descripcion: descripcionFinal,
            cuenta_codigo: cuentaCodigo,
            cuenta_nombre: meta.nombre || cuentaCodigo,
            debe,
            haber,
            referencia,
          });
        }
      }

      // Detecta si hay subcuentas en el periodo (para decidir estrategia)
      const hasSubcuentas = movimientos.some((m) => {
        const c = normalizeCode(m.cuenta_codigo);
        return c.includes("-") || c.includes(".") || c.includes("/");
      });

      // =========================
      // 4) ✅ Saldos por cuenta (E2E + compat + subcuentas)
      // =========================

      // Fast path si backend lo manda
      const saldosFastRaw: Record<string, any> =
        ((asientosPayload as any)?.saldosPorCuenta as any) ?? ((asientosJson as any)?.saldosPorCuenta as any) ?? {};

      const saldoInicialTotalFast = num((asientosPayload as any)?.saldoInicialTotal ?? (asientosJson as any)?.saldoInicialTotal, 0);
      const saldoFinalTotalFast = num((asientosPayload as any)?.saldoFinalTotal ?? (asientosJson as any)?.saldoFinalTotal, 0);

      const fastHasAny =
        saldosFastRaw && typeof saldosFastRaw === "object" && Object.keys(saldosFastRaw).length > 0;

      if (fastHasAny) {
        const saldosFast: Record<string, SaldoCuenta> = {};
        for (const k of Object.keys(saldosFastRaw)) {
          const code = normalizeCode(k);
          const row = saldosFastRaw[k] ?? {};
          const saldoFinal = num(row?.saldo_final ?? row?.saldo ?? 0, 0);
          const saldoInicial = num(row?.saldo_inicial ?? 0, 0);
          const debeTotal = num(row?.debe_total ?? row?.debe ?? 0, 0);
          const haberTotal = num(row?.haber_total ?? row?.haber ?? 0, 0);

          const meta = resolveCuentaMeta(code, String(row?.cuenta_nombre ?? ""));
          saldosFast[code] = {
            cuenta_codigo: code,
            cuenta_nombre: meta.nombre || code,
            estado_financiero: row?.estado_financiero ?? meta.estado_financiero ?? null,
            saldo_inicial: saldoInicial,
            debe_total: debeTotal,
            haber_total: haberTotal,
            saldo_final: saldoFinal,
            saldo: saldoFinal,
          };
        }

        return {
          movimientos,
          saldosPorCuenta: saldosFast,
          saldoInicialTotal: saldoInicialTotalFast,
          saldoFinalTotal: saldoFinalTotalFast,
        };
      }

      // ---- A) periodo desde /api/asientos/detalle (si existe) ----
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

      // ---- B) saldo inicial (acumulado previo) desde /api/asientos/detalle ----
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

      // saldo inicial por cuenta (si viene saldo, úsalo; si no, debe-haber)
      const saldoInicialByCuenta = new Map<
        string,
        { saldo: number; cuenta_nombre?: string; estado_financiero?: string | null }
      >();
      for (const row of detInicialArr || []) {
        const code = normalizeCode(row?.cuenta_codigo);
        if (!code) continue;
        const saldo = row?.saldo != null ? num(row.saldo, 0) : num(row.debe, 0) - num(row.haber, 0);
        saldoInicialByCuenta.set(code, {
          saldo,
          cuenta_nombre: normalizeCode(row?.cuenta_nombre),
          estado_financiero: row?.estado_financiero ?? null,
        });
      }

      // periodo por cuenta desde /api/asientos/detalle (puede venir sin subcuentas)
      const periodoByCuentaFromDetalle = new Map<
        string,
        { debe: number; haber: number; cuenta_nombre?: string; estado_financiero?: string | null }
      >();
      for (const row of detPeriodoArr || []) {
        const code = normalizeCode(row?.cuenta_codigo);
        if (!code) continue;
        periodoByCuentaFromDetalle.set(code, {
          debe: num(row?.debe, 0),
          haber: num(row?.haber, 0),
          cuenta_nombre: normalizeCode(row?.cuenta_nombre),
          estado_financiero: row?.estado_financiero ?? null,
        });
      }

      // ✅ periodo por cuenta desde ASIENTOS (para capturar SUBCUENTAS 100%)
      const periodoByCuentaFromAsientos = buildPeriodoFromAsientos(asientos);

      // Armamos el set de códigos final:
      const allCodes = new Set<string>();
      if (hasSubcuentas) {
        for (const code of periodoByCuentaFromAsientos.keys()) allCodes.add(code);
        for (const code of saldoInicialByCuenta.keys()) allCodes.add(code);
      } else {
        for (const code of saldoInicialByCuenta.keys()) allCodes.add(code);
        for (const code of periodoByCuentaFromDetalle.keys()) allCodes.add(code);
      }

      const saldosPorCuentaFinal: Record<string, SaldoCuenta> = {};
      let saldoInicialTotal = 0;
      let saldoFinalTotal = 0;

      for (const code of allCodes) {
        // saldo inicial: si no existe exacto y es subcuenta, intenta padre
        const initExact = saldoInicialByCuenta.get(code);
        let saldoInicial = initExact?.saldo ?? 0;
        let initNombre = initExact?.cuenta_nombre ?? "";
        let initEstado = initExact?.estado_financiero ?? null;

        if (!initExact && hasSubcuentas) {
          for (const parent of getParentCandidates(code)) {
            const p = saldoInicialByCuenta.get(parent);
            if (p) {
              saldoInicial = p.saldo ?? 0;
              initNombre = p.cuenta_nombre ?? "";
              initEstado = p.estado_financiero ?? null;
              break;
            }
          }
        }

        // periodo: según estrategia
        let debeTotal = 0;
        let haberTotal = 0;
        let perNombre = "";
        let perEstado: string | null = null;

        if (hasSubcuentas) {
          const per = periodoByCuentaFromAsientos.get(code);
          debeTotal = per?.debe ?? 0;
          haberTotal = per?.haber ?? 0;
          perNombre = per?.cuenta_nombre ?? "";
        } else {
          const per = periodoByCuentaFromDetalle.get(code);
          debeTotal = per?.debe ?? 0;
          haberTotal = per?.haber ?? 0;
          perNombre = per?.cuenta_nombre ?? "";
          perEstado = per?.estado_financiero ?? null;
        }

        const meta = resolveCuentaMeta(code, perNombre || initNombre);
        const saldoFinal = saldoInicial + (debeTotal - haberTotal);

        saldosPorCuentaFinal[code] = {
          cuenta_codigo: code,
          cuenta_nombre: meta.nombre || code,
          estado_financiero: perEstado ?? initEstado ?? meta.estado_financiero ?? null,
          saldo_inicial: saldoInicial,
          debe_total: debeTotal,
          haber_total: haberTotal,
          saldo_final: saldoFinal,
          saldo: saldoFinal,
        };

        saldoInicialTotal += saldoInicial;
        saldoFinalTotal += saldoFinal;
      }

      // ✅ Si /api/asientos/detalle NO trae 4/5/6 (y no hay subcuentas), ER puede quedar en ceros.
      // En ese caso, fallback a periodo desde asientos.
      if (!hasSubcuentas && !looksUsefulForER(saldosPorCuentaFinal)) {
        const per = periodoByCuentaFromAsientos;
        const fb: Record<string, SaldoCuenta> = {};
        let fbFinalTotal = 0;

        for (const [code, v] of per.entries()) {
          const meta = resolveCuentaMeta(code, v.cuenta_nombre || "");
          const saldoFinal = num(v.debe, 0) - num(v.haber, 0);
          fb[code] = {
            cuenta_codigo: code,
            cuenta_nombre: meta.nombre || code,
            estado_financiero: meta.estado_financiero ?? null,
            saldo_inicial: 0,
            debe_total: num(v.debe, 0),
            haber_total: num(v.haber, 0),
            saldo_final: saldoFinal,
            saldo: saldoFinal,
          };
          fbFinalTotal += saldoFinal;
        }

        return {
          movimientos,
          saldosPorCuenta: fb,
          saldoInicialTotal: 0,
          saldoFinalTotal: fbFinalTotal,
        };
      }

      return {
        movimientos,
        saldosPorCuenta: saldosPorCuentaFinal,
        saldoInicialTotal,
        saldoFinalTotal,
      };
    },
    enabled: !!startDate && !!endDate,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
