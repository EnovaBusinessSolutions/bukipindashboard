import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";
import { format } from "date-fns";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
  PieChart, Pie, Legend
} from "recharts";

interface FlujoEfectivoAnaliticoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  vistaColumnas: "consolidada" | "detallada";
}

interface Transaccion {
  fecha: string;
  referencia: string;
  tipo: string;
  descripcion: string;
  monto: number;
  categoria: string;
}

interface WaterfallData {
  name: string;
  value: number;
  start: number;
  fill: string;
  isTotal: boolean;
}

const FlujoEfectivoAnalitico = ({ startDate, endDate }: FlujoEfectivoAnaliticoProps) => {
  // Obtener saldo inicial
  const { data: saldoInicial, isLoading: saldoLoading } = useQuery({
    queryKey: ["saldo-inicial-flujo", startDate],
    queryFn: async () => {
      const startDateStr = startDate.toISOString().split('T')[0];

      const { data } = await supabase
        .from("detalle_asientos")
        .select("debe, haber, cuenta_codigo, asientos_contables!inner(fecha)")
        .in("cuenta_codigo", ["1001", "1002"])
        .lt("asientos_contables.fecha", startDateStr);

      let saldo = 0;
      data?.forEach((detalle) => {
        saldo += Number(detalle.debe || 0) - Number(detalle.haber || 0);
      });

      return saldo;
    },
  });

  const { data: transacciones, isLoading } = useQuery({
    queryKey: ["flujo-efectivo-analitico", startDate, endDate],
    queryFn: async () => {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();
      const trans: Transaccion[] = [];

      // Ingresos
      const { data: ingresos } = await supabase
        .from("transacciones_ingresos")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      ingresos?.forEach(ing => {
        if (ing.monto_pagado > 0) {
          trans.push({
            fecha: format(new Date(ing.created_at), "dd/MM/yyyy"),
            referencia: `ING-${ing.id.slice(0, 8)}`,
            tipo: "Cobro",
            descripcion: ing.descripcion,
            monto: ing.monto_pagado,
            categoria: "Operativo"
          });
        }
      });

      // Egresos
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      egresos?.forEach(egr => {
        if (egr.monto_pagado > 0) {
          trans.push({
            fecha: format(new Date(egr.created_at), "dd/MM/yyyy"),
            referencia: `EGR-${egr.id.slice(0, 8)}`,
            tipo: "Pago",
            descripcion: egr.descripcion,
            monto: -egr.monto_pagado,
            categoria: "Operativo"
          });
        }
      });

      // Inversiones
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      inversiones?.forEach(inv => {
        if (inv.monto_pagado > 0) {
          trans.push({
            fecha: format(new Date(inv.created_at), "dd/MM/yyyy"),
            referencia: `INV-${inv.id.slice(0, 8)}`,
            tipo: "Inversión",
            descripcion: inv.producto_nombre,
            monto: -inv.monto_pagado,
            categoria: "Inversión"
          });
        }
      });

      // Financiamientos - Disposiciones
      const { data: financiamientos } = await supabase
        .from("financiamientos")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      financiamientos?.forEach(fin => {
        if (fin.saldo_inicial > 0) {
          trans.push({
            fecha: format(new Date(fin.created_at), "dd/MM/yyyy"),
            referencia: `FIN-${fin.id.slice(0, 8)}`,
            tipo: "Disposición",
            descripcion: fin.nombre,
            monto: fin.saldo_inicial,
            categoria: "Financiamiento"
          });
        }
      });

      // Financiamientos - Pagos
      const { data: pagos } = await supabase
        .from("transacciones_financiamientos")
        .select("*, financiamientos(nombre)")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      pagos?.forEach(pago => {
        const monto = (pago.capital_pagado || 0) + (pago.interes_pagado || 0);
        if (monto > 0) {
          trans.push({
            fecha: format(new Date(pago.created_at), "dd/MM/yyyy"),
            referencia: `PAG-${pago.id.slice(0, 8)}`,
            tipo: pago.tipo_transaccion === 'amortizacion' ? 'Amortización' : 'Interés',
            descripcion: (pago.financiamientos as any)?.nombre || pago.descripcion || "",
            monto: -monto,
            categoria: "Financiamiento"
          });
        }
      });

      return trans.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    },
  });

  if (isLoading || saldoLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const porCategoria = {
    operativo: transacciones?.filter(t => t.categoria === 'Operativo') || [],
    inversion: transacciones?.filter(t => t.categoria === 'Inversión') || [],
    financiamiento: transacciones?.filter(t => t.categoria === 'Financiamiento') || []
  };

  const totales = {
    operativo: porCategoria.operativo.reduce((sum, t) => sum + t.monto, 0),
    inversion: porCategoria.inversion.reduce((sum, t) => sum + t.monto, 0),
    financiamiento: porCategoria.financiamiento.reduce((sum, t) => sum + t.monto, 0)
  };

  const totalGeneral = totales.operativo + totales.inversion + totales.financiamiento;
  const saldoFinal = (saldoInicial || 0) + totalGeneral;

  // Datos para waterfall
  const waterfallData: WaterfallData[] = [];

  // Saldo Inicial
  waterfallData.push({
    name: "Saldo Inicial",
    value: 0,
    start: saldoInicial || 0,
    fill: "#3b82f6",
    isTotal: true
  });

  // Actividades Operativas
  const despuesOperativo = (saldoInicial || 0) + totales.operativo;
  waterfallData.push({
    name: "Activ. Operativas",
    value: saldoInicial || 0,
    start: totales.operativo,
    fill: totales.operativo >= 0 ? "#10b981" : "#ef4444",
    isTotal: false
  });

  waterfallData.push({
    name: "Subtotal Operativo",
    value: 0,
    start: despuesOperativo,
    fill: "#6366f1",
    isTotal: true
  });

  // Actividades de Inversión
  const despuesInversion = despuesOperativo + totales.inversion;
  waterfallData.push({
    name: "Activ. Inversión",
    value: despuesOperativo,
    start: totales.inversion,
    fill: totales.inversion >= 0 ? "#10b981" : "#ef4444",
    isTotal: false
  });

  waterfallData.push({
    name: "Subtotal Inversión",
    value: 0,
    start: despuesInversion,
    fill: "#6366f1",
    isTotal: true
  });

  // Actividades de Financiamiento
  const despuesFinanciamiento = despuesInversion + totales.financiamiento;
  waterfallData.push({
    name: "Activ. Financ.",
    value: despuesInversion,
    start: totales.financiamiento,
    fill: totales.financiamiento >= 0 ? "#10b981" : "#ef4444",
    isTotal: false
  });

  // Saldo Final
  waterfallData.push({
    name: "SALDO FINAL",
    value: 0,
    start: saldoFinal,
    fill: saldoFinal >= 0 ? "#059669" : "#dc2626",
    isTotal: true
  });

  // Datos para gráfica de pie
  const pieData = [
    { name: "Operativas", value: Math.abs(totales.operativo), fill: "#10b981" },
    { name: "Inversión", value: Math.abs(totales.inversion), fill: "#3b82f6" },
    { name: "Financiamiento", value: Math.abs(totales.financiamiento), fill: "#8b5cf6" }
  ].filter(item => item.value > 0);

  // Datos para gráfica de barras comparativas
  const barData = [
    { name: "Operativas", monto: totales.operativo, fill: totales.operativo >= 0 ? "#10b981" : "#ef4444" },
    { name: "Inversión", monto: totales.inversion, fill: totales.inversion >= 0 ? "#10b981" : "#ef4444" },
    { name: "Financiamiento", monto: totales.financiamiento, fill: totales.financiamiento >= 0 ? "#10b981" : "#ef4444" }
  ];

  const formatCurrency = (value: number) => {
    return `$${Math.abs(value).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const CustomTooltipWaterfall = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const displayValue = data.isTotal ? data.start : data.start;
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-1">{data.name}</p>
          <p className={`text-sm ${displayValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(displayValue)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* 1. Gráfico de Cascada (Waterfall) */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-2xl">1. Gráfico de Cascada del Flujo de Efectivo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visualización del impacto de cada categoría de actividades en el efectivo
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={500}>
            <BarChart
              data={waterfallData}
              margin={{ top: 20, right: 30, left: 60, bottom: 80 }}
              barGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 500 }}
                interval={0}
              />
              <YAxis 
                tickFormatter={(value) => formatCurrency(value)}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                width={80}
              />
              <Tooltip content={<CustomTooltipWaterfall />} />
              <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />
              
              <Bar dataKey="value" stackId="stack" isAnimationActive={false}>
                {waterfallData.map((entry, index) => (
                  <Cell 
                    key={`cell-value-${index}`} 
                    fill="transparent"
                    style={{ pointerEvents: 'none' }}
                  />
                ))}
              </Bar>
              <Bar 
                dataKey="start" 
                stackId="stack" 
                radius={[6, 6, 6, 6]}
                label={{
                  position: 'top',
                  content: ({ x, y, width, value, index }: any) => {
                    const item = waterfallData[index];
                    if (!item) return null;
                    return (
                      <text
                        x={Number(x) + Number(width) / 2}
                        y={Number(y) - 5}
                        fill="hsl(var(--foreground))"
                        textAnchor="middle"
                        dominantBaseline="bottom"
                        fontSize={10}
                        fontWeight="bold"
                      >
                        {formatCurrency(item.start)}
                      </text>
                    );
                  }
                }}
              >
                {waterfallData.map((entry, index) => (
                  <Cell 
                    key={`cell-start-${index}`} 
                    fill={entry.fill}
                    stroke={entry.isTotal ? "#000" : "transparent"}
                    strokeWidth={entry.isTotal ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Saldo Inicial</p>
              <p className="font-semibold text-lg">{formatCurrency(saldoInicial || 0)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Flujo Operativo</p>
              <p className={`font-semibold text-lg ${totales.operativo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totales.operativo)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Flujo Neto</p>
              <p className={`font-semibold text-lg ${totalGeneral >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalGeneral)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Saldo Final</p>
              <p className={`font-semibold text-lg ${saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(saldoFinal)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Gráficos Comparativos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfica de Barras por Actividad */}
        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <CardTitle className="text-xl">2. Comparativa por Tipo de Actividad</CardTitle>
            <p className="text-sm text-muted-foreground">
              Flujo neto de efectivo por categoría
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={barData}
                margin={{ top: 20, right: 20, left: 60, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  angle={-25}
                  textAnchor="end"
                  height={80}
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value)}
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                  width={80}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />
                <Bar dataKey="monto" radius={[8, 8, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfica de Pie - Distribución de Actividades */}
        {pieData.length > 0 && (
          <Card className="border-2">
            <CardHeader className="bg-muted/50">
              <CardTitle className="text-xl">3. Distribución de Movimientos</CardTitle>
              <p className="text-sm text-muted-foreground">
                Participación por tipo de actividad (valores absolutos)
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detalle de Transacciones */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Vista detallada de cada transacción que afecta el efectivo, con su fecha, referencia y categoría.
        </AlertDescription>
      </Alert>

      {/* Actividades Operativas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-green-600">Actividades Operativas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porCategoria.operativo.map((trans, index) => (
                <TableRow key={index}>
                  <TableCell className="text-sm">{trans.fecha}</TableCell>
                  <TableCell className="font-mono text-sm">{trans.referencia}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      trans.tipo === 'Cobro' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                    }`}>
                      {trans.tipo}
                    </span>
                  </TableCell>
                  <TableCell>{trans.descripcion}</TableCell>
                  <TableCell className={`text-right font-medium ${trans.monto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${Math.abs(trans.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={4}>Total Actividades Operativas</TableCell>
                <TableCell className={`text-right ${totales.operativo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totales.operativo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Actividades de Inversión */}
      <Card>
        <CardHeader>
          <CardTitle className="text-blue-600">Actividades de Inversión</CardTitle>
        </CardHeader>
        <CardContent>
          {porCategoria.inversion.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCategoria.inversion.map((trans, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-sm">{trans.fecha}</TableCell>
                    <TableCell className="font-mono text-sm">{trans.referencia}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">
                        {trans.tipo}
                      </span>
                    </TableCell>
                    <TableCell>{trans.descripcion}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      ${Math.abs(trans.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={4}>Total Actividades de Inversión</TableCell>
                  <TableCell className={`text-right ${totales.inversion >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${totales.inversion.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">
              No hay movimientos en este período
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actividades de Financiamiento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-purple-600">Actividades de Financiamiento</CardTitle>
        </CardHeader>
        <CardContent>
          {porCategoria.financiamiento.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCategoria.financiamiento.map((trans, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-sm">{trans.fecha}</TableCell>
                    <TableCell className="font-mono text-sm">{trans.referencia}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        trans.tipo === 'Disposición' ? 'bg-green-500/10 text-green-600' : 'bg-purple-500/10 text-purple-600'
                      }`}>
                        {trans.tipo}
                      </span>
                    </TableCell>
                    <TableCell>{trans.descripcion}</TableCell>
                    <TableCell className={`text-right font-medium ${trans.monto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${Math.abs(trans.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={4}>Total Actividades de Financiamiento</TableCell>
                  <TableCell className={`text-right ${totales.financiamiento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${totales.financiamiento.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">
              No hay movimientos en este período
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total General */}
      <Card className="bg-primary/5">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 items-center">
            <span className="text-2xl font-bold">Flujo Neto Total de Efectivo</span>
            <span className={`text-2xl font-bold text-right ${totalGeneral >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FlujoEfectivoAnalitico;
