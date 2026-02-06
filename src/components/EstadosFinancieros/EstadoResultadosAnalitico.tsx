// bukipin-dashboard/src/components/EstadosFinancieros/EstadoResultadosAnalitico.tsx
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2 } from "lucide-react";
import { PeriodType } from "@/pages/EstadoResultados";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

// Si ya tienes Collapsible en tu proyecto shadcn, úsalo.
// Si no, puedes borrar este bloque y el panel de diagnóstico seguirá funcionando sin colapsar.
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface EstadoResultadosAnaliticoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
}

type CuentaFlat = {
  _id?: string;
  id?: string;
  codigo: string;
  nombre: string;
  code?: string;
  name?: string;

  estado_financiero?: string;
  estadoFinanciero?: string;

  grupo?: string;
  subgrupo?: string;

  // relación con subcuentas (pueden venir en distintas llaves)
  parentCode?: string | null;
  parent_code?: string | null;
  parentCodigo?: string | null;
  parent_codigo?: string | null;
  parentId?: string | null;
  parent_id?: string | null;
};

type SaldoCuentaHook = {
  cuenta_codigo: string;
  saldo_inicial: number;
  debe_total: number;
  haber_total: number;
  saldo_final: number;
};

interface WaterfallData {
  name: string;
  // offset invisible
  value: number;
  // barra visible
  start: number;
  fill: string;
  isTotal: boolean;
}

function isER(c: CuentaFlat) {
  const ef = c.estado_financiero ?? c.estadoFinanciero ?? "";
  return ef === "Estado de Resultados";
}

function getCodigo(c: CuentaFlat) {
  return String(c.codigo ?? c.code ?? "").trim();
}

function getNombre(c: CuentaFlat) {
  return String(c.nombre ?? c.name ?? "").trim();
}

function getParentCode(c: CuentaFlat): string | null {
  const v =
    c.parentCode ??
    c.parent_code ??
    c.parentCodigo ??
    c.parent_codigo ??
    null;
  return v ? String(v) : null;
}

function clampNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Reporte ER “humano”:
 * - 4xxx (Ingresos): contabilidad suele ser crédito => (debe - haber) negativo.
 *   => lo mostramos como positivo: (haber - debe)
 * - 5xxx / 6xxx (Costos/Gastos/Impuestos): suelen ser débito => (debe - haber) positivo.
 *   => lo mostramos como positivo: (debe - haber)
 */
function montoPeriodoER(codigo: string, row?: SaldoCuentaHook | null) {
  const debe = clampNum(row?.debe_total);
  const haber = clampNum(row?.haber_total);
  const neto = debe - haber; // neto contable
  const code = String(codigo || "");
  if (code.startsWith("4")) return haber - debe; // ingresos positivos
  if (code.startsWith("5")) return neto; // egresos positivos
  if (code.startsWith("6")) return neto; // egresos positivos
  // fallback: magnitud (evita signos “raros” por catálogo)
  return Math.abs(neto);
}

function formatCurrencyMX(value: number) {
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

const EstadoResultadosAnalitico = ({
  startDate,
  endDate,
  periodType,
}: EstadoResultadosAnaliticoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();

  // ✅ Fuente de verdad E2E (ya calculas saldosPorCuenta en el hook)
  const {
    data: balanzaData,
    isLoading: balanzaLoading,
    isError: balanzaIsError,
    error: balanzaError,
  } = useAsientosBalanza(startDate, endDate);

  // Filtros del analítico
  const [mostrarSubtotales, setMostrarSubtotales] = useState(true);

  // Filtro 1: Rubro ejecutivo
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string>("");

  // Filtro 2: Cuenta padre dentro del rubro
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>("__all__");

  // Diagnóstico colapsable (no ensucia UI)
  const [debugOpen, setDebugOpen] = useState(false);

  const cuentasFlat: CuentaFlat[] = useMemo(() => {
    const cf = (cuentasData?.cuentasFlat ?? []) as CuentaFlat[];
    return Array.isArray(cf) ? cf : [];
  }, [cuentasData]);

  const saldosPorCuenta = useMemo(() => {
    return (balanzaData?.saldosPorCuenta ?? {}) as Record<string, SaldoCuentaHook>;
  }, [balanzaData]);

  const movimientosCount = balanzaData?.movimientos?.length ?? 0;
  const cuentasConSaldoCount = Object.keys(saldosPorCuenta || {}).length;

  // Loading
  if (cuentasLoading || balanzaLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Error
  if (balanzaIsError) {
    const msg =
      (balanzaError as any)?.message ??
      "Error cargando asientos para Estado de Resultados.";
    return (
      <Card>
        <CardContent className="p-10">
          <div className="space-y-2">
            <p className="text-lg font-semibold">No se pudo cargar Estado de Resultados</p>
            <p className="text-sm text-muted-foreground">{msg}</p>
            <p className="text-xs text-muted-foreground">
              Tip: valida que{" "}
              <code className="px-1 py-0.5 rounded bg-muted">/api/asientos/detalle</code>{" "}
              responda 200 en el rango seleccionado.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si no hay datos en el rango
  if (!cuentasConSaldoCount) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center space-y-2">
            <p className="text-xl font-medium text-muted-foreground">
              No hay datos financieros en el rango seleccionado
            </p>
            <p className="text-sm text-muted-foreground">
              No se detectaron movimientos contables para construir el Estado de Resultados.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Función para formatear período
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

  // ====== Catálogo ER ======
  const cuentasER = useMemo(() => cuentasFlat.filter((c) => isER(c)), [cuentasFlat]);

  const cuentasVentas = useMemo(
    () => cuentasER.filter((c) => (c.subgrupo ?? "").trim() === "Ingresos por Ventas"),
    [cuentasER]
  );

  const cuentasOtrosIngresos = useMemo(
    () => cuentasER.filter((c) => (c.subgrupo ?? "").trim() === "Otros Ingresos"),
    [cuentasER]
  );

  const cuentasCostos = useMemo(
    () =>
      cuentasER.filter((c) => {
        const n = parseInt(getCodigo(c), 10);
        return Number.isFinite(n) && n >= 5001 && n <= 5099;
      }),
    [cuentasER]
  );

  const cuentasGastosOperativos = useMemo(
    () => cuentasER.filter((c) => (c.subgrupo ?? "").trim() === "Gastos de Operación"),
    [cuentasER]
  );

  const cuentasOtrosGastos = useMemo(
    () => cuentasER.filter((c) => (c.subgrupo ?? "").trim() === "Otros Gastos"),
    [cuentasER]
  );

  const cuentasDepreciaciones = useMemo(
    () =>
      cuentasER.filter((c) => {
        const n = parseInt(getCodigo(c), 10);
        return n === 5109 || n === 5110;
      }),
    [cuentasER]
  );

  const cuentasCostoFinanciero = useMemo(
    () =>
      cuentasER.filter((c) => {
        const n = parseInt(getCodigo(c), 10);
        return (n >= 5111 && n <= 5199) || n === 5201;
      }),
    [cuentasER]
  );

  const cuentasImpuestos = useMemo(
    () => cuentasER.filter((c) => getCodigo(c).startsWith("6")),
    [cuentasER]
  );

  // ====== Totales (usando saldosPorCuenta del hook) ======
  const sumCuentas = (arr: CuentaFlat[]) =>
    arr.reduce((t, c) => {
      const code = getCodigo(c);
      const row = saldosPorCuenta[code];
      const v = montoPeriodoER(code, row);
      return t + (Number.isFinite(v) ? v : 0);
    }, 0);

  const totalVentas = sumCuentas(cuentasVentas);
  const totalOtrosIngresos = sumCuentas(cuentasOtrosIngresos);
  const totalIngresos = totalVentas + totalOtrosIngresos;

  const costoVentas = sumCuentas(cuentasCostos);
  const gastosOperativos = sumCuentas(cuentasGastosOperativos);
  const otrosGastos = sumCuentas(cuentasOtrosGastos);
  const depreciaciones = sumCuentas(cuentasDepreciaciones);
  const costoFinanciero = sumCuentas(cuentasCostoFinanciero);
  const impuestos = sumCuentas(cuentasImpuestos);

  // Subtotales
  const utilidadBruta = totalIngresos - costoVentas;
  const ebitda = utilidadBruta - gastosOperativos - otrosGastos;
  const ebit = ebitda - depreciaciones;
  const utilidadAntesImpuestos = ebit - costoFinanciero;
  const utilidadNeta = utilidadAntesImpuestos - impuestos;

  // Márgenes
  const margenBruto = totalIngresos > 0 ? (utilidadBruta / totalIngresos) * 100 : 0;
  const margenEBITDA = totalIngresos > 0 ? (ebitda / totalIngresos) * 100 : 0;
  const margenEBIT = totalIngresos > 0 ? (ebit / totalIngresos) * 100 : 0;
  const margenAntesImpuestos =
    totalIngresos > 0 ? (utilidadAntesImpuestos / totalIngresos) * 100 : 0;
  const margenNeto = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0;

  // ====== Rubros (Executive buckets) ======
  const rubros = useMemo(() => {
    const items = [
      { id: "ventas", nombre: "Ingresos — Ventas", cuentas: cuentasVentas },
      { id: "otros_ingresos", nombre: "Ingresos — Otros Ingresos", cuentas: cuentasOtrosIngresos },
      { id: "costo_ventas", nombre: "Costos — Costo de Ventas", cuentas: cuentasCostos },
      { id: "gastos_operativos", nombre: "Gastos — Gastos Operativos", cuentas: cuentasGastosOperativos },
      { id: "otros_gastos", nombre: "Gastos — Otros Gastos", cuentas: cuentasOtrosGastos },
      { id: "depreciaciones", nombre: "Depreciaciones", cuentas: cuentasDepreciaciones },
      { id: "costo_financiero", nombre: "Costo Financiero", cuentas: cuentasCostoFinanciero },
      { id: "impuestos", nombre: "Impuestos", cuentas: cuentasImpuestos },
    ];

    return items
      .map((r) => {
        const total = sumCuentas(r.cuentas);
        return { ...r, total };
      })
      .filter((r) => r.total !== 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cuentasVentas,
    cuentasOtrosIngresos,
    cuentasCostos,
    cuentasGastosOperativos,
    cuentasOtrosGastos,
    cuentasDepreciaciones,
    cuentasCostoFinanciero,
    cuentasImpuestos,
    saldosPorCuenta,
  ]);

  // Default rubro (sin setState en render)
  useEffect(() => {
    if (!rubroSeleccionado && rubros.length > 0) {
      setRubroSeleccionado(rubros[0].id);
      setCuentaSeleccionada("__all__");
    }
  }, [rubroSeleccionado, rubros]);

  // Si cambia rubro => reset cuenta
  useEffect(() => {
    setCuentaSeleccionada("__all__");
  }, [rubroSeleccionado]);

  const rubroActual = useMemo(
    () => rubros.find((r) => r.id === rubroSeleccionado) ?? null,
    [rubros, rubroSeleccionado]
  );

  // Padres del rubro
  const cuentasPadreDelRubro = useMemo(() => {
    if (!rubroActual) return [];
    const padres = rubroActual.cuentas
      .filter((c) => !getParentCode(c))
      .map((c) => {
        const code = getCodigo(c);
        const row = saldosPorCuenta[code];
        const saldo = montoPeriodoER(code, row);
        return { codigo: code, nombre: getNombre(c), saldo };
      })
      .filter((x) => x.saldo !== 0)
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
    return padres;
  }, [rubroActual, saldosPorCuenta]);

  // fallback si catálogo no trae parentCode
  const cuentasDirectasDelRubro = useMemo(() => {
    if (!rubroActual) return [];
    return rubroActual.cuentas
      .map((c) => {
        const code = getCodigo(c);
        const row = saldosPorCuenta[code];
        const saldo = montoPeriodoER(code, row);
        return {
          codigo: code,
          nombre: getNombre(c),
          saldo,
          parentCode: getParentCode(c),
        };
      })
      .filter((x) => x.saldo !== 0)
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
  }, [rubroActual, saldosPorCuenta]);

  // Subcuentas / desglose
  const subcuentasDeCuentaSeleccionada = useMemo(() => {
    if (!rubroActual) return [];

    // “Todas”: mostrar por cuenta (padre si existe)
    if (cuentaSeleccionada === "__all__") {
      const base = cuentasPadreDelRubro.length ? cuentasPadreDelRubro : cuentasDirectasDelRubro;
      return base
        .map((x) => ({
          key: x.codigo,
          nombre: `${x.codigo} - ${x.nombre}`,
          valor: x.saldo,
        }))
        .filter((x) => x.valor !== 0)
        .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
    }

    // subcuentas cuyo parentCode == cuentaSeleccionada
    const subs = rubroActual.cuentas
      .filter((c) => (getParentCode(c) ?? "") === cuentaSeleccionada)
      .map((c) => {
        const code = getCodigo(c);
        const row = saldosPorCuenta[code];
        const valor = montoPeriodoER(code, row);
        return {
          key: code,
          nombre: `${code} - ${getNombre(c)}`,
          valor,
        };
      })
      .filter((x) => x.valor !== 0)
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

    // si no hay subcuentas => “Sin subcuenta”
    if (!subs.length) {
      const padre =
        cuentasPadreDelRubro.find((p) => p.codigo === cuentaSeleccionada) ??
        cuentasDirectasDelRubro.find((p) => p.codigo === cuentaSeleccionada);

      const v = padre?.saldo ?? 0;
      if (!v) return [];
      return [
        {
          key: "__no_sub__",
          nombre: "Sin subcuenta asignada",
          valor: v,
        },
      ];
    }

    return subs;
  }, [
    rubroActual,
    cuentaSeleccionada,
    cuentasPadreDelRubro,
    cuentasDirectasDelRubro,
    saldosPorCuenta,
  ]);

  // Datos para barras
  const datosBarras = useMemo(() => {
    return subcuentasDeCuentaSeleccionada.map((d) => ({
      nombre: d.nombre,
      valor: d.valor,
    }));
  }, [subcuentasDeCuentaSeleccionada]);

  // ====== Waterfall ======
  const waterfallData: WaterfallData[] = useMemo(() => {
    const data: WaterfallData[] = [];

    const pushTotal = (label: string, total: number, fill: string) => {
      data.push({
        name: label,
        value: 0,
        start: total,
        fill,
        isTotal: true,
      });
    };

    const pushDelta = (label: string, offset: number, amount: number, fill: string) => {
      data.push({
        name: label,
        value: offset,
        start: amount,
        fill,
        isTotal: false,
      });
    };

    // Colores (mantén tu paleta; si quieres “Bukipin” exacto, los ajustamos)
    const green1 = "#10b981";
    const green2 = "#34d399";
    const blue = "#3b82f6";
    const red = "#ef4444";
    const netGreen = "#059669";
    const netRed = "#dc2626";

    if (mostrarSubtotales) {
      // Ventas
      pushDelta("Ventas", 0, totalVentas, green1);

      // Otros ingresos (offset desde ventas)
      pushDelta("(+) Otros Ingr.", totalVentas, totalOtrosIngresos, green2);

      // Total ingresos
      pushTotal("= Total Ingresos", totalIngresos, blue);

      // Costo ventas (offset desde totalIngresos - costoVentas)
      const afterCost = totalIngresos - costoVentas;
      pushDelta("(-) Costo Ventas", afterCost, costoVentas, red);

      pushTotal("= Utilidad Bruta", utilidadBruta, blue);

      const afterGO = afterCost - gastosOperativos;
      pushDelta("(-) Gastos Op.", afterGO, gastosOperativos, red);

      const afterOG = afterGO - otrosGastos;
      pushDelta("(-) Otros Gastos", afterOG, otrosGastos, red);

      pushTotal("= EBITDA", ebitda, blue);

      const afterDep = afterOG - depreciaciones;
      pushDelta("(-) Deprec.", afterDep, depreciaciones, red);

      pushTotal("= EBIT", ebit, blue);

      const afterFin = afterDep - costoFinanciero;
      pushDelta("(-) Costo Fin.", afterFin, costoFinanciero, red);

      pushTotal("= Util. A. Imp.", utilidadAntesImpuestos, blue);

      const afterImp = afterFin - impuestos;
      pushDelta("(-) Impuestos", afterImp, impuestos, red);

      pushTotal("= UTILIDAD NETA", utilidadNeta, utilidadNeta >= 0 ? netGreen : netRed);
    } else {
      // Sin subtotales
      pushDelta("Ventas", 0, totalVentas, green1);
      pushDelta("(+) Otros Ingr.", totalVentas, totalOtrosIngresos, green2);

      const afterCost = totalIngresos - costoVentas;
      pushDelta("(-) Costo Ventas", afterCost, costoVentas, red);

      const afterGO = afterCost - gastosOperativos;
      pushDelta("(-) Gastos Op.", afterGO, gastosOperativos, red);

      const afterOG = afterGO - otrosGastos;
      pushDelta("(-) Otros Gastos", afterOG, otrosGastos, red);

      const afterDep = afterOG - depreciaciones;
      pushDelta("(-) Deprec.", afterDep, depreciaciones, red);

      const afterFin = afterDep - costoFinanciero;
      pushDelta("(-) Costo Fin.", afterFin, costoFinanciero, red);

      const afterImp = afterFin - impuestos;
      pushDelta("(-) Impuestos", afterImp, impuestos, red);

      pushTotal("= UTILIDAD NETA", utilidadNeta, utilidadNeta >= 0 ? netGreen : netRed);
    }

    return data;
  }, [
    mostrarSubtotales,
    totalVentas,
    totalOtrosIngresos,
    totalIngresos,
    costoVentas,
    gastosOperativos,
    otrosGastos,
    depreciaciones,
    costoFinanciero,
    impuestos,
    utilidadBruta,
    ebitda,
    ebit,
    utilidadAntesImpuestos,
    utilidadNeta,
  ]);

  const CustomTooltipWaterfall = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload as WaterfallData;
      const displayValue = d.isTotal ? d.start : d.name.includes("(-)") ? -d.start : d.start;
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-1">{d.name}</p>
          <p className={`text-sm ${displayValue >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrencyMX(displayValue)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* HEADER PRO */}
      <Card className="border-2 border-primary/20 overflow-hidden">
        <CardHeader className="bg-primary/5">
          <div className="space-y-2">
            <CardTitle className="text-2xl text-center">Estado de Resultados — Formato Analítico</CardTitle>
            <p className="text-sm text-muted-foreground text-center font-medium">
              {formatearPeriodo(startDate, endDate)}
            </p>

            {/* KPIs PRO */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Total Ingresos</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrencyMX(totalIngresos)}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Costo de Ventas</p>
                <p className="text-lg font-bold text-red-600">{formatCurrencyMX(costoVentas)}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Gastos Operativos</p>
                <p className="text-lg font-bold text-red-600">{formatCurrencyMX(gastosOperativos + otrosGastos)}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">EBITDA</p>
                <p className={`text-lg font-bold ${ebitda >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrencyMX(ebitda)}
                </p>
                <p className={`text-xs font-semibold ${ebitda >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {margenEBITDA.toFixed(1)}%
                </p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Utilidad Bruta</p>
                <p className={`text-lg font-bold ${utilidadBruta >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrencyMX(utilidadBruta)}
                </p>
                <p className={`text-xs font-semibold ${utilidadBruta >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {margenBruto.toFixed(1)}%
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border-2 ${
                  utilidadNeta >= 0
                    ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700"
                    : "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700"
                }`}
              >
                <p className="text-xs text-muted-foreground font-semibold">UTILIDAD NETA</p>
                <p className={`text-xl font-black ${utilidadNeta >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {formatCurrencyMX(utilidadNeta)}
                </p>
                <p className={`text-xs font-bold ${utilidadNeta >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {margenNeto.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Diagnóstico colapsable */}
            <div className="pt-2 flex justify-center">
              <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs">
                    {debugOpen ? "Ocultar diagnóstico" : "Ver diagnóstico (solo para admin)"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground space-y-1">
                    <div>
                      <span className="font-semibold text-foreground">Movimientos:</span> {movimientosCount}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Cuentas con saldo en rango:</span>{" "}
                      {cuentasConSaldoCount}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Rubro:</span>{" "}
                      {rubroActual?.nombre ?? "-"}{" "}
                      <span className="text-muted-foreground">(periodType: {String(periodType)})</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 1) WATERFALL */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-2xl">1. Gráfico de Cascada (Waterfall)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Flujo de ingresos → utilidad neta (mismo cálculo que Ejecutivo, distinta visualización)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mostrar subtotales</span>
              <Switch checked={mostrarSubtotales} onCheckedChange={setMostrarSubtotales} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {(() => {
            const hayNeg = waterfallData.some((d) => {
              const final = d.value + d.start;
              return final < 0 || d.value < 0;
            });
            const bottomMargin = hayNeg ? 210 : 130;

            return (
              <ResponsiveContainer width="100%" height={820}>
                <BarChart
                  data={waterfallData}
                  margin={{ top: 20, right: 20, left: 80, bottom: bottomMargin }}
                  barGap={10}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={120}
                    interval={0}
                    tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis
                    width={90}
                    tickFormatter={(v) => formatCurrencyMX(v)}
                    tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltipWaterfall />} />
                  <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />

                  {/* Offset invisible */}
                  <Bar dataKey="value" stackId="stack" isAnimationActive={false} legendType="none">
                    {waterfallData.map((_, i) => (
                      <Cell key={`off-${i}`} fill="transparent" style={{ pointerEvents: "none" }} />
                    ))}
                  </Bar>

                  {/* Barra visible */}
                  <Bar
                    dataKey="start"
                    stackId="stack"
                    radius={[7, 7, 7, 7]}
                    label={{
                      content: ({ x, y, width, index, height }: any) => {
                        const item = waterfallData[index];
                        if (!item) return null;

                        const isNegative = item.isTotal ? item.start < 0 : item.name.includes("(-)");
                        const displayValue = item.isTotal
                          ? item.start
                          : item.name.includes("(-)")
                          ? -item.start
                          : item.start;

                        const yPos = isNegative
                          ? item.isTotal
                            ? Number(y) + 14
                            : Number(y) + Number(height) + 14
                          : Number(y) - 6;

                        const baseline = isNegative ? "top" : "bottom";

                        return (
                          <text
                            x={Number(x) + Number(width) / 2}
                            y={yPos}
                            fill="hsl(var(--foreground))"
                            textAnchor="middle"
                            dominantBaseline={baseline}
                            fontSize={10}
                            fontWeight={800}
                          >
                            {formatCurrencyMX(displayValue)}
                          </text>
                        );
                      },
                    }}
                  >
                    {waterfallData.map((entry, i) => (
                      <Cell key={`w-${i}`} fill={entry.fill} stroke="transparent" strokeWidth={0} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          })()}

          {/* Leyenda */}
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span className="text-muted-foreground">Ingresos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span className="text-muted-foreground">Egresos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500 border-2 border-blue-500" />
              <span className="text-muted-foreground">Subtotales</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2) BARRAS (Rubro → Cuenta → Subcuenta) */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-2xl">2. Desglose (Cuentas y Subcuentas)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Rubro ejecutivo → cuenta → subcuentas (ordenado por mayor impacto)
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rubro:</span>
                <Select value={rubroSeleccionado} onValueChange={setRubroSeleccionado}>
                  <SelectTrigger className="w-[330px]">
                    <SelectValue placeholder="Selecciona un rubro" />
                  </SelectTrigger>
                  <SelectContent>
                    {rubros.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nombre} — {formatCurrencyMX(r.total)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Cuenta:</span>
                <Select value={cuentaSeleccionada} onValueChange={setCuentaSeleccionada}>
                  <SelectTrigger className="w-[360px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas (por cuenta)</SelectItem>

                    {(cuentasPadreDelRubro.length ? cuentasPadreDelRubro : cuentasDirectasDelRubro)
                      .filter((x) => x.codigo)
                      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo))
                      .map((c) => (
                        <SelectItem key={c.codigo} value={c.codigo}>
                          {c.codigo} - {c.nombre} ({formatCurrencyMX(c.saldo)})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {(() => {
            if (!rubroActual) {
              return (
                <div className="text-center py-12 text-muted-foreground">
                  Selecciona un rubro para comenzar
                </div>
              );
            }

            if (!datosBarras.length) {
              return (
                <div className="text-center py-12 text-muted-foreground">
                  No hay movimientos para esta selección
                </div>
              );
            }

            const maxAbs = Math.max(...datosBarras.map((d) => Math.abs(d.valor)));
            const minVal = Math.min(...datosBarras.map((d) => d.valor));
            const domainMax = maxAbs * 1.2;
            const domainMin = minVal < 0 ? minVal * 1.2 : 0;

            return (
              <>
                <ResponsiveContainer width="100%" height={Math.max(360, datosBarras.length * 58)}>
                  <BarChart
                    data={datosBarras}
                    layout="vertical"
                    margin={{ top: 20, right: 40, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      domain={[domainMin, domainMax]}
                      tickFormatter={(v) => formatCurrencyMX(v)}
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      width={450}
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrencyMX(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "10px",
                      }}
                    />
                    <ReferenceLine x={0} stroke="#374151" strokeWidth={2} />

                    <Bar
                      dataKey="valor"
                      radius={[0, 6, 6, 0]}
                      label={{
                        position: "right",
                        formatter: (v: number) => formatCurrencyMX(v),
                        fill: "hsl(var(--foreground))",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {datosBarras.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.valor >= 0 ? "#10b981" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Rubro seleccionado</p>
                      <p className="text-lg font-bold">{rubroActual.nombre}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Elementos mostrados</p>
                      <p className="text-lg font-bold">{datosBarras.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Mayor impacto</p>
                      <p className="text-lg font-bold">{formatCurrencyMX(maxAbs)}</p>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

export default EstadoResultadosAnalitico;
