// bukipin-dashboard/src/pages/registros/RegistroIngresos.page.tsx
import React, { Suspense } from "react";
import { Loader2, RefreshCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Fix típico: "Loading chunk failed" en producción
 * (cache viejo / deploy / usuario con tab abierto).
 */
function isChunkLoadError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /Loading chunk [\d]+ failed|ChunkLoadError|import\(\) failed/i.test(msg);
}

class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: unknown }
> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    // Aquí podrías mandar logs a Sentry/LogRocket si tienes
    console.error("RegistroIngresos.page error:", error);
  }

  handleRetry = () => {
    // Si fue error de chunk, lo más robusto es recargar
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    // Si no, solo re-render
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[70vh] items-center justify-center px-6">
          <div className="max-w-md w-full rounded-lg border bg-background p-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h2 className="text-base font-semibold">No se pudo cargar el módulo</h2>
            </div>

            <p className="text-sm text-muted-foreground">
              Ocurrió un error al cargar <b>Registro de Ingresos</b>.{" "}
              {isChunkLoadError(this.state.error)
                ? "Esto suele pasar después de un deploy. Recarga la página."
                : "Reintenta y revisa la consola para ver el detalle."}
            </p>

            <div className="mt-4 flex gap-2">
              <Button onClick={this.handleRetry} variant="default">
                <RefreshCcw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
              <Button
                variant="outline"
                onClick={() => console.error("Detalle error:", this.state.error)}
              >
                Ver detalle (consola)
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Lazy load del módulo pesado
const RegistroIngresos = React.lazy(() => import("./RegistroIngresos"));

export default function RegistroIngresosPage() {
  return (
    <PageErrorBoundary>
      <Suspense
        fallback={
          <div className="flex min-h-[70vh] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando módulo de Registro de Ingresos…
            </div>
          </div>
        }
      >
        <RegistroIngresos />
      </Suspense>
    </PageErrorBoundary>
  );
}
