import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, TrendingUp, TrendingDown, Calendar, Package, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

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
    imagen_url?: string;
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
  const [movimientoACancelar, setMovimientoACancelar] = useState<MovimientoInventario | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Obtener movimientos de inventario
  const { data: movimientos = [], isLoading, refetch } = useQuery({
    queryKey: ["movimientos-inventario", user?.id, fechaInicio, fechaFin],
    queryFn: async () => {
      let query = supabase
        .from("movimientos_inventario")
        .select(`
          *,
          productos (
            nombre,
            imagen_url
          )
        `)
        .or(`user_id.eq.${user?.id},user_id.is.null`) // Incluir movimientos sin user_id
        .order("fecha", { ascending: false });

      if (fechaInicio) {
        query = query.gte("fecha", fechaInicio);
      }
      if (fechaFin) {
        query = query.lte("fecha", fechaFin);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Actualizar movimientos sin user_id para asignarles el user_id actual
      const movimientosSinUserId = data?.filter(m => !m.user_id) || [];
      if (movimientosSinUserId.length > 0 && user?.id) {
        const idsToUpdate = movimientosSinUserId.map(m => m.id);
        await supabase
          .from("movimientos_inventario")
          .update({ user_id: user.id })
          .in('id', idsToUpdate);
      }
      
      return data as MovimientoInventario[];
    },
    enabled: !!user?.id,
  });

  // Obtener asiento contable relacionado con un movimiento
  const { data: asientoDetalle } = useQuery({
    queryKey: ["asiento-movimiento", selectedMovimiento?.id],
    queryFn: async () => {
      if (!selectedMovimiento) return null;

      // Para movimientos de venta (salidas)
      if (selectedMovimiento.tipo_movimiento === 'venta') {
        const { data: transaccion, error: transError } = await supabase
          .from("transacciones_ingresos")
          .select("id")
          .ilike("descripcion", `%${selectedMovimiento.productos?.nombre || ""}%`)
          .gte("created_at", `${selectedMovimiento.fecha}T00:00:00`)
          .lte("created_at", `${selectedMovimiento.fecha}T23:59:59`)
          .limit(1)
          .maybeSingle();

        if (transError || !transaccion) {
          console.error("Error fetching transaccion ingreso:", transError);
          return null;
        }

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
      }

      // Para movimientos de compra (entradas)
      if (selectedMovimiento.tipo_movimiento === 'compra') {
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
          .ilike("descripcion", `%${selectedMovimiento.productos?.nombre || ""}%`)
          .eq("fecha", selectedMovimiento.fecha)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error fetching asiento compra:", error);
          return null;
        }
        return data as AsientoContable | null;
      }

      return null;
    },
    enabled: !!selectedMovimiento,
  });

  // Función de cancelación
  const handleCancelarMovimiento = async () => {
    if (!movimientoACancelar || !motivoCancelacion.trim()) {
      toast({
        title: "Error",
        description: "Debes ingresar un motivo de cancelación",
        variant: "destructive"
      });
      return;
    }

    setIsCancelling(true);

    try {
      const { data, error } = await supabase.functions.invoke('cancelar-compra-inventario', {
        body: {
          movimientoId: movimientoACancelar.id,
          motivoCancelacion
        }
      });

      if (error) throw error;

      toast({
        title: "✅ Compra cancelada",
        description: "La compra ha sido cancelada y se generó el asiento de reversión"
      });

      // Refrescar datos
      refetch();
      setIsCancelDialogOpen(false);
      setMotivoCancelacion("");
      setMovimientoACancelar(null);

    } catch (error: any) {
      console.error('Error al cancelar:', error);
      toast({
        title: "Error al cancelar",
        description: error.message || "No se pudo cancelar la compra",
        variant: "destructive"
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Obtener lista única de productos para filtro
  const productosUnicos = Array.from(
    new Set(movimientos.map((m) => m.productos?.nombre).filter(Boolean))
  );

  // Aplicar filtros
  const movimientosFiltrados = movimientos.filter((mov) => {
    // Filtro por tipo de movimiento
    if (tipoMovimiento !== "todos") {
      const esEntrada = mov.tipo_movimiento === "entrada" || mov.tipo_movimiento === "compra";
      const esSalida = mov.tipo_movimiento === "salida" || mov.tipo_movimiento === "venta";
      
      if (tipoMovimiento === "entrada" && !esEntrada) {
        return false;
      }
      if (tipoMovimiento === "salida" && !esSalida) {
        return false;
      }
    }
    
    // Filtro por producto
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
                  <SelectItem value="todos">Todos los Movimientos</SelectItem>
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
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientosFiltrados.map((movimiento) => {
                const esCancelado = movimiento.descripcion?.includes('CANCELACIÓN');
                
                return (
                <TableRow key={movimiento.id} className={esCancelado ? "opacity-60 bg-muted/50" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(movimiento.fecha), "dd/MM/yyyy")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {movimiento.productos?.imagen_url ? (
                        <img 
                          src={movimiento.productos.imagen_url} 
                          alt={movimiento.productos.nombre}
                          className="w-10 h-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium">
                        {movimiento.productos?.nombre || "Producto eliminado"}
                      </span>
                    </div>
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
                  <TableCell className="max-w-xs">
                    <div className="flex flex-col gap-1">
                      {esCancelado && (
                        <Badge variant="destructive" className="w-fit">
                          <XCircle className="h-3 w-3 mr-1" />
                          Cancelado
                        </Badge>
                      )}
                      <span className={esCancelado ? "text-xs line-through" : ""}>
                        {movimiento.descripcion || "-"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
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

                            {/* Asientos en Balanza de Comprobación */}
                            <div>
                              <h3 className="text-lg font-semibold mb-4">
                                Asientos en Balanza de Comprobación
                              </h3>
                              {!asientoDetalle ? (
                                <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center space-y-2">
                                  <p>No se encontraron asientos contables para esta transacción</p>
                                  <p className="text-xs">
                                    Las entradas (compras) y salidas (ventas) de inventario generan 
                                    asientos automáticamente que afectan tus cuentas de inventario, 
                                    efectivo/bancos y cuentas por pagar.
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {/* Información del Asiento */}
                                  <div className="p-4 bg-muted rounded-lg">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="font-medium">Número de Asiento:</span>{' '}
                                        {asientoDetalle.numero_asiento}
                                      </div>
                                      <div>
                                        <span className="font-medium">Fecha:</span>{' '}
                                        {format(new Date(asientoDetalle.fecha), 'dd/MM/yyyy')}
                                      </div>
                                      <div className="col-span-2">
                                        <span className="font-medium">Descripción:</span>{' '}
                                        {asientoDetalle.descripcion}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Tabla de Detalles */}
                                  <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="w-[200px]">Cuenta</TableHead>
                                          <TableHead>Descripción</TableHead>
                                          <TableHead className="text-right w-[150px]">Debe</TableHead>
                                          <TableHead className="text-right w-[150px]">Haber</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {asientoDetalle.detalle_asientos?.map((detalle, idx) => (
                                          <TableRow key={idx}>
                                            <TableCell>
                                              <div>
                                                <div className="font-medium text-sm">
                                                  {detalle.cuenta_codigo}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                  {detalle.cuentas?.nombre}
                                                </div>
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                              {detalle.descripcion}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                              {detalle.debe > 0
                                                ? `$${Number(detalle.debe).toLocaleString('es-MX', {
                                                    minimumFractionDigits: 2,
                                                  })}`
                                                : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                              {detalle.haber > 0
                                                ? `$${Number(detalle.haber).toLocaleString('es-MX', {
                                                    minimumFractionDigits: 2,
                                                  })}`
                                                : '-'}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                        {/* Fila de Totales */}
                                        <TableRow className="border-t-2 bg-muted/50 font-bold">
                                          <TableCell colSpan={2}>TOTALES</TableCell>
                                          <TableCell className="text-right">
                                            $
                                            {asientoDetalle.detalle_asientos
                                              ?.reduce((sum, d) => sum + Number(d.debe), 0)
                                              .toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            $
                                            {asientoDetalle.detalle_asientos
                                              ?.reduce((sum, d) => sum + Number(d.haber), 0)
                                              .toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                          </TableCell>
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>

                                  {/* Nota informativa */}
                                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
                                    <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                                      💡 Trazabilidad Contable
                                    </p>
                                    <p className="text-blue-600 dark:text-blue-400">
                                      Este asiento contable refleja cómo esta transacción de inventario
                                      afecta a las diferentes cuentas en la balanza de comprobación y
                                      posteriormente en los estados financieros.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    
                    {/* Botón de cancelar (solo para compras no canceladas) */}
                    {movimiento.tipo_movimiento === 'compra' && !esCancelado && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => {
                          setMovimientoACancelar(movimiento);
                          setIsCancelDialogOpen(true);
                        }}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                    )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
              )}
            </TableBody>
          </Table>

          {movimientosFiltrados.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No se encontraron transacciones con los filtros seleccionados</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmación de cancelación */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta compra de inventario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción creará un asiento de reversión automático y ajustará el inventario.
              No se puede deshacer esta operación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {movimientoACancelar && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-md space-y-2">
                <div className="flex items-center gap-3">
                  {movimientoACancelar.productos?.imagen_url ? (
                    <img 
                      src={movimientoACancelar.productos.imagen_url} 
                      alt={movimientoACancelar.productos.nombre}
                      className="w-12 h-12 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-background flex items-center justify-center">
                      <Package className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{movimientoACancelar.productos?.nombre}</p>
                    <p className="text-sm text-muted-foreground">{movimientoACancelar.descripcion}</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Cantidad:</span>
                    <span className="ml-2 font-medium">{movimientoACancelar.cantidad}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Costo Total:</span>
                    <span className="ml-2 font-medium">
                      ${movimientoACancelar.costo_total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="motivo">Motivo de cancelación *</Label>
                <Textarea
                  id="motivo"
                  value={motivoCancelacion}
                  onChange={(e) => setMotivoCancelacion(e.target.value)}
                  placeholder="Describe por qué se cancela esta compra..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelarMovimiento}
              disabled={isCancelling || !motivoCancelacion.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isCancelling ? "Cancelando..." : "Confirmar Cancelación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ResumenTransaccionesInventario;
