import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInversiones } from "@/hooks/useInversiones";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Treemap, Sankey, Rectangle } from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"];

const AnalyticaInversiones = () => {
  const { inversiones, isLoading } = useInversiones();

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

  // Data para Sankey - Flujo de inversiones y depreciación
  const sankeyNodes: any[] = [];
  const sankeyLinks: any[] = [];
  
  // Nodo inicial: Inversión Total
  sankeyNodes.push({ name: "Inversión Total" });
  
  // Nodos para categorías
  dataPorCategoria.forEach((cat: any) => {
    sankeyNodes.push({ name: cat.name });
  });
  
  // Nodos finales: Depreciado y Valor en Libros
  sankeyNodes.push({ name: "Depreciación Acumulada" });
  sankeyNodes.push({ name: "Valor en Libros" });
  
  // Links de Inversión Total a cada categoría
  dataPorCategoria.forEach((cat: any, index: number) => {
    sankeyLinks.push({
      source: 0, // Inversión Total
      target: index + 1, // Categoría
      value: cat.montoTotal,
    });
  });
  
  // Links de cada categoría a Depreciación y Valor en Libros
  const depreciacionNodeIndex = dataPorCategoria.length + 1;
  const valorLibrosNodeIndex = dataPorCategoria.length + 2;
  
  dataPorCategoria.forEach((cat: any, index: number) => {
    // Link a depreciación
    if (cat.depreciacionAcumulada > 0) {
      sankeyLinks.push({
        source: index + 1, // Categoría
        target: depreciacionNodeIndex, // Depreciación Acumulada
        value: cat.depreciacionAcumulada,
      });
    }
    
    // Link a valor en libros
    const valorLibros = cat.montoTotal - cat.depreciacionAcumulada;
    if (valorLibros > 0) {
      sankeyLinks.push({
        source: index + 1, // Categoría
        target: valorLibrosNodeIndex, // Valor en Libros
        value: valorLibros,
      });
    }
  });

  const sankeyData = {
    nodes: sankeyNodes,
    links: sankeyLinks,
  };

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

      <Card>
        <CardHeader>
          <CardTitle>Flujo de Inversiones y Depreciación</CardTitle>
          <CardDescription>Diagrama Sankey mostrando el flujo desde la inversión total hasta la depreciación y valor en libros por categoría</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={500}>
            <Sankey
              data={sankeyData}
              node={{ fill: "#0088FE", fillOpacity: 1 }}
              link={{ stroke: "#77c2ff", fillOpacity: 0.5 }}
              nodePadding={50}
              margin={{ top: 20, right: 160, bottom: 20, left: 20 }}
            >
              <Tooltip 
                content={({ payload }: any) => {
                  if (!payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">{data.source?.name || data.target?.name || data.name}</p>
                      {data.value && (
                        <p className="text-sm text-muted-foreground">
                          ${data.value.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
            </Sankey>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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
    </div>
  );
};

export default AnalyticaInversiones;
