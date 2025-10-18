import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBalanceGeneral } from "@/hooks/useBalanceGeneral";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Shield, Activity, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const AnalisisBalance = () => {
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

  // Cálculos del Balance
  const activoCirculante = saldos.caja + saldos.bancos + saldos.cuentasPorCobrar + saldos.inventario;
  const activoFijo = saldos.activosFijos;
  const activoTotal = activoCirculante + activoFijo;

  const pasivoCirculante = saldos.proveedores;
  const pasivoLargoPlazo = saldos.financiamientos;
  const pasivoTotal = pasivoCirculante + pasivoLargoPlazo;

  const capitalContable = saldos.capitalSocial + saldos.utilidadesRetenidas;

  // Ratios de Liquidez
  const razonCorriente = pasivoCirculante > 0 ? activoCirculante / pasivoCirculante : 0;
  const pruebaAcida = pasivoCirculante > 0 ? (activoCirculante - saldos.inventario) / pasivoCirculante : 0;
  const capitalTrabajo = activoCirculante - pasivoCirculante;

  // Ratios de Endeudamiento
  const razonEndeudamiento = activoTotal > 0 ? (pasivoTotal / activoTotal) * 100 : 0;
  const razonDeuda = capitalContable > 0 ? (pasivoTotal / capitalContable) * 100 : 0;
  const multiplicadorCapital = capitalContable > 0 ? activoTotal / capitalContable : 0;

  // Ratios de Eficiencia
  const rotacionActivos = saldos.ingresos > 0 && activoTotal > 0 ? saldos.ingresos / activoTotal : 0;
  const rotacionActivosFijos = saldos.ingresos > 0 && activoFijo > 0 ? saldos.ingresos / activoFijo : 0;

  // Datos para gráficos
  const composicionActivosData = [
    { name: "Caja", value: saldos.caja, fill: "hsl(var(--chart-1))" },
    { name: "Bancos", value: saldos.bancos, fill: "hsl(var(--chart-2))" },
    { name: "Cuentas por Cobrar", value: saldos.cuentasPorCobrar, fill: "hsl(var(--chart-3))" },
    { name: "Inventario", value: saldos.inventario, fill: "hsl(var(--chart-4))" },
    { name: "Activos Fijos", value: activoFijo, fill: "hsl(var(--chart-5))" },
  ];

  const composicionPasivosData = [
    { name: "Proveedores", value: pasivoCirculante, fill: "hsl(var(--chart-2))" },
    { name: "Financiamientos", value: pasivoLargoPlazo, fill: "hsl(var(--chart-3))" },
    { name: "Capital Contable", value: capitalContable, fill: "hsl(var(--chart-1))" },
  ];

  const liquidezData = [
    { name: "Razón Corriente", value: razonCorriente, fill: "hsl(var(--chart-1))" },
    { name: "Prueba Ácida", value: pruebaAcida, fill: "hsl(var(--chart-2))" },
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

  const formatRatio = (value: number) => {
    return value.toFixed(2);
  };

  const getColorForRatio = (value: number, good: number, acceptable: number) => {
    return value >= good ? "text-green-600" : value >= acceptable ? "text-yellow-600" : "text-red-600";
  };

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Análisis Financiero del Balance</h1>
        <p className="text-muted-foreground mt-2">
          Análisis detallado de liquidez, solvencia y estructura financiera
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activo Total</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(activoTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">Recursos totales</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pasivo Total</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(pasivoTotal)}</div>
              <p className={`text-xs mt-1 font-medium ${getColorForRatio(razonEndeudamiento, 0, 50)}`}>
                {formatPercent(razonEndeudamiento)} de endeudamiento
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capital Contable</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(capitalContable)}</div>
              <p className="text-xs text-muted-foreground mt-1">Patrimonio neto</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capital de Trabajo</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(capitalTrabajo)}</div>
              <p className={`text-xs mt-1 font-medium ${capitalTrabajo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {capitalTrabajo >= 0 ? 'Positivo' : 'Negativo'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de Análisis */}
        <Tabs defaultValue="liquidez" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="liquidez">Liquidez</TabsTrigger>
            <TabsTrigger value="endeudamiento">Endeudamiento</TabsTrigger>
            <TabsTrigger value="estructura">Estructura</TabsTrigger>
            <TabsTrigger value="eficiencia">Eficiencia</TabsTrigger>
          </TabsList>

          {/* Tab de Liquidez */}
          <TabsContent value="liquidez" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Ratios de Liquidez</CardTitle>
                  <CardDescription>
                    Capacidad de pago de obligaciones de corto plazo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{
                    value: { label: "Ratio", color: "hsl(var(--chart-1))" }
                  }} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={liquidezData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" name="Ratio">
                          {liquidezData.map((entry, index) => (
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
                  <CardTitle>Interpretación de Liquidez</CardTitle>
                  <CardDescription>Análisis de capacidad de pago</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Razón Corriente</span>
                      <span className={`text-lg font-bold ${getColorForRatio(razonCorriente, 2, 1)}`}>
                        {formatRatio(razonCorriente)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {razonCorriente >= 2 ? "Excelente capacidad de pago. Activos circulantes cubren bien las obligaciones." : 
                       razonCorriente >= 1 ? "Capacidad de pago aceptable. Se pueden cubrir las obligaciones a corto plazo." : 
                       "Liquidez insuficiente. Riesgo de problemas de flujo de efectivo."}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Por cada $1 de pasivo circulante hay ${formatRatio(razonCorriente)} de activo circulante.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Prueba Ácida</span>
                      <span className={`text-lg font-bold ${getColorForRatio(pruebaAcida, 1, 0.5)}`}>
                        {formatRatio(pruebaAcida)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pruebaAcida >= 1 ? "Excelente liquidez inmediata. Puede pagar obligaciones sin vender inventario." : 
                       pruebaAcida >= 0.5 ? "Liquidez inmediata aceptable, aunque dependiente del inventario." : 
                       "Liquidez inmediata baja. Alta dependencia de venta de inventario."}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Capital de Trabajo</span>
                      <span className={`text-lg font-bold ${capitalTrabajo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(capitalTrabajo)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {capitalTrabajo > 0 ? "Capital de trabajo positivo. Hay recursos para operaciones diarias." : 
                       "Capital de trabajo negativo. Puede haber problemas de operación."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab de Endeudamiento */}
          <TabsContent value="endeudamiento" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Ratios de Endeudamiento</CardTitle>
                  <CardDescription>
                    Nivel de apalancamiento y dependencia de deuda
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Razón de Endeudamiento</span>
                      <span className={`text-lg font-bold ${getColorForRatio(100 - razonEndeudamiento, 50, 30)}`}>
                        {formatPercent(razonEndeudamiento)}
                      </span>
                    </div>
                    <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
                      <div 
                        className="bg-chart-2 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(razonEndeudamiento, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {razonEndeudamiento <= 50 ? "Nivel de endeudamiento saludable. Buena estructura financiera." : 
                       razonEndeudamiento <= 70 ? "Endeudamiento moderado. Revisar estructura de deuda." : 
                       "Alto endeudamiento. Riesgo financiero elevado."}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Razón Deuda/Capital</span>
                      <span className={`text-lg font-bold ${getColorForRatio(100 - razonDeuda, 50, 0)}`}>
                        {formatPercent(razonDeuda)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {razonDeuda <= 100 ? "Deuda controlada respecto al capital propio." : 
                       razonDeuda <= 200 ? "Deuda significativa. Monitorear capacidad de pago." : 
                       "Deuda muy alta respecto al capital. Riesgo financiero."}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Multiplicador de Capital</span>
                      <span className="text-lg font-bold">
                        {formatRatio(multiplicadorCapital)}x
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Por cada $1 de capital propio se tienen ${formatRatio(multiplicadorCapital)} en activos totales.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Composición Pasivo + Capital</CardTitle>
                  <CardDescription>
                    Distribución de fuentes de financiamiento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{
                    value: { label: "Monto", color: "hsl(var(--chart-1))" }
                  }} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={composicionPasivosData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {composicionPasivosData.map((entry, index) => (
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
            </div>
          </TabsContent>

          {/* Tab de Estructura */}
          <TabsContent value="estructura" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Composición de Activos</CardTitle>
                  <CardDescription>
                    Distribución de recursos de la empresa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{
                    value: { label: "Monto", color: "hsl(var(--chart-1))" }
                  }} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={composicionActivosData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {composicionActivosData.map((entry, index) => (
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
                  <CardTitle>Desglose de Activos</CardTitle>
                  <CardDescription>Valores monetarios por categoría</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-semibold">
                      <span>Activo Circulante</span>
                      <span>{formatCurrency(activoCirculante)}</span>
                    </div>
                    {composicionActivosData.filter(item => item.name !== "Activos Fijos").map((item, index) => (
                      <div key={index} className="ml-4 space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">{item.name}</span>
                          <span>{formatCurrency(item.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex justify-between items-center text-sm font-semibold">
                      <span>Activo Fijo</span>
                      <span>{formatCurrency(activoFijo)}</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex justify-between items-center text-base font-bold">
                      <span>Activo Total</span>
                      <span>{formatCurrency(activoTotal)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab de Eficiencia */}
          <TabsContent value="eficiencia" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ratios de Eficiencia</CardTitle>
                <CardDescription>
                  Aprovechamiento de activos para generar ingresos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Rotación de Activos Totales</span>
                    <span className="text-lg font-bold">
                      {formatRatio(rotacionActivos)} veces
                    </span>
                  </div>
                  <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-chart-1 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(rotacionActivos * 50, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {rotacionActivos >= 2 ? "Excelente rotación. Los activos generan múltiples veces su valor en ingresos." : 
                     rotacionActivos >= 1 ? "Rotación aceptable. Los activos están generando ingresos razonables." : 
                     "Baja rotación. Los activos no están siendo aprovechados eficientemente."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cada peso invertido en activos generó ${formatRatio(rotacionActivos)} en ingresos.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Rotación de Activos Fijos</span>
                    <span className="text-lg font-bold">
                      {formatRatio(rotacionActivosFijos)} veces
                    </span>
                  </div>
                  <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-chart-2 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(rotacionActivosFijos * 20, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {rotacionActivosFijos >= 5 ? "Excelente aprovechamiento de activos fijos." : 
                     rotacionActivosFijos >= 2 ? "Aprovechamiento aceptable de activos fijos." : 
                     "Baja productividad de activos fijos."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Los activos fijos generaron ${formatRatio(rotacionActivosFijos)} en ingresos por cada peso invertido.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AnalisisBalance;
