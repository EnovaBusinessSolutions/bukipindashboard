import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInversiones } from "@/hooks/useInversiones";
import { useTransaccionesInversionesConDepreciaciones } from "@/hooks/useTransaccionesInversionesConDepreciaciones";
import { useAsientosInversion } from "@/hooks/useAsientosInversion";
import { useAsientosInversionBulk } from "@/hooks/useAsientosInversionBulk";
import { useAsientosDepreciacion } from "@/hooks/useAsientosDepreciacion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import { Eye, ImageIcon, Trash2, AlertTriangle, TrendingUp, TrendingDown, ShoppingCart, RotateCcw, Calendar } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ResumenInversiones = () => {
  const { inversiones, isLoading: loadingInversiones, eliminarInversion, actualizarInversion } = useInversiones();
  const { transacciones, isLoading: loadingTransacciones } = useTransaccionesInversionesConDepreciaciones();
  const [selectedTransaccion, setSelectedTransaccion] = useState<any>(null);
  const { data: asientoInversion, isLoading: loadingAsiento } = useAsientosInversion(
    selectedTransaccion?.inversion_id,
    selectedTransaccion?.tipo === 'depreciacion' ? undefined : selectedTransaccion?.tipo
  );
  const { data: asientosDepreciacion } = useAsientosDepreciacion(
    selectedTransaccion?.tipo === 'depreciacion' ? selectedTransaccion?.inversion_id : undefined
  );
  const { data: inversionesConAsientos, isLoading: loadingAsientos } = useAsientosInversionBulk();

  const handleEliminar = (id: string) => {
    eliminarInversion.mutate(id);
  };

  const handleReactivar = (inversionId: string) => {
    actualizarInversion.mutate({
      id: inversionId,
      actualizacion: {
        estado: 'activo',
        // El trigger limpia automáticamente todos los campos de baja/venta
      }
    });
  };

  const getTipoTransaccionIcon = (tipo: string) => {
    switch (tipo) {
      case 'alta':
        return <TrendingUp className="h-4 w-4" />;
      case 'baja':
        return <TrendingDown className="h-4 w-4" />;
      case 'venta':
        return <ShoppingCart className="h-4 w-4" />;
      case 'depreciacion':
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

  const getTipoTransaccionVariant = (tipo: string) => {
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

  const getTipoPagoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      total: "Pago Total",
      parcial: "Pago Parcial",
      credito: "Crédito Total",
    };
    return labels[tipo] || tipo;
  };

  const getTipoPagoVariant = (tipo: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      total: "default",
      parcial: "secondary",
      credito: "destructive",
    };
    return variants[tipo] || "default";
  };

  const isLoading = loadingInversiones || loadingTransacciones;

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

  const totalInvertido = inversiones.reduce((acc, inv) => acc + Number(inv.valor_total), 0);
  const valorActivosActivos = inversiones
    .filter(inv => inv.estado === 'activo')
    .reduce((acc, inv) => acc + Number(inv.valor_total), 0);
  
  const totalTransacciones = transacciones.length;
  const transaccionesAlta = transacciones.filter(t => t.tipo === 'alta').length;
  const transaccionesBaja = transacciones.filter(t => t.tipo === 'baja').length;
  const transaccionesVenta = transacciones.filter(t => t.tipo === 'venta').length;
  const transaccionesDepreciacion = transacciones.filter(t => t.tipo === 'depreciacion').length;

  const inversionesSinAsientos = inversiones.filter(inv => {
    return !inversionesConAsientos?.has(inv.id);
  });

  return (
    <div className="space-y-6">
      {!loadingAsientos && inversionesSinAsientos.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Hay {inversionesSinAsientos.length} inversión(es) registrada(s) antes de la implementación de asientos automáticos. 
            Estas inversiones NO afectan la balanza de comprobación. Se recomienda eliminarlas y registrarlas nuevamente.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Invertido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalInvertido.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Valor Activos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${valorActivosActivos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
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
                {transaccionesAlta} altas • {transaccionesDepreciacion} depreciaciones • {transaccionesBaja} bajas • {transaccionesVenta} ventas
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
              {transacciones.map((transaccion) => (
                <TableRow key={transaccion.id}>
                  <TableCell>
                    {format(new Date(transaccion.fecha), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={getTipoTransaccionVariant(transaccion.tipo)}>
                        <div className="flex items-center gap-1">
                          {getTipoTransaccionIcon(transaccion.tipo)}
                          {getTipoTransaccionLabel(transaccion.tipo)}
                        </div>
                      </Badge>
                      {transaccion.inversion.estado === 'activo' && 
                       (transaccion.tipo === 'baja' || transaccion.tipo === 'venta') && (
                        <Badge variant="outline" className="text-xs">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reactivado
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={transaccion.inversion.imagen_url || ""} alt={transaccion.activo} />
                        <AvatarFallback>
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <span>{transaccion.activo}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getCategoriaLabel(transaccion.categoria)}</TableCell>
                  <TableCell>
                    {transaccion.tipo === 'alta' && transaccion.monto && (
                      <span className="font-medium text-green-600">
                        ${Number(transaccion.monto).toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    )}
                    {transaccion.tipo === 'venta' && transaccion.valor_venta && (
                      <span className="font-medium text-blue-600">
                        ${Number(transaccion.valor_venta).toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    )}
                    {transaccion.tipo === 'depreciacion' && transaccion.monto && (
                      <span className="font-medium text-purple-600">
                        ${Number(transaccion.monto).toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    )}
                    {transaccion.tipo === 'baja' && <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {transaccion.tipo === 'depreciacion' && transaccion.mes_ano && (
                      <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                        {transaccion.mes_ano}
                      </Badge>
                    )}
                    {transaccion.tipo !== 'depreciacion' && '-'}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {transaccion.tipo === 'alta' && transaccion.descripcion}
                    {transaccion.tipo === 'depreciacion' && transaccion.descripcion}
                    {(transaccion.tipo === 'baja' || transaccion.tipo === 'venta') && transaccion.motivo}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTransaccion(transaccion)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            Detalle de Transacción - {selectedTransaccion && getTipoTransaccionLabel(selectedTransaccion.tipo)}
                          </DialogTitle>
                        </DialogHeader>
                        {selectedTransaccion && (
                          <div className="space-y-4">
                            {selectedTransaccion.inversion.imagen_url && (
                              <img
                                src={selectedTransaccion.inversion.imagen_url}
                                alt={selectedTransaccion.activo}
                                className="w-full h-64 object-cover rounded-lg"
                              />
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Tipo de Transacción
                                </p>
                                <Badge variant={getTipoTransaccionVariant(selectedTransaccion.tipo)}>
                                  <div className="flex items-center gap-1">
                                    {getTipoTransaccionIcon(selectedTransaccion.tipo)}
                                    {getTipoTransaccionLabel(selectedTransaccion.tipo)}
                                  </div>
                                </Badge>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Fecha
                                </p>
                                <p className="text-base">
                                  {format(new Date(selectedTransaccion.fecha), "dd/MM/yyyy")}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Activo
                                </p>
                                <p className="text-base">{selectedTransaccion.activo}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Categoría
                                </p>
                                <p className="text-base">
                                  {getCategoriaLabel(selectedTransaccion.categoria)}
                                </p>
                              </div>
                              
                              {selectedTransaccion.tipo === 'alta' && (
                                <>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Valor Total
                                    </p>
                                    <p className="text-base font-semibold text-green-600">
                                      ${Number(selectedTransaccion.monto).toLocaleString("es-MX", {
                                        minimumFractionDigits: 2,
                                      })}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Depreciación Anual
                                    </p>
                                    <p className="text-base">
                                      $
                                      {Number(
                                        selectedTransaccion.inversion.valor_depreciacion_anual || 0
                                      ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  {selectedTransaccion.inversion.proveedor_nombre && (
                                    <>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">
                                          Proveedor
                                        </p>
                                        <p className="text-base">
                                          {selectedTransaccion.inversion.proveedor_nombre}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">
                                          RFC
                                        </p>
                                        <p className="text-base">
                                          {selectedTransaccion.inversion.proveedor_rfc || "N/A"}
                                        </p>
                                      </div>
                                    </>
                                  )}
                                </>
                              )}
                              
                              {selectedTransaccion.tipo === 'venta' && (
                                <>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Valor de Venta
                                    </p>
                                    <p className="text-base font-semibold text-blue-600">
                                      ${Number(selectedTransaccion.valor_venta || 0).toLocaleString("es-MX", {
                                        minimumFractionDigits: 2,
                                      })}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Valor Original
                                    </p>
                                    <p className="text-base">
                                      ${Number(selectedTransaccion.inversion.valor_total).toLocaleString("es-MX", {
                                        minimumFractionDigits: 2,
                                      })}
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                            
                            {selectedTransaccion.tipo === 'alta' && selectedTransaccion.descripcion && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Descripción
                                </p>
                                <p className="text-base">{selectedTransaccion.descripcion}</p>
                              </div>
                            )}
                            
                            {(selectedTransaccion.tipo === 'baja' || selectedTransaccion.tipo === 'venta') && selectedTransaccion.motivo && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Motivo
                                </p>
                                <p className="text-base">{selectedTransaccion.motivo}</p>
                              </div>
                            )}
                            
                            <Separator className="my-4" />
                            
                            <div>
                              <h3 className="text-lg font-semibold mb-3">
                                Historial de Asientos Contables
                              </h3>
                              {loadingAsiento ? (
                                <Skeleton className="h-32 w-full" />
                              ) : asientoInversion && asientoInversion.length > 0 ? (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary">
                                      {asientoInversion.length} {asientoInversion.length === 1 ? 'asiento' : 'asientos'}
                                    </Badge>
                                  </div>
                                  
                                  <Accordion type="single" collapsible defaultValue="item-0" className="space-y-2">
                                    {asientoInversion.map((asiento, index) => (
                                      <AccordionItem value={`item-${index}`} key={asiento.id} className="border rounded-lg">
                                        <AccordionTrigger className="px-4 hover:no-underline">
                                          <div className="flex flex-col items-start gap-2 text-left w-full">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <Badge variant="outline">{asiento.numero_asiento}</Badge>
                                              <span className="text-xs text-muted-foreground">
                                                {format(new Date(asiento.created_at), "dd/MM/yyyy HH:mm")}
                                              </span>
                                            </div>
                                            <span className="text-sm font-normal">{asiento.descripcion}</span>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4">
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
                                                {asiento.detalle_asientos.map((detalle) => (
                                                  <TableRow key={detalle.id}>
                                                    <TableCell>
                                                      <div>
                                                        <div className="font-medium text-sm">
                                                          {detalle.cuenta_codigo} - {detalle.cuenta?.nombre}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                          {detalle.descripcion}
                                                        </div>
                                                      </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                      {detalle.debe > 0 ? (
                                                        <span className="text-green-600">
                                                          ${Number(detalle.debe).toLocaleString("es-MX", {
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
                                                          ${Number(detalle.haber).toLocaleString("es-MX", {
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
                                        </AccordionContent>
                                      </AccordionItem>
                                    ))}
                                   </Accordion>
                                   
                                   <div className="bg-muted/50 p-3 rounded-lg text-sm">
                                     <p className="text-muted-foreground">
                                       Los asientos se generan automáticamente al {selectedTransaccion.tipo === 'alta' ? 'registrar la inversión' : selectedTransaccion.tipo === 'venta' ? 'vender el activo' : 'dar de baja el activo'} y se 
                                       reflejan en la Balanza de Comprobación.
                                     </p>
                                   </div>
                                </div>
                              ) : selectedTransaccion.tipo === 'depreciacion' && !asientosDepreciacion ? (
                                <div className="space-y-2">
                                  <Skeleton className="h-12 w-full" />
                                  <Skeleton className="h-32 w-full" />
                                </div>
                              ) : selectedTransaccion.tipo === 'depreciacion' && selectedTransaccion.numero_asiento ? (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">
                                      Asiento de Depreciación
                                    </Badge>
                                    <Badge variant="outline">{selectedTransaccion.numero_asiento}</Badge>
                                    {selectedTransaccion.mes_ano && (
                                      <Badge variant="secondary">{selectedTransaccion.mes_ano}</Badge>
                                    )}
                                  </div>
                                  
                                  <div className="border rounded-lg p-4 bg-purple-50/30">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="text-sm font-medium mb-1">
                                          {selectedTransaccion.descripcion}
                                        </p>
                                        <div className="text-xs text-muted-foreground">
                                          Periodo: {selectedTransaccion.mes_ano}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs text-muted-foreground mb-1">Monto de Depreciación</p>
                                        <p className="text-lg font-bold text-purple-700">
                                          ${Number(selectedTransaccion.monto || 0).toLocaleString("es-MX", {
                                            minimumFractionDigits: 2,
                                          })}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {asientosDepreciacion && asientosDepreciacion.length > 0 && (
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
                                          {asientosDepreciacion
                                            .find(a => a.numero_asiento === selectedTransaccion.numero_asiento)
                                            ?.detalle_asientos?.map((detalle) => (
                                            <TableRow key={detalle.id}>
                                              <TableCell>
                                                <div>
                                                  <div className="font-medium text-sm">
                                                    {detalle.cuenta_codigo} - {detalle.cuenta?.nombre}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground">
                                                    {detalle.descripcion}
                                                  </div>
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-right font-mono">
                                                {detalle.debe > 0 ? (
                                                  <span className="text-red-600 font-medium">
                                                    ${Number(detalle.debe).toLocaleString("es-MX", {
                                                      minimumFractionDigits: 2,
                                                    })}
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground">-</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-right font-mono">
                                                {detalle.haber > 0 ? (
                                                  <span className="text-green-600 font-medium">
                                                    ${Number(detalle.haber).toLocaleString("es-MX", {
                                                      minimumFractionDigits: 2,
                                                    })}
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground">-</span>
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}
                                  
                                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                                    <p className="text-muted-foreground">
                                      Los asientos de depreciación se generan mensualmente y se reflejan automáticamente en la Balanza de Comprobación.
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
                      {transaccion.tipo === 'alta' && (
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
                                Esta acción no se puede deshacer. Se eliminará permanentemente la inversión
                                "{transaccion.activo}" y todas sus transacciones asociadas.
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
                      {(transaccion.tipo === 'baja' || transaccion.tipo === 'venta') && (
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
                                Esta acción revertirá la {transaccion.tipo === 'venta' ? 'venta' : 'baja'} del activo
                                "{transaccion.activo}". El activo volverá a estado activo y podrás darlo de baja
                                nuevamente para generar los asientos contables correctos.
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumenInversiones;
