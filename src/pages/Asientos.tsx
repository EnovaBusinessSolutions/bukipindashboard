import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Asientos = () => {
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Registro de Asientos Contables</h1>
        <p className="text-muted-foreground mt-2">
          Crea y gestiona asientos contables de partida doble
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Asientos Contables</CardTitle>
            <CardDescription>
              Sistema para registrar movimientos contables con partida doble
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              Formulario de asientos contables próximamente...
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Asientos;