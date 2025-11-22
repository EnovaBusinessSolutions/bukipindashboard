import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RegistroImpuestosForm } from "@/components/Impuestos/RegistroImpuestosForm";
import { ResumenImpuestos } from "@/components/Impuestos/ResumenImpuestos";
import { AnalyticaImpuestos } from "@/components/Impuestos/AnalyticaImpuestos";
import CatalogoAutoridadesFiscales from "@/components/Impuestos/CatalogoAutoridadesFiscales";

const RegistroImpuestos = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Impuestos</h1>
          <p className="text-muted-foreground mt-2">
            Calcula, registra y analiza el ISR basado en la utilidad antes de impuestos
          </p>
        </div>

        <Tabs defaultValue="registro" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="registro">Registro</TabsTrigger>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="analitica">Analítica</TabsTrigger>
            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          </TabsList>

          <TabsContent value="registro" className="space-y-6 mt-6">
            <RegistroImpuestosForm />
          </TabsContent>

          <TabsContent value="resumen" className="space-y-6 mt-6">
            <ResumenImpuestos />
          </TabsContent>

          <TabsContent value="analitica" className="space-y-6 mt-6">
            <AnalyticaImpuestos />
          </TabsContent>

          <TabsContent value="catalogo" className="space-y-6 mt-6">
            <CatalogoAutoridadesFiscales />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegistroImpuestos;
