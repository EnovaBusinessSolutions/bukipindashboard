// bukipin-dashboard/src/components/Inventario/ResumenTransaccionesInventario.tsx
import React, { useMemo, useState } from "react";
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
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface MovimientoInventario {
  id: string;
  producto_id: string;
  tipo_movimiento: string; // compra|venta|entrada|salida|ajuste
  cantidad: number | string;
  costo_unitario: number | string | null;
  costo_total: number | string | null;
  fecha: string; // YYYY-MM-DD o ISO
  descripcion?: string;
  estado?: string | null;
  motivo_cancelacion?: string | null;
  fecha_cancelacion?: string | null;
  movimiento_reversion_id?: string | null;
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
    cuentas?: { nombre: string };
  }[];
}

/** ✅ Normaliza cualquier shape para devolver un array (E2E) */
function asArray<T = any>(json: any): T[] {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.items)) return json.data.items;
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.items)) return json.items;
  return [];
}

function unwrap<T = any>(json: any): T {
  return (json?.data ?? json) as T;
}

/** ✅ Número robusto: soporta "1,200", "$30.00", "", null */
function n(v: any, def = 0) {
  if (v === null || v === undefined) return def;
  const s = String(v).trim();
  if (!s) return def;
  const cleaned = s.replace(/[$,\s]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : def;
}

const safeDate = (s: any): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
};

const isEntrada = (t: string) => t === "entrada" || t === "compra" || t === "ajuste_entrada";
const isSalida = (t: string) => t === "salida" || t === "venta" || t === "ajuste_salida";
const getMovLabel = (t: string) => (isEntrada(t) ? "Entrada" : isSalida(t) ? "Salida" : "Ajuste");

/** Normalizadores de fields (por si el backend cambia shape) */
const getMovId = (m: any) => String(m?.id ?? m?._id ?? m?.movimientoId ?? "");
const getMovProductoId = (m: any) =>
  String(
    m?.producto_id ??
      m?.productoId ??
      m?.productId ??
      m?.producto ??
      m?.product ??
      m?.producto?._id ??
      m?.product?._id ??
      ""
  );

const getMovTipo = (m: any) =>
  String(m?.tipo_movimiento ?? m?.tipoMovimiento ?? m?.tipo ?? m?.type ?? "")
    .toLowerCase()
    .trim();

const getMovFecha = (m: any) =>
  String(m?.fecha ?? m?.date ?? m?.createdAt ?? m?.created_at ?? m?.updatedAt ?? m?.updated_at ?? "").trim();

const getMovCostoUnit = (m: any) =>
  n(
    m?.costo_unitario ??
      m?.costoUnitario ??
      m?.unitCost ??
      m?.costoUnit ??
      m?.costoCompra ??
      m?.costo_compra ??
      m?.precio_unitario ??
      m?.precioUnitario ??
      m?.unitPrice ??
      m?.precio ??
      m?.price
  );

const getMovCostoTotal = (m: any) =>
  n(
    m?.costo_total ??
      m?.costoTotal ??
      m?.total ??
      m?.monto_total ??
      m?.montoTotal ??
      m?.importe_total ??
      m?.importeTotal ??
      m?.amount ??
      m?.monto ??
      m?.importe
  );

const getMovCantidad = (m: any) => n(m?.cantidad ?? m?.qty ?? m?.quantity ?? m?.unidades ?? m?.units);

/** ✅ Derivación E2E: si falta unit o total, lo calculamos */
function getEffectiveUnitCost(m: any) {
  const unit = getMovCostoUnit(m);
  if (unit > 0) return unit;

  const total = getMovCostoTotal(m);
  const qty = getMovCantidad(m);
  if (total > 0 && qty > 0) return total / qty;

  return 0;
}

function getEffectiveTotalCost(m: any) {
  const total = getMovCostoTotal(m);
  if (total > 0) return total;

  const unit = getEffectiveUnitCost(m);
  const qty = getMovCantidad(m);
  if (unit > 0 && qty > 0) return unit * qty;

  return 0;
}

async function getMovimientos(params: { start?: string; end?: string }) {
  const qs = new URLSearchParams();
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);

  const json = await apiFetch(`/api/inventario/movimientos?${qs.toString()}`);
  return asArray<MovimientoInventario>(json);
}

/** ✅ Blindaje: si /asiento da 404 o no existe, regresamos null sin romper UI */
async function getAsientoByMovimientoId(movimientoId: string) {
  try {
    const json = await apiFetch(`/api/inventario/movimientos/${movimientoId}/asiento`);
    return unwrap<AsientoContable | null>(json) ?? null;
  } catch (e) {
    return null;
  }
}

async function cancelarCompraInventario(payload: { movimientoId: string; motivoCancelacion: string }) {
  const json = await apiFetch(`/api/inventario/movimientos/${payload.movimientoId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ motivoCancelacion: payload.motivoCancelacion }),
  });
  return unwrap<{ ok: boolean; message?: string }>(json);
}

const ResumenTransaccionesInventario = () => {
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [tipoMovimiento, setTipoMovimiento] = useState<string>("todos"); // todos|entrada|salida
  const [productoFiltro, setProductoFiltro] = useState<string>("todos");

  const [selectedMovimientoId, setSelectedMovimientoId] = useState<string | null>(null);

  const [movimientoACancelar, setMovimientoACancelar] = useState<MovimientoInventario | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const {
    data: movimientosRaw = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["inventario-movimientos", fechaInicio, fechaFin],
    queryFn: () => getMovimientos({ start: fechaInicio || undefined, end: fechaFin || undefined }),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // ✅ Normalización + derivación de costos E2E
  const movimientos = useMemo(() => {
    const raw = Array.isArray(movimientosRaw) ? movimientosRaw : asArray<any>(movimientosRaw);

    return (raw || []).map((m: any) => {
      const id = getMovId(m);
      const tipo = getMovTipo(m);
      const fecha = getMovFecha(m);

      const cantidad = getMovCantidad(m);
      const costoUnit = getEffectiveUnitCost(m);
      const costoTotal = getEffectiveTotalCost(m);

      const cancelado =
        String(m.estado || "").toLowerCase() === "cancelado" ||
        !!m.motivo_cancelacion ||
        !!m.fecha_cancelacion ||
        !!m.movimiento_reversion_id ||
        String(m.descripcion || "").toUpperCase().includes("CANCELACIÓN");

      const productos =
        m.productos ??
        m.producto ??
        m.product ??
        (m?.producto_id && typeof m.producto_id === "object" ? m.producto_id : null) ??
        (m?.productId && typeof m.productId === "object" ? m.productId : null) ??
        { nombre: "Producto eliminado" };

      return {
        ...m,
        id,
        producto_id: getMovProductoId(m),
        tipo_movimiento: tipo,
        fecha,
        cantidad,
        costo_unitario: costoUnit,
        costo_total: costoTotal,
        estado: m.estado ?? null,
        descripcion: m.descripcion ?? "",
        productos: {
          nombre: String(productos?.nombre ?? "Producto eliminado"),
          imagen_url: productos?.imagen_url ?? productos?.imagenUrl ?? productos?.image ?? undefined,
        },
        __cancelado: cancelado,
      } as any;
    });
  }, [movimientosRaw]);

  const selectedMovimiento = useMemo(() => {
    if (!selectedMovimientoId) return null;
    return (movimientos as any[]).find((m) => String(m.id) === String(selectedMovimientoId)) || null;
  }, [movimientos, selectedMovimientoId]);

  const { data: asientoDetalle, isLoading: loadingAsiento } = useQuery({
    queryKey: ["inventario-asiento-movimiento", selectedMovimientoId],
    queryFn: async () => {
      if (!selectedMovimientoId) return null;
      return await getAsientoByMovimientoId(selectedMovimientoId);
    },
    enabled: !!selectedMovimientoId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 0, // ✅ no reintentar si 404 / no existe
  });

  const handleCancelarMovimiento = async () => {
    if (!movimientoACancelar || !motivoCancelacion.trim()) {
      toast({
        title: "Error",
        description: "Debes ingresar un motivo de cancelación",
        variant: "destructive",
      });
      return;
    }

    setIsCancelling(true);

    try {
      await cancelarCompraInventario({
        movimientoId: movimientoACancelar.id,
        motivoCancelacion: motivoCancelacion.trim(),
      });

      setIsCancelDialogOpen(false);
      setMotivoCancelacion("");
      setMovimientoACancelar(null);

      await refetch();

      toast({
        title: "✅ Compra cancelada",
        description: "La compra ha sido cancelada y se generó el asiento de reversión",
      });
    } catch (error: any) {
      console.error("Error al cancelar:", error);
      toast({
        title: "Error al cancelar",
        description: error?.message || "No se pudo cancelar la compra",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const productosUnicos = useMemo(() => {
    const set = new Set<string>();
    for (const m of movimientos as any[]) {
      const name = String(m?.productos?.nombre || "").trim();
      if (name) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [movimientos]);

  const movimientosFiltrados = useMemo(() => {
    return (movimientos as any[]).filter((mov) => {
      if (tipoMovimiento !== "todos") {
        const t = String(mov.tipo_movimiento || "");
        const entrada = isEntrada(t);
        const salida = isSalida(t);

        if (tipoMovimiento === "entrada" && !entrada) return false;
        if (tipoMovimiento === "salida" && !salida) return false;
      }

      if (productoFiltro !== "todos") {
        const name = mov?.productos?.nombre || "";
        if (name !== productoFiltro) return false;
      }

      return true;
    });
  }, [movimientos, tipoMovimiento, productoFiltro]);

  const totalEntradas = useMemo(() => {
    return movimientosFiltrados
      .filter((m: any) => isEntrada(m.tipo_movimiento))
      .reduce((sum: number, m: any) => sum + Math.abs(n(m.costo_total)), 0);
  }, [movimientosFiltrados]);

  const totalSalidas = useMemo(() => {
    return movimientosFiltrados
      .filter((m: any) => isSalida(m.tipo_movimiento))
      .reduce((sum: number, m: any) => sum + Math.abs(n(m.costo_total)), 0);
  }, [movimientosFiltrados]);

  const cantidadEntradas = useMemo(() => {
    return movimientosFiltrados.filter((m: any) => isEntrada(m.tipo_movimiento)).length;
  }, [movimientosFiltrados]);

  const cantidadSalidas = useMemo(() => {
    return movimientosFiltrados.filter((m: any) => isSalida(m.tipo_movimiento)).length;
  }, [movimientosFiltrados]);

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
      <Card className="border-muted/60">
        <CardHeader>
          <CardTitle>Filtros de Búsqueda</CardTitle>
          <CardDescription>Filtra las transacciones de inventario por fecha, tipo y producto</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Inicio</label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Fin</label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
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
                    <SelectItem key={producto} value={producto}>
                      {producto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(fechaInicio || fechaFin) && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Tip: si no ves movimientos, borra fechas y vuelve a intentar.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFechaInicio("");
                  setFechaFin("");
                }}
              >
                Limpiar fechas
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subtotales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-muted/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Total Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalEntradas)}</div>
            <p className="text-xs text-muted-foreground mt-1">{cantidadEntradas} transacciones</p>
          </CardContent>
        </Card>

        <Card className="border-muted/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Total Salidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalSalidas)}</div>
            <p className="text-xs text-muted-foreground mt-1">{cantidadSalidas} transacciones</p>
          </CardContent>
        </Card>

        <Card className="border-muted/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Diferencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalEntradas - totalSalidas)}</div>
            <p className="text-xs text-muted-foreground mt-1">Entradas - Salidas</p>
          </CardContent>
        </Card>

        <Card className="border-muted/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Transacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movimientosFiltrados.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Movimientos registrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card className="border-muted/60">
        <CardHeader>
          <CardTitle>Transacciones de Inventario</CardTitle>
          <CardDescription>Historial completo de entradas y salidas de inventario</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="whitespace-nowrap">Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Cantidad</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Costo Unitario</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Costo Total</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {movimientosFiltrados.map((movimiento: any) => {
                  const cancelado = !!movimiento.__cancelado;
                  const t = String(movimiento.tipo_movimiento || "");
                  const fecha = safeDate(movimiento.fecha);

                  const puedeCancelar =
                    t === "compra" &&
                    !cancelado &&
                    !String(movimiento.descripcion || "").toUpperCase().includes("CANCELACIÓN");

                  return (
                    <TableRow key={movimiento.id} className={cancelado ? "opacity-70 bg-muted/40" : ""}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {fecha ? format(fecha, "dd/MM/yyyy") : "-"}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[220px]">
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
                          <div className="min-w-0">
                            <div className="font-medium truncate">{movimiento.productos?.nombre || "Producto eliminado"}</div>
                            {cancelado && <div className="text-xs text-muted-foreground">Movimiento cancelado</div>}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={isEntrada(t) ? "default" : "destructive"} className="w-fit">
                            {isEntrada(t) ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {getMovLabel(t)}
                          </Badge>

                          {String(movimiento.estado || "").toLowerCase() === "cancelado" && (
                            <Badge variant="destructive" className="text-xs w-fit">
                              Cancelado
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">{n(movimiento.cantidad).toLocaleString("es-MX")}</TableCell>
                      <TableCell className="text-right">{formatCurrency(n(movimiento.costo_unitario))}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(n(movimiento.costo_total))}</TableCell>

                      <TableCell className="max-w-xs">
                        <div className="flex flex-col gap-1">
                          {cancelado && (
                            <Badge variant="destructive" className="w-fit">
                              <XCircle className="h-3 w-3 mr-1" />
                              Cancelado
                            </Badge>
                          )}
                          <span className={cancelado ? "text-xs line-through text-muted-foreground" : "text-sm"}>
                            {movimiento.descripcion || "-"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Dialog
                            onOpenChange={(open) => {
                              if (!open) setSelectedMovimientoId(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedMovimientoId(movimiento.id)}
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>

                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Detalle de Transacción</DialogTitle>
                              </DialogHeader>

                              {!selectedMovimiento ? (
                                <div className="py-8 text-center text-muted-foreground">Cargando detalle...</div>
                              ) : (
                                <div className="space-y-6">
                                  {selectedMovimiento.__cancelado && (
                                    <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                                      <div className="flex items-start gap-2">
                                        <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                                        <div className="flex-1">
                                          <p className="font-medium text-red-700 dark:text-red-300 text-sm">Movimiento Cancelado</p>
                                          {!!selectedMovimiento.motivo_cancelacion && (
                                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                              {selectedMovimiento.motivo_cancelacion}
                                            </p>
                                          )}
                                          {!!selectedMovimiento.fecha_cancelacion && (
                                            <p className="text-xs text-red-500 mt-1">
                                              Cancelado el:{" "}
                                              {(() => {
                                                const d = safeDate(selectedMovimiento.fecha_cancelacion);
                                                return d ? format(d, "dd/MM/yyyy HH:mm") : "-";
                                              })()}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    <h3 className="text-lg font-semibold mb-3">Información del Movimiento</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-sm text-muted-foreground">Producto</p>
                                        <p className="font-medium">{selectedMovimiento.productos?.nombre}</p>
                                      </div>

                                      <div>
                                        <p className="text-sm text-muted-foreground">Tipo</p>
                                        <Badge variant={isEntrada(selectedMovimiento.tipo_movimiento) ? "default" : "destructive"}>
                                          {getMovLabel(selectedMovimiento.tipo_movimiento)}
                                        </Badge>
                                      </div>

                                      <div>
                                        <p className="text-sm text-muted-foreground">Fecha</p>
                                        <p className="font-medium">
                                          {(() => {
                                            const d = safeDate(selectedMovimiento.fecha);
                                            return d ? format(d, "dd/MM/yyyy") : "-";
                                          })()}
                                        </p>
                                      </div>

                                      <div>
                                        <p className="text-sm text-muted-foreground">Cantidad</p>
                                        <p className="font-medium">{n(selectedMovimiento.cantidad).toLocaleString("es-MX")}</p>
                                      </div>

                                      <div>
                                        <p className="text-sm text-muted-foreground">Costo Unitario</p>
                                        <p className="font-medium">{formatCurrency(n(selectedMovimiento.costo_unitario))}</p>
                                      </div>

                                      <div>
                                        <p className="text-sm text-muted-foreground">Costo Total</p>
                                        <p className="font-medium text-lg">{formatCurrency(n(selectedMovimiento.costo_total))}</p>
                                      </div>
                                    </div>

                                    {!!selectedMovimiento.descripcion && (
                                      <div className="mt-4">
                                        <p className="text-sm text-muted-foreground">Descripción</p>
                                        <p className="text-sm">{selectedMovimiento.descripcion}</p>
                                      </div>
                                    )}
                                  </div>

                                  <Separator />

                                  <div>
                                    <h3 className="text-lg font-semibold mb-4">Asiento Contable</h3>

                                    {loadingAsiento ? (
                                      <div className="py-6 text-center text-muted-foreground">Cargando asiento...</div>
                                    ) : !asientoDetalle ? (
                                      <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center space-y-2">
                                        <p>No se encontraron asientos contables para esta transacción</p>
                                        <p className="text-xs">Si el endpoint /asiento no existe o no hay asientoId, aquí se mostrará vacío.</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-4">
                                        <div className="p-4 bg-muted rounded-lg">
                                          <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                              <span className="font-medium">Número:</span> {asientoDetalle.numero_asiento}
                                            </div>
                                            <div>
                                              <span className="font-medium">Fecha:</span>{" "}
                                              {(() => {
                                                const d = safeDate(asientoDetalle.fecha);
                                                return d ? format(d, "dd/MM/yyyy") : "-";
                                              })()}
                                            </div>
                                            <div className="col-span-2">
                                              <span className="font-medium">Descripción:</span> {asientoDetalle.descripcion}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="border rounded-lg overflow-hidden">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead className="w-[220px]">Cuenta</TableHead>
                                                <TableHead>Descripción</TableHead>
                                                <TableHead className="text-right w-[160px]">Debe</TableHead>
                                                <TableHead className="text-right w-[160px]">Haber</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {asientoDetalle.detalle_asientos?.map((detalle, idx) => (
                                                <TableRow key={idx}>
                                                  <TableCell>
                                                    <div>
                                                      <div className="font-medium text-sm">{detalle.cuenta_codigo}</div>
                                                      <div className="text-xs text-muted-foreground">{detalle.cuentas?.nombre || ""}</div>
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="text-sm">{detalle.descripcion}</TableCell>
                                                  <TableCell className="text-right font-medium">
                                                    {n(detalle.debe) > 0 ? formatCurrency(n(detalle.debe)) : "-"}
                                                  </TableCell>
                                                  <TableCell className="text-right font-medium">
                                                    {n(detalle.haber) > 0 ? formatCurrency(n(detalle.haber)) : "-"}
                                                  </TableCell>
                                                </TableRow>
                                              ))}

                                              <TableRow className="border-t-2 bg-muted/50 font-bold">
                                                <TableCell colSpan={2}>TOTALES</TableCell>
                                                <TableCell className="text-right">
                                                  {formatCurrency(asientoDetalle.detalle_asientos?.reduce((sum, d) => sum + n(d.debe), 0) || 0)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                  {formatCurrency(asientoDetalle.detalle_asientos?.reduce((sum, d) => sum + n(d.haber), 0) || 0)}
                                                </TableCell>
                                              </TableRow>
                                            </TableBody>
                                          </Table>
                                        </div>

                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
                                          <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">💡 Trazabilidad Contable</p>
                                          <p className="text-blue-600 dark:text-blue-400">
                                            Este asiento refleja cómo esta transacción afecta tu inventario y tus estados financieros.
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>

                          {puedeCancelar && (
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
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {movimientosFiltrados.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No se encontraron transacciones con los filtros seleccionados</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog confirmación cancelación */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta compra de inventario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción crea un asiento de reversión y ajusta el inventario. No se puede deshacer.
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
                  <div className="min-w-0">
                    <p className="font-medium truncate">{movimientoACancelar.productos?.nombre}</p>
                    <p className="text-sm text-muted-foreground truncate">{movimientoACancelar.descripcion || "-"}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Cantidad:</span>
                    <span className="ml-2 font-medium">{n(movimientoACancelar.cantidad).toLocaleString("es-MX")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Costo Total:</span>
                    <span className="ml-2 font-medium">{formatCurrency(getEffectiveTotalCost(movimientoACancelar))}</span>
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
            <AlertDialogCancel disabled={isCancelling}>Volver</AlertDialogCancel>
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
