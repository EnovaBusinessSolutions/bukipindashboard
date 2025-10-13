import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EstadoResultadosOperativo from "@/components/EstadosFinancieros/EstadoResultadosOperativo";
import EstadoResultadosEjecutivo from "@/components/EstadosFinancieros/EstadoResultadosEjecutivo";

const EstadoResultados = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Estado de Resultados</h1>
        <p className="text-muted-foreground">Análisis de ingresos y gastos del período</p>
      </div>

      <Tabs defaultValue="operativo" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="operativo">Formato Operativo</TabsTrigger>
          <TabsTrigger value="ejecutivo">Formato Ejecutivo</TabsTrigger>
        </TabsList>
        
        <TabsContent value="operativo" className="mt-6">
          <EstadoResultadosOperativo />
        </TabsContent>
        
        <TabsContent value="ejecutivo" className="mt-6">
          <EstadoResultadosEjecutivo />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EstadoResultados;