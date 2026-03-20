import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Eye, CalendarRange, Wallet, ReceiptText, Scale, Sparkles, Landmark, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

import { apiFetch } from "@/lib/api";
import { useEstadoResultadosMensual } from "@/hooks/useEstadoResultadosMensual";

interface TransaccionImpuesto {
  id: string;
  mes: number;
  ano: number;
  utilidad_antes_impuestos: number;
  tasa_isr: number;
  isr_calculado: number;
  isr_real: number;
  diferencia: number;
  observaciones: string | null;
  created_at: string;

  egreso?: {
    tipo_pago: string; // contado|credito|parcial
    metodo_pago: string | null; // transferencia|efectivo|null
    monto_pagado: number;
    monto_pendiente: number;
    cuenta_codigo: string;
  } | null;
}

type AsientoDetalle = {
  id: string;
  cuenta_codigo: string;
  descripcion: string;
  debe: number;
  haber: number;
  cuentas?: {
    codigo: string;
    nombre: string;
  } | null;
};

type AsientoContable = {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string; // YYYY-MM-DD
  detalle_asientos: AsientoDetalle[];
};

const meses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function normalize<T = any>(json: any): T {
  return (json?.data ?? json) as T;
}

export const ResumenImpuestos = () => {
  const currentDate = new Date();

  const [mesSeleccionado, setMesSeleccionado] = useState<string>("todos");
  const [anoSeleccionado, setAnoSeleccionado] = useState<number>(currentDate.getFullYear());

  const [detalleAsiento, setDetalleAsiento] = useState<(AsientoContable & { transaccion: TransaccionImpuesto }) | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: resultadosMensuales } = useEstadoResultadosMensual(anoSeleccionado);

  const { data: transacciones = [], isFetching: loading } = useQuery({
    queryKey: ["impuestos-resumen", anoSeleccionado, mesSeleccionado],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("ano", String(anoSeleccionado));
      if (mesSeleccionado !== "todos") qs.set("mes", mesSeleccionado);

      const json = await apiFetch(`/api/impuestos/isr/resumen?${qs.toString()}`);
      return normalize<TransaccionImpuesto[]>(json) ?? [];
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value || 0);

  const verDetalleAsiento = async (transaccion: TransaccionImpuesto) => {
    const qs = new URLSearchParams();
    qs.set("mes", String(transaccion.mes));
    qs.set("ano", String(transaccion.ano));

    const json = await apiFetch(`/api/impuestos/isr/asiento?${qs.toString()}`);
    const asiento = normalize<AsientoContable | null>(json);

    if (asiento) {
      setDetalleAsiento({
        ...(asiento as any),
        transaccion,
      });
      setDialogOpen(true);
    }
  };

  const mesActual = currentDate.getMonth() + 1;
  const anoActual = currentDate.getFullYear();

  const mesesParaAcumular =
    anoSeleccionado === anoActual ? resultadosMensuales?.slice(0, mesActual) || [] : resultadosMensuales || [];

  const utilidadAcumuladaReal = mesesParaAcumular.reduce((sum: number, m: any) => sum + (m.utilidadAntesImpuestos || 0), 0);

  const tasaISR = 0.3;
  const isrTeoricoAcumulado = utilidadAcumuladaReal > 0 ? utilidadAcumuladaReal * tasaISR : 0;

  const isrRegistradoTotal = transacciones.reduce((sum, t) => sum + Number(t.isr_real || 0), 0);

  const diferencia = isrRegistradoTotal - isrTeoricoAcumulado;

  const totales = useMemo(
    () => ({
      utilidad: utilidadAcumuladaReal,
      calculado: isrTeoricoAcumulado,
      real: isrRegistradoTotal,
      diferencia,
    }),
    [utilidadAcumuladaReal, isrTeoricoAcumulado, isrRegistradoTotal, diferencia]
  );

  return (
    <div className="space-y-6">
      {/* Hero / Header visual */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-emerald-50/70 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_24%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              Resumen fiscal premium
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Control y seguimiento del ISR registrado
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-[15px]">
                Visualiza el comportamiento fiscal del ejercicio, compara el ISR teórico contra lo ya registrado y revisa
                el desglose contable de cada movimiento con una vista más ejecutiva y clara.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <CalendarRange className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Ejercicio</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">{anoSeleccionado}</p>
              <p className="mt-1 text-xs text-slate-500">
                {mesSeleccionado === "todos" ? "Todos los meses" : meses[Number(mesSeleccionado) - 1]}
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <ReceiptText className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Registros</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">{transacciones.length}</p>
              <p className="mt-1 text-xs text-slate-500">
                movimiento{transacciones.length !== 1 ? "s" : ""} fiscal{transacciones.length !== 1 ? "es" : ""}
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <Landmark className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">ISR acumulado</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">{formatCurrency(totales.real)}</p>
              <p className="mt-1 text-xs text-slate-500">Registrado en el período filtrado</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="overflow-hidden rounded-3xl border-slate-200/70 bg-white/95 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
            Filtros de consulta
          </CardTitle>
          <CardDescription className="text-slate-600">
            Filtra las transacciones por período para analizar el comportamiento fiscal con mayor detalle.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mes-filtro" className="text-[13px] font-semibold text-slate-700">
              Mes
            </Label>
            <Select value={mesSeleccionado} onValueChange={setMesSeleccionado}>
              <SelectTrigger
                id="mes-filtro"
                className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 text-slate-800 shadow-sm transition-all hover:border-emerald-300 focus:ring-2 focus:ring-emerald-500/20"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-200">
                <SelectItem value="todos">Todos los meses</SelectItem>
                {meses.map((mes, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                    {mes}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ano-filtro" className="text-[13px] font-semibold text-slate-700">
              Año
            </Label>
            <Select value={anoSeleccionado.toString()} onValueChange={(value) => setAnoSeleccionado(parseInt(value))}>
              <SelectTrigger
                id="ano-filtro"
                className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 text-slate-800 shadow-sm transition-all hover:border-emerald-300 focus:ring-2 focus:ring-emerald-500/20"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-200">
                {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resumen General */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="group overflow-hidden rounded-3xl border-slate-200/70 bg-gradient-to-br from-white via-white to-emerald-50/70 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-35px_rgba(16,185,129,0.35)]">
          <CardHeader className="pb-3">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700 ring-1 ring-emerald-200">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Base fiscal
              </div>
            </div>

            <CardDescription className="text-slate-600">
              Utilidad Acumulada {anoSeleccionado}
              {anoSeleccionado === anoActual && ` (hasta ${meses[mesActual - 1]})`}
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(totales.utilidad)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs leading-5 text-slate-500">Calculada automáticamente desde asientos contables del ejercicio.</p>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden rounded-3xl border-slate-200/70 bg-gradient-to-br from-white via-white to-cyan-50/70 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-35px_rgba(6,182,212,0.35)]">
          <CardHeader className="pb-3">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700 ring-1 ring-cyan-200">
                <Scale className="h-5 w-5" />
              </div>
              <div className="rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                Referencia
              </div>
            </div>

            <CardDescription className="text-slate-600">ISR Teórico (30%)</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(totales.calculado)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs leading-5 text-slate-500">Estimado sobre la utilidad acumulada real del año en curso.</p>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden rounded-3xl border-slate-200/70 bg-gradient-to-br from-white via-white to-violet-50/70 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-35px_rgba(139,92,246,0.35)]">
          <CardHeader className="pb-3">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl bg-violet-100 p-3 text-violet-700 ring-1 ring-violet-200">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                Registrado
              </div>
            </div>

            <CardDescription className="text-slate-600">ISR Registrado</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(totales.real)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs leading-5 text-slate-500">
              {transacciones.length} pago{transacciones.length !== 1 ? "s" : ""} registrado{transacciones.length !== 1 ? "s" : ""}
              {" "}en el período.
            </p>
          </CardContent>
        </Card>

        <Card
          className={`group overflow-hidden rounded-3xl border shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-1 ${
            diferencia > 0
              ? "border-amber-200 bg-gradient-to-br from-white via-white to-amber-50/80 hover:shadow-[0_30px_70px_-35px_rgba(245,158,11,0.35)]"
              : diferencia < 0
              ? "border-red-200 bg-gradient-to-br from-white via-white to-red-50/80 hover:shadow-[0_30px_70px_-35px_rgba(239,68,68,0.35)]"
              : "border-emerald-200 bg-gradient-to-br from-white via-white to-emerald-50/80 hover:shadow-[0_30px_70px_-35px_rgba(34,197,94,0.35)]"
          }`}
        >
          <CardHeader className="pb-3">
            <div className="mb-4 flex items-start justify-between">
              <div
                className={`rounded-2xl p-3 ring-1 ${
                  diferencia > 0
                    ? "bg-amber-100 text-amber-700 ring-amber-200"
                    : diferencia < 0
                    ? "bg-red-100 text-red-700 ring-red-200"
                    : "bg-emerald-100 text-emerald-700 ring-emerald-200"
                }`}
              >
                <Scale className="h-5 w-5" />
              </div>
              <div
                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  diferencia > 0
                    ? "bg-amber-50 text-amber-700"
                    : diferencia < 0
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                Balance
              </div>
            </div>

            <CardDescription className="text-slate-600">Diferencia</CardDescription>
            <CardTitle
              className={`text-2xl font-bold tracking-tight ${
                diferencia > 0 ? "text-amber-600" : diferencia < 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {diferencia > 0 ? "+" : ""}
              {formatCurrency(diferencia)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs leading-5 text-slate-500">
              {diferencia > 0 && "Has registrado un ISR superior al cálculo teórico del período."}
              {diferencia < 0 && `Existe un saldo estimado pendiente por ${formatCurrency(Math.abs(diferencia))}.`}
              {diferencia === 0 && "El ISR registrado coincide con el cálculo estimado del ejercicio."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Transacciones */}
      <Card className="overflow-hidden rounded-3xl border-slate-200/70 bg-white/95 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-slate-900 via-emerald-600 to-cyan-500" />
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <FileText className="h-5 w-5 text-emerald-600" />
                Historial de Transacciones
              </CardTitle>
              <CardDescription className="mt-1 text-slate-600">
                Registro detallado mensual del ejercicio fiscal actual con su contexto contable.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                {transacciones.length} registros
              </Badge>
              <Badge className="rounded-full bg-emerald-600 px-3 py-1 text-white shadow-sm hover:bg-emerald-600">
                Bukipin Fiscal
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-sm text-slate-500">
              Cargando transacciones...
            </div>
          ) : transacciones.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 text-center">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-500">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-slate-800">No hay transacciones registradas</p>
                <p className="mt-1 text-sm text-slate-500">
                  Cuando existan registros de ISR aparecerán aquí con su trazabilidad contable.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/80">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/90">
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className="h-12 whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                        Período
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-right text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                        Utilidad
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-right text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                        Tasa
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-right text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                        ISR Calculado
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-right text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                        ISR Registrado
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                        Tipo Pago
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                        Método
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-right text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                        Monto Pagado
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-right text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                        Saldo Pendiente
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                        Cuenta
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                        Estado
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {transacciones.map((t, index) => (
                      <TableRow
                        key={t.id}
                        className={`group border-slate-200 transition-colors hover:bg-emerald-50/40 ${
                          index % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                        }`}
                      >
                        <TableCell className="whitespace-nowrap">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">
                              {meses[t.mes - 1]} {t.ano}
                            </p>
                            <p className="text-xs text-slate-500">Periodo fiscal</p>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="font-medium text-slate-800">{formatCurrency(t.utilidad_antes_impuestos)}</span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {t.tasa_isr}%
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="font-medium text-slate-800">{formatCurrency(t.isr_calculado)}</span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="font-semibold text-slate-900">{formatCurrency(t.isr_real)}</span>
                        </TableCell>

                        <TableCell>
                          {t.egreso?.tipo_pago === "contado" ? (
                            <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600">Pago Total</Badge>
                          ) : t.egreso?.tipo_pago === "credito" ? (
                            <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 text-amber-700">
                              A Crédito
                            </Badge>
                          ) : t.egreso?.tipo_pago === "parcial" ? (
                            <Badge className="rounded-full bg-amber-500 text-white hover:bg-amber-500">Pago Parcial</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {t.egreso?.metodo_pago ? (
                            <span className="capitalize text-slate-700">{t.egreso.metodo_pago}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          {t.egreso?.monto_pagado ? (
                            <span className="font-semibold text-emerald-600">{formatCurrency(t.egreso.monto_pagado)}</span>
                          ) : (
                            <span className="text-muted-foreground">$0.00</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          {t.egreso?.monto_pendiente && t.egreso.monto_pendiente > 0 ? (
                            <span className="font-semibold text-red-600">{formatCurrency(t.egreso.monto_pendiente)}</span>
                          ) : (
                            <span className="text-muted-foreground">$0.00</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <span className="inline-flex rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono font-medium text-slate-700">
                            {t.egreso?.cuenta_codigo || "-"}
                          </span>
                        </TableCell>

                        <TableCell>
                          {t.egreso?.monto_pendiente && t.egreso.monto_pendiente > 0 ? (
                            <Badge variant="destructive" className="rounded-full">
                              Por Pagar
                            </Badge>
                          ) : t.egreso?.monto_pagado && t.egreso.monto_pagado > 0 ? (
                            <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600">Pagado</Badge>
                          ) : (
                            <Badge variant="secondary" className="rounded-full">
                              Registrado
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => verDetalleAsiento(t)}
                            className="h-9 w-9 rounded-xl border border-transparent p-0 text-slate-600 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            title="Ver desglose contable"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notas sobre Asientos Contables */}
      <Card className="overflow-hidden rounded-3xl border border-blue-200/70 bg-gradient-to-br from-blue-50 via-cyan-50 to-white shadow-[0_16px_40px_-30px_rgba(37,99,235,0.35)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Landmark className="h-4 w-4 text-blue-600" />
            Asientos contables automáticos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
          <p>
            Cada registro de impuesto genera automáticamente un asiento contable de doble partida para mantener la
            consistencia financiera y fiscal del módulo.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-blue-200/70 bg-white/80 p-4 shadow-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Debe</p>
              <p className="font-medium text-slate-800">Cuenta 6001 (ISR)</p>
              <p className="text-xs text-slate-500">Se reconoce el monto del impuesto registrado.</p>
            </div>

            <div className="rounded-2xl border border-cyan-200/70 bg-white/80 p-4 shadow-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Haber</p>
              <p className="font-medium text-slate-800">Cuenta 1002 (Bancos) o 2001 (Proveedores)</p>
              <p className="text-xs text-slate-500">Depende del tipo y la forma en la que se registra el pago.</p>
            </div>
          </div>

          <p className="text-slate-600">
            Haz clic en el ícono del ojo para revisar el desglose contable detallado de cada transacción.
          </p>
        </CardContent>
      </Card>

      {/* Dialog para mostrar detalle del asiento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl rounded-3xl border-slate-200 bg-white p-0 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.45)]">
          <div className="overflow-hidden rounded-3xl">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-700 px-6 py-5 text-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold tracking-tight">Desglose Contable</DialogTitle>
                <DialogDescription className="mt-1 text-slate-200">
                  Asiento: {detalleAsiento?.numero_asiento} - {detalleAsiento?.descripcion}
                </DialogDescription>
              </DialogHeader>
            </div>

            {detalleAsiento && (
              <div className="space-y-5 p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Fecha</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {new Date(detalleAsiento.fecha).toLocaleDateString("es-MX")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">ISR Registrado</p>
                    <p className="mt-2 text-sm font-semibold text-emerald-700">
                      {formatCurrency(detalleAsiento.transaccion.isr_real)}
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50/90">
                      <TableRow className="border-slate-200 hover:bg-transparent">
                        <TableHead className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                          Cuenta
                        </TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                          Descripción
                        </TableHead>
                        <TableHead className="text-right text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                          Debe
                        </TableHead>
                        <TableHead className="text-right text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                          Haber
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {detalleAsiento.detalle_asientos?.map((detalle) => (
                        <TableRow key={detalle.id} className="border-slate-200 hover:bg-slate-50/60">
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-mono text-sm font-semibold text-slate-900">{detalle.cuenta_codigo}</p>
                              <p className="text-xs text-slate-500">{detalle.cuentas?.nombre || "N/A"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-700">{detalle.descripcion}</TableCell>
                          <TableCell className="text-right font-semibold text-slate-800">
                            {detalle.debe > 0 ? formatCurrency(detalle.debe) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-800">
                            {detalle.haber > 0 ? formatCurrency(detalle.haber) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}

                      <TableRow className="bg-slate-100/80 font-semibold hover:bg-slate-100/80">
                        <TableCell colSpan={2} className="text-slate-900">
                          Total
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {formatCurrency(detalleAsiento.detalle_asientos?.reduce((sum, d) => sum + Number(d.debe || 0), 0) || 0)}
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {formatCurrency(detalleAsiento.detalle_asientos?.reduce((sum, d) => sum + Number(d.haber || 0), 0) || 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};