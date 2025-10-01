import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, BarChart3, Package, FileText, ShoppingCart } from "lucide-react";
import RegistroEgresosMain from "@/components/Egresos/RegistroEgresosMain";
import AnalyticaEgresos from "@/components/Egresos/AnalyticaEgresos";
import CatalogoProductos from "@/components/Egresos/CatalogoProductos";
import ResumenEgresos from "@/components/Egresos/ResumenEgresos";

const RegistroEgresos = () => {
  return (
    <div className="w-full">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Gestión de Egresos</h1>
        <p className="text-muted-foreground mt-2">
          Registra gastos, costos y otros egresos con seguimiento completo de pagos y proveedores
        </p>
      </div>

      <div className="p-6">
        <Tabs defaultValue="registro" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="registro" className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Registro de Egresos
            </TabsTrigger>
            <TabsTrigger value="resumen" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Resumen de Egresos
            </TabsTrigger>
            <TabsTrigger value="reportes" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analítica de Egresos
            </TabsTrigger>
            <TabsTrigger value="catalogo" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Catálogo de Costos y Gastos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="registro" className="w-full">
            <RegistroEgresosMain />
          </TabsContent>

          <TabsContent value="resumen" className="w-full">
            <ResumenEgresos />
          </TabsContent>

          <TabsContent value="reportes" className="w-full">
            <AnalyticaEgresos />
          </TabsContent>

          <TabsContent value="catalogo" className="w-full">
            <CatalogoProductos />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegistroEgresos;