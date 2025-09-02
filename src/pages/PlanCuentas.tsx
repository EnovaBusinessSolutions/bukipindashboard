import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PlanCuentas = () => {
  const cuentas = [
    // ACTIVOS
    { codigo: "1", nombre: "ACTIVOS", tipo: "grupo", nivel: 1 },
    { codigo: "11", nombre: "ACTIVO CORRIENTE", tipo: "subgrupo", nivel: 2 },
    { codigo: "1101", nombre: "Disponible", tipo: "cuenta", nivel: 3 },
    { codigo: "110101", nombre: "Caja General", tipo: "subcuenta", nivel: 4 },
    { codigo: "110102", nombre: "Caja Chica", tipo: "subcuenta", nivel: 4 },
    { codigo: "110201", nombre: "Banco de la Nación", tipo: "subcuenta", nivel: 4 },
    { codigo: "110202", nombre: "Banco Continental", tipo: "subcuenta", nivel: 4 },
    { codigo: "110203", nombre: "Banco de Crédito", tipo: "subcuenta", nivel: 4 },
    
    { codigo: "1102", nombre: "Exigible", tipo: "cuenta", nivel: 3 },
    { codigo: "110201", nombre: "Cuentas por cobrar comerciales", tipo: "subcuenta", nivel: 4 },
    { codigo: "110202", nombre: "Cuentas por cobrar al personal", tipo: "subcuenta", nivel: 4 },
    { codigo: "110203", nombre: "Cuentas por cobrar diversas", tipo: "subcuenta", nivel: 4 },
    
    { codigo: "1103", nombre: "Realizable", tipo: "cuenta", nivel: 3 },
    { codigo: "110301", nombre: "Mercaderías", tipo: "subcuenta", nivel: 4 },
    { codigo: "110302", nombre: "Productos terminados", tipo: "subcuenta", nivel: 4 },
    { codigo: "110303", nombre: "Materias primas", tipo: "subcuenta", nivel: 4 },
    
    // PASIVOS
    { codigo: "2", nombre: "PASIVOS", tipo: "grupo", nivel: 1 },
    { codigo: "21", nombre: "PASIVO CORRIENTE", tipo: "subgrupo", nivel: 2 },
    { codigo: "2101", nombre: "Cuentas por pagar comerciales", tipo: "cuenta", nivel: 3 },
    { codigo: "210101", nombre: "Facturas por pagar", tipo: "subcuenta", nivel: 4 },
    { codigo: "210102", nombre: "Letras por pagar", tipo: "subcuenta", nivel: 4 },
    
    { codigo: "2102", nombre: "Tributos por pagar", tipo: "cuenta", nivel: 3 },
    { codigo: "210201", nombre: "IGV por pagar", tipo: "subcuenta", nivel: 4 },
    { codigo: "210202", nombre: "Renta por pagar", tipo: "subcuenta", nivel: 4 },
    
    // PATRIMONIO
    { codigo: "3", nombre: "PATRIMONIO", tipo: "grupo", nivel: 1 },
    { codigo: "31", nombre: "CAPITAL", tipo: "subgrupo", nivel: 2 },
    { codigo: "3101", nombre: "Capital Social", tipo: "cuenta", nivel: 3 },
    { codigo: "3102", nombre: "Reservas", tipo: "cuenta", nivel: 3 },
    { codigo: "3103", nombre: "Resultados acumulados", tipo: "cuenta", nivel: 3 },
    
    // GASTOS
    { codigo: "6", nombre: "GASTOS", tipo: "grupo", nivel: 1 },
    { codigo: "61", nombre: "GASTOS OPERACIONALES", tipo: "subgrupo", nivel: 2 },
    { codigo: "6101", nombre: "Gastos de administración", tipo: "cuenta", nivel: 3 },
    { codigo: "6102", nombre: "Gastos de ventas", tipo: "cuenta", nivel: 3 },
    
    // INGRESOS
    { codigo: "7", nombre: "INGRESOS", tipo: "grupo", nivel: 1 },
    { codigo: "71", nombre: "INGRESOS OPERACIONALES", tipo: "subgrupo", nivel: 2 },
    { codigo: "7101", nombre: "Ventas", tipo: "cuenta", nivel: 3 },
    { codigo: "710101", nombre: "Ventas gravadas", tipo: "subcuenta", nivel: 4 },
    { codigo: "710102", nombre: "Ventas exoneradas", tipo: "subcuenta", nivel: 4 },
  ];

  const getTipoBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'grupo': return 'bg-blue-500';
      case 'subgrupo': return 'bg-green-500';
      case 'cuenta': return 'bg-orange-500';
      case 'subcuenta': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getIndentation = (nivel: number) => {
    return `pl-${(nivel - 1) * 4}`;
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
                className={`flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 ${getIndentation(cuenta.nivel)}`}
              >
                <div className="flex items-center space-x-3">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                    {cuenta.codigo}
                  </code>
                  <span className={`font-medium ${
                    cuenta.nivel === 1 ? 'text-lg' : 
                    cuenta.nivel === 2 ? 'text-base' : 'text-sm'
                  }`}>
                    {cuenta.nombre}
                  </span>
                </div>
                <Badge 
                  className={`${getTipoBadgeColor(cuenta.tipo)} text-white`}
                  variant="secondary"
                >
                  {cuenta.tipo}
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