import MetricCard from "@/components/Dashboard/MetricCard";
import ProgressCard from "@/components/Dashboard/ProgressCard";
import IncomeChart from "@/components/Dashboard/IncomeChart";

const Index = () => {
  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Resumen de tu actividad financiera</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Resumen Mensual"
            value="$15,000"
            change="+5% del mes anterior"
            changeType="positive"
          />
          <MetricCard
            title="Resumen Anual"
            value="$120,000"
            change="+15% del año anterior"
            changeType="positive"
          />
          <ProgressCard
            title="Meta Financiera"
            current={120000}
            target={160000}
            percentage={75}
          />
          <MetricCard
            title="Balance Actual"
            value="$45,250"
            change="Actualizado hoy"
            changeType="neutral"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <IncomeChart />
          <div className="space-y-6">
            <MetricCard
              title="Gastos del Mes"
              value="$8,500"
              change="-3% vs mes anterior"
              changeType="positive"
            />
            <MetricCard
              title="Facturas Pendientes"
              value="$2,300"
              change="5 facturas"
              changeType="warning"
            />
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
