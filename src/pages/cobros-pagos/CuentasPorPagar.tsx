import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  BarChart3,
  TrendingUp, 
  Clock,
  ChevronRight,
  ChevronDown,
  History,
  CreditCard,
  FileText,
  Mail,
  Phone,
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  LabelList
} from "recharts";
import { useCuentasPorPagarAgrupadas, TipoCxP, ProveedorAgrupado, FacturaCxP } from "@/hooks/useCuentasPorPagarAgrupadas";
import { useAnalyticsCuentasPorPagarConsolidadas } from "@/hooks/useCuentasPorPagarConsolidadas";
import { formatCurrency } from "@/lib/utils";

const COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  destructive: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
  success: "hsl(var(--success))"
};

const PIE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.destructive];

// Componente para labels personalizados
const CustomTotalLabel = (props: any) => {
  const { x, y, width, height, index, filtroAntiguedad, dataFiltradaProveedor, formatearConPreferenciasAnalitica } = props;
  
  if (!dataFiltradaProveedor || !dataFiltradaProveedor[index]) return null;
  
  const proveedor = dataFiltradaProveedor[index];
  const total = filtroAntiguedad === "todos" 
    ? proveedor.total 
    : proveedor[filtroAntiguedad] || 0;
  
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

  // Estados para analíticas
  const [periodoCxP, setPeriodoCxP] = useState<"diario" | "mensual" | "anual">("mensual");
  const [filtroAntiguedad, setFiltroAntiguedad] = useState("todos");
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>("todos");
  const [formatoNumerosAnalitica, setFormatoNumerosAnalitica] = useState<'normal' | 'miles' | 'millones'>('normal');
  const [decimalesAnalitica, setDecimalesAnalitica] = useState<0 | 1 | 2>(2);

  // Hooks de datos
  const { data: tiposCxP, isLoading } = useCuentasPorPagarAgrupadas();
  const { data: analytics, isLoading: loadingAnalytics } = useAnalyticsCuentasPorPagarConsolidadas(periodoCxP);
  const queryClient = useQueryClient();

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('cuentas-por-pagar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transacciones_egresos' }, () => {
        queryClient.invalidateQueries({ queryKey: ["cuentas-por-pagar-agrupadas"] });
        queryClient.invalidateQueries({ queryKey: ["analytics-cuentas-por-pagar-consolidadas"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inversiones_capex' }, () => {
        queryClient.invalidateQueries({ queryKey: ["cuentas-por-pagar-agrupadas"] });
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
            <TabsTrigger value="analiticas" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analíticas
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

          {/* Tab: Analíticas */}
          <TabsContent value="analiticas" className="space-y-6">
            {loadingAnalytics ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Cargando analíticas...</div>
              </div>
            ) : (
              <>
                {/* Filtros y Configuración */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Filtros de Período */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Período de Análisis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Select value={periodoCxP} onValueChange={(val: any) => setPeriodoCxP(val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diario">Diario</SelectItem>
                          <SelectItem value="mensual">Mensual</SelectItem>
                          <SelectItem value="anual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>

                  {/* Configuración de Formato */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Configuración
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Label className="text-sm min-w-[80px]">Formato:</Label>
                        <Select 
                          value={formatoNumerosAnalitica} 
                          onValueChange={(val: any) => setFormatoNumerosAnalitica(val)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="miles">Miles (K)</SelectItem>
                            <SelectItem value="millones">Millones (M)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3">
                        <Label className="text-sm min-w-[80px]">Decimales:</Label>
                        <Select 
                          value={decimalesAnalitica.toString()} 
                          onValueChange={(val) => setDecimalesAnalitica(parseInt(val) as 0 | 1 | 2)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0 decimales</SelectItem>
                            <SelectItem value="1">1 decimal</SelectItem>
                            <SelectItem value="2">2 decimales</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* KPIs Principales */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(analytics?.totalPendiente || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Proveedores</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analytics?.totalProveedores || 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Promedio Deuda</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(analytics?.promedioDeuda || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Facturas Pendientes</CardTitle>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">
                        {analytics?.todasCuentas?.length || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Gráficas */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Distribución por Tipo */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Distribución por Tipo
                      </CardTitle>
                      <CardDescription>
                        Cuentas por pagar agrupadas por categoría
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={analytics?.distribucionPorTipo || []}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ tipo, monto }) => `${tipo}: ${formatearConPreferenciasAnalitica(monto)}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="monto"
                          >
                            {(analytics?.distribucionPorTipo || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => formatearConPreferenciasAnalitica(value)}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Análisis de Antigüedad */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Análisis de Antigüedad
                      </CardTitle>
                      <CardDescription>
                        Distribución de cuentas por días de vencimiento
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analytics?.agingAnalysisDetailed || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="rango" 
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                          />
                          <YAxis 
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                            tickFormatter={(value) => formatearConPreferenciasAnalitica(value)}
                          />
                          <Tooltip
                            formatter={(value: number) => formatearConPreferenciasAnalitica(value)}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              color: 'hsl(var(--foreground))'
                            }}
                          />
                          <Bar dataKey="monto" fill={COLORS.primary} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Histórico de CxP */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Histórico de Cuentas por Pagar
                    </CardTitle>
                    <CardDescription>
                      Evolución del saldo de CxP en el tiempo
                    </CardDescription>
                  </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analytics?.historicoCxP || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="fecha" 
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                          />
                          <YAxis 
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                            tickFormatter={(value) => formatearConPreferenciasAnalitica(value)}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              color: 'hsl(var(--foreground))'
                            }}
                            formatter={(value: number) => [
                              formatearConPreferenciasAnalitica(value),
                              'Saldo CxP'
                            ]}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="saldo" 
                            stroke={COLORS.primary} 
                            strokeWidth={2}
                            dot={{ fill: COLORS.primary, r: 4 }}
                            label={{
                              position: 'top',
                              fill: 'hsl(var(--foreground))',
                              fontSize: 12,
                              formatter: (value: number) => formatearConPreferenciasAnalitica(value)
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                </Card>
              </>
            )}
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
                            {pago.metodo_pago.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-success">
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
      </div>
    </div>
  );
};

export default CuentasPorPagar;
