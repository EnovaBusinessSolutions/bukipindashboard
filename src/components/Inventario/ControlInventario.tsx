// bukipin-dashboard/src/components/Inventario/ControlInventario.tsx
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, TrendingUp, TrendingDown, AlertTriangle, Edit, Check, X } from "lucide-react";
import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";
import { useUpdateProducto } from "@/hooks/useProductos";
import { formatCurrency } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type InventoryStatus = "disponible" | "agotado" | "negativo";
type StockLevel = "alto" | "medio" | "bajo";

type StatusFilter = InventoryStatus | StockLevel | "todos";

const n = (v: any) => {
  const num = Number(v ?? 0);
  return Number.isFinite(num) ? num : 0;
};

const ControlInventario = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);

  const { data: productosInventario, isLoading, isError } = useInventarioConMovimientos();
  const updateProducto = useUpdateProducto();

  // Procesar datos de inventario con métricas calculadas + NORMALIZACIÓN ROBUSTA
  const inventoryData = useMemo(() => {
    const list = productosInventario || [];

    return list.map((producto: any) => {
      const stock = n(producto.cantidad_stock);
      const comprado = n(producto.cantidad_comprada);
      const vendido = n(producto.cantidad_vendida);

      const costoUnitario = n(producto.costo_unitario);
      const valorTotal = n(producto.valor_total_inventario);

      // “Precio configurado” (compat): preferimos precio_venta si existe, si no usamos precio
      const precioConfigurado = n(producto.precio_venta ?? producto.precio ?? 0);

      return {
        ...producto,

        // métricas normalizadas
        stock_actual: stock,
        stock_minimo: 10,
        stock_maximo: 100,

        costo_promedio: costoUnitario,
        valor_total: valorTotal,

        entradas_mes: comprado,
        salidas_mes: vendido,

        // UI fields robustos
        precio_configurado: precioConfigurado,
        imagen_url: producto.imagen_url ?? null,
        subcuenta_nombre: producto.subcuenta_nombre ?? null,
        descripcion: producto.descripcion ?? null,
        nombre: String(producto.nombre ?? ""),
      };
    });
  }, [productosInventario]);

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
        return <Badge className="bg-green-100 text-green-800 border border-green-200">Disponible</Badge>;
      case "negativo":
        return <Badge className="bg-red-100 text-red-800 border border-red-200">Vendido sin Stock</Badge>;
      case "agotado":
        return <Badge className="bg-orange-100 text-orange-800 border border-orange-200">Agotado</Badge>;
    }
  };

  const getStockLevelBadge = (level: StockLevel) => {
    switch (level) {
      case "alto":
        return <Badge className="bg-blue-100 text-blue-800 border border-blue-200">Alto</Badge>;
      case "medio":
        return <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200">Medio</Badge>;
      case "bajo":
        return <Badge className="bg-orange-100 text-orange-800 border border-orange-200">Bajo</Badge>;
    }
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return inventoryData.filter((producto: any) => {
      const name = String(producto.nombre ?? "").toLowerCase();
      const matchesSearch = !term || name.includes(term);

      const availability = getAvailabilityStatus(producto.stock_actual);
      const stockLevel = getStockLevel(producto.stock_actual, producto.stock_minimo, producto.stock_maximo);

      const matchesStatus =
        statusFilter === "todos" || availability === statusFilter || stockLevel === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [inventoryData, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = inventoryData.length;
    const disponible = inventoryData.filter((p: any) => getAvailabilityStatus(p.stock_actual) === "disponible").length;
    const agotado = inventoryData.filter((p: any) => getAvailabilityStatus(p.stock_actual) === "agotado").length;
    const bajo_stock = inventoryData.filter((p: any) => getStockLevel(p.stock_actual, p.stock_minimo, p.stock_maximo) === "bajo").length;
    const medio_stock = inventoryData.filter((p: any) => getStockLevel(p.stock_actual, p.stock_minimo, p.stock_maximo) === "medio").length;
    const alto_stock = inventoryData.filter((p: any) => getStockLevel(p.stock_actual, p.stock_minimo, p.stock_maximo) === "alto").length;

    return { total, disponible, agotado, bajo_stock, medio_stock, alto_stock };
  }, [inventoryData]);

  const handleEditPrice = (productId: string, currentPrice: number) => {
    setEditingPrice(productId);
    setTempPrice(n(currentPrice));
  };

  const handleSavePrice = async (productId: string) => {
    try {
      // ✅ Compat: el backend hoy soporta "precio"
      // 🧩 y dejamos "precio_venta/precioVenta" por si luego lo habilitas en backend sin tocar el front.
      await updateProducto.mutateAsync({
        id: productId,
        precio: n(tempPrice),
        // @ts-ignore compat
        precio_venta: n(tempPrice),
        // @ts-ignore compat
        precioVenta: n(tempPrice),
      } as any);

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

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando control de inventario...</div>;
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Ocurrió un error cargando el inventario. Revisa la consola / endpoint de inventario.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-muted/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Productos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted/60">
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

        <Card className="border-muted/60">
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

        <Card className="border-muted/60">
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

        <Card className="border-muted/60">
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

      {/* Tabla */}
      <Card className="border-muted/60">
        <CardHeader>
          <CardTitle>Control de Inventario</CardTitle>
          <CardDescription>Monitorea stock y métricas de rotación por producto</CardDescription>
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
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="disponible">Disponible</SelectItem>
                <SelectItem value="negativo">Vendido sin Stock</SelectItem>
                <SelectItem value="agotado">Agotado</SelectItem>
                <SelectItem value="alto">Alto Stock</SelectItem>
                <SelectItem value="medio">Medio Stock</SelectItem>
                <SelectItem value="bajo">Bajo Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {inventoryData.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No hay productos de inventario registrados. Registra tu primera compra en la pestaña “Registro de Productos”.
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No se encontraron productos con los filtros seleccionados.
            </div>
          ) : (
            <div className="w-full overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Producto</TableHead>
                    <TableHead className="whitespace-nowrap">Stock</TableHead>
                    <TableHead className="whitespace-nowrap">Min</TableHead>
                    <TableHead>Disponibilidad</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead className="whitespace-nowrap">Costo Unit.</TableHead>
                    <TableHead className="whitespace-nowrap">Precio Config.</TableHead>
                    <TableHead className="whitespace-nowrap">Valor Total</TableHead>
                    <TableHead className="whitespace-nowrap">Total Comprado</TableHead>
                    <TableHead className="whitespace-nowrap">Total Usado/Vendido</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredProducts.map((producto: any) => {
                    const availability = getAvailabilityStatus(producto.stock_actual);
                    const stockLevel = getStockLevel(producto.stock_actual, producto.stock_minimo, producto.stock_maximo);

                    return (
                      <TableRow key={producto.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {availability === "negativo" && (
                              <div
                                className="flex-shrink-0"
                                title="¡Atención! Inventario negativo. Revisa ventas/ajustes y registra compras para compensar."
                              >
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                              </div>
                            )}

                            {producto.imagen_url ? (
                              <img src={producto.imagen_url} alt={producto.nombre} className="w-10 h-10 object-cover rounded" />
                            ) : (
                              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="font-medium truncate">{producto.nombre}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {producto.subcuenta_nombre || "Sin subcuenta"}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span
                            className={`font-semibold ${
                              availability === "agotado"
                                ? "text-red-600"
                                : stockLevel === "bajo"
                                  ? "text-orange-600"
                                  : stockLevel === "medio"
                                    ? "text-yellow-600"
                                    : "text-green-600"
                            }`}
                          >
                            {producto.stock_actual}
                          </span>
                        </TableCell>

                        <TableCell>{producto.stock_minimo}</TableCell>

                        <TableCell>{getAvailabilityBadge(availability)}</TableCell>

                        <TableCell>{getStockLevelBadge(stockLevel)}</TableCell>

                        <TableCell className="font-semibold">{formatCurrency(producto.costo_promedio)}</TableCell>

                        <TableCell>
                          {editingPrice === producto.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={tempPrice}
                                onChange={(e) => setTempPrice(Number(e.target.value))}
                                className="w-28 h-8"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSavePrice(producto.id);
                                  if (e.key === "Escape") handleCancelEdit();
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSavePrice(producto.id)}
                                disabled={updateProducto.isPending}
                                className="h-8 w-8 p-0"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={handleCancelEdit} className="h-8 w-8 p-0">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-primary">{formatCurrency(producto.precio_configurado || 0)}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditPrice(producto.id, producto.precio_configurado || 0)}
                                className="h-8 w-8 p-0"
                                title="Editar precio configurado"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>

                        <TableCell className={`font-semibold ${producto.valor_total < 0 ? "text-red-600" : ""}`}>
                          {formatCurrency(producto.valor_total)}
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ControlInventario;
