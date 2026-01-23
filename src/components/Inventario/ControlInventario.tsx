// bukipin-dashboard/src/components/Inventario/ControlInventario.tsx
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, TrendingUp, TrendingDown, AlertTriangle, Edit, Check, X } from "lucide-react";
import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";
import { formatCurrency } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

type InventoryStatus = "disponible" | "agotado" | "negativo";
type StockLevel = "alto" | "medio" | "bajo";
type StatusFilter = InventoryStatus | StockLevel | "todos";

const n = (v: any) => {
  const num = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(num) ? num : 0;
};

const pickPrecioVenta = (p: any) =>
  n(p?.precio_venta ?? p?.precioVenta ?? p?.precio_venta_sugerido ?? p?.precioVentaSugerido ?? 0);

const pickCostoCompraFallback = (p: any) =>
  n(
    p?.costo_unitario ?? // (a veces calculado por hook)
      p?.costo_compra ??
      p?.costoCompra ??
      p?.precio ?? // compat legacy (precio como costo)
      0
  );

/**
 * Intenta detectar un array de movimientos en distintas llaves.
 * (Bukipin ha tenido varias versiones / nombres)
 */
function pickMovements(producto: any): any[] {
  const candidates = [
    producto?.movimientos,
    producto?.movimientosInventario,
    producto?.movimientos_inventario,
    producto?.inventoryMovements,
    producto?.inventory_movements,
    producto?.historial,
    producto?.historialMovimientos,
    producto?.transaccionesInventario,
    producto?.transacciones_inventario,
    producto?.kardex,
    producto?.movs,
    producto?.movsInventario,
    producto?.movimientosData,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c;
  }

  // a veces viene anidado
  const nestedCandidates = [
    producto?.data?.movimientos,
    producto?.data?.movimientosInventario,
    producto?.data?.movimientos_inventario,
  ];
  for (const c of nestedCandidates) {
    if (Array.isArray(c) && c.length) return c;
  }

  return [];
}

function normalizeMovement(mv: any) {
  const rawType = String(
    mv?.tipo ??
      mv?.type ??
      mv?.tipoMovimiento ??
      mv?.tipo_movimiento ??
      mv?.movementType ??
      mv?.movement_type ??
      ""
  ).toLowerCase();

  let qty = n(
    mv?.cantidad ??
      mv?.qty ??
      mv?.quantity ??
      mv?.cantidadMovida ??
      mv?.cantidad_movida ??
      mv?.cantidadVendida ??
      mv?.cantidad_vendida ??
      mv?.unidades ??
      mv?.units ??
      0
  );

  // si qty viene negativo, lo tratamos como salida (abs)
  const wasNegative = qty < 0;
  if (qty < 0) qty = Math.abs(qty);

  const unitCost = n(
    mv?.costoUnitario ??
      mv?.costo_unitario ??
      mv?.costo ??
      mv?.cost ??
      mv?.unitCost ??
      mv?.unit_cost ??
      0
  );

  const totalCost = n(
    mv?.costoTotal ??
      mv?.costo_total ??
      mv?.totalCost ??
      mv?.total_cost ??
      (unitCost > 0 && qty > 0 ? unitCost * qty : 0)
  );

  const isEntrada =
    rawType.includes("entrada") ||
    rawType.includes("compra") ||
    rawType.includes("in") ||
    rawType.includes("purchase") ||
    mv?.esEntrada === true ||
    mv?.isEntrada === true;

  const isSalida =
    rawType.includes("salida") ||
    rawType.includes("venta") ||
    rawType.includes("out") ||
    rawType.includes("sale") ||
    mv?.esSalida === true ||
    mv?.isSalida === true ||
    wasNegative;

  // Si no se detecta por type, inferimos por campos comunes
  // (ej: source="ingreso" suele ser salida)
  const source = String(mv?.source ?? mv?.origen ?? "").toLowerCase();
  const inferredSalida =
    !isEntrada && !isSalida && (source.includes("ingreso") || source.includes("venta"));

  const kind: "entrada" | "salida" | "unknown" = isEntrada
    ? "entrada"
    : isSalida || inferredSalida
      ? "salida"
      : "unknown";

  return { kind, qty, unitCost, totalCost, rawType };
}

function computeFromMovements(movs: any[]) {
  let entradasQty = 0;
  let salidasQty = 0;

  // para costo promedio ponderado (solo entradas)
  let entradasCostSum = 0;
  let entradasQtyForAvg = 0;

  for (const mv of movs) {
    const m = normalizeMovement(mv);
    if (!m.qty) continue;

    if (m.kind === "entrada") {
      entradasQty += m.qty;

      const costToUse = m.totalCost > 0 ? m.totalCost : m.unitCost > 0 ? m.unitCost * m.qty : 0;
      if (costToUse > 0) {
        entradasCostSum += costToUse;
        entradasQtyForAvg += m.qty;
      }
      continue;
    }

    if (m.kind === "salida") {
      salidasQty += m.qty;
      continue;
    }
  }

  const costoPromedioMovs =
    entradasQtyForAvg > 0 && entradasCostSum > 0 ? entradasCostSum / entradasQtyForAvg : 0;

  const stock = entradasQty - salidasQty;

  return {
    entradasQty,
    salidasQty,
    stock,
    costoPromedioMovs,
  };
}

const ControlInventario = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);

  const { data: productosInventario, isLoading, isError } = useInventarioConMovimientos();

  // Guardar precio venta (NO costo) directo al backend (E2E)
  const [savingId, setSavingId] = useState<string | null>(null);

  async function savePrecioVenta(productId: string, precioVenta: number) {
    setSavingId(productId);
    try {
      await apiFetch(`/api/productos/${encodeURIComponent(productId)}`, {
        method: "PUT",
        body: JSON.stringify({
          // ✅ canonical + compat
          precioVenta: n(precioVenta),
          precio_venta: n(precioVenta),
        }),
      });
    } finally {
      setSavingId(null);
    }
  }

  /**
   * ✅ FIX REAL:
   * Calculamos métricas POR MOVIMIENTOS cuando existan,
   * porque el backend todavía puede no actualizar producto.stock.
   */
  const inventoryData = useMemo(() => {
    const list = productosInventario || [];

    return list.map((producto: any) => {
      const id = String(producto?.id ?? producto?._id ?? producto?.productId ?? producto?.productoId ?? "");
      const nombre = String(producto?.nombre ?? producto?.name ?? "");

      // fallback legacy directo del producto
      const stockLegacy = n(
        producto?.cantidad_stock ??
          producto?.stock ??
          producto?.stock_actual ??
          producto?.stockActual ??
          producto?.existencia ??
          0
      );
      const compradoLegacy = n(producto?.cantidad_comprada ?? producto?.cantidadComprada ?? 0);
      const vendidoLegacy = n(producto?.cantidad_vendida ?? producto?.cantidadVendida ?? 0);

      const movs = pickMovements(producto);
      const hasMovs = Array.isArray(movs) && movs.length > 0;

      const calc = hasMovs ? computeFromMovements(movs) : null;

      // ✅ costo promedio: movimientos > hook/producto > fallback
      const costoUnitarioHook = n(producto?.costo_unitario);
      const costoFallback = pickCostoCompraFallback(producto);

      const costoPromedio =
        (calc?.costoPromedioMovs ?? 0) > 0
          ? (calc?.costoPromedioMovs ?? 0)
          : costoUnitarioHook > 0
            ? costoUnitarioHook
            : costoFallback;

      // ✅ stock: movimientos > legacy
      const stockActual = calc ? calc.stock : stockLegacy;

      // ✅ totales: movimientos > legacy
      const totalComprado = calc ? calc.entradasQty : (compradoLegacy > 0 ? compradoLegacy : Math.max(stockLegacy, 0));
      const totalVendido = calc ? calc.salidasQty : vendidoLegacy;

      // ✅ valor total: si hay movs, lo calculamos; si no, respetamos backend/hook
      const valorTotalBackend = n(producto?.valor_total_inventario ?? producto?.valorTotalInventario ?? 0);
      const valorTotal = calc ? stockActual * costoPromedio : (valorTotalBackend > 0 ? valorTotalBackend : stockActual * costoPromedio);

      // ✅ Precio configurado (VENTA), no costo
      const precioConfigurado = pickPrecioVenta(producto);

      // min/max (si ya existieran en el producto, respetarlos)
      const stockMin = n(producto?.stock_minimo ?? producto?.stockMinimo ?? producto?.min ?? 10) || 10;
      const stockMax = n(producto?.stock_maximo ?? producto?.stockMaximo ?? producto?.max ?? 100) || 100;

      return {
        ...producto,
        id,
        nombre,

        // métricas normalizadas
        stock_actual: stockActual,
        stock_minimo: stockMin,
        stock_maximo: stockMax,

        costo_promedio: costoPromedio,
        valor_total: valorTotal,

        // UI totals
        entradas_mes: totalComprado,
        salidas_mes: totalVendido,

        // UI fields robustos
        precio_configurado: precioConfigurado,
        imagen_url: producto.imagen_url ?? producto.imagenUrl ?? null,
        subcuenta_nombre: producto.subcuenta_nombre ?? producto.subcuentaNombre ?? null,
        descripcion: producto.descripcion ?? null,

        // debug util (por si quieres inspeccionar)
        __hasMovs: hasMovs,
        __movsCount: hasMovs ? movs.length : 0,
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
      await savePrecioVenta(productId, n(tempPrice));
      setEditingPrice(null);
      setTempPrice(0);
    } catch (error) {
      console.error("Error updating precioVenta:", error);
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
                    <TableHead className="whitespace-nowrap">Precio Venta</TableHead>
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
                            title={producto.__hasMovs ? `Calculado por movimientos (${producto.__movsCount})` : "Valor legacy del producto"}
                          >
                            {producto.stock_actual}
                          </span>
                        </TableCell>

                        <TableCell>{producto.stock_minimo}</TableCell>

                        <TableCell>{getAvailabilityBadge(availability)}</TableCell>

                        <TableCell>{getStockLevelBadge(stockLevel)}</TableCell>

                        <TableCell className="font-semibold" title="Costo unitario promedio (compras)">
                          {formatCurrency(producto.costo_promedio)}
                        </TableCell>

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
                                disabled={savingId === producto.id}
                                className="h-8 w-8 p-0"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                className="h-8 w-8 p-0"
                                disabled={savingId === producto.id}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-primary">
                                {formatCurrency(producto.precio_configurado || 0)}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditPrice(producto.id, producto.precio_configurado || 0)}
                                className="h-8 w-8 p-0"
                                title="Editar precio de venta"
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
