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

const GraficaHistorialInventario = () => {
  const [productoSeleccionado, setProductoSeleccionado] = useState<string | null>(null);
  const { data: productos } = useProductos();
  const { data: datosHistoricos, isLoading } = useHistoricoInventario(productoSeleccionado);

  // Filtrar solo productos de inventario (código 1005)
  const productosInventario = productos?.filter((p) => p.cuenta_codigo === "1005" && p.activo) || [];

  // Seleccionar el primer producto por defecto
  React.useEffect(() => {
    if (!productoSeleccionado && productosInventario.length > 0) {
      setProductoSeleccionado(productosInventario[0].id);
    }
  }, [productosInventario, productoSeleccionado]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <CardTitle>Historial de Inventario por Producto</CardTitle>
          </div>
          <Select value={productoSeleccionado || ""} onValueChange={setProductoSeleccionado}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Seleccionar producto" />
            </SelectTrigger>
            <SelectContent>
              {productosInventario.map((producto) => (
                <SelectItem key={producto.id} value={producto.id}>
                  {producto.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CardDescription>
          Evolución mensual de stock, compras y ventas del producto seleccionado
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Cargando datos históricos...
          </div>
        ) : datosHistoricos && datosHistoricos.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={datosHistoricos}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="mes" 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="stock"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="Stock Actual"
                dot={{ fill: "hsl(var(--primary))" }}
              />
              <Line
                type="monotone"
                dataKey="compras"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                name="Compras"
                dot={{ fill: "hsl(142, 76%, 36%)" }}
              />
              <Line
                type="monotone"
                dataKey="ventas"
                stroke="hsl(346, 77%, 50%)"
                strokeWidth={2}
                name="Ventas"
                dot={{ fill: "hsl(346, 77%, 50%)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No hay datos históricos para este producto
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GraficaHistorialInventario;
