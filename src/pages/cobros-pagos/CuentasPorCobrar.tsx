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

import PanelListaCuentas from "../cxc/PanelListaCuentas";
import PanelResumenTransacciones from "../cxc/PanelResumenTransacciones";
import PanelAnaliticasCxC from "../cxc/PanelAnaliticasCxC";

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

  // ===============================
// ✅ CLIENTES (para contacto en CxC)
// - Si la cuenta NO trae cliente_telefono/email/rfc, lo resolvemos por clienteId/clientId
// ===============================
const { data: clientesCatalogo } = useQuery({
  queryKey: ["clientes-catalogo"],
  queryFn: async () => {
    // helper tolerante a 404
    const tryFetchArray = async (url: string) => {
      try {
        const json = await apiFetch(url, { method: "GET" });
        const arr = unwrap<any[]>(json);
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    };

    // intenta endpoints comunes
    const a = await tryFetchArray("/api/clientes");
    if (a.length) return a;

    const b = await tryFetchArray("/api/clientes?include_all=true");
    if (b.length) return b;

    const c = await tryFetchArray("/api/clients");
    if (c.length) return c;

    return [];
  },
});

// helper: agarra cualquier variante de clienteId
const getClienteIdAny = (row: any): string => {
  const raw =
    row?.clienteId ??
    row?.cliente_id ??
    row?.clientId ??
    row?.client_id ??
    row?.cliente?.id ??
    row?.cliente?._id ??
    null;

  return raw ? String(raw) : "";
};

// index de clientes por id (Mongo: _id o id)
const clientesById = useMemo(() => {
  const map = new Map<string, any>();
  (clientesCatalogo || []).forEach((c: any) => {
    const id = String(c?._id ?? c?.id ?? "");
    if (id) map.set(id, c);
  });
  return map;
}, [clientesCatalogo]);

// resolver contacto FINAL (prioridad: payload de la cuenta -> catálogo por clienteId)
const resolveContacto = (cuenta: any) => {
  const tel =
    cuenta?.cliente_telefono ??
    cuenta?.clienteTelefono ??
    cuenta?.telefono_cliente ??
    cuenta?.telefonoCliente ??
    null;

  const email =
    cuenta?.cliente_email ??
    cuenta?.clienteEmail ??
    cuenta?.email_cliente ??
    cuenta?.emailCliente ??
    null;

  const rfc =
    cuenta?.cliente_rfc ??
    cuenta?.clienteRfc ??
    cuenta?.rfc_cliente ??
    cuenta?.rfcCliente ??
    null;

  // si ya viene en la cuenta, úsalo
  if (tel || email || rfc) {
    return {
      telefono: tel ? String(tel) : undefined,
      email: email ? String(email) : undefined,
      rfc: rfc ? String(rfc) : undefined,
    };
  }

  // si no, búscalo por clienteId
  const clienteId = getClienteIdAny(cuenta);
  if (!clienteId) return { telefono: undefined, email: undefined, rfc: undefined };

  const cli = clientesById.get(clienteId);
  if (!cli) return { telefono: undefined, email: undefined, rfc: undefined };

  // tu colección clients trae: name, email, phone (y a veces rfc/taxId)
  const phone = cli?.phone ?? cli?.telefono ?? cli?.telefonoCliente ?? null;
  const mail = cli?.email ?? cli?.correo ?? null;
  const tax =
    cli?.rfc ?? cli?.taxId ?? cli?.tax_id ?? cli?.identificacionFiscal ?? null;

  return {
    telefono: phone ? String(phone) : undefined,
    email: mail ? String(mail) : undefined,
    rfc: tax ? String(tax) : undefined,
  };
};

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
          contacto: resolveContacto(cuenta),
        });
      }

      const grupo = grupos.get(clienteKey)!;

  // ✅ merge contacto (por si esta factura sí trae datos y la primera no)
  const rc = resolveContacto(cuenta);
  grupo.contacto = {
    telefono: grupo.contacto.telefono ?? rc.telefono,
    email: grupo.contacto.email ?? rc.email,
    rfc: grupo.contacto.rfc ?? rc.rfc,
  };

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
  <PanelListaCuentas
    bucket={bucket}
    setBucket={setBucket}
    menuTotals={menuTotals}
    highlights={highlights}
    cuentasAgrupadasPorCliente={cuentasAgrupadasPorCliente}
    expandedClientes={expandedClientes}
    setExpandedClientes={setExpandedClientes}
    toggleClienteExpansion={toggleClienteExpansion}
    searchTerm={searchTerm}
    setSearchTerm={setSearchTerm}
    filtroEstado={filtroEstado}
    setFiltroEstado={setFiltroEstado}
    ordenMonto={ordenMonto}
    setOrdenMonto={setOrdenMonto}
    formatCurrency={formatCurrency}
    safeDate={safeDate}
    safeFormatDate={safeFormatDate}
    getEstadoBadge={getEstadoBadge}
    openHistorialPagos={openHistorialPagos}
    openPagoDialog={openPagoDialog}
  />
</TabsContent>

          {/* Tab 2: Resumen de Transacciones */}
          <TabsContent value="transacciones" className="space-y-6">
  <PanelResumenTransacciones
    loadingTransacciones={loadingTransacciones}
    todasTransacciones={todasTransacciones || []}
    filtroMesTransaccion={filtroMesTransaccion}
    setFiltroMesTransaccion={setFiltroMesTransaccion}
    filtroAnoTransaccion={filtroAnoTransaccion}
    setFiltroAnoTransaccion={setFiltroAnoTransaccion}
    filtroEstadoTransaccion={filtroEstadoTransaccion}
    setFiltroEstadoTransaccion={setFiltroEstadoTransaccion}
    filtroMetodoPago={filtroMetodoPago}
    setFiltroMetodoPago={setFiltroMetodoPago}
    filtroTipoIngreso={filtroTipoIngreso}
    setFiltroTipoIngreso={setFiltroTipoIngreso}
    filtroClienteTransaccion={filtroClienteTransaccion}
    setFiltroClienteTransaccion={setFiltroClienteTransaccion}
    ordenMontoTransaccion={ordenMontoTransaccion}
    setOrdenMontoTransaccion={setOrdenMontoTransaccion}
    safeDate={safeDate}
    safeFormatDate={safeFormatDate}
    formatCurrency={formatCurrency}
    onOpenDetalleContable={(id) => {
      setSelectedTransaccionId(id);
      setDetalleContableOpen(true);
    }}
    onResetFiltros={() => {
      setFiltroMesTransaccion("todos");
      setFiltroAnoTransaccion("todos");
      setFiltroEstadoTransaccion("todos");
      setFiltroMetodoPago("todos");
      setFiltroTipoIngreso("todos");
      setFiltroClienteTransaccion("todos");
      setOrdenMontoTransaccion("ninguno");
    }}
  />
</TabsContent>

          {/* Tab 3: Analíticas */}
          <TabsContent value="analiticas" className="space-y-6">
  <PanelAnaliticasCxC
    loadingAnalytics={loadingAnalytics}
    analytics={analytics}
    clientesUnicos={clientesUnicos}
    filtroClienteAnalitica={filtroClienteAnalitica}
    setFiltroClienteAnalitica={setFiltroClienteAnalitica}
    periodoCxC={periodoCxC}
    setPeriodoCxC={setPeriodoCxC}
    filtroAntiguedad={filtroAntiguedad}
    setFiltroAntiguedad={setFiltroAntiguedad}
    selectedCliente={selectedCliente}
    setSelectedCliente={setSelectedCliente}
    formatoNumerosAnalitica={formatoNumerosAnalitica}
    setFormatoNumerosAnalitica={setFormatoNumerosAnalitica}
    decimalesAnalitica={decimalesAnalitica}
    setDecimalesAnalitica={setDecimalesAnalitica}
    formatCurrency={formatCurrency}
    formatearConPreferenciasAnalitica={formatearConPreferenciasAnalitica}
    COLORS={COLORS}
    CustomTotalLabel={CustomTotalLabel}
  />
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
