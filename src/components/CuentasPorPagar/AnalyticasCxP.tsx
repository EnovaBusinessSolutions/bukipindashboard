import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from "recharts";
import { useAnalyticsCuentasPorPagar, useCuentasPorPagarDetalle } from "@/hooks/useAnalyticsCuentasPorPagar";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, Target, AlertTriangle, Settings } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const COLORS = {
  sinVencimiento: "hsl(var(--chart-1))",
  vencido1_15: "hsl(var(--chart-2))",
  vencido16_30: "hsl(var(--chart-3))",
  vencido31_60: "hsl(var(--chart-4))",
  vencido61_90: "hsl(var(--chart-5))",
  vencidoMas90: "hsl(var(--destructive))"
};

export default function AnalyticasCxP() {
  const [formatoNumeros, setFormatoNumeros] = useState<'normal' | 'miles' | 'millones'>('normal');
  const [decimales, setDecimales] = useState<0 | 1 | 2>(2);
  const [periodoHistorico, setPeriodoHistorico] = useState<'mensual' | 'anual'>('mensual');
  const [filtroProveedor, setFiltroProveedor] = useState<string>('todos');
  const [categoriasVisibles, setCategoriasVisibles] = useState<string[]>(['all']);

  const { data: analytics, isLoading } = useAnalyticsCuentasPorPagar(periodoHistorico, filtroProveedor);
  const { data: detalle } = useCuentasPorPagarDetalle();

  const formatearConPreferencias = (valor: number | undefined | null): string => {
    if (valor === undefined || valor === null) return "$0.00";
    
    let valorFormateado = valor;
    if (formatoNumeros === 'miles') valorFormateado = valor / 1000;
    if (formatoNumeros === 'millones') valorFormateado = valor / 1000000;
    
    return "$" + valorFormateado.toLocaleString('en-US', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    });
  };

  const formatearEtiqueta = (valor: number): string => {
    let valorFormateado = valor;
    if (formatoNumeros === 'miles') valorFormateado = valor / 1000;
    if (formatoNumeros === 'millones') valorFormateado = valor / 1000000;
    
    return valorFormateado.toLocaleString('en-US', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-muted-foreground">No hay datos de cuentas por pagar disponibles</p>
        </CardContent>
      </Card>
    );
  }

  const cuentasVencidas = analytics.agingAnalysisDetailed
    .filter(a => a.min !== null && a.min > 0)
    .reduce((sum, a) => sum + a.cantidad, 0);

  const proveedoresUnicos = analytics?.cxpPorProveedorApilado
    ?.map(p => p.proveedor)
    .filter(Boolean) || [];

  const toggleCategoria = (categoria: string) => {
    if (categoria === 'all') {
      setCategoriasVisibles(['all']);
    } else {
      const nuevas = categoriasVisibles.includes(categoria)
        ? categoriasVisibles.filter(c => c !== categoria && c !== 'all')
        : [...categoriasVisibles.filter(c => c !== 'all'), categoria];
      
      setCategoriasVisibles(nuevas.length === 0 ? ['all'] : nuevas);
    }
  };

  const dataProveedorFiltrada = categoriasVisibles.includes('all') 
    ? analytics.cxpPorProveedorApilado.map(p => ({
        ...p,
        total: (p.sinVencimiento || 0) + (p.vencido1_15 || 0) + (p.vencido16_30 || 0) + 
               (p.vencido31_60 || 0) + (p.vencido61_90 || 0) + (p.vencidoMas90 || 0)
      }))
    : analytics.cxpPorProveedorApilado.map(p => {
        const filtered: any = { proveedor: p.proveedor };
        let total = 0;
        if (categoriasVisibles.includes('sinVencimiento')) { filtered.sinVencimiento = p.sinVencimiento; total += p.sinVencimiento || 0; }
        if (categoriasVisibles.includes('vencido1_15')) { filtered.vencido1_15 = p.vencido1_15; total += p.vencido1_15 || 0; }
        if (categoriasVisibles.includes('vencido16_30')) { filtered.vencido16_30 = p.vencido16_30; total += p.vencido16_30 || 0; }
        if (categoriasVisibles.includes('vencido31_60')) { filtered.vencido31_60 = p.vencido31_60; total += p.vencido31_60 || 0; }
        if (categoriasVisibles.includes('vencido61_90')) { filtered.vencido61_90 = p.vencido61_90; total += p.vencido61_90 || 0; }
        if (categoriasVisibles.includes('vencidoMas90')) { filtered.vencidoMas90 = p.vencidoMas90; total += p.vencidoMas90 || 0; }
        filtered.total = total;
        return filtered;
      });

  const categoriaColors = [
    COLORS.sinVencimiento,
    COLORS.vencido1_15,
    COLORS.vencido16_30,
    COLORS.vencido31_60,
    COLORS.vencido61_90,
    COLORS.vencidoMas90
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analíticas de Cuentas por Pagar</h2>
        <p className="text-muted-foreground">Análisis detallado de deudas con proveedores</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total por Pagar</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatearConPreferencias(analytics.totalPendiente)}</div>
            <p className="text-xs text-muted-foreground">
              Saldo total pendiente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Proveedores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalProveedores}</div>
            <p className="text-xs text-muted-foreground">
              Proveedores activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Proveedor</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatearConPreferencias(analytics.promedioDeuda)}</div>
            <p className="text-xs text-muted-foreground">
              Deuda promedio
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cuentas Vencidas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{cuentasVencidas}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Formato de Números</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Select value={formatoNumeros} onValueChange={(v: any) => setFormatoNumeros(v)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="miles">Miles</SelectItem>
                <SelectItem value="millones">Millones</SelectItem>
              </SelectContent>
            </Select>
            <Select value={decimales.toString()} onValueChange={(v) => setDecimales(parseInt(v) as 0 | 1 | 2)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 decimales</SelectItem>
                <SelectItem value="1">1 decimal</SelectItem>
                <SelectItem value="2">2 decimales</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Gráfica 1: Antigüedad de CxP */}
      <Card>
        <CardHeader>
          <CardTitle>Antigüedad de Cuentas por Pagar</CardTitle>
          <CardDescription>Distribución por días de vencimiento</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={analytics.agingAnalysisDetailed}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="rango" 
                className="text-xs"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis className="text-xs" />
              <Tooltip 
                formatter={(value: number) => formatearConPreferencias(value)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="monto" radius={[8, 8, 0, 0]}>
                {analytics.agingAnalysisDetailed.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={categoriaColors[index]} />
                ))}
                <LabelList 
                  dataKey="monto" 
                  position="top" 
                  formatter={(value: number) => formatearEtiqueta(value)}
                  className="text-xs fill-foreground"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfica 2: Histórico de CxP */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Histórico de Cuentas por Pagar</CardTitle>
              <CardDescription>Evolución del saldo en el tiempo</CardDescription>
            </div>
            <Select value={periodoHistorico} onValueChange={(v: any) => setPeriodoHistorico(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={analytics.historicoCxP}>
              <defs>
                <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="fecha" 
                className="text-xs"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis className="text-xs" />
              <Tooltip 
                formatter={(value: number) => formatearConPreferencias(value)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Area 
                type="monotone" 
                dataKey="saldo" 
                stroke="hsl(var(--primary))" 
                fillOpacity={1} 
                fill="url(#colorSaldo)"
              >
                <LabelList 
                  dataKey="saldo" 
                  position="top" 
                  formatter={(value: number) => formatearEtiqueta(value)}
                  className="text-xs fill-foreground"
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfica 3: CxP por Proveedor Apilada */}
      <Card>
        <CardHeader>
          <CardTitle>Cuentas por Pagar por Proveedor</CardTitle>
          <CardDescription>Apilado por antigüedad de saldos</CardDescription>
          <div className="flex flex-wrap gap-4 pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cat-all" 
                checked={categoriasVisibles.includes('all')}
                onCheckedChange={() => toggleCategoria('all')}
              />
              <Label htmlFor="cat-all" className="text-sm cursor-pointer">Todas</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cat-sin" 
                checked={categoriasVisibles.includes('sinVencimiento') || categoriasVisibles.includes('all')}
                onCheckedChange={() => toggleCategoria('sinVencimiento')}
              />
              <Label htmlFor="cat-sin" className="text-sm cursor-pointer flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.sinVencimiento }}></span>
                Sin vencimiento
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cat-1-15" 
                checked={categoriasVisibles.includes('vencido1_15') || categoriasVisibles.includes('all')}
                onCheckedChange={() => toggleCategoria('vencido1_15')}
              />
              <Label htmlFor="cat-1-15" className="text-sm cursor-pointer flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.vencido1_15 }}></span>
                1-15 días
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cat-16-30" 
                checked={categoriasVisibles.includes('vencido16_30') || categoriasVisibles.includes('all')}
                onCheckedChange={() => toggleCategoria('vencido16_30')}
              />
              <Label htmlFor="cat-16-30" className="text-sm cursor-pointer flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.vencido16_30 }}></span>
                16-30 días
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cat-31-60" 
                checked={categoriasVisibles.includes('vencido31_60') || categoriasVisibles.includes('all')}
                onCheckedChange={() => toggleCategoria('vencido31_60')}
              />
              <Label htmlFor="cat-31-60" className="text-sm cursor-pointer flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.vencido31_60 }}></span>
                31-60 días
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cat-61-90" 
                checked={categoriasVisibles.includes('vencido61_90') || categoriasVisibles.includes('all')}
                onCheckedChange={() => toggleCategoria('vencido61_90')}
              />
              <Label htmlFor="cat-61-90" className="text-sm cursor-pointer flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.vencido61_90 }}></span>
                61-90 días
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cat-90plus" 
                checked={categoriasVisibles.includes('vencidoMas90') || categoriasVisibles.includes('all')}
                onCheckedChange={() => toggleCategoria('vencidoMas90')}
              />
              <Label htmlFor="cat-90plus" className="text-sm cursor-pointer flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.vencidoMas90 }}></span>
                +90 días
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={dataProveedorFiltrada} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" className="text-xs" />
              <YAxis 
                dataKey="proveedor" 
                type="category" 
                width={150}
                className="text-xs"
              />
              <Tooltip 
                formatter={(value: number) => formatearConPreferencias(value)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Legend />
              {(categoriasVisibles.includes('all') || categoriasVisibles.includes('sinVencimiento')) && (
                <Bar dataKey="sinVencimiento" stackId="a" fill={COLORS.sinVencimiento} name="Sin vencimiento" />
              )}
              {(categoriasVisibles.includes('all') || categoriasVisibles.includes('vencido1_15')) && (
                <Bar dataKey="vencido1_15" stackId="a" fill={COLORS.vencido1_15} name="1-15 días" />
              )}
              {(categoriasVisibles.includes('all') || categoriasVisibles.includes('vencido16_30')) && (
                <Bar dataKey="vencido16_30" stackId="a" fill={COLORS.vencido16_30} name="16-30 días" />
              )}
              {(categoriasVisibles.includes('all') || categoriasVisibles.includes('vencido31_60')) && (
                <Bar dataKey="vencido31_60" stackId="a" fill={COLORS.vencido31_60} name="31-60 días" />
              )}
              {(categoriasVisibles.includes('all') || categoriasVisibles.includes('vencido61_90')) && (
                <Bar dataKey="vencido61_90" stackId="a" fill={COLORS.vencido61_90} name="61-90 días" />
              )}
              {(categoriasVisibles.includes('all') || categoriasVisibles.includes('vencidoMas90')) && (
                <Bar dataKey="vencidoMas90" stackId="a" fill={COLORS.vencidoMas90} name="+90 días" />
              )}
              {/* Barra invisible para mostrar etiqueta de total */}
              <Bar 
                dataKey="total" 
                fill="transparent" 
                name="Total"
                legendType="none"
              >
                <LabelList 
                  dataKey="total" 
                  position="right" 
                  formatter={(value: number) => formatearConPreferencias(value)}
                  className="text-xs fill-foreground font-semibold"
                  offset={5}
                  style={{ dominantBaseline: 'middle' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfica 4: Vencimientos por Proveedor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vencimientos por Proveedor</CardTitle>
              <CardDescription>Antigüedad de deudas del proveedor seleccionado</CardDescription>
            </div>
            <Select value={filtroProveedor} onValueChange={setFiltroProveedor}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los proveedores</SelectItem>
                {proveedoresUnicos.map((proveedor) => (
                  <SelectItem key={proveedor} value={proveedor}>
                    {proveedor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={analytics.agingAnalysisDetailed}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="rango" 
                className="text-xs"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis className="text-xs" />
              <Tooltip 
                formatter={(value: number) => formatearConPreferencias(value)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="monto" radius={[8, 8, 0, 0]}>
                {analytics.agingAnalysisDetailed.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={categoriaColors[index]} />
                ))}
                <LabelList 
                  dataKey="monto" 
                  position="top" 
                  formatter={(value: number) => formatearEtiqueta(value)}
                  className="text-xs fill-foreground"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
