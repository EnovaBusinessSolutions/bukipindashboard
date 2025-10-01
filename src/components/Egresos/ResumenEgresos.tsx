import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Calendar, User, DollarSign, CreditCard } from "lucide-react";
import { useTransaccionesEgresos } from "@/hooks/useTransaccionesEgresos";
import { Skeleton } from "@/components/ui/skeleton";

const ResumenEgresos = () => {
  const { transacciones, loading } = useTransaccionesEgresos(50);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const getTipoEgresoBadge = (tipo: string) => {
    const variants: Record<string, any> = {
      'costo': 'destructive',
      'gasto': 'default',
      'otro': 'secondary'
    };
    return variants[tipo] || 'default';
  };

  const getTipoPagoBadge = (tipo: string) => {
    const variants: Record<string, any> = {
      'contado': 'default',
      'credito': 'secondary',
      'parcial': 'outline'
    };
    return variants[tipo] || 'default';
  };

  const handleViewDetails = (transaction: any) => {
    setSelectedTransaction(transaction);
    setDetailsOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Egresos</CardTitle>
          <CardDescription>Cargando transacciones...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Egresos</CardTitle>
          <CardDescription>
            Historial completo de todos los egresos registrados ({transacciones.length} transacciones)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transacciones.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No hay egresos registrados aún</p>
              <p className="text-sm mt-2">Los egresos que registres aparecerán aquí</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Monto Total</TableHead>
                    <TableHead>Tipo de Pago</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transacciones.map((transaccion) => (
                    <TableRow key={transaccion.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(transaccion.created_at).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTipoEgresoBadge(transaccion.tipo_egreso)}>
                          {transaccion.tipo_egreso}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="font-medium truncate">{transaccion.descripcion}</div>
                        {transaccion.comentarios && (
                          <div className="text-xs text-muted-foreground truncate mt-1">
                            {transaccion.comentarios.substring(0, 50)}
                            {transaccion.comentarios.length > 50 && '...'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transaccion.proveedor_nombre || '-'}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${transaccion.monto_total.toLocaleString('es-MX', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTipoPagoBadge(transaccion.tipo_pago)}>
                          {transaccion.tipo_pago}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {transaccion.monto_pendiente > 0 ? (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            Pendiente: ${transaccion.monto_pendiente.toFixed(2)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Pagado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(transaccion)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de detalles */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Egreso</DialogTitle>
            <DialogDescription>
              Información completa de la transacción
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4">
              {/* Información general */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Fecha
                  </div>
                  <div className="font-medium">
                    {new Date(selectedTransaction.created_at).toLocaleString('es-MX', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Tipo de Egreso</div>
                  <Badge variant={getTipoEgresoBadge(selectedTransaction.tipo_egreso)}>
                    {selectedTransaction.tipo_egreso}
                  </Badge>
                  {selectedTransaction.subtipo_egreso && (
                    <span className="text-sm text-muted-foreground ml-2">
                      ({selectedTransaction.subtipo_egreso})
                    </span>
                  )}
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Descripción</div>
                <div className="font-medium">{selectedTransaction.descripcion}</div>
              </div>

              {/* Cantidades y precios */}
              {selectedTransaction.cantidad && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Cantidad</div>
                    <div className="font-medium">{selectedTransaction.cantidad}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Precio Unitario</div>
                    <div className="font-medium">
                      ${selectedTransaction.precio_unitario?.toFixed(2)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Total</div>
                    <div className="font-medium text-lg">
                      ${selectedTransaction.monto_total.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {/* Información de pago */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Información de Pago
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Tipo de Pago</div>
                    <Badge variant={getTipoPagoBadge(selectedTransaction.tipo_pago)}>
                      {selectedTransaction.tipo_pago}
                    </Badge>
                  </div>
                  {selectedTransaction.metodo_pago && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Método de Pago</div>
                      <div className="font-medium">{selectedTransaction.metodo_pago}</div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Monto Pagado</div>
                    <div className="font-medium text-green-600">
                      ${selectedTransaction.monto_pagado.toFixed(2)}
                    </div>
                  </div>
                  {selectedTransaction.monto_pendiente > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Monto Pendiente</div>
                      <div className="font-medium text-yellow-600">
                        ${selectedTransaction.monto_pendiente.toFixed(2)}
                      </div>
                    </div>
                  )}
                  {selectedTransaction.fecha_vencimiento && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Fecha de Vencimiento</div>
                      <div className="font-medium">
                        {new Date(selectedTransaction.fecha_vencimiento).toLocaleDateString('es-MX')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Información del proveedor */}
              {selectedTransaction.proveedor_nombre && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Información del Proveedor
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Nombre</div>
                      <div className="font-medium">{selectedTransaction.proveedor_nombre}</div>
                    </div>
                    {selectedTransaction.proveedor_telefono && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Teléfono</div>
                        <div className="font-medium">{selectedTransaction.proveedor_telefono}</div>
                      </div>
                    )}
                    {selectedTransaction.proveedor_email && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Email</div>
                        <div className="font-medium">{selectedTransaction.proveedor_email}</div>
                      </div>
                    )}
                    {selectedTransaction.proveedor_rfc && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">RFC</div>
                        <div className="font-medium">{selectedTransaction.proveedor_rfc}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comentarios */}
              {selectedTransaction.comentarios && (
                <div className="border-t pt-4">
                  <div className="text-sm text-muted-foreground mb-2">Comentarios</div>
                  <div className="text-sm bg-muted p-3 rounded-md">
                    {selectedTransaction.comentarios}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ResumenEgresos;