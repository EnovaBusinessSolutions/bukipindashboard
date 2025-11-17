import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2 } from "lucide-react";
import { PeriodType } from "@/pages/EstadoResultados";
import { Switch } from "@/components/ui/switch";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts";

interface EstadoResultadosAnaliticoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
}

interface SaldoCuenta {
  cuenta_codigo: string;
  debe_total: number;
  haber_total: number;
  saldo: number;
}

interface WaterfallData {
  name: string;
  value: number;
  start: number;
  fill: string;
  isTotal: boolean;
}

const EstadoResultadosAnalitico = ({ startDate, endDate, periodType }: EstadoResultadosAnaliticoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();

  // Usar la misma lógica que la balanza
  const { data: asientosData, isLoading: asientosLoading } = useAsientosBalanza(startDate, endDate);

  // Estados para filtros
  const [mostrarSubtotales, setMostrarSubtotales] = useState(true);
  const [agrupadorSeleccionado, setAgrupadorSeleccionado] = useState("");

  // Función para formatear el período
  const formatearPeriodo = (startDate: Date, endDate: Date): string => {
    const formatoFecha = (fecha: Date) => {
      return fecha.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    };
    
    const fechaInicio = formatoFecha(startDate);
    const fechaFin = formatoFecha(endDate);
    
    // Si es el mismo día, mostrar solo una fecha
    if (startDate.toDateString() === endDate.toDateString()) {
      return `Estado de Resultados del ${fechaInicio}`;
    }
    
    return `Estado de Resultados del ${fechaInicio} al ${fechaFin}`;
  };

  if (cuentasLoading || asientosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const cuentasFlat = cuentasData?.cuentasFlat || [];
  const saldosPorCuenta = asientosData?.saldosPorCuenta || {};

  // Verificar si hay datos
  const hayDatos = asientosData?.movimientos && asientosData.movimientos.length > 0;

  if (!hayDatos) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center space-y-2">
            <p className="text-xl font-medium text-muted-foreground">
              No hay datos financieros registrados
            </p>
            <p className="text-sm text-muted-foreground">
              Comienza registrando transacciones para ver el estado de resultados
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Función para obtener el saldo de una cuenta desde los asientos de balanza
  const obtenerSaldo = (codigoCuenta: string): number => {
    return saldosPorCuenta[codigoCuenta]?.saldo || 0;
  };

  // Calcular métricas
  const cuentasVentas = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Ingresos por Ventas" && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasOtrosIngresos = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Otros Ingresos" && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasCostos = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return codigo >= 5001 && codigo <= 5099 && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasGastosOperativos = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Gastos de Operación" && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasOtrosGastos = cuentasFlat.filter(cuenta => 
    cuenta.subgrupo === "Otros Gastos" && cuenta.estado_financiero === "Estado de Resultados"
  );
  
  const cuentasDepreciaciones = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return (codigo === 5109 || codigo === 5110) && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasCostoFinanciero = cuentasFlat.filter(cuenta => {
    const codigo = parseInt(cuenta.codigo);
    return ((codigo >= 5111 && codigo <= 5199) || codigo === 5201) && cuenta.estado_financiero === "Estado de Resultados";
  });
  
  const cuentasImpuestos = cuentasFlat.filter(cuenta => {
    return cuenta.codigo.startsWith("6") && cuenta.estado_financiero === "Estado de Resultados";
  });

  const totalVentas = cuentasVentas.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalOtrosIngresos = cuentasOtrosIngresos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalIngresos = totalVentas + totalOtrosIngresos;
  const costoVentas = cuentasCostos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const gastosOperativos = cuentasGastosOperativos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const otrosGastos = cuentasOtrosGastos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const depreciaciones = cuentasDepreciaciones.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const costoFinanciero = cuentasCostoFinanciero.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const impuestos = cuentasImpuestos.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);

  const utilidadBruta = totalIngresos - costoVentas;
  const ebitda = utilidadBruta - gastosOperativos - otrosGastos;
  const ebit = ebitda - depreciaciones;
  const utilidadAntesImpuestos = ebit - costoFinanciero;
  const utilidadNeta = utilidadAntesImpuestos - impuestos;

  // Definir agrupadores con sus cuentas para desglose
  const agrupadores = [
    {
      id: "ventas",
      nombre: "Ventas",
      total: totalVentas,
      cuentas: cuentasVentas.map(c => ({
        codigo: c.codigo,
        nombre: c.nombre,
        saldo: obtenerSaldo(c.codigo)
      })).filter(c => c.saldo !== 0)
    },
    {
      id: "otros_ingresos",
      nombre: "Otros Ingresos",
      total: totalOtrosIngresos,
      cuentas: cuentasOtrosIngresos.map(c => ({
        codigo: c.codigo,
        nombre: c.nombre,
        saldo: obtenerSaldo(c.codigo)
      })).filter(c => c.saldo !== 0)
    },
    {
      id: "costo_ventas",
      nombre: "Costo de Ventas",
      total: costoVentas,
      cuentas: cuentasCostos.map(c => ({
        codigo: c.codigo,
        nombre: c.nombre,
        saldo: obtenerSaldo(c.codigo)
      })).filter(c => c.saldo !== 0)
    },
    {
      id: "gastos_operativos",
      nombre: "Gastos Operativos",
      total: gastosOperativos,
      cuentas: cuentasGastosOperativos.map(c => ({
        codigo: c.codigo,
        nombre: c.nombre,
        saldo: obtenerSaldo(c.codigo)
      })).filter(c => c.saldo !== 0)
    },
    {
      id: "otros_gastos",
      nombre: "Otros Gastos",
      total: otrosGastos,
      cuentas: cuentasOtrosGastos.map(c => ({
        codigo: c.codigo,
        nombre: c.nombre,
        saldo: obtenerSaldo(c.codigo)
      })).filter(c => c.saldo !== 0)
    },
    {
      id: "depreciaciones",
      nombre: "Depreciaciones",
      total: depreciaciones,
      cuentas: cuentasDepreciaciones.map(c => ({
        codigo: c.codigo,
        nombre: c.nombre,
        saldo: obtenerSaldo(c.codigo)
      })).filter(c => c.saldo !== 0)
    },
    {
      id: "costo_financiero",
      nombre: "Costo Financiero",
      total: costoFinanciero,
      cuentas: cuentasCostoFinanciero.map(c => ({
        codigo: c.codigo,
        nombre: c.nombre,
        saldo: obtenerSaldo(c.codigo)
      })).filter(c => c.saldo !== 0)
    },
    {
      id: "impuestos",
      nombre: "Impuestos",
      total: impuestos,
      cuentas: cuentasImpuestos.map(c => ({
        codigo: c.codigo,
        nombre: c.nombre,
        saldo: obtenerSaldo(c.codigo)
      })).filter(c => c.saldo !== 0)
    }
  ].filter(ag => ag.total !== 0);

  // Inicializar agrupador seleccionado si está vacío
  if (!agrupadorSeleccionado && agrupadores.length > 0) {
    setAgrupadorSeleccionado(agrupadores[0].id);
  }

  // Construir datos para waterfall - el "start" es la barra invisible que posiciona cada elemento
  const waterfallData: WaterfallData[] = [];

  if (mostrarSubtotales) {
    // VERSIÓN COMPLETA - CON SUBTOTALES
    
    // Ventas (inicio - verde brillante)
    waterfallData.push({
      name: "Ventas",
      value: 0, // Transparente (posiciona)
      start: totalVentas, // Con color (visible)
      fill: "#10b981", // green-500
      isTotal: false
    });

    // Otros Ingresos (verde más claro)
    waterfallData.push({
      name: "(+) Otros Ingr.",
      value: totalVentas, // Transparente (posiciona desde ventas)
      start: totalOtrosIngresos, // Con color (visible)
      fill: "#34d399", // green-400
      isTotal: false
    });

    // Total Ingresos (subtotal - azul)
    waterfallData.push({
      name: "= Total Ingresos",
      value: 0, // Transparente (posiciona)
      start: totalIngresos, // Con color (visible)
      fill: "#3b82f6", // blue-500
      isTotal: true
    });

    // Costo de Ventas (negativo - rojo)
    const despuesCostos = totalIngresos - costoVentas;
    waterfallData.push({
      name: "(-) Costo Ventas",
      value: despuesCostos, // Transparente (posiciona)
      start: costoVentas, // Con color (visible)
      fill: "#ef4444", // red-500
      isTotal: false
    });

    // Utilidad Bruta (subtotal - azul)
    waterfallData.push({
      name: "= Utilidad Bruta",
      value: 0, // Transparente (posiciona)
      start: utilidadBruta, // Con color (visible)
      fill: "#3b82f6", // blue-500
      isTotal: true
    });

    // Gastos Operativos (negativo - rojo)
    const despuesGastos = despuesCostos - gastosOperativos;
    waterfallData.push({
      name: "(-) Gastos Op.",
      value: despuesGastos, // Transparente (posiciona)
      start: gastosOperativos, // Con color (visible)
      fill: "#ef4444",
      isTotal: false
    });

    // Otros Gastos (negativo - rojo)
    const despuesOtrosGastos = despuesGastos - otrosGastos;
    waterfallData.push({
      name: "(-) Otros Gastos",
      value: despuesOtrosGastos, // Transparente (posiciona)
      start: otrosGastos, // Con color (visible)
      fill: "#ef4444",
      isTotal: false
    });

    // EBITDA (subtotal - azul)
    waterfallData.push({
      name: "= EBITDA",
      value: 0, // Transparente (posiciona)
      start: ebitda, // Con color (visible)
      fill: "#3b82f6", // blue-500
      isTotal: true
    });

    // Depreciaciones (negativo - rojo)
    const despuesDepreciaciones = despuesOtrosGastos - depreciaciones;
    waterfallData.push({
      name: "(-) Deprec.",
      value: despuesDepreciaciones, // Transparente (posiciona)
      start: depreciaciones, // Con color (visible)
      fill: "#ef4444",
      isTotal: false
    });

    // EBIT (subtotal - azul)
    waterfallData.push({
      name: "= EBIT",
      value: 0, // Transparente (posiciona)
      start: ebit, // Con color (visible)
      fill: "#3b82f6", // blue-500
      isTotal: true
    });

    // Costo Financiero (negativo - rojo)
    const despuesCostoFin = despuesDepreciaciones - costoFinanciero;
    waterfallData.push({
      name: "(-) Costo Fin.",
      value: despuesCostoFin, // Transparente (posiciona)
      start: costoFinanciero, // Con color (visible)
      fill: "#ef4444",
      isTotal: false
    });

    // Utilidad Antes de Impuestos (subtotal - azul)
    waterfallData.push({
      name: "= Util. A. Imp.",
      value: 0, // Transparente (posiciona)
      start: utilidadAntesImpuestos, // Con color (visible)
      fill: "#3b82f6", // blue-500
      isTotal: true
    });

    // Impuestos (negativo - rojo)
    const despuesImpuestos = despuesCostoFin - impuestos;
    waterfallData.push({
      name: "(-) Impuestos",
      value: despuesImpuestos, // Transparente (posiciona)
      start: impuestos, // Con color (visible)
      fill: "#ef4444",
      isTotal: false
    });

    // Utilidad Neta (final - verde o rojo según resultado)
    waterfallData.push({
      name: "= UTILIDAD NETA",
      value: 0, // Transparente (posiciona)
      start: utilidadNeta, // Con color (visible)
      fill: utilidadNeta >= 0 ? "#059669" : "#dc2626", // green-600 or red-600
      isTotal: true
    });
  } else {
    // VERSIÓN SIMPLIFICADA - SIN SUBTOTALES
    
    // Ventas
    waterfallData.push({
      name: "Ventas",
      value: 0,
      start: totalVentas,
      fill: "#10b981",
      isTotal: false
    });
    
    // Otros Ingresos
    waterfallData.push({
      name: "(+) Otros Ingr.",
      value: totalVentas,
      start: totalOtrosIngresos,
      fill: "#34d399",
      isTotal: false
    });
    
    // Costo de Ventas
    const despuesCostos = totalIngresos - costoVentas;
    waterfallData.push({
      name: "(-) Costo Ventas",
      value: despuesCostos,
      start: costoVentas,
      fill: "#ef4444",
      isTotal: false
    });
    
    // Gastos Operativos
    const despuesGastosOp = despuesCostos - gastosOperativos;
    waterfallData.push({
      name: "(-) Gastos Op.",
      value: despuesGastosOp,
      start: gastosOperativos,
      fill: "#ef4444",
      isTotal: false
    });
    
    // Otros Gastos
    const despuesOtrosGastos = despuesGastosOp - otrosGastos;
    waterfallData.push({
      name: "(-) Otros Gastos",
      value: despuesOtrosGastos,
      start: otrosGastos,
      fill: "#ef4444",
      isTotal: false
    });
    
    // Depreciaciones
    const despuesDepreciaciones = despuesOtrosGastos - depreciaciones;
    waterfallData.push({
      name: "(-) Deprec.",
      value: despuesDepreciaciones,
      start: depreciaciones,
      fill: "#ef4444",
      isTotal: false
    });
    
    // Costo Financiero
    const despuesCostoFin = despuesDepreciaciones - costoFinanciero;
    waterfallData.push({
      name: "(-) Costo Fin.",
      value: despuesCostoFin,
      start: costoFinanciero,
      fill: "#ef4444",
      isTotal: false
    });
    
    // Impuestos
    const despuesImpuestos = despuesCostoFin - impuestos;
    waterfallData.push({
      name: "(-) Impuestos",
      value: despuesImpuestos,
      start: impuestos,
      fill: "#ef4444",
      isTotal: false
    });
    
    // UTILIDAD NETA (único subtotal)
    waterfallData.push({
      name: "= UTILIDAD NETA",
      value: 0,
      start: utilidadNeta,
      fill: utilidadNeta >= 0 ? "#059669" : "#dc2626",
      isTotal: true
    });
  }

  // Calcular márgenes
  const margenBruto = totalIngresos > 0 ? (utilidadBruta / totalIngresos) * 100 : 0;
  const margenEBITDA = totalIngresos > 0 ? (ebitda / totalIngresos) * 100 : 0;
  const margenEBIT = totalIngresos > 0 ? (ebit / totalIngresos) * 100 : 0;
  const margenAntesImpuestos = totalIngresos > 0 ? (utilidadAntesImpuestos / totalIngresos) * 100 : 0;
  const margenNeto = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0;

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const CustomTooltipWaterfall = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      // Para egresos, mostrar el valor como negativo en el tooltip
      const displayValue = data.isTotal ? data.start : (data.name.includes("(-)") ? -data.start : data.start);
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
      {/* Encabezado con período */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-2xl text-center">
            Estado de Resultados - Formato Analítico
          </CardTitle>
          <p className="text-sm text-muted-foreground text-center font-medium mt-2">
            {formatearPeriodo(startDate, endDate)}
          </p>
        </CardHeader>
      </Card>

      {/* 1. Gráfico de Cascada */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">1. Gráfico de Cascada (Waterfall Chart)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Visualización del flujo de ingresos a utilidad neta
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mostrar subtotales</span>
              <Switch
                checked={mostrarSubtotales}
                onCheckedChange={setMostrarSubtotales}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Calcular si hay valores negativos para ajustar el margen inferior */}
          {(() => {
            const hayValoresNegativos = waterfallData.some(d => {
              const valorFinal = d.value + d.start;
              return valorFinal < 0 || d.value < 0;
            });
            const bottomMargin = hayValoresNegativos ? 210 : 120;
            
            return (
              <ResponsiveContainer width="100%" height={850}>
                <BarChart
                  data={waterfallData}
                  margin={{ top: 20, right: 20, left: 75, bottom: bottomMargin }}
              barGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={120}
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
              
              <Bar dataKey="value" stackId="stack" isAnimationActive={false} legendType="none">
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
                  content: ({ x, y, width, value, index, height }: any) => {
                    const item = waterfallData[index];
                    if (!item) return null;
                    
                    // Determinar si es negativo
                    // Para subtotales, verificar el signo del valor
                    // Para egresos, verificar si el nombre contiene "(-)"
                    const isNegative = item.isTotal 
                      ? item.start < 0          // Subtotales: por signo del valor
                      : item.name.includes("(-)"); // Egresos: por nombre
                    
                    // Para subtotales, usar directamente el valor (ya tiene su signo)
                    // Para egresos, invertir el signo (start es positivo, queremos mostrar negativo)
                    const displayValue = item.isTotal 
                      ? item.start                              // Subtotales: valor directo
                      : (item.name.includes("(-)") ? -item.start : item.start); // Egresos: invertir signo
                    
                    // Posicionar dinámicamente según el signo
                    const yPosition = isNegative 
                      ? (item.isTotal 
                          ? Number(y) + 15                      // Subtotales negativos: y ya está en la parte baja
                          : Number(y) + Number(height) + 15)    // Egresos: necesitan y + height
                      : Number(y) - 5;                          // Positivos: arriba
                    
                    const baseline = isNegative ? 'top' : 'bottom';
                    
                    return (
                      <text
                        x={Number(x) + Number(width) / 2}
                        y={yPosition}
                        fill="hsl(var(--foreground))"
                        textAnchor="middle"
                        dominantBaseline={baseline}
                        fontSize={10}
                        fontWeight="bold"
                      >
                        {formatCurrency(displayValue)}
                      </text>
                    );
                  }
                }}
              >
                {waterfallData.map((entry, index) => (
                  <Cell 
                    key={`cell-start-${index}`} 
                    fill={entry.fill}
                    stroke="transparent"
                    strokeWidth={0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
            );
          })()}
          
          {/* Leyenda de colores */}
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-muted-foreground">Ingresos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span className="text-muted-foreground">Egresos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-blue-500 bg-blue-500"></div>
              <span className="text-muted-foreground">Subtotales</span>
            </div>
          </div>
          
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold text-center">Métricas Clave y Márgenes</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            {/* Ventas */}
            <div className="space-y-1 p-3 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground text-xs">Ventas</p>
              <p className="font-semibold text-lg">{formatCurrency(totalVentas)}</p>
            </div>
              
            {/* Otros Ingresos */}
            <div className="space-y-1 p-3 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground text-xs">Otros Ingresos</p>
              <p className="font-semibold text-lg">{formatCurrency(totalOtrosIngresos)}</p>
            </div>
              
            {/* Total Ingresos */}
            <div className="space-y-1 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-muted-foreground text-xs font-semibold">Total Ingresos</p>
              <p className="font-semibold text-lg text-blue-600">{formatCurrency(totalIngresos)}</p>
            </div>
              
              {/* Utilidad Bruta */}
              <div className="space-y-1 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-muted-foreground text-xs">Utilidad Bruta</p>
                <p className="font-semibold text-lg text-green-600">{formatCurrency(utilidadBruta)}</p>
                <p className="text-xs text-green-600 font-medium">
                  Margen: {margenBruto.toFixed(1)}%
                </p>
              </div>
              
              {/* EBITDA */}
              <div className="space-y-1 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-muted-foreground text-xs">EBITDA</p>
                <p className="font-semibold text-lg text-green-600">{formatCurrency(ebitda)}</p>
                <p className="text-xs text-green-600 font-medium">
                  Margen: {margenEBITDA.toFixed(1)}%
                </p>
              </div>
              
              {/* EBIT */}
              <div className="space-y-1 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-muted-foreground text-xs">EBIT</p>
                <p className="font-semibold text-lg text-green-600">{formatCurrency(ebit)}</p>
                <p className="text-xs text-green-600 font-medium">
                  Margen: {margenEBIT.toFixed(1)}%
                </p>
              </div>
              
              {/* Utilidad A. Impuestos */}
              <div className="space-y-1 p-3 bg-muted/30 rounded-lg">
                <p className="text-muted-foreground text-xs">Util. A. Impuestos</p>
                <p className={`font-semibold text-lg ${utilidadAntesImpuestos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(utilidadAntesImpuestos)}
                </p>
                <p className={`text-xs font-medium ${utilidadAntesImpuestos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Margen: {margenAntesImpuestos.toFixed(1)}%
                </p>
              </div>
              
              {/* Utilidad Neta */}
              <div className={`space-y-1 p-3 border-2 rounded-lg ${
                utilidadNeta >= 0 
                  ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700' 
                  : 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700'
              }`}>
                <p className="text-muted-foreground text-xs font-semibold">UTILIDAD NETA</p>
                <p className={`font-bold text-xl ${utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(utilidadNeta)}
                </p>
                <p className={`text-xs font-bold ${utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Margen: {margenNeto.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Gráfico de Desglose por Agrupador */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-2xl">2. Desglose de Cuentas por Agrupador</CardTitle>
              <p className="text-sm text-muted-foreground">
                Análisis detallado de las cuentas que componen cada agrupador
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Seleccionar agrupador:</span>
              <Select 
                value={agrupadorSeleccionado} 
                onValueChange={setAgrupadorSeleccionado}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Selecciona un agrupador" />
                </SelectTrigger>
                <SelectContent>
                  {agrupadores.map(ag => (
                    <SelectItem key={ag.id} value={ag.id}>
                      {ag.nombre} - {formatCurrency(ag.total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {(() => {
            const agrupador = agrupadores.find(ag => ag.id === agrupadorSeleccionado);
            
            if (!agrupador || agrupador.cuentas.length === 0) {
              return (
                <div className="text-center py-12 text-muted-foreground">
                  No hay cuentas con movimientos en este agrupador
                </div>
              );
            }
            
            // Datos para gráfica de barras horizontales
            const datosDesglose = agrupador.cuentas
              .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)) // Ordenar por magnitud
              .map(cuenta => ({
                nombre: `${cuenta.codigo} - ${cuenta.nombre}`,
                valor: cuenta.saldo
              }));
            
            return (
              <>
                <ResponsiveContainer width="100%" height={Math.max(300, datosDesglose.length * 50)}>
                  <BarChart 
                    data={datosDesglose} 
                    layout="vertical"
                    margin={{ top: 20, right: 30, left: 200, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      type="number"
                      tickFormatter={(value) => formatCurrency(value)}
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="nombre"
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: 10 }}
                      width={190}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <ReferenceLine x={0} stroke="#374151" strokeWidth={2} />
                    <Bar 
                      dataKey="valor" 
                      radius={[0, 4, 4, 0]}
                      label={{
                        position: 'right',
                        formatter: (value: number) => formatCurrency(value),
                        fill: 'hsl(var(--foreground))',
                        fontSize: 10,
                        fontWeight: 'bold'
                      }}
                    >
                      {datosDesglose.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`}
                          fill={entry.valor >= 0 ? "#10b981" : "#ef4444"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                
                {/* Resumen del agrupador */}
                <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Agrupador</p>
                      <p className="text-lg font-bold">{formatCurrency(agrupador.total)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Número de Cuentas</p>
                      <p className="text-lg font-bold">{agrupador.cuentas.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cuenta Mayor</p>
                      <p className="text-lg font-bold">
                        {formatCurrency(Math.max(...agrupador.cuentas.map(c => Math.abs(c.saldo))))}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

export default EstadoResultadosAnalitico;
