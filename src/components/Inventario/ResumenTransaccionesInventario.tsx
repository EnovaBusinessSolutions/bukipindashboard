import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface MovimientoInventario {
  id: string;
  producto_id: string;
  tipo_movimiento: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
  fecha: string;
  descripcion?: string;
  productos?: {
    nombre: string;
  };
}

interface AsientoContable {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string;
  detalle_asientos: {
    id: string;
    cuenta_codigo: string;
    debe: number;
    haber: number;
    descripcion: string;
    cuentas?: {
      nombre: string;
    };
  }[];
}

const ResumenTransaccionesInventario = () => {
  const { user } = useAuth();
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [tipoMovimiento, setTipoMovimiento] = useState<string>("todos");
  const [productoFiltro, setProductoFiltro] = useState<string>("todos");
  const [selectedMovimiento, setSelectedMovimiento] = useState<MovimientoInventario | null>(null);

  // Obtener movimientos de inventario
  const { data: movimientos = [], isLoading } = useQuery({
    queryKey: ["movimientos-inventario", user?.id, fechaInicio, fechaFin],
    queryFn: async () => {
      let query = supabase
        .from("movimientos_inventario")
        .select(`
          *,
          productos (
            nombre
          )
        `)
        .eq("user_id", user?.id)
        .order("fecha", { ascending: false });

      if (fechaInicio) {
        query = query.gte("fecha", fechaInicio);
      }
      if (fechaFin) {
        query = query.lte("fecha", fechaFin);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MovimientoInventario[];
    },
    enabled: !!user?.id,
  });

  // Obtener asiento contable relacionado con un movimiento
  const { data: asientoDetalle } = useQuery({
    queryKey: ["asiento-movimiento", selectedMovimiento?.id],
    queryFn: async () => {
      if (!selectedMovimiento || selectedMovimiento.tipo_movimiento !== 'venta') return null;

      // Para movimientos de venta, buscar la transacción de ingreso relacionada
      const { data: transaccion, error: transError } = await supabase
        .from("transacciones_ingresos")
        .select("id")
        .ilike("descripcion", `%${selectedMovimiento.productos?.nombre || ""}%`)
        .gte("created_at", `${selectedMovimiento.fecha}T00:00:00`)
        .lte("created_at", `${selectedMovimiento.fecha}T23:59:59`)
        .limit(1)
        .maybeSingle();

      if (transError || !transaccion) {
        console.error("Error fetching transaccion:", transError);
        return null;
      }

      // Buscar el asiento contable asociado a esta transacción
      const { data, error } = await supabase
        .from("asientos_contables")
        .select(`
          id,
          numero_asiento,
          descripcion,
          fecha,
          detalle_asientos (
            id,
            cuenta_codigo,
            debe,
            haber,
            descripcion,
            cuentas (
              nombre
            )
          )
        `)
        .eq("transaccion_ingreso_id", transaccion.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching asiento:", error);
        return null;
      }
      return data as AsientoContable | null;
    },
    enabled: !!selectedMovimiento,
  });

  // Obtener lista única de productos para filtro
  const productosUnicos = Array.from(
    new Set(movimientos.map((m) => m.productos?.nombre).filter(Boolean))
  );

  // Aplicar filtros
  const movimientosFiltrados = movimientos.filter((mov) => {
    if (tipoMovimiento !== "todos") {
      // Aceptar tanto "entrada" como "compra" para el filtro de entrada
      if (tipoMovimiento === "entrada" && 
          mov.tipo_movimiento !== "entrada" && 
          mov.tipo_movimiento !== "compra") {
        return false;
      }
      // Aceptar "salida" o "venta" para el filtro de salida
      if (tipoMovimiento === "salida" && 
          mov.tipo_movimiento !== "salida" && 
          mov.tipo_movimiento !== "venta") {
        return false;
      }
    }
    if (productoFiltro !== "todos" && mov.productos?.nombre !== productoFiltro) {
      return false;
    }
    return true;
  });

  // Calcular subtotales
  const totalEntradas = movimientosFiltrados
    .filter((m) => m.tipo_movimiento === "entrada" || m.tipo_movimiento === "compra")
    .reduce((sum, m) => sum + Math.abs(m.costo_total), 0);

  const totalSalidas = movimientosFiltrados
    .filter((m) => m.tipo_movimiento === "salida" || m.tipo_movimiento === "venta")
    .reduce((sum, m) => sum + Math.abs(m.costo_total), 0);

  const cantidadEntradas = movimientosFiltrados.filter(
    (m) => m.tipo_movimiento === "entrada" || m.tipo_movimiento === "compra"
  ).length;

  const cantidadSalidas = movimientosFiltrados.filter(
    (m) => m.tipo_movimiento === "salida" || m.tipo_movimiento === "venta"
  ).length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Búsqueda</CardTitle>
          <CardDescription>
            Filtra las transacciones de inventario por fecha, tipo y producto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Inicio</label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Fin</label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo Movimiento</label>
              <Select value={tipoMovimiento} onValueChange={setTipoMovimiento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="salida">Salidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Producto</label>
              <Select value={productoFiltro} onValueChange={setProductoFiltro}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {productosUnicos.map((producto) => (
                    <SelectItem key={producto} value={producto || ""}>
                      {producto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subtotales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Total Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalEntradas.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {cantidadEntradas} transacciones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Total Salidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalSalidas.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {cantidadSalidas} transacciones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Diferencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalEntradas - totalSalidas).toLocaleString("es-MX", {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Entradas - Salidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Transacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movimientosFiltrados.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Movimientos registrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de transacciones */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones de Inventario</CardTitle>
          <CardDescription>
            Historial completo de entradas y salidas de inventario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo Unitario</TableHead>
                <TableHead className="text-right">Costo Total</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientosFiltrados.map((movimiento) => (
                <TableRow key={movimiento.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(movimiento.fecha), "dd/MM/yyyy")}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {movimiento.productos?.nombre || "Producto eliminado"}
                  </TableCell>
                                  <TableCell>
                    <Badge
                      variant={
                        movimiento.tipo_movimiento === "entrada" || movimiento.tipo_movimiento === "compra"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {movimiento.tipo_movimiento === "entrada" || movimiento.tipo_movimiento === "compra" ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {movimiento.tipo_movimiento === "entrada" || movimiento.tipo_movimiento === "compra" 
                        ? "Entrada" 
                        : movimiento.tipo_movimiento === "venta"
                        ? "Venta"
                        : "Salida"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {movimiento.cantidad.toLocaleString("es-MX")}
                  </TableCell>
                  <TableCell className="text-right">
                    ${movimiento.costo_unitario.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${movimiento.costo_total.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {movimiento.descripcion || "-"}
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMovimiento(movimiento)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Detalle de Transacción</DialogTitle>
                        </DialogHeader>
                        {selectedMovimiento && (
                          <div className="space-y-6">
                            {/* Información de la transacción */}
                            <div>
                              <h3 className="text-lg font-semibold mb-3">
                                Información del Movimiento
                              </h3>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Producto</p>
                                  <p className="font-medium">
                                    {selectedMovimiento.productos?.nombre}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Tipo</p>
                                  <Badge
                                    variant={
                                      selectedMovimiento.tipo_movimiento === "entrada" || 
                                      selectedMovimiento.tipo_movimiento === "compra"
                                        ? "default"
                                        : "destructive"
                                    }
                                  >
                                    {selectedMovimiento.tipo_movimiento === "entrada" || 
                                     selectedMovimiento.tipo_movimiento === "compra"
                                      ? "Entrada"
                                      : selectedMovimiento.tipo_movimiento === "venta"
                                      ? "Venta"
                                      : "Salida"}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Fecha</p>
                                  <p className="font-medium">
                                    {format(
                                      new Date(selectedMovimiento.fecha),
                                      "dd/MM/yyyy"
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Cantidad</p>
                                  <p className="font-medium">
                                    {selectedMovimiento.cantidad.toLocaleString("es-MX")}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">
                                    Costo Unitario
                                  </p>
                                  <p className="font-medium">
                                    $
                                    {selectedMovimiento.costo_unitario.toLocaleString(
                                      "es-MX",
                                      { minimumFractionDigits: 2 }
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Costo Total</p>
                                  <p className="font-medium text-lg">
                                    $
                                    {selectedMovimiento.costo_total.toLocaleString("es-MX", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </p>
                                </div>
                              </div>
                              {selectedMovimiento.descripcion && (
                                <div className="mt-4">
                                  <p className="text-sm text-muted-foreground">Descripción</p>
                                  <p>{selectedMovimiento.descripcion}</p>
                                </div>
                              )}
                            </div>

                            <Separator />

                            {/* Asientos contables */}
                            <div>
                              <h3 className="text-lg font-semibold mb-3">
                                Asientos Contables Afectados
                              </h3>
                              {asientoDetalle ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Número:</span>{" "}
                                      <span className="font-medium">
                                        {asientoDetalle.numero_asiento}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Fecha:</span>{" "}
                                      <span className="font-medium">
                                        {format(
                                          new Date(asientoDetalle.fecha),
                                          "dd/MM/yyyy"
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Descripción:</span>{" "}
                                    <span>{asientoDetalle.descripcion}</span>
                                  </div>

                                  <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Cuenta</TableHead>
                                          <TableHead className="text-right">Debe</TableHead>
                                          <TableHead className="text-right">Haber</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {asientoDetalle.detalle_asientos.map((detalle) => (
                                          <TableRow key={detalle.id}>
                                            <TableCell>
                                              <div>
                                                <div className="font-medium text-sm">
                                                  {detalle.cuenta_codigo} -{" "}
                                                  {detalle.cuentas?.nombre || "Sin nombre"}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                  {detalle.descripcion}
                                                </div>
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                              {detalle.debe > 0 ? (
                                                <span className="text-green-600">
                                                  $
                                                  {Number(detalle.debe).toLocaleString("es-MX", {
                                                    minimumFractionDigits: 2,
                                                  })}
                                                </span>
                                              ) : (
                                                "-"
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                              {detalle.haber > 0 ? (
                                                <span className="text-red-600">
                                                  $
                                                  {Number(detalle.haber).toLocaleString("es-MX", {
                                                    minimumFractionDigits: 2,
                                                  })}
                                                </span>
                                              ) : (
                                                "-"
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>

                                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                                    <p className="text-muted-foreground">
                                      Estos asientos se reflejan en la Balanza de Comprobación y
                                      afectan las cuentas contables correspondientes.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                  <p>
                                    No se encontraron asientos contables relacionados con esta
                                    transacción.
                                  </p>
                                  <p className="text-sm mt-2">
                                    Las transacciones de venta generan asientos automáticamente.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {movimientosFiltrados.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No se encontraron transacciones con los filtros seleccionados</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumenTransaccionesInventario;
