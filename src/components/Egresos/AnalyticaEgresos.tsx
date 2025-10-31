import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line 
} from "recharts";
import { TrendingDown, Calendar, DollarSign, Package, AlertCircle } from "lucide-react";
import { useTransaccionesEgresos } from "@/hooks/useTransaccionesEgresos";
import { useCostosVentaInventario } from "@/hooks/useCostosVentaInventario";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const AnalyticaEgresos = () => {
  const { transacciones, loading } = useTransaccionesEgresos(1000);
  const { data: costosVentaInventario, isLoading: loadingCostosVenta } = useCostosVentaInventario();
  const [periodFilter, setPeriodFilter] = useState<"diario" | "mensual" | "anual">("mensual");
  const [formatoMontos, setFormatoMontos] = useState<"normal" | "miles" | "millones">("normal");
  const [tipoEgreso, setTipoEgreso] = useState<"total" | "costo" | "gasto" | "costo_inventario" | "combinada">("total");

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

  // Calcular resúmenes por período
  const calcularResumenes = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const todayStr = today.toISOString().split('T')[0];

    // Costos de inventario
    const costosInventarioDia = costosVentaInventario
      ?.filter(c => new Date(c.fecha).toISOString().split('T')[0] === todayStr)
      .reduce((sum, c) => sum + c.monto, 0) || 0;

    const costosInventarioMes = costosVentaInventario
      ?.filter(c => {
        const cDate = new Date(c.fecha);
        return cDate.getMonth() === currentMonth && cDate.getFullYear() === currentYear;
      })
      .reduce((sum, c) => sum + c.monto, 0) || 0;

    const costosInventarioAnio = costosVentaInventario
      ?.filter(c => new Date(c.fecha).getFullYear() === currentYear)
      .reduce((sum, c) => sum + c.monto, 0) || 0;

    // Día
    const egresosDelDia = transaccionesFiltradas
      .filter(t => new Date(t.created_at).toISOString().split('T')[0] === todayStr)
      .reduce((sum, t) => sum + t.monto_total, 0);

    const pendientesDelDia = transaccionesFiltradas
      .filter(t => new Date(t.created_at).toISOString().split('T')[0] === todayStr)
      .reduce((sum, t) => sum + t.monto_pendiente, 0);

    // Mes
    const egresosDelMes = transaccionesFiltradas
      .filter(t => {
        const tDate = new Date(t.created_at);
        return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + t.monto_total, 0);

    const pendientesDelMes = transaccionesFiltradas
      .filter(t => {
        const tDate = new Date(t.created_at);
        return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + t.monto_pendiente, 0);

    // Año
    const egresosDelAnio = transaccionesFiltradas
      .filter(t => new Date(t.created_at).getFullYear() === currentYear)
      .reduce((sum, t) => sum + t.monto_total, 0);

    const pendientesDelAnio = transaccionesFiltradas
      .filter(t => new Date(t.created_at).getFullYear() === currentYear)
      .reduce((sum, t) => sum + t.monto_pendiente, 0);

    return {
      egresosDelDia: egresosDelDia + costosInventarioDia,
      pendientesDelDia,
      pagadosDelDia: egresosDelDia - pendientesDelDia,
      costosInventarioDia,
      egresosDelMes: egresosDelMes + costosInventarioMes,
      pendientesDelMes,
      pagadosDelMes: egresosDelMes - pendientesDelMes,
      costosInventarioMes,
      egresosDelAnio: egresosDelAnio + costosInventarioAnio,
      pendientesDelAnio,
      pagadosDelAnio: egresosDelAnio - pendientesDelAnio,
      costosInventarioAnio
    };
  };

  const resumenes = calcularResumenes();

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

  // Generar datos para gráfica de evolución según período
  const generarDatosEvolucion = () => {
    // Modo combinada: mostrar costos, gastos y costos de inventario por separado
    if (tipoEgreso === "combinada") {
      const costos = filteredTransactions.filter(t => t.tipo_egreso === 'costo');
      const gastos = filteredTransactions.filter(t => t.tipo_egreso === 'gasto');

      if (periodFilter === "diario") {
        const totalCostos = costos.reduce((sum, t) => sum + t.monto_total, 0);
        const totalGastos = gastos.reduce((sum, t) => sum + t.monto_total, 0);
        const totalCostosInventario = filteredCostosInventario.reduce((sum, c) => sum + c.monto, 0);
        
        return [{
          periodo: 'Hoy',
          costos: formatearMonto(totalCostos),
          gastos: formatearMonto(totalGastos),
          costosInventario: formatearMonto(totalCostosInventario)
        }];
      } else if (periodFilter === "mensual") {
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const costosByDay: Record<number, number> = {};
        const gastosByDay: Record<number, number> = {};
        const costosInventarioByDay: Record<number, number> = {};

        costos.forEach(t => {
          const day = new Date(t.created_at).getDate();
          if (!costosByDay[day]) costosByDay[day] = 0;
          costosByDay[day] += t.monto_total;
        });

        gastos.forEach(t => {
          const day = new Date(t.created_at).getDate();
          if (!gastosByDay[day]) gastosByDay[day] = 0;
          gastosByDay[day] += t.monto_total;
        });

        filteredCostosInventario.forEach(c => {
          const day = new Date(c.fecha).getDate();
          if (!costosInventarioByDay[day]) costosInventarioByDay[day] = 0;
          costosInventarioByDay[day] += c.monto;
        });

        return Array.from({ length: Math.min(30, daysInMonth) }, (_, i) => {
          const day = i + 1;
          return {
            periodo: `Día ${day}`,
            costos: formatearMonto(costosByDay[day] || 0),
            gastos: formatearMonto(gastosByDay[day] || 0),
            costosInventario: formatearMonto(costosInventarioByDay[day] || 0)
          };
        });
      } else {
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const costosByMonth: Record<number, number> = {};
        const gastosByMonth: Record<number, number> = {};
        const costosInventarioByMonth: Record<number, number> = {};

        costos.forEach(t => {
          const month = new Date(t.created_at).getMonth();
          if (!costosByMonth[month]) costosByMonth[month] = 0;
          costosByMonth[month] += t.monto_total;
        });

        gastos.forEach(t => {
          const month = new Date(t.created_at).getMonth();
          if (!gastosByMonth[month]) gastosByMonth[month] = 0;
          gastosByMonth[month] += t.monto_total;
        });

        filteredCostosInventario.forEach(c => {
          const month = new Date(c.fecha).getMonth();
          if (!costosInventarioByMonth[month]) costosInventarioByMonth[month] = 0;
          costosInventarioByMonth[month] += c.monto;
        });

        return meses.map((mes, index) => ({
          periodo: mes,
          costos: formatearMonto(costosByMonth[index] || 0),
          gastos: formatearMonto(gastosByMonth[index] || 0),
          costosInventario: formatearMonto(costosInventarioByMonth[index] || 0)
        }));
      }
    }

    // Modo normal: una sola línea
    let datosParaGrafica: any[] = [];
    
    if (tipoEgreso === "costo_inventario") {
      // Solo mostrar costos de inventario
      if (periodFilter === "diario") {
        const total = filteredCostosInventario.reduce((sum, c) => sum + c.monto, 0);
        return [{ periodo: 'Hoy', monto: formatearMonto(total) }];
      } else if (periodFilter === "mensual") {
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const dataByDay: Record<number, number> = {};
        
        filteredCostosInventario.forEach(c => {
          const day = new Date(c.fecha).getDate();
          if (!dataByDay[day]) dataByDay[day] = 0;
          dataByDay[day] += c.monto;
        });
        
        return Array.from({ length: Math.min(30, daysInMonth) }, (_, i) => ({
          periodo: `Día ${i + 1}`,
          monto: formatearMonto(dataByDay[i + 1] || 0)
        }));
      } else {
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const dataByMonth: Record<number, number> = {};
        
        filteredCostosInventario.forEach(c => {
          const month = new Date(c.fecha).getMonth();
          if (!dataByMonth[month]) dataByMonth[month] = 0;
          dataByMonth[month] += c.monto;
        });
        
        return meses.map((mes, index) => ({
          periodo: mes,
          monto: formatearMonto(dataByMonth[index] || 0)
        }));
      }
    }
    
    const transaccionesFiltradas = tipoEgreso === "total" 
      ? filteredTransactions 
      : filteredTransactions.filter(t => t.tipo_egreso === tipoEgreso);

    if (periodFilter === "diario") {
      const total = transaccionesFiltradas.reduce((sum, t) => sum + t.monto_total, 0);
      
      return [{
        periodo: 'Hoy',
        monto: formatearMonto(total)
      }];
    } else if (periodFilter === "mensual") {
      // Agrupar por día del mes
      const today = new Date();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const dataByDay: Record<number, number> = {};

      transaccionesFiltradas.forEach(t => {
        const day = new Date(t.created_at).getDate();
        if (!dataByDay[day]) {
          dataByDay[day] = 0;
        }
        dataByDay[day] += t.monto_total;
      });

      return Array.from({ length: Math.min(30, daysInMonth) }, (_, i) => {
        const day = i + 1;
        return {
          periodo: `Día ${day}`,
          monto: formatearMonto(dataByDay[day] || 0)
        };
      });
    } else {
      // Agrupar por mes
      const dataByMonth: Record<number, number> = {};
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

      transaccionesFiltradas.forEach(t => {
        const month = new Date(t.created_at).getMonth();
        if (!dataByMonth[month]) {
          dataByMonth[month] = 0;
        }
        dataByMonth[month] += t.monto_total;
      });

      return meses.map((mes, index) => ({
        periodo: mes,
        monto: formatearMonto(dataByMonth[index] || 0)
      }));
    }
  };

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

    return Object.entries(grouped)
      .map(([proveedor, monto]) => ({ proveedor, monto }))
      .sort((a, b) => b.monto - a.monto);
  };

  // Todos los gastos
  const topGastos = () => {
    return [...filteredTransactions]
      .sort((a, b) => b.monto_total - a.monto_total);
  };

  if (loading || loadingCostosVenta) {
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
            <CardTitle className="text-lg font-semibold text-primary">Resumen del Día</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Egresos Totales:</span>
              <span className="font-semibold text-destructive">
                ${resumenes.egresosDelDia.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-purple-600">Costo Venta Inventario:</span>
              <span className="font-medium text-purple-600">
                ${resumenes.costosInventarioDia.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-600">Pagado:</span>
              <span className="font-semibold text-green-600">
                ${resumenes.pagadosDelDia.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-px bg-border"></div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-yellow-600">Pendiente:</span>
              <span className="text-lg font-bold text-yellow-600">
                ${resumenes.pendientesDelDia.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Mes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-primary">Resumen del Mes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Egresos Totales:</span>
              <span className="font-semibold text-destructive">
                ${resumenes.egresosDelMes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-purple-600">Costo Venta Inventario:</span>
              <span className="font-medium text-purple-600">
                ${resumenes.costosInventarioMes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-600">Pagado:</span>
              <span className="font-semibold text-green-600">
                ${resumenes.pagadosDelMes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-px bg-border"></div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-yellow-600">Pendiente:</span>
              <span className="text-lg font-bold text-yellow-600">
                ${resumenes.pendientesDelMes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Año */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-primary">Resumen del Año</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Egresos Totales:</span>
              <span className="font-semibold text-destructive">
                ${resumenes.egresosDelAnio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-purple-600">Costo Venta Inventario:</span>
              <span className="font-medium text-purple-600">
                ${resumenes.costosInventarioAnio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-600">Pagado:</span>
              <span className="font-semibold text-green-600">
                ${resumenes.pagadosDelAnio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-px bg-border"></div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-yellow-600">Pendiente:</span>
              <span className="text-lg font-bold text-yellow-600">
                ${resumenes.pendientesDelAnio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
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
              <LineChart data={generarDatosEvolucion()}>
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
                      <TableCell className="max-w-xs truncate">{item.descripcion}</TableCell>
                      <TableCell>
                        <Badge variant={item.tipo_egreso === 'costo' ? 'destructive' : 'default'}>
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
