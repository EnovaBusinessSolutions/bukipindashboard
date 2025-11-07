import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInversiones } from "@/hooks/useInversiones";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { TrendingDown, Trash2, Info } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

const BajaActivos = () => {
  const { inversiones, isLoading, darDeBajaActivo } = useInversiones();
  const [selectedInversion, setSelectedInversion] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipoBaja, setTipoBaja] = useState<'vendido' | 'dado_de_baja'>('dado_de_baja');
  const [fechaBaja, setFechaBaja] = useState<Date>(new Date());
  const [motivo, setMotivo] = useState("");
  const [valorVenta, setValorVenta] = useState("");

  const inversionesActivas = inversiones.filter(inv => inv.estado === 'activo');

  const handleSubmit = () => {
    if (!selectedInversion || !motivo) return;

    darDeBajaActivo.mutate({
      id: selectedInversion.id,
      fecha_baja: format(fechaBaja, "yyyy-MM-dd"),
      motivo_baja: motivo,
      valor_venta: tipoBaja === 'vendido' && valorVenta ? parseFloat(valorVenta) : undefined,
      estado: tipoBaja,
    }, {
      onSuccess: () => {
        setDialogOpen(false);
        setSelectedInversion(null);
        setMotivo("");
        setValorVenta("");
        setTipoBaja('dado_de_baja');
        setFechaBaja(new Date());
      }
    });
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

  const calcularDepreciacionAcumulada = (inversion: any) => {
    const fechaAdquisicion = new Date(inversion.fecha_adquisicion);
    const hoy = new Date();
    const mesesTranscurridos = Math.floor(
      (hoy.getTime() - fechaAdquisicion.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    return Math.min(
      mesesTranscurridos * (inversion.valor_depreciacion_mensual || 0),
      inversion.valor_total
    );
  };

  const calcularValorLibros = (inversion: any) => {
    return inversion.valor_total - calcularDepreciacionAcumulada(inversion);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Bajas de Activos</CardTitle>
          <CardDescription>
            Registra la venta o baja de activos fijos. Solo se muestran los activos activos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Valor Original</TableHead>
                <TableHead>Valor en Libros</TableHead>
                <TableHead>Depreciación Acumulada</TableHead>
                <TableHead>Fecha Adquisición</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inversionesActivas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No hay activos activos para dar de baja
                  </TableCell>
                </TableRow>
              ) : (
                inversionesActivas.map((inversion) => {
                  const valorLibros = calcularValorLibros(inversion);
                  const depreciacionAcumulada = calcularDepreciacionAcumulada(inversion);
                  
                  return (
                    <TableRow key={inversion.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={inversion.imagen_url || ""} alt={inversion.producto_nombre} />
                            <AvatarFallback>
                              {inversion.producto_nombre.charAt(0)}
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
                      <TableCell className="font-medium">
                        ${valorLibros.toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        ${depreciacionAcumulada.toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(inversion.fecha_adquisicion), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Dialog open={dialogOpen && selectedInversion?.id === inversion.id} onOpenChange={(open) => {
                          setDialogOpen(open);
                          if (!open) {
                            setSelectedInversion(null);
                            setMotivo("");
                            setValorVenta("");
                            setTipoBaja('dado_de_baja');
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedInversion(inversion);
                                setDialogOpen(true);
                              }}
                            >
                              <TrendingDown className="h-4 w-4 mr-2" />
                              Venta/Baja de Activo
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Venta o Baja de Activo</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-medium mb-2">Activo:</p>
                                <p className="text-base">{inversion.producto_nombre}</p>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Valor Original:</p>
                                  <p className="font-medium">
                                    ${Number(inversion.valor_total).toLocaleString("es-MX", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Valor en Libros:</p>
                                  <p className="font-medium">
                                    ${valorLibros.toLocaleString("es-MX", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label>Tipo de Baja *</Label>
                                <Select value={tipoBaja} onValueChange={(value: any) => setTipoBaja(value)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="dado_de_baja">Baja de Activo (Sin Venta)</SelectItem>
                                    <SelectItem value="vendido">Venta de Activo (Con Ingreso)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {tipoBaja === 'vendido' && (
                                <Alert>
                                  <Info className="h-4 w-4" />
                                  <AlertDescription>
                                    Se generará un asiento contable registrando:
                                    <ul className="mt-1 ml-4 list-disc text-xs">
                                      <li>Ingreso por venta en Caja</li>
                                      <li>Eliminación del activo y su depreciación acumulada</li>
                                      <li>Ganancia o pérdida en venta de activo</li>
                                    </ul>
                                  </AlertDescription>
                                </Alert>
                              )}

                              {tipoBaja === 'dado_de_baja' && (
                                <Alert>
                                  <Info className="h-4 w-4" />
                                  <AlertDescription>
                                    Se generará un asiento contable registrando:
                                    <ul className="mt-1 ml-4 list-disc text-xs">
                                      <li>Eliminación del activo y su depreciación acumulada</li>
                                      <li>Pérdida por baja de activo (valor en libros)</li>
                                    </ul>
                                  </AlertDescription>
                                </Alert>
                              )}

                              <div className="space-y-2">
                                <Label>Fecha de Baja *</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !fechaBaja && "text-muted-foreground"
                                      )}
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {fechaBaja ? format(fechaBaja, "PPP") : <span>Selecciona fecha</span>}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                    <Calendar
                                      mode="single"
                                      selected={fechaBaja}
                                      onSelect={(date) => date && setFechaBaja(date)}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>

                              {tipoBaja === 'vendido' && (
                                <div className="space-y-2">
                                  <Label>Valor de Venta *</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={valorVenta}
                                    onChange={(e) => setValorVenta(e.target.value)}
                                    placeholder="0.00"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Este será el monto de ingreso registrado en Caja
                                  </p>
                                </div>
                              )}

                              <div className="space-y-2">
                                <Label>Motivo / Observaciones *</Label>
                                <Textarea
                                  value={motivo}
                                  onChange={(e) => setMotivo(e.target.value)}
                                  placeholder="Describe el motivo de la baja..."
                                  rows={3}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setDialogOpen(false);
                                  setSelectedInversion(null);
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={handleSubmit}
                                disabled={
                                  !motivo || 
                                  (tipoBaja === 'vendido' && (!valorVenta || parseFloat(valorVenta) <= 0)) ||
                                  darDeBajaActivo.isPending
                                }
                              >
                                Confirmar {tipoBaja === 'vendido' ? 'Venta' : 'Baja'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default BajaActivos;
