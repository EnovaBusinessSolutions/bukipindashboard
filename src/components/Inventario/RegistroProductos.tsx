import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Image, Trash2, Package, CreditCard, Wallet, FileText, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { useProductos, useCreateProducto } from "@/hooks/useProductos";
import { useSubcuentasInventario } from "@/hooks/useSubcuentas";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ProductoForm = {
  nombre: string;
  descripcion: string;
  precio: number;
  cantidad: number;
  proveedor?: string;
  ubicacion?: string;
  subcuentaId?: string;
  metodoPago: string;
  tipoPago: string;
  montoPagado: number;
  montoPendiente?: number;
  fechaVencimiento?: string;
};

const RegistroProductos = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const { data: productos, isLoading: loadingProductos } = useProductos();
  const { data: subcuentasInventario } = useSubcuentasInventario();
  const createProducto = useCreateProducto();

  const { register, handleSubmit, reset, setValue, watch } = useForm<ProductoForm>({
    defaultValues: {
      tipoPago: "contado",
      metodoPago: "efectivo"
    }
  });

  const tipoPago = watch("tipoPago");
  const precio = watch("precio") || 0;
  const cantidad = watch("cantidad") || 0;
  const montoPagado = watch("montoPagado") || 0;
  
  const montoTotal = precio * cantidad;
  const montoPendiente = montoTotal - montoPagado;

  // Auto-completar monto pagado según tipo de pago
  React.useEffect(() => {
    if (tipoPago === "contado") {
      setValue("montoPagado", montoTotal);
    } else if (tipoPago === "pendiente") {
      setValue("montoPagado", 0);
    }
    // Para "parcial" no hacemos nada, el usuario debe introducir el monto
  }, [tipoPago, montoTotal, setValue]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const onSubmit = async (data: ProductoForm) => {
    await createProducto.mutateAsync({
      nombre: data.nombre,
      precio: data.precio,
      cantidad: data.cantidad,
      descripcion: data.descripcion,
      subcuentaId: data.subcuentaId,
      imagen: selectedImage || undefined,
    });
    reset();
    clearImage();
  };

  const formatPrice = (precio: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(precio);
  };

  return (
    <div className="space-y-6">
      {/* Formulario de registro de compras */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-600" />
            Registrar Compra de Inventario
          </CardTitle>
          <CardDescription>
            Registra productos comprados para control de inventario. Si el producto ya existe, se actualizará el stock y costo promedio ponderado.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {/* Alerta informativa sobre agrupación de productos */}
            <Alert className="mb-4">
              <Package className="h-4 w-4" />
              <AlertDescription>
                <strong>Control de Inventario Inteligente:</strong> Si el producto ya existe, se actualizará automáticamente 
                la cantidad y se calculará el costo promedio ponderado para un mejor control financiero.
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información del producto */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground border-b pb-2">Información del Producto</h3>
                
                <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Package className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-800 dark:text-blue-200">Control Inteligente de Inventario</p>
                      <p className="text-blue-700 dark:text-blue-300 mt-1">
                        Si el producto ya existe, se actualizará automáticamente el stock y se calculará el costo promedio ponderado para un mejor control de costos.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="nombre">Nombre del Producto *</Label>
                  <Input
                    id="nombre"
                    {...register("nombre", { required: true })}
                    placeholder="Ej: Camiseta para inventario"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="precio">Precio Unitario *</Label>
                    <Input
                      id="precio"
                      type="number"
                      step="0.01"
                      {...register("precio", { required: true, valueAsNumber: true })}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="cantidad">Cantidad *</Label>
                    <Input
                      id="cantidad"
                      type="number"
                      min="1"
                      {...register("cantidad", { required: true, valueAsNumber: true })}
                      placeholder="1"
                    />
                  </div>
                </div>

                {montoTotal > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Monto Total: {formatPrice(montoTotal)}</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="proveedor">Proveedor</Label>
                  <Input
                    id="proveedor"
                    {...register("proveedor")}
                    placeholder="Nombre del proveedor"
                  />
                </div>

                <div>
                  <Label htmlFor="subcuenta">Subcuenta de Inventario (Opcional)</Label>
                  <Select onValueChange={(value) => setValue("subcuentaId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={
                        subcuentasInventario && subcuentasInventario.length > 0 
                          ? "Seleccionar subcuenta de inventario" 
                          : "No hay subcuentas - se asignará a Inventario General"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {subcuentasInventario?.map((subcuenta) => (
                        <SelectItem key={subcuenta.id} value={subcuenta.id}>
                          {subcuenta.nombre} ({subcuenta.nombreCuentaMadre})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se registrará automáticamente en cuentas de Inventario (1005/1006)
                  </p>
                </div>
              </div>

              {/* Información de pago */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground border-b pb-2">Información de Pago</h3>
                
                {/* Método de pago */}
                <div className="space-y-4">
                  <Label className="font-medium">Método de Pago *</Label>
                  <RadioGroup 
                    value={watch("metodoPago")} 
                    onValueChange={(value) => setValue("metodoPago", value)}
                    defaultValue="efectivo"
                  >
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="efectivo" id="efectivo-inv" />
                      <div className="flex items-center space-x-2">
                        <Wallet className="h-4 w-4 text-green-600" />
                        <Label htmlFor="efectivo-inv" className="cursor-pointer">
                          Efectivo <span className="text-sm text-muted-foreground">(se registra en Caja)</span>
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="bancos" id="bancos-inv" />
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4 text-blue-800" />
                        <Label htmlFor="bancos-inv" className="cursor-pointer">
                          Bancos <span className="text-sm text-muted-foreground">(se registra en Bancos)</span>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                {/* Estado del pago */}
                <div className="space-y-4">
                  <Label className="font-medium">Estado del Pago *</Label>
                  <RadioGroup 
                    value={tipoPago} 
                    onValueChange={(value) => setValue("tipoPago", value)}
                    defaultValue="contado"
                  >
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="contado" id="contado-inv" />
                      <Label htmlFor="contado-inv" className="cursor-pointer">Pago de contado</Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="parcial" id="parcial-inv" />
                      <Label htmlFor="parcial-inv" className="cursor-pointer">Pago parcial</Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="pendiente" id="pendiente-inv" />
                      <Label htmlFor="pendiente-inv" className="cursor-pointer">Quedó pendiente</Label>
                    </div>
                  </RadioGroup>

                  <div>
                    <Label htmlFor="montoPagado">Monto Pagado *</Label>
                    <Input
                      id="montoPagado"
                      type="number"
                      step="0.01"
                      {...register("montoPagado", { required: true, valueAsNumber: true })}
                      placeholder="0.00"
                      readOnly={tipoPago === "contado" || tipoPago === "pendiente"}
                      className={tipoPago === "contado" || tipoPago === "pendiente" ? "bg-muted" : ""}
                    />
                    {tipoPago === "contado" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Se completa automáticamente con el monto total
                      </p>
                    )}
                    {tipoPago === "pendiente" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Se establece en 0 automáticamente
                      </p>
                    )}
                    {tipoPago === "parcial" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Introduce el monto pagado parcialmente
                      </p>
                    )}
                  </div>

                  {(tipoPago === "parcial" || tipoPago === "pendiente") && (
                    <div className="space-y-4 ml-6 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Se registrará como cuenta por pagar al proveedor
                        </AlertDescription>
                      </Alert>
                      
                      {montoPendiente > 0 && (
                        <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                          <p className="text-sm font-medium text-yellow-800">
                            Monto Pendiente: {formatPrice(montoPendiente)}
                          </p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="proveedor-nombre">Nombre del proveedor</Label>
                          <Input 
                            id="proveedor-nombre" 
                            {...register("proveedor")}
                            placeholder="Nombre del proveedor" 
                          />
                        </div>
                        <div>
                          <Label htmlFor="fechaVencimiento">Fecha de Vencimiento</Label>
                          <Input
                            id="fechaVencimiento"
                            type="date"
                            {...register("fechaVencimiento")}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <Label htmlFor="ubicacion">Ubicación en Almacén</Label>
                  <Input
                    id="ubicacion"
                    {...register("ubicacion")}
                    placeholder="Ej: Estante A-1, Pasillo 2"
                  />
                </div>
              </div>
            </div>

            {/* Descripción completa */}
            <div className="mt-6">
              <Label htmlFor="descripcion">Descripción del Producto</Label>
              <Textarea
                id="descripcion"
                {...register("descripcion")}
                placeholder="Descripción, características, marca, modelo..."
                className="min-h-16"
              />
            </div>

            {/* Sección de imagen */}
            <div className="mt-6">
              <Label htmlFor="imagen">Imagen del Producto (Opcional)</Label>
              <div className="mt-2">
                {imagePreview ? (
                  <div className="relative w-full max-w-xs">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-md border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={clearImage}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full max-w-xs h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-muted-foreground/50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Image className="h-6 w-6 mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Click para subir</span>
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-6">
              <Button
                type="submit"
                disabled={createProducto.isPending}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {createProducto.isPending ? "Registrando..." : "Registrar Compra"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Información sobre el proceso */}
      <Card>
        <CardHeader>
          <CardTitle>Proceso de Control de Inventario</CardTitle>
          <CardDescription>
            Cómo funciona el sistema de inventario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="w-12 h-12 mx-auto mb-3 bg-blue-100 rounded-full flex items-center justify-center">
                <Plus className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">1. Registrar Compra</h3>
              <p className="text-sm text-muted-foreground">
                Registra productos comprados. Si ya existe, se agrupa automáticamente y calcula el costo promedio ponderado.
              </p>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">2. Control Automático</h3>
              <p className="text-sm text-muted-foreground">
                Sistema inteligente que agrupa productos por nombre y mantiene historial de movimientos y costos.
              </p>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="w-12 h-12 mx-auto mb-3 bg-purple-100 rounded-full flex items-center justify-center">
                <Upload className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">3. Venta (Próximo)</h3>
              <p className="text-sm text-muted-foreground">
                En la segunda etapa podrás registrar ventas y calcular ganancias automáticamente
              </p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">🔄 Control Inteligente de Inventario:</h4>
            <p className="text-blue-800 text-sm mb-2">
              El sistema detecta automáticamente si ya tienes este producto en inventario:
            </p>
            <ul className="text-blue-700 text-sm space-y-1 ml-4">
              <li>• <strong>Producto nuevo:</strong> Se crea el registro inicial</li>
              <li>• <strong>Producto existente:</strong> Se actualiza el stock y calcula el costo promedio ponderado</li>
              <li>• <strong>Historial completo:</strong> Cada compra queda registrada para análisis detallado</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegistroProductos;