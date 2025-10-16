import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RegistroFinanciamientoForm from "@/components/Financiamientos/RegistroFinanciamientoForm";
import RegistroAmortizacionForm from "@/components/Financiamientos/RegistroAmortizacionForm";
import RegistroCargoInteresForm from "@/components/Financiamientos/RegistroCargoInteresForm";
import ResumenFinanciamientos from "@/components/Financiamientos/ResumenFinanciamientos";
import AnalyticaFinanciamientos from "@/components/Financiamientos/AnalyticaFinanciamientos";

const RegistroFinanciamientos = () => {
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Registro de Financiamientos</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona préstamos, créditos y otras formas de financiamiento
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="registro" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="registro">Registro</TabsTrigger>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="analitica">Analítica</TabsTrigger>
          </TabsList>

          <TabsContent value="registro" className="space-y-6">
            <RegistroFinanciamientoForm />
            <div className="grid grid-cols-2 gap-6">
              <RegistroAmortizacionForm />
              <RegistroCargoInteresForm />
            </div>
          </TabsContent>

          <TabsContent value="resumen">
            <ResumenFinanciamientos />
          </TabsContent>

          <TabsContent value="analitica">
            <AnalyticaFinanciamientos />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegistroFinanciamientos;
