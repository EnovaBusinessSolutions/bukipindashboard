import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const AnalyticaFinanciamientos = () => {
  const { financiamientos, isLoading } = useFinanciamientos();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const financiamientosActivos = financiamientos.filter(f => f.estado === "activo");
  
  const totalDeuda = financiamientosActivos.reduce((sum, f) => sum + f.saldo_actual, 0);
  const totalOriginal = financiamientosActivos.reduce((sum, f) => sum + f.monto_total, 0);
  const totalPagado = totalOriginal - totalDeuda;
  
  const porTipo = financiamientosActivos.reduce((acc, f) => {
    const tipo = f.tipo_credito;
    if (!acc[tipo]) {
      acc[tipo] = { tipo, saldo: 0, count: 0 };
    }
    acc[tipo].saldo += f.saldo_actual;
    acc[tipo].count += 1;
    return acc;
  }, {} as Record<string, { tipo: string; saldo: number; count: number }>);

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

  const dataComparacion = [
    { name: "Monto Original", valor: totalOriginal, color: "#3b82f6" },
    { name: "Monto Pagado", valor: totalPagado, color: "#10b981" },
    { name: "Saldo Pendiente", valor: totalDeuda, color: "#ef4444" },
  ];

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
            <CardTitle>Deuda por Tipo de Crédito</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dataPorTipo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="tipo" 
                  tickFormatter={(value) => getTipoCreditoLabel(value)}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                  labelFormatter={(label) => getTipoCreditoLabel(label)}
                />
                <Legend />
                <Bar dataKey="saldo" fill="#10b981" name="Saldo Actual" />
              </BarChart>
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
    </div>
  );
};

export default AnalyticaFinanciamientos;
