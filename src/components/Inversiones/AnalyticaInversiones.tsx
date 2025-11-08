import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInversiones } from "@/hooks/useInversiones";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Treemap, Sankey, Rectangle, LabelList } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const COLORS = ["#10b981", "#059669", "#047857", "#065f46", "#064e3b", "#34d399", "#6ee7b7"];

const AnalyticaInversiones = () => {
  const { inversiones, isLoading } = useInversiones();
  const [periodoDepreciacion, setPeriodoDepreciacion] = useState<"mensual" | "anual">("mensual");
  const [formatoCifras, setFormatoCifras] = useState<"completo" | "miles" | "millones">("completo");

  // Función helper para formatear números según el formato seleccionado
  const formatearCifra = (valor: number, incluirSimbolo: boolean = true): string => {
    let valorFormateado: number;
    let sufijo: string = "";
    
    switch (formatoCifras) {
      case "miles":
        valorFormateado = valor / 1000;
        sufijo = "K";
        break;
      case "millones":
        valorFormateado = valor / 1000000;
        sufijo = "M";
        break;
      default:
        valorFormateado = valor;
        sufijo = "";
    }
    
    const decimales = formatoCifras === "completo" ? 2 : 2;
    const numeroFormateado = valorFormateado.toLocaleString("es-MX", { 
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales 
    });
    
    return incluirSimbolo ? `$${numeroFormateado}${sufijo}` : `${numeroFormateado}${sufijo}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const getCategoriaLabel = (categoria: string) => {
    const labels: Record<string, string> = {
      equipo_computo: "Equipo de Cómputo",
      maquinaria: "Maquinaria",
      vehiculos: "Vehículos",
      mobiliario: "Mobiliario",
      edificios: "Edificios",
      equipo_oficina: "Equipo de Oficina",
      otro: "Otro",
    };
    return labels[categoria] || categoria;
  };

  // Análisis por categoría con depreciación acumulada
  const hoy = new Date();
  const inversionPorCategoria = inversiones.reduce((acc: any, inv) => {
    const categoria = getCategoriaLabel(inv.categoria_activo);
    
    // Calcular depreciación acumulada para esta inversión
    let depreciacionAcumulada = 0;
    if (inv.fecha_inicio_depreciacion) {
      const fechaInicio = new Date(inv.fecha_inicio_depreciacion);
      const mesesTranscurridos = Math.max(0, (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 + (hoy.getMonth() - fechaInicio.getMonth()));
      depreciacionAcumulada = (inv.valor_depreciacion_mensual || 0) * mesesTranscurridos;
    }
    
    if (!acc[categoria]) {
      acc[categoria] = {
        name: categoria,
        montoTotal: 0,
        depreciacionAcumulada: 0,
        cantidad: 0,
      };
    }
    acc[categoria].montoTotal += Number(inv.valor_total);
    acc[categoria].depreciacionAcumulada += depreciacionAcumulada;
    acc[categoria].cantidad += 1;
    return acc;
  }, {});

  const dataPorCategoria = Object.values(inversionPorCategoria);

  // Depreciación anual total
  const depreciacionAnualTotal = inversiones.reduce(
    (acc, inv) => acc + Number(inv.valor_depreciacion_anual || 0),
    0
  );

  const totalInvertido = inversiones.reduce((acc, inv) => acc + Number(inv.valor_total), 0);
  const totalDepreciacionAcumulada = Number(Object.values(inversionPorCategoria).reduce(
    (acc: number, cat: any) => acc + cat.depreciacionAcumulada, 
    0
  ));
  const totalActivosNetos = totalInvertido - totalDepreciacionAcumulada;
  const numeroTotalActivos = inversiones.length;

  // Data para TreeMap de inversiones por categoría
  const treeMapInversionData = dataPorCategoria
    .filter((item: any) => item.montoTotal > 0)
    .map((item: any) => ({
      name: item.name,
      size: item.montoTotal,
      value: item.montoTotal,
    }));

  // Data para TreeMap de depreciaciones acumuladas por categoría
  const treeMapDepreciacionData = dataPorCategoria
    .filter((item: any) => item.depreciacionAcumulada > 0)
    .map((item: any) => ({
      name: item.name,
      size: item.depreciacionAcumulada,
      value: item.depreciacionAcumulada,
    }));

  // Data para TreeMap de activo fijo neto (inversión - depreciación)
  const treeMapActivoNetoData = dataPorCategoria
    .filter((item: any) => (item.montoTotal - item.depreciacionAcumulada) > 0)
    .map((item: any) => ({
      name: item.name,
      size: item.montoTotal - item.depreciacionAcumulada,
      value: item.montoTotal - item.depreciacionAcumulada,
    }));

  // Calcular totales para TreeMaps (para porcentajes)
  const totalInversionesTreemap = treeMapInversionData.reduce((acc, item) => acc + item.value, 0);
  const totalDepreciacionTreemap = treeMapDepreciacionData.reduce((acc, item) => acc + item.value, 0);
  const totalActivoNetoTreemap = treeMapActivoNetoData.reduce((acc, item) => acc + item.value, 0);

  // Función para calcular porcentaje
  const calcularPorcentaje = (valor: number, total: number) => {
    if (total === 0) return "0.0";
    return ((valor / total) * 100).toFixed(1);
  };

  // Calcular depreciaciones futuras
  const calcularDepreciacionesFuturas = () => {
    const periodos = periodoDepreciacion === "mensual" ? 12 : 20;
    const data: any[] = [];
    const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    // Crear estructura de periodos
    for (let i = 0; i < periodos; i++) {
      let nombrePeriodo: string;
      
      if (periodoDepreciacion === "mensual") {
        // Calcular el mes real
        const mesActual = hoy.getMonth();
        const anoActual = hoy.getFullYear();
        const mesIndex = (mesActual + i) % 12;
        const anoOffset = Math.floor((mesActual + i) / 12);
        nombrePeriodo = `${mesesNombres[mesIndex]} ${anoActual + anoOffset}`;
      } else {
        // Para años, considerar que el primer año puede ser parcial
        const anoActual = hoy.getFullYear();
        const mesActual = hoy.getMonth(); // 0-11
        const mesesRestantesAnoActual = 12 - mesActual; // meses que quedan en el año actual
        
        if (i === 0) {
          // Primer año: mostrar meses restantes
          nombrePeriodo = `${anoActual} (${mesesRestantesAnoActual} meses)`;
        } else {
          // Años futuros completos
          nombrePeriodo = `${anoActual + i}`;
        }
      }

      const periodo: any = {
        periodo: nombrePeriodo,
      };
      
      // Inicializar cada categoría en 0
      dataPorCategoria.forEach((cat: any) => {
        periodo[cat.name] = 0;
      });

      data.push(periodo);
    }

    // Calcular depreciaciones por inversión
    inversiones.forEach((inv) => {
      const categoria = getCategoriaLabel(inv.categoria_activo);
      const fechaInicio = inv.fecha_inicio_depreciacion ? new Date(inv.fecha_inicio_depreciacion) : new Date(inv.fecha_adquisicion);
      const mesesTranscurridos = Math.max(0, (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 + (hoy.getMonth() - fechaInicio.getMonth()));
      const totalMeses = inv.anos_depreciacion * 12;
      const mesesRestantes = Math.max(0, totalMeses - mesesTranscurridos);

      if (periodoDepreciacion === "mensual") {
        // Distribuir en los próximos 12 meses
        const mesesAMostrar = Math.min(12, mesesRestantes);
        for (let i = 0; i < mesesAMostrar; i++) {
          data[i][categoria] += inv.valor_depreciacion_mensual || 0;
        }
      } else {
        // Distribuir en los próximos años
        const anosRestantes = Math.ceil(mesesRestantes / 12);
        const anosAMostrar = Math.min(20, anosRestantes);
        
        // Calcular cuántos meses quedan en el año actual
        const mesActual = hoy.getMonth(); // 0-11 (0=enero, 11=diciembre)
        const mesesRestantesAnoActual = 12 - mesActual;
        
        for (let i = 0; i < anosAMostrar; i++) {
          if (i === 0) {
            // PRIMER AÑO: Usar solo los meses restantes del año actual
            const mesesAProcesar = Math.min(mesesRestantesAnoActual, mesesRestantes);
            data[i][categoria] += (inv.valor_depreciacion_mensual || 0) * mesesAProcesar;
          } else if (i === anosRestantes - 1) {
            // ÚLTIMO AÑO: Puede ser parcial
            const mesesEnUltimoAno = mesesRestantes % 12 || 12;
            data[i][categoria] += (inv.valor_depreciacion_mensual || 0) * mesesEnUltimoAno;
          } else {
            // AÑOS INTERMEDIOS: Completos (12 meses)
            data[i][categoria] += inv.valor_depreciacion_anual || 0;
          }
        }
      }
    });

    return data;
  };

  const dataDepreciacionesFuturas = calcularDepreciacionesFuturas();
  const categorias = dataPorCategoria.map((cat: any) => cat.name);

  // Calcular totales por periodo para la gráfica
  const calcularTotalPorPeriodo = (data: any[], categorias: string[]) => {
    return data.map(periodo => {
      const total = categorias.reduce((sum, cat) => sum + (periodo[cat] || 0), 0);
      return { ...periodo, total };
    });
  };

  const dataConTotales = calcularTotalPorPeriodo(dataDepreciacionesFuturas, categorias);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Resumen de Activos Fijos</h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="formato">Formato:</Label>
          <Select value={formatoCifras} onValueChange={(value: "completo" | "miles" | "millones") => setFormatoCifras(value)}>
            <SelectTrigger id="formato" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completo">Completo</SelectItem>
              <SelectItem value="miles">Miles (K)</SelectItem>
              <SelectItem value="millones">Millones (M)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Activos Fijos Brutos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatearCifra(totalInvertido)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Depreciación Acumulada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatearCifra(totalDepreciacionAcumulada)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Activos Netos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatearCifra(totalActivosNetos)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Valor en libros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Número de Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {numeroTotalActivos}
            </div>
            <p className="text-xs text-muted-foreground mt-1">activos registrados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Inversiones por Categoría</CardTitle>
            <CardDescription>Monto total invertido por tipo de activo</CardDescription>
          </CardHeader>
          <CardContent>
            {treeMapInversionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <Treemap
                  data={treeMapInversionData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={((props: any) => {
                    const { x, y, width, height, index, name, value } = props;
                    if (!value || typeof value !== 'number') return null;
                    return (
                      <g>
                        <rect x={x} y={y} width={width} height={height} style={{ fill: COLORS[index % COLORS.length], stroke: "#fff", strokeWidth: 2 }} />
                        {width > 80 && height > 60 && (
                          <>
                            <text x={x + width / 2} y={y + height / 2 - 18} textAnchor="middle" fill="#000" fontSize={16} fontWeight="bold">{name || 'Sin nombre'}</text>
                            <text x={x + width / 2} y={y + height / 2 + 2} textAnchor="middle" fill="#000" fontSize={14}>{formatearCifra(value)}</text>
                            <text x={x + width / 2} y={y + height / 2 + 20} textAnchor="middle" fill="#000" fontSize={13} fontWeight="normal">{`(${calcularPorcentaje(value, totalInversionesTreemap)}%)`}</text>
                          </>
                        )}
                      </g>
                    );
                  }) as any}
                />
              </ResponsiveContainer>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                No hay datos de inversiones para mostrar
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Depreciaciones por Categoría</CardTitle>
            <CardDescription>Depreciación acumulada por tipo de activo</CardDescription>
          </CardHeader>
          <CardContent>
            {treeMapDepreciacionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <Treemap
                  data={treeMapDepreciacionData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={((props: any) => {
                    const { x, y, width, height, index, name, value } = props;
                    if (!value || typeof value !== 'number') return null;
                    return (
                      <g>
                        <rect x={x} y={y} width={width} height={height} style={{ fill: COLORS[index % COLORS.length], stroke: "#fff", strokeWidth: 2 }} />
                        {width > 80 && height > 60 && (
                          <>
                            <text x={x + width / 2} y={y + height / 2 - 18} textAnchor="middle" fill="#000" fontSize={16} fontWeight="bold">{name || 'Sin nombre'}</text>
                            <text x={x + width / 2} y={y + height / 2 + 2} textAnchor="middle" fill="#000" fontSize={14}>{formatearCifra(value)}</text>
                            <text x={x + width / 2} y={y + height / 2 + 20} textAnchor="middle" fill="#000" fontSize={13} fontWeight="normal">{`(${calcularPorcentaje(value, totalDepreciacionTreemap)}%)`}</text>
                          </>
                        )}
                      </g>
                    );
                  }) as any}
                />
              </ResponsiveContainer>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                No hay datos de depreciación para mostrar
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activo Fijo Neto</CardTitle>
            <CardDescription>Valor en libros por categoría</CardDescription>
          </CardHeader>
          <CardContent>
            {treeMapActivoNetoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <Treemap
                  data={treeMapActivoNetoData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={((props: any) => {
                    const { x, y, width, height, index, name, value } = props;
                    if (!value || typeof value !== 'number') return null;
                    return (
                      <g>
                        <rect x={x} y={y} width={width} height={height} style={{ fill: COLORS[index % COLORS.length], stroke: "#fff", strokeWidth: 2 }} />
                        {width > 80 && height > 60 && (
                          <>
                            <text x={x + width / 2} y={y + height / 2 - 18} textAnchor="middle" fill="#000" fontSize={16} fontWeight="bold">{name || 'Sin nombre'}</text>
                            <text x={x + width / 2} y={y + height / 2 + 2} textAnchor="middle" fill="#000" fontSize={14}>{formatearCifra(value)}</text>
                            <text x={x + width / 2} y={y + height / 2 + 20} textAnchor="middle" fill="#000" fontSize={13} fontWeight="normal">{`(${calcularPorcentaje(value, totalActivoNetoTreemap)}%)`}</text>
                          </>
                        )}
                      </g>
                    );
                  }) as any}
                />
              </ResponsiveContainer>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                No hay datos de activo fijo neto para mostrar
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Proyección de Depreciaciones</CardTitle>
              <CardDescription>
                Distribución de depreciaciones {periodoDepreciacion === "mensual" ? "en los próximos 12 meses" : "por año"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="periodo">Vista:</Label>
              <Select value={periodoDepreciacion} onValueChange={(value: "mensual" | "anual") => setPeriodoDepreciacion(value)}>
                <SelectTrigger id="periodo" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={dataConTotales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
          <YAxis 
            tickFormatter={(value: number) => formatearCifra(value, false)}
            domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.08)]}
          />
              <Tooltip 
                formatter={(value: number) => formatearCifra(value)}
              />
              <Legend />
              {categorias.map((categoria: string, index: number) => (
                <Bar 
                  key={categoria} 
                  dataKey={categoria} 
                  stackId="a" 
                  fill={COLORS[index % COLORS.length]}
                >
            <LabelList 
              dataKey={categoria} 
              position="center" 
              fill="#fff"
              stroke="#fff"
              strokeWidth={0.5}
                    fontSize={13}
                    fontWeight="bold"
                    formatter={(value: number) => {
                      if (value <= 0) return '';
                      
                      // Aplicar el formato seleccionado consistentemente
                      let valorFormateado: number;
                      let sufijo: string = "";
                      
                      switch (formatoCifras) {
                        case "miles":
                          valorFormateado = value / 1000;
                          sufijo = "K";
                          break;
                        case "millones":
                          valorFormateado = value / 1000000;
                          sufijo = "M";
                          break;
                        default:
                          valorFormateado = value;
                          sufijo = "";
                      }
                      
                      // Para labels en la gráfica, usar formato compacto (menos decimales)
                      const decimales = formatoCifras === "completo" ? 0 : 1;
                      return `$${valorFormateado.toFixed(decimales)}${sufijo}`;
                    }}
                  />
                </Bar>
              ))}
              {/* Barra transparente para mostrar el total en la parte superior */}
              <Bar dataKey="total" stackId="a" fill="transparent">
            <LabelList 
              dataKey="total" 
              position="top"
              offset={-40}
                  fill="#000"
                  fontSize={14}
                  fontWeight="bold"
                  formatter={(value: number) => {
                    if (value <= 0) return '';
                    return formatearCifra(value);
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticaInversiones;
