import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
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
  Building2, 
  AlertCircle,
  AlertTriangle,
  TrendingUp, 
  Clock,
  ChevronRight,
  ChevronDown,
  History,
  CreditCard,
  FileText,
  Mail,
  Phone,
  Settings,
  Package,
  Receipt,
  Users,
  CheckCircle2,
  Eye,
  X,
} from "lucide-react";
import { useCuentasPorPagarAgrupadas, FacturaCxP } from "@/hooks/useCuentasPorPagarAgrupadas";
import { useAnalyticsCuentasPorPagar, useCuentasPorPagarDetalle } from "@/hooks/useAnalyticsCuentasPorPagar";
import { formatCurrency } from "@/lib/utils";

const CuentasPorPagar = () => {
  // Estados principales
  const [activeTab, setActiveTab] = useState("lista");
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string | null>(null);
  const [expandedProveedores, setExpandedProveedores] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  
  // Estados de dialogs
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<FacturaCxP | null>(null);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [historialDialogOpen, setHistorialDialogOpen] = useState(false);

  // Estados para Resumen de Transacciones
  const [filtroMesTransaccion, setFiltroMesTransaccion] = useState<string>("todos");
  const [filtroAnoTransaccion, setFiltroAnoTransaccion] = useState<string>("todos");
  const [filtroProveedorTransaccion, setFiltroProveedorTransaccion] = useState<string>("todos");
  const [filtroTipoEgreso, setFiltroTipoEgreso] = useState<string>("todos");
  const [filtroEstadoTransaccion, setFiltroEstadoTransaccion] = useState<string>("todos");
  const [filtroMetodoPago, setFiltroMetodoPago] = useState<string>("todos");
  const [ordenMontoTransaccion, setOrdenMontoTransaccion] = useState<string>("ninguno");
  const [detalleContableOpen, setDetalleContableOpen] = useState(false);
  const [selectedTransaccionId, setSelectedTransaccionId] = useState<string | null>(null);
  const [fuenteTransaccion, setFuenteTransaccion] = useState<'egreso' | 'capex' | null>(null);

  // Estados para analíticas
  const [formatoNumerosAnalitica, setFormatoNumerosAnalitica] = useState<'normal' | 'miles' | 'millones'>('normal');
  const [decimalesAnalitica, setDecimalesAnalitica] = useState<0 | 1 | 2>(2);

  // Hooks de datos
  const { data: tiposCxP, isLoading } = useCuentasPorPagarAgrupadas();
  const { data: analytics, isLoading: loadingAnalytics } = useAnalyticsCuentasPorPagar();
  const { data: detalles, isLoading: loadingDetalles } = useCuentasPorPagarDetalle();
  const queryClient = useQueryClient();

  // Query para todas las transacciones (incluye pagadas)
  const { data: todasTransaccionesCxP, isLoading: loadingTransaccionesCxP } = useQuery({
    queryKey: ["todas-transacciones-cxp"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { data: egresos, error: egresosError } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .eq("user_id", user.id)
        .eq("estado", "activo")
        .order("created_at", { ascending: false });

      if (egresosError) throw egresosError;

      const { data: inversiones, error: inversionesError } = await supabase
        .from("inversiones_capex")
        .select("*")
        .eq("user_id", user.id)
        .eq("estado", "activo")
        .order("created_at", { ascending: false });

      if (inversionesError) throw inversionesError;

      const egresosNormalizados = (egresos || []).map((e: any) => ({
        id: e.id,
        created_at: e.created_at,
        fecha: e.created_at,
        proveedor_nombre: e.proveedor_nombre || "Sin especificar",
        descripcion: e.descripcion,
        tipo: e.tipo_egreso,
        subtipo: e.subtipo_egreso || "-",
        monto_total: e.monto_total,
        monto_pagado: e.monto_pagado,
        monto_pendiente: e.monto_pendiente || 0,
        tipo_pago: e.tipo_pago,
        metodo_pago: e.metodo_pago || "-",
        fecha_vencimiento: e.fecha_vencimiento,
        estado: e.estado,
        fuente: 'egreso' as const
      }));

      const inversionesNormalizadas = (inversiones || []).map((inv: any) => ({
        id: inv.id,
        created_at: inv.created_at,
        fecha: inv.fecha_adquisicion,
        proveedor_nombre: inv.proveedor_nombre || "Sin especificar",
        descripcion: inv.producto_nombre + (inv.descripcion ? ` - ${inv.descripcion}` : ''),
        tipo: 'Inversión CAPEX',
        subtipo: inv.categoria_activo,
        monto_total: inv.valor_total,
        monto_pagado: inv.monto_pagado,
        monto_pendiente: inv.monto_pendiente || 0,
        tipo_pago: inv.tipo_pago,
        metodo_pago: inv.metodo_pago || "-",
        fecha_vencimiento: inv.fecha_vencimiento,
        estado: inv.estado,
        fuente: 'capex' as const
      }));

      return [...egresosNormalizados, ...inversionesNormalizadas]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  // Query para asiento contable
  const { data: asientoContable, isLoading: loadingAsiento } = useQuery({
    queryKey: ["asiento-contable-cxp", selectedTransaccionId, fuenteTransaccion],
    queryFn: async () => {
      if (!selectedTransaccionId || !fuenteTransaccion) return null;

    let numeroAsiento = '';
    if (fuenteTransaccion === 'egreso') {
      numeroAsiento = `EGR-${selectedTransaccionId}`;
    } else {
      numeroAsiento = `INV-${selectedTransaccionId}`;
    }

      const { data: asiento, error } = await supabase
        .from("asientos_contables")
        .select(`
          *,
          detalle_asientos (
            *,
            cuentas:cuenta_codigo (nombre)
          )
        `)
        .eq("numero_asiento", numeroAsiento)
        .single();

      if (error) return null;
      return asiento;
    },
    enabled: !!selectedTransaccionId && !!fuenteTransaccion && detalleContableOpen,
  });

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('cuentas-por-pagar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transacciones_egresos' }, () => {
        queryClient.invalidateQueries({ queryKey: ["cuentas-por-pagar-agrupadas"] });
        queryClient.invalidateQueries({ queryKey: ["todas-transacciones-cxp"] });
        queryClient.invalidateQueries({ queryKey: ["analytics-cuentas-por-pagar-consolidadas"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inversiones_capex' }, () => {
        queryClient.invalidateQueries({ queryKey: ["cuentas-por-pagar-agrupadas"] });
        queryClient.invalidateQueries({ queryKey: ["todas-transacciones-cxp"] });
        queryClient.invalidateQueries({ queryKey: ["analytics-cuentas-por-pagar-consolidadas"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Query para historial de pagos
  const { data: historialPagos } = useQuery({
    queryKey: ['historial-pagos-cxp', selectedFactura?.id],
    queryFn: async () => {
      if (!selectedFactura) return [];
      
      const { data } = await supabase
        .from('transacciones_cobros_pagos')
        .select('*')
        .eq('referencia_id', selectedFactura.id)
        .eq('tipo_transaccion', 'pago')
        .order('fecha', { ascending: false });
      
      return data || [];
    },
    enabled: !!selectedFactura && historialDialogOpen
  });

  // Mutación para registrar pago
  const registrarPagoMutation = useMutation({
    mutationFn: async ({ facturaId, monto, metodo, tipo }: { facturaId: string; monto: number; metodo: string; tipo: 'egreso' | 'capex' }) => {
      const factura = selectedFactura;
      if (!factura) throw new Error("Factura no encontrada");

      const nuevoMontoPendiente = (factura.monto_pendiente || 0) - monto;
      const nuevoMontoPagado = (factura.monto_pagado || 0) + monto;

      let error;
      let tablaReferencia = '';
      
      if (tipo === 'egreso') {
        const result = await supabase
          .from('transacciones_egresos')
          .update({
            monto_pendiente: Math.max(0, nuevoMontoPendiente),
            monto_pagado: nuevoMontoPagado,
            tipo_pago: nuevoMontoPendiente <= 0 ? 'contado' : 'parcial'
          })
          .eq('id', facturaId);
        error = result.error;
        tablaReferencia = 'transacciones_egresos';
      } else if (tipo === 'capex') {
        const result = await supabase
          .from('inversiones_capex')
          .update({
            monto_pendiente: Math.max(0, nuevoMontoPendiente),
            monto_pagado: nuevoMontoPagado,
            tipo_pago: nuevoMontoPendiente <= 0 ? 'total' : 'parcial'
          })
          .eq('id', facturaId);
        error = result.error;
        tablaReferencia = 'inversiones_capex';
      }

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { error: insertError } = await supabase
        .from('transacciones_cobros_pagos')
        .insert({
          user_id: user.id,
          tipo_transaccion: 'pago',
          referencia_id: facturaId,
          referencia_tabla: tablaReferencia,
          monto: monto,
          metodo_pago: metodo,
          fecha: new Date().toISOString().split('T')[0],
          descripcion: `Pago a ${factura.proveedor_nombre || 'Proveedor'}: ${factura.descripcion}`
        });

      if (insertError) throw insertError;
      
      return { facturaId, monto, metodo, tipo };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuentas-por-pagar-agrupadas"] });
      queryClient.invalidateQueries({ queryKey: ["todas-transacciones-cxp"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-cuentas-por-pagar-consolidadas"] });
      queryClient.invalidateQueries({ queryKey: ['historial-pagos-cxp'] });
      toast.success("Pago registrado exitosamente");
      setPagoDialogOpen(false);
      resetPagoForm();
    },
    onError: (error: any) => {
      toast.error("Error al registrar el pago: " + error.message);
    }
  });

  // Función para formatear números según preferencias
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

  // Handlers
  const toggleProveedor = (nombreProveedor: string) => {
    const newSet = new Set(expandedProveedores);
    if (newSet.has(nombreProveedor)) {
      newSet.delete(nombreProveedor);
    } else {
      newSet.add(nombreProveedor);
    }
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

    // Validar saldo disponible
    if (metodoPago === "efectivo") {
      const { data: detalles } = await supabase
        .from("detalle_asientos")
        .select("cuenta_codigo, debe, haber, asientos_contables!inner(user_id)")
        .eq("cuenta_codigo", "1001")
        .eq("asientos_contables.user_id", (await supabase.auth.getUser()).data.user?.id);

      let efectivo = 0;
      detalles?.forEach(detalle => {
        efectivo += (detalle.debe || 0) - (detalle.haber || 0);
      });

      if (monto > efectivo) {
        toast.error(`Saldo insuficiente en efectivo. Disponible: ${formatCurrency(efectivo)}`);
        return;
      }
    }

    if (metodoPago === "transferencia") {
      const { data: detalles } = await supabase
        .from("detalle_asientos")
        .select("cuenta_codigo, debe, haber, asientos_contables!inner(user_id)")
        .eq("cuenta_codigo", "1002")
        .eq("asientos_contables.user_id", (await supabase.auth.getUser()).data.user?.id);

      let bancos = 0;
      detalles?.forEach(detalle => {
        bancos += (detalle.debe || 0) - (detalle.haber || 0);
      });

      if (monto > bancos) {
        toast.error(`Saldo insuficiente en bancos. Disponible: ${formatCurrency(bancos)}`);
        return;
      }
    }

    registrarPagoMutation.mutate({
      facturaId: selectedFactura.id,
      monto: monto,
      metodo: metodoPago,
      tipo: selectedFactura.tipo_transaccion
    });
  };

  const getEstadoBadge = (fechaVencimiento: string | null, montoPendiente: number) => {
    if (montoPendiente === 0) {
      return <Badge variant="secondary">Pagado</Badge>;
    }
    
    if (!fechaVencimiento) {
      return <Badge variant="outline">Sin vencimiento</Badge>;
    }

    const fechaVence = new Date(fechaVencimiento);
    const hoy = new Date();
    
    if (fechaVence < hoy) {
      return <Badge variant="destructive">Vencida</Badge>;
    } else {
      return <Badge variant="default">Por vencer</Badge>;
    }
  };

  // Obtener tipo seleccionado
  const tipoActual = tiposCxP?.find(t => t.id === tipoSeleccionado);

  // Filtrar proveedores por búsqueda
  const proveedoresFiltrados = tipoActual?.proveedores.filter(prov =>
    prov.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prov.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prov.telefono?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prov.rfc?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Calcular KPIs generales
  const totalFacturas = tiposCxP?.reduce((sum, tipo) => sum + tipo.totalFacturas, 0) || 0;
  const totalPendiente = tiposCxP?.reduce((sum, tipo) => sum + tipo.totalPendiente, 0) || 0;
  
  const todasFacturas = tiposCxP?.flatMap(tipo => 
    tipo.proveedores.flatMap(prov => prov.facturas)
  ) || [];
  
  const hoy = new Date();
  const totalVencidas = todasFacturas.filter(f => 
    f.fecha_vencimiento && new Date(f.fecha_vencimiento) < hoy
  ).length;
  
  const totalPorVencer = todasFacturas.filter(f => 
    f.fecha_vencimiento && new Date(f.fecha_vencimiento) >= hoy
  ).length;

  // Filtros para Resumen de Transacciones
  const transaccionesFiltradas = useMemo(() => {
    if (!todasTransaccionesCxP) return [];

    let resultado = [...todasTransaccionesCxP];

    if (filtroMesTransaccion !== "todos") {
      resultado = resultado.filter(t => 
        new Date(t.created_at).getMonth() + 1 === parseInt(filtroMesTransaccion)
      );
    }

    if (filtroAnoTransaccion !== "todos") {
      resultado = resultado.filter(t => 
        new Date(t.created_at).getFullYear() === parseInt(filtroAnoTransaccion)
      );
    }

    if (filtroProveedorTransaccion !== "todos") {
      resultado = resultado.filter(t => t.proveedor_nombre === filtroProveedorTransaccion);
    }

    if (filtroTipoEgreso !== "todos") {
      resultado = resultado.filter(t => t.tipo === filtroTipoEgreso);
    }

    if (filtroEstadoTransaccion !== "todos") {
      if (filtroEstadoTransaccion === "completado") {
        resultado = resultado.filter(t => t.monto_pendiente === 0);
      } else if (filtroEstadoTransaccion === "enProgreso") {
        resultado = resultado.filter(t => t.monto_pendiente > 0 && t.monto_pagado > 0);
      } else if (filtroEstadoTransaccion === "sinPagar") {
        resultado = resultado.filter(t => t.monto_pagado === 0 && t.monto_pendiente > 0);
      }
    }

    if (filtroMetodoPago !== "todos") {
      resultado = resultado.filter(t => t.metodo_pago === filtroMetodoPago);
    }

    if (ordenMontoTransaccion === "menor") {
      resultado.sort((a, b) => a.monto_total - b.monto_total);
    } else if (ordenMontoTransaccion === "mayor") {
      resultado.sort((a, b) => b.monto_total - a.monto_total);
    }

    return resultado;
  }, [todasTransaccionesCxP, filtroMesTransaccion, filtroAnoTransaccion, filtroProveedorTransaccion, filtroTipoEgreso, filtroEstadoTransaccion, filtroMetodoPago, ordenMontoTransaccion]);

  // Listas únicas para filtros
  const proveedoresUnicos = useMemo(() => {
    if (!todasTransaccionesCxP) return [];
    const nombres = new Set(todasTransaccionesCxP.map(t => t.proveedor_nombre));
    return Array.from(nombres).sort();
  }, [todasTransaccionesCxP]);

  const tiposUnicos = useMemo(() => {
    if (!todasTransaccionesCxP) return [];
    const tipos = new Set(todasTransaccionesCxP.map(t => t.tipo));
    return Array.from(tipos).sort();
  }, [todasTransaccionesCxP]);

  const limpiarFiltrosTransacciones = () => {
    setFiltroMesTransaccion("todos");
    setFiltroAnoTransaccion("todos");
    setFiltroProveedorTransaccion("todos");
    setFiltroTipoEgreso("todos");
    setFiltroEstadoTransaccion("todos");
    setFiltroMetodoPago("todos");
    setOrdenMontoTransaccion("ninguno");
  };

  const getEstadoTransaccion = (transaccion: any) => {
    if (transaccion.monto_pendiente === 0) return "completado";
    if (transaccion.monto_pagado > 0) return "enProgreso";
    return "sinPagar";
  };

  const getPorcentajePagado = (transaccion: any) => {
    if (transaccion.monto_total === 0) return 0;
    return (transaccion.monto_pagado / transaccion.monto_total) * 100;
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
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cuentas por Pagar</h1>
            <p className="text-muted-foreground">
              Gestiona y da seguimiento a las cuentas pendientes de pago
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Lista de Cuentas
            </TabsTrigger>
            <TabsTrigger value="transacciones" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Resumen de Transacciones
            </TabsTrigger>
          </TabsList>

          {/* Tab: Lista de Cuentas */}
          <TabsContent value="lista" className="space-y-6">
            {/* Breadcrumb de navegación */}
            {tipoSeleccionado && (
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Button 
                        variant="ghost" 
                        onClick={() => {
                          setTipoSeleccionado(null);
                          setExpandedProveedores(new Set());
                          setSearchTerm("");
                        }}
                        className="h-auto p-0"
                      >
                        Todos los tipos
                      </Button>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-4 w-4" />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage>{tipoActual?.nombre}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            )}

            {/* KPIs Generales */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total por Pagar</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(totalPendiente)}
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

            {/* Vista Nivel 1: Cards de Tipos */}
            {!tipoSeleccionado && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {tiposCxP?.map(tipo => {
                  const Icon = tipo.icon;
                  return (
                    <Card 
                      key={tipo.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => setTipoSeleccionado(tipo.id)}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div 
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: `${tipo.color}15` }}
                          >
                            <Icon 
                              className="h-6 w-6" 
                              style={{ color: tipo.color }}
                            />
                          </div>
                          <CardTitle className="text-base">{tipo.nombre}</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                          {tipo.descripcion}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-3xl font-bold">
                          {formatCurrency(tipo.totalPendiente)}
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>Facturas pendientes</span>
                            <Badge variant="secondary">{tipo.totalFacturas}</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Proveedores</span>
                            <Badge variant="outline">{tipo.totalProveedores}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Vista Nivel 2 y 3: Lista de Proveedores y Facturas */}
            {tipoSeleccionado && tipoActual && (
              <div className="space-y-6">
                {/* Card de resumen del tipo seleccionado */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${tipoActual.color}15` }}
                        >
                          {(() => {
                            const Icon = tipoActual.icon;
                            return <Icon className="h-6 w-6" style={{ color: tipoActual.color }} />;
                          })()}
                        </div>
                        <div>
                          <CardTitle>{tipoActual.nombre}</CardTitle>
                          <CardDescription>{tipoActual.descripcion}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {formatCurrency(tipoActual.totalPendiente)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {tipoActual.totalFacturas} facturas • {tipoActual.totalProveedores} proveedores
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Barra de búsqueda */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar proveedor por nombre, email, teléfono o RFC..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Tabla de Proveedores */}
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Información de Contacto</TableHead>
                        <TableHead className="text-right">Total Pendiente</TableHead>
                        <TableHead className="text-center">Facturas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proveedoresFiltrados.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No se encontraron proveedores
                          </TableCell>
                        </TableRow>
                      ) : (
                        proveedoresFiltrados.map(proveedor => (
                          <>
                            {/* Fila del Proveedor */}
                            <TableRow 
                              key={proveedor.nombre}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleProveedor(proveedor.nombre)}
                            >
                              <TableCell>
                                {expandedProveedores.has(proveedor.nombre) ? 
                                  <ChevronDown className="h-4 w-4" /> : 
                                  <ChevronRight className="h-4 w-4" />
                                }
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{proveedor.nombre}</div>
                                {proveedor.rfc && (
                                  <div className="text-sm text-muted-foreground">RFC: {proveedor.rfc}</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1 text-sm">
                                  {proveedor.email && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Mail className="h-3 w-3" />
                                      {proveedor.email}
                                    </div>
                                  )}
                                  {proveedor.telefono && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Phone className="h-3 w-3" />
                                      {proveedor.telefono}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="font-bold">
                                  {formatCurrency(proveedor.totalPendiente)}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary">
                                  {proveedor.totalFacturas} {proveedor.totalFacturas === 1 ? 'factura' : 'facturas'}
                                </Badge>
                              </TableCell>
                            </TableRow>

                            {/* Facturas Expandidas */}
                            {expandedProveedores.has(proveedor.nombre) && proveedor.facturas.map(factura => (
                              <TableRow key={factura.id} className="bg-muted/30">
                                <TableCell></TableCell>
                                <TableCell colSpan={4}>
                                  <div className="pl-8 py-2">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1 space-y-2">
                                        <div className="flex items-start gap-3">
                                          <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                                          <div className="flex-1">
                                            <div className="font-medium">{factura.descripcion}</div>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                              <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(factura.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                                              </div>
                                              {factura.fecha_vencimiento && (
                                                <div className="flex items-center gap-1">
                                                  <Clock className="h-3 w-3" />
                                                  Vence: {format(new Date(factura.fecha_vencimiento), "d 'de' MMMM, yyyy", { locale: es })}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-6 text-sm pl-8">
                                          <div>
                                            <span className="text-muted-foreground">Total: </span>
                                            <span className="font-medium">{formatCurrency(factura.monto_total)}</span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Pagado: </span>
                                            <span className="font-medium text-success">{formatCurrency(factura.monto_pagado)}</span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Pendiente: </span>
                                            <span className="font-bold text-destructive">{formatCurrency(factura.monto_pendiente)}</span>
                                          </div>
                                          <div>
                                            {getEstadoBadge(factura.fecha_vencimiento, factura.monto_pendiente)}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex gap-2">
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
                            ))}
                          </>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Tab: Resumen de Transacciones */}
          <TabsContent value="transacciones" className="space-y-6">
            {/* KPIs de Transacciones */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Transacciones</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{todasTransaccionesCxP?.length || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completamente Pagadas</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {todasTransaccionesCxP?.filter(t => t.monto_pendiente === 0).length || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pagos Parciales</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">
                    {todasTransaccionesCxP?.filter(t => t.monto_pendiente > 0 && t.monto_pagado > 0).length || 0}
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
                    {todasTransaccionesCxP?.filter(t => t.monto_pagado === 0 && t.monto_pendiente > 0).length || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle>Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Mes */}
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
                            {new Date(2024, i, 1).toLocaleDateString('es-MX', { month: 'long' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Año */}
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
                          return <SelectItem key={year} value={String(year)}>{year}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Proveedor */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Proveedor</label>
                    <Select value={filtroProveedorTransaccion} onValueChange={setFiltroProveedorTransaccion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los proveedores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los proveedores</SelectItem>
                        {proveedoresUnicos.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tipo */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={filtroTipoEgreso} onValueChange={setFiltroTipoEgreso}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los tipos</SelectItem>
                        {tiposUnicos.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Estado */}
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

                  {/* Método de Pago */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Método de Pago</label>
                    <Select value={filtroMetodoPago} onValueChange={setFiltroMetodoPago}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los métodos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los métodos</SelectItem>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="-">No especificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ordenar */}
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

                  {/* Botón Limpiar */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">&nbsp;</label>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={limpiarFiltrosTransacciones}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Limpiar Filtros
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabla de Transacciones */}
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
                              <TableCell className="max-w-xs truncate">
                                {transaccion.descripcion}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{transaccion.tipo}</Badge>
                              </TableCell>
                              <TableCell>{transaccion.subtipo}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(transaccion.monto_total)}
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                {formatCurrency(transaccion.monto_pagado)}
                              </TableCell>
                              <TableCell className="text-right text-destructive">
                                {formatCurrency(transaccion.monto_pendiente)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  transaccion.tipo_pago === 'contado' ? 'default' : 
                                  transaccion.tipo_pago === 'credito' ? 'secondary' : 'outline'
                                }>
                                  {transaccion.tipo_pago}
                                </Badge>
                              </TableCell>
                              <TableCell className="capitalize">{transaccion.metodo_pago}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  estado === 'completado' ? 'default' :
                                  estado === 'enProgreso' ? 'secondary' : 'destructive'
                                }>
                                  {estado === 'completado' ? 'Completado' :
                                   estado === 'enProgreso' ? 'En Progreso' : 'Sin Pagar'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={porcentaje} className="w-16" />
                                  <span className="text-xs text-muted-foreground">
                                    {porcentaje.toFixed(0)}%
                                  </span>
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

        </Tabs>

        {/* Dialog: Registrar Pago */}
        <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pago</DialogTitle>
              <DialogDescription>
                Registra un pago para {selectedFactura?.proveedor_nombre || 'este proveedor'}
              </DialogDescription>
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
                    <span className="font-medium text-success">{formatCurrency(selectedFactura.monto_pagado)}</span>
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
                  <Label htmlFor="metodo">Método de pago</Label>
                  <Select value={metodoPago} onValueChange={setMetodoPago}>
                    <SelectTrigger id="metodo">
                      <SelectValue placeholder="Selecciona un método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="tarjeta_debito">Tarjeta de débito</SelectItem>
                      <SelectItem value="tarjeta_credito">Tarjeta de crédito</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Button
                    onClick={handleRegistrarPago}
                    disabled={registrarPagoMutation.isPending}
                  >
                    {registrarPagoMutation.isPending ? "Registrando..." : "Registrar Pago"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog: Historial de Pagos */}
        <Dialog open={historialDialogOpen} onOpenChange={setHistorialDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Historial de Pagos</DialogTitle>
              <DialogDescription>
                Pagos realizados para: {selectedFactura?.descripcion}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {historialPagos && historialPagos.length > 0 ? (
                <div className="space-y-2">
                  {historialPagos.map((pago: any) => (
                    <div key={pago.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(pago.fecha), "d 'de' MMMM, yyyy", { locale: es })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground capitalize">
                            {pago.metodo_pago}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-green-600">
                          {formatCurrency(pago.monto)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay pagos registrados para esta factura
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Detalle Contable */}
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
                      {asientoContable.detalle_asientos?.map((detalle: any) => (
                        <TableRow key={detalle.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{detalle.cuenta_codigo}</p>
                              <p className="text-sm text-muted-foreground">
                                {detalle.cuentas?.nombre || detalle.descripcion}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {detalle.debe > 0 ? formatCurrency(detalle.debe) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {detalle.haber > 0 ? formatCurrency(detalle.haber) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            asientoContable.detalle_asientos?.reduce((sum: number, d: any) => sum + (d.debe || 0), 0) || 0
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            asientoContable.detalle_asientos?.reduce((sum: number, d: any) => sum + (d.haber || 0), 0) || 0
                          )}
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