import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CreditCard, TrendingUp, Calendar, Eye, AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";

interface TransaccionesTarjetaCreditoProps {
  financiamientoId: string;
  nombreTarjeta: string;
  limiteCredito: number;
  saldoActual: number;
}

type TxKind = "egreso" | "capex" | "amortizacion" | "cargo_interes" | "desembolso";

type TxTarjeta = {
  id: string;
  fecha: string; // ISO
  descripcion: string;
  monto: number;
  tipo: TxKind;
  proveedor: string | null;

  // para UI
  tipoTransaccion: "cargo" | "amortizacion" | "cargo_interes" | "desembolso";
  estado: "activo" | "cancelado" | string;
  fechaCancelacion: string | null;
  motivoCancelacion: string | null;

  // detalle libre (para dialog)
  detalle: any;
};

const API_TARJETA_TX = (financiamientoId: string) =>
  `/api/financiamientos/${encodeURIComponent(financiamientoId)}/tarjeta/transacciones`;

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    throw new Error(json?.error || json?.message || `Error HTTP ${res.status}`);
  }

  return (json?.data ?? json) as T;
}

const TransaccionesTarjetaCredito = ({
  financiamientoId,
  nombreTarjeta,
  limiteCredito,
  saldoActual,
}: TransaccionesTarjetaCreditoProps) => {
  const [selectedTransaction, setSelectedTransaction] = useState<TxTarjeta | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);

  const { data: transacciones = [], isLoading, error } = useQuery({
    queryKey: ["transacciones-tarjeta", financiamientoId],
    enabled: !!financiamientoId,
    queryFn: async () => {
      // Backend ya regresa la lista unificada y ordenada
      return await fetchJSON<TxTarjeta[]>(API_TARJETA_TX(financiamientoId));
    },
  });

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      amortizacion: "Pago de Tarjeta",
      cargo_interes: "Cargo por Intereses",
      desembolso: "Disposición",
      egreso: "Egreso",
      capex: "CAPEX",
    };
    return labels[tipo] || tipo;
  };

  const handleVerDetalle = (tx: TxTarjeta) => {
    setSelectedTransaction(tx);
    setDetalleOpen(true);
  };

  const getCuentasAfectadas = (tx: TxTarjeta) => {
    if (tx.tipoTransaccion === "cargo") {
      // Cargo a la tarjeta (egreso o capex)
      return {
        cargo: tx.detalle?.cuenta_codigo || "Cuenta de gasto/inversión",
        abono: `2101 - Préstamos Bancarios LP (${nombreTarjeta})`,
      };
    } else if (tx.tipoTransaccion === "amortizacion") {
      return {
        cargo: `2101 - Préstamos Bancarios LP (${nombreTarjeta})`,
        abono: tx.detalle?.metodo_pago === "efectivo" ? "1001 - Efectivo" : "1002 - Bancos",
      };
    } else if (tx.tipoTransaccion === "cargo_interes") {
      return {
        cargo: "5201 - Gastos Financieros",
        abono: `2101 - Préstamos Bancarios LP (${nombreTarjeta})`,
      };
    }
    return { cargo: "N/A", abono: "N/A" };
  };

  const limiteDisponible = limiteCredito - saldoActual;
  const porcentajeUso = limiteCredito > 0 ? (saldoActual / limiteCredito) * 100 : 0;

  const cargosCancelados = useMemo(() => {
    return (
      transacciones
        .filter((t) => t.estado === "cancelado" && (t.tipo === "egreso" || t.tipo === "capex"))
        .reduce((sum, t) => sum + (Number(t.monto) || 0), 0) || 0
    );
  }, [transacciones]);

  const errorMsg = (error as any)?.message || null;

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
            <div className="text-2xl font-bold">${limiteCredito.toLocaleString("es-MX")}</div>
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
            <div className="text-2xl font-bold text-destructive">${saldoActual.toLocaleString("es-MX")}</div>
            <p className="text-xs text-muted-foreground mt-1">{porcentajeUso.toFixed(1)}% del límite</p>
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
            <div className="text-2xl font-bold text-success">${limiteDisponible.toLocaleString("es-MX")}</div>
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
              ${cargosCancelados.toLocaleString("es-MX")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Revertidos (impacto: $0)</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones de {nombreTarjeta}</CardTitle>
          <CardDescription>Historial completo de compras, pagos y transacciones canceladas</CardDescription>
        </CardHeader>
        <CardContent>
          {errorMsg ? (
            <div className="text-center py-8 text-destructive">{errorMsg}</div>
          ) : isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando transacciones...</div>
          ) : transacciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay transacciones registradas con esta tarjeta</div>
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
                {transacciones.map((t) => (
                  <TableRow
                    key={t.id}
                    className={t.estado === "cancelado" ? "bg-red-50 dark:bg-red-950/20" : ""}
                  >
                    <TableCell>{format(new Date(t.fecha), "dd MMM yyyy", { locale: es })}</TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{t.descripcion}</span>
                        {t.estado === "cancelado" && (
                          <Badge variant="destructive" className="w-fit text-xs">
                            CANCELADO
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>{t.proveedor || "-"}</TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          t.estado === "cancelado"
                            ? "outline"
                            : t.tipo === "egreso"
                            ? "secondary"
                            : t.tipo === "capex"
                            ? "default"
                            : t.tipo === "amortizacion"
                            ? "default"
                            : "destructive"
                        }
                      >
                        {getTipoLabel(t.tipo)}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      {t.estado === "cancelado" ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          $0 (revertido)
                        </Badge>
                      ) : t.tipoTransaccion === "amortizacion" ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          -${Number(t.monto || 0).toLocaleString("es-MX")}
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          +${Number(t.monto || 0).toLocaleString("es-MX")}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right font-medium">
                      <span className={t.estado === "cancelado" ? "line-through text-muted-foreground" : ""}>
                        ${Number(t.monto || 0).toLocaleString("es-MX")}
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" onClick={() => handleVerDetalle(t)}>
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

      {/* Dialog detalle */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Transacción</DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              {selectedTransaction.estado === "cancelado" && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 dark:text-red-100">Transacción Cancelada</h4>
                      {selectedTransaction.fechaCancelacion && (
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          Esta transacción fue cancelada el{" "}
                          {format(new Date(selectedTransaction.fechaCancelacion), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                        </p>
                      )}
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
                  <Badge
                    variant={
                      selectedTransaction.tipo === "egreso"
                        ? "secondary"
                        : selectedTransaction.tipo === "capex"
                        ? "default"
                        : selectedTransaction.tipo === "amortizacion"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {getTipoLabel(selectedTransaction.tipo)}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Descripción</p>
                  <p className="font-medium">{selectedTransaction.descripcion}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Monto</p>
                  <p className="font-medium text-lg">
                    ${Number(selectedTransaction.monto || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {selectedTransaction.proveedor && (
                  <div>
                    <p className="text-sm text-muted-foreground">Proveedor</p>
                    <p className="font-medium">{selectedTransaction.proveedor}</p>
                  </div>
                )}

                {selectedTransaction.tipo === "amortizacion" && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Capital Pagado</p>
                      <p className="font-medium">
                        ${Number(selectedTransaction.detalle?.capital_pagado || 0).toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interés Pagado</p>
                      <p className="font-medium">
                        ${Number(selectedTransaction.detalle?.interes_pagado || 0).toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Método de Pago</p>
                      <p className="font-medium">
                        {selectedTransaction.detalle?.metodo_pago === "efectivo" ? "Efectivo" : "Transferencia/Bancos"}
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
                        $
                        {Number(
                          selectedTransaction.tipoTransaccion === "amortizacion"
                            ? (Number(selectedTransaction.detalle?.capital_pagado || 0) +
                                Number(selectedTransaction.detalle?.interes_pagado || 0))
                            : selectedTransaction.monto
                        ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right py-2">-</td>
                    </TableRow>

                    <TableRow>
                      <td className="font-medium py-2">{getCuentasAfectadas(selectedTransaction).abono}</td>
                      <td className="text-right py-2">-</td>
                      <td className="text-right py-2 text-success">
                        $
                        {Number(
                          selectedTransaction.tipoTransaccion === "amortizacion"
                            ? (Number(selectedTransaction.detalle?.capital_pagado || 0) +
                                Number(selectedTransaction.detalle?.interes_pagado || 0))
                            : selectedTransaction.monto
                        ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </td>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {selectedTransaction.detalle?.comentarios && (
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
