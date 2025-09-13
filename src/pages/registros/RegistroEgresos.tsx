import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, BarChart3, Package } from "lucide-react";
import RegistroEgresosForm from "@/components/Egresos/RegistroEgresos";
import AnalyticaEgresos from "@/components/Egresos/AnalyticaEgresos";
import CatalogoProductos from "@/components/Egresos/CatalogoProductos";

const RegistroEgresos = () => {
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Gestión de Egresos</h1>
        <p className="text-muted-foreground mt-2">
          Registra gastos, analiza tendencias y gestiona catálogo de productos
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="registro" className="h-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="registro" className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Registro de Egresos
            </TabsTrigger>
            <TabsTrigger value="analitica" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analítica
            </TabsTrigger>
            <TabsTrigger value="catalogo" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Catálogo de Productos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="registro" className="h-full">
            <RegistroEgresosForm />
          </TabsContent>

          <TabsContent value="analitica" className="h-full">
            <AnalyticaEgresos />
          </TabsContent>

          <TabsContent value="catalogo" className="h-full">
            <CatalogoProductos />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegistroEgresos;