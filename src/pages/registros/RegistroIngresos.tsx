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
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Treemap,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Brush,
  LabelList,
  Legend,
  Label as RechartsLabel, // ✅ ESTE
} from "recharts";
import TabRegistroIngresos from "./tabs/TabRegistroIngresos";
import TabResumenVentas from "./tabs/TabResumenVentas";
import TabAnaliticaVentas from "./tabs/TabAnaliticaVentas";
import TabCatalogoProductos from "./tabs/TabCatalogoProductos";



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

type ChartTooltipProps = {
  active?: boolean;
  payload?: any[];
  label?: string;
  scaleFormat: "general" | "miles" | "millones";
  title?: string;
};

function ChartTooltipBukipin({ active, payload, label, scaleFormat, title }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  // Filtra solo series con valor > 0 para no mostrar basura
  const items = payload
    .map((p) => ({ name: p.name ?? p.dataKey, value: Number(p.value) || 0, color: p.color }))
    .filter((x) => x.value !== 0);

  return (
    <div className="rounded-xl border bg-background/95 backdrop-blur px-3 py-2 shadow-lg">
      <div className="text-xs text-muted-foreground">{title ?? "Detalle"}</div>
      <div className="text-sm font-semibold text-foreground">{label}</div>

      <div className="mt-2 space-y-1">
        {(items.length ? items : payload).map((it, idx) => (
          <div key={idx} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
              <span className="text-xs text-muted-foreground">{it.name}</span>
            </div>
            <span className="text-xs font-semibold text-foreground">
              ${formatCifra(Number(it.value) || 0, scaleFormat)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

    // ✅ fecha límite / vencimiento (para CxC / UI)
// IMPORTANTE: ignorar "" (string vacío) además de null/undefined
const pickNonEmpty = (...vals: any[]) => {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s; // solo si no está vacío
  }
  return null;
};

const fechaLimiteRaw = pickNonEmpty(
  tx.fechaLimite,
  tx.fecha_limite,
  tx.fecha_vencimiento,
  tx.fechaVencimiento,
  tx.dueDate,
  tx.due_date
);

// Para UI: YYYY-MM-DD (estable)
const fechaLimiteYMD = fechaLimiteRaw ? String(fechaLimiteRaw).slice(0, 10) : null;

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

        // fecha límite (dejamos ambas)
    // ✅ canónico en UI: siempre disponible si existe en cualquier alias
    fechaLimite: tx.fechaLimite ?? fechaLimiteRaw,
    fecha_limite: tx.fecha_limite ?? fechaLimiteRaw,

    // ✅ compat para tu UI actual (modal/resumen)
    fecha_vencimiento: fechaLimiteYMD,
    fechaVencimiento: fechaLimiteYMD,

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
type MetricType = "brutas" | "descuentos" | "netas" | "otros_netos";

const getMetricValue = (transaction: any, metricType: MetricType): number => {
  const montoTotal = Number(transaction?.monto_total ?? transaction?.montoTotal ?? 0) || 0;
  const montoDescuento = Number(transaction?.monto_descuento ?? transaction?.montoDescuento ?? 0) || 0;

  // monto neto si existe, si no lo derivamos
  const montoNeto =
    Number(transaction?.monto_neto ?? transaction?.montoNeto ?? 0) || Math.max(montoTotal - montoDescuento, 0);

  if (metricType === "brutas") return montoTotal;
  if (metricType === "descuentos") return montoDescuento;

  // ✅ netas y otros_netos regresan neto (para "otros" será su neto)
  return montoNeto;
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
  const [metricType, setMetricType] = useState<MetricType>("netas");
  
  // Estado para el tipo de ingreso a analizar
  const [tipoIngresoAnalisis, setTipoIngresoAnalisis] = useState<"ventas" | "otros">("ventas");

  const [highlightsScaleFormat, setHighlightsScaleFormat] =
  useState<"general" | "miles" | "millones">("general");

  // Estados para fechas específicas de análisis
const [fechaAnalisisDiario, setFechaAnalisisDiario] = useState<Date>(new Date());
const [fechaAnalisisMensual, setFechaAnalisisMensual] = useState<Date>(new Date());

// ✅ Labels de highlights (solo 1 declaración)
type HighlightLabels = { dia?: string; mes?: string; ano?: string };
const [highlightLabels, setHighlightLabels] = useState<HighlightLabels>({});

const [fechaAnalisisAnual, setFechaAnalisisAnual] = useState<Date>(
  () => new Date(new Date().getFullYear(), 0, 1)
);


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


 useEffect(() => {
  setMetricType((prev) => {
    if (tipoIngresoAnalisis === "otros") return "otros_netos";
    // si regresan a ventas y traían otros_netos, volvemos a netas
    return prev === "otros_netos" ? "netas" : prev;
  });
}, [tipoIngresoAnalisis]);

const [productSort, setProductSort] = useState<"desc" | "asc">("desc");
const [openProductsModal, setOpenProductsModal] = useState(false);
const [productSearch, setProductSearch] = useState("");
const [productPage, setProductPage] = useState(1);
const PAGE_SIZE_PRODUCTS = 25; // o 10 si quieres 10 en 10

const PAGE_SIZE_CLIENTS = 25;

const [clientSort, setClientSort] = useState<"desc" | "asc">("desc");
const [clientSearch, setClientSearch] = useState("");
const [clientPage, setClientPage] = useState(1);
const [openClientsModal, setOpenClientsModal] = useState(false);



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

const getSubcuentaIdAny = (t: any) =>
  t?.subcuenta_id ??
  t?.subcuentaId ??
  t?.subcuenta ??
  t?.subcuenta_codigo ??
  t?.subcuentaCodigo ??
  null;


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
  const [vistaGraficaBarras, setVistaGraficaBarras] = useState<"subcuenta" | "cuenta">("cuenta");

  
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

    if (productDiscountType === "monto" && discountValue > 0 && discountValue >= subtotalSinDescuento) {
      toast({
        title: "⚠️ Descuento inválido",
        description: `El descuento ($${discountValue}) no puede ser igual o mayor al precio del producto ($${subtotalSinDescuento}).`,
        variant: "destructive",
      });
      return;
    }

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

    if (inventoryDiscountType === "monto" && discountValue > 0 && discountValue >= subtotalSinDescuento) {
      toast({
        title: "⚠️ Descuento inválido",
        description: `El descuento ($${discountValue}) no puede ser igual o mayor al precio del producto ($${subtotalSinDescuento}).`,
        variant: "destructive",
      });
      return;
    }

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

    if (discountAmount && montoTotal) {
      const descuentoNum = parseFloat(discountAmount) || 0;
      const totalNum = parseFloat(montoTotal) || 0;
      if (descuentoNum > 0 && descuentoNum >= totalNum) {
        errors.push('El descuento no puede ser igual o mayor al monto total');
      }
    }

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

const dueYMD =
  fechaVencimiento && String(fechaVencimiento).trim()
    ? String(fechaVencimiento).trim().slice(0, 10)
    : null;

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

  const subRef =
    (firstProduct as any)?.subcuentaId ??
    (firstProduct as any)?.subcuenta_id ??
    (firstProduct as any)?.subcuentaCodigo ??
    (firstProduct as any)?.subcuenta_codigo ??
    null;

  subcuentaToSend = subRef ? String(subRef) : null;

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
              fechaVencimiento: dueYMD,
              fecha_vencimiento: dueYMD,
              comentarios: comentarios.trim() || null,
              // ✅ Campos canónicos para que el backend NO caiga en qty=1
productId: producto.id,
qty: producto.cantidad,
cantidad: producto.cantidad,

// ✅ recomendado: fuerza el modo “array items” del backend
items: [{ productId: producto.id, qty: producto.cantidad }],

// (Legacy, puedes dejarlo por compat)
productoId: producto.id,
cantidadVendida: producto.cantidad,

precioVenta: producto.precioUnitario,
costoPersonalizado:
  tipoCostoInventarioNegativo === "personalizado" && costoPersonalizado
    ? parseFloat(costoPersonalizado)
    : undefined,
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
            subcuenta_id: subcuentaToSend || undefined,
            metodoPago: paymentMethod,
            tipoPago: paymentStatus,
            montoPagado: montoPagado,
            montoPendiente: montoPendiente,
            clienteNombre: clienteNombre.trim() || null,
            clienteTelefono: clienteTelefono.trim() || null,
            clienteEmail: clienteEmail.trim() || null,
            clienteRFC: clienteRFC.trim() || null,
            clienteId: clienteId,
            fechaVencimiento: dueYMD,
            fecha_vencimiento: dueYMD,
            comentarios: comentarios.trim() || null,
            // Datos adicionales para inventario (flujo antiguo, no debería llegar aquí)
            ...(selectedIncomeType === "inventariados" && selectedInventoryProduct
  ? {
      // ✅ canónico
      productId: selectedInventoryProduct.id,
      qty: Number(inventoryQuantity || "1"),
      cantidad: Number(inventoryQuantity || "1"),

      // ✅ recomendado: items[] para que el backend entre por extractSaleItems()
      items: [
        { productId: selectedInventoryProduct.id, qty: Number(inventoryQuantity || "1") },
      ],

      // legacy
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
  <TabRegistroIngresos
    selectedIncomeType={selectedIncomeType as any}
    setSelectedIncomeType={setSelectedIncomeType as any}
    renderIncomeTypeForm={renderIncomeTypeForm}

    selectedProductId={selectedProductId}
    selectedInventoryProductId={selectedInventoryProductId}
    productQuantity={productQuantity}
    inventoryQuantity={inventoryQuantity}
    productUnitPrice={productUnitPrice}
    inventoryProductPrice={inventoryProductPrice}
    montoTotal={montoTotal}

    hasFieldError={hasFieldError}
    formatMonto={formatMonto}

    paymentStatus={paymentStatus}
    setPaymentStatus={setPaymentStatus}
    montoAbonado={montoAbonado}
    setMontoAbonado={setMontoAbonado}

    tipoCliente={tipoCliente}
    setTipoCliente={setTipoCliente}
    clienteSeleccionado={clienteSeleccionado}
    setClienteSeleccionado={setClienteSeleccionado}
    clienteNombre={clienteNombre}
    setClienteNombre={setClienteNombre}
    clienteTelefono={clienteTelefono}
    setClienteTelefono={setClienteTelefono}
    clienteEmail={clienteEmail}
    setClienteEmail={setClienteEmail}
    clienteRFC={clienteRFC}
    setClienteRFC={setClienteRFC}
    clientes={clientes}
    loadingClientes={loadingClientes}
    duplicateWarnings={duplicateWarnings}
    setDuplicateWarnings={setDuplicateWarnings}

    fechaVencimiento={fechaVencimiento}
    setFechaVencimiento={setFechaVencimiento}

    paymentMethod={paymentMethod}
    setPaymentMethod={setPaymentMethod}

    comentarios={comentarios}
    setComentarios={setComentarios}

    handleSubmitIngreso={handleSubmitIngreso}
    isSubmitting={isSubmitting}
  />
</TabsContent>

          {/* TAB 2: RESUMEN DE VENTAS - SOLO LISTA */}
 <TabsContent value="resumen" className="mt-6">
  <TabResumenVentas
    transacciones={transacciones ?? []}
    transaccionesNorm={transaccionesNorm ?? []}
    subcuentas={subcuentas ?? []}
    asientosIngresosDirectos={asientosIngresosDirectos ?? []}

    loadingTransacciones={loadingTransacciones}
    loadingAsientos={loadingAsientos}
    currentAsientos={currentAsientos}
    setCurrentAsientos={setCurrentAsientos}
    loadAsientosContables={loadAsientosContables}

    filtroRangoFechas={filtroRangoFechas}
    setFiltroRangoFechas={setFiltroRangoFechas}
    filtroFechaInicio={filtroFechaInicio}
    setFiltroFechaInicio={setFiltroFechaInicio}
    filtroFechaFin={filtroFechaFin}
    setFiltroFechaFin={setFiltroFechaFin}

    filtroTipoIngreso={filtroTipoIngreso}
    setFiltroTipoIngreso={setFiltroTipoIngreso}
    filtroCuenta={filtroCuenta}
    setFiltroCuenta={setFiltroCuenta}
    filtroSubcuenta={filtroSubcuenta}
    setFiltroSubcuenta={setFiltroSubcuenta}
    handleRangoChange={handleRangoChange}

    normalizeTx={normalizeTx}
    matchRangoFechas={matchRangoFechas}
    getMetricValue={getMetricValue}
    formatMonto={formatMonto}

    PAGE_SIZE={PAGE_SIZE}
    pageResumen={pageResumen}
    setPageResumen={setPageResumen}

    setTransaccionACancelar={setTransaccionACancelar}
    setIsCancelDialogOpen={setIsCancelDialogOpen}
  />
</TabsContent>




          {/* TAB 3: ANALÍTICA DE VENTAS - GRÁFICAS Y DESTACADOS */}
<TabsContent value="analitica" className="mt-6">
  <TabAnaliticaVentas
    transacciones={transacciones ?? []}
    loadingTransacciones={loadingTransacciones}
    asientosIngresosDirectos={asientosIngresosDirectos ?? []}

    subcuentas={subcuentas ?? []}
    cuentas={cuentas ?? []}
    productosInventario={productosInventario ?? []}
    productosServicios={productosServicios ?? []}

    datosAnaliticas={datosAnaliticas}

    highTotalesDia={highTotalesDia}
    highTotalesMes={highTotalesMes}
    highTotalesAno={highTotalesAno}
    highlightLabels={highlightLabels}

    tipoIngresoAnalisis={tipoIngresoAnalisis}
    setTipoIngresoAnalisis={setTipoIngresoAnalisis}

    periodFilter={periodFilter}
    setPeriodFilter={setPeriodFilter}

    scaleFormat={scaleFormat}
    setScaleFormat={setScaleFormat}

    highlightsScaleFormat={highlightsScaleFormat}
    setHighlightsScaleFormat={setHighlightsScaleFormat}

    metricType={metricType}
    setMetricType={setMetricType}

    fechaAnalisisDiario={fechaAnalisisDiario}
    setFechaAnalisisDiario={setFechaAnalisisDiario}

    fechaAnalisisMensual={fechaAnalisisMensual}
    setFechaAnalisisMensual={setFechaAnalisisMensual}

    fechaAnalisisAnual={fechaAnalisisAnual}
    setFechaAnalisisAnual={setFechaAnalisisAnual}

    vistaGraficaBarras={vistaGraficaBarras}
    setVistaGraficaBarras={setVistaGraficaBarras}

    openProductsModal={openProductsModal}
    setOpenProductsModal={setOpenProductsModal}
    productSort={productSort}
    setProductSort={setProductSort}
    productSearch={productSearch}
    setProductSearch={setProductSearch}
    productPage={productPage}
    setProductPage={setProductPage}
    PAGE_SIZE_PRODUCTS={PAGE_SIZE_PRODUCTS}

    openClientsModal={openClientsModal}
    setOpenClientsModal={setOpenClientsModal}
    clientSort={clientSort}
    setClientSort={setClientSort}
    clientSearch={clientSearch}
    setClientSearch={setClientSearch}
    clientPage={clientPage}
    setClientPage={setClientPage}
    PAGE_SIZE_CLIENTS={PAGE_SIZE_CLIENTS}

    getMetricValue={getMetricValue}
    parseDateSafe={parseDateSafe}
    ymdLocal={ymdLocal}
    formatCifra={formatCifra}

    getSubcuentaIdAny={getSubcuentaIdAny}

    ChartTooltipBukipin={ChartTooltipBukipin}
    CustomTreemapTooltip={CustomTreemapTooltip}
  />
</TabsContent>


          {/* TAB 4: CATÁLOGO DE PRODUCTOS */}
          <TabsContent value="catalogo" className="mt-6">
  <TabCatalogoProductos
    subcuentas={subcuentas ?? []}
    productosServicios={productosServicios ?? []}
    loadingProductosServicios={loadingProductosServicios}

    refetchProductosServicios={refetchProductosServicios}
    toast={toast}

    isProductDialogOpen={isProductDialogOpen}
    setIsProductDialogOpen={setIsProductDialogOpen}

    productName={productName}
    setProductName={setProductName}
    productImage={productImage}
    setProductImage={setProductImage}
    productPrice={productPrice}
    setProductPrice={setProductPrice}
    productSubcuenta={productSubcuenta}
    setProductSubcuenta={setProductSubcuenta}
    productDescription={productDescription}
    setProductDescription={setProductDescription}

    handleSubmitProduct={handleSubmitProduct}
    isSubmittingProduct={isSubmittingProduct}

    isEditDialogOpen={isEditDialogOpen}
    setIsEditDialogOpen={setIsEditDialogOpen}
    editProductName={editProductName}
    setEditProductName={setEditProductName}
    editProductPrice={editProductPrice}
    setEditProductPrice={setEditProductPrice}
    editProductDescription={editProductDescription}
    setEditProductDescription={setEditProductDescription}
    editProductSubcuenta={editProductSubcuenta}
    setEditProductSubcuenta={setEditProductSubcuenta}

    handleEditImageChange={handleEditImageChange}
    editImagePreview={editImagePreview}

    handleUpdateProduct={handleUpdateProduct}
    handleOpenEditDialog={handleOpenEditDialog}

    deleteProducto={deleteProducto}
  />
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