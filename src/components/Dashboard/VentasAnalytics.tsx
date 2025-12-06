import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useVentasResumen } from "@/hooks/useVentasResumen";
import { Loader2, TrendingUp } from "lucide-react";

const VentasAnalytics = () => {
  const { ventasResumen, loading, error } = useVentasResumen();

  if (loading) {
    return (
      <Card className="col-span-2 border-0 shadow-lg">
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="col-span-2 border-0 shadow-lg">
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
    <Card className="col-span-2 border-0 shadow-lg bg-gradient-to-br from-card to-secondary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Análisis de Ventas</CardTitle>
            <CardDescription>Ventas, descuentos e ingresos netos</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis 
              dataKey="periodo" 
              axisLine={false}
              tickLine={false}
              className="text-muted-foreground"
            />
            <YAxis 
              tickFormatter={formatCurrency} 
              axisLine={false}
              tickLine={false}
              className="text-muted-foreground"
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
              }}
            />
            <Legend />
            <Bar 
              dataKey="ventas" 
              fill="hsl(var(--primary))" 
              name="Ventas Brutas" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="descuentos" 
              fill="hsl(var(--destructive))" 
              name="Descuentos" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="ingresoNeto" 
              fill="hsl(var(--success))" 
              name="Ingreso Neto" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        
        {/* Resumen con diseño mejorado */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/10 hover:border-primary/30 transition-colors">
            <p className="font-medium text-primary text-sm mb-1">Día</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(ventasResumen.ventasDelDia)}</p>
            <p className="text-xs text-muted-foreground mt-1">Desc: {formatCurrency(ventasResumen.descuentosDelDia)}</p>
            <p className="text-sm font-semibold text-success mt-1">Neto: {formatCurrency(ventasResumen.ingresoNetoDelDia)}</p>
          </div>
          
          <div className="text-center p-4 bg-accent/10 rounded-xl border border-accent/20 hover:border-accent/40 transition-colors">
            <p className="font-medium text-accent text-sm mb-1">Mes</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(ventasResumen.ventasDelMes)}</p>
            <p className="text-xs text-muted-foreground mt-1">Desc: {formatCurrency(ventasResumen.descuentosDelMes)}</p>
            <p className="text-sm font-semibold text-success mt-1">Neto: {formatCurrency(ventasResumen.ingresoNetoDelMes)}</p>
          </div>
          
          <div className="text-center p-4 bg-success/10 rounded-xl border border-success/20 hover:border-success/40 transition-colors">
            <p className="font-medium text-success text-sm mb-1">Año</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(ventasResumen.ventasDelAno)}</p>
            <p className="text-xs text-muted-foreground mt-1">Desc: {formatCurrency(ventasResumen.descuentosDelAno)}</p>
            <p className="text-sm font-semibold text-success mt-1">Neto: {formatCurrency(ventasResumen.ingresoNetoDelAno)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VentasAnalytics;