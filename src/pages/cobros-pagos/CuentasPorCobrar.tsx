import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Calendar,
  DollarSign,
  User,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  Target,
  CheckCircle2,
  FileText,
  Eye,
  ChevronDown,
  ChevronRight,
  History,
  Settings
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  LabelList
} from "recharts";
import { useAnalyticsCuentasPorCobrar } from "@/hooks/useAnalyticsCuentasPorCobrar";
import { formatCurrency } from "@/lib/utils";

const COLORS = {
  primary: "hsl(var(--chart-1))",
  secondary: "hsl(var(--chart-2))",
  accent: "hsl(var(--chart-3))",
  destructive: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
  success: "hsl(var(--success))"
};

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string; error?: any } | T;
const unwrap = <T,>(json: ApiEnvelope<T>): T => (json as any)?.data ?? (json as T);

// ✅ helper: fecha segura (evita RangeError: Invalid time value)
function safeDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeFormatDate(value: any, fmt: string, opts?: any): string {
  const d = safeDate(value);
  if (!d) return "-";
  try {
    return format(d, fmt, opts);
  } catch {
    return "-";
  }
}

// Componente personalizado para mostrar el total a la derecha de las barras apiladas
const CustomTotalLabel = (props: any) => {
  const { x, y, width, height, index, filtroAntiguedad, dataFiltradaCliente, formatearConPreferenciasAnalitica } = props;

  if (!dataFiltradaCliente || !dataFiltradaCliente[index]) return null;

  const cliente = dataFiltradaCliente[index];
  const total = filtroAntiguedad === "todos"
    ? cliente.total
    : cliente[filtroAntiguedad] || 0;

  const labelX = x + width + 8;
  const labelY = y + height / 2;

  return (
    <text
      x={labelX}
      y={labelY}
      fill="hsl(var(--foreground))"
      fontSize="11"
      fontWeight="600"
      textAnchor="start"
      dominantBaseline="middle"
    >
      {formatearConPreferenciasAnalitica(total)}
    </text>
  );
};

const CuentasPorCobrar = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("lista");
    // ✅ NUEVO: “sub-vista” estilo CxP (menú vs detalle)
  const [bucket, setBucket] = useState<null | "1003" | "1009">(null);

  // ✅ NUEVO: clasificador (sin backend) para separar 1003 vs 1009
  const isDeudores1009 = (tx: any) => {
    const tipo = String(tx?.tipo_ingreso ?? tx?.tipoIngreso ?? "").trim().toLowerCase();
    const cuenta = String(
      tx?.cuenta_principal_codigo ??
        tx?.cuentaPrincipalCodigo ??
        tx?.cuenta_codigo ??
        tx?.cuentaCodigo ??
        ""
    ).trim();

    // Regla: “Otros ingresos” (4102) => 1009
    return tipo === "otros" || cuenta === "4102";
  };
  const bucketKeyOf = (tx: any): "1003" | "1009" => (isDeudores1009(tx) ? "1009" : "1003");
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [selectedCuenta, setSelectedCuenta] = useState<any>(null);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [filtroAntiguedad, setFiltroAntiguedad] = useState<string>("todos");
  const [periodoCxC, setPeriodoCxC] = useState<"mensual" | "anual">("mensual");
  const [filtroClienteAnalitica, setFiltroClienteAnalitica] = useState<string>("todos");
  const [selectedCliente, setSelectedCliente] = useState<string>("");
  const [filtroCliente, setFiltroCliente] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [ordenMonto, setOrdenMonto] = useState<string>("ninguno");

  // Filtros para la tabla de transacciones
  const [filtroMesTransaccion, setFiltroMesTransaccion] = useState<string>("todos");
  const [filtroAnoTransaccion, setFiltroAnoTransaccion] = useState<string>("todos");
  const [filtroEstadoTransaccion, setFiltroEstadoTransaccion] = useState<string>("todos");
  const [filtroMetodoPago, setFiltroMetodoPago] = useState<string>("todos");
  const [filtroTipoIngreso, setFiltroTipoIngreso] = useState<string>("todos");
  const [filtroClienteTransaccion, setFiltroClienteTransaccion] = useState<string>("todos");
  const [ordenMontoTransaccion, setOrdenMontoTransaccion] = useState<string>("ninguno");

  // Estados para modal de detalle contable
  const [detalleContableOpen, setDetalleContableOpen] = useState(false);
  const [selectedTransaccionId, setSelectedTransaccionId] = useState<string | null>(null);

  // Estados para agrupación por cliente
  const [expandedClientes, setExpandedClientes] = useState<Set<string>>(new Set());
  const [historialPagosOpen, setHistorialPagosOpen] = useState(false);
  const [selectedFacturaId, setSelectedFacturaId] = useState<string | null>(null);

  // Estados para formato de números en analíticas
  const [formatoNumerosAnalitica, setFormatoNumerosAnalitica] = useState<'normal' | 'miles' | 'millones'>('normal');
  const [decimalesAnalitica, setDecimalesAnalitica] = useState<0 | 1 | 2>(2);

  // Función para formatear números según preferencias del usuario
  const formatearConPreferenciasAnalitica = (valor: number) => {
    let valorFormateado = valor;
    let sufijo = '';

    if (formatoNumerosAnalitica === 'miles') {
      valorFormateado = valor / 1000;
      sufijo = 'K';
    } else if (formatoNumerosAnalitica === 'millones') {
      valorFormateado = valor / 1000000;
      sufijo = 'M';
    }

    return `$${valorFormateado.toLocaleString('en-US', {
      minimumFractionDigits: decimalesAnalitica,
      maximumFractionDigits: decimalesAnalitica
    })}${sufijo}`;
  };

  const queryClient = useQueryClient();

  // ✅ TRANSACCIONES INGRESOS (historial completo)
  const { data: todasTransacciones, isLoading: loadingTransacciones } = useQuery({
    queryKey: ["todas-transacciones-ingresos"],
    queryFn: async () => {
      const json = await apiFetch("/api/transacciones/ingresos?include_all=true&order=created_at_desc", {
        method: "GET",
      });
      return unwrap<any[]>(json) || [];
    },
  });

  // ✅ ANALÍTICAS (se queda igual)
  const { data: analytics, isLoading: loadingAnalytics } = useAnalyticsCuentasPorCobrar(periodoCxC, filtroClienteAnalitica);

  // ✅ FIX E2E: No depender de /api/cxc/ventas-activos (puede no existir en backend)
  // - intentamos /api/cxc/detalle?pendientes=1 (nuevo)
  // - fallback /api/cxc/ingresos?pendientes=1 (compat)
  // - intentamos /api/cxc/ventas-activos?pendientes=1 solo si existe (si da 404 se ignora)
  const { data: cuentasPorCobrar, isLoading: loadingDetalles } = useQuery({
    queryKey: ["cuentas-por-cobrar-detalle"],
    queryFn: async () => {
      const results: any[] = [];

      // helper de fetch tolerante a 404
      const tryFetchArray = async (url: string) => {
        try {
          const json = await apiFetch(url, { method: "GET" });
          const arr = unwrap<any[]>(json);
          return Array.isArray(arr) ? arr : [];
        } catch (e: any) {
          // si el backend responde 404 para una ruta, NO rompemos la pantalla
          return [];
        }
      };

      // 1) principal recomendado
      const base = await tryFetchArray("/api/cxc/detalle?pendientes=1");
      if (base.length) results.push(...base);

      // 2) compat (por si aún no montan /detalle)
      if (!results.length) {
        const compat = await tryFetchArray("/api/cxc/ingresos?pendientes=1");
        if (compat.length) results.push(...compat);
      }

      // 3) ventas activos (solo si existe; si 404 lo ignoramos)
      const activos = await tryFetchArray("/api/cxc/ventas-activos?pendientes=1");
      if (activos.length) results.push(...activos);

      // normalización mínima: asegurar keys esperadas y evitar fechas inválidas
      return (results || []).map((r: any) => {
        const id = String(r.id ?? r._id ?? "");
        const created_at = r.created_at ?? r.createdAt ?? r.fecha ?? r.asiento_fecha ?? null;

        const monto_total = Number(r.monto_total ?? r.montoTotal ?? r.total ?? 0) || 0;
        const monto_pagado = Number(r.monto_pagado ?? r.montoPagado ?? r.pagado ?? 0) || 0;
        const monto_pendiente = Number(
          r.monto_pendiente ?? r.montoPendiente ?? Math.max(0, monto_total - monto_pagado)
        ) || 0;

        return {
          ...r,
          id,
          created_at,
          monto_total,
          monto_pagado,
          monto_pendiente,
        };
      });
    },
  });

  const clientesUnicos = useMemo(() => {
    return Array.from(
      new Set(
        (cuentasPorCobrar || [])
          ?.map((c: any) => c.cliente_nombre || 'Sin nombre')
          .filter(Boolean)
      )
    ).sort();
  }, [cuentasPorCobrar]);

  const { data: asientosContables, isLoading: loadingAsientos } = useQuery({
    queryKey: ["asientos-contables-transaccion", selectedTransaccionId],
    queryFn: async () => {
      if (!selectedTransaccionId) return null;
      const json = await apiFetch(
        `/api/asientos/by-transaccion-ingreso/${encodeURIComponent(selectedTransaccionId)}`,
        { method: "GET" }
      );
      return unwrap<any>(json) ?? null;
    },
    enabled: !!selectedTransaccionId && detalleContableOpen,
  });

  const { data: historialPagos, isLoading: loadingHistorial } = useQuery({
    queryKey: ["historial-pagos", selectedFacturaId],
    queryFn: async () => {
      if (!selectedFacturaId) return [];

      const pagosJson = await apiFetch(
        `/api/cobros-pagos/historial?referencia_id=${encodeURIComponent(selectedFacturaId)}&tipo=cobro`,
        { method: "GET" }
      );

      const pagos = (unwrap<any[]>(pagosJson) || []).sort((a, b) => {
        const da = safeDate(a?.fecha || a?.created_at)?.getTime() ?? 0;
        const db = safeDate(b?.fecha || b?.created_at)?.getTime() ?? 0;
        return db - da;
      });

      const tienePagoInicial = pagos?.some((p) => String(p?.descripcion || "").includes("Pago inicial"));

      if (!tienePagoInicial) {
        const trxJson = await apiFetch(`/api/transacciones/ingresos/${encodeURIComponent(selectedFacturaId)}`, {
          method: "GET",
        });
        const transaccion = unwrap<any>(trxJson);

        if (transaccion && Number(transaccion.monto_pagado || 0) > 0) {
          const created = transaccion.created_at ?? transaccion.createdAt ?? null;
          const pagoInicial = {
            id: `inicial-${selectedFacturaId}`,
            user_id: transaccion.user_id,
            tipo_transaccion: "cobro",
            referencia_id: selectedFacturaId,
            referencia_tabla: "transacciones_ingresos",
            monto: transaccion.monto_pagado,
            metodo_pago: transaccion.metodo_pago,
            fecha: safeDate(created)?.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0],
            descripcion: `Pago inicial - ${transaccion.descripcion}`,
            created_at: created,
            updated_at: created,
            _es_pago_inicial: true,
          };

          return [pagoInicial, ...(pagos || [])];
        }
      }

      return pagos || [];
    },
    enabled: !!selectedFacturaId && historialPagosOpen,
  });

  const registrarPagoMutation = useMutation({
    mutationFn: async ({
      cuentaId,
      monto,
      metodo,
      tipoRegistro,
    }: {
      cuentaId: string;
      monto: number;
      metodo: string;
      tipoRegistro: "ingreso" | "venta_activo";
    }) => {
      const json = await apiFetch("/api/cuentas-por-cobrar/registrar-pago", {
        method: "POST",
        body: JSON.stringify({
          cuentaId,
          monto,
          metodo_pago: metodo,
          tipoRegistro,
        }),
      });

      return unwrap<any>(json);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuentas-por-cobrar-detalle"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-cuentas-por-cobrar"] });
      queryClient.invalidateQueries({ queryKey: ["todas-transacciones-ingresos"] });
      toast.success("Pago registrado exitosamente");
      setPagoDialogOpen(false);
      resetPagoForm();
    },
    onError: (error: any) => {
      toast.error("Error al registrar el pago: " + (error?.message || "Error desconocido"));
    },
  });



  // ===============================
// ✅ BASE (NO filtros) → NO toca highlights
// ===============================
const baseCuentas = useMemo(() => (Array.isArray(cuentasPorCobrar) ? cuentasPorCobrar : []), [cuentasPorCobrar]);

// ===============================
// ✅ HIGHLIGHTS (SIEMPRE desde baseCuentas)
// ===============================
const highlights = useMemo(() => {
  const totalPorCobrarBase = baseCuentas.reduce((sum: number, c: any) => sum + (Number(c?.monto_pendiente) || 0), 0);

  const hoy = new Date();
  const vencidasBase = baseCuentas.filter((c: any) => {
    const fv = c?.fecha_vencimiento ? safeDate(c.fecha_vencimiento) : null;
    return fv && fv.getTime() < hoy.getTime() && (Number(c?.monto_pendiente) || 0) > 0;
  }).length;

  const porVencerBase = baseCuentas.filter((c: any) => {
    const fv = c?.fecha_vencimiento ? safeDate(c.fecha_vencimiento) : null;
    return fv && fv.getTime() >= hoy.getTime() && (Number(c?.monto_pendiente) || 0) > 0;
  }).length;

  return {
    totalPorCobrar: totalPorCobrarBase,
    vencidas: vencidasBase,
    porVencer: porVencerBase,
    totalCuentas: baseCuentas.length,
  };
}, [baseCuentas]);

// ===============================
// ✅ TOTALES DEL MENÚ 1003/1009 (SIEMPRE desde baseCuentas)
// ===============================
const menuTotals = useMemo(() => {
  const sumBucket = (key: "1003" | "1009") =>
    baseCuentas
      .filter((c: any) => bucketKeyOf(c) === key)
      .reduce((sum: number, c: any) => sum + (Number(c?.monto_pendiente) || 0), 0);

  const countPend = (key: "1003" | "1009") =>
    baseCuentas.filter((c: any) => bucketKeyOf(c) === key && (Number(c?.monto_pendiente) || 0) > 0).length;

  const countClientes = (key: "1003" | "1009") =>
    Array.from(
      new Set(
        baseCuentas
          .filter((c: any) => bucketKeyOf(c) === key)
          .map((c: any) => c?.cliente_nombre || "Sin nombre")
      )
    ).length;

  return {
    "1003": { total: sumBucket("1003"), pendientes: countPend("1003"), clientes: countClientes("1003") },
    "1009": { total: sumBucket("1009"), pendientes: countPend("1009"), clientes: countClientes("1009") },
  };
}, [baseCuentas]);

// ===============================
// ✅ FILTROS (SOLO afectan listado, NO highlights)
// (sin filtro de Cliente)
// ===============================
const filteredCuentas = useMemo(() => {
  let cuentas = baseCuentas;

  // búsqueda
  const s = (searchTerm || "").toLowerCase().trim();
  if (s) {
    cuentas = cuentas.filter((c: any) => {
      return (
        String(c?.cliente_nombre || "").toLowerCase().includes(s) ||
        String(c?.descripcion || "").toLowerCase().includes(s) ||
        String(c?.cliente_telefono || "").toLowerCase().includes(s) ||
        String(c?.cliente_email || "").toLowerCase().includes(s) ||
        String(c?.cliente_rfc || "").toLowerCase().includes(s)
      );
    });
  }

  // estado
  if (filtroEstado !== "todos") {
    const hoy = new Date();
    cuentas = cuentas.filter((c: any) => {
      const pendiente = Number(c?.monto_pendiente) || 0;
      const fv = c?.fecha_vencimiento ? safeDate(c.fecha_vencimiento) : null;

      if (filtroEstado === "vencida") return !!fv && fv.getTime() < hoy.getTime() && pendiente > 0;
      if (filtroEstado === "porVencer") return !!fv && fv.getTime() >= hoy.getTime() && pendiente > 0;
      if (filtroEstado === "sinVencimiento") return !fv && pendiente > 0;
      if (filtroEstado === "cobrado") return pendiente === 0;
      return true;
    });
  }

  // orden
  if (ordenMonto === "menorMayor") {
    cuentas = [...cuentas].sort((a: any, b: any) => (Number(a?.monto_pendiente) || 0) - (Number(b?.monto_pendiente) || 0));
  } else if (ordenMonto === "mayorMenor") {
    cuentas = [...cuentas].sort((a: any, b: any) => (Number(b?.monto_pendiente) || 0) - (Number(a?.monto_pendiente) || 0));
  }

  return cuentas;
}, [baseCuentas, searchTerm, filtroEstado, ordenMonto]);

// bucket aplicado al listado
const filteredCuentasBucket = useMemo(() => {
  if (!bucket) return filteredCuentas;
  return filteredCuentas.filter((c: any) => bucketKeyOf(c) === bucket);
}, [bucket, filteredCuentas]);


  const openPagoDialog = (cuenta: any) => {
    setSelectedCuenta(cuenta);
    setMontoPago("");
    setMetodoPago("");
    setPagoDialogOpen(true);
  };

  const resetPagoForm = () => {
    setSelectedCuenta(null);
    setMontoPago("");
    setMetodoPago("");
  };

  const handleRegistrarPago = () => {
    if (!selectedCuenta || !montoPago || !metodoPago) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    const monto = parseFloat(montoPago);
    if (isNaN(monto) || monto <= 0) {
      toast.error("El monto debe ser un número válido mayor a 0");
      return;
    }

    if (monto > (selectedCuenta.monto_pendiente || 0)) {
      toast.error("El monto no puede ser mayor al monto pendiente");
      return;
    }

    const tipoRegistro = selectedCuenta.tipo_ingreso === 'venta_activo' ? 'venta_activo' : 'ingreso';

    registrarPagoMutation.mutate({
      cuentaId: selectedCuenta.id,
      monto,
      metodo: metodoPago,
      tipoRegistro
    });
  };

  const getEstadoBadge = (fechaVencimiento: string | null, montoPendiente: number) => {
    if (montoPendiente === 0) return <Badge variant="secondary">Cobrado</Badge>;
    if (!fechaVencimiento) return <Badge variant="outline">Sin vencimiento</Badge>;

    const fechaVence = safeDate(fechaVencimiento);
    if (!fechaVence) return <Badge variant="outline">Sin fecha válida</Badge>;

    const hoy = new Date();
    if (fechaVence < hoy) return <Badge variant="destructive">Vencida</Badge>;
    return <Badge variant="default">Por vencer</Badge>;
  };

  const cuentasAgrupadasPorCliente = (() => {
    const grupos = new Map<string, {
      cliente: string;
      facturas: any[];
      totalPendiente: number;
      totalOriginal: number;
      totalPagado: number;
      contacto: {
        telefono?: string;
        email?: string;
        rfc?: string;
      };
    }>();

        filteredCuentasBucket.forEach((cuenta: any) => {
      const clienteKey = cuenta.cliente_nombre || "Sin cliente asignado";

      if (!grupos.has(clienteKey)) {
        grupos.set(clienteKey, {
          cliente: clienteKey,
          facturas: [],
          totalPendiente: 0,
          totalOriginal: 0,
          totalPagado: 0,
          contacto: {
            telefono: (cuenta as any).cliente_telefono,
            email: (cuenta as any).cliente_email,
            rfc: (cuenta as any).cliente_rfc,
          }
        });
      }

      const grupo = grupos.get(clienteKey)!;
      grupo.facturas.push(cuenta);
      grupo.totalPendiente += cuenta.monto_pendiente || 0;
      grupo.totalOriginal += cuenta.monto_total || 0;
      grupo.totalPagado += cuenta.monto_pagado || 0;
    });

    return Array.from(grupos.values());
  })();

  const toggleClienteExpansion = (cliente: string) => {
    const newExpanded = new Set(expandedClientes);
    if (newExpanded.has(cliente)) newExpanded.delete(cliente);
    else newExpanded.add(cliente);
    setExpandedClientes(newExpanded);
  };

  const openHistorialPagos = (facturaId: string) => {
    setSelectedFacturaId(facturaId);
    setHistorialPagosOpen(true);
  };

  if (loadingDetalles) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Cargando cuentas por cobrar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cuentas por Cobrar</h1>
            <p className="text-muted-foreground">
              Gestiona y da seguimiento a las cuentas pendientes de cobro
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Lista de Cuentas
            </TabsTrigger>
            <TabsTrigger value="transacciones" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Resumen de Transacciones
            </TabsTrigger>
            <TabsTrigger value="analiticas" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analíticas
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Lista de Cuentas */}
<TabsContent value="lista" className="space-y-6">
  {/* Métricas Resumen (NO cambian con filtros) */}
  <div className="grid gap-4 md:grid-cols-4">
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">Total por Cobrar</CardTitle>
      <DollarSign className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{formatCurrency(highlights.totalPorCobrar)}</div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">Cuentas Vencidas</CardTitle>
      <AlertCircle className="h-4 w-4 text-destructive" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-destructive">{highlights.vencidas}</div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">Por Vencer</CardTitle>
      <Calendar className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{highlights.porVencer}</div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">Total Cuentas</CardTitle>
      <User className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{highlights.totalCuentas}</div>
    </CardContent>
  </Card>
</div>

  {/* ✅ MENÚ premium 1003 / 1009 (solo cuando bucket === null) */}
{bucket === null && (
  <div className="grid gap-4 md:grid-cols-2">
    {/* 1003 */}
    <Card
      onClick={() => {
        setExpandedClientes(new Set());
        setBucket("1003");
      }}
      className={[
        // ✅ FIX SCROLL: relative + overflow-hidden contiene los fondos absolute
        "relative overflow-hidden group cursor-pointer",
        "border border-[#0b3a5a]/25",
        "bg-gradient-to-br from-[#0b3a5a] via-[#072c44] to-[#051b2c]",
        "text-white shadow-sm transition-all",
        "hover:-translate-y-[1px] hover:shadow-lg",
      ].join(" ")}
    >
      {/* brillo / glow (contenido) */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-cyan-200/10 blur-3xl" />
      </div>

      <CardHeader className="relative flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg text-white">
            1003 - Cuentas por Cobrar Clientes
          </CardTitle>
          <CardDescription className="text-white/70">
            Facturas pendientes de clientes
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-white/70" />
          <span className="text-xs text-white/70 group-hover:text-white transition-colors">
            Ver detalle →
          </span>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-2">
        <div className="text-3xl font-bold">
          {formatCurrency(menuTotals["1003"].total)}
        </div>

        <div className="text-sm text-white/75">
          Facturas pendientes:{" "}
          <span className="font-semibold text-white">
            {menuTotals["1003"].pendientes}
          </span>
        </div>

        <div className="text-sm text-white/75">
          Clientes:{" "}
          <span className="font-semibold text-white">
            {menuTotals["1003"].clientes}
          </span>
        </div>

        <div className="mt-3 h-px bg-white/10" />
        <div className="text-xs text-white/60">
          Haz click para ver el listado y registrar pagos
        </div>
      </CardContent>
    </Card>

    {/* 1009 */}
    <Card
      onClick={() => {
        setExpandedClientes(new Set());
        setBucket("1009");
      }}
      className={[
        // ✅ FIX SCROLL: relative + overflow-hidden contiene los fondos absolute
        "relative overflow-hidden group cursor-pointer",
        "border border-[#0a5560]/25",
        "bg-gradient-to-br from-[#0a5560] via-[#08424b] to-[#052a2f]",
        "text-white shadow-sm transition-all",
        "hover:-translate-y-[1px] hover:shadow-lg",
      ].join(" ")}
    >
      {/* brillo / glow (contenido) */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-emerald-200/10 blur-3xl" />
      </div>

      <CardHeader className="relative flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg text-white">
            1009 - Deudores Diversos
          </CardTitle>
          <CardDescription className="text-white/70">
            Pendientes de “Otros ingresos” (4102)
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-white/70" />
          <span className="text-xs text-white/70 group-hover:text-white transition-colors">
            Ver detalle →
          </span>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-2">
        <div className="text-3xl font-bold">
          {formatCurrency(menuTotals["1009"].total)}
        </div>

        <div className="text-sm text-white/75">
          Registros pendientes:{" "}
          <span className="font-semibold text-white">
            {menuTotals["1009"].pendientes}
          </span>
        </div>

        <div className="text-sm text-white/75">
          Deudores:{" "}
          <span className="font-semibold text-white">
            {menuTotals["1009"].clientes}
          </span>
        </div>

        <div className="mt-3 h-px bg-white/10" />
        <div className="text-xs text-white/60">
          Haz click para ver el listado y registrar pagos
        </div>
      </CardContent>
    </Card>
  </div>
)}

  {/* ✅ Breadcrumb / regreso cuando ya estás dentro del bucket + HERO con estilo del bucket */}
{bucket !== null && (() => {
  const is1003 = bucket === "1003";

  const shellClass = is1003
    ? "relative overflow-hidden rounded-xl border border-[#0b3a5a]/25 bg-gradient-to-br from-[#0b3a5a] via-[#072c44] to-[#051b2c] text-white shadow-sm"
    : "relative overflow-hidden rounded-xl border border-[#0a5560]/25 bg-gradient-to-br from-[#0a5560] via-[#08424b] to-[#052a2f] text-white shadow-sm";

  const glowA = is1003 ? "bg-white/10" : "bg-white/10";
  const glowB = is1003 ? "bg-cyan-200/10" : "bg-emerald-200/10";

  const title = is1003
    ? "1003 - Cuentas por Cobrar Clientes"
    : "1009 - Deudores Diversos";

  const subtitle = is1003
    ? "Facturas pendientes de clientes"
    : "Pendientes de “Otros ingresos” (4102)";

  const metrics = menuTotals[bucket];

  return (
    <div className={shellClass}>
      {/* glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className={`absolute -right-16 -top-16 h-56 w-56 rounded-full ${glowA} blur-3xl`} />
        <div className={`absolute -left-16 -bottom-16 h-56 w-56 rounded-full ${glowB} blur-3xl`} />
      </div>

      <div className="relative p-5 md:p-6">
        {/* top row */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setExpandedClientes(new Set());
                  setBucket(null);
                }}
                className="border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              >
                ← Regresar al menú
              </Button>

              <div className="text-sm text-white/70">
                / <span className="font-semibold text-white">{title}</span>
              </div>
            </div>

            <div className="pt-1">
              <h2 className="text-xl md:text-2xl font-semibold leading-tight">{title}</h2>
              <p className="text-sm text-white/70">{subtitle}</p>
            </div>
          </div>

          {/* big number */}
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
            <div className="text-xs text-white/70">Total pendiente</div>
            <div className="text-2xl md:text-3xl font-bold">
              {formatCurrency(metrics?.total || 0)}
            </div>
          </div>
        </div>

        {/* mini stats */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/15 bg-white/10 p-3">
            <div className="text-xs text-white/70">
              {is1003 ? "Facturas pendientes" : "Registros pendientes"}
            </div>
            <div className="text-lg font-semibold">{metrics?.pendientes || 0}</div>
          </div>

          <div className="rounded-lg border border-white/15 bg-white/10 p-3">
            <div className="text-xs text-white/70">
              {is1003 ? "Clientes" : "Deudores"}
            </div>
            <div className="text-lg font-semibold">{metrics?.clientes || 0}</div>
          </div>

          <div className="rounded-lg border border-white/15 bg-white/10 p-3">
            <div className="text-xs text-white/70">Tip</div>
            <div className="text-sm text-white/85">
              Usa búsqueda + estado para encontrar rápido.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
})()}

{/* ✅ SOLO cuando estás dentro del bucket: filtros PRO + tabla */}
{bucket !== null && (
  <>
    {/* Filtros (PRO, sin Cliente dropdown) */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Filtrar Cuentas
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          {/* Buscar */}
          <div className="w-full md:max-w-md">
            <Label htmlFor="busqueda-general" className="mb-2 block text-sm">
              Búsqueda
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="busqueda-general"
                className="pl-9"
                placeholder="Cliente, descripción, teléfono, email o RFC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Estado */}
          <div className="w-full md:w-56">
            <Label htmlFor="filtro-estado" className="mb-2 block text-sm">
              Estado
            </Label>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger id="filtro-estado" className="bg-background">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
                <SelectItem value="porVencer">Por vencer</SelectItem>
                <SelectItem value="sinVencimiento">Sin vencimiento</SelectItem>
                <SelectItem value="cobrado">Cobrado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Orden */}
          <div className="w-full md:w-64">
            <Label htmlFor="orden-monto" className="mb-2 block text-sm">
              Orden
            </Label>
            <Select value={ordenMonto} onValueChange={setOrdenMonto}>
              <SelectTrigger id="orden-monto" className="bg-background">
                <SelectValue placeholder="Sin ordenar" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="ninguno">Por fecha</SelectItem>
                <SelectItem value="menorMayor">Menor a Mayor (pendiente)</SelectItem>
                <SelectItem value="mayorMenor">Mayor a Menor (pendiente)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Limpiar */}
          <div className="w-full md:w-auto md:pl-2">
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setFiltroEstado("todos");
                setOrdenMonto("ninguno");
              }}
              className="w-full md:w-auto"
            >
              Limpiar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Tabla de Cuentas por Cobrar */}
    <Card>
      <CardHeader>
        <CardTitle>Listado de Cuentas por Cobrar</CardTitle>
      </CardHeader>

      <CardContent>
        {cuentasAgrupadasPorCliente.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No se encontraron cuentas por cobrar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Información de Contacto</TableHead>
                  <TableHead>Total Pendiente</TableHead>
                  <TableHead>Facturas</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {cuentasAgrupadasPorCliente.map((grupo) => (
                  <>
                    <TableRow
                      key={`cliente-${grupo.cliente}`}
                      className="bg-muted/50 hover:bg-muted cursor-pointer font-medium"
                      onClick={() => toggleClienteExpansion(grupo.cliente)}
                    >
                      <TableCell>
                        {expandedClientes.has(grupo.cliente) ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </TableCell>

                      <TableCell className="font-semibold">{grupo.cliente}</TableCell>

                      <TableCell className="min-w-[200px]">
                        <div className="space-y-1">
                          {grupo.contacto.telefono && (
                            <div className="text-sm">📞 {grupo.contacto.telefono}</div>
                          )}
                          {grupo.contacto.email && (
                            <div className="text-sm">📧 {grupo.contacto.email}</div>
                          )}
                          {grupo.contacto.rfc && (
                            <div className="text-sm">🆔 {grupo.contacto.rfc}</div>
                          )}
                          {!grupo.contacto.telefono &&
                            !grupo.contacto.email &&
                            !grupo.contacto.rfc && (
                              <span className="text-muted-foreground text-sm">
                                Sin información de contacto
                              </span>
                            )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-lg font-bold text-primary">
                            {formatCurrency(grupo.totalPendiente)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Total: {formatCurrency(grupo.totalOriginal)}
                          </div>
                          {grupo.totalPagado > 0 && (
                            <div className="text-sm text-success">
                              Pagado: {formatCurrency(grupo.totalPagado)}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">
                          {grupo.facturas.length}{" "}
                          {grupo.facturas.length === 1 ? "factura" : "facturas"}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {expandedClientes.has(grupo.cliente) &&
                      grupo.facturas.map((cuenta) => (
                        <TableRow key={cuenta.id} className="bg-background">
                          <TableCell></TableCell>
                          <TableCell colSpan={5}>
                            <div className="pl-4 border-l-2 border-primary/30 ml-4">
                              <div className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-3">
                                  <div className="font-medium">{cuenta.descripcion}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {safeFormatDate(cuenta.created_at, "dd/MM/yyyy", { locale: es })}
                                  </div>
                                </div>

                                <div className="col-span-3">
                                  <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Total:</span>
                                      <span className="font-medium">
                                        {formatCurrency(cuenta.monto_total)}
                                      </span>
                                    </div>

                                    {cuenta.monto_descuento && cuenta.monto_descuento > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Descuento:</span>
                                        <span className="text-destructive">
                                          -{formatCurrency(cuenta.monto_descuento)}
                                        </span>
                                      </div>
                                    )}

                                    {cuenta.monto_pagado > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Pagado:</span>
                                        <span className="text-success">
                                          {formatCurrency(cuenta.monto_pagado)}
                                        </span>
                                      </div>
                                    )}

                                    <div className="flex justify-between border-t pt-1">
                                      <span className="font-medium">Pendiente:</span>
                                      <span className="font-bold text-primary">
                                        {formatCurrency(cuenta.monto_pendiente || 0)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="col-span-2">
                                  <div className="space-y-1">
                                    <Badge
                                      variant={
                                        cuenta.tipo_pago === "contado"
                                          ? "default"
                                          : cuenta.tipo_pago === "parcial"
                                            ? "secondary"
                                            : "outline"
                                      }
                                    >
                                      {cuenta.tipo_pago === "contado"
                                        ? "Contado"
                                        : cuenta.tipo_pago === "parcial"
                                          ? "Parcial"
                                          : "Crédito"}
                                    </Badge>

                                    {cuenta.metodo_pago && (
                                      <div className="text-xs text-muted-foreground">
                                        {cuenta.metodo_pago === "efectivo" ? "Efectivo" : "Tarjeta/Banco"}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="col-span-2">
                                  {cuenta.fecha_vencimiento ? (
                                    <div className="space-y-1">
                                      <div className="text-sm font-medium">
                                        {safeFormatDate(cuenta.fecha_vencimiento, "dd/MM/yyyy", { locale: es })}
                                      </div>

                                      <div className="text-xs">
                                        {(() => {
                                          const today = new Date();
                                          const dueDate = safeDate(cuenta.fecha_vencimiento);
                                          if (!dueDate) {
                                            return <span className="text-muted-foreground">Fecha inválida</span>;
                                          }

                                          const diffTime = dueDate.getTime() - today.getTime();
                                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                          if (diffDays < 0) {
                                            return (
                                              <span className="text-destructive font-medium">
                                                Vencida hace {Math.abs(diffDays)} día(s)
                                              </span>
                                            );
                                          }
                                          if (diffDays === 0) {
                                            return <span className="text-warning font-medium">Vence hoy</span>;
                                          }
                                          if (diffDays <= 7) {
                                            return (
                                              <span className="text-warning font-medium">
                                                Vence en {diffDays} día(s)
                                              </span>
                                            );
                                          }
                                          return (
                                            <span className="text-muted-foreground">
                                              Vence en {diffDays} día(s)
                                            </span>
                                          );
                                        })()}
                                      </div>

                                      {getEstadoBadge(cuenta.fecha_vencimiento, cuenta.monto_pendiente || 0)}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">Sin fecha límite</span>
                                  )}
                                </div>

                                <div className="col-span-2 flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openHistorialPagos(cuenta.id)}
                                    title="Ver historial de pagos"
                                  >
                                    <History className="w-4 h-4" />
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => openPagoDialog(cuenta)}
                                    disabled={cuenta.monto_pendiente <= 0}
                                  >
                                    Pagar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  </>
)}
</TabsContent>

          {/* Tab 2: Resumen de Transacciones */}
          <TabsContent value="transacciones" className="space-y-6">
            {loadingTransacciones ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Cargando transacciones...</div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Transacciones</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{todasTransacciones?.length || 0}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Completamente Pagadas</CardTitle>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-success">
                        {todasTransacciones?.filter((t: any) => t.monto_pendiente === 0).length || 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pagos Parciales</CardTitle>
                      <Clock className="h-4 w-4 text-warning" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-warning">
                        {todasTransacciones?.filter((t: any) => t.monto_pendiente > 0 && t.monto_pagado > 0).length || 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Sin Pagar</CardTitle>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">
                        {todasTransacciones?.filter((t: any) => t.monto_pagado === 0 && t.monto_pendiente > 0).length || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Historial Completo de Transacciones
                    </CardTitle>
                    <CardDescription>
                      Trazabilidad de todas las transacciones de ingresos, desde su creación hasta su liquidación
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <Label htmlFor="filtro-mes-transaccion" className="mb-2 block">Mes</Label>
                        <Select value={filtroMesTransaccion} onValueChange={setFiltroMesTransaccion}>
                          <SelectTrigger id="filtro-mes-transaccion" className="bg-background">
                            <SelectValue placeholder="Todos los meses" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="todos">Todos los meses</SelectItem>
                            <SelectItem value="1">Enero</SelectItem>
                            <SelectItem value="2">Febrero</SelectItem>
                            <SelectItem value="3">Marzo</SelectItem>
                            <SelectItem value="4">Abril</SelectItem>
                            <SelectItem value="5">Mayo</SelectItem>
                            <SelectItem value="6">Junio</SelectItem>
                            <SelectItem value="7">Julio</SelectItem>
                            <SelectItem value="8">Agosto</SelectItem>
                            <SelectItem value="9">Septiembre</SelectItem>
                            <SelectItem value="10">Octubre</SelectItem>
                            <SelectItem value="11">Noviembre</SelectItem>
                            <SelectItem value="12">Diciembre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="filtro-ano-transaccion" className="mb-2 block">Año</Label>
                        <Select value={filtroAnoTransaccion} onValueChange={setFiltroAnoTransaccion}>
                          <SelectTrigger id="filtro-ano-transaccion" className="bg-background">
                            <SelectValue placeholder="Todos los años" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="todos">Todos los años</SelectItem>
                            {Array.from(new Set((todasTransacciones || [])
                              .map((t: any) => safeDate(t.created_at)?.getFullYear())
                              .filter((y: any) => typeof y === "number")))
                              .sort((a: any, b: any) => b - a)
                              .map((year: any) => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="filtro-cliente-transaccion" className="mb-2 block">Cliente</Label>
                        <Select value={filtroClienteTransaccion} onValueChange={setFiltroClienteTransaccion}>
                          <SelectTrigger id="filtro-cliente-transaccion" className="bg-background">
                            <SelectValue placeholder="Todos los clientes" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="todos">Todos los clientes</SelectItem>
                            {Array.from(new Set((todasTransacciones || [])
                              .map((t: any) => t.cliente_nombre)
                              .filter(Boolean)))
                              .sort()
                              .map((cliente: any) => (
                                <SelectItem key={cliente} value={cliente!}>
                                  {cliente}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="filtro-tipo-ingreso" className="mb-2 block">Tipo de Ingreso</Label>
                        <Select value={filtroTipoIngreso} onValueChange={setFiltroTipoIngreso}>
                          <SelectTrigger id="filtro-tipo-ingreso" className="bg-background">
                            <SelectValue placeholder="Todos los tipos" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="todos">Todos los tipos</SelectItem>
                            {Array.from(new Set((todasTransacciones || []).map((t: any) => t.tipo_ingreso)))
                              .sort()
                              .map((tipo: any) => (
                                <SelectItem key={tipo} value={tipo}>
                                  {tipo}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="filtro-estado-transaccion" className="mb-2 block">Estado</Label>
                        <Select value={filtroEstadoTransaccion} onValueChange={setFiltroEstadoTransaccion}>
                          <SelectTrigger id="filtro-estado-transaccion" className="bg-background">
                            <SelectValue placeholder="Todos los estados" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="todos">Todos los estados</SelectItem>
                            <SelectItem value="completado">Completado</SelectItem>
                            <SelectItem value="enProgreso">En Progreso</SelectItem>
                            <SelectItem value="sinPagar">Sin Pagar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="filtro-metodo-pago" className="mb-2 block">Método de Pago</Label>
                        <Select value={filtroMetodoPago} onValueChange={setFiltroMetodoPago}>
                          <SelectTrigger id="filtro-metodo-pago" className="bg-background">
                            <SelectValue placeholder="Todos los métodos" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="todos">Todos los métodos</SelectItem>
                            {Array.from(new Set((todasTransacciones || [])
                              .map((t: any) => t.metodo_pago)
                              .filter(Boolean)))
                              .sort()
                              .map((metodo: any) => (
                                <SelectItem key={metodo} value={metodo!}>
                                  {metodo}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="orden-monto-transaccion" className="mb-2 block">Ordenar por Monto</Label>
                        <Select value={ordenMontoTransaccion} onValueChange={setOrdenMontoTransaccion}>
                          <SelectTrigger id="orden-monto-transaccion" className="bg-background">
                            <SelectValue placeholder="Sin ordenar" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="ninguno">Sin ordenar (Por fecha)</SelectItem>
                            <SelectItem value="menorMayor">Menor a Mayor</SelectItem>
                            <SelectItem value="mayorMenor">Mayor a Menor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setFiltroMesTransaccion("todos");
                            setFiltroAnoTransaccion("todos");
                            setFiltroEstadoTransaccion("todos");
                            setFiltroMetodoPago("todos");
                            setFiltroTipoIngreso("todos");
                            setFiltroClienteTransaccion("todos");
                            setOrdenMontoTransaccion("ninguno");
                          }}
                          className="w-full"
                        >
                          Limpiar Filtros
                        </Button>
                      </div>
                    </div>

                    {(() => {
                      let transaccionesFiltradas = todasTransacciones || [];

                      if (filtroMesTransaccion !== "todos") {
                        transaccionesFiltradas = transaccionesFiltradas.filter((t: any) => {
                          const d = safeDate(t.created_at);
                          if (!d) return false;
                          const mes = d.getMonth() + 1;
                          return mes === parseInt(filtroMesTransaccion);
                        });
                      }

                      if (filtroAnoTransaccion !== "todos") {
                        transaccionesFiltradas = transaccionesFiltradas.filter((t: any) => {
                          const d = safeDate(t.created_at);
                          if (!d) return false;
                          const ano = d.getFullYear();
                          return ano === parseInt(filtroAnoTransaccion);
                        });
                      }

                      if (filtroClienteTransaccion !== "todos") {
                        transaccionesFiltradas = transaccionesFiltradas.filter((t: any) =>
                          t.cliente_nombre === filtroClienteTransaccion
                        );
                      }

                      if (filtroTipoIngreso !== "todos") {
                        transaccionesFiltradas = transaccionesFiltradas.filter((t: any) =>
                          t.tipo_ingreso === filtroTipoIngreso
                        );
                      }

                      if (filtroEstadoTransaccion !== "todos") {
                        transaccionesFiltradas = transaccionesFiltradas.filter((t: any) => {
                          if (filtroEstadoTransaccion === "completado") return t.monto_pendiente === 0;
                          if (filtroEstadoTransaccion === "enProgreso") return t.monto_pendiente > 0 && t.monto_pagado > 0;
                          if (filtroEstadoTransaccion === "sinPagar") return t.monto_pagado === 0 && t.monto_pendiente > 0;
                          return true;
                        });
                      }

                      if (filtroMetodoPago !== "todos") {
                        transaccionesFiltradas = transaccionesFiltradas.filter((t: any) =>
                          t.metodo_pago === filtroMetodoPago
                        );
                      }

                      if (ordenMontoTransaccion === "menorMayor") {
                        transaccionesFiltradas = [...transaccionesFiltradas].sort((a: any, b: any) =>
                          (a.monto_neto || 0) - (b.monto_neto || 0)
                        );
                      } else if (ordenMontoTransaccion === "mayorMenor") {
                        transaccionesFiltradas = [...transaccionesFiltradas].sort((a: any, b: any) =>
                          (b.monto_neto || 0) - (a.monto_neto || 0)
                        );
                      }

                      return !transaccionesFiltradas || transaccionesFiltradas.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">
                            {todasTransacciones && todasTransacciones.length > 0
                              ? "No se encontraron transacciones con los filtros seleccionados."
                              : "No hay transacciones registradas."}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Fecha Creación</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Tipo Ingreso</TableHead>
                                <TableHead className="text-right">Monto Total</TableHead>
                                <TableHead className="text-right">Descuento</TableHead>
                                <TableHead className="text-right">Monto Neto</TableHead>
                                <TableHead className="text-right">Pagado</TableHead>
                                <TableHead className="text-right">Pendiente</TableHead>
                                <TableHead>Tipo Pago</TableHead>
                                <TableHead>Método Pago</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Progreso</TableHead>
                                <TableHead className="text-center">Detalle Contable</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {transaccionesFiltradas.map((transaccion: any) => {
                                const porcentajePagado = transaccion.monto_neto > 0
                                  ? (transaccion.monto_pagado / transaccion.monto_neto) * 100
                                  : 0;

                                return (
                                  <TableRow key={transaccion.id}>
                                    <TableCell className="font-medium">
                                      {safeFormatDate(transaccion.created_at, "dd MMM yyyy HH:mm", { locale: es })}
                                    </TableCell>
                                    <TableCell>{transaccion.cliente_nombre || "Sin especificar"}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">
                                      {transaccion.descripcion}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="capitalize">
                                        {transaccion.tipo_ingreso}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {formatCurrency(transaccion.monto_total)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {transaccion.monto_descuento > 0 ? (
                                        <span className="text-destructive">
                                          -{formatCurrency(transaccion.monto_descuento)}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      {formatCurrency(transaccion.monto_neto)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <span className="text-success font-semibold">
                                        {formatCurrency(transaccion.monto_pagado)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {transaccion.monto_pendiente > 0 ? (
                                        <span className="text-destructive font-semibold">
                                          {formatCurrency(transaccion.monto_pendiente)}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">$0</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {transaccion.tipo_pago === 'contado' ? (
                                        <Badge variant="secondary">Contado</Badge>
                                      ) : transaccion.tipo_pago === 'credito' ? (
                                        <Badge variant="outline">Crédito</Badge>
                                      ) : (
                                        <Badge className="bg-amber-500">Parcial</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="capitalize">
                                      {transaccion.metodo_pago || "-"}
                                    </TableCell>
                                    <TableCell>
                                      {transaccion.monto_pendiente === 0 ? (
                                        <Badge className="bg-success">Completado</Badge>
                                      ) : transaccion.monto_pagado > 0 ? (
                                        <Badge className="bg-warning">En Progreso</Badge>
                                      ) : (
                                        <Badge variant="destructive">Sin Pagar</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="min-w-[150px]">
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                          <span>{porcentajePagado.toFixed(0)}%</span>
                                          <span className="text-muted-foreground">
                                            {transaccion.monto_pagado > 0 && transaccion.monto_pendiente > 0
                                              ? 'Parcial'
                                              : transaccion.monto_pendiente === 0
                                                ? 'Completo'
                                                : 'Sin pago'}
                                          </span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2">
                                          <div
                                            className={`h-2 rounded-full transition-all ${porcentajePagado === 100
                                              ? 'bg-success'
                                              : porcentajePagado > 0
                                                ? 'bg-warning'
                                                : 'bg-destructive'
                                              }`}
                                            style={{ width: `${porcentajePagado}%` }}
                                          />
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedTransaccionId(transaccion.id);
                                          setDetalleContableOpen(true);
                                        }}
                                      >
                                        <Eye className="h-4 w-4 mr-1" />
                                        Ver Detalle
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Tab 3: Analíticas */}
          <TabsContent value="analiticas" className="space-y-6">
            {loadingAnalytics ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Cargando analíticas...</div>
              </div>
            ) : !analytics ? (
              <Card>
                <CardContent className="py-10">
                  <p className="text-center text-muted-foreground">
                    No hay datos disponibles para mostrar analíticas.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Filtro de Cliente para Analíticas */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <Label className="text-sm font-medium whitespace-nowrap">Filtrar por Cliente:</Label>
                      <Select value={filtroClienteAnalitica} onValueChange={setFiltroClienteAnalitica}>
                        <SelectTrigger className="w-[300px]">
                          <SelectValue placeholder="Todos los clientes" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="todos">Todos los clientes</SelectItem>
                          {clientesUnicos.map(cliente => (
                            <SelectItem key={cliente} value={cliente}>
                              {cliente}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* KPIs Principales */}
                <div className="grid gap-4 md:grid-cols-5">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total por Cobrar</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(analytics.totalPendiente)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{analytics.totalClientes}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Promedio por Cliente</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${analytics.promedioDeuda.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Cuentas Vencidas</CardTitle>
                      <Clock className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">
                        {(analytics?.agingAnalysisDetailed || [])
                          .filter((a: any) => a.min >= 1)
                          .reduce((sum: number, a: any) => sum + a.cantidad, 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Formato Números</CardTitle>
                      <Settings className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Escala</Label>
                        <Select value={formatoNumerosAnalitica} onValueChange={(v: 'normal' | 'miles' | 'millones') => setFormatoNumerosAnalitica(v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="miles">Miles (K)</SelectItem>
                            <SelectItem value="millones">Millones (M)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Decimales</Label>
                        <Select value={decimalesAnalitica.toString()} onValueChange={(v) => setDecimalesAnalitica(parseInt(v) as 0 | 1 | 2)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0</SelectItem>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Gráfico A */}
                <Card>
                  <CardHeader>
                    <CardTitle>Análisis de Antigüedad de Cuentas por Cobrar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const maxMontoAntiguedad = Math.max(...(analytics?.agingAnalysisDetailed || []).map((a: any) => a.monto), 1);
                      const dominioYAntiguedad = [0, maxMontoAntiguedad * 1.2];

                      return (
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart data={analytics?.agingAnalysisDetailed || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="rango"
                              stroke="hsl(var(--foreground))"
                              tick={{ fill: 'hsl(var(--foreground))' }}
                              angle={-45}
                              textAnchor="end"
                              height={100}
                            />
                            <YAxis
                              domain={dominioYAntiguedad}
                              stroke="hsl(var(--foreground))"
                              tick={{ fill: 'hsl(var(--foreground))' }}
                              tickFormatter={(value) => formatearConPreferenciasAnalitica(value)}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                              formatter={(value: number) => [formatearConPreferenciasAnalitica(value), 'Monto']}
                              labelFormatter={(label) => `${label}`}
                            />
                            <Bar dataKey="monto" fill={COLORS.primary} radius={[8, 8, 0, 0]}>
                              <LabelList
                                dataKey="monto"
                                position="top"
                                formatter={(value: number) => formatearConPreferenciasAnalitica(value)}
                                style={{ fontSize: '11px', fontWeight: 'bold', fill: 'hsl(var(--foreground))' }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Gráfico B */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Histórico de Cuentas por Cobrar</CardTitle>
                      <Select value={periodoCxC} onValueChange={(value: any) => setPeriodoCxC(value)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Selecciona período" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="mensual">Mensual (Mes actual)</SelectItem>
                          <SelectItem value="anual">Anual (Año actual)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const maxSaldoHistorico = Math.max(...(analytics?.historicoCxC || []).map((h: any) => h.saldo), 1);
                      const dominioYHistorico = [0, maxSaldoHistorico * 1.2];

                      return (
                        <ResponsiveContainer width="100%" height={350}>
                          <LineChart data={analytics?.historicoCxC || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="fecha"
                              stroke="hsl(var(--foreground))"
                              tick={{ fill: 'hsl(var(--foreground))' }}
                            />
                            <YAxis
                              domain={dominioYHistorico}
                              stroke="hsl(var(--foreground))"
                              tick={{ fill: 'hsl(var(--foreground))' }}
                              tickFormatter={(value) => `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                color: 'hsl(var(--foreground))'
                              }}
                              formatter={(value: number) => [
                                `$${value.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                                'Saldo CxC'
                              ]}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="saldo"
                              stroke={COLORS.primary}
                              strokeWidth={3}
                              dot={{ fill: COLORS.primary, r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Gráfico C */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Cuentas por Cobrar por Cliente (Apilado por Antigüedad)</CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Total Deuda:</span>
                        <Badge variant="default" className="text-lg px-3 py-1">
                          {formatearConPreferenciasAnalitica((analytics?.cxcPorClienteApilado || [])
                            .reduce((sum: number, c: any) => sum + c.total, 0))}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Label htmlFor="filtro-antiguedad">Filtrar por antigüedad:</Label>
                      <Select value={filtroAntiguedad} onValueChange={setFiltroAntiguedad}>
                        <SelectTrigger id="filtro-antiguedad" className="w-[240px]">
                          <SelectValue placeholder="Selecciona categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="sinVencimiento">Sin vencimiento</SelectItem>
                          <SelectItem value="vencido1_15">Vencido 1-15 días</SelectItem>
                          <SelectItem value="vencido16_30">Vencido 16-30 días</SelectItem>
                          <SelectItem value="vencido31_60">Vencido 31-60 días</SelectItem>
                          <SelectItem value="vencido61_90">Vencido 61-90 días</SelectItem>
                          <SelectItem value="vencidoMas90">Vencido +90 días</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(() => {
                      const dataFiltradaCliente = filtroAntiguedad === "todos"
                        ? (analytics?.cxcPorClienteApilado || [])
                        : (analytics?.cxcPorClienteApilado || [])
                          .filter((c: any) => (c as any)[filtroAntiguedad] > 0)
                          .sort((a: any, b: any) => ((b as any)[filtroAntiguedad] || 0) - ((a as any)[filtroAntiguedad] || 0));

                      const maxMontoCliente = filtroAntiguedad === "todos"
                        ? Math.max(...dataFiltradaCliente.map((c: any) => c.total), 1)
                        : Math.max(...dataFiltradaCliente.map((c: any) => (c as any)[filtroAntiguedad] || 0), 1);

                      const dominioXCliente = [0, maxMontoCliente * 1.2];

                      return (
                        <ResponsiveContainer
                          width="100%"
                          height={Math.max(400, dataFiltradaCliente.length * 40)}
                        >
                          <BarChart
                            data={dataFiltradaCliente}
                            layout="vertical"
                            margin={{ left: 100, right: 80 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              type="number"
                              domain={dominioXCliente}
                              stroke="hsl(var(--foreground))"
                              tick={{ fill: 'hsl(var(--foreground))' }}
                              tickFormatter={(value) => formatearConPreferenciasAnalitica(value)}
                            />
                            <YAxis
                              type="category"
                              dataKey="cliente"
                              stroke="hsl(var(--foreground))"
                              tick={{ fill: 'hsl(var(--foreground))' }}
                              width={90}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                padding: '12px'
                              }}
                            />

                            {(() => {
                              const barConfig: any = {
                                sinVencimiento: { fill: "hsl(var(--chart-1))", name: "Sin vencimiento" },
                                vencido1_15: { fill: "hsl(var(--chart-2))", name: "Vencido 1-15 días" },
                                vencido16_30: { fill: "hsl(var(--chart-3))", name: "Vencido 16-30 días" },
                                vencido31_60: { fill: "hsl(var(--warning))", name: "Vencido 31-60 días" },
                                vencido61_90: { fill: "hsl(222 47% 55%)", name: "Vencido 61-90 días" },
                                vencidoMas90: { fill: "hsl(var(--destructive))", name: "Vencido +90 días" }
                              };

                              return filtroAntiguedad === "todos" ? (
                                <>
                                  <Bar dataKey="sinVencimiento" stackId="a" fill={barConfig.sinVencimiento.fill} name={barConfig.sinVencimiento.name} />
                                  <Bar dataKey="vencido1_15" stackId="a" fill={barConfig.vencido1_15.fill} name={barConfig.vencido1_15.name} />
                                  <Bar dataKey="vencido16_30" stackId="a" fill={barConfig.vencido16_30.fill} name={barConfig.vencido16_30.name} />
                                  <Bar dataKey="vencido31_60" stackId="a" fill={barConfig.vencido31_60.fill} name={barConfig.vencido31_60.name} />
                                  <Bar dataKey="vencido61_90" stackId="a" fill={barConfig.vencido61_90.fill} name={barConfig.vencido61_90.name} />
                                  <Bar dataKey="vencidoMas90" stackId="a" fill={barConfig.vencidoMas90.fill} name={barConfig.vencidoMas90.name}>
                                    <LabelList
                                      position="right"
                                      content={(props) => (
                                        <CustomTotalLabel
                                          {...props}
                                          filtroAntiguedad={filtroAntiguedad}
                                          dataFiltradaCliente={dataFiltradaCliente}
                                          formatearConPreferenciasAnalitica={formatearConPreferenciasAnalitica}
                                        />
                                      )}
                                    />
                                  </Bar>
                                </>
                              ) : (
                                <Bar
                                  dataKey={filtroAntiguedad}
                                  fill={barConfig[filtroAntiguedad]?.fill || COLORS.primary}
                                  name={barConfig[filtroAntiguedad]?.name || filtroAntiguedad}
                                >
                                  <LabelList
                                    position="right"
                                    content={(props) => (
                                      <CustomTotalLabel
                                        {...props}
                                        filtroAntiguedad={filtroAntiguedad}
                                        dataFiltradaCliente={dataFiltradaCliente}
                                        formatearConPreferenciasAnalitica={formatearConPreferenciasAnalitica}
                                      />
                                    )}
                                  />
                                </Bar>
                              );
                            })()}
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Gráfico D */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Vencimientos por Cliente</CardTitle>
                      <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                        <SelectTrigger className="w-[300px]">
                          <SelectValue placeholder="Selecciona un cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {(analytics?.cxcPorClienteApilado || []).map((cliente: any) => (
                            <SelectItem key={cliente.cliente} value={cliente.cliente}>
                              {cliente.cliente} - {formatCurrency(cliente.total)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedCliente ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart
                          data={(() => {
                            const clienteData = (analytics?.cxcPorClienteApilado || []).find(
                              (c: any) => c.cliente === selectedCliente
                            );
                            if (!clienteData) return [];

                            return [
                              { rango: 'Sin vencimiento', monto: clienteData.sinVencimiento || 0 },
                              { rango: 'Vencido 1-15 días', monto: clienteData.vencido1_15 || 0 },
                              { rango: 'Vencido 16-30 días', monto: clienteData.vencido16_30 || 0 },
                              { rango: 'Vencido 31-60 días', monto: clienteData.vencido31_60 || 0 },
                              { rango: 'Vencido 61-90 días', monto: clienteData.vencido61_90 || 0 },
                              { rango: 'Vencido +90 días', monto: clienteData.vencidoMas90 || 0 }
                            ];
                          })()}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="rango"
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                            angle={-45}
                            textAnchor="end"
                            height={100}
                          />
                          <YAxis
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                            formatter={(value: number) => [formatCurrency(value), 'Monto']}
                            labelFormatter={(label) => `${label}`}
                          />
                          <Bar
                            dataKey="monto"
                            fill={COLORS.primary}
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[350px]">
                        <div className="text-center space-y-2">
                          <User className="h-12 w-12 mx-auto text-muted-foreground" />
                          <p className="text-muted-foreground">
                            Selecciona un cliente para ver el desglose de sus vencimientos
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog para ver detalle contable */}
      <Dialog open={detalleContableOpen} onOpenChange={setDetalleContableOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalle Contable - Asiento Generado
            </DialogTitle>
            <DialogDescription>
              Consulta las cuentas afectadas en la balanza de comprobación
            </DialogDescription>
          </DialogHeader>

          {loadingAsientos ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Cargando detalle contable...</div>
            </div>
          ) : !asientosContables ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No se encontró asiento contable para esta transacción.</p>
              <p className="text-sm text-muted-foreground mt-2">
                El asiento puede no haberse generado automáticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información del Asiento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Número de Asiento</Label>
                      <p className="font-mono font-semibold">{asientosContables.numero_asiento}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Fecha</Label>
                      <p className="font-medium">
                        {safeFormatDate(asientosContables.fecha, "dd 'de' MMMM, yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Descripción</Label>
                    <p className="font-medium">{asientosContables.descripcion}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Movimientos Contables (Debe y Haber)</CardTitle>
                  <CardDescription>
                    Cuentas afectadas en la balanza de comprobación
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Subcuenta</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Debe</TableHead>
                        <TableHead className="text-right">Haber</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {asientosContables.detalle_asientos?.map((detalle: any, idx: number) => (
                        <TableRow key={detalle.id ?? `${detalle.cuenta_codigo}-${idx}`}>
                          <TableCell>
                            <div>
                              <p className="font-mono text-sm font-semibold">
                                {detalle.cuentas?.codigo ?? detalle.cuenta_codigo ?? "-"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {detalle.cuentas?.nombre ?? detalle.cuenta_nombre ?? "-"}
                              </p>
                              {detalle.cuentas?.grupo && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {detalle.cuentas?.grupo}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {detalle.subcuentas ? (
                              <Badge variant="secondary" className="text-xs">
                                {detalle.subcuentas.nombre ?? detalle.subcuentas.name ?? "-"}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <p className="text-sm">{detalle.descripcion || "-"}</p>
                          </TableCell>
                          <TableCell className="text-right">
                            {detalle.debe > 0 ? (
                              <span className="font-semibold text-primary">
                                {formatCurrency(detalle.debe)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {detalle.haber > 0 ? (
                              <span className="font-semibold text-secondary">
                                {formatCurrency(detalle.haber)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="flex justify-between items-center font-semibold">
                      <span>Total Debe:</span>
                      <span className="text-primary">
                        {formatCurrency(asientosContables.detalle_asientos
                          ?.reduce((sum: number, d: any) => sum + (d.debe || 0), 0) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center font-semibold">
                      <span>Total Haber:</span>
                      <span className="text-secondary">
                        {formatCurrency(asientosContables.detalle_asientos
                          ?.reduce((sum: number, d: any) => sum + (d.haber || 0), 0) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-lg pt-2 border-t">
                      <span>Diferencia (Debe - Haber):</span>
                      <span className={
                        Math.abs(
                          (asientosContables.detalle_asientos?.reduce((sum: number, d: any) => sum + (d.debe || 0), 0) || 0) -
                          (asientosContables.detalle_asientos?.reduce((sum: number, d: any) => sum + (d.haber || 0), 0) || 0)
                        ) < 0.01 ? 'text-success' : 'text-destructive'
                      }>
                        {formatCurrency((
                          (asientosContables.detalle_asientos?.reduce((sum: number, d: any) => sum + (d.debe || 0), 0) || 0) -
                          (asientosContables.detalle_asientos?.reduce((sum: number, d: any) => sum + (d.haber || 0), 0) || 0)
                        ))}
                      </span>
                    </div>
                    {Math.abs(
                      (asientosContables.detalle_asientos?.reduce((sum: number, d: any) => sum + (d.debe || 0), 0) || 0) -
                      (asientosContables.detalle_asientos?.reduce((sum: number, d: any) => sum + (d.haber || 0), 0) || 0)
                    ) < 0.01 && (
                        <div className="flex items-center gap-2 text-success text-sm mt-2">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>El asiento está balanceado correctamente</span>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Registro de Pago */}
      <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {selectedCuenta && (
                <>
                  Cliente: {selectedCuenta.cliente_nombre}<br />
                  Monto pendiente: ${(selectedCuenta.monto_pendiente || 0).toLocaleString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="metodo-pago">Método de Pago</Label>
              <Select value={metodoPago} onValueChange={setMetodoPago}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="bancos">Transferencia/Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto-pago">Monto del Pago</Label>
              <Input
                id="monto-pago"
                type="number"
                placeholder="0.00"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                min="0"
                max={selectedCuenta?.monto_pendiente || 0}
                step="0.01"
              />
              <div className="text-xs text-muted-foreground">
                Máximo: ${(selectedCuenta?.monto_pendiente || 0).toLocaleString()}
              </div>
            </div>

            {montoPago && selectedCuenta && (
              <div className="bg-muted p-3 rounded-lg space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Monto actual pendiente:</span>
                  <span className="font-medium">${(selectedCuenta.monto_pendiente || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Monto a pagar:</span>
                  <span className="font-medium text-primary">${parseFloat(montoPago || "0").toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                  <span>Quedará pendiente:</span>
                  <span>${Math.max(0, (selectedCuenta.monto_pendiente || 0) - parseFloat(montoPago || "0")).toLocaleString()}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleRegistrarPago}
                disabled={registrarPagoMutation.isPending || !montoPago || !metodoPago}
                className="flex-1"
              >
                {registrarPagoMutation.isPending ? "Procesando..." : "Registrar Pago"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPagoDialogOpen(false)}
                disabled={registrarPagoMutation.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Historial de Pagos */}
      <Dialog open={historialPagosOpen} onOpenChange={setHistorialPagosOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Historial de Pagos</DialogTitle>
            <DialogDescription>
              {selectedFacturaId && (() => {
                const factura = filteredCuentas.find((c: any) => c.id === selectedFacturaId);
                return factura ? (
                  <>
                    Cliente: {factura.cliente_nombre || 'Sin especificar'}<br />
                    Descripción: {factura.descripcion}<br />
                    Monto Total: {formatCurrency(factura.monto_total)}<br />
                    Monto Pendiente: {formatCurrency(factura.monto_pendiente || 0)}
                  </>
                ) : null;
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {loadingHistorial ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando historial...
              </div>
            ) : !historialPagos || historialPagos.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <History className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No hay pagos registrados para esta factura.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3">
                  {historialPagos.map((pago: any, index: number) => (
                    <div
                      key={pago.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                              {historialPagos.length - index}
                            </div>
                            <div>
                              <div className="font-semibold text-lg">
                                {formatCurrency(pago.monto)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {safeFormatDate(pago.fecha, "dd 'de' MMMM 'de' yyyy", { locale: es })}
                              </div>
                            </div>
                          </div>

                          <div className="pl-11 space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">Método:</span>
                              <Badge variant="outline">
                                {pago.metodo_pago === 'efectivo' ? '💵 Efectivo' : '💳 Tarjeta/Banco'}
                              </Badge>
                              {pago._es_pago_inicial && (
                                <Badge variant="secondary" className="ml-2">
                                  ⭐ Pago Inicial
                                </Badge>
                              )}
                            </div>

                            {pago.descripcion && (
                              <div className="text-sm text-muted-foreground">
                                {pago.descripcion}
                              </div>
                            )}

                            <div className="text-xs text-muted-foreground pt-1">
                              Registrado: {safeFormatDate(pago.created_at, "dd/MM/yyyy HH:mm", { locale: es })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total de pagos realizados:</span>
                      <span className="font-semibold">{historialPagos.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Monto total pagado:</span>
                      <span className="text-lg font-bold text-success">
                        {formatCurrency(historialPagos.reduce((sum: number, p: any) => sum + (Number(p.monto) || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setHistorialPagosOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CuentasPorCobrar;
