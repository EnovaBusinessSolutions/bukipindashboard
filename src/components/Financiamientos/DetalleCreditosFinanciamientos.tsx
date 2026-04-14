import React, { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFinanciamientos,
  type DireccionFinanciamiento,
  type Financiamiento,
} from "@/hooks/useFinanciamientos";

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const money = (value: number) =>
  `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateText = (value: unknown) => {
  if (!value) return "-";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "-";
  return format(d, "dd/MM/yyyy", { locale: es });
};

const getEstado = (f: Financiamiento) =>
  String(f.estado_ui || f.estadoUi || f.estatus || f.estado || "activo").toLowerCase();

const DetailCard = ({
  financiamiento,
  direccion,
}: {
  financiamiento: Financiamiento;
  direccion: DireccionFinanciamiento;
}) => {
  const esRealizado = direccion === "realizado";
  const montoPrestado = toNum(
    financiamiento.monto_total_vista ??
      financiamiento.montoTotalVista ??
      financiamiento.total_dispuesto ??
      financiamiento.monto_original ??
      financiamiento.montoOriginal,
    0
  );
  const saldoCapital = toNum(
    financiamiento.saldo_capital_actual ?? financiamiento.saldoCapitalActual ?? 0,
    0
  );
  const saldoTotal = toNum(
    financiamiento.saldo_total_actual ?? financiamiento.saldoTotalActual ?? saldoCapital,
    0
  );
  const cobradoCapital = toNum(
    financiamiento.total_amortizado_capital ?? financiamiento.totalAmortizadoCapital,
    Math.max(0, montoPrestado - saldoCapital)
  );
  const interesesGenerados = toNum(
    financiamiento.total_intereses_cargados ?? financiamiento.totalInteresesCargados,
    0
  );
  const interesesCobrados = toNum(
    financiamiento.total_intereses_pagados ?? financiamiento.totalInteresesPagados,
    0
  );
  const contraparte = esRealizado
    ? financiamiento.deudor_nombre || financiamiento.nombre
    : financiamiento.institucion || financiamiento.institucion_financiera || "Sin institución";

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-2xl font-semibold tracking-tight text-slate-900">
            {financiamiento.nombre}
          </h4>
          <p className="text-sm text-muted-foreground">{contraparte}</p>
          {esRealizado && financiamiento.deudor_rfc ? (
            <p className="text-xs text-muted-foreground">RFC: {financiamiento.deudor_rfc}</p>
          ) : null}
        </div>
        <Badge variant="outline">
          {esRealizado ? "Capital de Trabajo" : financiamiento.tipoLabel || financiamiento.tipo_label || "Crédito"}
        </Badge>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label={esRealizado ? "Monto prestado" : "Monto original"} value={money(montoPrestado)} />
        <Stat label={esRealizado ? "Cobrado" : "Amortizado"} value={money(cobradoCapital)} />
        <Stat label={esRealizado ? "Saldo por cobrar" : "Saldo actual"} value={money(esRealizado ? saldoCapital : saldoTotal)} />
        <Stat label="Intereses generados" value={money(interesesGenerados)} />
        <Stat label="Intereses cobrados" value={money(interesesCobrados)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Fecha de inicio" value={dateText(financiamiento.fecha_inicio || financiamiento.fechaInicio || financiamiento.fecha_apertura || financiamiento.fechaApertura)} />
        <Stat label="Fecha de vencimiento" value={dateText(financiamiento.fecha_vencimiento || financiamiento.fechaVencimiento)} />
        <Stat label="Tasa" value={`${toNum(financiamiento.tasa_interes_anual ?? financiamiento.tasaInteresAnual ?? financiamiento.tasa_interes, 0).toFixed(2)}%`} />
        <Stat label="Estado" value={String(financiamiento.estadoLabel || financiamiento.estado_label || getEstado(financiamiento)).toUpperCase()} />
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-semibold tracking-tight text-slate-900">{value}</p>
  </div>
);

const Section = ({ title, items, direccion }: { title: string; items: Financiamiento[]; direccion: DireccionFinanciamiento }) => (
  <Card className="rounded-2xl shadow-sm">
    <CardHeader>
      <CardTitle className="text-3xl font-semibold tracking-tight">
        {title} ({items.length})
      </CardTitle>
    </CardHeader>
    <CardContent>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-slate-50 px-6 py-12 text-center text-muted-foreground">
          No hay registros en esta sección.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <DetailCard key={item.id} financiamiento={item} direccion={direccion} />
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

const DetalleCreditosFinanciamientos = ({
  direccion = "recibido",
}: {
  direccion?: DireccionFinanciamiento;
}) => {
  const { financiamientos, isLoading } = useFinanciamientos(direccion);

  const { activos, liquidados, vencidos } = useMemo(() => {
    return {
      activos: financiamientos.filter((f) => getEstado(f) === "activo"),
      liquidados: financiamientos.filter((f) => ["liquidado", "pagado"].includes(getEstado(f))),
      vencidos: financiamientos.filter((f) => getEstado(f) === "vencido"),
    };
  }, [financiamientos]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title={direccion === "realizado" ? "Préstamos activos" : "Créditos activos"}
        items={activos}
        direccion={direccion}
      />
      {liquidados.length > 0 && (
        <Section
          title={direccion === "realizado" ? "Préstamos cobrados" : "Créditos pagados"}
          items={liquidados}
          direccion={direccion}
        />
      )}
      {vencidos.length > 0 && (
        <Section
          title={direccion === "realizado" ? "Préstamos vencidos" : "Créditos vencidos"}
          items={vencidos}
          direccion={direccion}
        />
      )}
    </div>
  );
};

export default DetalleCreditosFinanciamientos;
