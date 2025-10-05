import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const RegistroInversiones = () => {
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Registro de Inversiones</h1>
        <p className="text-muted-foreground mt-2">
          Registra y gestiona las inversiones de la empresa
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Inversiones</CardTitle>
            <CardDescription>
              Sistema para registrar inversiones y activos financieros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              Formulario de registro de inversiones próximamente...
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegistroInversiones;