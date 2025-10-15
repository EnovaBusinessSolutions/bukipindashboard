import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInversiones } from "@/hooks/useInversiones";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

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
          <CardTitle>Inversión y Depreciación por Categoría</CardTitle>
          <CardDescription>Monto total invertido vs depreciación acumulada por tipo de activo</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={dataPorCategoria}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
              />
              <Legend />
              <Bar dataKey="montoTotal" fill="#0088FE" name="Monto Total Invertido" />
              <Bar dataKey="depreciacionAcumulada" fill="#FF8042" name="Depreciación Acumulada" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticaInversiones;
