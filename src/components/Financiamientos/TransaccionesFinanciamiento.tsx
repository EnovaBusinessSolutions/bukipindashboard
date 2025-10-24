import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DollarSign, FileText, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

interface TransaccionesFinanciamientoProps {
  financiamientoId: string;
  nombreFinanciamiento: string;
  montoTotal: number;
  saldoActual: number;
  saldoInicial: number;
}

const TransaccionesFinanciamiento = ({ 
  financiamientoId, 
  nombreFinanciamiento,
  montoTotal,
  saldoActual,
  saldoInicial 
}: TransaccionesFinanciamientoProps) => {
  const [detalleAsientoOpen, setDetalleAsientoOpen] = useState(false);
  const [asientoSeleccionado, setAsientoSeleccionado] = useState<any>(null);
  
  // Obtener transacciones del financiamiento
  const { data: transacciones, isLoading } = useQuery({
    queryKey: ["transacciones-financiamiento", financiamientoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("transacciones_financiamientos")
        .select("*")
        .eq("financiamiento_id", financiamientoId)
        .order("fecha", { ascending: false });

      return data || [];
    }
  });

  // Obtener asientos contables relacionados
  const { data: asientosContables } = useQuery({
    queryKey: ["asientos-financiamiento", financiamientoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("asientos_contables")
        .select(`
          *,
          detalle_asientos (
            *,
            cuentas:cuenta_codigo (
              codigo,
              nombre
            )
          )
        `)
        .ilike("descripcion", `%${nombreFinanciamiento}%`)
        .order("fecha", { ascending: false });

      return data || [];
    }
  });

  const handleVerAsiento = (transaccion: any) => {
    // Buscar el asiento relacionado con esta transacción
    const asiento = asientosContables?.find(a => 
      a.fecha === transaccion.fecha &&
      (a.descripcion.includes(transaccion.tipo_transaccion) || 
       a.descripcion.includes(nombreFinanciamiento))
    );
    
    if (asiento) {
      setAsientoSeleccionado(asiento);
      setDetalleAsientoOpen(true);
    }
  };

  const montoAmortizado = saldoInicial - saldoActual;
  const porcentajePagado = saldoInicial > 0 ? (montoAmortizado / saldoInicial) * 100 : 0;

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      desembolso: "Desembolso Inicial",
      amortizacion: "Amortización",
      cargo_interes: "Cargo por Interés",
    };
    return labels[tipo] || tipo;
  };

  const getTipoVariant = (tipo: string): "default" | "secondary" | "destructive" => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      desembolso: "secondary",
      amortizacion: "default",
      cargo_interes: "destructive",
    };
    return variants[tipo] || "default";
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Monto Original
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${montoTotal.toLocaleString('es-MX')}</div>
            <p className="text-xs text-muted-foreground mt-1">Préstamo total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Amortizado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${montoAmortizado.toLocaleString('es-MX')}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {porcentajePagado.toFixed(1)}% pagado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Saldo Pendiente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${saldoActual.toLocaleString('es-MX')}</div>
            <p className="text-xs text-muted-foreground mt-1">Por pagar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Transacciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transacciones?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Registros</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de transacciones */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones de {nombreFinanciamiento}</CardTitle>
          <CardDescription>
            Historial de desembolsos, amortizaciones y cargos por interés
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando transacciones...</div>
          ) : !transacciones || transacciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay transacciones registradas para este financiamiento
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Capital</TableHead>
                  <TableHead className="text-right">Interés</TableHead>
                  <TableHead className="text-right">Saldo Restante</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Asiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transacciones.map((transaccion) => (
                  <TableRow key={transaccion.id}>
                    <TableCell>
                      {format(new Date(transaccion.fecha), "dd MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTipoVariant(transaccion.tipo_transaccion)}>
                        {getTipoLabel(transaccion.tipo_transaccion)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${transaccion.monto.toLocaleString('es-MX')}
                    </TableCell>
                    <TableCell className="text-right">
                      ${transaccion.capital_pagado.toLocaleString('es-MX')}
                    </TableCell>
                    <TableCell className="text-right">
                      ${transaccion.interes_pagado.toLocaleString('es-MX')}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${transaccion.saldo_restante.toLocaleString('es-MX')}
                    </TableCell>
                    <TableCell>{transaccion.metodo_pago || "-"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleVerAsiento(transaccion)}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para ver detalle del asiento contable */}
      <Dialog open={detalleAsientoOpen} onOpenChange={setDetalleAsientoOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalle del Asiento Contable</DialogTitle>
            <DialogDescription>
              Registro contable de la transacción
            </DialogDescription>
          </DialogHeader>

          {asientoSeleccionado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Número de Asiento</p>
                  <p className="font-semibold">{asientoSeleccionado.numero_asiento}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="font-semibold">
                    {format(new Date(asientoSeleccionado.fecha), "dd MMM yyyy", { locale: es })}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Descripción</p>
                  <p className="font-medium">{asientoSeleccionado.descripcion}</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detalle de Movimientos</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Debe</TableHead>
                        <TableHead className="text-right">Haber</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {asientoSeleccionado.detalle_asientos?.map((detalle: any) => (
                        <TableRow key={detalle.id}>
                          <TableCell className="font-medium">
                            {detalle.cuenta_codigo} - {detalle.cuentas?.nombre || 'N/A'}
                          </TableCell>
                          <TableCell>{detalle.descripcion}</TableCell>
                          <TableCell className="text-right font-medium text-success">
                            {detalle.debe > 0 ? `$${detalle.debe.toLocaleString('es-MX')}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {detalle.haber > 0 ? `$${detalle.haber.toLocaleString('es-MX')}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted">
                        <TableCell colSpan={2}>TOTALES</TableCell>
                        <TableCell className="text-right text-success">
                          ${asientoSeleccionado.detalle_asientos
                            ?.reduce((sum: number, d: any) => sum + d.debe, 0)
                            .toLocaleString('es-MX')}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          ${asientoSeleccionado.detalle_asientos
                            ?.reduce((sum: number, d: any) => sum + d.haber, 0)
                            .toLocaleString('es-MX')}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransaccionesFinanciamiento;
