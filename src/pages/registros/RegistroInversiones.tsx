import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RegistroInversionForm from "@/components/Inversiones/RegistroInversionForm";
import TablaRecomendaciones from "@/components/Inversiones/TablaRecomendaciones";
import ResumenInversiones from "@/components/Inversiones/ResumenInversiones";
import AnalyticaInversiones from "@/components/Inversiones/AnalyticaInversiones";

const RegistroInversiones = () => {
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Registro de Inversiones CAPEX</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona inversiones de capital, depreciación de activos y análisis financiero
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="registro" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="registro">Registro</TabsTrigger>
            <TabsTrigger value="recomendaciones">Recomendaciones</TabsTrigger>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="analitica">Analítica</TabsTrigger>
          </TabsList>

          <TabsContent value="registro" className="space-y-6">
            <RegistroInversionForm />
          </TabsContent>

          <TabsContent value="recomendaciones">
            <TablaRecomendaciones />
          </TabsContent>

          <TabsContent value="resumen">
            <ResumenInversiones />
          </TabsContent>

          <TabsContent value="analitica">
            <AnalyticaInversiones />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegistroInversiones;