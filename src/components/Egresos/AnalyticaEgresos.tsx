import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Treemap
} from "recharts";
import { TrendingDown, DollarSign, Package, AlertCircle, CalendarIcon } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Componente personalizado para el contenido del Treemap
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, value, fill, dataTotal } = props;
  if (!name || !value || !dataTotal) return null;
  
  const porcentaje = ((value / dataTotal) * 100).toFixed(1);
  const montoFormateado = `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
  const fontSize = Math.min(width / 7, height / 5, 16);
  
  if (fontSize < 11) return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} />
    </g>
  );
  
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} />
      <text
        x={x + width / 2}
        y={y + height / 2 - fontSize}
        textAnchor="middle"
        fill="#fff"
        fontSize={fontSize}
        fontWeight="bold"
      >
        {name}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + fontSize / 2}
        textAnchor="middle"
        fill="#fff"
        fontSize={fontSize * 0.85}
        fontWeight="semibold"
      >
        {montoFormateado}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + fontSize * 2}
        textAnchor="middle"
        fill="#fff"
        fontSize={fontSize * 0.85}
      >
        {porcentaje}%
      </text>
    </g>
  );
};


const AnalyticaEgresos = () => {
  const { transacciones, loading } = useTransaccionesEgresos(1000);
  const { data: costosVentaInventario, isLoading: loadingCostosVenta } = useCostosVentaInventario();
  const { data: resumenes, isLoading: loadingResumen } = useResumenEgresosPorPeriodo();
  const { data: subcuentas } = useSubcuentas();
  const { data: productosEgresos } = useProductosEgresos();
  const [periodFilter, setPeriodFilter] = useState<"diario" | "mensual" | "anual">("mensual");
  const [formatoMontos, setFormatoMontos] = useState<"normal" | "miles" | "millones">("normal");
  const [tipoEgreso, setTipoEgreso] = useState<"total" | "costo" | "gasto" | "costo_inventario" | "otros_gastos" | "combinada">("total");
  const [vistaTotal, setVistaTotal] = useState<"unica" | "desglosada">("unica");
  const [fechaAnalisisDiario, setFechaAnalisisDiario] = useState<Date>(new Date());
  const [fechaAnalisisMensual, setFechaAnalisisMensual] = useState<Date>(new Date());
  
  // Usar el nuevo hook para datos de la gráfica
  const { data: datosGrafica, isLoading: loadingGrafica } = useEgresosPorPeriodo(
    periodFilter, 
    tipoEgreso,
    fechaAnalisisDiario,
    fechaAnalisisMensual
  );

  // Filtrar SOLO gastos operativos (51XX, 52XX) - EXCLUIR costos 5001
  const transaccionesFiltradas = transacciones.filter(
    (t) => t.cuenta_codigo && (
      (t.cuenta_codigo.startsWith('51') && 
       t.cuenta_codigo !== '5109' && 
       t.cuenta_codigo !== '5110') || 
      t.cuenta_codigo === '5204' // Solo Otros Gastos, NO 5202/5203
    )
  );

  // Filtrar todas las transacciones EXCLUYENDO ISR/impuestos (cuenta 6001)
  const transaccionesSinImpuestos = transacciones.filter(
    (t) => t.cuenta_codigo !== '6001' && t.tipo_egreso !== 'impuesto'
  );

  // Función para filtrar transacciones según el período
  const getFilteredTransactions = () => {
    if (periodFilter === "diario") {
      const fechaStr = fechaAnalisisDiario.toISOString().split('T')[0];
      return transaccionesFiltradas.filter(t => 
        new Date(t.created_at).toISOString().split('T')[0] === fechaStr
      );
    } else if (periodFilter === "mensual") {
      const mes = fechaAnalisisMensual.getMonth();
      const ano = fechaAnalisisMensual.getFullYear();
      return transaccionesFiltradas.filter(t => {
        const tDate = new Date(t.created_at);
        return tDate.getMonth() === mes && tDate.getFullYear() === ano;
      });
    } else {
      const ano = new Date().getFullYear();
      return transaccionesFiltradas.filter(t => {
        const tDate = new Date(t.created_at);
        return tDate.getFullYear() === ano;
      });
    }
  };

  const filteredTransactions = useMemo(() => {
    return getFilteredTransactions();
  }, [transaccionesFiltradas, periodFilter, fechaAnalisisDiario, fechaAnalisisMensual]);

  // Función para filtrar transacciones SIN impuestos según el período
  const getFilteredTransactionsSinImpuestos = () => {
    if (periodFilter === "diario") {
      const fechaStr = fechaAnalisisDiario.toISOString().split('T')[0];
      return transaccionesSinImpuestos.filter(t => 
        new Date(t.created_at).toISOString().split('T')[0] === fechaStr
      );
    } else if (periodFilter === "mensual") {
      const mes = fechaAnalisisMensual.getMonth();
      const ano = fechaAnalisisMensual.getFullYear();
      return transaccionesSinImpuestos.filter(t => {
        const tDate = new Date(t.created_at);
        return tDate.getMonth() === mes && tDate.getFullYear() === ano;
      });
    } else {
      const ano = new Date().getFullYear();
      return transaccionesSinImpuestos.filter(t => {
        const tDate = new Date(t.created_at);
        return tDate.getFullYear() === ano;
      });
    }
  };

  const filteredTransactionsSinImpuestos = useMemo(() => {
    return getFilteredTransactionsSinImpuestos();
  }, [transaccionesSinImpuestos, periodFilter, fechaAnalisisDiario, fechaAnalisisMensual]);

  // Filtrar costos de venta de inventario según período
  const getFilteredCostosInventario = () => {
    if (!costosVentaInventario) return [];
    
    if (periodFilter === "diario") {
      const fechaStr = fechaAnalisisDiario.toISOString().split('T')[0];
      return costosVentaInventario.filter(c => 
        new Date(c.fecha).toISOString().split('T')[0] === fechaStr
      );
    } else if (periodFilter === "mensual") {
      const mes = fechaAnalisisMensual.getMonth();
      const ano = fechaAnalisisMensual.getFullYear();
      return costosVentaInventario.filter(c => {
        const cDate = new Date(c.fecha);
        return cDate.getMonth() === mes && cDate.getFullYear() === ano;
      });
    } else {
      const ano = new Date().getFullYear();
      return costosVentaInventario.filter(c => {
        const cDate = new Date(c.fecha);
        return cDate.getFullYear() === ano;
      });
    }
  };

  const filteredCostosInventario = useMemo(() => {
    return getFilteredCostosInventario();
  }, [costosVentaInventario, periodFilter, fechaAnalisisDiario, fechaAnalisisMensual]);

  // Función para obtener transacciones según el tipo de egreso seleccionado
  const getTransactionsByTipo = () => {
    // Separar transacciones por tipo de cuenta
    const costoVenta52XX = filteredTransactions.filter(t => 
      t.cuenta_codigo?.startsWith('52') && t.cuenta_codigo !== '5204'
    );
    const gastos51XX = filteredTransactions.filter(t => 
      t.cuenta_codigo?.startsWith('51') && 
      t.cuenta_codigo !== '5109' && 
      t.cuenta_codigo !== '5110'
    );
    const otrosGastos5204 = filteredTransactions.filter(t => 
      t.cuenta_codigo === '5204'
    );
    
    // Lo mismo para sinImpuestos
    const costoVenta52XXSinImp = filteredTransactionsSinImpuestos.filter(t => 
      t.cuenta_codigo?.startsWith('52') && t.cuenta_codigo !== '5204'
    );
    const gastos51XXSinImp = filteredTransactionsSinImpuestos.filter(t => 
      t.cuenta_codigo?.startsWith('51') && 
      t.cuenta_codigo !== '5109' && 
      t.cuenta_codigo !== '5110'
    );
    const otrosGastos5204SinImp = filteredTransactionsSinImpuestos.filter(t => 
      t.cuenta_codigo === '5204'
    );

    if (tipoEgreso === "costo_inventario") {
      return { 
        costoVenta: [],
        gastos: [],
        otrosGastos: [],
        costosInventario: filteredCostosInventario,
        sinImpuestosCostoVenta: [],
        sinImpuestosGastos: [],
        sinImpuestosOtrosGastos: []
      };
    } else if (tipoEgreso === "gasto") {
      return { 
        costoVenta: [],
        gastos: gastos51XX,
        otrosGastos: [],
        costosInventario: [],
        sinImpuestosCostoVenta: [],
        sinImpuestosGastos: gastos51XXSinImp,
        sinImpuestosOtrosGastos: []
      };
    } else if (tipoEgreso === "otros_gastos") {
      return { 
        costoVenta: [],
        gastos: [],
        otrosGastos: otrosGastos5204,
        costosInventario: [],
        sinImpuestosCostoVenta: [],
        sinImpuestosGastos: [],
        sinImpuestosOtrosGastos: otrosGastos5204SinImp
      };
    } else if (tipoEgreso === "costo") {
      return { 
        costoVenta: costoVenta52XX,
        gastos: [],
        otrosGastos: [],
        costosInventario: [],
        sinImpuestosCostoVenta: costoVenta52XXSinImp,
        sinImpuestosGastos: [],
        sinImpuestosOtrosGastos: []
      };
    } else {
      // "total" o "combinada" - TODO separado en 4 categorías
      return { 
        costoVenta: costoVenta52XX,
        gastos: gastos51XX,
        otrosGastos: otrosGastos5204,
        costosInventario: filteredCostosInventario,
        sinImpuestosCostoVenta: costoVenta52XXSinImp,
        sinImpuestosGastos: gastos51XXSinImp,
        sinImpuestosOtrosGastos: otrosGastos5204SinImp
      };
    }
  };

  const transaccionesPorTipo = useMemo(() => {
    return getTransactionsByTipo();
  }, [filteredTransactions, filteredTransactionsSinImpuestos, filteredCostosInventario, tipoEgreso]);

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
    
    // Para "total" o "combinada", trabajar con formato combinado
    if (tipoEgreso === "total" || tipoEgreso === "combinada") {
      return (datosGrafica as any[]).map(item => ({
        periodo: item.periodo,
        monto: formatearMonto(item.monto || 0), // Para vista única
        costos: formatearMonto(item.costos || 0),
        gastos: formatearMonto(item.gastos || 0),
        costosInventario: formatearMonto(item.costosInventario || 0),
        otrosGastos: formatearMonto(item.otrosGastos || 0)
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
    const data: { tipo: string; monto: number }[] = [];
    
    // 1. Costos de Venta (52XX excepto 5204)
    const totalCostoVenta = transaccionesPorTipo.costoVenta.reduce((sum, t) => sum + t.monto_total, 0);
    if (totalCostoVenta > 0) {
      data.push({ tipo: 'Costo de Venta', monto: formatearMonto(totalCostoVenta) });
    }
    
    // 2. Costos de inventario (50XX)
    const totalCostosInventario = transaccionesPorTipo.costosInventario.reduce((sum, c) => sum + c.monto, 0);
    if (totalCostosInventario > 0) {
      data.push({ tipo: 'Costo Venta Inventario', monto: formatearMonto(totalCostosInventario) });
    }
    
    // 3. Gastos (51XX excepto 5109, 5110)
    const totalGastos = transaccionesPorTipo.gastos.reduce((sum, t) => sum + t.monto_total, 0);
    if (totalGastos > 0) {
      data.push({ tipo: 'Gastos', monto: formatearMonto(totalGastos) });
    }
    
    // 4. Otros Gastos (5204)
    const totalOtrosGastos = transaccionesPorTipo.otrosGastos.reduce((sum, t) => sum + t.monto_total, 0);
    if (totalOtrosGastos > 0) {
      data.push({ tipo: 'Otros Gastos', monto: formatearMonto(totalOtrosGastos) });
    }
    
    return data;
  };

  const datosEgresosPorTipo = useMemo(() => egresosPorTipo(), 
    [transaccionesPorTipo, formatoMontos]);

  // Métodos de pago utilizados
  const estadoPagos = () => {
    const grouped: Record<string, number> = {};
    
    // Combinar todos los arrays con montos pagados
    const todasTransacciones = [
      ...transaccionesPorTipo.sinImpuestosCostoVenta,
      ...transaccionesPorTipo.sinImpuestosGastos,
      ...transaccionesPorTipo.sinImpuestosOtrosGastos
    ];
    
    todasTransacciones
      .filter(t => t.monto_pagado > 0)
      .forEach(t => {
        const metodo = t.metodo_pago || 'Sin método especificado';
        const metodoCap = metodo.charAt(0).toUpperCase() + metodo.slice(1);
        
        if (!grouped[metodoCap]) {
          grouped[metodoCap] = 0;
        }
        grouped[metodoCap] += t.monto_pagado;
      });

    return Object.entries(grouped)
      .map(([estado, monto]) => ({ estado, monto: formatearMonto(monto) }))
      .sort((a, b) => b.monto - a.monto);
  };

  const datosEstadoPagos = useMemo(() => estadoPagos(), 
    [transaccionesPorTipo, formatoMontos]);

  // Todos los proveedores (SOLO gastos operativos)
  const topProveedores = () => {
    // Combinar costos de venta, gastos y otros gastos
    const todasTransacciones = [
      ...transaccionesPorTipo.costoVenta,
      ...transaccionesPorTipo.gastos,
      ...transaccionesPorTipo.otrosGastos
    ];
    
    const grouped = todasTransacciones.reduce((acc, t) => {
      const proveedor = t.proveedor_nombre || 'Sin proveedor';
      if (!acc[proveedor]) {
        acc[proveedor] = 0;
      }
      acc[proveedor] += t.monto_total;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([proveedor, monto]) => ({ proveedor, monto: formatearMonto(monto) }))
      .sort((a, b) => b.monto - a.monto);
  };

  const datosTopProveedores = useMemo(() => topProveedores(), 
    [transaccionesPorTipo, formatoMontos]);

  // Egresos por Subcuenta
  const egresosPorSubcuenta = () => {
    const grouped: Record<string, number> = {};

    // 1. Costos de Venta (52XX)
    transaccionesPorTipo.costoVenta.forEach(t => {
      let subcuentaNombre = 'Costos de Venta - Sin subcuenta';
      
      if (t.subcuenta_id) {
        const subcuenta = subcuentas?.find(s => s.id === t.subcuenta_id);
        if (subcuenta) {
          subcuentaNombre = `Costo Venta - ${subcuenta.nombre}`;
        }
      }
      
      if (!grouped[subcuentaNombre]) {
        grouped[subcuentaNombre] = 0;
      }
      grouped[subcuentaNombre] += t.monto_total;
    });

    // 2. Gastos (51XX)
    transaccionesPorTipo.gastos.forEach(t => {
      let subcuentaNombre = 'Gastos - Sin subcuenta';
      
      if (t.subcuenta_id) {
        const subcuenta = subcuentas?.find(s => s.id === t.subcuenta_id);
        if (subcuenta) {
          subcuentaNombre = `Gastos - ${subcuenta.nombre}`;
        }
      }
      
      if (!grouped[subcuentaNombre]) {
        grouped[subcuentaNombre] = 0;
      }
      grouped[subcuentaNombre] += t.monto_total;
    });

    // 3. Otros Gastos (5204)
    transaccionesPorTipo.otrosGastos.forEach(t => {
      let subcuentaNombre = 'Otros Gastos - Sin subcuenta';
      
      if (t.subcuenta_id) {
        const subcuenta = subcuentas?.find(s => s.id === t.subcuenta_id);
        if (subcuenta) {
          subcuentaNombre = `Otros Gastos - ${subcuenta.nombre}`;
        }
      }
      
      if (!grouped[subcuentaNombre]) {
        grouped[subcuentaNombre] = 0;
      }
      grouped[subcuentaNombre] += t.monto_total;
    });

    // 4. Costos de inventario (50XX)
    const totalCostosInventario = transaccionesPorTipo.costosInventario.reduce((sum, c) => sum + c.monto, 0);
    if (totalCostosInventario > 0) {
      grouped['Costo Venta Inventario'] = totalCostosInventario;
    }

    return Object.entries(grouped)
      .map(([subcuenta, monto]) => ({ subcuenta, monto: formatearMonto(monto) }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 10);
  };

  const datosEgresosPorSubcuenta = useMemo(() => egresosPorSubcuenta(), 
    [transaccionesPorTipo, subcuentas, formatoMontos]);

  // Egresos por Método de Pago
  const egresosPorMetodoPago = () => {
    // Combinar todos los arrays con montos pagados
    const todasTransacciones = [
      ...transaccionesPorTipo.sinImpuestosCostoVenta,
      ...transaccionesPorTipo.sinImpuestosGastos,
      ...transaccionesPorTipo.sinImpuestosOtrosGastos
    ];
    
    const efectivo = todasTransacciones
      .filter(t => t.metodo_pago === 'efectivo' && t.monto_pagado > 0)
      .reduce((sum, t) => sum + t.monto_pagado, 0);
    
    const bancosTarjeta = todasTransacciones
      .filter(t => t.metodo_pago && t.metodo_pago !== 'efectivo' && t.monto_pagado > 0)
      .reduce((sum, t) => sum + t.monto_pagado, 0);

    return [
      { name: 'Efectivo', value: formatearMonto(efectivo), fill: 'hsl(160, 55%, 50%)' },
      { name: 'Bancos/Tarjeta', value: formatearMonto(bancosTarjeta), fill: 'hsl(200, 55%, 55%)' }
    ].filter(item => item.value > 0);
  };

  const datosEgresosPorMetodoPago = useMemo(() => egresosPorMetodoPago(), 
    [transaccionesPorTipo, formatoMontos]);

  // Egresos por Producto
  const egresosPorProducto = () => {
    const grouped: Record<string, {
      nombre: string;
      imagen: string | null;
      monto: number;
      transacciones: number;
      tieneAsignacion: boolean;
      categoria: string;
    }> = {};

    // 1. Costos de Venta (52XX)
    transaccionesPorTipo.costoVenta.forEach(t => {
      const key = `CV-${t.descripcion || 'Sin descripción'}`;
      if (!grouped[key]) {
        grouped[key] = {
          nombre: t.descripcion || 'Sin descripción',
          imagen: t.imagen_comprobante || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: true,
          categoria: 'Costo Venta'
        };
      }
      grouped[key].monto += t.monto_total;
      grouped[key].transacciones += 1;
    });

    // 2. Gastos (51XX)
    transaccionesPorTipo.gastos.forEach(t => {
      const key = `G-${t.descripcion || 'Sin descripción'}`;
      if (!grouped[key]) {
        grouped[key] = {
          nombre: t.descripcion || 'Sin descripción',
          imagen: t.imagen_comprobante || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: true,
          categoria: 'Gastos'
        };
      }
      grouped[key].monto += t.monto_total;
      grouped[key].transacciones += 1;
    });

    // 3. Otros Gastos (5204)
    transaccionesPorTipo.otrosGastos.forEach(t => {
      const key = `OG-${t.descripcion || 'Sin descripción'}`;
      if (!grouped[key]) {
        grouped[key] = {
          nombre: t.descripcion || 'Sin descripción',
          imagen: t.imagen_comprobante || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: true,
          categoria: 'Otros Gastos'
        };
      }
      grouped[key].monto += t.monto_total;
      grouped[key].transacciones += 1;
    });

    // 4. Costos de inventario (50XX)
    transaccionesPorTipo.costosInventario.forEach(c => {
      const key = `CI-${c.producto_nombre || 'Sin asignación'}`;
      if (!grouped[key]) {
        grouped[key] = {
          nombre: c.producto_nombre || 'Sin asignación',
          imagen: c.producto_imagen || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: !!c.producto_nombre,
          categoria: 'Costo Venta Inventario'
        };
      }
      grouped[key].monto += c.monto;
      grouped[key].transacciones += 1;
    });

    const productosArray = Object.values(grouped)
      .map(p => ({ ...p, monto: formatearMonto(p.monto) }))
      .sort((a, b) => b.monto - a.monto);
    const totalGeneral = productosArray.reduce((sum, p) => sum + p.monto, 0);
    
    return { productos: productosArray.slice(0, 10), totalGeneral: formatearMonto(totalGeneral) };
  };

  const datosEgresosPorProducto = useMemo(() => egresosPorProducto(), 
    [transaccionesPorTipo, formatoMontos]);

  // Egresos por Proveedor mejorado
  const egresosPorProveedorMejorado = () => {
    const grouped: Record<string, {
      nombre: string;
      monto: number;
      transacciones: number;
      tieneAsignacion: boolean;
    }> = {};

    // 1. Costos de Venta (52XX)
    transaccionesPorTipo.costoVenta.forEach(t => {
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

    // 2. Gastos (51XX)
    transaccionesPorTipo.gastos.forEach(t => {
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

    // 3. Otros Gastos (5204)
    transaccionesPorTipo.otrosGastos.forEach(t => {
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

    // 4. Costos de inventario sin proveedor
    const totalCostosInventario = transaccionesPorTipo.costosInventario.reduce((sum, c) => sum + c.monto, 0);
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
      grouped['Sin proveedor asignado'].transacciones += transaccionesPorTipo.costosInventario.length;
    }

    const proveedoresArray = Object.values(grouped)
      .map(p => ({ ...p, monto: formatearMonto(p.monto) }))
      .sort((a, b) => b.monto - a.monto);
    const totalGeneral = proveedoresArray.reduce((sum, p) => sum + p.monto, 0);
    
    return { proveedores: proveedoresArray.slice(0, 10), totalGeneral: formatearMonto(totalGeneral) };
  };

  const datosEgresosPorProveedorMejorado = useMemo(() => egresosPorProveedorMejorado(), 
    [transaccionesPorTipo, formatoMontos]);

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
      {/* Título Highlights de Egresos */}
      <div>
        <h2 className="text-2xl font-bold text-primary">Highlights de Egresos</h2>
        <p className="text-sm text-muted-foreground">
          Resumen de costos y gastos por período
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
                  ${resumenes.dia.costosVenta5001.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                  ${resumenes.dia.costosVenta5002.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                  ${resumenes.dia.gastos.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                  ${resumenes.dia.otrosGastos.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                ${resumenes.dia.total.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                  ${resumenes.mes.costosVenta5001.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                  ${resumenes.mes.costosVenta5002.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                  ${resumenes.mes.gastos.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                  ${resumenes.mes.otrosGastos.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                ${resumenes.mes.total.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                  ${resumenes.anio.costosVenta5001.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                  ${resumenes.anio.costosVenta5002.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                  ${resumenes.anio.gastos.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                  ${resumenes.anio.otrosGastos.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
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
                ${resumenes.anio.total.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Título y Controles Globales */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-primary">Analítica de Egresos</h2>
          <p className="text-sm text-muted-foreground">
            Análisis detallado con controles personalizables
          </p>
        </div>

      {/* Panel de Controles Globales - Formato Ingresos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Período de Análisis */}
        <Card>
          <CardHeader>
            <CardTitle>Período de Análisis</CardTitle>
            <CardDescription>Selecciona el período</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <RadioGroup 
              value={periodFilter} 
              onValueChange={(v) => setPeriodFilter(v as "diario" | "mensual" | "anual")} 
              className="flex flex-col gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="diario" id="period-daily" />
                <Label htmlFor="period-daily" className="cursor-pointer">Diario</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mensual" id="period-monthly" />
                <Label htmlFor="period-monthly" className="cursor-pointer">Mensual</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="anual" id="period-annual" />
                <Label htmlFor="period-annual" className="cursor-pointer">Anual</Label>
              </div>
            </RadioGroup>
            
            {/* Selector de fecha para análisis diario */}
            {periodFilter === "diario" && (
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground mb-2 block">Fecha específica</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fechaAnalisisDiario && "text-muted-foreground"
                      )}
                      size="sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(fechaAnalisisDiario, "PPP", { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fechaAnalisisDiario}
                      onSelect={(date) => date && setFechaAnalisisDiario(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            
            {/* Selector de mes para análisis mensual */}
            {periodFilter === "mensual" && (
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground mb-2 block">Mes específico</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fechaAnalisisMensual && "text-muted-foreground"
                      )}
                      size="sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(fechaAnalisisMensual, "MMMM yyyy", { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fechaAnalisisMensual}
                      onSelect={(date) => date && setFechaAnalisisMensual(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Card 2: Tipo de Egreso */}
        <Card>
          <CardHeader>
            <CardTitle>Tipo de Egreso</CardTitle>
            <CardDescription>Selecciona qué analizar</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup 
              value={tipoEgreso} 
              onValueChange={(v) => setTipoEgreso(v as any)} 
              className="flex flex-col gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="costo" id="tipo-costo" />
                <Label htmlFor="tipo-costo" className="cursor-pointer">Costo de Venta</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="costo_inventario" id="tipo-inventario" />
                <Label htmlFor="tipo-inventario" className="cursor-pointer">Costo Inventario</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="gasto" id="tipo-gasto" />
                <Label htmlFor="tipo-gasto" className="cursor-pointer">Gastos</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="otros_gastos" id="tipo-otros" />
                <Label htmlFor="tipo-otros" className="cursor-pointer">Otros Gastos</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="total" id="tipo-total" />
                <Label htmlFor="tipo-total" className="cursor-pointer">Total</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
        
        {/* Card 3: Vista de Cifras */}
        <Card>
          <CardHeader>
            <CardTitle>Formato de Cifras</CardTitle>
            <CardDescription>Visualización de montos</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup 
              value={formatoMontos} 
              onValueChange={(v) => setFormatoMontos(v as "normal" | "miles" | "millones")} 
              className="flex flex-col gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="formato-normal" />
                <Label htmlFor="formato-normal" className="cursor-pointer">Normal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="miles" id="formato-miles" />
                <Label htmlFor="formato-miles" className="cursor-pointer">Miles (K)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="millones" id="formato-millones" />
                <Label htmlFor="formato-millones" className="cursor-pointer">Millones (M)</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      </div>
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
              
              {/* Toggle especial: Solo visible cuando tipoEgreso === "total" */}
              {tipoEgreso === "total" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Vista del Total:</span>
                  <Tabs value={vistaTotal} onValueChange={(v) => setVistaTotal(v as any)}>
                    <TabsList>
                      <TabsTrigger value="unica">Línea Única</TabsTrigger>
                      <TabsTrigger value="desglosada">Desglosada</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={datosGraficaFormateados}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis 
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                  padding={{ top: 20, bottom: 0 }}
                />
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
                
                {/* Lógica condicional: Si es "total" y vistaTotal === "desglosada", mostrar 4 líneas */}
                {tipoEgreso === "total" && vistaTotal === "desglosada" ? (
                  <>
                    <Line 
                      type="monotone" 
                      dataKey="costos" 
                      name="Costos Manuales"
                      stroke="hsl(180, 25%, 50%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(180, 25%, 50%)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="gastos" 
                      name="Gastos"
                      stroke="hsl(0, 70%, 55%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(0, 70%, 55%)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="costosInventario" 
                      name="Costo Venta Inventario"
                      stroke="hsl(280, 60%, 55%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(280, 60%, 55%)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="otrosGastos" 
                      name="Otros Gastos"
                      stroke="hsl(210, 15%, 55%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(210, 15%, 55%)' }}
                    />
                    <Legend />
                  </>
                ) : tipoEgreso === "combinada" ? (
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
                        fontSize: 12,
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
                        fontSize: 12,
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
                        fontSize: 12,
                        formatter: (value: number) => value > 0 ? `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}` : ''
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="otrosGastos" 
                      name="Otros Gastos"
                      stroke="hsl(210, 15%, 55%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(210, 15%, 55%)' }}
                      label={{ 
                        position: 'bottom', 
                        fill: 'hsl(var(--foreground))',
                        fontSize: 12,
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
                      fontSize: 14,
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
            {datosEgresosPorTipo.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay datos para mostrar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={datosEgresosPorTipo}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    labelLine={true}
                    label={(props: any) => {
                      const { x, y, tipo, monto, percent } = props;
                      const porcentaje = (percent * 100).toFixed(1);
                      const montoFormateado = `$${Number(monto).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
                      
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="hsl(var(--foreground))"
                          textAnchor={x > props.cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          fontSize={13}
                          fontWeight="500"
                        >
                          <tspan x={x} dy="0">{tipo}</tspan>
                          <tspan x={x} dy="16">{montoFormateado}</tspan>
                          <tspan x={x} dy="16" fontWeight="600">{porcentaje}%</tspan>
                        </text>
                      );
                    }}
                    fill="#8884d8"
                    dataKey="monto"
                  >
                    {datosEgresosPorTipo.map((entry, index) => {
                      const colors = [
                        "hsl(180, 50%, 55%)",
                        "hsl(200, 55%, 50%)",
                        "hsl(160, 45%, 50%)",
                        "hsl(220, 50%, 55%)"
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

        {/* Métodos de Pago Utilizados */}
        <Card>
          <CardHeader>
            <CardTitle>Métodos de Pago Utilizados</CardTitle>
            <CardDescription>Desglose de egresos por forma de pago</CardDescription>
          </CardHeader>
          <CardContent>
            {datosEstadoPagos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay datos para mostrar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={datosEstadoPagos}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    labelLine={true}
                    label={(props: any) => {
                      const { x, y, estado, monto, percent } = props;
                      const porcentaje = (percent * 100).toFixed(1);
                      const montoFormateado = `$${Number(monto).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
                      
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="hsl(var(--foreground))"
                          textAnchor={x > props.cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          fontSize={13}
                          fontWeight="500"
                        >
                          <tspan x={x} dy="0">{estado}</tspan>
                          <tspan x={x} dy="16">{montoFormateado}</tspan>
                          <tspan x={x} dy="16" fontWeight="600">{porcentaje}%</tspan>
                        </text>
                      );
                    }}
                    fill="#8884d8"
                    dataKey="monto"
                  >
                    <Cell fill="hsl(160, 60%, 45%)" />
                    <Cell fill="hsl(200, 50%, 55%)" />
                    <Cell fill="hsl(220, 45%, 50%)" />
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
            {datosEgresosPorSubcuenta.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay datos para mostrar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={datosEgresosPorSubcuenta} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    tickFormatter={(value) => `$${value.toLocaleString('es-MX')}`}
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.20)]}
                  />
                  <YAxis dataKey="subcuenta" type="category" width={150} />
                  <Tooltip 
                    formatter={(value) => [`$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Monto']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar 
                    dataKey="monto" 
                    fill="hsl(180, 50%, 50%)"
                    label={{
                      position: 'right',
                      fill: 'hsl(var(--foreground))',
                      fontSize: 13,
                      formatter: (value: number) => `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
                    }}
                  />
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
            {datosEgresosPorMetodoPago.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay datos para mostrar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <Treemap
                  data={datosEgresosPorMetodoPago}
                  dataKey="value"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={<CustomTreemapContent dataTotal={datosEgresosPorMetodoPago.reduce((sum, item) => sum + item.value, 0)} />}
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
            {datosEgresosPorProducto.productos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay productos para mostrar</p>
              </div>
            ) : (
              <>
                {datosEgresosPorProducto.productos.map((producto) => {
                  const porcentaje = datosEgresosPorProducto.totalGeneral > 0 
                    ? ((producto.monto / datosEgresosPorProducto.totalGeneral) * 100).toFixed(1) 
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
                    ${datosEgresosPorProducto.totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
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
            {datosEgresosPorProveedorMejorado.proveedores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay proveedores para mostrar</p>
              </div>
            ) : (
              <>
                {datosEgresosPorProveedorMejorado.proveedores.map((proveedor) => {
                  const porcentaje = datosEgresosPorProveedorMejorado.totalGeneral > 0 
                    ? ((proveedor.monto / datosEgresosPorProveedorMejorado.totalGeneral) * 100).toFixed(1) 
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
                    ${datosEgresosPorProveedorMejorado.totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
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
