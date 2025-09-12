import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  Calendar,
  Target,
  BarChart3
} from "lucide-react";
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

const AnalyticasCuentasPorCobrar = () => {
  const { data: analytics, isLoading: loadingAnalytics } = useAnalyticsCuentasPorCobrar();
  const { data: detalles, isLoading: loadingDetalles } = useCuentasPorCobrarDetalle();

  if (loadingAnalytics || loadingDetalles) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics || !detalles) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-muted-foreground">No hay datos de cuentas por cobrar disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analíticas de Cuentas por Cobrar</h1>
            <p className="text-muted-foreground mt-2">
              Análisis detallado de clientes, vencimientos y tendencias
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
        </div>

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
              <AlertTriangle className="h-4 w-4 text-destructive" />
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
              <CardDescription>
                Los 10 clientes con mayor monto pendiente
              </CardDescription>
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
              <CardDescription>
                Distribución por días de vencimiento
              </CardDescription>
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
                      label={({ rango, porcentaje }) => 
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
                Tendencia de Cuentas por Cobrar
              </CardTitle>
              <CardDescription>
                Evolución mensual de nuevas cuentas por cobrar
              </CardDescription>
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
              <CardDescription>
                Clasificación por estado de vencimiento
              </CardDescription>
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
            <CardTitle>Detalle de Cuentas por Cliente</CardTitle>
            <CardDescription>
              Lista completa de cuentas por cobrar con información de vencimiento
            </CardDescription>
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
      </div>
    </div>
  );
};

export default AnalyticasCuentasPorCobrar;