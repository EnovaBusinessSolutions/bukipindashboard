import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInversiones } from "@/hooks/useInversiones";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import { TrendingDown, FileText, RotateCcw } from "lucide-react";
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
import { useAsientosInversion } from "@/hooks/useAsientosInversion";
import { useClientes, useCreateCliente } from "@/hooks/useClientes";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

const BajaActivos = () => {
  const { inversiones, isLoading, darDeBajaActivo } = useInversiones();
  const { data: clientes } = useClientes();
  const crearCliente = useCreateCliente();
  const [selectedInversion, setSelectedInversion] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [asientoDialogOpen, setAsientoDialogOpen] = useState(false);
  const [selectedAsientoInversion, setSelectedAsientoInversion] = useState<any>(null);
  const [tipoBaja, setTipoBaja] = useState<'vendido' | 'dado_de_baja'>('dado_de_baja');
  const [fechaBaja, setFechaBaja] = useState<Date>(new Date());
  const [motivo, setMotivo] = useState("");
  const [valorVenta, setValorVenta] = useState("");
  
  // Campos para manejo de pagos
  const [tipoPago, setTipoPago] = useState<'contado' | 'credito' | 'parcial'>('contado');
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [montoPagado, setMontoPagado] = useState<string>('');
  const [montoPendiente, setMontoPendiente] = useState<string>('0');
  const [fechaVencimiento, setFechaVencimiento] = useState<Date | undefined>(undefined);
  
  // Campos para manejo de clientes
  const [tipoComprador, setTipoComprador] = useState<'nuevo' | 'recurrente'>('nuevo');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('');
  const [guardarComoCliente, setGuardarComoCliente] = useState(false);
  const [compradorNombre, setCompradorNombre] = useState('');
  const [compradorRfc, setCompradorRfc] = useState('');
  const [compradorTelefono, setCompradorTelefono] = useState('');
  const [compradorEmail, setCompradorEmail] = useState('');

  const inversionesActivas = inversiones.filter(inv => inv.estado === 'activo');
  const inversionesBaja = inversiones.filter(inv => inv.estado === 'dado_de_baja' || inv.estado === 'vendido');

  const { data: asientoData } = useAsientosInversion(
    selectedAsientoInversion?.id,
    selectedAsientoInversion?.estado === 'vendido' ? 'venta' : 'baja'
  );

  const handleSubmit = async () => {
    if (!selectedInversion || !motivo) return;

    // Validaciones
    if (tipoBaja === 'vendido') {
      const venta = parseFloat(valorVenta);
      if (!venta || venta <= 0) {
        return;
      }

      const pagado = parseFloat(montoPagado) || 0;
      const pendiente = parseFloat(montoPendiente) || 0;

      // Validar tipo de pago
      if (tipoPago === 'contado' && Math.abs(pagado - venta) > 0.01) {
        return;
      }

      if (tipoPago === 'credito' && pagado !== 0) {
        return;
      }

      if (tipoPago === 'parcial' && Math.abs(pagado + pendiente - venta) > 0.01) {
        return;
      }

      if (pendiente > 0 && !fechaVencimiento) {
        return;
      }

      // Guardar cliente nuevo si se marcó la opción
      if (tipoComprador === 'nuevo' && guardarComoCliente && compradorNombre) {
        try {
          await crearCliente.mutateAsync({
            nombre: compradorNombre,
            rfc: compradorRfc || undefined,
            telefono: compradorTelefono || undefined,
            email: compradorEmail || undefined,
            activo: true,
          });
        } catch (error) {
          console.error('Error al guardar cliente:', error);
          // Continuar con la baja aunque falle guardar el cliente
        }
      }
    }

    darDeBajaActivo.mutate({
      id: selectedInversion.id,
      fecha_baja: format(fechaBaja, "yyyy-MM-dd"),
      motivo_baja: motivo,
      valor_venta: tipoBaja === 'vendido' && valorVenta ? parseFloat(valorVenta) : undefined,
      estado: tipoBaja,
      // Campos de pago (solo para ventas)
      metodo_pago_venta: tipoBaja === 'vendido' && (tipoPago === 'contado' || tipoPago === 'parcial') ? metodoPago : undefined,
      tipo_pago_venta: tipoBaja === 'vendido' ? tipoPago : undefined,
      monto_pagado_venta: tipoBaja === 'vendido' ? parseFloat(montoPagado) || 0 : undefined,
      monto_pendiente_venta: tipoBaja === 'vendido' ? parseFloat(montoPendiente) || 0 : undefined,
      fecha_vencimiento_venta: tipoBaja === 'vendido' && fechaVencimiento ? format(fechaVencimiento, "yyyy-MM-dd") : undefined,
      comprador_nombre: tipoBaja === 'vendido' && compradorNombre ? compradorNombre : undefined,
      comprador_rfc: tipoBaja === 'vendido' && compradorRfc ? compradorRfc : undefined,
      comprador_telefono: tipoBaja === 'vendido' && compradorTelefono ? compradorTelefono : undefined,
      comprador_email: tipoBaja === 'vendido' && compradorEmail ? compradorEmail : undefined,
    }, {
      onSuccess: () => {
        setDialogOpen(false);
        setSelectedInversion(null);
        setMotivo("");
        setValorVenta("");
        setTipoBaja('dado_de_baja');
        setFechaBaja(new Date());
        setTipoPago('contado');
        setMetodoPago('efectivo');
        setMontoPagado('');
        setMontoPendiente('0');
        setFechaVencimiento(undefined);
        setTipoComprador('nuevo');
        setClienteSeleccionado('');
        setGuardarComoCliente(false);
        setCompradorNombre('');
        setCompradorRfc('');
        setCompradorTelefono('');
        setCompradorEmail('');
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

  const calcularDepreciacionAcumulada = (inversion: any, fechaHasta?: Date) => {
    const fechaAdquisicion = new Date(inversion.fecha_adquisicion);
    const fechaCalculo = fechaHasta || new Date();
    const mesesTranscurridos = Math.floor(
      (fechaCalculo.getTime() - fechaAdquisicion.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    return Math.min(
      mesesTranscurridos * (inversion.valor_depreciacion_mensual || 0),
      inversion.valor_total
    );
  };

  const calcularValorLibros = (inversion: any, fechaHasta?: Date) => {
    return inversion.valor_total - calcularDepreciacionAcumulada(inversion, fechaHasta);
  };

  const calcularGananciaPerdida = (inversion: any) => {
    if (inversion.estado !== 'vendido' || !inversion.valor_venta) return null;
    const fechaBaja = inversion.fecha_baja ? new Date(inversion.fecha_baja) : new Date();
    const valorLibros = calcularValorLibros(inversion, fechaBaja);
    return inversion.valor_venta - valorLibros;
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
      <Tabs defaultValue="disponibles" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="disponibles">
            Activos Disponibles ({inversionesActivas.length})
          </TabsTrigger>
          <TabsTrigger value="historial">
            Historial de Bajas ({inversionesBaja.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disponibles">
          <Card>
            <CardHeader>
              <CardTitle>Activos Disponibles para Baja</CardTitle>
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
                                          {fechaBaja ? format(fechaBaja, "dd/MM/yyyy") : <span>Selecciona fecha</span>}
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
                                    <>
                                      <div className="space-y-2">
                                        <Label>Valor de Venta *</Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={valorVenta}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setValorVenta(val);
                                            // Auto-calcular según tipo de pago
                                            if (tipoPago === 'contado') {
                                              setMontoPagado(val);
                                              setMontoPendiente('0');
                                            } else if (tipoPago === 'credito') {
                                              setMontoPagado('0');
                                              setMontoPendiente(val);
                                            }
                                          }}
                                          placeholder="0.00"
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label>Tipo de Pago *</Label>
                                        <Select 
                                          value={tipoPago} 
                                          onValueChange={(value: any) => {
                                            setTipoPago(value);
                                            const venta = parseFloat(valorVenta) || 0;
                                            if (value === 'contado') {
                                              setMontoPagado(valorVenta);
                                              setMontoPendiente('0');
                                            } else if (value === 'credito') {
                                              setMontoPagado('0');
                                              setMontoPendiente(valorVenta);
                                            } else {
                                              setMontoPagado('');
                                              setMontoPendiente('');
                                            }
                                          }}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="contado">Pago de Contado</SelectItem>
                                            <SelectItem value="credito">Venta a Crédito</SelectItem>
                                            <SelectItem value="parcial">Pago Parcial</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      {(tipoPago === 'contado' || tipoPago === 'parcial') && (
                                        <div className="space-y-2">
                                          <Label>Método de Pago *</Label>
                                          <Select value={metodoPago} onValueChange={(value: any) => setMetodoPago(value)}>
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="efectivo">Efectivo</SelectItem>
                                              <SelectItem value="transferencia">Transferencia/Tarjeta</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}

                                      {(tipoPago === 'parcial' || tipoPago === 'contado') && (
                                        <div className="space-y-2">
                                          <Label>Monto Pagado *</Label>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            value={montoPagado}
                                            onChange={(e) => {
                                              setMontoPagado(e.target.value);
                                              if (tipoPago === 'parcial') {
                                                const venta = parseFloat(valorVenta) || 0;
                                                const pagado = parseFloat(e.target.value) || 0;
                                                setMontoPendiente((venta - pagado).toFixed(2));
                                              }
                                            }}
                                            placeholder="0.00"
                                            disabled={tipoPago === 'contado'}
                                          />
                                        </div>
                                      )}

                                      {(tipoPago === 'parcial' || tipoPago === 'credito') && (
                                        <>
                                          <div className="space-y-2">
                                            <Label>Monto Pendiente {tipoPago === 'parcial' && '(Calculado)'}</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={montoPendiente}
                                              disabled
                                              placeholder="0.00"
                                            />
                                          </div>

                                          <div className="space-y-2">
                                            <Label>Fecha de Vencimiento *</Label>
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <Button
                                                  variant="outline"
                                                  className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !fechaVencimiento && "text-muted-foreground"
                                                  )}
                                                >
                                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                                  {fechaVencimiento ? format(fechaVencimiento, "dd/MM/yyyy") : <span>Selecciona fecha</span>}
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                  mode="single"
                                                  selected={fechaVencimiento}
                                                  onSelect={(date) => setFechaVencimiento(date)}
                                                  initialFocus
                                                />
                                              </PopoverContent>
                                            </Popover>
                                          </div>
                                        </>
                                      )}

                                      <div className="space-y-3">
                                        <Label>Datos del Comprador (Opcional)</Label>
                                        <RadioGroup value={tipoComprador} onValueChange={(value: any) => {
                                          setTipoComprador(value);
                                          if (value === 'recurrente') {
                                            setClienteSeleccionado('');
                                            setCompradorNombre('');
                                            setCompradorRfc('');
                                            setCompradorTelefono('');
                                            setCompradorEmail('');
                                          }
                                        }}>
                                          <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="nuevo" id="nuevo" />
                                            <Label htmlFor="nuevo" className="font-normal cursor-pointer">
                                              Cliente Nuevo
                                            </Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="recurrente" id="recurrente" />
                                            <Label htmlFor="recurrente" className="font-normal cursor-pointer">
                                              Cliente Recurrente
                                            </Label>
                                          </div>
                                        </RadioGroup>
                                      </div>

                                      {tipoComprador === 'recurrente' ? (
                                        <div className="space-y-2">
                                          <Label>Seleccionar Cliente</Label>
                                          <Select 
                                            value={clienteSeleccionado} 
                                            onValueChange={(value) => {
                                              setClienteSeleccionado(value);
                                              const cliente = clientes?.find(c => c.id === value);
                                              if (cliente) {
                                                setCompradorNombre(cliente.nombre || '');
                                                setCompradorRfc(cliente.rfc || '');
                                                setCompradorTelefono(cliente.telefono || '');
                                                setCompradorEmail(cliente.email || '');
                                              }
                                            }}
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Selecciona un cliente" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {clientes?.map((cliente) => (
                                                <SelectItem key={cliente.id} value={cliente.id}>
                                                  {cliente.nombre} {cliente.rfc ? `- ${cliente.rfc}` : ''}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                              <Label>Nombre</Label>
                                              <Input
                                                value={compradorNombre}
                                                onChange={(e) => setCompradorNombre(e.target.value)}
                                                placeholder="Nombre del comprador"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>RFC</Label>
                                              <Input
                                                value={compradorRfc}
                                                onChange={(e) => setCompradorRfc(e.target.value)}
                                                placeholder="RFC"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Teléfono</Label>
                                              <Input
                                                value={compradorTelefono}
                                                onChange={(e) => setCompradorTelefono(e.target.value)}
                                                placeholder="Teléfono"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Email</Label>
                                              <Input
                                                type="email"
                                                value={compradorEmail}
                                                onChange={(e) => setCompradorEmail(e.target.value)}
                                                placeholder="email@ejemplo.com"
                                              />
                                            </div>
                                          </div>
                                          
                                          {compradorNombre && (
                                            <div className="flex items-center space-x-2">
                                              <Checkbox 
                                                id="guardarCliente" 
                                                checked={guardarComoCliente}
                                                onCheckedChange={(checked) => setGuardarComoCliente(checked as boolean)}
                                              />
                                              <Label 
                                                htmlFor="guardarCliente" 
                                                className="text-sm font-normal cursor-pointer"
                                              >
                                                Guardar como cliente recurrente
                                              </Label>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </>
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
        </TabsContent>

        <TabsContent value="historial">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Bajas</CardTitle>
              <CardDescription>
                Consulta el historial completo de activos dados de baja o vendidos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Baja</TableHead>
                    <TableHead>Valor Original</TableHead>
                    <TableHead>Valor en Libros</TableHead>
                    <TableHead>Valor Venta</TableHead>
                    <TableHead>Método Pago</TableHead>
                    <TableHead>Tipo Pago</TableHead>
                    <TableHead>Monto Pagado/Pendiente</TableHead>
                    <TableHead>Ganancia/Pérdida</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inversionesBaja.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-muted-foreground">
                        No hay activos dados de baja en el historial
                      </TableCell>
                    </TableRow>
                  ) : (
                    inversionesBaja
                      .sort((a, b) => {
                        const fechaA = a.fecha_baja ? new Date(a.fecha_baja).getTime() : 0;
                        const fechaB = b.fecha_baja ? new Date(b.fecha_baja).getTime() : 0;
                        return fechaB - fechaA;
                      })
                      .map((inversion) => {
                        const fechaBaja = inversion.fecha_baja ? new Date(inversion.fecha_baja) : new Date();
                        const valorLibros = calcularValorLibros(inversion, fechaBaja);
                        const gananciaPerdida = calcularGananciaPerdida(inversion);
                        
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
                              <div className="flex items-center gap-2">
                                <Badge variant={inversion.estado === 'vendido' ? 'default' : 'secondary'}>
                                  {inversion.estado === 'vendido' ? 'Vendido' : 'Dado de Baja'}
                                </Badge>
                                {new Date(inversion.updated_at) > new Date(inversion.fecha_baja || inversion.created_at) && (
                                  <Badge variant="outline" className="text-xs">
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Reactivado
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {inversion.fecha_baja 
                                ? format(new Date(inversion.fecha_baja), "dd/MM/yyyy")
                                : '-'}
                            </TableCell>
                            <TableCell>
                              ${Number(inversion.valor_total).toLocaleString("es-MX", {
                                minimumFractionDigits: 2,
                              })}
                            </TableCell>
                            <TableCell>
                              ${valorLibros.toLocaleString("es-MX", {
                                minimumFractionDigits: 2,
                              })}
                            </TableCell>
                            <TableCell>
                              {inversion.valor_venta 
                                ? `$${Number(inversion.valor_venta).toLocaleString("es-MX", {
                                    minimumFractionDigits: 2,
                                  })}`
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {inversion.metodo_pago_venta ? (
                                <Badge variant="outline">
                                  {inversion.metodo_pago_venta === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {inversion.tipo_pago_venta ? (
                                <Badge variant="secondary">
                                  {inversion.tipo_pago_venta === 'contado' ? 'Contado' : 
                                   inversion.tipo_pago_venta === 'credito' ? 'Crédito' : 'Parcial'}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {inversion.monto_pagado_venta !== undefined || inversion.monto_pendiente_venta !== undefined ? (
                                <div className="text-sm">
                                  <div className="text-green-600">
                                    Pagado: ${(inversion.monto_pagado_venta || 0).toLocaleString("es-MX", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </div>
                                  {(inversion.monto_pendiente_venta || 0) > 0 && (
                                    <div className="text-orange-600">
                                      Pendiente: ${inversion.monto_pendiente_venta.toLocaleString("es-MX", {
                                        minimumFractionDigits: 2,
                                      })}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {gananciaPerdida !== null ? (
                                <span className={gananciaPerdida >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  ${Math.abs(gananciaPerdida).toLocaleString("es-MX", {
                                    minimumFractionDigits: 2,
                                  })}
                                  {gananciaPerdida >= 0 ? ' ↑' : ' ↓'}
                                </span>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {inversion.comprador_nombre ? (
                                <div className="text-sm">
                                  <div className="font-medium">{inversion.comprador_nombre}</div>
                                  {inversion.comprador_telefono && (
                                    <div className="text-muted-foreground">{inversion.comprador_telefono}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {inversion.motivo_baja || '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedAsientoInversion(inversion);
                                  setAsientoDialogOpen(true);
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Ver Asiento
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para ver asiento contable */}
      <Dialog open={asientoDialogOpen} onOpenChange={setAsientoDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de Asientos Contables de Baja</DialogTitle>
          </DialogHeader>
          {asientoData && asientoData.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {asientoData.length} {asientoData.length === 1 ? 'asiento' : 'asientos'}
                </Badge>
              </div>
              
              <Accordion type="single" collapsible defaultValue="item-0" className="space-y-2">
                {asientoData.map((asiento, index) => (
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
                              <TableHead>Descripción</TableHead>
                              <TableHead className="text-right">Debe</TableHead>
                              <TableHead className="text-right">Haber</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {asiento.detalle_asientos.map((detalle: any) => (
                              <TableRow key={detalle.id}>
                                <TableCell className="font-mono text-sm">
                                  {detalle.cuenta_codigo}
                                  <br />
                                  <span className="text-xs text-muted-foreground">
                                    {detalle.cuenta?.nombre}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm">{detalle.descripcion}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {detalle.debe > 0 
                                    ? `$${Number(detalle.debe).toLocaleString("es-MX", {
                                        minimumFractionDigits: 2,
                                      })}`
                                    : '-'}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {detalle.haber > 0 
                                    ? `$${Number(detalle.haber).toLocaleString("es-MX", {
                                        minimumFractionDigits: 2,
                                      })}`
                                    : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-semibold bg-muted/50">
                              <TableCell colSpan={2}>Total</TableCell>
                              <TableCell className="text-right">
                                ${asiento.detalle_asientos
                                  .reduce((sum: number, d: any) => sum + Number(d.debe), 0)
                                  .toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right">
                                ${asiento.detalle_asientos
                                  .reduce((sum: number, d: any) => sum + Number(d.haber), 0)
                                  .toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <p>No se encontró el asiento contable para esta baja.</p>
              <p className="text-sm mt-2">Es posible que aún no se haya generado.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsientoDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BajaActivos;
