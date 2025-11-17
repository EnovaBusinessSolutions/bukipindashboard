import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { useInstitucionesFinancieras } from "@/hooks/useInstitucionesFinancieras";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList, Treemap, ReferenceLine, LineChart, Line } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const COLORS = [
  'hsl(180, 50%, 55%)',  // Teal claro - chart-1
  'hsl(180, 45%, 45%)',  // Teal medio - chart-2
  'hsl(180, 55%, 65%)',  // Teal más claro - chart-3
  'hsl(180, 40%, 40%)',  // Teal oscuro - chart-4
  'hsl(180, 60%, 70%)',  // Teal muy claro - chart-5
];

const AnalyticaFinanciamientos = () => {
  const { financiamientos, isLoading, transacciones } = useFinanciamientos();
  const { instituciones } = useInstitucionesFinancieras();
  const [periodoAmortizacion, setPeriodoAmortizacion] = useState<"mensual" | "anual">("mensual");
  const [formatoVisualizacion, setFormatoVisualizacion] = useState<"normal" | "miles" | "millones">("normal");
  const [decimales, setDecimales] = useState<number>(2);
  const [creditoAmortizacion, setCreditoAmortizacion] = useState<string>("todos");
  const [creditoSimpleSeleccionado, setCreditoSimpleSeleccionado] = useState<string>("todos");
  const [creditoRevolventeSeleccionado, setCreditoRevolventeSeleccionado] = useState<string>("todos");
  const [periodoGastosFinancieros, setPeriodoGastosFinancieros] = useState<"mensual" | "anual">("mensual");
  const [tipoGastoFinanciero, setTipoGastoFinanciero] = useState<string>("total");

  // Consulta para obtener gastos financieros de la cuenta 5201
  const { data: gastosFinancieros, isLoading: isLoadingGastos } = useQuery({
    queryKey: ["gastos-financieros-5201"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { data, error } = await supabase
        .from("detalle_asientos")
        .select(`
          id,
          debe,
          cuenta_codigo,
          asientos_contables!inner(
            id,
            fecha,
            descripcion,
            user_id
          )
        `)
        .eq("cuenta_codigo", "5201")
        .eq("asientos_contables.user_id", user.id)
        .gt("debe", 0);

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading || isLoadingGastos) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const financiamientosActivos = financiamientos.filter(f => f.estado === "activo");
  
  // Separar tipos de crédito
  const tarjetasCorporativas = financiamientosActivos.filter(f => f.tipo_credito === "tarjeta_corporativa");
  const creditosRevolventes = financiamientosActivos.filter(f => f.tipo_credito === "revolvente");
  const creditosSimples = financiamientosActivos.filter(f => 
    f.tipo_credito !== "tarjeta_corporativa" && f.tipo_credito !== "revolvente"
  );
  
  // Para tarjetas: solo el saldo actual cuenta como deuda (lo utilizado)
  const deudaTarjetas = tarjetasCorporativas.reduce((sum, f) => sum + f.saldo_actual, 0);
  
  // Para créditos revolventes: solo el saldo actual es deuda (no tienen "monto original")
  const deudaRevolvente = creditosRevolventes.reduce((sum, f) => sum + f.saldo_actual, 0);
  
  // Para créditos simples: usar saldo_inicial como monto original
  const totalOriginalSimples = creditosSimples.reduce((sum, f) => sum + f.saldo_inicial, 0);
  const deudaSimples = creditosSimples.reduce((sum, f) => sum + f.saldo_actual, 0);
  const totalPagadoSimples = totalOriginalSimples - deudaSimples;
  
  // Totales combinados
  const totalDeuda = deudaSimples + deudaTarjetas + deudaRevolvente;
  const totalOriginal = totalOriginalSimples; // Solo créditos simples tienen monto original fijo
  const totalPagado = totalPagadoSimples; // Solo créditos simples calculan pagos por diferencia

  // LÓGICA PARA GRÁFICA DE CRÉDITOS SIMPLES
  const creditosSimplesFiltrados = creditoSimpleSeleccionado === "todos"
    ? creditosSimples
    : creditosSimples.filter(f => f.id === creditoSimpleSeleccionado);

  const totalOriginalSimplesFiltrado = creditosSimplesFiltrados.reduce((sum, f) => sum + f.saldo_inicial, 0);
  const deudaSimplesFiltrada = creditosSimplesFiltrados.reduce((sum, f) => sum + f.saldo_actual, 0);
  const totalPagadoSimplesFiltrado = totalOriginalSimplesFiltrado - deudaSimplesFiltrada;

  const dataComparacionSimples = [
    { name: "Monto Original", valor: totalOriginalSimplesFiltrado, color: "hsl(180, 50%, 55%)" },
    { name: "Monto Pagado", valor: totalPagadoSimplesFiltrado, color: "hsl(142, 76%, 36%)" },
    { name: "Saldo Pendiente", valor: deudaSimplesFiltrada, color: "hsl(0, 70%, 55%)" },
  ];

  // LÓGICA PARA GRÁFICA DE REVOLVENTES/TARJETAS
  const creditosRevolventesYTarjetas = [...creditosRevolventes, ...tarjetasCorporativas];

  const creditosRevolventesFiltrados = creditoRevolventeSeleccionado === "todos"
    ? creditosRevolventesYTarjetas
    : creditosRevolventesYTarjetas.filter(f => f.id === creditoRevolventeSeleccionado);

  const lineaTotal = creditosRevolventesFiltrados.reduce((sum, f) => sum + (f.monto_total || 0), 0);
  const lineaUtilizada = creditosRevolventesFiltrados.reduce((sum, f) => sum + f.saldo_actual, 0);
  const lineaDisponible = lineaTotal - lineaUtilizada;

  // Estructura de datos para gráfica waterfall
  interface ChartDataWaterfall {
    name: string;
    value: number;
    start: number;
    fill: string;
    isTotal: boolean;
  }

  const waterfallRevolvente: ChartDataWaterfall[] = [];

  // 1. Línea Total (inicio - teal)
  waterfallRevolvente.push({
    name: "Línea Total",
    value: 0,
    start: lineaTotal,
    fill: "hsl(180, 50%, 55%)",
    isTotal: true
  });

  // 2. Línea Utilizada (resta - rojo)
  const despuesUtilizada = lineaTotal - lineaUtilizada;
  waterfallRevolvente.push({
    name: "(-) Línea Utilizada",
    value: lineaDisponible,
    start: lineaUtilizada,
    fill: "hsl(0, 70%, 55%)",
    isTotal: false
  });

  // 3. Línea Disponible (resultado - verde)
  waterfallRevolvente.push({
    name: "= Línea Disponible",
    value: 0,
    start: lineaDisponible,
    fill: "hsl(142, 76%, 36%)",
    isTotal: true
  });

  // Funciones de formato para gráfica waterfall
  const CustomTooltipWaterfall = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const chartData = payload[0].payload;
      const displayValue = chartData.isTotal 
        ? chartData.start 
        : (chartData.name.includes("(-)") ? -chartData.start : chartData.start);
      
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-1">{chartData.name}</p>
          <p className={`text-sm ${displayValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatearValorCompleto(Math.abs(displayValue))}
          </p>
        </div>
      );
    }
    return null;
  };

  // Renderizador personalizado de etiquetas que muestra solo el valor 'start', no el acumulado
  const renderCustomLabel = (props: any) => {
    const { x, y, width, height, value, index } = props;
    const entry = waterfallRevolvente[index];
    
    // Mostrar la etiqueta con el valor 'start', que es el valor real de la barra
    const displayValue = entry.start;
    
    return (
      <text
        x={x + width / 2}
        y={y - 5}
        fill="hsl(var(--foreground))"
        textAnchor="middle"
        dominantBaseline="bottom"
        fontSize={12}
        fontWeight="bold"
      >
        ${formatearValor(displayValue)}
      </text>
    );
  };
  
  // Mostrar todos los tipos activos con su saldo real (incluso si es 0)
  const porTipo = financiamientosActivos.reduce((acc, f) => {
    const tipo = f.tipo_credito;
    const saldoReal = f.saldo_actual; // Para tarjetas: solo lo utilizado, para otros: saldo actual
    
    if (!acc[tipo]) {
      acc[tipo] = { tipo, saldo: 0, count: 0 };
    }
    acc[tipo].saldo += saldoReal;
    acc[tipo].count += 1;
    
    return acc;
  }, {} as Record<string, { tipo: string; saldo: number; count: 0 }>);

  const dataPorTipo = Object.values(porTipo);
  
  const getTipoCreditoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      simple: "Crédito Simple",
      arrendamiento: "Arrendamiento",
      revolvente: "Crédito Revolvente",
      tarjeta_corporativa: "Tarjeta Corporativa",
    };
    return labels[tipo] || tipo;
  };
  
  // Preparar datos para treemap
  const totalDeudaPorTipo = dataPorTipo.reduce((sum, item) => sum + item.saldo, 0);
  const treemapData = dataPorTipo.map((item, index) => ({
    name: getTipoCreditoLabel(item.tipo),
    value: item.saldo,
    percentage: totalDeudaPorTipo > 0 ? (item.saldo / totalDeudaPorTipo * 100) : 0,
    color: COLORS[index % COLORS.length]
  }));

  // Función para formatear valores según el formato seleccionado
  const formatearValor = (valor: number): string => {
    if (formatoVisualizacion === "miles") {
      return `${(valor / 1000).toFixed(decimales)}K`;
    } else if (formatoVisualizacion === "millones") {
      return `${(valor / 1000000).toFixed(decimales)}M`;
    } else {
      // Formato normal con comas y decimales configurables
      return valor.toLocaleString('es-MX', { 
        minimumFractionDigits: decimales, 
        maximumFractionDigits: decimales 
      });
    }
  };

  const formatearValorCompleto = (valor: number): string => {
    return `$${valor.toLocaleString('es-MX', { 
      minimumFractionDigits: decimales, 
      maximumFractionDigits: decimales 
    })}`;
  };

  // Componente personalizado para el contenido del Treemap
  const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, root, depth, index, name: nodeName } = props;
    
    if (width < 80 || height < 80) return null;
    if (!root) return null;
    
    // Encontrar el nodo actual en los datos
    const currentNode = treemapData[index] as { name: string; value: number; percentage: number; color: string } | undefined;
    const name = currentNode?.name || nodeName || '';
    const value = currentNode?.value || 0;
    const percentage = currentNode?.percentage || 0;
    const color = currentNode?.color || COLORS[0];
    
    const formattedValue = formatoVisualizacion === "miles" 
      ? `${(value / 1000).toFixed(1)}K`
      : formatoVisualizacion === "millones"
      ? `${(value / 1000000).toFixed(2)}M`
      : value.toLocaleString('es-MX', { minimumFractionDigits: 0 });
    
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: color,
            stroke: '#fff',
            strokeWidth: 2,
          }}
        />
        <text
          x={x + width / 2}
          y={y + height / 2 - 20}
          textAnchor="middle"
          fill="#fff"
          fontSize={14}
          fontWeight="bold"
        >
          {name}
        </text>
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill="#fff"
          fontSize={16}
          fontWeight="bold"
        >
          ${formattedValue}
        </text>
        <text
          x={x + width / 2}
          y={y + height / 2 + 20}
          textAnchor="middle"
          fill="#fff"
          fontSize={13}
        >
          {percentage.toFixed(1)}%
        </text>
      </g>
    );
  };

  // Calcular amortizaciones futuras por crédito
  const calcularAmortizacionesFuturas = () => {
    const hoy = new Date();
    
    // IMPORTANTE: Calcular fechaVencimientoMaxima usando TODOS los financiamientos activos
    // (no los filtrados) para que el rango de fechas no cambie al seleccionar un crédito
    let fechaVencimientoMaxima = new Date(hoy);
    
    financiamientosActivos.forEach(credito => {
      const fechaVencimiento = new Date(credito.fecha_vencimiento);
      if (fechaVencimiento > fechaVencimientoMaxima) {
        fechaVencimientoMaxima = fechaVencimiento;
      }
    });

    // Calcular periodos basados en el filtro de periodo (mensual/anual)
    // NO basados en el crédito seleccionado
    const anoInicio = hoy.getFullYear();
    const anoVencimiento = fechaVencimientoMaxima.getFullYear();
    const anosNecesarios = (anoVencimiento - anoInicio) + 1;
    const anosMinimos = 5;

    const periodos = periodoAmortizacion === "mensual" 
      ? 12  // SIEMPRE 12 meses fijos para vista de corto plazo
      : Math.max(anosMinimos, anosNecesarios);
    
    // DESPUÉS de calcular periodos, filtrar por crédito seleccionado
    const financiamientosFiltradosAmort = creditoAmortizacion === "todos"
      ? financiamientosActivos
      : financiamientosActivos.filter(f => f.id === creditoAmortizacion);
    
    const financiamientosConDeuda = financiamientosFiltradosAmort;
    
    const data: any[] = [];
    const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    // Crear estructura de periodos
    for (let i = 0; i < periodos; i++) {
      let nombrePeriodo: string;
      
      if (periodoAmortizacion === "mensual") {
        const mesActual = hoy.getMonth();
        const anoActual = hoy.getFullYear();
        const mesIndex = (mesActual + i) % 12;
        const anoOffset = Math.floor((mesActual + i) / 12);
        nombrePeriodo = `${mesesNombres[mesIndex]} ${anoActual + anoOffset}`;
      } else {
        nombrePeriodo = `${hoy.getFullYear() + i}`;
      }

      const periodo: any = { periodo: nombrePeriodo };
      
      // Inicializar cada crédito con deuda en 0
      financiamientosConDeuda.forEach((f) => {
        periodo[f.nombre] = 0;
      });

      data.push(periodo);
    }

    // Calcular amortizaciones por cada crédito con deuda
    financiamientosConDeuda.forEach((credito) => {
      const fechaVencimiento = new Date(credito.fecha_vencimiento);
      const mesesRestantes = Math.max(0, 
        (fechaVencimiento.getFullYear() - hoy.getFullYear()) * 12 + 
        (fechaVencimiento.getMonth() - hoy.getMonth())
      );

      if (credito.tipo_credito === "simple" || credito.tipo_credito === "arrendamiento") {
        // Amortizaciones iguales
        const amortizacionMensual = credito.plazo_meses > 0 ? credito.monto_total / credito.plazo_meses : 0;
        
        if (periodoAmortizacion === "mensual") {
          const mesesAMostrar = Math.min(periodos, mesesRestantes);
          for (let i = 0; i < mesesAMostrar; i++) {
            data[i][credito.nombre] += amortizacionMensual;
          }
        } else {
        const anoVencimiento = fechaVencimiento.getFullYear();
        const anoInicio = hoy.getFullYear();
        const anosRestantes = (anoVencimiento - anoInicio) + 1; // +1 para incluir ambos años
          const anosAMostrar = Math.min(periodos, anosRestantes);
          
          // Calcular cuántos meses quedan en el año actual
          const mesesRestantesAnoActual = 12 - hoy.getMonth();
          let mesesContados = 0;
          
          for (let i = 0; i < anosAMostrar; i++) {
            let mesesEnEsteAno: number;
            
            if (i === 0) {
              // Primer año: solo meses restantes del año actual
              mesesEnEsteAno = Math.min(mesesRestantesAnoActual, mesesRestantes);
            } else if (mesesContados + 12 <= mesesRestantes) {
              // Años completos intermedios
              mesesEnEsteAno = 12;
            } else {
              // Último año parcial
              mesesEnEsteAno = mesesRestantes - mesesContados;
            }
            
            data[i][credito.nombre] += amortizacionMensual * mesesEnEsteAno;
            mesesContados += mesesEnEsteAno;
            
            if (mesesContados >= mesesRestantes) break;
          }
        }
      } else if (credito.tipo_credito === "revolvente") {
        // Se paga en fecha de vencimiento
        const mesesHastaVencimiento = Math.max(0, (fechaVencimiento.getFullYear() - hoy.getFullYear()) * 12 + (fechaVencimiento.getMonth() - hoy.getMonth()));
        
        if (periodoAmortizacion === "mensual" && mesesHastaVencimiento < periodos) {
          data[mesesHastaVencimiento][credito.nombre] += credito.saldo_actual;
        } else if (periodoAmortizacion === "anual") {
          const anosHastaVencimiento = Math.floor(mesesHastaVencimiento / 12);
          if (anosHastaVencimiento < periodos) {
            data[anosHastaVencimiento][credito.nombre] += credito.saldo_actual;
          }
        }
      } else if (credito.tipo_credito === "tarjeta_corporativa") {
        // Pago al mes siguiente
        if (periodoAmortizacion === "mensual") {
          data[0][credito.nombre] += credito.saldo_actual;
        } else {
          data[0][credito.nombre] += credito.saldo_actual;
        }
      }
    });

    return data;
  };

  // Calcular deuda por acreedor
  const calcularDeudaPorAcreedor = () => {
    const deudaPorInstitucion: Record<string, { saldo: number; logo?: string; nombre: string }> = {};
    
    financiamientosActivos
      .filter(f => f.saldo_actual > 0)
      .forEach(f => {
        const key = f.institucion_financiera_id || f.institucion_financiera;
        const institucion = instituciones?.find(i => i.id === f.institucion_financiera_id);
        
        if (!deudaPorInstitucion[key]) {
          deudaPorInstitucion[key] = {
            saldo: 0,
            logo: institucion?.logo_url || undefined,
            nombre: institucion?.nombre || f.institucion_financiera,
          };
        }
        deudaPorInstitucion[key].saldo += f.saldo_actual;
      });
    
    // Convertir a array y ordenar por saldo descendente
    const acreedoresOrdenados = Object.entries(deudaPorInstitucion)
      .map(([key, data]) => ({
        id: key,
        ...data,
      }))
      .sort((a, b) => b.saldo - a.saldo);
    
    // Top 5 + agrupar resto
    const top5 = acreedoresOrdenados.slice(0, 5);
    const resto = acreedoresOrdenados.slice(5);
    
    if (resto.length > 0) {
      const saldoOtros = resto.reduce((sum, a) => sum + a.saldo, 0);
      top5.push({
        id: 'otros',
        nombre: 'Otros Bancos',
        saldo: saldoOtros,
        logo: undefined,
      });
    }
    
    // Calcular porcentajes
    const totalDeuda = top5.reduce((sum, a) => sum + a.saldo, 0);
    return top5.map(a => ({
      ...a,
      porcentaje: totalDeuda > 0 ? (a.saldo / totalDeuda) * 100 : 0,
    }));
  };

  const acreedoresTop = calcularDeudaPorAcreedor();
  const dataAmortizacionesFuturas = calcularAmortizacionesFuturas();
  // Mostrar todos los créditos activos en la leyenda (incluso con saldo 0)
  const nombresCreditos = financiamientosActivos.map(f => f.nombre);

  // Calcular gastos financieros históricos (intereses pagados)
  const calcularGastosFinancierosHistoricos = () => {
    if (!financiamientos) {
      const hoy = new Date();
      const añoActual = hoy.getFullYear();
      
      if (periodoGastosFinancieros === "mensual") {
        // Generar los 12 meses del año actual en cero
        return Array.from({ length: 12 }, (_, i) => {
          const mes = i + 1;
          const clave = `${añoActual}-${String(mes).padStart(2, '0')}`;
          return {
            periodo: clave,
            simple: 0,
            revolvente: 0,
            tarjeta: 0,
            total: 0,
            periodoFormateado: new Date(añoActual, i, 1).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
          };
        });
      } else {
        // Anual: si no hay datos, retornar array vacío
        return [];
      }
    }
    
    // Crear un mapa de financiamiento_id -> tipo_credito
    const financiamientosPorId = new Map(
      financiamientos.map(f => [f.id, f.tipo_credito])
    );
    
    // Solo transacciones con intereses PAGADOS (no pendientes)
    const transaccionesConIntereses = (transacciones || [])
      .filter(t => t.tipo_transaccion === 'cargo_interes' && (t.interes_pagado || 0) > 0)
      .map(t => ({
        ...t,
        tipoCreditoAsociado: financiamientosPorId.get(t.financiamiento_id) || 'desconocido'
      }));
    
    if (periodoGastosFinancieros === "mensual") {
      // MODO MENSUAL: Siempre mostrar 12 meses completos
      const hoy = new Date();
      const añoActual = hoy.getFullYear();
      
      // Determinar el rango de años con datos
      let añoMin = añoActual;
      let añoMax = añoActual;
      
      if (transaccionesConIntereses.length > 0) {
        const fechas = transaccionesConIntereses.map(t => new Date(t.fecha).getFullYear());
        añoMin = Math.min(...fechas);
        añoMax = Math.max(...fechas);
      }
      
      // Crear mapa para acumular datos por mes
      const datosPorPeriodo = new Map<string, {
        periodo: string,
        simple: number,
        revolvente: number,
        tarjeta: number,
        total: number
      }>();
      
      // Generar TODOS los meses del rango de años
      for (let año = añoMin; año <= añoMax; año++) {
        for (let mes = 1; mes <= 12; mes++) {
          const clave = `${año}-${String(mes).padStart(2, '0')}`;
          datosPorPeriodo.set(clave, {
            periodo: clave,
            simple: 0,
            revolvente: 0,
            tarjeta: 0,
            total: 0
          });
        }
      }
      
      // Acumular los intereses pagados reales
      transaccionesConIntereses.forEach(t => {
        const fecha = new Date(t.fecha);
        const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        
        const datos = datosPorPeriodo.get(clave);
        if (!datos) return;
        
        const valor = t.interes_pagado || 0;
        
        if (t.tipoCreditoAsociado === 'tarjeta_corporativa') {
          datos.tarjeta += valor;
        } else if (t.tipoCreditoAsociado === 'revolvente') {
          datos.revolvente += valor;
        } else {
          datos.simple += valor;
        }
        
        datos.total += valor;
      });
      
      // Convertir a array y ordenar
      return Array.from(datosPorPeriodo.values())
        .sort((a, b) => a.periodo.localeCompare(b.periodo))
        .map(d => ({
          ...d,
          periodoFormateado: new Date(d.periodo + "-01").toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
        }));
      
    } else {
      // MODO ANUAL: Solo años con datos reales
      if (transaccionesConIntereses.length === 0) {
        return [];
      }
      
      const datosPorAño = new Map<string, {
        periodo: string,
        simple: number,
        revolvente: number,
        tarjeta: number,
        total: number
      }>();
      
      transaccionesConIntereses.forEach(t => {
        const fecha = new Date(t.fecha);
        const clave = `${fecha.getFullYear()}`;
        
        if (!datosPorAño.has(clave)) {
          datosPorAño.set(clave, {
            periodo: clave,
            simple: 0,
            revolvente: 0,
            tarjeta: 0,
            total: 0
          });
        }
        
        const datos = datosPorAño.get(clave)!;
        const valor = t.interes_pagado || 0;
        
        if (t.tipoCreditoAsociado === 'tarjeta_corporativa') {
          datos.tarjeta += valor;
        } else if (t.tipoCreditoAsociado === 'revolvente') {
          datos.revolvente += valor;
        } else {
          datos.simple += valor;
        }
        
        datos.total += valor;
      });
      
      // Solo retornar años con datos (no llenar huecos)
      return Array.from(datosPorAño.values())
        .sort((a, b) => a.periodo.localeCompare(b.periodo))
        .map(d => ({
          ...d,
          periodoFormateado: d.periodo
        }));
    }
  };

  const dataGastosFinancieros = calcularGastosFinancierosHistoricos();

  // Calcular el valor máximo para el eje Y con 20% de margen
  const limiteYAxis = (() => {
    if (dataAmortizacionesFuturas.length === 0) return 0;
    
    // Encontrar el valor máximo sumando todos los créditos por periodo
    const valorMaximo = Math.max(...dataAmortizacionesFuturas.map(periodo => {
      return nombresCreditos.reduce((sum, nombre) => {
        return sum + (periodo[nombre] || 0);
      }, 0);
    }));
    
    // Agregar 20% de margen superior
    return valorMaximo * 1.2;
  })();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Créditos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {financiamientosActivos.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Deuda Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalDeuda.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalPagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">% Pagado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalOriginal > 0 ? ((totalPagado / totalOriginal) * 100).toFixed(1) : 0}%
            </div>
              </CardContent>
            </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Estado Vencimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {/* COLUMNA IZQUIERDA - Estado */}
              <div>
                {(() => {
                  const hoy = new Date();
                  hoy.setHours(0, 0, 0, 0);
                  
                  const creditosVencidos = financiamientosActivos.filter(f => {
                    const fechaVencimiento = new Date(f.fecha_vencimiento);
                    fechaVencimiento.setHours(0, 0, 0, 0);
                    return fechaVencimiento < hoy && f.saldo_actual > 0;
                  });
                  
                  if (creditosVencidos.length === 0) {
                    return (
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-green-600">✓</div>
                        <div className="text-sm text-green-600">Al día</div>
                      </div>
                    );
                  }
                  
                  const montoAtrasado = creditosVencidos.reduce((sum, f) => sum + f.saldo_actual, 0);
                  const diasAtraso = Math.max(...creditosVencidos.map(f => {
                    const fechaVencimiento = new Date(f.fecha_vencimiento);
                    fechaVencimiento.setHours(0, 0, 0, 0);
                    return Math.floor((hoy.getTime() - fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24));
                  }));
                  
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-red-600">⚠</div>
                        <div className="text-sm text-red-600 font-semibold">Atrasado</div>
                      </div>
                      <div className="text-lg font-bold text-red-600">
                        {diasAtraso} días
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ${montoAtrasado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* COLUMNA DERECHA - Configuración Visual */}
              <div className="space-y-2 border-l pl-4">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Configuración Visual
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="formato-global" className="text-xs text-muted-foreground">
                    Formato:
                  </Label>
                  <Select 
                    value={formatoVisualizacion} 
                    onValueChange={(value: "normal" | "miles" | "millones") => setFormatoVisualizacion(value)}
                  >
                    <SelectTrigger id="formato-global" className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="miles">Miles (K)</SelectItem>
                      <SelectItem value="millones">Millones (M)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="decimales-global" className="text-xs text-muted-foreground">
                    Decimales:
                  </Label>
                  <Select 
                    value={decimales.toString()} 
                    onValueChange={(value) => setDecimales(Number(value))}
                  >
                    <SelectTrigger id="decimales-global" className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 decimales</SelectItem>
                      <SelectItem value="1">1 decimal</SelectItem>
                      <SelectItem value="2">2 decimales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
          </div>


      {/* PRIMERA FILA: Deuda por Tipo + Deuda por Acreedor */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Deuda por Tipo de Crédito</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <Treemap
                data={treemapData}
                dataKey="value"
                stroke="#fff"
                fill="#10b981"
                content={<CustomTreemapContent />}
              />
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deuda por Acreedor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {acreedoresTop.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay deuda pendiente con acreedores
                </p>
              ) : (
                acreedoresTop.map((acreedor) => (
                  <div 
                    key={acreedor.id} 
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {/* Logo o inicial */}
                    <div className="flex-shrink-0">
                      {acreedor.logo ? (
                        <img 
                          src={acreedor.logo} 
                          alt={acreedor.nombre}
                          className="w-12 h-12 object-contain rounded-md bg-white p-1 border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg border">
                          {acreedor.nombre.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    
                    {/* Información */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {acreedor.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {acreedor.porcentaje.toFixed(1)}% del total
                      </p>
                    </div>
                    
                    {/* Monto */}
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">
                        ${formatearValor(acreedor.saldo)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        adeudado
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Resumen total */}
            {acreedoresTop.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Total Deuda:</span>
                  <span className="text-lg font-bold text-red-600">
                    ${formatearValor(acreedoresTop.reduce((sum, a) => sum + a.saldo, 0))}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SEGUNDA FILA: Comportamiento Crédito Simple + Comportamiento Revolvente */}
      <div className="grid grid-cols-2 gap-4">
        {/* Gráfica 3: Comportamiento Crédito Simple */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Comportamiento Crédito Simple</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="filtro-credito-simple" className="text-xs">Crédito:</Label>
                <Select value={creditoSimpleSeleccionado} onValueChange={setCreditoSimpleSeleccionado}>
                  <SelectTrigger id="filtro-credito-simple" className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {creditosSimples.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nombre} {f.saldo_actual === 0 ? "(Saldo: $0)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CardDescription>Monto original vs. pagado</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart 
                data={dataComparacionSimples}
                layout="vertical"
                margin={{ top: 5, right: 15, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  tickFormatter={(value) => `$${formatearValor(value)}`}
                />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip 
                  formatter={(value: number) => formatearValorCompleto(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="valor" radius={[0, 8, 8, 0]}>
                  {dataComparacionSimples.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList 
                    dataKey="valor" 
                    position="right" 
                    formatter={(value: number) => `$${formatearValor(value)}`}
                    style={{ fill: 'hsl(var(--foreground))', fontSize: '12px', fontWeight: 'bold' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfica 4: Comportamiento Revolvente/Tarjetas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Comportamiento Revolvente/Tarjetas</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="filtro-credito-revolvente" className="text-xs">Crédito:</Label>
                <Select value={creditoRevolventeSeleccionado} onValueChange={setCreditoRevolventeSeleccionado}>
                  <SelectTrigger id="filtro-credito-revolvente" className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {creditosRevolventesYTarjetas.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nombre} {f.saldo_actual === 0 ? "(Sin disposiciones)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CardDescription>Capacidad y utilización de líneas de crédito</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={waterfallRevolvente}
                margin={{ top: 20, right: 30, left: 60, bottom: 20 }}
                barGap={8}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name"
                  angle={0}
                  textAnchor="middle"
                  tick={{ fill: 'hsl(var(--foreground))' }}
                />
                <YAxis 
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]}
                  tickFormatter={(value) => `$${formatearValor(value)}`}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip content={<CustomTooltipWaterfall />} />
                
                {/* Barra transparente para posicionamiento */}
                <Bar 
                  dataKey="value" 
                  stackId="a" 
                  fill="transparent" 
                  fillOpacity={0}
                  stroke="transparent"
                  strokeOpacity={0}
                  isAnimationActive={false}
                />
                
                {/* Barra visible con colores */}
                <Bar dataKey="start" stackId="a" radius={[8, 8, 0, 0]} label={renderCustomLabel}>
                  {waterfallRevolvente.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
                
                {/* Línea de referencia en cero */}
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Amortizaciones Futuras por Crédito</CardTitle>
              <CardDescription>
                Proyección de pagos pendientes hasta el vencimiento de todos los créditos
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="credito-amortizacion">Crédito:</Label>
                <Select value={creditoAmortizacion} onValueChange={setCreditoAmortizacion}>
                  <SelectTrigger id="credito-amortizacion" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {financiamientosActivos.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nombre} {f.saldo_actual === 0 ? "(Sin disposiciones)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="periodo-amortizacion">Periodo:</Label>
                <Select value={periodoAmortizacion} onValueChange={(value: "mensual" | "anual") => setPeriodoAmortizacion(value)}>
                  <SelectTrigger id="periodo-amortizacion" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={dataAmortizacionesFuturas}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis 
                domain={[0, limiteYAxis]}
                allowDataOverflow={false}
              />
              <Tooltip
                formatter={(value: number) => formatearValorCompleto(value)}
              />
              <Legend />
              {nombresCreditos.map((nombre: string, index: number) => {
                const esUltimaBarra = index === nombresCreditos.length - 1;
                return (
                  <Bar 
                    key={nombre} 
                    dataKey={nombre} 
                    stackId="a" 
                    fill={COLORS[index % COLORS.length]}
                  >
                    <LabelList 
                      dataKey={nombre} 
                      position="center" 
                      fill="#fff"
                      fontSize={11}
                      fontWeight="bold"
                      formatter={(value: number) => {
                        if (value === 0) return '';
                        return `$${formatearValor(value)}`;
                      }}
                    />
                    {esUltimaBarra && (
                      <LabelList 
                        content={(props: any) => {
                          const { x, y, width, index: dataIndex } = props;
                          if (dataIndex === undefined) return null;
                          
                          const periodo = dataAmortizacionesFuturas[dataIndex];
                          const total = nombresCreditos.reduce((sum, n) => sum + (periodo[n] || 0), 0);
                          
                          if (total === 0) return null;
                          
                          const textoTotal = `$${formatearValor(total)}`;
                          
                          return (
                            <text
                              x={x + width / 2}
                              y={y - 5}
                              fill="#000"
                              textAnchor="middle"
                              fontSize={12}
                              fontWeight="bold"
                            >
                              {textoTotal}
                            </text>
                          );
                        }}
                      />
                    )}
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfica de Gastos Financieros Históricos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Evolución de Gastos Financieros</CardTitle>
            <CardDescription>
              Evolución de la cuenta 5201 - Gastos Financieros (intereses pagados y devengados)
            </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="tipo-gasto">Tipo:</Label>
                <Select value={tipoGastoFinanciero} onValueChange={setTipoGastoFinanciero}>
                  <SelectTrigger id="tipo-gasto" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total</SelectItem>
                    <SelectItem value="simple">Créditos Simples</SelectItem>
                    <SelectItem value="revolvente">Líneas Revolventes</SelectItem>
                    <SelectItem value="tarjeta">Tarjetas Corporativas</SelectItem>
                    <SelectItem value="combinada">Combinada (Todas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="periodo-gastos">Periodo:</Label>
                <Select value={periodoGastosFinancieros} onValueChange={(value: "mensual" | "anual") => setPeriodoGastosFinancieros(value)}>
                  <SelectTrigger id="periodo-gastos" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
          <CardContent>
            {periodoGastosFinancieros === "anual" && dataGastosFinancieros.length === 0 ? (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                No hay pagos de intereses registrados
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={400}>
            <LineChart data={dataGastosFinancieros}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="periodoFormateado"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tickFormatter={(value) => `$${formatearValor(value)}`} />
              <Tooltip
                formatter={(value: number) => formatearValorCompleto(value)}
                labelStyle={{ color: '#000' }}
              />
              <Legend />
              
              {/* Renderizar líneas según el filtro seleccionado */}
              {tipoGastoFinanciero === "total" && (
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="hsl(180, 50%, 55%)" 
                  strokeWidth={3}
                  name="Total Intereses"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
                
                {tipoGastoFinanciero === "simple" && (
                  <Line 
                    type="monotone" 
                    dataKey="simple" 
                    stroke="hsl(180, 50%, 55%)" 
                    strokeWidth={3}
                    name="Créditos Simples"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                )}
                
                {tipoGastoFinanciero === "revolvente" && (
                  <Line 
                    type="monotone" 
                    dataKey="revolvente" 
                    stroke="hsl(180, 45%, 45%)" 
                    strokeWidth={3}
                    name="Líneas Revolventes"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                )}
                
                {tipoGastoFinanciero === "tarjeta" && (
                  <Line 
                    type="monotone" 
                    dataKey="tarjeta" 
                    stroke="hsl(180, 55%, 65%)" 
                    strokeWidth={3}
                    name="Tarjetas Corporativas"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                )}
                
                {tipoGastoFinanciero === "combinada" && (
                  <>
                    <Line 
                      type="monotone" 
                      dataKey="simple" 
                      stroke="hsl(180, 50%, 55%)" 
                      strokeWidth={2}
                      name="Créditos Simples"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revolvente" 
                      stroke="hsl(180, 45%, 45%)" 
                      strokeWidth={2}
                      name="Líneas Revolventes"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="tarjeta" 
                      stroke="hsl(180, 55%, 65%)" 
                      strokeWidth={2}
                      name="Tarjetas Corporativas"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
            )}
          </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticaFinanciamientos;
