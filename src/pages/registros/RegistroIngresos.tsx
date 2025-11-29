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
import { AlertCircle, Plus, ShoppingCart, Package, FileText, Gift, CreditCard, Wallet, Calculator, Users, RefreshCw, CalendarIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList, Treemap } from "recharts";
import { useVentasResumen } from "@/hooks/useVentasResumen";
import { useTransaccionesRecientes } from "@/hooks/useTransaccionesRecientes";
import { useSubcuentas } from "@/hooks/useSubcuentas";
import { useProductos, useProductosServicios, useCreateProducto, useUpdateProducto, useDeleteProducto } from "@/hooks/useProductos";
import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";
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

// Función helper para obtener el valor de métrica según el tipo seleccionado
const getMetricValue = (transaction: any, metricType: "brutas" | "descuentos" | "netas"): number => {
  if (metricType === "brutas") return transaction.monto_total || 0;
  if (metricType === "descuentos") return transaction.monto_descuento || 0;
  if (metricType === "netas") return transaction.monto_neto || transaction.monto_total || 0;
  return 0;
};

// Función para parsear fechas DATE correctamente (evita problemas de zona horaria UTC)
const parseDateSafe = (dateString: string): Date => {
  // Forzar interpretación local, no UTC
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Función para ajustar proporcionalmente los datos para que sumen el total real de asientos contables
const ajustarProporcionalmente = (
  datosTransacciones: { [key: string]: number },
  totalReal: number
): { [key: string]: number } => {
  const totalTransacciones = Object.values(datosTransacciones).reduce((sum, val) => sum + val, 0);
  if (totalTransacciones === 0) return datosTransacciones;
  
  const factor = totalReal / totalTransacciones;
  const resultado: { [key: string]: number } = {};
  
  Object.entries(datosTransacciones).forEach(([key, valor]) => {
    resultado[key] = valor * factor;
  });
  
  return resultado;
};

// Componente personalizado para celdas del TreeMap
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, value, porcentaje } = props;
  
  const isEfectivo = name === "Efectivo";
  const color = isEfectivo ? "hsl(180 50% 55%)" : "hsl(180 45% 45%)";
  
  // Determinar si hay suficiente espacio para el texto
  const showFullText = width > 100 && height > 70;
  
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
      />
      {showFullText && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 20}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#000000"
            fontWeight="bold"
            fontSize="16px"
            style={{ userSelect: 'none' }}
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 5}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#000000"
            fontSize="14px"
            fontWeight="600"
            style={{ userSelect: 'none' }}
          >
            ${formatCifra(value, "general")}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 25}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#000000"
            fontSize="14px"
            fontWeight="600"
            style={{ userSelect: 'none' }}
          >
            {porcentaje}%
          </text>
        </>
      )}
    </g>
  );
};

// Tooltip personalizado para el TreeMap
const CustomTreemapTooltip = ({ active, payload, scaleFormat }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isEfectivo = data.name === "Efectivo";
    
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="font-bold text-foreground mb-1">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          Monto: <span className="font-semibold text-foreground">${formatCifra(data.value, scaleFormat)}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Porcentaje: <span className="font-semibold text-foreground">{data.porcentaje}%</span>
        </p>
        <p className="text-xs text-muted-foreground mt-2 italic">
          {isEfectivo ? "Se registra en Efectivo (Caja)" : "Se registra en Bancos"}
        </p>
      </div>
    );
  }
  return null;
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
    data: productosInventarioData = [],
    isLoading: loadingProductosInventario,
    refetch: refetchProductosInventario
  } = useInventarioConMovimientos();
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
  
  // Estado para el tipo de métrica a mostrar
  const [metricType, setMetricType] = useState<"brutas" | "descuentos" | "netas">("brutas");
  
  // Estado para el tipo de ingreso a analizar
  const [tipoIngresoAnalisis, setTipoIngresoAnalisis] = useState<"ventas" | "otros">("ventas");
  
  // Estados para fechas específicas de análisis
  const [fechaAnalisisDiario, setFechaAnalisisDiario] = useState<Date>(new Date());
  const [fechaAnalisisMensual, setFechaAnalisisMensual] = useState<Date>(new Date());
  
  // Estados para totales calculados desde asientos contables
  const [totalesDia, setTotalesDia] = useState({ ventasBrutas: 0, descuentos: 0, ventasNetas: 0, otrosIngresos: 0, totalIngresos: 0 });
  const [totalesMes, setTotalesMes] = useState({ ventasBrutas: 0, descuentos: 0, ventasNetas: 0, otrosIngresos: 0, totalIngresos: 0 });
  const [totalesAno, setTotalesAno] = useState({ ventasBrutas: 0, descuentos: 0, ventasNetas: 0, otrosIngresos: 0, totalIngresos: 0 });

  // Estado para datos de analíticas calculados desde asientos contables
  const [datosAnaliticas, setDatosAnaliticas] = useState<{
    ventasBrutas: number;
    descuentos: number;
    ventasNetas: number;
    otrosIngresos: number;
    detallesPorPeriodo: Array<{
      periodo: string;
      ventasBrutas: number;
      descuentos: number;
      ventasNetas: number;
      otrosIngresos: number;
    }>;
  }>({
    ventasBrutas: 0,
    descuentos: 0,
    ventasNetas: 0,
    otrosIngresos: 0,
    detallesPorPeriodo: []
  });

  // Estado para movimientos de inventario (para analítica de ventas por producto)
  const [movimientosInventario, setMovimientosInventario] = useState<any[]>([]);

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
  
  // Estados para inventario - manejo múltiple con descuentos
  const [inventoryProductDiscount, setInventoryProductDiscount] = useState("0");
  const [inventoryDiscountType, setInventoryDiscountType] = useState<"monto" | "porcentaje">("monto");
  const [selectedInventoryProducts, setSelectedInventoryProducts] = useState<Array<{
    id: string;
    nombre: string;
    precioUnitario: number;
    cantidad: number;
    descuento: number;
    subtotal: number;
    stockDisponible: number;
    costoUnitario: number;
    imagen_url?: string;
  }>>([]);

  // Estados para productos precargados - ahora manejando múltiples productos
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productUnitPrice, setProductUnitPrice] = useState("");
  const [productQuantity, setProductQuantity] = useState("1");
  const [productDiscount, setProductDiscount] = useState("0");
  const [productDiscountType, setProductDiscountType] = useState<"monto" | "porcentaje">("monto");
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

  // Estados para cancelación de transacciones
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [transaccionACancelar, setTransaccionACancelar] = useState<any>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [isCanceling, setIsCanceling] = useState(false);

  // Estados para editar producto
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editProductPrice, setEditProductPrice] = useState("");
  const [editProductDescription, setEditProductDescription] = useState("");
  const [editProductImage, setEditProductImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editProductSubcuenta, setEditProductSubcuenta] = useState<string>("");

  // Productos de inventario ya vienen filtrados y calculados desde useInventarioConMovimientos
  const productosInventario = productosInventarioData || [];

  // Función para manejar selección de producto de inventario
  const handleInventoryProductSelection = (productId: string) => {
    setSelectedInventoryProductId(productId);
    const selectedProduct = productosInventario.find(p => p.id === productId);
    if (selectedProduct) {
      // Usar precio de venta si está disponible, si no, usar costo unitario
      const precioVenta = selectedProduct.precio_venta;
      const precioAUsar = precioVenta && precioVenta > 0 ? precioVenta.toString() : selectedProduct.costo_unitario?.toString() || "0";

      // Si tiene precio de venta registrado, activar esa opción por defecto
      const tienePrecioRegistrado = precioVenta && precioVenta > 0;
      setUsePrecioRegistrado(tienePrecioRegistrado);
      setInventoryProductPrice(precioAUsar);
      setAvailableStock(selectedProduct.cantidad_stock || 0);
      // Autocompletar descripción
      setDescripcion(`Venta de ${selectedProduct.nombre}`);
      // Calcular monto total
      const precioNumerico = precioVenta && precioVenta > 0 ? precioVenta : selectedProduct.costo_unitario || 0;
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
    
    const selectedProduct = productosServicios.find(p => p.id === selectedProductId);
    if (!selectedProduct) return;

    const cantidad = parseFloat(productQuantity) || 1;
    const discountValue = parseFloat(productDiscount) || 0;
    const subtotalSinDescuento = selectedProduct.precio * cantidad;
    
    // Calcular descuento según el tipo
    const descuento = productDiscountType === "porcentaje" 
      ? subtotalSinDescuento * (discountValue / 100)
      : discountValue;
    
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

  // Función para agregar producto de inventario a la lista
  const handleAddInventoryProductToList = () => {
    if (!selectedInventoryProductId) return;
    
    const selectedProduct = productosInventario.find(p => p.id === selectedInventoryProductId);
    if (!selectedProduct) return;

    const cantidad = parseFloat(inventoryQuantity) || 1;
    const precioUnitario = parseFloat(inventoryProductPrice) || 0;
    const discountValue = parseFloat(inventoryProductDiscount) || 0;
    const subtotalSinDescuento = precioUnitario * cantidad;
    
    // Calcular descuento según el tipo
    const descuento = inventoryDiscountType === "porcentaje" 
      ? subtotalSinDescuento * (discountValue / 100)
      : discountValue;
    
    const subtotal = Math.max(0, subtotalSinDescuento - descuento);

    // Verificar si el producto ya está en la lista
    const existingProductIndex = selectedInventoryProducts.findIndex(p => p.id === selectedInventoryProductId);
    
    if (existingProductIndex !== -1) {
      // Si ya existe, actualizar cantidad y recalcular
      const updatedProducts = [...selectedInventoryProducts];
      updatedProducts[existingProductIndex].cantidad += cantidad;
      updatedProducts[existingProductIndex].descuento += descuento;
      const nuevoSubtotalSinDescuento = updatedProducts[existingProductIndex].precioUnitario * updatedProducts[existingProductIndex].cantidad;
      updatedProducts[existingProductIndex].subtotal = Math.max(0, nuevoSubtotalSinDescuento - updatedProducts[existingProductIndex].descuento);
      setSelectedInventoryProducts(updatedProducts);
    } else {
      // Agregar nuevo producto
      setSelectedInventoryProducts([...selectedInventoryProducts, {
        id: selectedInventoryProductId,
        nombre: selectedProduct.nombre,
        precioUnitario: precioUnitario,
        cantidad: cantidad,
        descuento: descuento,
        subtotal: subtotal,
        stockDisponible: selectedProduct.cantidad_stock || 0,
        costoUnitario: selectedProduct.costo_unitario || 0,
        imagen_url: selectedProduct.imagen_url
      }]);
    }

    // Limpiar formulario
    setSelectedInventoryProductId("");
    setInventoryQuantity("1");
    setInventoryProductPrice("");
    setInventoryProductDiscount("0");
    setInventoryDiscountType("monto");
    setAvailableStock(0);
    setUsePrecioRegistrado(true);
    
    toast({
      title: "✅ Producto agregado",
      description: `${selectedProduct.nombre} agregado a la venta`
    });
  };

  // Función para eliminar producto de inventario de la lista
  const handleRemoveInventoryProductFromList = (productId: string) => {
    setSelectedInventoryProducts(selectedInventoryProducts.filter(p => p.id !== productId));
    toast({
      title: "Producto eliminado",
      description: "El producto ha sido removido de la venta"
    });
  };

  // Calcular total de productos precargados
  useEffect(() => {
    if (selectedIncomeType === 'precargados' && selectedProducts.length > 0) {
      const total = selectedProducts.reduce((sum, p) => sum + p.subtotal, 0).toFixed(2);
      setMontoTotal(total);
      setDescripcion(`Venta de ${selectedProducts.length} producto(s)`);
    }
  }, [selectedProducts, selectedIncomeType]);

  // Calcular total de productos inventariados
  useEffect(() => {
    if (selectedIncomeType === 'inventariados' && selectedInventoryProducts.length > 0) {
      const total = selectedInventoryProducts.reduce((sum, p) => sum + p.subtotal, 0).toFixed(2);
      setMontoTotal(total);
      setDescripcion(`Venta de ${selectedInventoryProducts.length} producto(s) de inventario`);
    }
  }, [selectedInventoryProducts, selectedIncomeType]);

  // Función para manejar selección de producto precargado (para actualizar precio)
  const handleProductSelection = (productId: string) => {
    setSelectedProductId(productId);
    const selectedProduct = productosServicios.find(p => p.id === productId);
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
      if (selectedInventoryProducts.length === 0) errors.push('Debe agregar al menos un producto del inventario');
    } else if (selectedIncomeType === 'general' || selectedIncomeType === 'otros') {
      if (!descripcion.trim()) errors.push('Descripción');
    }
    if (selectedIncomeType !== 'precargados' && selectedIncomeType !== 'inventariados' && (!montoTotal || parseFloat(montoTotal) <= 0)) errors.push('Monto Total');

    // Validación de datos del cliente para cuentas pendientes (crédito o parcial)
    if (paymentStatus === 'credito' || paymentStatus === 'parcial') {
      if (!tipoCliente) errors.push('Tipo de Cliente');
      if (tipoCliente === 'recurrente' && !clienteSeleccionado) errors.push('Cliente Seleccionado');
      
      // Solo validar datos del cliente si es NUEVO
      if (tipoCliente === 'nuevo') {
        if (!clienteNombre.trim()) errors.push('Nombre del Cliente');
        if (!clienteTelefono.trim()) errors.push('Teléfono del Cliente');
        if (!clienteEmail.trim()) errors.push('Email del Cliente');
      }
      
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

  // useEffect para calcular analíticas desde asientos contables
  useEffect(() => {
    const calcularAnaliticasDesdeAsientos = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return;

      try {
        // Determinar el rango de fechas según el período seleccionado
        let fechaInicio: Date;
        let fechaFin: Date;

        if (periodFilter === "diario") {
          fechaInicio = new Date(fechaAnalisisDiario);
          fechaInicio.setHours(0, 0, 0, 0);
          fechaFin = new Date(fechaAnalisisDiario);
          fechaFin.setHours(23, 59, 59, 999);
        } else if (periodFilter === "mensual") {
          fechaInicio = new Date(fechaAnalisisMensual.getFullYear(), fechaAnalisisMensual.getMonth(), 1);
          fechaFin = new Date(fechaAnalisisMensual.getFullYear(), fechaAnalisisMensual.getMonth() + 1, 0, 23, 59, 59, 999);
        } else {
          // Anual
          fechaInicio = new Date(new Date().getFullYear(), 0, 1);
          fechaFin = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999);
        }

        // Consultar asientos contables en el rango de fechas
        const { data: asientos, error: asientosError } = await supabase
          .from('asientos_contables')
          .select('id, fecha, descripcion')
          .eq('user_id', user.user.id)
          .gte('fecha', fechaInicio.toISOString().split('T')[0])
          .lte('fecha', fechaFin.toISOString().split('T')[0]);

        if (asientosError) throw asientosError;
        if (!asientos || asientos.length === 0) {
          setDatosAnaliticas({
            ventasBrutas: 0,
            descuentos: 0,
            ventasNetas: 0,
            otrosIngresos: 0,
            detallesPorPeriodo: []
          });
          return;
        }

        // Obtener detalles de asientos
        const asientoIds = asientos.map(a => a.id);
        const { data: detalles, error: detallesError } = await supabase
          .from('detalle_asientos')
          .select('asiento_id, cuenta_codigo, debe, haber')
          .in('asiento_id', asientoIds);

        if (detallesError) throw detallesError;
        if (!detalles) return;

        // Calcular totales según tipo de ingreso
        let ventasBrutasTotal = 0;
        let descuentosTotal = 0;
        let otrosIngresosTotal = 0;

        // Agrupar detalles por período para la gráfica
        const detallesPorPeriodoMap: Record<string, {
          ventasBrutas: number;
          descuentos: number;
          otrosIngresos: number;
        }> = {};

        asientos.forEach(asiento => {
          const detallesAsiento = detalles.filter(d => d.asiento_id === asiento.id);
          const fecha = parseDateSafe(asiento.fecha);
          
          // Determinar la clave del período
          let periodKey: string;
          if (periodFilter === "diario") {
            periodKey = "Hoy";
          } else if (periodFilter === "mensual") {
            periodKey = `Día ${fecha.getDate()}`;
          } else {
            const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            periodKey = meses[fecha.getMonth()];
          }

          if (!detallesPorPeriodoMap[periodKey]) {
            detallesPorPeriodoMap[periodKey] = {
              ventasBrutas: 0,
              descuentos: 0,
              otrosIngresos: 0
            };
          }

          detallesAsiento.forEach(detalle => {
            const debe = detalle.debe || 0;
            const haber = detalle.haber || 0;
            const cuenta = detalle.cuenta_codigo;

            if (tipoIngresoAnalisis === "ventas") {
              // Ventas brutas (cuenta 4001)
              if (cuenta === '4001') {
                const monto = haber - debe;
                ventasBrutasTotal += monto;
                detallesPorPeriodoMap[periodKey].ventasBrutas += monto;
              }
              // Descuentos (cuenta 4003)
              if (cuenta === '4003') {
                const monto = debe - haber;
                descuentosTotal += monto;
                detallesPorPeriodoMap[periodKey].descuentos += monto;
              }
            } else {
              // Otros ingresos (cuentas 4XXX excepto 4001 y 4003)
              if (cuenta.startsWith('4') && cuenta !== '4001' && cuenta !== '4003') {
                const monto = haber - debe;
                otrosIngresosTotal += monto;
                detallesPorPeriodoMap[periodKey].otrosIngresos += monto;
              }
            }
          });
        });

        // Construir array de detalles por período
        let detallesPorPeriodo: Array<{
          periodo: string;
          ventasBrutas: number;
          descuentos: number;
          ventasNetas: number;
          otrosIngresos: number;
        }> = [];

        if (periodFilter === "diario") {
          // Un solo punto para el día
          const data = detallesPorPeriodoMap["Hoy"] || { ventasBrutas: 0, descuentos: 0, otrosIngresos: 0 };
          detallesPorPeriodo = [{
            periodo: "Hoy",
            ventasBrutas: data.ventasBrutas,
            descuentos: data.descuentos,
            ventasNetas: data.ventasBrutas - data.descuentos,
            otrosIngresos: data.otrosIngresos
          }];
        } else if (periodFilter === "mensual") {
          // Días del mes
          const daysInMonth = new Date(fechaAnalisisMensual.getFullYear(), fechaAnalisisMensual.getMonth() + 1, 0).getDate();
          detallesPorPeriodo = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const periodKey = `Día ${day}`;
            const data = detallesPorPeriodoMap[periodKey] || { ventasBrutas: 0, descuentos: 0, otrosIngresos: 0 };
            return {
              periodo: periodKey,
              ventasBrutas: data.ventasBrutas,
              descuentos: data.descuentos,
              ventasNetas: data.ventasBrutas - data.descuentos,
              otrosIngresos: data.otrosIngresos
            };
          });
        } else {
          // Meses del año
          const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
          detallesPorPeriodo = meses.map(mes => {
            const data = detallesPorPeriodoMap[mes] || { ventasBrutas: 0, descuentos: 0, otrosIngresos: 0 };
            return {
              periodo: mes,
              ventasBrutas: data.ventasBrutas,
              descuentos: data.descuentos,
              ventasNetas: data.ventasBrutas - data.descuentos,
              otrosIngresos: data.otrosIngresos
            };
          });
        }

        setDatosAnaliticas({
          ventasBrutas: ventasBrutasTotal,
          descuentos: descuentosTotal,
          ventasNetas: ventasBrutasTotal - descuentosTotal,
          otrosIngresos: otrosIngresosTotal,
          detallesPorPeriodo
        });
      } catch (error) {
        console.error('Error calculando analíticas desde asientos:', error);
      }
    };

    calcularAnaliticasDesdeAsientos();
  }, [periodFilter, fechaAnalisisDiario, fechaAnalisisMensual, tipoIngresoAnalisis]);

  // useEffect para calcular totales desde asientos contables
  useEffect(() => {
    const calcularTotales = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) return;

        const calcularPeriodo = async (periodo: 'dia' | 'mes' | 'ano') => {
          const today = new Date();
          let startDate: string;
          let endDate: string;

          if (periodo === 'dia') {
            const selectedDate = fechaAnalisisDiario;
            startDate = selectedDate.toISOString().split('T')[0];
            endDate = startDate;
          } else if (periodo === 'mes') {
            const selectedMonth = fechaAnalisisMensual.getMonth();
            const selectedYear = fechaAnalisisMensual.getFullYear();
            const firstDay = new Date(selectedYear, selectedMonth, 1);
            const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
            startDate = firstDay.toISOString().split('T')[0];
            endDate = lastDay.toISOString().split('T')[0];
          } else {
            const year = today.getFullYear();
            startDate = `${year}-01-01`;
            endDate = `${year}-12-31`;
          }

          const { data: detalles, error } = await supabase
            .from('detalle_asientos')
            .select(`
              id,
              cuenta_codigo,
              debe,
              haber,
              asiento_id,
              asientos_contables!inner(
                fecha,
                user_id
              )
            `)
            .eq('asientos_contables.user_id', user.user.id)
            .gte('asientos_contables.fecha', startDate)
            .lte('asientos_contables.fecha', endDate)
            .like('cuenta_codigo', '4%');

          if (error) throw error;

          let ventasBrutas = 0;
          let descuentos = 0;
          let otrosIngresos = 0;

          (detalles || []).forEach(detalle => {
            const debe = Number(detalle.debe) || 0;
            const haber = Number(detalle.haber) || 0;
            const cuenta = detalle.cuenta_codigo;

            if (cuenta === '4001') {
              ventasBrutas += (haber - debe);
            } else if (cuenta === '4003') {
              descuentos += (debe - haber);
            } else if (cuenta?.startsWith('4')) {
              otrosIngresos += (haber - debe);
            }
          });

          const ventasNetas = ventasBrutas - descuentos;
          const totalIngresos = ventasNetas + otrosIngresos;

          return { ventasBrutas, descuentos, ventasNetas, otrosIngresos, totalIngresos };
        };

        // Función para cargar movimientos de inventario para analítica
        const cargarMovimientosInventario = async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            // Calcular rango de fechas según el filtro de período
            let startDate: Date;
            let endDate: Date = new Date();
            
            if (periodFilter === 'diario') {
              startDate = new Date(fechaAnalisisDiario);
              startDate.setHours(0, 0, 0, 0);
              endDate = new Date(fechaAnalisisDiario);
              endDate.setHours(23, 59, 59, 999);
            } else if (periodFilter === 'mensual') {
              startDate = new Date(fechaAnalisisMensual.getFullYear(), fechaAnalisisMensual.getMonth(), 1);
              endDate = new Date(fechaAnalisisMensual.getFullYear(), fechaAnalisisMensual.getMonth() + 1, 0, 23, 59, 59, 999);
            } else { // anual
              startDate = new Date(fechaAnalisisMensual.getFullYear(), 0, 1);
              endDate = new Date(fechaAnalisisMensual.getFullYear(), 11, 31, 23, 59, 59, 999);
            }
            
            // Consultar movimientos de venta con información del producto
            const { data: movimientos, error } = await supabase
              .from('movimientos_inventario')
              .select(`
                *,
                productos (
                  id,
                  nombre,
                  precio_venta,
                  imagen_url
                )
              `)
              .eq('user_id', user.id)
              .eq('tipo_movimiento', 'venta')
              .gte('created_at', startDate.toISOString())
              .lte('created_at', endDate.toISOString())
              .order('created_at', { ascending: false });
            
            if (error) {
              console.error('Error cargando movimientos:', error);
              setMovimientosInventario([]);
              return;
            }
            
            setMovimientosInventario(movimientos || []);
          } catch (error) {
            console.error('Error en cargarMovimientosInventario:', error);
            setMovimientosInventario([]);
          }
        };

        const [dia, mes, ano] = await Promise.all([
          calcularPeriodo('dia'),
          calcularPeriodo('mes'),
          calcularPeriodo('ano')
        ]);

        setTotalesDia(dia);
        setTotalesMes(mes);
        setTotalesAno(ano);
      } catch (error) {
        console.error('Error calculando totales:', error);
      }
    };

    calcularTotales();
    
    // Cargar movimientos de inventario para analítica
    const loadMovimientos = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Calcular rango de fechas según el filtro de período
        let startDate: Date;
        let endDate: Date = new Date();
        
        if (periodFilter === 'diario') {
          startDate = new Date(fechaAnalisisDiario);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(fechaAnalisisDiario);
          endDate.setHours(23, 59, 59, 999);
        } else if (periodFilter === 'mensual') {
          startDate = new Date(fechaAnalisisMensual.getFullYear(), fechaAnalisisMensual.getMonth(), 1);
          endDate = new Date(fechaAnalisisMensual.getFullYear(), fechaAnalisisMensual.getMonth() + 1, 0, 23, 59, 59, 999);
        } else { // anual
          startDate = new Date(fechaAnalisisMensual.getFullYear(), 0, 1);
          endDate = new Date(fechaAnalisisMensual.getFullYear(), 11, 31, 23, 59, 59, 999);
        }
        
        // Consultar movimientos de venta con información del producto
        const { data: movimientos, error } = await supabase
          .from('movimientos_inventario')
          .select(`
            *,
            productos (
              id,
              nombre,
              precio_venta,
              imagen_url
            )
          `)
          .eq('user_id', user.id)
          .eq('tipo_movimiento', 'venta')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error cargando movimientos:', error);
          setMovimientosInventario([]);
          return;
        }
        
        setMovimientosInventario(movimientos || []);
      } catch (error) {
        console.error('Error en loadMovimientos:', error);
        setMovimientosInventario([]);
      }
    };
    
    loadMovimientos();
  }, [fechaAnalisisDiario, fechaAnalisisMensual, periodFilter, transacciones]);

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
    if (selectedIncomeType === 'inventariados') {
      if (selectedInventoryProducts.length === 0) {
        toast({
          title: "⚠️ No hay productos",
          description: "Debes agregar al menos un producto del inventario a la venta",
          variant: "destructive"
        });
        return;
      }
      
      // Validar stock por cada producto
      for (const producto of selectedInventoryProducts) {
        if (producto.cantidad > producto.stockDisponible) {
          // Mostrar diálogo de inventario negativo para el primer producto con problema
          const productoInventario = productosInventario.find(p => p.id === producto.id);
          setNegativeStockData({
            productName: producto.nombre,
            requested: producto.cantidad,
            available: producto.stockDisponible,
            costoPorUnidad: productoInventario?.costo_unitario || 0,
            costoTotal: (productoInventario?.costo_unitario || 0) * producto.cantidad
          });
          setShowNegativeStockDialog(true);
          return;
        }
      }
      
      // Si pasó todas las validaciones, procesar
      await processIngreso();
      return;
    }

    // Para otros tipos, validación normal de stock
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
      let descuento = 0; // Inicializar variable de descuento
      
      if (selectedIncomeType === 'precargados' && selectedProducts.length > 0) {
        // Para múltiples productos, usar la primera subcuenta o null
        const firstProduct = productosServicios.find(p => p.id === selectedProducts[0].id);
        subcuentaToSend = firstProduct?.subcuenta_id || null;
        // Calcular monto total SIN descuento y el descuento total
        const subtotalSinDescuento = selectedProducts.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);
        const descuentoTotal = selectedProducts.reduce((sum, p) => sum + p.descuento, 0);
        montoTotalDerived = subtotalSinDescuento; // El monto total es ANTES del descuento
        descuento = descuentoTotal; // Guardar el descuento total para enviarlo
        descripcionToSend = `Venta: ${selectedProducts.map(p => `${p.nombre} (x${p.cantidad})`).join(', ')}`;
      } else if (selectedIncomeType === 'inventariados') {
        // Para productos inventariados múltiples, procesaremos cada uno por separado
        // Aquí solo preparamos valores por defecto que no se usarán en este flujo
        descripcionToSend = `Venta de productos inventariados`;
        montoTotalDerived = 0;
        subcuentaToSend = null;
      }
      // Si no es precargados, usar el descuento del formulario general
      if (selectedIncomeType !== 'precargados') {
        descuento = hasDiscount ? Number(discountAmount || '0') : 0;
      }
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
      // MANEJO ESPECIAL PARA PRODUCTOS INVENTARIADOS MÚLTIPLES
      if (selectedIncomeType === 'inventariados' && selectedInventoryProducts.length > 0) {
        // Calcular totales
        const montoTotalVenta = selectedInventoryProducts.reduce((sum, p) => sum + (p.precioUnitario * p.cantidad), 0);
        const montoDescuentoTotal = selectedInventoryProducts.reduce((sum, p) => sum + p.descuento, 0);
        const montoNetoVenta = montoTotalVenta - montoDescuentoTotal;
        
        // Calcular monto pagado y pendiente basado en el neto total
        let montoPagadoFinal = 0;
        let montoPendienteFinal = 0;
        if (paymentStatus === 'contado') {
          montoPagadoFinal = montoNetoVenta;
          montoPendienteFinal = 0;
        } else if (paymentStatus === 'parcial') {
          montoPagadoFinal = Number(montoAbonado || '0');
          montoPendienteFinal = Math.max(0, montoNetoVenta - montoPagadoFinal);
        } else if (paymentStatus === 'credito') {
          montoPagadoFinal = 0;
          montoPendienteFinal = montoNetoVenta;
        }
        
        // Procesar cada producto del inventario
        for (const producto of selectedInventoryProducts) {
          const productoInventario = productosInventario.find(p => p.id === producto.id);
          if (!productoInventario) continue;
          
          // Descripción de la venta
          const descripcionVenta = selectedInventoryProducts.length === 1 
            ? `Venta de ${producto.nombre}`
            : `Venta múltiple (${selectedInventoryProducts.length} productos): ${producto.nombre}`;
          
          // Calcular proporción de pago para este producto
          const proporcionProducto = producto.subtotal / montoNetoVenta;
          const montoPagadoProducto = montoPagadoFinal * proporcionProducto;
          const montoPendienteProducto = montoPendienteFinal * proporcionProducto;
          
          // Llamar a edge function registrar-ingreso para CADA producto
          const { data: result, error: edgeFunctionError } = await supabase.functions.invoke('registrar-ingreso', {
            body: {
              tipoIngreso: 'inventariados',
              descripcion: descripcionVenta,
              montoTotal: producto.precioUnitario * producto.cantidad, // Subtotal antes de descuento
              montoDescuento: producto.descuento,
              cuentaPrincipalCodigo: '4001',
              subcuentaId: productoInventario.subcuenta_id || null,
              metodoPago: paymentMethod,
              tipoPago: paymentStatus,
              montoPagado: montoPagadoProducto,
              montoPendiente: montoPendienteProducto,
              clienteNombre: clienteNombre.trim() || null,
              clienteTelefono: clienteTelefono.trim() || null,
              clienteEmail: clienteEmail.trim() || null,
              clienteRFC: clienteRFC.trim() || null,
              clienteId: clienteId,
              fechaVencimiento: fechaVencimiento || null,
              comentarios: comentarios.trim() || null,
              // Campos específicos para inventario
              productoId: producto.id,
              cantidadVendida: producto.cantidad,
              precioVenta: producto.precioUnitario,
              costoPersonalizado: tipoCostoInventarioNegativo === "personalizado" && costoPersonalizado 
                ? parseFloat(costoPersonalizado) 
                : undefined
            }
          });
          
          if (edgeFunctionError) throw edgeFunctionError;
        }
        
        // Mensaje de éxito
        toast({
          title: "✅ Venta registrada exitosamente",
          description: `Se registraron ${selectedInventoryProducts.length} productos del inventario`,
          duration: 5000
        });
      } else {
        // FLUJO NORMAL PARA OTROS TIPOS DE INGRESO
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
            cuentaPrincipalCodigo: selectedIncomeType === 'otros' ? '4102' : '4001',
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
            // Datos adicionales para inventario (flujo antiguo, no debería llegar aquí)
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
      }

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
      setSelectedInventoryProducts([]);
      setInventoryProductDiscount("0");
      setInventoryDiscountType("monto");
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

  // Función para cancelar una transacción
  const handleCancelarTransaccion = async () => {
    if (!transaccionACancelar || !motivoCancelacion.trim()) {
      toast({
        title: "⚠️ Motivo requerido",
        description: "Debes ingresar el motivo de la cancelación",
        variant: "destructive"
      });
      return;
    }

    setIsCanceling(true);
    try {
      console.log('Cancelando transacción:', transaccionACancelar.id);
      
      const { data, error } = await supabase.functions.invoke('cancelar-ingreso', {
        body: {
          transaccionId: transaccionACancelar.id,
          motivoCancelacion: motivoCancelacion.trim()
        }
      });

      console.log('Respuesta de edge function:', { data, error });

      if (error) {
        console.error('Error de edge function:', error);
        throw new Error(error.message || JSON.stringify(error));
      }

      // Verificar si la respuesta indica error
      if (data?.error) {
        console.error('Error en data:', data);
        throw new Error(data.error);
      }

      toast({
        title: "✓ Transacción cancelada",
        description: `Asiento de reversión ${data?.numeroAsientoReversion || 'creado'} correctamente`
      });

      // Refrescar datos
      await Promise.all([refetchVentas(), refetchTransacciones()]);

      // Limpiar y cerrar diálogo
      setMotivoCancelacion("");
      setTransaccionACancelar(null);
      setIsCancelDialogOpen(false);

    } catch (error: any) {
      console.error('Error completo al cancelar:', error);
      toast({
        title: "❌ Error al cancelar",
        description: error?.message || error?.toString() || "No se pudo cancelar la transacción",
        variant: "destructive"
      });
    } finally {
      setIsCanceling(false);
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
                    <div className="flex gap-2">
                      <RadioGroup 
                        value={productDiscountType} 
                        onValueChange={(value: "monto" | "porcentaje") => setProductDiscountType(value)}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="monto" id="descuento-monto" />
                          <Label htmlFor="descuento-monto" className="cursor-pointer">Monto</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="porcentaje" id="descuento-porcentaje" />
                          <Label htmlFor="descuento-porcentaje" className="cursor-pointer">%</Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <Input 
                      id="descuento-producto" 
                      type="number" 
                      placeholder={productDiscountType === "porcentaje" ? "0" : "0.00"}
                      min="0"
                      max={productDiscountType === "porcentaje" ? "100" : undefined}
                      step={productDiscountType === "porcentaje" ? "1" : "0.01"}
                      value={productDiscount} 
                      onChange={e => setProductDiscount(e.target.value)} 
                    />
                    <p className="text-xs text-muted-foreground">
                      {productDiscountType === "porcentaje" 
                        ? "Descuento en porcentaje (0-100%)" 
                        : "Descuento en monto fijo"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Subtotal con Descuento</Label>
                    <Input 
                      type="text" 
                      value={selectedProductId && productUnitPrice ? (() => {
                        const subtotal = parseFloat(productUnitPrice) * parseFloat(productQuantity || "1");
                        const discount = parseFloat(productDiscount || "0");
                        const finalAmount = productDiscountType === "porcentaje" 
                          ? Math.max(0, subtotal - (subtotal * discount / 100))
                          : Math.max(0, subtotal - discount);
                        return `$${formatMonto(finalAmount)}`;
                      })() : "$0.00"} 
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
                <strong>Ventas desde Inventario:</strong> Selecciona productos, aplica descuentos opcionales y agrégalos a la venta. 
                Si vendes más de lo disponible, se te pedirá confirmar la sobreventa.
              </AlertDescription>
            </Alert>
            
            {/* Formulario para agregar productos */}
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Agregar Productos del Inventario</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Select de producto */}
                <div className="space-y-2">
                  <Label htmlFor="producto-inventario">Seleccionar Producto</Label>
                  <Select value={selectedInventoryProductId} onValueChange={handleInventoryProductSelection}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingProductosInventario ? "Cargando inventario..." : "Seleccionar producto del inventario"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-80 z-50 bg-background border border-border w-full">
                      {loadingProductosInventario ? 
                        <SelectItem value="loading" disabled>Cargando inventario...</SelectItem> 
                        : productosInventario.length === 0 ? 
                        <SelectItem value="empty" disabled>No hay productos con stock disponible</SelectItem> 
                        : productosInventario.map(producto => 
                          <SelectItem key={producto.id} value={producto.id} className="py-3 px-3 h-auto">
                            <div className="flex items-center space-x-3 w-full">
                              <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                {producto.imagen_url ? 
                                  <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" /> 
                                  : <div className="w-full h-full bg-muted flex items-center justify-center">
                                      <Package className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                }
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
                                    Costo: ${producto.costo_unitario || 0}
                                  </span>
                                  {producto.precio_venta && producto.precio_venta > 0 ? 
                                    <span className="text-xs text-green-600 font-medium">
                                      Venta: ${producto.precio_venta}
                                    </span> 
                                    : <span className="text-xs text-orange-600 font-medium">⚠️ Sin precio</span>
                                  }
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        )
                      }
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Grid: Cantidad + Precio */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cantidad-inv">Cantidad a Vender</Label>
                    <Input 
                      id="cantidad-inv" 
                      type="number" 
                      min="1" 
                      value={inventoryQuantity} 
                      onChange={(e) => setInventoryQuantity(e.target.value)} 
                    />
                    {selectedInventoryProductId && (
                      <p className="text-xs text-muted-foreground">
                        Stock disponible: {availableStock} unidades
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="precio-inv">Precio Unitario</Label>
                    <div className="space-y-2">
                      <RadioGroup 
                        value={usePrecioRegistrado ? "registrado" : "personalizado"} 
                        onValueChange={(value) => {
                          const useRegistrado = value === "registrado";
                          setUsePrecioRegistrado(useRegistrado);
                          if (useRegistrado && selectedInventoryProductId) {
                            const producto = productosInventario.find(p => p.id === selectedInventoryProductId);
                            if (producto) {
                              const precioVenta = producto.precio_venta || producto.costo_unitario || 0;
                              setInventoryProductPrice(precioVenta.toString());
                            }
                          }
                        }}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="registrado" id="precio-registrado" />
                          <Label htmlFor="precio-registrado" className="text-sm cursor-pointer">
                            Precio registrado
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="personalizado" id="precio-personalizado" />
                          <Label htmlFor="precio-personalizado" className="text-sm cursor-pointer">
                            Personalizado
                          </Label>
                        </div>
                      </RadioGroup>
                      
                      <Input 
                        id="precio-inv" 
                        type="number" 
                        step="0.01" 
                        min="0"
                        value={inventoryProductPrice} 
                        onChange={(e) => handleInventoryPriceChange(e.target.value)}
                        readOnly={usePrecioRegistrado}
                        className={usePrecioRegistrado ? "bg-muted" : ""}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Grid: Descuento + Subtotal */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="descuento-inv">Descuento (opcional)</Label>
                    <div className="flex gap-2">
                      <RadioGroup 
                        value={inventoryDiscountType} 
                        onValueChange={(value: "monto" | "porcentaje") => setInventoryDiscountType(value)}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="monto" id="descuento-inv-monto" />
                          <Label htmlFor="descuento-inv-monto" className="cursor-pointer">Monto</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="porcentaje" id="descuento-inv-porcentaje" />
                          <Label htmlFor="descuento-inv-porcentaje" className="cursor-pointer">%</Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <Input 
                      id="descuento-inv" 
                      type="number" 
                      placeholder={inventoryDiscountType === "porcentaje" ? "0" : "0.00"}
                      min="0"
                      max={inventoryDiscountType === "porcentaje" ? "100" : undefined}
                      step={inventoryDiscountType === "porcentaje" ? "1" : "0.01"}
                      value={inventoryProductDiscount} 
                      onChange={(e) => setInventoryProductDiscount(e.target.value)} 
                    />
                    <p className="text-xs text-muted-foreground">
                      {inventoryDiscountType === "porcentaje" 
                        ? "Descuento en porcentaje (0-100%)" 
                        : "Descuento en monto fijo"}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Subtotal con Descuento</Label>
                    <Input 
                      type="text" 
                      value={selectedInventoryProductId && inventoryProductPrice ? (() => {
                        const subtotal = parseFloat(inventoryProductPrice) * parseFloat(inventoryQuantity || "1");
                        const discount = parseFloat(inventoryProductDiscount || "0");
                        const finalAmount = inventoryDiscountType === "porcentaje" 
                          ? Math.max(0, subtotal - (subtotal * discount / 100))
                          : Math.max(0, subtotal - discount);
                        return `$${formatMonto(finalAmount)}`;
                      })() : "$0.00"} 
                      readOnly 
                      className="bg-muted font-medium" 
                    />
                  </div>
                </div>
                
                <Button 
                  type="button"
                  onClick={handleAddInventoryProductToList}
                  disabled={!selectedInventoryProductId || !inventoryProductPrice}
                  className="w-full"
                  variant="secondary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto
                </Button>
              </CardContent>
            </Card>
            
            {/* Lista de productos inventariados agregados */}
            {selectedInventoryProducts.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Productos en la Venta ({selectedInventoryProducts.length})</span>
                    <span className="text-primary">
                      ${formatMonto(selectedInventoryProducts.reduce((sum, p) => sum + p.subtotal, 0))}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedInventoryProducts.map((producto, index) => (
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
                              <span>
                                {producto.cantidad} x ${formatMonto(producto.precioUnitario)} = $
                                {formatMonto(producto.cantidad * producto.precioUnitario)}
                              </span>
                              {producto.descuento > 0 && (
                                <span className="text-orange-600">
                                  Descuento: -${formatMonto(producto.descuento)}
                                </span>
                              )}
                              <span className="text-primary font-medium">
                                Total: ${formatMonto(producto.subtotal)}
                              </span>
                              <span className="text-xs">
                                Stock disponible: {producto.stockDisponible}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveInventoryProductFromList(producto.id)}
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
                Este ingreso se ligará a la cuenta 4102 - Otros Productos.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="descripcion-otros">Descripción del Ingreso Extraordinario</Label>
                {hasFieldError('Descripción') && <div className="flex items-center text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-xs">Requerido</span>
                  </div>}
              </div>
              <Textarea 
                id="descripcion-otros" 
                placeholder="Ej: Venta extraordinaria de equipo usado, donación recibida, etc." 
                value={descripcion} 
                onChange={e => setDescripcion(e.target.value)}
                className={hasFieldError('Descripción') ? 'border-destructive' : ''}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="monto-otros">Monto</Label>
                {hasFieldError('Monto Total') && <div className="flex items-center text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-xs">Requerido</span>
                  </div>}
              </div>
              <Input 
                id="monto-otros" 
                type="number" 
                placeholder="0.00" 
                value={montoTotal} 
                onChange={e => setMontoTotal(e.target.value)}
                className={hasFieldError('Monto Total') ? 'border-destructive' : ''}
              />
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
    setEditProductSubcuenta(producto.subcuenta_id || "");
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
        imagen: editProductImage || undefined,
        subcuentaId: editProductSubcuenta || null
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
              {/* Sección informativa destacada - Costo Promedio Histórico */}
              {negativeStockData?.costoPorUnidad && negativeStockData.costoPorUnidad > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <p className="font-bold text-blue-700 dark:text-blue-300">
                      📊 Costo Promedio Histórico
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Costo promedio calculado:</span>
                      <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                        ${formatMonto(negativeStockData.costoPorUnidad)} por unidad
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Este costo se calculó automáticamente del promedio ponderado de todas tus compras anteriores de este producto.
                      Puedes usar este costo sugerido o ingresar uno personalizado si conoces el costo real de esta venta.
                    </p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="font-medium mb-3 text-blue-700 dark:text-blue-400">Impacto en el inventario:</p>
                
                {negativeStockData?.costoPorUnidad && negativeStockData.costoPorUnidad > 0 ? (
                  <>
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

                    // Agrupar transacciones: filtrar reversiones y asociarlas con sus originales
                    const transaccionesAgrupadas = transaccionesFiltradas.filter(t => {
                      // No mostrar reversiones directamente, se mostrarán agrupadas con su original
                      return !t.descripcion.includes('CANCELACIÓN:');
                    }).map(transaccion => {
                      const esCancelada = (transaccion as any).estado === 'cancelado';
                      let transaccionReversion = null;
                      
                      // Si está cancelada, buscar su transacción de reversión
                      if (esCancelada && (transaccion as any).transaccion_cancelacion_id) {
                        transaccionReversion = transacciones.find(t => 
                          t.id === (transaccion as any).transaccion_cancelacion_id
                        );
                      }
                      
                      return {
                        ...transaccion,
                        esCancelada,
                        transaccionReversion
                      };
                    });

                    return transaccionesAgrupadas.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                        No hay transacciones que coincidan con los filtros
                      </div> : <div className="space-y-4">
                        <div className="text-sm font-medium text-muted-foreground mb-4">
                          Mostrando {transaccionesAgrupadas.length} transacción(es)
                        </div>
                        <div className="space-y-3">
                           {transaccionesAgrupadas.map((item: any) => {
                             const transaccion = item;
                             const esCancelada = item.esCancelada;
                             const esReversion = false; // Ya no mostramos reversiones sueltas
                             
                             return (
                               <div 
                                 key={transaccion.id} 
                                 className={`border rounded-lg p-4 ${
                                   esCancelada ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800' : 
                                   esReversion ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800' :
                                   'hover:bg-muted/50'
                                 }`}
                               >
                           <div className="flex items-start gap-3 mb-2">
                              {/* Imagen del producto si es precargado o inventariado */}
                              {(transaccion.tipo_ingreso === 'precargados' || transaccion.tipo_ingreso === 'inventariados') && (() => {
                          // Buscar producto en la lista combinada (servicios + inventario)
                          const descripcionSinPrefijo = transaccion.descripcion.replace('Venta de ', '').replace('Venta: ', '');
                          const todosProdutos = [...productosServicios, ...productosInventarioData];
                          const producto = todosProdutos.find(p => 
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
                                   <div className="flex items-center gap-2 flex-wrap">
                                     <p className="font-medium">{transaccion.descripcion}</p>
                                     
                                     {/* Badge de estado */}
                                     {esCancelada && (
                                       <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200">
                                         ❌ Cancelada
                                       </span>
                                     )}
                                     {esReversion && (
                                       <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200">
                                         ↩️ Reversión
                                       </span>
                                     )}
                                     
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
                             <div className="text-right ml-4 flex flex-col gap-2 items-end">
                               <p className="font-bold text-primary">${formatMonto(transaccion.monto_total)}</p>
                               {transaccion.monto_descuento > 0 && <p className="text-sm text-red-600">
                                   -${formatMonto(transaccion.monto_descuento)} desc.
                                 </p>}
                               
                               {/* Botón de cancelar (solo si está activa) */}
                               {!esCancelada && !esReversion && (
                                 <Button 
                                   variant="outline" 
                                   size="sm" 
                                   className="mt-2 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                   onClick={() => {
                                     setTransaccionACancelar(transaccion);
                                     setIsCancelDialogOpen(true);
                                   }}
                                 >
                                   ❌ Cancelar
                                 </Button>
                               )}
                             </div>
                             </div>
                            </div>
                            
                            {/* Mostrar motivo de cancelación y transacción de reversión si está cancelada */}
                            {esCancelada && (transaccion as any).motivo_cancelacion && (
                              <div className="mt-3 space-y-2">
                                <div className="p-3 bg-red-100 dark:bg-red-950/40 rounded-md border border-red-300 dark:border-red-800">
                                  <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                                    📋 Motivo de cancelación:
                                  </p>
                                  <p className="text-xs text-red-600 dark:text-red-400">
                                    {(transaccion as any).motivo_cancelacion}
                                  </p>
                                  <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                                    Cancelada el: {new Date((transaccion as any).fecha_cancelacion).toLocaleDateString('es-ES', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                                
                                {/* Mostrar transacción de reversión asociada */}
                                {item.transaccionReversion && (
                                  <div className="p-3 bg-orange-100 dark:bg-orange-950/40 rounded-md border border-orange-300 dark:border-orange-800">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                                        ↩️ Asiento de Reversión Generado
                                      </span>
                                    </div>
                                    <div className="text-xs text-orange-600 dark:text-orange-400 space-y-1">
                                      <p><span className="font-medium">Descripción:</span> {item.transaccionReversion.descripcion}</p>
                                      <p><span className="font-medium">Monto reversado:</span> ${formatMonto(Math.abs(item.transaccionReversion.monto_total))}</p>
                                      <p><span className="font-medium">Fecha:</span> {new Date(item.transaccionReversion.created_at).toLocaleDateString('es-ES', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
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
                         );
                       })}
                      </div>
                    </div>;
                  })()}
               </CardContent>
             </Card>
           </TabsContent>

          {/* TAB 3: ANALÍTICA DE VENTAS - GRÁFICAS Y DESTACADOS */}
          <TabsContent value="analitica" className="mt-6">
            {/* Función para filtrar transacciones según el período y tipo de ingreso */}
            {(() => {
              const getFilteredTransactions = () => {
                const today = new Date();
                const currentMonth = today.getMonth();
                const currentYear = today.getFullYear();

                // Primero filtrar por período y excluir canceladas y reversiones
                let filtered = transacciones.filter(t => 
                  (t as any).estado !== 'cancelado' && 
                  !t.descripcion.includes('CANCELACIÓN:')
                );
                
                if (periodFilter === "diario") {
                  // Usar la fecha seleccionada para análisis diario desde asiento contable
                  const selectedDateStr = fechaAnalisisDiario.toISOString().split('T')[0];
                  filtered = filtered.filter(t => {
                    const asientoFecha = (t as any).asiento_fecha;
                    return asientoFecha === selectedDateStr;
                  });
                } else if (periodFilter === "mensual") {
                  // Usar el mes y año de la fecha seleccionada desde asiento contable
                  const selectedMonth = fechaAnalisisMensual.getMonth();
                  const selectedYear = fechaAnalisisMensual.getFullYear();
                  filtered = filtered.filter(t => {
                    const asientoFecha = (t as any).asiento_fecha;
                    if (!asientoFecha) return false;
                    const tDate = parseDateSafe(asientoFecha);
                    return tDate.getMonth() === selectedMonth && tDate.getFullYear() === selectedYear;
                  });
                } else {
                  // Anual desde asiento contable
                  filtered = filtered.filter(t => {
                    const asientoFecha = (t as any).asiento_fecha;
                    if (!asientoFecha) return false;
                    const tDate = parseDateSafe(asientoFecha);
                    return tDate.getFullYear() === currentYear;
                  });
                }

                // Luego filtrar por tipo de ingreso
                if (tipoIngresoAnalisis === "ventas") {
                  // Solo ventas (cuenta 4001)
                  return filtered.filter(t => t.cuenta_principal_codigo === '4001');
                } else {
                  // Otros ingresos (cuentas 4XXX excepto 4001 y 4003)
                  return filtered.filter(t => 
                    t.cuenta_principal_codigo?.startsWith('4') && 
                    t.cuenta_principal_codigo !== '4001' && 
                    t.cuenta_principal_codigo !== '4003'
                  );
                }
              };

              const filteredTransactions = getFilteredTransactions();

              // Función para procesar datos de métodos de pago (solo para transacciones con pago recibido)
              const getMetodosPagoData = () => {
                // Filtrar solo transacciones que tienen método de pago asignado (contado o parcial)
                const transaccionesConPago = filteredTransactions.filter(t => 
                  t.tipo_pago === "contado" || t.tipo_pago === "parcial"
                );

                if (transaccionesConPago.length === 0) {
                  return [];
                }

                // Agrupar por método de pago
                const metodosPago: { [key: string]: number } = {};
                transaccionesConPago.forEach(t => {
                  const metodo = t.metodo_pago === "efectivo" ? "Efectivo" : "Tarjeta";
                  metodosPago[metodo] = (metodosPago[metodo] || 0) + getMetricValue(t, metricType);
                });

                // Calcular total y porcentajes
                const total = Object.values(metodosPago).reduce((sum, val) => sum + val, 0);
                
                return Object.entries(metodosPago).map(([name, value]) => ({
                  name,
                  value,
                  porcentaje: total > 0 ? ((value / total) * 100).toFixed(1) : "0.0"
                }));
              };

              const datosMetodosPago = getMetodosPagoData();

              // Función para verificar si hay datos disponibles
              const hayDatosDisponibles = () => {
                if (tipoIngresoAnalisis === "ventas") {
                  return filteredTransactions.length > 0 || 
                         datosAnaliticas.ventasBrutas > 0 || 
                         datosAnaliticas.descuentos > 0;
                } else {
                  // Otros ingresos
                  return filteredTransactions.length > 0 || datosAnaliticas.otrosIngresos > 0;
                }
              };

              return (
                <>
                  {/* HIGHLIGHTS - Resumen Completo (sin filtros) */}
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-foreground mb-4">
                      Highlights de Ingresos
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Día */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-primary">Resumen del Día</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                   <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Ventas Brutas:</span>
                    <span className="font-semibold text-foreground">
                      ${formatCifra(totalesDia.ventasBrutas, scaleFormat)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-destructive">Descuentos:</span>
                    <span className="font-semibold text-foreground">
                      ${formatCifra(totalesDia.descuentos, scaleFormat)}
                    </span>
                  </div>
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-chart-2">Ventas Netas:</span>
                    <span className="text-lg font-bold text-foreground">
                      ${formatCifra(totalesDia.ventasNetas, scaleFormat)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-600">Otros Ingresos:</span>
                    <span className="font-semibold text-foreground">
                      ${formatCifra(totalesDia.otrosIngresos, scaleFormat)}
                    </span>
                  </div>
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-primary">Total Ingresos:</span>
                    <span className="text-xl font-bold text-primary">
                      ${formatCifra(totalesDia.totalIngresos, scaleFormat)}
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
                    <span className="font-semibold text-foreground">
                      ${formatCifra(totalesMes.ventasBrutas, scaleFormat)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-destructive">Descuentos:</span>
                    <span className="font-semibold text-foreground">
                      ${formatCifra(totalesMes.descuentos, scaleFormat)}
                    </span>
                  </div>
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-chart-2">Ventas Netas:</span>
                    <span className="text-lg font-bold text-foreground">
                      ${formatCifra(totalesMes.ventasNetas, scaleFormat)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-600">Otros Ingresos:</span>
                    <span className="font-semibold text-foreground">
                      ${formatCifra(totalesMes.otrosIngresos, scaleFormat)}
                    </span>
                  </div>
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-primary">Total Ingresos:</span>
                    <span className="text-xl font-bold text-primary">
                      ${formatCifra(totalesMes.totalIngresos, scaleFormat)}
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
                    <span className="font-semibold text-foreground">
                      ${formatCifra(totalesAno.ventasBrutas, scaleFormat)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-destructive">Descuentos:</span>
                    <span className="font-semibold text-foreground">
                      ${formatCifra(totalesAno.descuentos, scaleFormat)}
                    </span>
                  </div>
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-chart-2">Ventas Netas:</span>
                    <span className="text-lg font-bold text-foreground">
                      ${formatCifra(totalesAno.ventasNetas, scaleFormat)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-600">Otros Ingresos:</span>
                    <span className="font-semibold text-foreground">
                      ${formatCifra(totalesAno.otrosIngresos, scaleFormat)}
                    </span>
                  </div>
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-primary">Total Ingresos:</span>
                    <span className="text-xl font-bold text-primary">
                      ${formatCifra(totalesAno.totalIngresos, scaleFormat)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
                  </div>

            {/* SEPARADOR */}
            <div className="my-8 border-t-2 border-primary/20"></div>

            {/* ANALÍTICA - Sección de análisis detallado */}
            <div>
              <h3 className="text-xl font-bold text-foreground mb-6">
                Analítica de {tipoIngresoAnalisis === "ventas" ? "Ventas" : "Otros Ingresos"}
              </h3>

            {/* Selector de Período, Formato de Cifras, Tipo de Métrica y Tipo de Ingreso */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tipo de Ingreso</CardTitle>
                  <CardDescription>Selecciona qué analizar</CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={tipoIngresoAnalisis} onValueChange={(v) => setTipoIngresoAnalisis(v as "ventas" | "otros")} className="flex flex-col gap-3">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ventas" id="tipo-ventas" />
                      <Label htmlFor="tipo-ventas" className="cursor-pointer">Ventas</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="otros" id="tipo-otros" />
                      <Label htmlFor="tipo-otros" className="cursor-pointer">Otros Ingresos</Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Período de Análisis</CardTitle>
                  <CardDescription>Selecciona el período</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RadioGroup value={periodFilter} onValueChange={(v) => setPeriodFilter(v as "diario" | "mensual" | "anual")} className="flex flex-col gap-3">
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
                  
                  {/* Selector de fecha para análisis diario */}
                  {periodFilter === "diario" && (
                    <div className="pt-2 border-t">
                      <Label className="text-xs text-muted-foreground mb-2 block">Fecha específica</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !fechaAnalisisDiario && "text-muted-foreground"
                            )}
                            size="sm"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(fechaAnalisisDiario, "PPP", { locale: es })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={fechaAnalisisDiario}
                            onSelect={(date) => date && setFechaAnalisisDiario(date)}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                  
                  {/* Selector de mes para análisis mensual */}
                  {periodFilter === "mensual" && (
                    <div className="pt-2 border-t">
                      <Label className="text-xs text-muted-foreground mb-2 block">Mes específico</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !fechaAnalisisMensual && "text-muted-foreground"
                            )}
                            size="sm"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(fechaAnalisisMensual, "MMMM yyyy", { locale: es })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={fechaAnalisisMensual}
                            onSelect={(date) => date && setFechaAnalisisMensual(date)}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Formato de Cifras</CardTitle>
                  <CardDescription>Visualización de montos</CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={scaleFormat} onValueChange={(v) => setScaleFormat(v as "general" | "miles" | "millones")} className="flex flex-col gap-3">
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tipo de Métrica</CardTitle>
                  <CardDescription>Datos a visualizar</CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={metricType} onValueChange={(v) => setMetricType(v as "brutas" | "descuentos" | "netas")} className="flex flex-col gap-3">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="brutas" id="metric-brutas" />
                      <Label htmlFor="metric-brutas" className="cursor-pointer">Ventas Brutas</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="descuentos" id="metric-descuentos" />
                      <Label htmlFor="metric-descuentos" className="cursor-pointer">Descuentos</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="netas" id="metric-netas" />
                      <Label htmlFor="metric-netas" className="cursor-pointer">Ventas Netas</Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de Ventas Totales, Descuentos y Ventas Netas */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>
                  Evolución de {
                    metricType === "descuentos" ? "Descuentos" :
                    tipoIngresoAnalisis === "otros" ? "Otros Ingresos" :
                    metricType === "brutas" ? "Ventas Brutas" : "Ventas Netas"
                  }
                </CardTitle>
                <CardDescription>
                  {
                    metricType === "descuentos" ? "Descuentos aplicados" :
                    tipoIngresoAnalisis === "otros" ? "Otros ingresos" :
                    metricType === "brutas" ? "Ventas brutas" : "Ventas netas"
                  } - {periodFilter === "diario" ? "del día" : periodFilter === "mensual" ? "por día del mes" : "por mes del año"}
                </CardDescription>
              </CardHeader>
               <CardContent>
                {loadingTransacciones ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    Cargando datos...
                  </div>
                ) : datosAnaliticas.detallesPorPeriodo.length === 0 ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    No hay datos para mostrar
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={datosAnaliticas.detallesPorPeriodo.map(d => ({
                        periodo: d.periodo,
                        ventas: d.ventasBrutas,
                        descuentos: d.descuentos,
                        neto: d.ventasNetas,
                        otrosIngresos: d.otrosIngresos
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periodo" tick={{ fill: '#000000' }} />
                        <YAxis tickFormatter={(value) => formatCifra(value, scaleFormat)} tick={{ fill: '#000000' }} />
                        <Tooltip 
                          formatter={(value) => [`$${formatCifra(Number(value), scaleFormat)}`, '']}
                          contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #ccc', borderRadius: '4px', color: '#000000' }}
                          itemStyle={{ color: '#000000', fontWeight: 'bold' }}
                          labelStyle={{ color: '#000000', fontWeight: 'bold' }}
                          wrapperStyle={{ zIndex: 1000 }}
                        />
                        <Legend />
                        {metricType === "descuentos" && (
                          <Line type="monotone" dataKey="descuentos" stroke="hsl(180 60% 70%)" name="Descuentos" strokeWidth={2}>
                            <LabelList dataKey="descuentos" position="top" formatter={(value: number) => `$${formatCifra(value, scaleFormat)}`} style={{ fill: '#000000', fontWeight: 'bold', fontSize: '12px' }} />
                          </Line>
                        )}
                        {metricType === "brutas" && tipoIngresoAnalisis === "ventas" && (
                          <Line type="monotone" dataKey="ventas" stroke="hsl(180 50% 55%)" name="Ventas Brutas" strokeWidth={2}>
                            <LabelList dataKey="ventas" position="top" formatter={(value: number) => `$${formatCifra(value, scaleFormat)}`} style={{ fill: '#000000', fontWeight: 'bold', fontSize: '12px' }} />
                          </Line>
                        )}
                        {metricType === "netas" && tipoIngresoAnalisis === "ventas" && (
                          <Line type="monotone" dataKey="neto" stroke="hsl(180 45% 45%)" name="Ventas Netas" strokeWidth={2}>
                            <LabelList dataKey="neto" position="top" formatter={(value: number) => `$${formatCifra(value, scaleFormat)}`} style={{ fill: '#000000', fontWeight: 'bold', fontSize: '12px' }} />
                          </Line>
                        )}
                        {tipoIngresoAnalisis === "otros" && metricType !== "descuentos" && (
                          <Line type="monotone" dataKey="otrosIngresos" stroke="hsl(140 50% 50%)" name="Otros Ingresos" strokeWidth={2}>
                            <LabelList dataKey="otrosIngresos" position="top" formatter={(value: number) => `$${formatCifra(value, scaleFormat)}`} style={{ fill: '#000000', fontWeight: 'bold', fontSize: '12px' }} />
                          </Line>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Gráfico de Ventas por Tipo */}
              <Card>
                <CardHeader>
                  <CardTitle>{metricType === "brutas" ? "Ventas Brutas" : metricType === "descuentos" ? "Descuentos" : "Ventas Netas"} por Tipo</CardTitle>
                  <CardDescription>Distribución de {metricType === "brutas" ? "ventas brutas" : metricType === "descuentos" ? "descuentos" : "ventas netas"} por categoría</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Cargando gráfico...
                    </div>
                  ) : !hayDatosDisponibles() ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : tipoIngresoAnalisis === "otros" && metricType === "descuentos" ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay descuentos en otros ingresos
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={(() => {
                              // Obtener total real desde asientos contables
                              const totalRealPie = tipoIngresoAnalisis === "ventas"
                                ? (metricType === "brutas" ? datosAnaliticas.ventasBrutas 
                                   : metricType === "descuentos" ? datosAnaliticas.descuentos 
                                   : datosAnaliticas.ventasNetas)
                                : datosAnaliticas.otrosIngresos;
                              
                              // Si no hay transacciones pero hay monto en asientos (otros ingresos)
                              if (filteredTransactions.length === 0 && totalRealPie > 0) {
                                return [{
                                  tipo: "Otros Ingresos",
                                  monto: totalRealPie,
                                  porcentaje: "100.0"
                                }];
                              }
                              
                              // Calcular distribución desde transacciones
                              const distribucionTransacciones = filteredTransactions.reduce((acc, t) => {
                                acc[t.tipo_ingreso] = (acc[t.tipo_ingreso] || 0) + getMetricValue(t, metricType);
                                return acc;
                              }, {} as Record<string, number>);
                              
                              // Ajustar proporcionalmente
                              const distribucionAjustada = ajustarProporcionalmente(distribucionTransacciones, totalRealPie);
                              
                              return Object.entries(distribucionAjustada).map(([tipo, monto]) => ({
                                tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1),
                                monto,
                                porcentaje: totalRealPie > 0 ? ((monto / totalRealPie) * 100).toFixed(1) : '0.0'
                              }));
                            })()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ tipo, porcentaje, monto }) => `${tipo}\n${porcentaje}%\n$${formatCifra(monto, scaleFormat)}`}
                            innerRadius={60}
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
                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #ccc', borderRadius: '4px', color: '#000000' }}
                            itemStyle={{ color: '#000000', fontWeight: 'bold' }}
                            labelStyle={{ color: '#000000', fontWeight: 'bold' }}
                            wrapperStyle={{ zIndex: 1000 }}
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
                  <CardTitle>Estado de Pagos - {metricType === "brutas" ? "Ventas Brutas" : metricType === "descuentos" ? "Descuentos" : "Ventas Netas"}</CardTitle>
                  <CardDescription>Distribución por estado de pago</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Cargando gráfico...
                    </div>
                  ) : !hayDatosDisponibles() ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : tipoIngresoAnalisis === "otros" && metricType === "descuentos" ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay descuentos en otros ingresos
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={(() => {
                              // Obtener total real desde asientos contables
                              const totalRealEstado = tipoIngresoAnalisis === "ventas"
                                ? (metricType === "brutas" ? datosAnaliticas.ventasBrutas 
                                   : metricType === "descuentos" ? datosAnaliticas.descuentos 
                                   : datosAnaliticas.ventasNetas)
                                : datosAnaliticas.otrosIngresos;
                              
                              // Si no hay transacciones pero hay monto en asientos (otros ingresos)
                              if (filteredTransactions.length === 0 && totalRealEstado > 0) {
                                return [{
                                  estado: "Pagado Total",
                                  monto: totalRealEstado,
                                  porcentaje: "100.0"
                                }];
                              }
                              
                              // Calcular distribución por estado desde transacciones
                              const estadoPagos = filteredTransactions.reduce((acc, t: any) => {
                                let estado = "Por Cobrar";
                                if (t.tipo_pago === "contado" || (t.monto_pagado && t.monto_pendiente === 0)) {
                                  estado = "Pagado Total";
                                } else if (t.tipo_pago === "parcial" || (t.monto_pagado > 0 && t.monto_pendiente > 0)) {
                                  estado = "Pago Parcial";
                                }
                                acc[estado] = (acc[estado] || 0) + getMetricValue(t, metricType);
                                return acc;
                              }, {} as Record<string, number>);
                              
                              // Ajustar proporcionalmente
                              const estadoPagosAjustado = ajustarProporcionalmente(estadoPagos, totalRealEstado);
                              
                              return Object.entries(estadoPagosAjustado).map(([estado, monto]) => ({
                                estado,
                                monto,
                                porcentaje: totalRealEstado > 0 ? ((monto / totalRealEstado) * 100).toFixed(1) : '0.0'
                              }));
                            })()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ estado, porcentaje, monto }) => `${estado}\n${porcentaje}%\n$${formatCifra(monto, scaleFormat)}`}
                            innerRadius={60}
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
                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #ccc', borderRadius: '4px', color: '#000000' }}
                            itemStyle={{ color: '#000000', fontWeight: 'bold' }}
                            labelStyle={{ color: '#000000', fontWeight: 'bold' }}
                            wrapperStyle={{ zIndex: 1000 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico por Subcuenta Contable */}
              <Card>
                <CardHeader>
                  <CardTitle>{metricType === "brutas" ? "Ventas Brutas" : metricType === "descuentos" ? "Descuentos" : "Ventas Netas"} por Subcuenta</CardTitle>
                  <CardDescription>Distribución por subcuentas contables</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Cargando gráfico...
                    </div>
                  ) : !hayDatosDisponibles() ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : tipoIngresoAnalisis === "otros" && metricType === "descuentos" ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay descuentos en otros ingresos
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(() => {
                          const totalRealBarSub = tipoIngresoAnalisis === "ventas"
                            ? (metricType === "brutas" ? datosAnaliticas.ventasBrutas 
                               : metricType === "descuentos" ? datosAnaliticas.descuentos 
                               : datosAnaliticas.ventasNetas)
                            : datosAnaliticas.otrosIngresos;
                          
                          if (filteredTransactions.length === 0 && totalRealBarSub > 0) {
                            return [{subcuenta: "Sin detalle", monto: totalRealBarSub}];
                          }
                          
                          const subcuentaData = filteredTransactions.reduce((acc, t) => {
                            const subcuentaNombre = t.subcuenta_id 
                              ? (subcuentas.find(s => s.id === t.subcuenta_id)?.nombre || "Subcuenta desconocida")
                              : "Sin subcuenta asignada";
                            acc[subcuentaNombre] = (acc[subcuentaNombre] || 0) + getMetricValue(t, metricType);
                            return acc;
                          }, {} as Record<string, number>);
                          
                          const subcuentaDataAjustada = ajustarProporcionalmente(subcuentaData, totalRealBarSub);
                          
                          return Object.entries(subcuentaDataAjustada).map(([subcuenta, monto]) => ({
                            subcuenta,
                            monto
                          }));
                        })()} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(value) => formatCifra(value, scaleFormat)} tick={{ fill: '#000000' }} />
                          <YAxis type="category" dataKey="subcuenta" width={150} tick={{ fill: '#000000' }} />
                          <Tooltip 
                            formatter={(value) => [`$${formatCifra(Number(value), scaleFormat)}`, 'Monto']}
                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #ccc', borderRadius: '4px', color: '#000000' }}
                            itemStyle={{ color: '#000000', fontWeight: 'bold' }}
                            labelStyle={{ color: '#000000', fontWeight: 'bold' }}
                            wrapperStyle={{ zIndex: 1000 }}
                          />
                          <Bar dataKey="monto" fill="hsl(180 50% 55%)">
                            <LabelList dataKey="monto" position="right" formatter={(value: number) => `$${formatCifra(value, scaleFormat)}`} style={{ fill: '#000000', fontWeight: 'bold', fontSize: '12px' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* TreeMap de Métodos de Pago */}
              <Card>
                <CardHeader>
                  <CardTitle>Métodos de Pago Recibidos</CardTitle>
                  <CardDescription>
                    Distribución de {metricType === "brutas" ? "ventas brutas" : metricType === "descuentos" ? "descuentos" : "ventas netas"} por método de pago
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Cargando gráfico...
                    </div>
                  ) : !hayDatosDisponibles() ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : tipoIngresoAnalisis === "otros" && metricType === "descuentos" ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay descuentos en otros ingresos
                    </div>
                  ) : datosMetodosPago.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay transacciones con método de pago en este período
                      <br />
                      <span className="text-xs mt-2 block">Las ventas a crédito no tienen método de pago asignado</span>
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                          data={datosMetodosPago}
                          dataKey="value"
                          aspectRatio={4/3}
                          stroke="#fff"
                          fill="#8884d8"
                          content={<CustomTreemapContent />}
                        >
                          <Tooltip content={<CustomTreemapTooltip scaleFormat={scaleFormat} />} />
                        </Treemap>
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
                  <CardTitle>{metricType === "brutas" ? "Ventas Brutas" : metricType === "descuentos" ? "Descuentos" : "Ventas Netas"} por Producto</CardTitle>
                  <CardDescription>Ranking de productos {metricType === "descuentos" ? "con más descuentos" : "más vendidos"}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Cargando datos...
                    </div>
                  ) : !hayDatosDisponibles() ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : (
                     <div className="space-y-3">
                      {(() => {
                        // Si estamos en "Otros Ingresos" y seleccionamos "Descuentos", no hay nada que mostrar
                        if (tipoIngresoAnalisis === "otros" && metricType === "descuentos") {
                          return (
                            <div className="text-center py-8 text-muted-foreground">
                              No hay descuentos en otros ingresos
                            </div>
                          );
                        }
                        
                        // Obtener total real desde asientos contables
                        const totalRealProductos = tipoIngresoAnalisis === "ventas"
                          ? (metricType === "brutas" ? datosAnaliticas.ventasBrutas 
                             : metricType === "descuentos" ? datosAnaliticas.descuentos 
                             : datosAnaliticas.ventasNetas)
                          : datosAnaliticas.otrosIngresos;
                        
                        // Si no hay transacciones pero hay monto en asientos (otros ingresos)
                        if (filteredTransactions.length === 0 && totalRealProductos > 0) {
                          return (
                            <>
                              <div className="flex items-center gap-3 p-3 border rounded-lg">
                                <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Package className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium">Sin detalle de producto</p>
                                  <p className="text-sm text-muted-foreground">Otros Ingresos</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="font-bold text-foreground">
                                    ${formatCifra(totalRealProductos, scaleFormat)}
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  <div className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-semibold">
                                    100%
                                  </div>
                                </div>
                              </div>
                              {/* Fila de Total */}
                              <div className="flex items-center gap-3 p-3 border-2 border-primary rounded-lg bg-primary/5">
                                <div className="w-12 h-12 rounded-md bg-primary/20 flex items-center justify-center flex-shrink-0">
                                  <Package className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-foreground">TOTAL GENERAL</p>
                                  <p className="text-sm text-muted-foreground">1 registro</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="font-bold text-lg text-primary">
                                    ${formatCifra(totalRealProductos, scaleFormat)}
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  <div className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm font-bold">
                                    100%
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        }
                        
                        // Calcular distribución por producto desde movimientos de inventario
                        const productosVentas = movimientosInventario.reduce((acc, mov) => {
                          const productoNombre = mov.productos?.nombre || "Producto sin nombre";
                          const precioVenta = mov.productos?.precio_venta || 0;
                          const cantidad = Math.abs(mov.cantidad); // Las ventas son negativas
                          const montoVenta = cantidad * precioVenta;
                          
                          if (!acc[productoNombre]) {
                            acc[productoNombre] = {
                              nombre: productoNombre,
                              transacciones: 0,
                              monto: 0,
                              imagen: mov.productos?.imagen_url,
                              tieneAsignacion: true
                            };
                          }
                          
                          acc[productoNombre].transacciones += 1;
                          acc[productoNombre].monto += montoVenta;
                          
                          return acc;
                        }, {} as Record<string, { nombre: string; transacciones: number; monto: number; imagen?: string; tieneAsignacion: boolean }>);

                        // Agregar también productos precargados (servicios) desde transacciones
                        filteredTransactions.forEach(t => {
                          // Solo procesar si es tipo precargados
                          if (t.tipo_ingreso === 'precargados') {
                            // Parsear la descripción para extraer todos los productos
                            let productosPorProcesar: Array<{ nombre: string; cantidad: number }> = [];
                            
                            // Patrón 1: "Venta: Producto A (x2), Producto B (x1), Producto C (x3)"
                            if (t.descripcion.startsWith('Venta: ')) {
                              const productosSplit = t.descripcion.replace('Venta: ', '').split(', ');
                              productosPorProcesar = productosSplit.map(productoStr => {
                                const match = productoStr.match(/^(.+?) \(x(\d+)\)$/);
                                if (match) {
                                  return {
                                    nombre: match[1].trim(),
                                    cantidad: parseInt(match[2])
                                  };
                                }
                                return {
                                  nombre: productoStr.trim(),
                                  cantidad: 1
                                };
                              });
                            }
                            // Patrón 2: "Venta de Producto A" (venta única)
                            else if (t.descripcion.startsWith('Venta de ')) {
                              const nombreProducto = t.descripcion.replace('Venta de ', '').trim();
                              productosPorProcesar = [{
                                nombre: nombreProducto,
                                cantidad: 1
                              }];
                            }
                            // Patrón 3: Cualquier otro formato
                            else {
                              productosPorProcesar = [{
                                nombre: t.descripcion,
                                cantidad: 1
                              }];
                            }
                            
                            // Calcular el monto total de esta transacción según la métrica
                            const montoTransaccion = getMetricValue(t, metricType);
                            
                            // Calcular el precio base de cada producto en esta transacción
                            const preciosProductos: Array<{ nombre: string; cantidad: number; precioBase: number }> = [];
                            let sumaPreciosCatalogo = 0;
                            
                            productosPorProcesar.forEach(({ nombre, cantidad }) => {
                              const productoEnCatalogo = productosServicios.find(p => 
                                p.nombre.toLowerCase() === nombre.toLowerCase()
                              );
                              
                              const precioBase = productoEnCatalogo?.precio || 0;
                              preciosProductos.push({
                                nombre: nombre,
                                cantidad: cantidad,
                                precioBase: precioBase
                              });
                              
                              sumaPreciosCatalogo += precioBase * cantidad;
                            });
                            
                            // Distribuir el monto de la transacción proporcionalmente entre los productos
                            preciosProductos.forEach(({ nombre, cantidad, precioBase }) => {
                              const productoEnCatalogo = productosServicios.find(p => 
                                p.nombre.toLowerCase() === nombre.toLowerCase()
                              );
                              
                              // Calcular proporción de este producto
                              const subtotalProductoCatalogo = precioBase * cantidad;
                              const proporcion = sumaPreciosCatalogo > 0 
                                ? subtotalProductoCatalogo / sumaPreciosCatalogo 
                                : 1 / preciosProductos.length; // Si no hay precios en catálogo, dividir equitativamente
                              
                              const montoProducto = montoTransaccion * proporcion;
                              
                              if (!productosVentas[nombre]) {
                                productosVentas[nombre] = {
                                  nombre: nombre,
                                  transacciones: 0,
                                  monto: 0,
                                  imagen: productoEnCatalogo?.imagen_url,
                                  tieneAsignacion: !!productoEnCatalogo
                                };
                              }
                              
                              productosVentas[nombre].transacciones += 1; // Contar cada producto como transacción
                              productosVentas[nombre].monto += montoProducto;
                            });
                          }
                        });

                        // Obtener total real desde asientos contables  
                        const totalRealProd = tipoIngresoAnalisis === "ventas"
                          ? (metricType === "brutas" ? datosAnaliticas.ventasBrutas 
                             : metricType === "descuentos" ? datosAnaliticas.descuentos 
                             : datosAnaliticas.ventasNetas)
                          : datosAnaliticas.otrosIngresos;
                        
                        // Ajustar proporcionalmente cada producto
                        const distribucionProductos: Record<string, number> = {};
                        Object.entries(productosVentas).forEach(([key, data]: [string, { nombre: string; transacciones: number; monto: number; imagen?: string; tieneAsignacion: boolean }]) => {
                          distribucionProductos[key] = data.monto;
                        });
                        const distribucionAjustada = ajustarProporcionalmente(distribucionProductos, totalRealProd);
                        
                        // Actualizar montos ajustados
                        Object.keys(productosVentas).forEach(key => {
                          productosVentas[key].monto = distribucionAjustada[key] || 0;
                        });
                        
                        const productosArray = Object.values(productosVentas).sort((a: any, b: any) => b.monto - a.monto) as Array<{ nombre: string; transacciones: number; monto: number; imagen?: string; tieneAsignacion: boolean }>;
                        const totalGeneral = totalRealProd; // Usar el total real de asientos contables
                        const top10 = productosArray.slice(0, 10);
                        
                        return (
                          <>
                            {top10.map((producto) => {
                              const porcentaje = totalGeneral > 0 ? ((producto.monto / totalGeneral) * 100).toFixed(1) : '0.0';
                              return (
                                <div key={producto.nombre} className={`flex items-center gap-3 p-3 border rounded-lg ${!producto.tieneAsignacion ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                                  {producto.imagen ? (
                                    <img 
                                      src={producto.imagen} 
                                      alt={producto.nombre} 
                                      className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                                    />
                                  ) : (
                                    <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${!producto.tieneAsignacion ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'}`}>
                                      <Package className={`w-5 h-5 ${!producto.tieneAsignacion ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium truncate">{producto.nombre}</p>
                                      {!producto.tieneAsignacion && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 flex-shrink-0">
                                          Sin asignar
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {producto.transacciones} {producto.transacciones === 1 ? 'transacción' : 'transacciones'}
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="font-bold text-foreground">
                                      ${formatCifra(producto.monto, scaleFormat)}
                                    </p>
                                  </div>
                                  <div className="flex-shrink-0">
                                    <div className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-semibold">
                                      {porcentaje}%
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {/* Fila de Total - solo mostrar si hay monto */}
                            {(() => {
                              const totalGeneralMonto = productosArray.reduce((sum, p) => sum + p.monto, 0);
                              if (totalGeneralMonto > 0) {
                                return (
                                  <div className="flex items-center gap-3 p-3 border-2 border-primary rounded-lg bg-primary/5">
                                    <div className="w-12 h-12 rounded-md bg-primary/20 flex items-center justify-center flex-shrink-0">
                                      <Package className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-foreground">TOTAL GENERAL</p>
                                      <p className="text-sm text-muted-foreground">
                                        {productosArray.reduce((sum, p) => sum + p.transacciones, 0)} transacciones
                                      </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="font-bold text-lg text-primary">
                                        ${formatCifra(totalGeneral, scaleFormat)}
                                      </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                      <div className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm font-bold">
                                        100%
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tabla de Ventas por Cliente */}
              <Card>
                <CardHeader>
                  <CardTitle>{metricType === "brutas" ? "Ventas Brutas" : metricType === "descuentos" ? "Descuentos" : "Ventas Netas"} por Cliente</CardTitle>
                  <CardDescription>Ranking de {metricType === "descuentos" ? "clientes con más descuentos" : "mejores clientes"}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Cargando datos...
                    </div>
                  ) : !hayDatosDisponibles() ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        // Si estamos en "Otros Ingresos" y seleccionamos "Descuentos", no hay nada que mostrar
                        if (tipoIngresoAnalisis === "otros" && metricType === "descuentos") {
                          return (
                            <div className="text-center py-8 text-muted-foreground">
                              No hay descuentos en otros ingresos
                            </div>
                          );
                        }
                        
                        // Obtener total real desde asientos contables
                        const totalRealClientes = tipoIngresoAnalisis === "ventas"
                          ? (metricType === "brutas" ? datosAnaliticas.ventasBrutas 
                             : metricType === "descuentos" ? datosAnaliticas.descuentos 
                             : datosAnaliticas.ventasNetas)
                          : datosAnaliticas.otrosIngresos;
                        
                        // Si no hay transacciones pero hay monto en asientos (otros ingresos)
                        if (filteredTransactions.length === 0 && totalRealClientes > 0) {
                          return (
                            <>
                              <div className="flex items-center gap-3 p-3 border rounded-lg">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Users className="w-6 h-6 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium">Sin cliente asignado</p>
                                  <p className="text-sm text-muted-foreground">Otros Ingresos</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="font-bold text-foreground">
                                    ${formatCifra(totalRealClientes, scaleFormat)}
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  <div className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-semibold">
                                    100%
                                  </div>
                                </div>
                              </div>
                              {/* Fila de Total */}
                              <div className="flex items-center gap-3 p-3 border-2 border-primary rounded-lg bg-primary/5">
                                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                  <Users className="w-6 h-6 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-foreground">TOTAL GENERAL</p>
                                  <p className="text-sm text-muted-foreground">1 registro</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="font-bold text-lg text-primary">
                                    ${formatCifra(totalRealClientes, scaleFormat)}
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  <div className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm font-bold">
                                    100%
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        }
                        
                        // Calcular distribución por cliente desde transacciones
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
                          acc[clienteNombre].monto += getMetricValue(t, metricType);
                          return acc;
                        }, {} as Record<string, { nombre: string; transacciones: number; monto: number; email?: string; telefono?: string }>);
                        
                        // Obtener total real desde asientos contables
                        const totalRealCli = tipoIngresoAnalisis === "ventas"
                          ? (metricType === "brutas" ? datosAnaliticas.ventasBrutas 
                             : metricType === "descuentos" ? datosAnaliticas.descuentos 
                             : datosAnaliticas.ventasNetas)
                          : datosAnaliticas.otrosIngresos;
                        
                        // Ajustar proporcionalmente cada cliente
                        const distribucionClientes: Record<string, number> = {};
                        Object.entries(clientesVentas).forEach(([key, data]) => {
                          distribucionClientes[key] = data.monto;
                        });
                        const distribucionAjustada = ajustarProporcionalmente(distribucionClientes, totalRealCli);
                        
                        // Actualizar montos ajustados
                        Object.keys(clientesVentas).forEach(key => {
                          clientesVentas[key].monto = distribucionAjustada[key] || 0;
                        });
                        
                        const clientesArray = Object.values(clientesVentas).sort((a, b) => b.monto - a.monto);
                        const totalGeneral = totalRealCli; // Usar el total real de asientos contables
                        const top10 = clientesArray.slice(0, 10);
                        
                        return (
                          <>
                            {top10.map((cliente) => {
                              const porcentaje = totalGeneral > 0 ? ((cliente.monto / totalGeneral) * 100).toFixed(1) : '0.0';
                              return (
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
                                  <div className="text-right flex-shrink-0">
                                    <p className="font-bold text-foreground">
                                      ${formatCifra(cliente.monto, scaleFormat)}
                                    </p>
                                  </div>
                                  <div className="flex-shrink-0">
                                    <div className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-semibold">
                                      {porcentaje}%
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {/* Fila de Total - solo mostrar si hay monto */}
                            {(() => {
                              const totalGeneralMonto = clientesArray.reduce((sum, c) => sum + c.monto, 0);
                              if (totalGeneralMonto > 0) {
                                return (
                                  <div className="flex items-center gap-3 p-3 border-2 border-primary rounded-lg bg-primary/5">
                                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                      <Users className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-foreground">TOTAL GENERAL</p>
                                      <p className="text-sm text-muted-foreground">
                                        {clientesArray.reduce((sum, c) => sum + c.transacciones, 0)} transacciones
                                      </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="font-bold text-lg text-primary">
                                        ${formatCifra(totalGeneral, scaleFormat)}
                                      </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                      <div className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm font-bold">
                                        100%
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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
                        {/* Selector de Subcuenta */}
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="edit-product-subcuenta" className="text-right">
                            Subcuenta
                          </Label>
                          <Select 
                            value={editProductSubcuenta || "none"} 
                            onValueChange={v => setEditProductSubcuenta(v === "none" ? "" : v)}
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Sin subcuenta (usar cuenta principal)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin subcuenta (usar cuenta principal)</SelectItem>
                              {subcuentas
                                .filter(subcuenta => subcuenta.cuenta_madre_codigo === "4001")
                                .map(subcuenta => (
                                  <SelectItem key={subcuenta.id} value={subcuenta.id}>
                                    {subcuenta.nombre}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
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
        
        {/* Diálogo de confirmación de cancelación */}
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>❌ Cancelar Transacción</DialogTitle>
              <DialogDescription>
                Esta acción creará un asiento contable de reversión. La transacción original quedará marcada como cancelada pero mantendrá toda su trazabilidad.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {transaccionACancelar && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium mb-2">Transacción a cancelar:</p>
                  <p className="text-sm"><span className="font-medium">Descripción:</span> {transaccionACancelar.descripcion}</p>
                  <p className="text-sm"><span className="font-medium">Monto:</span> ${formatMonto(transaccionACancelar.monto_total)}</p>
                  <p className="text-sm"><span className="font-medium">Fecha:</span> {new Date(transaccionACancelar.created_at).toLocaleDateString('es-ES')}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="motivo-cancelacion">Motivo de la Cancelación *</Label>
                <Textarea 
                  id="motivo-cancelacion"
                  placeholder="Ej: Error en registro, cliente canceló pedido, etc."
                  value={motivoCancelacion}
                  onChange={(e) => setMotivoCancelacion(e.target.value)}
                  rows={3}
                />
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>¿Qué sucederá?</strong>
                  <ul className="list-disc ml-4 mt-1 space-y-1">
                    <li>Se creará un asiento de reversión automáticamente</li>
                    <li>La transacción original se marcará como "cancelada"</li>
                    <li>Si es venta de inventario, el stock se restaurará</li>
                    <li>Ambas transacciones quedarán visibles para auditoría</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsCancelDialogOpen(false);
                  setMotivoCancelacion("");
                  setTransaccionACancelar(null);
                }}
                disabled={isCanceling}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={handleCancelarTransaccion}
                disabled={isCanceling || !motivoCancelacion.trim()}
              >
                {isCanceling ? "Cancelando..." : "Confirmar Cancelación"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>;
};
export default RegistroIngresos;