import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  DollarSign,
  FileText,
  TrendingDown,
  TrendingUp,
  Eye,
  Wallet,
  Landmark,
  CalendarDays,
  ReceiptText,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface TransaccionesFinanciamientoProps {
  financiamientoId: string;
  nombreFinanciamiento: string;
  montoTotal: number;
  saldoActual: number;
  saldoInicial: number;
  tipoCredito?: string;
  direccion?: "recibido" | "realizado";
}

const API_MOVIMIENTOS = (financiamientoId: string) =>
  `/api/financiamientos/${encodeURIComponent(financiamientoId)}/movimientos`;

const API_ASIENTO_BY_ID = (journalEntryId: string) =>
  `/api/asientos/${encodeURIComponent(journalEntryId)}`;

const API_ASIENTO_BY_TX = (movementId: string) =>
  `/api/asientos/by-transaccion?source=financiamiento&id=${encodeURIComponent(movementId)}`;

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

const formatMoney = (value: unknown) =>
  `$${toNum(value, 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateSafe = (value: unknown, pattern = "dd MMM yyyy") => {
  if (!value) return "-";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "-";
  return format(d, pattern, { locale: es });
};

const getTipoMovimiento = (tx: any) =>
  String(tx?.tipo || tx?.tipo_transaccion || "").toLowerCase();

const getFecha = (tx: any) => {
  const raw = tx?.fecha || tx?.created_at || tx?.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getMonto = (tx: any) => toNum(tx?.monto, 0);

const getMontoCapital = (tx: any) =>
  toNum(tx?.monto_capital ?? tx?.montoCapital ?? tx?.capital_pagado, 0);

const getMontoIntereses = (tx: any) =>
  toNum(tx?.monto_intereses ?? tx?.montoIntereses ?? tx?.interes_pagado, 0);

const getMontoMoratorios = (tx: any) =>
  toNum(tx?.monto_moratorios ?? tx?.montoMoratorios, 0);

const getMontoComisiones = (tx: any) =>
  toNum(tx?.monto_comisiones ?? tx?.montoComisiones, 0);

const getMetodoPago = (tx: any) =>
  tx?.metodo_pago || tx?.metodoPago || "-";

const getSaldoRestante = (tx: any, fallbackSaldoActual: number) => {
  const snap = tx?.snapshot_after || {};
  const saldoNuevo =
    snap?.saldo_total_actual ??
    snap?.saldo_capital_actual ??
    tx?.saldo_restante;

  return toNum(saldoNuevo, fallbackSaldoActual);
};

const getReferencia = (tx: any) =>
  asText(tx?.referencia || tx?.numero_referencia || "");

const getDescripcion = (tx: any) =>
  asText(tx?.descripcion || tx?.notas || "");

const getTipoLabel = (tipoRaw: string) => {
  const tipo = String(tipoRaw || "").toLowerCase();

  const labels: Record<string, string> = {
    apertura: "Apertura",
    desembolso: "Desembolso",
    disposicion: "Disposición",
    amortizacion: "Amortización",
    cargo_intereses: "Cargo por Intereses",
    cargo_interes: "Cargo por Interés",
    pago_intereses: "Pago de Intereses",
    cargo_comision: "Cargo por Comisión",
    pago_comision: "Pago de Comisión",
    cargo_moratorio: "Cargo Moratorio",
    ajuste: "Ajuste",
    cancelacion: "Cancelación",
    refinanciamiento: "Refinanciamiento",
    otro: "Otro",
  };

  return labels[tipo] || tipoRaw || "Movimiento";
};

const getTipoVariant = (
  tipoRaw: string
): "default" | "secondary" | "destructive" => {
  const tipo = String(tipoRaw || "").toLowerCase();

  if (["amortizacion", "pago_intereses", "pago_comision"].includes(tipo)) {
    return "default";
  }

  if (["cargo_intereses", "cargo_interes", "cargo_comision", "cargo_moratorio"].includes(tipo)) {
    return "destructive";
  }

  return "secondary";
};

const getDetalleAsientos = (asiento: any) => {
  if (Array.isArray(asiento?.detalle_asientos)) return asiento.detalle_asientos;
  if (Array.isArray(asiento?.detalles)) return asiento.detalles;
  if (Array.isArray(asiento?.lines)) return asiento.lines;
  return [];
};

const getAsientoFecha = (asiento: any) =>
  asiento?.fecha || asiento?.date || asiento?.asiento_fecha || null;

const getAsientoDescripcion = (asiento: any) =>
  asiento?.descripcion || asiento?.concepto || asiento?.concept || "-";

const getAsientoNumero = (asiento: any) =>
  asiento?.numeroAsiento || asiento?.numero_asiento || asiento?.numero || "-";

const getCuentaCodigo = (detalle: any) =>
  detalle?.cuenta_codigo || detalle?.accountCode || detalle?.accountCodigo || "-";

const getCuentaNombre = (detalle: any) =>
  detalle?.cuentas?.nombre || detalle?.accountName || detalle?.cuenta_nombre || "N/A";

const getDebe = (detalle: any) =>
  toNum(detalle?.debe ?? detalle?.debit, 0);

const getHaber = (detalle: any) =>
  toNum(detalle?.haber ?? detalle?.credit, 0);

const getMemoDetalle = (detalle: any) =>
  detalle?.descripcion || detalle?.memo || "-";

const getAsientoEstatus = (asiento: any) =>
  asText(asiento?.estatus || asiento?.status || asiento?.estado || "");

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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
    <Skeleton className="h-[420px] w-full rounded-2xl" />
  </div>
);

const TransaccionesFinanciamiento = ({
  financiamientoId,
  nombreFinanciamiento,
  montoTotal,
  saldoActual,
  saldoInicial,
  tipoCredito = "simple",
  direccion = "recibido",
}: TransaccionesFinanciamientoProps) => {
  const [detalleAsientoOpen, setDetalleAsientoOpen] = useState(false);
  const [asientoSeleccionado, setAsientoSeleccionado] = useState<any>(null);
  const [mensajeAsiento, setMensajeAsiento] = useState("");
  const [detalleTransaccionOpen, setDetalleTransaccionOpen] = useState(false);
  const [transaccionSeleccionada, setTransaccionSeleccionada] = useState<any>(null);
  const [loadingAsientoId, setLoadingAsientoId] = useState<string | null>(null);
  const [asientoDetalleTransaccion, setAsientoDetalleTransaccion] = useState<any>(null);
  const [loadingDetalleAsiento, setLoadingDetalleAsiento] = useState(false);
  const [mensajeDetalleAsiento, setMensajeDetalleAsiento] = useState("");

  const {
    data: transacciones = [],
    isLoading: isLoadingTransacciones,
    error: transaccionesError,
  } = useQuery({
    queryKey: ["movimientos-financiamiento", financiamientoId],
    enabled: !!financiamientoId,
    queryFn: async () => {
      return await fetchJSON<any[]>(API_MOVIMIENTOS(financiamientoId));
    },
  });

  const montoAmortizado = Math.max(0, saldoInicial - saldoActual);
  const porcentajePagado = saldoInicial > 0 ? (montoAmortizado / saldoInicial) * 100 : 0;

  const esRevolvente =
    tipoCredito === "revolvente" ||
    tipoCredito === "tarjeta_corporativa" ||
    tipoCredito === "Crédito Revolvente" ||
    tipoCredito === "Tarjeta Corporativa";

  const saldoDisponible = Math.max(0, montoTotal - saldoActual);
  const porcentajeUtilizado = montoTotal > 0 ? (saldoActual / montoTotal) * 100 : 0;

  const resumenTx = useMemo(() => {
    const totalCapital = transacciones.reduce((sum, tx) => {
      const tipo = getTipoMovimiento(tx);
      if (tipo !== "amortizacion") return sum;
      return sum + getMontoCapital(tx);
    }, 0);

    const totalIntereses = transacciones.reduce((sum, tx) => {
      const tipo = getTipoMovimiento(tx);
      if (!["cargo_intereses", "cargo_interes", "pago_intereses"].includes(tipo)) return sum;
      return sum + getMontoIntereses(tx);
    }, 0);

    const totalComisiones = transacciones.reduce((sum, tx) => {
      const tipo = getTipoMovimiento(tx);
      if (!["cargo_comision", "pago_comision"].includes(tipo)) return sum;
      return sum + getMontoComisiones(tx);
    }, 0);

    const totalMoratorios = transacciones.reduce((sum, tx) => {
      const tipo = getTipoMovimiento(tx);
      if (tipo !== "cargo_moratorio") return sum;
      return sum + getMontoMoratorios(tx);
    }, 0);

    const totalMovimientos = transacciones.length;

    return {
      totalCapital,
      totalIntereses,
      totalComisiones,
      totalMoratorios,
      totalMovimientos,
    };
  }, [transacciones]);

  const getCuentasAfectadas = (transaccion: any) => {
    const tipo = getTipoMovimiento(transaccion);
    const metodoPago = String(getMetodoPago(transaccion)).toLowerCase();

    if (tipo === "apertura" || tipo === "desembolso" || tipo === "disposicion") {
      if (direccion === "realizado") {
        return {
          cargo: "1004 - Documentos por Cobrar",
          abono: metodoPago === "efectivo" ? "1001 - Caja" : "1002 - Bancos",
        };
      }
      return {
        cargo: metodoPago === "efectivo" ? "1001 - Caja" : "1002 - Bancos",
        abono: `2101 - Financiamientos (${nombreFinanciamiento})`,
      };
    }

    if (tipo === "amortizacion") {
      if (direccion === "realizado") {
        return {
          cargo: metodoPago === "efectivo" ? "1001 - Caja" : "1002 - Bancos",
          abono: `1004 - Documentos por Cobrar (${nombreFinanciamiento})`,
        };
      }
      return {
        cargo: `2101 - Financiamientos (${nombreFinanciamiento})`,
        abono: metodoPago === "efectivo" ? "1001 - Caja" : "1002 - Bancos",
        adicional:
          getMontoIntereses(transaccion) > 0
            ? {
                cargo: "5201 - Gastos Financieros",
                abono: metodoPago === "efectivo" ? "1001 - Caja" : "1002 - Bancos",
                monto: getMontoIntereses(transaccion),
              }
            : null,
      };
    }

    if (tipo === "cargo_intereses" || tipo === "cargo_interes") {
      if (direccion === "realizado") {
        return {
          cargo: getDescripcion(transaccion).toLowerCase().includes("pagado")
            ? metodoPago === "efectivo"
              ? "1001 - Caja"
              : "1002 - Bancos"
            : "1004 - Documentos por Cobrar",
          abono: "4101 - Productos Financieros",
        };
      }
      return {
        cargo: "5201 - Gastos Financieros",
        abono: `2101 - Financiamientos (${nombreFinanciamiento})`,
      };
    }

    if (tipo === "pago_intereses") {
      return {
        cargo: "2101 - Intereses por Pagar",
        abono: metodoPago === "efectivo" ? "1001 - Caja" : "1002 - Bancos",
      };
    }

    if (tipo === "cargo_comision") {
      return {
        cargo: "5201 - Gastos Financieros",
        abono: `2101 - Financiamientos (${nombreFinanciamiento})`,
      };
    }

    if (tipo === "pago_comision") {
      return {
        cargo: "2101 - Comisiones por Pagar",
        abono: metodoPago === "efectivo" ? "1001 - Caja" : "1002 - Bancos",
      };
    }

    if (tipo === "cargo_moratorio") {
      return {
        cargo: "5201 - Gastos Financieros",
        abono: `2101 - Financiamientos (${nombreFinanciamiento})`,
      };
    }

    return { cargo: "N/A", abono: "N/A" };
  };

  const resolveAsientoForTransaccion = async (transaccion: any) => {
    const movementId = String(transaccion?.id || transaccion?._id || "").trim();
    const journalEntryId = String(transaccion?.journalEntryId || "").trim();

    if (!movementId && !journalEntryId) {
      return {
        asiento: null,
        message: "Este movimiento no tiene un asiento contable ligado.",
      };
    }

    try {
      let asiento: any = null;

      if (journalEntryId) {
        try {
          asiento = await fetchJSON<any>(API_ASIENTO_BY_ID(journalEntryId));
        } catch {
          if (movementId) {
            asiento = await fetchJSON<any>(API_ASIENTO_BY_TX(movementId));
          } else {
            throw new Error("No se pudo cargar el asiento ligado.");
          }
        }
      } else if (movementId) {
        asiento = await fetchJSON<any>(API_ASIENTO_BY_TX(movementId));
      }

      if (!asiento) {
        return {
          asiento: null,
          message: "Este movimiento no tiene un asiento contable ligado.",
        };
      }

      return { asiento, message: "" };
    } catch (error) {
      console.error("Error cargando asiento del financiamiento:", error);
      return {
        asiento: null,
        message: "No se pudo cargar el asiento contable real de este movimiento.",
      };
    }
  };

  const handleVerAsiento = async (transaccion: any) => {
    const movementId = String(transaccion?.id || transaccion?._id || "").trim();
    const journalEntryId = String(transaccion?.journalEntryId || "").trim();

    try {
      setLoadingAsientoId(movementId || journalEntryId);
      const { asiento, message } = await resolveAsientoForTransaccion(transaccion);
      setAsientoSeleccionado(asiento);
      setMensajeAsiento(message);
      setDetalleAsientoOpen(true);
    } finally {
      setLoadingAsientoId(null);
    }
  };

  useEffect(() => {
    if (!detalleTransaccionOpen || !transaccionSeleccionada) {
      setAsientoDetalleTransaccion(null);
      setLoadingDetalleAsiento(false);
      setMensajeDetalleAsiento("");
      return;
    }

    let cancelled = false;

    const loadAsiento = async () => {
      setLoadingDetalleAsiento(true);
      setMensajeDetalleAsiento("");

      const { asiento, message } = await resolveAsientoForTransaccion(transaccionSeleccionada);

      if (cancelled) return;

      setAsientoDetalleTransaccion(asiento);
      setMensajeDetalleAsiento(message);
      setLoadingDetalleAsiento(false);
    };

    void loadAsiento();

    return () => {
      cancelled = true;
    };
  }, [detalleTransaccionOpen, transaccionSeleccionada]);

  const isLoading = isLoadingTransacciones;
  const errorMsg = (transaccionesError as any)?.message || null;

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {esRevolvente ? (
          <>
            <KpiCard
              title="Línea Total"
              value={formatMoney(montoTotal)}
              subtitle="Línea aprobada"
              icon={Landmark}
            />

            <KpiCard
              title="Monto Utilizado"
              value={formatMoney(saldoActual)}
              subtitle={`${porcentajeUtilizado.toFixed(1)}% utilizado`}
              icon={TrendingUp}
              valueClassName="text-orange-600"
            />

            <KpiCard
              title="Saldo Disponible"
              value={formatMoney(saldoDisponible)}
              subtitle={`${(100 - porcentajeUtilizado).toFixed(1)}% disponible`}
              icon={Wallet}
              valueClassName="text-emerald-600"
            />

            <KpiCard
              title="Movimientos"
              value={String(resumenTx.totalMovimientos)}
              subtitle="Registros capturados"
              icon={ReceiptText}
            />
          </>
        ) : (
          <>
            <KpiCard
              title="Monto Original"
              value={formatMoney(montoTotal)}
              subtitle="Préstamo total"
              icon={DollarSign}
            />

            <KpiCard
              title="Amortizado"
              value={formatMoney(montoAmortizado)}
              subtitle={`${porcentajePagado.toFixed(1)}% pagado`}
              icon={TrendingUp}
              valueClassName="text-emerald-600"
            />

            <KpiCard
              title="Saldo Pendiente"
              value={formatMoney(saldoActual)}
              subtitle="Por pagar"
              icon={TrendingDown}
              valueClassName="text-rose-600"
            />

            <KpiCard
              title="Movimientos"
              value={String(resumenTx.totalMovimientos)}
              subtitle="Registros capturados"
              icon={ReceiptText}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Capital aplicado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-slate-900">{formatMoney(resumenTx.totalCapital)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Intereses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-600">{formatMoney(resumenTx.totalIntereses)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Comisiones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-indigo-600">{formatMoney(resumenTx.totalComisiones)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Moratorios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-rose-600">{formatMoney(resumenTx.totalMoratorios)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Movimientos de {nombreFinanciamiento}
          </CardTitle>
          <CardDescription>
            Historial de disposiciones, amortizaciones, intereses y ajustes
          </CardDescription>
        </CardHeader>

        <CardContent>
          {errorMsg ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center text-red-700">
              {errorMsg}
            </div>
          ) : !transacciones || transacciones.length === 0 ? (
            <EmptyState text="No hay movimientos registrados para este financiamiento" />
          ) : (
            <div className="overflow-x-auto">
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
                    <TableHead className="text-center">Asiento</TableHead>
                    <TableHead className="text-center">Detalle</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {transacciones.map((transaccion: any) => {
                    const fecha = getFecha(transaccion);
                    const rowId = String(transaccion.id || transaccion._id || "");
                    const loadingThisAsiento =
                      loadingAsientoId === rowId ||
                      loadingAsientoId === String(transaccion.journalEntryId || "");

                    return (
                      <TableRow key={rowId}>
                        <TableCell>
                          {fecha ? format(fecha, "dd MMM yyyy", { locale: es }) : "-"}
                        </TableCell>

                        <TableCell>
                          <Badge variant={getTipoVariant(getTipoMovimiento(transaccion))}>
                            {getTipoLabel(getTipoMovimiento(transaccion))}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right font-medium">
                          {formatMoney(getMonto(transaccion))}
                        </TableCell>

                        <TableCell className="text-right">
                          {formatMoney(getMontoCapital(transaccion))}
                        </TableCell>

                        <TableCell className="text-right">
                          {formatMoney(getMontoIntereses(transaccion))}
                        </TableCell>

                        <TableCell className="text-right font-medium">
                          {formatMoney(getSaldoRestante(transaccion, saldoActual))}
                        </TableCell>

                        <TableCell>{getMetodoPago(transaccion)}</TableCell>

                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleVerAsiento(transaccion)}
                            disabled={loadingThisAsiento}
                            title={transaccion?.journalEntryId ? "Ver asiento real" : "Verificar asiento ligado"}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="hidden lg:inline">
                              {transaccion?.journalEntryId ? "Asiento real" : "Verificar"}
                            </span>
                          </Button>
                        </TableCell>

                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTransaccionSeleccionada(transaccion);
                              setDetalleTransaccionOpen(true);
                            }}
                            title="Ver detalle"
                          >
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

      <Dialog open={detalleAsientoOpen} onOpenChange={setDetalleAsientoOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Detalle del Asiento Contable</DialogTitle>
            <DialogDescription>
              {asientoSeleccionado
                ? "Asiento contable real registrado para este movimiento."
                : "No se encontro un asiento contable real ligado a este movimiento."}
            </DialogDescription>
          </DialogHeader>

          {asientoSeleccionado ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Asiento contable registrado. Este movimiento impacta la Balanza de Comprobacion.
              </div>

              <div className="grid grid-cols-1 gap-4 rounded-2xl bg-muted p-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Número de Asiento</p>
                  <p className="font-semibold">{getAsientoNumero(asientoSeleccionado)}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="font-semibold">{formatDateSafe(getAsientoFecha(asientoSeleccionado))}</p>
                </div>

                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Descripción</p>
                  <p className="font-medium">{getAsientoDescripcion(asientoSeleccionado)}</p>
                </div>
              </div>

              <Card className="rounded-2xl shadow-sm">
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
                      {getDetalleAsientos(asientoSeleccionado).map((detalle: any, idx: number) => (
                        <TableRow
                          key={detalle.id || `${getCuentaCodigo(detalle)}-${idx}`}
                        >
                          <TableCell className="font-medium">
                            {getCuentaCodigo(detalle)} - {getCuentaNombre(detalle)}
                          </TableCell>
                          <TableCell>{getMemoDetalle(detalle)}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            {getDebe(detalle) > 0 ? formatMoney(getDebe(detalle)) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-rose-600">
                            {getHaber(detalle) > 0 ? formatMoney(getHaber(detalle)) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}

                      <TableRow className="bg-muted font-bold">
                        <TableCell colSpan={2}>TOTALES</TableCell>
                        <TableCell className="text-right text-emerald-600">
                          {formatMoney(
                            getDetalleAsientos(asientoSeleccionado).reduce(
                              (sum: number, d: any) => sum + getDebe(d),
                              0
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-right text-rose-600">
                          {formatMoney(
                            getDetalleAsientos(asientoSeleccionado).reduce(
                              (sum: number, d: any) => sum + getHaber(d),
                              0
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              {mensajeAsiento || "No se encontro un asiento contable real ligado a este movimiento."}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={detalleTransaccionOpen} onOpenChange={setDetalleTransaccionOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de Movimiento</DialogTitle>
            <DialogDescription>
              Informacion operativa y trazabilidad contable del movimiento
            </DialogDescription>
          </DialogHeader>

          {transaccionSeleccionada && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Fecha</p>
                          <p className="font-medium">
                            {getFecha(transaccionSeleccionada)
                              ? format(
                                  getFecha(transaccionSeleccionada) as Date,
                                  "dd 'de' MMMM 'de' yyyy",
                                  { locale: es }
                                )
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <ReceiptText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Tipo</p>
                          <Badge variant={getTipoVariant(getTipoMovimiento(transaccionSeleccionada))}>
                            {getTipoLabel(getTipoMovimiento(transaccionSeleccionada))}
                          </Badge>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Descripción</p>
                        <p className="font-medium">
                          {getDescripcion(transaccionSeleccionada) ||
                            getTipoLabel(getTipoMovimiento(transaccionSeleccionada))}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Monto Total</p>
                        <p className="text-lg font-semibold">
                          {formatMoney(getMonto(transaccionSeleccionada))}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Saldo Restante</p>
                        <p className="text-lg font-semibold">
                          {formatMoney(getSaldoRestante(transaccionSeleccionada, saldoActual))}
                        </p>
                      </div>

                      {getMontoCapital(transaccionSeleccionada) > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground">Capital</p>
                          <p className="font-medium">
                            {formatMoney(getMontoCapital(transaccionSeleccionada))}
                          </p>
                        </div>
                      )}

                      {getMontoIntereses(transaccionSeleccionada) > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground">Intereses</p>
                          <p className="font-medium">
                            {formatMoney(getMontoIntereses(transaccionSeleccionada))}
                          </p>
                        </div>
                      )}

                      {getMontoMoratorios(transaccionSeleccionada) > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground">Moratorios</p>
                          <p className="font-medium">
                            {formatMoney(getMontoMoratorios(transaccionSeleccionada))}
                          </p>
                        </div>
                      )}

                      {getMontoComisiones(transaccionSeleccionada) > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground">Comisiones</p>
                          <p className="font-medium">
                            {formatMoney(getMontoComisiones(transaccionSeleccionada))}
                          </p>
                        </div>
                      )}

                      {getMetodoPago(transaccionSeleccionada) !== "-" && (
                        <div>
                          <p className="text-sm text-muted-foreground">Método</p>
                          <p className="font-medium">{getMetodoPago(transaccionSeleccionada)}</p>
                        </div>
                      )}

                      {getReferencia(transaccionSeleccionada) && (
                        <div>
                          <p className="text-sm text-muted-foreground">Referencia</p>
                          <p className="font-medium">{getReferencia(transaccionSeleccionada)}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    {asientoDetalleTransaccion
                      ? "Asiento Contable Registrado"
                      : "Afectacion Contable Estimada"}
                  </CardTitle>
                  <CardDescription>
                    {asientoDetalleTransaccion
                      ? "Se muestra el asiento contable real ligado a este movimiento."
                      : "Fallback visual cuando el movimiento no tiene un asiento real ligado."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {loadingDetalleAsiento ? (
                    <div className="rounded-2xl border bg-slate-50 px-4 py-4 text-sm text-muted-foreground">
                      Cargando asiento contable real...
                    </div>
                  ) : asientoDetalleTransaccion ? (
                    <>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Asiento contable registrado. Impacta la Balanza de Comprobacion y deja trazabilidad directa con este movimiento.
                      </div>

                      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-muted p-4 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Numero de Asiento</p>
                          <p className="font-semibold">{getAsientoNumero(asientoDetalleTransaccion)}</p>
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground">Fecha del Asiento</p>
                          <p className="font-semibold">
                            {formatDateSafe(getAsientoFecha(asientoDetalleTransaccion))}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground">Estatus</p>
                          <p className="font-semibold">
                            {getAsientoEstatus(asientoDetalleTransaccion) || "Registrado"}
                          </p>
                        </div>

                        <div className="flex items-end justify-start xl:justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              setAsientoSeleccionado(asientoDetalleTransaccion);
                              setMensajeAsiento("");
                              setDetalleAsientoOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4" />
                            Ver asiento real
                          </Button>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cuenta</TableHead>
                            <TableHead>Descripcion</TableHead>
                            <TableHead className="text-right">Debe</TableHead>
                            <TableHead className="text-right">Haber</TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {getDetalleAsientos(asientoDetalleTransaccion).map((detalle: any, idx: number) => (
                            <TableRow key={detalle.id || `${getCuentaCodigo(detalle)}-${idx}`}>
                              <TableCell className="font-medium">
                                {getCuentaCodigo(detalle)} - {getCuentaNombre(detalle)}
                              </TableCell>
                              <TableCell>{getMemoDetalle(detalle)}</TableCell>
                              <TableCell className="text-right text-emerald-600">
                                {getDebe(detalle) > 0 ? formatMoney(getDebe(detalle)) : "-"}
                              </TableCell>
                              <TableCell className="text-right text-rose-600">
                                {getHaber(detalle) > 0 ? formatMoney(getHaber(detalle)) : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {mensajeDetalleAsiento ||
        "Informacion operativa y trazabilidad contable del movimiento"}
    </div>

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
                              {getCuentasAfectadas(transaccionSeleccionada).cargo}
                            </TableCell>
                            <TableCell className="text-right text-rose-600">
                              {formatMoney(
                                getTipoMovimiento(transaccionSeleccionada) === "amortizacion"
                                  ? getMontoCapital(transaccionSeleccionada)
                                  : getMonto(transaccionSeleccionada)
                              )}
                            </TableCell>
                            <TableCell className="text-right">-</TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell className="font-medium">
                              {getCuentasAfectadas(transaccionSeleccionada).abono}
                            </TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right text-emerald-600">
                              {formatMoney(
                                getTipoMovimiento(transaccionSeleccionada) === "amortizacion"
                                  ? getMontoCapital(transaccionSeleccionada)
                                  : getMonto(transaccionSeleccionada)
                              )}
                            </TableCell>
                          </TableRow>

                          {getCuentasAfectadas(transaccionSeleccionada).adicional && (
                            <>
                              <TableRow>
                                <TableCell className="font-medium">
                                  {getCuentasAfectadas(transaccionSeleccionada).adicional.cargo}
                                </TableCell>
                                <TableCell className="text-right text-rose-600">
                                  {formatMoney(
                                    getCuentasAfectadas(transaccionSeleccionada).adicional.monto
                                  )}
                                </TableCell>
                                <TableCell className="text-right">-</TableCell>
                              </TableRow>

                              <TableRow>
                                <TableCell className="font-medium">
                                  {getCuentasAfectadas(transaccionSeleccionada).adicional.abono}
                                </TableCell>
                                <TableCell className="text-right">-</TableCell>
                                <TableCell className="text-right text-emerald-600">
                                  {formatMoney(
                                    getCuentasAfectadas(transaccionSeleccionada).adicional.monto
                                  )}
                                </TableCell>
                              </TableRow>
                            </>
                          )}
                        </TableBody>
                      </Table>
                    </>
                  )}
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
