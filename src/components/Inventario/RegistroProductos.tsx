import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Image, Trash2, Package, CreditCard, Wallet, FileText, AlertCircle, ArrowLeft, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { useProductos, useCreateProducto } from "@/hooks/useProductos";
import { useSubcuentasInventario } from "@/hooks/useSubcuentas";
import { useProveedores } from "@/hooks/useProveedores";
import { toast } from "@/hooks/use-toast";
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
  precioVenta: number;
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

type FlowStep = "select_type" | "select_existing" | "form";

const RegistroProductos = () => {
  const [flowStep, setFlowStep] = useState<FlowStep>("select_type");
  const [selectedProducto, setSelectedProducto] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Estados para manejo de proveedores
  const [tipoProveedor, setTipoProveedor] = useState(""); // "nuevo" o "existente"
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState("");
  const [proveedorTelefono, setProveedorTelefono] = useState("");
  const [proveedorEmail, setProveedorEmail] = useState("");
  const [proveedorRFC, setProveedorRFC] = useState("");
  
  const { data: productos, isLoading: loadingProductos } = useProductos();
  const { data: subcuentasInventario } = useSubcuentasInventario();
  const { proveedores, createProveedor } = useProveedores();
  const createProducto = useCreateProducto();

  // Filtrar productos existentes de inventario
  const productosExistentes = productos?.filter(producto => 
    (producto.cantidad_stock && producto.cantidad_stock >= 0) || 
    (producto.cantidad_comprada && producto.cantidad_comprada > 0)
  ) || [];

  const filteredProductos = productosExistentes.filter(producto =>
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleSelectExisting = (producto: any) => {
    setSelectedProducto(producto);
    setValue("nombre", producto.nombre);
    setValue("descripcion", producto.descripcion || "");
    setValue("subcuentaId", producto.subcuenta_id || "");
    setValue("precioVenta", producto.precio_venta || 0);
    
    // Pre-cargar imagen existente si la tiene
    if (producto.imagen_url) {
      setImagePreview(producto.imagen_url);
    }
    
    setFlowStep("form");
  };

  const handleNewProduct = () => {
    setSelectedProducto(null);
    reset();
    clearImage();
    setFlowStep("form");
  };

  const handleBackToSelection = () => {
    if (flowStep === "form") {
      setFlowStep(selectedProducto ? "select_existing" : "select_type");
    } else if (flowStep === "select_existing") {
      setFlowStep("select_type");
    }
    
    if (flowStep === "select_existing") {
      setSearchTerm("");
    }
  };

  const onSubmit = async (data: ProductoForm) => {
    // Para pago parcial o pendiente, el proveedor es obligatorio
    if (tipoPago === "parcial" || tipoPago === "pendiente") {
      // Validar selección de tipo de proveedor
      if (!tipoProveedor) {
        toast({
          title: "⚠️ Tipo de proveedor requerido",
          description: "Selecciona si es un proveedor nuevo o existente",
          variant: "destructive"
        });
        return;
      }

      // Validar datos del proveedor nuevo
      if (tipoProveedor === "nuevo" && !data.proveedor) {
        toast({
          title: "⚠️ Nombre del proveedor requerido",
          description: "Ingresa el nombre del proveedor",
          variant: "destructive"
        });
        return;
      }

      // Validar selección de proveedor existente
      if (tipoProveedor === "existente" && !proveedorSeleccionado) {
        toast({
          title: "⚠️ Proveedor no seleccionado",
          description: "Selecciona un proveedor de la lista",
          variant: "destructive"
        });
        return;
      }
    }

    let proveedorId = null;
    let proveedorNombre = data.proveedor || "";

    // Crear o seleccionar proveedor para pagos parciales o pendientes
    if (tipoPago === "parcial" || tipoPago === "pendiente") {
      if (tipoProveedor === "nuevo") {
        const nuevoProveedor = {
          nombre: data.proveedor || "",
          telefono: proveedorTelefono || null,
          email: proveedorEmail || null,
          rfc: proveedorRFC || null,
          direccion: null,
          ciudad: null,
          estado: null,
          codigo_postal: null
        };

        const { data: proveedorData, error: proveedorError } = await createProveedor(nuevoProveedor);
        
        if (proveedorError) {
          toast({
            title: "❌ Error al crear proveedor",
            description: proveedorError,
            variant: "destructive"
          });
          return;
        }

        proveedorId = proveedorData?.id;
      } else if (tipoProveedor === "existente") {
        proveedorId = proveedorSeleccionado;
        const proveedor = proveedores?.find(p => p.id === proveedorSeleccionado);
        proveedorNombre = proveedor?.nombre || "";
      }
    }

    await createProducto.mutateAsync({
      nombre: data.nombre,
      precio: data.precio,
      precioVenta: data.precioVenta,
      cantidad: data.cantidad,
      descripcion: data.descripcion,
      subcuentaId: data.subcuentaId,
      imagen: selectedImage || undefined,
    });
    
    // Reset del formulario y volver al inicio
    reset();
    clearImage();
    setSelectedProducto(null);
    setFlowStep("select_type");
    setTipoProveedor("");
    setProveedorSeleccionado("");
    setProveedorTelefono("");
    setProveedorEmail("");
    setProveedorRFC("");
  };

  const formatPrice = (precio: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(precio);
  };

  // Paso 1: Seleccionar tipo de registro
  if (flowStep === "select_type") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Tipo de Registro de Compra
            </CardTitle>
            <CardDescription>
              Selecciona si vas a registrar un producto nuevo o una compra adicional de un producto existente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                    onClick={() => setFlowStep("select_existing")}>
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                    <Search className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Producto Existente</h3>
                  <p className="text-sm text-muted-foreground">
                    Compra adicional de un producto que ya tienes en inventario. 
                    Se calculará automáticamente el costo promedio ponderado.
                  </p>
                  <div className="mt-4">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      Recomendado para restock
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                    onClick={handleNewProduct}>
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                    <Plus className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Producto Nuevo</h3>
                  <p className="text-sm text-muted-foreground">
                    Registrar un producto completamente nuevo en tu inventario. 
                    Necesitarás proporcionar toda la información del producto.
                  </p>
                  <div className="mt-4">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      Primera vez
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Paso 2: Seleccionar producto existente
  if (flowStep === "select_existing") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBackToSelection}
                className="mr-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Seleccionar Producto Existente
                </CardTitle>
                <CardDescription>
                  Busca y selecciona el producto al que quieres agregar stock
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos en inventario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {loadingProductos ? (
                <div className="text-center py-8 text-muted-foreground">
                  Cargando productos...
                </div>
              ) : filteredProductos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProductos.map((producto) => (
                    <Card key={producto.id} 
                          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                          onClick={() => handleSelectExisting(producto)}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {producto.imagen_url ? (
                            <img
                              src={producto.imagen_url}
                              alt={producto.nombre}
                              className="w-16 h-16 object-cover rounded"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                              <Package className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm mb-1 truncate">{producto.nombre}</h3>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {producto.descripcion || "Sin descripción"}
                            </p>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                Stock: {producto.cantidad_stock || 0}
                              </span>
                              <span className="font-medium text-primary">
                                {formatPrice(producto.costo_unitario || 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">
                    {searchTerm ? "No se encontraron productos" : "No hay productos en inventario"}
                  </p>
                  <Button variant="outline" onClick={handleNewProduct}>
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar Producto Nuevo
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Paso 3: Formulario (mantener funcionalidad exacta)
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackToSelection}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                {selectedProducto ? `Agregar Stock: ${selectedProducto.nombre}` : 'Registrar Producto Nuevo'}
              </CardTitle>
              <CardDescription>
                {selectedProducto 
                  ? 'Registra la compra adicional de este producto. Se calculará automáticamente el costo promedio ponderado.'
                  : 'Registra un producto completamente nuevo para control de inventario'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información del producto */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground border-b pb-2">Información del Producto</h3>
                
                {selectedProducto && (
                  <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                    <div className="flex items-start gap-2">
                      <Package className="h-4 w-4 text-primary mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-primary">Producto Existente</p>
                        <p className="text-muted-foreground mt-1">
                          Stock actual: {selectedProducto.cantidad_stock || 0} unidades | 
                          Costo actual: {formatPrice(selectedProducto.costo_unitario || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="nombre">Nombre del Producto *</Label>
                  <Input
                    id="nombre"
                    {...register("nombre", { required: true })}
                    placeholder="Ej: Camiseta para inventario"
                    readOnly={!!selectedProducto}
                    className={selectedProducto ? "bg-muted" : ""}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="precio">Precio Unitario de Compra *</Label>
                    <Input
                      id="precio"
                      type="number"
                      step="0.01"
                      {...register("precio", { required: true, valueAsNumber: true })}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="precioVenta">Precio de Venta Sugerido</Label>
                    <Input
                      id="precioVenta"
                      type="number"
                      step="0.01"
                      {...register("precioVenta", { valueAsNumber: true })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Este precio se usará por defecto al vender el producto
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="cantidad">Cantidad a Comprar *</Label>
                  <Input
                    id="cantidad"
                    type="number"
                    min="1"
                    {...register("cantidad", { required: true, valueAsNumber: true })}
                    placeholder="1"
                  />
                </div>

                {montoTotal > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Monto Total: {formatPrice(montoTotal)}</p>
                  </div>
                )}

                {tipoPago === "contado" && (
                  <div>
                    <Label htmlFor="proveedor">Proveedor (Opcional)</Label>
                    <Input
                      id="proveedor"
                      {...register("proveedor")}
                      placeholder="Nombre del proveedor (opcional para pago total)"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="subcuenta">Subcuenta de Inventario (Opcional)</Label>
                  <Select onValueChange={(value) => setValue("subcuentaId", value)} defaultValue={selectedProducto?.subcuenta_id}>
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
                        <Wallet className="h-4 w-4 text-primary" />
                        <Label htmlFor="efectivo-inv" className="cursor-pointer">
                          Efectivo <span className="text-sm text-muted-foreground">(se registra en Caja)</span>
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="bancos" id="bancos-inv" />
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4 text-primary" />
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
                      <Label htmlFor="contado-inv" className="cursor-pointer">Pago total</Label>
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
                    <div className="space-y-4 ml-6 p-4 border rounded-lg bg-muted/50">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Se registrará como cuenta por pagar al proveedor (obligatorio)
                        </AlertDescription>
                      </Alert>
                      
                      {montoPendiente > 0 && (
                        <div className="p-3 bg-muted border rounded-lg">
                          <p className="text-sm font-medium">
                            Monto Pendiente: {formatPrice(montoPendiente)}
                          </p>
                        </div>
                      )}
                      
                      <div>
                        <Label htmlFor="fechaVencimiento">Fecha de Vencimiento</Label>
                        <Input
                          id="fechaVencimiento"
                          type="date"
                          {...register("fechaVencimiento")}
                        />
                      </div>

                      <Separator />

                      {/* Información del Proveedor (Obligatorio) */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-primary">Información del Proveedor *</h4>
                        
                        {/* Tipo de proveedor */}
                        <div className="space-y-2">
                          <Label>¿Es un proveedor nuevo o existente? *</Label>
                          <RadioGroup value={tipoProveedor} onValueChange={(value) => {
                            setTipoProveedor(value);
                            if (value === "nuevo") {
                              setProveedorSeleccionado("");
                            } else {
                              // Limpiar campos de proveedor nuevo
                              setValue("proveedor", "");
                              setProveedorTelefono("");
                              setProveedorEmail("");
                              setProveedorRFC("");
                            }
                          }}>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="nuevo" id="proveedor-nuevo" />
                              <Label htmlFor="proveedor-nuevo">Proveedor Nuevo</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="existente" id="proveedor-existente" />
                              <Label htmlFor="proveedor-existente">Proveedor Existente</Label>
                            </div>
                          </RadioGroup>
                        </div>

                        {tipoProveedor === "nuevo" && (
                          <div className="space-y-4 p-3 bg-background rounded-lg border">
                            <h4 className="text-sm font-semibold">Datos del Nuevo Proveedor</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="proveedor-nombre">Nombre del Proveedor *</Label>
                                <Input
                                  id="proveedor-nombre"
                                  {...register("proveedor")}
                                  placeholder="Nombre completo o razón social"
                                />
                              </div>
                              <div>
                                <Label htmlFor="proveedor-telefono">Teléfono</Label>
                                <Input
                                  id="proveedor-telefono"
                                  value={proveedorTelefono}
                                  onChange={(e) => setProveedorTelefono(e.target.value)}
                                  placeholder="Número de teléfono"
                                />
                              </div>
                              <div>
                                <Label htmlFor="proveedor-email">Email</Label>
                                <Input
                                  id="proveedor-email"
                                  type="email"
                                  value={proveedorEmail}
                                  onChange={(e) => setProveedorEmail(e.target.value)}
                                  placeholder="correo@ejemplo.com"
                                />
                              </div>
                              <div>
                                <Label htmlFor="proveedor-rfc">RFC</Label>
                                <Input
                                  id="proveedor-rfc"
                                  value={proveedorRFC}
                                  onChange={(e) => setProveedorRFC(e.target.value)}
                                  placeholder="RFC del proveedor"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {tipoProveedor === "existente" && (
                          <div className="space-y-2">
                            <Label htmlFor="proveedor-select">Seleccionar Proveedor *</Label>
                            <Select value={proveedorSeleccionado} onValueChange={setProveedorSeleccionado}>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar proveedor de la base de datos" />
                              </SelectTrigger>
                              <SelectContent>
                                {proveedores && proveedores.length > 0 ? (
                                  proveedores.map((proveedor) => (
                                    <SelectItem key={proveedor.id} value={proveedor.id}>
                                      {proveedor.nombre}
                                      {proveedor.telefono && ` - ${proveedor.telefono}`}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="no-proveedores" disabled>
                                    No hay proveedores registrados
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Proveedores desde el menú de Cobros y Pagos
                            </p>
                          </div>
                        )}
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
                readOnly={!!selectedProducto}
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
                    {!selectedProducto && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={clearImage}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
                {createProducto.isPending ? "Registrando..." : 
                 selectedProducto ? "Agregar Stock" : "Registrar Producto"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegistroProductos;