import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const PlanCuentas = () => {
  // Tipos para la estructura de datos
  type Cuenta = {
    codigo: string;
    nombre: string;
  };

  type Subgrupo = {
    [key: string]: Cuenta[];
  };

  type Grupo = {
    [key: string]: Subgrupo;
  };

  type EstadosFinancieros = {
    [key: string]: Grupo;
  };

  // Plan de cuentas actualizado con estructura jerárquica
  const estadosFinancieros: EstadosFinancieros = {
    "Balance General": {
      "Activos": {
        "Activo Circulante": [
          { codigo: "1001", nombre: "Efectivo" },
          { codigo: "1002", nombre: "Bancos" },
          { codigo: "1003", nombre: "Cuentas por cobrar" },
          { codigo: "1004", nombre: "Inventarios" },
          { codigo: "1005", nombre: "Otras cuentas por cobrar" },
        ],
        "Activo Fijo": [
          { codigo: "1007", nombre: "Activo Fijo Bruto" },
          { codigo: "1008", nombre: "Depreciación Acumulada" },
        ],
        "Activo Diferido": [
          { codigo: "1009", nombre: "Activo Diferido Bruto" },
          { codigo: "1010", nombre: "Amortización Acumulada" },
          { codigo: "1011", nombre: "Otros Activos Largo Plazo" },
        ]
      },
      "Pasivos": {
        "Pasivo Circulante": [
          { codigo: "2001", nombre: "Proveedores" },
          { codigo: "2002", nombre: "Pasivos Bancarios" },
          { codigo: "2003", nombre: "Otros Pasivos" },
        ],
        "Pasivo Largo Plazo": [
          { codigo: "2004", nombre: "Otros Pasivos Largo Plazo" },
        ]
      },
      "Capital Contable": {
        "Capital": [
          { codigo: "3001", nombre: "Capital Social" },
          { codigo: "3002", nombre: "Aportaciones de Capital" },
          { codigo: "3005", nombre: "Utilidad de Ejercicios Anteriores" },
          { codigo: "3006", nombre: "Dividendos Decretados" },
        ]
      }
    },
    "Estado de Resultados": {
      "Ingresos": {
        "Ingresos Operacionales": [
          { codigo: "4001", nombre: "Ventas" },
          { codigo: "4002", nombre: "Otros Ingresos" },
        ]
      },
      "Costos y Gastos": {
        "Costos": [
          { codigo: "5001", nombre: "Costo de Ventas" },
        ],
        "Gastos Operacionales": [
          { codigo: "5002", nombre: "Otros Gastos" },
          { codigo: "5003", nombre: "Gastos Generales" },
          { codigo: "5005", nombre: "Depreciación y Amortización" },
        ],
        "Gastos Financieros": [
          { codigo: "6001", nombre: "Costo Financiero" },
        ]
      },
      "Otros": {
        "Impuestos y Utilidades": [
          { codigo: "8001", nombre: "Impuestos" },
          { codigo: "3007", nombre: "Utilidad del Ejercicio" },
        ]
      }
    }
  };

  const getGrupoBadgeColor = (grupo: string) => {
    switch (grupo) {
      case 'Activos': return 'bg-blue-500';
      case 'Pasivos': return 'bg-red-500';
      case 'Capital Contable': return 'bg-yellow-500';
      case 'Ingresos': return 'bg-green-500';
      case 'Costos y Gastos': return 'bg-orange-500';
      case 'Otros': return 'bg-purple-500';
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
      </div>
    </div>
  );
};

export default PlanCuentas;