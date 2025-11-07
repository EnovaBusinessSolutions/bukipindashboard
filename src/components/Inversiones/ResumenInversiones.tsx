import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInversiones } from "@/hooks/useInversiones";
import { useAsientosInversion } from "@/hooks/useAsientosInversion";
import { useAsientosInversionBulk } from "@/hooks/useAsientosInversionBulk";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { Eye, ImageIcon, Trash2, AlertTriangle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ResumenInversiones = () => {
  const { inversiones, isLoading, eliminarInversion } = useInversiones();
  const [selectedInversion, setSelectedInversion] = useState<any>(null);
  const { data: asientoInversion, isLoading: loadingAsiento } = useAsientosInversion(selectedInversion?.id);
  const { data: inversionesConAsientos, isLoading: loadingAsientos } = useAsientosInversionBulk();

  const handleEliminar = (id: string) => {
    eliminarInversion.mutate(id);
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
  const totalDepreciacionAnual = inversiones.reduce(
    (acc, inv) => acc + Number(inv.valor_depreciacion_anual || 0),
    0
  );
  
  const activosActivos = inversiones.filter(inv => inv.estado === 'activo').length;
  const activosVendidos = inversiones.filter(inv => inv.estado === 'vendido').length;
  const activosBaja = inversiones.filter(inv => inv.estado === 'dado_de_baja').length;

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
            <CardTitle className="text-sm font-medium">Activos Registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{inversiones.length}</div>
              <div className="text-xs text-muted-foreground">
                {activosActivos} activos • {activosVendidos} vendidos • {activosBaja} baja
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Depreciación Anual Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalDepreciacionAnual.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inversiones CAPEX Registradas</CardTitle>
          <CardDescription>
            Listado completo de activos fijos y su información de depreciación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Depreciación</TableHead>
                <TableHead>Estado Pago</TableHead>
                <TableHead>Estado Activo</TableHead>
                <TableHead>Fecha Adquisición</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inversiones.map((inversion) => (
                <TableRow key={inversion.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={inversion.imagen_url || ""} alt={inversion.producto_nombre} />
                        <AvatarFallback>
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <span>{inversion.producto_nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getCategoriaLabel(inversion.categoria_activo)}</TableCell>
                  <TableCell>
                    ${Number(inversion.valor_total).toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{inversion.anos_depreciacion} años</div>
                      <div className="text-muted-foreground">
                        ${Number(inversion.valor_depreciacion_anual || 0).toLocaleString(
                          "es-MX",
                          { minimumFractionDigits: 2 }
                        )}
                        /año
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getTipoPagoVariant(inversion.tipo_pago)}>
                      {getTipoPagoLabel(inversion.tipo_pago)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      inversion.estado === 'activo' ? 'default' : 
                      inversion.estado === 'vendido' ? 'secondary' : 
                      'destructive'
                    }>
                      {inversion.estado === 'activo' ? 'Activo' : 
                       inversion.estado === 'vendido' ? 'Vendido' : 
                       'Dado de Baja'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(inversion.fecha_adquisicion), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedInversion(inversion)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Detalle de Inversión</DialogTitle>
                        </DialogHeader>
                        {selectedInversion && (
                          <div className="space-y-4">
                            {selectedInversion.imagen_url && (
                              <img
                                src={selectedInversion.imagen_url}
                                alt={selectedInversion.producto_nombre}
                                className="w-full h-64 object-cover rounded-lg"
                              />
                            )}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Activo
                                </p>
                                <p className="text-base">{selectedInversion.producto_nombre}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Categoría
                                </p>
                                <p className="text-base">
                                  {getCategoriaLabel(selectedInversion.categoria_activo)}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Valor Total
                                </p>
                                <p className="text-base">
                                  $
                                  {Number(selectedInversion.valor_total).toLocaleString("es-MX", {
                                    minimumFractionDigits: 2,
                                  })}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Monto Pagado
                                </p>
                                <p className="text-base">
                                  $
                                  {Number(selectedInversion.monto_pagado).toLocaleString("es-MX", {
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
                                    selectedInversion.valor_depreciacion_anual || 0
                                  ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Depreciación Mensual
                                </p>
                                <p className="text-base">
                                  $
                                  {Number(
                                    selectedInversion.valor_depreciacion_mensual || 0
                                  ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              {selectedInversion.proveedor_nombre && (
                                <>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Proveedor
                                    </p>
                                    <p className="text-base">
                                      {selectedInversion.proveedor_nombre}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      RFC
                                    </p>
                                    <p className="text-base">
                                      {selectedInversion.proveedor_rfc || "N/A"}
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                            {selectedInversion.descripcion && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Descripción
                                </p>
                                <p className="text-base">{selectedInversion.descripcion}</p>
                              </div>
                            )}
                            
                            <Separator className="my-4" />
                            
                            <div>
                              <h3 className="text-lg font-semibold mb-3">Asiento Contable Generado</h3>
                              {loadingAsiento ? (
                                <Skeleton className="h-32 w-full" />
                              ) : asientoInversion ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Número:</span>{" "}
                                      <span className="font-medium">{asientoInversion.numero_asiento}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Fecha:</span>{" "}
                                      <span className="font-medium">
                                        {format(new Date(asientoInversion.fecha), "dd/MM/yyyy")}
                                      </span>
                                    </div>
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
                                        {asientoInversion.detalle_asientos.map((detalle) => (
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
                                  
                                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                                    <p className="text-muted-foreground">
                                      Este asiento se generó automáticamente al registrar la inversión y se 
                                      refleja en la Balanza de Comprobación.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                  <p>No se encontró asiento contable para esta inversión.</p>
                                  <p className="text-sm mt-2">
                                    Las inversiones antiguas deben ser eliminadas y registradas nuevamente.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    
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
                            Esta acción eliminará permanentemente la inversión "{inversion.producto_nombre}".
                            {!asientoInversion && (
                              <span className="block mt-2 text-destructive font-medium">
                                Esta inversión no tiene asientos contables asociados y no afecta la balanza.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleEliminar(inversion.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
