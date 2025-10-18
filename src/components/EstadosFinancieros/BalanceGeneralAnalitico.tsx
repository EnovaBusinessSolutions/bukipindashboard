import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBalanceGeneral } from "@/hooks/useBalanceGeneral";
import { Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, Treemap, ResponsiveContainer, Tooltip } from "recharts";

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

  // Datos para treemap de activos
  const activosTreemapData = [
    { name: "Caja", size: saldos.caja, color: "hsl(var(--chart-1))" },
    { name: "Bancos", size: saldos.bancos, color: "hsl(var(--chart-2))" },
    { name: "Cuentas por Cobrar", size: saldos.cuentasPorCobrar, color: "hsl(var(--chart-3))" },
    { name: "Inventario", size: saldos.inventario, color: "hsl(var(--chart-4))" },
  ].filter(item => item.size > 0);

  // Datos para treemap de pasivos
  const pasivosTreemapData = [
    { name: "Proveedores", size: saldos.proveedores, color: "hsl(var(--chart-5))" },
  ].filter(item => item.size > 0);

  // Datos para treemap de capital
  const capitalTreemapData = [
    { name: "Capital Contable", size: capital, color: "hsl(var(--chart-2))" },
  ].filter(item => item.size > 0);

  // Datos para gráfica de dona - Estructura de Balance
  const estructuraBalanceData = [
    { name: "Activos", value: totalActivos, color: "hsl(var(--chart-1))" },
    { name: "Pasivos", value: totalPasivos, color: "hsl(var(--chart-5))" },
    { name: "Capital", value: Math.abs(capital), color: "hsl(var(--chart-2))" },
  ].filter(item => item.value > 0);

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

  const CustomTreemapContent = ({ x, y, width, height, name, size, color }: any) => {
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: color,
            stroke: "hsl(var(--background))",
            strokeWidth: 2,
          }}
        />
        {width > 60 && height > 40 && (
          <>
            <text
              x={x + width / 2}
              y={y + height / 2 - 10}
              textAnchor="middle"
              fill="hsl(var(--background))"
              fontSize={14}
              fontWeight="bold"
            >
              {name}
            </text>
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              fill="hsl(var(--background))"
              fontSize={12}
            >
              {formatCurrency(size)}
            </text>
          </>
        )}
      </g>
    );
  };

  const CustomDonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const total = estructuraBalanceData.reduce((sum, item) => sum + item.value, 0);
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground">{payload[0].name}</p>
          <p className="text-primary font-bold">{formatCurrency(payload[0].value)}</p>
          <p className="text-sm text-muted-foreground">
            {((payload[0].value / total) * 100).toFixed(1)}%
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

      {/* Treemaps de Composición */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Treemap de Activos */}
        <Card>
          <CardHeader>
            <CardTitle>Composición de Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <Treemap
                data={activosTreemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="hsl(var(--background))"
                fill="hsl(var(--chart-1))"
                content={<CustomTreemapContent />}
              />
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {activosTreemapData.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-semibold text-foreground">{formatCurrency(item.size)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Treemap de Pasivos */}
        <Card>
          <CardHeader>
            <CardTitle>Composición de Pasivos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <Treemap
                data={pasivosTreemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="hsl(var(--background))"
                fill="hsl(var(--chart-5))"
                content={<CustomTreemapContent />}
              />
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {pasivosTreemapData.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-semibold text-foreground">{formatCurrency(item.size)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Treemap de Capital */}
        <Card>
          <CardHeader>
            <CardTitle>Composición de Capital</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <Treemap
                data={capitalTreemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="hsl(var(--background))"
                fill="hsl(var(--chart-2))"
                content={<CustomTreemapContent />}
              />
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {capitalTreemapData.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-semibold text-foreground">{formatCurrency(item.size)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estructura de Balance - Gráfica de Dona */}
      <Card>
        <CardHeader>
          <CardTitle>Estructura de Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={estructuraBalanceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={120}
                innerRadius={70}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={5}
              >
                {estructuraBalanceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomDonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {estructuraBalanceData.map((item, index) => (
              <div key={index} className="flex flex-col items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                </div>
                <span className="text-lg font-bold text-foreground">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
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
