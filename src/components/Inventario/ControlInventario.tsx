import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, TrendingUp, TrendingDown, AlertTriangle, Edit, Check, X } from "lucide-react";
import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";
import { useUpdateProducto } from "@/hooks/useProductos";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InventoryStatus = "disponible" | "agotado" | "negativo";
type StockLevel = "alto" | "medio" | "bajo";

const ControlInventario = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | StockLevel | "todos">("todos");
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);
  
  const { data: productosInventario, isLoading } = useInventarioConMovimientos();
  const updateProducto = useUpdateProducto();

  // Procesar datos de inventario con métricas calculadas
  const inventoryData = (productosInventario || []).map(producto => {
    return {
      ...producto,
      stock_actual: producto.cantidad_stock,
      stock_minimo: 10, // Puede ser configurable en el futuro
      stock_maximo: 100, // Puede ser configurable en el futuro
      costo_promedio: producto.costo_unitario,
      valor_total: producto.valor_total_inventario,
      entradas_mes: producto.cantidad_comprada,
      salidas_mes: producto.cantidad_vendida,
      precio_venta: producto.precio_venta,
      subcuenta_nombre: producto.subcuenta_nombre
    };
  });

  const getAvailabilityStatus = (actual: number): InventoryStatus => {
    if (actual > 0) return "disponible";
    if (actual < 0) return "negativo";
    return "agotado";
  };

  const getStockLevel = (actual: number, minimo: number, maximo: number): StockLevel => {
    if (actual <= minimo) return "bajo";
    if (actual >= maximo * 0.7) return "alto";
    return "medio";
  };

  const getAvailabilityBadge = (status: InventoryStatus) => {
    switch (status) {
      case "disponible":
        return <Badge className="bg-green-100 text-green-800">Disponible</Badge>;
      case "negativo":
        return <Badge className="bg-red-100 text-red-800">Vendido sin Stock</Badge>;
      case "agotado":
        return <Badge className="bg-orange-100 text-orange-800">Agotado</Badge>;
    }
  };

  const getStockLevelBadge = (level: StockLevel) => {
    switch (level) {
      case "alto":
        return <Badge className="bg-blue-100 text-blue-800">Alto Stock</Badge>;
      case "medio":
        return <Badge className="bg-yellow-100 text-yellow-800">Medio Stock</Badge>;
      case "bajo":
        return <Badge className="bg-orange-100 text-orange-800">Bajo Stock</Badge>;
    }
  };

  const filteredProducts = inventoryData.filter(producto => {
    const matchesSearch = producto.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const availability = getAvailabilityStatus(producto.stock_actual);
    const stockLevel = getStockLevel(producto.stock_actual, producto.stock_minimo, producto.stock_maximo);
    const matchesStatus = statusFilter === "todos" || availability === statusFilter || stockLevel === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: inventoryData.length,
    disponible: inventoryData.filter(p => getAvailabilityStatus(p.stock_actual) === "disponible").length,
    agotado: inventoryData.filter(p => getAvailabilityStatus(p.stock_actual) === "agotado").length,
    bajo_stock: inventoryData.filter(p => getStockLevel(p.stock_actual, p.stock_minimo, p.stock_maximo) === "bajo").length,
    medio_stock: inventoryData.filter(p => getStockLevel(p.stock_actual, p.stock_minimo, p.stock_maximo) === "medio").length,
    alto_stock: inventoryData.filter(p => getStockLevel(p.stock_actual, p.stock_minimo, p.stock_maximo) === "alto").length,
  };

  const handleEditPrice = (productId: string, currentPrice: number) => {
    setEditingPrice(productId);
    setTempPrice(currentPrice);
  };

  const handleSavePrice = async (productId: string) => {
    try {
      await updateProducto.mutateAsync({
        id: productId,
        precio: tempPrice
      });
      setEditingPrice(null);
      setTempPrice(0);
    } catch (error) {
      console.error("Error updating price:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingPrice(null);
    setTempPrice(0);
  };

  const formatPrice = (precio: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(precio);
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <p className="text-sm font-medium text-muted-foreground">Alto Stock</p>
                <p className="text-2xl font-bold text-blue-600">{stats.alto_stock}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bajo Stock</p>
                <p className="text-2xl font-bold text-orange-600">{stats.bajo_stock}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
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
                  <SelectItem value="negativo">Vendido sin Stock</SelectItem>
                  <SelectItem value="agotado">Agotado</SelectItem>
                  <SelectItem value="alto">Alto Stock</SelectItem>
                  <SelectItem value="medio">Medio Stock</SelectItem>
                  <SelectItem value="bajo">Bajo Stock</SelectItem>
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
                  <TableHead>Disponibilidad</TableHead>
                  <TableHead>Nivel de Stock</TableHead>
                  <TableHead>Costo Unitario</TableHead>
                  <TableHead>Precio de Venta</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Total Comprado</TableHead>
                  <TableHead>Total Usado/Vendido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((producto) => {
                  const availability = getAvailabilityStatus(producto.stock_actual);
                  const stockLevel = getStockLevel(producto.stock_actual, producto.stock_minimo, producto.stock_maximo);
                  return (
                    <TableRow key={producto.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {availability === "negativo" && (
                            <div className="flex-shrink-0" title="¡Atención! Debes comprar para compensar el inventario negativo">
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                          )}
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
                          availability === "agotado" ? "text-red-600" : 
                          stockLevel === "bajo" ? "text-orange-600" : 
                          stockLevel === "medio" ? "text-yellow-600" : "text-green-600"
                        }`}>
                          {producto.stock_actual}
                        </span>
                      </TableCell>
                      <TableCell>{producto.stock_minimo}</TableCell>
                      <TableCell>
                        {getAvailabilityBadge(availability)}
                      </TableCell>
                      <TableCell>
                        {getStockLevelBadge(stockLevel)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {new Intl.NumberFormat('es-CO', {
                          style: 'currency',
                          currency: 'COP',
                          minimumFractionDigits: 0,
                        }).format(producto.costo_promedio)}
                      </TableCell>
                      <TableCell>
                        {editingPrice === producto.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(Number(e.target.value))}
                              className="w-24 h-8"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSavePrice(producto.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                            />
                            <Button 
                              size="sm" 
                              onClick={() => handleSavePrice(producto.id)}
                              disabled={updateProducto.isPending}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={handleCancelEdit}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-green-600">
                              {formatPrice(producto.precio_venta || 0)}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditPrice(producto.id, producto.precio_venta || 0)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={`font-semibold ${producto.valor_total < 0 ? 'text-red-600' : ''}`}>
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
              {inventoryData.length === 0 
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