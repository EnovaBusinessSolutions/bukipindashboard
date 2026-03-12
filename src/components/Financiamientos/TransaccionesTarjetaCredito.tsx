import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  Calendar,
  CreditCard,
  Eye,
  TrendingUp,
  Wallet,
  ReceiptText,
  XCircle,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

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
    json = null;
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

const asText = (v: unknown, def = "") => {
  if (v === undefined || v === null) return def;
  return String(v).trim();
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

const formatDateSafe = (value?: string | null, pattern = "dd MMM yyyy") => {
  const d = parseSafeDate(value);
  if (!d) return "-";
  return format(d, pattern, { locale: es });
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

const getComentarios = (tx: TxTarjeta) =>
  asText(tx.detalle?.comentarios || tx.detalle?.comentario || "");

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

const getTipoBadgeVariant = (
  tx: TxTarjeta
): "default" | "secondary" | "destructive" | "outline" => {
  const estado = getEstado(tx);
  const tipo = getTipo(tx);

  if (estado === "cancelado") return "outline";
  if (tipo === "amortizacion") return "default";
  if (tipo === "cargo_intereses" || tipo === "cargo_interes") return "destructive";
  if (tipo === "capex") return "default";
  return "secondary";
};

const getImpactoLabel = (tx: TxTarjeta) => {
  const estado = getEstado(tx);
  const tipo = getTipo(tx);
  const monto = getMonto(tx);

  if (estado === "cancelado") {
    return {
      text: "$0.00 (revertido)",
      className: "text-muted-foreground",
    };
  }

  if (tipo === "amortizacion") {
    return {
      text: `-${formatMoney(monto)}`,
      className: "text-emerald-600 font-medium",
    };
  }

  return {
    text: `+${formatMoney(monto)}`,
    className: "text-rose-600 font-medium",
  };
};

const getCuentasAfectadas = (tx: TxTarjeta, nombreTarjeta: string) => {
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

const KpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  valueClassName = "",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  valueClassName?: string;
}) => {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={`text-2xl font-bold tracking-tight ${valueClassName}`}>{value}</div>
          <CardDescription>{subtitle}</CardDescription>
        </div>
        <div className="rounded-2xl border bg-slate-50 p-3">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
      </CardHeader>
    </Card>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed bg-slate-50 px-6 py-12 text-center text-muted-foreground">
    {text}
  </div>
);

const LoadingState = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
    <Skeleton className="h-[420px] w-full rounded-2xl" />
  </div>
);

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

  const handleVerDetalle = (tx: TxTarjeta) => {
    setSelectedTransaction(tx);
    setDetalleOpen(true);
  };

  const limiteDisponible = Math.max(0, limiteCredito - saldoActual);
  const porcentajeUso = limiteCredito > 0 ? (saldoActual / limiteCredito) * 100 : 0;

  const resumen = useMemo(() => {
    const cargosCancelados =
      transacciones
        .filter((t) => getEstado(t) === "cancelado" && ["egreso", "capex", "compra"].includes(getTipo(t)))
        .reduce((sum, t) => sum + getMonto(t), 0) || 0;

    const pagosAplicados =
      transacciones
        .filter((t) => getEstado(t) !== "cancelado" && getTipo(t) === "amortizacion")
        .reduce((sum, t) => sum + getMonto(t), 0) || 0;

    const intereses =
      transacciones
        .filter((t) => getEstado(t) !== "cancelado" && ["cargo_intereses", "cargo_interes"].includes(getTipo(t)))
        .reduce((sum, t) => sum + getMonto(t), 0) || 0;

    return {
      cargosCancelados,
      pagosAplicados,
      intereses,
      totalMovimientos: transacciones.length,
    };
  }, [transacciones]);

  const errorMsg = (error as any)?.message || null;

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Límite de Crédito"
          value={formatMoney(limiteCredito)}
          subtitle="Línea aprobada"
          icon={CreditCard}
        />

        <KpiCard
          title="Saldo Utilizado"
          value={formatMoney(saldoActual)}
          subtitle={`${porcentajeUso.toFixed(1)}% del límite`}
          icon={TrendingUp}
          valueClassName="text-rose-600"
        />

        <KpiCard
          title="Crédito Disponible"
          value={formatMoney(limiteDisponible)}
          subtitle="Puede utilizar"
          icon={Wallet}
          valueClassName="text-emerald-600"
        />

        <KpiCard
          title="Cargos Cancelados"
          value={formatMoney(resumen.cargosCancelados)}
          subtitle="Revertidos (impacto: $0)"
          icon={XCircle}
          valueClassName="text-slate-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pagos Aplicados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-600">{formatMoney(resumen.pagosAplicados)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Intereses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-600">{formatMoney(resumen.intereses)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Movimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{resumen.totalMovimientos}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Transacciones de {nombreTarjeta}
          </CardTitle>
          <CardDescription>
            Historial completo de compras, pagos y transacciones canceladas
          </CardDescription>
        </CardHeader>

        <CardContent>
          {errorMsg ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center text-red-700">
              {errorMsg}
            </div>
          ) : transacciones.length === 0 ? (
            <EmptyState text="No hay transacciones registradas con esta tarjeta" />
          ) : (
            <div className="overflow-x-auto">
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
                    const impacto = getImpactoLabel(t);

                    const esCancelado = estado === "cancelado";

                    return (
                      <TableRow
                        key={t.id || t._id}
                        className={esCancelado ? "bg-red-50/70 dark:bg-red-950/20" : ""}
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
                          <span className={impacto.className}>{impacto.text}</span>
                        </TableCell>

                        <TableCell className="text-right font-medium">
                          <span className={esCancelado ? "text-muted-foreground line-through" : ""}>
                            {formatMoney(monto)}
                          </span>
                        </TableCell>

                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm" onClick={() => handleVerDetalle(t)} title="Ver detalle">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de Transacción</DialogTitle>
            <DialogDescription>
              Información operativa y afectación contable estimada
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-5">
              {getEstado(selectedTransaction) === "cancelado" && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 dark:text-red-100">
                        Transacción Cancelada
                      </h4>

                      {parseSafeDate(selectedTransaction.fechaCancelacion) && (
                        <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                          Esta transacción fue cancelada el{" "}
                          {formatDateSafe(selectedTransaction.fechaCancelacion, "dd 'de' MMMM 'de' yyyy")}
                        </p>
                      )}

                      {selectedTransaction.motivoCancelacion && (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                          <strong>Motivo:</strong> {selectedTransaction.motivoCancelacion}
                        </p>
                      )}

                      <p className="mt-2 text-sm text-muted-foreground">
                        El saldo de la tarjeta fue revertido automáticamente.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Fecha</p>
                          <p className="font-medium">
                            {formatDateSafe(selectedTransaction.fecha, "dd 'de' MMMM 'de' yyyy")}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Tipo</p>
                        <Badge variant={getTipoBadgeVariant(selectedTransaction)}>
                          {getTipoLabel(getTipo(selectedTransaction))}
                        </Badge>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Descripción</p>
                        <p className="font-medium">
                          {selectedTransaction.descripcion || "Sin descripción"}
                        </p>
                      </div>

                      {selectedTransaction.proveedor && (
                        <div>
                          <p className="text-sm text-muted-foreground">Proveedor</p>
                          <p className="font-medium">{selectedTransaction.proveedor}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Monto</p>
                        <p className="text-lg font-semibold">
                          {formatMoney(getMonto(selectedTransaction))}
                        </p>
                      </div>

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
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Afectación Contable Estimada</CardTitle>
                </CardHeader>

                <CardContent>
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
                        <TableCell className="font-medium">
                          {getCuentasAfectadas(selectedTransaction, nombreTarjeta).cargo}
                        </TableCell>
                        <TableCell className="text-right text-rose-600">
                          {formatMoney(
                            getTipo(selectedTransaction) === "amortizacion"
                              ? getCapitalPagado(selectedTransaction) + getInteresPagado(selectedTransaction)
                              : getMonto(selectedTransaction)
                          )}
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell className="font-medium">
                          {getCuentasAfectadas(selectedTransaction, nombreTarjeta).abono}
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right text-emerald-600">
                          {formatMoney(
                            getTipo(selectedTransaction) === "amortizacion"
                              ? getCapitalPagado(selectedTransaction) + getInteresPagado(selectedTransaction)
                              : getMonto(selectedTransaction)
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {getComentarios(selectedTransaction) && (
                <div>
                  <p className="text-sm text-muted-foreground">Comentarios</p>
                  <p className="text-sm">{getComentarios(selectedTransaction)}</p>
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