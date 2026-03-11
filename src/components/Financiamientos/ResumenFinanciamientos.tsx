import React, { useMemo } from "react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import TransaccionesTarjetaCredito from "./TransaccionesTarjetaCredito";
import TransaccionesFinanciamiento from "./TransaccionesFinanciamiento";

const money = (value: number) =>
  `$${Number(value || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const getTipoUi = (f: any) => {
  const raw = String(f?.tipo || f?.tipo_credito || "").toLowerCase();

  if (raw === "tarjeta_credito" || raw === "tarjeta_corporativa") return "tarjeta_corporativa";
  if (raw === "linea_credito" || raw === "revolvente") return "revolvente";
  if (raw === "credito_simple" || raw === "simple" || raw === "prestamo") return "simple";

  return raw || "otro";
};

const getTipoLabel = (f: any) => {
  const tipo = getTipoUi(f);
  if (tipo === "tarjeta_corporativa") return "Tarjeta Corporativa";
  if (tipo === "revolvente") return "Crédito Revolvente";
  if (tipo === "simple") return "Crédito Simple";
  return "Financiamiento";
};

const getInstitucion = (f: any) =>
  f?.institucion ||
  f?.institucion_financiera ||
  "Sin institución";

const getMontoTotal = (f: any) => {
  const tipo = getTipoUi(f);

  if (tipo === "tarjeta_corporativa" || tipo === "revolvente") {
    return toNum(f?.linea_credito ?? f?.lineaCredito ?? f?.monto_total, 0);
  }

  return toNum(f?.monto_original ?? f?.montoOriginal ?? f?.monto_total, 0);
};

const getSaldoActual = (f: any) => {
  const tipo = getTipoUi(f);

  if (tipo === "tarjeta_corporativa" || tipo === "revolvente") {
    return toNum(
      f?.saldo_dispuesto_actual ??
        f?.saldoDispuestoActual ??
        f?.saldo_capital_actual ??
        f?.saldoCapitalActual ??
        f?.saldo_actual,
      0
    );
  }

  return toNum(
    f?.saldo_capital_actual ??
      f?.saldoCapitalActual ??
      f?.saldo_total_actual ??
      f?.saldoTotalActual ??
      f?.saldo_actual,
    0
  );
};

const getSaldoInicial = (f: any) => {
  const montoTotal = getMontoTotal(f);
  const saldoActual = getSaldoActual(f);
  const amortizado = toNum(
    f?.total_amortizado_capital ?? f?.totalAmortizadoCapital,
    0
  );

  return montoTotal > 0 ? montoTotal : saldoActual + amortizado;
};

const getDisponible = (f: any) => {
  const disponible = toNum(f?.disponible_actual ?? f?.disponibleActual, NaN);
  if (Number.isFinite(disponible)) return disponible;

  const montoTotal = getMontoTotal(f);
  const saldoActual = getSaldoActual(f);
  return Math.max(0, montoTotal - saldoActual);
};

const getFecha = (tx: any) => {
  const raw = tx?.fecha || tx?.created_at || tx?.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const ResumenFinanciamientos = () => {
  const { transacciones, financiamientos, resumen, isLoading } = useFinanciamientos();

  const {
    tarjetas,
    revolventes,
    simples,
    totalAmortizaciones,
    totalInteresesPagados,
    totalCargos,
    ultimasTransacciones,
  } = useMemo(() => {
    const tarjetas = financiamientos.filter((f) => getTipoUi(f) === "tarjeta_corporativa");
    const revolventes = financiamientos.filter((f) => getTipoUi(f) === "revolvente");
    const simples = financiamientos.filter(
      (f) => getTipoUi(f) !== "tarjeta_corporativa" && getTipoUi(f) !== "revolvente"
    );

    const totalAmortizaciones = transacciones.reduce((sum, t) => {
      const tipo = String(t?.tipo || t?.tipo_transaccion || "").toLowerCase();
      if (tipo !== "amortizacion") return sum;

      return (
        sum +
        toNum(
          t?.monto_capital ??
            t?.montoCapital ??
            t?.capital_pagado ??
            t?.monto,
          0
        )
      );
    }, 0);

    const totalInteresesPagados = transacciones.reduce((sum, t) => {
      const tipo = String(t?.tipo || t?.tipo_transaccion || "").toLowerCase();

      if (tipo === "pago_intereses") {
        return (
          sum +
          toNum(
            t?.monto_intereses ??
              t?.montoIntereses ??
              t?.interes_pagado ??
              t?.monto,
            0
          )
        );
      }

      return sum + toNum(t?.interes_pagado, 0);
    }, 0);

    const totalCargos = transacciones.reduce((sum, t) => {
      const tipo = String(t?.tipo || t?.tipo_transaccion || "").toLowerCase();

      if (tipo === "cargo_intereses") {
        return (
          sum +
          toNum(
            t?.monto_intereses ??
              t?.montoIntereses ??
              t?.monto,
            0
          )
        );
      }

      if (tipo === "cargo_comision" || tipo === "cargo_moratorio") {
        return sum + toNum(t?.monto, 0);
      }

      if (tipo === "cargo_interes") {
        return sum + toNum(t?.monto, 0);
      }

      return sum;
    }, 0);

    const ultimasTransacciones = [...transacciones]
      .sort((a, b) => {
        const ad = getFecha(a)?.getTime() || 0;
        const bd = getFecha(b)?.getTime() || 0;
        return bd - ad;
      })
      .slice(0, 8);

    return {
      tarjetas,
      revolventes,
      simples,
      totalAmortizaciones,
      totalInteresesPagados,
      totalCargos,
      ultimasTransacciones,
    };
  }, [financiamientos, transacciones]);

  const getNombreFinanciamiento = (id?: string) => {
    if (!id) return "N/A";
    const found = financiamientos.find((f) => f.id === id || f._id === id);
    return found?.nombre || "N/A";
  };

  const getBadgeVariant = (tipo: string): "default" | "secondary" | "destructive" => {
    const t = String(tipo || "").toLowerCase();
    if (t === "amortizacion" || t === "pago_intereses" || t === "pago_comision") return "default";
    if (t === "cargo_intereses" || t === "cargo_interes" || t === "cargo_moratorio") return "destructive";
    return "secondary";
  };

  const getTipoTransaccionLabel = (tipoRaw: string) => {
    const tipo = String(tipoRaw || "").toLowerCase();

    const labels: Record<string, string> = {
      apertura: "Apertura",
      disposicion: "Disposición",
      amortizacion: "Amortización",
      cargo_intereses: "Cargo por Intereses",
      cargo_interes: "Cargo por Interés",
      pago_intereses: "Pago de Intereses",
      cargo_comision: "Cargo por Comisión",
      pago_comision: "Pago de Comisión",
      cargo_moratorio: "Cargo Moratorio",
      desembolso: "Desembolso",
    };

    return labels[tipo] || tipoRaw || "Movimiento";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Amortizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {money(totalAmortizaciones || resumen?.total_amortizado_capital || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Intereses Pagados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {money(totalInteresesPagados)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cargos Acumulados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {money(totalCargos)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Saldo Total Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {money(resumen?.saldo_total_actual || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {ultimasTransacciones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Últimos movimientos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ultimasTransacciones.map((tx) => {
              const financingId =
                tx.financingId || tx.financing_id || tx.financiamiento_id || "";
              const fecha = getFecha(tx);

              return (
                <div
                  key={tx.id || tx._id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getBadgeVariant(String(tx.tipo || tx.tipo_transaccion || ""))}>
                        {getTipoTransaccionLabel(String(tx.tipo || tx.tipo_transaccion || ""))}
                      </Badge>
                      <span className="font-medium">{getNombreFinanciamiento(financingId)}</span>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {tx.descripcion || "Sin descripción"}
                    </div>

                    {fecha && (
                      <div className="text-xs text-muted-foreground">
                        {format(fecha, "dd/MM/yyyy")}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="font-semibold">{money(toNum(tx.monto, 0))}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {tarjetas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tarjetas de Crédito Corporativas</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {tarjetas.map((tarjeta) => {
                const montoTotal = getMontoTotal(tarjeta);
                const saldoActual = getSaldoActual(tarjeta);
                const disponible = getDisponible(tarjeta);

                return (
                  <AccordionItem key={tarjeta.id} value={tarjeta.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between items-center w-full pr-4 gap-4">
                        <div className="flex flex-col items-start text-left">
                          <span className="font-medium">{tarjeta.nombre}</span>
                          <span className="text-sm text-muted-foreground">
                            {getInstitucion(tarjeta)}
                          </span>
                        </div>

                        <div className="flex gap-4 text-sm flex-wrap justify-end">
                          <div>
                            <span className="text-muted-foreground">Límite: </span>
                            <span className="font-medium">{money(montoTotal)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Utilizado: </span>
                            <span className="font-medium">{money(saldoActual)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Disponible: </span>
                            <span className="font-medium text-green-600">{money(disponible)}</span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent>
                      <TransaccionesTarjetaCredito
                        financiamientoId={tarjeta.id}
                        nombreTarjeta={tarjeta.nombre}
                        limiteCredito={montoTotal}
                        saldoActual={saldoActual}
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {revolventes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Líneas de Crédito Revolventes</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {revolventes.map((financiamiento) => {
                const montoTotal = getMontoTotal(financiamiento);
                const saldoActual = getSaldoActual(financiamiento);
                const saldoInicial = getSaldoInicial(financiamiento);
                const disponible = getDisponible(financiamiento);

                return (
                  <AccordionItem key={financiamiento.id} value={financiamiento.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between items-center w-full pr-4 gap-4">
                        <div className="flex flex-col items-start text-left">
                          <span className="font-medium">{financiamiento.nombre}</span>
                          <span className="text-sm text-muted-foreground">
                            {getInstitucion(financiamiento)}
                          </span>
                        </div>

                        <div className="flex gap-4 text-sm flex-wrap justify-end">
                          <div>
                            <span className="text-muted-foreground">Línea Aprobada: </span>
                            <span className="font-medium">{money(montoTotal)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Monto Utilizado: </span>
                            <span className="font-medium text-destructive">
                              {money(saldoActual)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Disponible: </span>
                            <span className="font-medium text-green-600">
                              {money(disponible)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent>
                      <TransaccionesFinanciamiento
                        financiamientoId={financiamiento.id}
                        nombreFinanciamiento={financiamiento.nombre}
                        montoTotal={montoTotal}
                        saldoActual={saldoActual}
                        saldoInicial={saldoInicial}
                        tipoCredito={getTipoLabel(financiamiento)}
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {simples.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Créditos Simples</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {simples.map((financiamiento) => {
                const montoTotal = getMontoTotal(financiamiento);
                const saldoActual = getSaldoActual(financiamiento);
                const saldoInicial = getSaldoInicial(financiamiento);
                const amortizado = Math.max(0, montoTotal - saldoActual);

                return (
                  <AccordionItem key={financiamiento.id} value={financiamiento.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between items-center w-full pr-4 gap-4">
                        <div className="flex flex-col items-start text-left">
                          <span className="font-medium">{financiamiento.nombre}</span>
                          <span className="text-sm text-muted-foreground">
                            {getInstitucion(financiamiento)}
                          </span>
                        </div>

                        <div className="flex gap-4 text-sm flex-wrap justify-end">
                          <div>
                            <span className="text-muted-foreground">Monto Original: </span>
                            <span className="font-medium">{money(montoTotal)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Amortizado: </span>
                            <span className="font-medium text-green-600">
                              {money(amortizado)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pendiente: </span>
                            <span className="font-medium text-destructive">
                              {money(saldoActual)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent>
                      <TransaccionesFinanciamiento
                        financiamientoId={financiamiento.id}
                        nombreFinanciamiento={financiamiento.nombre}
                        montoTotal={montoTotal}
                        saldoActual={saldoActual}
                        saldoInicial={saldoInicial}
                        tipoCredito={getTipoLabel(financiamiento)}
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResumenFinanciamientos;