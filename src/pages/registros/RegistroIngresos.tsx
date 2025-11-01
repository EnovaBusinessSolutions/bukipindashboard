import React, { useState, useEffect } from "react";
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
import { AlertCircle, Plus, ShoppingCart, Package, FileText, Gift, CreditCard, Wallet, Calculator, Users, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useVentasResumen } from "@/hooks/useVentasResumen";
import { useTransaccionesRecientes } from "@/hooks/useTransaccionesRecientes";
import { useSubcuentas } from "@/hooks/useSubcuentas";
import { useProductos, useProductosServicios, useCreateProducto, useUpdateProducto, useDeleteProducto } from "@/hooks/useProductos";
import { useClientes, useCreateCliente } from "@/hooks/useClientes";

// Función helper para formatear montos con separador de comas
const formatMonto = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Función para formatear cifras según la escala seleccionada
const formatCifra = (value: number, scale: "general" | "miles" | "millones"): string => {
  let scaledValue = value;
  let suffix = "";
  
  if (scale === "miles") {
    scaledValue = value / 1000;
    suffix = " K";
  } else if (scale === "millones") {
    scaledValue = value / 1000000;
    suffix = " M";
  }
  
  return scaledValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
};

const RegistroIngresos = () => {
  const {
    ventasResumen,
    loading: loadingVentas,
    refetch: refetchVentas
  } = useVentasResumen();
  const {
    transacciones,
    loading: loadingTransacciones,
    refetch: refetchTransacciones
  } = useTransaccionesRecientes(10);
  const {
    data: subcuentas = []
  } = useSubcuentas();
  const {
    data: productos = [],
    isLoading: loadingProductos,
    refetch: refetchProductos
  } = useProductos();
  const {
    data: productosServicios = [],
    isLoading: loadingProductosServicios,
    refetch: refetchProductosServicios
  } = useProductosServicios();
  const {
    data: clientes = [],
    isLoading: loadingClientes
  } = useClientes();
  const createProducto = useCreateProducto();
  const updateProducto = useUpdateProducto();
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
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]); // Advertencias de duplicados
  
  // Estados para alerta de inventario negativo
  const [showNegativeStockDialog, setShowNegativeStockDialog] = useState(false);
  const [negativeStockData, setNegativeStockData] = useState<{productName: string; requested: number; available: number; costoPorUnidad: number; costoTotal: number} | null>(null);
  const [tipoCostoInventarioNegativo, setTipoCostoInventarioNegativo] = useState<"historico" | "personalizado">("historico");
  const [costoPersonalizado, setCostoPersonalizado] = useState("");
  
  // Estado para el período de análisis
  const [periodFilter, setPeriodFilter] = useState<"diario" | "mensual" | "anual">("diario");
  
  // Estado para el formato de cifras
  const [scaleFormat, setScaleFormat] = useState<"general" | "miles" | "millones">("general");

  // Estados para filtros del resumen
  const [filtroFechaInicio, setFiltroFechaInicio] = useState("");
  const [filtroFechaFin, setFiltroFechaFin] = useState("");
  const [filtroTipoIngreso, setFiltroTipoIngreso] = useState("");
  const [filtroCuenta, setFiltroCuenta] = useState("");
  const [filtroSubcuenta, setFiltroSubcuenta] = useState("");
  
  // Estado para asientos contables en diálogo
  const [currentAsientos, setCurrentAsientos] = useState<any>(null);
  const [loadingAsientos, setLoadingAsientos] = useState(false);

  // Estados para productos de inventario
  const [selectedInventoryProductId, setSelectedInventoryProductId] = useState("");
  const [inventoryProductPrice, setInventoryProductPrice] = useState("");
  const [inventoryQuantity, setInventoryQuantity] = useState("1");
  const [availableStock, setAvailableStock] = useState(0);
  const [usePrecioRegistrado, setUsePrecioRegistrado] = useState(true);

  // Estados para productos precargados - ahora manejando múltiples productos
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productUnitPrice, setProductUnitPrice] = useState("");
  const [productQuantity, setProductQuantity] = useState("1");
  const [productDiscount, setProductDiscount] = useState("0");
  const [selectedProducts, setSelectedProducts] = useState<Array<{
    id: string;
    nombre: string;
    precio: number;
    cantidad: number;
    descuento: number;
    subtotal: number;
    imagen_url?: string;
  }>>([]);

  // Estados para el catálogo de productos
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productAccount, setProductAccount] = useState("4001"); // Fijo en ventas
  const [productSubcuenta, setProductSubcuenta] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // Estados para editar producto
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editProductPrice, setEditProductPrice] = useState("");
  const [editProductDescription, setEditProductDescription] = useState("");
  const [editProductImage, setEditProductImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  // Filtrar productos con stock disponible para inventario
  const productosInventario = productos.filter(producto => producto.cantidad_stock && producto.cantidad_stock > 0 || producto.cantidad_comprada && producto.cantidad_comprada > 0);

  // Función para manejar selección de producto de inventario
  const handleInventoryProductSelection = (productId: string) => {
    setSelectedInventoryProductId(productId);
    const selectedProduct = productosInventario.find(p => p.id === productId);
    if (selectedProduct) {
      // Usar precio de venta si está disponible, si no, usar costo unitario
      const precioVenta = (selectedProduct as any).precio_venta;
      const precioAUsar = precioVenta && precioVenta > 0 ? precioVenta.toString() : selectedProduct.costo_unitario?.toString() || selectedProduct.precio.toString();

      // Si tiene precio de venta registrado, activar esa opción por defecto
      const tienePrecioRegistrado = precioVenta && precioVenta > 0;
      setUsePrecioRegistrado(tienePrecioRegistrado);
      setInventoryProductPrice(precioAUsar);
      setAvailableStock(selectedProduct.cantidad_stock || 0);
      // Autocompletar descripción
      setDescripcion(`Venta de ${selectedProduct.nombre}`);
      // Calcular monto total
      const precioNumerico = precioVenta && precioVenta > 0 ? precioVenta : selectedProduct.costo_unitario || selectedProduct.precio;
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

  // Función para agregar producto precargado a la lista
  const handleAddProductToList = () => {
    if (!selectedProductId) return;
    
    const selectedProduct = productos.find(p => p.id === selectedProductId);
    if (!selectedProduct) return;

    const cantidad = parseFloat(productQuantity) || 1;
    const descuento = parseFloat(productDiscount) || 0;
    const subtotalSinDescuento = selectedProduct.precio * cantidad;
    const subtotal = Math.max(0, subtotalSinDescuento - descuento);

    // Verificar si el producto ya está en la lista
    const existingProductIndex = selectedProducts.findIndex(p => p.id === selectedProductId);
    
    if (existingProductIndex !== -1) {
      // Si ya existe, actualizar la cantidad y recalcular
      const updatedProducts = [...selectedProducts];
      updatedProducts[existingProductIndex].cantidad += cantidad;
      updatedProducts[existingProductIndex].descuento += descuento;
      const nuevoSubtotalSinDescuento = updatedProducts[existingProductIndex].precio * updatedProducts[existingProductIndex].cantidad;
      updatedProducts[existingProductIndex].subtotal = Math.max(0, nuevoSubtotalSinDescuento - updatedProducts[existingProductIndex].descuento);
      setSelectedProducts(updatedProducts);
    } else {
      // Si no existe, agregarlo a la lista
      setSelectedProducts([...selectedProducts, {
        id: selectedProduct.id,
        nombre: selectedProduct.nombre,
        precio: selectedProduct.precio,
        cantidad: cantidad,
        descuento: descuento,
        subtotal: subtotal,
        imagen_url: selectedProduct.imagen_url
      }]);
    }

    // Limpiar selección
    setSelectedProductId("");
    setProductQuantity("1");
    setProductUnitPrice("");
    setProductDiscount("0");
  };

  // Función para remover producto de la lista
  const handleRemoveProductFromList = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };

  // Calcular total de productos precargados
  useEffect(() => {
    if (selectedIncomeType === 'precargados' && selectedProducts.length > 0) {
      const total = selectedProducts.reduce((sum, p) => sum + p.subtotal, 0).toFixed(2);
      setMontoTotal(total);
      setDescripcion(`Venta de ${selectedProducts.length} producto(s)`);
    }
  }, [selectedProducts, selectedIncomeType]);

  // Función para manejar selección de producto precargado (para actualizar precio)
  const handleProductSelection = (productId: string) => {
    setSelectedProductId(productId);
    const selectedProduct = productos.find(p => p.id === productId);
    if (selectedProduct) {
      setProductUnitPrice(selectedProduct.precio.toString());
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
      if (selectedProducts.length === 0) errors.push('Debe agregar al menos un producto');
    } else if (selectedIncomeType === 'inventariados') {
      if (!selectedInventoryProductId) errors.push('Producto de Inventario');
      if (!inventoryQuantity || parseFloat(inventoryQuantity) <= 0) errors.push('Cantidad');
      // Removida validación de stock - ahora permitimos inventario negativo
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

  // Función para validar duplicados de cliente
  const checkClientDuplicates = (telefono: string, email: string, rfc: string) => {
    const warnings: string[] = [];
    if (!clientes || clientes.length === 0) return warnings;
    clientes.forEach(cliente => {
      if (cliente.telefono && telefono && cliente.telefono.trim() === telefono.trim()) {
        warnings.push(`El teléfono ${telefono} ya está registrado para el cliente "${cliente.nombre}"`);
      }
      if (cliente.email && email && cliente.email.trim().toLowerCase() === email.trim().toLowerCase()) {
        warnings.push(`El correo ${email} ya está registrado para el cliente "${cliente.nombre}"`);
      }
      if (cliente.rfc && rfc && cliente.rfc.trim().toUpperCase() === rfc.trim().toUpperCase()) {
        warnings.push(`El RFC ${rfc} ya está registrado para el cliente "${cliente.nombre}"`);
      }
    });
    return warnings;
  };

  // useEffect para validar duplicados en tiempo real
  useEffect(() => {
    if (tipoCliente === "nuevo" && (clienteTelefono || clienteEmail || clienteRFC)) {
      const warnings = checkClientDuplicates(clienteTelefono, clienteEmail, clienteRFC);
      setDuplicateWarnings(warnings);
    } else {
      setDuplicateWarnings([]);
    }
  }, [clienteTelefono, clienteEmail, clienteRFC, tipoCliente, clientes]);

  // Función para cargar asientos contables relacionados con una transacción
  const loadAsientosContables = async (transaccionId: string) => {
    setLoadingAsientos(true);
    setCurrentAsientos(null);
    try {
      console.log("Cargando asientos para transacción:", transaccionId);
      
      // Buscar el asiento contable por transaccion_ingreso_id
      const { data: asientos, error: asientosError } = await supabase
        .from('asientos_contables')
        .select('*')
        .eq('transaccion_ingreso_id', transaccionId)
        .maybeSingle();

      console.log("Resultado de asientos:", { asientos, asientosError });

      if (asientosError) {
        console.error("Error loading asiento:", asientosError);
        toast({
          title: "Error",
          description: "Error al cargar asientos contables",
          variant: "destructive"
        });
        setLoadingAsientos(false);
        return;
      }

      if (!asientos) {
        console.warn("No se encontró asiento para la transacción:", transaccionId);
        setLoadingAsientos(false);
        return;
      }

      // Obtener los detalles del asiento
      const { data: detalles, error: detallesError } = await supabase
        .from('detalle_asientos')
        .select('*')
        .eq('asiento_id', asientos.id);

      console.log("Resultado de detalles:", { detalles, detallesError });

      if (detallesError) {
        console.error("Error loading detalles:", detallesError);
        toast({
          title: "Error",
          description: "Error al cargar detalles de asientos",
          variant: "destructive"
        });
        setLoadingAsientos(false);
        return;
      }

      // Obtener nombres de cuentas
      const { data: cuentas } = await supabase
        .from('cuentas')
        .select('codigo, nombre');

      const cuentasMap = new Map(cuentas?.map(c => [c.codigo, c.nombre]) || []);

      // Enriquecer detalles con nombres de cuentas
      const detallesEnriquecidos = detalles?.map(d => ({
        ...d,
        cuenta_nombre: cuentasMap.get(d.cuenta_codigo) || d.cuenta_codigo
      })) || [];

      const asientoCompleto = {
        ...asientos,
        detalles: detallesEnriquecidos
      };
      
      console.log("Asiento completo cargado:", asientoCompleto);
      setCurrentAsientos(asientoCompleto);
    } catch (error) {
      console.error("Error en loadAsientosContables:", error);
      toast({
        title: "Error",
        description: "Error inesperado al cargar asientos",
        variant: "destructive"
      });
    } finally {
      setLoadingAsientos(false);
    }
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

    // Verificar stock negativo para productos inventariados
    if (selectedIncomeType === 'inventariados' && selectedInventoryProductId) {
      const cantidadSolicitada = parseFloat(inventoryQuantity || '1');
      if (cantidadSolicitada > availableStock) {
        const selectedProduct = productosInventario.find(p => p.id === selectedInventoryProductId);
        
        // Calcular el costo que se usará para valorar el inventario negativo
        let costoParaInventario = selectedProduct?.costo_unitario || 0;
        
        // Si el producto no tiene costo, calcular el costo promedio histórico
        if (costoParaInventario === 0) {
          const { data: movimientos } = await supabase
            .from('movimientos_inventario')
            .select('costo_unitario, cantidad, tipo_movimiento')
            .eq('producto_id', selectedInventoryProductId)
            .eq('tipo_movimiento', 'compra')
            .order('created_at', { ascending: false });
          
          if (movimientos && movimientos.length > 0) {
            let totalCosto = 0;
            let totalCantidad = 0;
            
            for (const mov of movimientos) {
              if (mov.costo_unitario > 0 && mov.cantidad > 0) {
                totalCosto += mov.costo_unitario * mov.cantidad;
                totalCantidad += mov.cantidad;
              }
            }
            
            if (totalCantidad > 0) {
              costoParaInventario = totalCosto / totalCantidad;
            }
          }
        }
        
        const cantidadNegativa = cantidadSolicitada - availableStock;
        const costoTotal = costoParaInventario * cantidadNegativa;
        
        setNegativeStockData({
          productName: selectedProduct?.nombre || 'Producto',
          requested: cantidadSolicitada,
          available: availableStock,
          costoPorUnidad: costoParaInventario,
          costoTotal: costoTotal
        });
        setShowNegativeStockDialog(true);
        return;
      }
    }

    // Advertir sobre duplicados pero permitir continuar
    if (tipoCliente === "nuevo" && duplicateWarnings.length > 0) {
      const continuar = confirm(`Se detectaron posibles duplicados:\n\n${duplicateWarnings.join('\n')}\n\n¿Deseas continuar registrando este cliente de todas formas?`);
      if (!continuar) {
        return;
      }
    }
    
    await processIngreso();
  };

  // Función separada para procesar el ingreso
  const processIngreso = async () => {
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
      const selectedInventoryProduct = productosInventario.find(p => p.id === selectedInventoryProductId);
      let descripcionToSend = descripcion;
      let montoTotalDerived = Number(montoTotal || '0');
      let subcuentaToSend = null;
      
      if (selectedIncomeType === 'precargados' && selectedProducts.length > 0) {
        // Para múltiples productos, usar la primera subcuenta o null
        const firstProduct = productos.find(p => p.id === selectedProducts[0].id);
        subcuentaToSend = firstProduct?.subcuenta_id || null;
        montoTotalDerived = selectedProducts.reduce((sum, p) => sum + p.subtotal, 0);
        descripcionToSend = `Venta: ${selectedProducts.map(p => `${p.nombre} (x${p.cantidad})`).join(', ')}`;
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
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }
      const {
        data,
        error
      } = await supabase.functions.invoke('registrar-ingreso', {
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
            precioVenta: Number(inventoryProductPrice || '0'),
            costoPersonalizado: tipoCostoInventarioNegativo === 'personalizado' && costoPersonalizado ? Number(costoPersonalizado) : undefined
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
      await Promise.all([refetchVentas(), refetchTransacciones()]);

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
      setDuplicateWarnings([]); // Limpiar advertencias de duplicados
      setSelectedProductId("");
      setProductUnitPrice("");
      setProductQuantity("1");
      setSelectedProducts([]); // Limpiar lista de productos
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
        return <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Recordatorio:</strong> Para registrar ventas de productos precargados, primero debes agregar los productos al catálogo desde la pestaña "Catálogo de Productos".
              </AlertDescription>
            </Alert>
            
            {/* Formulario para agregar productos */}
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Agregar Productos a la Venta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="producto-precargado">Seleccionar Producto</Label>
                  <Select value={selectedProductId} onValueChange={handleProductSelection}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingProductosServicios ? "Cargando productos..." : "Seleccionar producto del catálogo"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-80 z-50 bg-background border border-border w-full">
                      {loadingProductosServicios ? <SelectItem value="loading" disabled>Cargando productos...</SelectItem> : productosServicios.length === 0 ? <SelectItem value="empty" disabled>No hay productos de servicios registrados</SelectItem> : productosServicios.map(producto => <SelectItem key={producto.id} value={producto.id} className="py-3 px-3 h-auto">
                             <div className="flex items-center space-x-3 w-full">
                               <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                 {producto.imagen_url ? <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center">
                                     <Package className="w-5 h-5 text-muted-foreground" />
                                   </div>}
                               </div>
                               <div className="flex-1 min-w-0">
                                 <p className="font-medium text-sm truncate mb-1">{producto.nombre}</p>
                                 <p className="text-xs text-muted-foreground">${formatMonto(producto.precio)}</p>
                               </div>
                             </div>
                           </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cantidad">Cantidad</Label>
                    <Input 
                      id="cantidad" 
                      type="number" 
                      placeholder="1" 
                      min="1"
                      value={productQuantity} 
                      onChange={e => setProductQuantity(e.target.value)} 
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="descuento-producto">Descuento (opcional)</Label>
                    <Input 
                      id="descuento-producto" 
                      type="number" 
                      placeholder="0.00" 
                      min="0"
                      step="0.01"
                      value={productDiscount} 
                      onChange={e => setProductDiscount(e.target.value)} 
                    />
                    <p className="text-xs text-muted-foreground">Descuento individual para este producto</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Subtotal con Descuento</Label>
                    <Input 
                      type="text" 
                      value={selectedProductId && productUnitPrice ? `$${formatMonto(Math.max(0, (parseFloat(productUnitPrice) * parseFloat(productQuantity || "1")) - parseFloat(productDiscount || "0")))}` : "$0.00"} 
                      readOnly 
                      className="bg-muted font-medium" 
                    />
                  </div>
                </div>

                <Button 
                  type="button"
                  onClick={handleAddProductToList}
                  disabled={!selectedProductId}
                  className="w-full"
                  variant="secondary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto
                </Button>
              </CardContent>
            </Card>

            {/* Lista de productos agregados */}
            {selectedProducts.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Productos en la Venta ({selectedProducts.length})</span>
                    <span className="text-primary">${formatMonto(selectedProducts.reduce((sum, p) => sum + p.subtotal, 0))}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedProducts.map((producto, index) => (
                      <div 
                        key={`${producto.id}-${index}`} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-background"
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            {producto.imagen_url ? (
                              <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <Package className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{producto.nombre}</p>
                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          <span>{producto.cantidad} x ${formatMonto(producto.precio)} = ${formatMonto(producto.cantidad * producto.precio)}</span>
                          {producto.descuento > 0 && (
                            <span className="text-orange-600">Descuento: -${formatMonto(producto.descuento)}</span>
                          )}
                          <span className="text-primary font-medium">Total: ${formatMonto(producto.subtotal)}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveProductFromList(producto.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <AlertCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {hasFieldError('Debe agregar al menos un producto') && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Debes agregar al menos un producto a la venta
                </AlertDescription>
              </Alert>
            )}
          </div>;
      case "inventariados":
        return <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Ventas desde Inventario:</strong> Solo se muestran productos con stock disponible. El stock se actualizará automáticamente al registrar la venta.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="producto-inventario">Seleccionar Producto del Inventario</Label>
                {hasFieldError('Producto de Inventario') && <div className="flex items-center text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-xs">Requerido</span>
                  </div>}
              </div>
              <Select value={selectedInventoryProductId} onValueChange={handleInventoryProductSelection}>
                <SelectTrigger className={hasFieldError('Producto de Inventario') ? 'border-destructive' : ''}>
                  <SelectValue placeholder={loadingProductos ? "Cargando inventario..." : "Seleccionar producto del inventario"} />
                </SelectTrigger>
                <SelectContent className="max-h-80 z-50 bg-background border border-border w-full">
                  {loadingProductos ? <SelectItem value="loading" disabled>Cargando inventario...</SelectItem> : productosInventario.length === 0 ? <SelectItem value="empty" disabled>No hay productos con stock disponible</SelectItem> : productosInventario.map(producto => <SelectItem key={producto.id} value={producto.id} className="py-3 px-3 h-auto">
                         <div className="flex items-center space-x-3 w-full">
                           <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                             {producto.imagen_url ? <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center">
                                 <Package className="w-5 h-5 text-muted-foreground" />
                               </div>}
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
                               {(producto as any).precio_venta && (producto as any).precio_venta > 0 ? <span className="text-xs text-green-600 font-medium">
                                   Venta: ${(producto as any).precio_venta}
                                 </span> : <span className="text-xs text-orange-600 font-medium">⚠️ Sin precio</span>}
                             </div>
                           </div>
                         </div>
                       </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="cantidad-inv">Cantidad a Vender</Label>
                  {hasFieldError('Cantidad') && <div className="flex items-center text-destructive">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs">Requerido</span>
                    </div>}
                </div>
                <Input id="cantidad-inv" type="number" placeholder="1" min="1" value={inventoryQuantity} onChange={e => handleInventoryQuantityChange(e.target.value)} className={hasFieldError('Cantidad') ? 'border-destructive' : ''} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="precio-inv">Precio de Venta Registrado</Label>
                  {selectedInventoryProductId && !(productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta && <div className="flex items-center text-orange-600">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs">Sin precio configurado</span>
                    </div>}
                </div>
                
                {/* Selector de tipo de precio */}
                {selectedInventoryProductId && <div className="space-y-2">
                    <RadioGroup value={usePrecioRegistrado ? "registrado" : "personalizado"} onValueChange={value => {
                  const useRegistrado = value === "registrado";
                  setUsePrecioRegistrado(useRegistrado);

                  // Si cambia a precio registrado, restaurar el precio del inventario
                  if (useRegistrado) {
                    const selectedProduct = productosInventario.find(p => p.id === selectedInventoryProductId);
                    if (selectedProduct) {
                      const precioVenta = (selectedProduct as any).precio_venta;
                      const precioAUsar = precioVenta && precioVenta > 0 ? precioVenta.toString() : selectedProduct.costo_unitario?.toString() || selectedProduct.precio.toString();
                      setInventoryProductPrice(precioAUsar);
                      // Recalcular total
                      const precioNumerico = precioVenta && precioVenta > 0 ? precioVenta : selectedProduct.costo_unitario || selectedProduct.precio;
                      const total = (precioNumerico * parseFloat(inventoryQuantity)).toFixed(2);
                      setMontoTotal(total);
                    }
                  }
                }} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="registrado" id="precio-registrado" />
                        <Label htmlFor="precio-registrado" className="text-sm">
                          Usar precio registrado
                          {selectedInventoryProductId && (productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta > 0 && <span className="ml-1 text-green-600 font-medium">
                              (${(productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta})
                            </span>}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="personalizado" id="precio-personalizado" />
                        <Label htmlFor="precio-personalizado" className="text-sm">Precio personalizado</Label>
                      </div>
                    </RadioGroup>
                  </div>}

                {selectedInventoryProductId && !usePrecioRegistrado && !(productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta && <Alert className="border-orange-200 bg-orange-50">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      <strong>Advertencia:</strong> Este producto no tiene un precio de venta configurado. 
                      Puedes establecerlo desde Control de Inventario o ingresarlo manualmente aquí.
                    </AlertDescription>
                  </Alert>}
                
                <Input id="precio-inv" type="number" placeholder="0.00" step="0.01" value={inventoryProductPrice} onChange={e => handleInventoryPriceChange(e.target.value)} disabled={usePrecioRegistrado && selectedInventoryProductId && (productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta > 0} className={`${selectedInventoryProductId && !usePrecioRegistrado && !(productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta ? 'border-orange-300 bg-orange-50' : ''} ${usePrecioRegistrado && selectedInventoryProductId && (productosInventario.find(p => p.id === selectedInventoryProductId) as any)?.precio_venta > 0 ? 'bg-muted' : ''}`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock-disponible">Stock Disponible</Label>
                <Input id="stock-disponible" type="number" disabled value={availableStock} className="bg-muted" />
              </div>
            </div>
            {selectedInventoryProductId && <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
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
                      ${formatMonto(parseFloat(inventoryProductPrice || '0') - (productosInventario.find(p => p.id === selectedInventoryProductId)?.costo_unitario || 0))}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ganancia total:</span>
                    <span className="ml-2 font-medium text-green-600">
                      ${formatMonto((parseFloat(inventoryProductPrice || '0') - (productosInventario.find(p => p.id === selectedInventoryProductId)?.costo_unitario || 0)) * parseFloat(inventoryQuantity))}
                    </span>
                  </div>
                </div>
              </div>}
          </div>;
      case "general":
        return <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="descripcion-general">Descripción del Ingreso</Label>
                {hasFieldError('Descripción') && <div className="flex items-center text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-xs">Requerido</span>
                  </div>}
              </div>
              <Input id="descripcion-general" placeholder="Ej: Servicio de consultoría" value={descripcion} onChange={e => setDescripcion(e.target.value)} className={hasFieldError('Descripción') ? 'border-destructive' : ''} />
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
                {hasFieldError('Monto Total') && <div className="flex items-center text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-xs">Requerido</span>
                  </div>}
              </div>
              <Input id="monto-general" type="number" placeholder="0.00" value={montoTotal} onChange={e => setMontoTotal(e.target.value)} className={hasFieldError('Monto Total') ? 'border-destructive' : ''} />
            </div>
          </div>;
      case "otros":
        return <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este ingreso se ligará a la cuenta 4004 - Ventas inventarios.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="descripcion-otros">Descripción del Ingreso Extraordinario</Label>
              <Textarea id="descripcion-otros" placeholder="Ej: Venta extraordinaria de equipo usado, donación recibida, etc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monto-otros">Monto</Label>
              <Input id="monto-otros" type="number" placeholder="0.00" />
            </div>
          </div>;
      default:
        return null;
    }
  };
  const handleSubmitProduct = async () => {
    if (!productName.trim() || !productPrice.trim()) {
      toast({
        title: "Error",
        description: "El nombre y precio del producto son obligatorios",
        variant: "destructive"
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
        imagen: productImage || undefined
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

  const handleOpenEditDialog = (producto: any) => {
    setEditingProduct(producto);
    setEditProductName(producto.nombre);
    setEditProductPrice(producto.precio?.toString() || "");
    setEditProductDescription(producto.descripcion || "");
    setEditImagePreview(producto.imagen_url || null);
    setEditProductImage(null);
    setIsEditDialogOpen(true);
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditProductImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProduct = async () => {
    if (!editProductName.trim() || !editProductPrice.trim()) {
      toast({
        title: "Error",
        description: "El nombre y precio del producto son obligatorios",
        variant: "destructive"
      });
      return;
    }

    setIsSubmittingProduct(true);
    try {
      await updateProducto.mutateAsync({
        id: editingProduct.id,
        nombre: editProductName.trim(),
        precio: parseFloat(editProductPrice),
        descripcion: editProductDescription.trim() || undefined,
        imagen: editProductImage || undefined
      });

      setIsEditDialogOpen(false);
      setEditingProduct(null);
      setEditProductName("");
      setEditProductPrice("");
      setEditProductDescription("");
      setEditProductImage(null);
      setEditImagePreview(null);
    } catch (error) {
      // Error manejado por el hook
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  return <div className="h-full overflow-hidden flex flex-col">
      {/* Diálogo de confirmación de inventario negativo */}
      <Dialog open={showNegativeStockDialog} onOpenChange={setShowNegativeStockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              Advertencia: Inventario Insuficiente
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-4">
              <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <p className="font-medium mb-2">Estás a punto de vender un producto sin suficiente inventario:</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Producto:</span>
                    <span className="font-medium">{negativeStockData?.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cantidad solicitada:</span>
                    <span className="font-medium">{negativeStockData?.requested}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stock disponible:</span>
                    <span className="font-medium">{negativeStockData?.available}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-orange-600">
                    <span className="font-medium">Faltante:</span>
                    <span className="font-bold">{(negativeStockData?.requested || 0) - (negativeStockData?.available || 0)}</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="font-medium mb-3 text-blue-700 dark:text-blue-400">Impacto en el inventario:</p>
                
                {negativeStockData?.costoPorUnidad && negativeStockData.costoPorUnidad > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      💡 El costo mostrado es el <strong>promedio histórico</strong> calculado de tus compras anteriores de este producto.
                    </p>
                    
                    <RadioGroup 
                      value={tipoCostoInventarioNegativo} 
                      onValueChange={(value: "historico" | "personalizado") => {
                        setTipoCostoInventarioNegativo(value);
                        if (value === "historico") {
                          setCostoPersonalizado("");
                        }
                      }}
                      className="space-y-3 mb-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="historico" id="costo-historico" />
                        <Label htmlFor="costo-historico" className="text-sm cursor-pointer">
                          Usar costo histórico: <strong className="text-blue-700 dark:text-blue-400">${formatMonto(negativeStockData.costoPorUnidad)}</strong> por unidad
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="personalizado" id="costo-personalizado" />
                        <Label htmlFor="costo-personalizado" className="text-sm cursor-pointer">
                          Ingresar costo personalizado
                        </Label>
                      </div>
                    </RadioGroup>
                    
                    {tipoCostoInventarioNegativo === "personalizado" && (
                      <div className="mb-3">
                        <Label htmlFor="costo-custom" className="text-xs">Costo unitario personalizado</Label>
                        <Input
                          id="costo-custom"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={costoPersonalizado}
                          onChange={(e) => setCostoPersonalizado(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}
                    
                    <Separator className="my-3" />
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Costo por unidad aplicado:</span>
                        <span className="font-medium">
                          ${tipoCostoInventarioNegativo === "personalizado" && costoPersonalizado 
                        ? formatMonto(costoPersonalizado)
                        : formatMonto(negativeStockData.costoPorUnidad)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor inventario negativo:</span>
                        <span className="font-bold text-destructive">
                          -${formatMonto(
                            (tipoCostoInventarioNegativo === "personalizado" && costoPersonalizado 
                              ? Number(costoPersonalizado) 
                              : negativeStockData.costoPorUnidad) * 
                            ((negativeStockData?.requested || 0) - (negativeStockData?.available || 0))
                      )}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ Este producto no tiene costo histórico registrado.
                    </p>
                    <div>
                      <Label htmlFor="costo-requerido" className="text-xs">Ingresa el costo unitario para esta transacción</Label>
                      <Input
                        id="costo-requerido"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={costoPersonalizado}
                        onChange={(e) => setCostoPersonalizado(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    {costoPersonalizado && Number(costoPersonalizado) > 0 && (
                      <>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Valor inventario negativo:</span>
                          <span className="font-bold text-destructive">
                            -${formatMonto(Number(costoPersonalizado) * ((negativeStockData?.requested || 0) - (negativeStockData?.available || 0)))}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm">
                Si continúas, el inventario quedará en <strong className="text-destructive">negativo ({(negativeStockData?.available || 0) - (negativeStockData?.requested || 0)} unidades)</strong>. 
                Esto se reflejará en tu control de inventario con el valor mostrado arriba.
              </p>
              <p className="text-sm text-muted-foreground">
                ¿Deseas continuar con la venta de todas formas?
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNegativeStockDialog(false);
                setNegativeStockData(null);
                setTipoCostoInventarioNegativo("historico");
                setCostoPersonalizado("");
              }}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={async () => {
                // Validar que si no hay costo histórico, se haya ingresado uno personalizado
                if ((!negativeStockData?.costoPorUnidad || negativeStockData.costoPorUnidad === 0) && (!costoPersonalizado || Number(costoPersonalizado) <= 0)) {
                  toast({
                    title: "Costo requerido",
                    description: "Debes ingresar un costo unitario para continuar",
                    variant: "destructive"
                  });
                  return;
                }
                
                setShowNegativeStockDialog(false);
                setNegativeStockData(null);
                await processIngreso();
                // Limpiar después de procesar
                setTipoCostoInventarioNegativo("historico");
                setCostoPersonalizado("");
              }}
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Continuar con la Venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Registro de Ingresos</h1>
        <p className="text-muted-foreground mt-2">
          Registra ventas, gestiona catálogos y analiza ingresos de la empresa
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="registro" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="registro">Registro de Ingresos</TabsTrigger>
            <TabsTrigger value="resumen">Resumen de Ventas</TabsTrigger>
            <TabsTrigger value="analitica">Analítica de Ventas</TabsTrigger>
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
                {selectedIncomeType && <div className="space-y-6 p-4 border rounded-lg bg-muted/20">
                    {/* Campos específicos por tipo de ingreso */}
                    {renderIncomeTypeForm(selectedIncomeType)}
                    
                    <Separator />
                    
                     {/* Sección de cálculos y descuentos */}
                     <div className="space-y-4">
                        {/* Mostrar total calculado para productos precargados e inventariados */}
                        {(selectedIncomeType === "precargados" && selectedProductId || selectedIncomeType === "inventariados" && selectedInventoryProductId) && <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
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
                          </div>}

                    </div>


                    {/* Estado del pago - PRIMERO */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Label className="font-medium">Estado del Pago</Label>
                        {hasFieldError('Tipo de Pago') && <div className="flex items-center text-destructive">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span className="text-xs">Requerido</span>
                          </div>}
                      </div>
                      <RadioGroup value={paymentStatus} onValueChange={setPaymentStatus} className={hasFieldError('Tipo de Pago') ? 'border border-destructive rounded-lg p-2' : ''}>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="contado" id="contado" />
                          <Label htmlFor="contado" className="cursor-pointer">Pago Total
                      </Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="parcial" id="parcial" />
                          <Label htmlFor="parcial" className="cursor-pointer">Pago parcial</Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="credito" id="credito" />
                          <Label htmlFor="credito" className="cursor-pointer">Adeudo Total</Label>
                        </div>
                       </RadioGroup>

                      {/* Campo para monto abonado en pago parcial */}
                      {paymentStatus === "parcial" && <div className="ml-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 space-y-3">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Label htmlFor="monto-abonado">Monto que se va a pagar</Label>
                              <span className="text-destructive text-sm">*</span>
                              {hasFieldError('Monto Abonado') && <div className="flex items-center text-destructive">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Requerido</span>
                                </div>}
                            </div>
                            <Input id="monto-abonado" type="number" step="0.01" placeholder="0.00" value={montoAbonado} onChange={e => setMontoAbonado(e.target.value)} className={hasFieldError('Monto Abonado') ? 'border-destructive' : ''} />
                          </div>
                          
                          {montoTotal && montoAbonado && <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-white dark:bg-gray-900 rounded border">
                              <div className="text-center">
                                <p className="text-sm text-muted-foreground">Total de la venta</p>
                                <p className="text-lg font-semibold text-primary">${formatMonto(montoTotal)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-sm text-muted-foreground">Se pagará ahora</p>
                                <p className="text-lg font-semibold text-green-600">${formatMonto(montoAbonado)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-sm text-muted-foreground">Queda pendiente</p>
                                <p className="text-lg font-semibold text-orange-600">
                                  ${formatMonto(parseFloat(montoTotal) - parseFloat(montoAbonado))}
                                </p>
                              </div>
                            </div>}
                        </div>}

                    </div>

                    <Separator />

                      {/* Base de Datos de Clientes - Mostrar para todos los tipos de pago */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Users className="h-5 w-5" />
                          <Label className="font-medium">Datos del Cliente</Label>
                          <span className="text-xs text-muted-foreground">
                            {paymentStatus === "contado" ? "Opcional - Para analíticas y comentarios" : "Obligatorio para cuentas por cobrar"}
                          </span>
                        </div>
                        
                        {paymentStatus === "contado" && <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Asignar cliente es opcional para pagos totales. Útil para analíticas de ventas y seguimiento de clientes.
                            </AlertDescription>
                          </Alert>}

                        {(paymentStatus === "parcial" || paymentStatus === "credito") && <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Se registrará en Cuentas por Cobrar para análisis de vencimientos
                            </AlertDescription>
                          </Alert>}

                         <div className="space-y-2">
                           <Label className="font-medium">Tipo de Cliente</Label>
                           <Select value={tipoCliente} onValueChange={value => {
                       setTipoCliente(value);
                       // Reset client data when switching types
                       setClienteSeleccionado("");
                       setClienteNombre("");
                       setClienteTelefono("");
                       setClienteEmail("");
                       setClienteRFC("");
                       setDuplicateWarnings([]); // Limpiar advertencias al cambiar tipo
                     }}>
                             <SelectTrigger>
                               <SelectValue placeholder={paymentStatus === "contado" ? "Opcional - Selecciona para analíticas" : "Selecciona el tipo de cliente"} />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="nuevo">Cliente Nuevo</SelectItem>
                               <SelectItem value="recurrente">Cliente Recurrente</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>

                        {/* Cliente recurrente - selector */}
                        {tipoCliente === "recurrente" && <div className="space-y-2">
                            <Label htmlFor="cliente-existente">Seleccionar Cliente</Label>
                            <Select value={clienteSeleccionado} onValueChange={value => {
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
                                {loadingClientes ? <div className="px-2 py-1.5 text-sm text-muted-foreground">Cargando clientes...</div> : clientes.length === 0 ? <div className="px-2 py-1.5 text-sm text-muted-foreground">No hay clientes registrados</div> : clientes.map(cliente => <SelectItem key={cliente.id} value={cliente.id}>
                                      <div className="flex flex-col">
                                        <span className="font-medium">{cliente.nombre}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {cliente.telefono && `Tel: ${cliente.telefono}`}
                                          {cliente.email && ` • Email: ${cliente.email}`}
                                          {cliente.source === 'transaction' && ' • (De transacción)'}
                                        </span>
                                      </div>
                                    </SelectItem>)}
                              </SelectContent>
                            </Select>
                            {clienteSeleccionado && <p className="text-xs text-muted-foreground text-green-600">
                                ✓ Datos del cliente cargados automáticamente
                              </p>}
                          </div>}

                        {/* Campos de cliente - solo si es nuevo o si se seleccionó uno recurrente */}
                        {(tipoCliente === "nuevo" || tipoCliente === "recurrente" && clienteSeleccionado) && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="cliente-nombre">Nombre del Cliente</Label>
                            <Input id="cliente-nombre" type="text" placeholder="Nombre completo" value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""} />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Label htmlFor="cliente-telefono">Número de Teléfono</Label>
                              {(paymentStatus === "parcial" || paymentStatus === "credito") && <span className="text-destructive text-sm">*</span>}
                              {hasFieldError('Teléfono del Cliente') && <div className="flex items-center text-destructive">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Requerido</span>
                                </div>}
                            </div>
                             <Input id="cliente-telefono" type="tel" placeholder="Ej: +52 55 1234 5678" value={clienteTelefono} onChange={e => setClienteTelefono(e.target.value)} className={hasFieldError('Teléfono del Cliente') ? 'border-destructive' : ''} disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""} />
                             {/* Advertencia de duplicado para teléfono */}
                             {tipoCliente === "nuevo" && duplicateWarnings.some(w => w.includes(clienteTelefono) && w.includes("teléfono")) && <div className="flex items-center text-amber-600 bg-amber-50 p-2 rounded">
                                 <AlertCircle className="h-3 w-3 mr-1" />
                                 <span className="text-xs">
                                   {duplicateWarnings.find(w => w.includes(clienteTelefono) && w.includes("teléfono"))}
                                 </span>
                               </div>}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Label htmlFor="cliente-email">Correo Electrónico</Label>
                              {(paymentStatus === "parcial" || paymentStatus === "credito") && <span className="text-destructive text-sm">*</span>}
                              {hasFieldError('Email del Cliente') && <div className="flex items-center text-destructive">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Requerido</span>
                                </div>}
                            </div>
                             <Input id="cliente-email" type="email" placeholder="cliente@ejemplo.com" value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} className={hasFieldError('Email del Cliente') ? 'border-destructive' : ''} disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""} />
                             {/* Advertencia de duplicado para email */}
                             {tipoCliente === "nuevo" && duplicateWarnings.some(w => w.includes(clienteEmail) && w.includes("correo")) && <div className="flex items-center text-amber-600 bg-amber-50 p-2 rounded">
                                 <AlertCircle className="h-3 w-3 mr-1" />
                                 <span className="text-xs">
                                   {duplicateWarnings.find(w => w.includes(clienteEmail) && w.includes("correo"))}
                                 </span>
                               </div>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cliente-rfc">RFC (ID Fiscal) - Opcional</Label>
                             <Input id="cliente-rfc" type="text" placeholder="RFC123456ABC1" value={clienteRFC} onChange={e => setClienteRFC(e.target.value.toUpperCase())} maxLength={13} disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""} />
                             {/* Advertencia de duplicado para RFC */}
                             {tipoCliente === "nuevo" && duplicateWarnings.some(w => w.includes(clienteRFC) && w.includes("RFC")) && <div className="flex items-center text-amber-600 bg-amber-50 p-2 rounded">
                                 <AlertCircle className="h-3 w-3 mr-1" />
                                 <span className="text-xs">
                                   {duplicateWarnings.find(w => w.includes(clienteRFC) && w.includes("RFC"))}
                                 </span>
                               </div>}
                          </div>
                          
                          {/* Fecha de vencimiento para pagos parciales y crédito */}
                          {(paymentStatus === "parcial" || paymentStatus === "credito") && <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Label htmlFor="fecha-vencimiento">Fecha de Vencimiento</Label>
                                <span className="text-destructive text-sm">*</span>
                                {hasFieldError('Fecha de Vencimiento') && <div className="flex items-center text-destructive">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    <span className="text-xs">Requerido</span>
                                  </div>}
                              </div>
                              <Input id="fecha-vencimiento" type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} className={hasFieldError('Fecha de Vencimiento') ? 'border-destructive' : ''} min={new Date().toISOString().split('T')[0]} />
                              <p className="text-xs text-muted-foreground">
                                Fecha límite para el pago {paymentStatus === "parcial" ? "del monto pendiente" : "completo"}
                              </p>
                            </div>}

                          {/* Campo de comentarios adicional para pagos totales */}
                          {paymentStatus === "contado" && tipoCliente && <div className="col-span-full space-y-2">
                              <Label htmlFor="comentario-venta">Comentarios de la venta (Opcional)</Label>
                              <Textarea 
                                id="comentario-venta" 
                                placeholder="Detalles adicionales sobre esta venta, preferencias del cliente, etc." 
                                value={comentarios} 
                                onChange={e => setComentarios(e.target.value)}
                                rows={2}
                              />
                              <p className="text-xs text-muted-foreground">
                                Información útil para futuras ventas y análisis del cliente
                              </p>
                            </div>}
                        </div>}
                      </div>

                    <Separator />

                    {/* Método de pago - SOLO si es contado o parcial */}
                    {(paymentStatus === "contado" || paymentStatus === "parcial") && <>
                        <Separator />
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2">
                            <Label className="font-medium">Método de Pago</Label>
                            {hasFieldError('Método de Pago') && <div className="flex items-center text-destructive">
                                <AlertCircle className="h-4 w-4 mr-1" />
                                <span className="text-xs">Requerido</span>
                              </div>}
                          </div>
                          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className={hasFieldError('Método de Pago') ? 'border border-destructive rounded-lg p-2' : ''}>
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
                      </>}

                    {/* Comments section */}
                    <div className="space-y-2">
                      <Label htmlFor="comentarios">Comentarios de la venta (Opcional)</Label>
                      <Textarea id="comentarios" placeholder="Agrega cualquier comentario o nota sobre esta venta..." value={comentarios} onChange={e => setComentarios(e.target.value)} rows={3} className="resize-none" />
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button size="lg" className="px-8" onClick={handleSubmitIngreso} disabled={isSubmitting}>
                        <Calculator className="mr-2 h-4 w-4" />
                        {isSubmitting ? "Registrando..." : "Registrar Ingreso"}
                      </Button>
                    </div>
                  </div>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: RESUMEN DE VENTAS - SOLO LISTA */}
          <TabsContent value="resumen" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Registro Detallado de Ventas</CardTitle>
                <CardDescription>
                  Historial completo de transacciones de ingresos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filtros */}
                <div className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="filtro-fecha-inicio">Fecha Inicio</Label>
                      <Input 
                        id="filtro-fecha-inicio"
                        type="date" 
                        value={filtroFechaInicio}
                        onChange={(e) => setFiltroFechaInicio(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="filtro-fecha-fin">Fecha Fin</Label>
                      <Input 
                        id="filtro-fecha-fin"
                        type="date" 
                        value={filtroFechaFin}
                        onChange={(e) => setFiltroFechaFin(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="filtro-tipo">Tipo de Ingreso</Label>
                      <Select value={filtroTipoIngreso} onValueChange={setFiltroTipoIngreso}>
                        <SelectTrigger id="filtro-tipo">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="precargados">Precargados</SelectItem>
                          <SelectItem value="inventariados">Inventariados</SelectItem>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="otros">Otros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="filtro-cuenta">Cuenta</Label>
                      <Select value={filtroCuenta} onValueChange={setFiltroCuenta}>
                        <SelectTrigger id="filtro-cuenta">
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Todas</SelectItem>
                          <SelectItem value="4001">4001 - Ventas</SelectItem>
                          <SelectItem value="4004">4004 - Otros Ingresos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="filtro-subcuenta">Subcuenta</Label>
                      <Select value={filtroSubcuenta} onValueChange={setFiltroSubcuenta}>
                        <SelectTrigger id="filtro-subcuenta">
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Todas</SelectItem>
                          <SelectItem value="sin-subcuenta">Sin subcuenta</SelectItem>
                          {subcuentas.map(sub => (
                            <SelectItem key={sub.id} value={sub.id}>{sub.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setFiltroFechaInicio("");
                        setFiltroFechaFin("");
                        setFiltroTipoIngreso("");
                        setFiltroCuenta("");
                        setFiltroSubcuenta("");
                      }}
                    >
                      Limpiar Filtros
                    </Button>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Resultados: {(() => {
                          const filtered = transacciones.filter(t => {
                            const fechaMatch = (!filtroFechaInicio || new Date(t.created_at) >= new Date(filtroFechaInicio)) &&
                                             (!filtroFechaFin || new Date(t.created_at) <= new Date(filtroFechaFin + 'T23:59:59'));
                            const tipoMatch = !filtroTipoIngreso || filtroTipoIngreso === 'todos' || t.tipo_ingreso === filtroTipoIngreso;
                            const cuentaMatch = !filtroCuenta || filtroCuenta === 'todas' || t.cuenta_principal_codigo === filtroCuenta;
                            const subcuentaMatch = !filtroSubcuenta || filtroSubcuenta === 'todas' || 
                                                 (filtroSubcuenta === 'sin-subcuenta' && !t.subcuenta_id) ||
                                                 t.subcuenta_id === filtroSubcuenta;
                            return fechaMatch && tipoMatch && cuentaMatch && subcuentaMatch;
                          });
                          return filtered.length;
                        })()}
                      </p>
                      <p className="text-lg font-bold text-primary">
                        Total: ${(() => {
                          const filtered = transacciones.filter(t => {
                            const fechaMatch = (!filtroFechaInicio || new Date(t.created_at) >= new Date(filtroFechaInicio)) &&
                                             (!filtroFechaFin || new Date(t.created_at) <= new Date(filtroFechaFin + 'T23:59:59'));
                            const tipoMatch = !filtroTipoIngreso || filtroTipoIngreso === 'todos' || t.tipo_ingreso === filtroTipoIngreso;
                            const cuentaMatch = !filtroCuenta || filtroCuenta === 'todas' || t.cuenta_principal_codigo === filtroCuenta;
                            const subcuentaMatch = !filtroSubcuenta || filtroSubcuenta === 'todas' || 
                                                 (filtroSubcuenta === 'sin-subcuenta' && !t.subcuenta_id) ||
                                                 t.subcuenta_id === filtroSubcuenta;
                            return fechaMatch && tipoMatch && cuentaMatch && subcuentaMatch;
                          });
                          return formatMonto(filtered.reduce((sum, t) => sum + t.monto_total, 0));
                        })()}
                      </p>
                      <p className="text-sm font-medium text-green-600">
                        Neto: ${(() => {
                          const filtered = transacciones.filter(t => {
                            const fechaMatch = (!filtroFechaInicio || new Date(t.created_at) >= new Date(filtroFechaInicio)) &&
                                             (!filtroFechaFin || new Date(t.created_at) <= new Date(filtroFechaFin + 'T23:59:59'));
                            const tipoMatch = !filtroTipoIngreso || filtroTipoIngreso === 'todos' || t.tipo_ingreso === filtroTipoIngreso;
                            const cuentaMatch = !filtroCuenta || filtroCuenta === 'todas' || t.cuenta_principal_codigo === filtroCuenta;
                            const subcuentaMatch = !filtroSubcuenta || filtroSubcuenta === 'todas' || 
                                                 (filtroSubcuenta === 'sin-subcuenta' && !t.subcuenta_id) ||
                                                 t.subcuenta_id === filtroSubcuenta;
                            return fechaMatch && tipoMatch && cuentaMatch && subcuentaMatch;
                          });
                          return formatMonto(filtered.reduce((sum, t) => sum + t.monto_neto, 0));
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {loadingTransacciones ? <div className="text-center py-8 text-muted-foreground">
                    Cargando transacciones...
                  </div> : (() => {
                    const transaccionesFiltradas = transacciones.filter(t => {
                      const fechaMatch = (!filtroFechaInicio || new Date(t.created_at) >= new Date(filtroFechaInicio)) &&
                                       (!filtroFechaFin || new Date(t.created_at) <= new Date(filtroFechaFin + 'T23:59:59'));
                      const tipoMatch = !filtroTipoIngreso || filtroTipoIngreso === 'todos' || t.tipo_ingreso === filtroTipoIngreso;
                      const cuentaMatch = !filtroCuenta || filtroCuenta === 'todas' || t.cuenta_principal_codigo === filtroCuenta;
                      const subcuentaMatch = !filtroSubcuenta || filtroSubcuenta === 'todas' || 
                                           (filtroSubcuenta === 'sin-subcuenta' && !t.subcuenta_id) ||
                                           t.subcuenta_id === filtroSubcuenta;
                      return fechaMatch && tipoMatch && cuentaMatch && subcuentaMatch;
                    });

                    return transaccionesFiltradas.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                        No hay transacciones que coincidan con los filtros
                      </div> : <div className="space-y-4">
                        <div className="text-sm font-medium text-muted-foreground mb-4">
                          Mostrando {transaccionesFiltradas.length} transacción(es)
                        </div>
                        <div className="space-y-3">
                           {transaccionesFiltradas.map(transaccion => <div key={transaccion.id} className="border rounded-lg p-4 hover:bg-muted/50">
                           <div className="flex items-start gap-3 mb-2">
                              {/* Imagen del producto si es precargado o inventariado */}
                              {(transaccion.tipo_ingreso === 'precargados' || transaccion.tipo_ingreso === 'inventariados') && (() => {
                          // Buscar producto en la lista (precargados o inventario)
                          const descripcionSinPrefijo = transaccion.descripcion.replace('Venta de ', '').replace('Venta: ', '');
                          const producto = productos.find(p => 
                            p.nombre === transaccion.descripcion || 
                            p.nombre === descripcionSinPrefijo ||
                            transaccion.descripcion.includes(p.nombre)
                          );
                          return producto?.imagen_url ? <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                    <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" />
                                </div> : (
                                  <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                                    <Package className="w-5 h-5 text-muted-foreground" />
                                  </div>
                                );
                        })()}
                             
                             <div className="flex justify-between items-start flex-1">
                               <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{transaccion.descripcion}</p>
                                    <Dialog onOpenChange={(open) => {
                                      if (open) {
                                        loadAsientosContables(transaccion.id);
                                      } else {
                                        setCurrentAsientos(null);
                                      }
                                    }}>
                                      <DialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                          <FileText className="h-3 w-3" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                        <DialogHeader>
                                          <DialogTitle>Detalles de la Transacción</DialogTitle>
                                          <DialogDescription>
                                            Información completa y asientos contables en balanza
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <h4 className="font-semibold text-sm">Información General</h4>
                                              <div className="space-y-1 text-sm">
                                                <p><span className="font-medium">Descripción:</span> {transaccion.descripcion}</p>
                                                <p><span className="font-medium">Tipo:</span> {transaccion.tipo_ingreso}</p>
                                                <p><span className="font-medium">Método de Pago:</span> {transaccion.metodo_pago || 'N/A'}</p>
                                                <p><span className="font-medium">Tipo de Pago:</span> {transaccion.tipo_pago}</p>
                                                <p><span className="font-medium">Fecha:</span> {new Date(transaccion.created_at).toLocaleDateString('es-ES', {
                                                  day: '2-digit',
                                                  month: '2-digit', 
                                                  year: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit'
                                                })}</p>
                                              </div>
                                            </div>
                                            <div>
                                              <h4 className="font-semibold text-sm">Montos</h4>
                                              <div className="space-y-1 text-sm">
                                            <p><span className="font-medium">Total:</span> ${formatMonto(transaccion.monto_total)}</p>
                                            <p><span className="font-medium">Descuento:</span> ${formatMonto(transaccion.monto_descuento)}</p>
                                            <p><span className="font-medium">Neto:</span> ${formatMonto(transaccion.monto_neto)}</p>
                                             <p><span className="font-medium">Pagado:</span> ${formatMonto((transaccion as any).monto_pagado || 0)}</p>
                                             <p><span className="font-medium">Pendiente:</span> ${formatMonto((transaccion as any).monto_pendiente || 0)}</p>
                                              </div>
                                            </div>
                                          </div>

                                           {/* Información del Cliente */}
                                           {((transaccion as any).cliente_nombre || (transaccion as any).cliente_telefono || (transaccion as any).cliente_email) && (
                                             <div>
                                               <h4 className="font-semibold text-sm mb-2">Información del Cliente</h4>
                                               <div className="grid grid-cols-2 gap-4 text-sm">
                                                 {(transaccion as any).cliente_nombre && <p><span className="font-medium">Nombre:</span> {(transaccion as any).cliente_nombre}</p>}
                                                 {(transaccion as any).cliente_telefono && <p><span className="font-medium">Teléfono:</span> {(transaccion as any).cliente_telefono}</p>}
                                                 {(transaccion as any).cliente_email && <p><span className="font-medium">Email:</span> {(transaccion as any).cliente_email}</p>}
                                                 {(transaccion as any).cliente_rfc && <p><span className="font-medium">RFC:</span> {(transaccion as any).cliente_rfc}</p>}
                                               </div>
                                             </div>
                                           )}

                                          {/* Información Contable */}
                                          <div>
                                            <h4 className="font-semibold text-sm mb-2">Información Contable</h4>
                                            <div className="text-sm space-y-1">
                                              <p><span className="font-medium">Cuenta Principal:</span> {transaccion.cuenta_principal_codigo} - {transaccion.cuenta_principal_codigo === '4001' ? 'Ventas' : transaccion.cuenta_principal_codigo === '4004' ? 'Otros Ingresos' : ''}</p>
                                              {transaccion.subcuenta_id ? (
                                                <p><span className="font-medium">Subcuenta:</span> {transaccion.subcuentas?.nombre || (() => {
                                                  const subcuenta = subcuentas.find(s => s.id === transaccion.subcuenta_id);
                                                  return subcuenta?.nombre || 'Subcuenta no encontrada';
                                                })()}</p>
                                              ) : (
                                                <p><span className="font-medium">Subcuenta:</span> Sin subcuenta asignada</p>
                                              )}
                                            </div>
                                          </div>

                                           {/* Comentarios */}
                                           {(transaccion as any).comentarios && (
                                             <div>
                                               <h4 className="font-semibold text-sm mb-2">Comentarios</h4>
                                               <div className="p-3 bg-muted rounded-md">
                                                 <p className="text-sm">{(transaccion as any).comentarios}</p>
                                               </div>
                                             </div>
                                           )}

                                           {/* Asientos Contables en Balanza */}
                                           <div className="pt-4 border-t">
                                             <h4 className="font-semibold text-sm mb-3">Asientos en Balanza de Comprobación</h4>
                                             {loadingAsientos ? (
                                               <div className="text-center py-8 text-muted-foreground">
                                                 Cargando asientos contables...
                                               </div>
                                             ) : !currentAsientos ? (
                                               <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center">
                                                 No se encontraron asientos contables para esta transacción
                                               </div>
                                             ) : (
                                               <div className="space-y-4">
                                                 <div className="p-4 bg-muted rounded-lg">
                                                   <div className="grid grid-cols-2 gap-4 text-sm">
                                                     <div>
                                                       <span className="font-medium">Número de Asiento:</span> {currentAsientos.numero_asiento}
                                                     </div>
                                                     <div>
                                                       <span className="font-medium">Fecha:</span>{' '}
                                                       {new Date(currentAsientos.fecha).toLocaleDateString('es-ES')}
                                                     </div>
                                                     <div className="col-span-2">
                                                       <span className="font-medium">Descripción:</span> {currentAsientos.descripcion}
                                                     </div>
                                                   </div>
                                                 </div>

                                                 <div className="border rounded-lg overflow-hidden">
                                                   <table className="w-full">
                                                     <thead className="bg-muted">
                                                       <tr>
                                                         <th className="text-left p-3 text-sm font-medium">Cuenta</th>
                                                         <th className="text-left p-3 text-sm font-medium">Descripción</th>
                                                         <th className="text-right p-3 text-sm font-medium">Debe</th>
                                                         <th className="text-right p-3 text-sm font-medium">Haber</th>
                                                       </tr>
                                                     </thead>
                                                     <tbody>
                                                       {currentAsientos.detalles?.map((detalle: any, idx: number) => (
                                                         <tr key={idx} className="border-t">
                                                           <td className="p-3 text-sm">
                                                             <div className="font-medium">{detalle.cuenta_codigo}</div>
                                                             <div className="text-xs text-muted-foreground">
                                                               {detalle.cuenta_nombre}
                                                             </div>
                                                           </td>
                                                           <td className="p-3 text-sm">{detalle.descripcion}</td>
                                                        <td className="p-3 text-sm text-right font-medium">
                                                          {detalle.debe > 0 ? `$${formatMonto(detalle.debe)}` : '-'}
                                                        </td>
                                                        <td className="p-3 text-sm text-right font-medium">
                                                          {detalle.haber > 0 ? `$${formatMonto(detalle.haber)}` : '-'}
                                                        </td>
                                                         </tr>
                                                       ))}
                                                       <tr className="border-t-2 bg-muted/50 font-bold">
                                                         <td colSpan={2} className="p-3 text-sm">
                                                           TOTALES
                                                         </td>
                                                      <td className="p-3 text-sm text-right">
                                                        $
                                                        {formatMonto(currentAsientos.detalles
                                                          ?.reduce((sum: number, d: any) => sum + Number(d.debe), 0))}
                                                      </td>
                                                      <td className="p-3 text-sm text-right">
                                                        $
                                                        {formatMonto(currentAsientos.detalles
                                                          ?.reduce((sum: number, d: any) => sum + Number(d.haber), 0))}
                                                      </td>
                                                       </tr>
                                                     </tbody>
                                                   </table>
                                                 </div>

                                                 <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
                                                   <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                                                     💡 Información
                                                   </p>
                                                   <p className="text-blue-600 dark:text-blue-400">
                                                     Este asiento contable refleja cómo esta transacción afecta a las diferentes
                                                     cuentas en la balanza de comprobación y posteriormente en los estados financieros.
                                                   </p>
                                                 </div>
                                               </div>
                                             )}
                                           </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  </div>

                                  {/* Comentarios resumidos */}
                                  {(transaccion as any).comentarios && (
                                    <div className="mt-1 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs">
                                      <span className="font-medium text-blue-700 dark:text-blue-300">💬 </span>
                                      <span className="text-blue-600 dark:text-blue-400">
                                        {(transaccion as any).comentarios.length > 50 ? 
                                          `${(transaccion as any).comentarios.substring(0, 50)}...` : 
                                          (transaccion as any).comentarios
                                        }
                                      </span>
                                    </div>
                                  )}

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
                                       {transaccion.cuenta_principal_codigo === '4001' ? ' - Ventas' : transaccion.cuenta_principal_codigo === '4004' ? ' - Otros Ingresos' : ''}
                                     </div>
                                     {transaccion.subcuenta_id ? <div>
                                         <span className="font-medium">Subcuenta:</span> {transaccion.subcuentas?.nombre || (() => {
                                   const subcuenta = subcuentas.find(s => s.id === transaccion.subcuenta_id);
                                   return subcuenta?.nombre || 'Subcuenta no encontrada';
                                 })()}
                                       </div> : <div className="text-muted-foreground">
                                         <span className="font-medium">Subcuenta:</span> Sin subcuenta asignada
                                       </div>}
                                   </div>
                                 </div>
                               </div>
                            <div className="text-right ml-4">
                              <p className="font-bold text-primary">${formatMonto(transaccion.monto_total)}</p>
                              {transaccion.monto_descuento > 0 && <p className="text-sm text-red-600">
                                  -${formatMonto(transaccion.monto_descuento)} desc.
                                </p>}
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
                          </div>)}
                     </div>
                   </div>;
                  })()}
               </CardContent>
             </Card>
           </TabsContent>

          {/* TAB 3: ANALÍTICA DE VENTAS - GRÁFICAS Y DESTACADOS */}
          <TabsContent value="analitica" className="mt-6">
            {/* Función para filtrar transacciones según el período */}
            {(() => {
              const getFilteredTransactions = () => {
                const today = new Date();
                const currentMonth = today.getMonth();
                const currentYear = today.getFullYear();

                if (periodFilter === "diario") {
                  // Filtrar solo del día actual
                  const todayStr = today.toISOString().split('T')[0];
                  return transacciones.filter(t => 
                    new Date(t.created_at).toISOString().split('T')[0] === todayStr
                  );
                } else if (periodFilter === "mensual") {
                  // Filtrar solo del mes actual
                  return transacciones.filter(t => {
                    const tDate = new Date(t.created_at);
                    return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
                  });
                } else {
                  // Filtrar solo del año actual
                  return transacciones.filter(t => {
                    const tDate = new Date(t.created_at);
                    return tDate.getFullYear() === currentYear;
                  });
                }
              };

              const filteredTransactions = getFilteredTransactions();

              return (
                <>
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
                    <span className="font-semibold hover:text-black transition-colors cursor-default">
                      {loadingVentas ? "..." : `$${formatCifra(ventasResumen.ventasDelDia, scaleFormat)}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-destructive">Descuentos:</span>
                    <span className="font-semibold text-destructive hover:text-black transition-colors cursor-default">
                      {loadingVentas ? "..." : `$${formatCifra(ventasResumen.descuentosDelDia, scaleFormat)}`}
                    </span>
                  </div>
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-chart-2">Ingreso Neto:</span>
                    <span className="text-lg font-bold text-chart-2 hover:text-black transition-colors cursor-default">
                      {loadingVentas ? "..." : `$${formatCifra(ventasResumen.ingresoNetoDelDia, scaleFormat)}`}
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
                    <span className="font-semibold hover:text-black transition-colors cursor-default">
                      {loadingVentas ? "..." : `$${formatCifra(ventasResumen.ventasDelMes, scaleFormat)}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-destructive">Descuentos:</span>
                    <span className="font-semibold text-destructive hover:text-black transition-colors cursor-default">
                      {loadingVentas ? "..." : `$${formatCifra(ventasResumen.descuentosDelMes, scaleFormat)}`}
                    </span>
                  </div>
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-chart-2">Ingreso Neto:</span>
                    <span className="text-lg font-bold text-chart-2 hover:text-black transition-colors cursor-default">
                      {loadingVentas ? "..." : `$${formatCifra(ventasResumen.ingresoNetoDelMes, scaleFormat)}`}
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
                    <span className="font-semibold hover:text-black transition-colors cursor-default">
                      {loadingVentas ? "..." : `$${formatCifra(ventasResumen.ventasDelAno, scaleFormat)}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-destructive">Descuentos:</span>
                    <span className="font-semibold text-destructive hover:text-black transition-colors cursor-default">
                      {loadingVentas ? "..." : `$${formatCifra(ventasResumen.descuentosDelAno, scaleFormat)}`}
                    </span>
                  </div>
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-chart-2">Ingreso Neto:</span>
                    <span className="text-lg font-bold text-chart-2 hover:text-black transition-colors cursor-default">
                      {loadingVentas ? "..." : `$${formatCifra(ventasResumen.ingresoNetoDelAno, scaleFormat)}`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Selector de Período y Formato de Cifras */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Configuración de Análisis</CardTitle>
                <CardDescription>Selecciona el período y formato de visualización</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Período de Análisis</Label>
                  <RadioGroup value={periodFilter} onValueChange={(v) => setPeriodFilter(v as "diario" | "mensual" | "anual")} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="diario" id="period-daily" />
                      <Label htmlFor="period-daily" className="cursor-pointer">Diario</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mensual" id="period-monthly" />
                      <Label htmlFor="period-monthly" className="cursor-pointer">Mensual</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="anual" id="period-annual" />
                      <Label htmlFor="period-annual" className="cursor-pointer">Anual</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <Separator />
                
                <div>
                  <Label className="text-sm font-medium mb-3 block">Formato de Cifras</Label>
                  <RadioGroup value={scaleFormat} onValueChange={(v) => setScaleFormat(v as "general" | "miles" | "millones")} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="general" id="scale-general" />
                      <Label htmlFor="scale-general" className="cursor-pointer">General</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="miles" id="scale-thousands" />
                      <Label htmlFor="scale-thousands" className="cursor-pointer">Miles (K)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="millones" id="scale-millions" />
                      <Label htmlFor="scale-millions" className="cursor-pointer">Millones (M)</Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de Ventas Totales, Descuentos y Ventas Netas */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Evolución de Ventas</CardTitle>
                <CardDescription>
                  Ventas brutas, descuentos y ventas netas - {periodFilter === "diario" ? "del día" : periodFilter === "mensual" ? "por día del mes" : "por mes del año"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransacciones ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    Cargando datos...
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    No hay datos para mostrar
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(() => {
                        const today = new Date();
                        const currentMonth = today.getMonth();
                        const currentYear = today.getFullYear();

                        if (periodFilter === "diario") {
                          // Para diario: un solo punto con los totales del día
                          const totalVentas = filteredTransactions.reduce((sum, t) => sum + t.monto_total, 0);
                          const totalDescuentos = filteredTransactions.reduce((sum, t) => sum + (t.monto_descuento || 0), 0);
                          const totalNeto = totalVentas - totalDescuentos;
                          
                          return [{
                            periodo: "Hoy",
                            ventas: totalVentas,
                            descuentos: totalDescuentos,
                            neto: totalNeto
                          }];
                        } else if (periodFilter === "mensual") {
                          // Para mensual: ventas por día del mes actual
                          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                          const dailyData: Record<string, {ventas: number, descuentos: number}> = {};
                          
                          // Agrupar por día (ya filtradas por mes)
                          filteredTransactions.forEach(t => {
                            const day = new Date(t.created_at).getDate();
                            const dayKey = `${day}`;
                            if (!dailyData[dayKey]) {
                              dailyData[dayKey] = { ventas: 0, descuentos: 0 };
                            }
                            dailyData[dayKey].ventas += t.monto_total;
                            dailyData[dayKey].descuentos += t.monto_descuento || 0;
                          });
                          
                          // Crear array con todos los días del mes
                          return Array.from({ length: daysInMonth }, (_, i) => {
                            const day = i + 1;
                            const data = dailyData[`${day}`] || { ventas: 0, descuentos: 0 };
                            return {
                              periodo: `Día ${day}`,
                              ventas: data.ventas,
                              descuentos: data.descuentos,
                              neto: data.ventas - data.descuentos
                            };
                          });
                        } else {
                          // Para anual: ventas por mes del año actual
                          const monthlyData: Record<number, {ventas: number, descuentos: number}> = {};
                          
                          // Agrupar por mes (ya filtradas por año)
                          filteredTransactions.forEach(t => {
                            const month = new Date(t.created_at).getMonth();
                            if (!monthlyData[month]) {
                              monthlyData[month] = { ventas: 0, descuentos: 0 };
                            }
                            monthlyData[month].ventas += t.monto_total;
                            monthlyData[month].descuentos += t.monto_descuento || 0;
                          });
                          
                          // Crear array con los 12 meses
                          const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                          return meses.map((mes, i) => {
                            const data = monthlyData[i] || { ventas: 0, descuentos: 0 };
                            return {
                              periodo: mes,
                              ventas: data.ventas,
                              descuentos: data.descuentos,
                              neto: data.ventas - data.descuentos
                            };
                          });
                        }
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periodo" />
                        <YAxis tickFormatter={(value) => formatCifra(value, scaleFormat)} />
                        <Tooltip 
                          formatter={(value) => [`$${formatCifra(Number(value), scaleFormat)}`, '']}
                          contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px' }}
                          itemStyle={{ color: 'black' }}
                          labelStyle={{ color: 'black' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="ventas" stroke="hsl(180 50% 55%)" name="Ventas Brutas" strokeWidth={2} />
                        <Line type="monotone" dataKey="descuentos" stroke="hsl(180 60% 70%)" name="Descuentos" strokeWidth={2} />
                        <Line type="monotone" dataKey="neto" stroke="hsl(180 45% 45%)" name="Ventas Netas" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Ventas por Tipo */}
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
                  ) : filteredTransactions.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(filteredTransactions.reduce((acc, t) => {
                              acc[t.tipo_ingreso] = (acc[t.tipo_ingreso] || 0) + t.monto_total;
                              return acc;
                            }, {} as Record<string, number>)).map(([tipo, monto]) => ({
                              tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1),
                              monto,
                              porcentaje: (monto / filteredTransactions.reduce((sum, t) => sum + t.monto_total, 0) * 100).toFixed(1)
                            }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ tipo, porcentaje }) => `${tipo} ${porcentaje}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="monto"
                          >
                            {Object.keys(filteredTransactions.reduce((acc, t) => {
                              acc[t.tipo_ingreso] = true;
                              return acc;
                            }, {} as Record<string, boolean>)).map((entry, index) => {
                              const colors = [
                                "hsl(180 50% 55%)", // Teal medio
                                "hsl(180 45% 45%)", // Teal oscuro
                                "hsl(180 55% 65%)", // Teal claro
                                "hsl(180 40% 40%)"  // Teal más oscuro
                              ];
                              return <Cell key={`cell-${index}`} fill={colors[index % 4]} />;
                            })}
                          </Pie>
                          <Tooltip 
                            formatter={(value) => [`$${formatCifra(Number(value), scaleFormat)}`, 'Monto']}
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px' }}
                            itemStyle={{ color: 'black' }}
                            labelStyle={{ color: 'black' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Gráfico de Estado de Pago */}
              <Card>
                <CardHeader>
                  <CardTitle>Estado de Pagos</CardTitle>
                  <CardDescription>Pagados, parciales y por cobrar</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Cargando gráfico...
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={(() => {
                              const estadoPagos = filteredTransactions.reduce((acc, t: any) => {
                                let estado = "Por Cobrar";
                                if (t.tipo_pago === "contado" || (t.monto_pagado && t.monto_pendiente === 0)) {
                                  estado = "Pagado Total";
                                } else if (t.tipo_pago === "parcial" || (t.monto_pagado > 0 && t.monto_pendiente > 0)) {
                                  estado = "Pago Parcial";
                                }
                                acc[estado] = (acc[estado] || 0) + t.monto_total;
                                return acc;
                              }, {} as Record<string, number>);
                              
                              return Object.entries(estadoPagos).map(([estado, monto]) => ({
                                estado,
                                monto,
                                porcentaje: (monto / filteredTransactions.reduce((sum, t) => sum + t.monto_total, 0) * 100).toFixed(1)
                              }));
                            })()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ estado, porcentaje }) => `${estado} ${porcentaje}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="monto"
                          >
                            <Cell fill="hsl(180 50% 55%)" />
                            <Cell fill="hsl(180 55% 65%)" />
                            <Cell fill="hsl(180 45% 45%)" />
                          </Pie>
                          <Tooltip 
                            formatter={(value) => [`$${formatCifra(Number(value), scaleFormat)}`, 'Monto']}
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px' }}
                            itemStyle={{ color: 'black' }}
                            labelStyle={{ color: 'black' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Gráfico por Subcuenta Contable */}
              <Card>
                <CardHeader>
                  <CardTitle>Ventas por Subcuenta</CardTitle>
                  <CardDescription>Distribución por subcuentas contables</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Cargando gráfico...
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(() => {
                          const subcuentaData = filteredTransactions.reduce((acc, t) => {
                            const subcuentaNombre = t.subcuenta_id 
                              ? (subcuentas.find(s => s.id === t.subcuenta_id)?.nombre || "Subcuenta desconocida")
                              : "Sin subcuenta asignada";
                            acc[subcuentaNombre] = (acc[subcuentaNombre] || 0) + t.monto_total;
                            return acc;
                          }, {} as Record<string, number>);
                          
                          return Object.entries(subcuentaData).map(([subcuenta, monto]) => ({
                            subcuenta,
                            monto
                          }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="subcuenta" angle={-45} textAnchor="end" height={100} />
                          <YAxis tickFormatter={(value) => formatCifra(value, scaleFormat)} />
                          <Tooltip 
                            formatter={(value) => [`$${formatCifra(Number(value), scaleFormat)}`, 'Monto']}
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px' }}
                            itemStyle={{ color: 'black' }}
                            labelStyle={{ color: 'black' }}
                          />
                          <Bar dataKey="monto" fill="hsl(180 50% 55%)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tablas de análisis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Tabla de Ventas por Producto */}
              <Card>
                <CardHeader>
                  <CardTitle>Ventas por Producto</CardTitle>
                  <CardDescription>Ranking de productos más vendidos</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Cargando datos...
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const productosVentas = filteredTransactions.reduce((acc, t) => {
                          if (t.tipo_ingreso === "precargados" || t.tipo_ingreso === "inventariados") {
                            const descripcionSinPrefijo = t.descripcion.replace('Venta de ', '').replace('Venta: ', '');
                            const producto = productos.find(p => 
                              p.nombre === t.descripcion || 
                              p.nombre === descripcionSinPrefijo ||
                              t.descripcion.includes(p.nombre)
                            );
                            
                            const productoKey = producto?.nombre || descripcionSinPrefijo;
                            if (!acc[productoKey]) {
                              acc[productoKey] = {
                                nombre: productoKey,
                                transacciones: 0,
                                monto: 0,
                                imagen: producto?.imagen_url
                              };
                            }
                            acc[productoKey].transacciones += 1;
                            acc[productoKey].monto += t.monto_total;
                          }
                          return acc;
                        }, {} as Record<string, { nombre: string; transacciones: number; monto: number; imagen?: string }>);
                        
                        return Object.values(productosVentas)
                          .sort((a, b) => b.monto - a.monto)
                          .slice(0, 10)
                          .map((producto) => (
                            <div key={producto.nombre} className="flex items-center gap-3 p-3 border rounded-lg">
                              {producto.imagen ? (
                                <img 
                                  src={producto.imagen} 
                                  alt={producto.nombre} 
                                  className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                  <Package className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{producto.nombre}</p>
                                <p className="text-sm text-muted-foreground">
                                  {producto.transacciones} {producto.transacciones === 1 ? 'transacción' : 'transacciones'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-primary hover:text-black transition-colors cursor-default">
                                  ${formatCifra(producto.monto, scaleFormat)}
                                </p>
                              </div>
                            </div>
                          ));
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tabla de Ventas por Cliente */}
              <Card>
                <CardHeader>
                  <CardTitle>Ventas por Cliente</CardTitle>
                  <CardDescription>Ranking de mejores clientes</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Cargando datos...
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const clientesVentas = filteredTransactions.reduce((acc, t: any) => {
                          const clienteNombre = t.cliente_nombre || "Sin cliente asignado";
                          if (!acc[clienteNombre]) {
                            acc[clienteNombre] = {
                              nombre: clienteNombre,
                              transacciones: 0,
                              monto: 0,
                              email: t.cliente_email,
                              telefono: t.cliente_telefono
                            };
                          }
                          acc[clienteNombre].transacciones += 1;
                          acc[clienteNombre].monto += t.monto_total;
                          return acc;
                        }, {} as Record<string, { nombre: string; transacciones: number; monto: number; email?: string; telefono?: string }>);
                        
                        return Object.values(clientesVentas)
                          .sort((a, b) => b.monto - a.monto)
                          .slice(0, 10)
                          .map((cliente) => (
                            <div key={cliente.nombre} className="flex items-center gap-3 p-3 border rounded-lg">
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Users className="w-6 h-6 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{cliente.nombre}</p>
                                <div className="text-sm text-muted-foreground space-y-0.5">
                                  <p>{cliente.transacciones} {cliente.transacciones === 1 ? 'compra' : 'compras'}</p>
                                  {cliente.telefono && <p className="text-xs">{cliente.telefono}</p>}
                                  {cliente.email && <p className="text-xs truncate">{cliente.email}</p>}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-primary hover:text-black transition-colors cursor-default">
                                  ${formatCifra(cliente.monto, scaleFormat)}
                                </p>
                              </div>
                            </div>
                          ));
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        );
      })()}
          </TabsContent>

          {/* TAB 4: CATÁLOGO DE PRODUCTOS */}
          <TabsContent value="catalogo" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Catálogo de Productos
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        refetchProductosServicios();
                        toast({
                          title: "Actualizado",
                          description: "La lista de productos se ha actualizado correctamente"
                        });
                      }}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Actualizar
                    </Button>
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
                          <Input id="product-name" value={productName} onChange={e => setProductName(e.target.value)} className="col-span-3" placeholder="Nombre del producto" />
                        </div>
                        
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="product-image" className="text-right">
                            Imagen
                          </Label>
                          <Input id="product-image" type="file" accept="image/*" onChange={e => setProductImage(e.target.files?.[0] || null)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="product-price" className="text-right">
                            Precio
                          </Label>
                          <Input id="product-price" type="number" value={productPrice} onChange={e => setProductPrice(e.target.value)} className="col-span-3" placeholder="0.00" />
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
                          <Select value={productSubcuenta} onValueChange={v => setProductSubcuenta(v === "none" ? "" : v)}>
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Sin subcuenta (usar cuenta principal)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin subcuenta (usar cuenta principal)</SelectItem>
                              {subcuentas.filter(subcuenta => subcuenta.cuenta_madre_codigo === "4001").map(subcuenta => <SelectItem key={subcuenta.id} value={subcuenta.id}>
                                    {subcuenta.nombre}
                                  </SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="product-description" className="text-right">
                            Descripción
                          </Label>
                          <Textarea id="product-description" value={productDescription} onChange={e => setProductDescription(e.target.value)} className="col-span-3" placeholder="Descripción opcional del producto" rows={3} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsProductDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSubmitProduct} disabled={isSubmittingProduct}>
                          {isSubmittingProduct ? "Guardando..." : "Guardar Producto"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Dialog para Editar Producto */}
                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Editar Producto</DialogTitle>
                        <DialogDescription>
                          Modifica la información del producto.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="edit-product-name" className="text-right">
                            Nombre *
                          </Label>
                          <Input 
                            id="edit-product-name" 
                            value={editProductName} 
                            onChange={e => setEditProductName(e.target.value)} 
                            className="col-span-3" 
                            placeholder="Ej: Consultoría, Producto X" 
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="edit-product-price" className="text-right">
                            Precio *
                          </Label>
                          <Input 
                            id="edit-product-price" 
                            type="number" 
                            value={editProductPrice} 
                            onChange={e => setEditProductPrice(e.target.value)} 
                            className="col-span-3" 
                            placeholder="0.00" 
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="edit-product-image" className="text-right">
                            Imagen
                          </Label>
                          <div className="col-span-3 space-y-2">
                            <Input 
                              id="edit-product-image" 
                              type="file" 
                              accept="image/*"
                              onChange={handleEditImageChange}
                            />
                            {editImagePreview && (
                              <div className="aspect-square w-24 mx-auto">
                                <img 
                                  src={editImagePreview} 
                                  alt="Preview" 
                                  className="w-full h-full object-cover rounded-md"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="edit-product-description" className="text-right">
                            Descripción
                          </Label>
                          <Textarea 
                            id="edit-product-description" 
                            value={editProductDescription} 
                            onChange={e => setEditProductDescription(e.target.value)} 
                            className="col-span-3" 
                            placeholder="Descripción opcional del producto" 
                            rows={3} 
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleUpdateProduct} disabled={isSubmittingProduct}>
                          {isSubmittingProduct ? "Actualizando..." : "Actualizar Producto"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  </div>
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
                  {loadingProductosServicios ? <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div> : productosServicios.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                      No hay productos de servicios registrados aún
                    </div> : <div className="space-y-6">
                      {/* Productos con subcuentas */}
                      {subcuentas.filter(subcuenta => subcuenta.cuenta_madre_codigo === "4001").map(subcuenta => {
                    const productosSubcuenta = productosServicios.filter(p => p.subcuenta_id === subcuenta.id);
                    if (productosSubcuenta.length === 0) return null;
                    return <Card key={subcuenta.id}>
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
                                  {productosSubcuenta.map(producto => <div key={producto.id} className="border rounded-lg p-4 space-y-3">
                                      {producto.imagen_url && <div className="aspect-square w-full max-w-24 mx-auto">
                                          <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover rounded-md" />
                                        </div>}
                                      <div>
                                        <h4 className="font-semibold">{producto.nombre}</h4>
                                        {producto.descripcion && <p className="text-sm text-muted-foreground">{producto.descripcion}</p>}
                                        <p className="text-lg font-bold text-primary">${producto.precio.toFixed(2)}</p>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(producto)} className="flex-1">
                                          Editar
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => deleteProducto.mutate(producto.id)} className="flex-1 text-destructive hover:text-destructive">
                                          Eliminar
                                        </Button>
                                      </div>
                                    </div>)}
                                </div>
                              </CardContent>
                            </Card>;
                  })}
                      
                      {/* Productos sin subcuenta (cuenta general) */}
                      {(() => {
                    const productosSinSubcuenta = productosServicios.filter(p => !p.subcuenta_id);
                    if (productosSinSubcuenta.length === 0) return null;
                    return <Card>
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
                                {productosSinSubcuenta.map(producto => <div key={producto.id} className="border rounded-lg p-4 space-y-3">
                                    {producto.imagen_url && <div className="aspect-square w-full max-w-24 mx-auto">
                                        <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover rounded-md" />
                                      </div>}
                                    <div>
                                      <h4 className="font-semibold">{producto.nombre}</h4>
                                      {producto.descripcion && <p className="text-sm text-muted-foreground">{producto.descripcion}</p>}
                                      <p className="text-lg font-bold text-primary">${producto.precio.toFixed(2)}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(producto)} className="flex-1">
                                        Editar
                                      </Button>
                                      <Button variant="outline" size="sm" onClick={() => deleteProducto.mutate(producto.id)} className="flex-1 text-destructive hover:text-destructive">
                                        Eliminar
                                      </Button>
                                    </div>
                                  </div>)}
                              </div>
                            </CardContent>
                          </Card>;
                  })()}
                    </div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>;
};
export default RegistroIngresos;