import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList, Treemap } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const AnalyticaFinanciamientos = () => {
  const { financiamientos, isLoading } = useFinanciamientos();
  const [periodoAmortizacion, setPeriodoAmortizacion] = useState<"mensual" | "anual">("mensual");
  const [formatoVisualizacion, setFormatoVisualizacion] = useState<"normal" | "miles" | "millones">("normal");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const financiamientosActivos = financiamientos.filter(f => f.estado === "activo");
  
  // Separar tarjetas corporativas de financiamientos tradicionales
  const tarjetasCorporativas = financiamientosActivos.filter(f => f.tipo_credito === "tarjeta_corporativa");
  const financiamientosTradicionales = financiamientosActivos.filter(f => f.tipo_credito !== "tarjeta_corporativa");
  
  // Para tarjetas: solo el saldo actual cuenta como deuda (lo utilizado)
  const deudaTarjetas = tarjetasCorporativas.reduce((sum, f) => sum + f.saldo_actual, 0);
  
  // Para financiamientos tradicionales: usar saldo_inicial como monto original
  const totalOriginalTradicional = financiamientosTradicionales.reduce((sum, f) => sum + f.saldo_inicial, 0);
  const deudaTradicional = financiamientosTradicionales.reduce((sum, f) => sum + f.saldo_actual, 0);
  const totalPagadoTradicional = totalOriginalTradicional - deudaTradicional;
  
  // Totales combinados
  const totalDeuda = deudaTradicional + deudaTarjetas;
  const totalOriginal = totalOriginalTradicional; // Tarjetas no cuentan como "monto original"
  const totalPagado = totalPagadoTradicional; // Solo financiamientos tradicionales tienen pagos
  
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

  const dataComparacion = [
    { name: "Monto Original", valor: totalOriginal, color: "#3b82f6" },
    { name: "Monto Pagado", valor: totalPagado, color: "#10b981" },
    { name: "Saldo Pendiente", valor: totalDeuda, color: "#ef4444" },
  ];

  // Función para formatear valores según el formato seleccionado
  const formatearValor = (valor: number): string => {
    if (formatoVisualizacion === "miles") {
      return `${(valor / 1000).toFixed(1)}K`;
    } else if (formatoVisualizacion === "millones") {
      return `${(valor / 1000000).toFixed(1)}M`;
    } else {
      // Formato normal con comas
      return valor.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
  };

  const formatearValorCompleto = (valor: number): string => {
    return `$${valor.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  };

  // Componente personalizado para el contenido del Treemap
  const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, name, value, percentage, color } = props;
    
    if (width < 80 || height < 80) return null;
    
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
    // Solo incluir financiamientos con saldo real > 0
    const financiamientosConDeuda = financiamientosActivos.filter(f => f.saldo_actual > 0);
    
    const periodos = periodoAmortizacion === "mensual" ? 12 : 10;
    const data: any[] = [];
    const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const hoy = new Date();

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
      const fechaInicio = new Date(credito.fecha_inicio);
      const fechaVencimiento = new Date(credito.fecha_vencimiento);
      const mesesTranscurridos = Math.max(0, (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 + (hoy.getMonth() - fechaInicio.getMonth()));
      const totalMeses = credito.plazo_meses;
      const mesesRestantes = Math.max(0, totalMeses - mesesTranscurridos);

      if (credito.tipo_credito === "simple" || credito.tipo_credito === "arrendamiento") {
        // Amortizaciones iguales
        const amortizacionMensual = mesesRestantes > 0 ? credito.saldo_actual / mesesRestantes : 0;
        
        if (periodoAmortizacion === "mensual") {
          const mesesAMostrar = Math.min(12, mesesRestantes);
          for (let i = 0; i < mesesAMostrar; i++) {
            data[i][credito.nombre] += amortizacionMensual;
          }
        } else {
          const anosRestantes = Math.ceil(mesesRestantes / 12);
          const anosAMostrar = Math.min(10, anosRestantes);
          
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
        
        if (periodoAmortizacion === "mensual" && mesesHastaVencimiento < 12) {
          data[mesesHastaVencimiento][credito.nombre] += credito.saldo_actual;
        } else if (periodoAmortizacion === "anual") {
          const anosHastaVencimiento = Math.floor(mesesHastaVencimiento / 12);
          if (anosHastaVencimiento < 10) {
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

  const dataAmortizacionesFuturas = calcularAmortizacionesFuturas();
  // Solo mostrar créditos con deuda real
  const nombresCreditos = financiamientosActivos
    .filter(f => f.saldo_actual > 0)
    .map(f => f.nombre);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Deuda por Tipo de Crédito</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="formato-treemap" className="text-xs">Formato:</Label>
                <Select value={formatoVisualizacion} onValueChange={(value: "normal" | "miles" | "millones") => setFormatoVisualizacion(value)}>
                  <SelectTrigger id="formato-treemap" className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="miles">Miles</SelectItem>
                    <SelectItem value="millones">Millones</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
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
            <CardTitle>Flujo del Financiamiento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={dataComparacion}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip 
                  formatter={(value: number) => `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                />
                <Bar dataKey="valor" name="Monto">
                  {dataComparacion.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
                  <span className="text-sm">Monto Original:</span>
                </div>
                <span className="text-sm font-semibold">
                  ${totalOriginal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#10b981" }} />
                  <span className="text-sm">Monto Pagado:</span>
                </div>
                <span className="text-sm font-semibold text-green-600">
                  ${totalPagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ef4444" }} />
                  <span className="text-sm">Saldo Pendiente:</span>
                </div>
                <span className="text-sm font-semibold text-red-600">
                  ${totalDeuda.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Amortizaciones Futuras por Crédito</CardTitle>
              <CardDescription>
                Proyección de pagos pendientes {periodoAmortizacion === "mensual" ? "en los próximos 12 meses" : "en los próximos 10 años"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
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
              <div className="flex items-center gap-2">
                <Label htmlFor="formato-visualizacion">Formato:</Label>
                <Select value={formatoVisualizacion} onValueChange={(value: "normal" | "miles" | "millones") => setFormatoVisualizacion(value)}>
                  <SelectTrigger id="formato-visualizacion" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="miles">Miles (K)</SelectItem>
                    <SelectItem value="millones">Millones (M)</SelectItem>
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
              <YAxis />
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
    </div>
  );
};

export default AnalyticaFinanciamientos;
