import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useProductos } from "@/hooks/useProductos";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InventoryStatus = "disponible" | "agotado" | "bajo_stock";

const ControlInventario = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | "todos">("todos");
  
  const { data: productos, isLoading } = useProductos();

  // Filtrar solo productos de inventario (que tienen cantidad_stock > 0 o cantidad_comprada > 0)
  const productosInventario = productos?.filter(producto => 
    (producto.cantidad_stock && producto.cantidad_stock > 0) || 
    (producto.cantidad_comprada && producto.cantidad_comprada > 0)
  ) || [];

  // Usar datos reales de inventario
  const inventoryData = productosInventario.map(producto => ({
    ...producto,
    stock_actual: producto.cantidad_stock || 0,
    stock_minimo: 10, // Puede ser configurable en el futuro
    stock_maximo: 100, // Puede ser configurable en el futuro
    costo_promedio: producto.costo_unitario || 0,
    valor_total: producto.valor_total_inventario || 0,
    entradas_mes: producto.cantidad_comprada || 0, // Total comprado
    salidas_mes: Math.max(0, (producto.cantidad_comprada || 0) - (producto.cantidad_stock || 0)), // Vendido/usado
  }));

  const getStockStatus = (actual: number, minimo: number): InventoryStatus => {
    if (actual === 0) return "agotado";
    if (actual <= minimo) return "bajo_stock";
    return "disponible";
  };

  const getStatusBadge = (status: InventoryStatus) => {
    switch (status) {
      case "disponible":
        return <Badge className="bg-green-100 text-green-800">Disponible</Badge>;
      case "bajo_stock":
        return <Badge className="bg-yellow-100 text-yellow-800">Bajo Stock</Badge>;
      case "agotado":
        return <Badge className="bg-red-100 text-red-800">Agotado</Badge>;
    }
  };

  const filteredProducts = inventoryData.filter(producto => {
    const matchesSearch = producto.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const status = getStockStatus(producto.stock_actual, producto.stock_minimo);
    const matchesStatus = statusFilter === "todos" || status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: inventoryData.length,
    disponible: inventoryData.filter(p => getStockStatus(p.stock_actual, p.stock_minimo) === "disponible").length,
    bajo_stock: inventoryData.filter(p => getStockStatus(p.stock_actual, p.stock_minimo) === "bajo_stock").length,
    agotado: inventoryData.filter(p => getStockStatus(p.stock_actual, p.stock_minimo) === "agotado").length,
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Cargando control de inventario...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas de inventario */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Productos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Disponibles</p>
                <p className="text-2xl font-bold text-green-600">{stats.disponible}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bajo Stock</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.bajo_stock}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Agotados</p>
                <p className="text-2xl font-bold text-red-600">{stats.agotado}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Control de Inventario</CardTitle>
          <CardDescription>
            Monitorea el stock y movimientos de tus productos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="disponible">Disponible</SelectItem>
                <SelectItem value="bajo_stock">Bajo Stock</SelectItem>
                <SelectItem value="agotado">Agotado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {inventoryData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Stock Actual</TableHead>
                  <TableHead>Stock Mínimo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Costo Unitario</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Total Comprado</TableHead>
                  <TableHead>Total Usado/Vendido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((producto) => {
                  const status = getStockStatus(producto.stock_actual, producto.stock_minimo);
                  return (
                    <TableRow key={producto.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {producto.imagen_url ? (
                            <img
                              src={producto.imagen_url}
                              alt={producto.nombre}
                              className="w-10 h-10 object-cover rounded"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{producto.nombre}</p>
                            <p className="text-sm text-muted-foreground">
                              {producto.subcuenta_nombre || "Sin subcuenta"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`font-semibold ${
                          status === "agotado" ? "text-red-600" : 
                          status === "bajo_stock" ? "text-yellow-600" : "text-green-600"
                        }`}>
                          {producto.stock_actual}
                        </span>
                      </TableCell>
                      <TableCell>{producto.stock_minimo}</TableCell>
                      <TableCell>
                        {getStatusBadge(status)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {new Intl.NumberFormat('es-CO', {
                          style: 'currency',
                          currency: 'COP',
                          minimumFractionDigits: 0,
                        }).format(producto.costo_promedio)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {new Intl.NumberFormat('es-CO', {
                          style: 'currency',
                          currency: 'COP',
                          minimumFractionDigits: 0,
                        }).format(producto.valor_total)}
                      </TableCell>
                      <TableCell>
                        <span className="text-blue-600 font-medium">{producto.entradas_mes}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-orange-600 font-medium">{producto.salidas_mes}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {productosInventario.length === 0 
                ? "No hay productos de inventario registrados. Registra tu primera compra en la pestaña 'Registro de Productos'."
                : "No se encontraron productos con los filtros seleccionados"
              }
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ControlInventario;