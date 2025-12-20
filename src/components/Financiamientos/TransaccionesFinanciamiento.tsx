import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DollarSign, FileText, TrendingDown, TrendingUp, Eye } from "lucide-react";
import { useMemo, useState } from "react";

interface TransaccionesFinanciamientoProps {
  financiamientoId: string;
  nombreFinanciamiento: string;
  montoTotal: number;
  saldoActual: number;
  saldoInicial: number;
  tipoCredito?: string;
}

/**
 * ✅ Ajusta estas rutas si tu backend usa otras
 */
const API_TRANSACCIONES = (financiamientoId: string) =>
  `/api/financiamientos/${encodeURIComponent(financiamientoId)}/transacciones`;

const API_ASIENTOS = (q: string) =>
  `/api/contabilidad/asientos?q=${encodeURIComponent(q)}&include=detalle,cuentas`;

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

  // soporta { ok:true, data:... } o payload plano
  return (json?.data ?? json) as T;
}

const sameDay = (a: string | Date, b: string | Date) => {
  const da = new Date(a);
  const db = new Date(b);
  return da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10);
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

  // 1) Obtener transacciones del financiamiento (desde backend)
  const {
    data: transacciones = [],
    isLoading: isLoadingTransacciones,
    error: transaccionesError,
  } = useQuery({
    queryKey: ["transacciones-financiamiento", financiamientoId],
    enabled: !!financiamientoId,
    queryFn: async () => {
      return await fetchJSON<any[]>(API_TRANSACCIONES(financiamientoId));
    },
  });

  // 2) Obtener asientos contables relacionados (desde backend)
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

  const asientosIndex = useMemo(() => {
    // index rápido por fecha+texto
    return asientosContables;
  }, [asientosContables]);

  const handleVerAsiento = (transaccion: any) => {
    if (!asientosIndex?.length) return;

    const tipo = String(transaccion.tipo_transaccion || "").toLowerCase();
    const nombre = String(nombreFinanciamiento || "").toLowerCase();

    const asiento = asientosIndex.find((a: any) => {
      const desc = String(a.descripcion || "").toLowerCase();
      const matchFecha = sameDay(a.fecha, transaccion.fecha);
      const matchTexto = desc.includes(tipo) || desc.includes(nombre);
      return matchFecha && matchTexto;
    });

    if (asiento) {
      setAsientoSeleccionado(asiento);
      setDetalleAsientoOpen(true);
    }
  };

  const montoAmortizado = saldoInicial - saldoActual;
  const porcentajePagado = saldoInicial > 0 ? (montoAmortizado / saldoInicial) * 100 : 0;

  const esRevolvente = tipoCredito === "revolvente" || tipoCredito === "tarjeta_corporativa";
  const saldoDisponible = montoTotal - saldoActual;
  const porcentajeUtilizado = montoTotal > 0 ? (saldoActual / montoTotal) * 100 : 0;

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      desembolso: "Desembolso Inicial",
      disposicion: "Disposición",
      amortizacion: "Amortización",
      cargo_interes: "Cargo por Interés",
    };
    return labels[tipo] || tipo;
  };

  const getTipoVariant = (tipo: string): "default" | "secondary" | "destructive" => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      desembolso: "secondary",
      disposicion: "secondary",
      amortizacion: "default",
      cargo_interes: "destructive",
    };
    return variants[tipo] || "default";
  };

  const getCuentasAfectadas = (transaccion: any) => {
    if (transaccion.tipo_transaccion === "desembolso") {
      return {
        cargo: "1002 - Bancos",
        abono: `2101 - Créditos Bancarios (${nombreFinanciamiento})`,
      };
    } else if (transaccion.tipo_transaccion === "disposicion") {
      return {
        cargo: transaccion.metodo_pago === "efectivo" ? "1001 - Caja" : "1002 - Bancos",
        abono: `2101 - Préstamos Bancarios LP (${nombreFinanciamiento})`,
      };
    } else if (transaccion.tipo_transaccion === "amortizacion") {
      return {
        cargo: `2101 - Créditos Bancarios (${nombreFinanciamiento})`,
        abono: transaccion.metodo_pago === "efectivo" ? "1001 - Efectivo" : "1002 - Bancos",
        adicional:
          transaccion.interes_pagado > 0
            ? {
                cargo: "5201 - Gastos Financieros",
                abono: transaccion.metodo_pago === "efectivo" ? "1001 - Efectivo" : "1002 - Bancos",
                monto: transaccion.interes_pagado,
              }
            : null,
      };
    } else if (transaccion.tipo_transaccion === "cargo_interes") {
      if (transaccion.interes_pagado > 0) {
        return {
          cargo: "5201 - Gastos Financieros",
          abono: transaccion.metodo_pago === "efectivo" ? "1001 - Efectivo" : "1002 - Bancos",
        };
      } else {
        return {
          cargo: "5201 - Gastos Financieros",
          abono: `2101 - Créditos Bancarios (${nombreFinanciamiento})`,
        };
      }
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
      {/* Tarjetas de resumen */}
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
                <div className="text-2xl font-bold">${montoTotal.toLocaleString("es-MX")}</div>
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
                <div className="text-2xl font-bold text-success">
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
                  Transacciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{transacciones?.length || 0}</div>
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
                <div className="text-2xl font-bold">${montoTotal.toLocaleString("es-MX")}</div>
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
                <div className="text-2xl font-bold text-success">
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
                  Transacciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{transacciones?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Registros</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tabla de transacciones */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones de {nombreFinanciamiento}</CardTitle>
          <CardDescription>Historial de desembolsos, amortizaciones y cargos por interés</CardDescription>
        </CardHeader>

        <CardContent>
          {errorMsg ? (
            <div className="text-center py-8 text-destructive">
              {errorMsg}
            </div>
          ) : isLoading ? (
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
                  <TableHead className="text-center">Asiento</TableHead>
                  <TableHead className="text-center">Detalle</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {transacciones.map((transaccion: any) => (
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
                      ${Number(transaccion.monto || 0).toLocaleString("es-MX")}
                    </TableCell>

                    <TableCell className="text-right">
                      ${Number(transaccion.capital_pagado || 0).toLocaleString("es-MX")}
                    </TableCell>

                    <TableCell className="text-right">
                      ${Number(transaccion.interes_pagado || 0).toLocaleString("es-MX")}
                    </TableCell>

                    <TableCell className="text-right font-medium">
                      ${Number(transaccion.saldo_restante || 0).toLocaleString("es-MX")}
                    </TableCell>

                    <TableCell>{transaccion.metodo_pago || "-"}</TableCell>

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
            <DialogDescription>Registro contable de la transacción</DialogDescription>
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
                            {detalle.cuenta_codigo} - {detalle.cuentas?.nombre || "N/A"}
                          </TableCell>
                          <TableCell>{detalle.descripcion}</TableCell>
                          <TableCell className="text-right font-medium text-success">
                            {detalle.debe > 0 ? `$${detalle.debe.toLocaleString("es-MX")}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {detalle.haber > 0 ? `$${detalle.haber.toLocaleString("es-MX")}` : "-"}
                          </TableCell>
                        </TableRow>
                      ))}

                      <TableRow className="font-bold bg-muted">
                        <TableCell colSpan={2}>TOTALES</TableCell>
                        <TableCell className="text-right text-success">
                          $
                          {asientoSeleccionado.detalle_asientos
                            ?.reduce((sum: number, d: any) => sum + (d.debe || 0), 0)
                            .toLocaleString("es-MX")}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          $
                          {asientoSeleccionado.detalle_asientos
                            ?.reduce((sum: number, d: any) => sum + (d.haber || 0), 0)
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

      {/* Dialog para ver detalle de la transacción con cuentas contables */}
      <Dialog open={detalleTransaccionOpen} onOpenChange={setDetalleTransaccionOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Transacción</DialogTitle>
          </DialogHeader>

          {transaccionSeleccionada && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="font-medium">
                    {format(new Date(transaccionSeleccionada.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <Badge variant={getTipoVariant(transaccionSeleccionada.tipo_transaccion)}>
                    {getTipoLabel(transaccionSeleccionada.tipo_transaccion)}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Descripción</p>
                  <p className="font-medium">
                    {transaccionSeleccionada.descripcion || getTipoLabel(transaccionSeleccionada.tipo_transaccion)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Monto Total</p>
                  <p className="font-medium text-lg">
                    ${Number(transaccionSeleccionada.monto || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {Number(transaccionSeleccionada.capital_pagado || 0) > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Capital Pagado</p>
                    <p className="font-medium">
                      ${Number(transaccionSeleccionada.capital_pagado || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {Number(transaccionSeleccionada.interes_pagado || 0) > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Interés Pagado</p>
                    <p className="font-medium">
                      ${Number(transaccionSeleccionada.interes_pagado || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Saldo Restante</p>
                  <p className="font-medium">
                    ${Number(transaccionSeleccionada.saldo_restante || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {transaccionSeleccionada.metodo_pago && (
                  <div>
                    <p className="text-sm text-muted-foreground">Método de Pago</p>
                    <p className="font-medium">
                      {transaccionSeleccionada.metodo_pago === "efectivo" ? "Efectivo" : "Transferencia/Bancos"}
                    </p>
                  </div>
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
                      <td className="font-medium py-2">{getCuentasAfectadas(transaccionSeleccionada).cargo}</td>
                      <td className="text-right py-2 text-destructive">
                        $
                        {Number(
                          transaccionSeleccionada.tipo_transaccion === "amortizacion"
                            ? transaccionSeleccionada.capital_pagado
                            : transaccionSeleccionada.monto
                        ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right py-2">-</td>
                    </TableRow>

                    <TableRow>
                      <td className="font-medium py-2">{getCuentasAfectadas(transaccionSeleccionada).abono}</td>
                      <td className="text-right py-2">-</td>
                      <td className="text-right py-2 text-success">
                        $
                        {Number(
                          transaccionSeleccionada.tipo_transaccion === "amortizacion"
                            ? transaccionSeleccionada.capital_pagado
                            : transaccionSeleccionada.monto
                        ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </td>
                    </TableRow>

                    {getCuentasAfectadas(transaccionSeleccionada).adicional && (
                      <>
                        <TableRow>
                          <td className="font-medium py-2">{getCuentasAfectadas(transaccionSeleccionada).adicional.cargo}</td>
                          <td className="text-right py-2 text-destructive">
                            $
                            {Number(getCuentasAfectadas(transaccionSeleccionada).adicional.monto).toLocaleString("es-MX", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="text-right py-2">-</td>
                        </TableRow>

                        <TableRow>
                          <td className="font-medium py-2">{getCuentasAfectadas(transaccionSeleccionada).adicional.abono}</td>
                          <td className="text-right py-2">-</td>
                          <td className="text-right py-2 text-success">
                            $
                            {Number(getCuentasAfectadas(transaccionSeleccionada).adicional.monto).toLocaleString("es-MX", {
                              minimumFractionDigits: 2,
                            })}
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
