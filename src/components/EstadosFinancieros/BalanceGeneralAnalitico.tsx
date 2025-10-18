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

  // Cálculos de totales
  const activosCirculantes = saldos.caja + saldos.bancos + saldos.cuentasPorCobrar + saldos.inventario;
  const activosFijos = saldos.activosFijos;
  const totalActivos = activosCirculantes + activosFijos;
  
  const pasivosCirculantes = saldos.proveedores;
  const pasivosLargoPlazo = saldos.financiamientos;
  const totalPasivos = pasivosCirculantes + pasivosLargoPlazo;
  
  const capital = totalActivos - totalPasivos;

  // 1. Estructura del Balance (Activos, Pasivos, Capital)
  const estructuraBalanceData = [
    { name: "Activos", value: totalActivos, color: "hsl(var(--chart-1))" },
    { name: "Pasivos", value: totalPasivos, color: "hsl(var(--chart-5))" },
    { name: "Capital", value: Math.abs(capital), color: "hsl(var(--chart-2))" },
  ].filter(item => item.value > 0);

  // 2. Estructura de Activos por tipo
  const estructuraActivosData = [
    { name: "Activos Circulantes", value: activosCirculantes, color: "hsl(var(--chart-1))" },
    { name: "Activos Fijos", value: activosFijos, color: "hsl(var(--chart-3))" },
  ].filter(item => item.value > 0);

  // 3. Desglose de Activos Circulantes
  const activosCirculantesData = [
    { name: "Caja", size: saldos.caja, color: "hsl(var(--chart-1))" },
    { name: "Bancos", size: saldos.bancos, color: "hsl(var(--chart-2))" },
    { name: "Cuentas por Cobrar", size: saldos.cuentasPorCobrar, color: "hsl(var(--chart-3))" },
    { name: "Inventario", size: saldos.inventario, color: "hsl(var(--chart-4))" },
  ].filter(item => item.size > 0);

  // 4. Estructura de Pasivos por tipo
  const estructuraPasivosData = [
    { name: "Pasivos Circulantes", value: pasivosCirculantes, color: "hsl(var(--chart-5))" },
    { name: "Pasivos Largo Plazo", value: pasivosLargoPlazo, color: "hsl(var(--chart-4))" },
  ].filter(item => item.value > 0);

  // 5. Desglose de Pasivos Circulantes
  const pasivosCirculantesData = [
    { name: "Proveedores", size: saldos.proveedores, color: "hsl(var(--chart-5))" },
  ].filter(item => item.size > 0);

  // 6. Capital Contable
  const capitalData = [
    { name: "Capital Contable", value: capital, color: "hsl(var(--chart-2))" },
  ].filter(item => item.value !== 0);


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
              fill="#000000"
              fontSize={14}
              fontWeight="bold"
            >
              {name}
            </text>
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              fill="#000000"
              fontSize={12}
            >
              {formatCurrency(size)}
            </text>
          </>
        )}
      </g>
    );
  };

  const CustomDonutTooltip = ({ active, payload, data }: any) => {
    if (active && payload && payload.length) {
      const total = data.reduce((sum: number, item: any) => sum + item.value, 0);
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
      {/* 1. Estructura del Balance */}
      <Card>
        <CardHeader>
          <CardTitle>1. Estructura del Balance General</CardTitle>
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
              <Tooltip content={(props) => <CustomDonutTooltip {...props} data={estructuraBalanceData} />} />
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

      {/* 2. Estructura de Activos */}
      <Card>
        <CardHeader>
          <CardTitle>2. Estructura de Activos por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={estructuraActivosData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={100}
                innerRadius={60}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={3}
              >
                {estructuraActivosData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={(props) => <CustomDonutTooltip {...props} data={estructuraActivosData} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {estructuraActivosData.map((item, index) => (
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

      {/* 3. Desglose de Activos Circulantes */}
      <Card>
        <CardHeader>
          <CardTitle>3. Composición de Activos Circulantes</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <Treemap
              data={activosCirculantesData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="hsl(var(--background))"
              fill="hsl(var(--chart-1))"
              content={<CustomTreemapContent />}
            />
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {activosCirculantesData.map((item, index) => (
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

      {/* 4. Estructura de Pasivos */}
      <Card>
        <CardHeader>
          <CardTitle>4. Estructura de Pasivos por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={estructuraPasivosData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={100}
                innerRadius={60}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={3}
              >
                {estructuraPasivosData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={(props) => <CustomDonutTooltip {...props} data={estructuraPasivosData} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {estructuraPasivosData.map((item, index) => (
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

      {/* 5. Desglose de Pasivos Circulantes */}
      <Card>
        <CardHeader>
          <CardTitle>5. Composición de Pasivos Circulantes</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <Treemap
              data={pasivosCirculantesData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="hsl(var(--background))"
              fill="hsl(var(--chart-5))"
              content={<CustomTreemapContent />}
            />
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {pasivosCirculantesData.map((item, index) => (
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

      {/* 6. Estructura de Capital */}
      <Card>
        <CardHeader>
          <CardTitle>6. Capital Contable</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-8">
            <div className="text-6xl font-bold mb-4" style={{ color: "hsl(var(--chart-2))" }}>
              {formatCurrency(capital)}
            </div>
            <p className="text-muted-foreground text-center">
              El capital contable representa la diferencia entre activos y pasivos
            </p>
            <div className="mt-6 grid grid-cols-2 gap-6 w-full max-w-md">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Activos</p>
                <p className="text-xl font-semibold text-foreground">{formatCurrency(totalActivos)}</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Pasivos</p>
                <p className="text-xl font-semibold text-foreground">{formatCurrency(totalPasivos)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen Ejecutivo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Ejecutivo</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default BalanceGeneralAnalitico;
