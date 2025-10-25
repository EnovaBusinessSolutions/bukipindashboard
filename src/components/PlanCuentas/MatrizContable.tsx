import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const MatrizContable = () => {
  // Definición de transacciones y sus afectaciones contables
  const transacciones = {
    "Registro de Ingresos": {
      color: "bg-green-500",
      casos: [
        {
          descripcion: "Venta de contado (Efectivo)",
          debe: [{ cuenta: "1001", nombre: "Caja", tipo: "Activo" }],
          haber: [{ cuenta: "4001", nombre: "Ventas", tipo: "Ingreso" }]
        },
        {
          descripcion: "Venta de contado (Banco)",
          debe: [{ cuenta: "1002", nombre: "Bancos", tipo: "Activo" }],
          haber: [{ cuenta: "4001", nombre: "Ventas", tipo: "Ingreso" }]
        },
        {
          descripcion: "Venta a crédito",
          debe: [{ cuenta: "1101", nombre: "Clientes", tipo: "Activo" }],
          haber: [{ cuenta: "4001", nombre: "Ventas", tipo: "Ingreso" }]
        },
        {
          descripcion: "Cobro de venta a crédito (Efectivo)",
          debe: [{ cuenta: "1001", nombre: "Caja", tipo: "Activo" }],
          haber: [{ cuenta: "1101", nombre: "Clientes", tipo: "Activo" }]
        },
        {
          descripcion: "Cobro de venta a crédito (Banco)",
          debe: [{ cuenta: "1002", nombre: "Bancos", tipo: "Activo" }],
          haber: [{ cuenta: "1101", nombre: "Clientes", tipo: "Activo" }]
        }
      ]
    },
    "Registro de Egresos": {
      color: "bg-orange-500",
      casos: [
        {
          descripcion: "Compra de inventario de contado (Efectivo)",
          debe: [{ cuenta: "1201", nombre: "Inventarios", tipo: "Activo" }],
          haber: [{ cuenta: "1001", nombre: "Caja", tipo: "Activo" }]
        },
        {
          descripcion: "Compra de inventario de contado (Banco)",
          debe: [{ cuenta: "1201", nombre: "Inventarios", tipo: "Activo" }],
          haber: [{ cuenta: "1002", nombre: "Bancos", tipo: "Activo" }]
        },
        {
          descripcion: "Compra de inventario a crédito",
          debe: [{ cuenta: "1201", nombre: "Inventarios", tipo: "Activo" }],
          haber: [{ cuenta: "2001", nombre: "Proveedores", tipo: "Pasivo" }]
        },
        {
          descripcion: "Pago a proveedores (Efectivo)",
          debe: [{ cuenta: "2001", nombre: "Proveedores", tipo: "Pasivo" }],
          haber: [{ cuenta: "1001", nombre: "Caja", tipo: "Activo" }]
        },
        {
          descripcion: "Pago a proveedores (Banco)",
          debe: [{ cuenta: "2001", nombre: "Proveedores", tipo: "Pasivo" }],
          haber: [{ cuenta: "1002", nombre: "Bancos", tipo: "Activo" }]
        },
        {
          descripcion: "Gasto operativo de contado (Efectivo)",
          debe: [{ cuenta: "5XXX", nombre: "Gastos operativos", tipo: "Egreso" }],
          haber: [{ cuenta: "1001", nombre: "Caja", tipo: "Activo" }]
        },
        {
          descripcion: "Gasto operativo de contado (Banco)",
          debe: [{ cuenta: "5XXX", nombre: "Gastos operativos", tipo: "Egreso" }],
          haber: [{ cuenta: "1002", nombre: "Bancos", tipo: "Activo" }]
        },
        {
          descripcion: "Gasto operativo con tarjeta de crédito",
          debe: [{ cuenta: "5XXX", nombre: "Gastos operativos", tipo: "Egreso" }],
          haber: [{ cuenta: "2104", nombre: "Tarjeta de crédito corporativa", tipo: "Pasivo" }]
        }
      ]
    },
    "Registro de Capital": {
      color: "bg-yellow-500",
      casos: [
        {
          descripcion: "Aportación de capital (Efectivo)",
          debe: [{ cuenta: "1001", nombre: "Caja", tipo: "Activo" }],
          haber: [{ cuenta: "3001", nombre: "Capital social", tipo: "Capital" }]
        },
        {
          descripcion: "Aportación de capital (Banco)",
          debe: [{ cuenta: "1002", nombre: "Bancos", tipo: "Activo" }],
          haber: [{ cuenta: "3001", nombre: "Capital social", tipo: "Capital" }]
        },
        {
          descripcion: "Retiro de capital (Efectivo)",
          debe: [{ cuenta: "3001", nombre: "Capital social", tipo: "Capital" }],
          haber: [{ cuenta: "1001", nombre: "Caja", tipo: "Activo" }]
        },
        {
          descripcion: "Retiro de capital (Banco)",
          debe: [{ cuenta: "3001", nombre: "Capital social", tipo: "Capital" }],
          haber: [{ cuenta: "1002", nombre: "Bancos", tipo: "Activo" }]
        }
      ]
    },
    "Registro de Financiamientos": {
      color: "bg-blue-500",
      casos: [
        {
          descripcion: "Disposición de crédito",
          debe: [{ cuenta: "1002", nombre: "Bancos", tipo: "Activo" }],
          haber: [{ cuenta: "2101/2102/2103", nombre: "Crédito bancario", tipo: "Pasivo" }]
        },
        {
          descripcion: "Pago de amortización (Capital)",
          debe: [{ cuenta: "2101/2102/2103", nombre: "Crédito bancario", tipo: "Pasivo" }],
          haber: [{ cuenta: "1002", nombre: "Bancos", tipo: "Activo" }]
        },
        {
          descripcion: "Pago de intereses",
          debe: [{ cuenta: "5301", nombre: "Gastos financieros", tipo: "Egreso" }],
          haber: [{ cuenta: "1002", nombre: "Bancos", tipo: "Activo" }]
        },
        {
          descripción: "Cargo de intereses (sin pago)",
          debe: [{ cuenta: "5301", nombre: "Gastos financieros", tipo: "Egreso" }],
          haber: [{ cuenta: "2101/2102/2103", nombre: "Crédito bancario", tipo: "Pasivo" }]
        }
      ]
    },
    "Registro de Inversiones (CapEx)": {
      color: "bg-purple-500",
      casos: [
        {
          descripcion: "Compra de activo fijo de contado",
          debe: [{ cuenta: "1301/1302/1303", nombre: "Activos fijos", tipo: "Activo" }],
          haber: [{ cuenta: "1002", nombre: "Bancos", tipo: "Activo" }]
        },
        {
          descripcion: "Compra de activo fijo a crédito",
          debe: [{ cuenta: "1301/1302/1303", nombre: "Activos fijos", tipo: "Activo" }],
          haber: [{ cuenta: "2001", nombre: "Proveedores", tipo: "Pasivo" }]
        },
        {
          descripcion: "Depreciación mensual",
          debe: [{ cuenta: "5201", nombre: "Depreciaciones", tipo: "Egreso" }],
          haber: [{ cuenta: "1304", nombre: "Depreciación acumulada", tipo: "Activo (contra)" }]
        },
        {
          descripcion: "Venta de activo fijo",
          debe: [
            { cuenta: "1002", nombre: "Bancos", tipo: "Activo" },
            { cuenta: "1304", nombre: "Depreciación acumulada", tipo: "Activo (contra)" }
          ],
          haber: [
            { cuenta: "1301/1302/1303", nombre: "Activos fijos", tipo: "Activo" },
            { cuenta: "4002", nombre: "Otros ingresos (ganancia)", tipo: "Ingreso" }
          ]
        }
      ]
    },
    "Registro de Impuestos": {
      color: "bg-red-500",
      casos: [
        {
          descripcion: "Provisión de ISR",
          debe: [{ cuenta: "6001", nombre: "ISR", tipo: "Impuesto" }],
          haber: [{ cuenta: "2002", nombre: "Impuestos por pagar", tipo: "Pasivo" }]
        },
        {
          descripcion: "Pago de ISR",
          debe: [{ cuenta: "2002", nombre: "Impuestos por pagar", tipo: "Pasivo" }],
          haber: [{ cuenta: "1002", nombre: "Bancos", tipo: "Activo" }]
        }
      ]
    }
  };

  const getTipoBadgeColor = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case 'activo': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'activo (contra)': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pasivo': return 'bg-red-100 text-red-800 border-red-300';
      case 'capital': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'ingreso': return 'bg-green-100 text-green-800 border-green-300';
      case 'egreso': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'impuesto': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Matriz de Afectaciones Contables
          </CardTitle>
          <CardDescription>
            Visualiza cómo cada tipo de transacción afecta las cuentas contables del sistema. 
            Esta matriz te ayuda a verificar que todas las transacciones están correctamente amarradas contablemente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {Object.entries(transacciones).map(([modulo, data]) => (
              <AccordionItem key={modulo} value={modulo}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${data.color}`}></div>
                    <span className="font-semibold">{modulo}</span>
                    <Badge variant="outline" className="ml-2">
                      {data.casos.length} casos
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-4">
                    {data.casos.map((caso, index) => (
                      <Card key={index} className="border-l-4" style={{ borderLeftColor: data.color.replace('bg-', '#') }}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">
                            {caso.descripcion}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                            {/* DEBE */}
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-muted-foreground uppercase">
                                Debe (Cargo)
                              </div>
                              {caso.debe.map((cuenta, idx) => (
                                <div key={idx} className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs font-mono bg-blue-100 px-2 py-0.5 rounded">
                                      {cuenta.cuenta}
                                    </code>
                                    <span className="text-sm font-medium">{cuenta.nombre}</span>
                                  </div>
                                  <Badge variant="outline" className={`mt-1 text-xs ${getTipoBadgeColor(cuenta.tipo)}`}>
                                    {cuenta.tipo}
                                  </Badge>
                                </div>
                              ))}
                            </div>

                            {/* FLECHA */}
                            <div className="flex justify-center">
                              <ArrowRight className="h-6 w-6 text-muted-foreground" />
                            </div>

                            {/* HABER */}
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-muted-foreground uppercase">
                                Haber (Abono)
                              </div>
                              {caso.haber.map((cuenta, idx) => (
                                <div key={idx} className="p-2 rounded-lg bg-green-50 border border-green-200">
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs font-mono bg-green-100 px-2 py-0.5 rounded">
                                      {cuenta.cuenta}
                                    </code>
                                    <span className="text-sm font-medium">{cuenta.nombre}</span>
                                  </div>
                                  <Badge variant="outline" className={`mt-1 text-xs ${getTipoBadgeColor(cuenta.tipo)}`}>
                                    {cuenta.tipo}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-sm">📚 Notas Importantes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            <strong>Debe (Cargo):</strong> Aumenta los activos y gastos, disminuye los pasivos, capital e ingresos.
          </p>
          <p>
            <strong>Haber (Abono):</strong> Disminuye los activos y gastos, aumenta los pasivos, capital e ingresos.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            Esta matriz refleja las afectaciones contables automáticas que genera el sistema. 
            Todas las transacciones están diseñadas para mantener el equilibrio contable (Debe = Haber).
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MatrizContable;
