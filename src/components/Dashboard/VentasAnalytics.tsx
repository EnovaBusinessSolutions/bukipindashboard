import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useVentasResumen } from "@/hooks/useVentasResumen";
import { Loader2 } from "lucide-react";

const VentasAnalytics = () => {
  const { ventasResumen, loading, error } = useVentasResumen();

  if (loading) {
    return (
      <Card className="col-span-2">
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="col-span-2">
        <CardContent className="flex items-center justify-center h-[400px]">
          <p className="text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const data = [
    {
      periodo: "Día",
      ventas: ventasResumen.ventasDelDia,
      descuentos: ventasResumen.descuentosDelDia,
      ingresoNeto: ventasResumen.ingresoNetoDelDia,
    },
    {
      periodo: "Mes",
      ventas: ventasResumen.ventasDelMes,
      descuentos: ventasResumen.descuentosDelMes,
      ingresoNeto: ventasResumen.ingresoNetoDelMes,
    },
    {
      periodo: "Año",
      ventas: ventasResumen.ventasDelAno,
      descuentos: ventasResumen.descuentosDelAno,
      ingresoNeto: ventasResumen.ingresoNetoDelAno,
    },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Análisis de Ventas, Descuentos e Ingresos Netos</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis dataKey="periodo" />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="ventas" fill="hsl(var(--primary))" name="Ventas Brutas" />
            <Bar dataKey="descuentos" fill="hsl(var(--destructive))" name="Descuentos" />
            <Bar dataKey="ingresoNeto" fill="hsl(var(--chart-2))" name="Ingreso Neto" />
          </BarChart>
        </ResponsiveContainer>
        
        {/* Resumen textual */}
        <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
          <div className="text-center p-3 bg-primary/5 rounded-lg">
            <p className="font-medium text-primary">Ventas del Día</p>
            <p className="text-lg font-bold">{formatCurrency(ventasResumen.ventasDelDia)}</p>
            <p className="text-xs text-muted-foreground">Descuento: {formatCurrency(ventasResumen.descuentosDelDia)}</p>
            <p className="text-sm font-semibold text-chart-2">Neto: {formatCurrency(ventasResumen.ingresoNetoDelDia)}</p>
          </div>
          
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <p className="font-medium text-primary">Ventas del Mes</p>
            <p className="text-lg font-bold">{formatCurrency(ventasResumen.ventasDelMes)}</p>
            <p className="text-xs text-muted-foreground">Descuento: {formatCurrency(ventasResumen.descuentosDelMes)}</p>
            <p className="text-sm font-semibold text-chart-2">Neto: {formatCurrency(ventasResumen.ingresoNetoDelMes)}</p>
          </div>
          
          <div className="text-center p-3 bg-primary/15 rounded-lg">
            <p className="font-medium text-primary">Ventas del Año</p>
            <p className="text-lg font-bold">{formatCurrency(ventasResumen.ventasDelAno)}</p>
            <p className="text-xs text-muted-foreground">Descuento: {formatCurrency(ventasResumen.descuentosDelAno)}</p>
            <p className="text-sm font-semibold text-chart-2">Neto: {formatCurrency(ventasResumen.ingresoNetoDelAno)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VentasAnalytics;