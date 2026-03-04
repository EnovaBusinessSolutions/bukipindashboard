import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { DollarSign, Users, Target, Clock, Settings, User } from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  LabelList,
} from "recharts";

type NumeroFormato = "normal" | "miles" | "millones";

type Props = {
  loadingAnalytics: boolean;
  analytics: any;

  clientesUnicos: string[];
  filtroClienteAnalitica: string;
  setFiltroClienteAnalitica: (v: string) => void;

  periodoCxC: "mensual" | "anual";
  setPeriodoCxC: (v: "mensual" | "anual") => void;

  filtroAntiguedad: string;
  setFiltroAntiguedad: (v: string) => void;

  selectedCliente: string;
  setSelectedCliente: (v: string) => void;

  formatoNumerosAnalitica: NumeroFormato;
  setFormatoNumerosAnalitica: (v: NumeroFormato) => void;

  decimalesAnalitica: 0 | 1 | 2;
  setDecimalesAnalitica: (v: 0 | 1 | 2) => void;

  formatCurrency: (n: number) => string;
  formatearConPreferenciasAnalitica: (n: number) => string;

  COLORS: {
    primary: string;
    secondary: string;
    accent: string;
    destructive: string;
    warning: string;
    success: string;
  };

  CustomTotalLabel: React.ComponentType<any>;
};

const PanelAnaliticasCxC: React.FC<Props> = ({
  loadingAnalytics,
  analytics,

  clientesUnicos,
  filtroClienteAnalitica,
  setFiltroClienteAnalitica,

  periodoCxC,
  setPeriodoCxC,

  filtroAntiguedad,
  setFiltroAntiguedad,

  selectedCliente,
  setSelectedCliente,

  formatoNumerosAnalitica,
  setFormatoNumerosAnalitica,

  decimalesAnalitica,
  setDecimalesAnalitica,

  formatCurrency,
  formatearConPreferenciasAnalitica,

  COLORS,
  CustomTotalLabel,
}) => {
  if (loadingAnalytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando analíticas...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-muted-foreground">
            No hay datos disponibles para mostrar analíticas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Filtro de Cliente para Analíticas */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium whitespace-nowrap">Filtrar por Cliente:</Label>
            <Select value={filtroClienteAnalitica} onValueChange={setFiltroClienteAnalitica}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="todos">Todos los clientes</SelectItem>
                {(clientesUnicos || []).map((cliente) => (
                  <SelectItem key={cliente} value={cliente}>
                    {cliente}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Principales */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total por Cobrar</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(Number(analytics.totalPendiente || 0))}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(analytics.totalClientes || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Cliente</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Number(analytics.promedioDeuda || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}
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
                .filter((a: any) => Number(a?.min ?? 0) >= 1)
                .reduce((sum: number, a: any) => sum + Number(a?.cantidad || 0), 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Formato Números</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>

          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Escala</Label>
              <Select
                value={formatoNumerosAnalitica}
                onValueChange={(v: any) => setFormatoNumerosAnalitica(v as NumeroFormato)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="miles">Miles (K)</SelectItem>
                  <SelectItem value="millones">Millones (M)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Decimales</Label>
              <Select
                value={String(decimalesAnalitica)}
                onValueChange={(v) => setDecimalesAnalitica(parseInt(v) as 0 | 1 | 2)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico A */}
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Antigüedad de Cuentas por Cobrar</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const rows = analytics?.agingAnalysisDetailed || [];
            const maxMonto = Math.max(...rows.map((a: any) => Number(a?.monto || 0)), 1);
            const dominioY = [0, maxMonto * 1.2];

            return (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="rango"
                    stroke="hsl(var(--foreground))"
                    tick={{ fill: "hsl(var(--foreground))" }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis
                    domain={dominioY}
                    stroke="hsl(var(--foreground))"
                    tick={{ fill: "hsl(var(--foreground))" }}
                    tickFormatter={(value) => formatearConPreferenciasAnalitica(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: any) => [formatearConPreferenciasAnalitica(Number(value)), "Monto"]}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Bar dataKey="monto" fill={COLORS.primary} radius={[8, 8, 0, 0]}>
                    <LabelList
                      dataKey="monto"
                      position="top"
                      formatter={(value: any) => formatearConPreferenciasAnalitica(Number(value))}
                      style={{
                        fontSize: "11px",
                        fontWeight: "bold",
                        fill: "hsl(var(--foreground))",
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </CardContent>
      </Card>

      {/* Gráfico B */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Histórico de Cuentas por Cobrar</CardTitle>
            <Select value={periodoCxC} onValueChange={(value: any) => setPeriodoCxC(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecciona período" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="mensual">Mensual (Mes actual)</SelectItem>
                <SelectItem value="anual">Anual (Año actual)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const rows = analytics?.historicoCxC || [];
            const maxSaldo = Math.max(...rows.map((h: any) => Number(h?.saldo || 0)), 1);
            const dominioY = [0, maxSaldo * 1.2];

            return (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="fecha" stroke="hsl(var(--foreground))" tick={{ fill: "hsl(var(--foreground))" }} />
                  <YAxis
                    domain={dominioY}
                    stroke="hsl(var(--foreground))"
                    tick={{ fill: "hsl(var(--foreground))" }}
                    tickFormatter={(value) =>
                      `$${Number(value).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: any) => [
                      `$${Number(value).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                      "Saldo CxC",
                    ]}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
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
            );
          })()}
        </CardContent>
      </Card>

      {/* Gráfico C */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cuentas por Cobrar por Cliente (Apilado por Antigüedad)</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Total Deuda:</span>
              <Badge variant="default" className="text-lg px-3 py-1">
                {formatearConPreferenciasAnalitica(
                  (analytics?.cxcPorClienteApilado || []).reduce((sum: number, c: any) => sum + Number(c?.total || 0), 0)
                )}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="filtro-antiguedad">Filtrar por antigüedad:</Label>
            <Select value={filtroAntiguedad} onValueChange={setFiltroAntiguedad}>
              <SelectTrigger id="filtro-antiguedad" className="w-[240px]">
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sinVencimiento">Sin vencimiento</SelectItem>
                <SelectItem value="vencido1_15">Vencido 1-15 días</SelectItem>
                <SelectItem value="vencido16_30">Vencido 16-30 días</SelectItem>
                <SelectItem value="vencido31_60">Vencido 31-60 días</SelectItem>
                <SelectItem value="vencido61_90">Vencido 61-90 días</SelectItem>
                <SelectItem value="vencidoMas90">Vencido +90 días</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(() => {
            const base = analytics?.cxcPorClienteApilado || [];

            const dataFiltradaCliente =
              filtroAntiguedad === "todos"
                ? base
                : base
                    .filter((c: any) => Number((c as any)[filtroAntiguedad] || 0) > 0)
                    .sort((a: any, b: any) => Number((b as any)[filtroAntiguedad] || 0) - Number((a as any)[filtroAntiguedad] || 0));

            const maxMontoCliente =
              filtroAntiguedad === "todos"
                ? Math.max(...dataFiltradaCliente.map((c: any) => Number(c?.total || 0)), 1)
                : Math.max(...dataFiltradaCliente.map((c: any) => Number((c as any)[filtroAntiguedad] || 0)), 1);

            const dominioXCliente = [0, maxMontoCliente * 1.2];

            const barConfig: Record<string, { fill: string; name: string }> = {
              sinVencimiento: { fill: "hsl(var(--chart-1))", name: "Sin vencimiento" },
              vencido1_15: { fill: "hsl(var(--chart-2))", name: "Vencido 1-15 días" },
              vencido16_30: { fill: "hsl(var(--chart-3))", name: "Vencido 16-30 días" },
              vencido31_60: { fill: "hsl(var(--warning))", name: "Vencido 31-60 días" },
              vencido61_90: { fill: "hsl(222 47% 55%)", name: "Vencido 61-90 días" },
              vencidoMas90: { fill: "hsl(var(--destructive))", name: "Vencido +90 días" },
            };

            return (
              <ResponsiveContainer width="100%" height={Math.max(400, dataFiltradaCliente.length * 40)}>
                <BarChart data={dataFiltradaCliente} layout="vertical" margin={{ left: 100, right: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    domain={dominioXCliente}
                    stroke="hsl(var(--foreground))"
                    tick={{ fill: "hsl(var(--foreground))" }}
                    tickFormatter={(value) => formatearConPreferenciasAnalitica(Number(value))}
                  />
                  <YAxis
                    type="category"
                    dataKey="cliente"
                    stroke="hsl(var(--foreground))"
                    tick={{ fill: "hsl(var(--foreground))" }}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  />

                  {filtroAntiguedad === "todos" ? (
                    <>
                      <Bar dataKey="sinVencimiento" stackId="a" fill={barConfig.sinVencimiento.fill} name={barConfig.sinVencimiento.name} />
                      <Bar dataKey="vencido1_15" stackId="a" fill={barConfig.vencido1_15.fill} name={barConfig.vencido1_15.name} />
                      <Bar dataKey="vencido16_30" stackId="a" fill={barConfig.vencido16_30.fill} name={barConfig.vencido16_30.name} />
                      <Bar dataKey="vencido31_60" stackId="a" fill={barConfig.vencido31_60.fill} name={barConfig.vencido31_60.name} />
                      <Bar dataKey="vencido61_90" stackId="a" fill={barConfig.vencido61_90.fill} name={barConfig.vencido61_90.name} />
                      <Bar dataKey="vencidoMas90" stackId="a" fill={barConfig.vencidoMas90.fill} name={barConfig.vencidoMas90.name}>
                        <LabelList
                          position="right"
                          content={(props) => (
                            <CustomTotalLabel
                              {...props}
                              filtroAntiguedad={filtroAntiguedad}
                              dataFiltradaCliente={dataFiltradaCliente}
                              formatearConPreferenciasAnalitica={formatearConPreferenciasAnalitica}
                            />
                          )}
                        />
                      </Bar>
                    </>
                  ) : (
                    <Bar
                      dataKey={filtroAntiguedad}
                      fill={barConfig[filtroAntiguedad]?.fill || COLORS.primary}
                      name={barConfig[filtroAntiguedad]?.name || filtroAntiguedad}
                    >
                      <LabelList
                        position="right"
                        content={(props) => (
                          <CustomTotalLabel
                            {...props}
                            filtroAntiguedad={filtroAntiguedad}
                            dataFiltradaCliente={dataFiltradaCliente}
                            formatearConPreferenciasAnalitica={formatearConPreferenciasAnalitica}
                          />
                        )}
                      />
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </CardContent>
      </Card>

      {/* Gráfico D */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Vencimientos por Cliente</CardTitle>
            <Select value={selectedCliente} onValueChange={setSelectedCliente}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {(analytics?.cxcPorClienteApilado || []).map((cliente: any) => (
                  <SelectItem key={cliente.cliente} value={cliente.cliente}>
                    {cliente.cliente} - {formatCurrency(Number(cliente.total || 0))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {selectedCliente ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={(() => {
                  const clienteData = (analytics?.cxcPorClienteApilado || []).find((c: any) => c.cliente === selectedCliente);
                  if (!clienteData) return [];

                  return [
                    { rango: "Sin vencimiento", monto: Number(clienteData.sinVencimiento || 0) },
                    { rango: "Vencido 1-15 días", monto: Number(clienteData.vencido1_15 || 0) },
                    { rango: "Vencido 16-30 días", monto: Number(clienteData.vencido16_30 || 0) },
                    { rango: "Vencido 31-60 días", monto: Number(clienteData.vencido31_60 || 0) },
                    { rango: "Vencido 61-90 días", monto: Number(clienteData.vencido61_90 || 0) },
                    { rango: "Vencido +90 días", monto: Number(clienteData.vencidoMas90 || 0) },
                  ];
                })()}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="rango"
                  stroke="hsl(var(--foreground))"
                  tick={{ fill: "hsl(var(--foreground))" }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis
                  stroke="hsl(var(--foreground))"
                  tick={{ fill: "hsl(var(--foreground))" }}
                  tickFormatter={(value) => `$${(Number(value) / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "Monto"]}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar dataKey="monto" fill={COLORS.primary} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[350px]">
              <div className="text-center space-y-2">
                <User className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Selecciona un cliente para ver el desglose de sus vencimientos
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default PanelAnaliticasCxC;