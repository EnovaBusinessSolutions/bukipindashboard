import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { useProductos } from "@/hooks/useProductos";
import { useHistoricoInventario } from "@/hooks/useHistoricoInventario";

type Periodo = "mensual" | "anual";
type Unidad = "unidades" | "dinero";
type Formato = "general" | "miles" | "millones";

const GraficaHistorialInventario = () => {
  const [productoSeleccionado, setProductoSeleccionado] = useState<string>("total");
  const [periodo, setPeriodo] = useState<Periodo>("anual");
  const [unidad, setUnidad] = useState<Unidad>("unidades");
  const [formato, setFormato] = useState<Formato>("general");
  
  const { data: productos } = useProductos();
  const { data: datosHistoricos, isLoading } = useHistoricoInventario(productoSeleccionado, periodo);

  // Filtrar solo productos de inventario (código 1005)
  const productosInventario = productos?.filter((p) => p.cuenta_codigo === "1005" && p.activo) || [];

  // Formatear valores según el formato seleccionado
  const formatearValor = (valor: number): number => {
    if (formato === "miles") return valor / 1000;
    if (formato === "millones") return valor / 1000000;
    return valor;
  };

  // Formatear datos para la gráfica
  const datosFormateados = datosHistoricos?.map((dato) => {
    const usarDinero = unidad === "dinero";
    return {
      mes: dato.mes,
      stock: formatearValor(usarDinero ? dato.stock_valor : dato.stock),
      compras: formatearValor(usarDinero ? dato.compras_valor : dato.compras),
      ventas: formatearValor(usarDinero ? dato.ventas_valor : dato.ventas),
    };
  }) || [];

  // Etiqueta de unidad para la gráfica
  const etiquetaUnidad = unidad === "dinero" ? "$" : "unidades";
  const sufijo = formato === "miles" ? "K" : formato === "millones" ? "M" : "";
  const etiquetaCompleta = `${etiquetaUnidad}${sufijo}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5" />
          <CardTitle>Historial de Inventario</CardTitle>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Selector de Producto */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Producto</label>
            <Select value={productoSeleccionado} onValueChange={setProductoSeleccionado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">📊 Total (Todos)</SelectItem>
                {productosInventario.map((producto) => (
                  <SelectItem key={producto.id} value={producto.id}>
                    {producto.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selector de Período */}
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

          {/* Selector de Unidad */}
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

          {/* Selector de Formato */}
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
          {productoSeleccionado === "total" 
            ? `Evolución ${periodo === "mensual" ? "del mes actual" : "de los últimos 12 meses"} - Todos los productos`
            : `Evolución ${periodo === "mensual" ? "del mes actual" : "de los últimos 12 meses"} - ${productosInventario.find(p => p.id === productoSeleccionado)?.nombre || ""}`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Cargando datos históricos...
          </div>
        ) : datosFormateados && datosFormateados.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={datosFormateados}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="mes" 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                label={{ 
                  value: etiquetaCompleta, 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fill: "hsl(var(--muted-foreground))" }
                }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value: number) => [
                  `${unidad === "dinero" ? "$" : ""}${value.toLocaleString("es-MX", { 
                    minimumFractionDigits: 0, 
                    maximumFractionDigits: 2 
                  })}${sufijo}`,
                  ""
                ]}
              />
              <Legend 
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    stock: "Stock Actual",
                    compras: "Compras",
                    ventas: "Ventas"
                  };
                  return labels[value] || value;
                }}
              />
              <Line
                type="monotone"
                dataKey="stock"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="stock"
                dot={{ fill: "hsl(var(--primary))" }}
              />
              <Line
                type="monotone"
                dataKey="compras"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                name="compras"
                dot={{ fill: "hsl(142, 76%, 36%)" }}
              />
              <Line
                type="monotone"
                dataKey="ventas"
                stroke="hsl(346, 77%, 50%)"
                strokeWidth={2}
                name="ventas"
                dot={{ fill: "hsl(346, 77%, 50%)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No hay datos históricos {periodo === "mensual" ? "para el mes actual" : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GraficaHistorialInventario;
