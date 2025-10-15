import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
            <div className="text-center text-muted-foreground py-12">
              Formulario de registro de financiamientos
            </div>
          </TabsContent>

          <TabsContent value="resumen">
            <div className="text-center text-muted-foreground py-12">
              Resumen de financiamientos
            </div>
          </TabsContent>

          <TabsContent value="analitica">
            <div className="text-center text-muted-foreground py-12">
              Analítica de financiamientos
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegistroFinanciamientos;
