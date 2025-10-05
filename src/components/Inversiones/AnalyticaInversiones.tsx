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

  // Análisis por categoría
  const inversionPorCategoria = inversiones.reduce((acc: any, inv) => {
    const categoria = getCategoriaLabel(inv.categoria_activo);
    if (!acc[categoria]) {
      acc[categoria] = {
        name: categoria,
        valor: 0,
        cantidad: 0,
      };
    }
    acc[categoria].valor += Number(inv.valor_total);
    acc[categoria].cantidad += 1;
    return acc;
  }, {});

  const dataPorCategoria = Object.values(inversionPorCategoria);

  // Análisis por estado de pago
  const inversionPorEstadoPago = inversiones.reduce((acc: any, inv) => {
    const estado = inv.tipo_pago;
    if (!acc[estado]) {
      acc[estado] = {
        name: estado === "total" ? "Pagado" : estado === "parcial" ? "Parcial" : "Crédito",
        valor: 0,
        cantidad: 0,
      };
    }
    acc[estado].valor += Number(inv.valor_total);
    acc[estado].cantidad += 1;
    return acc;
  }, {});

  const dataPorEstadoPago = Object.values(inversionPorEstadoPago);

  // Top 5 inversiones
  const topInversiones = [...inversiones]
    .sort((a, b) => Number(b.valor_total) - Number(a.valor_total))
    .slice(0, 5)
    .map((inv) => ({
      name: inv.producto_nombre,
      valor: Number(inv.valor_total),
    }));

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Inversión por Categoría</CardTitle>
            <CardDescription>Distribución del capital por tipo de activo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dataPorCategoria}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: $${entry.valor.toLocaleString("es-MX")}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="valor"
                >
                  {dataPorCategoria.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de Pago</CardTitle>
            <CardDescription>Distribución por forma de pago</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dataPorEstadoPago}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: $${entry.valor.toLocaleString("es-MX")}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="valor"
                >
                  {dataPorEstadoPago.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top 5 Inversiones</CardTitle>
          <CardDescription>Activos con mayor valor</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topInversiones}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="valor" fill="#8884d8" name="Valor Total ($)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticaInversiones;
