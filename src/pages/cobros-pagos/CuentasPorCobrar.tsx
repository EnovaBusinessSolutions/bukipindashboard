import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  User, 
  AlertCircle,
  BarChart3,
  TrendingUp, 
  Users, 
  Clock, 
  Target
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
  AreaChart
} from "recharts";
import { useAnalyticsCuentasPorCobrar, useCuentasPorCobrarDetalle } from "@/hooks/useAnalyticsCuentasPorCobrar";

const COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  destructive: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
  success: "hsl(var(--success))"
};

const PIE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.destructive];

const CuentasPorCobrar = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("lista");
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [selectedCuenta, setSelectedCuenta] = useState<any>(null);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [filtroAntiguedad, setFiltroAntiguedad] = useState<string>("todos");

  const { data: cuentasPorCobrar, isLoading } = useQuery({
    queryKey: ["cuentas-por-cobrar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacciones_ingresos")
        .select("*")
        .gt("monto_pendiente", 0)
        .order("fecha_vencimiento", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const queryClient = useQueryClient();

  // Real-time updates for accounts receivable
  useEffect(() => {
    const channel = supabase
      .channel('cuentas-por-cobrar-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacciones_ingresos'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          queryClient.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Hooks para analíticas
  const { data: analytics, isLoading: loadingAnalytics } = useAnalyticsCuentasPorCobrar();
  const { data: detalles, isLoading: loadingDetalles } = useCuentasPorCobrarDetalle();

  // Mutación para registrar pago
  const registrarPagoMutation = useMutation({
    mutationFn: async ({ cuentaId, monto, metodo }: { cuentaId: string; monto: number; metodo: string }) => {
      const cuenta = cuentasPorCobrar?.find(c => c.id === cuentaId);
      if (!cuenta) throw new Error("Cuenta no encontrada");

      const nuevoMontoPendiente = (cuenta.monto_pendiente || 0) - monto;
      const nuevoMontoPagado = (cuenta.monto_pagado || 0) + monto;

      const { error } = await supabase
        .from('transacciones_ingresos')
        .update({
          monto_pendiente: Math.max(0, nuevoMontoPendiente),
          monto_pagado: nuevoMontoPagado,
          tipo_pago: nuevoMontoPendiente <= 0 ? 'contado' : 'parcial'
        })
        .eq('id', cuentaId);

      if (error) throw error;
      
      return { cuentaId, monto, metodo };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
      toast.success("Pago registrado exitosamente");
      setPagoDialogOpen(false);
      resetPagoForm();
    },
    onError: (error: any) => {
      toast.error("Error al registrar el pago: " + error.message);
    }
  });

  const filteredCuentas = cuentasPorCobrar?.filter(
    (cuenta) =>
      cuenta.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cuenta.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cuenta as any).cliente_telefono?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cuenta as any).cliente_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cuenta as any).cliente_rfc?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalPorCobrar = filteredCuentas.reduce((sum, cuenta) => sum + (cuenta.monto_pendiente || 0), 0);
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
      metodo: metodoPago
    });
  };

  const getEstadoBadge = (fechaVencimiento: string | null, montoPendiente: number) => {
    if (montoPendiente === 0) {
      return <Badge variant="secondary">Cobrado</Badge>;
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Lista de Cuentas
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
                  <CardTitle className="text-sm font-medium">Total por Cobrar</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${totalPorCobrar.toLocaleString('es-CO')}
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
                  <User className="h-4 w-4 text-muted-foreground" />
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
                            placeholder="Buscar por cliente, descripción, teléfono, email o RFC..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
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
                {filteredCuentas.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No se encontraron cuentas por cobrar.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
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
                            <TableCell className="font-medium">
                              {cuenta.cliente_nombre || "Sin especificar"}
                            </TableCell>
                            <TableCell className="min-w-[200px]">
                              <div className="space-y-1">
                                {(cuenta as any).cliente_telefono && (
                                  <div className="text-sm">
                                    📞 {(cuenta as any).cliente_telefono}
                                  </div>
                                )}
                                {(cuenta as any).cliente_email && (
                                  <div className="text-sm">
                                    📧 {(cuenta as any).cliente_email}
                                  </div>
                                )}
                                {(cuenta as any).cliente_rfc && (
                                  <div className="text-sm">
                                    🆔 {(cuenta as any).cliente_rfc}
                                  </div>
                                )}
                                {!(cuenta as any).cliente_telefono && !(cuenta as any).cliente_email && !(cuenta as any).cliente_rfc && (
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
                                {cuenta.monto_descuento && cuenta.monto_descuento > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Descuento:</span>
                                    <span className="text-destructive">-${cuenta.monto_descuento.toLocaleString('es-CO')}</span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center border-t pt-1">
                                  <span className="text-sm text-muted-foreground">Subtotal:</span>
                                  <span className="font-medium">${cuenta.monto_neto.toLocaleString('es-CO')}</span>
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
                                        return (
                                          <span className="text-destructive font-medium">
                                            Vencida hace {Math.abs(diffDays)} día(s)
                                          </span>
                                        );
                                      } else if (diffDays === 0) {
                                        return (
                                          <span className="text-warning font-medium">
                                            Vence hoy
                                          </span>
                                        );
                                      } else if (diffDays <= 7) {
                                        return (
                                          <span className="text-warning font-medium">
                                            Vence en {diffDays} día(s)
                                          </span>
                                        );
                                      } else {
                                        return (
                                          <span className="text-muted-foreground">
                                            Vence en {diffDays} día(s)
                                          </span>
                                        );
                                      }
                                    })()}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">Sin fecha límite</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {getEstadoBadge(cuenta.fecha_vencimiento, cuenta.monto_pendiente || 0)}
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => openPagoDialog(cuenta)}
                                disabled={cuenta.monto_pendiente <= 0}
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

          {/* Tab 2: Analíticas */}
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
                {/* KPIs Principales */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total por Cobrar</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${analytics.totalPendiente.toLocaleString('es-CO')}
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
                          .filter(a => a.min >= 1)
                          .reduce((sum, a) => sum + a.cantidad, 0)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Gráfico A: Análisis de Antigüedad (Barras Verticales) */}
                <Card>
                  <CardHeader>
                    <CardTitle>Análisis de Antigüedad de Cuentas por Cobrar</CardTitle>
                  </CardHeader>
                  <CardContent>
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
                          formatter={(value: number) => [`$${value.toLocaleString('es-CO')}`, 'Monto']}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Bar dataKey="monto" fill={COLORS.primary} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Gráfico B: Histórico de CxC (Líneas) */}
                <Card>
                  <CardHeader>
                    <CardTitle>Histórico de Cuentas por Cobrar (Últimos 30 días)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={analytics?.historicoCxC || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="fecha" 
                          stroke="hsl(var(--foreground))"
                          tick={{ fill: 'hsl(var(--foreground))' }}
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
                          formatter={(value: number) => [`$${value.toLocaleString('es-CO')}`, 'Saldo CxC']}
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
                  </CardContent>
                </Card>

                {/* Gráfico C: CxC por Cliente (Barras Horizontales Apiladas) */}
                <Card>
                  <CardHeader>
                    <CardTitle>Cuentas por Cobrar por Cliente (Apilado por Antigüedad)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Filtro de antigüedad */}
                    <div className="flex items-center gap-4">
                      <Label htmlFor="filtro-antiguedad">Filtrar por antigüedad:</Label>
                      <Select value={filtroAntiguedad} onValueChange={setFiltroAntiguedad}>
                        <SelectTrigger id="filtro-antiguedad" className="w-[240px]">
                          <SelectValue placeholder="Selecciona categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="noVencido">No vencido</SelectItem>
                          <SelectItem value="vencido1_15">Vencido 1-15 días</SelectItem>
                          <SelectItem value="vencido16_30">Vencido 16-30 días</SelectItem>
                          <SelectItem value="vencido31_60">Vencido 31-60 días</SelectItem>
                          <SelectItem value="vencido61_90">Vencido 61-90 días</SelectItem>
                          <SelectItem value="vencidoMas90">Vencido +90 días</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <ResponsiveContainer 
                      width="100%" 
                      height={Math.max(
                        400, 
                        (filtroAntiguedad === "todos" 
                          ? (analytics?.cxcPorClienteApilado || [])
                          : (analytics?.cxcPorClienteApilado || []).filter(c => (c as any)[filtroAntiguedad] > 0)
                        ).length * 40
                      )}
                    >
                      <BarChart 
                        data={
                          filtroAntiguedad === "todos" 
                            ? (analytics?.cxcPorClienteApilado || [])
                            : (analytics?.cxcPorClienteApilado || [])
                                .filter(c => (c as any)[filtroAntiguedad] > 0)
                                .sort((a, b) => ((b as any)[filtroAntiguedad] || 0) - ((a as any)[filtroAntiguedad] || 0))
                        }
                        layout="vertical"
                        margin={{ left: 100 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          type="number"
                          stroke="hsl(var(--foreground))"
                          tick={{ fill: 'hsl(var(--foreground))' }}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
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
                            borderRadius: '8px'
                          }}
                          formatter={(value: number) => `$${value.toLocaleString('es-CO')}`}
                        />
                        <Bar dataKey="noVencido" stackId="a" fill={COLORS.success} name="No vencido" />
                        <Bar dataKey="vencido1_15" stackId="a" fill={COLORS.primary} name="Vencido 1-15 días" />
                        <Bar dataKey="vencido16_30" stackId="a" fill={COLORS.secondary} name="Vencido 16-30 días" />
                        <Bar dataKey="vencido31_60" stackId="a" fill={COLORS.warning} name="Vencido 31-60 días" />
                        <Bar dataKey="vencido61_90" stackId="a" fill={COLORS.accent} name="Vencido 61-90 días" />
                        <Bar dataKey="vencidoMas90" stackId="a" fill={COLORS.destructive} name="Vencido +90 días" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
            {loadingAnalytics || loadingDetalles ? (
              <div className="animate-pulse space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 bg-muted rounded"></div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-80 bg-muted rounded"></div>
                  ))}
                </div>
              </div>
            ) : !analytics || !detalles ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No hay datos de analíticas disponibles</p>
              </div>
            ) : (
              <>
                {/* KPIs Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total por Cobrar</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${analytics.totalPendiente.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">
                        Monto total pendiente
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{analytics.totalClientes}</div>
                      <p className="text-xs text-muted-foreground">
                        Clientes con deudas
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Promedio por Cliente</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${analytics.promedioDeuda.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">
                        Deuda promedio
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Cuentas Vencidas</CardTitle>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">
                        {detalles.filter(d => d.estado === 'Vencida' || d.estado === 'Muy vencida').length}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Requieren atención
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Top Clientes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Top Clientes por Deuda
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.cuentasPorCliente} layout="horizontal">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="cliente" type="category" width={100} />
                            <Tooltip 
                              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Monto']}
                              labelFormatter={(label) => `Cliente: ${label}`}
                            />
                            <Bar dataKey="monto" fill={COLORS.primary} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Aging Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Análisis de Antigüedad
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analytics.agingAnalysis}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ rango }) => 
                                `${rango}: ${((analytics.agingAnalysis.find(a => a.rango === rango)?.monto || 0) / analytics.totalPendiente * 100).toFixed(1)}%`
                              }
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="monto"
                            >
                              {analytics.agingAnalysis.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Monto']} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tendencia Mensual */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Tendencia Mensual
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analytics.tendenciaMensual}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="mes" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Monto']} />
                            <Area 
                              type="monotone" 
                              dataKey="monto" 
                              stroke={COLORS.primary} 
                              fill={COLORS.primary} 
                              fillOpacity={0.3} 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Estado de Cuentas */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Estado de Cuentas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {['Al día', 'Por vencer', 'Vencida', 'Muy vencida', 'Sin fecha límite'].map((estado) => {
                          const cuentasEstado = detalles.filter(d => d.estado === estado);
                          const montoTotal = cuentasEstado.reduce((sum, c) => sum + c.monto_pendiente, 0);
                          const porcentaje = (montoTotal / analytics.totalPendiente * 100).toFixed(1);
                          
                          const getColorByEstado = (estado: string) => {
                            switch (estado) {
                              case 'Al día': return 'bg-green-500';
                              case 'Por vencer': return 'bg-yellow-500';
                              case 'Vencida': return 'bg-orange-500';
                              case 'Muy vencida': return 'bg-red-500';
                              default: return 'bg-gray-500';
                            }
                          };

                          return (
                            <div key={estado} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${getColorByEstado(estado)}`} />
                                  <span className="text-sm font-medium">{estado}</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-semibold">${montoTotal.toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground">{porcentaje}%</div>
                                </div>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${getColorByEstado(estado)}`}
                                  style={{ width: `${porcentaje}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detalles por Cliente */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top 5 Clientes con Mayor Deuda</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.cuentasPorCliente.slice(0, 5).map((cliente) => {
                        const cuentasCliente = detalles.filter(d => 
                          (d.cliente_nombre || 'Sin nombre') === cliente.cliente
                        );
                        
                        return (
                          <div key={cliente.cliente} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-semibold text-lg">{cliente.cliente}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {cliente.cantidad} cuenta(s) pendiente(s)
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold">${cliente.monto.toLocaleString()}</div>
                                <Badge variant="outline">
                                  Total adeudado
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {cuentasCliente.map((cuenta) => (
                                <div key={cuenta.id} className="bg-muted/50 rounded p-3 text-sm">
                                  <div className="font-medium truncate">{cuenta.descripcion}</div>
                                  <div className="text-muted-foreground">
                                    ${cuenta.monto_pendiente.toLocaleString()}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge 
                                      variant={cuenta.estado === 'Vencida' || cuenta.estado === 'Muy vencida' ? 'destructive' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {cuenta.estado}
                                    </Badge>
                                    {cuenta.diasVencimiento > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        {cuenta.diasVencimiento} días
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Diálogo de Registro de Pago */}
      <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {selectedCuenta && (
                <>
                  Cliente: {selectedCuenta.cliente_nombre}<br/>
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
    </div>
  );
};

export default CuentasPorCobrar;