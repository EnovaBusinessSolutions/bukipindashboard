import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBalanceGeneral } from "@/hooks/useBalanceGeneral";
import { useEstadoResultadosMensual } from "@/hooks/useEstadoResultadosMensual";
import { useVentasProductos } from "@/hooks/useVentasProductos";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, Percent, BarChart3, PieChart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart as RechartsPieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart, LabelList } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AnalisisResultados = () => {
  const [escalaVisualizacion, setEscalaVisualizacion] = useState<'original' | 'miles' | 'millones'>('original');
  const { data: saldos, isLoading } = useBalanceGeneral();
  const { data: resultadosMensuales, isLoading: isLoadingMensual } = useEstadoResultadosMensual();
  const { data: ventasProductosData, isLoading: isLoadingVentasProductos } = useVentasProductos();

  const ventasProductos = ventasProductosData?.ventasDetalladas || [];
  const ventasPorMes = ventasProductosData?.ventasPorMes || [];
  const productos = ventasProductosData?.productos || [];

  if (isLoading) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="mensual">Estado de Resultados Mensual</TabsTrigger>
            <TabsTrigger value="ventas">Ventas</TabsTrigger>
            <TabsTrigger value="costos">Costos</TabsTrigger>
            <TabsTrigger value="gastos">Gastos</TabsTrigger>
            <TabsTrigger value="depreciaciones">Depreciaciones</TabsTrigger>
            <TabsTrigger value="costo-financiero">Costo Financiero</TabsTrigger>
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

          {/* Tab de Costos */}
          <TabsContent value="costos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Costos</CardTitle>
                <CardDescription>
                  Desglose detallado de los costos de operación
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Contenido en desarrollo...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Gastos */}
          <TabsContent value="gastos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Gastos</CardTitle>
                <CardDescription>
                  Desglose detallado de los gastos operativos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Contenido en desarrollo...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Depreciaciones */}
          <TabsContent value="depreciaciones" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Depreciaciones</CardTitle>
                <CardDescription>
                  Desglose de depreciaciones de activos fijos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Contenido en desarrollo...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Costo Financiero */}
          <TabsContent value="costo-financiero" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Costo Financiero</CardTitle>
                <CardDescription>
                  Desglose de intereses y costos financieros
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Contenido en desarrollo...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AnalisisResultados;
