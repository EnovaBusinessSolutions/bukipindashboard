import React, { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinanciamientos, type Financiamiento } from "@/hooks/useFinanciamientos";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const asText = (v: unknown, fallback = "") => {
  if (v === undefined || v === null) return fallback;
  return String(v).trim();
};

const formatMoney = (value: number) =>
  `$${toNum(value, 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPercent = (value: number) => `${toNum(value, 0).toFixed(1)}%`;

const formatDateSafe = (value: unknown) => {
  if (!value) return "-";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "-";
  return format(d, "dd/MM/yyyy", { locale: es });
};

const getTipoUi = (f: Financiamiento) =>
  String(f.tipo_ui || f.tipoUi || f.tipo_credito || f.tipo || "simple").toLowerCase();

const getTipoLabel = (f: Financiamiento) =>
  asText(f.tipo_label || f.tipoLabel) ||
  (getTipoUi(f) === "revolvente"
    ? "Crédito Revolvente"
    : getTipoUi(f) === "tarjeta_corporativa"
      ? "Tarjeta Corporativa"
      : "Crédito Simple");

const getEstadoUi = (f: Financiamiento) =>
  String(f.estado_ui || f.estadoUi || f.estatus || f.estado || "activo").toLowerCase();

const getEstadoLabel = (f: Financiamiento) =>
  asText(f.estado_label || f.estadoLabel) ||
  (getEstadoUi(f) === "liquidado"
    ? "PAGADO"
    : getEstadoUi(f) === "vencido"
      ? "VENCIDO"
      : getEstadoUi(f) === "cancelado"
        ? "CANCELADO"
        : getEstadoUi(f) === "suspendido"
          ? "SUSPENDIDO"
          : "ACTIVO");

const getEstadoBadgeClass = (estado: string) => {
  if (estado === "activo") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  }
  if (estado === "liquidado" || estado === "pagado") {
    return "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100";
  }
  if (estado === "vencido") {
    return "border-red-200 bg-red-50 text-red-700 hover:bg-red-50";
  }
  if (estado === "cancelado" || estado === "suspendido") {
    return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50";
  }
  return "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100";
};

const getTipoBadgeClass = (tipo: string) => {
  if (tipo === "revolvente") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-50";
  }
  if (tipo === "tarjeta_corporativa") {
    return "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50";
  }
  return "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-50";
};

const getInstitucion = (f: Financiamiento) =>
  asText(f.institucion || f.institucion_financiera, "Sin institución");

const getCuentaDisplay = (f: Financiamiento) =>
  asText(f.cuenta_display || f.cuentaDisplay) ||
  asText(f.numero_cuenta || f.numeroCuenta) ||
  asText(f.numero_contrato || f.numeroContrato) ||
  asText(f.referencia);

const getMontoTotalVista = (f: Financiamiento) =>
  toNum(f.monto_total_vista ?? f.montoTotalVista ?? f.monto_total, 0);

const getSaldoActualVista = (f: Financiamiento) =>
  toNum(f.saldo_actual_vista ?? f.saldoActualVista ?? f.saldo_actual, 0);

const getMontoPagadoCapital = (f: Financiamiento) =>
  toNum(f.monto_pagado_capital ?? f.montoPagadoCapital, 0);

const getMontoPendienteCapital = (f: Financiamiento) =>
  toNum(f.monto_pendiente_capital ?? f.montoPendienteCapital, 0);

const getDisponibleLinea = (f: Financiamiento) =>
  toNum(f.disponible_linea ?? f.disponibleLinea ?? f.disponible_actual ?? f.disponibleActual, 0);

const getUsoLineaPct = (f: Financiamiento) =>
  Math.min(100, Math.max(0, toNum(f.uso_linea_pct ?? f.usoLineaPct, 0)));

const getProgresoPagoPct = (f: Financiamiento) =>
  Math.min(100, Math.max(0, toNum(f.progreso_pago_pct ?? f.progresoPagoPct, 0)));

const getTasa = (f: Financiamiento) =>
  toNum(f.tasa_interes_anual ?? f.tasaInteresAnual ?? f.tasa_interes, 0);

const getPlazo = (f: Financiamiento) =>
  toNum(f.plazo_meses ?? f.plazoMeses, 0);

const getFechaInicio = (f: Financiamiento) =>
  f.fecha_inicio || f.fechaInicio || f.fecha_apertura || f.fechaApertura || null;

const getFechaVencimiento = (f: Financiamiento) =>
  f.fecha_vencimiento || f.fechaVencimiento || null;

const getDescripcion = (f: Financiamiento) =>
  asText(f.descripcion_corta || f.descripcionCorta) || asText(f.descripcion);

const getCondiciones = (f: Financiamiento) =>
  asText(f.condiciones_texto || f.condicionesTexto) || asText(f.condiciones) || asText(f.notas);

const getModoVisual = (f: Financiamiento) =>
  asText(f.modo_visual || f.modoVisual) === "uso_linea" ? "uso_linea" : "progreso_pago";

const FinancialStat = ({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) => {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tracking-tight ${valueClassName}`}>{value}</p>
    </div>
  );
};

const DetailCard = ({ f }: { f: Financiamiento }) => {
  const tipoUi = getTipoUi(f);
  const tipoLabel = getTipoLabel(f);
  const estadoUi = getEstadoUi(f);
  const estadoLabel = getEstadoLabel(f);

  const institucion = getInstitucion(f);
  const cuentaDisplay = getCuentaDisplay(f);
  const descripcion = getDescripcion(f);
  const condiciones = getCondiciones(f);

  const montoTotalVista = getMontoTotalVista(f);
  const saldoActualVista = getSaldoActualVista(f);
  const montoPagadoCapital = getMontoPagadoCapital(f);
  const montoPendienteCapital = getMontoPendienteCapital(f);
  const disponibleLinea = getDisponibleLinea(f);

  const tasa = getTasa(f);
  const plazo = getPlazo(f);

  const fechaInicio = getFechaInicio(f);
  const fechaVencimiento = getFechaVencimiento(f);

  const modoVisual = getModoVisual(f);
  const usoLineaPct = getUsoLineaPct(f);
  const progresoPagoPct = getProgresoPagoPct(f);

  const esLinea = modoVisual === "uso_linea";

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm transition-all">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h4 className="text-2xl font-semibold tracking-tight text-slate-900">{f.nombre}</h4>
          <p className="text-sm text-muted-foreground">{institucion}</p>

          {cuentaDisplay ? (
            <p className="text-xs text-muted-foreground">Cuenta: {cuentaDisplay}</p>
          ) : null}

          {descripcion ? (
            <p className="pt-2 text-sm text-slate-600">{descripcion}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Badge variant="outline" className={getTipoBadgeClass(tipoUi)}>
            {tipoLabel}
          </Badge>
          <Badge variant="outline" className={getEstadoBadgeClass(estadoUi)}>
            {estadoLabel}
          </Badge>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <FinancialStat
          label={esLinea ? "Línea Total" : "Monto Original"}
          value={formatMoney(montoTotalVista)}
        />
        <FinancialStat
          label={esLinea ? "Saldo Actual" : "Saldo Actual"}
          value={formatMoney(saldoActualVista)}
          valueClassName="text-red-600"
        />
        <FinancialStat
          label="Tasa de Interés"
          value={`${formatPercent(tasa)} anual`}
        />
        <FinancialStat
          label="Plazo"
          value={`${plazo || 0} ${plazo === 1 ? "mes" : "meses"}`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Fecha de Inicio</p>
          <p className="text-base font-medium text-slate-900">{formatDateSafe(fechaInicio)}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Fecha de Vencimiento</p>
          <p className="text-base font-medium text-slate-900">{formatDateSafe(fechaVencimiento)}</p>
        </div>

        {tipoUi === "tarjeta_corporativa" ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Tipo de Crédito</p>
            <p className="text-base font-medium text-slate-900">{tipoLabel}</p>
          </div>
        ) : null}
      </div>

      {condiciones ? (
        <div className="mt-6 space-y-2">
          <p className="text-xs text-muted-foreground">Condiciones</p>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {condiciones}
          </div>
        </div>
      ) : null}

      {esLinea ? (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Uso de Línea de Crédito</span>
            <span className="font-semibold text-slate-900">
              {formatPercent(usoLineaPct)} utilizado
            </span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="flex h-full w-full">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.max(0, 100 - usoLineaPct)}%` }}
                title="Disponible"
              />
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${usoLineaPct}%` }}
                title="Utilizado"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              Disponible: {formatMoney(disponibleLinea)}
            </span>

            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              Pendiente: {formatMoney(montoPendienteCapital)}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Progreso de Pago</span>
            <span className="font-semibold text-slate-900">
              {formatPercent(progresoPagoPct)} completado
            </span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-sky-600 transition-all"
              style={{ width: `${progresoPagoPct}%` }}
            />
          </div>

          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Pagado: {formatMoney(montoPagadoCapital)}</span>
            <span>Pendiente: {formatMoney(montoPendienteCapital)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const Section = ({
  title,
  count,
  children,
  titleClassName = "",
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  titleClassName?: string;
}) => {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className={`text-3xl font-semibold tracking-tight ${titleClassName}`}>
          {title} ({count})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">{children}</div>
      </CardContent>
    </Card>
  );
};

const EmptyState = ({ text }: { text: string }) => {
  return (
    <div className="rounded-2xl border border-dashed bg-slate-50 px-6 py-12 text-center text-muted-foreground">
      {text}
    </div>
  );
};

const DetalleCreditosFinanciamientos = () => {
  const { financiamientos, isLoading } = useFinanciamientos();

  const { creditosActivos, creditosPagados, creditosVencidos } = useMemo(() => {
    const activos = financiamientos.filter((f) => getEstadoUi(f) === "activo");
    const pagados = financiamientos.filter((f) => {
      const estado = getEstadoUi(f);
      return estado === "liquidado" || estado === "pagado";
    });
    const vencidos = financiamientos.filter((f) => getEstadoUi(f) === "vencido");

    return {
      creditosActivos: activos,
      creditosPagados: pagados,
      creditosVencidos: vencidos,
    };
  }, [financiamientos]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section title="Créditos Activos" count={creditosActivos.length}>
        {creditosActivos.length > 0 ? (
          creditosActivos.map((f) => <DetailCard key={f.id} f={f} />)
        ) : (
          <EmptyState text="No hay créditos activos" />
        )}
      </Section>

      {creditosPagados.length > 0 && (
        <Section title="Créditos Pagados" count={creditosPagados.length}>
          {creditosPagados.map((f) => (
            <DetailCard key={f.id} f={f} />
          ))}
        </Section>
      )}

      {creditosVencidos.length > 0 && (
        <Section
          title="Créditos Vencidos"
          count={creditosVencidos.length}
          titleClassName="text-red-700"
        >
          {creditosVencidos.map((f) => (
            <DetailCard key={f.id} f={f} />
          ))}
        </Section>
      )}
    </div>
  );
};

export default DetalleCreditosFinanciamientos;