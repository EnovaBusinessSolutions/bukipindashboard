// bukipin-dashboard/src/components/Egresos/AnalyticaEgresos.tsx
import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Treemap,
} from "recharts";
import { AlertCircle, CalendarIcon, Package, TrendingDown } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { useTransaccionesEgresos } from "@/hooks/useTransaccionesEgresos";
import { useCostosVentaInventario } from "@/hooks/useCostosVentaInventario";
// ❌ YA NO usamos resumenQuery para highlights (era la causa del “todo en 0”)
// import { useResumenEgresosPorPeriodo } from "@/hooks/useResumenEgresosPorPeriodo";
import { useEgresosPorPeriodo, DatosEvolucionSimple } from "@/hooks/useEgresosPorPeriodo";
import { useSubcuentas } from "@/hooks/useSubcuentas";
import { useCuentas } from "@/hooks/useCuentas";
import { useProductosEgresos } from "@/hooks/useProductosEgresos";

/**
 * Helpers (E2E): normalización para tolerar backends con shape:
 * - Array directo
 * - { data: [...] }
 * - { ok: true, data: [...] }
 */
const toNum = (v: any) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const normalizeArray = <T,>(raw: any): T[] => {
  const candidate = Array.isArray(raw) ? raw : raw?.data ?? raw?.items ?? raw?.results ?? [];
  return Array.isArray(candidate) ? candidate : [];
};

// ---------- UI helpers ----------
const ChartCardEmpty = ({
  title = "Sin datos",
  hint = "No hay información para el rango actual.",
}: {
  title?: string;
  hint?: string;
}) => (
  <div className="flex flex-col items-center justify-center h-72 text-muted-foreground">
    <AlertCircle className="h-10 w-10 mb-3 opacity-60" />
    <p className="font-medium">{title}</p>
    <p className="text-xs mt-1 max-w-[28rem] text-center">{hint}</p>
  </div>
);

// Tooltip “pro” y consistente
const tooltipCardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--background))",
  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
};

const tooltipLabelStyle: React.CSSProperties = { color: "hsl(var(--foreground))", fontWeight: 600 };

// Leyenda simple (sin saturar)
const LegendText = (value: any) => <span className="text-xs text-muted-foreground">{value}</span>;

// Colores “theme-friendly”
const CHART = {
  primary: "hsl(var(--primary))",
  destructive: "hsl(var(--destructive))",
  accent: "hsl(var(--accent))",
  muted: "hsl(var(--muted-foreground))",
  ring: "hsl(var(--ring))",
};

// -------- Treemap “pro” (rounded + hover) --------
const TreemapTile = (props: any) => {
  const { x, y, width, height, name, value, fill, dataTotal, formatMoneyScaled } = props;

  const v = toNum(value);
  const total = toNum(dataTotal);
  if (!name || total <= 0) return null;

  const pct = total > 0 ? (v / total) * 100 : 0;
  const porcentaje = pct.toFixed(1);

  // no texto si la caja es chica
  const minSide = Math.min(width, height);
  const showText = minSide >= 72;

  const rx = Math.min(14, Math.max(8, Math.floor(minSide / 10)));

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        rx={rx}
        ry={rx}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1}
      />
      {showText && (
        <>
          <text x={x + 10} y={y + 22} textAnchor="start" fill="#ffffff" fontSize={12} fontWeight={700} opacity={0.95}>
            {name}
          </text>
          <text x={x + 10} y={y + 40} textAnchor="start" fill="#ffffff" fontSize={11} opacity={0.9}>
            {porcentaje}% · {formatMoneyScaled(v, true)}
          </text>
        </>
      )}
    </g>
  );
};

const AnalyticaEgresos = () => {
  // ✅ Precisión eliminada del UI (se queda fijo a 2 decimales como en analítica de ingresos)
  const decimales: 0 | 1 | 2 = 2;

  const [periodFilter, setPeriodFilter] = useState<"diario" | "mensual" | "anual">("mensual");
  const [formatoMontos, setFormatoMontos] = useState<"normal" | "miles" | "millones">("normal");

  // ✅ Como Ventas: formato SOLO para highlights (independiente)
  const [highlightsScaleFormat, setHighlightsScaleFormat] = useState<"normal" | "miles" | "millones">("normal");

  // ✅ Solo 4 opciones (sin “Total”)
  const [tipoEgreso, setTipoEgreso] = useState<"costo" | "costo_inventario" | "gasto" | "otros_gastos">("costo");

  const [fechaAnalisisDiario, setFechaAnalisisDiario] = useState<Date>(new Date());
  const [fechaAnalisisMensual, setFechaAnalisisMensual] = useState<Date>(new Date());
  const [vistaAgrupacion, setVistaAgrupacion] = useState<"cuenta" | "subcuenta">("subcuenta");

  // ✅ Mes/Año selector como en Ingresos
  const MONTHS = useMemo(
    () => [
      { label: "Enero", value: 0 },
      { label: "Febrero", value: 1 },
      { label: "Marzo", value: 2 },
      { label: "Abril", value: 3 },
      { label: "Mayo", value: 4 },
      { label: "Junio", value: 5 },
      { label: "Julio", value: 6 },
      { label: "Agosto", value: 7 },
      { label: "Septiembre", value: 8 },
      { label: "Octubre", value: 9 },
      { label: "Noviembre", value: 10 },
      { label: "Diciembre", value: 11 },
    ],
    []
  );

  const YEARS = useMemo(() => {
    const base = new Date().getFullYear();
    const min = base - 10;
    const max = base + 1;

    const selectedYear = fechaAnalisisMensual.getFullYear();
    const ys: number[] = [];
    for (let y = min; y <= max; y++) ys.push(y);

    if (!ys.includes(selectedYear)) ys.push(selectedYear);
    ys.sort((a, b) => a - b);

    return ys;
  }, [fechaAnalisisMensual]);

  // Queries
  const transQuery = useTransaccionesEgresos(1000, periodFilter, fechaAnalisisDiario, fechaAnalisisMensual) as any;
  const costosInvQuery = useCostosVentaInventario(periodFilter, fechaAnalisisDiario, fechaAnalisisMensual) as any;
  const graficaQuery = useEgresosPorPeriodo(periodFilter, tipoEgreso as any, fechaAnalisisDiario, fechaAnalisisMensual) as any;

  const subcuentasQuery = useSubcuentas() as any;
  const productosQuery = useProductosEgresos() as any;
  const cuentasQuery = useCuentas() as any;

  // Normalización E2E del shape
  const transacciones = useMemo(() => normalizeArray<any>(transQuery?.data), [transQuery?.data]);
  const costosVentaInventario = useMemo(() => normalizeArray<any>(costosInvQuery?.data), [costosInvQuery?.data]);

  const subcuentas = useMemo(() => normalizeArray<any>(subcuentasQuery?.data), [subcuentasQuery?.data]);
  const productosEgresos = useMemo(() => normalizeArray<any>(productosQuery?.data), [productosQuery?.data]);
  const cuentasData = cuentasQuery?.data?.data ?? cuentasQuery?.data ?? null;

  const cuentasFlat = useMemo(() => {
    const arr = cuentasData?.cuentasFlat ?? cuentasData?.data?.cuentasFlat ?? [];
    return Array.isArray(arr) ? arr : [];
  }, [cuentasData]);

  const datosGraficaRaw = graficaQuery?.data?.data ?? graficaQuery?.data ?? null;

  const loading = !!transQuery?.isLoading || !!costosInvQuery?.isLoading || !!graficaQuery?.isLoading;

  // ---- Formato/escala SOLO PARA VISUAL ----
  const getSufijoFormato = (fmt: "normal" | "miles" | "millones") => {
    if (fmt === "miles") return " (Miles)";
    if (fmt === "millones") return " (Millones)";
    return "";
  };

  const scaleWith = (fmt: "normal" | "miles" | "millones", n: number) => {
    const v = toNum(n);
    if (fmt === "miles") return v / 1000;
    if (fmt === "millones") return v / 1_000_000;
    return v;
  };

  const formatMoneyScaledWith = (fmt: "normal" | "miles" | "millones", raw: number, incluirSufijo = false) => {
    const v = scaleWith(fmt, raw);
    const sufijo = incluirSufijo ? getSufijoFormato(fmt) : "";
    return `$${v.toLocaleString("es-MX", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })}${sufijo}`;
  };

  const formatMoneyScaled = (raw: number, incluirSufijo = false) => formatMoneyScaledWith(formatoMontos, raw, incluirSufijo);

  const calcularPorcentaje = (monto: number, total: number): string => {
    const t = toNum(total);
    if (t === 0) return "0.0";
    return ((toNum(monto) / t) * 100).toFixed(1);
  };

  // ✅ fecha robusta (porque cada endpoint manda distinto)
  const getDateAny = (x: any): Date | null => {
    const raw =
      x?.fecha ??
      x?.date ??
      x?.createdAt ??
      x?.created_at ??
      x?.updatedAt ??
      x?.updated_at ??
      x?.fecha_egreso ??
      x?.fechaEgreso ??
      x?.fecha_movimiento ??
      x?.fechaMovimiento ??
      null;

    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const inRange = (d: Date | null, start: Date, end: Date) => {
    if (!d) return false;
    const t = d.getTime();
    return t >= start.getTime() && t < end.getTime();
  };

  // JOIN manual: imagenes por nombre
  const mapaImagenesProductos = useMemo(() => {
    const mapa = new Map<string, string>();
    (productosEgresos || []).forEach((p: any) => {
      const nombre = String(p?.nombre ?? "").toLowerCase().trim();
      if (nombre && p?.imagen_url) mapa.set(nombre, p.imagen_url);
    });
    return mapa;
  }, [productosEgresos]);

  /**
   * Filtrar transacciones operativas:
   * - Costos de venta: 5001, 5003, 5004
   * - Costo inventario: (NO se toma de transacciones en highlights; viene de hook inventario)
   * - Gastos: 51XX (excepto 5109, 5110 si aplica)
   * - Otros gastos: 5204
   */
  const filteredTransactions = useMemo(
    () =>
      (transacciones || []).filter((t: any) => {
        const cc = String(t?.cuenta_codigo ?? "");
        if (!cc) return false;

        if (cc === "5001" || cc === "5003" || cc === "5004") return true;
        if (cc.startsWith("51") && cc !== "5109" && cc !== "5110") return true;
        if (cc === "5204") return true;

        return false;
      }),
    [transacciones]
  );

  // Filtrar transacciones excluyendo ISR/impuestos (6001) y/o tipo impuesto si existe
  const filteredTransactionsSinImpuestos = useMemo(
    () =>
      (transacciones || []).filter((t: any) => {
        const cc = String(t?.cuenta_codigo ?? "");
        const tipo = String(t?.tipo_egreso ?? "");
        return cc !== "6001" && tipo !== "impuesto";
      }),
    [transacciones]
  );

  /**
   * IMPORTANTÍSIMO E2E:
   * NO depender de t.tipo_egreso para clasificar.
   * Clasificamos por cuenta_codigo.
   */
  const transaccionesPorTipo = useMemo(() => {
    const costoVenta = filteredTransactions.filter((t: any) => {
      const cc = String(t?.cuenta_codigo ?? "");
      return cc === "5001" || cc === "5003" || cc === "5004";
    });

    const gastos51XX = filteredTransactions.filter((t: any) => {
      const cc = String(t?.cuenta_codigo ?? "");
      return cc.startsWith("51") && cc !== "5109" && cc !== "5110";
    });

    const otrosGastos5204 = filteredTransactions.filter((t: any) => String(t?.cuenta_codigo ?? "") === "5204");

    const costoVentaSinImp = filteredTransactionsSinImpuestos.filter((t: any) => {
      const cc = String(t?.cuenta_codigo ?? "");
      return cc === "5001" || cc === "5003" || cc === "5004";
    });

    const gastos51XXSinImp = filteredTransactionsSinImpuestos.filter((t: any) => {
      const cc = String(t?.cuenta_codigo ?? "");
      return cc.startsWith("51") && cc !== "5109" && cc !== "5110";
    });

    const otrosGastos5204SinImp = filteredTransactionsSinImpuestos.filter((t: any) => String(t?.cuenta_codigo ?? "") === "5204");

    if (tipoEgreso === "costo_inventario") {
      return {
        costoVenta: [],
        gastos: [],
        otrosGastos: [],
        costosInventario: costosVentaInventario,
        sinImpuestosCostoVenta: [],
        sinImpuestosGastos: [],
        sinImpuestosOtrosGastos: [],
      };
    }

    if (tipoEgreso === "gasto") {
      return {
        costoVenta: [],
        gastos: gastos51XX,
        otrosGastos: [],
        costosInventario: [],
        sinImpuestosCostoVenta: [],
        sinImpuestosGastos: gastos51XXSinImp,
        sinImpuestosOtrosGastos: [],
      };
    }

    if (tipoEgreso === "otros_gastos") {
      return {
        costoVenta: [],
        gastos: [],
        otrosGastos: otrosGastos5204,
        costosInventario: [],
        sinImpuestosCostoVenta: [],
        sinImpuestosGastos: [],
        sinImpuestosOtrosGastos: otrosGastos5204SinImp,
      };
    }

    // costo
    return {
      costoVenta,
      gastos: [],
      otrosGastos: [],
      costosInventario: [],
      sinImpuestosCostoVenta: costoVentaSinImp,
      sinImpuestosGastos: [],
      sinImpuestosOtrosGastos: [],
    };
  }, [filteredTransactions, filteredTransactionsSinImpuestos, costosVentaInventario, tipoEgreso]);

  // Datos para gráfica (RAW, sin escala)
  const datosGraficaFormateados = useMemo(() => {
    if (!datosGraficaRaw) return [];
    const arr = normalizeArray<DatosEvolucionSimple>(datosGraficaRaw);
    return arr.map((item: any) => ({
      periodo: item?.periodo,
      monto: toNum(item?.monto),
    }));
  }, [datosGraficaRaw]);

  const getTipoLabel = (t: typeof tipoEgreso) => {
    if (t === "costo") return "Costo de Ventas";
    if (t === "costo_inventario") return "Costo de Ventas Inventario";
    if (t === "gasto") return "Gastos Operativos";
    return "Otros Gastos";
  };

  // ✅✅✅ HIGHLIGHTS E2E (misma base que la tabla de Resumen: transacciones)
  // - Día: hoy
  // - Mes: mes seleccionado (fechaAnalisisMensual)
  // - Año: año del mes seleccionado
  // - Inventario: SOLO hook inventario
  const highlights = useMemo(() => {
    const hoy = new Date();
    const startDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0);
    const endDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1, 0, 0, 0, 0);

    const startMes = new Date(fechaAnalisisMensual.getFullYear(), fechaAnalisisMensual.getMonth(), 1, 0, 0, 0, 0);
    const endMes = new Date(fechaAnalisisMensual.getFullYear(), fechaAnalisisMensual.getMonth() + 1, 1, 0, 0, 0, 0);

    const startAnio = new Date(fechaAnalisisMensual.getFullYear(), 0, 1, 0, 0, 0, 0);
    const endAnio = new Date(fechaAnalisisMensual.getFullYear() + 1, 0, 1, 0, 0, 0, 0);

    const sumTx = (list: any[], start: Date, end: Date) => {
      let costosVenta = 0;
      let gastos = 0;
      let otrosGastos = 0;

      for (const t of list) {
        const d = getDateAny(t);
        if (!inRange(d, start, end)) continue;

        const cc = String(t?.cuenta_codigo ?? "");
        const monto = toNum(t?.monto_total ?? t?.total ?? t?.monto ?? 0);

        if (cc === "5001" || cc === "5003" || cc === "5004") costosVenta += monto;
        else if (cc.startsWith("51") && cc !== "5109" && cc !== "5110") gastos += monto;
        else if (cc === "5204") otrosGastos += monto;
      }

      return { costosVenta, gastos, otrosGastos };
    };

    const sumInv = (list: any[], start: Date, end: Date) => {
      let inv = 0;
      for (const c of list) {
        const d = getDateAny(c);
        if (!inRange(d, start, end)) continue;
        inv += toNum(c?.monto ?? c?.total ?? 0);
      }
      return inv;
    };

    const diaTx = sumTx(filteredTransactions, startDia, endDia);
    const mesTx = sumTx(filteredTransactions, startMes, endMes);
    const anioTx = sumTx(filteredTransactions, startAnio, endAnio);

    const diaInv = sumInv(costosVentaInventario, startDia, endDia);
    const mesInv = sumInv(costosVentaInventario, startMes, endMes);
    const anioInv = sumInv(costosVentaInventario, startAnio, endAnio);

    const diaTotal = diaTx.costosVenta + diaInv + diaTx.gastos + diaTx.otrosGastos;
    const mesTotal = mesTx.costosVenta + mesInv + mesTx.gastos + mesTx.otrosGastos;
    const anioTotal = anioTx.costosVenta + anioInv + anioTx.gastos + anioTx.otrosGastos;

    return {
      dia: { ...diaTx, costosVentaInventario: diaInv, total: diaTotal },
      mes: { ...mesTx, costosVentaInventario: mesInv, total: mesTotal },
      anio: { ...anioTx, costosVentaInventario: anioInv, total: anioTotal },
    };
  }, [filteredTransactions, costosVentaInventario, fechaAnalisisMensual]);

  // Egresos por Tipo (RAW) — siempre muestra la distribución general
  const datosEgresosPorTipo = useMemo(() => {
    const data: { tipo: string; monto: number }[] = [];

    const totalCostoVentas = filteredTransactions
      .filter((t: any) => ["5001", "5003", "5004"].includes(String(t?.cuenta_codigo ?? "")))
      .reduce((sum: number, t: any) => sum + toNum(t?.monto_total), 0);
    if (totalCostoVentas > 0) data.push({ tipo: "Costo de Ventas", monto: totalCostoVentas });

    const totalCostoVentasInventario = costosVentaInventario.reduce((sum: number, c: any) => sum + toNum(c?.monto), 0);
    if (totalCostoVentasInventario > 0) data.push({ tipo: "Costo de Ventas Inventario", monto: totalCostoVentasInventario });

    const totalGastosOperativos = filteredTransactions
      .filter((t: any) => {
        const cc = String(t?.cuenta_codigo ?? "");
        return cc.startsWith("51") && cc !== "5109" && cc !== "5110";
      })
      .reduce((sum: number, t: any) => sum + toNum(t?.monto_total), 0);
    if (totalGastosOperativos > 0) data.push({ tipo: "Gastos Operativos", monto: totalGastosOperativos });

    const totalOtrosGastos = filteredTransactions
      .filter((t: any) => String(t?.cuenta_codigo ?? "") === "5204")
      .reduce((sum: number, t: any) => sum + toNum(t?.monto_total), 0);
    if (totalOtrosGastos > 0) data.push({ tipo: "Otros Gastos", monto: totalOtrosGastos });

    return data;
  }, [filteredTransactions, costosVentaInventario]);

  // Métodos de pago utilizados (sin impuestos) + inventario como adquisición (RAW)
  const datosEstadoPagos = useMemo(() => {
    const grouped: Record<string, number> = {};

    const todasTransacciones = [
      ...transaccionesPorTipo.sinImpuestosCostoVenta,
      ...transaccionesPorTipo.sinImpuestosGastos,
      ...transaccionesPorTipo.sinImpuestosOtrosGastos,
    ];

    todasTransacciones
      .filter((t: any) => toNum(t?.monto_pagado) > 0)
      .forEach((t: any) => {
        const metodo = String(t?.metodo_pago ?? "Sin método");
        const metodoCap = metodo.charAt(0).toUpperCase() + metodo.slice(1);
        grouped[metodoCap] = (grouped[metodoCap] ?? 0) + toNum(t?.monto_pagado);
      });

    const totalCostosInventario = transaccionesPorTipo.costosInventario.reduce((sum: number, c: any) => sum + toNum(c?.monto), 0);
    if (totalCostosInventario > 0) grouped["Inventario"] = (grouped["Inventario"] ?? 0) + totalCostosInventario;

    return Object.entries(grouped)
      .map(([estado, monto]) => ({ estado, monto }))
      .sort((a, b) => b.monto - a.monto);
  }, [transaccionesPorTipo]);

  // Egresos por Subcuenta (Top 10) RAW
  const datosEgresosPorSubcuenta = useMemo(() => {
    const grouped: Record<string, number> = {};

    const getId = (x: any) => String(x?.id ?? x?._id ?? "");
    const resolveSubName = (prefix: string, subId: any) => {
      const id = String(subId ?? "");
      if (!id) return `${prefix} · Sin subcuenta`;
      const s = (subcuentas || []).find((x: any) => getId(x) === id);
      return s?.nombre ? `${prefix} · ${s.nombre}` : `${prefix} · Sin subcuenta`;
    };

    transaccionesPorTipo.costoVenta.forEach((t: any) => {
      const k = resolveSubName("Costo de Ventas", t?.subcuenta_id);
      grouped[k] = (grouped[k] ?? 0) + toNum(t?.monto_total);
    });

    transaccionesPorTipo.gastos.forEach((t: any) => {
      const k = resolveSubName("Gastos Operativos", t?.subcuenta_id);
      grouped[k] = (grouped[k] ?? 0) + toNum(t?.monto_total);
    });

    transaccionesPorTipo.otrosGastos.forEach((t: any) => {
      const k = resolveSubName("Otros Gastos", t?.subcuenta_id);
      grouped[k] = (grouped[k] ?? 0) + toNum(t?.monto_total);
    });

    const totalCostosInventario = transaccionesPorTipo.costosInventario.reduce((sum: number, c: any) => sum + toNum(c?.monto), 0);
    if (totalCostosInventario > 0) grouped["Costo de Ventas Inventario"] = (grouped["Costo de Ventas Inventario"] ?? 0) + totalCostosInventario;

    return Object.entries(grouped)
      .map(([subcuenta, monto]) => ({ subcuenta, monto }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 10);
  }, [transaccionesPorTipo, subcuentas]);

  // Egresos por Cuenta (Top 15) RAW
  const datosEgresosPorCuenta = useMemo(() => {
    const grouped: Record<string, { codigo: string; nombre: string; monto: number }> = {};

    const agregarACuenta = (codigoCuenta: string, monto: number) => {
      const code = String(codigoCuenta ?? "");
      if (!code) return;

      if (!grouped[code]) {
        const cuenta = cuentasFlat.find((c: any) => String(c?.codigo ?? "") === code);
        grouped[code] = {
          codigo: code,
          nombre: cuenta ? `${cuenta.codigo} - ${cuenta.nombre}` : code,
          monto: 0,
        };
      }
      grouped[code].monto += toNum(monto);
    };

    transaccionesPorTipo.costoVenta.forEach((t: any) => agregarACuenta(t?.cuenta_codigo, t?.monto_total));
    transaccionesPorTipo.gastos.forEach((t: any) => agregarACuenta(t?.cuenta_codigo, t?.monto_total));
    transaccionesPorTipo.otrosGastos.forEach((t: any) => agregarACuenta(t?.cuenta_codigo, t?.monto_total));
    transaccionesPorTipo.costosInventario.forEach((c: any) => agregarACuenta("5002", c?.monto));

    return Object.values(grouped)
      .map((item) => ({ subcuenta: item.nombre, monto: item.monto }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 15);
  }, [transaccionesPorTipo, cuentasFlat]);

  // Egresos por Método de Pago (Treemap) RAW
  const datosEgresosPorMetodoPago = useMemo(() => {
    const todasTransacciones = [
      ...transaccionesPorTipo.sinImpuestosCostoVenta,
      ...transaccionesPorTipo.sinImpuestosGastos,
      ...transaccionesPorTipo.sinImpuestosOtrosGastos,
    ];

    const efectivo = todasTransacciones
      .filter((t: any) => String(t?.metodo_pago ?? "") === "efectivo" && toNum(t?.monto_pagado) > 0)
      .reduce((sum: number, t: any) => sum + toNum(t?.monto_pagado), 0);

    const bancosTarjeta = todasTransacciones
      .filter((t: any) => {
        const mp = String(t?.metodo_pago ?? "");
        return mp && mp !== "efectivo" && toNum(t?.monto_pagado) > 0;
      })
      .reduce((sum: number, t: any) => sum + toNum(t?.monto_pagado), 0);

    const costosInventario = transaccionesPorTipo.costosInventario.reduce((sum: number, c: any) => sum + toNum(c?.monto), 0);

    const data = [
      { name: "Efectivo", value: efectivo, fill: "hsl(var(--primary))" },
      { name: "Bancos / Tarjeta", value: bancosTarjeta, fill: "hsl(var(--accent))" },
    ];

    if (costosInventario > 0) data.push({ name: "Inventario", value: costosInventario, fill: "hsl(var(--ring))" });

    return data.filter((item) => toNum(item.value) > 0);
  }, [transaccionesPorTipo]);

  // Egresos por Producto (Top 10) RAW
  const datosEgresosPorProducto = useMemo(() => {
    const grouped: Record<
      string,
      {
        nombre: string;
        imagen: string | null;
        monto: number;
        transacciones: number;
        tieneAsignacion: boolean;
        categoria: string;
      }
    > = {};

    transaccionesPorTipo.costoVenta.forEach((t: any) => {
      const desc = String(t?.descripcion ?? "Sin descripción");
      const key = `CV-${desc}`;
      if (!grouped[key]) {
        const joinKey = desc.toLowerCase().trim();
        grouped[key] = {
          nombre: desc,
          imagen: mapaImagenesProductos.get(joinKey) || t?.imagen_comprobante || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: true,
          categoria: "Costo de Ventas",
        };
      }
      grouped[key].monto += toNum(t?.monto_total);
      grouped[key].transacciones += 1;
    });

    transaccionesPorTipo.gastos.forEach((t: any) => {
      const desc = String(t?.descripcion ?? "Sin descripción");
      const key = `G-${desc}`;
      if (!grouped[key]) {
        const joinKey = desc.toLowerCase().trim();
        grouped[key] = {
          nombre: desc,
          imagen: mapaImagenesProductos.get(joinKey) || t?.imagen_comprobante || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: true,
          categoria: "Gastos Operativos",
        };
      }
      grouped[key].monto += toNum(t?.monto_total);
      grouped[key].transacciones += 1;
    });

    transaccionesPorTipo.otrosGastos.forEach((t: any) => {
      const desc = String(t?.descripcion ?? "Sin descripción");
      const key = `OG-${desc}`;
      if (!grouped[key]) {
        const joinKey = desc.toLowerCase().trim();
        grouped[key] = {
          nombre: desc,
          imagen: mapaImagenesProductos.get(joinKey) || t?.imagen_comprobante || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: true,
          categoria: "Otros Gastos",
        };
      }
      grouped[key].monto += toNum(t?.monto_total);
      grouped[key].transacciones += 1;
    });

    transaccionesPorTipo.costosInventario.forEach((c: any) => {
      const prod = String(c?.producto_nombre ?? "Sin asignación");
      const key = `CI-${prod}`;
      if (!grouped[key]) {
        grouped[key] = {
          nombre: prod,
          imagen: c?.producto_imagen || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: !!c?.producto_nombre,
          categoria: "Costo de Ventas Inventario",
        };
      }
      grouped[key].monto += toNum(c?.monto);
      grouped[key].transacciones += 1;
    });

    const productosArray = Object.values(grouped).sort((a, b) => b.monto - a.monto);
    const totalGeneral = productosArray.reduce((sum, p) => sum + toNum(p.monto), 0);

    return {
      productos: productosArray.slice(0, 10),
      totalGeneral,
    };
  }, [transaccionesPorTipo, mapaImagenesProductos]);

  // Egresos por Proveedor (Top 10) RAW
  const datosEgresosPorProveedorMejorado = useMemo(() => {
    const grouped: Record<
      string,
      {
        nombre: string;
        monto: number;
        transacciones: number;
        tieneAsignacion: boolean;
      }
    > = {};

    const addProv = (prov: string, monto: number, has: boolean) => {
      const key = prov || "Sin proveedor asignado";
      if (!grouped[key]) grouped[key] = { nombre: key, monto: 0, transacciones: 0, tieneAsignacion: has };
      grouped[key].monto += toNum(monto);
      grouped[key].transacciones += 1;
      grouped[key].tieneAsignacion = grouped[key].tieneAsignacion || has;
    };

    transaccionesPorTipo.costoVenta.forEach((t: any) =>
      addProv(String(t?.proveedor_nombre ?? "Sin proveedor asignado"), t?.monto_total, !!t?.proveedor_nombre)
    );
    transaccionesPorTipo.gastos.forEach((t: any) =>
      addProv(String(t?.proveedor_nombre ?? "Sin proveedor asignado"), t?.monto_total, !!t?.proveedor_nombre)
    );
    transaccionesPorTipo.otrosGastos.forEach((t: any) =>
      addProv(String(t?.proveedor_nombre ?? "Sin proveedor asignado"), t?.monto_total, !!t?.proveedor_nombre)
    );

    const totalCostosInventario = transaccionesPorTipo.costosInventario.reduce((sum: number, c: any) => sum + toNum(c?.monto), 0);
    if (totalCostosInventario > 0) {
      if (!grouped["Sin proveedor asignado"])
        grouped["Sin proveedor asignado"] = { nombre: "Sin proveedor asignado", monto: 0, transacciones: 0, tieneAsignacion: false };
      grouped["Sin proveedor asignado"].monto += totalCostosInventario;
      grouped["Sin proveedor asignado"].transacciones += transaccionesPorTipo.costosInventario.length;
    }

    const proveedoresArray = Object.values(grouped).sort((a, b) => b.monto - a.monto);
    const totalGeneral = proveedoresArray.reduce((sum, p) => sum + toNum(p.monto), 0);

    return {
      proveedores: proveedoresArray.slice(0, 10),
      totalGeneral,
    };
  }, [transaccionesPorTipo]);

  // Totales RAW
  const totalEgresosPorTipo = useMemo(() => datosEgresosPorTipo.reduce((sum, item) => sum + toNum(item.monto), 0), [datosEgresosPorTipo]);
  const totalMetodosPago = useMemo(() => datosEstadoPagos.reduce((sum, item) => sum + toNum(item.monto), 0), [datosEstadoPagos]);

  const totalEgresosPorCuentaSubcuenta = useMemo(() => {
    const datos = vistaAgrupacion === "cuenta" ? datosEgresosPorCuenta : datosEgresosPorSubcuenta;
    return datos.reduce((sum, item) => sum + toNum(item.monto), 0);
  }, [vistaAgrupacion, datosEgresosPorCuenta, datosEgresosPorSubcuenta]);

  const totalEgresosPorMetodoPagoTreemap = useMemo(() => datosEgresosPorMetodoPago.reduce((sum, item) => sum + toNum(item.value), 0), [datosEgresosPorMetodoPago]);

  // ✅ Labels como en Ventas (visuales, no afectan lógica)
  const labelHoy = useMemo(() => format(new Date(), "dd/MM/yyyy", { locale: es }), []);
  const labelMes = useMemo(() => format(fechaAnalisisMensual, "MMMM/yyyy", { locale: es }), [fechaAnalisisMensual]);
  const labelAno = useMemo(() => format(new Date(fechaAnalisisMensual.getFullYear(), 0, 1), "yyyy", { locale: es }), [fechaAnalisisMensual]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-72 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Donas palette (theme-friendly)
  const pieColors = [CHART.primary, CHART.ring, CHART.destructive, CHART.accent];

  const DonutCenterLabel = ({
    cx = "50%",
    cy = "46%",
    total,
  }: {
    cx?: string | number;
    cy?: string | number;
    total: number;
  }) => (
    <>
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" style={{ fill: "hsl(var(--foreground))" }} fontSize={12} opacity={0.75}>
        Total
      </text>
      <text x={cx} y={typeof cy === "number" ? cy + 18 : cy} textAnchor="middle" dominantBaseline="middle" style={{ fill: "hsl(var(--foreground))" }} fontSize={16} fontWeight={800}>
        {formatMoneyScaled(total, false)}
      </text>
    </>
  );

  // ✅ Colores de highlights (consistentes con analítica)
  const HL = {
    costoVentas: CHART.primary,
    costoVentasInventario: CHART.ring,
    gastosOperativos: CHART.destructive,
    otrosGastos: CHART.accent,
  };

  // ✅ helper para highlights (usa formato propio como Ventas)
  const HighlightRow = ({
    label,
    value,
    color,
    bold = false,
  }: {
    label: string;
    value: number;
    color: string;
    bold?: boolean;
  }) => (
    <div className="flex justify-between items-center">
      <span className={cn("text-sm", bold ? "font-bold" : "font-medium")} style={{ color }}>
        {label}
      </span>
      <span className={cn("text-foreground", bold ? "font-extrabold" : "font-semibold")}>
        {formatMoneyScaledWith(highlightsScaleFormat, value, false)}
      </span>
    </div>
  );

  // ✅ Resúmenes ya NO dependen del endpoint “resumenes”
  const resDia = {
    costosVenta5001: toNum(highlights?.dia?.costosVenta),
    costosVenta5002: toNum(highlights?.dia?.costosVentaInventario),
    gastos: toNum(highlights?.dia?.gastos),
    otrosGastos: toNum(highlights?.dia?.otrosGastos),
    total: toNum(highlights?.dia?.total),
  };

  const resMes = {
    costosVenta5001: toNum(highlights?.mes?.costosVenta),
    costosVenta5002: toNum(highlights?.mes?.costosVentaInventario),
    gastos: toNum(highlights?.mes?.gastos),
    otrosGastos: toNum(highlights?.mes?.otrosGastos),
    total: toNum(highlights?.mes?.total),
  };

  const resAnio = {
    costosVenta5001: toNum(highlights?.anio?.costosVenta),
    costosVenta5002: toNum(highlights?.anio?.costosVentaInventario),
    gastos: toNum(highlights?.anio?.gastos),
    otrosGastos: toNum(highlights?.anio?.otrosGastos),
    total: toNum(highlights?.anio?.total),
  };

  return (
    <div className="space-y-6">
      {/* ✅ Título */}
      <div>
        <h3 className="text-xl font-bold text-foreground mb-1">Highlights de egresos</h3>
      </div>

      {/* ✅ HIGHLIGHTS */}
      <div className="mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <p className="text-sm text-muted-foreground">Ajusta el formato numérico de los highlights</p>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Formato:</span>
            <RadioGroup
              value={highlightsScaleFormat}
              onValueChange={(v) => setHighlightsScaleFormat(v as any)}
              className="flex items-center gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="eg-high-general" />
                <Label htmlFor="eg-high-general" className="cursor-pointer text-sm">
                  General
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="miles" id="eg-high-miles" />
                <Label htmlFor="eg-high-miles" className="cursor-pointer text-sm">
                  Miles (K)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="millones" id="eg-high-millones" />
                <Label htmlFor="eg-high-millones" className="cursor-pointer text-sm">
                  Millones (M)
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-primary">Resumen del Día ({labelHoy})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <HighlightRow label="Costo de Ventas:" value={resDia.costosVenta5001} color={HL.costoVentas} />
              <HighlightRow label="Costo de Ventas Inventario:" value={resDia.costosVenta5002} color={HL.costoVentasInventario} />
              <HighlightRow label="Gastos Operativos:" value={resDia.gastos} color={HL.gastosOperativos} />
              <HighlightRow label="Otros Gastos:" value={resDia.otrosGastos} color={HL.otrosGastos} />

              <div className="h-px bg-border" />

              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-foreground">Total Egresos:</span>
                <span className="text-xl font-bold text-foreground">{formatMoneyScaledWith(highlightsScaleFormat, resDia.total, false)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-primary">Resumen del Mes ({labelMes})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <HighlightRow label="Costo de Ventas:" value={resMes.costosVenta5001} color={HL.costoVentas} />
              <HighlightRow label="Costo de Ventas Inventario:" value={resMes.costosVenta5002} color={HL.costoVentasInventario} />
              <HighlightRow label="Gastos Operativos:" value={resMes.gastos} color={HL.gastosOperativos} />
              <HighlightRow label="Otros Gastos:" value={resMes.otrosGastos} color={HL.otrosGastos} />

              <div className="h-px bg-border" />

              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-foreground">Total Egresos:</span>
                <span className="text-xl font-bold text-foreground">{formatMoneyScaledWith(highlightsScaleFormat, resMes.total, false)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-primary">Resumen del Año ({labelAno})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <HighlightRow label="Costo de Ventas:" value={resAnio.costosVenta5001} color={HL.costoVentas} />
              <HighlightRow label="Costo de Ventas Inventario:" value={resAnio.costosVenta5002} color={HL.costoVentasInventario} />
              <HighlightRow label="Gastos Operativos:" value={resAnio.gastos} color={HL.gastosOperativos} />
              <HighlightRow label="Otros Gastos:" value={resAnio.otrosGastos} color={HL.otrosGastos} />

              <div className="h-px bg-border" />

              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-foreground">Total Egresos:</span>
                <span className="text-xl font-bold text-foreground">{formatMoneyScaledWith(highlightsScaleFormat, resAnio.total, false)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ✅ Separador */}
      <div className="my-8 border-t-2 border-primary/20" />

      {/* ✅ ANALÍTICA DE EGRESOS (antes “Controles de análisis”) */}
      <div>
        <h3 className="text-xl font-bold text-foreground mb-6">Analítica de egresos</h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* 1) Tipo de Egreso */}
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Egreso</CardTitle>
              <CardDescription>Selecciona qué analizar</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={tipoEgreso} onValueChange={(v) => setTipoEgreso(v as any)} className="flex flex-col gap-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="costo" id="eg-tipo-costo" />
                  <Label htmlFor="eg-tipo-costo" className="cursor-pointer">
                    Costo de Ventas
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="costo_inventario" id="eg-tipo-inv" />
                  <Label htmlFor="eg-tipo-inv" className="cursor-pointer">
                    Costo de Ventas Inventario
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gasto" id="eg-tipo-gasto" />
                  <Label htmlFor="eg-tipo-gasto" className="cursor-pointer">
                    Gastos Operativos
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="otros_gastos" id="eg-tipo-otros" />
                  <Label htmlFor="eg-tipo-otros" className="cursor-pointer">
                    Otros Gastos
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* 2) Periodo de Análisis */}
          <Card>
            <CardHeader>
              <CardTitle>Periodo de Análisis</CardTitle>
              <CardDescription>Selecciona el período</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={periodFilter} onValueChange={(v) => setPeriodFilter(v as any)} className="flex flex-col gap-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="diario" id="eg-period-diario" />
                  <Label htmlFor="eg-period-diario" className="cursor-pointer">
                    Diario
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mensual" id="eg-period-mensual" />
                  <Label htmlFor="eg-period-mensual" className="cursor-pointer">
                    Mensual
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="anual" id="eg-period-anual" />
                  <Label htmlFor="eg-period-anual" className="cursor-pointer">
                    Anual
                  </Label>
                </div>
              </RadioGroup>

              {/* ✅ Diario = calendario */}
              {periodFilter === "diario" && (
                <div className="pt-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">Fecha específica</Label>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal" size="sm">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(fechaAnalisisDiario, "PPP", { locale: es })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaAnalisisDiario}
                        onSelect={(date) => {
                          if (!date) return;
                          setFechaAnalisisDiario(date);
                        }}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* ✅ Mensual = selector Mes + Año (como Ingresos) */}
              {periodFilter === "mensual" && (
                <div className="pt-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">Mes específico</Label>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal" size="sm">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(fechaAnalisisMensual, "MMMM yyyy", { locale: es })}
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-[340px] p-4" align="start">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Mes</Label>
                          <Select
                            value={String(fechaAnalisisMensual.getMonth())}
                            onValueChange={(v) => {
                              const month = Number(v);
                              const y = fechaAnalisisMensual.getFullYear();
                              setFechaAnalisisMensual(new Date(y, month, 1));
                            }}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                            <SelectContent>
                              {MONTHS.map((m) => (
                                <SelectItem key={m.value} value={String(m.value)}>
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Año</Label>
                          <Select
                            value={String(fechaAnalisisMensual.getFullYear())}
                            onValueChange={(v) => {
                              const year = Number(v);
                              const m = fechaAnalisisMensual.getMonth();
                              setFechaAnalisisMensual(new Date(year, m, 1));
                            }}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Año" />
                            </SelectTrigger>
                            <SelectContent>
                              {YEARS.map((y) => (
                                <SelectItem key={y} value={String(y)}>
                                  {y}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* ✅ Anual = selector de Año (como Ingresos) */}
              {periodFilter === "anual" && (
                <div className="pt-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">Año específico</Label>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal" size="sm">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {String(fechaAnalisisMensual.getFullYear())}
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-[260px] p-4" align="start">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Año</Label>
                        <Select
                          value={String(fechaAnalisisMensual.getFullYear())}
                          onValueChange={(v) => {
                            const year = Number(v);
                            // Para anual usamos el año, el mes queda fijo en enero
                            setFechaAnalisisMensual(new Date(year, 0, 1));
                          }}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Año" />
                          </SelectTrigger>
                          <SelectContent>
                            {YEARS.map((y) => (
                              <SelectItem key={y} value={String(y)}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3) Formato de cifras */}
          <Card>
            <CardHeader>
              <CardTitle>Formato de Cifras</CardTitle>
              <CardDescription>Visualización de montos</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={formatoMontos} onValueChange={(v) => setFormatoMontos(v as any)} className="flex flex-col gap-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="normal" id="eg-scale-normal" />
                  <Label htmlFor="eg-scale-normal" className="cursor-pointer">
                    General
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="miles" id="eg-scale-miles" />
                  <Label htmlFor="eg-scale-miles" className="cursor-pointer">
                    Miles (K)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="millones" id="eg-scale-millones" />
                  <Label htmlFor="eg-scale-millones" className="cursor-pointer">
                    Millones (M)
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ✅ GRÁFICAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolución */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  Evolución — {getTipoLabel(tipoEgreso)}
                  {getSufijoFormato(formatoMontos)}
                </CardTitle>
                <CardDescription>Tendencia en el tiempo (útil para detectar picos)</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {datosGraficaFormateados?.length ? `${datosGraficaFormateados.length} puntos` : "Sin datos"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="h-80">
            {datosGraficaFormateados.length === 0 ? (
              <ChartCardEmpty title="Sin evolución para mostrar" hint="Ajusta el período o registra egresos para ver la tendencia." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={datosGraficaFormateados} margin={{ top: 10, right: 18, left: 0, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: any) => scaleWith(formatoMontos, toNum(v)).toLocaleString("es-MX", { maximumFractionDigits: decimales })}
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                    padding={{ top: 12, bottom: 0 }}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatMoneyScaled(toNum(value), true), "Monto"]}
                    contentStyle={tooltipCardStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Line type="monotone" dataKey="monto" name="Monto" stroke={CHART.primary} strokeWidth={2.8} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donas (por tipo) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Distribución por tipo</CardTitle>
                <CardDescription>¿En qué se va el dinero?</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {formatMoneyScaled(totalEgresosPorTipo, true)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="h-80">
            {datosEgresosPorTipo.length === 0 ? (
              <ChartCardEmpty title="Sin egresos" hint="Registra costos o gastos para que aparezca la distribución." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={datosEgresosPorTipo} cx="50%" cy="46%" innerRadius={72} outerRadius={98} paddingAngle={3} dataKey="monto">
                    {datosEgresosPorTipo.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>

                  <DonutCenterLabel total={totalEgresosPorTipo} />

                  <Tooltip
                    formatter={(value: any, _name: any, props: any) => {
                      const label = props?.payload?.tipo || "Monto";
                      return [formatMoneyScaled(toNum(value), true), label];
                    }}
                    contentStyle={tooltipCardStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Legend verticalAlign="bottom" height={32} formatter={LegendText as any} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donas (por método pago) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Métodos de pago</CardTitle>
                <CardDescription>Solo pagos realizados (sin impuestos)</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {formatMoneyScaled(totalMetodosPago, true)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="h-80">
            {datosEstadoPagos.length === 0 ? (
              <ChartCardEmpty title="Sin pagos registrados" hint="Si todo está en crédito, aquí no se mostrará monto pagado." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={datosEstadoPagos} cx="50%" cy="46%" innerRadius={72} outerRadius={98} paddingAngle={3} dataKey="monto">
                    {datosEstadoPagos.map((_, idx) => (
                      <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                    ))}
                  </Pie>

                  <DonutCenterLabel total={totalMetodosPago} />

                  <Tooltip
                    formatter={(value: any, _name: any, props: any) => {
                      const label = props?.payload?.estado || "Monto";
                      return [formatMoneyScaled(toNum(value), true), label];
                    }}
                    contentStyle={tooltipCardStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Legend verticalAlign="bottom" height={32} formatter={LegendText as any} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Más gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Egresos por Cuenta/Subcuenta */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{vistaAgrupacion === "cuenta" ? "Top por cuenta" : "Top por subcuenta"}</CardTitle>
                <CardDescription>Identifica lo que más pesa</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {formatMoneyScaled(totalEgresosPorCuentaSubcuenta, true)}
              </Badge>
            </div>

            <div className="pt-3">
              <Tabs value={vistaAgrupacion} onValueChange={(v) => setVistaAgrupacion(v as "cuenta" | "subcuenta")}>
                <TabsList className="h-9">
                  <TabsTrigger value="cuenta" className="text-xs">
                    Cuenta
                  </TabsTrigger>
                  <TabsTrigger value="subcuenta" className="text-xs">
                    Subcuenta
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          <CardContent className="h-[26rem]">
            {(() => {
              const datosActuales = vistaAgrupacion === "cuenta" ? datosEgresosPorCuenta : datosEgresosPorSubcuenta;

              if (!datosActuales.length) return <ChartCardEmpty title="Sin datos" hint="Registra egresos o ajusta filtros para ver el top." />;

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosActuales} layout="vertical" margin={{ top: 8, right: 18, left: 6, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v: any) => {
                        const s = scaleWith(formatoMontos, toNum(v));
                        return `$${s.toLocaleString("es-MX", { maximumFractionDigits: decimales })}`;
                      }}
                      domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]}
                    />
                    <YAxis dataKey="subcuenta" type="category" width={vistaAgrupacion === "cuenta" ? 210 : 160} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: any) => [formatMoneyScaled(toNum(value), true), "Monto"]}
                      contentStyle={tooltipCardStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar dataKey="monto" radius={[10, 10, 10, 10]} fill={CHART.accent} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>

        {/* Treemap métodos pago */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Métodos de pago (vista treemap)</CardTitle>
                <CardDescription>Más visual y rápida de leer</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {formatMoneyScaled(totalEgresosPorMetodoPagoTreemap, true)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="h-[26rem]">
            {datosEgresosPorMetodoPago.length === 0 ? (
              <ChartCardEmpty title="Sin pagos" hint="No hay montos pagados para este período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={datosEgresosPorMetodoPago}
                  dataKey="value"
                  aspectRatio={16 / 9}
                  content={<TreemapTile dataTotal={totalEgresosPorMetodoPagoTreemap} formatMoneyScaled={formatMoneyScaled} />}
                >
                  <Tooltip
                    formatter={(value: any, _name: any, props: any) => {
                      const label = props?.payload?.name || "Monto";
                      return [formatMoneyScaled(toNum(value), true), label];
                    }}
                    contentStyle={tooltipCardStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                </Treemap>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top egresos por concepto</CardTitle>
            <CardDescription>Productos/servicios (según descripción)</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {datosEgresosPorProducto.productos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Package className="h-10 w-10 mb-3 opacity-60" />
                <p className="font-medium">Sin conceptos</p>
                <p className="text-xs mt-1">Aparecerán cuando tengas egresos registrados.</p>
              </div>
            ) : (
              <>
                {datosEgresosPorProducto.productos.map((producto: any) => {
                  const total = toNum(datosEgresosPorProducto.totalGeneral);
                  const porcentaje = total > 0 ? calcularPorcentaje(toNum(producto.monto), total) : "0.0";

                  return (
                    <div
                      key={`${producto.categoria}-${producto.nombre}`}
                      className={cn(
                        "flex items-center gap-3 p-3 border rounded-xl bg-card/50",
                        !producto.tieneAsignacion && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20"
                      )}
                    >
                      {producto.imagen ? (
                        <img src={producto.imagen} alt={producto.nombre} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div
                          className={cn(
                            "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                            !producto.tieneAsignacion ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"
                          )}
                        >
                          <Package className={cn("w-5 h-5", !producto.tieneAsignacion ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{producto.nombre}</p>
                          {!producto.tieneAsignacion && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 flex-shrink-0">
                              Sin asignar
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {producto.transacciones} {producto.transacciones === 1 ? "movimiento" : "movimientos"}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-foreground">{formatMoneyScaled(toNum(producto.monto), true)}</p>
                        <p className="text-xs text-muted-foreground">{porcentaje}%</p>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="font-semibold text-primary">Total</span>
                  <span className="text-lg font-bold text-foreground">{formatMoneyScaled(datosEgresosPorProducto.totalGeneral, true)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Proveedores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top egresos por proveedor</CardTitle>
            <CardDescription>Concentración de pagos</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {datosEgresosPorProveedorMejorado.proveedores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <TrendingDown className="h-10 w-10 mb-3 opacity-60" />
                <p className="font-medium">Sin proveedores</p>
                <p className="text-xs mt-1">Aparecerán cuando registres egresos con proveedor.</p>
              </div>
            ) : (
              <>
                {datosEgresosPorProveedorMejorado.proveedores.map((proveedor: any) => {
                  const total = toNum(datosEgresosPorProveedorMejorado.totalGeneral);
                  const porcentaje = total > 0 ? calcularPorcentaje(toNum(proveedor.monto), total) : "0.0";

                  return (
                    <div
                      key={proveedor.nombre}
                      className={cn(
                        "flex items-center gap-3 p-3 border rounded-xl bg-card/50",
                        !proveedor.tieneAsignacion && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{proveedor.nombre}</p>
                          {!proveedor.tieneAsignacion && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 flex-shrink-0">
                              Sin asignar
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {proveedor.transacciones} {proveedor.transacciones === 1 ? "movimiento" : "movimientos"}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-foreground">{formatMoneyScaled(toNum(proveedor.monto), true)}</p>
                        <p className="text-xs text-muted-foreground">{porcentaje}%</p>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="font-semibold text-primary">Total</span>
                  <span className="text-lg font-bold text-foreground">{formatMoneyScaled(datosEgresosPorProveedorMejorado.totalGeneral, true)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticaEgresos;
