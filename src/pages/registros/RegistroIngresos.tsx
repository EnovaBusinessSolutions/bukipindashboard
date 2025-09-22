import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Plus, ShoppingCart, Package, FileText, Gift, CreditCard, Wallet, Calculator } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useVentasResumen } from "@/hooks/useVentasResumen";
import { useTransaccionesRecientes } from "@/hooks/useTransaccionesRecientes";
import { useSubcuentas } from "@/hooks/useSubcuentas";
import { useProductos, useProductosServicios, useCreateProducto, useDeleteProducto } from "@/hooks/useProductos";
import { useClientes, useCreateCliente } from "@/hooks/useClientes";

const RegistroIngresos = () => {
  const { ventasResumen, loading: loadingVentas, refetch: refetchVentas } = useVentasResumen();
  const { transacciones, loading: loadingTransacciones, refetch: refetchTransacciones } = useTransaccionesRecientes(10);
  const { data: subcuentas = [] } = useSubcuentas();
  const { data: productos = [], isLoading: loadingProductos } = useProductos();
  const { data: productosServicios = [], isLoading: loadingProductosServicios } = useProductosServicios();
  const { data: clientes = [], isLoading: loadingClientes } = useClientes();
  const createProducto = useCreateProducto();
  const deleteProducto = useDeleteProducto();
  const createCliente = useCreateCliente();
  const [selectedIncomeType, setSelectedIncomeType] = useState("");
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [montoTotal, setMontoTotal] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para información del cliente
  const [tipoCliente, setTipoCliente] = useState(""); // "nuevo" o "recurrente"
  const [clienteSeleccionado, setClienteSeleccionado] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteRFC, setClienteRFC] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [montoAbonado, setMontoAbonado] = useState("");
  const [comentarios, setComentarios] = useState(""); // New comments field
  
  // Estados para productos de inventario
  const [selectedInventoryProductId, setSelectedInventoryProductId] = useState("");
  const [inventoryProductPrice, setInventoryProductPrice] = useState("");
  const [inventoryQuantity, setInventoryQuantity] = useState("1");
  const [availableStock, setAvailableStock] = useState(0);
  const [usePrecioRegistrado, setUsePrecioRegistrado] = useState(true);
  
  // Estados para productos precargados
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productUnitPrice, setProductUnitPrice] = useState("");
  const [productQuantity, setProductQuantity] = useState("1");
  
  // Estados para el catálogo de productos
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productAccount, setProductAccount] = useState("4001"); // Fijo en ventas
  const [productSubcuenta, setProductSubcuenta] = useState(""); // Nueva subcuenta
  const [productImage, setProductImage] = useState<File | null>(null);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // Filtrar productos con stock disponible para inventario
  const productosInventario = productos.filter(producto => 
    (producto.cantidad_stock && producto.cantidad_stock > 0) ||
    (producto.cantidad_comprada && producto.cantidad_comprada > 0)
  );

  // Función para manejar selección de producto de inventario
  const handleInventoryProductSelection = (productId: string) => {
    setSelectedInventoryProductId(productId);
    const selectedProduct = productosInventario.find(p => p.id === productId);
    if (selectedProduct) {
      // Usar precio de venta si está disponible, si no, usar costo unitario
      const precioVenta = (selectedProduct as any).precio_venta;
      const precioAUsar = precioVenta && precioVenta > 0 
        ? precioVenta.toString() 
        : (selectedProduct.costo_unitario?.toString() || selectedProduct.precio.toString());
      
      // Si tiene precio de venta registrado, activar esa opción por defecto
      const tienePrecioRegistrado = precioVenta && precioVenta > 0;
      setUsePrecioRegistrado(tienePrecioRegistrado);
      
      setInventoryProductPrice(precioAUsar);
      setAvailableStock(selectedProduct.cantidad_stock || 0);
      // Autocompletar descripción
      setDescripcion(`Venta de ${selectedProduct.nombre}`);
      // Calcular monto total
      const precioNumerico = precioVenta && precioVenta > 0 
        ? precioVenta 
        : (selectedProduct.costo_unitario || selectedProduct.precio);
      const total = (precioNumerico * parseFloat(inventoryQuantity)).toFixed(2);
      setMontoTotal(total);
    }
  };

  // Función para manejar cambio de cantidad del inventario
  const handleInventoryQuantityChange = (quantity: string) => {
    setInventoryQuantity(quantity);
    if (selectedInventoryProductId && inventoryProductPrice) {
      const total = (parseFloat(inventoryProductPrice) * parseFloat(quantity || '1')).toFixed(2);
      setMontoTotal(total);
    }
  };

  // Función para manejar cambio de precio de inventario
  const handleInventoryPriceChange = (price: string) => {
    setInventoryProductPrice(price);
    if (selectedInventoryProductId && price) {
      const total = (parseFloat(price) * parseFloat(inventoryQuantity || '1')).toFixed(2);
      setMontoTotal(total);
    }
  };

  // Función para manejar selección de producto precargado
  const handleProductSelection = (productId: string) => {
    setSelectedProductId(productId);
    const selectedProduct = productos.find(p => p.id === productId);
    if (selectedProduct) {
      setProductUnitPrice(selectedProduct.precio.toString());
      // Autocompletar descripción requerida por el backend
      setDescripcion(selectedProduct.nombre);
      // Calcular monto total automáticamente
      const total = (selectedProduct.precio * parseFloat(productQuantity)).toFixed(2);
      setMontoTotal(total);
    }
  };

  // Función para manejar cambio de cantidad
  const handleQuantityChange = (quantity: string) => {
    setProductQuantity(quantity);
    if (selectedProductId && productUnitPrice) {
      const total = (parseFloat(productUnitPrice) * parseFloat(quantity || '1')).toFixed(2);
      setMontoTotal(total);
    }
  };

  // Función para validar campos requeridos y mostrar alertas visuales
  const getValidationErrors = () => {
    const errors = [];
    
    if (!selectedIncomeType) errors.push('Tipo de Ingreso');
    
    // Validación específica por tipo de ingreso
    if (selectedIncomeType === 'precargados') {
      if (!selectedProductId) errors.push('Producto Precargado');
      if (!productQuantity || parseFloat(productQuantity) <= 0) errors.push('Cantidad');
    } else if (selectedIncomeType === 'inventariados') {
      if (!selectedInventoryProductId) errors.push('Producto de Inventario');
      if (!inventoryQuantity || parseFloat(inventoryQuantity) <= 0) errors.push('Cantidad');
      if (parseFloat(inventoryQuantity) > availableStock) errors.push('Cantidad excede stock disponible');
    } else if (selectedIncomeType === 'general' || selectedIncomeType === 'otros') {
      if (!descripcion.trim()) errors.push('Descripción');
    }
    
    if (selectedIncomeType !== 'precargados' && selectedIncomeType !== 'inventariados' && (!montoTotal || parseFloat(montoTotal) <= 0)) errors.push('Monto Total');
    
    // Validación de datos del cliente para cuentas pendientes (crédito o parcial)
    if (paymentStatus === 'credito' || paymentStatus === 'parcial') {
      if (!tipoCliente) errors.push('Tipo de Cliente');
      if (tipoCliente === 'recurrente' && !clienteSeleccionado) errors.push('Cliente Seleccionado');
      if (!clienteTelefono.trim()) errors.push('Teléfono del Cliente');
      if (!clienteEmail.trim()) errors.push('Email del Cliente');
      if (!fechaVencimiento) errors.push('Fecha de Vencimiento');
      
      // Validación específica para pago parcial
      if (paymentStatus === 'parcial') {
        if (!montoAbonado || parseFloat(montoAbonado) <= 0) errors.push('Monto Abonado');
        if (montoTotal && montoAbonado && parseFloat(montoAbonado) >= parseFloat(montoTotal)) {
          errors.push('Monto Abonado debe ser menor al total');
        }
      }
    }
    
    // Solo requerir método de pago cuando hay pago efectivo (contado o parcial)
    if ((paymentStatus === 'contado' || paymentStatus === 'parcial') && !paymentMethod) errors.push('Método de Pago');
    if (!paymentStatus) errors.push('Tipo de Pago');
    
    return errors;
  };

  // Función para verificar si un campo tiene error
  const hasFieldError = (fieldName: string) => {
    const errors = getValidationErrors();
    return errors.includes(fieldName);
  };

  // Función para registrar el ingreso
  const handleSubmitIngreso = async () => {
    const validationErrors = getValidationErrors();
    
    if (validationErrors.length > 0) {
      toast({
        title: "⚠️ Campos requeridos faltantes",
        description: `Debes completar: ${validationErrors.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Crear cliente si es nuevo y si hay información del cliente
      let clienteId = null;
      if (tipoCliente === "nuevo" && clienteNombre.trim()) {
        try {
          const nuevoCliente = await createCliente.mutateAsync({
            nombre: clienteNombre.trim(),
            email: clienteEmail.trim() || undefined,
            telefono: clienteTelefono.trim() || undefined,
            rfc: clienteRFC.trim() || undefined,
            activo: true
          });
          clienteId = nuevoCliente.id;
        } catch (error) {
          console.error("Error creating client:", error);
          toast({
            title: "Error al crear cliente",
            description: "No se pudo crear el cliente nuevo",
            variant: "destructive"
          });
          setIsSubmitting(false);
          return;
        }
      } else if (tipoCliente === "recurrente" && clienteSeleccionado) {
        clienteId = clienteSeleccionado;
      }
      // Derivar valores por seguridad
      const selectedProduct = productos.find(p => p.id === selectedProductId);
      const selectedInventoryProduct = productosInventario.find(p => p.id === selectedInventoryProductId);
      
      let descripcionToSend = descripcion;
      let montoTotalDerived = Number(montoTotal || '0');
      let subcuentaToSend = null;

      if (selectedIncomeType === 'precargados' && selectedProduct) {
        descripcionToSend = selectedProduct.nombre;
        montoTotalDerived = Number((Number(selectedProduct.precio) * Number(productQuantity || '1')).toFixed(2));
        subcuentaToSend = selectedProduct.subcuenta_id || null;
      } else if (selectedIncomeType === 'inventariados' && selectedInventoryProduct) {
        descripcionToSend = `Venta de ${selectedInventoryProduct.nombre}`;
        montoTotalDerived = Number((Number(inventoryProductPrice || '0') * Number(inventoryQuantity || '1')).toFixed(2));
        subcuentaToSend = selectedInventoryProduct.subcuenta_id || null;
      }

      const descuento = hasDiscount ? Number(discountAmount || '0') : 0;
      const neto = Math.max(0, Number((montoTotalDerived - descuento).toFixed(2)));
      
      // Calcular monto pagado y pendiente según el tipo de pago
      let montoPagado = 0;
      let montoPendiente = 0;
      
      if (paymentStatus === 'contado') {
        montoPagado = neto;
        montoPendiente = 0;
      } else if (paymentStatus === 'parcial') {
        montoPagado = Number(montoAbonado || '0');
        montoPendiente = Math.max(0, neto - montoPagado);
      } else if (paymentStatus === 'credito') {
        montoPagado = 0;
        montoPendiente = neto;
      }

      if (!descripcionToSend || montoTotalDerived <= 0) {
        toast({
          title: "⚠️ Datos incompletos",
          description: "Selecciona un producto válido o ingresa una descripción y monto.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('registrar-ingreso', {
        body: {
          tipoIngreso: selectedIncomeType,
          descripcion: descripcionToSend,
          montoTotal: montoTotalDerived,
          montoDescuento: descuento,
          cuentaPrincipalCodigo: selectedIncomeType === 'otros' ? '4004' : '4001',
          subcuentaId: subcuentaToSend || undefined,
          metodoPago: paymentMethod,
          tipoPago: paymentStatus,
          montoPagado: montoPagado,
          montoPendiente: montoPendiente,
          clienteNombre: clienteNombre.trim() || null,
          clienteTelefono: clienteTelefono.trim() || null,
          clienteEmail: clienteEmail.trim() || null,
          clienteRFC: clienteRFC.trim() || null,
          clienteId: clienteId,
          fechaVencimiento: fechaVencimiento || null,
          comentarios: comentarios.trim() || null,
          // Datos adicionales para inventario
          ...(selectedIncomeType === 'inventariados' && selectedInventoryProduct && {
            productoId: selectedInventoryProduct.id,
            cantidadVendida: Number(inventoryQuantity || '1'),
            precioVenta: Number(inventoryProductPrice || '0')
          })
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Ingreso registrado",
        description: `Asiento ${data.numeroAsiento} creado correctamente`
      });

      // Refrescar datos para mostrar la nueva venta
      await Promise.all([
        refetchVentas(),
        refetchTransacciones()
      ]);
      
      // Si fue una venta de inventario, refrescar también los productos
      if (selectedIncomeType === 'inventariados') {
        // Forzar actualización de productos para mostrar nuevo stock
        window.location.reload();
      }

      // Limpiar formulario
      setSelectedIncomeType("");
      setDescripcion("");
      setMontoTotal("");
      setDiscountAmount("");
      setHasDiscount(false);
      setPaymentMethod("");
      setPaymentStatus("");
      setTipoCliente("");
      setClienteSeleccionado("");
      setClienteNombre("");
      setClienteTelefono("");
      setClienteEmail("");
      setClienteRFC("");
      setFechaVencimiento("");
      setMontoAbonado("");
      setComentarios("");
      setSelectedProductId("");
      setProductUnitPrice("");
      setProductQuantity("1");
      setSelectedInventoryProductId("");
      setInventoryProductPrice("");
      setInventoryQuantity("1");
      setAvailableStock(0);
      setUsePrecioRegistrado(true);

    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Error al registrar el ingreso",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const renderIncomeTypeForm = (type: string) => {
    switch (type) {
      case "precargados":
        return (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Recordatorio:</strong> Para registrar ventas de productos precargados, primero debes agregar los productos al catálogo desde la pestaña "Catálogo de Productos".
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="producto-precargado">Seleccionar Producto Precargado</Label>
                {hasFieldError('Producto Precargado') && (
                  <div className="flex items-center text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-xs">Requerido</span>
                  </div>
                )}
              </div>
              <Select 
                value={selectedProductId} 
                onValueChange={handleProductSelection}
              >
                <SelectTrigger className={hasFieldError('Producto Precargado') ? 'border-destructive' : ''}>
                  <SelectValue placeholder={loadingProductosServicios ? "Cargando productos..." : "Seleccionar producto del catálogo"} />
                </SelectTrigger>
                <SelectContent className="max-h-80 z-50 bg-background border border-border w-full">
                  {loadingProductosServicios ? (
                    <SelectItem value="loading" disabled>Cargando productos...</SelectItem>
                  ) : productosServicios.length === 0 ? (
                    <SelectItem value="empty" disabled>No hay productos de servicios registrados</SelectItem>
                  ) : (
                    productosServicios.map((producto) => (
                       <SelectItem key={producto.id} value={producto.id} className="py-3 px-3 h-auto">
                         <div className="flex items-center space-x-3 w-full">
                           <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                             {producto.imagen_url ? (
                               <img 
                                 src={producto.imagen_url} 
                                 alt={producto.nombre}
                                 className="w-full h-full object-cover"
                               />
                             ) : (
                               <div className="w-full h-full bg-muted flex items-center justify-center">
                                 <Package className="w-5 h-5 text-muted-foreground" />
                               </div>
                             )}
                           </div>
                           <div className="flex-1 min-w-0">
                             <p className="font-medium text-sm truncate mb-1">{producto.nombre}</p>
                             <p className="text-xs text-muted-foreground">${producto.precio}</p>
                           </div>
                         </div>
                       </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="cantidad">Cantidad</Label>
                  {hasFieldError('Cantidad') && (
                    <div className="flex items-center text-destructive">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs">Requerido</span>
                    </div>
                  )}
                </div>
                <Input 
                  id="cantidad" 
                  type="number" 
                  placeholder="1" 
                  value={productQuantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className={hasFieldError('Cantidad') ? 'border-destructive' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="precio-unitario">Precio Unitario</Label>
                <Input 
                  id="precio-unitario" 
                  type="number" 
                  placeholder="0.00" 
                  value={productUnitPrice}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>
          </div>
        );
      
      case "inventariados":
        return (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Ventas desde Inventario:</strong> Solo se muestran productos con stock disponible. El stock se actualizará automáticamente al registrar la venta.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="producto-inventario">Seleccionar Producto del Inventario</Label>
                {hasFieldError('Producto de Inventario') && (
                  <div className="flex items-center text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-xs">Requerido</span>
                  </div>
                )}
              </div>
              <Select 
                value={selectedInventoryProductId} 
                onValueChange={handleInventoryProductSelection}
              >
                <SelectTrigger className={hasFieldError('Producto de Inventario') ? 'border-destructive' : ''}>
                  <SelectValue placeholder={loadingProductos ? "Cargando inventario..." : "Seleccionar producto del inventario"} />
                </SelectTrigger>
                <SelectContent className="max-h-80 z-50 bg-background border border-border w-full">
                  {loadingProductos ? (
                    <SelectItem value="loading" disabled>Cargando inventario...</SelectItem>
                  ) : productosInventario.length === 0 ? (
                    <SelectItem value="empty" disabled>No hay productos con stock disponible</SelectItem>
                  ) : (
                    productosInventario.map((producto) => (
                       <SelectItem key={producto.id} value={producto.id} className="py-3 px-3 h-auto">
                         <div className="flex items-center space-x-3 w-full">
                           <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                             {producto.imagen_url ? (
                               <img 
                                 src={producto.imagen_url} 
                                 alt={producto.nombre}
                                 className="w-full h-full object-cover"
                               />
                             ) : (
                               <div className="w-full h-full bg-muted flex items-center justify-center">
                                 <Package className="w-5 h-5 text-muted-foreground" />
                               </div>
                             )}
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between mb-1">
                               <p className="font-medium text-sm truncate">{producto.nombre}</p>
                               <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                                 Stock: {producto.cantidad_stock || 0}
                               </span>
                             </div>
                             <div className="flex items-center justify-between">
                               <span className="text-xs text-muted-foreground">
                                 Costo: ${producto.costo_unitario || producto.precio}
                               </span>
                               {(producto as any).precio_venta && (producto as any).precio_venta > 0 ? (
                                 <span className="text-xs text-green-600 font-medium">
                                   Venta: ${(producto as any).precio_venta}
                                 </span>
                               ) : (
                                 <span className="text-xs text-orange-600 font-medium">⚠️ Sin precio</span>
                               )}
                             </div>
                           </div>
                         </div>
                       </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="cantidad-inv">Cantidad a Vender</Label>
                  {hasFieldError('Cantidad') && (
                    <div className="flex items-center text-destructive">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs">Requerido</span>
                    </div>
                  )}
                  {hasFieldError('Cantidad excede stock disponible') && (
                    <div className="flex items-center text-destructive">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs">Excede stock</span>
                    </div>
                  )}
                </div>
                <Input 
                  id="cantidad-inv" 
                  type="number" 
                  placeholder="1"
                  min="1"
                  max={availableStock}
                  value={inventoryQuantity}
                  onChange={(e) => handleInventoryQuantityChange(e.target.value)}
                  className={hasFieldError('Cantidad') || hasFieldError('Cantidad excede stock disponible') ? 'border-destructive' : ''}
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="precio-inv">Precio de Venta Registrado</Label>
                  {selectedInventoryProductId && !(productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta && (
                    <div className="flex items-center text-orange-600">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs">Sin precio configurado</span>
                    </div>
                  )}
                </div>
                
                {/* Selector de tipo de precio */}
                {selectedInventoryProductId && (
                  <div className="space-y-2">
                    <RadioGroup 
                      value={usePrecioRegistrado ? "registrado" : "personalizado"}
                      onValueChange={(value) => {
                        const useRegistrado = value === "registrado";
                        setUsePrecioRegistrado(useRegistrado);
                        
                        // Si cambia a precio registrado, restaurar el precio del inventario
                        if (useRegistrado) {
                          const selectedProduct = productosInventario.find(p => p.id === selectedInventoryProductId);
                          if (selectedProduct) {
                            const precioVenta = (selectedProduct as any).precio_venta;
                            const precioAUsar = precioVenta && precioVenta > 0 
                              ? precioVenta.toString() 
                              : (selectedProduct.costo_unitario?.toString() || selectedProduct.precio.toString());
                            setInventoryProductPrice(precioAUsar);
                            // Recalcular total
                            const precioNumerico = precioVenta && precioVenta > 0 
                              ? precioVenta 
                              : (selectedProduct.costo_unitario || selectedProduct.precio);
                            const total = (precioNumerico * parseFloat(inventoryQuantity)).toFixed(2);
                            setMontoTotal(total);
                          }
                        }
                      }}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="registrado" id="precio-registrado" />
                        <Label htmlFor="precio-registrado" className="text-sm">
                          Usar precio registrado
                          {selectedInventoryProductId && (productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta > 0 && (
                            <span className="ml-1 text-green-600 font-medium">
                              (${(productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta})
                            </span>
                          )}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="personalizado" id="precio-personalizado" />
                        <Label htmlFor="precio-personalizado" className="text-sm">Precio personalizado</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {selectedInventoryProductId && !usePrecioRegistrado && !(productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      <strong>Advertencia:</strong> Este producto no tiene un precio de venta configurado. 
                      Puedes establecerlo desde Control de Inventario o ingresarlo manualmente aquí.
                    </AlertDescription>
                  </Alert>
                )}
                
                <Input 
                  id="precio-inv" 
                  type="number" 
                  placeholder="0.00" 
                  step="0.01"
                  value={inventoryProductPrice}
                  onChange={(e) => handleInventoryPriceChange(e.target.value)}
                  disabled={usePrecioRegistrado && selectedInventoryProductId && (productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta > 0}
                  className={`${
                    selectedInventoryProductId && !usePrecioRegistrado && !(productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta 
                      ? 'border-orange-300 bg-orange-50' 
                      : ''
                  } ${
                    usePrecioRegistrado && selectedInventoryProductId && (productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta > 0 
                      ? 'bg-muted' 
                      : ''
                  }`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock-disponible">Stock Disponible</Label>
                <Input 
                  id="stock-disponible" 
                  type="number" 
                  disabled 
                  value={availableStock}
                  className="bg-muted"
                />
              </div>
            </div>
            {selectedInventoryProductId && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-medium text-primary mb-2">Información del Producto</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Costo de inventario:</span>
                    <span className="ml-2 font-medium">${productosInventario.find(p => p.id === selectedInventoryProductId)?.costo_unitario || 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Precio de venta:</span>
                    <span className="ml-2 font-medium">${inventoryProductPrice}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ganancia por unidad:</span>
                    <span className="ml-2 font-medium text-green-600">
                      ${(parseFloat(inventoryProductPrice || '0') - (productosInventario.find(p => p.id === selectedInventoryProductId)?.costo_unitario || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ganancia total:</span>
                    <span className="ml-2 font-medium text-green-600">
                      ${((parseFloat(inventoryProductPrice || '0') - (productosInventario.find(p => p.id === selectedInventoryProductId)?.costo_unitario || 0)) * parseFloat(inventoryQuantity)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      
      case "general":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="descripcion-general">Descripción del Ingreso</Label>
                {hasFieldError('Descripción') && (
                  <div className="flex items-center text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-xs">Requerido</span>
                  </div>
                )}
              </div>
              <Input 
                id="descripcion-general" 
                placeholder="Ej: Servicio de consultoría"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className={hasFieldError('Descripción') ? 'border-destructive' : ''}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cuenta-contable">Cuenta Contable</Label>
                <Select defaultValue="4001">
                  <SelectTrigger>
                    <SelectValue placeholder="4001 - Ventas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4001">4001 - Ventas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcuenta">Subcuenta (Opcional)</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar subcuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sub1">Subcuenta ejemplo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="monto-general">Monto</Label>
                {hasFieldError('Monto Total') && (
                  <div className="flex items-center text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-xs">Requerido</span>
                  </div>
                )}
              </div>
              <Input 
                id="monto-general" 
                type="number" 
                placeholder="0.00"
                value={montoTotal}
                onChange={(e) => setMontoTotal(e.target.value)}
                className={hasFieldError('Monto Total') ? 'border-destructive' : ''}
              />
            </div>
          </div>
        );
      
      case "otros":
        return (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este ingreso se ligará a la cuenta 4004 - Ventas inventarios.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="descripcion-otros">Descripción del Ingreso Extraordinario</Label>
              <Textarea 
                id="descripcion-otros" 
                placeholder="Ej: Venta extraordinaria de equipo usado, donación recibida, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monto-otros">Monto</Label>
              <Input id="monto-otros" type="number" placeholder="0.00" />
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const handleSubmitProduct = async () => {
    if (!productName.trim() || !productPrice.trim()) {
      toast({
        title: "Error",
        description: "El nombre y precio del producto son obligatorios",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingProduct(true);
    try {
      await createProducto.mutateAsync({
        nombre: productName.trim(),
        precio: parseFloat(productPrice),
        descripcion: productDescription.trim() || undefined,
        subcuentaId: productSubcuenta || undefined,
        imagen: productImage || undefined,
      });

      // Limpiar formulario
      setProductName("");
      setProductPrice("");  
      setProductDescription("");
      setProductAccount("4001");
      setProductSubcuenta("");
      setProductImage(null);
      setIsProductDialogOpen(false);
    } catch (error) {
      // Error manejado por el hook
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Registro de Ingresos</h1>
        <p className="text-muted-foreground mt-2">
          Registra ventas, gestiona catálogos y analiza ingresos de la empresa
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="registro" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="registro">Registro de Ingresos</TabsTrigger>
            <TabsTrigger value="resumen">Resumen de Ventas</TabsTrigger>
            <TabsTrigger value="catalogo">Catálogo de Productos</TabsTrigger>
          </TabsList>

          {/* TAB 1: REGISTRO DE INGRESOS */}
          <TabsContent value="registro" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Nuevo Registro de Ingreso</CardTitle>
                <CardDescription>
                  Selecciona el tipo de ingreso y completa la información requerida
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Selección del tipo de ingreso */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Tipo de Ingreso</Label>
                  <RadioGroup value={selectedIncomeType} onValueChange={setSelectedIncomeType}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="precargados" id="precargados" />
                        <div className="flex items-center space-x-2">
                          <ShoppingCart className="h-5 w-5 text-primary" />
                          <Label htmlFor="precargados" className="cursor-pointer flex-1">
                            <div className="font-medium">Productos Precargados</div>
                          </Label>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="inventariados" id="inventariados" />
                        <div className="flex items-center space-x-2">
                          <Package className="h-5 w-5 text-primary" />
                          <Label htmlFor="inventariados" className="cursor-pointer flex-1">
                            <div className="font-medium">Productos Inventariados</div>
                            <div className="text-sm text-muted-foreground">Del inventario registrado</div>
                          </Label>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="general" id="general" />
                        <div className="flex items-center space-x-2">
                          <FileText className="h-5 w-5 text-primary" />
                          <Label htmlFor="general" className="cursor-pointer flex-1">
                            <div className="font-medium">Ingreso General</div>
                            <div className="text-sm text-muted-foreground">Operación no inventariada</div>
                          </Label>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="otros" id="otros" />
                        <div className="flex items-center space-x-2">
                          <Gift className="h-5 w-5 text-primary" />
                          <Label htmlFor="otros" className="cursor-pointer flex-1">
                            <div className="font-medium">Otros Ingresos</div>
                            <div className="text-sm text-muted-foreground">Extraordinarios, donaciones</div>
                          </Label>
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Formulario dinámico según el tipo seleccionado */}
                {selectedIncomeType && (
                  <div className="space-y-6 p-4 border rounded-lg bg-muted/20">
                    {/* Campos específicos por tipo de ingreso */}
                    {renderIncomeTypeForm(selectedIncomeType)}
                    
                    <Separator />
                    
                     {/* Sección de cálculos y descuentos */}
                     <div className="space-y-4">
                        {/* Mostrar total calculado para productos precargados e inventariados */}
                        {((selectedIncomeType === "precargados" && selectedProductId) || 
                          (selectedIncomeType === "inventariados" && selectedInventoryProductId)) && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Cálculo Automático</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span>Cantidad:</span>
                                <span>{selectedIncomeType === "precargados" ? productQuantity : inventoryQuantity}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Precio Unitario:</span>
                                <span>${selectedIncomeType === "precargados" ? productUnitPrice : inventoryProductPrice}</span>
                              </div>
                              <Separator />
                              <div className="flex justify-between font-medium">
                                <span>Subtotal:</span>
                                <span>${montoTotal}</span>
                              </div>
                            </div>
                          </div>
                        )}

                       <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="discount" 
                          checked={hasDiscount} 
                          onCheckedChange={(checked) => setHasDiscount(checked === true)}
                        />
                        <Label htmlFor="discount" className="font-medium">¿Aplicar descuento?</Label>
                      </div>
                      
                      {hasDiscount && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                          <div className="space-y-2">
                            <Label htmlFor="discount-amount">Monto del descuento</Label>
                            <Input
                              id="discount-amount"
                              type="number"
                              placeholder="0.00"
                              value={discountAmount}
                              onChange={(e) => setDiscountAmount(e.target.value)}
                            />
                          </div>
                          <div className="flex items-end">
                            <Alert className="mt-4">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                <strong>Contabilización automática:</strong><br />
                                • Ventas: +${montoTotal || '0'}<br />
                                {hasDiscount && discountAmount && <span>• Descuento sobre ventas: +${discountAmount}<br /></span>}
                                • {paymentMethod === 'efectivo' ? 'Caja' : 'Bancos'}: +${((parseFloat(montoTotal || '0') - parseFloat(discountAmount || '0'))).toFixed(2)}
                              </AlertDescription>
                            </Alert>
                          </div>
                          <div className="mt-4 p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                            <div className="text-center">
                              <p className="text-sm font-medium text-muted-foreground mb-1">Total a cobrar al cliente</p>
                              <p className="text-2xl font-bold text-primary">
                                ${((parseFloat(montoTotal || '0') - parseFloat(discountAmount || '0'))).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>


                    {/* Estado del pago - PRIMERO */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Label className="font-medium">Estado del Pago</Label>
                        {hasFieldError('Tipo de Pago') && (
                          <div className="flex items-center text-destructive">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span className="text-xs">Requerido</span>
                          </div>
                        )}
                      </div>
                      <RadioGroup 
                        value={paymentStatus} 
                        onValueChange={setPaymentStatus}
                        className={hasFieldError('Tipo de Pago') ? 'border border-destructive rounded-lg p-2' : ''}
                      >
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="contado" id="contado" />
                          <Label htmlFor="contado" className="cursor-pointer">Pago de contado</Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="parcial" id="parcial" />
                          <Label htmlFor="parcial" className="cursor-pointer">Pago parcial</Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="credito" id="credito" />
                          <Label htmlFor="credito" className="cursor-pointer">Quedó a deber</Label>
                        </div>
                       </RadioGroup>

                      {/* Campo para monto abonado en pago parcial */}
                      {paymentStatus === "parcial" && (
                        <div className="ml-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 space-y-3">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Label htmlFor="monto-abonado">Monto que se va a pagar</Label>
                              <span className="text-destructive text-sm">*</span>
                              {hasFieldError('Monto Abonado') && (
                                <div className="flex items-center text-destructive">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Requerido</span>
                                </div>
                              )}
                            </div>
                            <Input 
                              id="monto-abonado" 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
                              value={montoAbonado}
                              onChange={(e) => setMontoAbonado(e.target.value)}
                              className={hasFieldError('Monto Abonado') ? 'border-destructive' : ''}
                            />
                          </div>
                          
                          {montoTotal && montoAbonado && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-white dark:bg-gray-900 rounded border">
                              {hasDiscount && discountAmount ? (
                                <>
                                  <div className="text-center">
                                    <p className="text-sm text-muted-foreground">Total original</p>
                                    <p className="text-sm line-through text-muted-foreground">${parseFloat(montoTotal).toFixed(2)}</p>
                                    <p className="text-sm text-muted-foreground">Descuento: -${parseFloat(discountAmount).toFixed(2)}</p>
                                    <p className="text-lg font-semibold text-primary">
                                      ${(parseFloat(montoTotal) - parseFloat(discountAmount)).toFixed(2)}
                                    </p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm text-muted-foreground">Se pagará ahora</p>
                                    <p className="text-lg font-semibold text-green-600">${parseFloat(montoAbonado).toFixed(2)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm text-muted-foreground">Queda pendiente</p>
                                    <p className="text-lg font-semibold text-orange-600">
                                      ${((parseFloat(montoTotal) - parseFloat(discountAmount)) - parseFloat(montoAbonado)).toFixed(2)}
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="text-center">
                                    <p className="text-sm text-muted-foreground">Total de la venta</p>
                                    <p className="text-lg font-semibold text-primary">${parseFloat(montoTotal).toFixed(2)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm text-muted-foreground">Se pagará ahora</p>
                                    <p className="text-lg font-semibold text-green-600">${parseFloat(montoAbonado).toFixed(2)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm text-muted-foreground">Queda pendiente</p>
                                    <p className="text-lg font-semibold text-orange-600">
                                      ${(parseFloat(montoTotal) - parseFloat(montoAbonado)).toFixed(2)}
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                    </div>

                    <Separator />

                     {/* Base de Datos de Clientes */}
                     <div className="space-y-4">
                       <div className="flex items-center space-x-2">
                         <Label className="font-medium">Base de Datos de Clientes</Label>
                         <span className="text-xs text-muted-foreground">
                           {paymentStatus === "contado" ? "Opcional - Para control y seguimiento" : "Obligatorio para cuentas por cobrar"}
                         </span>
                       </div>
                       
                       {(paymentStatus === "parcial" || paymentStatus === "credito") && (
                         <Alert>
                           <AlertCircle className="h-4 w-4" />
                           <AlertDescription>
                             Se registrará en Cuentas por Cobrar para análisis de vencimientos
                           </AlertDescription>
                         </Alert>
                       )}

                       {/* Selector de tipo de cliente */}
                       <div className="space-y-2">
                         <Label className="font-medium">Tipo de Cliente</Label>
                         <Select value={tipoCliente} onValueChange={(value) => {
                           setTipoCliente(value);
                           // Reset client data when switching types
                           setClienteSeleccionado("");
                           setClienteNombre("");
                           setClienteTelefono("");
                           setClienteEmail("");
                           setClienteRFC("");
                         }}>
                           <SelectTrigger>
                             <SelectValue placeholder="Selecciona el tipo de cliente" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="nuevo">Cliente Nuevo</SelectItem>
                             <SelectItem value="recurrente">Cliente Recurrente</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       {/* Cliente recurrente - selector */}
                       {tipoCliente === "recurrente" && (
                         <div className="space-y-2">
                           <Label htmlFor="cliente-existente">Seleccionar Cliente</Label>
                           <Select value={clienteSeleccionado} onValueChange={(value) => {
                             setClienteSeleccionado(value);
                             const cliente = clientes.find(c => c.id === value);
                             if (cliente) {
                               setClienteNombre(cliente.nombre);
                               setClienteTelefono(cliente.telefono || "");
                               setClienteEmail(cliente.email || "");
                               setClienteRFC(cliente.rfc || "");
                             }
                           }}>
                             <SelectTrigger>
                               <SelectValue placeholder="Buscar cliente existente" />
                             </SelectTrigger>
                             <SelectContent>
                               {loadingClientes ? (
                                 <SelectItem value="" disabled>Cargando clientes...</SelectItem>
                               ) : clientes.length === 0 ? (
                                 <SelectItem value="" disabled>No hay clientes registrados</SelectItem>
                               ) : (
                                 clientes.map((cliente) => (
                                   <SelectItem key={cliente.id} value={cliente.id}>
                                     {cliente.nombre} {cliente.telefono && `- ${cliente.telefono}`}
                                   </SelectItem>
                                 ))
                               )}
                             </SelectContent>
                           </Select>
                           {clienteSeleccionado && (
                             <p className="text-xs text-muted-foreground text-green-600">
                               ✓ Datos del cliente cargados automáticamente
                             </p>
                           )}
                         </div>
                       )}

                       {/* Campos de cliente - solo si es nuevo o si se seleccionó uno recurrente */}
                       {(tipoCliente === "nuevo" || (tipoCliente === "recurrente" && clienteSeleccionado)) && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label htmlFor="cliente-nombre">Nombre del Cliente</Label>
                           <Input
                             id="cliente-nombre"
                             type="text"
                             placeholder="Nombre completo"
                             value={clienteNombre}
                             onChange={(e) => setClienteNombre(e.target.value)}
                             disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""}
                           />
                         </div>
                         <div className="space-y-2">
                           <div className="flex items-center space-x-2">
                             <Label htmlFor="cliente-telefono">Número de Teléfono</Label>
                             {(paymentStatus === "parcial" || paymentStatus === "credito") && (
                               <span className="text-destructive text-sm">*</span>
                             )}
                             {hasFieldError('Teléfono del Cliente') && (
                               <div className="flex items-center text-destructive">
                                 <AlertCircle className="h-3 w-3 mr-1" />
                                 <span className="text-xs">Requerido</span>
                               </div>
                             )}
                           </div>
                           <Input
                             id="cliente-telefono"
                             type="tel"
                             placeholder="Ej: +52 55 1234 5678"
                             value={clienteTelefono}
                             onChange={(e) => setClienteTelefono(e.target.value)}
                             className={hasFieldError('Teléfono del Cliente') ? 'border-destructive' : ''}
                             disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""}
                           />
                         </div>
                         <div className="space-y-2">
                           <div className="flex items-center space-x-2">
                             <Label htmlFor="cliente-email">Correo Electrónico</Label>
                             {(paymentStatus === "parcial" || paymentStatus === "credito") && (
                               <span className="text-destructive text-sm">*</span>
                             )}
                             {hasFieldError('Email del Cliente') && (
                               <div className="flex items-center text-destructive">
                                 <AlertCircle className="h-3 w-3 mr-1" />
                                 <span className="text-xs">Requerido</span>
                               </div>
                             )}
                           </div>
                           <Input
                             id="cliente-email"
                             type="email"
                             placeholder="cliente@ejemplo.com"
                             value={clienteEmail}
                             onChange={(e) => setClienteEmail(e.target.value)}
                             className={hasFieldError('Email del Cliente') ? 'border-destructive' : ''}
                             disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""}
                           />
                         </div>
                         <div className="space-y-2">
                           <Label htmlFor="cliente-rfc">RFC (ID Fiscal) - Opcional</Label>
                           <Input
                             id="cliente-rfc"
                             type="text"
                             placeholder="RFC123456ABC1"
                             value={clienteRFC}
                             onChange={(e) => setClienteRFC(e.target.value.toUpperCase())}
                             maxLength={13}
                             disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""}
                           />
                         </div>
                         
                         {/* Fecha de vencimiento para pagos parciales y crédito */}
                         {(paymentStatus === "parcial" || paymentStatus === "credito") && (
                           <div className="space-y-2">
                             <div className="flex items-center space-x-2">
                               <Label htmlFor="fecha-vencimiento">Fecha de Vencimiento</Label>
                               <span className="text-destructive text-sm">*</span>
                               {hasFieldError('Fecha de Vencimiento') && (
                                 <div className="flex items-center text-destructive">
                                   <AlertCircle className="h-3 w-3 mr-1" />
                                   <span className="text-xs">Requerido</span>
                                 </div>
                               )}
                             </div>
                             <Input
                               id="fecha-vencimiento"
                               type="date"
                               value={fechaVencimiento}
                               onChange={(e) => setFechaVencimiento(e.target.value)}
                               className={hasFieldError('Fecha de Vencimiento') ? 'border-destructive' : ''}
                               min={new Date().toISOString().split('T')[0]}
                             />
                             <p className="text-xs text-muted-foreground">
                               Fecha límite para el pago {paymentStatus === "parcial" ? "del monto pendiente" : "completo"}
                             </p>
                           </div>
                         )}
                       </div>
                       )}
                     </div>

                    <Separator />

                    {/* Método de pago - SOLO si es contado o parcial */}
                    {(paymentStatus === "contado" || paymentStatus === "parcial") && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2">
                            <Label className="font-medium">Método de Pago</Label>
                            {hasFieldError('Método de Pago') && (
                              <div className="flex items-center text-destructive">
                                <AlertCircle className="h-4 w-4 mr-1" />
                                <span className="text-xs">Requerido</span>
                              </div>
                            )}
                          </div>
                          <RadioGroup 
                            value={paymentMethod} 
                            onValueChange={setPaymentMethod}
                            className={hasFieldError('Método de Pago') ? 'border border-destructive rounded-lg p-2' : ''}
                          >
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="efectivo" id="efectivo" />
                              <div className="flex items-center space-x-2">
                                <Wallet className="h-4 w-4 text-green-600" />
                                <Label htmlFor="efectivo" className="cursor-pointer">
                                  Efectivo <span className="text-sm text-muted-foreground">(se registra en Caja)</span>
                                </Label>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="tarjeta" id="tarjeta" />
                              <div className="flex items-center space-x-2">
                                <CreditCard className="h-4 w-4 text-blue-800" />
                                <Label htmlFor="tarjeta" className="cursor-pointer">
                                  Tarjeta <span className="text-sm text-muted-foreground">(se registra en Bancos)</span>
                                </Label>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                      </>
                    )}

                    {/* Comments section */}
                    <div className="space-y-2">
                      <Label htmlFor="comentarios">Comentarios de la venta (Opcional)</Label>
                      <Textarea
                        id="comentarios"
                        placeholder="Agrega cualquier comentario o nota sobre esta venta..."
                        value={comentarios}
                        onChange={(e) => setComentarios(e.target.value)}
                        rows={3}
                        className="resize-none"
                      />
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button 
                        size="lg" 
                        className="px-8"
                        onClick={handleSubmitIngreso}
                        disabled={isSubmitting}
                      >
                        <Calculator className="mr-2 h-4 w-4" />
                        {isSubmitting ? "Registrando..." : "Registrar Ingreso"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: RESUMEN DE VENTAS */}
          <TabsContent value="resumen" className="mt-6">
            {/* Resumen de Ventas, Descuentos e Ingreso Neto */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Día */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-primary">Resumen del Día</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Ventas Brutas:</span>
                    <span className="font-semibold">
                      {loadingVentas ? "..." : `$${ventasResumen.ventasDelDia.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-destructive">Descuentos:</span>
                    <span className="font-semibold text-destructive">
                      {loadingVentas ? "..." : `$${ventasResumen.descuentosDelDia.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-chart-2">Ingreso Neto:</span>
                    <span className="text-lg font-bold text-chart-2">
                      {loadingVentas ? "..." : `$${ventasResumen.ingresoNetoDelDia.toLocaleString()}`}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Mes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-primary">Resumen del Mes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Ventas Brutas:</span>
                    <span className="font-semibold">
                      {loadingVentas ? "..." : `$${ventasResumen.ventasDelMes.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-destructive">Descuentos:</span>
                    <span className="font-semibold text-destructive">
                      {loadingVentas ? "..." : `$${ventasResumen.descuentosDelMes.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-chart-2">Ingreso Neto:</span>
                    <span className="text-lg font-bold text-chart-2">
                      {loadingVentas ? "..." : `$${ventasResumen.ingresoNetoDelMes.toLocaleString()}`}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Año */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-primary">Resumen del Año</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Ventas Brutas:</span>
                    <span className="font-semibold">
                      {loadingVentas ? "..." : `$${ventasResumen.ventasDelAno.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-destructive">Descuentos:</span>
                    <span className="font-semibold text-destructive">
                      {loadingVentas ? "..." : `$${ventasResumen.descuentosDelAno.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-chart-2">Ingreso Neto:</span>
                    <span className="text-lg font-bold text-chart-2">
                      {loadingVentas ? "..." : `$${ventasResumen.ingresoNetoDelAno.toLocaleString()}`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de barras - Ventas por día */}
              <Card>
                <CardHeader>
                  <CardTitle>Ventas por Tipo</CardTitle>
                  <CardDescription>Distribución de ingresos por categoría</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Cargando gráfico...
                    </div>
                  ) : transacciones.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={
                          Object.entries(
                            transacciones.reduce((acc, t) => {
                              acc[t.tipo_ingreso] = (acc[t.tipo_ingreso] || 0) + t.monto_total;
                              return acc;
                            }, {} as Record<string, number>)
                          ).map(([tipo, monto]) => ({ tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1), monto }))
                        }>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="tipo" />
                          <YAxis />
                          <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Monto']} />
                          <Bar dataKey="monto" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Gráfico circular - Métodos de pago */}
              <Card>
                <CardHeader>
                  <CardTitle>Métodos de Pago</CardTitle>
                  <CardDescription>Distribución por forma de pago</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Cargando gráfico...
                    </div>
                  ) : transacciones.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={
                              Object.entries(
                                transacciones.reduce((acc, t) => {
                                  // Manejar métodos de pago vacíos o nulos
                                  const metodo = t.metodo_pago || 'Sin método definido';
                                  acc[metodo] = (acc[metodo] || 0) + t.monto_total;
                                  return acc;
                                }, {} as Record<string, number>)
                              ).map(([metodo, monto]) => ({ 
                                metodo: metodo === 'efectivo' ? 'Efectivo' : 
                                        metodo === 'tarjeta' ? 'Tarjeta' : 
                                        metodo === 'Sin método definido' ? 'A Crédito' : 
                                        metodo.charAt(0).toUpperCase() + metodo.slice(1), 
                                monto,
                                porcentaje: ((monto / transacciones.reduce((sum, t) => sum + t.monto_total, 0)) * 100).toFixed(1)
                              }))
                            }
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ metodo, porcentaje, x, y }) => (
                              <text 
                                x={x} 
                                y={y} 
                                fill="hsl(var(--foreground))" 
                                textAnchor={x > 150 ? 'start' : 'end'} 
                                dominantBaseline="central"
                                className="font-bold text-sm"
                                style={{ fontWeight: '700', fontSize: '14px' }}
                              >
                                {`${metodo} ${porcentaje}%`}
                              </text>
                            )}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="monto"
                          >
                            {Object.entries(
                              transacciones.reduce((acc, t) => {
                                acc[t.metodo_pago] = (acc[t.metodo_pago] || 0) + t.monto_total;
                                return acc;
                              }, {} as Record<string, number>)
                            ).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--secondary))"} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Monto']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Analytics adicionales */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              {/* Número de ventas por tipo */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transacciones por Tipo</CardTitle>
                  <CardDescription>Cantidad y monto promedio por categoría</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="space-y-3">
                      <div className="h-4 bg-muted rounded animate-pulse"></div>
                      <div className="h-4 bg-muted rounded animate-pulse"></div>
                      <div className="h-4 bg-muted rounded animate-pulse"></div>
                    </div>
                  ) : transacciones.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No hay datos disponibles</p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(
                        transacciones.reduce((acc, t) => {
                          if (!acc[t.tipo_ingreso]) {
                            acc[t.tipo_ingreso] = { count: 0, total: 0 };
                          }
                          acc[t.tipo_ingreso].count += 1;
                          acc[t.tipo_ingreso].total += t.monto_total;
                          return acc;
                        }, {} as Record<string, { count: number; total: number }>)
                      ).map(([tipo, stats]) => (
                        <div key={tipo} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium capitalize">{tipo}</span>
                            <div className="text-right">
                              <div className="text-sm font-semibold">{stats.count} ventas</div>
                              <div className="text-xs text-muted-foreground">
                                Promedio: ${(stats.total / stats.count).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ 
                                width: `${(stats.count / transacciones.length) * 100}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Análisis por cuenta */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Por Cuenta Principal</CardTitle>
                  <CardDescription>Distribución de ingresos por cuenta contable</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="space-y-3">
                      <div className="h-4 bg-muted rounded animate-pulse"></div>
                      <div className="h-4 bg-muted rounded animate-pulse"></div>
                      <div className="h-4 bg-muted rounded animate-pulse"></div>
                    </div>
                  ) : transacciones.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No hay datos disponibles</p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(
                        transacciones.reduce((acc, t) => {
                          if (!acc[t.cuenta_principal_codigo]) {
                            acc[t.cuenta_principal_codigo] = { count: 0, total: 0 };
                          }
                          acc[t.cuenta_principal_codigo].count += 1;
                          acc[t.cuenta_principal_codigo].total += t.monto_total;
                          return acc;
                        }, {} as Record<string, { count: number; total: number }>)
                      ).slice(0, 5).map(([cuenta, stats]) => (
                        <div key={cuenta} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{cuenta}</span>
                            <div className="text-right">
                              <div className="text-sm font-semibold">${stats.total.toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground">{stats.count} trans.</div>
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-chart-2 h-2 rounded-full" 
                              style={{ 
                                width: `${(stats.total / transacciones.reduce((sum, t) => sum + t.monto_total, 0)) * 100}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Métricas de rendimiento */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Métricas Clave</CardTitle>
                  <CardDescription>Indicadores de rendimiento</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="space-y-4">
                      <div className="h-8 bg-muted rounded animate-pulse"></div>
                      <div className="h-8 bg-muted rounded animate-pulse"></div>
                      <div className="h-8 bg-muted rounded animate-pulse"></div>
                    </div>
                  ) : transacciones.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No hay datos disponibles</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center p-3 bg-primary/5 rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {transacciones.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Transacciones</div>
                      </div>
                      
                      <div className="text-center p-3 bg-chart-2/5 rounded-lg">
                        <div className="text-2xl font-bold text-chart-2">
                          ${(transacciones.reduce((sum, t) => sum + t.monto_total, 0) / transacciones.length).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Ticket Promedio</div>
                      </div>
                      
                      <div className="text-center p-3 bg-destructive/5 rounded-lg">
                        <div className="text-2xl font-bold text-destructive">
                          {((transacciones.reduce((sum, t) => sum + (t.monto_descuento || 0), 0) / 
                            transacciones.reduce((sum, t) => sum + t.monto_total, 0)) * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">% Descuento Promedio</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Gráficos de ventas históricas */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ventas diarias por día */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ventas Diarias</CardTitle>
                  <CardDescription>Evolución de ventas día a día</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="h-80 flex items-center justify-center">
                      <div className="text-muted-foreground">Cargando datos diarios...</div>
                    </div>
                  ) : transacciones.length === 0 ? (
                    <div className="h-80 flex items-center justify-center">
                      <div className="text-muted-foreground">No hay datos para mostrar</div>
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={
                          Object.entries(
                            transacciones.reduce((acc, t) => {
                              const fecha = new Date(t.created_at).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit'
                              });
                              if (!acc[fecha]) {
                                acc[fecha] = { 
                                  ventas: 0, 
                                  descuentos: 0, 
                                  neto: 0, 
                                  transacciones: 0 
                                };
                              }
                              acc[fecha].ventas += t.monto_total;
                              acc[fecha].descuentos += t.monto_descuento || 0;
                              acc[fecha].neto += t.monto_neto;
                              acc[fecha].transacciones += 1;
                              return acc;
                            }, {} as Record<string, { ventas: number; descuentos: number; neto: number; transacciones: number }>)
                          )
                          .map(([fecha, data]) => ({
                            fecha,
                            ventas: data.ventas,
                            descuentos: data.descuentos,
                            neto: data.neto,
                            transacciones: data.transacciones
                          }))
                          .sort((a, b) => {
                            const [diaA, mesA] = a.fecha.split('/').map(Number);
                            const [diaB, mesB] = b.fecha.split('/').map(Number);
                            return mesA !== mesB ? mesA - mesB : diaA - diaB;
                          })
                          .slice(-15) // Últimos 15 días con datos
                        }>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="fecha" 
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            fontSize={12}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value, name) => [`$${Number(value).toLocaleString()}`, name]}
                            labelFormatter={(label) => `Fecha: ${label}`}
                          />
                          <Bar dataKey="ventas" fill="hsl(var(--primary))" name="Ventas Brutas" />
                          <Bar dataKey="descuentos" fill="hsl(var(--destructive))" name="Descuentos" />
                          <Bar dataKey="neto" fill="hsl(var(--chart-2))" name="Ventas Netas" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ventas mensuales por mes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ventas Mensuales</CardTitle>
                  <CardDescription>Evolución de ventas mes a mes</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="h-80 flex items-center justify-center">
                      <div className="text-muted-foreground">Cargando datos mensuales...</div>
                    </div>
                  ) : transacciones.length === 0 ? (
                    <div className="h-80 flex items-center justify-center">
                      <div className="text-muted-foreground">No hay datos para mostrar</div>
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={
                          Object.entries(
                            transacciones.reduce((acc, t) => {
                              const fecha = new Date(t.created_at);
                              const mesAno = `${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
                              if (!acc[mesAno]) {
                                acc[mesAno] = { 
                                  ventas: 0, 
                                  descuentos: 0, 
                                  neto: 0, 
                                  transacciones: 0 
                                };
                              }
                              acc[mesAno].ventas += t.monto_total;
                              acc[mesAno].descuentos += t.monto_descuento || 0;
                              acc[mesAno].neto += t.monto_neto;
                              acc[mesAno].transacciones += 1;
                              return acc;
                            }, {} as Record<string, { ventas: number; descuentos: number; neto: number; transacciones: number }>)
                          )
                          .map(([mesAno, data]) => ({
                            mes: mesAno,
                            ventas: data.ventas,
                            descuentos: data.descuentos,
                            neto: data.neto,
                            transacciones: data.transacciones
                          }))
                          .sort((a, b) => {
                            const [mesA, anoA] = a.mes.split('/').map(Number);
                            const [mesB, anoB] = b.mes.split('/').map(Number);
                            return anoA !== anoB ? anoA - anoB : mesA - mesB;
                          })
                          .slice(-12) // Últimos 12 meses con datos
                        }>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="mes" 
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            fontSize={12}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value, name) => [`$${Number(value).toLocaleString()}`, name]}
                            labelFormatter={(label) => `Mes: ${label}`}
                          />
                          <Bar dataKey="ventas" fill="hsl(var(--primary))" name="Ventas Brutas" />
                          <Bar dataKey="descuentos" fill="hsl(var(--destructive))" name="Descuentos" />
                          <Bar dataKey="neto" fill="hsl(var(--chart-2))" name="Ventas Netas" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Lista de transacciones detallada */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Registro Detallado de Ventas</CardTitle>
                <CardDescription>
                  Historial completo de transacciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransacciones ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Cargando transacciones...
                  </div>
                ) : transacciones.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay ventas registradas aún
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm font-medium text-muted-foreground mb-4">
                      Últimas {transacciones.length} transacciones
                    </div>
                    <div className="space-y-3">
                      {transacciones.map((transaccion) => (
                        <div key={transaccion.id} className="border rounded-lg p-4 hover:bg-muted/50">
                          <div className="flex items-start gap-3 mb-2">
                            {/* Imagen del producto si es precargado */}
                            {transaccion.tipo_ingreso === 'precargados' && (() => {
                              const producto = productos.find(p => p.nombre === transaccion.descripcion);
                              return producto?.imagen_url ? (
                                <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                  <img 
                                    src={producto.imagen_url} 
                                    alt={producto.nombre}
                                    className="w-full h-full object-cover"
                                  />
                                {transaccion.comentarios && (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    <span className="font-medium">Comentarios:</span> {transaccion.comentarios}
                                  </div>
                                )}
                              </div>
                              ) : null;
                            })()}
                            
                            <div className="flex justify-between items-start flex-1">
                              <div className="flex-1">
                                <p className="font-medium">{transaccion.descripcion}</p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                  <span className="capitalize">{transaccion.tipo_ingreso}</span>
                                  <span>•</span>
                                  <span className="capitalize">{transaccion.metodo_pago}</span>
                                  <span>•</span>
                                  <span className="capitalize">{transaccion.tipo_pago}</span>
                                </div>
                                {/* Información contable */}
                                <div className="mt-2 p-2 bg-muted/30 rounded-md">
                                  <div className="text-xs font-medium text-muted-foreground mb-1">Información Contable:</div>
                                  <div className="text-xs space-y-1">
                                    <div>
                                      <span className="font-medium">Cuenta Principal:</span> {transaccion.cuenta_principal_codigo}
                                      {transaccion.cuenta_principal_codigo === '4001' ? ' - Ventas' : 
                                       transaccion.cuenta_principal_codigo === '4004' ? ' - Otros Ingresos' : ''}
                                    </div>
                                    {transaccion.subcuenta_id ? (
                                      <div>
                                        <span className="font-medium">Subcuenta:</span> {
                                          transaccion.subcuentas?.nombre || 
                                          (() => {
                                            const subcuenta = subcuentas.find(s => s.id === transaccion.subcuenta_id);
                                            return subcuenta?.nombre || 'Subcuenta no encontrada';
                                          })()
                                        }
                                      </div>
                                    ) : (
                                      <div className="text-muted-foreground">
                                        <span className="font-medium">Subcuenta:</span> Sin subcuenta asignada
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="font-bold text-primary">${transaccion.monto_total.toFixed(2)}</p>
                                {transaccion.monto_descuento > 0 && (
                                  <p className="text-sm text-red-600">
                                    -${transaccion.monto_descuento.toFixed(2)} desc.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>
                              {new Date(transaccion.created_at).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="font-medium text-green-600">
                              Neto: ${transaccion.monto_neto.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: CATÁLOGO DE PRODUCTOS */}
          <TabsContent value="catalogo" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Catálogo de Productos
                  <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Producto
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Agregar Nuevo Producto</DialogTitle>
                        <DialogDescription>
                          Completa la información del producto para agregarlo al catálogo.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="product-name" className="text-right">
                            Nombre
                          </Label>
                          <Input
                            id="product-name"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            className="col-span-3"
                            placeholder="Nombre del producto"
                          />
                        </div>
                        
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="product-image" className="text-right">
                            Imagen
                          </Label>
                          <Input
                            id="product-image"
                            type="file"
                            accept="image/*"
                            onChange={(e) => setProductImage(e.target.files?.[0] || null)}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="product-price" className="text-right">
                            Precio
                          </Label>
                          <Input
                            id="product-price"
                            type="number"
                            value={productPrice}
                            onChange={(e) => setProductPrice(e.target.value)}
                            className="col-span-3"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="product-account" className="text-right">
                            Cuenta
                          </Label>
                          <div className="col-span-3 flex items-center p-2 border rounded-md bg-muted/50">
                            <span className="text-sm font-medium">4001 - Ventas</span>
                            <span className="text-xs text-muted-foreground ml-2">(cuenta fija)</span>
                          </div>
                        </div>
                        
                        {/* Selector de Subcuenta */}
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="product-subcuenta" className="text-right">
                            Subcuenta
                          </Label>
                          <Select value={productSubcuenta} onValueChange={(v) => setProductSubcuenta(v === "none" ? "" : v)}>
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Sin subcuenta (usar cuenta principal)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin subcuenta (usar cuenta principal)</SelectItem>
                              {subcuentas
                                .filter(subcuenta => subcuenta.cuenta_madre_codigo === "4001")
                                .map((subcuenta) => (
                                  <SelectItem key={subcuenta.id} value={subcuenta.id}>
                                    {subcuenta.nombre}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="product-description" className="text-right">
                            Descripción
                          </Label>
                          <Textarea
                            id="product-description"
                            value={productDescription}
                            onChange={(e) => setProductDescription(e.target.value)}
                            className="col-span-3"
                            placeholder="Descripción opcional del producto"
                            rows={3}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsProductDialogOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleSubmitProduct} 
                          disabled={isSubmittingProduct}
                        >
                          {isSubmittingProduct ? "Guardando..." : "Guardar Producto"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
                <CardDescription>
                  Gestiona el catálogo de productos y servicios con cuentas contables asignadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Recomendación:</strong> Asignar subcuentas a cada producto ayuda a llevar un mejor control contable. 
                    La cuenta predeterminada es "4001 - Ventas".
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-6">
                  {loadingProductosServicios ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : productosServicios.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay productos de servicios registrados aún
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Productos con subcuentas */}
                      {subcuentas
                        .filter(subcuenta => subcuenta.cuenta_madre_codigo === "4001")
                        .map(subcuenta => {
                          const productosSubcuenta = productosServicios.filter(p => p.subcuenta_id === subcuenta.id);
                          if (productosSubcuenta.length === 0) return null;
                          
                          return (
                            <Card key={subcuenta.id}>
                              <CardHeader>
                                <CardTitle className="text-lg flex items-center">
                                  <Package className="mr-2 h-5 w-5" />
                                  Subcuenta: {subcuenta.nombre}
                                </CardTitle>
                                <CardDescription>
                                  {productosSubcuenta.length} producto{productosSubcuenta.length !== 1 ? 's' : ''}
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {productosSubcuenta.map(producto => (
                                    <div key={producto.id} className="border rounded-lg p-4 space-y-3">
                                      {producto.imagen_url && (
                                        <div className="aspect-square w-full max-w-24 mx-auto">
                                          <img 
                                            src={producto.imagen_url} 
                                            alt={producto.nombre}
                                            className="w-full h-full object-cover rounded-md"
                                          />
                                        </div>
                                      )}
                                      <div>
                                        <h4 className="font-semibold">{producto.nombre}</h4>
                                        {producto.descripcion && (
                                          <p className="text-sm text-muted-foreground">{producto.descripcion}</p>
                                        )}
                                        <p className="text-lg font-bold text-primary">${producto.precio.toFixed(2)}</p>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => deleteProducto.mutate(producto.id)}
                                        className="w-full text-destructive hover:text-destructive"
                                      >
                                        Eliminar
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      
                      {/* Productos sin subcuenta (cuenta general) */}
                      {(() => {
                        const productosSinSubcuenta = productosServicios.filter(p => !p.subcuenta_id);
                        if (productosSinSubcuenta.length === 0) return null;
                        
                        return (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center">
                                <ShoppingCart className="mr-2 h-5 w-5" />
                                Cuenta General: 4001 - Ventas
                              </CardTitle>
                              <CardDescription>
                                {productosSinSubcuenta.length} producto{productosSinSubcuenta.length !== 1 ? 's' : ''} sin subcuenta específica
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {productosSinSubcuenta.map(producto => (
                                  <div key={producto.id} className="border rounded-lg p-4 space-y-3">
                                    {producto.imagen_url && (
                                      <div className="aspect-square w-full max-w-24 mx-auto">
                                        <img 
                                          src={producto.imagen_url} 
                                          alt={producto.nombre}
                                          className="w-full h-full object-cover rounded-md"
                                        />
                                      </div>
                                    )}
                                    <div>
                                      <h4 className="font-semibold">{producto.nombre}</h4>
                                      {producto.descripcion && (
                                        <p className="text-sm text-muted-foreground">{producto.descripcion}</p>
                                      )}
                                      <p className="text-lg font-bold text-primary">${producto.precio.toFixed(2)}</p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => deleteProducto.mutate(producto.id)}
                                      className="w-full text-destructive hover:text-destructive"
                                    >
                                      Eliminar
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegistroIngresos;