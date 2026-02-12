// src/components/EstadosFinancieros/EstadoResultadosEjecutivo.tsx
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { PeriodType } from "@/pages/EstadoResultados";
import { cn } from "@/lib/utils";

interface EstadoResultadosEjecutivoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
}

type SaldoRow = {
  // del hook nuevo (E2E)
  debe_total?: number;
  haber_total?: number;
  saldo_final?: number;

  // compat (por si algún endpoint antiguo lo manda)
  saldo?: number;

  // ✅ para mostrar nombres si el hook los manda (useAsientosBalanza ya los arma)
  cuenta_nombre?: string;
};

function num(v: any, def = 0) {
  if (v == null) return def;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : def;
}

const EstadoResultadosEjecutivo = ({ startDate, endDate }: EstadoResultadosEjecutivoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();
  const { data: asientosData, isLoading: asientosLoading } = useAsientosBalanza(startDate, endDate);

  // ✅ Toggle para mostrar/ocultar detalle por cuenta (incluye subcuentas)
  const [showDetalle, setShowDetalle] = useState<boolean>(true);

  // Función para formatear el período
  const formatearPeriodo = (start: Date, end: Date): string => {
    const formatoFecha = (fecha: Date) =>
      fecha.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

    const fechaInicio = formatoFecha(start);
    const fechaFin = formatoFecha(end);

    if (start.toDateString() === end.toDateString()) {
      return `Estado de Resultados del ${fechaInicio}`;
    }
    return `Estado de Resultados del ${fechaInicio} al ${fechaFin}`;
  };

  if (cuentasLoading || asientosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const cuentasFlat = cuentasData?.cuentasFlat || [];
  const saldosPorCuenta = (asientosData?.saldosPorCuenta || {}) as Record<string, SaldoRow>;

  // ✅ Hay datos si hay movimientos o si hay saldos por cuenta
  const hayDatos =
    (Array.isArray(asientosData?.movimientos) && (asientosData?.movimientos?.length ?? 0) > 0) ||
    (saldosPorCuenta && Object.keys(saldosPorCuenta).length > 0);

  if (!hayDatos) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center space-y-2">
            <p className="text-xl font-medium text-muted-foreground">No hay datos financieros registrados</p>
            <p className="text-sm text-muted-foreground">
              Comienza registrando transacciones para ver el estado de resultados
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const normalizeCodigo = (codigo: string) => String(codigo || "").trim();

  // ✅ Para incluir subcuentas (4001-01 / 5101.02 / 5201/01, etc.)
  const splitCode = (code: string) => {
    const c = normalizeCodigo(code);
    if (!c) return { base: "", baseNum: NaN };
    const base = c.split(/[-./]/)[0]?.trim() || c;
    const baseNum = Number(base);
    return { base, baseNum };
  };

  const isSubcuenta = (code: string) => /[-./]/.test(normalizeCodigo(code));

  /**
   * ✅ Monto “del período” para ER
   * - 4xxx (Ingresos): normalmente crédito => (haber - debe) positivo
   * - 5xxx/6xxx (Costos/Gastos/Impuestos): normalmente débito => (debe - haber) positivo
   * - 4003: descuentos sobre ventas => NEGATIVO
   * - fallback: saldo_final/saldo con reglas suaves
   */
  const obtenerMontoPeriodoER = (codigoCuenta: string): number => {
    const codigo = normalizeCodigo(codigoCuenta);
    const altKey = codigo.replace(/\s+/g, "");
    const row = (saldosPorCuenta[codigo] ?? saldosPorCuenta[altKey]) as SaldoRow | undefined;

    // 1) Preferimos debe/haber del período si existen
    const debe = num(row?.debe_total, NaN);
    const haber = num(row?.haber_total, NaN);

    if (Number.isFinite(debe) && Number.isFinite(haber)) {
      if (codigo.startsWith("4")) {
        if (codigo === "4003") return -Math.abs(haber - debe);
        return Math.abs(haber - debe);
      }
      if (codigo.startsWith("5") || codigo.startsWith("6")) {
        return Math.abs(debe - haber);
      }
      return Math.abs(debe - haber);
    }

    // 2) fallback: saldo_final/saldo (compat)
    const rawSaldo = num(row?.saldo_final ?? row?.saldo, 0);

    if (codigo === "4003") return -Math.abs(rawSaldo);
    if (codigo.startsWith("4")) return Math.abs(rawSaldo);
    if (codigo.startsWith("5") || codigo.startsWith("6")) return Math.abs(rawSaldo);

    return rawSaldo;
  };

  const resolveNombreCuenta = (codigo: string) => {
    const c = normalizeCodigo(codigo);

    // 1) si el hook lo trae, úsalo
    const row = saldosPorCuenta[c] as any;
    const fromHook = String(row?.cuenta_nombre ?? "").trim();
    if (fromHook) return fromHook;

    // 2) catálogo exacto
    const exact = cuentasFlat.find((x: any) => String(x?.codigo ?? "").trim() === c);
    if (exact?.nombre) return String(exact.nombre);

    // 3) catálogo por padre (para subcuentas)
    const parent = c.split(/[-./]/)[0]?.trim();
    if (parent && parent !== c) {
      const p = cuentasFlat.find((x: any) => String(x?.codigo ?? "").trim() === parent);
      if (p?.nombre) return `Subcuenta de ${parent} — ${String(p.nombre)}`;
    }

    return "Cuenta";
  };

  // Tomamos códigos del catálogo; si el catálogo falla, fallback a saldos
  const codigosCatalogo = cuentasFlat
    .map((c: any) => String(c?.codigo ?? "").trim())
    .filter((x: string) => x);

  const codigosSaldos = Object.keys(saldosPorCuenta || {})
    .map((k) => String(k).trim())
    .filter(Boolean);

  const allCodigos = Array.from(new Set([...codigosCatalogo, ...codigosSaldos]));

  // ✅ SUMA por rangos usando baseNum para que NO se pierdan subcuentas
  const sumBy = (predicate: (baseNum: number, fullCode: string, baseCode: string) => boolean) => {
    let total = 0;
    for (const codigoStr of allCodigos) {
      const full = normalizeCodigo(codigoStr);
      const { base, baseNum } = splitCode(full);
      if (!Number.isFinite(baseNum)) continue;
      if (!predicate(baseNum, full, base)) continue;
      total += obtenerMontoPeriodoER(full);
    }
    return total;
  };

  // ✅ Clasificación por rangos (Ejecutivo)
  const totalIngresos = sumBy((n) => n >= 4000 && n <= 4999);
  const costoVentas = sumBy((n) => n >= 5000 && n <= 5099);
  const depreciaciones = sumBy((n, _full, base) => base === "5109" || base === "5110");
  const gastosOperativos = sumBy((n, _full, base) => n >= 5100 && n <= 5199 && base !== "5109" && base !== "5110");
  const otrosGastos = sumBy((n, _full, base) => n >= 5200 && n <= 5299 && base !== "5201");
  const costoFinanciero = sumBy((n, _full, base) => base === "5201" || (n >= 5111 && n <= 5199));
  const impuestos = sumBy((n) => n >= 6000 && n <= 6999);

  // ✅ Subtotales (cálculos)
  const utilidadBruta = totalIngresos - costoVentas;
  const ebitda = utilidadBruta - gastosOperativos - otrosGastos;
  const utilidadNeta = ebitda - depreciaciones - costoFinanciero - impuestos;

  // --------------------------
  // UI helpers (estilo limpio)
  // --------------------------
  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const pct = (value: number) => {
    if (!totalIngresos) return 0;
    return (value / totalIngresos) * 100;
  };

  const formatPct = (value: number) => `${pct(value).toFixed(1)}% Mg`;

  const Pill = ({
    children,
    tone = "emerald",
  }: {
    children: React.ReactNode;
    tone?: "emerald" | "blue" | "slate";
  }) => {
    const cls =
      tone === "blue"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200 border-blue-200 dark:border-blue-900"
        : tone === "slate"
        ? "bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200 border-slate-200 dark:border-slate-800"
        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900";
    return (
      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", cls)}>
        {children}
      </span>
    );
  };

  const KpiCard = ({
    title,
    value,
    rightPill,
    emphasize = false,
  }: {
    title: string;
    value: number;
    rightPill?: React.ReactNode;
    emphasize?: boolean;
  }) => {
    const positive = value >= 0;
    return (
      <div className="rounded-xl border bg-background p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs text-muted-foreground">{title}</div>
          {rightPill ? <div className="shrink-0">{rightPill}</div> : null}
        </div>

        <div
          className={cn(
            "mt-2 text-xl font-extrabold tracking-tight",
            emphasize ? "text-primary" : positive ? "text-foreground" : "text-rose-700 dark:text-rose-300"
          )}
        >
          {formatCurrency(value)}
        </div>

        <div className="mt-3 h-1 w-16 rounded-full bg-primary/70" />
      </div>
    );
  };

  const TableRowLine = ({
    label,
    value,
    isSection = false,
    isSubtotal = false,
    indent = 0,
    rightBadge,
  }: {
    label: string;
    value?: number;
    isSection?: boolean;
    isSubtotal?: boolean;
    indent?: number; // 0..2
    rightBadge?: React.ReactNode; // para margen en subtotales
  }) => {
    const v = Number(value ?? 0);
    const isNegative = v < 0;

    if (isSection) {
      return (
        <tr className="bg-muted/30">
          <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground" colSpan={3}>
            {label}
          </td>
        </tr>
      );
    }

    if (isSubtotal) {
      return (
        <tr className="bg-primary text-primary-foreground">
          <td className="px-4 py-3 font-semibold">{label}</td>

          <td className="px-4 py-3 text-right font-extrabold">{formatCurrency(v)}</td>

          <td className="px-4 py-3 text-right">
            <span className="inline-flex items-center justify-end gap-2">
              {rightBadge ? rightBadge : null}
              <span className="rounded-md bg-primary-foreground/15 px-2 py-0.5 text-xs font-semibold">
                {totalIngresos ? `${pct(v).toFixed(1)}%` : "0.0%"}
              </span>
            </span>
          </td>
        </tr>
      );
    }

    return (
      <tr className="border-b last:border-b-0">
        <td className="px-4 py-3">
          <div className={cn("flex items-center gap-2", indent === 1 ? "pl-4" : indent === 2 ? "pl-8" : "")}>
            <span className={cn("text-sm", "text-foreground")}>{label}</span>
          </div>
        </td>

        <td
          className={cn(
            "px-4 py-3 text-right font-semibold tabular-nums",
            isNegative ? "text-rose-700 dark:text-rose-300" : "text-foreground"
          )}
        >
          {formatCurrency(v)}
        </td>

        <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
          {totalIngresos ? `${pct(v).toFixed(1)}%` : "0.0%"}
        </td>
      </tr>
    );
  };

  // ✅ Armar listas por bloque (con subcuentas) para pintarlas en Ejecutivo
  const buildList = (predicate: (baseNum: number, fullCode: string, baseCode: string) => boolean) => {
    const rows: Array<{ code: string; name: string; baseNum: number; base: string; isSub: boolean; amount: number }> = [];

    for (const codigoStr of allCodigos) {
      const code = normalizeCodigo(codigoStr);
      if (!code) continue;

      const { base, baseNum } = splitCode(code);
      if (!Number.isFinite(baseNum)) continue;
      if (!predicate(baseNum, code, base)) continue;

      const amount = obtenerMontoPeriodoER(code);

      // En ejecutivo: mostramos solo cuentas con movimiento para que no se llene de ceros
      if (Math.abs(amount) < 0.0000001) continue;

      rows.push({
        code,
        name: resolveNombreCuenta(code),
        baseNum,
        base,
        isSub: isSubcuenta(code),
        amount,
      });
    }

    rows.sort((a, b) => {
      if (a.baseNum !== b.baseNum) return a.baseNum - b.baseNum;
      // para que 4001 salga antes que 4001-01
      if (a.base === b.base) return a.code.localeCompare(b.code);
      return a.base.localeCompare(b.base);
    });

    return rows;
  };

  const detalleIngresos = useMemo(() => buildList((n) => n >= 4000 && n <= 4999), [allCodigos.join("|")]);
  const detalleCostos = useMemo(() => buildList((n) => n >= 5000 && n <= 5099), [allCodigos.join("|")]);
  const detalleGastosOp = useMemo(
    () => buildList((n, _full, base) => n >= 5100 && n <= 5199 && base !== "5109" && base !== "5110"),
    [allCodigos.join("|")]
  );
  const detalleOtrosGastos = useMemo(
    () => buildList((n, _full, base) => n >= 5200 && n <= 5299 && base !== "5201"),
    [allCodigos.join("|")]
  );
  const detalleDep = useMemo(
    () => buildList((_n, _full, base) => base === "5109" || base === "5110"),
    [allCodigos.join("|")]
  );
  const detalleFin = useMemo(
    () => buildList((n, _full, base) => base === "5201" || (n >= 5111 && n <= 5199)),
    [allCodigos.join("|")]
  );
  const detalleImp = useMemo(() => buildList((n) => n >= 6000 && n <= 6999), [allCodigos.join("|")]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {utilidadNeta >= 0 ? (
            <TrendingUp className="h-7 w-7 text-emerald-600" />
          ) : (
            <TrendingDown className="h-7 w-7 text-rose-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">Formato ejecutivo</p>
            <p className="text-xs text-muted-foreground">{formatearPeriodo(startDate, endDate)}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDetalle((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted/40"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", showDetalle ? "rotate-180" : "rotate-0")} />
          {showDetalle ? "Ocultar detalle" : "Ver detalle"}
        </button>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard title="Ingresos Totales" value={totalIngresos} emphasize rightPill={<Pill tone="slate">100% base</Pill>} />
        <KpiCard
          title="Utilidad Bruta"
          value={utilidadBruta}
          rightPill={<Pill tone={utilidadBruta >= 0 ? "emerald" : "slate"}>{formatPct(utilidadBruta)}</Pill>}
        />
        <KpiCard title="EBITDA" value={ebitda} rightPill={<Pill tone={ebitda >= 0 ? "emerald" : "slate"}>{formatPct(ebitda)}</Pill>} />
        <KpiCard
          title="Utilidad Neta"
          value={utilidadNeta}
          rightPill={<Pill tone={utilidadNeta >= 0 ? "emerald" : "slate"}>{formatPct(utilidadNeta)}</Pill>}
        />
      </div>

      {/* Tabla */}
      <Card className="overflow-hidden border-2 border-primary/15">
        <CardHeader className="bg-muted/10">
          <CardTitle className="text-base">Análisis Mensual</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/20">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Concepto contable
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Monto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Análisis vertical
                  </th>
                </tr>
              </thead>

              <tbody>
                <TableRowLine label="Ingresos Operativos" isSection />
                {showDetalle
                  ? detalleIngresos.map((r) => (
                      <TableRowLine
                        key={`ing-${r.code}`}
                        label={`${r.code} — ${r.name}`}
                        value={r.amount}
                        indent={r.isSub ? 2 : 1}
                      />
                    ))
                  : null}
                <TableRowLine
                  label="Ingresos Totales"
                  value={totalIngresos}
                  isSubtotal
                  rightBadge={<span className="rounded-md bg-primary-foreground/15 px-2 py-0.5 text-xs font-semibold">100.0%</span>}
                />

                <TableRowLine label="Costos de Ventas (COGS)" isSection />
                {showDetalle
                  ? detalleCostos.map((r) => (
                      <TableRowLine
                        key={`cogs-${r.code}`}
                        label={`${r.code} — ${r.name}`}
                        value={-Math.abs(r.amount)}
                        indent={r.isSub ? 2 : 1}
                      />
                    ))
                  : null}
                <TableRowLine
                  label="Costo de Ventas"
                  value={-Math.abs(costoVentas)}
                  indent={1}
                />
                <TableRowLine
                  label="Utilidad Bruta"
                  value={utilidadBruta}
                  isSubtotal
                  rightBadge={<span className="rounded-md bg-primary-foreground/15 px-2 py-0.5 text-xs font-semibold">{formatPct(utilidadBruta)}</span>}
                />

                <TableRowLine label="Gastos Operativos (OPEX)" isSection />
                {showDetalle
                  ? detalleGastosOp.map((r) => (
                      <TableRowLine
                        key={`opex-${r.code}`}
                        label={`${r.code} — ${r.name}`}
                        value={-Math.abs(r.amount)}
                        indent={r.isSub ? 2 : 1}
                      />
                    ))
                  : null}
                <TableRowLine label="Gastos Operativos" value={-Math.abs(gastosOperativos)} indent={1} />

                {showDetalle
                  ? detalleOtrosGastos.map((r) => (
                      <TableRowLine
                        key={`otros-${r.code}`}
                        label={`${r.code} — ${r.name}`}
                        value={-Math.abs(r.amount)}
                        indent={r.isSub ? 2 : 1}
                      />
                    ))
                  : null}
                <TableRowLine label="Otros Gastos" value={-Math.abs(otrosGastos)} indent={1} />

                <TableRowLine
                  label="EBITDA"
                  value={ebitda}
                  isSubtotal
                  rightBadge={<span className="rounded-md bg-primary-foreground/15 px-2 py-0.5 text-xs font-semibold">{formatPct(ebitda)}</span>}
                />

                {showDetalle
                  ? detalleDep.map((r) => (
                      <TableRowLine
                        key={`dep-${r.code}`}
                        label={`${r.code} — ${r.name}`}
                        value={-Math.abs(r.amount)}
                        indent={r.isSub ? 2 : 1}
                      />
                    ))
                  : null}
                <TableRowLine label="Depreciación y Amortización" value={-Math.abs(depreciaciones)} indent={1} />

                {showDetalle
                  ? detalleFin.map((r) => (
                      <TableRowLine
                        key={`fin-${r.code}`}
                        label={`${r.code} — ${r.name}`}
                        value={-Math.abs(r.amount)}
                        indent={r.isSub ? 2 : 1}
                      />
                    ))
                  : null}
                <TableRowLine label="Costo Financiero" value={-Math.abs(costoFinanciero)} indent={1} />

                {showDetalle
                  ? detalleImp.map((r) => (
                      <TableRowLine
                        key={`imp-${r.code}`}
                        label={`${r.code} — ${r.name}`}
                        value={-Math.abs(r.amount)}
                        indent={r.isSub ? 2 : 1}
                      />
                    ))
                  : null}
                <TableRowLine label="Impuestos" value={-Math.abs(impuestos)} indent={1} />

                <TableRowLine
                  label="Utilidad Neta del Ejercicio"
                  value={utilidadNeta}
                  isSubtotal
                  rightBadge={<span className="rounded-md bg-primary-foreground/15 px-2 py-0.5 text-xs font-semibold">{formatPct(utilidadNeta)}</span>}
                />
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EstadoResultadosEjecutivo;
