import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";

const TablaRotacionInventario = () => {
  const { data: productos, isLoading } = useInventarioConMovimientos();

  // Ordenar por días de rotación (más lentos primero)
  const productosOrdenados = [...(productos || [])].sort((a, b) => {
    if (!a.dias_promedio_rotacion) return 1;
    if (!b.dias_promedio_rotacion) return -1;
    return b.dias_promedio_rotacion - a.dias_promedio_rotacion;
  });

  const getRotacionBadge = (estado: string | undefined, dias: number | undefined) => {
    if (!estado || dias === undefined) {
      return <Badge variant="secondary">Sin movimiento</Badge>;
    }

    if (estado === "alta") {
      return <Badge className="bg-success text-success-foreground">Alta</Badge>;
    } else if (estado === "media") {
      return <Badge className="bg-muted text-muted-foreground">Media</Badge>;
    } else if (estado === "baja") {
      return <Badge variant="secondary">Baja</Badge>;
    } else if (estado === "muy_baja") {
      return <Badge variant="destructive">Muy Baja</Badge>;
    } else {
      return <Badge variant="secondary">Sin movimiento</Badge>;
    }
  };

  const formatDias = (dias: number | undefined) => {
    if (!dias || dias === 0) return "Sin datos";
    return `${dias.toFixed(0)} días`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Cargando datos de rotación...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <CardTitle>Rotación de Inventario</CardTitle>
        </div>
        <CardDescription>
          Promedio de días que tarda cada producto en salir del inventario
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Stock Actual</TableHead>
              <TableHead className="text-right">Días Promedio</TableHead>
              <TableHead className="text-center">Estado Rotación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productosOrdenados.length > 0 ? (
              productosOrdenados.map((producto) => (
                <TableRow key={producto.id}>
                  <TableCell className="font-medium">{producto.nombre}</TableCell>
                  <TableCell className="text-right">
                    {producto.cantidad_stock.toLocaleString()} unidades
                  </TableCell>
                  <TableCell className="text-right">
                    {formatDias(producto.dias_promedio_rotacion)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getRotacionBadge(producto.estado_rotacion, producto.dias_promedio_rotacion)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No hay productos de inventario
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default TablaRotacionInventario;
