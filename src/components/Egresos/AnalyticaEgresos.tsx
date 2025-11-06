import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line 
} from "recharts";
import { TrendingDown, Calendar, DollarSign, Package, AlertCircle } from "lucide-react";
import { useTransaccionesEgresos } from "@/hooks/useTransaccionesEgresos";
import { useCostosVentaInventario } from "@/hooks/useCostosVentaInventario";
import { useResumenEgresosPorPeriodo } from "@/hooks/useResumenEgresosPorPeriodo";
import { useEgresosPorPeriodo, DatosEvolucionSimple, DatosEvolucionCombinada } from "@/hooks/useEgresosPorPeriodo";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const AnalyticaEgresos = () => {
  const { transacciones, loading } = useTransaccionesEgresos(1000);
  const { data: costosVentaInventario, isLoading: loadingCostosVenta } = useCostosVentaInventario();
  const { data: resumenes, isLoading: loadingResumen } = useResumenEgresosPorPeriodo();
  const [periodFilter, setPeriodFilter] = useState<"diario" | "mensual" | "anual">("mensual");
  const [formatoMontos, setFormatoMontos] = useState<"normal" | "miles" | "millones">("normal");
  const [tipoEgreso, setTipoEgreso] = useState<"total" | "costo" | "gasto" | "costo_inventario" | "combinada">("total");
  
  // Usar el nuevo hook para datos de la gráfica
  const { data: datosGrafica, isLoading: loadingGrafica } = useEgresosPorPeriodo(periodFilter, tipoEgreso);

  // Filtrar solo costos y gastos
  const transaccionesFiltradas = transacciones.filter(
    (t) => t.tipo_egreso === 'costo' || t.tipo_egreso === 'gasto'
  );

  // Función para filtrar transacciones según el período
  const getFilteredTransactions = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    if (periodFilter === "diario") {
      const todayStr = today.toISOString().split('T')[0];
      return transaccionesFiltradas.filter(t => 
        new Date(t.created_at).toISOString().split('T')[0] === todayStr
      );
    } else if (periodFilter === "mensual") {
      return transaccionesFiltradas.filter(t => {
        const tDate = new Date(t.created_at);
        return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
      });
    } else {
      return transaccionesFiltradas.filter(t => {
        const tDate = new Date(t.created_at);
        return tDate.getFullYear() === currentYear;
      });
    }
  };

  const filteredTransactions = getFilteredTransactions();

  // Filtrar costos de venta de inventario según período
  const getFilteredCostosInventario = () => {
    if (!costosVentaInventario) return [];
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    if (periodFilter === "diario") {
      const todayStr = today.toISOString().split('T')[0];
      return costosVentaInventario.filter(c => 
        new Date(c.fecha).toISOString().split('T')[0] === todayStr
      );
    } else if (periodFilter === "mensual") {
      return costosVentaInventario.filter(c => {
        const cDate = new Date(c.fecha);
        return cDate.getMonth() === currentMonth && cDate.getFullYear() === currentYear;
      });
    } else {
      return costosVentaInventario.filter(c => {
        const cDate = new Date(c.fecha);
        return cDate.getFullYear() === currentYear;
      });
    }
  };

  const filteredCostosInventario = getFilteredCostosInventario();

  // Función helper para calcular porcentajes de forma segura
  const calcularPorcentaje = (monto: number, total: number): string => {
    if (total === 0) return '0.0';
    return ((monto / total) * 100).toFixed(1);
  };

  // Función para formatear montos según el filtro
  const formatearMonto = (monto: number) => {
    if (formatoMontos === "miles") return monto / 1000;
    if (formatoMontos === "millones") return monto / 1000000;
    return monto;
  };

  // Función para obtener el sufijo del formato
  const getSufijoFormato = () => {
    if (formatoMontos === "miles") return " (Miles)";
    if (formatoMontos === "millones") return " (Millones)";
    return "";
  };

  // Formatear datos de la gráfica según el formato de montos seleccionado
  const datosGraficaFormateados = useMemo(() => {
    if (!datosGrafica) return [];
    
    if (tipoEgreso === "combinada") {
      return (datosGrafica as DatosEvolucionCombinada[]).map(item => ({
        periodo: item.periodo,
        costos: formatearMonto(item.costos),
        gastos: formatearMonto(item.gastos),
        costosInventario: formatearMonto(item.costosInventario)
      }));
    } else {
      return (datosGrafica as DatosEvolucionSimple[]).map(item => ({
        periodo: item.periodo,
        monto: formatearMonto(item.monto)
      }));
    }
  }, [datosGrafica, tipoEgreso, formatoMontos]);

  // Egresos por tipo
  const egresosPorTipo = () => {
    const grouped = filteredTransactions.reduce((acc, t) => {
      const tipo = t.tipo_egreso;
      if (!acc[tipo]) {
        acc[tipo] = 0;
      }
      acc[tipo] += t.monto_total;
      return acc;
    }, {} as Record<string, number>);

    // Agregar costos de inventario
    const totalCostosInventario = filteredCostosInventario.reduce((sum, c) => sum + c.monto, 0);
    if (totalCostosInventario > 0) {
      grouped['Costo Venta Inventario'] = totalCostosInventario;
    }

    return Object.entries(grouped)
      .map(([tipo, monto]) => ({ tipo, monto }))
      .filter(item => item.monto > 0);
  };

  // Estado de pagos
  const estadoPagos = () => {
    const pagadoTotal = filteredTransactions.filter(t => t.monto_pendiente === 0).reduce((sum, t) => sum + t.monto_total, 0);
    const parcial = filteredTransactions.filter(t => t.monto_pendiente > 0 && t.monto_pagado > 0).reduce((sum, t) => sum + t.monto_total, 0);
    const porPagar = filteredTransactions.filter(t => t.monto_pagado === 0).reduce((sum, t) => sum + t.monto_total, 0);

    return [
      { estado: 'Pagado Total', monto: pagadoTotal },
      { estado: 'Pago Parcial', monto: parcial },
      { estado: 'Por Pagar', monto: porPagar }
    ].filter(item => item.monto > 0);
  };

  // Todos los proveedores
  const topProveedores = () => {
    const grouped = filteredTransactions.reduce((acc, t) => {
      const proveedor = t.proveedor_nombre || 'Sin proveedor';
      if (!acc[proveedor]) {
        acc[proveedor] = 0;
      }
      acc[proveedor] += t.monto_total;
      return acc;
    }, {} as Record<string, number>);

    // Agregar costos de inventario
    const totalCostosInventario = filteredCostosInventario.reduce((sum, c) => sum + c.monto, 0);
    if (totalCostosInventario > 0) {
      grouped['Costo Venta Inventario'] = totalCostosInventario;
    }

    return Object.entries(grouped)
      .map(([proveedor, monto]) => ({ proveedor, monto }))
      .sort((a, b) => b.monto - a.monto);
  };

  // Todos los gastos
  const topGastos = () => {
    // Combinar transacciones manuales con costos de inventario
    const gastosTransacciones = filteredTransactions.map(t => ({
      id: t.id,
      descripcion: t.descripcion,
      tipo_egreso: t.tipo_egreso,
      monto_total: t.monto_total,
      es_inventario: false,
      producto_nombre: null,
      fecha: t.created_at
    }));

    const gastosInventario = filteredCostosInventario.map(c => ({
      id: c.numero_asiento,
      descripcion: c.descripcion,
      tipo_egreso: 'Costo Venta',
      monto_total: c.monto,
      es_inventario: true,
      producto_nombre: c.producto_nombre,
      fecha: c.fecha
    }));

    return [...gastosTransacciones, ...gastosInventario]
      .sort((a, b) => b.monto_total - a.monto_total);
  };

  if (loading || loadingCostosVenta || loadingResumen || loadingGrafica || !resumenes) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h3 className="text-lg font-semibold">Analítica de Egresos</h3>
        <p className="text-sm text-muted-foreground">
          Análisis detallado de costos y gastos
        </p>
      </div>

      {/* Resúmenes por Período */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Día */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-primary">
              Resumen del Día
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Costos de Venta */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costos de Venta</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  ${resumenes.dia.costosVenta5001.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resumenes.dia.costosVenta5001, resumenes.dia.total)}%
                </Badge>
              </div>
            </div>

            {/* Costos de Venta Inventario */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costo Venta Inventario</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  ${resumenes.dia.costosVenta5002.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resumenes.dia.costosVenta5002, resumenes.dia.total)}%
                </Badge>
              </div>
            </div>

            {/* Gastos */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  ${resumenes.dia.gastos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resumenes.dia.gastos, resumenes.dia.total)}%
                </Badge>
              </div>
            </div>

            {/* Otros Gastos */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Otros Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  ${resumenes.dia.otrosGastos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resumenes.dia.otrosGastos, resumenes.dia.total)}%
                </Badge>
              </div>
            </div>

            {/* Divisor */}
            <div className="h-px bg-border my-2"></div>

            {/* Total Egresos */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-primary">Total Egresos</span>
              <span className="text-lg font-bold text-destructive">
                ${resumenes.dia.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Mes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-primary">
              Resumen del Mes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Costos de Venta */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costos de Venta</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  ${resumenes.mes.costosVenta5001.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resumenes.mes.costosVenta5001, resumenes.mes.total)}%
                </Badge>
              </div>
            </div>

            {/* Costos de Venta Inventario */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costo Venta Inventario</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  ${resumenes.mes.costosVenta5002.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resumenes.mes.costosVenta5002, resumenes.mes.total)}%
                </Badge>
              </div>
            </div>

            {/* Gastos */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  ${resumenes.mes.gastos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resumenes.mes.gastos, resumenes.mes.total)}%
                </Badge>
              </div>
            </div>

            {/* Otros Gastos */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Otros Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  ${resumenes.mes.otrosGastos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resumenes.mes.otrosGastos, resumenes.mes.total)}%
                </Badge>
              </div>
            </div>

            {/* Divisor */}
            <div className="h-px bg-border my-2"></div>

            {/* Total Egresos */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-primary">Total Egresos</span>
              <span className="text-lg font-bold text-destructive">
                ${resumenes.mes.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Año */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-primary">
              Resumen del Año
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Costos de Venta */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costos de Venta</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  ${resumenes.anio.costosVenta5001.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resumenes.anio.costosVenta5001, resumenes.anio.total)}%
                </Badge>
              </div>
            </div>

            {/* Costos de Venta Inventario */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costo Venta Inventario</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  ${resumenes.anio.costosVenta5002.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resumenes.anio.costosVenta5002, resumenes.anio.total)}%
                </Badge>
              </div>
            </div>

            {/* Gastos */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  ${resumenes.anio.gastos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resumenes.anio.gastos, resumenes.anio.total)}%
                </Badge>
              </div>
            </div>

            {/* Otros Gastos */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Otros Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  ${resumenes.anio.otrosGastos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resumenes.anio.otrosGastos, resumenes.anio.total)}%
                </Badge>
              </div>
            </div>

            {/* Divisor */}
            <div className="h-px bg-border my-2"></div>

            {/* Total Egresos */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-primary">Total Egresos</span>
              <span className="text-lg font-bold text-destructive">
                ${resumenes.anio.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selector de Período */}
      <div className="flex justify-center">
        <Tabs value={periodFilter} onValueChange={(v) => setPeriodFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="diario">Día</TabsTrigger>
            <TabsTrigger value="mensual">Mes</TabsTrigger>
            <TabsTrigger value="anual">Año</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolución de Egresos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div>
                <CardTitle>Evolución de Egresos{getSufijoFormato()}</CardTitle>
                <CardDescription>
                  Tendencia de egresos en el período seleccionado
                </CardDescription>
              </div>
              
              {/* Filtros */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Formato:</span>
                  <Tabs value={formatoMontos} onValueChange={(v) => setFormatoMontos(v as any)}>
                    <TabsList>
                      <TabsTrigger value="normal">Normal</TabsTrigger>
                      <TabsTrigger value="miles">Miles</TabsTrigger>
                      <TabsTrigger value="millones">Millones</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Tipo:</span>
                  <Tabs value={tipoEgreso} onValueChange={(v) => setTipoEgreso(v as any)}>
                    <TabsList>
                      <TabsTrigger value="total">Total</TabsTrigger>
                      <TabsTrigger value="costo">Costos</TabsTrigger>
                      <TabsTrigger value="gasto">Gastos</TabsTrigger>
                      <TabsTrigger value="costo_inventario">Costo Inventario</TabsTrigger>
                      <TabsTrigger value="combinada">Desglosada</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={datosGraficaFormateados}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => {
                    const formattedValue = Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 });
                    return [`$${formattedValue}${getSufijoFormato()}`, 'Monto'];
                  }}
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--background))'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                {tipoEgreso === "combinada" ? (
                  <>
                    <Line 
                      type="monotone" 
                      dataKey="costos" 
                      name="Costos Manuales"
                      stroke="hsl(180, 25%, 50%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(180, 25%, 50%)' }}
                      label={{ 
                        position: 'top', 
                        fill: 'hsl(var(--foreground))',
                        fontSize: 10,
                        formatter: (value: number) => value > 0 ? `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}` : ''
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="gastos" 
                      name="Gastos"
                      stroke="hsl(0, 70%, 55%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(0, 70%, 55%)' }}
                      label={{ 
                        position: 'top', 
                        fill: 'hsl(var(--foreground))',
                        fontSize: 10,
                        formatter: (value: number) => value > 0 ? `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}` : ''
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="costosInventario" 
                      name="Costo Venta Inventario"
                      stroke="hsl(280, 60%, 55%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(280, 60%, 55%)' }}
                      label={{ 
                        position: 'bottom', 
                        fill: 'hsl(var(--foreground))',
                        fontSize: 10,
                        formatter: (value: number) => value > 0 ? `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}` : ''
                      }}
                    />
                    <Legend />
                  </>
                ) : (
                  <Line 
                    type="monotone" 
                    dataKey="monto" 
                    stroke="hsl(180, 25%, 50%)" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(180, 25%, 50%)' }}
                    label={{ 
                      position: 'top', 
                      fill: 'hsl(var(--foreground))',
                      fontSize: 12,
                      formatter: (value: number) => value > 0 ? `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}` : ''
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Egresos por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Egresos por Tipo</CardTitle>
            <CardDescription>Distribución de costos y gastos</CardDescription>
          </CardHeader>
          <CardContent>
            {egresosPorTipo().length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay datos para mostrar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={egresosPorTipo()}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    labelLine={false}
                    label={({ tipo, percent }) => `${tipo}\n${(percent * 100).toFixed(1)}%`}
                    fill="#8884d8"
                    dataKey="monto"
                  >
                    {egresosPorTipo().map((entry, index) => {
                      const colors = [
                        "hsl(180 50% 55%)",
                        "hsl(0 70% 55%)",
                        "hsl(280 60% 55%)",
                        "hsl(180 40% 40%)"
                      ];
                      return <Cell key={`cell-${index}`} fill={colors[index % 4]} />;
                    })}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Monto']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Estado de Pagos */}
        <Card>
          <CardHeader>
            <CardTitle>Estado de Pagos</CardTitle>
            <CardDescription>Distribución por estado de pago</CardDescription>
          </CardHeader>
          <CardContent>
            {estadoPagos().length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay datos para mostrar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={estadoPagos()}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    labelLine={false}
                    label={({ estado, percent }) => `${estado}\n${(percent * 100).toFixed(1)}%`}
                    fill="#8884d8"
                    dataKey="monto"
                  >
                    <Cell fill="hsl(142 76% 36%)" />
                    <Cell fill="hsl(48 96% 53%)" />
                    <Cell fill="hsl(0 84% 60%)" />
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Monto']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tablas de Detalles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Todos los Proveedores */}
        <Card>
          <CardHeader>
            <CardTitle>Egresos por Proveedor</CardTitle>
            <CardDescription>Todos los proveedores con egresos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            {topProveedores().length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay proveedores para mostrar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Monto Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProveedores().map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="max-w-xs truncate">{item.proveedor}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ${item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Todos los Gastos */}
        <Card>
          <CardHeader>
            <CardTitle>Gastos por Monto</CardTitle>
            <CardDescription>Todos los egresos ordenados por monto</CardDescription>
          </CardHeader>
          <CardContent>
            {topGastos().length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay gastos para mostrar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topGastos().map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {item.es_inventario && item.producto_nombre ? (
                          <div>
                            <div className="font-medium">{item.producto_nombre}</div>
                            <div className="text-xs text-muted-foreground">{item.descripcion}</div>
                          </div>
                        ) : (
                          item.descripcion
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          item.es_inventario ? 'secondary' : 
                          item.tipo_egreso === 'costo' ? 'destructive' : 'default'
                        }>
                          {item.tipo_egreso}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${item.monto_total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticaEgresos;
