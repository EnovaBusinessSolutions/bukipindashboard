import MetricCard from "@/components/Dashboard/MetricCard";
import ProgressCard from "@/components/Dashboard/ProgressCard";
import IncomeChart from "@/components/Dashboard/IncomeChart";
import VentasAnalytics from "@/components/Dashboard/VentasAnalytics";
import { useVentasResumen } from "@/hooks/useVentasResumen";

const Index = () => {
  const { ventasResumen, loading } = useVentasResumen();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-8">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Resumen de tu actividad financiera</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Ventas del Mes"
            value={loading ? "Cargando..." : formatCurrency(ventasResumen.ventasDelMes)}
            change={loading ? "" : `Descuentos: ${formatCurrency(ventasResumen.descuentosDelMes)}`}
            changeType="neutral"
            subtitle={loading ? "" : `Neto: ${formatCurrency(ventasResumen.ingresoNetoDelMes)}`}
          />
          <MetricCard
            title="Ventas del Año"
            value={loading ? "Cargando..." : formatCurrency(ventasResumen.ventasDelAno)}
            change={loading ? "" : `Descuentos: ${formatCurrency(ventasResumen.descuentosDelAno)}`}
            changeType="neutral"
            subtitle={loading ? "" : `Neto: ${formatCurrency(ventasResumen.ingresoNetoDelAno)}`}
          />
          <MetricCard
            title="Ventas del Día"
            value={loading ? "Cargando..." : formatCurrency(ventasResumen.ventasDelDia)}
            change={loading ? "" : `Descuentos: ${formatCurrency(ventasResumen.descuentosDelDia)}`}
            changeType="neutral"
            subtitle={loading ? "" : `Neto: ${formatCurrency(ventasResumen.ingresoNetoDelDia)}`}
          />
          <MetricCard
            title="Balance Actual"
            value={loading ? "Cargando..." : formatCurrency(ventasResumen.ingresoNetoDelMes)}
            change="Ingreso neto del mes"
            changeType="positive"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <VentasAnalytics />
          <div className="space-y-6">
            <MetricCard
              title="Descuentos del Mes"
              value={loading ? "Cargando..." : formatCurrency(ventasResumen.descuentosDelMes)}
              change={`${((ventasResumen.descuentosDelMes / ventasResumen.ventasDelMes) * 100).toFixed(1)}% de las ventas`}
              changeType="warning"
            />
            <MetricCard
              title="Margen del Mes"
              value={loading ? "Cargando..." : `${((ventasResumen.ingresoNetoDelMes / ventasResumen.ventasDelMes) * 100).toFixed(1)}%`}
              change="Ingreso neto vs ventas brutas"
              changeType="positive"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
