import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";
import { useHistoricoInventario } from "@/hooks/useHistoricoInventario";
import { formatCurrency } from "@/lib/utils";

type Periodo = "mensual" | "anual";
type Unidad = "unidades" | "dinero";
type Formato = "general" | "miles" | "millones";

type ChartRow = {
  mes: string;
  stock: number;
  compras: number;
  ventas: number;
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

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // timestamp / ISO
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

// Extrae movimientos desde productosInventario con tolerancia de nombres
function extractMovimientos(productos: any[], productId: string | null) {
  const prods = Array.isArray(productos) ? productos : [];
  const selected =
    !productId ? prods : prods.filter((p) => safeId(p) === String(productId));

  const movimientos: any[] = [];
  for (const p of selected) {
    const movs =
      p?.movimientos ??
      p?.movimientos_inventario ??
      p?.inventoryMovements ??
      p?.history ??
      [];
    if (Array.isArray(movs)) {
      movs.forEach((m) => movimientos.push({ ...m, __pid: safeId(p) }));
    }
  }
  return movimientos;
}

function getTipoMovimiento(m: any): "entrada" | "salida" | "otro" {
  const t = String(m?.tipo ?? m?.type ?? m?.movimiento ?? m?.movementType ?? "").toLowerCase();

  // Normaliza variantes
  if (t.includes("entrada") || t.includes("compra") || t.includes("in")) return "entrada";
  if (t.includes("salida") || t.includes("venta") || t.includes("out")) return "salida";

  // A veces viene como boolean o enum
  const isEntrada = m?.isEntrada ?? m?.entrada ?? false;
  const isSalida = m?.isSalida ?? m?.salida ?? false;
  if (isEntrada) return "entrada";
  if (isSalida) return "salida";

  return "otro";
}

function getCantidad(m: any) {
  // alias comunes
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
  // Si no viene costo_total, intenta qty * costo_unitario
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

type Props = {
  // opcional: si luego quieres pasar los productos desde el padre
  productosInventarioProp?: any[];
};

const GraficaHistorialInventario: React.FC<Props> = ({ productosInventarioProp }) => {
  const [productoSeleccionado, setProductoSeleccionado] = useState<string>("total");
  const [periodo, setPeriodo] = useState<Periodo>("anual");
  const [unidad, setUnidad] = useState<Unidad>("unidades");
  const [formato, setFormato] = useState<Formato>("general");

  const { data: productosInventarioHook = [] } = useInventarioConMovimientos();
  const productosInventario = productosInventarioProp ?? productosInventarioHook;

  // 👇 IMPORTANTÍSIMO:
  // Muchos backends no entienden "total". Si mandas "" o null suelen regresar el agregado.
  // (No rompemos TS: lo casteamos a any).
  const productIdForQuery: any = productoSeleccionado === "total" ? "" : productoSeleccionado;

  const { data: datosHistoricos = [], isLoading } = useHistoricoInventario(productIdForQuery, periodo);

  const divisor = formato === "miles" ? 1000 : formato === "millones" ? 1_000_000 : 1;
  const sufijo = formato === "miles" ? "K" : formato === "millones" ? "M" : "";

  const nombreProductoSeleccionado = useMemo(() => {
    if (productoSeleccionado === "total") return "Todos los productos";
    const found = (productosInventario || []).find((p: any) => safeId(p) === productoSeleccionado);
    return found?.nombre ?? "Producto";
  }, [productoSeleccionado, productosInventario]);

  // ---------- FALLBACK E2E: construir histórico desde movimientos reales ----------
  const historicoDesdeMovimientos = useMemo(() => {
    const today = new Date();
    const end = endOfDay(today);

    let start: Date;
    let buckets: { key: string; label: string; date: Date }[] = [];

    if (periodo === "mensual") {
      start = startOfMonth(today);

      // buckets por día del mes (hasta hoy)
      const d = new Date(start);
      while (d <= end) {
        buckets.push({ key: toDayKey(d), label: dayLabelES(d), date: new Date(d) });
        d.setDate(d.getDate() + 1);
      }
    } else {
      // últimos 12 meses incluyendo mes actual
      const startMonth = addMonths(startOfMonth(today), -11);
      start = new Date(startMonth);

      for (let i = 0; i < 12; i++) {
        const md = addMonths(startMonth, i);
        buckets.push({ key: toMonthKey(md), label: monthLabelES(md), date: md });
      }
    }

    const selectedProductId = productoSeleccionado === "total" ? null : productoSeleccionado;
    const movimientos = extractMovimientos(productosInventario || [], selectedProductId);

    // filtrar por periodo
    const movsPeriodo = movimientos
      .map((m) => {
        const d = parseAnyDate(m?.fecha ?? m?.date ?? m?.createdAt ?? m?.fecha_movimiento ?? m?.movementDate);
        return { ...m, __date: d };
      })
      .filter((m) => m.__date && m.__date >= start && m.__date <= end);

    // stock actual (unidades y valor) del seleccionado / total
    const productos = Array.isArray(productosInventario) ? productosInventario : [];
    const selectedProducts =
      !selectedProductId ? productos : productos.filter((p: any) => safeId(p) === selectedProductId);

    const stockActualUnidades = selectedProducts.reduce((acc, p) => acc + n(p?.cantidad_stock), 0);
    const stockActualValor = selectedProducts.reduce((acc, p) => acc + n(p?.valor_total_inventario), 0);

    // neto de movimientos en el periodo (para obtener stock inicial)
    let netU = 0;
    let netV = 0;

    for (const m of movsPeriodo) {
      const tipo = getTipoMovimiento(m);
      const qty = getCantidad(m);
      const val = getCostoTotal(m);

      if (tipo === "entrada") {
        netU += qty;
        netV += val;
      } else if (tipo === "salida") {
        netU -= qty;
        netV -= val;
      }
    }

    const stockInicialUnidades = stockActualUnidades - netU;
    const stockInicialValor = stockActualValor - netV;

    // agrega compras/ventas por bucket
    const map = new Map<string, { comprasU: number; ventasU: number; comprasV: number; ventasV: number }>();
    buckets.forEach((b) => map.set(b.key, { comprasU: 0, ventasU: 0, comprasV: 0, ventasV: 0 }));

    for (const m of movsPeriodo) {
      const d: Date = m.__date;
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

    // construye serie con stock acumulado
    let runningU = stockInicialUnidades;
    let runningV = stockInicialValor;

    const rows = buckets.map((b) => {
      const slot = map.get(b.key)!;

      runningU += slot.comprasU - slot.ventasU;
      runningV += slot.comprasV - slot.ventasV;

      return {
        mes: b.label,
        stock: runningU,
        compras: slot.comprasU,
        ventas: slot.ventasU,
        stock_valor: runningV,
        compras_valor: slot.comprasV,
        ventas_valor: slot.ventasV,
      };
    });

    // si no hubo ningún movimiento y el stock está en 0, puede salir plano, pero NO vacío.
    return rows;
  }, [productosInventario, productoSeleccionado, periodo]);

  // Usamos el endpoint si trae data; si no, fallback real con movimientos
  const historicoFinal = useMemo(() => {
    const h = Array.isArray(datosHistoricos) ? datosHistoricos : [];
    if (h.length > 0) return h;
    return historicoDesdeMovimientos;
  }, [datosHistoricos, historicoDesdeMovimientos]);

  const datosFormateados: ChartRow[] = useMemo(() => {
    const usarDinero = unidad === "dinero";

    return (historicoFinal || []).map((dato: any) => {
      const stock = usarDinero ? n(dato.stock_valor ?? dato.stockValor ?? dato.stock_value) : n(dato.stock);
      const compras = usarDinero ? n(dato.compras_valor ?? dato.comprasValor ?? dato.compras_value) : n(dato.compras);
      const ventas = usarDinero ? n(dato.ventas_valor ?? dato.ventasValor ?? dato.ventas_value) : n(dato.ventas);

      return {
        mes: String(dato.mes ?? ""),
        stock: stock / divisor,
        compras: compras / divisor,
        ventas: ventas / divisor,
      };
    });
  }, [historicoFinal, unidad, divisor]);

  // Dominio Y “pro”: contempla negativos y deja padding
  const { yMin, yMax } = useMemo(() => {
    if (!datosFormateados.length) return { yMin: 0, yMax: 100 };

    const values = datosFormateados.flatMap((d) => [n(d.stock), n(d.compras), n(d.ventas)]);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 100;

    const range = Math.max(1, Math.abs(max - min));
    const pad = range * 0.18;

    const finalMin = min >= 0 ? 0 : min - pad;
    const finalMax = max + pad;

    return { yMin: finalMin, yMax: finalMax };
  }, [datosFormateados]);

  // Tooltip tipo “card” pro
  const TooltipCard = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const getLabel = (key: string) => {
      if (key === "stock") return "Stock";
      if (key === "compras") return "Compras";
      if (key === "ventas") return "Ventas";
      return key;
    };

    const formatValue = (val: number) => {
      const value = n(val);
      if (unidad === "dinero") {
        return `${formatCurrency(value)}${sufijo}`;
      }
      return `${value.toLocaleString("es-MX", { maximumFractionDigits: 2 })}${sufijo}`;
    };

    return (
      <div className="rounded-lg border bg-card px-3 py-2 shadow-sm">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 space-y-1">
          {payload.map((p: any) => (
            <div key={p.dataKey} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                <span className="text-muted-foreground">{getLabel(p.dataKey)}</span>
              </div>
              <span className="font-medium">{formatValue(p.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const yAxisLabel =
    unidad === "dinero"
      ? `Valor (${formato === "general" ? "moneda" : formato})`
      : `Unidades (${formato === "general" ? "normal" : formato})`;

  // Opciones de productos con id robusto
  const productosSelect = useMemo(() => {
    return (productosInventario || [])
      .map((p: any) => ({
        id: safeId(p),
        nombre: p?.nombre ?? "Producto",
      }))
      .filter((p) => p.id);
  }, [productosInventario]);

  return (
    <Card className="border-muted/60">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Historial de inventario</CardTitle>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Producto */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Producto</label>
            <Select value={productoSeleccionado} onValueChange={setProductoSeleccionado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">📊 Total (Todos)</SelectItem>
                {productosSelect.map((producto) => (
                  <SelectItem key={producto.id} value={producto.id}>
                    {producto.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Período */}
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

          {/* Unidad */}
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

          {/* Formato */}
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
          Evolución {periodo === "mensual" ? "del mes actual" : "de los últimos 12 meses"} —{" "}
          <span className="font-medium text-foreground">{nombreProductoSeleccionado}</span>
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Si el endpoint está cargando, pero el fallback ya tiene data, mostramos la gráfica */}
        {datosFormateados.length > 0 ? (
          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datosFormateados} margin={{ top: 14, right: 16, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="mes"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickMargin={8}
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

                <Line
                  type="monotone"
                  dataKey="stock"
                  name="Stock"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="compras"
                  name="Compras"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="ventas"
                  name="Ventas"
                  stroke="hsl(346, 77%, 50%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>

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

            {isLoading && (
              <div className="mt-2 text-center text-xs text-muted-foreground">
                Cargando datos históricos del servidor… (mostrando cálculo con movimientos)
              </div>
            )}
          </div>
        ) : isLoading ? (
          <div className="h-[380px] flex items-center justify-center text-muted-foreground">
            Cargando datos históricos...
          </div>
        ) : (
          <div className="h-[380px] flex items-center justify-center text-muted-foreground">
            No hay datos históricos {periodo === "mensual" ? "para el mes actual" : "para este período"}.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GraficaHistorialInventario;
