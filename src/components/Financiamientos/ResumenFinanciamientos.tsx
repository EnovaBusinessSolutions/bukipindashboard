import React, { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Wallet,
  Landmark,
  TrendingDown,
  TrendingUp,
  Clock3,
  CreditCard,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { useFinanciamientos, type Financiamiento, type TransaccionFinanciamiento } from "@/hooks/useFinanciamientos";
import TransaccionesTarjetaCredito from "./TransaccionesTarjetaCredito";
import TransaccionesFinanciamiento from "./TransaccionesFinanciamiento";

const money = (value: number) =>
  `$${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const asText = (v: unknown, fallback = "") => {
  if (v === undefined || v === null) return fallback;
  return String(v).trim();
};

const getTipoUi = (f: Financiamiento) =>
  String(f.tipo_ui || f.tipoUi || f.tipo_credito || f.tipo || "").toLowerCase();

const getTipoLabel = (f: Financiamiento) =>
  asText(f.tipo_label || f.tipoLabel) ||
  (getTipoUi(f) === "tarjeta_corporativa"
    ? "Tarjeta Corporativa"
    : getTipoUi(f) === "revolvente"
      ? "Crédito Revolvente"
      : "Crédito Simple");

const getInstitucion = (f: Financiamiento) =>
  f.institucion || f.institucion_financiera || "Sin institución";

const getMontoTotal = (f: Financiamiento) =>
  toNum(f.monto_total_vista ?? f.montoTotalVista ?? f.monto_total, 0);

const getSaldoActual = (f: Financiamiento) =>
  toNum(f.saldo_actual_vista ?? f.saldoActualVista ?? f.saldo_actual, 0);

const getSaldoInicial = (f: Financiamiento) => {
  const montoTotal = getMontoTotal(f);
  const saldoActual = getSaldoActual(f);
  const amortizado = toNum(f.total_amortizado_capital ?? f.totalAmortizadoCapital, 0);

  return montoTotal > 0 ? montoTotal : saldoActual + amortizado;
};

const getDisponible = (f: Financiamiento) =>
  Math.max(
    0,
    toNum(
      f.disponible_linea ??
        f.disponibleLinea ??
        f.disponible_actual ??
        f.disponibleActual,
      0
    )
  );

const getMontoAmortizado = (f: Financiamiento) =>
  Math.max(
    0,
    toNum(f.monto_pagado_capital ?? f.montoPagadoCapital, NaN) ||
      Math.max(0, getMontoTotal(f) - getSaldoActual(f))
  );

const getFecha = (tx: TransaccionFinanciamiento) => {
  const raw = tx.fecha || tx.created_at || tx.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getNombreFinanciamiento = (
  id: string | undefined,
  financiamientos: Financiamiento[]
) => {
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

const KpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  valueClassName = "",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  valueClassName?: string;
}) => {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={`text-2xl font-bold tracking-tight ${valueClassName}`}>{value}</div>
          {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
        </div>
        <div className="rounded-2xl border bg-slate-50 p-3">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
      </CardHeader>
    </Card>
  );
};

const FinancingAccordionHeader = ({
  financiamiento,
  leftLabel,
  midLabel,
  rightLabel,
  leftValue,
  midValue,
  rightValue,
  rightValueClassName = "",
}: {
  financiamiento: Financiamiento;
  leftLabel: string;
  midLabel: string;
  rightLabel: string;
  leftValue: string;
  midValue: string;
  rightValue: string;
  rightValueClassName?: string;
}) => {
  return (
    <div className="flex w-full flex-col gap-4 pr-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900">{financiamiento.nombre}</span>
          <Badge variant="outline">{getTipoLabel(financiamiento)}</Badge>
        </div>
        <span className="text-sm text-muted-foreground">{getInstitucion(financiamiento)}</span>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 lg:min-w-[520px]">
        <div className="rounded-xl border bg-slate-50 px-3 py-2 text-left">
          <p className="text-xs text-muted-foreground">{leftLabel}</p>
          <p className="font-semibold">{leftValue}</p>
        </div>
        <div className="rounded-xl border bg-slate-50 px-3 py-2 text-left">
          <p className="text-xs text-muted-foreground">{midLabel}</p>
          <p className="font-semibold">{midValue}</p>
        </div>
        <div className="rounded-xl border bg-slate-50 px-3 py-2 text-left">
          <p className="text-xs text-muted-foreground">{rightLabel}</p>
          <p className={`font-semibold ${rightValueClassName}`}>{rightValue}</p>
        </div>
      </div>
    </div>
  );
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
      const tipo = String(t.tipo || t.tipo_transaccion || "").toLowerCase();
      if (tipo !== "amortizacion") return sum;

      return (
        sum +
        toNum(
          t.monto_capital ??
            t.montoCapital ??
            t.capital_pagado ??
            t.monto,
          0
        )
      );
    }, 0);

    const totalInteresesPagados = transacciones.reduce((sum, t) => {
      const tipo = String(t.tipo || t.tipo_transaccion || "").toLowerCase();

      if (tipo === "pago_intereses") {
        return (
          sum +
          toNum(
            t.monto_intereses ??
              t.montoIntereses ??
              t.interes_pagado ??
              t.monto,
            0
          )
        );
      }

      return sum + toNum(t.interes_pagado, 0);
    }, 0);

    const totalCargos = transacciones.reduce((sum, t) => {
      const tipo = String(t.tipo || t.tipo_transaccion || "").toLowerCase();

      if (tipo === "cargo_intereses") {
        return sum + toNum(t.monto_intereses ?? t.montoIntereses ?? t.monto, 0);
      }

      if (tipo === "cargo_comision" || tipo === "cargo_moratorio" || tipo === "cargo_interes") {
        return sum + toNum(t.monto, 0);
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Amortizado"
          value={money(totalAmortizaciones || resumen?.total_amortizado_capital || 0)}
          subtitle="Capital pagado acumulado"
          icon={TrendingUp}
          valueClassName="text-emerald-600"
        />

        <KpiCard
          title="Intereses Pagados"
          value={money(totalInteresesPagados)}
          subtitle="Pagos aplicados a intereses"
          icon={Clock3}
          valueClassName="text-amber-600"
        />

        <KpiCard
          title="Cargos Acumulados"
          value={money(totalCargos)}
          subtitle="Intereses, moratorios y comisiones"
          icon={TrendingDown}
          valueClassName="text-rose-600"
        />

        <KpiCard
          title="Saldo Total Actual"
          value={money(resumen?.saldo_total_actual || 0)}
          subtitle="Saldo vigente del módulo"
          icon={Wallet}
        />
      </div>

      {ultimasTransacciones.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Últimos movimientos
            </CardTitle>
            <CardDescription>
              Resumen reciente de movimientos registrados en financiamientos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ultimasTransacciones.map((tx) => {
              const financingId =
                tx.financingId || tx.financing_id || tx.financiamiento_id || "";
              const fecha = getFecha(tx);

              return (
                <div
                  key={tx.id || tx._id}
                  className="flex flex-col gap-3 rounded-2xl border bg-white p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getBadgeVariant(String(tx.tipo || tx.tipo_transaccion || ""))}>
                        {getTipoTransaccionLabel(String(tx.tipo || tx.tipo_transaccion || ""))}
                      </Badge>
                      <span className="font-medium text-slate-900">
                        {getNombreFinanciamiento(financingId, financiamientos)}
                      </span>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {tx.descripcion || "Sin descripción"}
                    </div>

                    {fecha && (
                      <div className="text-xs text-muted-foreground">
                        {format(fecha, "dd/MM/yyyy", { locale: es })}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-semibold text-slate-900">
                      {money(toNum(tx.monto, 0))}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {tarjetas.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <CreditCard className="h-5 w-5" />
              Tarjetas de Crédito Corporativas
            </CardTitle>
            <CardDescription>
              Consulta saldos, disponibilidad y transacciones por tarjeta.
            </CardDescription>
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
                      <FinancingAccordionHeader
                        financiamiento={tarjeta}
                        leftLabel="Límite"
                        midLabel="Utilizado"
                        rightLabel="Disponible"
                        leftValue={money(montoTotal)}
                        midValue={money(saldoActual)}
                        rightValue={money(disponible)}
                        rightValueClassName="text-emerald-600"
                      />
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
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Landmark className="h-5 w-5" />
              Líneas de Crédito Revolventes
            </CardTitle>
            <CardDescription>
              Consulta línea aprobada, monto utilizado y disponibilidad restante.
            </CardDescription>
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
                      <FinancingAccordionHeader
                        financiamiento={financiamiento}
                        leftLabel="Línea Aprobada"
                        midLabel="Monto Utilizado"
                        rightLabel="Disponible"
                        leftValue={money(montoTotal)}
                        midValue={money(saldoActual)}
                        rightValue={money(disponible)}
                        rightValueClassName="text-emerald-600"
                      />
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
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Wallet className="h-5 w-5" />
              Créditos Simples
            </CardTitle>
            <CardDescription>
              Consulta monto original, saldo amortizado y pendiente por crédito.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {simples.map((financiamiento) => {
                const montoTotal = getMontoTotal(financiamiento);
                const saldoActual = getSaldoActual(financiamiento);
                const saldoInicial = getSaldoInicial(financiamiento);
                const amortizado = getMontoAmortizado(financiamiento);

                return (
                  <AccordionItem key={financiamiento.id} value={financiamiento.id}>
                    <AccordionTrigger>
                      <FinancingAccordionHeader
                        financiamiento={financiamiento}
                        leftLabel="Monto Original"
                        midLabel="Amortizado"
                        rightLabel="Pendiente"
                        leftValue={money(montoTotal)}
                        midValue={money(amortizado)}
                        rightValue={money(saldoActual)}
                        rightValueClassName="text-rose-600"
                      />
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