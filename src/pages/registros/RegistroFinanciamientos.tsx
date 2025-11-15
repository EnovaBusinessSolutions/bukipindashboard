import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, DollarSign, TrendingDown, Wallet } from "lucide-react";
import RegistroFinanciamientoForm from "@/components/Financiamientos/RegistroFinanciamientoForm";
import RegistroDisposicionForm from "@/components/Financiamientos/RegistroDisposicionForm";
import RegistroAmortizacionForm from "@/components/Financiamientos/RegistroAmortizacionForm";
import RegistroCargoInteresForm from "@/components/Financiamientos/RegistroCargoInteresForm";

import ResumenFinanciamientos from "@/components/Financiamientos/ResumenFinanciamientos";
import DetalleCreditosFinanciamientos from "@/components/Financiamientos/DetalleCreditosFinanciamientos";
import AnalyticaFinanciamientos from "@/components/Financiamientos/AnalyticaFinanciamientos";

const RegistroFinanciamientos = () => {
  const [tipoRegistro, setTipoRegistro] = useState<"" | "financiamiento" | "disposicion" | "amortizacion" | "interes">("");
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Registro de Financiamientos</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona préstamos, créditos y otras formas de financiamiento
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="registro" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="registro">Registro</TabsTrigger>
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            <TabsTrigger value="resumen">Resumen Transacciones</TabsTrigger>
            <TabsTrigger value="analitica">Analítica</TabsTrigger>
          </TabsList>

          <TabsContent value="registro" className="space-y-6">
            {!tipoRegistro ? (
              <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setTipoRegistro("financiamiento")}>
                  <CardHeader>
                    <div className="flex items-center justify-center mb-4">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <CreditCard className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-center">Nuevo Financiamiento</CardTitle>
                    <CardDescription className="text-center">
                      Registra un nuevo crédito, préstamo o arrendamiento
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setTipoRegistro("disposicion")}>
                  <CardHeader>
                    <div className="flex items-center justify-center mb-4">
                      <div className="p-3 bg-blue-500/10 rounded-full">
                        <Wallet className="h-8 w-8 text-blue-600" />
                      </div>
                    </div>
                    <CardTitle className="text-center">Disposición</CardTitle>
                    <CardDescription className="text-center">
                      Dispón de tu línea de crédito revolvente
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setTipoRegistro("amortizacion")}>
                  <CardHeader>
                    <div className="flex items-center justify-center mb-4">
                      <div className="p-3 bg-green-500/10 rounded-full">
                        <DollarSign className="h-8 w-8 text-green-600" />
                      </div>
                    </div>
                    <CardTitle className="text-center">Amortización</CardTitle>
                    <CardDescription className="text-center">
                      Registra el pago de una mensualidad o abono a capital
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setTipoRegistro("interes")}>
                  <CardHeader>
                    <div className="flex items-center justify-center mb-4">
                      <div className="p-3 bg-red-500/10 rounded-full">
                        <TrendingDown className="h-8 w-8 text-red-600" />
                      </div>
                    </div>
                    <CardTitle className="text-center">Cargo por Intereses</CardTitle>
                    <CardDescription className="text-center">
                      Registra intereses ordinarios, moratorios o comisiones
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            ) : (
              <div className="space-y-4">
                <Button variant="outline" onClick={() => setTipoRegistro("")}>
                  ← Volver a selección
                </Button>
                {tipoRegistro === "financiamiento" && <RegistroFinanciamientoForm />}
                {tipoRegistro === "disposicion" && <RegistroDisposicionForm />}
                {tipoRegistro === "amortizacion" && <RegistroAmortizacionForm />}
                {tipoRegistro === "interes" && <RegistroCargoInteresForm />}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resumen">
            <ResumenFinanciamientos />
          </TabsContent>

          <TabsContent value="detalle">
            <DetalleCreditosFinanciamientos />
          </TabsContent>

          <TabsContent value="analitica">
            <AnalyticaFinanciamientos />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegistroFinanciamientos;
