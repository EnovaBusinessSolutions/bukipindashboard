import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Ingresos = () => {
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Registro de Ingresos</h1>
        <p className="text-muted-foreground mt-2">
          Registra y gestiona todos los ingresos de la empresa
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos</CardTitle>
            <CardDescription>
              Sistema para registrar ingresos por ventas y otros conceptos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              Formulario de registro de ingresos próximamente...
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Ingresos;