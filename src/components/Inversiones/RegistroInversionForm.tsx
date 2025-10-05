import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInversiones } from "@/hooks/useInversiones";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { CalendarIcon, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const RegistroInversionForm = () => {
  const { crearInversion, recomendaciones } = useInversiones();
  const [fecha, setFecha] = useState<Date>(new Date());
  const [categoriaActivo, setCategoriaActivo] = useState<string>("");
  const [anosDepreciacion, setAnosDepreciacion] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagenUrl, setImagenUrl] = useState<string>("");

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
  };

  const handleValorTotalChange = (value: string) => {
    // Permitir solo números y punto decimal
    const cleanValue = value.replace(/[^\d.]/g, '');
    setFormData({ ...formData, valor_total: cleanValue });
  };

  const handleMontoPagadoChange = (value: string) => {
    // Permitir solo números y punto decimal
    const cleanValue = value.replace(/[^\d.]/g, '');
    setFormData({ ...formData, monto_pagado: cleanValue });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const valorTotal = parseFloat(formData.valor_total);
    const montoPagado = formData.tipo_pago === "total" 
      ? valorTotal 
      : formData.tipo_pago === "credito" 
        ? 0 
        : parseFloat(formData.monto_pagado);
    
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
  };

  return (
    <Card className="max-w-5xl mx-auto border-0 shadow-none">
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
                      value={formData.valor_total ? formatNumber(formData.valor_total) : ''}
                      onChange={(e) => handleValorTotalChange(e.target.value)}
                      placeholder="Ej: 25,000.00"
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
                        <SelectItem value="efectivo">Efectivo (Caja - 1001)</SelectItem>
                        <SelectItem value="transferencia">Tarjeta/Transferencia (Bancos - 1002)</SelectItem>
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
                          value={formData.monto_pagado ? formatNumber(formData.monto_pagado) : ''}
                          onChange={(e) => handleMontoPagadoChange(e.target.value)}
                          placeholder="Cantidad pagada hasta ahora"
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
                            <SelectItem value="efectivo">Efectivo (Caja - 1001)</SelectItem>
                            <SelectItem value="transferencia">Tarjeta/Transferencia (Bancos - 1002)</SelectItem>
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
  );
};

export default RegistroInversionForm;
