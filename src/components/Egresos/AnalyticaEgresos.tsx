import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Treemap
} from "recharts";
import { TrendingDown, Calendar, DollarSign, Package, AlertCircle } from "lucide-react";
import { useTransaccionesEgresos } from "@/hooks/useTransaccionesEgresos";
import { useCostosVentaInventario } from "@/hooks/useCostosVentaInventario";
import { useResumenEgresosPorPeriodo } from "@/hooks/useResumenEgresosPorPeriodo";
import { useEgresosPorPeriodo, DatosEvolucionSimple, DatosEvolucionCombinada } from "@/hooks/useEgresosPorPeriodo";
import { useSubcuentas } from "@/hooks/useSubcuentas";
import { useProductosEgresos } from "@/hooks/useProductosEgresos";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const AnalyticaEgresos = () => {
  const { transacciones, loading } = useTransaccionesEgresos(1000);
  const { data: costosVentaInventario, isLoading: loadingCostosVenta } = useCostosVentaInventario();
  const { data: resumenes, isLoading: loadingResumen } = useResumenEgresosPorPeriodo();
  const { data: subcuentas } = useSubcuentas();
  const { data: productosEgresos } = useProductosEgresos();
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

  // Egresos por Subcuenta
  const egresosPorSubcuenta = () => {
    const grouped: Record<string, number> = {};

    filteredTransactions.forEach(t => {
      // TransaccionEgreso no tiene subcuenta_id, usar descripción o agrupar todo
      const subcuentaNombre = 'Sin subcuenta asignada';
      
      if (!grouped[subcuentaNombre]) {
        grouped[subcuentaNombre] = 0;
      }
      grouped[subcuentaNombre] += t.monto_total;
    });

    // Agregar costos de inventario
    const totalCostosInventario = filteredCostosInventario.reduce((sum, c) => sum + c.monto, 0);
    if (totalCostosInventario > 0) {
      if (!grouped['Sin subcuenta asignada']) {
        grouped['Sin subcuenta asignada'] = 0;
      }
      grouped['Sin subcuenta asignada'] += totalCostosInventario;
    }

    return Object.entries(grouped)
      .map(([subcuenta, monto]) => ({ subcuenta, monto }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 10);
  };

  // Egresos por Método de Pago
  const egresosPorMetodoPago = () => {
    const efectivo = filteredTransactions
      .filter(t => t.metodo_pago === 'efectivo')
      .reduce((sum, t) => sum + t.monto_pagado, 0);
    
    const bancosTarjeta = filteredTransactions
      .filter(t => t.metodo_pago && t.metodo_pago !== 'efectivo')
      .reduce((sum, t) => sum + t.monto_pagado, 0);

    return [
      { name: 'Efectivo', value: efectivo, fill: 'hsl(142, 70%, 50%)' },
      { name: 'Bancos/Tarjeta', value: bancosTarjeta, fill: 'hsl(220, 70%, 55%)' }
    ].filter(item => item.value > 0);
  };

  // Egresos por Producto
  const egresosPorProducto = () => {
    const grouped: Record<string, {
      nombre: string;
      imagen: string | null;
      monto: number;
      transacciones: number;
      tieneAsignacion: boolean;
    }> = {};

    // Agrupar por descripción como proxy de producto
    filteredTransactions.forEach(t => {
      const key = t.descripcion || 'Sin descripción';
      if (!grouped[key]) {
        grouped[key] = {
          nombre: key,
          imagen: t.imagen_comprobante || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: true
        };
      }
      grouped[key].monto += t.monto_total;
      grouped[key].transacciones += 1;
    });

    // Agregar costos de inventario
    const totalCostosInventario = filteredCostosInventario.reduce((sum, c) => sum + c.monto, 0);
    if (totalCostosInventario > 0) {
      if (!grouped['Costo Venta Inventario']) {
        grouped['Costo Venta Inventario'] = {
          nombre: 'Costo Venta Inventario',
          imagen: null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: false
        };
      }
      grouped['Costo Venta Inventario'].monto += totalCostosInventario;
    }

    const productosArray = Object.values(grouped).sort((a, b) => b.monto - a.monto);
    const totalGeneral = productosArray.reduce((sum, p) => sum + p.monto, 0);
    
    return { productos: productosArray.slice(0, 10), totalGeneral };
  };

  // Egresos por Proveedor mejorado
  const egresosPorProveedorMejorado = () => {
    const grouped: Record<string, {
      nombre: string;
      monto: number;
      transacciones: number;
      tieneAsignacion: boolean;
    }> = {};

    filteredTransactions.forEach(t => {
      const proveedorNombre = t.proveedor_nombre || 'Sin proveedor asignado';
      const tieneAsignacion = !!t.proveedor_nombre;
      
      if (!grouped[proveedorNombre]) {
        grouped[proveedorNombre] = {
          nombre: proveedorNombre,
          monto: 0,
          transacciones: 0,
          tieneAsignacion
        };
      }
      grouped[proveedorNombre].monto += t.monto_total;
      grouped[proveedorNombre].transacciones += 1;
    });

    // Agregar costos de inventario
    const totalCostosInventario = filteredCostosInventario.reduce((sum, c) => sum + c.monto, 0);
    if (totalCostosInventario > 0) {
      if (!grouped['Sin proveedor asignado']) {
        grouped['Sin proveedor asignado'] = {
          nombre: 'Sin proveedor asignado',
          monto: 0,
          transacciones: 0,
          tieneAsignacion: false
        };
      }
      grouped['Sin proveedor asignado'].monto += totalCostosInventario;
    }

    const proveedoresArray = Object.values(grouped).sort((a, b) => b.monto - a.monto);
    const totalGeneral = proveedoresArray.reduce((sum, p) => sum + p.monto, 0);
    
    return { proveedores: proveedoresArray.slice(0, 10), totalGeneral };
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
                    label={({ tipo, monto, percent }) => 
                      `${tipo}\n${(percent * 100).toFixed(1)}%\n$${monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
                    }
                    fill="#8884d8"
                    dataKey="monto"
                  >
                    {egresosPorTipo().map((entry, index) => {
                      const colors = [
                        "hsl(180, 50%, 50%)",
                        "hsl(0, 60%, 55%)",
                        "hsl(280, 55%, 55%)",
                        "hsl(45, 85%, 60%)"
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
                    label={({ estado, monto, percent }) => 
                      `${estado}\n${(percent * 100).toFixed(1)}%\n$${monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
                    }
                    fill="#8884d8"
                    dataKey="monto"
                  >
                    <Cell fill="hsl(142, 70%, 40%)" />
                    <Cell fill="hsl(45, 85%, 55%)" />
                    <Cell fill="hsl(0, 65%, 55%)" />
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

      {/* Nuevas Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Egresos por Subcuenta */}
        <Card>
          <CardHeader>
            <CardTitle>Egresos por Subcuenta</CardTitle>
            <CardDescription>Desglose de egresos por clasificación detallada</CardDescription>
          </CardHeader>
          <CardContent>
            {egresosPorSubcuenta().length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay datos para mostrar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={egresosPorSubcuenta()} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => `$${value.toLocaleString('es-MX')}`} />
                  <YAxis dataKey="subcuenta" type="category" width={150} />
                  <Tooltip 
                    formatter={(value) => [`$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Monto']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="monto" fill="hsl(180, 50%, 50%)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Métodos de Pago */}
        <Card>
          <CardHeader>
            <CardTitle>Métodos de Pago</CardTitle>
            <CardDescription>Distribución de pagos realizados</CardDescription>
          </CardHeader>
          <CardContent>
            {egresosPorMetodoPago().length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay datos para mostrar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <Treemap
                  data={egresosPorMetodoPago()}
                  dataKey="value"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  fill="hsl(180, 50%, 50%)"
                >
                  <Tooltip 
                    formatter={(value) => [`$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Pagado']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                </Treemap>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tablas de Detalles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Egresos por Producto */}
        <Card>
          <CardHeader>
            <CardTitle>Egresos por Producto</CardTitle>
            <CardDescription>Top 10 productos con mayor egreso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {egresosPorProducto().productos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay productos para mostrar</p>
              </div>
            ) : (
              <>
                {egresosPorProducto().productos.map((producto) => {
                  const porcentaje = egresosPorProducto().totalGeneral > 0 
                    ? ((producto.monto / egresosPorProducto().totalGeneral) * 100).toFixed(1) 
                    : '0.0';
                  
                  return (
                    <div 
                      key={producto.nombre} 
                      className={`flex items-center gap-3 p-3 border rounded-lg ${
                        !producto.tieneAsignacion 
                          ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20' 
                          : ''
                      }`}
                    >
                      {producto.imagen ? (
                        <img 
                          src={producto.imagen} 
                          alt={producto.nombre} 
                          className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${
                          !producto.tieneAsignacion 
                            ? 'bg-amber-100 dark:bg-amber-900/30' 
                            : 'bg-muted'
                        }`}>
                          <Package className={`w-5 h-5 ${
                            !producto.tieneAsignacion 
                              ? 'text-amber-600 dark:text-amber-400' 
                              : 'text-muted-foreground'
                          }`} />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{producto.nombre}</p>
                          {!producto.tieneAsignacion && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 flex-shrink-0">
                              Sin asignar
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {producto.transacciones} {producto.transacciones === 1 ? 'transacción' : 'transacciones'}
                        </p>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-foreground">
                          ${producto.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      
                      <div className="flex-shrink-0">
                        <Badge variant="outline" className="bg-teal-50/50 text-teal-700 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300">
                          {porcentaje}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                
                {/* Fila de Total */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="font-semibold text-primary">Total General</span>
                  <span className="text-lg font-bold text-foreground">
                    ${egresosPorProducto().totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Egresos por Proveedor */}
        <Card>
          <CardHeader>
            <CardTitle>Egresos por Proveedor</CardTitle>
            <CardDescription>Top 10 proveedores por monto de egresos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {egresosPorProveedorMejorado().proveedores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay proveedores para mostrar</p>
              </div>
            ) : (
              <>
                {egresosPorProveedorMejorado().proveedores.map((proveedor) => {
                  const porcentaje = egresosPorProveedorMejorado().totalGeneral > 0 
                    ? ((proveedor.monto / egresosPorProveedorMejorado().totalGeneral) * 100).toFixed(1) 
                    : '0.0';
                  
                  return (
                    <div 
                      key={proveedor.nombre} 
                      className={`flex items-center gap-3 p-3 border rounded-lg ${
                        !proveedor.tieneAsignacion 
                          ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20' 
                          : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{proveedor.nombre}</p>
                          {!proveedor.tieneAsignacion && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 flex-shrink-0">
                              Sin asignar
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {proveedor.transacciones} {proveedor.transacciones === 1 ? 'transacción' : 'transacciones'}
                        </p>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-foreground">
                          ${proveedor.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      
                      <div className="flex-shrink-0">
                        <Badge variant="outline" className="bg-teal-50/50 text-teal-700 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300">
                          {porcentaje}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                
                {/* Fila de Total */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="font-semibold text-primary">Total General</span>
                  <span className="text-lg font-bold text-foreground">
                    ${egresosPorProveedorMejorado().totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticaEgresos;
