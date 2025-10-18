import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBalanceGeneral } from "@/hooks/useBalanceGeneral";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, Percent, BarChart3, PieChart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart as RechartsPieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const AnalisisResultados = () => {
  const { data: saldos, isLoading } = useBalanceGeneral();

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
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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
        <Tabs defaultValue="margenes" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="margenes">Márgenes</TabsTrigger>
            <TabsTrigger value="rentabilidad">Rentabilidad</TabsTrigger>
            <TabsTrigger value="estructura">Estructura</TabsTrigger>
            <TabsTrigger value="distribucion">Distribución</TabsTrigger>
          </TabsList>

          {/* Tab de Márgenes */}
          <TabsContent value="margenes" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  }} className="h-[300px]">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  }} className="h-[300px]">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  }} className="h-[300px]">
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
        </Tabs>
      </div>
    </div>
  );
};

export default AnalisisResultados;
