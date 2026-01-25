// bukipin-dashboard/src/components/Egresos/AnalyticaEgresos.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Treemap,
  AreaChart,
  Area,
  Brush,
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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { useTransaccionesEgresos } from "@/hooks/useTransaccionesEgresos";
import { useCostosVentaInventario } from "@/hooks/useCostosVentaInventario";
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

// ✅ Costos inventario: el backend/hook a veces devuelve OBJETO (no array).
// Esta función intenta extraer un listado usable para sums, evolución y tops.
const normalizeCostosInventario = (raw: any): any[] => {
  const root = raw?.data ?? raw;

  // 1) si ya viene como array directo (o data/items/results), úsalo
  const arr = normalizeArray<any>(root);
  if (arr.length) return arr;

  // 2) shapes típicos: movimientos/rows/entries/detalle
  const maybe =
    root?.movimientos ??
    root?.movs ??
    root?.rows ??
    root?.entries ??
    root?.detalle ??
    root?.costos ??
    root?.items ??
    root?.results ??
    [];

  return Array.isArray(maybe) ? maybe : [];
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

/**
 * Treemap “Métodos de pago” estilo PRO (como Ingresos):
 * - Texto centrado (label + $ + %)
 * - Barra superior tipo “pill”
 */
const PaymentsTreemapTile = (props: any) => {
  const { x, y, width, height, name, value, fill, dataTotal, formatMoneyScaled } = props;

  const v = toNum(value);
  const total = toNum(dataTotal);
  if (!name || total <= 0) return null;

  const pct = total > 0 ? (v / total) * 100 : 0;
  const porcentaje = pct.toFixed(1);

  const minSide = Math.min(width, height);
  const rx = Math.min(18, Math.max(12, Math.floor(minSide / 9)));

  // si muy chico, evitamos texto grande
  const showCentered = minSide >= 120;
  const showCompact = !showCentered && minSide >= 84;

  const pad = 10;
  const pillH = Math.min(18, Math.max(14, Math.floor(height * 0.085)));
  const pillW = Math.max(40, Math.min(width - pad * 2, Math.floor(width * 0.7)));

  const cx = x + width / 2;
  const cy = y + height / 2;

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
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={1}
      />

      {/* top “pill” */}
      <rect
        x={x + pad}
        y={y + pad}
        width={pillW}
        height={pillH}
        rx={pillH / 2}
        ry={pillH / 2}
        fill="rgba(255,255,255,0.18)"
        stroke="rgba(255,255,255,0.20)"
        strokeWidth={1}
      />

      {(showCentered || showCompact) && (
        <>
          <text
            x={cx}
            y={cy - (showCentered ? 10 : 8)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            fontSize={showCentered ? 15 : 13}
            fontWeight={800}
            opacity={0.95}
          >
            {name}
          </text>

          <text
            x={cx}
            y={cy + (showCentered ? 10 : 8)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            fontSize={showCentered ? 13 : 12}
            fontWeight={800}
            opacity={0.95}
          >
            {formatMoneyScaled(v, false)}
          </text>

          <text
            x={cx}
            y={cy + (showCentered ? 30 : 26)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            fontSize={11}
            fontWeight={700}
            opacity={0.9}
          >
            {porcentaje}%
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

  // ✅✅✅ IMPORTANTE: por default "Por cuenta" (como Registro de Ingresos)
  const [vistaAgrupacion, setVistaAgrupacion] = useState<"cuenta" | "subcuenta">("cuenta");

  // ✅ TOPs estilo Ingresos: orden + modal + búsqueda + paginación
const [ordenConceptos, setOrdenConceptos] = useState<"desc" | "asc">("desc");
const [openConceptos, setOpenConceptos] = useState(false);
const [qConceptos, setQConceptos] = useState("");
const [pageConceptos, setPageConceptos] = useState(1);

const [ordenProveedores, setOrdenProveedores] = useState<"desc" | "asc">("desc");
const [openProveedores, setOpenProveedores] = useState(false);
const [qProveedores, setQProveedores] = useState("");
const [pageProveedores, setPageProveedores] = useState(1);


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

  const MONTHS_SHORT = useMemo(() => ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"], []);

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

  const subcuentasQuery = useSubcuentas() as any;
  const productosQuery = useProductosEgresos() as any;
  const cuentasQuery = useCuentas() as any;

  // Normalización E2E del shape
  const transacciones = useMemo(() => normalizeArray<any>(transQuery?.data), [transQuery?.data]);
  const costosVentaInventario = useMemo(() => normalizeCostosInventario(costosInvQuery?.data), [costosInvQuery?.data]);


  const subcuentas = useMemo(() => normalizeArray<any>(subcuentasQuery?.data), [subcuentasQuery?.data]);
  const productosEgresos = useMemo(() => normalizeArray<any>(productosQuery?.data), [productosQuery?.data]);
  const cuentasData = cuentasQuery?.data?.data ?? cuentasQuery?.data ?? null;

  const cuentasFlat = useMemo(() => {
    const arr = cuentasData?.cuentasFlat ?? cuentasData?.data?.cuentasFlat ?? [];
    return Array.isArray(arr) ? arr : [];
  }, [cuentasData]);

  const loading = !!transQuery?.isLoading || !!costosInvQuery?.isLoading;

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
      x?.periodo ??
      null;

    if (!raw) return null;
    // ✅ Parse robusto (evita desfase por timezone con "YYYY-MM-DD")
if (raw instanceof Date) {
  return Number.isNaN(raw.getTime()) ? null : raw;
}

const s = String(raw).trim();

// Si viene "2026-01-25" (date-only), construimos fecha LOCAL
if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
  const [yy, mm, dd] = s.split("-").map(Number);
  const dLocal = new Date(yy, (mm || 1) - 1, dd || 1, 12, 0, 0, 0); // 12:00 para evitar edge DST
  return Number.isNaN(dLocal.getTime()) ? null : dLocal;
}

const d = new Date(s);
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

  const getTipoLabel = (t: typeof tipoEgreso) => {
    if (t === "costo") return "Costo de Ventas";
    if (t === "costo_inventario") return "Costo de Ventas Inventario";
    if (t === "gasto") return "Gastos Operativos";
    return "Otros Gastos";
  };

  // ✅ Rango actual de análisis (para que el donut respete diario/mensual/anual)
  const rangoAnalisis = useMemo(() => {
    let start: Date;
    let end: Date;

    if (periodFilter === "diario") {
      const d = new Date(fechaAnalisisDiario);
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
    } else if (periodFilter === "mensual") {
      const d = new Date(fechaAnalisisMensual);
      start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
    } else {
      const y = fechaAnalisisMensual.getFullYear();
      start = new Date(y, 0, 1, 0, 0, 0, 0);
      end = new Date(y + 1, 0, 1, 0, 0, 0, 0);
    }

    return { start, end };
  }, [periodFilter, fechaAnalisisDiario, fechaAnalisisMensual]);

  // ✅ Totales por tipo DENTRO del rango (para donut rubro vs demás)
  const totalesEgresosEnRango = useMemo(() => {
    const { start, end } = rangoAnalisis;

    let costoVentas = 0;
    let gastosOperativos = 0;
    let otrosGastos = 0;
    let costoVentasInventario = 0;

    for (const t of filteredTransactions || []) {
      const d = getDateAny(t);
      if (!inRange(d, start, end)) continue;

      const cc = String(t?.cuenta_codigo ?? "");
      const monto = toNum(t?.monto_total ?? t?.total ?? t?.monto ?? 0);

      if (cc === "5001" || cc === "5003" || cc === "5004") costoVentas += monto;
      else if (cc.startsWith("51") && cc !== "5109" && cc !== "5110") gastosOperativos += monto;
      else if (cc === "5204") otrosGastos += monto;
    }

    for (const c of costosVentaInventario || []) {
  const d = getDateAny(c);
  if (!inRange(d, start, end)) continue;

  const m = toNum(
    c?.monto ??
      c?.monto_total ??
      c?.total ??
      c?.debe ??      // ✅ cuando viene desde asientos
      c?.debit ??     // ✅ cuando viene en inglés
      0
  );

  costoVentasInventario += m;
}


    const total = costoVentas + costoVentasInventario + gastosOperativos + otrosGastos;

    return {
      costoVentas,
      costoVentasInventario,
      gastosOperativos,
      otrosGastos,
      total,
    };
  }, [filteredTransactions, costosVentaInventario, rangoAnalisis]);

  // ✅✅✅ SERIE EVOLUCIÓN (E2E REAL) — basada en los mismos datos que “Resumen de Egresos”
  const evolucion = useMemo(() => {
    // rango según periodo
    let start: Date;
    let end: Date;

    if (periodFilter === "diario") {
      const d = new Date(fechaAnalisisDiario);
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
    } else if (periodFilter === "mensual") {
      const d = new Date(fechaAnalisisMensual);
      start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
    } else {
      const y = fechaAnalisisMensual.getFullYear();
      start = new Date(y, 0, 1, 0, 0, 0, 0);
      end = new Date(y + 1, 0, 1, 0, 0, 0, 0);
    }

    // fuente según tipo
    const fuente =
      tipoEgreso === "costo"
        ? transaccionesPorTipo.costoVenta
        : tipoEgreso === "gasto"
        ? transaccionesPorTipo.gastos
        : tipoEgreso === "otros_gastos"
        ? transaccionesPorTipo.otrosGastos
        : transaccionesPorTipo.costosInventario;

    const getMonto = (x: any) => {
  if (tipoEgreso === "costo_inventario") {
    return toNum(
      x?.monto ??
        x?.monto_total ??
        x?.total ??
        x?.debe ??
        x?.debit ??
        0
    );
  }
  return toNum(x?.monto_total ?? x?.total ?? x?.monto ?? 0);
};


    // bucketing
    if (periodFilter === "diario") {
      const buckets = Array.from({ length: 24 }).map((_, h) => ({
        periodo: `${String(h).padStart(2, "0")}:00`,
        monto: 0,
      }));

      for (const item of fuente || []) {
        const d = getDateAny(item);
        if (!inRange(d, start, end) || !d) continue;
        const h = d.getHours();
        buckets[h].monto += getMonto(item);
      }

      return buckets;
    }

    if (periodFilter === "mensual") {
      const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      const buckets = Array.from({ length: daysInMonth }).map((_, i) => ({
        periodo: `Día ${i + 1}`,
        monto: 0,
      }));

      for (const item of fuente || []) {
        const d = getDateAny(item);
        if (!inRange(d, start, end) || !d) continue;
        const dayIdx = d.getDate() - 1;
        if (dayIdx >= 0 && dayIdx < buckets.length) buckets[dayIdx].monto += getMonto(item);
      }

      return buckets;
    }

    // anual
    const buckets = Array.from({ length: 12 }).map((_, i) => ({
      periodo: MONTHS_SHORT[i],
      monto: 0,
    }));

    for (const item of fuente || []) {
      const d = getDateAny(item);
      if (!inRange(d, start, end) || !d) continue;
      const m = d.getMonth();
      buckets[m].monto += getMonto(item);
    }

    return buckets;
  }, [periodFilter, fechaAnalisisDiario, fechaAnalisisMensual, tipoEgreso, transaccionesPorTipo, MONTHS_SHORT]);

  const evolucionHasData = useMemo(() => evolucion.some((p) => toNum(p?.monto) > 0), [evolucion]);

  const evolucionSubtitle = useMemo(() => {
    const tipo = getTipoLabel(tipoEgreso);
    if (periodFilter === "diario") return `${tipo} — por hora del día`;
    if (periodFilter === "mensual") return `${tipo} — por día del mes`;
    return `${tipo} — por mes del año`;
  }, [periodFilter, tipoEgreso]);

  const evolucionTitle = useMemo(() => {
    const tipo = getTipoLabel(tipoEgreso);
    if (tipoEgreso === "costo_inventario") return `Evolución de Costo de Ventas Inventario`;
    return `Evolución de ${tipo}`;
  }, [tipoEgreso]);

  // ✅✅✅ HIGHLIGHTS E2E (misma base que la tabla de Resumen: transacciones)
  const highlights = useMemo(() => {
  // ✅ El "día" debe respetar la fecha seleccionada (no el reloj del sistema)
  const baseDia = new Date(fechaAnalisisDiario);
  const startDia = new Date(baseDia.getFullYear(), baseDia.getMonth(), baseDia.getDate(), 0, 0, 0, 0);
  const endDia = new Date(baseDia.getFullYear(), baseDia.getMonth(), baseDia.getDate() + 1, 0, 0, 0, 0);


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

    inv += toNum(
      c?.monto ??
        c?.monto_total ??
        c?.total ??
        c?.debe ??
        c?.debit ??
        0
    );
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
  }, [filteredTransactions, costosVentaInventario, fechaAnalisisMensual, fechaAnalisisDiario]);


  // ✅ NUEVA LÓGICA DONUT: Rubro elegido vs Demás egresos (en el período actual)
  const donutRubroVsDemas = useMemo(() => {
    const total = toNum(totalesEgresosEnRango.total);
    const labelSel = getTipoLabel(tipoEgreso);

    const selected =
      tipoEgreso === "costo"
        ? toNum(totalesEgresosEnRango.costoVentas)
        : tipoEgreso === "costo_inventario"
        ? toNum(totalesEgresosEnRango.costoVentasInventario)
        : tipoEgreso === "gasto"
        ? toNum(totalesEgresosEnRango.gastosOperativos)
        : toNum(totalesEgresosEnRango.otrosGastos);

    const rest = Math.max(0, total - selected);

    const slices: { key: "selected" | "rest"; label: string; value: number }[] = [];
    if (selected > 0) slices.push({ key: "selected", label: labelSel, value: selected });
    if (rest > 0) slices.push({ key: "rest", label: "Demás egresos", value: rest });

    const rows =
      total > 0
        ? [
            { key: "selected" as const, label: labelSel, value: selected },
            { key: "rest" as const, label: "Demás egresos", value: rest },
          ]
        : [];

    return { total, selected, rest, slices, rows, labelSel };
  }, [totalesEgresosEnRango, tipoEgreso]);

  // -----------------------------
  // ✅✅✅ ESTADO DE PAGO (E2E)
  // -----------------------------
  const datosEstadoPagoEgresos = useMemo(() => {
    if (tipoEgreso === "costo_inventario") {
      return {
        applicable: false,
        total: 0,
        slices: [] as { estado: string; monto: number; key: "pagado" | "parcial" | "credito" }[],
        rows: [] as { estado: string; monto: number; key: "pagado" | "parcial" | "credito" }[],
      };
    }

    const { start, end } = rangoAnalisis;

    const fuente =
      tipoEgreso === "costo"
        ? transaccionesPorTipo.sinImpuestosCostoVenta
        : tipoEgreso === "gasto"
        ? transaccionesPorTipo.sinImpuestosGastos
        : transaccionesPorTipo.sinImpuestosOtrosGastos;

    const EPS = 0.01;

    const getMontoTotal = (t: any) => toNum(t?.monto_total ?? t?.total ?? t?.monto ?? 0);
    const getMontoPagado = (t: any) =>
      toNum(t?.monto_pagado ?? t?.pagado ?? t?.montoPagado ?? t?.total_pagado ?? t?.totalPagado ?? 0);

    const norm = (s: any) =>
      String(s ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const deriveEstado = (t: any): "pagado" | "parcial" | "credito" => {
      const rawEstado = norm(t?.estado_pago ?? t?.estadoPago ?? t?.estatus_pago ?? t?.estatusPago ?? "");
      if (rawEstado) {
        if (rawEstado.includes("parcial")) return "parcial";
        if (rawEstado.includes("credito") || rawEstado.includes("pendiente")) return "credito";
        if (rawEstado.includes("pagado")) return "pagado";
      }

      const total = getMontoTotal(t);
      const pagado = getMontoPagado(t);

      if (total <= EPS) return "credito";
      if (pagado >= total - EPS) return "pagado";
      if (pagado > EPS && pagado < total - EPS) return "parcial";

      const mp = norm(t?.metodo_pago ?? t?.metodoPago ?? "");
      if (mp.includes("credito")) return "credito";

      return "credito";
    };

    const acc = { pagado: 0, parcial: 0, credito: 0 };

    for (const t of fuente || []) {
      const d = getDateAny(t);
      if (!inRange(d, start, end)) continue;

      const total = getMontoTotal(t);
      if (total <= 0) continue;

      const estado = deriveEstado(t);
      acc[estado] += total;
    }

    const totalGeneral = acc.pagado + acc.parcial + acc.credito;

    const rows = [
      { key: "pagado" as const, estado: "Pagado Total", monto: acc.pagado },
      { key: "parcial" as const, estado: "Pago Parcial", monto: acc.parcial },
      { key: "credito" as const, estado: "Crédito", monto: acc.credito },
    ];

    const slices = rows.filter((r) => toNum(r.monto) > 0);

    return {
      applicable: true,
      total: totalGeneral,
      rows,
      slices,
    };
  }, [tipoEgreso, transaccionesPorTipo, rangoAnalisis]);

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

  /**
   * ✅✅✅ MÉTODOS DE PAGO — E2E CERTERO
   * - Solo considera pagos reales (Pagado Total o Pago Parcial) usando monto_pagado
   * - Para costo_inventario: NO APLICA (mensaje)
   * - Clasifica en: Efectivo vs Bancos / Tarjeta (transferencia, tarjeta, banco, spei, etc.)
   */
  const datosMetodoPagoEgresos = useMemo(() => {
    // ✅ Tipos para que TS no “rompa” el union al usar .filter()
    type MetodoPagoKey = "efectivo" | "bancos" | "otros";
    type MetodoPagoDatum = { name: string; value: number; fill: string; key: MetodoPagoKey };
    type MetodoPagoRow = { key: MetodoPagoKey; label: string; value: number; color: string };

    if (tipoEgreso === "costo_inventario") {
      return {
        applicable: false,
        totalReal: 0,
        sumByMethods: 0,
        diff: 0,
        totalTreemap: 0,
        data: [] as MetodoPagoDatum[],
        rows: [] as MetodoPagoRow[],
      };
    }

    const { start, end } = rangoAnalisis;

    const fuente =
      tipoEgreso === "costo"
        ? transaccionesPorTipo.sinImpuestosCostoVenta
        : tipoEgreso === "gasto"
        ? transaccionesPorTipo.sinImpuestosGastos
        : transaccionesPorTipo.sinImpuestosOtrosGastos;

    const EPS = 0.01;

    const norm = (s: any) =>
      String(s ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const getMontoTotal = (t: any) => toNum(t?.monto_total ?? t?.total ?? t?.monto ?? 0);
    const getMontoPagado = (t: any) =>
      toNum(t?.monto_pagado ?? t?.pagado ?? t?.montoPagado ?? t?.total_pagado ?? t?.totalPagado ?? 0);

    const deriveEstado = (t: any): "pagado" | "parcial" | "credito" => {
      const rawEstado = norm(t?.estado_pago ?? t?.estadoPago ?? t?.estatus_pago ?? t?.estatusPago ?? "");
      if (rawEstado) {
        if (rawEstado.includes("parcial")) return "parcial";
        if (rawEstado.includes("credito") || rawEstado.includes("pendiente")) return "credito";
        if (rawEstado.includes("pagado")) return "pagado";
      }

      const total = getMontoTotal(t);
      const pagado = getMontoPagado(t);

      if (total <= EPS) return "credito";
      if (pagado >= total - EPS) return "pagado";
      if (pagado > EPS && pagado < total - EPS) return "parcial";

      const mp = norm(t?.metodo_pago ?? t?.metodoPago ?? "");
      if (mp.includes("credito")) return "credito";

      return "credito";
    };

    const classifyMethod = (t: any): MetodoPagoKey => {
      const mp = norm(t?.metodo_pago ?? t?.metodoPago ?? t?.metodo ?? "");
      if (!mp) return "otros";

      if (mp.includes("efect")) return "efectivo";

      if (
        mp.includes("transfer") ||
        mp.includes("banco") ||
        mp.includes("spei") ||
        mp.includes("tarjet") ||
        mp.includes("debito") ||
        mp.includes("credito") ||
        mp.includes("tdc") ||
        mp.includes("tdd")
      ) {
        return "bancos";
      }

      if (mp.includes("caja")) return "efectivo";

      return "otros";
    };

    let totalReal = 0;
    const acc: Record<MetodoPagoKey, number> = { efectivo: 0, bancos: 0, otros: 0 };

    for (const t of fuente || []) {
      const d = getDateAny(t);
      if (!inRange(d, start, end)) continue;

      const estado = deriveEstado(t);
      if (estado === "credito") continue;

      const pagado = getMontoPagado(t);
      if (pagado <= EPS) continue;

      totalReal += pagado;

      const bucket = classifyMethod(t);
      acc[bucket] += pagado;
    }

    const base: MetodoPagoDatum[] = [
      { key: "efectivo", name: "Efectivo", value: acc.efectivo, fill: "hsl(var(--primary))" },
      { key: "bancos", name: "Bancos / Tarjeta", value: acc.bancos, fill: "hsl(var(--accent))" },
      { key: "otros", name: "Otros", value: acc.otros, fill: "hsl(var(--ring))" },
    ];

    // ✅ Type-guard: mantiene el union de key
    const data: MetodoPagoDatum[] = base.filter((x): x is MetodoPagoDatum => toNum(x.value) > 0);

    const sumByMethods = data.reduce((s, it) => s + toNum(it.value), 0);
    const diff = totalReal - sumByMethods;

    const rows: MetodoPagoRow[] = [
      { key: "efectivo", label: "Efectivo", value: acc.efectivo, color: "hsl(var(--primary))" },
      { key: "bancos", label: "Bancos / Tarjeta", value: acc.bancos, color: "hsl(var(--accent))" },
      ...(acc.otros > 0
        ? ([{ key: "otros", label: "Otros", value: acc.otros, color: "hsl(var(--ring))" }] satisfies MetodoPagoRow[])
        : ([] as MetodoPagoRow[])),
    ];

    return {
      applicable: true,
      totalReal,
      sumByMethods,
      diff,
      totalTreemap: sumByMethods,
      data,
      rows,
    };
  }, [tipoEgreso, transaccionesPorTipo, rangoAnalisis]);

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
  productos: productosArray, // ✅ lista completa para modal + top 10 en UI
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
  proveedores: proveedoresArray, // ✅ lista completa para modal + top 10 en UI
  totalGeneral,
};
  }, [transaccionesPorTipo]);

// -----------------------------
// ✅ TOPs (Conceptos y Proveedores) estilo Ingresos
// -----------------------------
const PAGE_SIZE = 8;
const TOP_N = 10;

const sortByMonto = <T extends { monto: number }>(arr: T[], order: "asc" | "desc") => {
  const copy = [...arr];
  copy.sort((a, b) => (order === "desc" ? toNum(b.monto) - toNum(a.monto) : toNum(a.monto) - toNum(b.monto)));
  return copy;
};

const normalizeText = (s: any) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// Conceptos (productos/servicios)
const conceptosSorted = useMemo(() => {
  return sortByMonto(datosEgresosPorProducto.productos || [], ordenConceptos);
}, [datosEgresosPorProducto.productos, ordenConceptos]);

const conceptosTop10 = useMemo(() => conceptosSorted.slice(0, TOP_N), [conceptosSorted]);

const conceptosFiltered = useMemo(() => {
  const q = normalizeText(qConceptos);
  if (!q) return conceptosSorted;
  return conceptosSorted.filter((x: any) => normalizeText(x?.nombre).includes(q));
}, [conceptosSorted, qConceptos]);

const conceptosTotalPages = useMemo(() => Math.max(1, Math.ceil(conceptosFiltered.length / PAGE_SIZE)), [conceptosFiltered.length]);

const conceptosPageSafe = useMemo(() => Math.min(pageConceptos, conceptosTotalPages), [pageConceptos, conceptosTotalPages]);

const conceptosPageItems = useMemo(() => {
  const start = (conceptosPageSafe - 1) * PAGE_SIZE;
  return conceptosFiltered.slice(start, start + PAGE_SIZE);
}, [conceptosFiltered, conceptosPageSafe]);

// Proveedores
const proveedoresSorted = useMemo(() => {
  return sortByMonto(datosEgresosPorProveedorMejorado.proveedores || [], ordenProveedores);
}, [datosEgresosPorProveedorMejorado.proveedores, ordenProveedores]);

const proveedoresTop10 = useMemo(() => proveedoresSorted.slice(0, TOP_N), [proveedoresSorted]);

const proveedoresFiltered = useMemo(() => {
  const q = normalizeText(qProveedores);
  if (!q) return proveedoresSorted;
  return proveedoresSorted.filter((x: any) => normalizeText(x?.nombre).includes(q));
}, [proveedoresSorted, qProveedores]);

const proveedoresTotalPages = useMemo(() => Math.max(1, Math.ceil(proveedoresFiltered.length / PAGE_SIZE)), [proveedoresFiltered.length]);

const proveedoresPageSafe = useMemo(() => Math.min(pageProveedores, proveedoresTotalPages), [pageProveedores, proveedoresTotalPages]);

const proveedoresPageItems = useMemo(() => {
  const start = (proveedoresPageSafe - 1) * PAGE_SIZE;
  return proveedoresFiltered.slice(start, start + PAGE_SIZE);
}, [proveedoresFiltered, proveedoresPageSafe]);

// Reset page al cambiar búsqueda o orden (como UX pro)
useEffect(() => setPageConceptos(1), [qConceptos, ordenConceptos]);
useEffect(() => setPageProveedores(1), [qProveedores, ordenProveedores]);


  // Totales RAW
  const totalEgresosPorCuentaSubcuenta = useMemo(() => {
    const datos = vistaAgrupacion === "cuenta" ? datosEgresosPorCuenta : datosEgresosPorSubcuenta;
    return datos.reduce((sum, item) => sum + toNum(item.monto), 0);
  }, [vistaAgrupacion, datosEgresosPorCuenta, datosEgresosPorSubcuenta]);

  // ✅ Labels como en Ventas (visuales, no afectan lógica)
  const labelHoy = useMemo(() => format(fechaAnalisisDiario, "dd/MM/yyyy", { locale: es }), [fechaAnalisisDiario]);
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
      <text
        x={cx}
        y={typeof cy === "number" ? cy + 18 : cy}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: "hsl(var(--foreground))" }}
        fontSize={16}
        fontWeight={800}
      >
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

  // ✅✅ Breakdown row (igual estilo que Ingresos: dot + label + % + $)
  const DonutBreakdownRow = ({
    label,
    value,
    total,
    color,
  }: {
    label: string;
    value: number;
    total: number;
    color: string;
  }) => {
    const pct = total > 0 ? (toNum(value) / toNum(total)) * 100 : 0;
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-sm text-foreground truncate">{label}</span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">{formatMoneyScaled(toNum(value), false)}</span>
        </div>
      </div>
    );
  };

  // ✅ Paleta estados de pago (similar al panel de ingresos)
  const PAY_STATUS_COLORS: Record<"pagado" | "parcial" | "credito", string> = {
    pagado: CHART.primary,
    parcial: CHART.ring,
    credito: "hsl(var(--muted))",
  };

  // ✅ “pill” row para métodos de pago (estilo pro como Ingresos)
  const MetodoPagoPill = ({
    label,
    value,
    total,
    color,
  }: {
    label: string;
    value: number;
    total: number;
    color: string;
  }) => {
    const pct = total > 0 ? (toNum(value) / toNum(total)) * 100 : 0;

    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/30">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
      </div>
    );
  };

  // ✅✅✅ “Pill” selector estilo Ingresos para Cuenta/Subcuenta
  const TopSelectorPill = () => (
    <div className="pt-3">
      <Tabs value={vistaAgrupacion} onValueChange={(v) => setVistaAgrupacion(v as "cuenta" | "subcuenta")}>
        <TabsList className="h-9 bg-muted/30 border rounded-full p-1">
          <TabsTrigger value="cuenta" className="text-xs rounded-full px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Por cuenta
          </TabsTrigger>
          <TabsTrigger value="subcuenta" className="text-xs rounded-full px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Por subcuenta
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );

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
            <RadioGroup value={highlightsScaleFormat} onValueChange={(v) => setHighlightsScaleFormat(v as any)} className="flex items-center gap-4">
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

      {/* ✅ ANALÍTICA DE EGRESOS */}
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

              {/* ✅ Mensual = selector Mes + Año */}
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

              {/* ✅ Anual = selector de Año */}
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
                <CardTitle className="text-lg md:text-xl font-semibold">
                  {evolucionTitle}
                  {getSufijoFormato(formatoMontos)}
                </CardTitle>
                <CardDescription>{evolucionSubtitle}</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {evolucion?.length ? `${evolucion.length} puntos` : "Sin datos"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="h-[26rem]">
            {!evolucionHasData ? (
              <ChartCardEmpty title="Sin evolución para mostrar" hint="Ajusta el período, el tipo de egreso o registra egresos para ver la tendencia." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucion} margin={{ top: 12, right: 18, left: 0, bottom: 26 }}>
                  <defs>
                    <linearGradient id="egresosArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART.primary} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART.primary} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} />

                  <XAxis dataKey="periodo" tick={{ fontSize: 12 }} minTickGap={18} height={30} />

                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: any) =>
                      scaleWith(formatoMontos, toNum(v)).toLocaleString("es-MX", {
                        maximumFractionDigits: decimales,
                      })
                    }
                    domain={[0, (dataMax: number) => Math.ceil((Number(dataMax) || 0) * 1.15)]}
                    padding={{ top: 10, bottom: 0 }}
                  />

                  <Tooltip
                    formatter={(value: any) => [formatMoneyScaled(toNum(value), true), "Monto"]}
                    contentStyle={tooltipCardStyle}
                    labelStyle={tooltipLabelStyle}
                    cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                  />

                  <Area
                    type="monotone"
                    dataKey="monto"
                    name="Monto"
                    stroke={CHART.primary}
                    strokeWidth={2.6}
                    fill="url(#egresosArea)"
                    fillOpacity={1}
                    dot={false}
                    activeDot={{
                      r: 5,
                      stroke: CHART.primary,
                      strokeWidth: 2,
                      fill: "hsl(var(--background))",
                    }}
                  />

                  <Brush
                    dataKey="periodo"
                    height={26}
                    travellerWidth={12}
                    stroke={CHART.primary}
                    fill="hsl(var(--muted))"
                    tickFormatter={(v: any) => String(v)}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ✅✅✅ Donut (por tipo) — Rubro seleccionado vs Demás egresos */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Distribución por tipo</CardTitle>
                <CardDescription>{getTipoLabel(tipoEgreso)} vs. demás egresos</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {formatMoneyScaled(toNum(donutRubroVsDemas.total), true)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="h-80">
            {toNum(donutRubroVsDemas.total) <= 0 ? (
              <ChartCardEmpty title="Sin egresos" hint="Registra costos o gastos para que aparezca la distribución." />
            ) : (
              <div className="h-full flex flex-col">
                <div className="flex-1 min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutRubroVsDemas.slices.map((s) => ({ tipo: s.label, monto: s.value, key: s.key }))}
                        cx="50%"
                        cy="44%"
                        innerRadius={78}
                        outerRadius={104}
                        paddingAngle={2}
                        dataKey="monto"
                        startAngle={90}
                        endAngle={-270}
                        cornerRadius={12}
                        stroke="hsl(var(--background))"
                        strokeWidth={3}
                      >
                        {donutRubroVsDemas.slices.map((s, idx) => {
                          const fill = s.key === "selected" ? CHART.primary : "hsl(var(--muted))";
                          return <Cell key={`${s.key}-${idx}`} fill={fill} />;
                        })}
                      </Pie>

                      <DonutCenterLabel total={toNum(donutRubroVsDemas.total)} />

                      <Tooltip
                        formatter={(value: any, _name: any, props: any) => {
                          const label = props?.payload?.tipo || "Monto";
                          return [formatMoneyScaled(toNum(value), true), label];
                        }}
                        contentStyle={tooltipCardStyle}
                        labelStyle={tooltipLabelStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* ✅ Lista estilo “Ingresos” */}
                <div className="pt-3 space-y-2">
                  <DonutBreakdownRow
                    label={donutRubroVsDemas.labelSel}
                    value={toNum(donutRubroVsDemas.selected)}
                    total={toNum(donutRubroVsDemas.total)}
                    color={CHART.primary}
                  />
                  <DonutBreakdownRow
                    label="Demás egresos"
                    value={toNum(donutRubroVsDemas.rest)}
                    total={toNum(donutRubroVsDemas.total)}
                    color={"hsl(var(--muted))"}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ✅✅✅ Estado de Pagos (replica analítica de ingresos) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Estado de Pagos — {getTipoLabel(tipoEgreso)}</CardTitle>
                <CardDescription>Distribución por estado de pago</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {formatMoneyScaled(toNum(datosEstadoPagoEgresos.total), true)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="h-80">
            {!datosEstadoPagoEgresos.applicable ? (
              <ChartCardEmpty
                title="No aplica para Costo de Ventas Inventario"
                hint="El desglose de estatus de pago para costo de venta inventario no aplica, ya que este rubro se adquirió desde la plantilla inventario."
              />
            ) : toNum(datosEstadoPagoEgresos.total) <= 0 ? (
              <ChartCardEmpty title="Sin datos de estado de pago" hint="Registra egresos dentro del período seleccionado para visualizar el desglose." />
            ) : (
              <div className="h-full flex flex-col">
                <div className="flex-1 min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={datosEstadoPagoEgresos.slices.map((s) => ({ estado: s.estado, monto: s.monto, key: s.key }))}
                        cx="50%"
                        cy="44%"
                        innerRadius={78}
                        outerRadius={104}
                        paddingAngle={2}
                        dataKey="monto"
                        startAngle={90}
                        endAngle={-270}
                        cornerRadius={12}
                        stroke="hsl(var(--background))"
                        strokeWidth={3}
                      >
                        {datosEstadoPagoEgresos.slices.map((s, idx) => (
                          <Cell key={`${s.key}-${idx}`} fill={PAY_STATUS_COLORS[s.key]} />
                        ))}
                      </Pie>

                      <DonutCenterLabel total={toNum(datosEstadoPagoEgresos.total)} />

                      <Tooltip
                        formatter={(value: any, _name: any, props: any) => {
                          const label = props?.payload?.estado || "Monto";
                          return [formatMoneyScaled(toNum(value), true), label];
                        }}
                        contentStyle={tooltipCardStyle}
                        labelStyle={tooltipLabelStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="pt-3 space-y-2">
                  {datosEstadoPagoEgresos.rows.map((r) => (
                    <DonutBreakdownRow
                      key={r.key}
                      label={r.estado}
                      value={toNum(r.monto)}
                      total={toNum(datosEstadoPagoEgresos.total)}
                      color={PAY_STATUS_COLORS[r.key]}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Más gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ✅✅✅ Egresos por Cuenta/Subcuenta (estética como Registro de Ingresos) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">
                  {vistaAgrupacion === "cuenta" ? "Top por cuenta" : "Top por subcuenta"}
                </CardTitle>
                <CardDescription>Identifica lo que más pesa</CardDescription>

                {/* ✅ selector tipo ingresos */}
                <TopSelectorPill />
              </div>

              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {formatMoneyScaled(totalEgresosPorCuentaSubcuenta, true)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="h-[26rem]">
            {(() => {
              const datosActuales = vistaAgrupacion === "cuenta" ? datosEgresosPorCuenta : datosEgresosPorSubcuenta;

              if (!datosActuales.length) return <ChartCardEmpty title="Sin datos" hint="Registra egresos o ajusta filtros para ver el top." />;

              return (
                <div className="h-full rounded-2xl border bg-muted/10 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datosActuales} layout="vertical" margin={{ top: 10, right: 16, left: 10, bottom: 10 }}>
                      {/* grid suave (como ingresos) */}
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />

                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: any) => {
                          const s = scaleWith(formatoMontos, toNum(v));
                          return `$${s.toLocaleString("es-MX", { maximumFractionDigits: decimales })}`;
                        }}
                        domain={[0, (dataMax: number) => Math.ceil((Number(dataMax) || 0) * 1.18)]}
                      />

                      <YAxis
                        dataKey="subcuenta"
                        type="category"
                        width={vistaAgrupacion === "cuenta" ? 240 : 190}
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip
                        formatter={(value: any, _name: any, props: any) => {
                          const label = props?.payload?.subcuenta ?? "Monto";
                          return [formatMoneyScaled(toNum(value), true), label];
                        }}
                        contentStyle={tooltipCardStyle}
                        labelStyle={tooltipLabelStyle}
                        cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.25 }}
                      />

                      <Bar
                        dataKey="monto"
                        radius={[12, 12, 12, 12]}
                        fill={CHART.accent}
                        barSize={14}
                        background={{ fill: "hsl(var(--muted))", fillOpacity: 0.25, radius: 12 }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* ✅✅✅ Métodos de pago (PRO) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Métodos de pago — {getTipoLabel(tipoEgreso)}</CardTitle>
                <CardDescription>Distribución de pagos reales por método</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {formatMoneyScaled(toNum(datosMetodoPagoEgresos.totalTreemap), true)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="h-[26rem]">
            {!datosMetodoPagoEgresos.applicable ? (
              <ChartCardEmpty
                title="No aplica para Costo de Ventas Inventario"
                hint="El desglose de Método de pago para costo de venta inventario no aplica, ya que este rubro se adquirió desde la plantilla inventario."
              />
            ) : toNum(datosMetodoPagoEgresos.totalTreemap) <= 0 ? (
              <ChartCardEmpty
                title="Sin pagos para mostrar"
                hint="Registra egresos pagados (total o parcial) dentro del período seleccionado para visualizar el desglose por método."
              />
            ) : (
              <div className="h-full flex flex-col">
                {/* ✅ mini-cards estilo Ingresos */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="rounded-xl border bg-muted/20 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Total real (Highlights)</p>
                    <p className="text-sm font-bold text-foreground tabular-nums">{formatMoneyScaled(toNum(datosMetodoPagoEgresos.totalReal), false)}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Sumado por métodos</p>
                    <p className="text-sm font-bold text-foreground tabular-nums">{formatMoneyScaled(toNum(datosMetodoPagoEgresos.sumByMethods), false)}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Diferencia</p>
                    <p className="text-sm font-bold text-foreground tabular-nums">{formatMoneyScaled(toNum(datosMetodoPagoEgresos.diff), false)}</p>
                  </div>
                </div>

                <div className="flex-1 min-h-[210px] rounded-2xl border bg-muted/10 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                      data={datosMetodoPagoEgresos.data}
                      dataKey="value"
                      aspectRatio={16 / 9}
                      content={<PaymentsTreemapTile dataTotal={toNum(datosMetodoPagoEgresos.totalTreemap)} formatMoneyScaled={formatMoneyScaled} />}
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
                </div>

                {/* ✅ legend pills */}
                <div className="pt-3 flex flex-wrap gap-2">
                  {datosMetodoPagoEgresos.rows.map((r) => (
                    <MetodoPagoPill key={r.key} label={r.label} value={toNum(r.value)} total={toNum(datosMetodoPagoEgresos.totalTreemap)} color={r.color} />
                  ))}
                </div>

                <p className="text-xs text-muted-foreground pt-2">Tip: pasa el cursor sobre un bloque para ver el detalle.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos */}
        <Card>
          <CardHeader className="pb-2">
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <CardTitle className="text-base">Top egresos por concepto</CardTitle>
      <CardDescription>Productos/servicios (según descripción)</CardDescription>
    </div>

    <div className="flex items-center gap-2 flex-shrink-0">
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-full"
        onClick={() => setOrdenConceptos((p) => (p === "desc" ? "asc" : "desc"))}
      >
        Orden: {ordenConceptos === "desc" ? "Mayor → Menor" : "Menor → Mayor"}
      </Button>

      <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={() => setOpenConceptos(true)}>
        Ver todos
      </Button>
    </div>
  </div>
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
                {conceptosTop10.map((producto: any) => {
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
                <Dialog open={openConceptos} onOpenChange={setOpenConceptos}>
  <DialogContent className="sm:max-w-2xl">
    <DialogHeader>
      <DialogTitle>Productos</DialogTitle>
      <p className="text-sm text-muted-foreground">Lista completa para análisis detallado</p>
    </DialogHeader>

    <div className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <Input value={qConceptos} onChange={(e) => setQConceptos(e.target.value)} placeholder="Buscar producto..." />
      </div>

      <Button
        variant="outline"
        className="rounded-full"
        onClick={() => setOrdenConceptos((p) => (p === "desc" ? "asc" : "desc"))}
      >
        Orden: {ordenConceptos === "desc" ? "Mayor → Menor" : "Menor → Mayor"}
      </Button>
    </div>

    <div className="space-y-3 pt-2">
      {conceptosPageItems.map((producto: any) => {
        const total = toNum(datosEgresosPorProducto.totalGeneral);
        const porcentaje = total > 0 ? calcularPorcentaje(toNum(producto.monto), total) : "0.0";

        return (
          <div
            key={`modal-${producto.categoria}-${producto.nombre}`}
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
                {producto.transacciones} {producto.transacciones === 1 ? "transacción" : "transacciones"}
              </p>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-foreground">{formatMoneyScaled(toNum(producto.monto), true)}</p>
              <p className="text-xs text-muted-foreground">{porcentaje}%</p>
            </div>
          </div>
        );
      })}
    </div>

    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
      <p className="text-xs text-muted-foreground">
        {(() => {
          const total = conceptosFiltered.length;
          const start = total === 0 ? 0 : (conceptosPageSafe - 1) * PAGE_SIZE + 1;
          const end = Math.min(conceptosPageSafe * PAGE_SIZE, total);
          return `Mostrando ${start}-${end} de ${total}`;
        })()}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={conceptosPageSafe <= 1}
          onClick={() => setPageConceptos((p) => Math.max(1, p - 1))}
        >
          Anterior
        </Button>

        <span className="text-sm tabular-nums">
          {conceptosPageSafe} / {conceptosTotalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={conceptosPageSafe >= conceptosTotalPages}
          onClick={() => setPageConceptos((p) => Math.min(conceptosTotalPages, p + 1))}
        >
          Siguiente
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
              </>
            )}
          </CardContent>
        </Card>

        {/* Proveedores */}
        <Card>
          <CardHeader className="pb-2">
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <CardTitle className="text-base">Top egresos por proveedor</CardTitle>
      <CardDescription>Concentración de pagos</CardDescription>
    </div>

    <div className="flex items-center gap-2 flex-shrink-0">
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-full"
        onClick={() => setOrdenProveedores((p) => (p === "desc" ? "asc" : "desc"))}
      >
        Orden: {ordenProveedores === "desc" ? "Mayor → Menor" : "Menor → Mayor"}
      </Button>

      <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={() => setOpenProveedores(true)}>
        Ver todos
      </Button>
    </div>
  </div>
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
                {proveedoresTop10.map((proveedor: any) => {
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
                <Dialog open={openProveedores} onOpenChange={setOpenProveedores}>
  <DialogContent className="sm:max-w-2xl">
    <DialogHeader>
      <DialogTitle>Proveedores</DialogTitle>
      <p className="text-sm text-muted-foreground">Lista completa para análisis detallado</p>
    </DialogHeader>

    <div className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <Input value={qProveedores} onChange={(e) => setQProveedores(e.target.value)} placeholder="Buscar proveedor..." />
      </div>

      <Button
        variant="outline"
        className="rounded-full"
        onClick={() => setOrdenProveedores((p) => (p === "desc" ? "asc" : "desc"))}
      >
        Orden: {ordenProveedores === "desc" ? "Mayor → Menor" : "Menor → Mayor"}
      </Button>
    </div>

    <div className="space-y-3 pt-2">
      {proveedoresPageItems.map((proveedor: any) => {
        const total = toNum(datosEgresosPorProveedorMejorado.totalGeneral);
        const porcentaje = total > 0 ? calcularPorcentaje(toNum(proveedor.monto), total) : "0.0";

        return (
          <div
            key={`modal-${proveedor.nombre}`}
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
                {proveedor.transacciones} {proveedor.transacciones === 1 ? "transacción" : "transacciones"}
              </p>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-foreground">{formatMoneyScaled(toNum(proveedor.monto), true)}</p>
              <p className="text-xs text-muted-foreground">{porcentaje}%</p>
            </div>
          </div>
        );
      })}
    </div>

    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
      <p className="text-xs text-muted-foreground">
        {(() => {
          const total = proveedoresFiltered.length;
          const start = total === 0 ? 0 : (proveedoresPageSafe - 1) * PAGE_SIZE + 1;
          const end = Math.min(proveedoresPageSafe * PAGE_SIZE, total);
          return `Mostrando ${start}-${end} de ${total}`;
        })()}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={proveedoresPageSafe <= 1}
          onClick={() => setPageProveedores((p) => Math.max(1, p - 1))}
        >
          Anterior
        </Button>

        <span className="text-sm tabular-nums">
          {proveedoresPageSafe} / {proveedoresTotalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={proveedoresPageSafe >= proveedoresTotalPages}
          onClick={() => setPageProveedores((p) => Math.min(proveedoresTotalPages, p + 1))}
        >
          Siguiente
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticaEgresos;
