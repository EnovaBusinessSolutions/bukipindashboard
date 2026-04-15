import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useDepreciacionesAtrasadas } from "@/hooks/useDepreciacionesAtrasadas";
import RegistroInversionForm from "@/components/Inversiones/RegistroInversionForm";
import ResumenInversiones from "@/components/Inversiones/ResumenInversiones";
import ResumenDepreciaciones from "@/components/Inversiones/ResumenDepreciaciones";
import BajaActivos from "@/components/Inversiones/BajaActivos";
import AnalyticaInversiones from "@/components/Inversiones/AnalyticaInversiones";

const RegistroInversiones = () => {
  const { tieneAtrasadas, totalAtrasadas } = useDepreciacionesAtrasadas();

  return (
    <div className="h-full min-h-0 overflow-hidden flex flex-col">
      <div className="shrink-0 border-b bg-background p-6">
        <h1 className="text-3xl font-bold text-foreground">Registro de Inversiones CAPEX</h1>
        <p className="mt-2 text-muted-foreground">
          Gestiona inversiones de capital, depreciación de activos y análisis financiero
        </p>

        {tieneAtrasadas && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Depreciaciones Atrasadas:</strong> {totalAtrasadas} período(s) sin registrar.
              Ve a la pestaña <strong>"Depreciaciones"</strong> para generarlas manualmente.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden p-6">
        <Tabs defaultValue="registro" className="flex h-full min-h-0 flex-col">
          <TabsList className="grid w-full shrink-0 grid-cols-5">
            <TabsTrigger value="registro">Registro</TabsTrigger>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="depreciaciones">Depreciaciones</TabsTrigger>
            <TabsTrigger value="baja">Baja</TabsTrigger>
            <TabsTrigger value="analitica">Analítica</TabsTrigger>
          </TabsList>

          <TabsContent value="registro" className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
            <RegistroInversionForm />
          </TabsContent>

          <TabsContent value="resumen" className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
            <ResumenInversiones />
          </TabsContent>

          <TabsContent value="depreciaciones" className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
            <ResumenDepreciaciones />
          </TabsContent>

          <TabsContent value="baja" className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
            <BajaActivos />
          </TabsContent>

          <TabsContent value="analitica" className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
            <AnalyticaInversiones />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegistroInversiones;