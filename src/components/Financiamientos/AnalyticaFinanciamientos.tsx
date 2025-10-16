import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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
    { name: "Monto Original", valor: totalOriginal },
    { name: "Monto Pagado", valor: totalPagado },
    { name: "Saldo Actual", valor: totalDeuda },
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
            <CardTitle>Comparación de Montos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dataComparacion}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="valor"
                >
                  {dataComparacion.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle de Créditos Activos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {financiamientosActivos.map((f) => (
              <div key={f.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-lg">{f.nombre}</h4>
                    <p className="text-sm text-muted-foreground">{f.institucion_financiera}</p>
                  </div>
                  <Badge>{getTipoCreditoLabel(f.tipo_credito)}</Badge>
                </div>
                <div className="grid grid-cols-4 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Monto Original</p>
                    <p className="font-medium">${f.monto_total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo Actual</p>
                    <p className="font-medium text-red-600">${f.saldo_actual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tasa de Interés</p>
                    <p className="font-medium">{f.tasa_interes}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Plazo</p>
                    <p className="font-medium">{f.plazo_meses} meses</p>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${((f.monto_total - f.saldo_actual) / f.monto_total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {((f.monto_total - f.saldo_actual) / f.monto_total * 100).toFixed(1)}% pagado
                </p>
              </div>
            ))}
            {financiamientosActivos.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No hay créditos activos
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticaFinanciamientos;
