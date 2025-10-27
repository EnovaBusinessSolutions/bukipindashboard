import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, BarChart3, Package, FileText, ShoppingCart, Wallet, Receipt, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RegistroEgresosPrecargados from "@/components/Egresos/RegistroEgresosPrecargados";
import RegistroEgresosGenerales from "@/components/Egresos/RegistroEgresosGenerales";
import RegistroOtrosGastos from "@/components/Egresos/RegistroOtrosGastos";
import AnalyticaEgresos from "@/components/Egresos/AnalyticaEgresos";
import CatalogoProductos from "@/components/Egresos/CatalogoProductos";
import ResumenEgresos from "@/components/Egresos/ResumenEgresos";

const RegistroEgresos = () => {
  const [selectedEgresoType, setSelectedEgresoType] = useState<string | null>(null);
  return (
    <div className="w-full">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Gestión de Egresos</h1>
        <p className="text-muted-foreground mt-2">
          Registra gastos, costos y otros egresos con seguimiento completo de pagos y proveedores
        </p>
      </div>

      <div className="p-6 pb-0">
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

          <TabsContent value="registro" className="w-full overflow-visible">
            {!selectedEgresoType ? (
              <Card>
                <CardHeader>
                  <CardTitle>Nuevo Registro de Egreso</CardTitle>
                  <CardDescription>
                    Selecciona el tipo de egreso que deseas registrar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card 
                      className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
                      onClick={() => setSelectedEgresoType('precargados')}
                    >
                      <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                          <div className="p-4 bg-primary/10 rounded-full">
                            <Package className="h-8 w-8 text-primary" />
                          </div>
                        </div>
                        <CardTitle className="text-lg">Costos y Gastos Precargados</CardTitle>
                        <CardDescription>
                          Registra egresos de productos del catálogo
                        </CardDescription>
                      </CardHeader>
                    </Card>

                    <Card 
                      className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
                      onClick={() => setSelectedEgresoType('generales')}
                    >
                      <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                          <div className="p-4 bg-primary/10 rounded-full">
                            <Wallet className="h-8 w-8 text-primary" />
                          </div>
                        </div>
                        <CardTitle className="text-lg">Costos y Gastos Generales</CardTitle>
                        <CardDescription>
                          Registra gastos operativos generales
                        </CardDescription>
                      </CardHeader>
                    </Card>

                    <Card 
                      className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
                      onClick={() => setSelectedEgresoType('otros')}
                    >
                      <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                          <div className="p-4 bg-primary/10 rounded-full">
                            <Receipt className="h-8 w-8 text-primary" />
                          </div>
                        </div>
                        <CardTitle className="text-lg">Otros Gastos</CardTitle>
                        <CardDescription>
                          Registra gastos extraordinarios y diversos
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedEgresoType(null)}
                  className="mb-4"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al menú de selección
                </Button>
                
                {selectedEgresoType === 'precargados' && <RegistroEgresosPrecargados />}
                {selectedEgresoType === 'generales' && <RegistroEgresosGenerales />}
                {selectedEgresoType === 'otros' && <RegistroOtrosGastos />}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resumen" className="w-full overflow-visible">
            <ResumenEgresos />
          </TabsContent>

          <TabsContent value="reportes" className="w-full overflow-visible">
            <AnalyticaEgresos />
          </TabsContent>

          <TabsContent value="catalogo" className="w-full overflow-visible">
            <CatalogoProductos />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegistroEgresos;