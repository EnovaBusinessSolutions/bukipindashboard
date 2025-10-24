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
  Users, 
  Clock, 
  Target,
  CheckCircle2
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
import { useCuentasPorPagarConsolidadas, useAnalyticsCuentasPorPagarConsolidadas } from "@/hooks/useCuentasPorPagarConsolidadas";

const COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  destructive: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
  success: "hsl(var(--success))"
};

const PIE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.destructive];

const CuentasPorPagar = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("lista");
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [selectedCuenta, setSelectedCuenta] = useState<any>(null);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  
  // Estados para filtros de transacciones
  const [filtroMesTransaccion, setFiltroMesTransaccion] = useState("todos");
  const [filtroAnoTransaccion, setFiltroAnoTransaccion] = useState("todos");
  const [filtroProveedorTransaccion, setFiltroProveedorTransaccion] = useState("todos");
  const [filtroEstadoTransaccion, setFiltroEstadoTransaccion] = useState("todos");
  const [filtroMetodoPago, setFiltroMetodoPago] = useState("todos");
  const [ordenMontoTransaccion, setOrdenMontoTransaccion] = useState("mayorMenor");
  
  // Estados para analíticas
  const [periodoCxP, setPeriodoCxP] = useState<"diario" | "mensual" | "anual">("mensual");
  const [escalaHistorico, setEscalaHistorico] = useState("normal");
  const [filtroAntiguedad, setFiltroAntiguedad] = useState("todos");
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>("todos");

  const { data: cuentasPorPagar, isLoading } = useCuentasPorPagarConsolidadas();

  const queryClient = useQueryClient();

  // Real-time updates para las 3 tablas
  useEffect(() => {
    const channel = supabase
      .channel('cuentas-por-pagar-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacciones_egresos'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["cuentas-por-pagar-consolidadas"] });
          queryClient.invalidateQueries({ queryKey: ["analytics-cuentas-por-pagar-consolidadas"] });
          queryClient.invalidateQueries({ queryKey: ["todas-transacciones-cxp"] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inversiones_capex'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["cuentas-por-pagar-consolidadas"] });
          queryClient.invalidateQueries({ queryKey: ["analytics-cuentas-por-pagar-consolidadas"] });
          queryClient.invalidateQueries({ queryKey: ["todas-transacciones-cxp"] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'movimientos_inventario'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["cuentas-por-pagar-consolidadas"] });
          queryClient.invalidateQueries({ queryKey: ["analytics-cuentas-por-pagar-consolidadas"] });
          queryClient.invalidateQueries({ queryKey: ["todas-transacciones-cxp"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Hook para analíticas consolidadas con período dinámico
  const { data: analytics, isLoading: loadingAnalytics } = useAnalyticsCuentasPorPagarConsolidadas(periodoCxP);
  
  // Obtener todas las transacciones para el resumen
  const { data: todasTransacciones, isLoading: loadingTransacciones } = useQuery({
    queryKey: ["todas-transacciones-cxp"],
    queryFn: async () => {
      const allTransactions = [];
      
      // Obtener egresos
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (egresos) {
        allTransactions.push(...egresos.map(e => ({
          ...e,
          tipo_transaccion: 'egreso' as const
        })));
      }
      
      // Obtener inversiones
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (inversiones) {
        allTransactions.push(...inversiones.map(i => ({
          ...i,
          tipo_transaccion: 'capex' as const,
          monto_total: i.valor_total,
          descripcion: i.descripcion || i.producto_nombre
        })));
      }
      
      return allTransactions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
  });

  // Mutación para registrar pago (maneja tanto egresos como inversiones)
  const registrarPagoMutation = useMutation({
    mutationFn: async ({ cuentaId, monto, metodo, tipo }: { cuentaId: string; monto: number; metodo: string; tipo: 'egreso' | 'capex' | 'inventario' }) => {
      const cuenta = cuentasPorPagar?.find(c => c.id === cuentaId);
      if (!cuenta) throw new Error("Cuenta no encontrada");

      const nuevoMontoPendiente = (cuenta.monto_pendiente || 0) - monto;
      const nuevoMontoPagado = (cuenta.monto_pagado || 0) + monto;

      let error;
      
      if (tipo === 'egreso') {
        const result = await supabase
          .from('transacciones_egresos')
          .update({
            monto_pendiente: Math.max(0, nuevoMontoPendiente),
            monto_pagado: nuevoMontoPagado,
            tipo_pago: nuevoMontoPendiente <= 0 ? 'contado' : 'parcial'
          })
          .eq('id', cuentaId);
        error = result.error;
      } else if (tipo === 'capex') {
        const result = await supabase
          .from('inversiones_capex')
          .update({
            monto_pendiente: Math.max(0, nuevoMontoPendiente),
            monto_pagado: nuevoMontoPagado,
            tipo_pago: nuevoMontoPendiente <= 0 ? 'total' : 'parcial'
          })
          .eq('id', cuentaId);
        error = result.error;
      }

      if (error) throw error;
      
      return { cuentaId, monto, metodo, tipo };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuentas-por-pagar-consolidadas"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-cuentas-por-pagar-consolidadas"] });
      queryClient.invalidateQueries({ queryKey: ["todas-transacciones-cxp"] });
      toast.success("Pago registrado exitosamente");
      setPagoDialogOpen(false);
      resetPagoForm();
    },
    onError: (error: any) => {
      toast.error("Error al registrar el pago: " + error.message);
    }
  });

  const filteredCuentas = cuentasPorPagar?.filter(
    (cuenta) =>
      cuenta.proveedor_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cuenta.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cuenta.proveedor_telefono?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cuenta.proveedor_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cuenta.proveedor_rfc?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalPorPagar = filteredCuentas.reduce((sum, cuenta) => sum + (cuenta.monto_pendiente || 0), 0);
  const vencidas = filteredCuentas.filter(cuenta => 
    cuenta.fecha_vencimiento && new Date(cuenta.fecha_vencimiento) < new Date()
  ).length;
  const porVencer = filteredCuentas.filter(cuenta => 
    cuenta.fecha_vencimiento && new Date(cuenta.fecha_vencimiento) >= new Date()
  ).length;

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

    registrarPagoMutation.mutate({
      cuentaId: selectedCuenta.id,
      monto: monto,
      metodo: metodoPago,
      tipo: selectedCuenta.tipo_transaccion
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
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
            {/* Métricas Resumen */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total por Pagar</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${totalPorPagar.toLocaleString('es-CO')}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cuentas Vencidas</CardTitle>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{vencidas}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Por Vencer</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{porVencer}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cuentas</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filteredCuentas.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Filtrar Cuentas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                          <Input
                            placeholder="Buscar por proveedor, descripción, teléfono, email o RFC..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabla de Cuentas por Pagar */}
            <Card>
              <CardHeader>
                <CardTitle>Listado de Cuentas por Pagar</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredCuentas.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No se encontraron cuentas por pagar.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Información de Contacto</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Desglose de Montos</TableHead>
                          <TableHead>Estado de Pago</TableHead>
                          <TableHead>Fecha Vencimiento</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCuentas.map((cuenta) => (
                          <TableRow key={cuenta.id}>
                            <TableCell>
                              <Badge variant={
                                cuenta.tipo_transaccion === 'egreso' ? 'secondary' :
                                cuenta.tipo_transaccion === 'capex' ? 'default' : 'outline'
                              }>
                                {cuenta.tipo_transaccion === 'egreso' ? '💰 Egreso' :
                                 cuenta.tipo_transaccion === 'capex' ? '🏭 CAPEX' : '📦 Inventario'}
                              </Badge>
                              {cuenta.producto_nombre && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {cuenta.producto_nombre}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {cuenta.proveedor_nombre || "Sin especificar"}
                            </TableCell>
                            <TableCell className="min-w-[200px]">
                              <div className="space-y-1">
                                {cuenta.proveedor_telefono && (
                                  <div className="text-sm">
                                    📞 {cuenta.proveedor_telefono}
                                  </div>
                                )}
                                {cuenta.proveedor_email && (
                                  <div className="text-sm">
                                    📧 {cuenta.proveedor_email}
                                  </div>
                                )}
                                {cuenta.proveedor_rfc && (
                                  <div className="text-sm">
                                    🆔 {cuenta.proveedor_rfc}
                                  </div>
                                )}
                                {!cuenta.proveedor_telefono && !cuenta.proveedor_email && !cuenta.proveedor_rfc && (
                                  <span className="text-muted-foreground text-sm">Sin información de contacto</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{cuenta.descripcion}</TableCell>
                            <TableCell className="min-w-[280px]">
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-muted-foreground">Total original:</span>
                                  <span className="font-medium">${cuenta.monto_total.toLocaleString('es-CO')}</span>
                                </div>
                                {cuenta.monto_pagado > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Pagado:</span>
                                    <span className="text-success">+${cuenta.monto_pagado.toLocaleString('es-CO')}</span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center border-t pt-1">
                                  <span className="text-sm font-medium">Pendiente:</span>
                                  <span className="font-bold text-lg text-primary">
                                    ${cuenta.monto_pendiente?.toLocaleString('es-CO') || 0}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge variant={cuenta.tipo_pago === 'contado' ? 'default' : cuenta.tipo_pago === 'parcial' ? 'secondary' : 'outline'}>
                                  {cuenta.tipo_pago === 'contado' ? 'Contado' : 
                                   cuenta.tipo_pago === 'parcial' ? 'Pago Parcial' : 
                                   'A Crédito'}
                                </Badge>
                                {cuenta.metodo_pago && (
                                  <div className="text-xs text-muted-foreground">
                                    {cuenta.metodo_pago === 'efectivo' ? 'Efectivo' : 'Tarjeta/Banco'}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {cuenta.fecha_vencimiento ? (
                                <div className="space-y-1">
                                  <div className="text-sm font-medium">
                                    {format(new Date(cuenta.fecha_vencimiento), "dd/MM/yyyy", { locale: es })}
                                  </div>
                                  <div className="text-xs">
                                    {(() => {
                                      const today = new Date();
                                      const dueDate = new Date(cuenta.fecha_vencimiento);
                                      const diffTime = dueDate.getTime() - today.getTime();
                                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                      
                                      if (diffDays < 0) {
                                        return <span className="text-destructive">Vencido hace {Math.abs(diffDays)} días</span>;
                                      } else if (diffDays === 0) {
                                        return <span className="text-warning">Vence hoy</span>;
                                      } else {
                                        return <span className="text-muted-foreground">Vence en {diffDays} días</span>;
                                      }
                                    })()}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Sin fecha</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {getEstadoBadge(cuenta.fecha_vencimiento, cuenta.monto_pendiente)}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => openPagoDialog(cuenta)}
                              >
                                Registrar Pago
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Resumen de Transacciones */}
          <TabsContent value="transacciones" className="space-y-6">
            {loadingTransacciones ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Cargando transacciones...</div>
              </div>
            ) : (
              <>
                {/* KPIs de Transacciones */}
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
                        {todasTransacciones?.filter(t => t.monto_pendiente === 0).length || 0}
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
                        {todasTransacciones?.filter(t => t.monto_pendiente > 0 && t.monto_pagado > 0).length || 0}
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
                        {todasTransacciones?.filter(t => t.monto_pagado === 0 && t.monto_pendiente > 0).length || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabla de Transacciones Completas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Historial Completo de Transacciones
                    </CardTitle>
                    <CardDescription>
                      Trazabilidad de todas las transacciones de pagos, desde su creación hasta su liquidación
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Filtros para transacciones */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                      {/* Filtro por mes */}
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

                      {/* Filtro por año */}
                      <div>
                        <Label htmlFor="filtro-ano-transaccion" className="mb-2 block">Año</Label>
                        <Select value={filtroAnoTransaccion} onValueChange={setFiltroAnoTransaccion}>
                          <SelectTrigger id="filtro-ano-transaccion" className="bg-background">
                            <SelectValue placeholder="Todos los años" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="todos">Todos los años</SelectItem>
                            {Array.from(new Set((todasTransacciones || [])
                              .map(t => new Date(t.created_at).getFullYear())))
                              .sort((a, b) => b - a)
                              .map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Filtro por proveedor */}
                      <div>
                        <Label htmlFor="filtro-proveedor-transaccion" className="mb-2 block">Proveedor</Label>
                        <Select value={filtroProveedorTransaccion} onValueChange={setFiltroProveedorTransaccion}>
                          <SelectTrigger id="filtro-proveedor-transaccion" className="bg-background">
                            <SelectValue placeholder="Todos los proveedores" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="todos">Todos los proveedores</SelectItem>
                            {Array.from(new Set((todasTransacciones || [])
                              .map(t => t.proveedor_nombre)
                              .filter(Boolean)))
                              .sort()
                              .map((proveedor) => (
                                <SelectItem key={proveedor} value={proveedor!}>
                                  {proveedor}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Filtro por estado */}
                      <div>
                        <Label htmlFor="filtro-estado-transaccion" className="mb-2 block">Estado</Label>
                        <Select value={filtroEstadoTransaccion} onValueChange={setFiltroEstadoTransaccion}>
                          <SelectTrigger id="filtro-estado-transaccion" className="bg-background">
                            <SelectValue placeholder="Todos los estados" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="todos">Todos los estados</SelectItem>
                            <SelectItem value="completado">Completamente Pagado</SelectItem>
                            <SelectItem value="enProgreso">En Progreso (Pago Parcial)</SelectItem>
                            <SelectItem value="sinPagar">Sin Pagar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Filtro por método de pago */}
                      <div>
                        <Label htmlFor="filtro-metodo-pago" className="mb-2 block">Método de Pago</Label>
                        <Select value={filtroMetodoPago} onValueChange={setFiltroMetodoPago}>
                          <SelectTrigger id="filtro-metodo-pago" className="bg-background">
                            <SelectValue placeholder="Todos los métodos" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="todos">Todos los métodos</SelectItem>
                            {Array.from(new Set((todasTransacciones || [])
                              .map(t => t.metodo_pago)
                              .filter(Boolean)))
                              .sort()
                              .map((metodo) => (
                                <SelectItem key={metodo} value={metodo!}>
                                  {metodo}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Ordenar por monto */}
                      <div>
                        <Label htmlFor="orden-monto" className="mb-2 block">Ordenar por Monto</Label>
                        <Select value={ordenMontoTransaccion} onValueChange={setOrdenMontoTransaccion}>
                          <SelectTrigger id="orden-monto" className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="mayorMenor">Mayor a Menor</SelectItem>
                            <SelectItem value="menorMayor">Menor a Mayor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Botón limpiar filtros */}
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setFiltroMesTransaccion("todos");
                            setFiltroAnoTransaccion("todos");
                            setFiltroProveedorTransaccion("todos");
                            setFiltroEstadoTransaccion("todos");
                            setFiltroMetodoPago("todos");
                            setOrdenMontoTransaccion("mayorMenor");
                          }}
                        >
                          Limpiar Filtros
                        </Button>
                      </div>
                    </div>

                    {/* Tabla filtrada */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha Registro</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Monto Total</TableHead>
                            <TableHead>Monto Pagado</TableHead>
                            <TableHead>Monto Pendiente</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Método de Pago</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            let transaccionesFiltradas = todasTransacciones || [];
                            
                            // Aplicar filtros
                            if (filtroMesTransaccion !== "todos") {
                              transaccionesFiltradas = transaccionesFiltradas.filter(t => 
                                new Date(t.created_at).getMonth() + 1 === parseInt(filtroMesTransaccion)
                              );
                            }
                            
                            if (filtroAnoTransaccion !== "todos") {
                              transaccionesFiltradas = transaccionesFiltradas.filter(t => 
                                new Date(t.created_at).getFullYear() === parseInt(filtroAnoTransaccion)
                              );
                            }
                            
                            if (filtroProveedorTransaccion !== "todos") {
                              transaccionesFiltradas = transaccionesFiltradas.filter(t => 
                                t.proveedor_nombre === filtroProveedorTransaccion
                              );
                            }
                            
                            if (filtroEstadoTransaccion !== "todos") {
                              transaccionesFiltradas = transaccionesFiltradas.filter(t => {
                                if (filtroEstadoTransaccion === "completado") return t.monto_pendiente === 0;
                                if (filtroEstadoTransaccion === "enProgreso") return t.monto_pendiente > 0 && t.monto_pagado > 0;
                                if (filtroEstadoTransaccion === "sinPagar") return t.monto_pagado === 0 && t.monto_pendiente > 0;
                                return true;
                              });
                            }
                            
                            if (filtroMetodoPago !== "todos") {
                              transaccionesFiltradas = transaccionesFiltradas.filter(t => 
                                t.metodo_pago === filtroMetodoPago
                              );
                            }
                            
                            // Ordenar por monto
                            transaccionesFiltradas = [...transaccionesFiltradas].sort((a, b) => {
                              if (ordenMontoTransaccion === "mayorMenor") {
                                return b.monto_total - a.monto_total;
                              } else {
                                return a.monto_total - b.monto_total;
                              }
                            });
                            
                            if (transaccionesFiltradas.length === 0) {
                              return (
                                <TableRow>
                                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                    No se encontraron transacciones con los filtros aplicados
                                  </TableCell>
                                </TableRow>
                              );
                            }
                            
                            return transaccionesFiltradas.map((transaccion) => (
                              <TableRow key={transaccion.id}>
                                <TableCell>
                                  {format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    transaccion.tipo_transaccion === 'egreso' ? 'secondary' : 'default'
                                  }>
                                    {transaccion.tipo_transaccion === 'egreso' ? 'Egreso' : 'CAPEX'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {transaccion.proveedor_nombre || "Sin especificar"}
                                </TableCell>
                                <TableCell className="max-w-xs truncate">
                                  {transaccion.descripcion || "Sin descripción"}
                                </TableCell>
                                <TableCell className="font-medium">
                                  ${transaccion.monto_total.toLocaleString('es-MX')}
                                </TableCell>
                                <TableCell className="text-success">
                                  ${transaccion.monto_pagado.toLocaleString('es-MX')}
                                </TableCell>
                                <TableCell className="font-bold text-primary">
                                  ${transaccion.monto_pendiente.toLocaleString('es-MX')}
                                </TableCell>
                                <TableCell>
                                  {transaccion.monto_pendiente === 0 ? (
                                    <Badge variant="default">Completado</Badge>
                                  ) : transaccion.monto_pagado > 0 ? (
                                    <Badge variant="secondary">En Progreso</Badge>
                                  ) : (
                                    <Badge variant="destructive">Sin Pagar</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {transaccion.metodo_pago ? (
                                    <span className="text-sm">{transaccion.metodo_pago}</span>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ));
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Tab 3: Analíticas */}
          <TabsContent value="analiticas" className="space-y-6">
            {loadingAnalytics ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground">Cargando analíticas...</div>
              </div>
            ) : analytics ? (
              <>
                {/* Métricas Principales */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${analytics.totalPendiente.toLocaleString('es-MX')}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Proveedores</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{analytics.totalProveedores}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Promedio por Deuda</CardTitle>
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
                          .filter(a => a.min && a.min >= 1)
                          .reduce((sum, a) => sum + a.cantidad, 0)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Gráfico 1: Análisis de Antigüedad */}
                <Card>
                  <CardHeader><CardTitle>Análisis de Antigüedad de Cuentas por Pagar</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={analytics?.agingAnalysisDetailed || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="rango" stroke="hsl(var(--foreground))" tick={{ fill: 'hsl(var(--foreground))' }} angle={-45} textAnchor="end" height={100} />
                        <YAxis stroke="hsl(var(--foreground))" tick={{ fill: 'hsl(var(--foreground))' }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [`$${value.toLocaleString('es-MX')}`, 'Monto']} />
                        <Bar dataKey="monto" fill={COLORS.primary} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Gráfico 2: Histórico de CxP */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Histórico de Cuentas por Pagar</CardTitle>
                      <div className="flex gap-4">
                        <Select value={escalaHistorico} onValueChange={setEscalaHistorico}>
                          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="miles">Miles</SelectItem>
                            <SelectItem value="millones">Millones</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={periodoCxP} onValueChange={(value) => setPeriodoCxP(value as "diario" | "mensual" | "anual")}>
                          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="diario">Diario (Hoy)</SelectItem>
                            <SelectItem value="mensual">Mensual (Mes actual)</SelectItem>
                            <SelectItem value="anual">Anual (Año actual)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={analytics?.historicoCxP || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="fecha" stroke="#000" tick={{ fill: '#000', fontSize: 12, fontWeight: 500 }} />
                        <YAxis stroke="#000" tick={{ fill: '#000', fontSize: 12, fontWeight: 500 }} tickFormatter={(value) => escalaHistorico === "miles" ? `$${(value / 1000).toFixed(0)}k` : escalaHistorico === "millones" ? `$${(value / 1000000).toFixed(2)}M` : `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} formatter={(value: number) => [escalaHistorico === "miles" ? `$${(value / 1000).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}k` : escalaHistorico === "millones" ? `$${(value / 1000000).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M` : `$${value.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 'Saldo CxP']} labelStyle={{ color: 'hsl(var(--foreground))' }} labelFormatter={(label) => label} />
                        <Line type="monotone" dataKey="saldo" stroke={COLORS.primary} strokeWidth={3} dot={{ fill: COLORS.primary, r: 5 }}>
                          <LabelList 
                            dataKey="saldo" 
                            position="top"
                            style={{ fill: '#000', fontSize: '11px', fontWeight: 600 }}
                            formatter={(value: number) => 
                              escalaHistorico === "miles" 
                                ? `$${(value / 1000).toFixed(1)}k` 
                                : escalaHistorico === "millones" 
                                ? `$${(value / 1000000).toFixed(2)}M` 
                                : `$${(value / 1000).toFixed(0)}k`
                            }
                          />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Gráfico 3: CxP por Proveedor Apilado */}
                <Card>
                  <CardHeader><CardTitle>Cuentas por Pagar por Proveedor (Apilado por Antigüedad)</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <Select value={filtroAntiguedad} onValueChange={setFiltroAntiguedad}>
                      <SelectTrigger className="w-[240px]"><SelectValue placeholder="Filtrar por antigüedad" /></SelectTrigger>
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
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={filtroAntiguedad === "todos" ? (analytics?.cxpPorProveedorApilado || []) : (analytics?.cxpPorProveedorApilado || []).filter(c => (c as any)[filtroAntiguedad] > 0)} layout="vertical" margin={{ left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--foreground))" tick={{ fill: 'hsl(var(--foreground))' }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="proveedor" stroke="hsl(var(--foreground))" tick={{ fill: 'hsl(var(--foreground))' }} width={90} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [`$${value.toLocaleString('es-MX')}`, 'Monto']} />
                        {filtroAntiguedad === "todos" ? (<><Bar dataKey="sinVencimiento" stackId="a" fill="#10b981" /><Bar dataKey="vencido1_15" stackId="a" fill="#fbbf24" /><Bar dataKey="vencido16_30" stackId="a" fill="#f97316" /><Bar dataKey="vencido31_60" stackId="a" fill="#ef4444" /><Bar dataKey="vencido61_90" stackId="a" fill="#dc2626" /><Bar dataKey="vencidoMas90" stackId="a" fill="#991b1b" /></>) : (<Bar dataKey={filtroAntiguedad} fill={COLORS.primary} />)}
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Gráfico 4: Vencimientos por Proveedor */}
                <Card>
                  <CardHeader>
                    <CardTitle>Vencimientos por Proveedor</CardTitle>
                    <Select value={proveedorSeleccionado} onValueChange={setProveedorSeleccionado}>
                      <SelectTrigger className="w-[240px]"><SelectValue placeholder="Selecciona proveedor" /></SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="todos">Todos</SelectItem>
                        {(analytics?.proveedoresLista || []).map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent>
                    {proveedorSeleccionado !== "todos" ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={(() => { const pd = (analytics?.cxpPorProveedorApilado || []).find(c => c.proveedor === proveedorSeleccionado); if (!pd) return []; return [{ categoria: 'Sin vencimiento', monto: pd.sinVencimiento }, { categoria: 'Vencido 1-15 días', monto: pd.vencido1_15 }, { categoria: 'Vencido 16-30 días', monto: pd.vencido16_30 }, { categoria: 'Vencido 31-60 días', monto: pd.vencido31_60 }, { categoria: 'Vencido 61-90 días', monto: pd.vencido61_90 }, { categoria: 'Vencido +90 días', monto: pd.vencidoMas90 }].filter(item => item.monto > 0); })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="categoria" stroke="hsl(var(--foreground))" tick={{ fill: 'hsl(var(--foreground))' }} angle={-45} textAnchor="end" height={100} />
                          <YAxis stroke="hsl(var(--foreground))" tick={{ fill: 'hsl(var(--foreground))' }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [`$${value.toLocaleString('es-MX')}`, 'Monto']} />
                          <Bar dataKey="monto" fill={COLORS.accent} radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (<div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Selecciona un proveedor</p></div>)}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No hay datos suficientes para mostrar analíticas</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog para Registrar Pago */}
        <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pago</DialogTitle>
              <DialogDescription>
                Registra un pago para {selectedCuenta?.proveedor_nombre || "este proveedor"}
              </DialogDescription>
            </DialogHeader>

            {selectedCuenta && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Monto Total:</span>
                    <span className="font-medium">${selectedCuenta.monto_total.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ya Pagado:</span>
                    <span className="font-medium">${selectedCuenta.monto_pagado.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Pendiente:</span>
                    <span className="font-bold text-lg">${selectedCuenta.monto_pendiente.toLocaleString('es-CO')}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monto">Monto a Pagar *</Label>
                  <Input
                    id="monto"
                    type="number"
                    placeholder="0.00"
                    value={montoPago}
                    onChange={(e) => setMontoPago(e.target.value)}
                    step="0.01"
                    min="0"
                    max={selectedCuenta.monto_pendiente}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metodo">Método de Pago *</Label>
                  <Select value={metodoPago} onValueChange={setMetodoPago}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setPagoDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleRegistrarPago} className="flex-1">
                    Registrar Pago
                  </Button>
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
