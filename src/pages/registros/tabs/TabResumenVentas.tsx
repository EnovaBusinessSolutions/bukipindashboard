import React from "react";

import { FileText } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Ajusta el import si tu DateRangePicker está en otro path
import { DateRangePicker } from "@/components/ui/date-range-picker";

type Props = {
  // data
  transacciones: any[];
  transaccionesNorm: any[];
  subcuentas: any[];
  asientosIngresosDirectos: any[];

  // loading / modal asientos
  loadingTransacciones: boolean;
  loadingAsientos: boolean;
  currentAsientos: any;
  setCurrentAsientos: (v: any) => void;
  loadAsientosContables: (txId: string) => void;

  // filtros
  filtroRangoFechas: any;
  setFiltroRangoFechas: (v: any) => void;
  filtroFechaInicio: string;
  setFiltroFechaInicio: (v: string) => void;
  filtroFechaFin: string;
  setFiltroFechaFin: (v: string) => void;

  filtroTipoIngreso: string;
  setFiltroTipoIngreso: (v: string) => void;

  filtroCuenta: string;
  setFiltroCuenta: (v: string) => void;

  filtroSubcuenta: string;
  setFiltroSubcuenta: (v: string) => void;

  handleRangoChange: (range: any) => void;

  // helpers
  normalizeTx: (t: any) => any;
  matchRangoFechas: (dt: any) => boolean;
  getMetricValue: (t: any, metric: string) => any;
  formatMonto: (n: any) => string;

  // paginación
  PAGE_SIZE: number;
  pageResumen: number;
  setPageResumen: (fn: any) => void;

  // cancelación (solo se dispara desde este tab)
  setTransaccionACancelar: (t: any) => void;
  setIsCancelDialogOpen: (v: boolean) => void;
};

function isDateOnlyYMD(v: any) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
}

/**
 * ✅ Resolver FECHA LÍMITE / VENCIMIENTO E2E
 * - soporta camelCase + snake_case + aliases legacy
 * - devuelve YYYY-MM-DD o null
 */
function resolveFechaVencimientoYMD(tx: any): string | null {
  const raw =
    tx?.fecha_vencimiento ??
    tx?.fechaVencimiento ??
    tx?.fecha_limite ??
    tx?.fechaLimite ??
    tx?.dueDate ??
    tx?.due_date ??
    tx?.vencimiento ??
    tx?.fechaVence ??
    tx?.fecha_vence ??
    null;

  if (!raw) return null;

  // si ya viene YYYY-MM-DD
  const s = String(raw).trim();
  if (isDateOnlyYMD(s)) return s;

  // si viene ISO / Date
  try {
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    // 👇 usamos recorte ISO (estable) a YMD
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

// Helper: ID robusto
function getTxIdAny(tx: any): string {
  return String(tx?._id ?? tx?.id ?? tx?.incomeId ?? tx?.transaccionId ?? "").trim();
}

export default function TabResumenVentas(props: Props) {
  const {
    transacciones,
    transaccionesNorm,
    subcuentas,
    asientosIngresosDirectos,

    loadingTransacciones,
    loadingAsientos,
    currentAsientos,
    setCurrentAsientos,
    loadAsientosContables,

    filtroRangoFechas,
    setFiltroRangoFechas,
    setFiltroFechaInicio,
    setFiltroFechaFin,
    filtroTipoIngreso,
    setFiltroTipoIngreso,
    filtroCuenta,
    setFiltroCuenta,
    filtroSubcuenta,
    setFiltroSubcuenta,
    handleRangoChange,

    normalizeTx,
    matchRangoFechas,
    getMetricValue,
    formatMonto,

    PAGE_SIZE,
    pageResumen,
    setPageResumen,

    setTransaccionACancelar,
    setIsCancelDialogOpen,
  } = props;

  /**
   * ✅ FIX E2E (Fecha límite):
   * A veces `transaccionesNorm` viene “recortada” por `normalizeTx` (upstream) y no incluye `fechaLimite`.
   * Como en Mongo sí está guardada, acá construimos un lookup de la lista RAW `transacciones`
   * para poder resolver `fechaLimite/fecha_vencimiento` aunque el objeto normalizado no lo traiga.
   */
  const rawTxById = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const t of transacciones ?? []) {
      const id = getTxIdAny(t);
      if (id) m.set(id, t);
    }
    return m;
  }, [transacciones]);

  const mergeRawForDueDate = React.useCallback(
    (tx: any) => {
      const id = getTxIdAny(tx);
      const raw = id ? rawTxById.get(id) : null;
      // Preferimos el shape normalizado para UI, pero “inyectamos” cualquier llave faltante desde raw (como fechaLimite)
      return raw ? { ...raw, ...tx } : tx;
    },
    [rawTxById]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro Detallado de Ventas</CardTitle>
        <CardDescription>Historial completo de transacciones de ingresos</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Filtros */}
        <div className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2 lg:col-span-2">
              <Label>Rango de fechas</Label>
              <DateRangePicker value={filtroRangoFechas} onChange={handleRangoChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filtro-tipo">Tipo de Ingreso</Label>
              <Select value={filtroTipoIngreso} onValueChange={setFiltroTipoIngreso}>
                <SelectTrigger id="filtro-tipo">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="precargados">Precargados</SelectItem>
                  <SelectItem value="inventariados">Inventariados</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="otros">Otros</SelectItem>
                  <SelectItem value="asiento_directo">Venta de activo fijo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filtro-cuenta">Cuenta</Label>
              <Select value={filtroCuenta} onValueChange={setFiltroCuenta}>
                <SelectTrigger id="filtro-cuenta">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="4001">4001 - Ventas</SelectItem>
                  <SelectItem value="4004">4004 - Ventas Inventarios</SelectItem>
                  <SelectItem value="4101">4101 - Productos Financieros</SelectItem>
                  <SelectItem value="4102">4102 - Otros Productos</SelectItem>
                  <SelectItem value="4103">4103 - Ganancia en Venta de Activos</SelectItem>
                  <SelectItem value="4003">4003 - Devoluciones sobre ventas</SelectItem>
                  <SelectItem value="4002">4002 - Descuentos sobre ventas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filtro-subcuenta">Subcuenta</Label>
              <Select value={filtroSubcuenta || "todas"} onValueChange={(v) => setFiltroSubcuenta(v)}>
                <SelectTrigger id="filtro-subcuenta">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="sin-subcuenta">Sin subcuenta</SelectItem>

                  {subcuentas.map((sub: any) => {
                    const sid = String(sub?.id ?? sub?._id ?? "").trim();
                    return (
                      <SelectItem key={sid} value={sid}>
                        {sub?.nombre}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFiltroRangoFechas(undefined);
                setFiltroFechaInicio("");
                setFiltroFechaFin("");
                setFiltroTipoIngreso("todos");
                setFiltroCuenta("todas");
                setFiltroSubcuenta("todas");
              }}
            >
              Limpiar Filtros
            </Button>

            <div className="text-right">
              {(() => {
                const asientosComoTransacciones = asientosIngresosDirectos.map((asiento: any) => {
                  const detalleIngreso = asiento.detalle_asientos.find(
                    (d: any) => String(d.cuenta_codigo || "").startsWith("4") && Number(d.haber) > 0
                  );

                  return {
                    created_at: asiento.fecha,
                    fecha: asiento.fecha,
                    fecha_fixed: asiento.fecha,
                    tipo_ingreso: "asiento_directo",
                    cuenta_principal_codigo: detalleIngreso?.cuenta_codigo || "",
                    subcuenta_id:
                      (detalleIngreso as any)?.subcuenta_id ??
                      (detalleIngreso as any)?.subcuentaId ??
                      (detalleIngreso as any)?.subcuenta ??
                      null,
                    subcuentaId:
                      (detalleIngreso as any)?.subcuentaId ??
                      (detalleIngreso as any)?.subcuenta_id ??
                      (detalleIngreso as any)?.subcuenta ??
                      null,
                    monto_total: Number(detalleIngreso?.haber) || 0,
                    monto_neto: Number(detalleIngreso?.haber) || 0,
                    monto_descuento: 0,
                    // ✅ asiento_directo no trae vencimiento
                    fecha_vencimiento: null,
                    fechaVencimiento: null,
                  };
                });

                const todasLasTransaccionesRaw = [
                  ...(transacciones ?? []),
                  ...(asientosComoTransacciones ?? []),
                ];
                const todasLasTransacciones = todasLasTransaccionesRaw.map(normalizeTx);

                const filtered = todasLasTransacciones.filter((t: any) => {
                  const dt = t.fecha_fixed ?? t.fecha ?? t.created_at;
                  const fechaMatch = matchRangoFechas(dt);

                  const tipoMatch =
                    !filtroTipoIngreso ||
                    filtroTipoIngreso === "todos" ||
                    t.tipo_ingreso === filtroTipoIngreso;

                  const cuentaMatch =
                    !filtroCuenta ||
                    filtroCuenta === "todas" ||
                    String(t.cuenta_principal_codigo || "") === String(filtroCuenta);

                  const subRef =
                    t.subcuenta_id ??
                    t.subcuentaId ??
                    t.subcuenta ??
                    t.subcuentaCodigo ??
                    t.subcuenta_codigo ??
                    null;

                  const subIdStr = subRef ? String(subRef) : "";

                  const subcuentaMatch =
                    !filtroSubcuenta ||
                    filtroSubcuenta === "todas" ||
                    (filtroSubcuenta === "sin-subcuenta" && !subIdStr) ||
                    subIdStr === String(filtroSubcuenta);

                  return fechaMatch && tipoMatch && cuentaMatch && subcuentaMatch;
                });

                const total = filtered.reduce((sum: number, t: any) => sum + Number(t.monto_total || 0), 0);
                const descuento = filtered.reduce(
                  (sum: number, t: any) => sum + Number(t.monto_descuento || 0),
                  0
                );
                const neto = filtered.reduce(
                  (sum: number, t: any) =>
                    sum + Number(getMetricValue(t, "netas") ?? t.monto_neto ?? 0),
                  0
                );

                return (
                  <>
                    <p className="text-sm text-muted-foreground">Resultados: {filtered.length}</p>
                    <p className="text-lg font-bold text-primary">Total: ${formatMonto(total)}</p>
                    <p className="text-sm font-medium text-red-600">Descuento: -${formatMonto(descuento)}</p>
                    <p className="text-sm font-medium text-green-600">Ingreso: ${formatMonto(neto)}</p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {loadingTransacciones ? (
          <div className="text-center py-8 text-muted-foreground">Cargando transacciones...</div>
        ) : (
          (() => {
            // Asientos directos a transacción
            const asientosComoTransacciones = asientosIngresosDirectos.map((asiento: any) => {
              const detalleIngreso = asiento.detalle_asientos.find(
                (d: any) => String(d.cuenta_codigo || "").startsWith("4") && Number(d.haber) > 0
              );

              return {
                id: asiento.id ?? asiento._id,
                descripcion: asiento.descripcion,
                monto_total: Number(detalleIngreso?.haber) || 0,
                monto_neto: Number(detalleIngreso?.haber) || 0,
                monto_descuento: 0,
                monto_pagado: Number(detalleIngreso?.haber) || 0,
                monto_pendiente: 0,
                tipo_ingreso: "asiento_directo",
                metodo_pago: "N/A",
                tipo_pago: "contado",
                cuenta_principal_codigo: detalleIngreso?.cuenta_codigo || "",
                subcuenta_id:
                  (detalleIngreso as any)?.subcuenta_id ??
                  (detalleIngreso as any)?.subcuentaId ??
                  (detalleIngreso as any)?.subcuenta ??
                  null,
                subcuentaId:
                  (detalleIngreso as any)?.subcuentaId ??
                  (detalleIngreso as any)?.subcuenta_id ??
                  (detalleIngreso as any)?.subcuenta ??
                  null,
                created_at: asiento.fecha,
                fecha: asiento.fecha,
                fecha_fixed: asiento.fecha,
                asiento_fecha: asiento.fecha,
                es_asiento_directo: true,
                estado: "activo",
                // ✅ asiento_directo no trae vencimiento
                fecha_vencimiento: null,
                fechaVencimiento: null,
              };
            });

            const todasLasTransacciones = [
              ...(transaccionesNorm ?? []),
              ...asientosComoTransacciones.map(normalizeTx),
            ];

            const transaccionesFiltradas = todasLasTransacciones.filter((t: any) => {
              const dt = t.fecha_fixed ?? t.fecha ?? t.created_at;
              const fechaMatch = matchRangoFechas(dt);

              const tipoMatch =
                !filtroTipoIngreso ||
                filtroTipoIngreso === "todos" ||
                t.tipo_ingreso === filtroTipoIngreso;

              const cuentaMatch =
                !filtroCuenta ||
                filtroCuenta === "todas" ||
                String(t.cuenta_principal_codigo || "") === String(filtroCuenta);

              const subRef =
                t.subcuenta_id ??
                t.subcuentaId ??
                t.subcuenta ??
                t.subcuentaCodigo ??
                t.subcuenta_codigo ??
                null;

              const subIdStr = subRef ? String(subRef) : "";

              const subcuentaMatch =
                !filtroSubcuenta ||
                filtroSubcuenta === "todas" ||
                (filtroSubcuenta === "sin-subcuenta" && !subIdStr) ||
                subIdStr === String(filtroSubcuenta);

              return fechaMatch && tipoMatch && cuentaMatch && subcuentaMatch;
            });

            const transaccionesAgrupadas = transaccionesFiltradas
              .filter((t: any) => !String(t.descripcion || "").includes("CANCELACIÓN:"))
              .map((transaccion: any) => {
                const esCancelada = transaccion.estado === "cancelado";
                let transaccionReversion = null;

                if (esCancelada && transaccion.transaccion_cancelacion_id) {
                  transaccionReversion = (transaccionesNorm ?? []).find(
                    (t: any) => t.id === transaccion.transaccion_cancelacion_id
                  );
                }

                return { ...transaccion, esCancelada, transaccionReversion };
              });

            const totalItems = transaccionesAgrupadas.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

            const safePage = Math.min(Math.max(pageResumen, 1), totalPages);
            const startIndex = (safePage - 1) * PAGE_SIZE;
            const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);

            const transaccionesPaginadas = transaccionesAgrupadas.slice(startIndex, endIndex);

            return transaccionesAgrupadas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay transacciones que coincidan con los filtros
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm font-medium text-muted-foreground">
                    Mostrando {transaccionesPaginadas.length} de {transaccionesAgrupadas.length} transacción(es)
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tip: da clic en el ícono 📄 para ver “Información general” y “Registro contable”
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden bg-background">
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="text-left p-3 font-medium whitespace-nowrap">Fecha</th>
                          <th className="text-left p-3 font-medium min-w-[320px]">Descripción</th>
                          <th className="text-left p-3 font-medium whitespace-nowrap hidden md:table-cell">Tipo</th>
                          <th className="text-left p-3 font-medium whitespace-nowrap hidden lg:table-cell">Cuenta</th>
                          <th className="text-right p-3 font-medium whitespace-nowrap">Total</th>
                          <th className="text-right p-3 font-medium whitespace-nowrap hidden md:table-cell">Ingreso</th>
                          <th className="text-left p-3 font-medium whitespace-nowrap hidden md:table-cell">Estado</th>
                          <th className="text-right p-3 font-medium whitespace-nowrap">Acciones</th>
                        </tr>
                      </thead>

                      <tbody>
                        {transaccionesPaginadas.map((item: any) => {
                          const transaccion = item;
                          const esCancelada = item.esCancelada;
                          const esReversion = false;

                          const rawFecha =
                            transaccion.fecha_fixed ?? transaccion.fecha ?? transaccion.created_at;

                          const fechaStr = (() => {
                            try {
                              return new Date(rawFecha).toLocaleString("es-ES", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              });
                            } catch {
                              return String(rawFecha || "");
                            }
                          })();

                          const netoRow = Number(getMetricValue(transaccion, "netas") || 0);

                          // ✅ Fecha límite / vencimiento (E2E) — usando RAW fallback
                          const txForDueDate = mergeRawForDueDate(transaccion);
                          const fechaVencYMD = resolveFechaVencimientoYMD(txForDueDate);

                          // Subcuenta robusta
                          const subRefRaw =
                            (transaccion as any).subcuenta_id ??
                            (transaccion as any).subcuentaId ??
                            (transaccion as any).subcuenta ??
                            (transaccion as any).subcuentaCodigo ??
                            (transaccion as any).subcuenta_codigo ??
                            null;

                          const subIdStr = subRefRaw ? String(subRefRaw).trim() : "";

                          const subNombreDirecto =
                            (transaccion as any).subcuentaNombre ??
                            (transaccion as any).subcuenta_nombre ??
                            null;

                          const subCodigoDirecto =
                            (transaccion as any).subcuentaCodigo ??
                            (transaccion as any).subcuenta_codigo ??
                            null;

                          const subInfoLookup = (() => {
                            if (!subIdStr) return null;

                            const sById = subcuentas.find((x: any) => {
                              const id = String(x?.id ?? x?._id ?? "").trim();
                              return id && id === subIdStr;
                            });
                            if (sById) return sById;

                            const sByCode = subcuentas.find((x: any) => {
                              const code = String(x?.codigo ?? x?.code ?? "").trim();
                              return code && code === subIdStr;
                            });

                            return sByCode || null;
                          })();

                          const subNombreLookup = subInfoLookup ? (subInfoLookup as any).nombre ?? null : null;
                          const subCodigoLookup = subInfoLookup ? (subInfoLookup as any).codigo ?? null : null;

                          const subNombreFinal = subNombreDirecto ?? subNombreLookup;
                          const subCodigoFinal = subCodigoDirecto ?? subCodigoLookup;

                          const subLabelFinal =
                            String((transaccion as any).subcuenta ?? "").trim() ||
                            (subNombreFinal
                              ? `${subCodigoFinal ? `${subCodigoFinal} - ` : ""}${subNombreFinal}`
                              : subCodigoFinal
                                ? String(subCodigoFinal)
                                : "");

                          return (
                            <tr
                              key={transaccion.id}
                              className={`border-t hover:bg-muted/30 ${
                                esCancelada ? "bg-red-50/60 dark:bg-red-950/20" : ""
                              }`}
                            >
                              <td className="p-3 whitespace-nowrap text-muted-foreground">{fechaStr}</td>

                              <td className="p-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{transaccion.descripcion}</span>

                                  {(transaccion as any).es_asiento_directo && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200">
                                      📋 Asiento Directo
                                    </span>
                                  )}

                                  {esCancelada && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200">
                                      ❌ Cancelada
                                    </span>
                                  )}

                                  {esReversion && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200">
                                      ↩️ Reversión
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs text-muted-foreground mt-1">
                                  <span className="capitalize">{transaccion.metodo_pago || "N/A"}</span> •{" "}
                                  <span className="capitalize">{transaccion.tipo_pago || "N/A"}</span>

                                  {subLabelFinal ? (
                                    <>
                                      {" "}
                                      •{" "}
                                      <span className="text-muted-foreground">
                                        Subcuenta: {subLabelFinal || "Subcuenta no encontrada"}
                                      </span>
                                    </>
                                  ) : null}

                                  {/* ✅ mini hint de vencimiento */}
                                  {fechaVencYMD ? (
                                    <>
                                      {" "}
                                      •{" "}
                                      <span className="text-muted-foreground">
                                        Fecha límite: {fechaVencYMD}
                                      </span>
                                    </>
                                  ) : null}
                                </div>

                                {(transaccion as any).comentarios && (
                                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs">
                                    <span className="font-medium text-blue-700 dark:text-blue-300">💬 </span>
                                    <span className="text-blue-600 dark:text-blue-400">
                                      {String((transaccion as any).comentarios).length > 80
                                        ? `${String((transaccion as any).comentarios).substring(0, 80)}...`
                                        : String((transaccion as any).comentarios)}
                                    </span>
                                  </div>
                                )}

                                {esCancelada && (transaccion as any).motivo_cancelacion && (
                                  <div className="mt-3 space-y-2">
                                    <div className="p-3 bg-red-100 dark:bg-red-950/40 rounded-md border border-red-300 dark:border-red-800">
                                      <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                                        📋 Motivo de cancelación:
                                      </p>
                                      <p className="text-xs text-red-600 dark:text-red-400">
                                        {(transaccion as any).motivo_cancelacion}
                                      </p>
                                      <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                                        Cancelada el:{" "}
                                        {new Date((transaccion as any).fecha_cancelacion).toLocaleDateString("es-ES", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>
                                    </div>

                                    {item.transaccionReversion && (
                                      <div className="p-3 bg-orange-100 dark:bg-orange-950/40 rounded-md border border-orange-300 dark:border-orange-800">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                                            ↩️ Asiento de Reversión Generado
                                          </span>
                                        </div>
                                        <div className="text-xs text-orange-600 dark:text-orange-400 space-y-1">
                                          <p>
                                            <span className="font-medium">Descripción:</span>{" "}
                                            {item.transaccionReversion.descripcion}
                                          </p>
                                          <p>
                                            <span className="font-medium">Monto reversado:</span> $
                                            {formatMonto(Math.abs(item.transaccionReversion.monto_total))}
                                          </p>
                                          <p>
                                            <span className="font-medium">Fecha:</span>{" "}
                                            {(() => {
                                              const raw =
                                                item.transaccionReversion.fecha_fixed ??
                                                item.transaccionReversion.fecha ??
                                                item.transaccionReversion.created_at;
                                              return new Date(raw).toLocaleDateString("es-ES", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              });
                                            })()}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>

                              <td className="p-3 hidden md:table-cell">
                                <span className="capitalize">{transaccion.tipo_ingreso}</span>
                              </td>

                              <td className="p-3 hidden lg:table-cell">{transaccion.cuenta_principal_codigo || "-"}</td>

                              <td className="p-3 text-right font-bold text-primary whitespace-nowrap">
                                ${formatMonto(transaccion.monto_total)}
                                {transaccion.monto_descuento > 0 && (
                                  <div className="text-xs text-red-600 font-medium">
                                    -${formatMonto(transaccion.monto_descuento)} desc.
                                  </div>
                                )}
                              </td>

                              <td className="p-3 text-right hidden md:table-cell whitespace-nowrap">
                                <span className="font-medium text-green-600">${formatMonto(netoRow)}</span>
                              </td>

                              <td className="p-3 hidden md:table-cell">
                                {esCancelada ? (
                                  <span className="text-red-600 font-medium">Cancelada</span>
                                ) : (
                                  <span className="text-muted-foreground">Activa</span>
                                )}
                              </td>

                              <td className="p-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2 justify-end">
                                  <Dialog
                                    onOpenChange={(open) => {
                                      if (open) {
                                        const txId = String((transaccion as any)._id ?? (transaccion as any).id ?? "");
                                        loadAsientosContables(txId);
                                      } else {
                                        setCurrentAsientos(null);
                                      }
                                    }}
                                  >
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="h-8 px-2">
                                        <FileText className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>

                                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                      <DialogHeader>
                                        <DialogTitle>Detalles de la Transacción</DialogTitle>
                                        <DialogDescription>
                                          Información completa y asientos contables en balanza
                                        </DialogDescription>
                                      </DialogHeader>

                                      <Tabs defaultValue="general" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2">
                                          <TabsTrigger value="general">Información General</TabsTrigger>
                                          <TabsTrigger value="contable">Registros Contables</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="general" className="mt-4 space-y-4">
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <h4 className="font-semibold text-sm">Información General</h4>
                                              <div className="space-y-1 text-sm">
                                                <p>
                                                  <span className="font-medium">Descripción:</span>{" "}
                                                  {transaccion.descripcion}
                                                </p>
                                                <p>
                                                  <span className="font-medium">Tipo:</span>{" "}
                                                  {transaccion.tipo_ingreso}
                                                </p>
                                                <p>
                                                  <span className="font-medium">Método de Pago:</span>{" "}
                                                  {transaccion.metodo_pago || "N/A"}
                                                </p>
                                                <p>
                                                  <span className="font-medium">Tipo de Pago:</span>{" "}
                                                  {transaccion.tipo_pago}
                                                </p>

                                                <p>
                                                  <span className="font-medium">Fecha:</span>{" "}
                                                  {(() => {
                                                    const raw =
                                                      (transaccion as any).fecha_fixed ??
                                                      (transaccion as any).fecha ??
                                                      (transaccion as any).created_at;
                                                    try {
                                                      return new Date(raw).toLocaleString("es-ES", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                      });
                                                    } catch {
                                                      return String(raw || "");
                                                    }
                                                  })()}
                                                </p>

                                                {/* ✅ FECHA LÍMITE (E2E) — usando RAW fallback */}
                                                <p>
                                                  <span className="font-medium">Fecha límite:</span>{" "}
                                                  {resolveFechaVencimientoYMD(mergeRawForDueDate(transaccion)) || "—"}
                                                </p>
                                              </div>
                                            </div>

                                            <div>
                                              <h4 className="font-semibold text-sm">Montos</h4>
                                              <div className="space-y-1 text-sm">
                                                <p>
                                                  <span className="font-medium">Total:</span> $
                                                  {formatMonto((transaccion as any).monto_total)}
                                                </p>
                                                <p>
                                                  <span className="font-medium">Descuento:</span> $
                                                  {formatMonto((transaccion as any).monto_descuento)}
                                                </p>
                                                <p>
                                                  <span className="font-medium">Neto:</span> $
                                                  {formatMonto((transaccion as any).monto_neto)}
                                                </p>
                                                <p>
                                                  <span className="font-medium">Pagado:</span> $
                                                  {formatMonto((transaccion as any).monto_pagado || 0)}
                                                </p>
                                                <p>
                                                  <span className="font-medium">Pendiente:</span> $
                                                  {formatMonto((transaccion as any).monto_pendiente || 0)}
                                                </p>
                                              </div>
                                            </div>
                                          </div>

                                          {((transaccion as any).cliente_nombre ||
                                            (transaccion as any).cliente_telefono ||
                                            (transaccion as any).cliente_email) && (
                                            <div>
                                              <h4 className="font-semibold text-sm mb-2">Información del Cliente</h4>
                                              <div className="grid grid-cols-2 gap-4 text-sm">
                                                {(transaccion as any).cliente_nombre && (
                                                  <p>
                                                    <span className="font-medium">Nombre:</span>{" "}
                                                    {(transaccion as any).cliente_nombre}
                                                  </p>
                                                )}
                                                {(transaccion as any).cliente_telefono && (
                                                  <p>
                                                    <span className="font-medium">Teléfono:</span>{" "}
                                                    {(transaccion as any).cliente_telefono}
                                                  </p>
                                                )}
                                                {(transaccion as any).cliente_email && (
                                                  <p>
                                                    <span className="font-medium">Email:</span>{" "}
                                                    {(transaccion as any).cliente_email}
                                                  </p>
                                                )}
                                                {(transaccion as any).cliente_rfc && (
                                                  <p>
                                                    <span className="font-medium">RFC:</span>{" "}
                                                    {(transaccion as any).cliente_rfc}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          )}

                                          <div>
                                            <h4 className="font-semibold text-sm mb-2">Información Contable</h4>

                                            {(() => {
                                              const cuentaPrincipalLabel =
                                                (transaccion as any).cuenta_principal ||
                                                ((transaccion as any).cuenta_principal_codigo
                                                  ? String((transaccion as any).cuenta_principal_codigo)
                                                  : "");

                                              // Subcuenta robusta (mismo algoritmo del row)
                                              const subRefRaw2 =
                                                (transaccion as any).subcuenta_id ??
                                                (transaccion as any).subcuentaId ??
                                                (transaccion as any).subcuenta ??
                                                (transaccion as any).subcuentaCodigo ??
                                                (transaccion as any).subcuenta_codigo ??
                                                null;

                                              const subIdStr2 = subRefRaw2 ? String(subRefRaw2).trim() : "";

                                              const subNombreDirecto2 =
                                                (transaccion as any).subcuentaNombre ??
                                                (transaccion as any).subcuenta_nombre ??
                                                null;

                                              const subCodigoDirecto2 =
                                                (transaccion as any).subcuentaCodigo ??
                                                (transaccion as any).subcuenta_codigo ??
                                                null;

                                              const subInfoLookup2 = (() => {
                                                if (!subIdStr2) return null;

                                                const sById = subcuentas.find((x: any) => {
                                                  const id = String(x?.id ?? x?._id ?? "").trim();
                                                  return id && id === subIdStr2;
                                                });
                                                if (sById) return sById;

                                                const sByCode = subcuentas.find((x: any) => {
                                                  const code = String(x?.codigo ?? x?.code ?? "").trim();
                                                  return code && code === subIdStr2;
                                                });

                                                return sByCode || null;
                                              })();

                                              const subNombreLookup2 = subInfoLookup2 ? (subInfoLookup2 as any).nombre ?? null : null;
                                              const subCodigoLookup2 = subInfoLookup2 ? (subInfoLookup2 as any).codigo ?? null : null;

                                              const subNombreFinal2 = subNombreDirecto2 ?? subNombreLookup2;
                                              const subCodigoFinal2 = subCodigoDirecto2 ?? subCodigoLookup2;

                                              const subLabelFinal2 =
                                                String((transaccion as any).subcuenta ?? "").trim() ||
                                                (subNombreFinal2
                                                  ? `${subCodigoFinal2 ? `${subCodigoFinal2} - ` : ""}${subNombreFinal2}`
                                                  : subCodigoFinal2
                                                    ? String(subCodigoFinal2)
                                                    : "");

                                              return (
                                                <div className="text-sm space-y-1">
                                                  <p>
                                                    <span className="font-medium">Cuenta Principal:</span>{" "}
                                                    {cuentaPrincipalLabel || "Sin cuenta"}
                                                  </p>
                                                  <p>
                                                    <span className="font-medium">Subcuenta:</span>{" "}
                                                    {subLabelFinal2 || "Sin subcuenta asignada"}
                                                  </p>
                                                </div>
                                              );
                                            })()}
                                          </div>

                                          {(transaccion as any).comentarios && (
                                            <div>
                                              <h4 className="font-semibold text-sm mb-2">Comentarios</h4>
                                              <div className="p-3 bg-muted rounded-md">
                                                <p className="text-sm">{(transaccion as any).comentarios}</p>
                                              </div>
                                            </div>
                                          )}
                                        </TabsContent>

                                        <TabsContent value="contable" className="mt-4">
                                          <h4 className="font-semibold text-sm mb-3">
                                            Asientos en Balanza de Comprobación
                                          </h4>

                                          {loadingAsientos ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                              Cargando asientos contables...
                                            </div>
                                          ) : !currentAsientos ? (
                                            <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center">
                                              No se encontraron asientos contables para esta transacción
                                            </div>
                                          ) : (
                                            <div className="space-y-4">
                                              <div className="p-4 bg-muted rounded-lg">
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                  <div>
                                                    <span className="font-medium">Número de Asiento:</span>{" "}
                                                    {currentAsientos.numero_asiento}
                                                  </div>
                                                  <div>
                                                    <span className="font-medium">Fecha:</span>{" "}
                                                    {new Date(currentAsientos.fecha).toLocaleDateString("es-ES")}
                                                  </div>
                                                  <div className="col-span-2">
                                                    <span className="font-medium">Descripción:</span>{" "}
                                                    {currentAsientos.descripcion}
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="border rounded-lg overflow-hidden">
                                                <table className="w-full">
                                                  <thead className="bg-muted">
                                                    <tr>
                                                      <th className="text-left p-3 text-sm font-medium">Cuenta</th>
                                                      <th className="text-left p-3 text-sm font-medium">Descripción</th>
                                                      <th className="text-right p-3 text-sm font-medium">Debe</th>
                                                      <th className="text-right p-3 text-sm font-medium">Haber</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {currentAsientos.detalles?.map((detalle: any, idx: number) => (
                                                      <tr key={idx} className="border-t">
                                                        <td className="p-3 text-sm">
                                                          <div className="font-medium">{detalle.cuenta_codigo}</div>
                                                          <div className="text-xs text-muted-foreground">
                                                            {detalle.cuenta_nombre}
                                                          </div>
                                                        </td>
                                                        <td className="p-3 text-sm">{detalle.descripcion}</td>
                                                        <td className="p-3 text-sm text-right font-medium">
                                                          {detalle.debe > 0 ? `$${formatMonto(detalle.debe)}` : "-"}
                                                        </td>
                                                        <td className="p-3 text-sm text-right font-medium">
                                                          {detalle.haber > 0 ? `$${formatMonto(detalle.haber)}` : "-"}
                                                        </td>
                                                      </tr>
                                                    ))}

                                                    <tr className="border-t-2 bg-muted/50 font-bold">
                                                      <td colSpan={2} className="p-3 text-sm">
                                                        TOTALES
                                                      </td>
                                                      <td className="p-3 text-sm text-right">
                                                        ${formatMonto(
                                                          currentAsientos.detalles?.reduce(
                                                            (sum: number, d: any) => sum + Number(d.debe),
                                                            0
                                                          )
                                                        )}
                                                      </td>
                                                      <td className="p-3 text-sm text-right">
                                                        ${formatMonto(
                                                          currentAsientos.detalles?.reduce(
                                                            (sum: number, d: any) => sum + Number(d.haber),
                                                            0
                                                          )
                                                        )}
                                                      </td>
                                                    </tr>
                                                  </tbody>
                                                </table>
                                              </div>

                                              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
                                                <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                                                  💡 Información
                                                </p>
                                                <p className="text-blue-600 dark:text-blue-400">
                                                  Este asiento contable refleja cómo esta transacción afecta a las diferentes
                                                  cuentas en la balanza de comprobación y posteriormente en los estados financieros.
                                                </p>
                                              </div>
                                            </div>
                                          )}
                                        </TabsContent>
                                      </Tabs>
                                    </DialogContent>
                                  </Dialog>

                                  {!esCancelada && !esReversion && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                      onClick={() => {
                                        setTransaccionACancelar(normalizeTx(transaccion));
                                        setIsCancelDialogOpen(true);
                                      }}
                                    >
                                      ❌
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t p-3 bg-background">
                    <div className="text-xs text-muted-foreground">
                      Mostrando <span className="font-medium">{totalItems === 0 ? 0 : startIndex + 1}</span>–
                      <span className="font-medium">{endIndex}</span> de{" "}
                      <span className="font-medium">{totalItems}</span>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage <= 1}
                        onClick={() => setPageResumen((p: number) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>

                      <div className="text-xs text-muted-foreground px-2">
                        Página <span className="font-medium">{safePage}</span> de{" "}
                        <span className="font-medium">{totalPages}</span>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage >= totalPages}
                        onClick={() => setPageResumen((p: number) => Math.min(totalPages, p + 1))}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}