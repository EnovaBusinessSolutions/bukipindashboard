import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInversiones } from "@/hooks/useInversiones";
import { useProveedores } from "@/hooks/useProveedores";
import { useTarjetasCredito, validarLimiteCredito } from "@/hooks/useTarjetasCredito";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { actualizarSaldoTarjetaCredito, extraerIdTarjetaCredito } from "@/lib/tarjetaCreditoUtils";
import { useSaldosDisponibles } from "@/hooks/useSaldosDisponibles";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { CalendarIcon, Upload } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PreviewCuentasContables from "./PreviewCuentasContables";

const RegistroInversionForm = () => {
  const { crearInversion, recomendaciones } = useInversiones();
  const { proveedores } = useProveedores();
  const { data: tarjetasCredito } = useTarjetasCredito();
  const { data: saldosDisponibles } = useSaldosDisponibles();
  const [fecha, setFecha] = useState<Date>(new Date());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<any>(null);
  const [categoriaActivo, setCategoriaActivo] = useState<string>("");
  const [anosDepreciacion, setAnosDepreciacion] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagenUrl, setImagenUrl] = useState<string>("");
  const [valorTotalDisplay, setValorTotalDisplay] = useState<string>("");
  const [montoPagadoDisplay, setMontoPagadoDisplay] = useState<string>("");
  const [tipoProveedor, setTipoProveedor] = useState<string>("");
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>("");

  const [fechaVencimiento, setFechaVencimiento] = useState<Date | undefined>();
  const [formData, setFormData] = useState({
    producto_nombre: "",
    descripcion: "",
    valor_total: "",
    monto_pagado: "",
    tipo_pago: "",
    metodo_pago: "",
    proveedor_nombre: "",
    proveedor_email: "",
    proveedor_telefono: "",
    proveedor_rfc: "",
    cuenta_codigo: "",
    comentarios: "",
  });

  const recomendacion = recomendaciones.find(
    (r) => r.categoria_activo === categoriaActivo
  );

  // Función para formatear números con separador de miles
  const formatNumber = (value: string) => {
    if (!value) return "";
    const num = parseFloat(value.replace(/,/g, ''));
    if (isNaN(num)) return "";
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleCategoriaChange = (value: string) => {
    setCategoriaActivo(value);
    const rec = recomendaciones.find((r) => r.categoria_activo === value);
    if (rec) {
      setAnosDepreciacion(rec.anos_recomendados);
    }
    
    // Mapear categoría a código de cuenta contable
    const cuentaMap: { [key: string]: string } = {
      'equipo_computo': '1206',
      'maquinaria': '1203',
      'vehiculos': '1205',
      'mobiliario': '1204',
      'edificios': '1202',
      'equipo_oficina': '1204',
      'otro': '1212'
    };
    
    setFormData({ 
      ...formData, 
      cuenta_codigo: cuentaMap[value] || '1212' 
    });
  };

  const handleValorTotalChange = (value: string) => {
    // Permitir solo números y punto decimal
    const cleanValue = value.replace(/[^\d.]/g, '');
    setValorTotalDisplay(cleanValue);
    setFormData({ ...formData, valor_total: cleanValue });
  };

  const handleValorTotalBlur = () => {
    if (formData.valor_total) {
      setValorTotalDisplay(formatNumber(formData.valor_total));
    }
  };

  const handleValorTotalFocus = () => {
    setValorTotalDisplay(formData.valor_total);
  };

  const handleMontoPagadoChange = (value: string) => {
    // Permitir solo números y punto decimal
    const cleanValue = value.replace(/[^\d.]/g, '');
    setMontoPagadoDisplay(cleanValue);
    setFormData({ ...formData, monto_pagado: cleanValue });
  };

  const handleMontoPagadoBlur = () => {
    if (formData.monto_pagado) {
      setMontoPagadoDisplay(formatNumber(formData.monto_pagado));
    }
  };

  const handleMontoPagadoFocus = () => {
    setMontoPagadoDisplay(formData.monto_pagado);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      setImagenUrl(data.publicUrl);
      toast({
        title: "Imagen cargada",
        description: "La imagen se ha cargado correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo cargar la imagen",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const calcularMontoPendiente = () => {
    const valorTotal = parseFloat(formData.valor_total) || 0;
    const montoPagado = parseFloat(formData.monto_pagado) || 0;
    return valorTotal - montoPagado;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que se haya seleccionado cuenta contable
    if (!formData.cuenta_codigo) {
      toast({
        title: "Error de validación",
        description: "No se pudo determinar la cuenta contable. Por favor selecciona nuevamente la categoría.",
        variant: "destructive"
      });
      return;
    }

    const valorTotal = parseFloat(formData.valor_total);
    const montoPagado = formData.tipo_pago === "total"
      ? valorTotal 
      : formData.tipo_pago === "credito" 
        ? 0 
        : parseFloat(formData.monto_pagado);

    // FASE 1: Verificar que los saldos se hayan cargado
    if (montoPagado > 0 && (formData.metodo_pago === "efectivo" || formData.metodo_pago === "transferencia")) {
      if (!saldosDisponibles) {
        toast({
          title: "⚠️ Error de validación",
          description: "No se pudieron cargar los saldos disponibles. Intenta nuevamente.",
          variant: "destructive"
        });
        return;
      }
    }

    // FASE 2: Validar saldo disponible para efectivo o bancos
    if (formData.metodo_pago === "efectivo") {
      if (montoPagado > saldosDisponibles.efectivo) {
        toast({
          title: "💰 Saldo insuficiente en efectivo",
          description: `Disponible: $${formatCurrency(saldosDisponibles.efectivo)} | Necesitas: $${formatCurrency(montoPagado)}`,
          variant: "destructive"
        });
        return;
      }
    }

    if (formData.metodo_pago === "transferencia") {
      if (montoPagado > saldosDisponibles.bancos) {
        toast({
          title: "🏦 Saldo insuficiente en bancos",
          description: `Disponible: $${formatCurrency(saldosDisponibles.bancos)} | Necesitas: $${formatCurrency(montoPagado)}`,
          variant: "destructive"
        });
        return;
      }
    }

    // Validar límite de crédito si se seleccionó tarjeta de crédito
    if (formData.metodo_pago?.startsWith("tarjeta_credito_") && tarjetasCredito) {
      const tarjetaId = formData.metodo_pago.replace("tarjeta_credito_", "");
      const validacion = validarLimiteCredito(tarjetaId, montoPagado, tarjetasCredito);
      
      if (!validacion.valido) {
        toast({
          title: "⚠️ Límite de crédito excedido",
          description: validacion.mensaje,
          variant: "destructive"
        });
        return;
      }

      setPendingSubmit({ formData, montoPagado, valorTotal });
      setShowConfirmDialog(true);
      return;
    }
    
    const valorDepreciacionAnual = valorTotal / (anosDepreciacion || 1);
    const valorDepreciacionMensual = valorDepreciacionAnual / 12;

    crearInversion.mutate({
      ...formData,
      categoria_activo: categoriaActivo,
      anos_depreciacion: anosDepreciacion || 0,
      valor_total: valorTotal,
      monto_pagado: montoPagado,
      monto_pendiente: valorTotal - montoPagado,
      valor_depreciacion_anual: valorDepreciacionAnual,
      valor_depreciacion_mensual: valorDepreciacionMensual,
      fecha_adquisicion: format(fecha, "yyyy-MM-dd"),
      fecha_inicio_depreciacion: format(fecha, "yyyy-MM-dd"),
      fecha_vencimiento: fechaVencimiento ? format(fechaVencimiento, "yyyy-MM-dd") : null,
      imagen_url: imagenUrl,
    } as any, {
      onSuccess: async () => {
        // Actualizar saldo de tarjeta de crédito si se usó
        const tarjetaId = extraerIdTarjetaCredito(formData.metodo_pago);
        if (tarjetaId && montoPagado > 0) {
          await actualizarSaldoTarjetaCredito(
            tarjetaId, 
            montoPagado,
            `Pago de inversión: ${formData.producto_nombre}`
          );
        }
      },
      onError: (error: any) => {
        console.error("Error al registrar inversión:", error);
        
        let errorMessage = "Error al registrar la inversión";
        
        // Intentar extraer el mensaje de error específico
        if (error?.message) {
          if (error.message.includes("Para pago total")) {
            errorMessage = error.message;
          } else if (error.message.includes("asiento")) {
            errorMessage = "Error al generar el asiento contable: " + error.message;
          } else {
            errorMessage = error.message;
          }
        }
        
        toast({
          title: "❌ Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    });

    // Reset form
    setFormData({
      producto_nombre: "",
      descripcion: "",
      valor_total: "",
      monto_pagado: "",
      tipo_pago: "",
      metodo_pago: "",
      proveedor_nombre: "",
      proveedor_email: "",
      proveedor_telefono: "",
      proveedor_rfc: "",
      cuenta_codigo: "",
      comentarios: "",
    });
    setCategoriaActivo("");
    setAnosDepreciacion(null);
    setImagenUrl("");
    setFechaVencimiento(undefined);
    setValorTotalDisplay("");
    setMontoPagadoDisplay("");
    setTipoProveedor("");
    setProveedorSeleccionado("");
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

  const valorTotalNum = parseFloat(formData.valor_total) || 0;
  const montoPagadoNum = formData.tipo_pago === "total" 
    ? valorTotalNum 
    : formData.tipo_pago === "credito" 
      ? 0 
      : parseFloat(formData.monto_pagado) || 0;
  const montoPendienteNum = valorTotalNum - montoPagadoNum;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Formulario - 2/3 del ancho */}
      <Card className="lg:col-span-2 border-0 shadow-none">
        <CardHeader>
          <CardTitle>Registro de Inversión CAPEX</CardTitle>
          <CardDescription>
            Registra un nuevo activo fijo y configura su depreciación
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selección de Categoría del Activo */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Categoría del Activo</h3>
            
            <div className="space-y-2">
              <Label>¿Qué tipo de activo fijo vas a registrar? *</Label>
              <Select value={categoriaActivo} onValueChange={handleCategoriaChange} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la categoría del activo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equipo_computo">Equipo de Cómputo</SelectItem>
                  <SelectItem value="maquinaria">Maquinaria</SelectItem>
                  <SelectItem value="vehiculos">Vehículos</SelectItem>
                  <SelectItem value="mobiliario">Mobiliario</SelectItem>
                  <SelectItem value="edificios">Edificios</SelectItem>
                  <SelectItem value="equipo_oficina">Equipo de Oficina</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {categoriaActivo && (
            <>
              <Separator />
              
              {/* Información del Activo */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Información del Activo</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="producto_nombre">Nombre del Activo *</Label>
                    <Input
                      id="producto_nombre"
                      value={formData.producto_nombre}
                      onChange={(e) =>
                        setFormData({ ...formData, producto_nombre: e.target.value })
                      }
                      placeholder="Ej: Computadora Dell XPS 15"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valor_total">Valor Total del Activo *</Label>
                    <Input
                      id="valor_total"
                      type="text"
                      value={valorTotalDisplay || formData.valor_total}
                      onChange={(e) => handleValorTotalChange(e.target.value)}
                      onBlur={handleValorTotalBlur}
                      onFocus={handleValorTotalFocus}
                      placeholder="Ej: 25000.00"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anos_depreciacion">Años de Depreciación *</Label>
                    <Input
                      id="anos_depreciacion"
                      type="number"
                      value={anosDepreciacion || ""}
                      disabled
                      className="bg-muted"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Establecido automáticamente según la categoría del activo
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fecha_adquisicion">Fecha de Adquisición *</Label>
                    <Input
                      id="fecha_adquisicion"
                      type="text"
                      value={format(fecha, "PPP")}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Se registrará automáticamente con la fecha de hoy
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción del Activo</Label>
                  <Textarea
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) =>
                      setFormData({ ...formData, descripcion: e.target.value })
                    }
                    placeholder="Descripción detallada del activo"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imagen">Fotografía del Activo</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="imagen"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                    {imagenUrl && (
                      <img src={imagenUrl} alt="Preview" className="h-20 w-20 object-cover rounded" />
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Información de Pago */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Información de Pago</h3>
                
                <div className="space-y-2">
                  <Label>¿Cómo se pagó el activo? *</Label>
                  <Select
                    value={formData.tipo_pago}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tipo_pago: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Pago Total</SelectItem>
                      <SelectItem value="parcial">Pago Parcial</SelectItem>
                      <SelectItem value="credito">Crédito Total</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.tipo_pago === "total" && (
                  <div className="space-y-2">
                    <Label htmlFor="metodo_pago">Método de Pago *</Label>
                    <Select
                      value={formData.metodo_pago}
                      onValueChange={(value) =>
                        setFormData({ ...formData, metodo_pago: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar método" />
                      </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="efectivo">
                              Efectivo - Disponible: ${saldosDisponibles?.efectivo.toFixed(2) || "0.00"}
                            </SelectItem>
                            <SelectItem value="transferencia">
                              Bancos - Disponible: ${saldosDisponibles?.bancos.toFixed(2) || "0.00"}
                            </SelectItem>
                            {tarjetasCredito && tarjetasCredito.length > 0 ? (
                              tarjetasCredito.map((tarjeta) => (
                                <SelectItem key={tarjeta.id} value={`tarjeta_credito_${tarjeta.id}`}>
                                  {tarjeta.nombre} - Disponible: ${tarjeta.limite_disponible.toFixed(2)}
                                </SelectItem>
                              ))
                            ) : null}
                          </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.tipo_pago === "parcial" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="monto_pagado">Monto Pagado *</Label>
                        <Input
                          id="monto_pagado"
                          type="text"
                          value={montoPagadoDisplay || formData.monto_pagado}
                          onChange={(e) => handleMontoPagadoChange(e.target.value)}
                          onBlur={handleMontoPagadoBlur}
                          onFocus={handleMontoPagadoFocus}
                          placeholder="Ej: 10000.00"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="metodo_pago">Método de Pago *</Label>
                        <Select
                          value={formData.metodo_pago}
                          onValueChange={(value) =>
                            setFormData({ ...formData, metodo_pago: value })
                          }
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar método" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="efectivo">
                              Efectivo - Disponible: ${saldosDisponibles?.efectivo.toFixed(2) || "0.00"}
                            </SelectItem>
                            <SelectItem value="transferencia">
                              Bancos - Disponible: ${saldosDisponibles?.bancos.toFixed(2) || "0.00"}
                            </SelectItem>
                            {tarjetasCredito && tarjetasCredito.length > 0 ? (
                              tarjetasCredito.map((tarjeta) => (
                                <SelectItem key={tarjeta.id} value={`tarjeta_credito_${tarjeta.id}`}>
                                  {tarjeta.nombre} - Disponible: ${tarjeta.limite_disponible.toFixed(2)}
                                </SelectItem>
                              ))
                            ) : null}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {formData.monto_pagado && formData.valor_total && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm font-medium">
                          Monto Pendiente: ${formatNumber(calcularMontoPendiente().toString())}
                        </p>
                      </div>
                    )}

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
                            {fechaVencimiento ? format(fechaVencimiento, "PPP") : <span>Selecciona fecha</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={fechaVencimiento}
                            onSelect={setFechaVencimiento}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}

                {formData.tipo_pago === "credito" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        Monto Total a Crédito: ${formData.valor_total ? formatNumber(formData.valor_total) : '0.00'}
                      </p>
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
                            {fechaVencimiento ? format(fechaVencimiento, "PPP") : <span>Selecciona fecha</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={fechaVencimiento}
                            onSelect={setFechaVencimiento}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Información del Proveedor */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Información del Proveedor</h3>
                
                {/* Selección de tipo de proveedor */}
                <div className="space-y-2">
                  <Label>Tipo de Proveedor</Label>
                  <RadioGroup value={tipoProveedor} onValueChange={(val) => {
                    setTipoProveedor(val);
                    if (val === "nuevo") {
                      setProveedorSeleccionado("");
                      setFormData({
                        ...formData,
                        proveedor_nombre: "",
                        proveedor_telefono: "",
                        proveedor_email: "",
                        proveedor_rfc: ""
                      });
                    } else if (val === "existente") {
                      setFormData({
                        ...formData,
                        proveedor_nombre: "",
                        proveedor_telefono: "",
                        proveedor_email: "",
                        proveedor_rfc: ""
                      });
                    }
                  }}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nuevo" id="proveedor-nuevo-inv" />
                      <Label htmlFor="proveedor-nuevo-inv">Nuevo Proveedor</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="existente" id="proveedor-existente-inv" />
                      <Label htmlFor="proveedor-existente-inv">Proveedor Existente</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Seleccionar proveedor existente */}
                {tipoProveedor === "existente" && (
                  <div className="space-y-2">
                    <Label htmlFor="proveedor-select-inv">Seleccionar Proveedor *</Label>
                    <Select value={proveedorSeleccionado} onValueChange={(val) => {
                      setProveedorSeleccionado(val);
                      const proveedor = proveedores.find(p => p.id === val);
                      if (proveedor) {
                        setFormData({
                          ...formData,
                          proveedor_nombre: proveedor.nombre,
                          proveedor_telefono: proveedor.telefono || "",
                          proveedor_email: proveedor.email || "",
                          proveedor_rfc: proveedor.rfc || ""
                        });
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar proveedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {proveedores && proveedores.length > 0 ? (
                          proveedores.map(proveedor => (
                            <SelectItem key={proveedor.id} value={proveedor.id}>
                              {proveedor.nombre}
                              {proveedor.rfc && ` - ${proveedor.rfc}`}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-proveedores" disabled>
                            No hay proveedores registrados
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Mostrar datos del proveedor seleccionado (read-only) */}
                {tipoProveedor === "existente" && proveedorSeleccionado && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nombre</Label>
                      <p className="text-sm font-medium">{formData.proveedor_nombre}</p>
                    </div>
                    {formData.proveedor_telefono && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Teléfono</Label>
                        <p className="text-sm font-medium">{formData.proveedor_telefono}</p>
                      </div>
                    )}
                    {formData.proveedor_email && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Email</Label>
                        <p className="text-sm font-medium">{formData.proveedor_email}</p>
                      </div>
                    )}
                    {formData.proveedor_rfc && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">RFC</Label>
                        <p className="text-sm font-medium">{formData.proveedor_rfc}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Formulario para nuevo proveedor */}
                {tipoProveedor === "nuevo" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="proveedor_nombre">Nombre del Proveedor</Label>
                      <Input
                        id="proveedor_nombre"
                        value={formData.proveedor_nombre}
                        onChange={(e) =>
                          setFormData({ ...formData, proveedor_nombre: e.target.value })
                        }
                        placeholder="Nombre del proveedor"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proveedor_telefono">Teléfono</Label>
                      <Input
                        id="proveedor_telefono"
                        value={formData.proveedor_telefono}
                        onChange={(e) =>
                          setFormData({ ...formData, proveedor_telefono: e.target.value })
                        }
                        placeholder="Teléfono de contacto"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proveedor_email">Email</Label>
                      <Input
                        id="proveedor_email"
                        type="email"
                        value={formData.proveedor_email}
                        onChange={(e) =>
                          setFormData({ ...formData, proveedor_email: e.target.value })
                        }
                        placeholder="email@proveedor.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proveedor_rfc">RFC</Label>
                      <Input
                        id="proveedor_rfc"
                        value={formData.proveedor_rfc}
                        onChange={(e) =>
                          setFormData({ ...formData, proveedor_rfc: e.target.value })
                        }
                        placeholder="RFC del proveedor"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Comentarios Adicionales */}
              <div className="space-y-2">
                <Label htmlFor="comentarios">Comentarios Adicionales</Label>
                <Textarea
                  id="comentarios"
                  value={formData.comentarios}
                  onChange={(e) =>
                    setFormData({ ...formData, comentarios: e.target.value })
                  }
                  placeholder="Notas o comentarios adicionales sobre la inversión"
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full" disabled={crearInversion.isPending}>
                {crearInversion.isPending ? "Registrando..." : "Registrar Inversión"}
              </Button>
            </>
          )}
          </form>
        </CardContent>
      </Card>

      {/* Preview y Recomendaciones - 1/3 del ancho */}
      <div className="space-y-6">
        {/* Preview de Cuentas Contables */}
        {categoriaActivo && formData.valor_total && formData.tipo_pago && (
          <PreviewCuentasContables
            categoriaActivo={categoriaActivo}
            valorTotal={valorTotalNum}
            tipoPago={formData.tipo_pago}
            metodoPago={formData.metodo_pago}
            montoPagado={montoPagadoNum}
            montoPendiente={montoPendienteNum}
            anosDepreciacion={anosDepreciacion}
            fechaAdquisicion={fecha}
          />
        )}

        {/* Recomendaciones */}
        <Card className="border-0 shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Recomendaciones de Depreciación</CardTitle>
            <CardDescription className="text-xs">
              Años recomendados según normativas fiscales mexicanas
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <div className="overflow-auto max-h-[calc(100vh-40rem)]">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Categoría</TableHead>
                  <TableHead className="text-xs text-center">Años</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recomendaciones.map((rec) => (
                  <TableRow key={rec.id} className={rec.categoria_activo === categoriaActivo ? "bg-muted" : ""}>
                    <TableCell className="text-xs font-medium py-2">
                      {getCategoriaLabel(rec.categoria_activo)}
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                        {rec.anos_recomendados}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {categoriaActivo && recomendacion && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs font-semibold mb-1">
                {getCategoriaLabel(categoriaActivo)}
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Rango: {recomendacion.anos_minimos} - {recomendacion.anos_maximos} años
              </p>
              {recomendacion.descripcion && (
                <p className="text-xs text-muted-foreground">
                  {recomendacion.descripcion}
                </p>
              )}
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pago con tarjeta de crédito</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSubmit?.formData?.metodo_pago?.startsWith("tarjeta_credito_") && tarjetasCredito && (() => {
                const tarjetaId = pendingSubmit.formData.metodo_pago.replace("tarjeta_credito_", "");
                const tarjeta = tarjetasCredito.find(t => t.id === tarjetaId);
                return tarjeta ? (
                  <>
                    <div className="space-y-2 my-4">
                      <p><strong>Tarjeta:</strong> {tarjeta.nombre}</p>
                      <p><strong>Límite disponible actual:</strong> ${tarjeta.limite_disponible.toFixed(2)}</p>
                      <p><strong>Monto del cargo:</strong> ${pendingSubmit?.montoPagado?.toFixed(2)}</p>
                      <p><strong>Límite disponible después:</strong> ${(tarjeta.limite_disponible - (pendingSubmit?.montoPagado || 0)).toFixed(2)}</p>
                    </div>
                    <p>¿Deseas continuar con este pago?</p>
                  </>
                ) : null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowConfirmDialog(false);
              setPendingSubmit(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (pendingSubmit) {
                const { formData, montoPagado, valorTotal } = pendingSubmit;
                const valorDepreciacionAnual = valorTotal / (anosDepreciacion || 1);
                const valorDepreciacionMensual = valorDepreciacionAnual / 12;

                crearInversion.mutate({
                  ...formData,
                  categoria_activo: categoriaActivo,
                  anos_depreciacion: anosDepreciacion || 0,
                  valor_total: valorTotal,
                  monto_pagado: montoPagado,
                  monto_pendiente: valorTotal - montoPagado,
                  valor_depreciacion_anual: valorDepreciacionAnual,
                  valor_depreciacion_mensual: valorDepreciacionMensual,
                  fecha_adquisicion: format(fecha, "yyyy-MM-dd"),
                  fecha_inicio_depreciacion: format(fecha, "yyyy-MM-dd"),
                  fecha_vencimiento: fechaVencimiento ? format(fechaVencimiento, "yyyy-MM-dd") : null,
                  imagen_url: imagenUrl,
                } as any, {
                  onSuccess: async () => {
                    const tarjetaId = extraerIdTarjetaCredito(formData.metodo_pago);
                    if (tarjetaId && montoPagado > 0) {
                      await actualizarSaldoTarjetaCredito(
                        tarjetaId, 
                        montoPagado,
                        `Pago de inversión: ${formData.producto_nombre}`
                      );
                    }
                    
                    setFormData({
                      producto_nombre: "",
                      descripcion: "",
                      valor_total: "",
                      monto_pagado: "",
                      tipo_pago: "",
                      metodo_pago: "",
                      proveedor_nombre: "",
                      proveedor_email: "",
                      proveedor_telefono: "",
                      proveedor_rfc: "",
                      cuenta_codigo: "",
                      comentarios: "",
                    });
                    setCategoriaActivo("");
                    setAnosDepreciacion(null);
                    setImagenUrl("");
                    setFechaVencimiento(undefined);
                    setValorTotalDisplay("");
                    setMontoPagadoDisplay("");
                    setShowConfirmDialog(false);
                    setPendingSubmit(null);
                  }
                });
              }
            }}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RegistroInversionForm;
