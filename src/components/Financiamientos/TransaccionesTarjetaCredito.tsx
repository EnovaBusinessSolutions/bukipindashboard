import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CreditCard, TrendingUp, Calendar, Eye, AlertCircle } from "lucide-react";
import { useState } from "react";

interface TransaccionesTarjetaCreditoProps {
  financiamientoId: string;
  nombreTarjeta: string;
  limiteCredito: number;
  saldoActual: number;
}

const TransaccionesTarjetaCredito = ({ 
  financiamientoId, 
  nombreTarjeta,
  limiteCredito,
  saldoActual 
}: TransaccionesTarjetaCreditoProps) => {
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  
  // Obtener todas las transacciones donde se usó esta tarjeta
  const { data: transacciones, isLoading } = useQuery({
    queryKey: ["transacciones-tarjeta", financiamientoId],
    queryFn: async () => {
      const metodoPagoBuscar = `tarjeta_credito_${financiamientoId}`;
      
      // Buscar en transacciones_egresos
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .eq("metodo_pago", metodoPagoBuscar)
        .order("created_at", { ascending: false });

      // Buscar en inversiones_capex
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("*")
        .eq("metodo_pago", metodoPagoBuscar)
        .order("created_at", { ascending: false });

      // Buscar transacciones del financiamiento (amortizaciones, cargos de interés, etc.)
      const { data: transaccionesFinanciamiento } = await supabase
        .from("transacciones_financiamientos")
        .select("*")
        .eq("financiamiento_id", financiamientoId)
        .order("fecha", { ascending: false });

      const todasTransacciones = [
        ...(egresos || []).map(e => ({
          id: e.id,
          fecha: e.created_at,
          descripcion: e.descripcion,
          monto: e.monto_pagado,
          tipo: 'egreso' as const,
          proveedor: e.proveedor_nombre,
          detalle: e,
          tipoTransaccion: 'cargo',
          estado: e.estado,
          fechaCancelacion: e.fecha_cancelacion,
          motivoCancelacion: e.motivo_cancelacion
        })),
        ...(inversiones || []).map(i => ({
          id: i.id,
          fecha: i.fecha_adquisicion,
          descripcion: i.producto_nombre,
          monto: i.monto_pagado,
          tipo: 'capex' as const,
          proveedor: i.proveedor_nombre,
          detalle: i,
          tipoTransaccion: 'cargo',
          estado: i.estado,
          fechaCancelacion: i.fecha_baja,
          motivoCancelacion: i.motivo_baja
        })),
        ...(transaccionesFinanciamiento || []).map(t => ({
          id: t.id,
          fecha: t.fecha,
          descripcion: t.tipo_transaccion === 'amortizacion' && t.capital_pagado > 0 && t.interes_pagado > 0
            ? `Pago de Tarjeta: $${t.capital_pagado.toLocaleString('es-MX')} capital + $${t.interes_pagado.toLocaleString('es-MX')} interés`
            : t.descripcion || getTipoLabel(t.tipo_transaccion),
          monto: t.monto,
          tipo: t.tipo_transaccion,
          proveedor: null,
          detalle: t,
          tipoTransaccion: t.tipo_transaccion,
          estado: 'activo',
          fechaCancelacion: null,
          motivoCancelacion: null
        }))
      ];

      return todasTransacciones.sort((a, b) => 
        new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );
    }
  });

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      amortizacion: "Pago de Tarjeta",
      cargo_interes: "Cargo por Intereses",
      desembolso: "Disposición",
    };
    return labels[tipo] || tipo;
  };

  const handleVerDetalle = (transaccion: any) => {
    setSelectedTransaction(transaccion);
    setDetalleOpen(true);
  };

  const getCuentasAfectadas = (transaccion: any) => {
    if (transaccion.tipoTransaccion === 'cargo') {
      // Cargo a la tarjeta (egreso o capex)
      return {
        cargo: transaccion.detalle.cuenta_codigo || "Cuenta de gasto/inversión",
        abono: `2101 - Préstamos Bancarios LP (${nombreTarjeta})`
      };
    } else if (transaccion.tipoTransaccion === 'amortizacion') {
      // Pago de tarjeta
      return {
        cargo: `2101 - Préstamos Bancarios LP (${nombreTarjeta})`,
        abono: transaccion.detalle.metodo_pago === 'efectivo' ? '1001 - Efectivo' : '1002 - Bancos'
      };
    } else if (transaccion.tipoTransaccion === 'cargo_interes') {
      // Cargo por intereses
      return {
        cargo: '5201 - Gastos Financieros',
        abono: `2101 - Préstamos Bancarios LP (${nombreTarjeta})`
      };
    }
    return { cargo: 'N/A', abono: 'N/A' };
  };

  const limiteDisponible = limiteCredito - saldoActual;
  const porcentajeUso = (saldoActual / limiteCredito) * 100;

  // Calcular cargos cancelados para el resumen
  const cargosCancelados = transacciones?.filter(t => 
    t.estado === 'cancelado' && (t.tipo === 'egreso' || t.tipo === 'capex')
  ).reduce((sum, t) => sum + t.monto, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Límite de Crédito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${limiteCredito.toLocaleString('es-MX')}</div>
            <p className="text-xs text-muted-foreground mt-1">Línea aprobada</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Saldo Utilizado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${saldoActual.toLocaleString('es-MX')}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {porcentajeUso.toFixed(1)}% del límite
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Crédito Disponible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${limiteDisponible.toLocaleString('es-MX')}</div>
            <p className="text-xs text-muted-foreground mt-1">Puede utilizar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Cargos Cancelados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              ${cargosCancelados.toLocaleString('es-MX')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revertidos (impacto: $0)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de transacciones */}
      <Card>
      <CardHeader>
        <CardTitle>Transacciones de {nombreTarjeta}</CardTitle>
        <CardDescription>
          Historial completo de compras, pagos y transacciones canceladas
        </CardDescription>
      </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando transacciones...</div>
          ) : !transacciones || transacciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay transacciones registradas con esta tarjeta
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Impacto en Saldo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transacciones.map((transaccion) => (
                  <TableRow 
                    key={transaccion.id}
                    className={transaccion.estado === 'cancelado' ? 'bg-red-50 dark:bg-red-950/20' : ''}
                  >
                    <TableCell>
                      {format(new Date(transaccion.fecha), "dd MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{transaccion.descripcion}</span>
                        {transaccion.estado === 'cancelado' && (
                          <Badge variant="destructive" className="w-fit text-xs">
                            CANCELADO
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  <TableCell>{transaccion.proveedor || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={
                      transaccion.estado === 'cancelado' ? 'outline' :
                      transaccion.tipo === 'egreso' ? 'secondary' : 
                      transaccion.tipo === 'capex' ? 'default' :
                      transaccion.tipo === 'amortizacion' ? 'default' :
                      'destructive'
                    }>
                      {transaccion.tipo === 'egreso' ? 'Egreso' : 
                       transaccion.tipo === 'capex' ? 'CAPEX' :
                       transaccion.tipo === 'amortizacion' ? 'Pago' :
                       transaccion.tipo === 'cargo_interes' ? 'Interés' : transaccion.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {transaccion.estado === 'cancelado' ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        $0 (revertido)
                      </Badge>
                    ) : transaccion.tipoTransaccion === 'amortizacion' ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        -${transaccion.monto.toLocaleString('es-MX')}
                      </span>
                    ) : transaccion.tipoTransaccion === 'cargo_interes' ? (
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        +${transaccion.monto.toLocaleString('es-MX')}
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        +${transaccion.monto.toLocaleString('es-MX')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={transaccion.estado === 'cancelado' ? 'line-through text-muted-foreground' : ''}>
                      ${transaccion.monto.toLocaleString('es-MX')}
                    </span>
                  </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleVerDetalle(transaccion)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de detalle de transacción */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Transacción</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              {/* Indicador de cancelación prominente */}
              {selectedTransaction.estado === 'cancelado' && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 dark:text-red-100">
                        Transacción Cancelada
                      </h4>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        Esta transacción fue cancelada el{' '}
                        {format(new Date(selectedTransaction.fechaCancelacion), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                      </p>
                      {selectedTransaction.motivoCancelacion && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                          <strong>Motivo:</strong> {selectedTransaction.motivoCancelacion}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">
                        El saldo de la tarjeta fue revertido automáticamente.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="font-medium">
                    {format(new Date(selectedTransaction.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <Badge variant={
                    selectedTransaction.tipo === 'egreso' ? 'secondary' : 
                    selectedTransaction.tipo === 'capex' ? 'default' :
                    selectedTransaction.tipo === 'amortizacion' ? 'default' :
                    'destructive'
                  }>
                    {selectedTransaction.tipo === 'egreso' ? 'Egreso' : 
                     selectedTransaction.tipo === 'capex' ? 'CAPEX' :
                     selectedTransaction.tipo === 'amortizacion' ? 'Pago de Tarjeta' :
                     selectedTransaction.tipo === 'cargo_interes' ? 'Cargo por Intereses' : selectedTransaction.tipo}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Descripción</p>
                  <p className="font-medium">{selectedTransaction.descripcion}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monto</p>
                  <p className="font-medium text-lg">
                    ${selectedTransaction.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {selectedTransaction.proveedor && (
                  <div>
                    <p className="text-sm text-muted-foreground">Proveedor</p>
                    <p className="font-medium">{selectedTransaction.proveedor}</p>
                  </div>
                )}
                {selectedTransaction.tipo === 'amortizacion' && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Capital Pagado</p>
                      <p className="font-medium">
                        ${selectedTransaction.detalle.capital_pagado?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interés Pagado</p>
                      <p className="font-medium">
                        ${selectedTransaction.detalle.interes_pagado?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Método de Pago</p>
                      <p className="font-medium">
                        {selectedTransaction.detalle.metodo_pago === 'efectivo' ? 'Efectivo' : 'Transferencia/Bancos'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-3">Afectación Contable</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuenta</TableHead>
                      <TableHead className="text-right">Cargo (Debe)</TableHead>
                      <TableHead className="text-right">Abono (Haber)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <td className="font-medium py-2">{getCuentasAfectadas(selectedTransaction).cargo}</td>
                      <td className="text-right py-2 text-destructive">
                        ${(selectedTransaction.tipoTransaccion === 'amortizacion' 
                          ? (selectedTransaction.detalle.capital_pagado || 0) + (selectedTransaction.detalle.interes_pagado || 0)
                          : selectedTransaction.monto
                        ).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right py-2">-</td>
                    </TableRow>
                    <TableRow>
                      <td className="font-medium py-2">{getCuentasAfectadas(selectedTransaction).abono}</td>
                      <td className="text-right py-2">-</td>
                      <td className="text-right py-2 text-success">
                        ${(selectedTransaction.tipoTransaccion === 'amortizacion' 
                          ? (selectedTransaction.detalle.capital_pagado || 0) + (selectedTransaction.detalle.interes_pagado || 0)
                          : selectedTransaction.monto
                        ).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {selectedTransaction.detalle.comentarios && (
                <div>
                  <p className="text-sm text-muted-foreground">Comentarios</p>
                  <p className="text-sm">{selectedTransaction.detalle.comentarios}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransaccionesTarjetaCredito;
