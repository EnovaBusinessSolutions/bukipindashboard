import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DollarSign, FileText, TrendingDown, TrendingUp, Eye } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TransaccionesFinanciamientoProps {
  financiamientoId: string;
  nombreFinanciamiento: string;
  montoTotal: number;
  saldoActual: number;
  saldoInicial: number;
  tipoCredito?: string;
}

const API_MOVIMIENTOS = (financiamientoId: string) =>
  `/api/financiamientos/${encodeURIComponent(financiamientoId)}/movimientos`;

const API_ASIENTOS = (q: string) =>
  `/api/contabilidad/asientos?q=${encodeURIComponent(q)}&include=detalle,cuentas`;

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  const text = await res.text();

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore parse error
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

const sameDay = (a: string | Date, b: string | Date) => {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10);
};

const getTipoMovimiento = (tx: any) =>
  String(tx?.tipo || tx?.tipo_transaccion || "").toLowerCase();

const getFecha = (tx: any) => {
  const raw = tx?.fecha || tx?.created_at || tx?.createdAt;
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
    snap?.saldo_capital_actual ??
    snap?.saldo_total_actual ??
    tx?.saldo_restante;

  return toNum(saldoNuevo, fallbackSaldoActual);
};

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

const TransaccionesFinanciamiento = ({
  financiamientoId,
  nombreFinanciamiento,
  montoTotal,
  saldoActual,
  saldoInicial,
  tipoCredito = "simple",
}: TransaccionesFinanciamientoProps) => {
  const [detalleAsientoOpen, setDetalleAsientoOpen] = useState(false);
  const [asientoSeleccionado, setAsientoSeleccionado] = useState<any>(null);
  const [detalleTransaccionOpen, setDetalleTransaccionOpen] = useState(false);
  const [transaccionSeleccionada, setTransaccionSeleccionada] = useState<any>(null);

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

  const {
    data: asientosContables = [],
    isLoading: isLoadingAsientos,
    error: asientosError,
  } = useQuery({
    queryKey: ["asientos-financiamiento", financiamientoId, nombreFinanciamiento],
    enabled: !!financiamientoId && !!nombreFinanciamiento,
    queryFn: async () => {
      return await fetchJSON<any[]>(API_ASIENTOS(nombreFinanciamiento));
    },
  });

  const asientosIndex = useMemo(() => asientosContables || [], [asientosContables]);

  const handleVerAsiento = (transaccion: any) => {
    if (!asientosIndex.length) return;

    const tipo = getTipoMovimiento(transaccion);
    const nombre = String(nombreFinanciamiento || "").toLowerCase();

    const asiento = asientosIndex.find((a: any) => {
      const desc = String(a?.descripcion || "").toLowerCase();
      const matchFecha = transaccion?.fecha ? sameDay(a?.fecha, transaccion.fecha) : false;
      const matchTexto = desc.includes(tipo) || desc.includes(nombre);
      return matchFecha && matchTexto;
    });

    if (asiento) {
      setAsientoSeleccionado(asiento);
      setDetalleAsientoOpen(true);
    }
  };

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

    const totalMovimientos = transacciones.length;

    return {
      totalCapital,
      totalIntereses,
      totalMovimientos,
    };
  }, [transacciones]);

  const getCuentasAfectadas = (transaccion: any) => {
    const tipo = getTipoMovimiento(transaccion);
    const metodoPago = String(getMetodoPago(transaccion)).toLowerCase();

    if (tipo === "apertura" || tipo === "desembolso" || tipo === "disposicion") {
      return {
        cargo: metodoPago === "efectivo" ? "1001 - Caja" : "1002 - Bancos",
        abono: `2101 - Financiamientos (${nombreFinanciamiento})`,
      };
    }

    if (tipo === "amortizacion") {
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

  const isLoading = isLoadingTransacciones || isLoadingAsientos;
  const errorMsg =
    (transaccionesError as any)?.message ||
    (asientosError as any)?.message ||
    null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {esRevolvente ? (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Línea Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${montoTotal.toLocaleString("es-MX")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Línea aprobada</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Monto Utilizado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  ${saldoActual.toLocaleString("es-MX")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {porcentajeUtilizado.toFixed(1)}% utilizado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Saldo Disponible
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${saldoDisponible.toLocaleString("es-MX")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(100 - porcentajeUtilizado).toFixed(1)}% disponible
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Movimientos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumenTx.totalMovimientos}</div>
                <p className="text-xs text-muted-foreground mt-1">Registros</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Monto Original
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${montoTotal.toLocaleString("es-MX")}
                </div>
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
                <div className="text-2xl font-bold text-green-600">
                  ${montoAmortizado.toLocaleString("es-MX")}
                </div>
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
                <div className="text-2xl font-bold text-destructive">
                  ${saldoActual.toLocaleString("es-MX")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Por pagar</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Movimientos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumenTx.totalMovimientos}</div>
                <p className="text-xs text-muted-foreground mt-1">Registros</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos de {nombreFinanciamiento}</CardTitle>
          <CardDescription>
            Historial de disposiciones, amortizaciones, intereses y ajustes
          </CardDescription>
        </CardHeader>

        <CardContent>
          {errorMsg ? (
            <div className="text-center py-8 text-destructive">{errorMsg}</div>
          ) : isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando movimientos...
            </div>
          ) : !transacciones || transacciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay movimientos registrados para este financiamiento
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
                  <TableHead className="text-center">Asiento</TableHead>
                  <TableHead className="text-center">Detalle</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {transacciones.map((transaccion: any) => {
                  const fecha = getFecha(transaccion);

                  return (
                    <TableRow key={transaccion.id || transaccion._id}>
                      <TableCell>
                        {fecha ? format(fecha, "dd MMM yyyy", { locale: es }) : "-"}
                      </TableCell>

                      <TableCell>
                        <Badge variant={getTipoVariant(getTipoMovimiento(transaccion))}>
                          {getTipoLabel(getTipoMovimiento(transaccion))}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        ${getMonto(transaccion).toLocaleString("es-MX")}
                      </TableCell>

                      <TableCell className="text-right">
                        ${getMontoCapital(transaccion).toLocaleString("es-MX")}
                      </TableCell>

                      <TableCell className="text-right">
                        ${getMontoIntereses(transaccion).toLocaleString("es-MX")}
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        ${getSaldoRestante(transaccion, saldoActual).toLocaleString("es-MX")}
                      </TableCell>

                      <TableCell>{getMetodoPago(transaccion)}</TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerAsiento(transaccion)}
                          disabled={!asientosContables?.length}
                          title={!asientosContables?.length ? "No hay asientos disponibles" : "Ver asiento"}
                        >
                          <FileText className="h-4 w-4" />
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
                        >
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

      <Dialog open={detalleAsientoOpen} onOpenChange={setDetalleAsientoOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalle del Asiento Contable</DialogTitle>
            <DialogDescription>Registro contable del movimiento</DialogDescription>
          </DialogHeader>

          {asientoSeleccionado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Número de Asiento</p>
                  <p className="font-semibold">
                    {asientoSeleccionado.numero_asiento || asientoSeleccionado.numero || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="font-semibold">
                    {asientoSeleccionado.fecha
                      ? format(new Date(asientoSeleccionado.fecha), "dd MMM yyyy", { locale: es })
                      : "-"}
                  </p>
                </div>

                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Descripción</p>
                  <p className="font-medium">{asientoSeleccionado.descripcion || "-"}</p>
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
                      {(asientoSeleccionado.detalle_asientos || []).map((detalle: any) => (
                        <TableRow key={detalle.id || `${detalle.cuenta_codigo}-${detalle.descripcion}`}>
                          <TableCell className="font-medium">
                            {detalle.cuenta_codigo || "-"} - {detalle.cuentas?.nombre || detalle.cuenta_nombre || "N/A"}
                          </TableCell>
                          <TableCell>{detalle.descripcion || "-"}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {toNum(detalle.debe, 0) > 0
                              ? `$${toNum(detalle.debe, 0).toLocaleString("es-MX")}`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {toNum(detalle.haber, 0) > 0
                              ? `$${toNum(detalle.haber, 0).toLocaleString("es-MX")}`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}

                      <TableRow className="font-bold bg-muted">
                        <TableCell colSpan={2}>TOTALES</TableCell>
                        <TableCell className="text-right text-green-600">
                          $
                          {(asientoSeleccionado.detalle_asientos || [])
                            .reduce((sum: number, d: any) => sum + toNum(d.debe, 0), 0)
                            .toLocaleString("es-MX")}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          $
                          {(asientoSeleccionado.detalle_asientos || [])
                            .reduce((sum: number, d: any) => sum + toNum(d.haber, 0), 0)
                            .toLocaleString("es-MX")}
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

      <Dialog open={detalleTransaccionOpen} onOpenChange={setDetalleTransaccionOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Movimiento</DialogTitle>
          </DialogHeader>

          {transaccionSeleccionada && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="font-medium">
                    {getFecha(transaccionSeleccionada)
                      ? format(getFecha(transaccionSeleccionada) as Date, "dd 'de' MMMM 'de' yyyy", { locale: es })
                      : "-"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <Badge variant={getTipoVariant(getTipoMovimiento(transaccionSeleccionada))}>
                    {getTipoLabel(getTipoMovimiento(transaccionSeleccionada))}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Descripción</p>
                  <p className="font-medium">
                    {transaccionSeleccionada.descripcion ||
                      getTipoLabel(getTipoMovimiento(transaccionSeleccionada))}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Monto Total</p>
                  <p className="font-medium text-lg">
                    ${getMonto(transaccionSeleccionada).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {getMontoCapital(transaccionSeleccionada) > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Capital</p>
                    <p className="font-medium">
                      ${getMontoCapital(transaccionSeleccionada).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {getMontoIntereses(transaccionSeleccionada) > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Intereses</p>
                    <p className="font-medium">
                      ${getMontoIntereses(transaccionSeleccionada).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {getMontoMoratorios(transaccionSeleccionada) > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Moratorios</p>
                    <p className="font-medium">
                      ${getMontoMoratorios(transaccionSeleccionada).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {getMontoComisiones(transaccionSeleccionada) > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Comisiones</p>
                    <p className="font-medium">
                      ${getMontoComisiones(transaccionSeleccionada).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Saldo Restante</p>
                  <p className="font-medium">
                    ${getSaldoRestante(transaccionSeleccionada, saldoActual).toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>

                {getMetodoPago(transaccionSeleccionada) !== "-" && (
                  <div>
                    <p className="text-sm text-muted-foreground">Método</p>
                    <p className="font-medium">{getMetodoPago(transaccionSeleccionada)}</p>
                  </div>
                )}

                {(transaccionSeleccionada.referencia || transaccionSeleccionada.numero_referencia) && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Referencia</p>
                    <p className="font-medium">
                      {transaccionSeleccionada.referencia || transaccionSeleccionada.numero_referencia}
                    </p>
                  </div>
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
                      <td className="font-medium py-2">{getCuentasAfectadas(transaccionSeleccionada).cargo}</td>
                      <td className="text-right py-2 text-destructive">
                        $
                        {(
                          getTipoMovimiento(transaccionSeleccionada) === "amortizacion"
                            ? getMontoCapital(transaccionSeleccionada)
                            : getMonto(transaccionSeleccionada)
                        ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right py-2">-</td>
                    </TableRow>

                    <TableRow>
                      <td className="font-medium py-2">{getCuentasAfectadas(transaccionSeleccionada).abono}</td>
                      <td className="text-right py-2">-</td>
                      <td className="text-right py-2 text-green-600">
                        $
                        {(
                          getTipoMovimiento(transaccionSeleccionada) === "amortizacion"
                            ? getMontoCapital(transaccionSeleccionada)
                            : getMonto(transaccionSeleccionada)
                        ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </td>
                    </TableRow>

                    {getCuentasAfectadas(transaccionSeleccionada).adicional && (
                      <>
                        <TableRow>
                          <td className="font-medium py-2">
                            {getCuentasAfectadas(transaccionSeleccionada).adicional.cargo}
                          </td>
                          <td className="text-right py-2 text-destructive">
                            $
                            {Number(
                              getCuentasAfectadas(transaccionSeleccionada).adicional.monto
                            ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right py-2">-</td>
                        </TableRow>

                        <TableRow>
                          <td className="font-medium py-2">
                            {getCuentasAfectadas(transaccionSeleccionada).adicional.abono}
                          </td>
                          <td className="text-right py-2">-</td>
                          <td className="text-right py-2 text-green-600">
                            $
                            {Number(
                              getCuentasAfectadas(transaccionSeleccionada).adicional.monto
                            ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </td>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransaccionesFinanciamiento;