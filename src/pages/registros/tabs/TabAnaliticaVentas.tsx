import React from "react";

// UI (ajusta paths si tus imports en el proyecto son distintos)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Utils
import { cn } from "@/lib/utils";

// date-fns
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Icons
import { Calendar as CalendarIcon, Package, Users } from "lucide-react";

// Recharts
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Brush,
  PieChart,
  Pie,
  Cell,
  Label as RechartsLabel,
  Legend,
  BarChart,
  Bar,
  LabelList,
  Treemap,
} from "recharts";

type Props = {
  // data base
  transacciones: any[];
  loadingTransacciones: boolean;
  asientosIngresosDirectos: any[];

  // catálogos (para labels / imágenes / cuentas)
  subcuentas: any[];
  cuentas: any[];
  productosInventario: any[];
  productosServicios: any[];

  // analítica / highlights
  datosAnaliticas: any;

  highTotalesDia: any;
  highTotalesMes: any;
  highTotalesAno: any;
  highlightLabels: any;

  // filtros / estados
  tipoIngresoAnalisis: string;
  setTipoIngresoAnalisis: (v: any) => void;

  periodFilter: string;
  setPeriodFilter: (v: any) => void;

  scaleFormat: string;
  setScaleFormat: (v: any) => void;

  highlightsScaleFormat: string;
  setHighlightsScaleFormat: (v: any) => void;

  metricType: any;
  setMetricType: (v: any) => void;

  fechaAnalisisDiario: Date;
  setFechaAnalisisDiario: (d: Date) => void;

  fechaAnalisisMensual: Date;
  setFechaAnalisisMensual: (d: Date) => void;

  fechaAnalisisAnual: Date;
  setFechaAnalisisAnual: (d: Date) => void;

  // vista barras
  vistaGraficaBarras: string;
  setVistaGraficaBarras: (v: any) => void;

  // modales + estados productos
  openProductsModal: boolean;
  setOpenProductsModal: (v: boolean) => void;
  productSort: string;
  setProductSort: (fn: any) => void;
  productSearch: string;
  setProductSearch: (v: string) => void;
  productPage: number;
  setProductPage: (fn: any) => void;
  PAGE_SIZE_PRODUCTS: number;

  // modales + estados clientes
  openClientsModal: boolean;
  setOpenClientsModal: (v: boolean) => void;
  clientSort: string;
  setClientSort: (fn: any) => void;
  clientSearch: string;
  setClientSearch: (v: string) => void;
  clientPage: number;
  setClientPage: (fn: any) => void;
  PAGE_SIZE_CLIENTS: number;

  // helpers que existen en el padre
  getMetricValue: (t: any, metric: any) => any;
  parseDateSafe: (raw: any) => Date;
  ymdLocal: (d: Date) => string;
  formatCifra: (n: number, scale: any) => string;

  // helpers opcionales (si existe en tu padre)
  getSubcuentaIdAny?: (t: any) => any;

  // componentes tooltips (ya existen en tu RegistroIngresos.tsx)
  ChartTooltipBukipin: React.ComponentType<any>;
  CustomTreemapTooltip: React.ComponentType<any>;
};

type MetricType = "brutas" | "descuentos" | "netas" | "otros_netos";

export default function TabAnaliticaVentas(props: Props) {
  const {
    transacciones,
    loadingTransacciones,
    asientosIngresosDirectos,

    subcuentas,
    cuentas,
    productosInventario,
    productosServicios,

    datosAnaliticas,
    highTotalesDia,
    highTotalesMes,
    highTotalesAno,
    highlightLabels,

    tipoIngresoAnalisis,
    setTipoIngresoAnalisis,

    periodFilter,
    setPeriodFilter,

    scaleFormat,
    setScaleFormat,

    highlightsScaleFormat,
    setHighlightsScaleFormat,

    metricType,
    setMetricType,

    fechaAnalisisDiario,
    setFechaAnalisisDiario,

    fechaAnalisisMensual,
    setFechaAnalisisMensual,

    fechaAnalisisAnual,
    setFechaAnalisisAnual,

    vistaGraficaBarras,
    setVistaGraficaBarras,

    openProductsModal,
    setOpenProductsModal,
    productSort,
    setProductSort,
    productSearch,
    setProductSearch,
    productPage,
    setProductPage,
    PAGE_SIZE_PRODUCTS,

    openClientsModal,
    setOpenClientsModal,
    clientSort,
    setClientSort,
    clientSearch,
    setClientSearch,
    clientPage,
    setClientPage,
    PAGE_SIZE_CLIENTS,

    getMetricValue,
    parseDateSafe,
    ymdLocal,
    formatCifra,

    getSubcuentaIdAny,

    ChartTooltipBukipin,
    CustomTreemapTooltip,
  } = props;

  // ✅ Pegamos el IIFE tal cual (sin tocar lógica)
  return (
    <>
      {/* Función para filtrar transacciones según el período y tipo de ingreso */}
      {(() => {
        // ----------------------------
        // ✅ FIX TS (evitar unknown)
        // ----------------------------
        type NumMap = Record<string, number>;
        type BoolMap = Record<string, boolean>;

        type MetodoPagoItem = { name: string; value: number; porcentaje: string };
        type PieTipoItem = { tipo: string; monto: number; porcentaje: string };
        type PieEstadoItem = { estado: string; monto: number; porcentaje: string };

        type ClienteVenta = {
          nombre: string;
          transacciones: number;
          monto: number;
          email?: string;
          telefono?: string;
        };

        const valuesNum = (obj: NumMap) => Object.values(obj) as number[];
        const entriesNum = (obj: NumMap) => Object.entries(obj) as Array<[string, number]>;

        const asientosDir: any[] = Array.isArray(asientosIngresosDirectos) ? asientosIngresosDirectos : [];

        const getTipoIngresoKey = (t: any) => {
          const raw =
            t?.tipo_ingreso ??
            t?.tipoIngreso ??
            t?.tipo ??
            t?.tipo_ingreso_registro ??
            t?.tipo_ingreso_original;

          return String(raw ?? "sin_tipo").toLowerCase().trim();
        };

        const prettyTipoIngreso = (raw: string) => {
          const k = String(raw ?? "sin_tipo").toLowerCase().trim();

          const map: Record<string, string> = {
            precargados: "Precargados",
            inventariados: "Inventariados",
            general: "General",
            otros: "Otros",
            sin_tipo: "Sin tipo",
          };

          return map[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        };

        // ✅ Helper: misma fecha “real” que usa la tabla (soporta varios shapes)
        const getTxFecha = (t: any) => {
          const raw =
            t?.fecha_fixed ?? // ideal (YYYY-MM-DD)
            t?.fecha ?? // fallback
            t?.createdAt ??
            t?.created_at ??
            t?.asiento_fecha; // último fallback
          if (!raw) return null;
          return parseDateSafe(raw);
        };

        const prettyMonthYearLabel = (raw?: string) => {
          if (!raw) return "";

          const s = String(raw).trim();

          // Soporta: "01/2026", "1/2026"
          let mm: string | undefined;
          let yyyy: string | undefined;

          const m1 = s.match(/^(\d{1,2})\/(\d{4})$/);
          if (m1) {
            mm = m1[1];
            yyyy = m1[2];
          }

          // Soporta: "2026-01" o "2026-01-15"
          const m2 = s.match(/^(\d{4})-(\d{2})/);
          if (!mm && m2) {
            yyyy = m2[1];
            mm = m2[2];
          }

          if (!mm || !yyyy) return s;

          const monthNum = parseInt(mm, 10);
          const months = [
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

          if (monthNum >= 1 && monthNum <= 12) {
            return `${months[monthNum - 1]}/${yyyy}`;
          }

          return s;
        };

        // ✅ Helper: normaliza cuenta principal a string (evita bug 4001 number vs "4001")
        const getCuentaCodigo = (t: any) => String(t?.cuenta_principal_codigo ?? "");

        const getFilteredTransactions = () => {
          // ✅ año seleccionado (no “año actual” fijo)
          const selectedYear = fechaAnalisisAnual.getFullYear();

          // 1) Base: excluir canceladas y reversiones
          let filtered = (transacciones || []).filter((t: any) => {
            const estado = String(t?.estado || "").toLowerCase();
            const desc = String(t?.descripcion || "");
            return estado !== "cancelado" && !desc.includes("CANCELACIÓN:");
          });

          // 2) Filtrar por período (usando misma fecha que la tabla)
          if (periodFilter === "diario") {
            const selected = ymdLocal(fechaAnalisisDiario);

            filtered = filtered.filter((t: any) => {
              const d = getTxFecha(t);
              if (!d) return false;
              return ymdLocal(d) === selected;
            });
          } else if (periodFilter === "mensual") {
            const month = fechaAnalisisMensual.getMonth();
            const year = fechaAnalisisMensual.getFullYear();

            filtered = filtered.filter((t: any) => {
              const d = getTxFecha(t);
              if (!d) return false;
              return d.getFullYear() === year && d.getMonth() === month;
            });
          } else {
            // ✅ anual (año seleccionado por el usuario)
            filtered = filtered.filter((t: any) => {
              const d = getTxFecha(t);
              if (!d) return false;
              return d.getFullYear() === selectedYear;
            });
          }

          // 3) Filtrar por tipo de ingreso (ventas vs otros) usando cuenta como string
          if (tipoIngresoAnalisis === "ventas") {
            return filtered.filter((t: any) => getCuentaCodigo(t) === "4001");
          } else {
            const codeIsOtherIncome = (code: string) =>
              code.startsWith("4") && code !== "4001" && code !== "4003";

            return filtered.filter((t: any) => codeIsOtherIncome(getCuentaCodigo(t)));
          }
        };

        const filteredTransactions = getFilteredTransactions();

        // Función para procesar datos de métodos de pago (solo para transacciones con pago recibido)
        const getMetodosPagoData = (): MetodoPagoItem[] => {
          // Filtrar solo transacciones que tienen método de pago asignado (contado o parcial)
          const transaccionesConPago = filteredTransactions.filter(
            (t) => (t as any).tipo_pago === "contado" || (t as any).tipo_pago === "parcial"
          );

          if (transaccionesConPago.length === 0) return [];

          // Agrupar por método de pago
          const metodosPago: NumMap = {};
          transaccionesConPago.forEach((t) => {
            const metodo = (t as any).metodo_pago === "efectivo" ? "Efectivo" : "Tarjeta";
            metodosPago[metodo] =
              (metodosPago[metodo] || 0) + (Number(getMetricValue(t as any, metricType)) || 0);
          });

          const total = (Object.values(metodosPago) as number[]).reduce(
            (sum, val) => sum + (Number(val) || 0),
            0
          );

          return (Object.entries(metodosPago) as Array<[string, number]>).map(([name, value]) => ({
            name,
            value,
            porcentaje: total > 0 ? ((value / total) * 100).toFixed(1) : "0.0",
          }));
        };

        const datosMetodosPago = getMetodosPagoData();

        // Función para verificar si hay datos disponibles
        const hayDatosDisponibles = () => {
          if (tipoIngresoAnalisis === "ventas") {
            return (
              filteredTransactions.length > 0 ||
              (Number(datosAnaliticas.ventasBrutas) || 0) > 0 ||
              (Number(datosAnaliticas.descuentos) || 0) > 0
            );
          } else {
            // Otros ingresos
            return filteredTransactions.length > 0 || (Number(datosAnaliticas.otrosIngresos) || 0) > 0;
          }
        };

        const hsl = (v: string) => `hsl(var(--${v}))`;

        const PIE_COLORS = [
          hsl("primary"),
          hsl("chart-1"),
          hsl("chart-2"),
          hsl("chart-3"),
          hsl("muted-foreground"),
        ];

        const metricLabel =
          tipoIngresoAnalisis === "otros"
            ? "Otros Ingresos Netos"
            : metricType === "brutas"
            ? "Ventas Brutas"
            : metricType === "descuentos"
            ? "Descuentos"
            : "Ventas Netas";

        const metricLabelLower =
          tipoIngresoAnalisis === "otros"
            ? "otros ingresos netos"
            : metricType === "brutas"
            ? "ventas brutas"
            : metricType === "descuentos"
            ? "descuentos"
            : "ventas netas";

        const makeLegend =
          (nameKey: "tipo" | "estado") =>
          ({ payload }: any) => {
            if (!payload?.length) return null;

            return (
              <div className="mt-3 grid grid-cols-1 gap-2">
                {payload.map((item: any, idx: number) => {
                  const raw = item?.payload?.payload ?? item?.payload ?? {};
                  const label = String(raw?.[nameKey] ?? item?.value ?? "—");
                  const monto = Number(raw?.monto ?? raw?.value ?? 0) || 0;
                  const pct = String(raw?.porcentaje ?? "");

                  return (
                    <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{
                            background: item.color || PIE_COLORS[idx % PIE_COLORS.length],
                          }}
                        />
                        <span className="truncate text-foreground/90">{label}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground">{pct ? `${pct}%` : ""}</span>
                        <span className="font-medium text-foreground">
                          ${formatCifra(monto, scaleFormat)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          };

        const CenterLabel =
          (title: string, total: number) =>
          ({ viewBox }: any) => {
            const cx = viewBox?.cx ?? 0;
            const cy = viewBox?.cy ?? 0;

            return (
              <g>
                <text x={cx} y={cy - 6} textAnchor="middle" fill={hsl("muted-foreground")} fontSize="12">
                  {title}
                </text>
                <text
                  x={cx}
                  y={cy + 16}
                  textAnchor="middle"
                  fill={hsl("foreground")}
                  fontSize="16"
                  fontWeight="700"
                >
                  ${formatCifra(total, scaleFormat)}
                </text>
              </g>
            );
          };
                return (
                  <>
                    {/* HIGHLIGHTS - Resumen Completo (sin filtros) */}
                    <div className="mb-8">
                      <h3 className="text-xl font-bold text-foreground mb-4">Highlights de Ingresos</h3>
            
                      {/* Filtro SOLO para Highlights */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <p className="text-sm text-muted-foreground">
                          Ajusta el formato numérico de los highlights
                        </p>
            
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Formato:</span>
            
                          <RadioGroup
                            value={highlightsScaleFormat}
                            onValueChange={(v) =>
                              setHighlightsScaleFormat(v as "general" | "miles" | "millones")
                            }
                            className="flex items-center gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="general" id="high-scale-general" />
                              <Label htmlFor="high-scale-general" className="cursor-pointer text-sm">
                                General
                              </Label>
                            </div>
            
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="miles" id="high-scale-miles" />
                              <Label htmlFor="high-scale-miles" className="cursor-pointer text-sm">
                                Miles (K)
                              </Label>
                            </div>
            
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="millones" id="high-scale-millones" />
                              <Label htmlFor="high-scale-millones" className="cursor-pointer text-sm">
                                Millones (M)
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>
            
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Día */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-semibold text-primary">
                              Resumen del Día {highlightLabels?.dia ? `(${highlightLabels.dia})` : ""}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Ventas Brutas:</span>
                              <span className="font-semibold text-foreground">
                                ${formatCifra(highTotalesDia.ventasBrutas, highlightsScaleFormat)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-destructive">Descuentos:</span>
                              <span className="font-semibold text-foreground">
                                ${formatCifra(highTotalesDia.descuentos, highlightsScaleFormat)}
                              </span>
                            </div>
                            <div className="h-px bg-border"></div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-chart-2">Ventas Netas:</span>
                              <span className="text-lg font-bold text-foreground">
                                ${formatCifra(highTotalesDia.ventasNetas, highlightsScaleFormat)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-blue-600">Otros Ingresos:</span>
                              <span className="font-semibold text-foreground">
                                ${formatCifra(highTotalesDia.otrosIngresos, highlightsScaleFormat)}
                              </span>
                            </div>
                            <div className="h-px bg-border"></div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-primary">Total Ingresos:</span>
                              <span className="text-xl font-bold text-primary">
                                ${formatCifra(highTotalesDia.totalIngresos, highlightsScaleFormat)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
            
                        {/* Mes */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-semibold text-primary">
                              Resumen del Mes{" "}
                              {highlightLabels?.mes
                                ? `(${prettyMonthYearLabel(highlightLabels.mes)})`
                                : ""}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Ventas Brutas:</span>
                              <span className="font-semibold text-foreground">
                                ${formatCifra(highTotalesMes.ventasBrutas, highlightsScaleFormat)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-destructive">Descuentos:</span>
                              <span className="font-semibold text-foreground">
                                ${formatCifra(highTotalesMes.descuentos, highlightsScaleFormat)}
                              </span>
                            </div>
                            <div className="h-px bg-border"></div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-chart-2">Ventas Netas:</span>
                              <span className="text-lg font-bold text-foreground">
                                ${formatCifra(highTotalesMes.ventasNetas, highlightsScaleFormat)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-blue-600">Otros Ingresos:</span>
                              <span className="font-semibold text-foreground">
                                ${formatCifra(highTotalesMes.otrosIngresos, highlightsScaleFormat)}
                              </span>
                            </div>
                            <div className="h-px bg-border"></div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-primary">Total Ingresos:</span>
                              <span className="text-xl font-bold text-primary">
                                ${formatCifra(highTotalesMes.totalIngresos, highlightsScaleFormat)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
            
                        {/* Año */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-semibold text-primary">
                              Resumen del Año {highlightLabels?.ano ? `(${highlightLabels.ano})` : ""}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Ventas Brutas:</span>
                              <span className="font-semibold text-foreground">
                                ${formatCifra(highTotalesAno.ventasBrutas, highlightsScaleFormat)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-destructive">Descuentos:</span>
                              <span className="font-semibold text-foreground">
                                ${formatCifra(highTotalesAno.descuentos, highlightsScaleFormat)}
                              </span>
                            </div>
                            <div className="h-px bg-border"></div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-chart-2">Ventas Netas:</span>
                              <span className="text-lg font-bold text-foreground">
                                ${formatCifra(highTotalesAno.ventasNetas, highlightsScaleFormat)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-blue-600">Otros Ingresos:</span>
                              <span className="font-semibold text-foreground">
                                ${formatCifra(highTotalesAno.otrosIngresos, highlightsScaleFormat)}
                              </span>
                            </div>
                            <div className="h-px bg-border"></div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-primary">Total Ingresos:</span>
                              <span className="text-xl font-bold text-primary">
                                ${formatCifra(highTotalesAno.totalIngresos, highlightsScaleFormat)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
            
                    {/* SEPARADOR */}
                    <div className="my-8 border-t-2 border-primary/20"></div>
            
                    {/* ANALÍTICA - Sección de análisis detallado */}
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-6">
                        Analítica de {tipoIngresoAnalisis === "ventas" ? "Ventas" : "Otros Ingresos"}
                      </h3>
            
                      {/* Selector de Período, Formato de Cifras, Tipo de Métrica y Tipo de Ingreso */}
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>Tipo de Ingreso</CardTitle>
                            <CardDescription>Selecciona qué analizar</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <RadioGroup
                              value={tipoIngresoAnalisis}
                              onValueChange={(v) => setTipoIngresoAnalisis(v as "ventas" | "otros")}
                              className="flex flex-col gap-3"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="ventas" id="tipo-ventas" />
                                <Label htmlFor="tipo-ventas" className="cursor-pointer">
                                  Ventas
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="otros" id="tipo-otros" />
                                <Label htmlFor="tipo-otros" className="cursor-pointer">
                                  Otros Ingresos
                                </Label>
                              </div>
                            </RadioGroup>
                          </CardContent>
                        </Card>
            
                        <Card>
                          <CardHeader>
                            <CardTitle>Período de Análisis</CardTitle>
                            <CardDescription>Selecciona el período</CardDescription>
                          </CardHeader>
            
                          <CardContent className="space-y-3">
                            <RadioGroup
                              value={periodFilter}
                              onValueChange={(v) => setPeriodFilter(v as "diario" | "mensual" | "anual")}
                              className="flex flex-col gap-3"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="diario" id="period-daily" />
                                <Label htmlFor="period-daily" className="cursor-pointer">
                                  Diario
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="mensual" id="period-monthly" />
                                <Label htmlFor="period-monthly" className="cursor-pointer">
                                  Mensual
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="anual" id="period-annual" />
                                <Label htmlFor="period-annual" className="cursor-pointer">
                                  Anual
                                </Label>
                              </div>
                            </RadioGroup>
            
                            {/* Selector de fecha para análisis diario */}
                            {periodFilter === "diario" && (
                              <div className="pt-2 border-t">
                                <Label className="text-xs text-muted-foreground mb-2 block">
                                  Fecha específica
                                </Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !fechaAnalisisDiario && "text-muted-foreground"
                                      )}
                                      size="sm"
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {format(fechaAnalisisDiario, "PPP", { locale: es })}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={fechaAnalisisDiario}
                                      onSelect={(date) => date && setFechaAnalisisDiario(date)}
                                      initialFocus
                                      className="pointer-events-auto"
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}
            
                            {/* ✅ Selector de mes para análisis mensual (SOLO MES/AÑO, sin días) */}
                            {periodFilter === "mensual" && (
                              <div className="pt-2 border-t">
                                <Label className="text-xs text-muted-foreground mb-2 block">
                                  Mes específico
                                </Label>
            
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className={cn("w-full justify-start text-left font-normal")}
                                      size="sm"
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {format(fechaAnalisisMensual, "MMMM yyyy", { locale: es })}
                                    </Button>
                                  </PopoverTrigger>
            
                                  <PopoverContent className="w-[280px] p-3" align="start">
                                    <div className="grid grid-cols-2 gap-3">
                                      {/* Mes */}
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Mes</Label>
                                        <Select
                                          value={String(fechaAnalisisMensual.getMonth())}
                                          onValueChange={(v) => {
                                            const month = Number(v);
                                            const y = fechaAnalisisMensual.getFullYear();
                                            setFechaAnalisisMensual(new Date(y, month, 1));
                                          }}
                                        >
                                          <SelectTrigger className="w-full">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {[
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
                                            ].map((m, idx) => (
                                              <SelectItem key={m} value={String(idx)}>
                                                {m}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
            
                                      {/* Año */}
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Año</Label>
                                        <Select
                                          value={String(fechaAnalisisMensual.getFullYear())}
                                          onValueChange={(v) => {
                                            const year = Number(v);
                                            const m = fechaAnalisisMensual.getMonth();
                                            setFechaAnalisisMensual(new Date(year, m, 1));
                                          }}
                                        >
                                          <SelectTrigger className="w-full">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {(() => {
                                              const now = new Date().getFullYear();
                                              const years = Array.from({ length: 12 }, (_, i) => now - 10 + i);
                                              return years.map((y) => (
                                                <SelectItem key={y} value={String(y)}>
                                                  {y}
                                                </SelectItem>
                                              ));
                                            })()}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}
            
                            {/* ✅ Selector de año para análisis anual (SOLO AÑO) */}
                            {periodFilter === "anual" && (
                              <div className="pt-2 border-t">
                                <Label className="text-xs text-muted-foreground mb-2 block">
                                  Año específico
                                </Label>
            
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className={cn("w-full justify-start text-left font-normal")}
                                      size="sm"
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {String(fechaAnalisisAnual.getFullYear())}
                                    </Button>
                                  </PopoverTrigger>
            
                                  <PopoverContent className="w-[220px] p-3" align="start">
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Año</Label>
                                      <Select
                                        value={String(fechaAnalisisAnual.getFullYear())}
                                        onValueChange={(v) =>
                                          setFechaAnalisisAnual(new Date(Number(v), 0, 1))
                                        }
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(() => {
                                            const now = new Date().getFullYear();
                                            const years = Array.from({ length: 15 }, (_, i) => now - 12 + i);
                                            return years.map((y) => (
                                              <SelectItem key={y} value={String(y)}>
                                                {y}
                                              </SelectItem>
                                            ));
                                          })()}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}
                          </CardContent>
                        </Card>
            
                        <Card>
                          <CardHeader>
                            <CardTitle>Formato de Cifras</CardTitle>
                            <CardDescription>Visualización de montos</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <RadioGroup
                              value={scaleFormat}
                              onValueChange={(v) =>
                                setScaleFormat(v as "general" | "miles" | "millones")
                              }
                              className="flex flex-col gap-3"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="general" id="scale-general" />
                                <Label htmlFor="scale-general" className="cursor-pointer">
                                  General
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="miles" id="scale-thousands" />
                                <Label htmlFor="scale-thousands" className="cursor-pointer">
                                  Miles (K)
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="millones" id="scale-millions" />
                                <Label htmlFor="scale-millions" className="cursor-pointer">
                                  Millones (M)
                                </Label>
                              </div>
                            </RadioGroup>
                          </CardContent>
                        </Card>
            
                        <Card>
              <CardHeader>
                <CardTitle>Tipo de Métrica</CardTitle>
                <CardDescription>Datos a visualizar</CardDescription>
              </CardHeader>
            
              <CardContent className="space-y-3">
              {tipoIngresoAnalisis === "otros" ? (
                <>
                  <RadioGroup
                    value={metricType}
                    onValueChange={(v) => setMetricType(v as MetricType)}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="otros_netos" id="metric-otros-netos" />
                      <Label htmlFor="metric-otros-netos" className="cursor-pointer">
                        Otros Ingresos Netos
                      </Label>
                    </div>
                  </RadioGroup>
            
                  <div className="mt-1 text-xs text-muted-foreground border rounded-lg bg-muted/30 px-3 py-2">
                    Muestra el total neto de <b>otros ingresos</b> en el período seleccionado.
                  </div>
                </>
              ) : (
                <>
                  <RadioGroup
                    value={metricType}
                    onValueChange={(v) => setMetricType(v as MetricType)}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="netas" id="metric-netas" />
                      <Label htmlFor="metric-netas" className="cursor-pointer">
                        Ventas Netas
                      </Label>
                    </div>
            
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="descuentos" id="metric-descuentos" />
                      <Label htmlFor="metric-descuentos" className="cursor-pointer">
                        Descuentos
                      </Label>
                    </div>
            
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="brutas" id="metric-brutas" />
                      <Label htmlFor="metric-brutas" className="cursor-pointer">
                        Ventas Brutas
                      </Label>
                    </div>
                  </RadioGroup>
            
                  {metricType === "netas" && (
                    <div className="mt-1 text-xs text-muted-foreground border rounded-lg bg-muted/30 px-3 py-2">
                      <b>Ventas netas</b> = (Ventas Brutas) − (Descuentos)
                    </div>
                  )}
            
                  {metricType === "brutas" && (
                    <div className="mt-1 text-xs text-muted-foreground border rounded-lg bg-muted/30 px-3 py-2">
                      Las <b>ventas brutas</b> es lo facturado antes de hacer algún descuento
                    </div>
                  )}
                </>
              )}
             </CardContent>
             </Card>
            
                      </div>
            
                      {/* Gráfico de Ventas Totales, Descuentos y Ventas Netas */}
             <Card className="mb-6">
              <CardHeader>
                <CardTitle>
                  Evolución de{" "}
                  {metricType === "descuentos"
                    ? "Descuentos"
                    : tipoIngresoAnalisis === "otros"
                    ? "Otros Ingresos"
                    : metricType === "brutas"
                    ? "Ventas Brutas"
                    : "Ventas Netas"}
                </CardTitle>
                <CardDescription>
                  {(metricType === "descuentos"
                    ? "Descuentos aplicados"
                    : tipoIngresoAnalisis === "otros"
                    ? "Otros ingresos"
                    : metricType === "brutas"
                    ? "Ventas brutas"
                    : "Ventas netas") +
                    " - " +
                    (periodFilter === "diario"
                      ? "del día"
                      : periodFilter === "mensual"
                      ? "por día del mes"
                      : "por mes del año")}
                </CardDescription>
              </CardHeader>
            
              <CardContent>
                {(() => {
                  // 1) Total real (para decidir si mostramos “no hay datos”)
                  const totalReal =
                    tipoIngresoAnalisis === "ventas"
                      ? metricType === "brutas"
                        ? Number(datosAnaliticas.ventasBrutas || 0)
                        : metricType === "descuentos"
                        ? Number(datosAnaliticas.descuentos || 0)
                        : Number(datosAnaliticas.ventasNetas || 0)
                      : Number(datosAnaliticas.otrosIngresos || 0);
            
                  // 2) Construir fallback cuando detallesPorPeriodo viene vacío
                  const buildFallbackFromTransactions = () => {
                    const txs = (filteredTransactions || []) as any[];
            
                    const pushValue = (bucket: any, v: number) => {
                      if (tipoIngresoAnalisis === "otros") {
                        bucket.otrosIngresos += v;
                        return;
                      }
                      if (metricType === "brutas") bucket.ventasBrutas += v;
                      else if (metricType === "descuentos") bucket.descuentos += v;
                      else bucket.ventasNetas += v;
                    };
            
                    // ✅ Usar la misma fecha “real” que usa la tabla (no asiento_fecha)
             const getTxFecha = (t: any) => {
              const raw =
                t?.fecha_fixed ??        // ideal (viene del backend mapeado)
                t?.fecha ??              // fallback
                t?.createdAt ??
                t?.created_at ??
                t?.asiento_fecha;        // último fallback, por si existiera en alguno
              if (!raw) return null;
              return parseDateSafe(raw); // usa tu helper existente
             };
            
            
                    // Diario: 1 punto (fecha seleccionada)
                    if (periodFilter === "diario") {
              const selectedDateStr = ymdLocal(fechaAnalisisDiario);
            
              const bucket = {
                periodo: "Hoy",
                ventasBrutas: 0,
                descuentos: 0,
                ventasNetas: 0,
                otrosIngresos: 0,
              };
            
              txs.forEach((t) => {
                const d = getTxFecha(t);
                if (!d) return;
            
                // ✅ Comparación local (sin UTC), coherente con la tabla
                if (ymdLocal(d) !== selectedDateStr) return;
            
                pushValue(bucket, Number(getMetricValue(t, metricType) || 0));
              });
            
              return [bucket];
             }
            
                    // Mensual: puntos por día del mes seleccionado
                    if (periodFilter === "mensual") {
              const month = fechaAnalisisMensual.getMonth();
              const year = fechaAnalisisMensual.getFullYear();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
            
              const buckets = Array.from({ length: daysInMonth }, (_, i) => ({
                periodo: `Día ${i + 1}`,
                ventasBrutas: 0,
                descuentos: 0,
                ventasNetas: 0,
                otrosIngresos: 0,
                __day: i + 1,
              }));
            
              txs.forEach((t) => {
                const d = getTxFecha(t);
                if (!d) return;
            
                if (d.getFullYear() !== year || d.getMonth() !== month) return;
            
                const idx = d.getDate() - 1;
                if (idx < 0 || idx >= buckets.length) return;
            
                pushValue(buckets[idx], Number(getMetricValue(t, metricType) || 0));
              });
            
              return buckets;
             }
            
                    // Anual: puntos por mes del año actual (o del sistema)
                    const today = new Date();
                    const year = today.getFullYear();
                    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            
                    const buckets = Array.from({ length: 12 }, (_, i) => ({
                      periodo: monthNames[i],
                      ventasBrutas: 0,
                      descuentos: 0,
                      ventasNetas: 0,
                      otrosIngresos: 0,
                      __month: i,
                    }));
            
                    txs.forEach((t) => {
              const d = getTxFecha(t);
              if (!d) return;
              if (d.getFullYear() !== year) return;
            
                      const idx = d.getMonth();
                      pushValue(buckets[idx], Number(getMetricValue(t, metricType) || 0));
                    });
            
                    const sum = buckets.reduce(
                      (acc, b) => acc + b.ventasBrutas + b.descuentos + b.ventasNetas + b.otrosIngresos,
                      0
                    );
                    if (sum === 0 && totalReal > 0) {
                      const one = {
                        periodo: `${year}`,
                        ventasBrutas: 0,
                        descuentos: 0,
                        ventasNetas: 0,
                        otrosIngresos: 0,
                      };
                      pushValue(one, totalReal);
                      return [one];
                    }
            
                    return buckets;
                  };
            
                  // ✅ El gráfico siempre debe ser coherente con la tabla (filteredTransactions)
                  const detalles = buildFallbackFromTransactions();
            
            
                  // 4) Adaptar al shape del chart
                  const chartData = (detalles || []).map((d: any) => ({
                    periodo: d.periodo,
                    ventas: Number(d.ventasBrutas || 0),
                    descuentos: Number(d.descuentos || 0),
                    neto: Number(d.ventasNetas || 0),
                    otrosIngresos: Number(d.otrosIngresos || 0),
                    __day: d.__day,
                    __month: d.__month,
                  }));
            
                  // 5) ¿Hay algo distinto de 0?
                  const hasAnyValue = chartData.some(
                    (p) => (p.ventas || 0) + (p.descuentos || 0) + (p.neto || 0) + (p.otrosIngresos || 0) > 0
                  );
            
                  if (loadingTransacciones) {
                    return <div className="h-80 flex items-center justify-center text-muted-foreground">Cargando datos...</div>;
                  }
            
                  if (!hasAnyValue && totalReal <= 0) {
                    return <div className="h-80 flex items-center justify-center text-muted-foreground">No hay datos para mostrar</div>;
                  }
            
                  return (
                    <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 14, right: 18, left: 4, bottom: 0 }}
                >
                  {/* Degradados (modern look) */}
                  <defs>
                    <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
            
                    <linearGradient id="gradOtros" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.30} />
                      <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.02} />
                    </linearGradient>
            
                    <linearGradient id="gradDescuentos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.20} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
            
                  {/* Grid suave (más pro) */}
                  <CartesianGrid
                    strokeDasharray="4 6"
                    vertical={false}
                    stroke="hsl(var(--border))"
                    opacity={0.6}
                  />
            
                  <XAxis
                    dataKey="periodo"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
            
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value) => formatCifra(Number(value) || 0, scaleFormat)}
                  />
            
                  {/* Tooltip pro + cursor tipo crosshair */}
                  <RechartsTooltip
                    cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "4 6" }}
                    content={
                      <ChartTooltipBukipin
                        scaleFormat={scaleFormat}
                        title={
                          metricType === "descuentos"
                            ? "Descuentos"
                            : tipoIngresoAnalisis === "otros"
                            ? "Otros ingresos"
                            : metricType === "brutas"
                            ? "Ventas brutas"
                            : "Ventas netas"
                        }
                      />
                    }
                  />
            
                  {/* 🔥 Serie ACTIVA (solo 1, coherente con tu selector) */}
                  {metricType === "descuentos" && (
                    <Area
                      type="monotone"
                      dataKey="descuentos"
                      name="Descuentos"
                      stroke="hsl(var(--destructive))"
                      fill="url(#gradDescuentos)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  )}
            
                  {metricType === "brutas" && tipoIngresoAnalisis === "ventas" && (
                    <Area
                      type="monotone"
                      dataKey="ventas"
                      name="Ventas brutas"
                      stroke="hsl(var(--primary))"
                      fill="url(#gradVentas)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  )}
            
                  {metricType === "netas" && tipoIngresoAnalisis === "ventas" && (
                    <Area
                      type="monotone"
                      dataKey="neto"
                      name="Ventas netas"
                      stroke="hsl(var(--chart-1))"
                      fill="url(#gradVentas)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  )}
            
                  {tipoIngresoAnalisis === "otros" && metricType !== "descuentos" && (
                    <Area
                      type="monotone"
                      dataKey="otrosIngresos"
                      name="Otros ingresos"
                      stroke="hsl(var(--chart-2))"
                      fill="url(#gradOtros)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  )}
            
                  {/* Brush (mini-zoom) estilo “pro” como tu referencia */}
                  {periodFilter !== "diario" && chartData.length > 12 && (
                    <Brush
                      dataKey="periodo"
                      height={18}
                      travellerWidth={10}
                      stroke="hsl(var(--primary))"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
             </div>
                  );
                })()}
              </CardContent>
             </Card>
            
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            
                        {/* Gráfico por Tipo */}
             <Card>
              <CardHeader>
                <CardTitle>{metricLabel} por Tipo</CardTitle>
                <CardDescription>Distribución de {metricLabelLower} por categoría</CardDescription>
              </CardHeader>
            
            
              <CardContent>
                {loadingTransacciones ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">Cargando gráfico...</div>
                ) : !hayDatosDisponibles() ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">No hay datos para mostrar</div>
                ) : tipoIngresoAnalisis === "otros" && metricType === "descuentos" ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">No hay descuentos en otros ingresos</div>
                ) : (
                  <div className="h-80">
                    {(() => {
                      const pieTipoData: PieTipoItem[] = (() => {
                        const totalRealPie =
                          tipoIngresoAnalisis === "ventas"
                            ? metricType === "brutas"
                              ? datosAnaliticas.ventasBrutas
                              : metricType === "descuentos"
                              ? datosAnaliticas.descuentos
                              : datosAnaliticas.ventasNetas
                            : datosAnaliticas.otrosIngresos;
            
                        if (filteredTransactions.length === 0 && (Number(totalRealPie) || 0) > 0) {
                          return [{ tipo: "Sin detalle", monto: Number(totalRealPie) || 0, porcentaje: "100.0" }];
                        }
            
                        const distribucion = filteredTransactions.reduce<NumMap>((acc, t: any) => {
                          const rawKey = getTipoIngresoKey(t);
                          acc[rawKey] = (acc[rawKey] || 0) + (Number(getMetricValue(t, metricType)) || 0);
                          return acc;
                        }, {} as NumMap);
            
                        const total = (Object.values(distribucion) as number[]).reduce((sum, v) => sum + (Number(v) || 0), 0);
            
                        return (Object.entries(distribucion) as Array<[string, number]>)
                          .map(([tipo, monto]) => ({
                            tipo: prettyTipoIngreso(tipo),
                            monto: Number(monto) || 0,
                            porcentaje: total > 0 ? (((Number(monto) || 0) / total) * 100).toFixed(1) : "0.0",
                          }))
                          .sort((a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0));
                      })();
            
                      const totalPie = pieTipoData.reduce((s, d) => s + (Number(d.monto) || 0), 0);
            
                      return (
                        <div className="h-full flex flex-col">
                          {/* ⬇️ El chart ocupa el aire disponible */}
                          <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart margin={{ top: 6, right: 10, bottom: 6, left: 10 }}>
                                <Pie
                                  data={pieTipoData}
                                  dataKey="monto"
                                  nameKey="tipo"
                                  cx="50%"
                                  cy="44%"              // ✅ un poco más arriba (más aire para la leyenda)
                                  innerRadius={64}
                                  outerRadius={88}      // ✅ un pelín menor para evitar recortes con 3+ segmentos
                                  paddingAngle={2}
                                  cornerRadius={10}
                                  stroke={hsl("border")}
                                  strokeWidth={2}
                                  labelLine={false}
                                  label={false}
                                >
                                  <RechartsLabel content={CenterLabel("Total", totalPie)} position="center" />
                                  {pieTipoData.map((_, idx) => (
                                    <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
            
                                <RechartsTooltip
                                  formatter={(value: any) => [`$${formatCifra(Number(value) || 0, scaleFormat)}`, "Monto"]}
                                  contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "10px",
                                    color: "hsl(var(--foreground))",
                                    boxShadow: "0 12px 30px rgba(0,0,0,0.10)",
                                  }}
                                  itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                                  labelStyle={{ color: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                                />
            
                                {/* ✅ la leyenda abajo sin empujar a lo loco */}
                                <Legend verticalAlign="bottom" align="center" content={makeLegend("tipo")} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
            
                          {/* ✅ Nota aclaratoria */}
                          {tipoIngresoAnalisis === "ventas" && (
                            <div className="mt-2 px-3 py-2 rounded-lg border bg-muted/30 text-xs text-muted-foreground flex items-start gap-2">
                              <span className="mt-0.5">⚠️</span>
                              <span className="leading-relaxed">
                                Este <b>Total</b> corresponde únicamente a <b>Ventas</b> (no incluye <b>Otros ingresos</b>).
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
             </Card>
            
            
                        {/* Gráfico de Estado de Pago */}
             <Card>
              <CardHeader>
                <CardTitle>
                  Estado de Pagos - {metricLabel}
                </CardTitle>
                <CardDescription>Distribución por estado de pago</CardDescription>
              </CardHeader>
            
              <CardContent>
                {loadingTransacciones ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    Cargando gráfico...
                  </div>
                ) : !hayDatosDisponibles() ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    No hay datos para mostrar
                  </div>
                ) : tipoIngresoAnalisis === "ventas" && metricType !== "netas" ? (
                  // ✅ Regla clave: solo se integra con netas (en ventas)
                  <div className="h-80 flex items-center justify-center">
                    <div className="max-w-md w-full p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground text-center">
                      <div className="font-semibold text-foreground mb-1">
                        Solo se puede integrar con <span className="text-primary">Ventas netas</span>
                      </div>
                      <div>
                        ya que es lo que realmente se cobra.
                      </div>
                    </div>
                  </div>
                ) : (
                  // ✅ Caso permitido: Ventas Netas o Otros Ingresos Netos
                  <div className="h-80">
                    {(() => {
                      const pieEstadoData: PieEstadoItem[] = (() => {
                        const totalRealEstado =
                          tipoIngresoAnalisis === "ventas"
                            ? Number(datosAnaliticas.ventasNetas || 0)
                            : Number(datosAnaliticas.otrosIngresos || 0);
            
                        if (filteredTransactions.length === 0 && totalRealEstado > 0) {
                          return [
                            { estado: "Pagado Total", monto: totalRealEstado, porcentaje: "100.0" },
                          ];
                        }
            
                        const estadoPagos = filteredTransactions.reduce<NumMap>((acc, t: any) => {
                          let estado = "Por Cobrar";
                          const pagado = Number(t?.monto_pagado) || 0;
                          const pendiente = Number(t?.monto_pendiente) || 0;
            
                          if (t?.tipo_pago === "contado" || (pagado > 0 && pendiente === 0)) estado = "Pagado Total";
                          else if (t?.tipo_pago === "parcial" || (pagado > 0 && pendiente > 0)) estado = "Pago Parcial";
            
                          // ✅ IMPORTANTÍSIMO: Estado de pagos siempre se calcula sobre NETO cobrable
                          acc[estado] = (acc[estado] || 0) + (Number(getMetricValue(t, tipoIngresoAnalisis === "ventas" ? "netas" : "otros_netos")) || 0);
                          return acc;
                        }, {} as NumMap);
            
                        const total = (Object.values(estadoPagos) as number[]).reduce(
                          (sum, v) => sum + (Number(v) || 0),
                          0
                        );
            
                        return (Object.entries(estadoPagos) as Array<[string, number]>)
                          .map(([estado, monto]) => ({
                            estado,
                            monto: Number(monto) || 0,
                            porcentaje:
                              total > 0 ? (((Number(monto) || 0) / total) * 100).toFixed(1) : "0.0",
                          }))
                          .sort((a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0));
                      })();
            
                      const totalPie = pieEstadoData.reduce((s, d) => s + (Number(d.monto) || 0), 0);
            
                      const ESTADO_COLORS: Record<string, string> = {
                        "Pagado Total": "hsl(180 50% 55%)",
                        "Pago Parcial": "hsl(180 55% 65%)",
                        "Por Cobrar": "hsl(180 45% 45%)",
                      };
            
                      return (
                        <div className="h-full flex flex-col">
                          <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart margin={{ top: 6, right: 10, bottom: 6, left: 10 }}>
                                <Pie
                                  data={pieEstadoData}
                                  dataKey="monto"
                                  nameKey="estado"
                                  cx="50%"
                                  cy="44%"
                                  innerRadius={64}
                                  outerRadius={88}
                                  paddingAngle={2}
                                  cornerRadius={10}
                                  stroke={hsl("border")}
                                  strokeWidth={2}
                                  labelLine={false}
                                  label={false}
                                >
                                  <RechartsLabel content={CenterLabel("Total", totalPie)} position="center" />
                                  {pieEstadoData.map((item, idx) => (
                                    <Cell
                                      key={`estado-cell-${idx}`}
                                      fill={ESTADO_COLORS[item.estado] ?? PIE_COLORS[idx % PIE_COLORS.length]}
                                    />
                                  ))}
                                </Pie>
            
                                <RechartsTooltip
                                  formatter={(value: any) => [
                                    `$${formatCifra(Number(value) || 0, scaleFormat)}`,
                                    "Monto",
                                  ]}
                                  contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "10px",
                                    color: "hsl(var(--foreground))",
                                    boxShadow: "0 12px 30px rgba(0,0,0,0.10)",
                                  }}
                                  itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                                  labelStyle={{ color: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                                />
            
                                <Legend verticalAlign="bottom" align="center" content={makeLegend("estado")} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
             </Card>
            
                        {/* Gráfico por Subcuenta/Cuenta Contable */}
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>
                    {metricLabel} por{" "}
                    {vistaGraficaBarras === "subcuenta" ? "Subcuenta" : "Cuenta"}
                  </CardTitle>
            
                  <CardDescription>
                    Distribución por{" "}
                    {vistaGraficaBarras === "subcuenta" ? "subcuentas" : "cuentas"} contables
                  </CardDescription>
                </div>
            
                <div className="flex items-center gap-2">
                  <Select
                    value={vistaGraficaBarras}
                    onValueChange={(v) => setVistaGraficaBarras(v as "subcuenta" | "cuenta")}
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
            
                    <SelectContent>
                      <SelectItem value="cuenta">Por Cuenta</SelectItem>
                      <SelectItem value="subcuenta">Por Subcuenta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
            
              <CardContent>
                {loadingTransacciones ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    Cargando gráfico...
                  </div>
                ) : !hayDatosDisponibles() ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    No hay datos para mostrar
                  </div>
                ) : tipoIngresoAnalisis === "otros" && metricType === "descuentos" ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    No hay descuentos en otros ingresos
                  </div>
                ) : (
                  (() => {
                    // ----------------------------
                    // ✅ PRO: soporta MUCHAS subcuentas sin aplastar
                    // - No encima: altura interna proporcional a items
                    // - Card con altura fija y scroll interno
                    // - “Top N” adaptativo: subcuenta => ALL, cuenta => 25
                    // ----------------------------
            
                    type NumMap = Record<string, number>;
                    const safeStr = (v: any) => String(v ?? "").trim();
            
                    const resolveCuentaLabel = (t: any) => {
                      const code = safeStr(t?.cuenta_principal_codigo ?? t?.cuenta_codigo ?? t?.cuentaCodigo);
                      const found = (cuentas || []).find((c: any) => safeStr(c?.codigo) === code);
            
                      const nombreTx =
                        safeStr(t?.cuenta_principal_nombre) ||
                        safeStr(t?.cuenta_nombre) ||
                        safeStr(t?.cuentaNombre);
            
                      const nombre = found?.nombre || nombreTx || "";
                      return code ? (nombre ? `${code} - ${nombre}` : code) : "Sin cuenta";
                    };
            
                    const resolveSubcuentaLabel = (t: any) => {
                      const sid = getSubcuentaIdAny?.(t);
                      const sidStr = sid ? String(sid) : "";
            
                      const subFromList = (subcuentas || []).find(
                        (s: any) => String(s?.id ?? s?._id ?? "") === sidStr
                      );
            
                      if (subFromList) {
                        const code = safeStr(subFromList?.codigo);
                        const name = safeStr(subFromList?.nombre);
                        return code ? `${code} - ${name}` : name || "Sin subcuenta asignada";
                      }
            
                      // fallback si la tx ya trae subcuenta resuelta
                      const codeTx =
                        safeStr(t?.subcuenta_codigo) ||
                        safeStr(t?.subcuentaCodigo) ||
                        safeStr(t?.subcuenta_code);
            
                      const nameTx =
                        safeStr(t?.subcuenta_nombre) ||
                        safeStr(t?.subcuentaNombre) ||
                        safeStr(t?.subcuenta_name);
            
                      if (codeTx || nameTx) return codeTx ? `${codeTx} - ${nameTx || "Subcuenta"}` : nameTx;
            
                      return "Sin subcuenta asignada";
                    };
            
                    const totalRealBarSub =
                      tipoIngresoAnalisis === "ventas"
                        ? metricType === "brutas"
                          ? datosAnaliticas.ventasBrutas
                          : metricType === "descuentos"
                          ? datosAnaliticas.descuentos
                          : datosAnaliticas.ventasNetas
                        : datosAnaliticas.otrosIngresos;
            
                    const agg = (() => {
                      // Caso fallback si no hay tx pero sí total
                      if (filteredTransactions.length === 0 && (Number(totalRealBarSub) || 0) > 0) {
                        return { "Sin detalle": Number(totalRealBarSub) || 0 } as NumMap;
                      }
            
                      const map = filteredTransactions.reduce<NumMap>((acc, t: any) => {
                        const key =
                          vistaGraficaBarras === "subcuenta"
                            ? resolveSubcuentaLabel(t)
                            : resolveCuentaLabel(t);
            
                        acc[key] = (acc[key] || 0) + (Number(getMetricValue(t, metricType)) || 0);
                        return acc;
                      }, {} as NumMap);
            
                      // Si hay diferencia vs total, sumamos desde asientos directos
                      const totalTrans = (Object.values(map) as number[]).reduce((sum, v) => sum + (Number(v) || 0), 0);
                      const diff = (Number(totalRealBarSub) || 0) - totalTrans;
            
                      if (diff > 0.01) {
                        const extra: NumMap = {};
            
                        (asientosDir || []).forEach((asiento: any) => {
                          const detalles = Array.isArray(asiento?.detalle_asientos) ? asiento.detalle_asientos : [];
                          const detalleIngreso = detalles.find(
                            (d: any) => safeStr(d?.cuenta_codigo).startsWith("4") && Number(d?.haber) > 0
                          );
                          if (!detalleIngreso) return;
            
                          const monto = Number(detalleIngreso?.haber) || 0;
            
                          let key = "Sin detalle";
                          if (vistaGraficaBarras === "cuenta") {
                            const cuentaCodigo = safeStr(detalleIngreso?.cuenta_codigo);
                            const cInfo = (cuentas || []).find((c: any) => safeStr(c?.codigo) === cuentaCodigo);
                            const nombre = cInfo?.nombre || "Otros ingresos";
                            key = cuentaCodigo ? `${cuentaCodigo} - ${nombre}` : "Sin cuenta";
                          } else {
                            const subRef =
                              detalleIngreso?.subcuenta_id ??
                              detalleIngreso?.subcuentaId ??
                              detalleIngreso?.subcuenta ??
                              null;
            
                            const subIdStr = subRef ? String(subRef) : "";
                            const subInfo = (subcuentas || []).find(
                              (s: any) => String(s?.id ?? s?._id ?? "") === subIdStr
                            );
            
                            key = subInfo
                              ? safeStr(subInfo?.codigo)
                                ? `${safeStr(subInfo.codigo)} - ${safeStr(subInfo.nombre)}`
                                : safeStr(subInfo?.nombre) || "Sin subcuenta asignada"
                              : "Sin subcuenta asignada";
                          }
            
                          extra[key] = (extra[key] || 0) + monto;
                        });
            
                        (Object.entries(extra) as Array<[string, number]>).forEach(([k, v]) => {
                          map[k] = (map[k] || 0) + (Number(v) || 0);
                        });
                      }
            
                      return map;
                    })();
            
                    // Convertimos a array + orden
                    const arrAll = (Object.entries(agg) as Array<[string, number]>)
                      .map(([label, monto]) => ({ label, monto: Number(monto) || 0 }))
                      .sort((a, b) => (b.monto || 0) - (a.monto || 0));
            
                    // ✅ Límite adaptativo:
                    // - Subcuentas: ALL (para soportar muchas)
                    // - Cuentas: TOP 25 (mejor UX)
                    const limit = vistaGraficaBarras === "subcuenta" ? 0 : 25;
                    const barData = limit > 0 ? arrAll.slice(0, limit) : arrAll;
            
                    // ✅ ancho Y dinámico
                    const maxLen = barData.reduce((m, it) => Math.max(m, String(it?.label ?? "").length), 0);
                    const yAxisWidth = Math.min(340, Math.max(180, maxLen * 6.2));
            
                    // ✅ Card altura fija + scroll interno
                    // visible: estable y elegante
                    const containerH = 420;
            
                    // ✅ altura interna proporcional a items (evita encimado)
                    // 70px por barra = mucho aire (pro)
                    const innerH = Math.max(340, Math.min(2400, barData.length * 70));
            
                    // ✅ si hay muchas, mostramos hint
                    const showScrollHint = barData.length >= 10;
            
                    return (
                      <div className="w-full">
                        <div className="rounded-xl border bg-muted/10" style={{ height: containerH }}>
                          <div className="h-full overflow-y-auto overflow-x-hidden p-4">
                            <div style={{ height: innerH }} className="w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={barData}
                                  layout="vertical"
                                  margin={{ top: 8, right: 110, bottom: 14, left: 8 }}
                                  barCategoryGap={26}
                                >
                                  <CartesianGrid
                                    stroke="hsl(var(--border))"
                                    strokeDasharray="4 8"
                                    vertical={false}
                                    opacity={0.65}
                                  />
            
                                  <XAxis
                                    type="number"
                                    tickFormatter={(value) => formatCifra(Number(value) || 0, scaleFormat)}
                                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={[0, (dataMax: number) => dataMax * 1.28]}
                                  />
            
                                  <YAxis
                                    type="category"
                                    dataKey="label"
                                    width={yAxisWidth}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={(props: any) => {
                                      const { x, y, payload } = props;
                                      const full = String(payload?.value ?? "");
            
                                      // wrap 2 líneas (sin encimar)
                                      const maxChars = 26;
                                      const line1 = full.length > maxChars ? full.slice(0, maxChars) : full;
                                      const line2 = full.length > maxChars ? full.slice(maxChars, maxChars * 2) : "";
            
                                      return (
                                        <g transform={`translate(${x},${y})`}>
                                          <text
                                            x={-10}
                                            y={0}
                                            textAnchor="end"
                                            fill="hsl(var(--foreground))"
                                            fontSize={12}
                                            fontWeight={650}
                                          >
                                            <tspan x={-10} dy="0">{line1}</tspan>
                                            {line2 ? (
                                              <tspan x={-10} dy="14" fill="hsl(var(--muted-foreground))" fontWeight={500}>
                                                {line2}
                                              </tspan>
                                            ) : null}
                                          </text>
                                        </g>
                                      );
                                    }}
                                  />
            
                                  <RechartsTooltip
                                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.22 }}
                                    formatter={(value) => [`$${formatCifra(Number(value) || 0, scaleFormat)}`, "Monto"]}
                                    contentStyle={{
                                      backgroundColor: "hsl(var(--background))",
                                      border: "1px solid hsl(var(--border))",
                                      borderRadius: "12px",
                                      color: "hsl(var(--foreground))",
                                      boxShadow: "0 12px 30px rgba(0,0,0,0.10)",
                                      padding: "10px 12px",
                                    }}
                                    itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 700 }}
                                    labelStyle={{ color: "hsl(var(--muted-foreground))", fontWeight: 700 }}
                                  />
            
                                  <Bar
                                    dataKey="monto"
                                    fill="hsl(180 50% 55%)"
                                    radius={[14, 14, 14, 14]}
                                    barSize={36}
                                  >
                                    <LabelList
                                      dataKey="monto"
                                      position="right"
                                      offset={14}
                                      formatter={(value: number) => `$${formatCifra(Number(value) || 0, scaleFormat)}`}
                                      style={{
                                        fill: "hsl(var(--foreground))",
                                        fontWeight: 800,
                                        fontSize: 12,
                                      }}
                                    />
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
            
                        {/* Hint pro: scroll */}
                        {showScrollHint ? (
                          <div className="mt-3 text-xs text-muted-foreground border rounded-lg bg-muted/20 px-3 py-2">
                            Tip: desplázate dentro del gráfico para ver todas las{" "}
                            {vistaGraficaBarras === "subcuenta" ? "subcuentas" : "cuentas"}.
                          </div>
                        ) : null}
            
                        {/* Hint pro: subcuentas no cargadas */}
                        {vistaGraficaBarras === "subcuenta" && (!subcuentas || subcuentas.length === 0) ? (
                          <div className="mt-2 text-xs text-muted-foreground border rounded-lg bg-muted/20 px-3 py-2">
                            Nota: No se detectaron subcuentas cargadas. Se mostrará “Sin subcuenta asignada” cuando aplique.
                          </div>
                        ) : null}
                      </div>
                    );
                  })()
                )}
              </CardContent>
             </Card>
            
                        {/* TreeMap de Métodos de Pago */}
             <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold text-foreground">
                      Métodos de Pago Recibidos
                    </CardTitle>
            
                    <CardDescription>
                      Distribución de {metricLabelLower} por método de pago
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            
              <CardContent>
                {loadingTransacciones ? (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    Cargando gráfico...
                  </div>
                ) : !hayDatosDisponibles() ? (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    No hay datos para mostrar
                  </div>
                ) : tipoIngresoAnalisis === "otros" && metricType === "descuentos" ? (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    No hay descuentos en otros ingresos
                  </div>
                ) : (
                  (() => {
                    // ============================
                    // ✅ REGLAS (igual que tu diseño):
                    // - Ventas: SOLO con "netas" → treemap
                    // - Ventas: "brutas" o "descuentos" → SOLO leyenda
                    // - Otros ingresos: SIEMPRE treemap (su neta)
                    // ============================
                    const tipo = String(tipoIngresoAnalisis ?? "");
                    const mt = String(metricType ?? "");
            
                    const isVentas = tipo === "ventas";
                    const isOtros = tipo === "otros";
            
                    const showLegendOnly = isVentas && (mt === "brutas" || mt === "descuentos");
                    const shouldShowTreemap = isVentas ? mt === "netas" : isOtros;
            
                    const legendText =
                      "Solo se puede integrar con ventas netas, ya que es lo que realmente se cobra.";
            
                    if (showLegendOnly) {
                      return (
                        <div className="h-72 flex items-center justify-center">
                          <div className="max-w-md text-center rounded-xl border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                            <div className="font-semibold text-foreground">Nota</div>
                            <div className="mt-1">{legendText}</div>
                          </div>
                        </div>
                      );
                    }
            
                    if (!shouldShowTreemap) {
                      return (
                        <div className="h-72 flex items-center justify-center text-muted-foreground">
                          Selecciona{" "}
                          <div className="font-semibold mx-1 inline">Ventas Netas</div>
                          para ver los métodos de pago.
                        </div>
                      );
                    }
            
                    if (!Array.isArray(datosMetodosPago) || datosMetodosPago.length === 0) {
                      return (
                        <div className="h-72 flex items-center justify-center text-muted-foreground text-center">
                          No hay transacciones con método de pago en este período
                          <div className="text-xs mt-2">
                            Tip: las ventas a crédito pueden no tener método de pago asignado.
                          </div>
                        </div>
                      );
                    }
            
                    // ============================
                    // ✅ TOTAL CANÓNICO (CUADRA con Highlights)
                    // - Ventas → ventasNetas
                    // - Otros → otrosIngresos
                    // - Según periodo (Diario/Mensual/Anual)
                    // ============================
                    const totalCanonicoMetodoPago = (() => {
                      // ⚠️ Si tu state se llama distinto, cambia "periodoAnalisis" aquí.
                      const p = String((periodFilter as any) ?? "mensual").toLowerCase();
            
                      const src =
                        p === "diario" ? highTotalesDia :
                        p === "anual"  ? highTotalesAno :
                        highTotalesMes; // default mensual
            
                      if (isVentas) return Number(src?.ventasNetas) || 0;
                      if (isOtros)  return Number(src?.otrosIngresos) || 0;
            
                      // fallback (no debería entrar)
                      return (datosMetodosPago as any[]).reduce(
                        (s, it) => s + (Number(it?.value) || 0),
                        0
                      );
                    })();
            
                    // total del treemap calculado (lo que viene por método)
                    const totalTreemap = (datosMetodosPago as any[]).reduce(
                      (sum, it) => sum + (Number(it?.value) || 0),
                      0
                    );
            
                    // si falta dinero para llegar al total real → lo metemos como "Sin método"
                    const missing = Math.max(
                      0,
                      (Number(totalCanonicoMetodoPago) || 0) - (Number(totalTreemap) || 0)
                    );
            
                    const dataFinal =
                      missing > 0.009
                        ? [
                            ...(datosMetodosPago as any[]),
                            { name: "Sin método", value: missing, _missing: true },
                          ]
                        : (datosMetodosPago as any[]);
            
                    // el total para % debe ser el canónico (si existe)
                    const total =
                      (Number(totalCanonicoMetodoPago) || 0) > 0
                        ? Number(totalCanonicoMetodoPago)
                        : dataFinal.reduce((s, it) => s + (Number((it as any)?.value) || 0), 0);
            
                    // ============================
                    // 🎨 PALETA AZUL PRO BUKIPIN
                    // ============================
                    const safeName = (v: any) => String(v ?? "").trim();
            
                    const pickBlueByName = (nameRaw: string) => {
                      const n = safeName(nameRaw).toLowerCase();
                      if (n.includes("tarj")) return 214; // azul premium
                      if (n.includes("efect")) return 202; // azul-cian profundo
                      if (n.includes("transf") || n.includes("spei")) return 222; // azul serio
                      if (n.includes("depo")) return 208; // azul medio
                      if (n.includes("cheq")) return 230; // azul oscuro
                      if (n.includes("paypal")) return 226; // azul tech
                      if (n.includes("mercado")) return 206; // azul teal
                      if (n.includes("sin método")) return 220; // lo convertimos a azul-gris abajo
                      return -1;
                    };
            
                    const fallbackHues = [214, 222, 202, 208, 230, 226, 238, 196];
            
                    const getTileFill = (nameRaw: string, index: number, intensity01: number) => {
                      const n = safeName(nameRaw).toLowerCase();
                      const hueFromName = pickBlueByName(nameRaw);
                      const hue =
                        hueFromName >= 0 ? hueFromName : fallbackHues[index % fallbackHues.length];
            
                      const isMissing = n.includes("sin método");
            
                      // Missing = azul-gris elegante
                      const s = isMissing ? 16 : 62;
                      const lBase = isMissing ? 72 : 50;
                      const l = Math.max(
                        isMissing ? 60 : 38,
                        Math.min(isMissing ? 78 : 60, lBase - intensity01 * 12)
                      );
            
                      return `hsl(${hue} ${s}% ${l}%)`;
                    };
            
                    // ============================
                    // ✅ Node del Treemap
                    // ============================
                    const TreemapNode = (props: any) => {
                      const { x, y, width, height, name, value, index } = props;
                      const w = Number(width) || 0;
                      const h = Number(height) || 0;
            
                      if (w < 8 || h < 8) return null;
            
                      const v = Number(value) || 0;
                      const pct01 = total > 0 ? v / total : 0;
            
                      const showText = w >= 170 && h >= 92;
                      const showTiny = !showText && w >= 118 && h >= 62;
            
                      const fill = getTileFill(String(name ?? ""), Number(index) || 0, pct01);
            
                      const money = `$${formatCifra(v, scaleFormat)}`;
                      const pct = total > 0 ? `${(pct01 * 100).toFixed(1)}%` : "";
            
                      const textFill = "hsl(var(--background))";
            
                      return (
                        <g>
                          <rect
                            x={x}
                            y={y}
                            width={w}
                            height={h}
                            rx={18}
                            ry={18}
                            fill={fill}
                            stroke="hsl(var(--background))"
                            strokeWidth={2}
                            opacity={0.98}
                          />
            
                          {/* borde suave */}
                          <rect
                            x={x + 1}
                            y={y + 1}
                            width={Math.max(0, w - 2)}
                            height={Math.max(0, h - 2)}
                            rx={17}
                            ry={17}
                            fill="transparent"
                            stroke="rgba(255,255,255,0.22)"
                            strokeWidth={1}
                          />
            
                          {/* highlight superior */}
                          <rect
                            x={x + 10}
                            y={y + 10}
                            width={Math.max(0, w - 20)}
                            height={Math.max(0, Math.min(18, h - 20))}
                            rx={12}
                            ry={12}
                            fill="rgba(255,255,255,0.16)"
                            opacity={0.45}
                          />
            
                          {showText ? (
                            <>
                              <text
                                x={x + w / 2}
                                y={y + h / 2 - 14}
                                textAnchor="middle"
                                fill={textFill}
                                fontSize={14}
                                fontWeight={900}
                                style={{
                                  paintOrder: "stroke",
                                  stroke: "rgba(0,0,0,0.28)",
                                  strokeWidth: 2,
                                }}
                              >
                                {safeName(name)}
                              </text>
            
                              <text
                                x={x + w / 2}
                                y={y + h / 2 + 10}
                                textAnchor="middle"
                                fill={textFill}
                                fontSize={13}
                                fontWeight={900}
                                style={{
                                  paintOrder: "stroke",
                                  stroke: "rgba(0,0,0,0.28)",
                                  strokeWidth: 2,
                                }}
                              >
                                {money}
                              </text>
            
                              <text
                                x={x + w / 2}
                                y={y + h / 2 + 30}
                                textAnchor="middle"
                                fill={textFill}
                                fontSize={12}
                                fontWeight={800}
                                opacity={0.95}
                                style={{
                                  paintOrder: "stroke",
                                  stroke: "rgba(0,0,0,0.28)",
                                  strokeWidth: 2,
                                }}
                              >
                                {pct}
                              </text>
                            </>
                          ) : showTiny ? (
                            <>
                              <text
                                x={x + w / 2}
                                y={y + h / 2 - 6}
                                textAnchor="middle"
                                fill={textFill}
                                fontSize={12}
                                fontWeight={900}
                                style={{
                                  paintOrder: "stroke",
                                  stroke: "rgba(0,0,0,0.28)",
                                  strokeWidth: 2,
                                }}
                              >
                                {safeName(name)}
                              </text>
            
                              <text
                                x={x + w / 2}
                                y={y + h / 2 + 14}
                                textAnchor="middle"
                                fill={textFill}
                                fontSize={12}
                                fontWeight={900}
                                style={{
                                  paintOrder: "stroke",
                                  stroke: "rgba(0,0,0,0.28)",
                                  strokeWidth: 2,
                                }}
                              >
                                {money}
                              </text>
                            </>
                          ) : null}
                        </g>
                      );
                    };
            
                    // ============================
                    // ✅ Leyenda chips
                    // ============================
                    const legendItems = dataFinal
                      .slice()
                      .sort((a: any, b: any) => (Number(b?.value) || 0) - (Number(a?.value) || 0))
                      .slice(0, 8);
            
                    const fmtMoney = (n: number) => `$${formatCifra(n, scaleFormat)}`;
            
                    return (
                      <div className="w-full">
                        <div className="rounded-xl border bg-muted/10 p-3">
                          {/* Totales (alineación) */}
                          <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="rounded-lg border bg-background/60 px-3 py-2 text-xs">
                              <div className="text-muted-foreground">Total real (Highlights)</div>
                              <div className="font-semibold text-foreground">{fmtMoney(totalCanonicoMetodoPago)}</div>
                            </div>
            
                            <div className="rounded-lg border bg-background/60 px-3 py-2 text-xs">
                              <div className="text-muted-foreground">Sumado por métodos</div>
                              <div className="font-semibold text-foreground">{fmtMoney(totalTreemap)}</div>
                            </div>
            
                            <div className="rounded-lg border bg-background/60 px-3 py-2 text-xs">
                              <div className="text-muted-foreground">Diferencia</div>
                              <div className="font-semibold text-foreground">
                                {fmtMoney(Math.max(0, totalCanonicoMetodoPago - totalTreemap))}
                              </div>
                            </div>
                          </div>
            
                          <div className="h-[340px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <Treemap
                                data={dataFinal}
                                dataKey="value"
                                aspectRatio={4 / 3}
                                stroke="hsl(var(--background))"
                                content={<TreemapNode />}
                              >
                                <RechartsTooltip
                                  content={<CustomTreemapTooltip scaleFormat={scaleFormat} />}
                                />
                              </Treemap>
                            </ResponsiveContainer>
                          </div>
            
                          {/* Chips */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {legendItems.map((it: any, idx: number) => {
                              const n = safeName(it?.name);
                              const v = Number(it?.value) || 0;
                              const pct01 = total > 0 ? v / total : 0;
                              const dot = getTileFill(n, idx, pct01);
            
                              return (
                                <div
                                  key={`${n}-${idx}`}
                                  className="flex items-center gap-2 rounded-full border bg-background/60 px-2.5 py-1 text-xs"
                                >
                                  <div
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ background: dot }}
                                  />
                                  <div className="font-semibold text-foreground">{n}</div>
                                  <div className="text-muted-foreground">
                                    {total > 0 ? `${(pct01 * 100).toFixed(1)}%` : "0%"}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
            
                          {/* Nota de missing */}
                          {missing > 0.009 ? (
                            <div className="mt-2 text-[11px] text-muted-foreground">
                              Nota: {fmtMoney(missing)} no tenía método de pago asignado, por eso se agrupa como{" "}
                              <div className="font-semibold inline">Sin método</div>.
                            </div>
                          ) : null}
                        </div>
            
                        <div className="mt-3 text-xs text-muted-foreground">
                          Tip: pasa el cursor sobre un bloque para ver el detalle.
                        </div>
                      </div>
                    );
                  })()
                )}
              </CardContent>
             </Card>
            
            
                      </div>
            
                      {/* Tablas de análisis */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        {/* Tabla de Ventas por Producto */}
                        <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold text-foreground">
                      {metricLabel} por Producto
                    </CardTitle>
                    <CardDescription>
                      Ranking de productos {metricType === "descuentos" ? "con más descuentos" : "más vendidos"}
                    </CardDescription>
                  </div>
            
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProductSort((s) => (s === "desc" ? "asc" : "desc"))}
                      className="rounded-full border bg-background/60 px-3 py-1 text-xs text-foreground hover:bg-background"
                    >
                      Orden: {productSort === "desc" ? "Mayor → Menor" : "Menor → Mayor"}
                    </button>
            
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearch("");
                        setProductPage(1);
                        setOpenProductsModal(true);
                      }}
                      className="rounded-full border bg-background/60 px-3 py-1 text-xs text-foreground hover:bg-background"
                    >
                      Ver todos
                    </button>
                  </div>
                </div>
              </CardHeader>
            
              <CardContent>
                {loadingTransacciones ? (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">Cargando datos...</div>
                ) : !hayDatosDisponibles() ? (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">No hay datos para mostrar</div>
                ) : (
                  (() => {
                    // ============================
                    // ✅ Reglas:
                    // - Top 10 + “Otros Productos” (posición 11)
                    // - Orden DESC default, toggle ASC
                    // - Modal: listado completo + búsqueda + paginación
                    // ============================
                    if (tipoIngresoAnalisis === "otros" && metricType === "descuentos") {
                      return (
                        <div className="h-72 flex items-center justify-center text-muted-foreground">
                          No hay descuentos en otros ingresos
                        </div>
                      );
                    }
            
                    const safeStr = (v: any) => String(v ?? "").trim();
            
                    // total “canónico” para % (cuadra con el resumen)
                    const totalCanonicoProductos =
                      tipoIngresoAnalisis === "ventas"
                        ? metricType === "brutas"
                          ? Number(datosAnaliticas.ventasBrutas || 0)
                          : metricType === "descuentos"
                            ? Number(datosAnaliticas.descuentos || 0)
                            : Number(datosAnaliticas.ventasNetas || 0)
                        : Number(datosAnaliticas.otrosIngresos || 0);
            
                    // Detectar nombre de producto (robusto)
                    const getProductoNombre = (t: any) => {
                      // 1) Si backend ya lo manda
                      const direct =
                        t?.producto_nombre ??
                        t?.productoNombre ??
                        t?.productName ??
                        t?.producto ??
                        null;
            
                      if (safeStr(direct)) return safeStr(direct);
            
                      const tipo = safeStr(t?.tipo_ingreso ?? t?.tipoIngreso ?? t?.tipo ?? "").toLowerCase();
                      const desc = safeStr(t?.descripcion);
            
                      // 2) Inventariados: “Venta de X”
                      if (tipo === "inventariados" && desc.toLowerCase().startsWith("venta de ")) {
                        return safeStr(desc.replace(/^Venta de\s+/i, ""));
                      }
            
                      // 3) Precargados: “Venta: Prod (x2), Prod2 (x1)”
                      // Para la tabla, NO desglosamos por unidad aquí; abajo lo hacemos con reparto proporcional si aplica
                      if (tipo === "precargados" && desc.toLowerCase().startsWith("venta: ")) {
                        return "__MULTI__"; // señal para desglose
                      }
            
                      // 4) Otros ingresos: usar descripción como “producto/origen”
                      if (tipo === "otros") return desc || "Otros ingresos";
            
                      // 5) General o sin match
                      return "Ingresos sin producto asignado";
                    };
            
                    const findImageForName = (name: string) => {
                      const n = safeStr(name).toLowerCase();
                      const inv = (productosInventario || []).find((p: any) => safeStr(p?.nombre).toLowerCase() === n);
                      if (inv?.imagen_url) return inv.imagen_url;
            
                      const srv = (productosServicios || []).find((p: any) => safeStr(p?.nombre).toLowerCase() === n);
                      if (srv?.imagen_url) return srv.imagen_url;
            
                      return undefined;
                    };
            
                    type Row = {
                      nombre: string;
                      transacciones: number;
                      monto: number;
                      imagen?: string;
                      tieneAsignacion: boolean;
                    };
            
                    const map = new Map<string, Row>();
            
                    const addRow = (nombre: string, addMonto: number, addTx: number, tieneAsignacion: boolean, imagen?: string) => {
                      const key = safeStr(nombre) || "Ingresos sin producto asignado";
                      const prev = map.get(key);
                      if (prev) {
                        prev.monto += Number(addMonto) || 0;
                        prev.transacciones += Number(addTx) || 0;
                        prev.tieneAsignacion = prev.tieneAsignacion || !!tieneAsignacion;
                        prev.imagen = prev.imagen || imagen;
                      } else {
                        map.set(key, {
                          nombre: key,
                          monto: Number(addMonto) || 0,
                          transacciones: Number(addTx) || 0,
                          tieneAsignacion: !!tieneAsignacion,
                          imagen,
                        });
                      }
                    };
            
                    // 1) Base: desde filteredTransactions
                    (filteredTransactions || []).forEach((t: any) => {
                      const tipo = safeStr(t?.tipo_ingreso ?? t?.tipoIngreso ?? t?.tipo ?? "").toLowerCase();
                      const desc = safeStr(t?.descripcion);
            
                      const montoTx = Number(getMetricValue(t, metricType)) || 0;
            
                      // Caso: precargados multi-producto “Venta: ...”
                      if (tipo === "precargados" && desc.toLowerCase().startsWith("venta: ")) {
                        const items = safeStr(desc.replace(/^Venta:\s*/i, ""))
                          .split(",")
                          .map((s) => safeStr(s))
                          .filter(Boolean);
            
                        // Parse “Nombre (x2)”
                        const parsed = items.map((it) => {
                          const m = it.match(/^(.+?)\s*\(x(\d+)\)\s*$/i);
                          return {
                            nombre: safeStr(m ? m[1] : it),
                            cantidad: m ? Number(m[2]) || 1 : 1,
                          };
                        });
            
                        // Reparto proporcional usando catálogo si existe precio (como tú ya hacías)
                        const precios = parsed.map((p) => {
                          const prod = (productosServicios || []).find(
                            (x: any) => safeStr(x?.nombre).toLowerCase() === p.nombre.toLowerCase()
                          );
                          const precioBase = Number(prod?.precio) || 0;
                          return { ...p, precioBase, tieneAsignacion: !!prod, imagen: prod?.imagen_url };
                        });
            
                        const suma = precios.reduce((s, p) => s + (p.precioBase * p.cantidad), 0);
            
                        precios.forEach((p) => {
                          const subtotalCat = p.precioBase * p.cantidad;
                          const proporcion = suma > 0 ? subtotalCat / suma : 1 / Math.max(precios.length, 1);
                          const montoProducto = montoTx * proporcion;
                          addRow(
                            p.nombre,
                            montoProducto,
                            1, // transacciones (mantén 1 por tx como en tu tabla)
                            p.tieneAsignacion,
                            p.imagen || findImageForName(p.nombre)
                          );
                        });
            
                        return;
                      }
            
                      // Caso normal: 1 “producto”
                      const nombre = getProductoNombre(t);
                      const imagen = findImageForName(nombre);
                      const tieneAsignacion = !!imagen && nombre !== "Ingresos sin producto asignado";
                      addRow(nombre, montoTx, 1, tieneAsignacion, imagen);
                    });
            
                    // 2) Si es “otros”, podemos sumar asientos directos como “origen”
                    if (tipoIngresoAnalisis === "otros") {
                      const sumFromTx = Array.from(map.values()).reduce((s, r) => s + (Number(r.monto) || 0), 0);
                      const diff = (Number(totalCanonicoProductos) || 0) - sumFromTx;
            
                      if (diff > 0.01) {
                        const ingresosPorOrigen: Record<string, { monto: number; count: number }> = {};
            
                        (asientosDir || []).forEach((asiento: any) => {
                          const detalles = Array.isArray(asiento?.detalle_asientos) ? asiento.detalle_asientos : [];
                          const det = detalles.find(
                            (d: any) => String(d?.cuenta_codigo || "").startsWith("4") && Number(d?.haber) > 0
                          );
                          if (!det) return;
            
                          const monto = Number(det?.haber) || 0;
                          const cuentaCodigo = String(det?.cuenta_codigo || "");
                          const cuentaInfo = (cuentas || []).find((c: any) => String(c?.codigo) === cuentaCodigo);
            
                          const nombre =
                            safeStr(asiento?.descripcion) ||
                            safeStr(cuentaInfo?.nombre) ||
                            "Otros ingresos";
            
                          if (!ingresosPorOrigen[nombre]) ingresosPorOrigen[nombre] = { monto: 0, count: 0 };
                          ingresosPorOrigen[nombre].monto += monto;
                          ingresosPorOrigen[nombre].count += 1;
                        });
            
                        Object.entries(ingresosPorOrigen).forEach(([nombre, data]) => {
                          if ((Number(data.monto) || 0) > 0.01) {
                            addRow(nombre, Number(data.monto) || 0, Number(data.count) || 1, false);
                          }
                        });
                      }
                    }
            
                    // 3) Array final + orden
                    const allRows = Array.from(map.values())
                      .filter((r) => (Number(r.monto) || 0) > 0)
                      .sort((a, b) => (productSort === "desc" ? (b.monto || 0) - (a.monto || 0) : (a.monto || 0) - (b.monto || 0)));
            
                    const totalForPct =
                      (Number(totalCanonicoProductos) || 0) > 0
                        ? Number(totalCanonicoProductos)
                        : allRows.reduce((s, r) => s + (Number(r.monto) || 0), 0);
            
                    if (allRows.length === 0) {
                      return (
                        <div className="h-72 flex items-center justify-center text-muted-foreground">
                          No hay productos para mostrar en este período.
                        </div>
                      );
                    }
            
                    // 4) Top 10 + Otros Productos (posición 11)
                    const top10 = allRows.slice(0, 10);
                    const rest = allRows.slice(10);
            
                    const otros = rest.reduce(
                      (acc, r) => {
                        acc.monto += Number(r.monto) || 0;
                        acc.transacciones += Number(r.transacciones) || 0;
                        return acc;
                      },
                      {
                        nombre: "Otros Productos",
                        monto: 0,
                        transacciones: 0,
                        tieneAsignacion: true,
                      } as Row
                    );
            
                    const list = otros.monto > 0 ? [...top10, otros] : top10;
            
                    const pctOf = (m: number) => (totalForPct > 0 ? ((Number(m) || 0) / totalForPct) * 100 : 0);
            
                    const RowItem = (p: Row & { pct: number }) => {
                      const isOtrosRow = p.nombre === "Otros Productos";
                      const isSinAsignar = p.nombre === "Ingresos sin producto asignado" || !p.tieneAsignacion;
            
                      return (
                        <div
                          className={[
                            "flex items-center gap-3 p-3 rounded-lg border",
                            isOtrosRow ? "border-primary/40 bg-primary/5" : "",
                            isSinAsignar && !isOtrosRow ? "border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20" : "",
                          ].join(" ")}
                        >
                          {p.imagen ? (
                            <img
                              src={p.imagen}
                              alt={p.nombre}
                              className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                            />
                          ) : (
                            <div
                              className={[
                                "w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0",
                                isSinAsignar ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted",
                              ].join(" ")}
                            >
                              <Package className={isSinAsignar ? "w-5 h-5 text-amber-600 dark:text-amber-400" : "w-5 h-5 text-muted-foreground"} />
                            </div>
                          )}
            
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="font-medium truncate">{p.nombre}</p>
                              {isSinAsignar && !isOtrosRow ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 flex-shrink-0">
                                  Sin asignar
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {p.transacciones} {p.transacciones === 1 ? "transacción" : "transacciones"}
                            </p>
                          </div>
            
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-foreground">
                              ${formatCifra(Number(p.monto) || 0, scaleFormat)}
                            </p>
                          </div>
            
                          <div className="flex-shrink-0">
                            <div className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-semibold">
                              {p.pct.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      );
                    };
            
                    // total general
                    const totalGeneralMonto = allRows.reduce((s, r) => s + (Number(r.monto) || 0), 0);
                    const totalGeneralTx = allRows.reduce((s, r) => s + (Number(r.transacciones) || 0), 0);
            
                    return (
                      <>
                        <div className="space-y-3">
                          {list.map((p) => (
                            <RowItem key={p.nombre} {...p} pct={pctOf(p.monto)} />
                          ))}
            
                          <div className="flex items-center gap-3 p-3 border-2 border-primary rounded-lg bg-primary/5">
                            <div className="w-12 h-12 rounded-md bg-primary/20 flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-foreground">TOTAL GENERAL</p>
                              <p className="text-sm text-muted-foreground">{totalGeneralTx} transacciones</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-lg text-primary">
                                ${formatCifra(totalGeneralMonto, scaleFormat)}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <div className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm font-bold">
                                100%
                              </div>
                            </div>
                          </div>
                        </div>
            
                        {/* ============================
                            Modal: Ver todos
                           ============================ */}
                        <Dialog
                          open={openProductsModal}
                          onOpenChange={(v) => {
                            setOpenProductsModal(v);
                            if (!v) {
                              setProductSearch("");
                              setProductPage(1);
                            }
                          }}
                        >
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>Productos</DialogTitle>
                              <DialogDescription>Lista completa para análisis detallado</DialogDescription>
                            </DialogHeader>
            
                            <div className="flex flex-col md:flex-row md:items-center gap-2">
                              <Input
                                value={productSearch}
                                onChange={(e) => {
                                  setProductSearch(e.target.value);
                                  setProductPage(1);
                                }}
                                placeholder="Buscar producto..."
                              />
            
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setProductSort((s) => (s === "desc" ? "asc" : "desc"))}
                              >
                                Orden: {productSort === "desc" ? "Mayor → Menor" : "Menor → Mayor"}
                              </Button>
                            </div>
            
                            {(() => {
                              const q = safeStr(productSearch).toLowerCase();
                              const filtered = q
                                ? allRows.filter((r) => safeStr(r.nombre).toLowerCase().includes(q))
                                : allRows;
            
                              const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_PRODUCTS));
                              const page = Math.min(productPage, totalPages);
                              const start = (page - 1) * PAGE_SIZE_PRODUCTS;
                              const chunk = filtered.slice(start, start + PAGE_SIZE_PRODUCTS);
            
                              return (
                                <>
                                  <div className="mt-3 max-h-[55vh] overflow-auto pr-1 space-y-2">
                                    {chunk.map((p) => (
                                      <RowItem key={`modal-${p.nombre}`} {...p} pct={pctOf(p.monto)} />
                                    ))}
                                  </div>
            
                                  <div className="mt-4 flex items-center justify-between">
                                    <div className="text-xs text-muted-foreground">
                                      Mostrando {start + 1}-{Math.min(start + PAGE_SIZE_PRODUCTS, filtered.length)} de{" "}
                                      {filtered.length}
                                    </div>
            
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        disabled={page <= 1}
                                        onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                                      >
                                        Anterior
                                      </Button>
            
                                      <div className="text-sm">
                                        {page} / {totalPages}
                                      </div>
            
                                      <Button
                                        type="button"
                                        variant="outline"
                                        disabled={page >= totalPages}
                                        onClick={() => setProductPage((p) => Math.min(totalPages, p + 1))}
                                      >
                                        Siguiente
                                      </Button>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </DialogContent>
                        </Dialog>
                      </>
                    );
                  })()
                )}
              </CardContent>
            </Card>
            
            
                        {/* Tabla de Ventas por Cliente */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold text-foreground">
                      {metricLabel} por Cliente
                    </CardTitle>
                    <CardDescription>
                      Ranking de {metricType === "descuentos" ? "clientes con más descuentos" : "mejores clientes"}
                    </CardDescription>
                  </div>
            
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setClientSort((s) => (s === "desc" ? "asc" : "desc"))}
                      className="rounded-full border bg-background/60 px-3 py-1 text-xs text-foreground hover:bg-background"
                    >
                      Orden: {clientSort === "desc" ? "Mayor → Menor" : "Menor → Mayor"}
                    </button>
            
                    <button
                      type="button"
                      onClick={() => {
                        setClientSearch("");
                        setClientPage(1);
                        setOpenClientsModal(true);
                      }}
                      className="rounded-full border bg-background/60 px-3 py-1 text-xs text-foreground hover:bg-background"
                    >
                      Ver todos
                    </button>
                  </div>
                </div>
              </CardHeader>
            
              <CardContent>
                {loadingTransacciones ? (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">Cargando datos...</div>
                ) : !hayDatosDisponibles() ? (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">No hay datos para mostrar</div>
                ) : (
                  (() => {
                    if (tipoIngresoAnalisis === "otros" && metricType === "descuentos") {
                      return (
                        <div className="h-72 flex items-center justify-center text-muted-foreground">
                          No hay descuentos en otros ingresos
                        </div>
                      );
                    }
            
                    const safeStr = (v: any) => String(v ?? "").trim();
            
                    // ✅ Total canónico para % (cuadra con resumen)
                    const totalCanonicoClientes =
                      tipoIngresoAnalisis === "ventas"
                        ? metricType === "brutas"
                          ? Number(datosAnaliticas.ventasBrutas || 0)
                          : metricType === "descuentos"
                          ? Number(datosAnaliticas.descuentos || 0)
                          : Number(datosAnaliticas.ventasNetas || 0)
                        : Number(datosAnaliticas.otrosIngresos || 0);
            
                    type Row = {
                      nombre: string;
                      transacciones: number;
                      monto: number;
                      email?: string;
                      telefono?: string;
                    };
            
                    const getClienteNombre = (t: any) => {
                      const direct =
                        t?.cliente_nombre ??
                        t?.clienteNombre ??
                        t?.cliente_name ??
                        t?.cliente ??
                        t?.customer_name ??
                        null;
            
                      const nested =
                        t?.cliente?.nombre ??
                        t?.cliente?.name ??
                        null;
            
                      const name = safeStr(direct) || safeStr(nested);
                      return name || "Sin cliente asignado";
                    };
            
                    const getClienteEmail = (t: any) =>
                      safeStr(t?.cliente_email ?? t?.clienteEmail ?? t?.cliente?.email) || undefined;
            
                    const getClienteTelefono = (t: any) =>
                      safeStr(t?.cliente_telefono ?? t?.clienteTelefono ?? t?.cliente?.telefono ?? t?.cliente?.phone) || undefined;
            
                    const map = new Map<string, Row>();
            
                    const addRow = (nombre: string, addMonto: number, addTx: number, email?: string, telefono?: string) => {
                      const key = safeStr(nombre) || "Sin cliente asignado";
                      const prev = map.get(key);
                      if (prev) {
                        prev.monto += Number(addMonto) || 0;
                        prev.transacciones += Number(addTx) || 0;
                        prev.email = prev.email || email;
                        prev.telefono = prev.telefono || telefono;
                      } else {
                        map.set(key, {
                          nombre: key,
                          monto: Number(addMonto) || 0,
                          transacciones: Number(addTx) || 0,
                          email,
                          telefono,
                        });
                      }
                    };
            
                    // 1) Base desde transacciones filtradas
                    (filteredTransactions || []).forEach((t: any) => {
                      const nombre = getClienteNombre(t);
                      const email = getClienteEmail(t);
                      const telefono = getClienteTelefono(t);
                      const montoTx = Number(getMetricValue(t, metricType)) || 0;
            
                      addRow(nombre, montoTx, 1, email, telefono);
                    });
            
                    // 2) Si es “otros”, sumar diferencia desde asientos directos a “Sin cliente asignado”
                    if (tipoIngresoAnalisis === "otros") {
                      const sumFromTx = Array.from(map.values()).reduce((s, r) => s + (Number(r.monto) || 0), 0);
                      const diff = (Number(totalCanonicoClientes) || 0) - sumFromTx;
            
                      if (diff > 0.01) {
                        addRow("Sin cliente asignado", diff, Math.max(1, (asientosDir || []).length));
                      }
                    }
            
                    // 3) Array final + orden
                    const allRows = Array.from(map.values())
                      .filter((r) => (Number(r.monto) || 0) > 0)
                      .sort((a, b) =>
                        clientSort === "desc"
                          ? (b.monto || 0) - (a.monto || 0)
                          : (a.monto || 0) - (b.monto || 0)
                      );
            
                    const totalForPct =
                      (Number(totalCanonicoClientes) || 0) > 0
                        ? Number(totalCanonicoClientes)
                        : allRows.reduce((s, r) => s + (Number(r.monto) || 0), 0);
            
                    if (allRows.length === 0) {
                      return (
                        <div className="h-72 flex items-center justify-center text-muted-foreground">
                          No hay clientes para mostrar en este período.
                        </div>
                      );
                    }
            
                    // 4) Top 10 + “Otros clientes” (posición 11)
                    const top10 = allRows.slice(0, 10);
                    const rest = allRows.slice(10);
            
                    const otros = rest.reduce(
                      (acc, r) => {
                        acc.monto += Number(r.monto) || 0;
                        acc.transacciones += Number(r.transacciones) || 0;
                        return acc;
                      },
                      { nombre: "Otros clientes", monto: 0, transacciones: 0 } as Row
                    );
            
                    const list = otros.monto > 0 ? [...top10, otros] : top10;
            
                    const pctOf = (m: number) => (totalForPct > 0 ? ((Number(m) || 0) / totalForPct) * 100 : 0);
            
                    const RowItem = (c: Row & { pct: number }) => {
                      const isOtrosRow = c.nombre === "Otros clientes";
                      const isSinAsignar = c.nombre === "Sin cliente asignado";
            
                      return (
                        <div
                          className={[
                            "flex items-center gap-3 p-3 rounded-lg border",
                            isOtrosRow ? "border-primary/40 bg-primary/5" : "",
                            isSinAsignar && !isOtrosRow ? "border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20" : "",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                              isSinAsignar ? "bg-amber-100 dark:bg-amber-900/30" : "bg-primary/10",
                            ].join(" ")}
                          >
                            <Users className={isSinAsignar ? "w-6 h-6 text-amber-600 dark:text-amber-400" : "w-6 h-6 text-primary"} />
                          </div>
            
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="font-medium truncate">{c.nombre}</p>
                              {isSinAsignar && !isOtrosRow ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 flex-shrink-0">
                                  Sin asignar
                                </span>
                              ) : null}
                            </div>
            
                            <div className="text-sm text-muted-foreground space-y-0.5">
                              <p>
                                {c.transacciones} {c.transacciones === 1 ? "compra" : "compras"}
                              </p>
                              {c.telefono ? <p className="text-xs">{c.telefono}</p> : null}
                              {c.email ? <p className="text-xs truncate">{c.email}</p> : null}
                            </div>
                          </div>
            
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-foreground">
                              ${formatCifra(Number(c.monto) || 0, scaleFormat)}
                            </p>
                          </div>
            
                          <div className="flex-shrink-0">
                            <div className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-semibold">
                              {c.pct.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      );
                    };
            
                    // Total general
                    const totalGeneralMonto = allRows.reduce((s, r) => s + (Number(r.monto) || 0), 0);
                    const totalGeneralTx = allRows.reduce((s, r) => s + (Number(r.transacciones) || 0), 0);
            
                    return (
                      <>
                        <div className="space-y-3">
                          {list.map((c) => (
                            <RowItem key={c.nombre} {...c} pct={pctOf(c.monto)} />
                          ))}
            
                          <div className="flex items-center gap-3 p-3 border-2 border-primary rounded-lg bg-primary/5">
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                              <Users className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-foreground">TOTAL GENERAL</p>
                              <p className="text-sm text-muted-foreground">{totalGeneralTx} transacciones</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-lg text-primary">
                                ${formatCifra(totalGeneralMonto, scaleFormat)}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <div className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm font-bold">
                                100%
                              </div>
                            </div>
                          </div>
                        </div>
            
                        {/* ============================
                            Modal: Ver todos
                           ============================ */}
                        <Dialog
                          open={openClientsModal}
                          onOpenChange={(v) => {
                            setOpenClientsModal(v);
                            if (!v) {
                              setClientSearch("");
                              setClientPage(1);
                            }
                          }}
                        >
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>Clientes</DialogTitle>
                              <DialogDescription>Lista completa para análisis detallado</DialogDescription>
                            </DialogHeader>
            
                            <div className="flex flex-col md:flex-row md:items-center gap-2">
                              <Input
                                value={clientSearch}
                                onChange={(e) => {
                                  setClientSearch(e.target.value);
                                  setClientPage(1);
                                }}
                                placeholder="Buscar cliente..."
                              />
            
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setClientSort((s) => (s === "desc" ? "asc" : "desc"))}
                              >
                                Orden: {clientSort === "desc" ? "Mayor → Menor" : "Menor → Mayor"}
                              </Button>
                            </div>
            
                            {(() => {
                              const q = safeStr(clientSearch).toLowerCase();
            
                              const filtered = q
                                ? allRows.filter((r) => safeStr(r.nombre).toLowerCase().includes(q))
                                : allRows;
            
                              const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_CLIENTS));
                              const page = Math.min(clientPage, totalPages);
                              const start = (page - 1) * PAGE_SIZE_CLIENTS;
                              const chunk = filtered.slice(start, start + PAGE_SIZE_CLIENTS);
            
                              return (
                                <>
                                  <div className="mt-3 max-h-[55vh] overflow-auto pr-1 space-y-2">
                                    {chunk.map((c) => (
                                      <RowItem key={`modal-${c.nombre}`} {...c} pct={pctOf(c.monto)} />
                                    ))}
                                  </div>
            
                                  <div className="mt-4 flex items-center justify-between">
                                    <div className="text-xs text-muted-foreground">
                                      Mostrando {start + 1}-{Math.min(start + PAGE_SIZE_CLIENTS, filtered.length)} de{" "}
                                      {filtered.length}
                                    </div>
            
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        disabled={page <= 1}
                                        onClick={() => setClientPage((p) => Math.max(1, p - 1))}
                                      >
                                        Anterior
                                      </Button>
            
                                      <div className="text-sm">
                                        {page} / {totalPages}
                                      </div>
            
                                      <Button
                                        type="button"
                                        variant="outline"
                                        disabled={page >= totalPages}
                                        onClick={() => setClientPage((p) => Math.min(totalPages, p + 1))}
                                      >
                                        Siguiente
                                      </Button>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </DialogContent>
                        </Dialog>
                      </>
                    );
                  })()
                )}
              </CardContent>
             </Card>
                      </div>
                    </div>
                  </>
                );
              })()}
    </>
  );
}