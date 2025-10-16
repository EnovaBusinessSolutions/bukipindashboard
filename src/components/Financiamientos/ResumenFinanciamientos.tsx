import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const ResumenFinanciamientos = () => {
  const { transacciones, financiamientos, isLoading } = useFinanciamientos();

  const getTipoTransaccionLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      amortizacion: "Amortización",
      cargo_interes: "Cargo por Interés",
      desembolso: "Desembolso",
    };
    return labels[tipo] || tipo;
  };

  const getTipoTransaccionVariant = (tipo: string) => {
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

      <Card>
        <CardHeader>
          <CardTitle>Historial de Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Financiamiento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Capital</TableHead>
                <TableHead className="text-right">Interés</TableHead>
                <TableHead className="text-right">Saldo Restante</TableHead>
                <TableHead>Método</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transacciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No hay transacciones registradas
                  </TableCell>
                </TableRow>
              ) : (
                transacciones.map((transaccion) => (
                  <TableRow key={transaccion.id}>
                    <TableCell>{format(new Date(transaccion.fecha), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium">
                      {getFinanciamientoNombre(transaccion.financiamiento_id)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTipoTransaccionVariant(transaccion.tipo_transaccion)}>
                        {getTipoTransaccionLabel(transaccion.tipo_transaccion)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${transaccion.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      ${transaccion.capital_pagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      ${transaccion.interes_pagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      ${transaccion.saldo_restante.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{transaccion.metodo_pago || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumenFinanciamientos;
