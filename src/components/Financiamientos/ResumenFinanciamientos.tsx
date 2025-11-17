import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TransaccionesTarjetaCredito from "./TransaccionesTarjetaCredito";
import TransaccionesFinanciamiento from "./TransaccionesFinanciamiento";

const ResumenFinanciamientos = () => {
  const { transacciones, financiamientos, isLoading } = useFinanciamientos();

  const getTipoTransaccionLabel = (tipo: string, financiamientoId?: string) => {
    if (tipo === "desembolso" && financiamientoId) {
      const financiamiento = financiamientos.find(f => f.id === financiamientoId);
      if (financiamiento) {
        const tipoCredito: Record<string, string> = {
          simple: "Crédito Simple",
          arrendamiento: "Arrendamiento",
          revolvente: "Crédito Revolvente",
          tarjeta_corporativa: "Tarjeta Corporativa",
        };
        return tipoCredito[financiamiento.tipo_credito] || financiamiento.tipo_credito;
      }
    }
    
    const labels: Record<string, string> = {
      amortizacion: "Amortización",
      cargo_interes: "Cargo por Interés",
      desembolso: "Desembolso",
    };
    return labels[tipo] || tipo;
  };

  const getTipoTransaccionVariant = (tipo: string): "default" | "secondary" | "destructive" => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      amortizacion: "default",
      cargo_interes: "destructive",
      desembolso: "secondary",
    };
    return variants[tipo] || "default";
  };

  const getFinanciamientoNombre = (id: string) => {
    const financiamiento = financiamientos.find(f => f.id === id);
    return financiamiento?.nombre || "N/A";
  };

  console.log("Financiamientos:", financiamientos);
  console.log("Transacciones:", transacciones);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const totalAmortizaciones = transacciones
    .filter(t => t.tipo_transaccion === "amortizacion")
    .reduce((sum, t) => sum + t.capital_pagado, 0);

  const totalIntereses = transacciones
    .reduce((sum, t) => sum + t.interes_pagado, 0);

  const totalCargos = transacciones
    .filter(t => t.tipo_transaccion === "cargo_interes")
    .reduce((sum, t) => sum + t.monto, 0);

  return (
    <div className="space-y-6">
      {/* Resumen general */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Amortizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ${totalAmortizaciones.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Intereses Pagados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${totalIntereses.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Cargos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalCargos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tarjetas de Crédito - Sección especial */}
      {financiamientos.filter(f => f.tipo_credito === 'tarjeta_corporativa').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tarjetas de Crédito Corporativas</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {financiamientos
                .filter(f => f.tipo_credito === 'tarjeta_corporativa')
                .map((tarjeta) => (
                  <AccordionItem key={tarjeta.id} value={tarjeta.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between items-center w-full pr-4">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{tarjeta.nombre}</span>
                          <span className="text-sm text-muted-foreground">{tarjeta.institucion_financiera}</span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Límite: </span>
                            <span className="font-medium">${tarjeta.monto_total.toLocaleString('es-MX')}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Utilizado: </span>
                            <span className="font-medium">${tarjeta.saldo_actual.toLocaleString('es-MX')}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Disponible: </span>
                            <span className="font-medium text-success">
                              ${(tarjeta.monto_total - tarjeta.saldo_actual).toLocaleString('es-MX')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <TransaccionesTarjetaCredito 
                        financiamientoId={tarjeta.id}
                        nombreTarjeta={tarjeta.nombre}
                        limiteCredito={tarjeta.monto_total}
                        saldoActual={tarjeta.saldo_actual}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Líneas de Crédito Revolventes */}
      {financiamientos.filter(f => f.tipo_credito === 'revolvente').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Líneas de Crédito Revolventes</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {financiamientos
                .filter(f => f.tipo_credito === 'revolvente')
                .map((financiamiento) => (
                  <AccordionItem key={financiamiento.id} value={financiamiento.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between items-center w-full pr-4">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{financiamiento.nombre}</span>
                          <span className="text-sm text-muted-foreground">{financiamiento.institucion_financiera}</span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Línea Aprobada: </span>
                            <span className="font-medium">${financiamiento.monto_total.toLocaleString('es-MX')}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Monto Utilizado: </span>
                            <span className="font-medium text-destructive">
                              ${financiamiento.saldo_actual.toLocaleString('es-MX')}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Disponible: </span>
                            <span className="font-medium text-success">
                              ${(financiamiento.monto_total - financiamiento.saldo_actual).toLocaleString('es-MX')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <TransaccionesFinanciamiento 
                        financiamientoId={financiamiento.id}
                        nombreFinanciamiento={financiamiento.nombre}
                        montoTotal={financiamiento.monto_total}
                        saldoActual={financiamiento.saldo_actual}
                        saldoInicial={financiamiento.saldo_inicial}
                        tipoCredito={financiamiento.tipo_credito}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Créditos Simples (no revolventes ni tarjetas) */}
      {financiamientos.filter(f => f.tipo_credito !== 'tarjeta_corporativa' && f.tipo_credito !== 'revolvente').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Créditos Simples</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {financiamientos
                .filter(f => f.tipo_credito !== 'tarjeta_corporativa' && f.tipo_credito !== 'revolvente')
                .map((financiamiento) => (
                  <AccordionItem key={financiamiento.id} value={financiamiento.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between items-center w-full pr-4">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{financiamiento.nombre}</span>
                          <span className="text-sm text-muted-foreground">{financiamiento.institucion_financiera}</span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Monto Original: </span>
                            <span className="font-medium">${financiamiento.monto_total.toLocaleString('es-MX')}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Amortizado: </span>
                            <span className="font-medium text-success">
                              ${(financiamiento.monto_total - financiamiento.saldo_actual).toLocaleString('es-MX')}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pendiente: </span>
                            <span className="font-medium text-destructive">
                              ${financiamiento.saldo_actual.toLocaleString('es-MX')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <TransaccionesFinanciamiento 
                        financiamientoId={financiamiento.id}
                        nombreFinanciamiento={financiamiento.nombre}
                        montoTotal={financiamiento.monto_total}
                        saldoActual={financiamiento.saldo_actual}
                        saldoInicial={financiamiento.saldo_inicial}
                        tipoCredito={financiamiento.tipo_credito}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResumenFinanciamientos;
