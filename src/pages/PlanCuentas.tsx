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

  // Plan de cuentas con estructura contable correcta
  // Ecuación fundamental: ACTIVOS = PASIVOS + CAPITAL
  // Resultado del Ejercicio = INGRESOS - EGRESOS (incluido en Capital)
  const estadosFinancieros: EstadosFinancieros = {
    "Balance General": {
      "Activos": {
        "Activo Circulante": [
          { codigo: "1001", nombre: "Caja" },
          { codigo: "1002", nombre: "Bancos" },
          { codigo: "1003", nombre: "Cuentas por Cobrar Clientes" },
          { codigo: "1004", nombre: "Documentos por Cobrar" },
          { codigo: "1005", nombre: "Inventario de Mercancías" },
          { codigo: "1006", nombre: "Inventario de Materias Primas" },
          { codigo: "1007", nombre: "IVA Acreditable" },
          { codigo: "1008", nombre: "Gastos Pagados por Anticipado" },
        ],
        "Activo No Circulante": [
          { codigo: "1201", nombre: "Terrenos" },
          { codigo: "1202", nombre: "Edificios" },
          { codigo: "1203", nombre: "Maquinaria y Equipo" },
          { codigo: "1204", nombre: "Mobiliario y Equipo de Oficina" },
          { codigo: "1205", nombre: "Equipo de Transporte" },
          { codigo: "1206", nombre: "Equipo de Cómputo" },
          { codigo: "1207", nombre: "Depreciación Acumulada Edificios" },
          { codigo: "1208", nombre: "Depreciación Acumulada Maquinaria" },
          { codigo: "1209", nombre: "Depreciación Acumulada Mobiliario" },
          { codigo: "1210", nombre: "Depreciación Acumulada Transporte" },
          { codigo: "1211", nombre: "Depreciación Acumulada Equipo Cómputo" },
        ],
        "Activo Diferido": [
          { codigo: "1301", nombre: "Gastos de Instalación" },
          { codigo: "1302", nombre: "Gastos de Organización" },
          { codigo: "1303", nombre: "Marcas y Patentes" },
          { codigo: "1304", nombre: "Amortización Acumulada" },
        ]
      },
      "Pasivos": {
        "Pasivo Circulante": [
          { codigo: "2001", nombre: "Proveedores" },
          { codigo: "2002", nombre: "Documentos por Pagar" },
          { codigo: "2003", nombre: "Acreedores Diversos" },
          { codigo: "2004", nombre: "IVA por Pagar" },
          { codigo: "2005", nombre: "Impuestos por Pagar" },
          { codigo: "2006", nombre: "Sueldos por Pagar" },
          { codigo: "2007", nombre: "Préstamos Bancarios Corto Plazo" },
        ],
        "Pasivo No Circulante": [
          { codigo: "2101", nombre: "Préstamos Bancarios Largo Plazo" },
          { codigo: "2102", nombre: "Hipotecas por Pagar" },
          { codigo: "2103", nombre: "Documentos por Pagar Largo Plazo" },
        ]
      },
      "Capital Contable": {
        "Capital Contribuido": [
          { codigo: "3001", nombre: "Capital Social" },
          { codigo: "3002", nombre: "Aportaciones para Futuros Aumentos" },
          { codigo: "3003", nombre: "Prima en Venta de Acciones" },
        ],
        "Capital Ganado": [
          { codigo: "3101", nombre: "Reserva Legal" },
          { codigo: "3102", nombre: "Utilidades Retenidas" },
          { codigo: "3103", nombre: "Utilidad del Ejercicio" },
          { codigo: "3104", nombre: "Pérdidas Acumuladas" },
        ],
        "Capital Reembolsado": [
          { codigo: "3201", nombre: "Dividendos Decretados" },
        ]
      }
    },
    "Estado de Resultados": {
      "Ingresos": {
        "Ingresos por Ventas": [
          { codigo: "4001", nombre: "Ventas" },
          { codigo: "4002", nombre: "Devoluciones sobre Ventas" },
          { codigo: "4003", nombre: "Descuentos sobre Ventas" },
        ],
        "Otros Ingresos": [
          { codigo: "4101", nombre: "Productos Financieros" },
          { codigo: "4102", nombre: "Otros Productos" },
          { codigo: "4103", nombre: "Ganancia en Venta de Activos" },
        ]
      },
      "Egresos": {
        "Costo de Ventas": [
          { codigo: "5001", nombre: "Compras" },
          { codigo: "5002", nombre: "Gastos sobre Compras" },
          { codigo: "5003", nombre: "Devoluciones sobre Compras" },
          { codigo: "5004", nombre: "Descuentos sobre Compras" },
        ],
        "Gastos de Operación": [
          { codigo: "5101", nombre: "Gastos de Venta" },
          { codigo: "5102", nombre: "Sueldos y Salarios Ventas" },
          { codigo: "5103", nombre: "Comisiones sobre Ventas" },
          { codigo: "5104", nombre: "Publicidad" },
          { codigo: "5105", nombre: "Gastos de Administración" },
          { codigo: "5106", nombre: "Sueldos y Salarios Administración" },
          { codigo: "5107", nombre: "Renta de Oficinas" },
          { codigo: "5108", nombre: "Servicios Públicos" },
          { codigo: "5109", nombre: "Depreciaciones" },
          { codigo: "5110", nombre: "Amortizaciones" },
        ],
        "Gastos Financieros": [
          { codigo: "5201", nombre: "Intereses Pagados" },
          { codigo: "5202", nombre: "Comisiones Bancarias" },
          { codigo: "5203", nombre: "Pérdida en Venta de Activos" },
        ]
      },
      "Impuestos": {
        "Provisiones": [
          { codigo: "6001", nombre: "Impuesto sobre la Renta" },
          { codigo: "6002", nombre: "Participación de Utilidades a Trabajadores" },
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