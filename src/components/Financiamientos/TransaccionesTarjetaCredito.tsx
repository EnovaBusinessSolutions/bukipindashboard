import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, Calendar, CreditCard, Eye, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TransaccionesTarjetaCreditoProps {
  financiamientoId: string;
  nombreTarjeta: string;
  limiteCredito: number;
  saldoActual: number;
}

type TxTarjeta = {
  id: string;
  _id?: string;
  fecha?: string;
  descripcion?: string;
  monto?: number;
  tipo?: string;
  proveedor?: string | null;

  tipoTransaccion?: string;
  estado?: string;
  fechaCancelacion?: string | null;
  motivoCancelacion?: string | null;

  detalle?: any;
  asiento?: any;
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

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const formatMoney = (v: number) =>
  `$${toNum(v, 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const parseSafeDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getTipo = (tx: TxTarjeta) =>
  String(tx.tipo || tx.tipoTransaccion || "").toLowerCase();

const getEstado = (tx: TxTarjeta) =>
  String(tx.estado || "activo").toLowerCase();

const getMonto = (tx: TxTarjeta) =>
  toNum(tx.monto, 0);

const getCapitalPagado = (tx: TxTarjeta) =>
  toNum(
    tx.detalle?.monto_capital ??
      tx.detalle?.montoCapital ??
      tx.detalle?.capital_pagado,
    0
  );

const getInteresPagado = (tx: TxTarjeta) =>
  toNum(
    tx.detalle?.monto_intereses ??
      tx.detalle?.montoIntereses ??
      tx.detalle?.interes_pagado,
    0
  );

const getMetodoPago = (tx: TxTarjeta) =>
  tx.detalle?.metodo_pago || tx.detalle?.metodoPago || "";

const TransaccionesTarjetaCredito = ({
  financiamientoId,
  nombreTarjeta,
  limiteCredito,
  saldoActual,
}: TransaccionesTarjetaCreditoProps) => {
  const [selectedTransaction, setSelectedTransaction] = useState<TxTarjeta | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);

  const {
    data: transacciones = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["transacciones-tarjeta", financiamientoId],
    enabled: !!financiamientoId,
    queryFn: async () => {
      return await fetchJSON<TxTarjeta[]>(API_TARJETA_TX(financiamientoId));
    },
  });

  const getTipoLabel = (tipoRaw: string) => {
    const tipo = String(tipoRaw || "").toLowerCase();
    const labels: Record<string, string> = {
      amortizacion: "Pago de Tarjeta",
      cargo_intereses: "Cargo por Intereses",
      cargo_interes: "Cargo por Interés",
      desembolso: "Disposición",
      egreso: "Egreso",
      capex: "CAPEX",
      compra: "Compra",
    };
    return labels[tipo] || tipoRaw || "Movimiento";
  };

  const getTipoBadgeVariant = (tx: TxTarjeta): "default" | "secondary" | "destructive" | "outline" => {
    const estado = getEstado(tx);
    const tipo = getTipo(tx);

    if (estado === "cancelado") return "outline";
    if (tipo === "amortizacion") return "default";
    if (tipo === "cargo_intereses" || tipo === "cargo_interes") return "destructive";
    if (tipo === "capex") return "default";
    return "secondary";
  };

  const handleVerDetalle = (tx: TxTarjeta) => {
    setSelectedTransaction(tx);
    setDetalleOpen(true);
  };

  const getCuentasAfectadas = (tx: TxTarjeta) => {
    const tipo = getTipo(tx);
    const metodoPago = String(getMetodoPago(tx)).toLowerCase();

    if (tipo === "egreso" || tipo === "capex" || tipo === "compra") {
      return {
        cargo:
          tx.detalle?.cuenta_codigo ||
          tx.detalle?.cuentaCodigo ||
          "Cuenta de gasto / inversión",
        abono: `2101 - Financiamientos (${nombreTarjeta})`,
      };
    }

    if (tipo === "amortizacion") {
      return {
        cargo: `2101 - Financiamientos (${nombreTarjeta})`,
        abono: metodoPago === "efectivo" ? "1001 - Caja" : "1002 - Bancos",
      };
    }

    if (tipo === "cargo_intereses" || tipo === "cargo_interes") {
      return {
        cargo: "5201 - Gastos Financieros",
        abono: `2101 - Financiamientos (${nombreTarjeta})`,
      };
    }

    if (tipo === "desembolso") {
      return {
        cargo: metodoPago === "efectivo" ? "1001 - Caja" : "1002 - Bancos",
        abono: `2101 - Financiamientos (${nombreTarjeta})`,
      };
    }

    return { cargo: "N/A", abono: "N/A" };
  };

  const limiteDisponible = Math.max(0, limiteCredito - saldoActual);
  const porcentajeUso = limiteCredito > 0 ? (saldoActual / limiteCredito) * 100 : 0;

  const cargosCancelados = useMemo(() => {
    return (
      transacciones
        .filter((t) => getEstado(t) === "cancelado" && ["egreso", "capex", "compra"].includes(getTipo(t)))
        .reduce((sum, t) => sum + getMonto(t), 0) || 0
    );
  }, [transacciones]);

  const errorMsg = (error as any)?.message || null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Límite de Crédito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(limiteCredito)}</div>
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
            <div className="text-2xl font-bold text-destructive">{formatMoney(saldoActual)}</div>
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
            <div className="text-2xl font-bold text-green-600">{formatMoney(limiteDisponible)}</div>
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
              {formatMoney(cargosCancelados)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Revertidos (impacto: $0)</p>
          </CardContent>
        </Card>
      </div>

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
                {transacciones.map((t) => {
                  const fecha = parseSafeDate(t.fecha);
                  const tipo = getTipo(t);
                  const estado = getEstado(t);
                  const monto = getMonto(t);

                  const esCancelado = estado === "cancelado";
                  const esPago = tipo === "amortizacion";

                  return (
                    <TableRow
                      key={t.id || t._id}
                      className={esCancelado ? "bg-red-50 dark:bg-red-950/20" : ""}
                    >
                      <TableCell>
                        {fecha ? format(fecha, "dd MMM yyyy", { locale: es }) : "-"}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{t.descripcion || "Sin descripción"}</span>
                          {esCancelado && (
                            <Badge variant="destructive" className="w-fit text-xs">
                              CANCELADO
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>{t.proveedor || "-"}</TableCell>

                      <TableCell>
                        <Badge variant={getTipoBadgeVariant(t)}>
                          {getTipoLabel(tipo)}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        {esCancelado ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            $0.00 (revertido)
                          </Badge>
                        ) : esPago ? (
                          <span className="text-green-600 font-medium">
                            -{formatMoney(monto)}
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium">
                            +{formatMoney(monto)}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        <span className={esCancelado ? "line-through text-muted-foreground" : ""}>
                          {formatMoney(monto)}
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => handleVerDetalle(t)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Transacción</DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              {getEstado(selectedTransaction) === "cancelado" && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 dark:text-red-100">
                        Transacción Cancelada
                      </h4>

                      {parseSafeDate(selectedTransaction.fechaCancelacion) && (
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          Esta transacción fue cancelada el{" "}
                          {format(parseSafeDate(selectedTransaction.fechaCancelacion) as Date, "dd 'de' MMMM 'de' yyyy", { locale: es })}
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
                    {parseSafeDate(selectedTransaction.fecha)
                      ? format(parseSafeDate(selectedTransaction.fecha) as Date, "dd 'de' MMMM 'de' yyyy", { locale: es })
                      : "-"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <Badge variant={getTipoBadgeVariant(selectedTransaction)}>
                    {getTipoLabel(getTipo(selectedTransaction))}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Descripción</p>
                  <p className="font-medium">{selectedTransaction.descripcion || "Sin descripción"}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Monto</p>
                  <p className="font-medium text-lg">
                    {formatMoney(getMonto(selectedTransaction))}
                  </p>
                </div>

                {selectedTransaction.proveedor && (
                  <div>
                    <p className="text-sm text-muted-foreground">Proveedor</p>
                    <p className="font-medium">{selectedTransaction.proveedor}</p>
                  </div>
                )}

                {getTipo(selectedTransaction) === "amortizacion" && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Capital Pagado</p>
                      <p className="font-medium">{formatMoney(getCapitalPagado(selectedTransaction))}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Interés Pagado</p>
                      <p className="font-medium">{formatMoney(getInteresPagado(selectedTransaction))}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Método de Pago</p>
                      <p className="font-medium">
                        {getMetodoPago(selectedTransaction) === "efectivo"
                          ? "Efectivo"
                          : getMetodoPago(selectedTransaction)
                          ? "Transferencia/Bancos"
                          : "-"}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-3">Afectación Contable Estimada</h4>

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
                      <td className="font-medium py-2">
                        {getCuentasAfectadas(selectedTransaction).cargo}
                      </td>
                      <td className="text-right py-2 text-destructive">
                        {formatMoney(
                          getTipo(selectedTransaction) === "amortizacion"
                            ? getCapitalPagado(selectedTransaction) + getInteresPagado(selectedTransaction)
                            : getMonto(selectedTransaction)
                        )}
                      </td>
                      <td className="text-right py-2">-</td>
                    </TableRow>

                    <TableRow>
                      <td className="font-medium py-2">
                        {getCuentasAfectadas(selectedTransaction).abono}
                      </td>
                      <td className="text-right py-2">-</td>
                      <td className="text-right py-2 text-green-600">
                        {formatMoney(
                          getTipo(selectedTransaction) === "amortizacion"
                            ? getCapitalPagado(selectedTransaction) + getInteresPagado(selectedTransaction)
                            : getMonto(selectedTransaction)
                        )}
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