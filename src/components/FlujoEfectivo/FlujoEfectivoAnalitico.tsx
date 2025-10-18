import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";
import { format } from "date-fns";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts";

interface FlujoEfectivoAnaliticoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  vistaColumnas: "consolidada" | "detallada";
  filtroMetodoPago: "consolidado" | "efectivo" | "bancos";
}

interface Transaccion {
  fecha: string;
  referencia: string;
  tipo: string;
  descripcion: string;
  monto: number;
  categoria: string;
  metodoPago?: string;
}

interface WaterfallData {
  name: string;
  value: number;
  start: number;
  fill: string;
  isTotal: boolean;
}

const FlujoEfectivoAnalitico = ({ startDate, endDate, filtroMetodoPago }: FlujoEfectivoAnaliticoProps) => {
  // Obtener saldo inicial
  const { data: saldoInicial, isLoading: saldoLoading } = useQuery({
    queryKey: ["saldo-inicial-flujo", startDate, filtroMetodoPago],
    queryFn: async () => {
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // Filtrar por cuenta dependiendo del filtro
      const cuentas = filtroMetodoPago === "consolidado" 
        ? ["1001", "1002"] 
        : filtroMetodoPago === "efectivo" 
          ? ["1001"] 
          : ["1002"];

      const { data } = await supabase
        .from("detalle_asientos")
        .select("debe, haber, cuenta_codigo, asientos_contables!inner(fecha)")
        .in("cuenta_codigo", cuentas)
        .lt("asientos_contables.fecha", startDateStr);

      let saldo = 0;
      data?.forEach((detalle) => {
        saldo += Number(detalle.debe || 0) - Number(detalle.haber || 0);
      });

      return saldo;
    },
  });

  const { data: transacciones, isLoading } = useQuery({
    queryKey: ["flujo-efectivo-analitico", startDate, endDate, filtroMetodoPago],
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
          // Filtrar según método de pago
          if (filtroMetodoPago === "consolidado" || 
              (filtroMetodoPago === "efectivo" && ing.metodo_pago === "efectivo") ||
              (filtroMetodoPago === "bancos" && ing.metodo_pago === "bancos")) {
            trans.push({
              fecha: format(new Date(ing.created_at), "dd/MM/yyyy"),
              referencia: `ING-${ing.id.slice(0, 8)}`,
              tipo: "Cobro",
              descripcion: ing.descripcion,
              monto: ing.monto_pagado,
              categoria: "Operativo",
              metodoPago: ing.metodo_pago
            });
          }
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
          // Filtrar según método de pago
          if (filtroMetodoPago === "consolidado" || 
              (filtroMetodoPago === "efectivo" && egr.metodo_pago === "efectivo") ||
              (filtroMetodoPago === "bancos" && egr.metodo_pago === "bancos")) {
            trans.push({
              fecha: format(new Date(egr.created_at), "dd/MM/yyyy"),
              referencia: `EGR-${egr.id.slice(0, 8)}`,
              tipo: "Pago",
              descripcion: egr.descripcion,
              monto: -egr.monto_pagado,
              categoria: "Operativo",
              metodoPago: egr.metodo_pago
            });
          }
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
          // Filtrar según método de pago
          if (filtroMetodoPago === "consolidado" || 
              (filtroMetodoPago === "efectivo" && inv.metodo_pago === "efectivo") ||
              (filtroMetodoPago === "bancos" && inv.metodo_pago === "bancos")) {
            trans.push({
              fecha: format(new Date(inv.created_at), "dd/MM/yyyy"),
              referencia: `INV-${inv.id.slice(0, 8)}`,
              tipo: "Inversión",
              descripcion: inv.producto_nombre,
              monto: -inv.monto_pagado,
              categoria: "Inversión",
              metodoPago: inv.metodo_pago
            });
          }
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
          // Para financiamientos, siempre asumimos bancos
          if (filtroMetodoPago === "consolidado" || filtroMetodoPago === "bancos") {
            trans.push({
              fecha: format(new Date(fin.created_at), "dd/MM/yyyy"),
              referencia: `FIN-${fin.id.slice(0, 8)}`,
              tipo: "Disposición",
              descripcion: fin.nombre,
              monto: fin.saldo_inicial,
              categoria: "Financiamiento",
              metodoPago: "bancos"
            });
          }
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
          // Filtrar según método de pago
          if (filtroMetodoPago === "consolidado" || 
              (filtroMetodoPago === "efectivo" && pago.metodo_pago === "efectivo") ||
              (filtroMetodoPago === "bancos" && pago.metodo_pago === "bancos")) {
            trans.push({
              fecha: format(new Date(pago.created_at), "dd/MM/yyyy"),
              referencia: `PAG-${pago.id.slice(0, 8)}`,
              tipo: pago.tipo_transaccion === 'amortizacion' ? 'Amortización' : 'Interés',
              descripcion: (pago.financiamientos as any)?.nombre || pago.descripcion || "",
              monto: -monto,
              categoria: "Financiamiento",
              metodoPago: pago.metodo_pago
            });
          }
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

  // Calcular componentes para el Sankey
  const cobros = porCategoria.operativo.filter(t => t.monto > 0).reduce((sum, t) => sum + t.monto, 0);
  const pagos = Math.abs(porCategoria.operativo.filter(t => t.monto < 0).reduce((sum, t) => sum + t.monto, 0));
  const inversiones = Math.abs(totales.inversion);
  const nuevosCreditos = porCategoria.financiamiento.filter(t => t.monto > 0).reduce((sum, t) => sum + t.monto, 0);
  const pagosCreditos = Math.abs(porCategoria.financiamiento.filter(t => t.monto < 0).reduce((sum, t) => sum + t.monto, 0));

  const totalIngresos = cobros + nuevosCreditos;
  const totalEgresos = pagos + inversiones + pagosCreditos;

  const totalGeneral = totales.operativo + totales.inversion + totales.financiamiento;
  const saldoFinal = (saldoInicial || 0) + totalGeneral;

  // Datos para waterfall con colores del sistema de diseño
  const waterfallData: WaterfallData[] = [];

  // Saldo Inicial
  waterfallData.push({
    name: "Saldo Inicial",
    value: 0,
    start: saldoInicial || 0,
    fill: "hsl(var(--chart-balance))",
    isTotal: true
  });

  // Actividades Operativas
  const despuesOperativo = (saldoInicial || 0) + totales.operativo;
  waterfallData.push({
    name: "Activ. Operativas",
    value: saldoInicial || 0,
    start: totales.operativo,
    fill: totales.operativo >= 0 ? "hsl(var(--chart-income))" : "hsl(var(--chart-expense))",
    isTotal: false
  });

  waterfallData.push({
    name: "Subtotal Operativo",
    value: 0,
    start: despuesOperativo,
    fill: "hsl(var(--chart-balance))",
    isTotal: true
  });

  // Actividades de Inversión
  const despuesInversion = despuesOperativo + totales.inversion;
  waterfallData.push({
    name: "Activ. Inversión",
    value: despuesOperativo,
    start: totales.inversion,
    fill: totales.inversion >= 0 ? "hsl(var(--chart-income))" : "hsl(var(--chart-expense))",
    isTotal: false
  });

  waterfallData.push({
    name: "Subtotal Inversión",
    value: 0,
    start: despuesInversion,
    fill: "hsl(var(--chart-balance))",
    isTotal: true
  });

  // Actividades de Financiamiento
  const despuesFinanciamiento = despuesInversion + totales.financiamiento;
  waterfallData.push({
    name: "Activ. Financ.",
    value: despuesInversion,
    start: totales.financiamiento,
    fill: totales.financiamiento >= 0 ? "hsl(var(--chart-income))" : "hsl(var(--chart-expense))",
    isTotal: false
  });

  // Saldo Final
  waterfallData.push({
    name: "SALDO FINAL",
    value: 0,
    start: saldoFinal,
    fill: "hsl(var(--chart-balance))",
    isTotal: true
  });

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

      {/* 2. Gráfico Sankey - Composición de Flujos */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-2xl">2. Composición de Ingresos y Egresos de Efectivo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Desglose porcentual por naturaleza de cada flujo
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-8 items-stretch">
            {/* Ingresos de Efectivo */}
            <div 
              className="flex-1 transition-all duration-500 hover:scale-105"
              style={{ 
                minHeight: `${Math.max(200, (totalIngresos / Math.max(totalIngresos, totalEgresos)) * 500)}px`,
                maxHeight: '600px'
              }}
            >
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-6 rounded-lg border-2 border-green-200 dark:border-green-800 h-full flex flex-col animate-fade-in">
                <h3 className="text-xl font-bold mb-4 text-green-800 dark:text-green-200">Ingresos de Efectivo</h3>
                <div className="flex-1 flex flex-col justify-center space-y-3">
                  <div 
                    className="flex flex-col p-4 bg-white dark:bg-green-950 rounded-md transition-all duration-300 hover:shadow-lg"
                    style={{
                      height: totalIngresos > 0 ? `${(cobros / totalIngresos) * 100}%` : '50%',
                      minHeight: '60px'
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">Cobros a Clientes</span>
                      <div className="text-right">
                        <p className="font-bold text-2xl text-green-600">{totalIngresos > 0 ? ((cobros / totalIngresos) * 100).toFixed(1) : 0}%</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-auto">${cobros.toLocaleString('es-MX', { minimumFractionDigits: 0 })}</p>
                  </div>
                  
                  <div 
                    className="flex flex-col p-4 bg-white dark:bg-green-950 rounded-md transition-all duration-300 hover:shadow-lg"
                    style={{
                      height: totalIngresos > 0 ? `${(nuevosCreditos / totalIngresos) * 100}%` : '50%',
                      minHeight: '60px'
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">Nuevos Créditos</span>
                      <div className="text-right">
                        <p className="font-bold text-2xl text-green-600">{totalIngresos > 0 ? ((nuevosCreditos / totalIngresos) * 100).toFixed(1) : 0}%</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-auto">${nuevosCreditos.toLocaleString('es-MX', { minimumFractionDigits: 0 })}</p>
                  </div>
                </div>
                <div className="flex justify-between border-t-2 border-green-300 pt-3 mt-4">
                  <span className="font-bold text-lg">Total Ingresos</span>
                  <span className="font-bold text-xl text-green-700 dark:text-green-300">${totalIngresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            
            {/* Egresos de Efectivo */}
            <div 
              className="flex-1 transition-all duration-500 hover:scale-105"
              style={{ 
                minHeight: `${Math.max(200, (totalEgresos / Math.max(totalIngresos, totalEgresos)) * 500)}px`,
                maxHeight: '600px'
              }}
            >
              <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 p-6 rounded-lg border-2 border-red-200 dark:border-red-800 h-full flex flex-col animate-fade-in">
                <h3 className="text-xl font-bold mb-4 text-red-800 dark:text-red-200">Egresos de Efectivo</h3>
                <div className="flex-1 flex flex-col justify-center space-y-3">
                  <div 
                    className="flex flex-col p-4 bg-white dark:bg-red-950 rounded-md transition-all duration-300 hover:shadow-lg"
                    style={{
                      height: totalEgresos > 0 ? `${(pagos / totalEgresos) * 100}%` : '33.33%',
                      minHeight: '60px'
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">Pagos a Proveedores</span>
                      <div className="text-right">
                        <p className="font-bold text-2xl text-red-600">{totalEgresos > 0 ? ((pagos / totalEgresos) * 100).toFixed(1) : 0}%</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-auto">${pagos.toLocaleString('es-MX', { minimumFractionDigits: 0 })}</p>
                  </div>
                  
                  <div 
                    className="flex flex-col p-4 bg-white dark:bg-red-950 rounded-md transition-all duration-300 hover:shadow-lg"
                    style={{
                      height: totalEgresos > 0 ? `${(inversiones / totalEgresos) * 100}%` : '33.33%',
                      minHeight: '60px'
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">Inversiones (CAPEX)</span>
                      <div className="text-right">
                        <p className="font-bold text-2xl text-red-600">{totalEgresos > 0 ? ((inversiones / totalEgresos) * 100).toFixed(1) : 0}%</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-auto">${inversiones.toLocaleString('es-MX', { minimumFractionDigits: 0 })}</p>
                  </div>
                  
                  <div 
                    className="flex flex-col p-4 bg-white dark:bg-red-950 rounded-md transition-all duration-300 hover:shadow-lg"
                    style={{
                      height: totalEgresos > 0 ? `${(pagosCreditos / totalEgresos) * 100}%` : '33.33%',
                      minHeight: '60px'
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">Pago de Créditos</span>
                      <div className="text-right">
                        <p className="font-bold text-2xl text-red-600">{totalEgresos > 0 ? ((pagosCreditos / totalEgresos) * 100).toFixed(1) : 0}%</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-auto">${pagosCreditos.toLocaleString('es-MX', { minimumFractionDigits: 0 })}</p>
                  </div>
                </div>
                <div className="flex justify-between border-t-2 border-red-300 pt-3 mt-4">
                  <span className="font-bold text-lg">Total Egresos</span>
                  <span className="font-bold text-xl text-red-700 dark:text-red-300">${totalEgresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default FlujoEfectivoAnalitico;
