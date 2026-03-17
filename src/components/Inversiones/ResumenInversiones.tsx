import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  Eye,
  ImageIcon,
  RotateCcw,
  ShoppingCart,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useInversiones } from "@/hooks/useInversiones";
import {
  useTransaccionesInversionesConDepreciaciones,
  type TransaccionInversionCompleta,
} from "@/hooks/useTransaccionesInversionesConDepreciaciones";
import { useAsientosInversion } from "@/hooks/useAsientosInversion";
import { useAsientosInversionBulk } from "@/hooks/useAsientosInversionBulk";
import { useAsientosDepreciacion } from "@/hooks/useAsientosDepreciacion";
import { useDepreciacionesAtrasadas } from "@/hooks/useDepreciacionesAtrasadas";

const safeDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatMoney = (value?: number | null) =>
  Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const ResumenInversiones = () => {
  const {
    inversiones,
    isLoading: loadingInversiones,
    eliminarInversion,
    actualizarInversion,
  } = useInversiones();

  const {
    transacciones,
    isLoading: loadingTransacciones,
  } = useTransaccionesInversionesConDepreciaciones();

  const { tieneAtrasadas, totalAtrasadas } = useDepreciacionesAtrasadas();

  const [selectedTransaccion, setSelectedTransaccion] =
    useState<TransaccionInversionCompleta | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);

  const { data: asientoInversion, isLoading: loadingAsiento } = useAsientosInversion(
    selectedTransaccion?.inversion_id,
    selectedTransaccion?.tipo === "depreciacion" ? undefined : selectedTransaccion?.tipo
  );

  const { data: asientosDepreciacion } = useAsientosDepreciacion(
    selectedTransaccion?.tipo === "depreciacion" ? selectedTransaccion?.inversion_id : undefined
  );

  const {
    data: inversionesConAsientos,
    isLoading: loadingAsientos,
  } = useAsientosInversionBulk();

  const isLoading = loadingInversiones || loadingTransacciones;

  const totalInvertido = useMemo(
    () => inversiones.reduce((acc, inv) => acc + Number(inv.valor_total || 0), 0),
    [inversiones]
  );

  const valorActivosActivos = useMemo(
    () =>
      inversiones
        .filter((inv) => inv.estado === "activo")
        .reduce((acc, inv) => acc + Number(inv.valor_total || 0), 0),
    [inversiones]
  );

  const totalTransacciones = transacciones.length;
  const transaccionesAlta = transacciones.filter((t) => t.tipo === "alta").length;
  const transaccionesBaja = transacciones.filter((t) => t.tipo === "baja").length;
  const transaccionesVenta = transacciones.filter((t) => t.tipo === "venta").length;
  const transaccionesDepreciacion = transacciones.filter((t) => t.tipo === "depreciacion").length;

  const inversionesSinAsientos = useMemo(() => {
    return inversiones.filter((inv) => !inversionesConAsientos?.has(inv.id));
  }, [inversiones, inversionesConAsientos]);

  const handleEliminar = (id: string) => {
    eliminarInversion.mutate(id);
  };

  const handleReactivar = (inversionId: string) => {
    actualizarInversion.mutate({
      id: inversionId,
      actualizacion: {
        estado: "activo",
      },
    });
  };

  const openDetalle = (transaccion: TransaccionInversionCompleta) => {
    setSelectedTransaccion(transaccion);
    setDetalleOpen(true);
  };

  const closeDetalle = (open: boolean) => {
    setDetalleOpen(open);
    if (!open) {
      setSelectedTransaccion(null);
    }
  };

  const getTipoTransaccionIcon = (tipo: string) => {
    switch (tipo) {
      case "alta":
        return <TrendingUp className="h-4 w-4" />;
      case "baja":
        return <TrendingDown className="h-4 w-4" />;
      case "venta":
        return <ShoppingCart className="h-4 w-4" />;
      case "depreciacion":
        return <Calendar className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTipoTransaccionLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      alta: "Alta",
      baja: "Baja",
      venta: "Venta",
      depreciacion: "Depreciación",
    };
    return labels[tipo] || tipo;
  };

  const getTipoTransaccionVariant = (
    tipo: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      alta: "default",
      baja: "destructive",
      venta: "secondary",
      depreciacion: "outline",
    };
    return variants[tipo] || "default";
  };

  const getCategoriaLabel = (categoria: string) => {
    const labels: Record<string, string> = {
      equipo_computo: "Equipo de Cómputo",
      maquinaria: "Maquinaria",
      vehiculos: "Vehículos",
      mobiliario: "Mobiliario",
      edificios: "Edificios",
      equipo_oficina: "Equipo de Oficina",
      otro: "Otro",
    };
    return labels[categoria] || categoria;
  };

  const selectedFecha = safeDate(selectedTransaccion?.fecha);

  const selectedAsientoDepreciacion =
    selectedTransaccion?.tipo === "depreciacion" && selectedTransaccion?.numero_asiento
      ? asientosDepreciacion?.find(
          (a: any) => a?.numero_asiento === selectedTransaccion.numero_asiento
        )
      : null;

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
      {tieneAtrasadas && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>{totalAtrasadas} depreciación(es) atrasada(s).</strong> Algunos activos no
              tienen depreciaciones registradas para períodos anteriores.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {!loadingAsientos && inversionesSinAsientos.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Hay {inversionesSinAsientos.length} inversión(es) registrada(s) antes de la
            implementación de asientos automáticos. Estas inversiones no afectan la balanza de
            comprobación. Se recomienda eliminarlas y registrarlas nuevamente.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Invertido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatMoney(totalInvertido)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Valor Activos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatMoney(valorActivosActivos)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Transacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{totalTransacciones}</div>
              <div className="text-xs text-muted-foreground">
                {transaccionesAlta} altas • {transaccionesDepreciacion} depreciaciones •{" "}
                {transaccionesBaja} bajas • {transaccionesVenta} ventas
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Transacciones CAPEX</CardTitle>
          <CardDescription>
            Registro cronológico de todas las transacciones de inversiones
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Mes/Año</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {transacciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No hay transacciones de inversiones registradas todavía.
                  </TableCell>
                </TableRow>
              ) : (
                transacciones.map((transaccion) => {
                  const fecha = safeDate(transaccion.fecha);

                  return (
                    <TableRow key={transaccion.id}>
                      <TableCell>{fecha ? format(fecha, "dd/MM/yyyy") : "-"}</TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={getTipoTransaccionVariant(transaccion.tipo)}>
                            <div className="flex items-center gap-1">
                              {getTipoTransaccionIcon(transaccion.tipo)}
                              {getTipoTransaccionLabel(transaccion.tipo)}
                            </div>
                          </Badge>

                          {transaccion.inversion.estado === "activo" &&
                            (transaccion.tipo === "baja" || transaccion.tipo === "venta") && (
                              <Badge variant="outline" className="text-xs">
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Reactivado
                              </Badge>
                            )}
                        </div>
                      </TableCell>

                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage
                              src={transaccion.inversion.imagen_url || ""}
                              alt={transaccion.activo}
                            />
                            <AvatarFallback>
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                          <span>{transaccion.activo}</span>
                        </div>
                      </TableCell>

                      <TableCell>{getCategoriaLabel(transaccion.categoria)}</TableCell>

                      <TableCell>
                        {transaccion.tipo === "alta" && transaccion.monto !== undefined && (
                          <span className="font-medium text-green-600">
                            ${formatMoney(transaccion.monto)}
                          </span>
                        )}

                        {transaccion.tipo === "venta" && transaccion.valor_venta !== undefined && (
                          <span className="font-medium text-blue-600">
                            ${formatMoney(transaccion.valor_venta)}
                          </span>
                        )}

                        {transaccion.tipo === "depreciacion" && transaccion.monto !== undefined && (
                          <span className="font-medium text-purple-600">
                            ${formatMoney(transaccion.monto)}
                          </span>
                        )}

                        {transaccion.tipo === "baja" && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {transaccion.tipo === "depreciacion" && transaccion.mes_ano ? (
                          <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                            {transaccion.mes_ano}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>

                      <TableCell className="max-w-xs truncate">
                        {transaccion.tipo === "alta" && transaccion.descripcion}
                        {transaccion.tipo === "depreciacion" && transaccion.descripcion}
                        {(transaccion.tipo === "baja" || transaccion.tipo === "venta") &&
                          transaccion.motivo}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetalle(transaccion)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {transaccion.tipo === "alta" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar inversión?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Se eliminará permanentemente la
                                    inversión "{transaccion.activo}" y todas sus transacciones
                                    asociadas.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleEliminar(transaccion.inversion_id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {(transaccion.tipo === "baja" || transaccion.tipo === "venta") && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <RotateCcw className="h-4 w-4 text-primary" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Reactivar activo?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción revertirá la{" "}
                                    {transaccion.tipo === "venta" ? "venta" : "baja"} del activo "
                                    {transaccion.activo}". El activo volverá a estado activo y
                                    podrás darlo de baja nuevamente para generar los asientos
                                    contables correctos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleReactivar(transaccion.inversion_id)}
                                  >
                                    Reactivar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detalleOpen} onOpenChange={closeDetalle}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalle de Transacción -{" "}
              {selectedTransaccion ? getTipoTransaccionLabel(selectedTransaccion.tipo) : ""}
            </DialogTitle>
          </DialogHeader>

          {selectedTransaccion && (
            <div className="space-y-4">
              {selectedTransaccion.inversion.imagen_url && (
                <img
                  src={selectedTransaccion.inversion.imagen_url}
                  alt={selectedTransaccion.activo}
                  className="h-64 w-full rounded-lg object-cover"
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tipo de Transacción</p>
                  <Badge variant={getTipoTransaccionVariant(selectedTransaccion.tipo)}>
                    <div className="flex items-center gap-1">
                      {getTipoTransaccionIcon(selectedTransaccion.tipo)}
                      {getTipoTransaccionLabel(selectedTransaccion.tipo)}
                    </div>
                  </Badge>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fecha</p>
                  <p className="text-base">{selectedFecha ? format(selectedFecha, "dd/MM/yyyy") : "-"}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Activo</p>
                  <p className="text-base">{selectedTransaccion.activo}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Categoría</p>
                  <p className="text-base">
                    {getCategoriaLabel(selectedTransaccion.categoria)}
                  </p>
                </div>

                {selectedTransaccion.tipo === "alta" && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                      <p className="text-base font-semibold text-green-600">
                        ${formatMoney(selectedTransaccion.monto)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Depreciación Anual
                      </p>
                      <p className="text-base">
                        ${formatMoney(selectedTransaccion.inversion.valor_depreciacion_anual || 0)}
                      </p>
                    </div>

                    {!!selectedTransaccion.inversion.proveedor_nombre && (
                      <>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Proveedor</p>
                          <p className="text-base">
                            {selectedTransaccion.inversion.proveedor_nombre}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground">RFC</p>
                          <p className="text-base">
                            {selectedTransaccion.inversion.proveedor_rfc || "N/A"}
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}

                {selectedTransaccion.tipo === "venta" && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Valor de Venta</p>
                      <p className="text-base font-semibold text-blue-600">
                        ${formatMoney(selectedTransaccion.valor_venta || 0)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Valor Original</p>
                      <p className="text-base">
                        ${formatMoney(selectedTransaccion.inversion.valor_total)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {selectedTransaccion.tipo === "alta" && selectedTransaccion.descripcion && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Descripción</p>
                  <p className="text-base">{selectedTransaccion.descripcion}</p>
                </div>
              )}

              {(selectedTransaccion.tipo === "baja" || selectedTransaccion.tipo === "venta") &&
                selectedTransaccion.motivo && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Motivo</p>
                    <p className="text-base">{selectedTransaccion.motivo}</p>
                  </div>
                )}

              <Separator className="my-4" />

              <div>
                <h3 className="mb-3 text-lg font-semibold">Historial de Asientos Contables</h3>

                {loadingAsiento ? (
                  <Skeleton className="h-32 w-full" />
                ) : selectedTransaccion.tipo === "depreciacion" && !asientosDepreciacion ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : selectedTransaccion.tipo === "depreciacion" &&
                  selectedTransaccion.numero_asiento ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="border-purple-200 bg-purple-50 text-purple-700"
                      >
                        Asiento de Depreciación
                      </Badge>

                      <Badge variant="outline">{selectedTransaccion.numero_asiento}</Badge>

                      {selectedTransaccion.mes_ano && (
                        <Badge variant="secondary">{selectedTransaccion.mes_ano}</Badge>
                      )}
                    </div>

                    <div className="rounded-lg border bg-purple-50/30 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="mb-1 text-sm font-medium">
                            {selectedTransaccion.descripcion}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            Periodo: {selectedTransaccion.mes_ano || "-"}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="mb-1 text-xs text-muted-foreground">
                            Monto de Depreciación
                          </p>
                          <p className="text-lg font-bold text-purple-700">
                            ${formatMoney(selectedTransaccion.monto || 0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedAsientoDepreciacion?.detalle_asientos?.length > 0 && (
                      <div className="overflow-hidden rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cuenta</TableHead>
                              <TableHead className="text-right">Debe</TableHead>
                              <TableHead className="text-right">Haber</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {selectedAsientoDepreciacion.detalle_asientos.map(
                              (detalle: any, idx: number) => (
                                <TableRow key={detalle?.id ?? `${detalle?.cuenta_codigo}-${idx}`}>
                                  <TableCell>
                                    <div>
                                      <div className="text-sm font-medium">
                                        {detalle?.cuenta_codigo} -{" "}
                                        {detalle?.cuenta?.nombre ||
                                          detalle?.cuenta_nombre ||
                                          "Cuenta"}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {detalle?.descripcion || detalle?.memo || ""}
                                      </div>
                                    </div>
                                  </TableCell>

                                  <TableCell className="text-right font-mono">
                                    {Number(detalle?.debe || 0) > 0 ? (
                                      <span className="font-medium text-red-600">
                                        ${formatMoney(detalle?.debe || 0)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>

                                  <TableCell className="text-right font-mono">
                                    {Number(detalle?.haber || 0) > 0 ? (
                                      <span className="font-medium text-green-600">
                                        ${formatMoney(detalle?.haber || 0)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    <div className="rounded-lg bg-muted/50 p-3 text-sm">
                      <p className="text-muted-foreground">
                        Los asientos de depreciación se generan mensualmente y se reflejan
                        automáticamente en la Balanza de Comprobación.
                      </p>
                    </div>
                  </div>
                ) : Array.isArray(asientoInversion) && asientoInversion.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {asientoInversion.length}{" "}
                        {asientoInversion.length === 1 ? "asiento" : "asientos"}
                      </Badge>
                    </div>

                    <Accordion
                      type="single"
                      collapsible
                      defaultValue="item-0"
                      className="space-y-2"
                    >
                      {asientoInversion.map((asiento: any, index: number) => {
                        const asientoFecha = safeDate(
                          asiento?.created_at || asiento?.fecha || asiento?.asiento_fecha
                        );

                        return (
                          <AccordionItem
                            value={`item-${index}`}
                            key={asiento?.id ?? `asiento-${index}`}
                            className="rounded-lg border"
                          >
                            <AccordionTrigger className="px-4 hover:no-underline">
                              <div className="flex w-full flex-col items-start gap-2 text-left">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">
                                    {asiento?.numero_asiento || "Sin folio"}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {asientoFecha ? format(asientoFecha, "dd/MM/yyyy HH:mm") : "-"}
                                  </span>
                                </div>
                                <span className="text-sm font-normal">
                                  {asiento?.descripcion || "Asiento contable"}
                                </span>
                              </div>
                            </AccordionTrigger>

                            <AccordionContent className="px-4 pb-4">
                              <div className="overflow-hidden rounded-lg border">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Cuenta</TableHead>
                                      <TableHead className="text-right">Debe</TableHead>
                                      <TableHead className="text-right">Haber</TableHead>
                                    </TableRow>
                                  </TableHeader>

                                  <TableBody>
                                    {(asiento?.detalle_asientos || []).map(
                                      (detalle: any, idx: number) => (
                                        <TableRow
                                          key={detalle?.id ?? `${detalle?.cuenta_codigo}-${idx}`}
                                        >
                                          <TableCell>
                                            <div>
                                              <div className="text-sm font-medium">
                                                {detalle?.cuenta_codigo} -{" "}
                                                {detalle?.cuenta?.nombre ||
                                                  detalle?.cuenta_nombre ||
                                                  "Cuenta"}
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                {detalle?.descripcion || detalle?.memo || ""}
                                              </div>
                                            </div>
                                          </TableCell>

                                          <TableCell className="text-right font-mono">
                                            {Number(detalle?.debe || 0) > 0 ? (
                                              <span className="text-green-600">
                                                ${formatMoney(detalle?.debe || 0)}
                                              </span>
                                            ) : (
                                              "-"
                                            )}
                                          </TableCell>

                                          <TableCell className="text-right font-mono">
                                            {Number(detalle?.haber || 0) > 0 ? (
                                              <span className="text-red-600">
                                                ${formatMoney(detalle?.haber || 0)}
                                              </span>
                                            ) : (
                                              "-"
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>

                    <div className="rounded-lg bg-muted/50 p-3 text-sm">
                      <p className="text-muted-foreground">
                        Los asientos se generan automáticamente al{" "}
                        {selectedTransaccion.tipo === "alta"
                          ? "registrar la inversión"
                          : selectedTransaccion.tipo === "venta"
                            ? "vender el activo"
                            : "dar de baja el activo"}{" "}
                        y se reflejan en la Balanza de Comprobación.
                      </p>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No hay asientos contables registrados para esta transacción.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResumenInversiones;