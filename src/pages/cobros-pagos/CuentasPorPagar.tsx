import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  Search,
  Calendar,
  DollarSign,
  Building2,
  AlertCircle,
  TrendingUp,
  Clock,
  ChevronRight,
  ChevronDown,
  History,
  CreditCard,
  FileText,
  Mail,
  Phone,
  CheckCircle2,
  Eye,
  X,
  Banknote,
  ArrowLeft,
  Users,
  Layers,
  Boxes,
  Landmark,
  BriefcaseBusiness,
  Info,
  Scale,
} from "lucide-react";

import { useCuentasPorPagarAgrupadas, FacturaCxP } from "@/hooks/useCuentasPorPagarAgrupadas";
import { useSaldosDisponibles } from "@/hooks/useSaldosDisponibles";
import { formatCurrency, cn } from "@/lib/utils";
import AnalyticasCxP from "@/components/CuentasPorPagar/AnalyticasCxP";

/** Fetch helper */
async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || `Error HTTP ${res.status}`;
    throw new Error(msg);
  }

  return (json?.data ?? json) as T;
}

type FuenteTransaccion = "egreso" | "capex" | "pago_cxp";

type TransaccionCxP = {
  id: string;
  created_at: string;
  fecha: string | null;
  proveedor_nombre: string;
  descripcion: string;
  tipo: string;
  subtipo: string;
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;
  tipo_pago: string;
  metodo_pago: string;
  fecha_vencimiento: string | null;
  estado: string;
  fuente: FuenteTransaccion;
};

type AsientoContable = {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string;
  detalle_asientos?: Array<{
    id: string;
    cuenta_codigo: string;
    debe: number;
    haber: number;
    descripcion?: string;
    cuentas?: { nombre?: string };
  }>;
};

type PagoHistorial = {
  id: string;
  fecha: string;
  monto: number;
  metodo_pago?: string;
  descripcion?: string;
  es_pago_inicial?: boolean;
};

type TipoMenuProveedores = "inventario" | "capex" | "operativos" | "impuestos";
type EstadoFiltroLista = "todos" | "conSaldo" | "pagados" | "vencidos";
type OrdenLista = "monto_desc" | "monto_asc" | "nombre_asc" | "nombre_desc";

const CuentasPorPagar = () => {
  const [activeTab, setActiveTab] = useState("lista");
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string | null>(null);
  const [expandedProveedores, setExpandedProveedores] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectorAcreedoresOpen, setSelectorAcreedoresOpen] = useState(false);
  const [selectorAcreedoresTipo, setSelectorAcreedoresTipo] = useState<TipoMenuProveedores>("operativos");

  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<FacturaCxP | null>(null);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [historialDialogOpen, setHistorialDialogOpen] = useState(false);

  const [filtroMesTransaccion, setFiltroMesTransaccion] = useState<string>("todos");
  const [filtroAnoTransaccion, setFiltroAnoTransaccion] = useState<string>("todos");
  const [filtroProveedorTransaccion, setFiltroProveedorTransaccion] = useState<string>("todos");
  const [filtroTipoEgreso, setFiltroTipoEgreso] = useState<string>("todos");
  const [filtroCuentaTransaccion, setFiltroCuentaTransaccion] = useState<string>("todos");
  const [filtroEstadoTransaccion, setFiltroEstadoTransaccion] = useState<string>("todos");
  const [filtroMetodoPago, setFiltroMetodoPago] = useState<string>("todos");
  const [ordenMontoTransaccion, setOrdenMontoTransaccion] = useState<string>("ninguno");
  const [detalleContableOpen, setDetalleContableOpen] = useState(false);
  const [selectedTransaccionId, setSelectedTransaccionId] = useState<string | null>(null);
  const [fuenteTransaccion, setFuenteTransaccion] = useState<FuenteTransaccion | null>(null);

  // filtros estilo CxC para Lista
  const [estadoFiltroLista, setEstadoFiltroLista] = useState<EstadoFiltroLista>("todos");
  const [ordenLista, setOrdenLista] = useState<OrdenLista>("monto_desc");

  const { data: tiposCxP, isLoading } = useCuentasPorPagarAgrupadas();
  const { data: saldos } = useSaldosDisponibles();

  const queryClient = useQueryClient();

  const { data: todasTransaccionesCxP, isLoading: loadingTransaccionesCxP } = useQuery({
    queryKey: ["todas-transacciones-cxp"],
    queryFn: async () => {
      return await apiJson<TransaccionCxP[]>("/api/cxp/transacciones");
    },
  });

  const { data: asientoContable, isLoading: loadingAsiento } = useQuery({
    queryKey: ["asiento-contable-cxp", selectedTransaccionId, fuenteTransaccion],
    queryFn: async () => {
      if (!selectedTransaccionId || !fuenteTransaccion) return null;
      return await apiJson<AsientoContable | null>(
        `/api/asientos/by-transaccion?source=${encodeURIComponent(fuenteTransaccion)}&id=${encodeURIComponent(
          selectedTransaccionId
        )}`
      );
    },
    enabled: !!selectedTransaccionId && !!fuenteTransaccion && detalleContableOpen,
  });

  const { data: historialPagos } = useQuery({
    queryKey: ["historial-pagos-cxp", selectedFactura?.id],
    queryFn: async () => {
      if (!selectedFactura) return [];
      return await apiJson<PagoHistorial[]>(
        `/api/cxp/facturas/${encodeURIComponent(selectedFactura.id)}/pagos?source=${encodeURIComponent(
          selectedFactura.tipo_transaccion
        )}`
      );
    },
    enabled: !!selectedFactura && historialDialogOpen,
  });

  const registrarPagoMutation = useMutation({
    mutationFn: async ({
      facturaId,
      monto,
      metodo,
      tipo,
    }: {
      facturaId: string;
      monto: number;
      metodo: string;
      tipo: "egreso" | "capex" | "impuesto";
    }) => {
      return await apiJson<{ ok: true }>("/api/cxp/pagos", {
        method: "POST",
        body: JSON.stringify({
          facturaId,
          source: tipo,
          monto,
          metodo,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuentas-por-pagar-agrupadas"] });
      queryClient.invalidateQueries({ queryKey: ["todas-transacciones-cxp"] });
      queryClient.invalidateQueries({ queryKey: ["historial-pagos-cxp"] });
      queryClient.invalidateQueries({ queryKey: ["saldos-disponibles"] });
      queryClient.invalidateQueries({ queryKey: ["asientos-balanza"] });
      queryClient.invalidateQueries({ queryKey: ["resumen-transacciones"] });

      toast.success("Pago registrado exitosamente");
      setPagoDialogOpen(false);
      resetPagoForm();
    },
    onError: (error: any) => {
      toast.error("Error al registrar el pago: " + (error?.message || "Error desconocido"));
    },
  });

  const getTipo = (id: string) => (tiposCxP || []).find((t) => t.id === id) || null;

  const tipoInventario = getTipo("inventario");
  const tipoCapex = getTipo("capex");
  const tipoOperativos = getTipo("operativos");
  const tipoAcreedoresDiversos = getTipo("acreedores");
  const tipoImpuestos = getTipo("impuestos");

  const facturasProveedores = useMemo(() => {
    const a = tipoInventario?.proveedores?.flatMap((p) => p.facturas) || [];
    const b = tipoCapex?.proveedores?.flatMap((p) => p.facturas) || [];
    const c = tipoOperativos?.proveedores?.flatMap((p) => p.facturas) || [];
    return [...a, ...b, ...c];
  }, [tipoInventario, tipoCapex, tipoOperativos]);

  const proveedoresProveedoresCount = useMemo(() => {
    const s = new Set((facturasProveedores || []).map((f) => f.proveedor_nombre || "Sin proveedor"));
    return s.size;
  }, [facturasProveedores]);

  const totalProveedoresPendiente =
    (tipoInventario?.totalPendiente || 0) + (tipoCapex?.totalPendiente || 0) + (tipoOperativos?.totalPendiente || 0);

  const totalProveedoresFacturas = facturasProveedores.length;
  const saldoAcreedores = tipoAcreedoresDiversos?.totalPendiente || 0;
  const saldoProveedores = totalProveedoresPendiente;

  const resetVistaLista = () => {
    setTipoSeleccionado(null);
    setExpandedProveedores(new Set());
    setSearchTerm("");
    setEstadoFiltroLista("todos");
    setOrdenLista("monto_desc");
  };

  const toggleProveedor = (nombreProveedor: string) => {
    const newSet = new Set(expandedProveedores);
    if (newSet.has(nombreProveedor)) newSet.delete(nombreProveedor);
    else newSet.add(nombreProveedor);
    setExpandedProveedores(newSet);
  };

  const openPagoDialog = (factura: FacturaCxP) => {
    setSelectedFactura(factura);
    setMontoPago("");
    setMetodoPago("");
    setPagoDialogOpen(true);
  };

  const openHistorialDialog = (factura: FacturaCxP) => {
    setSelectedFactura(factura);
    setHistorialDialogOpen(true);
  };

  const resetPagoForm = () => {
    setSelectedFactura(null);
    setMontoPago("");
    setMetodoPago("");
  };

  const handleRegistrarPago = async () => {
    if (!selectedFactura || !montoPago || !metodoPago) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    const monto = parseFloat(montoPago);
    if (isNaN(monto) || monto <= 0) {
      toast.error("El monto debe ser un número válido mayor a 0");
      return;
    }

    if (monto > (selectedFactura.monto_pendiente || 0)) {
      toast.error("El monto no puede ser mayor al monto pendiente");
      return;
    }

    if (metodoPago === "efectivo") {
      const disponible = saldos?.efectivo || 0;
      if (monto > disponible) {
        toast.error(`Saldo insuficiente en efectivo. Disponible: ${formatCurrency(disponible)}`);
        return;
      }
    }

    if (metodoPago === "transferencia") {
      const disponible = saldos?.bancos || 0;
      if (monto > disponible) {
        toast.error(`Saldo insuficiente en bancos. Disponible: ${formatCurrency(disponible)}`);
        return;
      }
    }

    registrarPagoMutation.mutate({
      facturaId: selectedFactura.id,
      monto,
      metodo: metodoPago,
      tipo: selectedFactura.tipo_transaccion,
    });
  };

  const getEstadoBadge = (fechaVencimiento: string | null, montoPendiente: number) => {
    if (montoPendiente === 0) return <Badge variant="secondary">Pagado</Badge>;
    if (!fechaVencimiento) return <Badge variant="outline">Sin vencimiento</Badge>;

    const fechaVence = new Date(fechaVencimiento);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaVence.setHours(0, 0, 0, 0);

    if (fechaVence < hoy) return <Badge variant="destructive">Vencida</Badge>;
    return <Badge variant="default">Por vencer</Badge>;
  };

  const tipoActual = tiposCxP?.find((t) => t.id === tipoSeleccionado);

  const proveedoresFiltrados = useMemo(() => {
    const base = tipoActual?.proveedores || [];
    let resultado = [...base];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      resultado = resultado.filter(
        (prov) =>
          prov.nombre.toLowerCase().includes(q) ||
          prov.email?.toLowerCase().includes(q) ||
          prov.telefono?.toLowerCase().includes(q) ||
          prov.rfc?.toLowerCase().includes(q)
      );
    }

    if (estadoFiltroLista === "conSaldo") {
      resultado = resultado.filter((prov) => (prov.totalPendiente || 0) > 0);
    } else if (estadoFiltroLista === "pagados") {
      resultado = resultado.filter((prov) => (prov.totalPendiente || 0) <= 0);
    } else if (estadoFiltroLista === "vencidos") {
      resultado = resultado.filter((prov) =>
        prov.facturas?.some((f) => {
          if (!f.fecha_vencimiento || (f.monto_pendiente || 0) <= 0) return false;
          const vence = new Date(f.fecha_vencimiento);
          const hoy = new Date();
          vence.setHours(0, 0, 0, 0);
          hoy.setHours(0, 0, 0, 0);
          return vence < hoy;
        })
      );
    }

    resultado.sort((a, b) => {
      switch (ordenLista) {
        case "monto_asc":
          return (a.totalPendiente || 0) - (b.totalPendiente || 0);
        case "nombre_asc":
          return a.nombre.localeCompare(b.nombre);
        case "nombre_desc":
          return b.nombre.localeCompare(a.nombre);
        case "monto_desc":
        default:
          return (b.totalPendiente || 0) - (a.totalPendiente || 0);
      }
    });

    return resultado;
  }, [tipoActual, searchTerm, estadoFiltroLista, ordenLista]);

  const totalFacturas = tiposCxP?.reduce((sum, tipo) => sum + tipo.totalFacturas, 0) || 0;
  const totalPendiente = tiposCxP?.reduce((sum, tipo) => sum + tipo.totalPendiente, 0) || 0;

  const todasFacturas = tiposCxP?.flatMap((tipo) => tipo.proveedores.flatMap((prov) => prov.facturas)) || [];

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const totalVencidas = todasFacturas.filter((f) => {
    if (!f.fecha_vencimiento || (f.monto_pendiente || 0) <= 0) return false;
    const vence = new Date(f.fecha_vencimiento);
    vence.setHours(0, 0, 0, 0);
    return vence < hoy;
  }).length;

  const totalPorVencer = todasFacturas.filter((f) => {
    if (!f.fecha_vencimiento || (f.monto_pendiente || 0) <= 0) return false;
    const vence = new Date(f.fecha_vencimiento);
    vence.setHours(0, 0, 0, 0);
    return vence >= hoy;
  }).length;

  const transaccionesFiltradas = useMemo(() => {
    if (!todasTransaccionesCxP) return [];

    let resultado = [...todasTransaccionesCxP];

    if (filtroMesTransaccion !== "todos") {
      resultado = resultado.filter((t) => new Date(t.created_at).getMonth() + 1 === parseInt(filtroMesTransaccion));
    }

    if (filtroAnoTransaccion !== "todos") {
      resultado = resultado.filter((t) => new Date(t.created_at).getFullYear() === parseInt(filtroAnoTransaccion));
    }

    if (filtroProveedorTransaccion !== "todos") {
      resultado = resultado.filter((t) => t.proveedor_nombre === filtroProveedorTransaccion);
    }

    if (filtroTipoEgreso !== "todos") {
      resultado = resultado.filter((t) => t.tipo === filtroTipoEgreso);
    }

    if (filtroCuentaTransaccion !== "todos") {
      const tipoLower = (x: string) => String(x || "").toLowerCase().trim();
      if (filtroCuentaTransaccion === "proveedores") {
        resultado = resultado.filter((t) => tipoLower(t.tipo) !== "acreedores diversos");
      } else if (filtroCuentaTransaccion === "acreedores") {
        resultado = resultado.filter((t) => tipoLower(t.tipo) === "acreedores diversos");
      }
    }

    if (filtroEstadoTransaccion !== "todos") {
      if (filtroEstadoTransaccion === "completado") {
        resultado = resultado.filter((t) => t.monto_pendiente === 0 && t.fuente !== "pago_cxp");
      } else if (filtroEstadoTransaccion === "enProgreso") {
        resultado = resultado.filter((t) => t.monto_pendiente > 0 && t.monto_pagado > 0 && t.fuente !== "pago_cxp");
      } else if (filtroEstadoTransaccion === "sinPagar") {
        resultado = resultado.filter((t) => t.monto_pagado === 0 && t.monto_pendiente > 0 && t.fuente !== "pago_cxp");
      }
    }

    if (filtroMetodoPago !== "todos") {
      resultado = resultado.filter((t) => t.metodo_pago === filtroMetodoPago);
    }

    if (ordenMontoTransaccion === "menor") {
      resultado.sort((a, b) => a.monto_total - b.monto_total);
    } else if (ordenMontoTransaccion === "mayor") {
      resultado.sort((a, b) => b.monto_total - a.monto_total);
    }

    return resultado;
  }, [
    todasTransaccionesCxP,
    filtroMesTransaccion,
    filtroAnoTransaccion,
    filtroProveedorTransaccion,
    filtroTipoEgreso,
    filtroCuentaTransaccion,
    filtroEstadoTransaccion,
    filtroMetodoPago,
    ordenMontoTransaccion,
  ]);

  const proveedoresUnicos = useMemo(() => {
    if (!todasTransaccionesCxP) return [];
    const nombres = new Set(todasTransaccionesCxP.map((t) => t.proveedor_nombre));
    return Array.from(nombres).sort();
  }, [todasTransaccionesCxP]);

  const tiposUnicos = useMemo(() => {
    if (!todasTransaccionesCxP) return [];
    const tipos = new Set(todasTransaccionesCxP.map((t) => t.tipo));
    return Array.from(tipos).sort((a, b) => {
      if (a === "Pago CxP") return -1;
      if (b === "Pago CxP") return 1;
      return a.localeCompare(b);
    });
  }, [todasTransaccionesCxP]);

  const limpiarFiltrosTransacciones = () => {
    setFiltroMesTransaccion("todos");
    setFiltroAnoTransaccion("todos");
    setFiltroProveedorTransaccion("todos");
    setFiltroTipoEgreso("todos");
    setFiltroCuentaTransaccion("todos");
    setFiltroEstadoTransaccion("todos");
    setFiltroMetodoPago("todos");
    setOrdenMontoTransaccion("ninguno");
  };

  const getEstadoTransaccion = (transaccion: TransaccionCxP) => {
    if (transaccion.monto_pendiente === 0) return "completado";
    if (transaccion.monto_pagado > 0) return "enProgreso";
    return "sinPagar";
  };

  const getPorcentajePagado = (transaccion: TransaccionCxP) => {
    if (transaccion.monto_total === 0) return 0;
    return (transaccion.monto_pagado / transaccion.monto_total) * 100;
  };

  const openSelectorAcreedores = () => {
    setSelectorAcreedoresOpen(true);
  };

  const confirmarSelectorAcreedores = () => {
    const nextId: TipoMenuProveedores = selectorAcreedoresTipo || "operativos";
    setSelectorAcreedoresOpen(false);
    setTipoSeleccionado(nextId);
    setExpandedProveedores(new Set());
    setSearchTerm("");
    setEstadoFiltroLista("todos");
    setOrdenLista("monto_desc");
  };

  const abrirAcreedoresDiversos = () => {
    setTipoSeleccionado("acreedores");
    setExpandedProveedores(new Set());
    setSearchTerm("");
    setEstadoFiltroLista("todos");
    setOrdenLista("monto_desc");
  };

  const heroConfig = useMemo(() => {
    switch (tipoSeleccionado) {
      case "inventario":
        return {
          breadcrumb: "/ Acreedores / Compras de Inventario",
          title: "Compras de Inventario",
          subtitle: "Facturas pendientes por compras de mercancía y productos",
          amountLabel: "Total pendiente",
          gradient: "from-sky-950 via-slate-900 to-blue-950",
          panelBg: "bg-white/10 border-white/10",
          textSoft: "text-sky-100",
          Icon: Boxes,
        };
      case "capex":
        return {
          breadcrumb: "/ Acreedores / Inversiones CAPEX",
          title: "Inversiones CAPEX",
          subtitle: "Adquisiciones de activos e inversiones de capital pendientes de pago",
          amountLabel: "Total pendiente",
          gradient: "from-violet-950 via-slate-900 to-indigo-950",
          panelBg: "bg-white/10 border-white/10",
          textSoft: "text-violet-100",
          Icon: Landmark,
        };
      case "operativos":
        return {
          breadcrumb: "/ Acreedores / Gastos Operativos",
          title: "Gastos Operativos",
          subtitle: "Compromisos pendientes relacionados con operación y funcionamiento",
          amountLabel: "Total pendiente",
          gradient: "from-slate-950 via-slate-900 to-slate-800",
          panelBg: "bg-white/10 border-white/10",
          textSoft: "text-slate-200",
          Icon: BriefcaseBusiness,
        };
      case "impuestos":
        return {
          breadcrumb: "/ Impuestos por Pagar",
          title: "Impuestos por Pagar",
          subtitle: "ISR y contribuciones pendientes de pago a autoridades fiscales",
          amountLabel: "Total pendiente",
          gradient: "from-amber-950 via-orange-900 to-amber-900",
          panelBg: "bg-white/10 border-white/10",
          textSoft: "text-amber-100",
          Icon: Scale,
        };
      case "acreedores":
        return {
          breadcrumb: "/ 2003 - Acreedores Diversos",
          title: "Acreedores Diversos",
          subtitle: "Otras cuentas por pagar registradas en la cuenta 2003",
          amountLabel: "Total pendiente",
          gradient: "from-emerald-950 via-teal-900 to-cyan-950",
          panelBg: "bg-white/10 border-white/10",
          textSoft: "text-emerald-100",
          Icon: Users,
        };
      default:
        return null;
    }
  }, [tipoSeleccionado]);

  const metricasVistaActual = useMemo(() => {
    if (!tipoActual) {
      return {
        pendientes: 0,
        vencidas: 0,
        proveedores: 0,
      };
    }

    const facturas = tipoActual.proveedores.flatMap((p) => p.facturas);

    const vencidas = facturas.filter((f) => {
      if (!f.fecha_vencimiento || (f.monto_pendiente || 0) <= 0) return false;
      const vence = new Date(f.fecha_vencimiento);
      const ahora = new Date();
      vence.setHours(0, 0, 0, 0);
      ahora.setHours(0, 0, 0, 0);
      return vence < ahora;
    }).length;

    return {
      pendientes: tipoActual.totalFacturas || 0,
      vencidas,
      proveedores: tipoActual.totalProveedores || 0,
    };
  }, [tipoActual]);

  const limpiarFiltrosLista = () => {
    setSearchTerm("");
    setEstadoFiltroLista("todos");
    setOrdenLista("monto_desc");
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Cargando cuentas por pagar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cuentas por Pagar</h1>
            <p className="text-muted-foreground">Gestiona y da seguimiento a las cuentas pendientes de pago</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Lista de Cuentas
            </TabsTrigger>
            <TabsTrigger value="transacciones" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Resumen de Transacciones
            </TabsTrigger>
            <TabsTrigger value="analiticas" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Analíticas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-6">
            {tipoSeleccionado && (
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={resetVistaLista} className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Regresar al menú
                </Button>
                <span className="text-sm text-muted-foreground">{heroConfig?.breadcrumb}</span>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total por Pagar</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>

                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold">{formatCurrency(totalPendiente)}</div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Proveedores</span>
                      <span className="font-medium text-foreground">{formatCurrency(saldoProveedores)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Acreedores diversos</span>
                      <span className="font-medium text-foreground">{formatCurrency(saldoAcreedores)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cuentas Vencidas</CardTitle>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{totalVencidas}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Por Vencer</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalPorVencer}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cuentas</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalFacturas}</div>
                </CardContent>
              </Card>
            </div>

            {!tipoSeleccionado && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card
                  className={cn(
                    "cursor-pointer overflow-hidden border-0",
                    "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white",
                    "shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/20 transition-all"
                  )}
                  onClick={openSelectorAcreedores}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-semibold tracking-tight">Acreedores</CardTitle>
                        <CardDescription className="text-slate-200">
                          Compras de inventario, CAPEX y egresos operativos
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="rounded-xl bg-white/10 p-2">
                          <Layers className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-sm text-slate-200">Ver detalle →</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="text-4xl font-bold">{formatCurrency(totalProveedoresPendiente)}</div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                        <div className="text-slate-200">Facturas pendientes</div>
                        <div className="text-lg font-semibold">{totalProveedoresFacturas}</div>
                      </div>
                      <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                        <div className="text-slate-200">Proveedores</div>
                        <div className="text-lg font-semibold">{proveedoresProveedoresCount}</div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-300">
                      Haz click para seleccionar inventario, CAPEX u operativos.
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={cn(
                    "cursor-pointer overflow-hidden border-0",
                    "bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 text-white",
                    "shadow-lg shadow-emerald-900/10 hover:shadow-xl hover:shadow-emerald-900/20 transition-all"
                  )}
                  onClick={abrirAcreedoresDiversos}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-semibold tracking-tight">Acreedores Diversos</CardTitle>
                        <CardDescription className="text-emerald-100">
                          Otras cuentas por pagar registradas en la cuenta 2003
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="rounded-xl bg-white/10 p-2">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-sm text-emerald-100">Ver detalle →</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="text-4xl font-bold">{formatCurrency(tipoAcreedoresDiversos?.totalPendiente || 0)}</div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                        <div className="text-emerald-100">Facturas pendientes</div>
                        <div className="text-lg font-semibold">{tipoAcreedoresDiversos?.totalFacturas || 0}</div>
                      </div>
                      <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                        <div className="text-emerald-100">Proveedores</div>
                        <div className="text-lg font-semibold">{tipoAcreedoresDiversos?.totalProveedores || 0}</div>
                      </div>
                    </div>

                    <div className="text-xs text-emerald-100">
                      Haz click para ver el listado y registrar pagos.
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={cn(
                    "cursor-pointer overflow-hidden border-0",
                    "bg-gradient-to-br from-amber-950 via-orange-900 to-amber-900 text-white",
                    "shadow-lg shadow-amber-900/10 hover:shadow-xl hover:shadow-amber-900/20 transition-all"
                  )}
                  onClick={() => {
                    setTipoSeleccionado("impuestos");
                    setExpandedProveedores(new Set());
                    setSearchTerm("");
                    setEstadoFiltroLista("todos");
                    setOrdenLista("monto_desc");
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-semibold tracking-tight">Impuestos por Pagar</CardTitle>
                        <CardDescription className="text-amber-100">
                          ISR y contribuciones pendientes a autoridades fiscales
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-xl bg-white/10 p-2">
                          <Scale className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-sm text-amber-100">Ver detalle →</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-4xl font-bold">{formatCurrency(tipoImpuestos?.totalPendiente || 0)}</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                        <div className="text-amber-100">Registros pendientes</div>
                        <div className="text-lg font-semibold">{tipoImpuestos?.totalFacturas || 0}</div>
                      </div>
                      <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                        <div className="text-amber-100">Autoridades</div>
                        <div className="text-lg font-semibold">{tipoImpuestos?.totalProveedores || 0}</div>
                      </div>
                    </div>
                    <div className="text-xs text-amber-100">
                      Haz click para ver el listado y registrar pagos.
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Dialog open={selectorAcreedoresOpen} onOpenChange={setSelectorAcreedoresOpen}>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Selecciona qué deseas analizar</DialogTitle>
                  <DialogDescription>
                    Dentro de <span className="font-medium">Acreedores</span>, elige una categoría para ver el listado.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de acreedor</Label>
                    <Select value={selectorAcreedoresTipo} onValueChange={(v) => setSelectorAcreedoresTipo(v as TipoMenuProveedores)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una opción" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inventario">
                          Compras de Inventario — {formatCurrency(tipoInventario?.totalPendiente || 0)}
                        </SelectItem>
                        <SelectItem value="capex">
                          Inversiones CAPEX — {formatCurrency(tipoCapex?.totalPendiente || 0)}
                        </SelectItem>
                        <SelectItem value="operativos">
                          Egresos Operativos — {formatCurrency(tipoOperativos?.totalPendiente || 0)}
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="text-xs text-muted-foreground">
                      Tip: Puedes regresar al menú principal con “Regresar al menú”.
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSelectorAcreedoresOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={confirmarSelectorAcreedores}>Continuar</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {tipoSeleccionado && tipoActual && heroConfig && (
              <div className="space-y-5">
                <Card className={cn("overflow-hidden border-0 text-white shadow-xl", `bg-gradient-to-r ${heroConfig.gradient}`)}>
                  <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              variant="outline"
                              onClick={resetVistaLista}
                              className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                            >
                              <ArrowLeft className="mr-2 h-4 w-4" />
                              Regresar al menú
                            </Button>

                            <span className={cn("text-sm font-medium", heroConfig.textSoft)}>{heroConfig.breadcrumb}</span>
                          </div>

                          <div className="space-y-1">
                            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{heroConfig.title}</h2>
                            <p className={cn("text-sm md:text-base", heroConfig.textSoft)}>{heroConfig.subtitle}</p>
                          </div>
                        </div>

                        <div className={cn("rounded-2xl border px-4 py-3 min-w-[180px] lg:min-w-[210px]", heroConfig.panelBg)}>
                          <div className={cn("text-sm", heroConfig.textSoft)}>{heroConfig.amountLabel}</div>
                          <div className="text-3xl font-bold">{formatCurrency(tipoActual.totalPendiente || 0)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className={cn("rounded-2xl border p-4", heroConfig.panelBg)}>
                          <div className={cn("text-xs uppercase tracking-wide", heroConfig.textSoft)}>Registros pendientes</div>
                          <div className="mt-1 text-2xl font-semibold">{metricasVistaActual.pendientes}</div>
                        </div>

                        <div className={cn("rounded-2xl border p-4", heroConfig.panelBg)}>
                          <div className={cn("text-xs uppercase tracking-wide", heroConfig.textSoft)}>
                            {tipoSeleccionado === "acreedores" ? "Acreedores" : "Proveedores"}
                          </div>
                          <div className="mt-1 text-2xl font-semibold">{metricasVistaActual.proveedores}</div>
                        </div>

                        <div className={cn("rounded-2xl border p-4", heroConfig.panelBg)}>
                          <div className={cn("text-xs uppercase tracking-wide", heroConfig.textSoft)}>Tip</div>
                          <div className="mt-1 text-sm leading-relaxed text-white">
                            Usa búsqueda + estado para encontrar rápido y registrar pagos sin perder contexto.
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-2xl font-semibold tracking-tight">Filtrar Cuentas</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-5 space-y-2">
                          <Label>Búsqueda</Label>
                          <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Proveedor, descripción, teléfono, email o RFC..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-9"
                            />
                          </div>
                        </div>

                        <div className="md:col-span-3 space-y-2">
                          <Label>Estado</Label>
                          <Select value={estadoFiltroLista} onValueChange={(v) => setEstadoFiltroLista(v as EstadoFiltroLista)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Todos</SelectItem>
                              <SelectItem value="conSaldo">Con saldo pendiente</SelectItem>
                              <SelectItem value="vencidos">Con facturas vencidas</SelectItem>
                              <SelectItem value="pagados">Total pagado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-3 space-y-2">
                          <Label>Orden</Label>
                          <Select value={ordenLista} onValueChange={(v) => setOrdenLista(v as OrdenLista)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Ordenar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monto_desc">Mayor saldo</SelectItem>
                              <SelectItem value="monto_asc">Menor saldo</SelectItem>
                              <SelectItem value="nombre_asc">Nombre A-Z</SelectItem>
                              <SelectItem value="nombre_desc">Nombre Z-A</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-1">
                          <Button variant="outline" className="w-full" onClick={limpiarFiltrosLista}>
                            Limpiar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-3xl tracking-tight">
                      {tipoSeleccionado === "acreedores" ? "Listado de Acreedores Diversos" : "Listado de Proveedores"}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[52px]"></TableHead>
                          <TableHead>
                            {tipoSeleccionado === "acreedores" ? "Acreedor" : tipoSeleccionado === "impuestos" ? "Autoridad Fiscal" : "Proveedor"}
                          </TableHead>
                          <TableHead>Información de Contacto</TableHead>
                          <TableHead className="text-right">Total Pendiente</TableHead>
                          <TableHead className="text-center">Facturas</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {proveedoresFiltrados.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                              No se encontraron cuentas por pagar.
                            </TableCell>
                          </TableRow>
                        ) : (
                          proveedoresFiltrados.map((proveedor) => (
                            <>
                              <TableRow
                                key={`prov-${proveedor.nombre}`}
                                className="cursor-pointer hover:bg-muted/40"
                                onClick={() => toggleProveedor(proveedor.nombre)}
                              >
                                <TableCell>
                                  {expandedProveedores.has(proveedor.nombre) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </TableCell>

                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="font-semibold">{proveedor.nombre}</div>
                                    {proveedor.rfc && <div className="text-sm text-muted-foreground">RFC: {proveedor.rfc}</div>}
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="space-y-1 text-sm">
                                    {proveedor.telefono && (
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <Phone className="h-3.5 w-3.5" />
                                        {proveedor.telefono}
                                      </div>
                                    )}
                                    {proveedor.email && (
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <Mail className="h-3.5 w-3.5" />
                                        {proveedor.email}
                                      </div>
                                    )}
                                    {!proveedor.email && !proveedor.telefono && (
                                      <div className="text-sm text-muted-foreground">Sin información de contacto</div>
                                    )}
                                  </div>
                                </TableCell>

                                <TableCell className="text-right">
                                  <div className="font-bold text-lg">{formatCurrency(proveedor.totalPendiente || 0)}</div>
                                </TableCell>

                                <TableCell className="text-center">
                                  <Badge variant="secondary">
                                    {proveedor.totalFacturas} {proveedor.totalFacturas === 1 ? "factura" : "facturas"}
                                  </Badge>
                                </TableCell>
                              </TableRow>

                              {expandedProveedores.has(proveedor.nombre) &&
                                proveedor.facturas.map((factura) => {
                                  const porcentajePagado =
                                    factura.monto_total > 0 ? (factura.monto_pagado / factura.monto_total) * 100 : 0;

                                  return (
                                    <TableRow key={factura.id} className="bg-muted/25">
                                      <TableCell></TableCell>
                                      <TableCell colSpan={4}>
                                        <div className="pl-4 md:pl-8 py-3">
                                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                            <div className="flex-1 space-y-3">
                                              <div className="flex items-start gap-3">
                                                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                                                <div className="space-y-1">
                                                  <div className="font-medium">{factura.descripcion}</div>

                                                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-1">
                                                      <Calendar className="h-3.5 w-3.5" />
                                                      {format(new Date(factura.created_at), "d 'de' MMMM, yyyy", {
                                                        locale: es,
                                                      })}
                                                    </div>

                                                    {factura.fecha_vencimiento && (
                                                      <div className="flex items-center gap-1">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        Vence:{" "}
                                                        {format(new Date(factura.fecha_vencimiento), "d 'de' MMMM, yyyy", {
                                                          locale: es,
                                                        })}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pl-0 md:pl-8">
                                                <div className="rounded-xl border bg-background p-3">
                                                  <div className="text-xs text-muted-foreground">Total</div>
                                                  <div className="font-semibold">{formatCurrency(factura.monto_total)}</div>
                                                </div>

                                                <div className="rounded-xl border bg-background p-3">
                                                  <div className="text-xs text-muted-foreground">Pagado</div>
                                                  <div className="font-semibold text-green-600">
                                                    {formatCurrency(factura.monto_pagado)}
                                                  </div>
                                                </div>

                                                <div className="rounded-xl border bg-background p-3">
                                                  <div className="text-xs text-muted-foreground">Pendiente</div>
                                                  <div className="font-semibold text-destructive">
                                                    {formatCurrency(factura.monto_pendiente)}
                                                  </div>
                                                </div>

                                                <div className="rounded-xl border bg-background p-3 flex items-center justify-between gap-2">
                                                  <div>
                                                    <div className="text-xs text-muted-foreground">Estado</div>
                                                    <div className="mt-1">
                                                      {getEstadoBadge(factura.fecha_vencimiento, factura.monto_pendiente)}
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="pl-0 md:pl-8 space-y-2">
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                  <span>Progreso de pago</span>
                                                  <span>{porcentajePagado.toFixed(0)}%</span>
                                                </div>
                                                <Progress value={porcentajePagado} className="h-2" />
                                              </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2 xl:pl-4">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openHistorialDialog(factura);
                                                }}
                                              >
                                                <History className="h-4 w-4 mr-2" />
                                                Historial
                                              </Button>

                                              <Button
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openPagoDialog(factura);
                                                }}
                                                disabled={factura.monto_pendiente <= 0}
                                              >
                                                <CreditCard className="h-4 w-4 mr-2" />
                                                Pagar
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="transacciones" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-5">
              <Card className="bg-card/50 backdrop-blur">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Transacciones</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{todasTransaccionesCxP?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Facturas y pagos</p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completamente Pagadas</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {todasTransaccionesCxP?.filter((t) => t.monto_pendiente === 0 && t.fuente !== "pago_cxp").length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Facturas completadas</p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pagos Parciales</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">
                    {todasTransaccionesCxP?.filter(
                      (t) => t.monto_pendiente > 0 && t.monto_pagado > 0 && t.fuente !== "pago_cxp"
                    ).length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">En progreso</p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sin Pagar</CardTitle>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {todasTransaccionesCxP?.filter(
                      (t) => t.monto_pagado === 0 && t.monto_pendiente > 0 && t.fuente !== "pago_cxp"
                    ).length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </CardContent>
              </Card>

              <Card className="bg-primary/10 backdrop-blur border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pagos CxP</CardTitle>
                  <Banknote className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {todasTransaccionesCxP?.filter((t) => t.fuente === "pago_cxp").length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(
                      todasTransaccionesCxP
                        ?.filter((t) => t.fuente === "pago_cxp")
                        .reduce((sum, t) => sum + t.monto_total, 0) || 0
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Filtros</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mes</label>
                    <Select value={filtroMesTransaccion} onValueChange={setFiltroMesTransaccion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los meses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los meses</SelectItem>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            {new Date(2024, i, 1).toLocaleDateString("es-MX", { month: "long" })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Año</label>
                    <Select value={filtroAnoTransaccion} onValueChange={setFiltroAnoTransaccion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los años" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los años</SelectItem>
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return (
                            <SelectItem key={year} value={String(year)}>
                              {year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Proveedor</label>
                    <Select value={filtroProveedorTransaccion} onValueChange={setFiltroProveedorTransaccion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los proveedores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los proveedores</SelectItem>
                        {proveedoresUnicos.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={filtroTipoEgreso} onValueChange={setFiltroTipoEgreso}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los tipos</SelectItem>
                        {tiposUnicos.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cuenta</label>
                    <Select value={filtroCuentaTransaccion} onValueChange={setFiltroCuentaTransaccion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas</SelectItem>
                        <SelectItem value="proveedores">Proveedores</SelectItem>
                        <SelectItem value="acreedores">Acreedores diversos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estado</label>
                    <Select value={filtroEstadoTransaccion} onValueChange={setFiltroEstadoTransaccion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los estados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los estados</SelectItem>
                        <SelectItem value="completado">Completado</SelectItem>
                        <SelectItem value="enProgreso">En Progreso</SelectItem>
                        <SelectItem value="sinPagar">Sin Pagar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Método de Pago</label>
                    <Select value={filtroMetodoPago} onValueChange={setFiltroMetodoPago}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los métodos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los métodos</SelectItem>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="bancos">Transferencia / Bancos</SelectItem>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="-">No especificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ordenar por Monto</label>
                    <Select value={ordenMontoTransaccion} onValueChange={setOrdenMontoTransaccion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin orden" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ninguno">Sin orden</SelectItem>
                        <SelectItem value="menor">Menor a Mayor</SelectItem>
                        <SelectItem value="mayor">Mayor a Menor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">&nbsp;</label>
                    <Button variant="outline" className="w-full" onClick={limpiarFiltrosTransacciones}>
                      <X className="h-4 w-4 mr-2" />
                      Limpiar Filtros
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transacciones ({transaccionesFiltradas.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTransaccionesCxP ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Cargando transacciones...</p>
                  </div>
                ) : transaccionesFiltradas.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No hay transacciones que coincidan con los filtros</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Subtipo</TableHead>
                          <TableHead className="text-right">Monto Total</TableHead>
                          <TableHead className="text-right">Pagado</TableHead>
                          <TableHead className="text-right">Pendiente</TableHead>
                          <TableHead>Tipo Pago</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Progreso</TableHead>
                          <TableHead className="text-center">Detalle</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {transaccionesFiltradas.map((transaccion) => {
                          const estado = getEstadoTransaccion(transaccion);
                          const porcentaje = getPorcentajePagado(transaccion);

                          return (
                            <TableRow key={transaccion.id}>
                              <TableCell className="whitespace-nowrap">
                                {format(new Date(transaccion.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                              </TableCell>
                              <TableCell>{transaccion.proveedor_nombre}</TableCell>
                              <TableCell className="max-w-xs truncate">{transaccion.descripcion}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{transaccion.tipo}</Badge>
                              </TableCell>
                              <TableCell>{transaccion.subtipo}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(transaccion.monto_total)}</TableCell>
                              <TableCell className="text-right text-green-600">{formatCurrency(transaccion.monto_pagado)}</TableCell>
                              <TableCell className="text-right text-destructive">{formatCurrency(transaccion.monto_pendiente)}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    transaccion.tipo_pago === "contado"
                                      ? "default"
                                      : transaccion.tipo_pago === "credito"
                                      ? "secondary"
                                      : "outline"
                                  }
                                >
                                  {transaccion.tipo_pago}
                                </Badge>
                              </TableCell>
                              <TableCell className="capitalize">{transaccion.metodo_pago}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    estado === "completado" ? "default" : estado === "enProgreso" ? "secondary" : "destructive"
                                  }
                                >
                                  {estado === "completado" ? "Completado" : estado === "enProgreso" ? "En Progreso" : "Sin Pagar"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={porcentaje} className="w-16" />
                                  <span className="text-xs text-muted-foreground">{porcentaje.toFixed(0)}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTransaccionId(transaccion.id);
                                    setFuenteTransaccion(transaccion.fuente);
                                    setDetalleContableOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analiticas" className="space-y-6">
            <AnalyticasCxP />
          </TabsContent>
        </Tabs>

        <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pago</DialogTitle>
              <DialogDescription>Registra un pago para {selectedFactura?.proveedor_nombre || "este proveedor"}</DialogDescription>
            </DialogHeader>

            {selectedFactura && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monto total:</span>
                    <span className="font-medium">{formatCurrency(selectedFactura.monto_total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pagado:</span>
                    <span className="font-medium text-green-600">{formatCurrency(selectedFactura.monto_pagado)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pendiente:</span>
                    <span className="font-bold text-destructive">{formatCurrency(selectedFactura.monto_pendiente)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monto">Monto a pagar</Label>
                  <Input
                    id="monto"
                    type="number"
                    placeholder="0.00"
                    value={montoPago}
                    onChange={(e) => setMontoPago(e.target.value)}
                    max={selectedFactura.monto_pendiente}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Método de pago</Label>
                  <RadioGroup value={metodoPago} onValueChange={setMetodoPago} className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="efectivo" id="efectivo" />
                        <Label htmlFor="efectivo" className="cursor-pointer flex items-center gap-2">
                          <Banknote className="h-4 w-4" />
                          <span>Efectivo</span>
                        </Label>
                      </div>
                      <span
                        className={cn(
                          "font-medium text-sm",
                          (saldos?.efectivo || 0) >= Number(montoPago || 0) ? "text-green-600" : "text-destructive"
                        )}
                      >
                        Disponible: {formatCurrency(saldos?.efectivo || 0)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="transferencia" id="transferencia" />
                        <Label htmlFor="transferencia" className="cursor-pointer flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>Transferencia / Bancos</span>
                        </Label>
                      </div>
                      <span
                        className={cn(
                          "font-medium text-sm",
                          (saldos?.bancos || 0) >= Number(montoPago || 0) ? "text-green-600" : "text-destructive"
                        )}
                      >
                        Disponible: {formatCurrency(saldos?.bancos || 0)}
                      </span>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPagoDialogOpen(false);
                      resetPagoForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleRegistrarPago} disabled={registrarPagoMutation.isPending}>
                    {registrarPagoMutation.isPending ? "Registrando..." : "Registrar Pago"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={historialDialogOpen} onOpenChange={setHistorialDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Historial de Pagos</DialogTitle>
              <DialogDescription>Pagos realizados para: {selectedFactura?.descripcion}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {selectedFactura && (
                <div className="p-4 bg-muted rounded-lg grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Monto Total</p>
                    <p className="font-bold">{formatCurrency(selectedFactura.monto_total)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Pagado</p>
                    <p className="font-bold text-green-600">{formatCurrency(selectedFactura.monto_pagado)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pendiente</p>
                    <p className="font-bold text-destructive">{formatCurrency(selectedFactura.monto_pendiente || 0)}</p>
                  </div>
                </div>
              )}

              {historialPagos && historialPagos.length > 0 ? (
                <div className="space-y-2">
                  {historialPagos.map((pago, index) => (
                    <div key={pago.id || String(index)} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{format(new Date(pago.fecha), "d 'de' MMMM, yyyy", { locale: es })}</span>
                          {pago.es_pago_inicial && (
                            <Badge variant="secondary" className="ml-2">
                              Anticipo
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground capitalize">
                            {pago.metodo_pago?.replace("_", " ").replace("-", " ") || "N/A"}
                          </span>
                        </div>
                        {pago.descripcion && <p className="text-xs text-muted-foreground">{pago.descripcion}</p>}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-green-600">{formatCurrency(pago.monto)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No hay pagos registrados para esta factura</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={detalleContableOpen} onOpenChange={setDetalleContableOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Detalle Contable</DialogTitle>
            </DialogHeader>

            {loadingAsiento ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Cargando detalle contable...</p>
              </div>
            ) : !asientoContable ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No se encontró asiento contable para esta transacción</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Número de Asiento</p>
                    <p className="text-sm text-muted-foreground">{asientoContable.numero_asiento}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Fecha</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(asientoContable.fecha), "dd MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium">Descripción</p>
                  <p className="text-sm text-muted-foreground">{asientoContable.descripcion}</p>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuenta</TableHead>
                        <TableHead className="text-right">Debe</TableHead>
                        <TableHead className="text-right">Haber</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {asientoContable.detalle_asientos?.map((detalle) => (
                        <TableRow key={detalle.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{detalle.cuenta_codigo}</p>
                              <p className="text-sm text-muted-foreground">{detalle.cuentas?.nombre || detalle.descripcion}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{detalle.debe > 0 ? formatCurrency(detalle.debe) : "-"}</TableCell>
                          <TableCell className="text-right">{detalle.haber > 0 ? formatCurrency(detalle.haber) : "-"}</TableCell>
                        </TableRow>
                      ))}

                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(asientoContable.detalle_asientos?.reduce((sum, d) => sum + (d.debe || 0), 0) || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(asientoContable.detalle_asientos?.reduce((sum, d) => sum + (d.haber || 0), 0) || 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CuentasPorPagar;