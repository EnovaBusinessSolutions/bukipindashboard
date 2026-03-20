import React, { Suspense, lazy, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RegistroImpuestosForm = lazy(() =>
  import("@/components/Impuestos/RegistroImpuestosForm").then((mod) => ({
    default: mod.RegistroImpuestosForm,
  }))
);

const ResumenImpuestos = lazy(() =>
  import("@/components/Impuestos/ResumenImpuestos").then((mod) => ({
    default: mod.ResumenImpuestos,
  }))
);

const AnalyticaImpuestos = lazy(() =>
  import("@/components/Impuestos/AnalyticaImpuestos").then((mod) => ({
    default: mod.AnalyticaImpuestos,
  }))
);

const CatalogoAutoridadesFiscales = lazy(() => import("@/components/Impuestos/CatalogoAutoridadesFiscales"));

const LoadingPanel = ({ label }: { label: string }) => (
  <div className="rounded-3xl border border-slate-200 bg-white/80 p-10 text-center shadow-sm">
    <p className="text-sm font-medium text-slate-700">Cargando {label}...</p>
    <p className="mt-2 text-xs text-slate-500">Espera un momento mientras se prepara la sección.</p>
  </div>
);

const ErrorPanel = ({ title, message }: { title: string; message: string }) => (
  <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
    <h3 className="text-base font-semibold text-red-700">{title}</h3>
    <p className="mt-2 text-sm text-red-600">{message}</p>
  </div>
);

class TabErrorBoundary extends React.Component<
  { children: React.ReactNode; tabName: string },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode; tabName: string }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: any) {
    return {
      hasError: true,
      errorMessage: error?.message || "Error inesperado al cargar esta sección.",
    };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error(`Error en tab ${this.props.tabName}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPanel
          title={`No se pudo cargar la pestaña "${this.props.tabName}"`}
          message={this.state.errorMessage}
        />
      );
    }

    return this.props.children;
  }
}

const RegistroImpuestos = () => {
  const [activeTab, setActiveTab] = useState("registro");

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Impuestos</h1>
          <p className="mt-2 text-muted-foreground">
            Calcula, registra y analiza el ISR basado en la utilidad antes de impuestos
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="registro">Registro</TabsTrigger>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="analitica">Analítica</TabsTrigger>
            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          </TabsList>

          <TabsContent value="registro" className="mt-6 space-y-6">
            <TabErrorBoundary tabName="Registro">
              <Suspense fallback={<LoadingPanel label="registro" />}>
                <RegistroImpuestosForm />
              </Suspense>
            </TabErrorBoundary>
          </TabsContent>

          <TabsContent value="resumen" className="mt-6 space-y-6">
            <TabErrorBoundary tabName="Resumen">
              <Suspense fallback={<LoadingPanel label="resumen" />}>
                <ResumenImpuestos />
              </Suspense>
            </TabErrorBoundary>
          </TabsContent>

          <TabsContent value="analitica" className="mt-6 space-y-6">
            <TabErrorBoundary tabName="Analítica">
              <Suspense fallback={<LoadingPanel label="analítica" />}>
                <AnalyticaImpuestos />
              </Suspense>
            </TabErrorBoundary>
          </TabsContent>

          <TabsContent value="catalogo" className="mt-6 space-y-6">
            <TabErrorBoundary tabName="Catálogo">
              <Suspense fallback={<LoadingPanel label="catálogo" />}>
                <CatalogoAutoridadesFiscales />
              </Suspense>
            </TabErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegistroImpuestos;