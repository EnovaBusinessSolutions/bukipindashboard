import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingDown, Calendar, DollarSign, Package } from "lucide-react";

const AnalyticaEgresos = () => {
  // Datos de ejemplo para las gráficas
  const gastosPorCategoria = [
    { name: "Materiales", value: 45000, color: "#8884d8" },
    { name: "Servicios", value: 25000, color: "#82ca9d" },
    { name: "Gastos Operativos", value: 15000, color: "#ffc658" },
    { name: "Gastos Administrativos", value: 12000, color: "#ff7300" },
    { name: "Otros", value: 8000, color: "#8dd1e1" }
  ];

  const gastosTemporales = [
    { mes: "Ene", gastos: 42000 },
    { mes: "Feb", gastos: 38000 },
    { mes: "Mar", gastos: 45000 },
    { mes: "Apr", gastos: 52000 },
    { mes: "May", gastos: 48000 },
    { mes: "Jun", gastos: 55000 }
  ];

  const gastosPorProveedor = [
    { proveedor: "Proveedor A", monto: 35000 },
    { proveedor: "Proveedor B", monto: 28000 },
    { proveedor: "Proveedor C", monto: 22000 },
    { proveedor: "Proveedor D", monto: 18000 },
    { proveedor: "Otros", monto: 15000 }
  ];

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Egresos</p>
                <p className="text-2xl font-bold">$105,000</p>
              </div>
              <DollarSign className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Este Mes</p>
                <p className="text-2xl font-bold">$55,000</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Promedio Mensual</p>
                <p className="text-2xl font-bold">$46,667</p>
              </div>
              <TrendingDown className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Proveedores</p>
                <p className="text-2xl font-bold">24</p>
              </div>
              <Package className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gastos por Categoría */}
        <Card>
          <CardHeader>
            <CardTitle>Gastos por Categoría</CardTitle>
            <CardDescription>Distribución de gastos por tipo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={gastosPorCategoria}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {gastosPorCategoria.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Monto']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tendencia Temporal */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Gastos</CardTitle>
            <CardDescription>Evolución mensual de egresos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={gastosTemporales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Gastos']} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="gastos" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="Gastos Mensuales"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gastos por Proveedor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Gastos por Proveedor</CardTitle>
            <CardDescription>Top proveedores por monto gastado</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={gastosPorProveedor}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="proveedor" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Monto']} />
                <Legend />
                <Bar dataKey="monto" fill="#82ca9d" name="Monto Gastado" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticaEgresos;