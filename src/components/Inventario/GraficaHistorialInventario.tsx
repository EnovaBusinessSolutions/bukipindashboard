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

const GraficaHistorialInventario = () => {
  const [productoSeleccionado, setProductoSeleccionado] = useState<string>("total");
  const [periodo, setPeriodo] = useState<Periodo>("anual");
  const [unidad, setUnidad] = useState<Unidad>("unidades");
  const [formato, setFormato] = useState<Formato>("general");

  const { data: productosInventario = [] } = useInventarioConMovimientos();
  const { data: datosHistoricos = [], isLoading } = useHistoricoInventario(productoSeleccionado, periodo);

  const divisor = formato === "miles" ? 1000 : formato === "millones" ? 1_000_000 : 1;
  const sufijo = formato === "miles" ? "K" : formato === "millones" ? "M" : "";

  const nombreProductoSeleccionado = useMemo(() => {
    if (productoSeleccionado === "total") return "Todos los productos";
    return productosInventario.find((p: any) => p.id === productoSeleccionado)?.nombre ?? "Producto";
  }, [productoSeleccionado, productosInventario]);

  const datosFormateados: ChartRow[] = useMemo(() => {
    const usarDinero = unidad === "dinero";

    return (datosHistoricos || []).map((dato: any) => {
      const stock = usarDinero ? n(dato.stock_valor) : n(dato.stock);
      const compras = usarDinero ? n(dato.compras_valor) : n(dato.compras);
      const ventas = usarDinero ? n(dato.ventas_valor) : n(dato.ventas);

      return {
        mes: String(dato.mes ?? ""),
        stock: stock / divisor,
        compras: compras / divisor,
        ventas: ventas / divisor,
      };
    });
  }, [datosHistoricos, unidad, divisor]);

  // Dominio Y “pro”: contempla negativos y deja padding
  const { yMin, yMax } = useMemo(() => {
    if (!datosFormateados.length) return { yMin: 0, yMax: 100 };

    const values = datosFormateados.flatMap((d) => [n(d.stock), n(d.compras), n(d.ventas)]);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 100;

    // padding visual
    const range = Math.max(1, Math.abs(max - min));
    const pad = range * 0.18;

    // Si todo es positivo, arranca en 0 para lectura fácil
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
        // El valor viene “dividido” por K/M si aplica, así que mostramos sufijo y moneda
        // formatCurrency ya te lo deja pro; solo agregamos sufijo si aplica
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
                {(productosInventario || []).map((producto: any) => (
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
        {isLoading ? (
          <div className="h-[380px] flex items-center justify-center text-muted-foreground">
            Cargando datos históricos...
          </div>
        ) : datosFormateados.length > 0 ? (
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

                {/* Stock */}
                <Line
                  type="monotone"
                  dataKey="stock"
                  name="Stock"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />

                {/* Compras */}
                <Line
                  type="monotone"
                  dataKey="compras"
                  name="Compras"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />

                {/* Ventas */}
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

            {/* Leyenda “pro” abajo */}
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
