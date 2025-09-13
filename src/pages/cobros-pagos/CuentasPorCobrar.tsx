import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

  // Hooks para analíticas
  const { data: analytics, isLoading: loadingAnalytics } = useAnalyticsCuentasPorCobrar();
  const { data: detalles, isLoading: loadingDetalles } = useCuentasPorCobrarDetalle();

  const filteredCuentas = cuentasPorCobrar?.filter(
    (cuenta) =>
      cuenta.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cuenta.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalPorCobrar = filteredCuentas.reduce((sum, cuenta) => sum + (cuenta.monto_pendiente || 0), 0);
  const vencidas = filteredCuentas.filter(cuenta => 
    cuenta.fecha_vencimiento && new Date(cuenta.fecha_vencimiento) < new Date()
  ).length;
  const porVencer = filteredCuentas.filter(cuenta => 
    cuenta.fecha_vencimiento && new Date(cuenta.fecha_vencimiento) >= new Date()
  ).length;

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
                      placeholder="Buscar por cliente o descripción..."
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
                          <TableHead>Contacto</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Monto Total</TableHead>
                          <TableHead>Monto Pagado</TableHead>
                          <TableHead>Monto Pendiente</TableHead>
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
                            <TableCell className="text-sm text-muted-foreground">
                              {cuenta.cliente_contacto || "Sin contacto"}
                            </TableCell>
                            <TableCell>{cuenta.descripcion}</TableCell>
                            <TableCell>
                              ${cuenta.monto_total.toLocaleString('es-CO')}
                            </TableCell>
                            <TableCell>
                              ${cuenta.monto_pagado.toLocaleString('es-CO')}
                            </TableCell>
                            <TableCell className="font-semibold">
                              ${cuenta.monto_pendiente?.toLocaleString('es-CO') || 0}
                            </TableCell>
                            <TableCell>
                              {cuenta.fecha_vencimiento
                                ? format(new Date(cuenta.fecha_vencimiento), "dd/MM/yyyy", {
                                    locale: es,
                                  })
                                : "Sin vencimiento"}
                            </TableCell>
                            <TableCell>
                              {getEstadoBadge(cuenta.fecha_vencimiento, cuenta.monto_pendiente || 0)}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline">
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
    </div>
  );
};

export default CuentasPorCobrar;