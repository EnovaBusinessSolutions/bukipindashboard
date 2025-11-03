import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBalanceGeneral } from "@/hooks/useBalanceGeneral";
import { useEstadoResultadosMensual } from "@/hooks/useEstadoResultadosMensual";
import { useVentasProductos } from "@/hooks/useVentasProductos";
import { useCostosMensuales } from "@/hooks/useCostosMensuales";
import { useIngresosMensualesPorTipo } from "@/hooks/useIngresosMensualesPorTipo";
import { useEgresosMensualesPorTipo } from "@/hooks/useEgresosMensualesPorTipo";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, Percent, BarChart3, PieChart, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart as RechartsPieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart, LabelList } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AnalisisResultados = () => {
  const [escalaVisualizacion, setEscalaVisualizacion] = useState<'original' | 'miles' | 'millones'>('original');
  const { data: saldos, isLoading } = useBalanceGeneral();
  const { data: resultadosMensuales, isLoading: isLoadingMensual } = useEstadoResultadosMensual();
  const { data: ventasProductosData, isLoading: isLoadingVentasProductos } = useVentasProductos();
  const { data: costosData, isLoading: isLoadingCostos } = useCostosMensuales();
  const { data: ingresosPorTipo, isLoading: isLoadingIngresosTipo } = useIngresosMensualesPorTipo();
  const { data: egresosPorTipo, isLoading: isLoadingEgresosTipo } = useEgresosMensualesPorTipo();

  const ventasProductos = ventasProductosData?.ventasDetalladas || [];
  const ventasPorMes = ventasProductosData?.ventasPorMes || [];
  const productos = ventasProductosData?.productos || [];
  const costosMensuales = costosData?.costosMensuales || [];
  const costosPorCuenta = costosData?.costosPorCuenta || [];
  const cuentasCostos = costosData?.cuentas || [];

  if (isLoading || isLoadingMensual || isLoadingIngresosTipo || isLoadingEgresosTipo) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Cargando Análisis Financiero</h3>
              <p className="text-sm text-muted-foreground text-center">
                Calculando resultados mensuales, esto puede tomar unos segundos...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!saldos) return null;

  // Cálculos financieros
  const ingresosTotales = saldos.ingresos;
  const costoVentas = saldos.costos;
  const gastosOperativos = saldos.gastos;
  const utilidadBruta = ingresosTotales - costoVentas;
  const utilidadOperativa = utilidadBruta - gastosOperativos;
  const utilidadNeta = saldos.utilidad;

  // Márgenes
  const margenBruto = ingresosTotales > 0 ? (utilidadBruta / ingresosTotales) * 100 : 0;
  const margenOperativo = ingresosTotales > 0 ? (utilidadOperativa / ingresosTotales) * 100 : 0;
  const margenNeto = ingresosTotales > 0 ? (utilidadNeta / ingresosTotales) * 100 : 0;

  // Ratios de rentabilidad
  const activoTotal = saldos.caja + saldos.bancos + saldos.cuentasPorCobrar + saldos.inventario + saldos.activosFijos;
  const capitalContable = saldos.capitalSocial + saldos.utilidadesRetenidas;
  
  const ROA = activoTotal > 0 ? (utilidadNeta / activoTotal) * 100 : 0; // Return on Assets
  const ROE = capitalContable > 0 ? (utilidadNeta / capitalContable) * 100 : 0; // Return on Equity
  const ROI = (ingresosTotales > 0 && costoVentas + gastosOperativos > 0) 
    ? ((utilidadNeta / (costoVentas + gastosOperativos)) * 100) 
    : 0; // Return on Investment

  // Datos para gráficos
  const margenesData = [
    { name: "Margen Bruto", value: margenBruto, fill: "hsl(var(--chart-1))" },
    { name: "Margen Operativo", value: margenOperativo, fill: "hsl(var(--chart-2))" },
    { name: "Margen Neto", value: margenNeto, fill: "hsl(var(--chart-3))" },
  ];

  const rentabilidadData = [
    { name: "ROA", value: ROA, fill: "hsl(var(--chart-1))" },
    { name: "ROE", value: ROE, fill: "hsl(var(--chart-2))" },
    { name: "ROI", value: ROI, fill: "hsl(var(--chart-3))" },
  ];

  const desgloseCostosData = [
    { name: "Ingresos", value: ingresosTotales, fill: "hsl(var(--chart-1))" },
    { name: "Costos", value: costoVentas, fill: "hsl(var(--chart-2))" },
    { name: "Gastos", value: gastosOperativos, fill: "hsl(var(--chart-3))" },
    { name: "Utilidad", value: utilidadNeta, fill: "hsl(var(--chart-4))" },
  ];

  const estructuraResultadosData = [
    { concepto: "Ingresos", monto: ingresosTotales },
    { concepto: "Costos", monto: -costoVentas },
    { concepto: "Utilidad Bruta", monto: utilidadBruta },
    { concepto: "Gastos", monto: -gastosOperativos },
    { concepto: "Utilidad Operativa", monto: utilidadOperativa },
    { concepto: "Utilidad Neta", monto: utilidadNeta },
  ];

  const distribucionData = [
    { name: "Costos de Venta", value: costoVentas, fill: "hsl(var(--chart-2))" },
    { name: "Gastos Operativos", value: gastosOperativos, fill: "hsl(var(--chart-3))" },
    { name: "Utilidad Neta", value: utilidadNeta, fill: "hsl(var(--chart-4))" },
  ];

  const formatCurrency = (value: number) => {
    let valorAjustado = value;
    let sufijo = '';
    
    if (escalaVisualizacion === 'miles') {
      valorAjustado = value / 1000;
      sufijo = 'K';
    } else if (escalaVisualizacion === 'millones') {
      valorAjustado = value / 1000000;
      sufijo = 'M';
    }
    
    const formatted = new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN',
      minimumFractionDigits: escalaVisualizacion === 'original' ? 0 : 1,
      maximumFractionDigits: escalaVisualizacion === 'original' ? 0 : 1,
    }).format(valorAjustado);
    
    return sufijo ? `${formatted}${sufijo}` : formatted;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getIndicatorColor = (value: number, threshold: number) => {
    return value >= threshold ? "text-green-600" : value >= threshold / 2 ? "text-yellow-600" : "text-red-600";
  };

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Análisis Financiero de Resultados</h1>
        <p className="text-muted-foreground mt-2">
          Análisis detallado de rentabilidad, márgenes y ratios financieros
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(ingresosTotales)}</div>
              <p className="text-xs text-muted-foreground mt-1">Base de análisis</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilidad Bruta</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(utilidadBruta)}</div>
              <p className={`text-xs mt-1 font-medium ${getIndicatorColor(margenBruto, 40)}`}>
                Margen: {formatPercent(margenBruto)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilidad Operativa</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(utilidadOperativa)}</div>
              <p className={`text-xs mt-1 font-medium ${getIndicatorColor(margenOperativo, 20)}`}>
                Margen: {formatPercent(margenOperativo)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilidad Neta</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(utilidadNeta)}</div>
              <p className={`text-xs mt-1 font-medium ${getIndicatorColor(margenNeto, 15)}`}>
                Margen: {formatPercent(margenNeto)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de Análisis */}
        <Tabs defaultValue="mensual" className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="mensual">Estado de Resultados Mensual</TabsTrigger>
            <TabsTrigger value="ventas">Ventas</TabsTrigger>
            <TabsTrigger value="margenes">Márgenes</TabsTrigger>
            <TabsTrigger value="costos">Costos</TabsTrigger>
            <TabsTrigger value="rentabilidad">Rentabilidad</TabsTrigger>
            <TabsTrigger value="estructura">Estructura</TabsTrigger>
            <TabsTrigger value="distribucion">Distribución</TabsTrigger>
          </TabsList>

          {/* Tab de Estado de Resultados Mensual */}
          <TabsContent value="mensual" className="space-y-4">
            {isLoadingMensual ? (
              <Skeleton className="h-96 w-full" />
            ) : resultadosMensuales ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Comparativo de Ingresos vs Egresos con Utilidades</CardTitle>
                    <CardDescription>
                      Barras muestran ingresos y egresos totales, líneas representan evolución de utilidades
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer 
                      config={{
                        ingresos: { label: "Ingresos", color: "hsl(142, 70%, 45%)" },
                        egresos: { label: "Egresos", color: "hsl(0, 70%, 50%)" },
                        utilidadBruta: { label: "Utilidad Bruta", color: "hsl(220, 70%, 50%)" },
                        ebitda: { label: "EBITDA", color: "hsl(142, 70%, 45%)" },
                        ebit: { label: "EBIT", color: "hsl(280, 70%, 50%)" },
                        utilidadNeta: { label: "Utilidad Neta", color: "hsl(25, 95%, 53%)" },
                      }} 
                      className="h-[600px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={resultadosMensuales?.map(r => ({
                          ...r,
                          egresos: r.costos + r.gastos
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="mes" angle={-45} textAnchor="end" height={80} />
                          <YAxis label={{ value: 'Monto ($)', angle: -90, position: 'insideLeft' }} />
                          <ChartTooltip 
                            content={({ active, payload }) => {
                              if (!active || !payload) return null;
                              return (
                                <div className="bg-background border rounded-lg shadow-lg p-3 space-y-1">
                                  <p className="font-bold">{payload[0]?.payload?.mes}</p>
                                  {payload.map((entry: any, index: number) => (
                                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                                      {entry.name}: {formatCurrency(entry.value)}
                                    </p>
                                  ))}
                                </div>
                              );
                            }}
                          />
                          <Legend />
                          <Bar dataKey="ingresos" fill="hsl(142, 70%, 45%)" name="Ingresos">
                            <LabelList
                              dataKey="ingresos"
                              position="top"
                              fill="black"
                              fontSize={11}
                              fontWeight={600}
                              formatter={(value: number) => formatCurrency(value)}
                            />
                          </Bar>
                          <Bar dataKey="egresos" fill="hsl(0, 70%, 50%)" name="Egresos">
                            <LabelList
                              dataKey="egresos"
                              position="top"
                              fill="black"
                              fontSize={11}
                              fontWeight={600}
                              formatter={(value: number) => formatCurrency(value)}
                            />
                          </Bar>
                          <Line type="monotone" dataKey="utilidadBruta" stroke="hsl(220, 70%, 50%)" strokeWidth={3} name="Utilidad Bruta" dot={{ r: 5 }}>
                            <LabelList
                              dataKey="utilidadBruta"
                              position="top"
                              fill="black"
                              fontSize={10}
                              fontWeight={600}
                              formatter={(value: number) => formatCurrency(value)}
                            />
                          </Line>
                          <Line type="monotone" dataKey="ebitda" stroke="hsl(142, 70%, 45%)" strokeWidth={3} name="EBITDA" dot={{ r: 5 }}>
                            <LabelList
                              dataKey="ebitda"
                              position="top"
                              fill="black"
                              fontSize={10}
                              fontWeight={600}
                              formatter={(value: number) => formatCurrency(value)}
                            />
                          </Line>
                          <Line type="monotone" dataKey="ebit" stroke="hsl(280, 70%, 50%)" strokeWidth={3} name="EBIT" dot={{ r: 5 }}>
                            <LabelList
                              dataKey="ebit"
                              position="top"
                              fill="black"
                              fontSize={10}
                              fontWeight={600}
                              formatter={(value: number) => formatCurrency(value)}
                            />
                          </Line>
                          <Line type="monotone" dataKey="utilidadNeta" stroke="hsl(25, 95%, 53%)" strokeWidth={3} name="Utilidad Neta" dot={{ r: 5 }}>
                            <LabelList
                              dataKey="utilidadNeta"
                              position="top"
                              fill="black"
                              fontSize={10}
                              fontWeight={600}
                              formatter={(value: number) => formatCurrency(value)}
                            />
                          </Line>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Nueva Gráfica: Ingresos por Tipo */}
                <Card>
                  <CardHeader>
                    <CardTitle>Desglose de Ingresos por Tipo</CardTitle>
                    <CardDescription>
                      Análisis mensual de ventas y otros ingresos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingIngresosTipo ? (
                      <Skeleton className="h-[400px] w-full" />
                    ) : ingresosPorTipo && ingresosPorTipo.length > 0 ? (
                      <ChartContainer
                        config={{
                          ventas: { label: "Ventas", color: "hsl(142, 70%, 45%)" },
                          otrosIngresos: { label: "Otros Ingresos", color: "hsl(220, 70%, 50%)" },
                        }}
                        className="h-[400px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={ingresosPorTipo}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="mes" angle={-45} textAnchor="end" height={80} />
                            <YAxis label={{ value: 'Monto ($)', angle: -90, position: 'insideLeft' }} />
                            <ChartTooltip
                              content={({ active, payload }) => {
                                if (!active || !payload) return null;
                                return (
                                  <div className="bg-background border rounded-lg shadow-lg p-3 space-y-1">
                                    <p className="font-bold">{payload[0]?.payload?.mes}</p>
                                    {payload.map((entry: any, index: number) => (
                                      <p key={index} className="text-sm" style={{ color: entry.color }}>
                                        {entry.name}: {formatCurrency(entry.value)}
                                      </p>
                                    ))}
                                    <p className="text-sm font-bold border-t pt-1 mt-1">
                                      Total: {formatCurrency(payload[0]?.payload?.total)}
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <Legend />
                            <Bar dataKey="ventas" fill="hsl(142, 70%, 45%)" name="Ventas" stackId="ingresos">
                              <LabelList
                                dataKey="ventas"
                                position="inside"
                                fill="white"
                                fontSize={10}
                                fontWeight={600}
                                formatter={(value: number) => value > 0 ? formatCurrency(value) : ''}
                              />
                            </Bar>
                            <Bar dataKey="otrosIngresos" fill="hsl(220, 70%, 50%)" name="Otros Ingresos" stackId="ingresos">
                              <LabelList
                                dataKey="otrosIngresos"
                                position="inside"
                                fill="white"
                                fontSize={10}
                                fontWeight={600}
                                formatter={(value: number) => value > 0 ? formatCurrency(value) : ''}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No hay datos de ingresos disponibles</p>
                    )}
                  </CardContent>
                </Card>

                {/* Nueva Gráfica: Egresos por Tipo */}
                <Card>
                  <CardHeader>
                    <CardTitle>Desglose de Egresos por Tipo</CardTitle>
                    <CardDescription>
                      Análisis mensual de costos y gastos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingEgresosTipo ? (
                      <Skeleton className="h-[400px] w-full" />
                    ) : egresosPorTipo && egresosPorTipo.length > 0 ? (
                      <ChartContainer
                        config={{
                          costos: { label: "Costos", color: "hsl(0, 70%, 50%)" },
                          gastos: { label: "Gastos", color: "hsl(25, 95%, 53%)" },
                        }}
                        className="h-[400px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={egresosPorTipo}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="mes" angle={-45} textAnchor="end" height={80} />
                            <YAxis label={{ value: 'Monto ($)', angle: -90, position: 'insideLeft' }} />
                            <ChartTooltip
                              content={({ active, payload }) => {
                                if (!active || !payload) return null;
                                return (
                                  <div className="bg-background border rounded-lg shadow-lg p-3 space-y-1">
                                    <p className="font-bold">{payload[0]?.payload?.mes}</p>
                                    {payload.map((entry: any, index: number) => (
                                      <p key={index} className="text-sm" style={{ color: entry.color }}>
                                        {entry.name}: {formatCurrency(entry.value)}
                                      </p>
                                    ))}
                                    <p className="text-sm font-bold border-t pt-1 mt-1">
                                      Total: {formatCurrency(payload[0]?.payload?.total)}
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <Legend />
                            <Bar dataKey="costos" fill="hsl(0, 70%, 50%)" name="Costos" stackId="egresos">
                              <LabelList
                                dataKey="costos"
                                position="inside"
                                fill="white"
                                fontSize={10}
                                fontWeight={600}
                                formatter={(value: number) => value > 0 ? formatCurrency(value) : ''}
                              />
                            </Bar>
                            <Bar dataKey="gastos" fill="hsl(25, 95%, 53%)" name="Gastos" stackId="egresos">
                              <LabelList
                                dataKey="gastos"
                                position="inside"
                                fill="white"
                                fontSize={10}
                                fontWeight={600}
                                formatter={(value: number) => value > 0 ? formatCurrency(value) : ''}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No hay datos de egresos disponibles</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>Estado de Resultados Mensual</CardTitle>
                        <CardDescription>
                          Análisis mensual de ingresos, costos, gastos y utilidades del ejercicio actual
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Visualizar en:</span>
                        <select 
                          value={escalaVisualizacion}
                          onChange={(e) => setEscalaVisualizacion(e.target.value as 'original' | 'miles' | 'millones')}
                          className="px-3 py-1 border rounded-md text-sm bg-background"
                        >
                          <option value="original">Original</option>
                          <option value="miles">Miles</option>
                          <option value="millones">Millones</option>
                        </select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="font-bold py-2">Concepto</TableHead>
                            {resultadosMensuales.map((r) => (
                              <TableHead key={r.mes} className="text-right min-w-[100px] font-semibold py-2">{r.mes}</TableHead>
                            ))}
                            <TableHead className="text-right font-bold min-w-[120px] py-2">Total Anual</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-bold py-2">Ingresos</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right py-2">
                                {formatCurrency(r.ingresos)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold py-2">
                              {formatCurrency(resultadosMensuales.reduce((sum, r) => sum + r.ingresos, 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-bold py-2">Costos</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right text-red-600 py-2">
                                ({formatCurrency(r.costos)})
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold text-red-600 py-2">
                              ({formatCurrency(resultadosMensuales.reduce((sum, r) => sum + r.costos, 0))})
                            </TableCell>
                          </TableRow>
                          <TableRow className="border-t-2 bg-muted/50">
                            <TableCell className="font-bold py-2">Utilidad Bruta</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right font-bold py-2">
                                {formatCurrency(r.utilidadBruta)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold py-2">
                              {formatCurrency(resultadosMensuales.reduce((sum, r) => sum + r.utilidadBruta, 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50">
                            <TableCell className="font-bold italic text-sm py-1.5">Margen Bruto %</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right font-semibold italic text-sm py-1.5">
                                {formatPercent(r.margenBruto)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold italic text-sm py-1.5">
                              {formatPercent(
                                resultadosMensuales.reduce((sum, r) => sum + r.ingresos, 0) > 0
                                  ? (resultadosMensuales.reduce((sum, r) => sum + r.utilidadBruta, 0) / 
                                     resultadosMensuales.reduce((sum, r) => sum + r.ingresos, 0)) * 100
                                  : 0
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-bold py-2">Gastos Operativos</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right text-red-600 py-2">
                                ({formatCurrency(r.gastos)})
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold text-red-600 py-2">
                              ({formatCurrency(resultadosMensuales.reduce((sum, r) => sum + r.gastos, 0))})
                            </TableCell>
                          </TableRow>
                          <TableRow className="border-t-2 bg-muted/50">
                            <TableCell className="font-bold py-2">EBITDA</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right font-bold py-2">
                                {formatCurrency(r.ebitda)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold py-2">
                              {formatCurrency(resultadosMensuales.reduce((sum, r) => sum + r.ebitda, 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50">
                            <TableCell className="font-bold italic text-sm py-1.5">Margen EBITDA %</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right font-semibold italic text-sm py-1.5">
                                {formatPercent(r.margenEBITDA)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold italic text-sm py-1.5">
                              {formatPercent(
                                resultadosMensuales.reduce((sum, r) => sum + r.ingresos, 0) > 0
                                  ? (resultadosMensuales.reduce((sum, r) => sum + r.ebitda, 0) / 
                                     resultadosMensuales.reduce((sum, r) => sum + r.ingresos, 0)) * 100
                                  : 0
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-bold py-2">Depreciación</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right text-red-600 py-2">
                                ({formatCurrency(r.depreciacion)})
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold text-red-600 py-2">
                              ({formatCurrency(resultadosMensuales.reduce((sum, r) => sum + r.depreciacion, 0))})
                            </TableCell>
                          </TableRow>
                          <TableRow className="border-t-2 bg-muted/50">
                            <TableCell className="font-bold py-2">EBIT (Utilidad Operativa)</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right font-bold py-2">
                                {formatCurrency(r.ebit)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold py-2">
                              {formatCurrency(resultadosMensuales.reduce((sum, r) => sum + r.ebit, 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50">
                            <TableCell className="font-bold italic text-sm py-1.5">Margen EBIT %</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right font-semibold italic text-sm py-1.5">
                                {formatPercent(r.margenEBIT)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold italic text-sm py-1.5">
                              {formatPercent(
                                resultadosMensuales.reduce((sum, r) => sum + r.ingresos, 0) > 0
                                  ? (resultadosMensuales.reduce((sum, r) => sum + r.ebit, 0) / 
                                     resultadosMensuales.reduce((sum, r) => sum + r.ingresos, 0)) * 100
                                  : 0
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-bold py-2">Intereses</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right text-red-600 py-2">
                                ({formatCurrency(r.intereses)})
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold text-red-600 py-2">
                              ({formatCurrency(resultadosMensuales.reduce((sum, r) => sum + r.intereses, 0))})
                            </TableCell>
                          </TableRow>
                          <TableRow className="border-t-2 bg-muted/50">
                            <TableCell className="font-bold py-2">Utilidad antes de Impuestos (EBT)</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right font-bold py-2">
                                {formatCurrency(r.utilidadAntesImpuestos)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold py-2">
                              {formatCurrency(resultadosMensuales.reduce((sum, r) => sum + r.utilidadAntesImpuestos, 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-bold py-2">Impuestos (30%)</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right text-red-600 py-2">
                                ({formatCurrency(r.impuestos)})
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold text-red-600 py-2">
                              ({formatCurrency(resultadosMensuales.reduce((sum, r) => sum + r.impuestos, 0))})
                            </TableCell>
                          </TableRow>
                          <TableRow className="border-t-2 bg-muted/50">
                            <TableCell className="font-bold py-2">Utilidad Neta</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right font-bold py-2">
                                {formatCurrency(r.utilidadNeta)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold py-2">
                              {formatCurrency(resultadosMensuales.reduce((sum, r) => sum + r.utilidadNeta, 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50">
                            <TableCell className="font-bold italic text-sm py-1.5">Margen Neto %</TableCell>
                            {resultadosMensuales.map((r) => (
                              <TableCell key={r.mes} className="text-right font-semibold italic text-sm py-1.5">
                                {formatPercent(r.margenNeto)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold italic text-sm py-1.5">
                              {formatPercent(
                                resultadosMensuales.reduce((sum, r) => sum + r.ingresos, 0) > 0
                                  ? (resultadosMensuales.reduce((sum, r) => sum + r.utilidadNeta, 0) / 
                                     resultadosMensuales.reduce((sum, r) => sum + r.ingresos, 0)) * 100
                                  : 0
                              )}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>

          {/* Tab de Márgenes */}
          <TabsContent value="margenes" className="space-y-4">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Análisis de Márgenes</CardTitle>
                  <CardDescription>
                    Comparación de márgenes de rentabilidad en cada nivel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{
                    value: { label: "Porcentaje", color: "hsl(var(--chart-1))" }
                  }} className="h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={margenesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="hsl(var(--chart-1))" name="Margen %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Interpretación de Márgenes</CardTitle>
                  <CardDescription>Análisis detallado por tipo de margen</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Margen Bruto</span>
                      <span className={`text-sm font-bold ${getIndicatorColor(margenBruto, 40)}`}>
                        {formatPercent(margenBruto)}
                      </span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-chart-1 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(margenBruto, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {margenBruto >= 40 ? "Excelente eficiencia en costos de producción" : 
                       margenBruto >= 20 ? "Margen moderado, revisar costos" : 
                       "Margen bajo, optimizar costos urgentemente"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Margen Operativo</span>
                      <span className={`text-sm font-bold ${getIndicatorColor(margenOperativo, 20)}`}>
                        {formatPercent(margenOperativo)}
                      </span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-chart-2 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(margenOperativo, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {margenOperativo >= 20 ? "Operación eficiente con buenos controles" : 
                       margenOperativo >= 10 ? "Operación aceptable, mejorar eficiencia" : 
                       "Gastos operativos elevados, requiere control"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Margen Neto</span>
                      <span className={`text-sm font-bold ${getIndicatorColor(margenNeto, 15)}`}>
                        {formatPercent(margenNeto)}
                      </span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-chart-3 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(margenNeto, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {margenNeto >= 15 ? "Rentabilidad neta excelente" : 
                       margenNeto >= 7 ? "Rentabilidad aceptable" : 
                       "Rentabilidad baja, revisar estructura de costos"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab de Rentabilidad */}
          <TabsContent value="rentabilidad" className="space-y-4">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Ratios de Rentabilidad</CardTitle>
                  <CardDescription>
                    Indicadores clave de retorno sobre inversión
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{
                    value: { label: "Porcentaje", color: "hsl(var(--chart-1))" }
                  }} className="h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rentabilidadData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" name="Ratio %">
                          {rentabilidadData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Interpretación de Ratios</CardTitle>
                  <CardDescription>Análisis de eficiencia y retornos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">ROA (Return on Assets)</span>
                      <span className={`text-lg font-bold ${getIndicatorColor(ROA, 10)}`}>
                        {formatPercent(ROA)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Utilidad generada por cada peso de activos. 
                      {ROA >= 10 ? " Excelente aprovechamiento de activos." : 
                       ROA >= 5 ? " Uso aceptable de activos." : 
                       " Activos subutilizados."}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">ROE (Return on Equity)</span>
                      <span className={`text-lg font-bold ${getIndicatorColor(ROE, 15)}`}>
                        {formatPercent(ROE)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Retorno sobre capital de accionistas.
                      {ROE >= 15 ? " Excelente retorno para inversionistas." : 
                       ROE >= 8 ? " Retorno moderado sobre inversión." : 
                       " Retorno bajo sobre capital."}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">ROI (Return on Investment)</span>
                      <span className={`text-lg font-bold ${getIndicatorColor(ROI, 20)}`}>
                        {formatPercent(ROI)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Retorno sobre inversión total.
                      {ROI >= 20 ? " Inversión altamente rentable." : 
                       ROI >= 10 ? " Inversión con retorno aceptable." : 
                       " Inversión con bajo retorno."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab de Estructura */}
          <TabsContent value="estructura" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Estructura del Estado de Resultados</CardTitle>
                <CardDescription>
                  Flujo desde ingresos hasta utilidad neta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{
                  monto: { label: "Monto", color: "hsl(var(--chart-1))" }
                }} className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={estructuraResultadosData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="concepto" type="category" width={120} />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="monto" fill="hsl(var(--chart-1))" name="Monto">
                        {estructuraResultadosData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.monto >= 0 ? "hsl(var(--chart-1))" : "hsl(var(--chart-2))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Distribución */}
          <TabsContent value="distribucion" className="space-y-4">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Distribución de Ingresos</CardTitle>
                  <CardDescription>
                    Cómo se distribuyen los ingresos entre costos, gastos y utilidad
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{
                    value: { label: "Monto", color: "hsl(var(--chart-1))" }
                  }} className="h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={distribucionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {distribucionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Desglose Monetario</CardTitle>
                  <CardDescription>Valores absolutos de cada componente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {desgloseCostosData.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="text-sm font-bold">{formatCurrency(item.value)}</span>
                      </div>
                      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${(item.value / ingresosTotales) * 100}%`,
                            backgroundColor: item.fill.replace('hsl(var(', 'hsl(').replace(')', ')')
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {((item.value / ingresosTotales) * 100).toFixed(2)}% del total de ingresos
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab de Ventas por Producto */}
          <TabsContent value="ventas" className="space-y-4">
            {isLoadingVentasProductos ? (
              <Skeleton className="h-96 w-full" />
            ) : (() => {
              // Preparar datos para las gráficas
              const mesesDelAno = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
              
              // Usar ventasPorMes del hook directamente y enriquecerlo con cálculos adicionales
              const datosPorMes = mesesDelAno.map(mes => {
                // Buscar el mes en ventasPorMes o crear uno vacío
                const ventasDelMes = ventasPorMes.find(v => v.mes === mes);
                const productosDelMes: any = ventasDelMes ? { ...ventasDelMes } : { mes };
                
                let totalMontoMes = 0;
                let totalVolumenMes = 0;
                
                // Calcular totales
                productos.forEach(producto => {
                  const monto = productosDelMes[`${producto}_monto`] || 0;
                  const volumen = productosDelMes[`${producto}_volumen`] || 0;
                  totalMontoMes += monto;
                  totalVolumenMes += volumen;
                });
                
                productosDelMes.totalMonto = totalMontoMes;
                productosDelMes.totalVolumen = totalVolumenMes;
                
                // Calcular porcentajes y precios promedio
                productos.forEach(producto => {
                  const monto = productosDelMes[`${producto}_monto`] || 0;
                  const volumen = productosDelMes[`${producto}_volumen`] || 0;
                  productosDelMes[`${producto}_pct_monto`] = totalMontoMes > 0 ? (monto / totalMontoMes) * 100 : 0;
                  productosDelMes[`${producto}_pct_volumen`] = totalVolumenMes > 0 ? (volumen / totalVolumenMes) * 100 : 0;
                  productosDelMes[`${producto}_precio_promedio`] = volumen > 0 ? monto / volumen : 0;
                });
                
                // Precio promedio general del mes
                productosDelMes.precioPromedioGeneral = totalVolumenMes > 0 ? totalMontoMes / totalVolumenMes : 0;
                
                return productosDelMes;
              });

              // Datos para la tabla (productos en filas, meses en columnas)
              const productosConDatos = productos.map(producto => {
                const ventasProducto = ventasProductos.filter(v => v.producto === producto);
                const datosPorMesProducto: any = { 
                  nombre: producto,
                  // Aquí podríamos agregar la URL de imagen si está disponible
                };
                
                mesesDelAno.forEach(mes => {
                  const venta = ventasProducto.find(v => v.mes === mes);
                  datosPorMesProducto[mes] = {
                    monto: venta?.monto || 0,
                    volumen: venta?.volumen || 0,
                    tarifaPromedio: venta?.tarifaPromedio || 0
                  };
                });
                
                return datosPorMesProducto;
              });

              const colors = [
                "hsl(var(--chart-1))", 
                "hsl(var(--chart-2))", 
                "hsl(var(--chart-3))", 
                "hsl(var(--chart-4))", 
                "hsl(var(--chart-5))"
              ];

              return (
                <>
                  {/* 1. Gráfica de Ventas por Producto (Columnas Apiladas) */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Ventas por Producto (Monto Total)</CardTitle>
                      <CardDescription>
                        Monto individual de ventas por producto en columnas apiladas por mes
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 pb-2">
                      <ChartContainer 
                        config={productos.reduce((acc, producto, index) => {
                          acc[`${producto}_monto`] = {
                            label: producto,
                            color: colors[index % colors.length]
                          };
                          return acc;
                        }, {} as any)} 
                        className="h-[600px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={datosPorMes}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="mes" tick={{ fill: 'hsl(var(--foreground))' }} />
                            <YAxis tick={{ fill: 'hsl(var(--foreground))' }} label={{ value: 'Monto ($)', angle: -90, position: 'insideLeft' }} />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (!active || !payload || !payload.length) return null;
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-background border rounded-lg shadow-lg p-3 space-y-1">
                                    <p className="font-bold">{data.mes}</p>
                                    {productos.map((prod) => {
                                      const valor = data[`${prod}_monto`];
                                      if (!valor || valor === 0) return null;
                                      const color = colors[productos.indexOf(prod) % colors.length];
                                      return (
                                        <p key={prod} className="text-sm" style={{ color }}>
                                          {prod}: {formatCurrency(valor)}
                                        </p>
                                      );
                                    })}
                                    <p className="text-sm font-bold border-t pt-1">
                                      Total: {formatCurrency(data.totalMonto || 0)}
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <Legend />
                            {productos.map((producto, index) => (
                              <Bar
                                key={producto}
                                dataKey={`${producto}_monto`}
                                stackId="a"
                                fill={colors[index % colors.length]}
                                name={producto}
                              >
                                <LabelList
                                  dataKey={`${producto}_monto`}
                                  position="center"
                                  fill="black"
                                  fontSize={11}
                                  fontWeight={600}
                                  formatter={(value: number) => value > 0 ? formatCurrency(value) : ''}
                                />
                              </Bar>
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* 2. Gráfica de Número de Ventas (Unidades) */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Volumen de Ventas por Producto (Unidades)</CardTitle>
                      <CardDescription>
                        Cantidad de unidades vendidas por producto cada mes
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 pb-2">
                      <ChartContainer 
                        config={productos.reduce((acc, producto, index) => {
                          acc[`${producto}_volumen`] = {
                            label: producto,
                            color: colors[index % colors.length]
                          };
                          return acc;
                        }, {} as any)} 
                        className="h-[600px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={datosPorMes}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="mes" tick={{ fill: 'hsl(var(--foreground))' }} />
                            <YAxis tick={{ fill: 'hsl(var(--foreground))' }} label={{ value: 'Unidades', angle: -90, position: 'insideLeft' }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            {productos.map((producto, index) => (
                              <Bar
                                key={producto}
                                dataKey={`${producto}_volumen`}
                                fill={colors[index % colors.length]}
                                name={producto}
                                label={{ position: 'center', fill: 'white', fontSize: 12, formatter: (value: number) => value > 0 ? value.toFixed(0) : '' }}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* 3. Gráfica de Porcentaje de Ventas por Producto (Monto) */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Porcentaje de Ventas por Producto (Monto)</CardTitle>
                      <CardDescription>
                        Porcentaje que representa cada producto sobre el total de ventas en dinero del mes
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 pb-2">
                      <ChartContainer 
                        config={productos.reduce((acc, producto, index) => {
                          acc[`${producto}_pct_monto`] = {
                            label: producto,
                            color: colors[index % colors.length]
                          };
                          return acc;
                        }, {} as any)} 
                        className="h-[600px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={datosPorMes}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="mes" tick={{ fill: 'hsl(var(--foreground))' }} />
                            <YAxis tick={{ fill: 'hsl(var(--foreground))' }} label={{ value: 'Porcentaje (%)', angle: -90, position: 'insideLeft' }} />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (!active || !payload) return null;
                                return (
                                  <div className="bg-background border rounded-lg shadow-lg p-3 space-y-1">
                                    <p className="font-bold">{payload[0]?.payload?.mes}</p>
                                    {payload.map((entry: any, index: number) => (
                                      <p key={index} className="text-sm" style={{ color: entry.color }}>
                                        {entry.name}: {formatPercent(entry.value)}
                                      </p>
                                    ))}
                                  </div>
                                );
                              }}
                            />
                            <Legend />
                            {productos.map((producto, index) => (
                              <Line
                                key={producto}
                                type="monotone"
                                dataKey={`${producto}_pct_monto`}
                                stroke={colors[index % colors.length]}
                                strokeWidth={3}
                                name={producto}
                                dot={{ r: 5 }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* 4. Gráfica de Porcentaje de Ventas por Volumen */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Porcentaje de Ventas por Producto (Volumen)</CardTitle>
                      <CardDescription>
                        Porcentaje que representa cada producto sobre el total de unidades vendidas del mes
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 pb-2">
                      <ChartContainer 
                        config={productos.reduce((acc, producto, index) => {
                          acc[`${producto}_pct_volumen`] = {
                            label: producto,
                            color: colors[index % colors.length]
                          };
                          return acc;
                        }, {} as any)} 
                        className="h-[600px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={datosPorMes}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="mes" tick={{ fill: 'hsl(var(--foreground))' }} />
                            <YAxis tick={{ fill: 'hsl(var(--foreground))' }} label={{ value: 'Porcentaje (%)', angle: -90, position: 'insideLeft' }} />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (!active || !payload) return null;
                                return (
                                  <div className="bg-background border rounded-lg shadow-lg p-3 space-y-1">
                                    <p className="font-bold">{payload[0]?.payload?.mes}</p>
                                    {payload.map((entry: any, index: number) => (
                                      <p key={index} className="text-sm" style={{ color: entry.color }}>
                                        {entry.name}: {formatPercent(entry.value)}
                                      </p>
                                    ))}
                                  </div>
                                );
                              }}
                            />
                            <Legend />
                            {productos.map((producto, index) => (
                              <Line
                                key={producto}
                                type="monotone"
                                dataKey={`${producto}_pct_volumen`}
                                stroke={colors[index % colors.length]}
                                strokeWidth={3}
                                name={producto}
                                dot={{ r: 5, fill: colors[index % colors.length] }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* 5. Gráfica Combinada: Total de Ventas y Ticket Promedio */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Ventas Totales y Ticket Promedio</CardTitle>
                      <CardDescription>
                        Comparación del total de ventas mensuales (barras) con el ticket promedio (línea)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 pb-2">
                      <ChartContainer 
                        config={{
                          totalMonto: {
                            label: "Total Ventas",
                            color: "hsl(var(--primary))"
                          },
                          precioPromedioGeneral: {
                            label: "Ticket Promedio",
                            color: "hsl(var(--destructive))"
                          }
                        }} 
                        className="h-[600px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={datosPorMes}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="mes" tick={{ fill: 'hsl(var(--foreground))' }} />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fill: 'hsl(var(--foreground))' }} 
                              label={{ value: 'Total Ventas ($)', angle: -90, position: 'insideLeft' }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: 'hsl(var(--foreground))' }} 
                              label={{ value: 'Ticket Promedio ($)', angle: 90, position: 'insideRight' }}
                            />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (!active || !payload) return null;
                                return (
                                  <div className="bg-background border rounded-lg shadow-lg p-3 space-y-1">
                                    <p className="font-bold">{payload[0]?.payload?.mes}</p>
                                    {payload.map((entry: any, index: number) => (
                                      <p key={index} className="text-sm" style={{ color: entry.color }}>
                                        {entry.name}: {formatCurrency(entry.value)}
                                      </p>
                                    ))}
                                  </div>
                                );
                              }}
                            />
                            <Legend />
                            <Bar 
                              yAxisId="left"
                              dataKey="totalMonto" 
                              fill="hsl(var(--primary))" 
                              name="Total Ventas"
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="precioPromedioGeneral"
                              stroke="hsl(var(--destructive))"
                              strokeWidth={4}
                              name="Ticket Promedio"
                              dot={{ r: 6 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* Tabla Final: Productos en Filas, Meses en Columnas */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Resumen de Ventas por Producto y Mes</CardTitle>
                      <CardDescription>
                        Tabla detallada con productos en filas y meses en columnas
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-primary/10">
                              <TableHead className="font-bold bg-primary/20 sticky left-0 z-10">Producto</TableHead>
                              {mesesDelAno.map((mes) => (
                                <TableHead key={mes} className="text-right min-w-[120px] font-semibold">{mes}</TableHead>
                              ))}
                              <TableHead className="text-right font-bold bg-primary/20 min-w-[120px]">Total Anual</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {productosConDatos.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={mesesDelAno.length + 2} className="text-center text-muted-foreground py-8">
                                  No hay datos de ventas de productos disponibles para el año actual
                                </TableCell>
                              </TableRow>
                            ) : (
                              productosConDatos.map((producto, index) => {
                                const totalAnual = mesesDelAno.reduce((sum, mes) => sum + (producto[mes]?.monto || 0), 0);
                                const totalVolumen = mesesDelAno.reduce((sum, mes) => sum + (producto[mes]?.volumen || 0), 0);
                                
                                return (
                                  <TableRow key={producto.nombre}>
                                    <TableCell className="font-medium bg-muted/50 sticky left-0 z-10">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: colors[index % colors.length] }}>
                                          {producto.nombre.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span>{producto.nombre}</span>
                                      </div>
                                    </TableCell>
                                    {mesesDelAno.map((mes) => (
                                      <TableCell key={mes} className="text-right">
                                        <div className="space-y-1">
                                          <div className="text-green-600 font-medium">
                                            {formatCurrency(producto[mes]?.monto || 0)}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {(producto[mes]?.volumen || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })} und
                                          </div>
                                        </div>
                                      </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold bg-muted">
                                      <div className="space-y-1">
                                        <div className="text-green-600">
                                          {formatCurrency(totalAnual)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {totalVolumen.toLocaleString('es-MX', { maximumFractionDigits: 0 })} und
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          {/* Tab de Costos */}
          <TabsContent value="costos" className="space-y-4">
            {isLoadingCostos ? (
              <Skeleton className="h-96 w-full" />
            ) : costosMensuales.length > 0 ? (
              <>
                {/* Gráfica de Costos Mensuales por Cuenta */}
                <Card>
                  <CardHeader>
                    <CardTitle>Evolución Mensual de Costos por Cuenta</CardTitle>
                    <CardDescription>
                      Análisis de costos desglosados por cuenta contable a lo largo del año
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={
                        cuentasCostos.reduce((acc, cuenta, index) => {
                          const colors = [
                            "hsl(220, 70%, 50%)",
                            "hsl(142, 70%, 45%)",
                            "hsl(0, 70%, 50%)",
                            "hsl(280, 70%, 50%)",
                            "hsl(25, 95%, 53%)",
                            "hsl(45, 93%, 47%)",
                            "hsl(340, 82%, 52%)",
                            "hsl(195, 85%, 50%)"
                          ];
                          acc[cuenta.codigo] = {
                            label: cuenta.nombre,
                            color: colors[index % colors.length]
                          };
                          return acc;
                        }, {} as Record<string, { label: string; color: string }>)
                      }
                      className="h-[500px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={costosMensuales}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="mes" angle={-45} textAnchor="end" height={80} />
                          <YAxis label={{ value: 'Monto ($)', angle: -90, position: 'insideLeft' }} />
                          <ChartTooltip
                            content={({ active, payload }) => {
                              if (!active || !payload) return null;
                              return (
                                <div className="bg-background border rounded-lg shadow-lg p-3 space-y-1">
                                  <p className="font-bold">{payload[0]?.payload?.mes}</p>
                                  {payload.map((entry: any, index: number) => (
                                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                                      {entry.name}: {formatCurrency(entry.value)}
                                    </p>
                                  ))}
                                  <p className="text-sm font-bold border-t pt-1 mt-1">
                                    Total: {formatCurrency(payload[0]?.payload?.total)}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Legend />
                          {cuentasCostos.map((cuenta, index) => {
                            const colors = [
                              "hsl(220, 70%, 50%)",
                              "hsl(142, 70%, 45%)",
                              "hsl(0, 70%, 50%)",
                              "hsl(280, 70%, 50%)",
                              "hsl(25, 95%, 53%)",
                              "hsl(45, 93%, 47%)",
                              "hsl(340, 82%, 52%)",
                              "hsl(195, 85%, 50%)"
                            ];
                            return (
                              <Line
                                key={cuenta.codigo}
                                type="monotone"
                                dataKey={cuenta.codigo}
                                stroke={colors[index % colors.length]}
                                strokeWidth={3}
                                name={cuenta.nombre}
                                dot={{ r: 5 }}
                              />
                            );
                          })}
                          <Line
                            type="monotone"
                            dataKey="total"
                            stroke="hsl(0, 0%, 20%)"
                            strokeWidth={4}
                            strokeDasharray="5 5"
                            name="Total Costos"
                            dot={{ r: 6 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Tabla de Costos Mensuales */}
                <Card>
                  <CardHeader>
                    <CardTitle>Detalle de Costos Mensuales por Cuenta</CardTitle>
                    <CardDescription>
                      Tabla con el desglose completo de costos por mes y cuenta contable
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="font-bold">Mes</TableHead>
                            {cuentasCostos.map((cuenta) => (
                              <TableHead key={cuenta.codigo} className="text-right min-w-[120px]">
                                {cuenta.nombre}
                              </TableHead>
                            ))}
                            <TableHead className="text-right font-bold min-w-[120px] bg-muted/50">
                              Total Mes
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {costosMensuales.map((mes) => (
                            <TableRow key={mes.mes}>
                              <TableCell className="font-medium">{mes.mes}</TableCell>
                              {cuentasCostos.map((cuenta) => (
                                <TableCell key={cuenta.codigo} className="text-right">
                                  {formatCurrency(mes[cuenta.codigo] as number || 0)}
                                </TableCell>
                              ))}
                              <TableCell className="text-right font-bold bg-muted/20">
                                {formatCurrency(mes.total as number)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-primary/10 font-bold">
                            <TableCell>Total Anual</TableCell>
                            {cuentasCostos.map((cuenta) => (
                              <TableCell key={cuenta.codigo} className="text-right">
                                {formatCurrency(
                                  costosMensuales.reduce((sum, mes) => sum + ((mes[cuenta.codigo] as number) || 0), 0)
                                )}
                              </TableCell>
                            ))}
                            <TableCell className="text-right bg-primary/20">
                              {formatCurrency(
                                costosMensuales.reduce((sum, mes) => sum + (mes.total as number), 0)
                              )}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Sin Datos de Costos</CardTitle>
                  <CardDescription>
                    No hay transacciones de costos registradas para el año actual
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-center py-8">
                    Comienza a registrar costos para ver el análisis mensual
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AnalisisResultados;
