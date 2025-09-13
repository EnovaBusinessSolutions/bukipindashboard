import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Wallet, Receipt } from "lucide-react";
import RegistroEgresosPrecargados from "./RegistroEgresosPrecargados";
import RegistroEgresosGenerales from "./RegistroEgresosGenerales";
import RegistroOtrosGastos from "./RegistroOtrosGastos";

const RegistroEgresosMain = () => {
  return (
    <div className="h-full">
      <Tabs defaultValue="precargados" className="h-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="precargados" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Costos y Gastos Precargados
          </TabsTrigger>
          <TabsTrigger value="generales" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Costos y Gastos Generales
          </TabsTrigger>
          <TabsTrigger value="otros" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Otros Gastos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="precargados" className="h-full">
          <RegistroEgresosPrecargados />
        </TabsContent>

        <TabsContent value="generales" className="h-full">
          <RegistroEgresosGenerales />
        </TabsContent>

        <TabsContent value="otros" className="h-full">
          <RegistroOtrosGastos />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RegistroEgresosMain;