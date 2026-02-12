import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LabelList,
  CartesianGrid,
} from "recharts";

interface BalanceGeneralAnaliticoProps {
  cutoffDate: Date;
}

const BalanceGeneralAnalitico = ({ cutoffDate }: BalanceGeneralAnaliticoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();

  // Usar la misma lógica que los otros componentes del Balance
  const startDate = new Date(0); // Desde el inicio
  const { data: asientosData, isLoading: asientosLoading } = useAsientosBalanza(startDate, cutoffDate);
  const [selectedView, setSelectedView] = useState<"activos" | "pasivos" | "capital">("activos");

  if (cuentasLoading || asientosLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!asientosData || !cuentasData) return null;

  const cuentasFlat = cuentasData.cuentasFlat || [];
  const saldosPorCuenta = asientosData.saldosPorCuenta || {};

  // Verificar si hay datos
  const hayDatos = asientosData?.movimientos && asientosData.movimientos.length > 0;

  if (!hayDatos) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center space-y-2">
            <p className="text-xl font-medium text-muted-foreground">No hay datos financieros registrados</p>
            <p className="text-sm text-muted-foreground">
              Comienza registrando transacciones para ver el balance general
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString("es-CO", { minimumFractionDigits: 2 });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const truncateLabel = (text: string, max = 26) => {
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  };

  // Función para obtener el saldo de una cuenta desde los asientos de balanza
  const obtenerSaldo = (codigoCuenta: string): number => {
    return saldosPorCuenta[codigoCuenta]?.saldo || 0;
  };

  // Calcular TODOS los activos desde los saldos de la balanza (cuentas 1xxx)
  const codigosActivos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("1"));
  const totalActivos = codigosActivos.reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0);

  // Clasificar activos por subgrupo usando la tabla cuentas
  const activoCirculante = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Activo Circulante" && cuenta.estado_financiero === "Balance General"
  );

  const activoFijo = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Activo No Circulante" && cuenta.estado_financiero === "Balance General"
  );

  const activoDiferido = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Activo Diferido" && cuenta.estado_financiero === "Balance General"
  );

  // Calcular totales por subgrupo
  const activosCirculantes = activoCirculante.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const activosFijos = activoFijo.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const activosDiferidos = activoDiferido.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);

  // Calcular TODOS los pasivos desde los saldos de la balanza (cuentas 2xxx)
  const codigosPasivos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("2"));
  const totalPasivos = codigosPasivos.reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0);

  // Clasificar pasivos por subgrupo usando la tabla cuentas
  const pasivoCortoPlazo = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Pasivo Circulante" && cuenta.estado_financiero === "Balance General"
  );

  const pasivoLargoPlazo = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Pasivo No Circulante" && cuenta.estado_financiero === "Balance General"
  );

  // Calcular totales por subgrupo
  const pasivosCirculantes = pasivoCortoPlazo.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const pasivosLargoPlazo = pasivoLargoPlazo.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);

  // Calcular TODOS los capital contable desde los saldos de la balanza (cuentas 3xxx)
  const codigosCapital = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("3"));
  const totalCapitalContable = codigosCapital.reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0);

  // Calcular utilidad del ejercicio desde los saldos de la balanza
  const ingresosCodigos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("4"));
  const egresosCodigos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("5"));
  const impuestosCodigos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("6"));

  const ingresos = ingresosCodigos.reduce((sum, c) => sum + (saldosPorCuenta[c]?.saldo || 0), 0);
  const egresos = egresosCodigos.reduce((sum, c) => sum + (saldosPorCuenta[c]?.saldo || 0), 0);
  const impuestos = impuestosCodigos.reduce((sum, c) => sum + (saldosPorCuenta[c]?.saldo || 0), 0);

  const utilidadEjercicio = ingresos - egresos - impuestos;
  const capital = totalCapitalContable + utilidadEjercicio;

  // Colores
  const CHART_COLORS = useMemo(
    () => [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
    ],
    []
  );

  // 1. Estructura del Balance (Activos, Pasivos, Capital)
  const estructuraBalanceData = useMemo(() => {
    return [
      { name: "Activos", value: totalActivos, color: "hsl(var(--chart-1))" },
      { name: "Pasivos", value: totalPasivos, color: "hsl(var(--chart-5))" },
      { name: "Capital", value: Math.abs(capital), color: "hsl(var(--chart-2))" },
    ].filter((item) => item.value > 0.01);
  }, [totalActivos, totalPasivos, capital]);

  // 2. Estructura de Activos por tipo
  const estructuraActivosData = useMemo(() => {
    return [
      { name: "Activos Circulantes", value: activosCirculantes, color: "hsl(var(--chart-1))" },
      { name: "Activos Fijos", value: activosFijos, color: "hsl(var(--chart-3))" },
      { name: "Activos Diferidos", value: activosDiferidos, color: "hsl(var(--chart-4))" },
    ].filter((i) => Math.abs(i.value) > 0.01);
  }, [activosCirculantes, activosFijos, activosDiferidos]);

  // 3. Desglose de Activos Circulantes - DINÁMICO
  const activosCirculantesData = useMemo(() => {
    return activoCirculante
      .map((cuenta, index) => ({
        name: cuenta.nombre,
        nameShort: truncateLabel(cuenta.nombre, 28),
        size: obtenerSaldo(cuenta.codigo),
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .filter((item) => Math.abs(item.size) > 0.01)
      .sort((a, b) => Math.abs(b.size) - Math.abs(a.size));
  }, [activoCirculante, CHART_COLORS]);

  // 3B. Desglose de Activos Fijos - DINÁMICO
  const activosFijosData = useMemo(() => {
    return activoFijo
      .map((cuenta, index) => ({
        name: cuenta.nombre,
        nameShort: truncateLabel(cuenta.nombre, 28),
        size: obtenerSaldo(cuenta.codigo),
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .filter((item) => Math.abs(item.size) > 0.01)
      .sort((a, b) => Math.abs(b.size) - Math.abs(a.size));
  }, [activoFijo, CHART_COLORS]);

  // 3C. Desglose de Activos Diferidos
  const activosDiferidosData = useMemo(() => {
    return [
      { name: "Gastos Diferidos", nameShort: "Gastos Diferidos", size: activosDiferidos, color: "hsl(var(--chart-4))" },
    ].filter((item) => Math.abs(item.size) > 0.01);
  }, [activosDiferidos]);

  // 4. Estructura de Pasivos por tipo
  const estructuraPasivosData = useMemo(() => {
    return [
      { name: "Pasivos Circulantes", value: pasivosCirculantes, color: "hsl(var(--chart-5))" },
      { name: "Pasivos Largo Plazo", value: pasivosLargoPlazo, color: "hsl(var(--chart-4))" },
    ].filter((i) => Math.abs(i.value) > 0.01);
  }, [pasivosCirculantes, pasivosLargoPlazo]);

  // 5. Desglose de Pasivos Circulantes - DINÁMICO
  const pasivosCirculantesData = useMemo(() => {
    return pasivoCortoPlazo
      .map((cuenta, index) => ({
        name: cuenta.nombre,
        nameShort: truncateLabel(cuenta.nombre, 28),
        size: Math.abs(obtenerSaldo(cuenta.codigo)),
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .filter((item) => item.size > 0.01)
      .sort((a, b) => b.size - a.size);
  }, [pasivoCortoPlazo, CHART_COLORS]);

  // 5B. Desglose de Pasivos Largo Plazo - DINÁMICO
  const pasivosLargoPlazoData = useMemo(() => {
    return pasivoLargoPlazo
      .map((cuenta, index) => ({
        name: cuenta.nombre,
        nameShort: truncateLabel(cuenta.nombre, 28),
        size: Math.abs(obtenerSaldo(cuenta.codigo)),
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .filter((item) => item.size > 0.01)
      .sort((a, b) => b.size - a.size);
  }, [pasivoLargoPlazo, CHART_COLORS]);

  // 6. Capital Contable - DINÁMICO
  const capitalCuentas = useMemo(() => {
    return cuentasFlat.filter(
      (cuenta) => cuenta.codigo.startsWith("3") && cuenta.estado_financiero === "Balance General"
    );
  }, [cuentasFlat]);

  const capitalData = useMemo(() => {
    const base = capitalCuentas
      .map((cuenta, index) => ({
        name: cuenta.nombre,
        nameShort: truncateLabel(cuenta.nombre, 28),
        size: Math.abs(obtenerSaldo(cuenta.codigo)),
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .filter((item) => item.size > 0.01);

    const utilidad = {
      name: "Utilidad del Ejercicio",
      nameShort: "Utilidad del Ejercicio",
      size: Math.abs(utilidadEjercicio),
      color: CHART_COLORS[base.length % CHART_COLORS.length],
    };

    return [...base, ...(Math.abs(utilidad.size) > 0.01 ? [utilidad] : [])].sort((a, b) => b.size - a.size);
  }, [capitalCuentas, utilidadEjercicio, CHART_COLORS]);

  // Tooltips
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const row = payload[0]?.payload;
      return (
        <div className="bg-background/95 backdrop-blur border border-border p-3 rounded-xl shadow-xl">
          <p className="font-semibold text-foreground">{row?.name}</p>
          <p className="text-primary font-bold">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  const CustomDonutTooltip = ({ active, payload, data }: any) => {
    if (active && payload && payload.length) {
      const total = (data || []).reduce((sum: number, item: any) => sum + (item.value || 0), 0);
      const val = payload[0].value || 0;
      return (
        <div className="bg-background/95 backdrop-blur border border-border p-3 rounded-xl shadow-xl">
          <p className="font-semibold text-foreground">{payload[0].name}</p>
          <p className="text-primary font-bold">{formatCurrency(val)}</p>
          {total > 0 && (
            <p className="text-sm text-muted-foreground">{((val / total) * 100).toFixed(1)}%</p>
          )}
        </div>
      );
    }
    return null;
  };

  // ✅ Label fijo a la derecha de la barra (sin hover)
  const ValueLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    const safeValue = typeof value === "number" ? value : Number(value || 0);
    const label = formatCurrency(safeValue);

    // x/y son coords del rect; ponemos etiqueta al final
    const labelX = x + width + 10;
    const labelY = y + height / 2;

    return (
      <text
        x={labelX}
        y={labelY}
        dominantBaseline="middle"
        className="fill-foreground"
        style={{ fontSize: 12, fontWeight: 600 }}
      >
        {label}
      </text>
    );
  };

  const getBarHeight = (len: number) => Math.max(220, len * 56);

  return (
    <div className="space-y-6">
      {/* 1. Estructura del Balance */}
      <Card>
        <CardHeader>
          <CardTitle>1. Estructura del Balance General</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full">
            <ResponsiveContainer width="100%" height={360}>
              <PieChart>
                <Pie
                  data={estructuraBalanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={78}
                  outerRadius={120}
                  dataKey="value"
                  paddingAngle={4}
                  stroke="transparent"
                  labelLine={false}
                  // ✅ quitamos labels en la dona para evitar encimados (pro)
                >
                  {estructuraBalanceData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={(props) => <CustomDonutTooltip {...props} data={estructuraBalanceData} />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {estructuraBalanceData.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 p-4 bg-muted/40 rounded-xl border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="text-base font-bold text-foreground">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtro de Vista Detallada */}
      <Card>
        <CardHeader>
          <CardTitle>Análisis Detallado</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
              <TabsTrigger value="activos">Activos</TabsTrigger>
              <TabsTrigger value="pasivos">Pasivos</TabsTrigger>
              <TabsTrigger value="capital">Capital</TabsTrigger>
            </TabsList>

            {/* Vista de Activos */}
            <TabsContent value="activos" className="space-y-6">
              {/* Estructura de Activos por Tipo */}
              <Card>
                <CardHeader>
                  <CardTitle>Estructura de Activos por Tipo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={estructuraActivosData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        dataKey="value"
                        paddingAngle={4}
                        stroke="transparent"
                        labelLine={false}
                        // ✅ sin labels para evitar encimado
                      >
                        {estructuraActivosData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={(props) => <CustomDonutTooltip {...props} data={estructuraActivosData} />} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {estructuraActivosData.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-3 p-4 bg-muted/40 rounded-xl border border-border/50"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="text-base font-bold text-foreground">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Composición de Activos Circulantes */}
              <Card>
                <CardHeader>
                  <CardTitle>Composición de Activos Circulantes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={getBarHeight(activosCirculantesData.length)}>
                    <BarChart
                      data={activosCirculantesData}
                      layout="vertical"
                      margin={{ top: 8, right: 140, left: 12, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                      <YAxis
                        type="category"
                        dataKey="nameShort"
                        width={240}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="size" radius={[0, 8, 8, 0]}>
                        {activosCirculantesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        {/* ✅ etiqueta fija a la derecha (sin hover) */}
                        <LabelList dataKey="size" content={<ValueLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-4 space-y-2">
                    {activosCirculantesData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">{formatCurrency(item.size)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Composición de Activos Fijos */}
              <Card>
                <CardHeader>
                  <CardTitle>Composición de Activos Fijos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={getBarHeight(activosFijosData.length)}>
                    <BarChart
                      data={activosFijosData}
                      layout="vertical"
                      margin={{ top: 8, right: 140, left: 12, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                      <YAxis type="category" dataKey="nameShort" width={240} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="size" radius={[0, 8, 8, 0]}>
                        {activosFijosData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        <LabelList dataKey="size" content={<ValueLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-4 space-y-2">
                    {activosFijosData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">{formatCurrency(item.size)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Composición de Activos Diferidos */}
              <Card>
                <CardHeader>
                  <CardTitle>Composición de Activos Diferidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={getBarHeight(activosDiferidosData.length)}>
                    <BarChart
                      data={activosDiferidosData}
                      layout="vertical"
                      margin={{ top: 8, right: 140, left: 12, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                      <YAxis type="category" dataKey="nameShort" width={240} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="size" radius={[0, 8, 8, 0]}>
                        {activosDiferidosData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        <LabelList dataKey="size" content={<ValueLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-4 space-y-2">
                    {activosDiferidosData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">{formatCurrency(item.size)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Vista de Pasivos */}
            <TabsContent value="pasivos" className="space-y-6">
              {/* Estructura de Pasivos por Tipo */}
              <Card>
                <CardHeader>
                  <CardTitle>Estructura de Pasivos por Tipo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={estructuraPasivosData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        dataKey="value"
                        paddingAngle={4}
                        stroke="transparent"
                        labelLine={false}
                      >
                        {estructuraPasivosData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={(props) => <CustomDonutTooltip {...props} data={estructuraPasivosData} />} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {estructuraPasivosData.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-3 p-4 bg-muted/40 rounded-xl border border-border/50"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="text-base font-bold text-foreground">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Composición de Pasivos Circulantes */}
              <Card>
                <CardHeader>
                  <CardTitle>Composición de Pasivos Circulantes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={getBarHeight(pasivosCirculantesData.length)}>
                    <BarChart
                      data={pasivosCirculantesData}
                      layout="vertical"
                      margin={{ top: 8, right: 140, left: 12, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                      <YAxis type="category" dataKey="nameShort" width={240} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="size" radius={[0, 8, 8, 0]}>
                        {pasivosCirculantesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        <LabelList dataKey="size" content={<ValueLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-4 space-y-2">
                    {pasivosCirculantesData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">{formatCurrency(item.size)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Composición de Pasivos Largo Plazo */}
              <Card>
                <CardHeader>
                  <CardTitle>Composición de Pasivos a Largo Plazo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={getBarHeight(pasivosLargoPlazoData.length)}>
                    <BarChart
                      data={pasivosLargoPlazoData}
                      layout="vertical"
                      margin={{ top: 8, right: 140, left: 12, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                      <YAxis type="category" dataKey="nameShort" width={240} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="size" radius={[0, 8, 8, 0]}>
                        {pasivosLargoPlazoData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        <LabelList dataKey="size" content={<ValueLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-4 space-y-2">
                    {pasivosLargoPlazoData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">{formatCurrency(item.size)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Vista de Capital */}
            <TabsContent value="capital" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Capital Contable Total</CardTitle>
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
                      <div className="text-center p-4 bg-muted/30 rounded-xl border border-border/40">
                        <p className="text-sm text-muted-foreground mb-1">Total Activos</p>
                        <p className="text-xl font-semibold text-foreground">{formatCurrency(totalActivos)}</p>
                      </div>
                      <div className="text-center p-4 bg-muted/30 rounded-xl border border-border/40">
                        <p className="text-sm text-muted-foreground mb-1">Total Pasivos</p>
                        <p className="text-xl font-semibold text-foreground">{formatCurrency(totalPasivos)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Composición del Capital */}
              <Card>
                <CardHeader>
                  <CardTitle>Composición del Capital Contable</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={getBarHeight(capitalData.length)}>
                    <BarChart
                      data={capitalData}
                      layout="vertical"
                      margin={{ top: 8, right: 140, left: 12, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                      <YAxis type="category" dataKey="nameShort" width={240} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="size" radius={[0, 8, 8, 0]}>
                        {capitalData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        <LabelList dataKey="size" content={<ValueLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-4 space-y-2">
                    {capitalData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">{formatCurrency(item.size)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Resumen Ejecutivo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Ejecutivo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/40 rounded-xl border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Total Activos</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalActivos)}</p>
            </div>
            <div className="p-4 bg-muted/40 rounded-xl border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Total Pasivos</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalPasivos)}</p>
            </div>
            <div className="p-4 bg-muted/40 rounded-xl border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Capital Contable</p>
              <p className={`text-2xl font-bold ${capital >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
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
