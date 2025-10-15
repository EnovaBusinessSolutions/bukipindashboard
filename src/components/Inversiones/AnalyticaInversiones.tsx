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
  const totalPagado = inversiones.reduce((acc, inv) => acc + Number(inv.monto_pagado), 0);
  const totalPendiente = inversiones.reduce((acc, inv) => acc + Number(inv.monto_pendiente), 0);

  // Data para TreeMap de inversiones por categoría
  const treeMapInversionData = dataPorCategoria.map((item: any) => ({
    name: item.name,
    size: item.montoTotal,
    value: item.montoTotal,
  }));

  // Data para TreeMap de depreciaciones acumuladas por categoría
  const treeMapDepreciacionData = dataPorCategoria.map((item: any) => ({
    name: item.name,
    size: item.depreciacionAcumulada,
    value: item.depreciacionAcumulada,
  }));

  // Data para TreeMap de activo fijo neto (inversión - depreciación)
  const treeMapActivoNetoData = dataPorCategoria.map((item: any) => ({
    name: item.name,
    size: item.montoTotal - item.depreciacionAcumulada,
    value: item.montoTotal - item.depreciacionAcumulada,
  }));

  // Custom content para el Treemap
  const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, index, name, value } = props;
    
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: COLORS[index % COLORS.length],
            stroke: "#fff",
            strokeWidth: 2,
          }}
        />
        {width > 80 && height > 40 && (
          <>
            <text
              x={x + width / 2}
              y={y + height / 2 - 10}
              textAnchor="middle"
              fill="#fff"
              fontSize={14}
              fontWeight="bold"
            >
              {name}
            </text>
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              fill="#fff"
              fontSize={12}
            >
              ${value.toLocaleString("es-MX")}
            </text>
          </>
        )}
      </g>
    );
  };

  // Calcular depreciaciones futuras
  const calcularDepreciacionesFuturas = () => {
    const periodos = periodoDepreciacion === "mensual" ? 12 : 20;
    const data: any[] = [];

    // Crear estructura de periodos
    for (let i = 0; i < periodos; i++) {
      const periodo: any = {
        periodo: periodoDepreciacion === "mensual" 
          ? `Mes ${i + 1}`
          : `Año ${i + 1}`,
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
        
        for (let i = 0; i < anosAMostrar; i++) {
          // Si es el último año, puede ser parcial
          if (i === anosRestantes - 1) {
            const mesesEnUltimoAno = mesesRestantes % 12 || 12;
            data[i][categoria] += (inv.valor_depreciacion_mensual || 0) * mesesEnUltimoAno;
          } else {
            data[i][categoria] += inv.valor_depreciacion_anual || 0;
          }
        }
      }
    });

    return data;
  };

  const dataDepreciacionesFuturas = calcularDepreciacionesFuturas();
  const categorias = dataPorCategoria.map((cat: any) => cat.name);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Invertido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalInvertido.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalPagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Depreciación Anual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${depreciacionAnualTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
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
            <ResponsiveContainer width="100%" height={400}>
              <Treemap
                data={treeMapInversionData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
                content={<CustomTreemapContent />}
              />
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Depreciaciones por Categoría</CardTitle>
            <CardDescription>Depreciación acumulada por tipo de activo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <Treemap
                data={treeMapDepreciacionData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
                content={<CustomTreemapContent />}
              />
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activo Fijo Neto</CardTitle>
            <CardDescription>Valor en libros por categoría</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <Treemap
                data={treeMapActivoNetoData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
                content={<CustomTreemapContent />}
              />
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Depreciaciones Futuras por Categoría</CardTitle>
              <CardDescription>
                Proyección de depreciaciones pendientes {periodoDepreciacion === "mensual" ? "en los próximos 12 meses" : "en los próximos 20 años"}
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
            <BarChart data={dataDepreciacionesFuturas}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
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
                    fontSize={11}
                    fontWeight="bold"
                    formatter={(value: number) => value > 1000 ? `$${(value / 1000).toFixed(0)}k` : value > 0 ? `$${value.toFixed(0)}` : ''}
                  />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticaInversiones;
