import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { PeriodType } from "@/pages/EstadoResultados";

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
};

function num(v: any, def = 0) {
  if (v == null) return def;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : def;
}

const EstadoResultadosEjecutivo = ({ startDate, endDate }: EstadoResultadosEjecutivoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();
  const { data: asientosData, isLoading: asientosLoading } = useAsientosBalanza(startDate, endDate);

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

  /**
   * ✅ Monto “del período” para ER
   * - 4xxx (Ingresos): normalmente crédito => (haber - debe) positivo
   * - 5xxx/6xxx (Costos/Gastos/Impuestos): normalmente débito => (debe - haber) positivo
   * - fallback: usa saldo_final/saldo con reglas de signo “suaves”
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
        // ingresos
        // 4003 (Descuentos sobre ventas) debe verse negativo en ER
        if (codigo === "4003") return -Math.abs(haber - debe);
        return Math.abs(haber - debe);
      }
      if (codigo.startsWith("5") || codigo.startsWith("6")) {
        return Math.abs(debe - haber);
      }
      // fallback por si llega otro código raro
      return Math.abs(debe - haber);
    }

    // 2) fallback: saldo_final/saldo (compat)
    const rawSaldo = num(row?.saldo_final ?? row?.saldo, 0);

    // 4003: Descuentos sobre ventas (contra cuenta)
    if (codigo === "4003") return -Math.abs(rawSaldo);

    // 4xxx en muchos motores viene negativo (acreedor), lo hacemos positivo
    if (codigo.startsWith("4")) return Math.abs(rawSaldo);

    // 5/6 normalmente deudoras (gasto/costo) -> positivo
    if (codigo.startsWith("5") || codigo.startsWith("6")) return Math.abs(rawSaldo);

    return rawSaldo;
  };

  // Tomamos códigos del catálogo; si el catálogo falla, fallback a saldos
  const codigosCatalogo = cuentasFlat
    .map((c: any) => String(c?.codigo ?? "").trim())
    .filter((x: string) => x);

  const codigosSaldos = Object.keys(saldosPorCuenta || {}).map((k) => String(k).trim()).filter(Boolean);
  const allCodigos = Array.from(new Set([...codigosCatalogo, ...codigosSaldos]));

  const sumBy = (predicate: (codigoNum: number, codigoStr: string) => boolean) => {
    let total = 0;
    for (const codigoStr of allCodigos) {
      const codigo = normalizeCodigo(codigoStr);
      const codigoNum = Number(codigo);
      if (!Number.isFinite(codigoNum)) continue;
      if (!predicate(codigoNum, codigo)) continue;
      total += obtenerMontoPeriodoER(codigo);
    }
    return total;
  };

  // ✅ Clasificación por rangos (como pide el cliente en Ejecutivo)
  const totalIngresos = sumBy((n) => n >= 4000 && n <= 4999);
  const costoVentas = sumBy((n) => n >= 5000 && n <= 5099);
  const depreciaciones = sumBy((n) => n === 5109 || n === 5110);
  const gastosOperativos = sumBy((n) => n >= 5100 && n <= 5199 && n !== 5109 && n !== 5110);
  const otrosGastos = sumBy((n) => n >= 5200 && n <= 5299 && n !== 5201);
  const costoFinanciero = sumBy((n) => n === 5201 || (n >= 5111 && n <= 5199));
  const impuestos = sumBy((n) => n >= 6000 && n <= 6999);

  // ✅ Subtotales (no son cuentas contables, son cálculos)
  const utilidadBruta = totalIngresos - costoVentas;
  const ebitda = utilidadBruta - gastosOperativos - otrosGastos;
  const ebit = ebitda - depreciaciones;
  const utilidadAntesImpuestos = ebit - costoFinanciero;
  const utilidadNeta = utilidadAntesImpuestos - impuestos;

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const formatPct = (value: number) => {
    if (!totalIngresos) return "0.00%";
    return `${((value / totalIngresos) * 100).toFixed(2)}%`;
  };

  const Badge = ({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "blue" | "emerald" }) => {
    const cls =
      tone === "emerald"
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
        : tone === "blue"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border-blue-200 dark:border-blue-900"
        : "bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200 border-slate-200 dark:border-slate-800";

    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
        {children}
      </span>
    );
  };

  const LineItem = ({
    label,
    value,
    kind = "normal",
    hint,
  }: {
    label: string;
    value: number;
    kind?: "normal" | "negative" | "subtotal" | "total";
    hint?: string;
  }) => {
    const isTotal = kind === "total";
    const isSubtotal = kind === "subtotal";
    const isNegative = kind === "negative";

    const color =
      isTotal
        ? value >= 0
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-rose-700 dark:text-rose-300"
        : isSubtotal
        ? value >= 0
          ? "text-blue-700 dark:text-blue-300"
          : "text-rose-700 dark:text-rose-300"
        : isNegative
        ? "text-slate-600 dark:text-slate-400"
        : "text-slate-800 dark:text-slate-200";

    const weight =
      isTotal ? "font-black text-xl" : isSubtotal ? "font-bold text-lg" : "font-medium";

    const rowBorder =
      isSubtotal || isTotal ? "border-t-2 border-slate-200 dark:border-slate-700 pt-4 mt-2" : "";

    const pct = formatPct(value);

    return (
      <div className={`grid grid-cols-3 gap-4 items-center py-2 ${rowBorder}`}>
        <div className="space-y-1">
          <div className={`flex items-center gap-2 ${weight} ${color}`}>
            <span>{label}</span>

            {isSubtotal && <Badge tone="blue">Subtotal</Badge>}
            {isTotal && <Badge tone="emerald">Resultado</Badge>}
            {isNegative && <Badge>Salida</Badge>}
          </div>

          {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}

          {isSubtotal ? (
            <div className="text-xs text-muted-foreground">
              Margen: <span className="font-semibold text-foreground">{pct}</span>
            </div>
          ) : null}
        </div>

        <div className={`text-right ${weight} ${color}`}>{formatCurrency(value)}</div>

        <div className={`text-right ${weight} ${color}`}>
          {isNegative && value !== 0 ? `(${pct})` : pct}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {utilidadNeta >= 0 ? (
          <TrendingUp className="h-8 w-8 text-emerald-600" />
        ) : (
          <TrendingDown className="h-8 w-8 text-rose-600" />
        )}
        <div>
          <p className="text-sm font-semibold text-foreground">Vista ejecutiva consolidada</p>
          <p className="text-xs text-muted-foreground">
            Subtotales calculados + márgenes sobre ingresos (como pide el formato ejecutivo)
          </p>
        </div>
      </div>

      <Card className="border-2 border-primary/20 overflow-hidden">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-2xl">Resumen Financiero</CardTitle>
          <p className="text-sm text-muted-foreground mt-2 font-medium">{formatearPeriodo(startDate, endDate)}</p>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">Total Ingresos</div>
              <div className="text-lg font-extrabold text-blue-700 dark:text-blue-300">
                {formatCurrency(totalIngresos)}
              </div>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">EBITDA</div>
              <div className={`text-lg font-extrabold ${ebitda >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                {formatCurrency(ebitda)}
              </div>
              <div className="text-xs text-muted-foreground">
                Margen: <span className="font-semibold text-foreground">{formatPct(ebitda)}</span>
              </div>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">Utilidad Neta</div>
              <div className={`text-lg font-extrabold ${utilidadNeta >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                {formatCurrency(utilidadNeta)}
              </div>
              <div className="text-xs text-muted-foreground">
                Margen: <span className="font-semibold text-foreground">{formatPct(utilidadNeta)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-4 pb-3 border-b border-slate-200 dark:border-slate-700 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
              <span>Concepto</span>
              <span className="text-right">Monto</span>
              <span className="text-right">% Ingresos</span>
            </div>

            <LineItem label="Total Ingresos" value={totalIngresos} kind="subtotal" hint="Suma de cuentas 4xxx (ingresos) del período" />

            <LineItem label="(-) Costo de Ventas" value={costoVentas} kind="negative" />
            <LineItem label="Utilidad Bruta" value={utilidadBruta} kind="subtotal" hint="Ingresos - Costo de Ventas" />

            <LineItem label="(-) Gastos Operativos" value={gastosOperativos} kind="negative" />
            <LineItem label="(-) Otros Gastos" value={otrosGastos} kind="negative" />
            <LineItem label="EBITDA" value={ebitda} kind="subtotal" hint="Utilidad Bruta - Gastos Operativos - Otros Gastos" />

            <LineItem label="(-) Depreciaciones y Amortizaciones" value={depreciaciones} kind="negative" />
            <LineItem label="EBIT (Utilidad Operativa)" value={ebit} kind="subtotal" hint="EBITDA - Depreciaciones/Amortizaciones" />

            <LineItem label="(-) Costo Financiero" value={costoFinanciero} kind="negative" />
            <LineItem label="Utilidad Antes de Impuestos" value={utilidadAntesImpuestos} kind="subtotal" hint="EBIT - Costo Financiero" />

            <LineItem label="(-) Impuestos" value={impuestos} kind="negative" />

            <LineItem
              label={utilidadNeta >= 0 ? "Utilidad Neta" : "Pérdida Neta"}
              value={utilidadNeta}
              kind="total"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EstadoResultadosEjecutivo;