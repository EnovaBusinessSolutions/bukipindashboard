import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useCuentas } from "@/hooks/useCuentas";
import { useSubcuentas, useCreateSubcuenta, useDeleteSubcuenta } from "@/hooks/useSubcuentas";

const PlanCuentas = () => {
  // Hooks para datos
  const { data: cuentasData, isLoading: cuentasLoading, error: cuentasError } = useCuentas();
  const { data: subcuentas = [], isLoading: subcuentasLoading } = useSubcuentas();
  const createSubcuenta = useCreateSubcuenta();
  const deleteSubcuenta = useDeleteSubcuenta();

  // Estado para el formulario
  const [nombreSubcuenta, setNombreSubcuenta] = useState("");
  const [cuentaMadreSeleccionada, setCuentaMadreSeleccionada] = useState("");

  // Extraer datos
  const estadosFinancieros = cuentasData?.estadosFinancieros || {};
  const todasLasCuentas = cuentasData?.cuentasFlat || [];

  const agregarSubcuenta = () => {
    if (!nombreSubcuenta.trim() || !cuentaMadreSeleccionada) return;
    
    createSubcuenta.mutate(
      { nombre: nombreSubcuenta.trim(), cuentaMadreCodigo: cuentaMadreSeleccionada },
      {
        onSuccess: () => {
          setNombreSubcuenta("");
          setCuentaMadreSeleccionada("");
        }
      }
    );
  };

  const eliminarSubcuenta = (id: string) => {
    deleteSubcuenta.mutate(id);
  };

  if (cuentasLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (cuentasError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Error al cargar las cuentas</p>
          <p className="text-muted-foreground text-sm mt-2">Por favor, intenta recargar la página</p>
        </div>
      </div>
    );
  }

  const getGrupoBadgeColor = (grupo: string) => {
    switch (grupo) {
      case 'Activos': return 'bg-blue-500';
      case 'Pasivos': return 'bg-red-500';
      case 'Capital Contable': return 'bg-yellow-500';
      case 'Ingresos': return 'bg-green-500';
      case 'Egresos': return 'bg-orange-500';
      case 'Impuestos': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };


  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Plan de Cuentas</h1>
        <p className="text-muted-foreground mt-2">
          Sistema de clasificación y codificación de cuentas contables
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="catalogo" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="catalogo">Catálogo de Cuentas</TabsTrigger>
            <TabsTrigger value="subcuentas">Gestión de Subcuentas</TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Catálogo de Cuentas</CardTitle>
                <CardDescription>
                  Estructura jerárquica del plan contable de la empresa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {Object.entries(estadosFinancieros).map(([estadoFinanciero, grupos]) => (
                    <AccordionItem key={estadoFinanciero} value={estadoFinanciero}>
                      <AccordionTrigger className="text-lg font-semibold">
                        {estadoFinanciero}
                      </AccordionTrigger>
                      <AccordionContent>
                        <Accordion type="multiple" className="w-full pl-4">
                          {Object.entries(grupos).map(([grupo, subgrupos]) => (
                            <AccordionItem key={grupo} value={grupo}>
                              <AccordionTrigger className="text-base font-medium">
                                <div className="flex items-center space-x-2">
                                  <span>{grupo}</span>
                                  <Badge 
                                    className={`${getGrupoBadgeColor(grupo)} text-white text-xs`}
                                    variant="secondary"
                                  >
                                    {grupo}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <Accordion type="multiple" className="w-full pl-4">
                                  {Object.entries(subgrupos).map(([subgrupo, cuentas]) => (
                                    <AccordionItem key={subgrupo} value={subgrupo}>
                                      <AccordionTrigger className="text-sm font-medium text-muted-foreground">
                                        {subgrupo}
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        <div className="space-y-2 pl-4">
                                          {cuentas.map((cuenta) => (
                                            <div
                                              key={cuenta.codigo}
                                              className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 hover:bg-muted/50"
                                            >
                                              <div className="flex items-center space-x-3">
                                                <code className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono">
                                                  {cuenta.codigo}
                                                </code>
                                                <span className="text-sm">
                                                  {cuenta.nombre}
                                                </span>
                                              </div>
                                               <div className="text-xs text-muted-foreground">
                                                 {subcuentas.filter(s => s.cuenta_madre_codigo === cuenta.codigo).length > 0 && (
                                                   <Badge variant="outline" className="text-xs">
                                                     {subcuentas.filter(s => s.cuenta_madre_codigo === cuenta.codigo).length} subcuentas
                                                   </Badge>
                                                 )}
                                               </div>
                                            </div>
                                          ))}
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  ))}
                                </Accordion>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subcuentas" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agregar Nueva Subcuenta</CardTitle>
                <CardDescription>
                  Crea subcuentas y asígnalas a una cuenta madre
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre-subcuenta">Nombre de la Subcuenta</Label>
                    <Input
                      id="nombre-subcuenta"
                      placeholder="Ej: Banco Santander"
                      value={nombreSubcuenta}
                      onChange={(e) => setNombreSubcuenta(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cuenta-madre">Cuenta Madre</Label>
                    <Select value={cuentaMadreSeleccionada} onValueChange={setCuentaMadreSeleccionada}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una cuenta madre" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {Object.entries(estadosFinancieros).map(([estadoFinanciero, grupos]) => (
                          <SelectGroup key={estadoFinanciero}>
                            <SelectLabel className="font-semibold text-primary">
                              {estadoFinanciero}
                            </SelectLabel>
                            {Object.entries(grupos).map(([grupo, subgrupos]) => (
                              <SelectGroup key={grupo}>
                                <SelectLabel className="pl-4 text-muted-foreground font-medium">
                                  {grupo}
                                </SelectLabel>
                                {Object.entries(subgrupos).map(([subgrupo, cuentas]) => (
                                  <div key={subgrupo}>
                                    <SelectLabel className="pl-8 text-sm text-muted-foreground/80">
                                      {subgrupo}
                                    </SelectLabel>
                                    {cuentas.map((cuenta) => (
                                      <SelectItem key={cuenta.codigo} value={cuenta.codigo} className="pl-12">
                                        <span className="font-mono text-xs text-primary mr-2">
                                          {cuenta.codigo}
                                        </span>
                                        {cuenta.nombre}
                                      </SelectItem>
                                    ))}
                                  </div>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  onClick={agregarSubcuenta}
                  disabled={!nombreSubcuenta.trim() || !cuentaMadreSeleccionada || createSubcuenta.isPending}
                  className="w-full md:w-auto"
                >
                  {createSubcuenta.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Agregar Subcuenta
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subcuentas Registradas</CardTitle>
                <CardDescription>
                  Lista de todas las subcuentas creadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {subcuentasLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : subcuentas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay subcuentas registradas
                  </div>
                ) : (
                  <div className="space-y-2">
                    {subcuentas.map((subcuenta) => (
                      <div
                        key={subcuenta.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="space-y-1">
                          <div className="font-medium">{subcuenta.nombre}</div>
                          <div className="text-sm text-muted-foreground">
                            Cuenta madre: {subcuenta.cuenta_madre_codigo} - {subcuenta.nombreCuentaMadre}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => eliminarSubcuenta(subcuenta.id)}
                          disabled={deleteSubcuenta.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          {deleteSubcuenta.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PlanCuentas;