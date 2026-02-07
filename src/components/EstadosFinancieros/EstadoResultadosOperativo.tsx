import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";

interface EstadoResultadosOperativoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
}

type SaldoCuenta = {
  cuenta_codigo?: string;

  // ✅ del hook E2E
  debe_total?: number;
  haber_total?: number;
  saldo_final?: number;

  // compat vieja
  saldo?: number;
};

function num(v: any, def = 0) {
  if (v == null) return def;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : def;
}

const EstadoResultadosOperativo = ({ startDate, endDate }: EstadoResultadosOperativoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();
  const { data: asientosData, isLoading: asientosLoading } = useAsientosBalanza(startDate, endDate);

  const formatearPeriodo = (start: Date, end: Date): string => {
    const formatoFecha = (fecha: Date) =>
      fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

    const fechaInicio = formatoFecha(start);
    const fechaFin = formatoFecha(end);

    if (start.toDateString() === end.toDateString()) return `Estado de Resultados del ${fechaInicio}`;
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
  const saldosPorCuenta: Record<string, SaldoCuenta> = (asientosData?.saldosPorCuenta || {}) as any;

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
   * ✅ Monto del PERÍODO (NO saldo acumulado raro)
   * - 4xxx: ingreso => (haber - debe) positivo
   * - 5xxx/6xxx: costo/gasto => (debe - haber) positivo
   * - 4003: descuentos sobre ventas => NEGATIVO
   * - fallback: saldo_final/saldo
   */
  const obtenerMontoPeriodoER = (codigoCuenta: string): number => {
    const codigo = normalizeCodigo(codigoCuenta);
    const alt = codigo.replace(/\s+/g, "");
    const row = saldosPorCuenta[codigo] ?? saldosPorCuenta[alt];

    const debe = num(row?.debe_total, NaN);
    const haber = num(row?.haber_total, NaN);

    // Preferimos debe/haber del período si están
    if (Number.isFinite(debe) && Number.isFinite(haber)) {
      if (codigo.startsWith("4")) {
        if (codigo === "4003") return -Math.abs(haber - debe);
        return Math.abs(haber - debe);
      }
      if (codigo.startsWith("5") || codigo.startsWith("6")) return Math.abs(debe - haber);
      return Math.abs(debe - haber);
    }

    // fallback
    const rawSaldo = num(row?.saldo_final ?? row?.saldo, 0);
    if (codigo === "4003") return -Math.abs(rawSaldo);
    if (codigo.startsWith("4")) return Math.abs(rawSaldo);
    if (codigo.startsWith("5") || codigo.startsWith("6")) return Math.abs(rawSaldo);
    return rawSaldo;
  };

  const codigosCatalogo = cuentasFlat.map((c: any) => String(c?.codigo ?? "").trim()).filter(Boolean);
  const codigosSaldos = Object.keys(saldosPorCuenta || {}).map((k) => String(k).trim()).filter(Boolean);
  const allCodigos = Array.from(new Set([...codigosCatalogo, ...codigosSaldos]));

  const cuentasPorRango = (predicate: (codigoNum: number) => boolean) => {
    const res: Array<{ codigo: string; nombre: string }> = [];

    for (const codigoStr of allCodigos) {
      const codigo = normalizeCodigo(codigoStr);
      const n = Number(codigo);
      if (!Number.isFinite(n)) continue;
      if (!predicate(n)) continue;

      const cuenta = cuentasFlat.find((c: any) => String(c?.codigo ?? "").trim() === codigo);
      res.push({
        codigo,
        nombre: String((cuenta as any)?.nombre ?? "Cuenta"),
      });
    }

    res.sort((a, b) => Number(a.codigo) - Number(b.codigo));
    return res;
  };

  const sumCuentas = (lista: Array<{ codigo: string }>) =>
    lista.reduce((acc, c) => acc + obtenerMontoPeriodoER(c.codigo), 0);

  // ✅ Definiciones por rangos
  const cuentasIngresos = cuentasPorRango((n) => n >= 4000 && n <= 4999);
  const cuentasCostos = cuentasPorRango((n) => n >= 5000 && n <= 5099);
  const cuentasDepreciaciones = cuentasPorRango((n) => n === 5109 || n === 5110);
  const cuentasGastosOperativos = cuentasPorRango((n) => n >= 5100 && n <= 5199 && n !== 5109 && n !== 5110);
  const cuentasOtrosGastos = cuentasPorRango((n) => n >= 5200 && n <= 5299 && n !== 5201);
  const cuentasCostoFinanciero = cuentasPorRango((n) => n === 5201 || (n >= 5111 && n <= 5199));
  const cuentasImpuestos = cuentasPorRango((n) => n >= 6000 && n <= 6999);

  const totalIngresos = sumCuentas(cuentasIngresos);
  const totalCostos = sumCuentas(cuentasCostos);
  const totalGastosOperativos = sumCuentas(cuentasGastosOperativos);
  const totalOtrosGastos = sumCuentas(cuentasOtrosGastos);
  const totalDepreciaciones = sumCuentas(cuentasDepreciaciones);
  const totalCostoFinanciero = sumCuentas(cuentasCostoFinanciero);
  const totalImpuestos = sumCuentas(cuentasImpuestos);

  const utilidadBruta = totalIngresos - totalCostos;
  const ebitda = utilidadBruta - totalGastosOperativos - totalOtrosGastos;
  const ebit = ebitda - totalDepreciaciones;
  const utilidadAntesImpuestos = ebit - totalCostoFinanciero;
  const utilidadNeta = utilidadAntesImpuestos - totalImpuestos;

  const money = (n: number) =>
    `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct = (n: number) => (totalIngresos !== 0 ? `${((n / totalIngresos) * 100).toFixed(2)}%` : "0.00%");

  const Pill = ({
    children,
    tone = "slate",
  }: {
    children: React.ReactNode;
    tone?: "slate" | "green" | "orange" | "red" | "blue" | "purple" | "amber" | "rose";
  }) => {
    const cls =
      tone === "green"
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/25 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
        : tone === "orange"
        ? "bg-orange-50 text-orange-700 dark:bg-orange-950/25 dark:text-orange-300 border-orange-200 dark:border-orange-900"
        : tone === "red"
        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/25 dark:text-rose-300 border-rose-200 dark:border-rose-900"
        : tone === "blue"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/25 dark:text-blue-300 border-blue-200 dark:border-blue-900"
        : tone === "purple"
        ? "bg-purple-50 text-purple-700 dark:bg-purple-950/25 dark:text-purple-300 border-purple-200 dark:border-purple-900"
        : tone === "amber"
        ? "bg-amber-50 text-amber-800 dark:bg-amber-950/25 dark:text-amber-300 border-amber-200 dark:border-amber-900"
        : tone === "rose"
        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/25 dark:text-rose-300 border-rose-200 dark:border-rose-900"
        : "bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200 border-slate-200 dark:border-slate-800";

    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
        {children}
      </span>
    );
  };

  const EmptyNice = ({ text }: { text: string }) => (
    <div className="py-6 text-sm text-muted-foreground">
      <div className="rounded-lg border bg-muted/20 p-4">{text}</div>
    </div>
  );

  const Row = ({ codigo, nombre }: { codigo: string; nombre: string }) => {
    const monto = obtenerMontoPeriodoER(codigo);
    const isNeg = monto < 0;
    return (
      <div className="grid grid-cols-3 gap-4 items-center py-2 px-2 rounded-md hover:bg-muted/40 transition">
        <span className="text-sm">
          <span className="font-semibold text-foreground">{codigo}</span>{" "}
          <span className="text-muted-foreground">—</span> {nombre}
        </span>

        <span className={`font-medium text-right ${isNeg ? "text-rose-700 dark:text-rose-300" : "text-foreground"}`}>
          {money(monto)}
        </span>

        <span className="text-right text-sm text-muted-foreground">{pct(monto)}</span>
      </div>
    );
  };

  const Section = ({
    title,
    tone,
    subtitle,
    rows,
    totalLabel,
    totalValue,
  }: {
    title: string;
    tone: "green" | "orange" | "red" | "purple" | "amber" | "rose";
    subtitle?: string;
    rows: Array<{ codigo: string; nombre: string }>;
    totalLabel: string;
    totalValue: number;
  }) => {
    return (
      <Card className="border-2 border-primary/10 overflow-hidden">
        <CardHeader className="bg-muted/40">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{title}</CardTitle>
                <Pill tone={tone}>{title.includes("(4") ? "Ingresos" : title.includes("(50") ? "Costos" : "Detalle"}</Pill>
              </div>
              {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>

            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className={`text-xl font-black ${tone === "green" ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
                {money(totalValue)}
              </div>
              <div className="text-xs text-muted-foreground">{pct(totalValue)}</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 pb-2 border-b text-xs font-semibold text-muted-foreground">
            <span>Cuenta</span>
            <span className="text-right">Monto</span>
            <span className="text-right">% Ingresos</span>
          </div>

          <div className="mt-2">
            {rows.length ? rows.map((c) => <Row key={c.codigo} codigo={c.codigo} nombre={c.nombre} />) : <EmptyNice text="No hay cuentas con movimientos en este bloque para el rango seleccionado." />}
          </div>

          <div className="border-t pt-3 mt-4">
            <div className={`grid grid-cols-3 gap-4 items-center font-bold`}>
              <span className="text-sm">{totalLabel}</span>
              <span className="text-right">{money(totalValue)}</span>
              <span className="text-right text-muted-foreground">{pct(totalValue)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header PRO */}
      <Card className="border-2 border-primary/20 overflow-hidden">
        <CardHeader className="bg-primary/5">
          <div className="space-y-2">
            <CardTitle className="text-2xl text-center">Estado de Resultados — Formato Operativo</CardTitle>
            <p className="text-sm text-muted-foreground text-center font-medium">{formatearPeriodo(startDate, endDate)}</p>

            {/* KPIs */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Total Ingresos</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{money(totalIngresos)}</p>
                <p className="text-xs text-muted-foreground">100.00%</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Costos</p>
                <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{money(totalCostos)}</p>
                <p className="text-xs text-muted-foreground">{pct(totalCostos)}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Utilidad Bruta</p>
                <p className={`text-lg font-bold ${utilidadBruta >= 0 ? "text-blue-700 dark:text-blue-300" : "text-rose-700 dark:text-rose-300"}`}>
                  {money(utilidadBruta)}
                </p>
                <p className="text-xs text-muted-foreground">{pct(utilidadBruta)}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">EBITDA</p>
                <p className={`text-lg font-bold ${ebitda >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                  {money(ebitda)}
                </p>
                <p className="text-xs text-muted-foreground">{pct(ebitda)}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">EBIT</p>
                <p className={`text-lg font-bold ${ebit >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                  {money(ebit)}
                </p>
                <p className="text-xs text-muted-foreground">{pct(ebit)}</p>
              </div>

              <div
                className={`p-3 rounded-lg border-2 ${
                  utilidadNeta >= 0
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900"
                    : "bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900"
                }`}
              >
                <p className="text-xs text-muted-foreground font-semibold">UTILIDAD NETA</p>
                <p className={`text-xl font-black ${utilidadNeta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{money(utilidadNeta)}</p>
                <p className="text-xs font-bold text-muted-foreground">{pct(utilidadNeta)}</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Alert className="border-primary/20">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Este Estado de Resultados refleja automáticamente todas las transacciones registradas: ingresos, costos, gastos,
          depreciaciones, costo financiero e impuestos.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        <Section
          title="Ingresos (4xxx)"
          tone="green"
          subtitle="Detalle por cuenta (monto del período)"
          rows={cuentasIngresos}
          totalLabel="Total Ingresos"
          totalValue={totalIngresos}
        />

        <Section
          title="Costos de Ventas (50xx)"
          tone="orange"
          subtitle="Detalle por cuenta (monto del período)"
          rows={cuentasCostos}
          totalLabel="Total Costos"
          totalValue={totalCostos}
        />

        {/* Utilidad Bruta (bloque de cálculo) */}
        <Card className="border-2 border-primary/10 overflow-hidden">
          <CardHeader className="bg-muted/40">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Utilidad Bruta</CardTitle>
                  <Pill tone={utilidadBruta >= 0 ? "blue" : "rose"}>Subtotal</Pill>
                </div>
                <p className="text-xs text-muted-foreground">Ingresos - Costos</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Margen</div>
                <div className={`text-xl font-black ${utilidadBruta >= 0 ? "text-blue-700 dark:text-blue-300" : "text-rose-700 dark:text-rose-300"}`}>
                  {pct(utilidadBruta)}
                </div>
                <div className="text-xs text-muted-foreground">{money(utilidadBruta)}</div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 pb-2 border-b text-xs font-semibold text-muted-foreground">
              <span>Concepto</span>
              <span className="text-right">Monto</span>
              <span className="text-right">% Ingresos</span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="grid grid-cols-3 gap-4 items-center py-2 px-2 rounded-md hover:bg-muted/40 transition">
                <span className="text-sm">Ingresos</span>
                <span className="text-right font-medium">{money(totalIngresos)}</span>
                <span className="text-right text-sm text-muted-foreground">100.00%</span>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center py-2 px-2 rounded-md hover:bg-muted/40 transition">
                <span className="text-sm">(-) Costos</span>
                <span className="text-right font-medium text-orange-700 dark:text-orange-300">
                  ({money(totalCostos)})
                </span>
                <span className="text-right text-sm text-muted-foreground">
                  {totalIngresos ? `(${((totalCostos / totalIngresos) * 100).toFixed(2)}%)` : "0.00%"}
                </span>
              </div>

              <div className="border-t pt-3 mt-3">
                <div className={`grid grid-cols-3 gap-4 items-center font-bold ${utilidadBruta >= 0 ? "text-blue-700 dark:text-blue-300" : "text-rose-700 dark:text-rose-300"}`}>
                  <span>Utilidad Bruta</span>
                  <span className="text-right">{money(utilidadBruta)}</span>
                  <span className="text-right text-muted-foreground">{pct(utilidadBruta)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Section
          title="Gastos Operativos (51xx)"
          tone="red"
          subtitle="Detalle por cuenta (monto del período)"
          rows={cuentasGastosOperativos}
          totalLabel="Total Gastos Operativos"
          totalValue={totalGastosOperativos}
        />

        <Section
          title="Otros Gastos (52xx)"
          tone="red"
          subtitle="Detalle por cuenta (monto del período)"
          rows={cuentasOtrosGastos}
          totalLabel="Total Otros Gastos"
          totalValue={totalOtrosGastos}
        />

        {/* EBITDA (cálculo) */}
        <Card className="border-2 border-primary/10 overflow-hidden">
          <CardHeader className="bg-muted/40">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">EBITDA</CardTitle>
                  <Pill tone={ebitda >= 0 ? "green" : "rose"}>Subtotal</Pill>
                </div>
                <p className="text-xs text-muted-foreground">Utilidad Bruta - Gastos Operativos - Otros Gastos</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Margen</div>
                <div className={`text-xl font-black ${ebitda >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                  {pct(ebitda)}
                </div>
                <div className="text-xs text-muted-foreground">{money(ebitda)}</div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 pb-2 border-b text-xs font-semibold text-muted-foreground">
              <span>Concepto</span>
              <span className="text-right">Monto</span>
              <span className="text-right">% Ingresos</span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="grid grid-cols-3 gap-4 items-center py-2 px-2 rounded-md hover:bg-muted/40 transition">
                <span className="text-sm">Utilidad Bruta</span>
                <span className="text-right font-medium">{money(utilidadBruta)}</span>
                <span className="text-right text-sm text-muted-foreground">{pct(utilidadBruta)}</span>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center py-2 px-2 rounded-md hover:bg-muted/40 transition">
                <span className="text-sm">(-) Gastos Operativos</span>
                <span className="text-right font-medium text-rose-700 dark:text-rose-300">
                  ({money(totalGastosOperativos)})
                </span>
                <span className="text-right text-sm text-muted-foreground">
                  {totalIngresos ? `(${((totalGastosOperativos / totalIngresos) * 100).toFixed(2)}%)` : "0.00%"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center py-2 px-2 rounded-md hover:bg-muted/40 transition">
                <span className="text-sm">(-) Otros Gastos</span>
                <span className="text-right font-medium text-rose-700 dark:text-rose-300">
                  ({money(totalOtrosGastos)})
                </span>
                <span className="text-right text-sm text-muted-foreground">
                  {totalIngresos ? `(${((totalOtrosGastos / totalIngresos) * 100).toFixed(2)}%)` : "0.00%"}
                </span>
              </div>

              <div className="border-t pt-3 mt-3">
                <div className={`grid grid-cols-3 gap-4 items-center font-bold ${ebitda >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                  <span>EBITDA</span>
                  <span className="text-right">{money(ebitda)}</span>
                  <span className="text-right text-muted-foreground">{pct(ebitda)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Section
          title="Depreciaciones y Amortizaciones (5109/5110)"
          tone="purple"
          subtitle="Detalle por cuenta (monto del período)"
          rows={cuentasDepreciaciones}
          totalLabel="Total Depreciaciones"
          totalValue={totalDepreciaciones}
        />

        <Section
          title="Costo Financiero (5201)"
          tone="amber"
          subtitle="Detalle por cuenta (monto del período)"
          rows={cuentasCostoFinanciero}
          totalLabel="Total Costo Financiero"
          totalValue={totalCostoFinanciero}
        />

        <Section
          title="Impuestos (6xxx)"
          tone="rose"
          subtitle="Detalle por cuenta (monto del período)"
          rows={cuentasImpuestos}
          totalLabel="Total Impuestos"
          totalValue={totalImpuestos}
        />

        {/* Utilidad Neta */}
        <Card className="border-2 border-primary overflow-hidden">
          <CardHeader className="bg-primary/5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="space-y-1">
                <CardTitle className="text-lg">Utilidad Neta del Período</CardTitle>
                <p className="text-xs text-muted-foreground">Utilidad antes de impuestos - impuestos</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Margen neto</div>
                <div className={`text-2xl font-black ${utilidadNeta >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                  {pct(utilidadNeta)}
                </div>
                <div className="text-xs text-muted-foreground">{money(utilidadNeta)}</div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 pb-2 border-b text-xs font-semibold text-muted-foreground">
              <span>Concepto</span>
              <span className="text-right">Monto</span>
              <span className="text-right">% Ingresos</span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="grid grid-cols-3 gap-4 items-center py-2 px-2 rounded-md hover:bg-muted/40 transition">
                <span className="text-sm">Utilidad Antes de Impuestos</span>
                <span className="text-right font-medium">{money(utilidadAntesImpuestos)}</span>
                <span className="text-right text-sm text-muted-foreground">{pct(utilidadAntesImpuestos)}</span>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center py-2 px-2 rounded-md hover:bg-muted/40 transition">
                <span className="text-sm">(-) Impuestos</span>
                <span className="text-right font-medium text-rose-700 dark:text-rose-300">({money(totalImpuestos)})</span>
                <span className="text-right text-sm text-muted-foreground">
                  {totalIngresos ? `(${((totalImpuestos / totalIngresos) * 100).toFixed(2)}%)` : "0.00%"}
                </span>
              </div>

              <div className="border-t-2 pt-3 mt-3">
                <div className={`grid grid-cols-3 gap-4 items-center font-black text-xl ${utilidadNeta >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                  <span>{utilidadNeta >= 0 ? "Utilidad Neta" : "Pérdida Neta"}</span>
                  <span className="text-right">{money(utilidadNeta)}</span>
                  <span className="text-right text-muted-foreground">{pct(utilidadNeta)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EstadoResultadosOperativo;
