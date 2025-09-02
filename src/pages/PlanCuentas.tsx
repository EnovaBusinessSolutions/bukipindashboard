import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";

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

  // Tipo para subcuentas
  type Subcuenta = {
    id: string;
    nombre: string;
    codigoCuentaMadre: string;
    nombreCuentaMadre: string;
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

  // Estado para subcuentas
  const [subcuentas, setSubcuentas] = useState<Subcuenta[]>([]);
  const [nombreSubcuenta, setNombreSubcuenta] = useState("");
  const [cuentaMadreSeleccionada, setCuentaMadreSeleccionada] = useState("");

  // Obtener todas las cuentas para el selector
  const todasLasCuentas = Object.entries(estadosFinancieros).flatMap(([_, grupos]) =>
    Object.entries(grupos).flatMap(([__, subgrupos]) =>
      Object.entries(subgrupos).flatMap(([___, cuentas]) => cuentas)
    )
  );

  const agregarSubcuenta = () => {
    if (!nombreSubcuenta.trim() || !cuentaMadreSeleccionada) return;
    
    const cuentaMadre = todasLasCuentas.find(c => c.codigo === cuentaMadreSeleccionada);
    if (!cuentaMadre) return;

    const nuevaSubcuenta: Subcuenta = {
      id: Date.now().toString(),
      nombre: nombreSubcuenta.trim(),
      codigoCuentaMadre: cuentaMadre.codigo,
      nombreCuentaMadre: cuentaMadre.nombre
    };

    setSubcuentas([...subcuentas, nuevaSubcuenta]);
    setNombreSubcuenta("");
    setCuentaMadreSeleccionada("");
  };

  const eliminarSubcuenta = (id: string) => {
    setSubcuentas(subcuentas.filter(s => s.id !== id));
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
                                                {subcuentas.filter(s => s.codigoCuentaMadre === cuenta.codigo).length > 0 && (
                                                  <Badge variant="outline" className="text-xs">
                                                    {subcuentas.filter(s => s.codigoCuentaMadre === cuenta.codigo).length} subcuentas
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
                      <SelectContent>
                        {todasLasCuentas.map((cuenta) => (
                          <SelectItem key={cuenta.codigo} value={cuenta.codigo}>
                            {cuenta.codigo} - {cuenta.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  onClick={agregarSubcuenta}
                  disabled={!nombreSubcuenta.trim() || !cuentaMadreSeleccionada}
                  className="w-full md:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
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
                {subcuentas.length === 0 ? (
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
                            Cuenta madre: {subcuenta.codigoCuentaMadre} - {subcuenta.nombreCuentaMadre}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => eliminarSubcuenta(subcuenta.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
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