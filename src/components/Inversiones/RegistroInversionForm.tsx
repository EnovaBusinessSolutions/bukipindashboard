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

  const handleCategoriaChange = (value: string) => {
    setCategoriaActivo(value);
    const rec = recomendaciones.find((r) => r.categoria_activo === value);
    if (rec) {
      setAnosDepreciacion(rec.anos_recomendados);
    }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const valorTotal = parseFloat(formData.valor_total);
    const montoPagado = parseFloat(formData.monto_pagado);
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
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Inversión CAPEX</CardTitle>
        <CardDescription>
          Registra un nuevo activo fijo y configura su depreciación
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="producto_nombre">Nombre del Activo *</Label>
              <Input
                id="producto_nombre"
                value={formData.producto_nombre}
                onChange={(e) =>
                  setFormData({ ...formData, producto_nombre: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria_activo">Categoría del Activo *</Label>
              <Select value={categoriaActivo} onValueChange={handleCategoriaChange} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría" />
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

            <div className="space-y-2">
              <Label htmlFor="valor_total">Valor Total *</Label>
              <Input
                id="valor_total"
                type="number"
                step="0.01"
                value={formData.valor_total}
                onChange={(e) =>
                  setFormData({ ...formData, valor_total: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto_pagado">Monto Pagado *</Label>
              <Input
                id="monto_pagado"
                type="number"
                step="0.01"
                value={formData.monto_pagado}
                onChange={(e) =>
                  setFormData({ ...formData, monto_pagado: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo_pago">Estado de Pago *</Label>
              <Select
                value={formData.tipo_pago}
                onValueChange={(value) =>
                  setFormData({ ...formData, tipo_pago: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Pago Total</SelectItem>
                  <SelectItem value="parcial">Pago Parcial</SelectItem>
                  <SelectItem value="credito">Crédito Total</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metodo_pago">Método de Pago</Label>
              <Select
                value={formData.metodo_pago}
                onValueChange={(value) =>
                  setFormData({ ...formData, metodo_pago: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="anos_depreciacion">Años de Depreciación *</Label>
              <Input
                id="anos_depreciacion"
                type="number"
                value={anosDepreciacion || ""}
                onChange={(e) => setAnosDepreciacion(parseInt(e.target.value))}
                required
              />
              {recomendacion && (
                <p className="text-xs text-muted-foreground">
                  Recomendado: {recomendacion.anos_recomendados} años (Rango:{" "}
                  {recomendacion.anos_minimos}-{recomendacion.anos_maximos})
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Fecha de Adquisición *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fecha && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fecha ? format(fecha, "PPP") : <span>Selecciona fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={fecha}
                    onSelect={(date) => date && setFecha(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) =>
                setFormData({ ...formData, descripcion: e.target.value })
              }
              rows={3}
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

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Información del Proveedor</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proveedor_nombre">Nombre del Proveedor</Label>
                <Input
                  id="proveedor_nombre"
                  value={formData.proveedor_nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, proveedor_nombre: e.target.value })
                  }
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
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comentarios">Comentarios</Label>
            <Textarea
              id="comentarios"
              value={formData.comentarios}
              onChange={(e) =>
                setFormData({ ...formData, comentarios: e.target.value })
              }
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={crearInversion.isPending}>
            {crearInversion.isPending ? "Registrando..." : "Registrar Inversión"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistroInversionForm;
