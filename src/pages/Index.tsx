import MetricCard from "@/components/Dashboard/MetricCard";
import VentasAnalytics from "@/components/Dashboard/VentasAnalytics";
import { useVentasResumen } from "@/hooks/useVentasResumen";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Target, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const Index = () => {
  const { ventasResumen, loading } = useVentasResumen();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const margenMes = ventasResumen.ventasDelMes > 0 
    ? ((ventasResumen.ingresoNetoDelMes / ventasResumen.ventasDelMes) * 100).toFixed(1)
    : "0";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
      <div className="p-8">
        <div className="space-y-8">
          {/* Header con gradiente */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-accent p-8 text-primary-foreground shadow-xl">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
            <div className="relative">
              <h1 className="text-4xl font-bold mb-2 tracking-tight">Dashboard Financiero</h1>
              <p className="text-primary-foreground/80 text-lg">Resumen completo de tu actividad financiera</p>
            </div>
          </div>

          {/* Metrics Grid con iconos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-card to-card/80 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 h-24 w-24 bg-primary/10 rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-muted-foreground font-medium">Ventas del Día</CardDescription>
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground mb-1">
                  {loading ? "..." : formatCurrency(ventasResumen.ventasDelDia)}
                </p>
                <p className="text-sm text-accent">
                  Neto: {loading ? "..." : formatCurrency(ventasResumen.ingresoNetoDelDia)}
                </p>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-card to-card/80 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 h-24 w-24 bg-accent/20 rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-muted-foreground font-medium">Ventas del Mes</CardDescription>
                  <div className="p-2 rounded-lg bg-accent/20">
                    <BarChart3 className="h-5 w-5 text-accent" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground mb-1">
                  {loading ? "..." : formatCurrency(ventasResumen.ventasDelMes)}
                </p>
                <p className="text-sm text-accent">
                  Neto: {loading ? "..." : formatCurrency(ventasResumen.ingresoNetoDelMes)}
                </p>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-card to-card/80 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 h-24 w-24 bg-success/15 rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-muted-foreground font-medium">Ventas del Año</CardDescription>
                  <div className="p-2 rounded-lg bg-success/15">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground mb-1">
                  {loading ? "..." : formatCurrency(ventasResumen.ventasDelAno)}
                </p>
                <p className="text-sm text-success">
                  Neto: {loading ? "..." : formatCurrency(ventasResumen.ingresoNetoDelAno)}
                </p>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/90 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 h-24 w-24 bg-white/10 rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-primary-foreground/80 font-medium">Margen del Mes</CardDescription>
                  <div className="p-2 rounded-lg bg-white/20">
                    <Target className="h-5 w-5 text-primary-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary-foreground mb-1">
                  {loading ? "..." : `${margenMes}%`}
                </p>
                <p className="text-sm text-primary-foreground/70">
                  Ingreso neto vs ventas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <VentasAnalytics />
            <div className="space-y-6">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-secondary/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-destructive/10">
                      <TrendingDown className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Descuentos del Mes</CardTitle>
                      <CardDescription>Porcentaje sobre ventas</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    {loading ? "..." : formatCurrency(ventasResumen.descuentosDelMes)}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-destructive rounded-full transition-all duration-500"
                        style={{ 
                          width: `${ventasResumen.ventasDelMes > 0 
                            ? Math.min((ventasResumen.descuentosDelMes / ventasResumen.ventasDelMes) * 100, 100) 
                            : 0}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-destructive">
                      {ventasResumen.ventasDelMes > 0 
                        ? ((ventasResumen.descuentosDelMes / ventasResumen.ventasDelMes) * 100).toFixed(1)
                        : "0"}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-secondary/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/10">
                      <DollarSign className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Balance del Mes</CardTitle>
                      <CardDescription>Ingreso neto total</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-success">
                    {loading ? "..." : formatCurrency(ventasResumen.ingresoNetoDelMes)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Después de descuentos aplicados
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;