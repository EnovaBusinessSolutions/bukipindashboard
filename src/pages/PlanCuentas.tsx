import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PlanCuentas = () => {
  const cuentas = [
    // ACTIVO CIRCULANTE
    { codigo: "1001", nombre: "Efectivo", agrupador: "Activo Circulante" },
    { codigo: "1002", nombre: "Bancos", agrupador: "Activo Circulante" },
    { codigo: "1003", nombre: "Cuentas por cobrar", agrupador: "Activo Circulante" },
    { codigo: "1004", nombre: "Inventarios", agrupador: "Activo Circulante" },
    { codigo: "1005", nombre: "Otras cuentas por cobrar", agrupador: "Activo Circulante" },
    
    // ACTIVO FIJO
    { codigo: "1007", nombre: "Activo Fijo Bruto", agrupador: "Activo Fijo" },
    { codigo: "1008", nombre: "Depreciación Acumulada", agrupador: "Activo Fijo" },
    
    // ACTIVO DIFERIDO
    { codigo: "1009", nombre: "Activo Diferido Bruto", agrupador: "Activo Diferido" },
    { codigo: "1010", nombre: "Amortización Acumulada", agrupador: "Activo Diferido" },
    { codigo: "1011", nombre: "Otros Activos Largo Plazo", agrupador: "Activo Diferido" },
    
    // PASIVO CIRCULANTE
    { codigo: "2001", nombre: "Proveedores", agrupador: "Pasivo Circulante" },
    { codigo: "2002", nombre: "Pasivos Bancarios", agrupador: "Pasivo Circulante" },
    { codigo: "2003", nombre: "Otros Pasivos", agrupador: "Pasivo Circulante" },
    { codigo: "2004", nombre: "Otros Pasivos Largo Plazo", agrupador: "Pasivo Largo Plazo" },
    
    // CAPITAL CONTABLE
    { codigo: "3001", nombre: "Capital Social", agrupador: "Capital Contable" },
    { codigo: "3002", nombre: "Aportaciones de Capital", agrupador: "Capital Contable" },
    { codigo: "3005", nombre: "Utilidad de Ejercicios Anteriores", agrupador: "Capital Contable" },
    { codigo: "3006", nombre: "Dividendos Decretados", agrupador: "Capital Contable" },
    { codigo: "3007", nombre: "Utilidad del Ejercicio", agrupador: "Resultados" },
    
    // RESULTADOS - INGRESOS
    { codigo: "4001", nombre: "Ventas", agrupador: "Resultados" },
    { codigo: "4002", nombre: "Otros Ingresos", agrupador: "Resultados" },
    
    // RESULTADOS - COSTOS Y GASTOS
    { codigo: "5001", nombre: "Costo de Ventas", agrupador: "Resultados" },
    { codigo: "5002", nombre: "Otros Gastos", agrupador: "Resultados" },
    { codigo: "5003", nombre: "Gastos Generales", agrupador: "Resultados" },
    { codigo: "5005", nombre: "Depreciación y Amortización", agrupador: "Resultados" },
    
    // RESULTADOS - FINANCIEROS
    { codigo: "6001", nombre: "Costo Financiero", agrupador: "Resultados" },
    
    // IMPUESTOS
    { codigo: "8001", nombre: "Impuestos", agrupador: "Resultados" },
  ];

  const getAgrupadorBadgeColor = (agrupador: string) => {
    switch (agrupador) {
      case 'Activo Circulante': return 'bg-blue-500';
      case 'Activo Fijo': return 'bg-green-500';
      case 'Activo Diferido': return 'bg-purple-500';
      case 'Pasivo Circulante': return 'bg-red-500';
      case 'Pasivo Largo Plazo': return 'bg-red-600';
      case 'Capital Contable': return 'bg-yellow-500';
      case 'Resultados': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };


  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Plan de Cuentas</h1>
        <p className="text-muted-foreground mt-2">
          Sistema de clasificación y codificación de cuentas contables
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de Cuentas</CardTitle>
          <CardDescription>
            Estructura jerárquica del plan contable de la empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {cuentas.map((cuenta) => (
              <div
                key={cuenta.codigo}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
              >
                <div className="flex items-center space-x-3">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                    {cuenta.codigo}
                  </code>
                  <span className="font-medium text-sm">
                    {cuenta.nombre}
                  </span>
                </div>
                <Badge 
                  className={`${getAgrupadorBadgeColor(cuenta.agrupador)} text-white`}
                  variant="secondary"
                >
                  {cuenta.agrupador}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlanCuentas;