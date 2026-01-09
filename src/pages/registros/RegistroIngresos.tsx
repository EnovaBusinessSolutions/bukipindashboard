import React, { useMemo, useState, useEffect } from "react";
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
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList, Treemap } from "recharts";
import { useVentasResumen } from "@/hooks/useVentasResumen";
import { useTransaccionesRecientes } from "@/hooks/useTransaccionesRecientes";
import { useSubcuentas } from "@/hooks/useSubcuentas";
import { useCuentas } from "@/hooks/useCuentas";
import { useProductos, useProductosServicios, useCreateProducto, useUpdateProducto, useDeleteProducto } from "@/hooks/useProductos";
import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";
import { useClientes, useCreateCliente } from "@/hooks/useClientes";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";



async function apiJson<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.error || (json as any)?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return ((json as any)?.data ?? json) as T;
}


async function invokeServer(fnName: string, args: { body?: any } = {}): Promise<{ data: any; error: any }> {
  const body = args?.body ?? {};
  try {
    if (fnName === "registrar-ingreso") {
      const data = await apiJson("/api/ingresos", { method: "POST", body: JSON.stringify(body) });
      return { data, error: null };
    }
    if (fnName === "cancelar-ingreso") {
      const transaccionId = body?.transaccionId;
      const data = await apiJson(`/api/ingresos/${encodeURIComponent(transaccionId)}/cancelar`, {
        method: "POST",
        body: JSON.stringify({ motivoCancelacion: body?.motivoCancelacion }),
      });
      return { data, error: null };
    }
    // fallback genérico por si agregas otros nombres
    const data = await apiJson(`/api/functions/${encodeURIComponent(fnName)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { data, error: null };
  } catch (e: any) {
    return { data: null, error: { message: e?.message || String(e) } };
  }
}


// Función helper para formatear montos con separador de comas
// Helpers numéricos seguros (evitan toLocaleString sobre undefined/null/string basura)
const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

// Función helper para formatear montos con separador de comas (SEGURA)
const formatMonto = (value: unknown): string => {
  const numValue = toNum(value);
  return numValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getClientId = (c: any) => String(c?.id ?? c?._id ?? "");
const getClientNombre = (c: any) => c?.nombre ?? c?.name ?? "Sin nombre";
const getClientTelefono = (c: any) => c?.telefono ?? c?.phone ?? "";

// Función para formatear cifras según la escala seleccionada (SEGURA)
const formatCifra = (value: unknown, scale: "general" | "miles" | "millones"): string => {
  const base = toNum(value);
  let scaledValue = base;
  let suffix = "";

  if (scale === "miles") {
    scaledValue = base / 1000;
    suffix = " K";
  } else if (scale === "millones") {
    scaledValue = base / 1_000_000;
    suffix = " M";
  }

  return (
    scaledValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + suffix
  );
};

// ✅ Normaliza transacciones: soporta camelCase y snake_case + arregla fechas/números
const normalizeTx = (tx: any) => {
  if (!tx) return tx;

  // id
  const id = tx.id ?? tx._id;

  // fecha: puede venir como fecha (ISO) o created_at (YYYY-MM-DD)
  const rawDate = tx.fecha ?? tx.createdAt ?? tx.created_at ?? tx.updatedAt ?? tx.updated_at;
  const rawDateStr = rawDate ? String(rawDate) : undefined;

  // Para tu parseDateSafe (YYYY-MM-DD), si viene ISO lo recortamos a 10 chars
  const created_at = rawDateStr ? rawDateStr.slice(0, 10) : tx.created_at;

  // números (muchos vienen camelCase en tu backend actual)
  const monto_total = toNum(tx.monto_total ?? tx.montoTotal ?? tx.total ?? tx.monto_total);
  const monto_descuento = toNum(tx.monto_descuento ?? tx.montoDescuento ?? tx.descuento);
  const monto_neto = toNum(
    tx.monto_neto ?? tx.montoNeto ?? tx.neto ?? (monto_total - monto_descuento)
  );
  const monto_pagado = toNum(tx.monto_pagado ?? tx.montoPagado ?? tx.pagado ?? monto_neto);
  const saldo_pendiente = toNum(
    tx.saldo_pendiente ?? tx.saldoPendiente ?? tx.pendiente ?? Math.max(0, monto_neto - monto_pagado)
  );

  const tipo_ingreso = tx.tipo_ingreso ?? tx.tipoIngreso ?? tx.tipo;
  const metodo_pago = tx.metodo_pago ?? tx.metodoPago;
  const tipo_pago = tx.tipo_pago ?? tx.tipoPago;

  return {
    ...tx,

    // ids
    id,
    _id: tx._id ?? id,

    // fechas (dejamos ambas)
    created_at: tx.created_at ?? created_at,
    fecha: tx.fecha ?? rawDateStr,

    // tipos (dejamos ambas)
    tipo_ingreso,
    tipoIngreso: tx.tipoIngreso ?? tipo_ingreso,
    metodo_pago,
    metodoPago: tx.metodoPago ?? metodo_pago,
    tipo_pago,
    tipoPago: tx.tipoPago ?? tipo_pago,

    // montos (dejamos ambas)
    monto_total,
    montoTotal: tx.montoTotal ?? monto_total,
    total: tx.total ?? monto_total,

    monto_descuento,
    montoDescuento: tx.montoDescuento ?? monto_descuento,

    monto_neto,
    montoNeto: tx.montoNeto ?? monto_neto,
    neto: tx.neto ?? monto_neto,

    monto_pagado,
    montoPagado: tx.montoPagado ?? monto_pagado,
    pagado: tx.pagado ?? monto_pagado,

    saldo_pendiente,
    saldoPendiente: tx.saldoPendiente ?? saldo_pendiente,
    pendiente: tx.pendiente ?? saldo_pendiente,
  };
};

// Función helper para obtener el valor de métrica según el tipo seleccionado
const getMetricValue = (transaction: any, metricType: "brutas" | "descuentos" | "netas"): number => {
  const t = normalizeTx(transaction);
  if (metricType === "brutas") return t.monto_total || 0;
  if (metricType === "descuentos") return t.monto_descuento || 0;
  if (metricType === "netas") return t.monto_neto || t.monto_total || 0;
  return 0;
};


// Función para parsear fechas DATE correctamente (evita problemas de zona horaria UTC)
const parseDateSafe = (dateString: string): Date => {
  // ✅ si viene ISO, nos quedamos con YYYY-MM-DD
  const clean = (dateString ?? "").toString().slice(0, 10);
  const [year, month, day] = clean.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
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
  } = useTransaccionesRecientes(1000);
    // ✅ Normalizar transacciones (camelCase ↔ snake_case, id, created_at, montos)
  const transaccionesNorm = (transacciones ?? []).map(normalizeTx);
  const {
    data: subcuentas = []
  } = useSubcuentas();
  const {
    data: cuentasData
  } = useCuentas();
  const cuentas = cuentasData?.cuentasFlat || [];
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
  
  const PAGE_SIZE = 25;
const [pageResumen, setPageResumen] = useState(1);

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

// ✅ Labels de highlights (solo 1 declaración)
type HighlightLabels = { dia?: string; mes?: string; ano?: string };
const [highlightLabels, setHighlightLabels] = useState<HighlightLabels>({});

// ✅ Totales highlights
type TotalesHighlights = {
  ventasBrutas: number;
  descuentos: number;
  ventasNetas: number;
  otrosIngresos: number;
  totalIngresos: number;
};

const EMPTY_HIGHLIGHTS: TotalesHighlights = {
  ventasBrutas: 0,
  descuentos: 0,
  ventasNetas: 0,
  otrosIngresos: 0,
  totalIngresos: 0,
};

const [highTotalesDia, setHighTotalesDia] = useState<TotalesHighlights>(EMPTY_HIGHLIGHTS);
const [highTotalesMes, setHighTotalesMes] = useState<TotalesHighlights>(EMPTY_HIGHLIGHTS);
const [highTotalesAno, setHighTotalesAno] = useState<TotalesHighlights>(EMPTY_HIGHLIGHTS);

 

 useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      const json = await apiJson<any>("/api/ingresos/highlights");
const payload = (json?.data ?? json) as any;

if (cancelled) return;

setHighlightLabels(payload?.labels ?? {});
setHighTotalesDia(payload?.dia ?? EMPTY_HIGHLIGHTS);
setHighTotalesMes(payload?.mes ?? EMPTY_HIGHLIGHTS);
setHighTotalesAno(payload?.ano ?? EMPTY_HIGHLIGHTS);

    } catch (err) {
      console.error("Error cargando highlights:", err);
      if (cancelled) return;

setHighlightLabels({});
setHighTotalesDia(EMPTY_HIGHLIGHTS);
setHighTotalesMes(EMPTY_HIGHLIGHTS);
setHighTotalesAno(EMPTY_HIGHLIGHTS);

    }
  })();

  return () => {
    cancelled = true;
  };
}, []);


 
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

  // Estado para asientos de ingresos directos (sin transacción asociada)
  const [asientosIngresosDirectos, setAsientosIngresosDirectos] = useState<any[]>([]);

  // Estados para filtros del resumen
  const [filtroFechaInicio, setFiltroFechaInicio] = useState("");
  const [filtroFechaFin, setFiltroFechaFin] = useState("");
  const [filtroRangoFechas, setFiltroRangoFechas] = useState<DateRange | undefined>(undefined);

// ✅ formatea fecha en LOCAL a YYYY-MM-DD (sin UTC/toISOString)
function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateOnlyToLocalStart(s: string) {
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function dateOnlyToLocalEnd(s: string) {
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

// ✅ esto reemplaza el new Date(...) directo en TODOS tus filtros
const matchRangoFechas = (createdAt: any) => {
  const dt = parseDateSafe(createdAt);
  const start = filtroFechaInicio ? dateOnlyToLocalStart(filtroFechaInicio) : null;
  const end = filtroFechaFin ? dateOnlyToLocalEnd(filtroFechaFin) : null;

  if (start && dt < start) return false;
  if (end && dt > end) return false;
  return true;
};

const handleRangoChange = (range?: DateRange) => {
  setFiltroRangoFechas(range);

  const from = range?.from;
  const to = range?.to;

  setFiltroFechaInicio(from ? ymdLocal(from) : "");
  setFiltroFechaFin(to ? ymdLocal(to) : "");
};
  const [filtroTipoIngreso, setFiltroTipoIngreso] = useState("todos");
  const [filtroCuenta, setFiltroCuenta] = useState("todas");
  const [filtroSubcuenta, setFiltroSubcuenta] = useState("");
  const [vistaGraficaBarras, setVistaGraficaBarras] = useState<"subcuenta" | "cuenta">("subcuenta");
  
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

  const CUENTA_VENTAS = "4001";
const [subcuentaGeneral, setSubcuentaGeneral] = useState<string>("");

// Subcuentas hijas de 4001 (toma code/codigo si existe; si no, muestra todas)
const subcuentasVentas = useMemo(() => {
  const list: any[] = Array.isArray(subcuentas) ? subcuentas : [];

  return list.filter((s: any) => {
    const code = String(
      s.codigo ?? s.code ?? s.cuenta_codigo ?? s.cuentaCodigo ?? ""
    ).trim();

    const parent = String(
      s.parentCodigo ?? s.parent_code ?? s.parent ?? s.padre ?? ""
    ).trim();

    if (parent) return parent === CUENTA_VENTAS;
    if (code) return code.startsWith(`${CUENTA_VENTAS}-`);
    return false;
  });
}, [subcuentas]);


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

  useEffect(() => {
  setPageResumen(1);
}, [filtroRangoFechas, filtroTipoIngreso, filtroCuenta, filtroSubcuenta]);


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

  // useEffect para cargar asientos de ingresos directos (sin transacción asociada)
  useEffect(() => {
    const cargarAsientosDirectos = async () => {

      try {
        // Obtener asientos contables que NO tienen transaccion_ingreso_id
        const resp = await apiJson<any>("/api/ingresos/asientos-directos");
        const asientos = resp?.asientos ?? resp?.data?.asientos ?? resp ?? [];
        const asientosError: any = null;

        if (asientosError) throw asientosError;
        if (!asientos) return;

        // Filtrar solo los que tienen cuentas de ingresos (4XXX excepto 4003) con HABER
        const asientosIngresos = (asientos || []).filter((asiento: any) => {
  const dets = Array.isArray(asiento?.detalle_asientos) ? asiento.detalle_asientos : [];
  return dets.some((d: any) =>
    String(d?.cuenta_codigo || "").startsWith("4") &&
    String(d?.cuenta_codigo || "") !== "4003" &&
    Number(d?.haber) > 0
  );
});

        setAsientosIngresosDirectos(asientosIngresos);     
      } catch (error) {
        console.error('Error al cargar asientos directos:', error);
      }
    };

    cargarAsientosDirectos();
  }, []);

  // ✅ Helper: YYYY-MM-DD en horario LOCAL (evita bug UTC)
const toYMDLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};


 // useEffect para calcular analíticas desde asientos contables
useEffect(() => {
  const calcularAnaliticasDesdeAsientos = async () => {
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
        fechaInicio = new Date(
          fechaAnalisisMensual.getFullYear(),
          fechaAnalisisMensual.getMonth(),
          1
        );
        fechaFin = new Date(
          fechaAnalisisMensual.getFullYear(),
          fechaAnalisisMensual.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
      } else {
        // Anual
        fechaInicio = new Date(new Date().getFullYear(), 0, 1);
        fechaFin = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999);
      }

      const start = toYMDLocal(fechaInicio);
      const end = toYMDLocal(fechaFin);


      // Helpers robustos (para evitar mismatch de llaves)
      const toNum = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      const getCuenta = (d: any) =>
        String(d?.cuenta_codigo ?? d?.cuentaCodigo ?? d?.cuenta ?? "");

      const getDetalleFecha = (d: any) => {
  const raw = d?.asiento_fecha ?? d?.fecha ?? d?.createdAt ?? d?.created_at;
  if (!raw) return null;
  return parseDateSafe(raw);
};

      const getAsientoId = (a: any) => String(a?.id ?? a?._id ?? "");
      const getDetalleAsientoId = (d: any) =>
        String(d?.asiento_id ?? d?.asientoId ?? d?.asiento ?? "");

      const getAsientoFecha = (a: any) =>
        parseDateSafe(a?.fecha ?? a?.createdAt ?? a?.created_at);

      const periodKeyFromDate = (fecha: Date) => {
        if (periodFilter === "diario") return "Hoy";
        if (periodFilter === "mensual") return `Día ${fecha.getDate()}`;
        const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        return meses[fecha.getMonth()];
      };

      // Acumuladores + mapa por periodo
      let ventasBrutasTotal = 0;
      let descuentosTotal = 0;
      let otrosIngresosTotal = 0;

      const detallesPorPeriodoMap: Record<
        string,
        { ventasBrutas: number; descuentos: number; otrosIngresos: number }
      > = {};

      const ensureBucket = (key: string) => {
        if (!detallesPorPeriodoMap[key]) {
          detallesPorPeriodoMap[key] = { ventasBrutas: 0, descuentos: 0, otrosIngresos: 0 };
        }
      };

      // 1) Intentar por asientos (ideal)
      const resp = await apiJson<any>(
  `/api/ingresos/asientos?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
);

const asientos = resp?.asientos ?? resp?.data?.asientos ?? [];
let detalles = resp?.detalles ?? resp?.data?.detalles ?? [];

// ✅ FIX CLAVE: si /asientos NO trae detalles, usa /detalles aunque sí existan asientos
if (!Array.isArray(detalles) || detalles.length === 0) {
  const respDet = await apiJson<any>(
    `/api/ingresos/detalles?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  );
  detalles = respDet?.detalles ?? respDet?.data?.detalles ?? [];
}

      // 2) Fallback E2E: si asientos no trae data, usa /detalles (que ya te funciona para resúmenes)
      if (!Array.isArray(asientos) || asientos.length === 0) {
        const respDet = await apiJson<any>(
          `/api/ingresos/detalles?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
        );
        const detallesSolo = respDet?.detalles ?? respDet?.data?.detalles ?? [];

        if (!detallesSolo || detallesSolo.length === 0) {
          setDatosAnaliticas({                 
            ventasBrutas: 0,
            descuentos: 0,
            ventasNetas: 0,
            otrosIngresos: 0,
            detallesPorPeriodo: [],
          });
          return;
        }

        // Construir analítica por fecha del detalle
        for (const det of detallesSolo) {
          const fecha = getDetalleFecha(det);
          if (!fecha || isNaN(fecha.getTime())) continue;

          const key = periodKeyFromDate(fecha);
          ensureBucket(key);

          const cuenta = getCuenta(det);
          const debe = toNum(det?.debe);
          const haber = toNum(det?.haber);

          if (!cuenta) continue;

          if (tipoIngresoAnalisis === "ventas") {
            // Ventas brutas (cuenta 4001) => HABER - DEBE
            if (cuenta === "4001") {
              const monto = haber - debe;
              ventasBrutasTotal += monto;
              detallesPorPeriodoMap[key].ventasBrutas += monto;
            }

            // Descuentos (cuenta 4003) => DEBE - HABER
            if (cuenta === "4003") {
              const monto = debe - haber;
              descuentosTotal += monto;
              detallesPorPeriodoMap[key].descuentos += monto;
            }
          } else {
            // Otros ingresos (4XXX excepto 4001/4003)
            if (cuenta.startsWith("4") && cuenta !== "4001" && cuenta !== "4003") {
              const monto = haber - debe;
              otrosIngresosTotal += monto;
              detallesPorPeriodoMap[key].otrosIngresos += monto;
            }
          }
        }
      } else {
        // 3) Camino normal: asientos + detalles
        for (const asiento of asientos) {
          const asientoId = getAsientoId(asiento);
          const fecha = getAsientoFecha(asiento);
          if (!fecha || isNaN(fecha.getTime())) continue;

          const key = periodKeyFromDate(fecha);
          ensureBucket(key);

          const detallesAsiento = (detalles || []).filter(
            (d: any) => getDetalleAsientoId(d) === asientoId
          );

          for (const det of detallesAsiento) {
            const cuenta = getCuenta(det);
            const debe = toNum(det?.debe);
            const haber = toNum(det?.haber);

            if (!cuenta) continue;

            if (tipoIngresoAnalisis === "ventas") {
              if (cuenta === "4001") {
                const monto = haber - debe;
                ventasBrutasTotal += monto;
                detallesPorPeriodoMap[key].ventasBrutas += monto;
              }
              if (cuenta === "4003") {
                const monto = debe - haber;
                descuentosTotal += monto;
                detallesPorPeriodoMap[key].descuentos += monto;
              }
            } else {
              if (cuenta.startsWith("4") && cuenta !== "4001" && cuenta !== "4003") {
                const monto = haber - debe;
                otrosIngresosTotal += monto;
                detallesPorPeriodoMap[key].otrosIngresos += monto;
              }
            }
          }
        }
      }

      // Construir array de detalles por período (igual que tu lógica)
      let detallesPorPeriodo: Array<{
        periodo: string;
        ventasBrutas: number;
        descuentos: number;
        ventasNetas: number;
        otrosIngresos: number;
      }> = [];

      if (periodFilter === "diario") {
        const data = detallesPorPeriodoMap["Hoy"] || { ventasBrutas: 0, descuentos: 0, otrosIngresos: 0 };
        detallesPorPeriodo = [
          {
            periodo: "Hoy",
            ventasBrutas: data.ventasBrutas,
            descuentos: data.descuentos,
            ventasNetas: data.ventasBrutas - data.descuentos,
            otrosIngresos: data.otrosIngresos,
          },
        ];
      } else if (periodFilter === "mensual") {
        const daysInMonth = new Date(
          fechaAnalisisMensual.getFullYear(),
          fechaAnalisisMensual.getMonth() + 1,
          0
        ).getDate();

        detallesPorPeriodo = Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = `Día ${day}`;
          const data = detallesPorPeriodoMap[key] || { ventasBrutas: 0, descuentos: 0, otrosIngresos: 0 };
          return {
            periodo: key,
            ventasBrutas: data.ventasBrutas,
            descuentos: data.descuentos,
            ventasNetas: data.ventasBrutas - data.descuentos,
            otrosIngresos: data.otrosIngresos,
          };
        });
      } else {
        const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        detallesPorPeriodo = meses.map((mes) => {
          const data = detallesPorPeriodoMap[mes] || { ventasBrutas: 0, descuentos: 0, otrosIngresos: 0 };
          return {
            periodo: mes,
            ventasBrutas: data.ventasBrutas,
            descuentos: data.descuentos,
            ventasNetas: data.ventasBrutas - data.descuentos,
            otrosIngresos: data.otrosIngresos,
          };
        });
      }

      // IMPORTANTE: aquí decides si quieres mostrar aunque todo sea 0
      // Yo recomiendo NO bloquearla por length, porque mensual siempre tendrá 30/31 puntos.
      setDatosAnaliticas({
        ventasBrutas: ventasBrutasTotal,
        descuentos: descuentosTotal,
        ventasNetas: ventasBrutasTotal - descuentosTotal,
        otrosIngresos: otrosIngresosTotal,
        detallesPorPeriodo,
      });
    } catch (error) {
      console.error("Error calculando analíticas desde asientos:", error);
      // en caso de error, no dejes el state viejo “pegado”
      setDatosAnaliticas({
        ventasBrutas: 0,
        descuentos: 0,
        ventasNetas: 0,
        otrosIngresos: 0,
        detallesPorPeriodo: [],
      });
    }
  };

  calcularAnaliticasDesdeAsientos();
}, [periodFilter, fechaAnalisisDiario, fechaAnalisisMensual, tipoIngresoAnalisis]);


  // useEffect para calcular totales desde asientos contables
  useEffect(() => {
    const calcularTotales = async () => {
      try {

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

          const resp = await apiJson<any>(`/api/ingresos/detalles?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`);
          const detalles = resp?.detalles ?? resp?.data?.detalles ?? resp ?? [];
          const error: any = null;

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
            const respMov = await apiJson<any>(`/api/inventario/movimientos?tipo=venta&start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`);
            const movimientos = respMov?.movimientos ?? respMov?.data?.movimientos ?? respMov ?? [];
            const error: any = null;
            
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


      } catch (error) {
        console.error('Error calculando totales:', error);
      }
    };

    calcularTotales();

    // Cargar movimientos de inventario para analítica
    const loadMovimientos = async () => {
      try {
        
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
        const respMov = await apiJson<any>(`/api/inventario/movimientos?tipo=venta&start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`);
        const movimientos = respMov?.movimientos ?? respMov?.data?.movimientos ?? respMov ?? [];
        const error: any = null;
        
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
  const loadAsientosContables = async (transaccionId?: string) => {
  const id = String(transaccionId ?? "").trim();

  setLoadingAsientos(true);
  setCurrentAsientos(null);

  // ✅ Si no hay id, no llames al backend
  if (!id || id === "undefined" || id === "null") {
    setLoadingAsientos(false);
    return;
  }

  try {
    const resp = await apiJson<any>(
      `/api/asientos/by-transaccion?source=ingreso&id=${encodeURIComponent(id)}`
    );

    const asiento = resp?.asiento ?? resp?.data?.asiento ?? resp ?? null;
    setCurrentAsientos(asiento);
  } catch (error: any) {
    // ✅ Si es 404, significa "no hay asientos", NO es error fatal
    const msg = String(error?.message ?? "");
    const is404 =
      error?.status === 404 ||
      error?.response?.status === 404 ||
      msg.includes("404");

    if (!is404) {
      console.error("Error en loadAsientosContables:", error);
      toast({
        title: "Error",
        description: "Error inesperado al cargar asientos",
        variant: "destructive",
      });
    }

    setCurrentAsientos(null);
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
          const respMov = await apiJson<any>(`/api/inventario/productos/${encodeURIComponent(selectedInventoryProductId)}/movimientos?tipo=compra`);
          const movimientos = respMov?.movimientos ?? respMov?.data?.movimientos ?? respMov ?? [];
          
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
let subcuentaToSend: string | null = null;
let descuento = 0; // Inicializar variable de descuento

if (selectedIncomeType === 'precargados' && selectedProducts.length > 0) {
  const firstProduct = productosServicios.find(p => p.id === selectedProducts[0].id);
  subcuentaToSend = firstProduct?.subcuenta_id || null;

  const subtotalSinDescuento = selectedProducts.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);
  const descuentoTotal = selectedProducts.reduce((sum, p) => sum + p.descuento, 0);
  montoTotalDerived = subtotalSinDescuento;
  descuento = descuentoTotal;
  descripcionToSend = `Venta: ${selectedProducts.map(p => `${p.nombre} (x${p.cantidad})`).join(', ')}`;

} else if (selectedIncomeType === 'inventariados') {
  descripcionToSend = `Venta de productos inventariados`;
  montoTotalDerived = 0;
  subcuentaToSend = null;

// ✅ FIX: si es "general", enviar la subcuenta seleccionada en el formulario
} else if (selectedIncomeType === "general") {
  subcuentaToSend = subcuentaGeneral ? String(subcuentaGeneral) : null;
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
          const { data: result, error: edgeFunctionError } = await invokeServer('registrar-ingreso', {
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
        } = await invokeServer('registrar-ingreso', {
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
            ...(selectedIncomeType === "inventariados" && selectedInventoryProduct
  ? {
      productoId: selectedInventoryProduct.id,
      cantidadVendida: Number(inventoryQuantity || "1"),
      precioVenta: Number(inventoryProductPrice || "0"),
      costoPersonalizado:
        tipoCostoInventarioNegativo === "personalizado" && costoPersonalizado
          ? Number(costoPersonalizado)
          : undefined,
    }
  : {})
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
      
      const { data, error } = await invokeServer('cancelar-ingreso', {
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
  return (
    <div className="space-y-4">
      {/* Descripción */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Label htmlFor="descripcion-general">Descripción del Ingreso</Label>
          {hasFieldError("Descripción") && (
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
          className={hasFieldError("Descripción") ? "border-destructive" : ""}
        />
      </div>

      {/* Grid: Cuenta + Subcuenta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cuenta contable fija */}
        <div className="space-y-2">
          <Label htmlFor="cuenta-contable">Cuenta Contable</Label>
          <Select value={CUENTA_VENTAS} onValueChange={() => {}} disabled>
            <SelectTrigger>
              <SelectValue placeholder="4001 - Ventas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4001">4001 - Ventas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Subcuentas reales */}
        <div className="space-y-2">
          <Label htmlFor="subcuenta">Subcuenta (Opcional)</Label>

          <Select
            value={subcuentaGeneral || "__none__"}
            onValueChange={(v) => setSubcuentaGeneral(v === "__none__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar subcuenta" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="__none__">Sin subcuenta</SelectItem>

              {subcuentasVentas.length === 0 ? (
                <SelectItem value="__empty" disabled>
                  No hay subcuentas en 4001
                </SelectItem>
              ) : (
                subcuentasVentas
                  .map((sub: any) => {
                    const id = String(sub?.id ?? sub?._id ?? "").trim();
                    if (!id) return null;

                    const code = String(sub?.codigo ?? sub?.code ?? "").trim();
                    const label = code ? `${code} - ${sub?.nombre}` : sub?.nombre;

                    return (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    );
                  })
                  .filter(Boolean)
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Monto */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Label htmlFor="monto-general">Monto</Label>
          {hasFieldError("Monto Total") && (
            <div className="flex items-center text-destructive">
              <AlertCircle className="h-4 w-4 mr-1" />
              <span className="text-xs">Requerido</span>
            </div>
          )}
        </div>

        <Input
          id="monto-general"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={montoTotal}
          onChange={(e) => setMontoTotal(e.target.value)}
          className={hasFieldError("Monto Total") ? "border-destructive" : ""}
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
          Este ingreso se ligará a la cuenta <strong>4102 - Otros Productos</strong>.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Label htmlFor="descripcion-otros">Descripción del Ingreso Extraordinario</Label>
          {hasFieldError("Descripción") && (
            <div className="flex items-center text-destructive">
              <AlertCircle className="h-4 w-4 mr-1" />
              <span className="text-xs">Requerido</span>
            </div>
          )}
        </div>

        <Textarea
          id="descripcion-otros"
          placeholder="Ej: Venta extraordinaria de equipo usado, donación recibida, etc."
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className={hasFieldError("Descripción") ? "border-destructive" : ""}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Label htmlFor="monto-otros">Monto</Label>
          {hasFieldError("Monto Total") && (
            <div className="flex items-center text-destructive">
              <AlertCircle className="h-4 w-4 mr-1" />
              <span className="text-xs">Requerido</span>
            </div>
          )}
        </div>

        <Input
          id="monto-otros"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={montoTotal}
          onChange={(e) => setMontoTotal(e.target.value)}
          className={hasFieldError("Monto Total") ? "border-destructive" : ""}
        />
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
      {/* ✅ VISTA 1: MENÚ DE SELECCIÓN (igual lógica que egresos: click -> cambia de vista) */}
      {!selectedIncomeType && (
        <div className="space-y-4">
          <Label className="text-base font-semibold">Selecciona el tipo de ingreso que deseas registrar</Label>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {/* Productos Precargados */}
            <button
              type="button"
              onClick={() => setSelectedIncomeType("precargados")}
              className="border rounded-2xl bg-muted/20 hover:bg-muted/40 transition p-8 min-h-[180px] flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ShoppingCart className="h-7 w-7 text-primary" />
              </div>
              <div className="font-semibold text-base">Productos Precargados</div>
              <div className="text-sm text-muted-foreground mt-1">
                Del catálogo de servicios/productos
              </div>
            </button>

            {/* Productos Inventariados */}
            <button
              type="button"
              onClick={() => setSelectedIncomeType("inventariados")}
              className="border rounded-2xl bg-muted/20 hover:bg-muted/40 transition p-8 min-h-[180px] flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="h-7 w-7 text-primary" />
              </div>
              <div className="font-semibold text-base">Productos Inventariados</div>
              <div className="text-sm text-muted-foreground mt-1">
                Del inventario registrado
              </div>
            </button>

            {/* Ingreso General */}
            <button
              type="button"
              onClick={() => setSelectedIncomeType("general")}
              className="border rounded-2xl bg-muted/20 hover:bg-muted/40 transition p-8 min-h-[180px] flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <div className="font-semibold text-base">Ingreso General</div>
              <div className="text-sm text-muted-foreground mt-1">
                Operación no inventariada
              </div>
            </button>

            {/* Otros Ingresos */}
            <button
              type="button"
              onClick={() => setSelectedIncomeType("otros")}
              className="border rounded-2xl bg-muted/20 hover:bg-muted/40 transition p-8 min-h-[180px] flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Gift className="h-7 w-7 text-primary" />
              </div>
              <div className="font-semibold text-base">Otros Ingresos</div>
              <div className="text-sm text-muted-foreground mt-1">
                Extraordinarios, donaciones
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ✅ VISTA 2: FORMULARIO (click -> entra aquí, NO se despliega debajo del menú) */}
      {selectedIncomeType && (
        <div className="space-y-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-0"
            onClick={() => setSelectedIncomeType("")}
          >
            ← Volver al menú de selección
          </Button>

          <div className="space-y-6 p-4 border rounded-lg bg-muted/20">
            {/* Campos específicos por tipo de ingreso */}
            {renderIncomeTypeForm(selectedIncomeType)}

            <Separator />

            {/* Sección de cálculos y descuentos */}
            <div className="space-y-4">
              {/* Mostrar total calculado para productos precargados e inventariados */}
              {(selectedIncomeType === "precargados" && selectedProductId) ||
              (selectedIncomeType === "inventariados" && selectedInventoryProductId) ? (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Cálculo Automático
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Cantidad:</span>
                      <span>
                        {selectedIncomeType === "precargados"
                          ? productQuantity
                          : inventoryQuantity}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Precio Unitario:</span>
                      <span>
                        $
                        {selectedIncomeType === "precargados"
                          ? productUnitPrice
                          : inventoryProductPrice}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Subtotal:</span>
                      <span>${montoTotal}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Estado del pago - PRIMERO */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Label className="font-medium">Estado del Pago</Label>
                {hasFieldError("Tipo de Pago") && (
                  <div className="flex items-center text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-xs">Requerido</span>
                  </div>
                )}
              </div>

              <RadioGroup
                value={paymentStatus}
                onValueChange={setPaymentStatus}
                className={
                  hasFieldError("Tipo de Pago")
                    ? "border border-destructive rounded-lg p-2"
                    : ""
                }
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="contado" id="contado" />
                  <Label htmlFor="contado" className="cursor-pointer">
                    Pago Total
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="parcial" id="parcial" />
                  <Label htmlFor="parcial" className="cursor-pointer">
                    Pago parcial
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="credito" id="credito" />
                  <Label htmlFor="credito" className="cursor-pointer">
                    Adeudo Total
                  </Label>
                </div>
              </RadioGroup>

              {/* Campo para monto abonado en pago parcial */}
              {paymentStatus === "parcial" && (
                <div className="ml-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="monto-abonado">Monto que se va a pagar</Label>
                      <span className="text-destructive text-sm">*</span>
                      {hasFieldError("Monto Abonado") && (
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
                      className={hasFieldError("Monto Abonado") ? "border-destructive" : ""}
                    />
                  </div>

                  {montoTotal && montoAbonado && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-white dark:bg-gray-900 rounded border">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Total de la venta</p>
                        <p className="text-lg font-semibold text-primary">
                          ${formatMonto(montoTotal)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Se pagará ahora</p>
                        <p className="text-lg font-semibold text-green-600">
                          ${formatMonto(montoAbonado)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Queda pendiente</p>
                        <p className="text-lg font-semibold text-orange-600">
                          ${formatMonto(parseFloat(montoTotal) - parseFloat(montoAbonado))}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Base de Datos de Clientes - Mostrar para todos los tipos de pago */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <Label className="font-medium">Datos del Cliente</Label>
                <span className="text-xs text-muted-foreground">
                  {paymentStatus === "contado"
                    ? "Opcional - Para analíticas y comentarios"
                    : "Obligatorio para cuentas por cobrar"}
                </span>
              </div>

              {paymentStatus === "contado" && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Asignar cliente es opcional para pagos totales. Útil para analíticas de
                    ventas y seguimiento de clientes.
                  </AlertDescription>
                </Alert>
              )}

              {(paymentStatus === "parcial" || paymentStatus === "credito") && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Se registrará en Cuentas por Cobrar para análisis de vencimientos
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label className="font-medium">Tipo de Cliente</Label>
                <Select
                  value={tipoCliente}
                  onValueChange={(value) => {
                    setTipoCliente(value);
                    // Reset client data when switching types
                    setClienteSeleccionado("");
                    setClienteNombre("");
                    setClienteTelefono("");
                    setClienteEmail("");
                    setClienteRFC("");
                    setDuplicateWarnings([]); // Limpiar advertencias al cambiar tipo
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        paymentStatus === "contado"
                          ? "Opcional - Selecciona para analíticas"
                          : "Selecciona el tipo de cliente"
                      }
                    />
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

                  {(() => {
                    const selectedCliente = clientes.find((c) => c.id === clienteSeleccionado);

                    return (
                      <Select
                        value={clienteSeleccionado ?? ""} // ✅ evita warning controlled/uncontrolled
                        onValueChange={(value) => {
                          setClienteSeleccionado(value);

                          const cliente = clientes.find((c) => c.id === value);
                          if (cliente) {
                            setClienteNombre(cliente.nombre);
                            setClienteTelefono(cliente.telefono || "");
                            setClienteEmail(cliente.email || "");
                            setClienteRFC(cliente.rfc || "");
                          }
                        }}
                      >
                        <SelectTrigger className="h-auto py-2">
                          {/* ✅ Render custom como Bukipin 2 */}
                          {selectedCliente ? (
                            <div className="flex flex-col text-left leading-tight">
                              <span className="font-medium">{selectedCliente.nombre}</span>
                              <span className="text-xs text-muted-foreground">
                                {selectedCliente.telefono ? `Tel: ${selectedCliente.telefono}` : ""}
                                {selectedCliente.telefono && selectedCliente.email ? " • " : ""}
                                {selectedCliente.email ? `Email: ${selectedCliente.email}` : ""}
                                {selectedCliente.source === "transaction"
                                  ? " • (De transacción)"
                                  : ""}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Buscar cliente existente...</span>
                          )}
                        </SelectTrigger>

                        <SelectContent className="p-1">
                          {loadingClientes ? (
                            <div className="px-2 py-2 text-sm text-muted-foreground">
                              Cargando clientes...
                            </div>
                          ) : clientes.length === 0 ? (
                            <div className="px-2 py-2 text-sm text-muted-foreground">
                              No hay clientes registrados
                            </div>
                          ) : (
                            clientes.map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.id} className="py-2">
                                <div className="flex flex-col text-left leading-tight">
                                  <span className="font-medium">{cliente.nombre}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {cliente.telefono ? `Tel: ${cliente.telefono}` : ""}
                                    {cliente.telefono && cliente.email ? " • " : ""}
                                    {cliente.email ? `Email: ${cliente.email}` : ""}
                                    {cliente.source === "transaction" ? " • (De transacción)" : ""}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    );
                  })()}

                  {!!clienteSeleccionado && (
                    <p className="text-xs text-green-600">
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
                      {hasFieldError("Teléfono del Cliente") && (
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
                      className={hasFieldError("Teléfono del Cliente") ? "border-destructive" : ""}
                      disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""}
                    />
                    {/* Advertencia de duplicado para teléfono */}
                    {tipoCliente === "nuevo" &&
                      duplicateWarnings.some((w) => w.includes(clienteTelefono) && w.includes("teléfono")) && (
                        <div className="flex items-center text-amber-600 bg-amber-50 p-2 rounded">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          <span className="text-xs">
                            {duplicateWarnings.find(
                              (w) => w.includes(clienteTelefono) && w.includes("teléfono")
                            )}
                          </span>
                        </div>
                      )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="cliente-email">Correo Electrónico</Label>
                      {(paymentStatus === "parcial" || paymentStatus === "credito") && (
                        <span className="text-destructive text-sm">*</span>
                      )}
                      {hasFieldError("Email del Cliente") && (
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
                      className={hasFieldError("Email del Cliente") ? "border-destructive" : ""}
                      disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""}
                    />
                    {/* Advertencia de duplicado para email */}
                    {tipoCliente === "nuevo" &&
                      duplicateWarnings.some((w) => w.includes(clienteEmail) && w.includes("correo")) && (
                        <div className="flex items-center text-amber-600 bg-amber-50 p-2 rounded">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          <span className="text-xs">
                            {duplicateWarnings.find(
                              (w) => w.includes(clienteEmail) && w.includes("correo")
                            )}
                          </span>
                        </div>
                      )}
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
                    {/* Advertencia de duplicado para RFC */}
                    {tipoCliente === "nuevo" &&
                      duplicateWarnings.some((w) => w.includes(clienteRFC) && w.includes("RFC")) && (
                        <div className="flex items-center text-amber-600 bg-amber-50 p-2 rounded">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          <span className="text-xs">
                            {duplicateWarnings.find((w) => w.includes(clienteRFC) && w.includes("RFC"))}
                          </span>
                        </div>
                      )}
                  </div>

                  {/* Fecha de vencimiento para pagos parciales y crédito */}
                  {(paymentStatus === "parcial" || paymentStatus === "credito") && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="fecha-vencimiento">Fecha de Vencimiento</Label>
                        <span className="text-destructive text-sm">*</span>
                        {hasFieldError("Fecha de Vencimiento") && (
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
                        className={hasFieldError("Fecha de Vencimiento") ? "border-destructive" : ""}
                        min={new Date().toISOString().split("T")[0]}
                      />
                      <p className="text-xs text-muted-foreground">
                        Fecha límite para el pago{" "}
                        {paymentStatus === "parcial" ? "del monto pendiente" : "completo"}
                      </p>
                    </div>
                  )}

                  {/* Campo de comentarios adicional para pagos totales */}
                  {paymentStatus === "contado" && tipoCliente && (
                    <div className="col-span-full space-y-2">
                      <Label htmlFor="comentario-venta">Comentarios de la venta (Opcional)</Label>
                      <Textarea
                        id="comentario-venta"
                        placeholder="Detalles adicionales sobre esta venta, preferencias del cliente, etc."
                        value={comentarios}
                        onChange={(e) => setComentarios(e.target.value)}
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground">
                        Información útil para futuras ventas y análisis del cliente
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
                    {hasFieldError("Método de Pago") && (
                      <div className="flex items-center text-destructive">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        <span className="text-xs">Requerido</span>
                      </div>
                    )}
                  </div>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                    className={
                      hasFieldError("Método de Pago")
                        ? "border border-destructive rounded-lg p-2"
                        : ""
                    }
                  >
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="efectivo" id="efectivo" />
                      <div className="flex items-center space-x-2">
                        <Wallet className="h-4 w-4 text-green-600" />
                        <Label htmlFor="efectivo" className="cursor-pointer">
                          Efectivo{" "}
                          <span className="text-sm text-muted-foreground">(se registra en Caja)</span>
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="tarjeta" id="tarjeta" />
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4 text-blue-800" />
                        <Label htmlFor="tarjeta" className="cursor-pointer">
                          Tarjeta{" "}
                          <span className="text-sm text-muted-foreground">
                            (se registra en Bancos)
                          </span>
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
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>

          {/* TAB 2: RESUMEN DE VENTAS - SOLO LISTA */}
<TabsContent value="resumen" className="mt-6">
  <Card>
    <CardHeader>
      <CardTitle>Registro Detallado de Ventas</CardTitle>
      <CardDescription>Historial completo de transacciones de ingresos</CardDescription>
    </CardHeader>

    <CardContent>
      {/* Filtros */}
      <div className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Rango de fechas</Label>
            <DateRangePicker value={filtroRangoFechas} onChange={handleRangoChange} />
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
                <SelectItem value="asiento_directo">Venta de activo fijo</SelectItem>
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
                <SelectItem value="4004">4004 - Ventas Inventarios</SelectItem>
                <SelectItem value="4101">4101 - Productos Financieros</SelectItem>
                <SelectItem value="4102">4102 - Otros Productos</SelectItem>
                <SelectItem value="4103">4103 - Ganancia en Venta de Activos</SelectItem>
                <SelectItem value="4003">4003 - Devoluciones sobre ventas</SelectItem>
                <SelectItem value="4002">4002 - Descuentos sobre ventas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-subcuenta">Subcuenta</Label>
            <Select
              value={filtroSubcuenta || "todas"}
              onValueChange={(v) => setFiltroSubcuenta(v)}
            >
              <SelectTrigger id="filtro-subcuenta">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="sin-subcuenta">Sin subcuenta</SelectItem>
                {subcuentas.map((sub) => (
                  <SelectItem key={String(sub.id)} value={String(sub.id)}>
                    {sub.nombre}
                  </SelectItem>
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
              setFiltroRangoFechas(undefined);
              setFiltroFechaInicio("");
              setFiltroFechaFin("");
              setFiltroTipoIngreso("todos");
              setFiltroCuenta("todas");
              setFiltroSubcuenta("todas");
            }}
          >
            Limpiar Filtros
          </Button>

          <div className="text-right">
  {(() => {
    // 1) Asientos directos -> transacciones
    const asientosComoTransacciones = asientosIngresosDirectos.map((asiento) => {
      const detalleIngreso = asiento.detalle_asientos.find(
        (d: any) => String(d.cuenta_codigo || "").startsWith("4") && Number(d.haber) > 0
      );

      return {
        created_at: asiento.fecha,
        fecha: asiento.fecha,
        fecha_fixed: asiento.fecha,
        tipo_ingreso: "asiento_directo",
        cuenta_principal_codigo: detalleIngreso?.cuenta_codigo || "",
        subcuenta_id:
          (detalleIngreso as any)?.subcuenta_id ??
          (detalleIngreso as any)?.subcuentaId ??
          (detalleIngreso as any)?.subcuenta ??
          null,
        subcuentaId:
          (detalleIngreso as any)?.subcuentaId ??
          (detalleIngreso as any)?.subcuenta_id ??
          (detalleIngreso as any)?.subcuenta ??
          null,

        // Montos
        monto_total: Number(detalleIngreso?.haber) || 0,
        monto_neto: Number(detalleIngreso?.haber) || 0,
        monto_descuento: 0,
      };
    });

    // 2) Normalizar + combinar
    const todasLasTransaccionesRaw = [
      ...(transacciones ?? []),
      ...(asientosComoTransacciones ?? []),
    ];
    const todasLasTransacciones = todasLasTransaccionesRaw.map(normalizeTx);

    // 3) Filtrar (UNA sola vez)
    const filtered = todasLasTransacciones.filter((t: any) => {
      const dt = t.fecha_fixed ?? t.fecha ?? t.created_at;
      const fechaMatch = matchRangoFechas(dt);

      const tipoMatch =
        !filtroTipoIngreso ||
        filtroTipoIngreso === "todos" ||
        t.tipo_ingreso === filtroTipoIngreso;

      const cuentaMatch =
        !filtroCuenta ||
        filtroCuenta === "todas" ||
        String(t.cuenta_principal_codigo || "") === String(filtroCuenta);

      const subRef =
        t.subcuenta_id ??
        t.subcuentaId ??
        t.subcuenta ??
        t.subcuentaCodigo ??
        t.subcuenta_codigo ??
        null;

      const subIdStr = subRef ? String(subRef) : "";

      const subcuentaMatch =
        !filtroSubcuenta ||
        filtroSubcuenta === "todas" ||
        (filtroSubcuenta === "sin-subcuenta" && !subIdStr) ||
        subIdStr === String(filtroSubcuenta);

      return fechaMatch && tipoMatch && cuentaMatch && subcuentaMatch;
    });

    // 4) Sumas
    const total = filtered.reduce((sum: number, t: any) => sum + Number(t.monto_total || 0), 0);
    const descuento = filtered.reduce(
      (sum: number, t: any) => sum + Number(t.monto_descuento || 0),
      0
    );

    // Neto: usa tu misma lógica (si tienes netas por getMetricValue, úsala; si no, monto_neto)
    const neto = filtered.reduce(
      (sum: number, t: any) => sum + Number(getMetricValue(t, "netas") ?? t.monto_neto ?? 0),
      0
    );

    return (
      <>
        <p className="text-sm text-muted-foreground">Resultados: {filtered.length}</p>

        <p className="text-lg font-bold text-primary">
          Total: ${formatMonto(total)}
        </p>

        <p className="text-sm font-medium text-red-600">
          Descuento: -${formatMonto(descuento)}
        </p>

        <p className="text-sm font-medium text-green-600">
          Neto: ${formatMonto(neto)}
        </p>
      </>
    );
  })()}
</div>
        </div>
      </div>

      {loadingTransacciones ? (
        <div className="text-center py-8 text-muted-foreground">Cargando transacciones...</div>
      ) : (() => {
          // Transformar asientos directos a formato de transacción
          const asientosComoTransacciones = asientosIngresosDirectos.map((asiento) => {
            const detalleIngreso = asiento.detalle_asientos.find(
              (d: any) => String(d.cuenta_codigo || "").startsWith("4") && Number(d.haber) > 0
            );

            return {
              id: asiento.id ?? asiento._id,
              descripcion: asiento.descripcion,
              monto_total: Number(detalleIngreso?.haber) || 0,
              monto_neto: Number(detalleIngreso?.haber) || 0,
              monto_descuento: 0,
              monto_pagado: Number(detalleIngreso?.haber) || 0,
              monto_pendiente: 0,
              tipo_ingreso: "asiento_directo",
              metodo_pago: "N/A",
              tipo_pago: "contado",
              cuenta_principal_codigo: detalleIngreso?.cuenta_codigo || "",
              subcuenta_id:
                (detalleIngreso as any)?.subcuenta_id ??
                (detalleIngreso as any)?.subcuentaId ??
                (detalleIngreso as any)?.subcuenta ??
                null,
              subcuentaId:
                (detalleIngreso as any)?.subcuentaId ??
                (detalleIngreso as any)?.subcuenta_id ??
                (detalleIngreso as any)?.subcuenta ??
                null,
              // ✅ importante: fecha consistente para UI y filtros
              created_at: asiento.fecha,
              fecha: asiento.fecha,
              fecha_fixed: asiento.fecha,
              asiento_fecha: asiento.fecha,
              es_asiento_directo: true,
              estado: "activo",
            };
          });

          // Combinar transacciones normales + asientos directos
          const todasLasTransacciones = [
            ...transaccionesNorm,
            ...asientosComoTransacciones.map(normalizeTx),
          ];

          const transaccionesFiltradas = todasLasTransacciones.filter((t: any) => {
            const dt = t.fecha_fixed ?? t.fecha ?? t.created_at;
            const fechaMatch = matchRangoFechas(dt);

            const tipoMatch =
              !filtroTipoIngreso ||
              filtroTipoIngreso === "todos" ||
              t.tipo_ingreso === filtroTipoIngreso;

            const cuentaMatch =
              !filtroCuenta ||
              filtroCuenta === "todas" ||
              String(t.cuenta_principal_codigo || "") === String(filtroCuenta);

            const subRef =
              t.subcuenta_id ??
              t.subcuentaId ??
              t.subcuenta ??
              t.subcuentaCodigo ??
              t.subcuenta_codigo ??
              null;

            const subIdStr = subRef ? String(subRef) : "";

            const subcuentaMatch =
              !filtroSubcuenta ||
              filtroSubcuenta === "todas" ||
              (filtroSubcuenta === "sin-subcuenta" && !subIdStr) ||
              subIdStr === String(filtroSubcuenta);

            return fechaMatch && tipoMatch && cuentaMatch && subcuentaMatch;
          });

          // Agrupar transacciones: filtrar reversiones y asociarlas con sus originales
          const transaccionesAgrupadas = transaccionesFiltradas
            .filter((t: any) => !String(t.descripcion || "").includes("CANCELACIÓN:"))
            .map((transaccion: any) => {
              const esCancelada = transaccion.estado === "cancelado";
              let transaccionReversion = null;

              if (esCancelada && transaccion.transaccion_cancelacion_id) {
                transaccionReversion = transaccionesNorm.find(
                  (t: any) => t.id === transaccion.transaccion_cancelacion_id
                );
              }

              return { ...transaccion, esCancelada, transaccionReversion };
            });

          const totalItems = transaccionesAgrupadas.length;
          const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

const safePage = Math.min(Math.max(pageResumen, 1), totalPages);
const startIndex = (safePage - 1) * PAGE_SIZE;
const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);

const transaccionesPaginadas = transaccionesAgrupadas.slice(startIndex, endIndex);
  

          return transaccionesAgrupadas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay transacciones que coincidan con los filtros
            </div>
          ) : (
            <div className="space-y-4">
              {/* Encabezado */}
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-medium text-muted-foreground">
                  Mostrando {transaccionesPaginadas.length} de {transaccionesAgrupadas.length} transacción(es)
                </div>
                <div className="text-xs text-muted-foreground">
                  Tip: da clic en el ícono 📄 para ver “Información general” y “Registro contable”
                </div>
              </div>

              {/* Tabla */}
              <div className="border rounded-lg overflow-hidden bg-background">
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="text-left p-3 font-medium whitespace-nowrap">Fecha</th>
                        <th className="text-left p-3 font-medium min-w-[320px]">Descripción</th>
                        <th className="text-left p-3 font-medium whitespace-nowrap hidden md:table-cell">Tipo</th>
                        <th className="text-left p-3 font-medium whitespace-nowrap hidden lg:table-cell">Cuenta</th>
                        <th className="text-right p-3 font-medium whitespace-nowrap">Total</th>
                        <th className="text-right p-3 font-medium whitespace-nowrap hidden md:table-cell">Neto</th>
                        <th className="text-left p-3 font-medium whitespace-nowrap hidden md:table-cell">Estado</th>
                        <th className="text-right p-3 font-medium whitespace-nowrap">Acciones</th>
                      </tr>
                    </thead>

                    <tbody>
                      {transaccionesPaginadas.map((item: any) => {
                        const transaccion = item;
                        const esCancelada = item.esCancelada;
                        const esReversion = false;

                        const rawFecha =
                          transaccion.fecha_fixed ?? transaccion.fecha ?? transaccion.created_at;

                        const fechaStr = (() => {
                          try {
                            return new Date(rawFecha).toLocaleString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                          } catch {
                            return String(rawFecha || "");
                          }
                        })();

                        const netoRow = Number(getMetricValue(transaccion, "netas") || 0);

                        const subRefRaw =
                          (transaccion as any).subcuenta_id ??
                          (transaccion as any).subcuentaId ??
                          (transaccion as any).subcuenta ??
                          (transaccion as any).subcuentaCodigo ??
                          (transaccion as any).subcuenta_codigo ??
                          null;

                        const subIdStr = subRefRaw ? String(subRefRaw) : "";

                        const subNombreDirecto =
                          (transaccion as any).subcuentaNombre ??
                          (transaccion as any).subcuenta_nombre ??
                          null;

                        const subCodigoDirecto =
                          (transaccion as any).subcuentaCodigo ??
                          (transaccion as any).subcuenta_codigo ??
                          null;

                        const subNombreLookup = (() => {
                          if (!subIdStr) return null;
                          const s = subcuentas.find((x) => String(x.id) === String(subIdStr));
                          return s?.nombre ?? null;
                        })();

                        const subNombreFinal = subNombreDirecto ?? subNombreLookup;

                        return (
                          <tr
                            key={transaccion.id}
                            className={`border-t hover:bg-muted/30 ${
                              esCancelada ? "bg-red-50/60 dark:bg-red-950/20" : ""
                            }`}
                          >
                            <td className="p-3 whitespace-nowrap text-muted-foreground">{fechaStr}</td>

                            <td className="p-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{transaccion.descripcion}</span>

                                {(transaccion as any).es_asiento_directo && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200">
                                    📋 Asiento Directo
                                  </span>
                                )}

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
                              </div>

                              <div className="text-xs text-muted-foreground mt-1">
                                <span className="capitalize">{transaccion.metodo_pago || "N/A"}</span>{" "}
                                •{" "}
                                <span className="capitalize">{transaccion.tipo_pago || "N/A"}</span>
                                {subIdStr ? (
                                  <>
                                    {" "}
                                    •{" "}
                                    <span className="text-muted-foreground">
                                      Subcuenta:{" "}
                                      {subNombreFinal
                                        ? `${subCodigoDirecto ? `${subCodigoDirecto} - ` : ""}${subNombreFinal}`
                                        : subCodigoDirecto
                                          ? subCodigoDirecto
                                          : "Subcuenta no encontrada"}
                                    </span>
                                  </>
                                ) : null}
                              </div>

                              {(transaccion as any).comentarios && (
                                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs">
                                  <span className="font-medium text-blue-700 dark:text-blue-300">
                                    💬{" "}
                                  </span>
                                  <span className="text-blue-600 dark:text-blue-400">
                                    {String((transaccion as any).comentarios).length > 80
                                      ? `${String((transaccion as any).comentarios).substring(0, 80)}...`
                                      : String((transaccion as any).comentarios)}
                                  </span>
                                </div>
                              )}

                              {/* Motivo de cancelación y reversión (si aplica) */}
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
                                      Cancelada el:{" "}
                                      {new Date((transaccion as any).fecha_cancelacion).toLocaleDateString(
                                        "es-ES",
                                        {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }
                                      )}
                                    </p>
                                  </div>

                                  {item.transaccionReversion && (
                                    <div className="p-3 bg-orange-100 dark:bg-orange-950/40 rounded-md border border-orange-300 dark:border-orange-800">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                                          ↩️ Asiento de Reversión Generado
                                        </span>
                                      </div>
                                      <div className="text-xs text-orange-600 dark:text-orange-400 space-y-1">
                                        <p>
                                          <span className="font-medium">Descripción:</span>{" "}
                                          {item.transaccionReversion.descripcion}
                                        </p>
                                        <p>
                                          <span className="font-medium">Monto reversado:</span> $
                                          {formatMonto(Math.abs(item.transaccionReversion.monto_total))}
                                        </p>
                                        <p>
                                          <span className="font-medium">Fecha:</span>{" "}
                                          {(() => {
                                            const raw =
                                              item.transaccionReversion.fecha_fixed ??
                                              item.transaccionReversion.fecha ??
                                              item.transaccionReversion.created_at;
                                            return new Date(raw).toLocaleDateString("es-ES", {
                                              day: "2-digit",
                                              month: "2-digit",
                                              year: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            });
                                          })()}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="p-3 hidden md:table-cell">
                              <span className="capitalize">{transaccion.tipo_ingreso}</span>
                            </td>

                            <td className="p-3 hidden lg:table-cell">
                              {transaccion.cuenta_principal_codigo || "-"}
                            </td>

                            <td className="p-3 text-right font-bold text-primary whitespace-nowrap">
                              ${formatMonto(transaccion.monto_total)}
                              {transaccion.monto_descuento > 0 && (
                                <div className="text-xs text-red-600 font-medium">
                                  -${formatMonto(transaccion.monto_descuento)} desc.
                                </div>
                              )}
                            </td>

                            <td className="p-3 text-right hidden md:table-cell whitespace-nowrap">
                              <span className="font-medium text-green-600">
                                ${formatMonto(netoRow)}
                              </span>
                            </td>

                            <td className="p-3 hidden md:table-cell">
                              {esCancelada ? (
                                <span className="text-red-600 font-medium">Cancelada</span>
                              ) : (
                                <span className="text-muted-foreground">Activa</span>
                              )}
                            </td>

                            <td className="p-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2 justify-end">
                                <Dialog
                                  onOpenChange={(open) => {
                                    if (open) {
                                      const txId = String(
                                        (transaccion as any)._id ?? (transaccion as any).id ?? ""
                                      );
                                      loadAsientosContables(txId);
                                    } else {
                                      setCurrentAsientos(null);
                                    }
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 px-2">
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>

                                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>Detalles de la Transacción</DialogTitle>
                                      <DialogDescription>
                                        Información completa y asientos contables en balanza
                                      </DialogDescription>
                                    </DialogHeader>

                                    <Tabs defaultValue="general" className="w-full">
                                      <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="general">Información General</TabsTrigger>
                                        <TabsTrigger value="contable">Registros Contables</TabsTrigger>
                                      </TabsList>

                                      {/* TAB 1: Información General */}
                                      <TabsContent value="general" className="mt-4 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <h4 className="font-semibold text-sm">Información General</h4>
                                            <div className="space-y-1 text-sm">
                                              <p>
                                                <span className="font-medium">Descripción:</span>{" "}
                                                {transaccion.descripcion}
                                              </p>
                                              <p>
                                                <span className="font-medium">Tipo:</span>{" "}
                                                {transaccion.tipo_ingreso}
                                              </p>
                                              <p>
                                                <span className="font-medium">Método de Pago:</span>{" "}
                                                {transaccion.metodo_pago || "N/A"}
                                              </p>
                                              <p>
                                                <span className="font-medium">Tipo de Pago:</span>{" "}
                                                {transaccion.tipo_pago}
                                              </p>
                                              <p>
                                                <span className="font-medium">Fecha:</span>{" "}
                                                {(() => {
                                                  const raw =
                                                    transaccion.fecha_fixed ??
                                                    transaccion.fecha ??
                                                    transaccion.created_at;

                                                  try {
                                                    return new Date(raw).toLocaleString("es-ES", {
                                                      day: "2-digit",
                                                      month: "2-digit",
                                                      year: "numeric",
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                    });
                                                  } catch {
                                                    return String(raw || "");
                                                  }
                                                })()}
                                              </p>
                                            </div>
                                          </div>

                                          <div>
                                            <h4 className="font-semibold text-sm">Montos</h4>
                                            <div className="space-y-1 text-sm">
                                              <p>
                                                <span className="font-medium">Total:</span> $
                                                {formatMonto(transaccion.monto_total)}
                                              </p>
                                              <p>
                                                <span className="font-medium">Descuento:</span> $
                                                {formatMonto(transaccion.monto_descuento)}
                                              </p>
                                              <p>
                                                <span className="font-medium">Neto:</span> $
                                                {formatMonto(transaccion.monto_neto)}
                                              </p>
                                              <p>
                                                <span className="font-medium">Pagado:</span> $
                                                {formatMonto((transaccion as any).monto_pagado || 0)}
                                              </p>
                                              <p>
                                                <span className="font-medium">Pendiente:</span> $
                                                {formatMonto((transaccion as any).monto_pendiente || 0)}
                                              </p>
                                            </div>
                                          </div>
                                        </div>

                                        {((transaccion as any).cliente_nombre ||
                                          (transaccion as any).cliente_telefono ||
                                          (transaccion as any).cliente_email) && (
                                          <div>
                                            <h4 className="font-semibold text-sm mb-2">
                                              Información del Cliente
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                              {(transaccion as any).cliente_nombre && (
                                                <p>
                                                  <span className="font-medium">Nombre:</span>{" "}
                                                  {(transaccion as any).cliente_nombre}
                                                </p>
                                              )}
                                              {(transaccion as any).cliente_telefono && (
                                                <p>
                                                  <span className="font-medium">Teléfono:</span>{" "}
                                                  {(transaccion as any).cliente_telefono}
                                                </p>
                                              )}
                                              {(transaccion as any).cliente_email && (
                                                <p>
                                                  <span className="font-medium">Email:</span>{" "}
                                                  {(transaccion as any).cliente_email}
                                                </p>
                                              )}
                                              {(transaccion as any).cliente_rfc && (
                                                <p>
                                                  <span className="font-medium">RFC:</span>{" "}
                                                  {(transaccion as any).cliente_rfc}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        <div>
                                          <h4 className="font-semibold text-sm mb-2">
                                            Información Contable
                                          </h4>
                                          <div className="text-sm space-y-1">
                                            <p>
                                              <span className="font-medium">Cuenta Principal:</span>{" "}
                                              {transaccion.cuenta_principal ??
                                                `${transaccion.cuenta_principal_codigo}`}
                                            </p>

                                            {subIdStr ? (
                                              <p>
                                                <span className="font-medium">Subcuenta:</span>{" "}
                                                {subNombreFinal
                                                  ? `${subCodigoDirecto ? `${subCodigoDirecto} - ` : ""}${subNombreFinal}`
                                                  : subCodigoDirecto
                                                    ? subCodigoDirecto
                                                    : "Subcuenta no encontrada"}
                                              </p>
                                            ) : (
                                              <p>
                                                <span className="font-medium">Subcuenta:</span> Sin
                                                subcuenta asignada
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        {(transaccion as any).comentarios && (
                                          <div>
                                            <h4 className="font-semibold text-sm mb-2">Comentarios</h4>
                                            <div className="p-3 bg-muted rounded-md">
                                              <p className="text-sm">{(transaccion as any).comentarios}</p>
                                            </div>
                                          </div>
                                        )}
                                      </TabsContent>

                                      {/* TAB 2: Registros Contables */}
                                      <TabsContent value="contable" className="mt-4">
                                        <h4 className="font-semibold text-sm mb-3">
                                          Asientos en Balanza de Comprobación
                                        </h4>

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
                                                  <span className="font-medium">Número de Asiento:</span>{" "}
                                                  {currentAsientos.numero_asiento}
                                                </div>
                                                <div>
                                                  <span className="font-medium">Fecha:</span>{" "}
                                                  {new Date(currentAsientos.fecha).toLocaleDateString("es-ES")}
                                                </div>
                                                <div className="col-span-2">
                                                  <span className="font-medium">Descripción:</span>{" "}
                                                  {currentAsientos.descripcion}
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
                                                        {detalle.debe > 0 ? `$${formatMonto(detalle.debe)}` : "-"}
                                                      </td>
                                                      <td className="p-3 text-sm text-right font-medium">
                                                        {detalle.haber > 0 ? `$${formatMonto(detalle.haber)}` : "-"}
                                                      </td>
                                                    </tr>
                                                  ))}

                                                  <tr className="border-t-2 bg-muted/50 font-bold">
                                                    <td colSpan={2} className="p-3 text-sm">TOTALES</td>
                                                    <td className="p-3 text-sm text-right">
                                                      ${formatMonto(
                                                        currentAsientos.detalles?.reduce(
                                                          (sum: number, d: any) => sum + Number(d.debe),
                                                          0
                                                        )
                                                      )}
                                                    </td>
                                                    <td className="p-3 text-sm text-right">
                                                      ${formatMonto(
                                                        currentAsientos.detalles?.reduce(
                                                          (sum: number, d: any) => sum + Number(d.haber),
                                                          0
                                                        )
                                                      )}
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
                                      </TabsContent>
                                    </Tabs>
                                  </DialogContent>
                                </Dialog>

                                {!esCancelada && !esReversion && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                    onClick={() => {
                                      setTransaccionACancelar(normalizeTx(transaccion));
                                      setIsCancelDialogOpen(true);
                                    }}
                                  >
                                    ❌
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t p-3 bg-background">
  <div className="text-xs text-muted-foreground">
    Mostrando <span className="font-medium">{totalItems === 0 ? 0 : startIndex + 1}</span>–
    <span className="font-medium">{endIndex}</span> de{" "}
    <span className="font-medium">{totalItems}</span>
  </div>

  <div className="flex items-center justify-end gap-2">
    <Button
      variant="outline"
      size="sm"
      disabled={safePage <= 1}
      onClick={() => setPageResumen((p) => Math.max(1, p - 1))}
    >
      Anterior
    </Button>

    <div className="text-xs text-muted-foreground px-2">
      Página <span className="font-medium">{safePage}</span> de{" "}
      <span className="font-medium">{totalPages}</span>
    </div>

    <Button
      variant="outline"
      size="sm"
      disabled={safePage >= totalPages}
      onClick={() => setPageResumen((p) => Math.min(totalPages, p + 1))}
    >
      Siguiente
    </Button>
  </div>
</div>
              </div>
            </div>
          );
        })()}
    </CardContent>
  </Card>
</TabsContent>




          {/* TAB 3: ANALÍTICA DE VENTAS - GRÁFICAS Y DESTACADOS */}
<TabsContent value="analitica" className="mt-6">
  {/* Función para filtrar transacciones según el período y tipo de ingreso */}
  {(() => {
    // ----------------------------
    // ✅ FIX TS (evitar unknown)
    // ----------------------------
    type NumMap = Record<string, number>;
    type BoolMap = Record<string, boolean>;

    type MetodoPagoItem = { name: string; value: number; porcentaje: string };
    type PieTipoItem = { tipo: string; monto: number; porcentaje: string };
    type PieEstadoItem = { estado: string; monto: number; porcentaje: string };

    type ClienteVenta = {
      nombre: string;
      transacciones: number;
      monto: number;
      email?: string;
      telefono?: string;
    };

    const valuesNum = (obj: NumMap) => Object.values(obj) as number[];
    const entriesNum = (obj: NumMap) => Object.entries(obj) as Array<[string, number]>;

    const asientosDir: any[] = Array.isArray(asientosIngresosDirectos) ? asientosIngresosDirectos : [];

    // ✅ Helper: misma fecha “real” que usa la tabla (soporta varios shapes)
const getTxFecha = (t: any) => {
  const raw =
    t?.fecha_fixed ??        // ideal (YYYY-MM-DD)
    t?.fecha ??              // fallback
    t?.createdAt ??
    t?.created_at ??
    t?.asiento_fecha;        // último fallback
  if (!raw) return null;
  return parseDateSafe(raw);
};

// ✅ Helper: normaliza cuenta principal a string (evita bug 4001 number vs "4001")
const getCuentaCodigo = (t: any) => String(t?.cuenta_principal_codigo ?? "");


    const getFilteredTransactions = () => {
  const today = new Date();
  const currentYear = today.getFullYear();

  // 1) Base: excluir canceladas y reversiones
  let filtered = (transacciones || []).filter((t: any) => {
    const estado = String(t?.estado || "").toLowerCase();
    const desc = String(t?.descripcion || "");
    return estado !== "cancelado" && !desc.includes("CANCELACIÓN:");
  });

  // 2) Filtrar por período (usando misma fecha que la tabla)
  if (periodFilter === "diario") {
    const selected = ymdLocal(fechaAnalisisDiario);

    filtered = filtered.filter((t: any) => {
      const d = getTxFecha(t);
      if (!d) return false;
      return ymdLocal(d) === selected;
    });
  } else if (periodFilter === "mensual") {
    const month = fechaAnalisisMensual.getMonth();
    const year = fechaAnalisisMensual.getFullYear();

    filtered = filtered.filter((t: any) => {
      const d = getTxFecha(t);
      if (!d) return false;
      return d.getFullYear() === year && d.getMonth() === month;
    });
  } else {
    // anual (año actual)
    filtered = filtered.filter((t: any) => {
      const d = getTxFecha(t);
      if (!d) return false;
      return d.getFullYear() === currentYear;
    });
  }

  // 3) Filtrar por tipo de ingreso (ventas vs otros) usando cuenta como string
  if (tipoIngresoAnalisis === "ventas") {
    return filtered.filter((t: any) => getCuentaCodigo(t) === "4001");
  } else {
    const codeIsOtherIncome = (code: string) =>
      code.startsWith("4") && code !== "4001" && code !== "4003";

    return filtered.filter((t: any) => codeIsOtherIncome(getCuentaCodigo(t)));
  }
};


    const filteredTransactions = getFilteredTransactions();

    console.log("[Analitica] filteredTransactions:", filteredTransactions.length, filteredTransactions.slice(0, 3));


    // Función para procesar datos de métodos de pago (solo para transacciones con pago recibido)
    const getMetodosPagoData = (): MetodoPagoItem[] => {
      // Filtrar solo transacciones que tienen método de pago asignado (contado o parcial)
      const transaccionesConPago = filteredTransactions.filter((t) =>
        (t as any).tipo_pago === "contado" || (t as any).tipo_pago === "parcial"
      );

      if (transaccionesConPago.length === 0) return [];

      // Agrupar por método de pago
      const metodosPago: NumMap = {};
      transaccionesConPago.forEach((t) => {
        const metodo = (t as any).metodo_pago === "efectivo" ? "Efectivo" : "Tarjeta";
        metodosPago[metodo] = (metodosPago[metodo] || 0) + (Number(getMetricValue(t as any, metricType)) || 0);
      });

      const total = (Object.values(metodosPago) as number[]).reduce((sum, val) => sum + (Number(val) || 0), 0);

      return (Object.entries(metodosPago) as Array<[string, number]>).map(([name, value]) => ({
        name,
        value,
        porcentaje: total > 0 ? ((value / total) * 100).toFixed(1) : "0.0",
      }));
    };

    const datosMetodosPago = getMetodosPagoData();

    // Función para verificar si hay datos disponibles
    const hayDatosDisponibles = () => {
      if (tipoIngresoAnalisis === "ventas") {
        return (
          filteredTransactions.length > 0 ||
          (Number(datosAnaliticas.ventasBrutas) || 0) > 0 ||
          (Number(datosAnaliticas.descuentos) || 0) > 0
        );
      } else {
        // Otros ingresos
        return filteredTransactions.length > 0 || (Number(datosAnaliticas.otrosIngresos) || 0) > 0;
      }
    };

    return (
      <>
        {/* HIGHLIGHTS - Resumen Completo (sin filtros) */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-foreground mb-4">Highlights de Ingresos</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Día */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-primary">
  Resumen del Día {highlightLabels?.dia ? `(${highlightLabels.dia})` : ""}
</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Ventas Brutas:</span>
                  <span className="font-semibold text-foreground">
                    ${formatCifra(highTotalesDia.ventasBrutas, scaleFormat)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-destructive">Descuentos:</span>
                  <span className="font-semibold text-foreground">
                    ${formatCifra(highTotalesDia.descuentos, scaleFormat)}
                  </span>
                </div>
                <div className="h-px bg-border"></div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-chart-2">Ventas Netas:</span>
                  <span className="text-lg font-bold text-foreground">
                    ${formatCifra(highTotalesDia.ventasNetas, scaleFormat)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-600">Otros Ingresos:</span>
                  <span className="font-semibold text-foreground">
                    ${formatCifra(highTotalesDia.otrosIngresos, scaleFormat)}
                  </span>
                </div>
                <div className="h-px bg-border"></div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-primary">Total Ingresos:</span>
                  <span className="text-xl font-bold text-primary">
                    ${formatCifra(highTotalesDia.totalIngresos, scaleFormat)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Mes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-primary">Resumen del Mes {highlightLabels?.mes ? `(${highlightLabels.mes})` : ""}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Ventas Brutas:</span>
                  <span className="font-semibold text-foreground">
                    ${formatCifra(highTotalesMes.ventasBrutas, scaleFormat)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-destructive">Descuentos:</span>
                  <span className="font-semibold text-foreground">
                    ${formatCifra(highTotalesMes.descuentos, scaleFormat)}
                  </span>
                </div>
                <div className="h-px bg-border"></div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-chart-2">Ventas Netas:</span>
                  <span className="text-lg font-bold text-foreground">
                    ${formatCifra(highTotalesMes.ventasNetas, scaleFormat)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-600">Otros Ingresos:</span>
                  <span className="font-semibold text-foreground">
                    ${formatCifra(highTotalesMes.otrosIngresos, scaleFormat)}
                  </span>
                </div>
                <div className="h-px bg-border"></div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-primary">Total Ingresos:</span>
                  <span className="text-xl font-bold text-primary">
                    ${formatCifra(highTotalesMes.totalIngresos, scaleFormat)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Año */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-primary">Resumen del Año {highlightLabels?.ano ? `(${highlightLabels.ano})` : ""}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Ventas Brutas:</span>
                  <span className="font-semibold text-foreground">
                    ${formatCifra(highTotalesAno.ventasBrutas, scaleFormat)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-destructive">Descuentos:</span>
                  <span className="font-semibold text-foreground">
                    ${formatCifra(highTotalesAno.descuentos, scaleFormat)}
                  </span>
                </div>
                <div className="h-px bg-border"></div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-chart-2">Ventas Netas:</span>
                  <span className="text-lg font-bold text-foreground">
                    ${formatCifra(highTotalesAno.ventasNetas, scaleFormat)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-600">Otros Ingresos:</span>
                  <span className="font-semibold text-foreground">
                    ${formatCifra(highTotalesAno.otrosIngresos, scaleFormat)}
                  </span>
                </div>
                <div className="h-px bg-border"></div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-primary">Total Ingresos:</span>
                  <span className="text-xl font-bold text-primary">
                    ${formatCifra(highTotalesAno.totalIngresos, scaleFormat)}
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
                <RadioGroup
                  value={tipoIngresoAnalisis}
                  onValueChange={(v) => setTipoIngresoAnalisis(v as "ventas" | "otros")}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ventas" id="tipo-ventas" />
                    <Label htmlFor="tipo-ventas" className="cursor-pointer">
                      Ventas
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="otros" id="tipo-otros" />
                    <Label htmlFor="tipo-otros" className="cursor-pointer">
                      Otros Ingresos
                    </Label>
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
                <RadioGroup
                  value={periodFilter}
                  onValueChange={(v) => setPeriodFilter(v as "diario" | "mensual" | "anual")}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="diario" id="period-daily" />
                    <Label htmlFor="period-daily" className="cursor-pointer">
                      Diario
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mensual" id="period-monthly" />
                    <Label htmlFor="period-monthly" className="cursor-pointer">
                      Mensual
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="anual" id="period-annual" />
                    <Label htmlFor="period-annual" className="cursor-pointer">
                      Anual
                    </Label>
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
                          className={cn("w-full justify-start text-left font-normal", !fechaAnalisisDiario && "text-muted-foreground")}
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
                          className={cn("w-full justify-start text-left font-normal", !fechaAnalisisMensual && "text-muted-foreground")}
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
                <RadioGroup
                  value={scaleFormat}
                  onValueChange={(v) => setScaleFormat(v as "general" | "miles" | "millones")}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="general" id="scale-general" />
                    <Label htmlFor="scale-general" className="cursor-pointer">
                      General
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="miles" id="scale-thousands" />
                    <Label htmlFor="scale-thousands" className="cursor-pointer">
                      Miles (K)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="millones" id="scale-millions" />
                    <Label htmlFor="scale-millions" className="cursor-pointer">
                      Millones (M)
                    </Label>
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
                <RadioGroup
                  value={metricType}
                  onValueChange={(v) => setMetricType(v as "brutas" | "descuentos" | "netas")}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="brutas" id="metric-brutas" />
                    <Label htmlFor="metric-brutas" className="cursor-pointer">
                      Ventas Brutas
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="descuentos" id="metric-descuentos" />
                    <Label htmlFor="metric-descuentos" className="cursor-pointer">
                      Descuentos
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="netas" id="metric-netas" />
                    <Label htmlFor="metric-netas" className="cursor-pointer">
                      Ventas Netas
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Ventas Totales, Descuentos y Ventas Netas */}
<Card className="mb-6">
  <CardHeader>
    <CardTitle>
      Evolución de{" "}
      {metricType === "descuentos"
        ? "Descuentos"
        : tipoIngresoAnalisis === "otros"
        ? "Otros Ingresos"
        : metricType === "brutas"
        ? "Ventas Brutas"
        : "Ventas Netas"}
    </CardTitle>
    <CardDescription>
      {(metricType === "descuentos"
        ? "Descuentos aplicados"
        : tipoIngresoAnalisis === "otros"
        ? "Otros ingresos"
        : metricType === "brutas"
        ? "Ventas brutas"
        : "Ventas netas") +
        " - " +
        (periodFilter === "diario"
          ? "del día"
          : periodFilter === "mensual"
          ? "por día del mes"
          : "por mes del año")}
    </CardDescription>
  </CardHeader>

  <CardContent>
    {(() => {
      // 1) Total real (para decidir si mostramos “no hay datos”)
      const totalReal =
        tipoIngresoAnalisis === "ventas"
          ? metricType === "brutas"
            ? Number(datosAnaliticas.ventasBrutas || 0)
            : metricType === "descuentos"
            ? Number(datosAnaliticas.descuentos || 0)
            : Number(datosAnaliticas.ventasNetas || 0)
          : Number(datosAnaliticas.otrosIngresos || 0);

      // 2) Construir fallback cuando detallesPorPeriodo viene vacío
      const buildFallbackFromTransactions = () => {
        const txs = (filteredTransactions || []) as any[];

        const pushValue = (bucket: any, v: number) => {
          if (tipoIngresoAnalisis === "otros") {
            bucket.otrosIngresos += v;
            return;
          }
          if (metricType === "brutas") bucket.ventasBrutas += v;
          else if (metricType === "descuentos") bucket.descuentos += v;
          else bucket.ventasNetas += v;
        };

        // ✅ Usar la misma fecha “real” que usa la tabla (no asiento_fecha)
const getTxFecha = (t: any) => {
  const raw =
    t?.fecha_fixed ??        // ideal (viene del backend mapeado)
    t?.fecha ??              // fallback
    t?.createdAt ??
    t?.created_at ??
    t?.asiento_fecha;        // último fallback, por si existiera en alguno
  if (!raw) return null;
  return parseDateSafe(raw); // usa tu helper existente
};


        // Diario: 1 punto (fecha seleccionada)
        if (periodFilter === "diario") {
  const selectedDateStr = ymdLocal(fechaAnalisisDiario);

  const bucket = {
    periodo: "Hoy",
    ventasBrutas: 0,
    descuentos: 0,
    ventasNetas: 0,
    otrosIngresos: 0,
  };

  txs.forEach((t) => {
    const d = getTxFecha(t);
    if (!d) return;

    // ✅ Comparación local (sin UTC), coherente con la tabla
    if (ymdLocal(d) !== selectedDateStr) return;

    pushValue(bucket, Number(getMetricValue(t, metricType) || 0));
  });

  return [bucket];
}

        // Mensual: puntos por día del mes seleccionado
        if (periodFilter === "mensual") {
  const month = fechaAnalisisMensual.getMonth();
  const year = fechaAnalisisMensual.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const buckets = Array.from({ length: daysInMonth }, (_, i) => ({
    periodo: `Día ${i + 1}`,
    ventasBrutas: 0,
    descuentos: 0,
    ventasNetas: 0,
    otrosIngresos: 0,
    __day: i + 1,
  }));

  txs.forEach((t) => {
    const d = getTxFecha(t);
    if (!d) return;

    if (d.getFullYear() !== year || d.getMonth() !== month) return;

    const idx = d.getDate() - 1;
    if (idx < 0 || idx >= buckets.length) return;

    pushValue(buckets[idx], Number(getMetricValue(t, metricType) || 0));
  });

  return buckets;
}

        // Anual: puntos por mes del año actual (o del sistema)
        const today = new Date();
        const year = today.getFullYear();
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        const buckets = Array.from({ length: 12 }, (_, i) => ({
          periodo: monthNames[i],
          ventasBrutas: 0,
          descuentos: 0,
          ventasNetas: 0,
          otrosIngresos: 0,
          __month: i,
        }));

        txs.forEach((t) => {
  const d = getTxFecha(t);
  if (!d) return;
  if (d.getFullYear() !== year) return;

          const idx = d.getMonth();
          pushValue(buckets[idx], Number(getMetricValue(t, metricType) || 0));
        });

        const sum = buckets.reduce(
          (acc, b) => acc + b.ventasBrutas + b.descuentos + b.ventasNetas + b.otrosIngresos,
          0
        );
        if (sum === 0 && totalReal > 0) {
          const one = {
            periodo: `${year}`,
            ventasBrutas: 0,
            descuentos: 0,
            ventasNetas: 0,
            otrosIngresos: 0,
          };
          pushValue(one, totalReal);
          return [one];
        }

        return buckets;
      };

      // ✅ El gráfico siempre debe ser coherente con la tabla (filteredTransactions)
      const detalles = buildFallbackFromTransactions();


      // 4) Adaptar al shape del chart
      const chartData = (detalles || []).map((d: any) => ({
        periodo: d.periodo,
        ventas: Number(d.ventasBrutas || 0),
        descuentos: Number(d.descuentos || 0),
        neto: Number(d.ventasNetas || 0),
        otrosIngresos: Number(d.otrosIngresos || 0),
        __day: d.__day,
        __month: d.__month,
      }));

      // 5) ¿Hay algo distinto de 0?
      const hasAnyValue = chartData.some(
        (p) => (p.ventas || 0) + (p.descuentos || 0) + (p.neto || 0) + (p.otrosIngresos || 0) > 0
      );

      if (loadingTransacciones) {
        return <div className="h-80 flex items-center justify-center text-muted-foreground">Cargando datos...</div>;
      }

      if (!hasAnyValue && totalReal <= 0) {
        return <div className="h-80 flex items-center justify-center text-muted-foreground">No hay datos para mostrar</div>;
      }

      return (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis tickFormatter={(value) => formatCifra(value, scaleFormat)} />
              <Tooltip
                formatter={(value) => [`$${formatCifra(Number(value), scaleFormat)}`, ""]}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                }}
                wrapperStyle={{ zIndex: 1000 }}
              />
              <Legend />

              {metricType === "descuentos" && (
                <Line type="monotone" dataKey="descuentos" stroke="hsl(180 60% 70%)" name="Descuentos" strokeWidth={2} dot={false}>
                  <LabelList
                    dataKey="descuentos"
                    position="top"
                    formatter={(value: number) => (Number(value) > 0 ? `$${formatCifra(value, scaleFormat)}` : "")}
                    style={{ fill: "#000000", fontWeight: "bold", fontSize: "12px" }}
                  />
                </Line>
              )}

              {metricType === "brutas" && tipoIngresoAnalisis === "ventas" && (
                <Line type="monotone" dataKey="ventas" stroke="hsl(180 50% 55%)" name="Ventas Brutas" strokeWidth={2} dot={false}>
                  <LabelList
                    dataKey="ventas"
                    position="top"
                    formatter={(value: number) => (Number(value) > 0 ? `$${formatCifra(value, scaleFormat)}` : "")}
                    style={{ fill: "#000000", fontWeight: "bold", fontSize: "12px" }}
                  />
                </Line>
              )}

              {metricType === "netas" && tipoIngresoAnalisis === "ventas" && (
                <Line type="monotone" dataKey="neto" stroke="hsl(180 45% 45%)" name="Ventas Netas" strokeWidth={2} dot={false}>
                  <LabelList
                    dataKey="neto"
                    position="top"
                    formatter={(value: number) => (Number(value) > 0 ? `$${formatCifra(value, scaleFormat)}` : "")}
                    style={{ fill: "#000000", fontWeight: "bold", fontSize: "12px" }}
                  />
                </Line>
              )}

              {tipoIngresoAnalisis === "otros" && metricType !== "descuentos" && (
                <Line type="monotone" dataKey="otrosIngresos" stroke="hsl(140 50% 50%)" name="Otros Ingresos" strokeWidth={2} dot={false}>
                  <LabelList
                    dataKey="otrosIngresos"
                    position="top"
                    formatter={(value: number) => (Number(value) > 0 ? `$${formatCifra(value, scaleFormat)}` : "")}
                    style={{ fill: "#000000", fontWeight: "bold", fontSize: "12px" }}
                  />
                </Line>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    })()}
  </CardContent>
</Card>

<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* Gráfico de Ventas por Tipo */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {metricType === "brutas" ? "Ventas Brutas" : metricType === "descuentos" ? "Descuentos" : "Ventas Netas"} por Tipo
                </CardTitle>
                <CardDescription>
                  Distribución de{" "}
                  {metricType === "brutas" ? "ventas brutas" : metricType === "descuentos" ? "descuentos" : "ventas netas"} por categoría
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransacciones ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">Cargando gráfico...</div>
                ) : !hayDatosDisponibles() ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">No hay datos para mostrar</div>
                ) : tipoIngresoAnalisis === "otros" && metricType === "descuentos" ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">No hay descuentos en otros ingresos</div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={((): PieTipoItem[] => {
                            const totalRealPie =
                              tipoIngresoAnalisis === "ventas"
                                ? metricType === "brutas"
                                  ? datosAnaliticas.ventasBrutas
                                  : metricType === "descuentos"
                                  ? datosAnaliticas.descuentos
                                  : datosAnaliticas.ventasNetas
                                : datosAnaliticas.otrosIngresos;

                            if (filteredTransactions.length === 0 && (Number(totalRealPie) || 0) > 0) {
                              return [{ tipo: "Otros Ingresos", monto: Number(totalRealPie) || 0, porcentaje: "100.0" }];
                            }

                            const distribucionTransacciones = filteredTransactions.reduce<NumMap>((acc, t: any) => {
                              const key = (t?.tipo_ingreso || "sin_tipo") as string;
                              acc[key] = (acc[key] || 0) + (Number(getMetricValue(t, metricType)) || 0);
                              return acc;
                            }, {} as NumMap);

                            const totalTransacciones = (Object.values(distribucionTransacciones) as number[]).reduce(
                              (sum, val) => sum + (Number(val) || 0),
                              0
                            );

                            return (Object.entries(distribucionTransacciones) as Array<[string, number]>).map(([tipo, monto]) => ({
                              tipo: String(tipo).charAt(0).toUpperCase() + String(tipo).slice(1),
                              monto: Number(monto) || 0,
                              porcentaje: totalTransacciones > 0 ? (((Number(monto) || 0) / totalTransacciones) * 100).toFixed(1) : "0.0",
                            }));
                          })()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ tipo, porcentaje, monto }: any) => `${tipo}\n${porcentaje}%\n$${formatCifra(Number(monto) || 0, scaleFormat)}`}
                          innerRadius={60}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="monto"
                        >
                          {Object.keys(
                            filteredTransactions.reduce((acc: BoolMap, t: any) => {
                              acc[t?.tipo_ingreso || "sin_tipo"] = true;
                              return acc;
                            }, {} as BoolMap)
                          ).map((entry, index) => {
                            const colors = [
                              "hsl(180 50% 55%)",
                              "hsl(180 45% 45%)",
                              "hsl(180 55% 65%)",
                              "hsl(180 40% 40%)",
                            ];
                            return <Cell key={`cell-${index}`} fill={colors[index % 4]} />;
                          })}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [`$${formatCifra(Number(value), scaleFormat)}`, "Monto"]}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            color: "#000000",
                          }}
                          itemStyle={{ color: "#000000", fontWeight: "bold" }}
                          labelStyle={{ color: "#000000", fontWeight: "bold" }}
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
                <CardTitle>
                  Estado de Pagos - {metricType === "brutas" ? "Ventas Brutas" : metricType === "descuentos" ? "Descuentos" : "Ventas Netas"}
                </CardTitle>
                <CardDescription>Distribución por estado de pago</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransacciones ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">Cargando gráfico...</div>
                ) : !hayDatosDisponibles() ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">No hay datos para mostrar</div>
                ) : tipoIngresoAnalisis === "otros" && metricType === "descuentos" ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">No hay descuentos en otros ingresos</div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={((): PieEstadoItem[] => {
                            const totalRealEstado =
                              tipoIngresoAnalisis === "ventas"
                                ? metricType === "brutas"
                                  ? datosAnaliticas.ventasBrutas
                                  : metricType === "descuentos"
                                  ? datosAnaliticas.descuentos
                                  : datosAnaliticas.ventasNetas
                                : datosAnaliticas.otrosIngresos;

                            if (filteredTransactions.length === 0 && (Number(totalRealEstado) || 0) > 0) {
                              return [{ estado: "Pagado Total", monto: Number(totalRealEstado) || 0, porcentaje: "100.0" }];
                            }

                            const estadoPagos = filteredTransactions.reduce<NumMap>((acc, t: any) => {
                              let estado = "Por Cobrar";
                              if (t.tipo_pago === "contado" || (t.monto_pagado && t.monto_pendiente === 0)) {
                                estado = "Pagado Total";
                              } else if (t.tipo_pago === "parcial" || (t.monto_pagado > 0 && t.monto_pendiente > 0)) {
                                estado = "Pago Parcial";
                              }
                              acc[estado] = (acc[estado] || 0) + (Number(getMetricValue(t, metricType)) || 0);
                              return acc;
                            }, {} as NumMap);

                            const totalEstadoPagos = (Object.values(estadoPagos) as number[]).reduce((sum, val) => sum + (Number(val) || 0), 0);

                            return (Object.entries(estadoPagos) as Array<[string, number]>).map(([estado, monto]) => ({
                              estado,
                              monto: Number(monto) || 0,
                              porcentaje: totalEstadoPagos > 0 ? (((Number(monto) || 0) / totalEstadoPagos) * 100).toFixed(1) : "0.0",
                            }));
                          })()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ estado, porcentaje, monto }: any) => `${estado}\n${porcentaje}%\n$${formatCifra(Number(monto) || 0, scaleFormat)}`}
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
                          formatter={(value) => [`$${formatCifra(Number(value), scaleFormat)}`, "Monto"]}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            color: "#000000",
                          }}
                          itemStyle={{ color: "#000000", fontWeight: "bold" }}
                          labelStyle={{ color: "#000000", fontWeight: "bold" }}
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
            {/* Gráfico por Subcuenta/Cuenta Contable */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>
                    {metricType === "brutas" ? "Ventas Brutas" : metricType === "descuentos" ? "Descuentos" : "Ventas Netas"} por{" "}
                    {vistaGraficaBarras === "subcuenta" ? "Subcuenta" : "Cuenta"}
                  </CardTitle>
                  <CardDescription>
                    Distribución por {vistaGraficaBarras === "subcuenta" ? "subcuentas" : "cuentas"} contables
                  </CardDescription>
                </div>
                <Select value={vistaGraficaBarras} onValueChange={(v) => setVistaGraficaBarras(v as "subcuenta" | "cuenta")}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subcuenta">Por Subcuenta</SelectItem>
                    <SelectItem value="cuenta">Por Cuenta</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {loadingTransacciones ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">Cargando gráfico...</div>
                ) : !hayDatosDisponibles() ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">No hay datos para mostrar</div>
                ) : tipoIngresoAnalisis === "otros" && metricType === "descuentos" ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">No hay descuentos en otros ingresos</div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(() => {
                          const totalRealBarSub =
                            tipoIngresoAnalisis === "ventas"
                              ? metricType === "brutas"
                                ? datosAnaliticas.ventasBrutas
                                : metricType === "descuentos"
                                ? datosAnaliticas.descuentos
                                : datosAnaliticas.ventasNetas
                              : datosAnaliticas.otrosIngresos;

                          if (filteredTransactions.length === 0 && (Number(totalRealBarSub) || 0) > 0) {
                            return [{ subcuenta: "Sin detalle", monto: Number(totalRealBarSub) || 0 }];
                          }

                          const chartData = filteredTransactions.reduce<NumMap>((acc, t: any) => {
                            let key: string;
                            if (vistaGraficaBarras === "subcuenta") {
                              key = t.subcuenta_id
                                ? subcuentas.find((s) => s.id === t.subcuenta_id)?.nombre || "Subcuenta desconocida"
                                : "Sin subcuenta asignada";
                            } else {
                              const cuenta = cuentas.find((c) => c.codigo === t.cuenta_principal_codigo);
                              key = cuenta ? `${t.cuenta_principal_codigo} - ${cuenta.nombre}` : t.cuenta_principal_codigo || "Sin cuenta";
                            }

                            acc[key] = (acc[key] || 0) + (Number(getMetricValue(t, metricType)) || 0);
                            return acc;
                          }, {} as NumMap);

                          const totalTransacciones = (Object.values(chartData) as number[]).reduce((sum, v) => sum + (Number(v) || 0), 0);
                          const diferencia = (Number(totalRealBarSub) || 0) - totalTransacciones;

                          if (diferencia > 0.01) {
                            const ingresosPorOrigen: NumMap = {};

                            asientosDir.forEach((asiento: any) => {
                              const detalles = Array.isArray(asiento.detalle_asientos) ? asiento.detalle_asientos : [];
                              const detalleIngreso = detalles.find((d: any) => String(d.cuenta_codigo || "").startsWith("4") && Number(d.haber) > 0);
                              if (!detalleIngreso) return;

                              const monto = Number(detalleIngreso.haber) || 0;
                              const cuentaCodigo = String(detalleIngreso.cuenta_codigo || "");
                              const cuentaInfo = cuentas.find((c) => c.codigo === cuentaCodigo);
                              const cuentaNombre = cuentaInfo?.nombre || "Otros ingresos";

                              let origen: string;
                              if (vistaGraficaBarras === "cuenta") {
                                origen = `${cuentaCodigo} - ${cuentaNombre}`;
                              } else {
                                const subcuentaId = detalleIngreso.subcuenta_id;
                                const subcuentaInfo = subcuentas.find((s) => s.id === subcuentaId);
                                origen = subcuentaInfo?.nombre || "Sin subcuenta asignada";
                              }

                              ingresosPorOrigen[origen] = (ingresosPorOrigen[origen] || 0) + monto;
                            });

                            (Object.entries(ingresosPorOrigen) as Array<[string, number]>).forEach(([origen, monto]) => {
                              chartData[origen] = (chartData[origen] || 0) + (Number(monto) || 0);
                            });
                          }

                          return (Object.entries(chartData) as Array<[string, number]>).map(([subcuenta, monto]) => ({
                            subcuenta,
                            monto: Number(monto) || 0,
                          }));
                        })()}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          tickFormatter={(value) => formatCifra(value, scaleFormat)}
                          tick={{ fill: "#000000" }}
                          domain={[0, (dataMax: number) => dataMax * 1.2]}
                        />
                        <YAxis type="category" dataKey="subcuenta" width={150} tick={{ fill: "#000000" }} />
                        <Tooltip
                          formatter={(value) => [`$${formatCifra(Number(value), scaleFormat)}`, "Monto"]}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            color: "#000000",
                          }}
                          itemStyle={{ color: "#000000", fontWeight: "bold" }}
                          labelStyle={{ color: "#000000", fontWeight: "bold" }}
                          wrapperStyle={{ zIndex: 1000 }}
                        />
                        <Bar dataKey="monto" fill="hsl(180 50% 55%)">
                          <LabelList
                            dataKey="monto"
                            position="right"
                            formatter={(value: number) => `$${formatCifra(value, scaleFormat)}`}
                            style={{ fill: "#000000", fontWeight: "bold", fontSize: "12px" }}
                          />
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
                  Distribución de{" "}
                  {metricType === "brutas" ? "ventas brutas" : metricType === "descuentos" ? "descuentos" : "ventas netas"} por método de pago
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransacciones ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">Cargando gráfico...</div>
                ) : !hayDatosDisponibles() ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">No hay datos para mostrar</div>
                ) : tipoIngresoAnalisis === "otros" && metricType === "descuentos" ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">No hay descuentos en otros ingresos</div>
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
                        aspectRatio={4 / 3}
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
                <CardTitle>
                  {metricType === "brutas" ? "Ventas Brutas" : metricType === "descuentos" ? "Descuentos" : "Ventas Netas"} por Producto
                </CardTitle>
                <CardDescription>
                  Ranking de productos {metricType === "descuentos" ? "con más descuentos" : "más vendidos"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransacciones ? (
                  <div className="text-center py-8 text-muted-foreground">Cargando datos...</div>
                ) : !hayDatosDisponibles() ? (
                  <div className="text-center py-8 text-muted-foreground">No hay datos para mostrar</div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      if (tipoIngresoAnalisis === "otros" && metricType === "descuentos") {
                        return <div className="text-center py-8 text-muted-foreground">No hay descuentos en otros ingresos</div>;
                      }

                      const totalRealProductos =
                        tipoIngresoAnalisis === "ventas"
                          ? metricType === "brutas"
                            ? datosAnaliticas.ventasBrutas
                            : metricType === "descuentos"
                            ? datosAnaliticas.descuentos
                            : datosAnaliticas.ventasNetas
                          : datosAnaliticas.otrosIngresos;

                      if (filteredTransactions.length === 0 && (Number(totalRealProductos) || 0) > 0) {
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
                                <p className="font-bold text-foreground">${formatCifra(Number(totalRealProductos) || 0, scaleFormat)}</p>
                              </div>
                              <div className="flex-shrink-0">
                                <div className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-semibold">100%</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 border-2 border-primary rounded-lg bg-primary/5">
                              <div className="w-12 h-12 rounded-md bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <Package className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-foreground">TOTAL GENERAL</p>
                                <p className="text-sm text-muted-foreground">1 registro</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-lg text-primary">${formatCifra(Number(totalRealProductos) || 0, scaleFormat)}</p>
                              </div>
                              <div className="flex-shrink-0">
                                <div className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm font-bold">100%</div>
                              </div>
                            </div>
                          </>
                        );
                      }

                      const productosVentas: Record<
                        string,
                        { nombre: string; transacciones: number; monto: number; imagen?: string; tieneAsignacion: boolean }
                      > = {};

                      filteredTransactions.forEach((t: any) => {
                        if (t.tipo_ingreso === "inventariados" && String(t.descripcion || "").startsWith("Venta de ")) {
                          const productoNombre = String(t.descripcion).replace("Venta de ", "").trim();
                          const productoEnCatalogo = productosInventario.find((p) => p.nombre.toLowerCase() === productoNombre.toLowerCase());

                          if (!productosVentas[productoNombre]) {
                            productosVentas[productoNombre] = {
                              nombre: productoNombre,
                              transacciones: 0,
                              monto: 0,
                              imagen: productoEnCatalogo?.imagen_url,
                              tieneAsignacion: true,
                            };
                          }

                          productosVentas[productoNombre].transacciones += 1;
                          productosVentas[productoNombre].monto += Number(getMetricValue(t, metricType)) || 0;
                        }
                      });

                      filteredTransactions.forEach((t: any) => {
                        if (t.tipo_ingreso === "precargados") {
                          let productosPorProcesar: Array<{ nombre: string; cantidad: number }> = [];

                          if (String(t.descripcion || "").startsWith("Venta: ")) {
                            const productosSplit = String(t.descripcion).replace("Venta: ", "").split(", ");
                            productosPorProcesar = productosSplit.map((productoStr) => {
                              const match = productoStr.match(/^(.+?) \(x(\d+)\)$/);
                              if (match) return { nombre: match[1].trim(), cantidad: parseInt(match[2]) };
                              return { nombre: productoStr.trim(), cantidad: 1 };
                            });
                          } else if (String(t.descripcion || "").startsWith("Venta de ")) {
                            const nombreProducto = String(t.descripcion).replace("Venta de ", "").trim();
                            productosPorProcesar = [{ nombre: nombreProducto, cantidad: 1 }];
                          } else {
                            productosPorProcesar = [{ nombre: String(t.descripcion || "Sin descripción"), cantidad: 1 }];
                          }

                          const montoTransaccion = Number(getMetricValue(t, metricType)) || 0;

                          const preciosProductos: Array<{ nombre: string; cantidad: number; precioBase: number }> = [];
                          let sumaPreciosCatalogo = 0;

                          productosPorProcesar.forEach(({ nombre, cantidad }) => {
                            const productoEnCatalogo = productosServicios.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase());
                            const precioBase = Number(productoEnCatalogo?.precio) || 0;

                            preciosProductos.push({ nombre, cantidad, precioBase });
                            sumaPreciosCatalogo += precioBase * cantidad;
                          });

                          preciosProductos.forEach(({ nombre, cantidad, precioBase }) => {
                            const productoEnCatalogo = productosServicios.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase());
                            const subtotalProductoCatalogo = precioBase * cantidad;

                            const proporcion =
                              sumaPreciosCatalogo > 0 ? subtotalProductoCatalogo / sumaPreciosCatalogo : 1 / Math.max(preciosProductos.length, 1);

                            const montoProducto = montoTransaccion * proporcion;

                            if (!productosVentas[nombre]) {
                              productosVentas[nombre] = {
                                nombre,
                                transacciones: 0,
                                monto: 0,
                                imagen: productoEnCatalogo?.imagen_url,
                                tieneAsignacion: !!productoEnCatalogo,
                              };
                            }

                            productosVentas[nombre].transacciones += 1;
                            productosVentas[nombre].monto += Number(montoProducto) || 0;
                          });
                        }

                        if (t.tipo_ingreso === "general" || (t.tipo_ingreso === "inventariados" && !String(t.descripcion || "").startsWith("Venta de "))) {
                          const nombre = "Ingresos sin producto asignado";
                          if (!productosVentas[nombre]) {
                            productosVentas[nombre] = { nombre, transacciones: 0, monto: 0, tieneAsignacion: false };
                          }
                          productosVentas[nombre].transacciones += 1;
                          productosVentas[nombre].monto += Number(getMetricValue(t, metricType)) || 0;
                        }

                        if (t.tipo_ingreso === "otros") {
                          const nombre = String(t.descripcion || "Otros ingresos");
                          if (!productosVentas[nombre]) {
                            productosVentas[nombre] = { nombre, transacciones: 0, monto: 0, tieneAsignacion: false };
                          }
                          productosVentas[nombre].transacciones += 1;
                          productosVentas[nombre].monto += Number(getMetricValue(t, metricType)) || 0;
                        }
                      });

                      const productosArray = (Object.values(productosVentas) as Array<{
                        nombre: string;
                        transacciones: number;
                        monto: number;
                        imagen?: string;
                        tieneAsignacion: boolean;
                      }>).sort((a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0));

                      if (tipoIngresoAnalisis === "otros") {
                        const totalTransaccionesOtros = filteredTransactions
                          .filter((t: any) => t.tipo_ingreso === "otros")
                          .reduce((sum, t: any) => sum + (Number(getMetricValue(t, metricType)) || 0), 0);

                        const diferencia = (Number(totalRealProductos) || 0) - totalTransaccionesOtros;

                        if (diferencia > 0.01) {
                          const ingresosPorOrigen: Record<string, { monto: number; count: number }> = {};

                          asientosDir.forEach((asiento: any) => {
                            const detalles = Array.isArray(asiento.detalle_asientos) ? asiento.detalle_asientos : [];
                            const detalleIngreso = detalles.find((d: any) => String(d.cuenta_codigo || "").startsWith("4") && Number(d.haber) > 0);
                            if (!detalleIngreso) return;

                            const monto = Number(detalleIngreso.haber) || 0;
                            const cuentaCodigo = String(detalleIngreso.cuenta_codigo || "");
                            const cuentaInfo = cuentas.find((c) => c.codigo === cuentaCodigo);

                            let nombre: string;
                            if (String(asiento.numero_asiento || "").startsWith("BAJA-")) {
                              nombre = cuentaInfo?.nombre || "Ganancia en Venta de Activos";
                            } else {
                              nombre = String(asiento.descripcion || cuentaInfo?.nombre || "Otros ingresos");
                            }

                            if (!ingresosPorOrigen[nombre]) ingresosPorOrigen[nombre] = { monto: 0, count: 0 };
                            ingresosPorOrigen[nombre].monto += monto;
                            ingresosPorOrigen[nombre].count += 1;
                          });

                          Object.entries(ingresosPorOrigen).forEach(([nombre, data]) => {
                            if ((Number(data.monto) || 0) > 0.01) {
                              productosArray.push({
                                nombre,
                                transacciones: data.count,
                                monto: data.monto,
                                tieneAsignacion: false,
                              });
                            }
                          });
                        }
                      }

                      const top10 = productosArray.slice(0, 10);

                      return (
                        <>
                          {top10.map((producto) => {
                            const totalConAsientos = productosArray.reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
                            const porcentaje = totalConAsientos > 0 ? (((Number(producto.monto) || 0) / totalConAsientos) * 100).toFixed(1) : "0.0";

                            return (
                              <div
                                key={producto.nombre}
                                className={`flex items-center gap-3 p-3 border rounded-lg ${
                                  !producto.tieneAsignacion ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20" : ""
                                }`}
                              >
                                {producto.imagen ? (
                                  <img src={producto.imagen} alt={producto.nombre} className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                                ) : (
                                  <div
                                    className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${
                                      !producto.tieneAsignacion ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"
                                    }`}
                                  >
                                    <Package
                                      className={`w-5 h-5 ${!producto.tieneAsignacion ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
                                    />
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
                                    {producto.transacciones} {producto.transacciones === 1 ? "transacción" : "transacciones"}
                                  </p>
                                </div>

                                <div className="text-right flex-shrink-0">
                                  <p className="font-bold text-foreground">${formatCifra(Number(producto.monto) || 0, scaleFormat)}</p>
                                </div>

                                <div className="flex-shrink-0">
                                  <div className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-semibold">{porcentaje}%</div>
                                </div>
                              </div>
                            );
                          })}

                          {(() => {
                            const totalGeneralMonto = productosArray.reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
                            if (totalGeneralMonto > 0) {
                              return (
                                <div className="flex items-center gap-3 p-3 border-2 border-primary rounded-lg bg-primary/5">
                                  <div className="w-12 h-12 rounded-md bg-primary/20 flex items-center justify-center flex-shrink-0">
                                    <Package className="w-5 h-5 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-foreground">TOTAL GENERAL</p>
                                    <p className="text-sm text-muted-foreground">
                                      {productosArray.reduce((sum, p) => sum + (Number(p.transacciones) || 0), 0)} transacciones
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="font-bold text-lg text-primary">${formatCifra(totalGeneralMonto, scaleFormat)}</p>
                                  </div>
                                  <div className="flex-shrink-0">
                                    <div className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm font-bold">100%</div>
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
                <CardTitle>
                  {metricType === "brutas" ? "Ventas Brutas" : metricType === "descuentos" ? "Descuentos" : "Ventas Netas"} por Cliente
                </CardTitle>
                <CardDescription>
                  Ranking de {metricType === "descuentos" ? "clientes con más descuentos" : "mejores clientes"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransacciones ? (
                  <div className="text-center py-8 text-muted-foreground">Cargando datos...</div>
                ) : !hayDatosDisponibles() ? (
                  <div className="text-center py-8 text-muted-foreground">No hay datos para mostrar</div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      if (tipoIngresoAnalisis === "otros" && metricType === "descuentos") {
                        return <div className="text-center py-8 text-muted-foreground">No hay descuentos en otros ingresos</div>;
                      }

                      const totalRealClientes =
                        tipoIngresoAnalisis === "ventas"
                          ? metricType === "brutas"
                            ? datosAnaliticas.ventasBrutas
                            : metricType === "descuentos"
                            ? datosAnaliticas.descuentos
                            : datosAnaliticas.ventasNetas
                          : datosAnaliticas.otrosIngresos;

                      if (filteredTransactions.length === 0 && (Number(totalRealClientes) || 0) > 0) {
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
                                <p className="font-bold text-foreground">${formatCifra(Number(totalRealClientes) || 0, scaleFormat)}</p>
                              </div>
                              <div className="flex-shrink-0">
                                <div className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-semibold">100%</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 border-2 border-primary rounded-lg bg-primary/5">
                              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <Users className="w-6 h-6 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-foreground">TOTAL GENERAL</p>
                                <p className="text-sm text-muted-foreground">1 registro</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-lg text-primary">${formatCifra(Number(totalRealClientes) || 0, scaleFormat)}</p>
                              </div>
                              <div className="flex-shrink-0">
                                <div className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm font-bold">100%</div>
                              </div>
                            </div>
                          </>
                        );
                      }

                      const clientesVentas = filteredTransactions.reduce<Record<string, ClienteVenta>>((acc, t: any) => {
                        const clienteNombre = String(t?.cliente_nombre || "Sin cliente asignado");

                        if (!acc[clienteNombre]) {
                          acc[clienteNombre] = {
                            nombre: clienteNombre,
                            transacciones: 0,
                            monto: 0,
                            email: t?.cliente_email,
                            telefono: t?.cliente_telefono,
                          };
                        }

                        acc[clienteNombre].transacciones += 1;
                        acc[clienteNombre].monto += Number(getMetricValue(t, metricType)) || 0;

                        return acc;
                      }, {} as Record<string, ClienteVenta>);

                      const clientesArray = (Object.values(clientesVentas) as ClienteVenta[]).sort(
                        (a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0)
                      );

                      const totalGeneralClientes = clientesArray.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);

                      if (tipoIngresoAnalisis === "otros") {
                        const diferencia = (Number(totalRealClientes) || 0) - totalGeneralClientes;
                        if (diferencia > 0.01) {
                          const existente = clientesArray.find((c) => c.nombre === "Sin cliente asignado");
                          if (existente) {
                            existente.monto += diferencia;
                            existente.transacciones += asientosDir.length;
                          } else {
                            clientesArray.push({
                              nombre: "Sin cliente asignado",
                              transacciones: asientosDir.length,
                              monto: diferencia,
                            });
                          }
                          clientesArray.sort((a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0));
                        }
                      }

                      const top10 = clientesArray.slice(0, 10);

                      return (
                        <>
                          {top10.map((cliente: ClienteVenta) => {
                            const totalConAsientos = clientesArray.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
                            const porcentaje =
                              totalConAsientos > 0 ? (((Number(cliente.monto) || 0) / totalConAsientos) * 100).toFixed(1) : "0.0";

                            return (
                              <div key={cliente.nombre} className="flex items-center gap-3 p-3 border rounded-lg">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Users className="w-6 h-6 text-primary" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{cliente.nombre}</p>
                                  <div className="text-sm text-muted-foreground space-y-0.5">
                                    <p>
                                      {cliente.transacciones} {cliente.transacciones === 1 ? "compra" : "compras"}
                                    </p>
                                    {cliente.telefono && <p className="text-xs">{cliente.telefono}</p>}
                                    {cliente.email && <p className="text-xs truncate">{cliente.email}</p>}
                                  </div>
                                </div>

                                <div className="text-right flex-shrink-0">
                                  <p className="font-bold text-foreground">${formatCifra(Number(cliente.monto) || 0, scaleFormat)}</p>
                                </div>

                                <div className="flex-shrink-0">
                                  <div className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-semibold">{porcentaje}%</div>
                                </div>
                              </div>
                            );
                          })}

                          {(() => {
                            const totalGeneralMonto = clientesArray.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
                            if (totalGeneralMonto > 0) {
                              return (
                                <div className="flex items-center gap-3 p-3 border-2 border-primary rounded-lg bg-primary/5">
                                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                    <Users className="w-6 h-6 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-foreground">TOTAL GENERAL</p>
                                    <p className="text-sm text-muted-foreground">
                                      {clientesArray.reduce((sum, c) => sum + (Number(c.transacciones) || 0), 0)} transacciones
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="font-bold text-lg text-primary">${formatCifra(totalGeneralMonto, scaleFormat)}</p>
                                  </div>
                                  <div className="flex-shrink-0">
                                    <div className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm font-bold">100%</div>
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