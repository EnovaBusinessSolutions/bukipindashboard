import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInversiones } from "@/hooks/useInversiones";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Eye, ImageIcon } from "lucide-react";

const ResumenInversiones = () => {
  const { inversiones, isLoading } = useInversiones();
  const [selectedInversion, setSelectedInversion] = useState<any>(null);

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

  return (
    <div className="space-y-6">
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
            <div className="text-2xl font-bold">{inversiones.length}</div>
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
                <TableHead>Fecha Adquisición</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inversiones.map((inversion) => (
                <TableRow key={inversion.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {inversion.imagen_url && (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                      {inversion.producto_nombre}
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
                    {format(new Date(inversion.fecha_adquisicion), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
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
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
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
