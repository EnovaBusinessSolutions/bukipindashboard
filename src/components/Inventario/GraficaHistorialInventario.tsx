import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  Bar,
  ComposedChart,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";
import { formatCurrency } from "@/lib/utils";

type Periodo = "mensual" | "anual";
type Unidad = "unidades" | "dinero";
type Formato = "general" | "miles" | "millones";

type ChartRow = {
  label: string; // eje X (mes o día)
  stock: number; // ya escalado (K/M)
  compras: number;
  ventas: number;

  // raw (sin escala) para tooltips y cálculos
  __rawStock: number;
  __rawCompras: number;
  __rawVentas: number;
};

const n = (v: any) => {
  const num = Number(v ?? 0);
  return Number.isFinite(num) ? num : 0;
};

function safeId(p: any): string {
  const v =
    p?.id ??
    p?._id ??
    p?.productId ??
    p?.product_id ??
    p?.productoId ??
    p?.producto_id ??
    "";
  return String(v || "");
}

function parseAnyDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;

  const s = String(v).trim();
  if (!s) return null;

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split("/");
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD / ISO / timestamp
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function addMonths(d: Date, months: number) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}
function pad2(x: number) {
  return String(x).padStart(2, "0");
}

function monthLabelES(d: Date) {
  // ej: "ene 2026"
  return d.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
}
function dayLabelES(d: Date) {
  // DD/MM
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}
function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function toDayKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getTipoMovimiento(m: any): "entrada" | "salida" | "otro" {
  const t = String(m?.tipo ?? m?.type ?? m?.movimiento ?? m?.movementType ?? "").toLowerCase();

  if (t.includes("entrada") || t.includes("compra") || t.includes("in")) return "entrada";
  if (t.includes("salida") || t.includes("venta") || t.includes("out")) return "salida";

  const isEntrada = m?.isEntrada ?? m?.entrada ?? false;
  const isSalida = m?.isSalida ?? m?.salida ?? false;
  if (isEntrada) return "entrada";
  if (isSalida) return "salida";

  return "otro";
}

function getCantidad(m: any) {
  return n(
    m?.cantidad ??
      m?.qty ??
      m?.quantity ??
      m?.unidades ??
      m?.units ??
      m?.cantidad_movimiento ??
      m?.cantidadMovimiento
  );
}

function getCostoTotal(m: any) {
  // preferimos costo_total
  const ct = n(
    m?.costo_total ??
      m?.costoTotal ??
      m?.total_cost ??
      m?.totalCost ??
      m?.importe ??
      m?.monto ??
      m?.amount
  );
  if (ct) return ct;

  // fallback: qty * costo_unitario
  const cu = n(
    m?.costo_unitario ??
      m?.costoUnitario ??
      m?.unit_cost ??
      m?.unitCost ??
      m?.costo ??
      m?.cost
  );
  const qty = getCantidad(m);
  return cu && qty ? cu * qty : 0;
}

const GraficaHistorialInventario = () => {
  const [productoSeleccionado, setProductoSeleccionado] = useState<string>("total");
  const [periodo, setPeriodo] = useState<Periodo>("anual");
  const [unidad, setUnidad] = useState<Unidad>("unidades");
  const [formato, setFormato] = useState<Formato>("general");

  const { data: productosInventario = [] } = useInventarioConMovimientos();

  // movimientos reales (desde backend)
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loadingMovs, setLoadingMovs] = useState(false);
  const [errorMovs, setErrorMovs] = useState<string | null>(null);

  const divisor = formato === "miles" ? 1000 : formato === "millones" ? 1_000_000 : 1;
  const sufijo = formato === "miles" ? "K" : formato === "millones" ? "M" : "";

  const nombreProductoSeleccionado = useMemo(() => {
    if (productoSeleccionado === "total") return "Todos los productos";
    const found = (productosInventario || []).find((p: any) => safeId(p) === productoSeleccionado);
    return found?.nombre ?? "Producto";
  }, [productoSeleccionado, productosInventario]);

  const productosSelect = useMemo(() => {
    return (productosInventario || [])
      .map((p: any) => ({ id: safeId(p), nombre: p?.nombre ?? "Producto" }))
      .filter((p) => p.id);
  }, [productosInventario]);

  // Fechas del periodo
  const { start, end, buckets } = useMemo(() => {
    const today = new Date();
    const end = endOfDay(today);

    let start: Date;
    let buckets: { key: string; label: string; date: Date }[] = [];

    if (periodo === "mensual") {
      start = startOfMonth(today);

      const d = new Date(start);
      while (d <= end) {
        buckets.push({ key: toDayKey(d), label: dayLabelES(d), date: new Date(d) });
        d.setDate(d.getDate() + 1);
      }
    } else {
      const startMonth = addMonths(startOfMonth(today), -11);
      start = new Date(startMonth);

      for (let i = 0; i < 12; i++) {
        const md = addMonths(startMonth, i);
        buckets.push({ key: toMonthKey(md), label: monthLabelES(md), date: md });
      }
    }

    return { start, end, buckets };
  }, [periodo]);

  // 👇 FETCH movimientos reales del backend (mismo origen que tu tabla)
  useEffect(() => {
    let alive = true;

    async function fetchMovs() {
      setLoadingMovs(true);
      setErrorMovs(null);

      const pid = productoSeleccionado === "total" ? "" : productoSeleccionado;

      // Intentamos con filtros (si tu endpoint los soporta)
      const qs = new URLSearchParams();
      qs.set("start", toYMD(start));
      qs.set("end", toYMD(end));
      if (pid) qs.set("productoId", pid);

      const candidates = [
        `/api/movimientos-inventario?${qs.toString()}`,
        `/api/inventario/movimientos?${qs.toString()}`, // legacy fallback
        `/api/movimientos-inventario`,
        `/api/inventario/movimientos`,
      ];

      for (const url of candidates) {
        try {
          const res = await fetch(url, { credentials: "include" });
          if (!res.ok) continue;

          const json = await res.json();
          const data = (json?.data ?? json) as any;

          // normaliza lista
          const list =
            Array.isArray(data) ? data :
            Array.isArray(data?.movimientos) ? data.movimientos :
            Array.isArray(data?.items) ? data.items :
            Array.isArray(data?.rows) ? data.rows :
            [];

          if (!alive) return;

          // Si vino sin filtros, filtramos client-side
          const parsed = list
            .map((m: any) => {
              const d = parseAnyDate(m?.fecha ?? m?.date ?? m?.createdAt ?? m?.fecha_movimiento ?? m?.movementDate);
              return { ...m, __date: d };
            })
            .filter((m: any) => m.__date);

          const filtered = parsed
            .filter((m: any) => {
              const inRange = m.__date >= start && m.__date <= end;
              const matchProduct =
                !pid ||
                String(m?.productoId ?? m?.productId ?? m?.producto_id ?? m?.product_id ?? "") === String(pid);
              return inRange && matchProduct;
            });

          // Si este endpoint sí nos dio algo o al menos es válido, lo tomamos
          setMovimientos(filtered);
          setLoadingMovs(false);
          return;
        } catch {
          // intenta siguiente
        }
      }

      if (!alive) return;
      setMovimientos([]);
      setLoadingMovs(false);
      setErrorMovs("No pude obtener movimientos de inventario desde el backend.");
    }

    fetchMovs();

    return () => {
      alive = false;
    };
  }, [productoSeleccionado, start, end, periodo]);

  // Stock actual (para calcular stock inicial)
  const stockActualUnidades = useMemo(() => {
    const items = Array.isArray(productosInventario) ? productosInventario : [];
    if (productoSeleccionado === "total") {
      return items.reduce((acc, p: any) => acc + n(p?.cantidad_stock), 0);
    }
    const found = items.find((p: any) => safeId(p) === productoSeleccionado);
    return found ? n(found?.cantidad_stock) : 0;
  }, [productosInventario, productoSeleccionado]);

  const stockActualValor = useMemo(() => {
    const items = Array.isArray(productosInventario) ? productosInventario : [];
    if (productoSeleccionado === "total") {
      return items.reduce((acc, p: any) => acc + n(p?.valor_total_inventario), 0);
    }
    const found = items.find((p: any) => safeId(p) === productoSeleccionado);
    return found ? n(found?.valor_total_inventario) : 0;
  }, [productosInventario, productoSeleccionado]);

  // Serie REAL por buckets (con compras/ventas)
  const serie = useMemo(() => {
    const pid = productoSeleccionado === "total" ? "" : productoSeleccionado;

    const map = new Map<
      string,
      { comprasU: number; ventasU: number; comprasV: number; ventasV: number }
    >();
    buckets.forEach((b) => map.set(b.key, { comprasU: 0, ventasU: 0, comprasV: 0, ventasV: 0 }));

    // Movimientos ya filtrados por rango y producto en el fetch
    for (const m of movimientos) {
      const d: Date | null = m.__date;
      if (!d) continue;

      const key = periodo === "mensual" ? toDayKey(d) : toMonthKey(d);
      const slot = map.get(key);
      if (!slot) continue;

      const tipo = getTipoMovimiento(m);
      const qty = getCantidad(m);
      const val = getCostoTotal(m);

      if (tipo === "entrada") {
        slot.comprasU += qty;
        slot.comprasV += val;
      } else if (tipo === "salida") {
        slot.ventasU += qty;
        slot.ventasV += val;
      }
    }

    // neto para calcular stock inicial (desde stock actual)
    let netU = 0;
    let netV = 0;

    for (const slot of map.values()) {
      netU += slot.comprasU - slot.ventasU;
      netV += slot.comprasV - slot.ventasV;
    }

    const stockInicialU = stockActualUnidades - netU;
    const stockInicialV = stockActualValor - netV;

    let runningU = stockInicialU;
    let runningV = stockInicialV;

    const rows = buckets.map((b) => {
      const slot = map.get(b.key)!;

      runningU += slot.comprasU - slot.ventasU;
      runningV += slot.comprasV - slot.ventasV;

      const usarDinero = unidad === "dinero";

      const rawStock = usarDinero ? runningV : runningU;
      const rawCompras = usarDinero ? slot.comprasV : slot.comprasU;
      const rawVentas = usarDinero ? slot.ventasV : slot.ventasU;

      return {
        label: b.label,
        stock: rawStock / divisor,
        compras: rawCompras / divisor,
        ventas: rawVentas / divisor,
        __rawStock: rawStock,
        __rawCompras: rawCompras,
        __rawVentas: rawVentas,
      } as ChartRow;
    });

    return rows;
  }, [
    movimientos,
    buckets,
    periodo,
    unidad,
    divisor,
    stockActualUnidades,
    stockActualValor,
    productoSeleccionado,
  ]);

  const hasRealActivity = useMemo(() => {
    return serie.some((r) => n(r.__rawCompras) > 0 || n(r.__rawVentas) > 0);
  }, [serie]);

  const totalsPeriodo = useMemo(() => {
    const compras = serie.reduce((acc, r) => acc + n(r.__rawCompras), 0);
    const ventas = serie.reduce((acc, r) => acc + n(r.__rawVentas), 0);
    const stock = serie.length ? n(serie[serie.length - 1].__rawStock) : 0;
    return { compras, ventas, stock };
  }, [serie]);

  // Dominio Y: padding pro
  const { yMin, yMax } = useMemo(() => {
    if (!serie.length) return { yMin: 0, yMax: 10 };
    const values = serie.flatMap((d) => [n(d.stock), n(d.compras), n(d.ventas)]);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 10;

    const range = Math.max(1, Math.abs(max - min));
    const pad = range * 0.2;

    const finalMin = min >= 0 ? 0 : min - pad;
    const finalMax = max + pad;

    return { yMin: finalMin, yMax: finalMax };
  }, [serie]);

  const yAxisLabel =
    unidad === "dinero"
      ? `Valor (${formato === "general" ? "moneda" : formato})`
      : `Unidades (${formato === "general" ? "normal" : formato})`;

  const TooltipCard = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    // payload trae keys: stock / compras / ventas (en ese orden depende)
    const byKey = new Map<string, any>();
    payload.forEach((p: any) => byKey.set(p.dataKey, p));

    const rawStock = byKey.get("stock")?.payload?.__rawStock ?? 0;
    const rawCompras = byKey.get("compras")?.payload?.__rawCompras ?? 0;
    const rawVentas = byKey.get("ventas")?.payload?.__rawVentas ?? 0;

    const fmt = (v: number) => {
      if (unidad === "dinero") return `${formatCurrency(v)}${sufijo}`;
      return `${n(v).toLocaleString("es-MX")}${sufijo}`;
    };

    return (
      <div className="rounded-lg border bg-card px-3 py-2 shadow-sm">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Stock</span>
            <span className="font-medium">{fmt(rawStock)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Compras</span>
            <span className="font-medium">{fmt(rawCompras)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Ventas</span>
            <span className="font-medium">{fmt(rawVentas)}</span>
          </div>
        </div>
      </div>
    );
  };

  const tituloPeriodo = periodo === "mensual" ? "del mes actual" : "de los últimos 12 meses";

  return (
    <Card className="border-muted/60">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Historial de inventario</CardTitle>
        </div>

        {/* Controles claros y “pro” */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Producto</label>
            <Select value={productoSeleccionado} onValueChange={setProductoSeleccionado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">📊 Total (Todos)</SelectItem>
                {productosSelect.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Período</label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensual">📅 Mes actual</SelectItem>
                <SelectItem value="anual">📆 Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Mostrar en</label>
            <Select value={unidad} onValueChange={(v) => setUnidad(v as Unidad)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unidades">📦 Unidades</SelectItem>
                <SelectItem value="dinero">💰 Dinero</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Formato</label>
            <Select value={formato} onValueChange={(v) => setFormato(v as Formato)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="miles">Miles (K)</SelectItem>
                <SelectItem value="millones">Millones (M)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardDescription className="mt-3">
          Evolución {tituloPeriodo} —{" "}
          <span className="font-medium text-foreground">{nombreProductoSeleccionado}</span>
        </CardDescription>

        {/* Mini KPI row (pro) */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[11px] text-muted-foreground">Compras en el período</div>
            <div className="text-sm font-semibold">
              {unidad === "dinero" ? formatCurrency(totalsPeriodo.compras) : totalsPeriodo.compras.toLocaleString("es-MX")}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[11px] text-muted-foreground">Ventas en el período</div>
            <div className="text-sm font-semibold">
              {unidad === "dinero" ? formatCurrency(totalsPeriodo.ventas) : totalsPeriodo.ventas.toLocaleString("es-MX")}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[11px] text-muted-foreground">Stock al cierre</div>
            <div className="text-sm font-semibold">
              {unidad === "dinero" ? formatCurrency(totalsPeriodo.stock) : totalsPeriodo.stock.toLocaleString("es-MX")}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loadingMovs ? (
          <div className="h-[380px] flex items-center justify-center text-muted-foreground">
            Cargando movimientos reales…
          </div>
        ) : errorMovs ? (
          <div className="h-[380px] flex items-center justify-center text-muted-foreground">
            {errorMovs}
          </div>
        ) : serie.length > 0 ? (
          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 14, right: 16, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

                <XAxis
                  dataKey="label"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickMargin={8}
                  interval="preserveStartEnd"
                />

                <YAxis
                  className="text-xs"
                  domain={[yMin, yMax]}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickMargin={8}
                  width={56}
                  label={{
                    value: yAxisLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
                  }}
                />

                <Tooltip content={<TooltipCard />} />

                {/* Stock como área (moderno y legible) */}
                <Area
                  type="monotone"
                  dataKey="stock"
                  name="Stock"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.10}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />

                {/* Compras y Ventas como barras (se notan picos reales) */}
                <Bar
                  dataKey="compras"
                  name="Compras"
                  fill="hsl(142, 76%, 36%)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={26}
                />
                <Bar
                  dataKey="ventas"
                  name="Ventas"
                  fill="hsl(346, 77%, 50%)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={26}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Leyenda pro */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: "hsl(var(--primary))" }} />
                Stock
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: "hsl(142, 76%, 36%)" }} />
                Compras
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: "hsl(346, 77%, 50%)" }} />
                Ventas
              </div>
            </div>

            {!hasRealActivity && (
              <div className="mt-2 text-center text-xs text-muted-foreground">
                Hay stock, pero no se detectaron compras/ventas dentro del período seleccionado.
                Prueba “Mes actual” o revisa si tus movimientos están fuera del rango.
              </div>
            )}
          </div>
        ) : (
          <div className="h-[380px] flex items-center justify-center text-muted-foreground">
            No hay movimientos para el período seleccionado.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GraficaHistorialInventario;
