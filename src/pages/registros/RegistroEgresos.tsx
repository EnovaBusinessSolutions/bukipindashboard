import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const RegistroEgresos = () => {
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Registro de Egresos</h1>
        <p className="text-muted-foreground mt-2">
          Registra y gestiona todos los gastos y egresos de la empresa
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Egresos</CardTitle>
            <CardDescription>
              Sistema para registrar gastos, compras y otros egresos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              Formulario de registro de egresos próximamente...
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegistroEgresos;