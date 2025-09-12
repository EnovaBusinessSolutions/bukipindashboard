import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ClipboardList, BarChart3 } from "lucide-react";
import RegistroProductos from "@/components/Inventario/RegistroProductos";
import ControlInventario from "@/components/Inventario/ControlInventario";
import AnalyticaInventario from "@/components/Inventario/AnalyticaInventario";

const Inventario = () => {
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Gestión de Inventario</h1>
        <p className="text-muted-foreground mt-2">
          Registra productos y controla el inventario de tu negocio
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="registro" className="h-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="registro" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Registro de Productos
            </TabsTrigger>
            <TabsTrigger value="control" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Control de Inventario
            </TabsTrigger>
            <TabsTrigger value="analitica" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analítica
            </TabsTrigger>
          </TabsList>

          <TabsContent value="registro" className="h-full">
            <RegistroProductos />
          </TabsContent>

          <TabsContent value="control" className="h-full">
            <ControlInventario />
          </TabsContent>

          <TabsContent value="analitica" className="h-full">
            <AnalyticaInventario />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Inventario;