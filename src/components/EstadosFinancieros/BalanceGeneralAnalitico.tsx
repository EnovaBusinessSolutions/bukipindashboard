import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBalanceGeneral } from "@/hooks/useBalanceGeneral";
import { Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface BalanceGeneralAnaliticoProps {
  cutoffDate: Date;
}

const BalanceGeneralAnalitico = ({ cutoffDate }: BalanceGeneralAnaliticoProps) => {
  const { data: saldos, isLoading } = useBalanceGeneral();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!saldos) return null;

  const totalActivos = saldos.caja + saldos.bancos + saldos.cuentasPorCobrar + saldos.inventario;
  const totalPasivos = saldos.proveedores;
  const capital = totalActivos - totalPasivos;

  // Datos para gráfica de composición de activos
  const activosData = [
    { name: "Caja", value: saldos.caja, color: "hsl(var(--chart-1))" },
    { name: "Bancos", value: saldos.bancos, color: "hsl(var(--chart-2))" },
    { name: "Cuentas por Cobrar", value: saldos.cuentasPorCobrar, color: "hsl(var(--chart-3))" },
    { name: "Inventario", value: saldos.inventario, color: "hsl(var(--chart-4))" },
  ].filter(item => item.value > 0);

  // Datos para gráfica de composición patrimonial
  const patrimonioData = [
    { name: "Activos", value: totalActivos, color: "hsl(var(--chart-1))" },
    { name: "Pasivos", value: totalPasivos, color: "hsl(var(--chart-5))" },
    { name: "Capital", value: capital, color: "hsl(var(--chart-2))" },
  ].filter(item => item.value !== 0);

  // Datos para gráfica de barras comparativa
  const comparativaData = [
    {
      name: "Balance",
      Activos: totalActivos,
      "Pasivos + Capital": totalPasivos + capital,
    },
  ];

  // Cálculo de ratios financieros
  const activoCorriente = saldos.caja + saldos.bancos + saldos.cuentasPorCobrar;
  const pasivoCorriente = saldos.proveedores;
  
  const liquidezCorriente = pasivoCorriente > 0 ? activoCorriente / pasivoCorriente : 0;
  const pruebaAcida = pasivoCorriente > 0 ? (activoCorriente - saldos.inventario) / pasivoCorriente : 0;
  const nivelEndeudamiento = totalActivos > 0 ? (totalPasivos / totalActivos) * 100 : 0;
  const autonomiaFinanciera = totalActivos > 0 ? (capital / totalActivos) * 100 : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground">{payload[0].name}</p>
          <p className="text-primary font-bold">{formatCurrency(payload[0].value)}</p>
          <p className="text-sm text-muted-foreground">
            {((payload[0].value / payload[0].payload.total) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Ratios Financieros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Liquidez Corriente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {liquidezCorriente.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {liquidezCorriente >= 1.5 ? "Saludable" : liquidezCorriente >= 1 ? "Aceptable" : "Riesgo"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Prueba Ácida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {pruebaAcida.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pruebaAcida >= 1 ? "Saludable" : "Limitada"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Endeudamiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {nivelEndeudamiento.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {nivelEndeudamiento <= 50 ? "Saludable" : "Alto"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Autonomía Financiera
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {autonomiaFinanciera.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {autonomiaFinanciera >= 50 ? "Independiente" : "Dependiente"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficas de Composición */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composición de Activos */}
        <Card>
          <CardHeader>
            <CardTitle>Composición de Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={activosData.map(item => ({
                    ...item,
                    total: totalActivos,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {activosData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {activosData.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-semibold text-foreground">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Estructura Patrimonial */}
        <Card>
          <CardHeader>
            <CardTitle>Estructura Patrimonial</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={patrimonioData.map(item => ({
                    ...item,
                    total: totalActivos,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {patrimonioData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {patrimonioData.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-semibold text-foreground">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfica Comparativa de Balance */}
      <Card>
        <CardHeader>
          <CardTitle>Balance: Activos vs Pasivos + Capital</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={comparativaData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-muted-foreground" />
              <YAxis className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Bar dataKey="Activos" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Pasivos + Capital" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Resumen Ejecutivo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Ejecutivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Total Activos</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalActivos)}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Total Pasivos</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalPasivos)}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Capital Contable</p>
              <p className={`text-2xl font-bold ${capital >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(capital)}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="font-semibold text-foreground mb-2">Análisis de Salud Financiera</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                • <span className="font-medium">Liquidez:</span>{" "}
                {liquidezCorriente >= 1.5
                  ? "La empresa tiene una posición de liquidez saludable, con capacidad para cubrir sus obligaciones de corto plazo."
                  : liquidezCorriente >= 1
                  ? "La empresa tiene liquidez aceptable, pero debe monitorear sus obligaciones de corto plazo."
                  : "La empresa enfrenta desafíos de liquidez y debe priorizar la gestión del efectivo."}
              </li>
              <li>
                • <span className="font-medium">Endeudamiento:</span>{" "}
                {nivelEndeudamiento <= 50
                  ? "El nivel de endeudamiento es saludable y permite flexibilidad financiera."
                  : "El nivel de endeudamiento es elevado, se recomienda reducir el apalancamiento."}
              </li>
              <li>
                • <span className="font-medium">Autonomía:</span>{" "}
                {autonomiaFinanciera >= 50
                  ? "La empresa tiene independencia financiera con bajo riesgo de solvencia."
                  : "La empresa depende significativamente de financiamiento externo."}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BalanceGeneralAnalitico;
