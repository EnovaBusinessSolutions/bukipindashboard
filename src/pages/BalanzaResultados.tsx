// bukipin-dashboard/src/pages/BalanzaResultados.tsx
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  CalendarIcon,
  ChevronRight,
  Filter,
  AlertTriangle,
  Info,
  BookOpen,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addMonths,
  subDays,
  differenceInCalendarDays,
} from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { useCuentas } from "@/hooks/useCuentas";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface BalanzaEntry {
  fecha: string;
  tipo: string;
  descripcion: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: number;
  haber: number;
  referencia: string;
  esCuentaFiltrada?: boolean;
}

interface AsientoAgrupado {
  referencia: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  movimientos: BalanzaEntry[];
  totalDebe: number;
  totalHaber: number;
  categoriaFlujo?: string;
  efectoNetoCuentaFiltrada?: {
    debe: number;
    haber: number;
    neto: number;
    esAumento: boolean;
    codigoCuenta?: string;
  };
}

type CuentaFlat = {
  codigo: string;
  nombre: string;
  estado_financiero?: string | null;
};

type CuentaInfo = {
  nombre: string;
  estado_financiero?: string | null;
};

const PAGE_SIZE = 25;

// Parser robusto: intenta dd/MM/yyyy, yyyy-MM-dd y Date nativo
function parseFechaFlexible(fecha: string): Date | null {
  if (!fecha) return null;

  // dd/MM/yyyy
  if (fecha.includes("/")) {
    const parts = fecha.split("/");
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      const d = Number(dd);
      const m = Number(mm);
      const y = Number(yyyy);
      if (Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y)) {
        const dt = new Date(y, m - 1, d);
        if (!Number.isNaN(dt.getTime())) return dt;
      }
    }
  }

  // yyyy-MM-dd
  if (fecha.includes("-")) {
    const dt = new Date(fecha);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  // fallback
  const dt = new Date(fecha);
  if (!Number.isNaN(dt.getTime())) return dt;

  return null;
}

export default function BalanzaResultados() {
  // =========================
  // ✅ ESTADO (SOLO RESULTADOS)
  // =========================
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [filtroBusqueda, setFiltroBusqueda] = useState<string>("");

  type DateMode = "day" | "month" | "year" | "range";
  type MonthMode = "isolated" | "accumulated";
  type AgrupadorER = "ingresos" | "egresos";

  const [dateModeER, setDateModeER] = useState<DateMode>("month");
  const [monthModeER, setMonthModeER] = useState<MonthMode>("isolated");
  const [dayER, setDayER] = useState<Date | undefined>(new Date());

  const [monthER, setMonthER] = useState<Date>(() => startOfMonth(new Date())); // aislado
  const [monthFromER, setMonthFromER] = useState<Date>(() => startOfMonth(new Date())); // acumulado
  const [monthToER, setMonthToER] = useState<Date>(() => startOfMonth(new Date()));
  const [yearER, setYearER] = useState<number>(new Date().getFullYear());

  const [rangeER, setRangeER] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const [agrupadorER, setAgrupadorER] = useState<AgrupadorER>("ingresos");
  const [subAgrupadorER, setSubAgrupadorER] = useState<string>("todos"); // grupo ER
  const [cuentaER, setCuentaER] = useState<string>("todos");

  // Educación
  const [showTips, setShowTips] = useState<boolean>(true);

  // Lista / tabla
  const [asientosOpen, setAsientosOpen] = useState<boolean>(false); // colapsado por default
  const [page, setPage] = useState<number>(1);

  // Modal asiento completo
  const [asientoModalOpen, setAsientoModalOpen] = useState(false);
  const [asientoModalRef, setAsientoModalRef] = useState<string | null>(null);

  // =========================
  // ✅ HELPERS
  // =========================
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

  const getNaturaleza = (codigoCuenta?: string) => {
    const d = (codigoCuenta || "").charAt(0);
    if (!d) return "—";
    return ["1", "5", "6"].includes(d) ? "Deudora" : ["2", "3", "4"].includes(d) ? "Acreedora" : "—";
  };

  const getTipoERByCodigo = (codigo?: string): AgrupadorER | null => {
    const d = String(codigo || "").charAt(0);
    if (d === "4") return "ingresos";
    if (d === "5" || d === "6") return "egresos";
    return null;
  };

  // Opciones Mes/Año
  const monthOptions = useMemo(() => {
    const base = new Date(2020, 0, 1);
    const list: { label: string; value: string; date: Date }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), i, 1);
      list.push({
        label: format(d, "LLLL", { locale: es }).replace(/^\w/, (c) => c.toUpperCase()),
        value: String(i + 1).padStart(2, "0"),
        date: d,
      });
    }
    return list;
  }, []);

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const years: number[] = [];
    for (let y = now; y >= now - 10; y--) years.push(y);
    return years;
  }, []);

  const setMonthKeepingYear = (current: Date, monthIndex: number) => {
    const y = current.getFullYear();
    return new Date(y, monthIndex, 1);
  };

  // =========================
  // ✅ DATA FETCH (HOOKS)
  // =========================
  // En Resultados NO ajustamos 10 años; usamos fechas del filtro ER.
  const { data: balanzaData, isLoading } = useAsientosBalanza(startDate, endDate);
  const { data: cuentasData } = useCuentas();

  // Data safe
  const movimientos: BalanzaEntry[] = (balanzaData?.movimientos as BalanzaEntry[]) || [];
  const saldosPorCuenta: Record<string, any> = (balanzaData?.saldosPorCuenta as Record<string, any>) || {};
  const cuentasFlat: CuentaFlat[] = (cuentasData?.cuentasFlat as CuentaFlat[]) || [];
  const estadosFinancieros: any = cuentasData?.estadosFinancieros;

  // Map tipado
  const cuentasInfoMap = useMemo(() => {
    const entries: Array<[string, CuentaInfo]> = (cuentasFlat || []).map((cuenta) => [
      cuenta.codigo,
      { nombre: cuenta.nombre, estado_financiero: cuenta.estado_financiero ?? null },
    ]);
    return new Map<string, CuentaInfo>(entries);
  }, [cuentasFlat]);

  // =========================
  // ✅ EFECTO: aplicar lógica de fechas ER -> startDate/endDate
  // =========================
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const clampRangeToOneYear = (from: Date, to: Date) => {
      const diff = Math.abs(differenceInCalendarDays(to, from));
      if (diff <= 366) return { from, to };
      const toClamped = subDays(addMonths(from, 12), 1);
      return { from, to: toClamped };
    };

    if (dateModeER === "day") {
      const d = dayER ? new Date(dayER) : new Date();
      d.setHours(0, 0, 0, 0);
      setStartDate(d);
      setEndDate(d);
      return;
    }

    if (dateModeER === "month") {
      if (monthModeER === "isolated") {
        const m = monthER ? startOfMonth(monthER) : startOfMonth(new Date());
        const e = endOfMonth(m);
        setStartDate(m);
        setEndDate(e);
        return;
      }

      const fromM = monthFromER ? startOfMonth(monthFromER) : startOfMonth(new Date());
      const toM = monthToER ? endOfMonth(monthToER) : endOfMonth(new Date());
      const fixed = clampRangeToOneYear(fromM, toM);
      setStartDate(startOfMonth(fixed.from));
      setEndDate(endOfMonth(fixed.to));
      return;
    }

    if (dateModeER === "year") {
      const y = Number(yearER || new Date().getFullYear());
      const s = startOfYear(new Date(y, 0, 1));
      const eRaw = endOfYear(new Date(y, 0, 1));
      const e = y === today.getFullYear() ? today : eRaw;
      setStartDate(s);
      setEndDate(e);
      return;
    }

    if (dateModeER === "range") {
      const from = rangeER?.from ? new Date(rangeER.from) : startOfMonth(new Date());
      const to = rangeER?.to ? new Date(rangeER.to) : endOfMonth(new Date());
      const fixed = clampRangeToOneYear(from, to);
      setStartDate(fixed.from);
      setEndDate(fixed.to);

      if (fixed.to.getTime() !== to.getTime() || fixed.from.getTime() !== from.getTime()) {
        setRangeER({ from: fixed.from, to: fixed.to });
      }
      return;
    }
  }, [dateModeER, monthModeER, dayER, monthER, monthFromER, monthToER, yearER, rangeER]);

  // Reset página cuando cambian filtros
  useEffect(() => {
    setPage(1);
  }, [
    filtroBusqueda,
    agrupadorER,
    subAgrupadorER,
    cuentaER,
    dateModeER,
    monthModeER,
    startDate.getTime(),
    endDate.getTime(),
  ]);

  // =========================
  // ✅ OPCIONES ER (Sub-agrupador / Cuentas)
  // =========================
  const erGrupoOptions = useMemo(() => {
    const er = estadosFinancieros?.["Estado de Resultados"];
    if (!er) return [];

    const grupos = Object.keys(er || {});
    const matchesAgrupador = (grupo: string) => {
      const subObj = er?.[grupo] || {};
      const cuentasAll: any[] = Object.values(subObj).flat() as any[];
      const codigos = cuentasAll.map((c) => String(c?.codigo || "")).filter(Boolean);
      if (!codigos.length) return false;
      return codigos.some((codigo) => getTipoERByCodigo(codigo) === agrupadorER);
    };

    return grupos.filter(matchesAgrupador);
  }, [estadosFinancieros, agrupadorER]);

  const erCuentaOptions = useMemo(() => {
    const er = estadosFinancieros?.["Estado de Resultados"];
    if (!er) return [];
    if (subAgrupadorER === "todos") return [];

    const subObj = er?.[subAgrupadorER] || {};
    const cuentasAll: any[] = Object.values(subObj).flat() as any[];

    const rows = cuentasAll
      .map((c) => ({ codigo: String(c?.codigo || ""), nombre: String(c?.nombre || "N/A") }))
      .filter((x) => !!x.codigo)
      .filter((x) => getTipoERByCodigo(x.codigo) === agrupadorER)
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    const seen = new Set<string>();
    return rows.filter((r) => {
      if (seen.has(r.codigo)) return false;
      seen.add(r.codigo);
      return true;
    });
  }, [estadosFinancieros, subAgrupadorER, agrupadorER]);

  const infoFiltroActivoER = subAgrupadorER !== "todos" || cuentaER !== "todos" || !!agrupadorER;

  // =========================
  // ✅ MOVIMIENTOS FILTRADOS (SOLO 4/5/6 + filtros ER)
  // =========================
  let movimientosFiltrados: BalanzaEntry[] = movimientos.filter((mov) =>
    ["4", "5", "6"].includes((mov.cuenta_codigo || "").charAt(0))
  );

  // Agrupador (ingresos/egresos)
  movimientosFiltrados = movimientosFiltrados.filter((mov) => getTipoERByCodigo(mov.cuenta_codigo) === agrupadorER);

  // Sub-agrupador (grupo ER)
  if (subAgrupadorER !== "todos" && estadosFinancieros?.["Estado de Resultados"]?.[subAgrupadorER]) {
    const obj = estadosFinancieros["Estado de Resultados"][subAgrupadorER] || {};
    const cuentasAll: any[] = Object.values(obj).flat() as any[];
    const codigos = new Set(
      cuentasAll
        .map((c) => String(c?.codigo || ""))
        .filter(Boolean)
        .filter((codigo) => getTipoERByCodigo(codigo) === agrupadorER)
    );
    movimientosFiltrados = movimientosFiltrados.filter((mov) => codigos.has(String(mov.cuenta_codigo || "")));
  }

  // Cuenta específica
  if (cuentaER !== "todos") {
    movimientosFiltrados = movimientosFiltrados.filter((mov) => mov.cuenta_codigo === cuentaER);
  }

  // Fechas futuras detectadas
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tieneFechasFuturas = movimientosFiltrados.some((mov) => {
    const fechaMov = parseFechaFlexible(mov.fecha);
    if (!fechaMov) return false;
    const dt = new Date(fechaMov);
    dt.setHours(0, 0, 0, 0);
    return dt > today;
  });

  // =========================
  // ✅ AGRUPAR ASIENTOS (para: cancelación, modal, etc.)
  //    Nota: en Resultados usamos referencias relevantes,
  //    y “marcamos” esCuentaFiltrada solo para los movimientos que coinciden con el filtro actual.
  // =========================
  const asientosAgrupados: Record<string, AsientoAgrupado> = {};

  const referenciasRelevantes = new Set(movimientosFiltrados.map((m) => m.referencia).filter(Boolean));

  referenciasRelevantes.forEach((referencia) => {
    const movimientosCompletos = movimientos.filter((m) => m.referencia === referencia);
    if (!movimientosCompletos.length) return;

    const codigosFiltrados = new Set(
      movimientosFiltrados.filter((m) => m.referencia === referencia).map((m) => m.cuenta_codigo)
    );

    const movimientosFiltradosAsiento = movimientosCompletos.filter((m) => codigosFiltrados.has(m.cuenta_codigo));

    let efectoNetoCuentaFiltrada: AsientoAgrupado["efectoNetoCuentaFiltrada"] = undefined;

    if (movimientosFiltradosAsiento.length > 0) {
      const debeFiltrado = movimientosFiltradosAsiento.reduce((sum, m) => sum + (m.debe || 0), 0);
      const haberFiltrado = movimientosFiltradosAsiento.reduce((sum, m) => sum + (m.haber || 0), 0);

      const primerDigito = (movimientosFiltradosAsiento[0].cuenta_codigo || "").charAt(0);
      const esDeudora = ["1", "5", "6"].includes(primerDigito);
      const efectoNeto = esDeudora ? debeFiltrado - haberFiltrado : haberFiltrado - debeFiltrado;

      efectoNetoCuentaFiltrada = {
        debe: debeFiltrado,
        haber: haberFiltrado,
        neto: efectoNeto,
        esAumento: efectoNeto > 0,
        codigoCuenta: movimientosFiltradosAsiento[0].cuenta_codigo,
      };
    }

    asientosAgrupados[referencia] = {
      referencia,
      fecha: movimientosCompletos[0].fecha,
      tipo: movimientosCompletos[0].tipo,
      descripcion: movimientosCompletos[0].descripcion,
      movimientos: movimientosCompletos.map((mov) => ({
        ...mov,
        esCuentaFiltrada: codigosFiltrados.has(mov.cuenta_codigo),
      })),
      totalDebe: movimientosCompletos.reduce((sum, m) => sum + (m.debe || 0), 0),
      totalHaber: movimientosCompletos.reduce((sum, m) => sum + (m.haber || 0), 0),
      efectoNetoCuentaFiltrada,
    };
  });

  const asientosArray = Object.values(asientosAgrupados);

  // Detectar reversión/cancelación
  const asientosConReversion = asientosArray
    .map((asiento) => {
      const descripcionLower = (asiento.descripcion || "").toLowerCase();
      const esReversion =
        descripcionLower.includes("reversión:") ||
        descripcionLower.includes("reversion:") ||
        descripcionLower.includes("cancelación de egreso:") ||
        descripcionLower.includes("cancelacion de egreso:");

      if (esReversion) return null;

      const asientoReversion = asientosArray.find((a) => {
        const aDescLower = (a.descripcion || "").toLowerCase();
        const esRev =
          aDescLower.includes("reversión:") ||
          aDescLower.includes("reversion:") ||
          aDescLower.includes("cancelación de egreso:") ||
          aDescLower.includes("cancelacion de egreso:");
        if (!esRev) return false;

        const matchOriginal = (asiento.referencia || "").match(/^([A-Z]+)-(.+)$/);
        if (!matchOriginal) return false;
        const idOriginal = matchOriginal[2];
        return (a.referencia || "").includes(idOriginal);
      });

      return {
        ...asiento,
        esCancelado: !!asientoReversion,
        asientoReversion: asientoReversion || null,
      };
    })
    .filter(Boolean) as (AsientoAgrupado & { esCancelado: boolean; asientoReversion: AsientoAgrupado | null })[];

  // Búsqueda global (filtra asientos y afecta la tabla de filas)
  let asientosFiltrados = asientosConReversion;

  if (filtroBusqueda) {
    const busquedaLower = filtroBusqueda.toLowerCase();
    asientosFiltrados = asientosFiltrados.filter(
      (a) =>
        (a.descripcion || "").toLowerCase().includes(busquedaLower) ||
        (a.referencia || "").toLowerCase().includes(busquedaLower) ||
        a.movimientos.some(
          (m) =>
            (m.cuenta_nombre || "").toLowerCase().includes(busquedaLower) ||
            (m.cuenta_codigo || "").toLowerCase().includes(busquedaLower)
        )
    );
  }

  // =========================
  // ✅ F.2 DEFINITIVO: filas por “movimiento afectado”
  //    (si un asiento afecta 2+ cuentas del filtro, aparecen 2+ filas)
  // =========================
  const filasAsientosResultados = useMemo(() => {
    const rows: Array<{
      referencia: string;
      fecha: string;
      tipo: string;
      asientoDescripcion: string;
      mov: BalanzaEntry;
      totalDebe: number;
      totalHaber: number;
      esCancelado?: boolean;
    }> = [];

    for (const asiento of asientosFiltrados) {
      const afectados = (asiento.movimientos || []).filter((m) => m.esCuentaFiltrada);
      if (!afectados.length) continue;

      for (const mov of afectados) {
        rows.push({
          referencia: asiento.referencia,
          fecha: asiento.fecha,
          tipo: asiento.tipo,
          asientoDescripcion: asiento.descripcion,
          mov,
          totalDebe: asiento.totalDebe,
          totalHaber: asiento.totalHaber,
          esCancelado: (asiento as any).esCancelado || false,
        });
      }
    }

    return rows;
  }, [asientosFiltrados]);

  // =========================
  // ✅ SALDOS filtrados (Result. + ER filters)
  // =========================
  let saldosPorCuentaFiltrados: Record<string, any> = saldosPorCuenta;

  // Solo 4/5/6
  const codigosResultados = Object.keys(saldosPorCuenta).filter((codigo) => ["4", "5", "6"].includes(codigo.charAt(0)));
  saldosPorCuentaFiltrados = Object.fromEntries(codigosResultados.map((codigo) => [codigo, saldosPorCuenta[codigo]]));

  // Agrupador
  saldosPorCuentaFiltrados = Object.fromEntries(
    Object.entries(saldosPorCuentaFiltrados).filter(([codigo]) => getTipoERByCodigo(codigo) === agrupadorER)
  );

  // Sub-agrupador
  if (subAgrupadorER !== "todos" && estadosFinancieros?.["Estado de Resultados"]?.[subAgrupadorER]) {
    const obj = estadosFinancieros["Estado de Resultados"][subAgrupadorER] || {};
    const cuentasAll: any[] = Object.values(obj).flat() as any[];
    const codigos = new Set(
      cuentasAll
        .map((c) => String(c?.codigo || ""))
        .filter(Boolean)
        .filter((codigo) => getTipoERByCodigo(codigo) === agrupadorER)
    );

    saldosPorCuentaFiltrados = Object.fromEntries(
      Object.entries(saldosPorCuentaFiltrados).filter(([codigo]) => codigos.has(String(codigo || "")))
    );
  }

  // Cuenta
  if (cuentaER !== "todos") {
    saldosPorCuentaFiltrados = saldosPorCuentaFiltrados[cuentaER]
      ? { [cuentaER]: saldosPorCuentaFiltrados[cuentaER] }
      : {};
  }

  // Totales (basados en saldos filtrados)
  const totalDebe = useMemo(() => {
    return Object.values(saldosPorCuentaFiltrados).reduce((sum, cuenta: any) => sum + (cuenta?.debe_total || 0), 0);
  }, [saldosPorCuentaFiltrados]);

  const totalHaber = useMemo(() => {
    return Object.values(saldosPorCuentaFiltrados).reduce((sum, cuenta: any) => sum + (cuenta?.haber_total || 0), 0);
  }, [saldosPorCuentaFiltrados]);

  const diferencia = Math.abs(totalDebe - totalHaber);
  const cuadra = diferencia < 0.01;

  // =========================
  // ✅ SALDOS UI (Plan de Cuentas estilo desplegable)
  //    Para Resultados mostramos solo “Estado de Resultados”.
  // =========================
  type SaldosCuentaRow = {
    codigo: string;
    nombre: string;
    estado_financiero: "Balance General" | "Estado de Resultados" | "—";
    naturaleza: string;
    debe: number;
    haber: number;
    saldo: number;
  };

  type SaldosNode = {
    key: string;
    label: string;
    level: "estado" | "grupo" | "subgrupo";
    totals: { debe: number; haber: number; saldo: number };
    cuentas: SaldosCuentaRow[];
    children: SaldosNode[];
  };

  const saldosUI = useMemo(() => {
    const saldoMap = new Map<string, any>();

    for (const [k, v] of Object.entries(saldosPorCuentaFiltrados || {})) {
      const codigo = String((v as any)?.cuenta_codigo ?? k ?? "");
      if (!codigo) continue;
      saldoMap.set(codigo, v);
    }

    for (const v of Object.values(saldosPorCuentaFiltrados || {})) {
      const codigo = String((v as any)?.cuenta_codigo ?? "");
      if (!codigo) continue;
      if (!saldoMap.has(codigo)) saldoMap.set(codigo, v);
    }

    const sumRows = (rows: SaldosCuentaRow[]) =>
      rows.reduce(
        (acc, r) => {
          acc.debe += r.debe || 0;
          acc.haber += r.haber || 0;
          acc.saldo += r.saldo || 0;
          return acc;
        },
        { debe: 0, haber: 0, saldo: 0 }
      );

    const buildCuentaRow = (codigo: string, estado_financiero: "Balance General" | "Estado de Resultados" | "—"): SaldosCuentaRow | null => {
      const raw = saldoMap.get(codigo);
      if (!raw) return null;

      const info = cuentasInfoMap.get(codigo);
      const debe = Number(raw?.debe_total || 0);
      const haber = Number(raw?.haber_total || 0);
      const saldo = Number(raw?.saldo || 0);

      return {
        codigo,
        nombre: info?.nombre || "N/A",
        estado_financiero,
        naturaleza: getNaturaleza(codigo),
        debe,
        haber,
        saldo,
      };
    };

    const fallbackFlat: SaldosNode[] = (() => {
      const rows: SaldosCuentaRow[] = Array.from(saldoMap.keys())
        .sort((a, b) => a.localeCompare(b))
        .map((codigo) => {
          const info = cuentasInfoMap.get(codigo);
          const raw = saldoMap.get(codigo);
          const estado = ((info?.estado_financiero as any) || "Estado de Resultados") as any;
          return {
            codigo,
            nombre: info?.nombre || "N/A",
            estado_financiero: estado,
            naturaleza: getNaturaleza(codigo),
            debe: Number(raw?.debe_total || 0),
            haber: Number(raw?.haber_total || 0),
            saldo: Number(raw?.saldo || 0),
          } as SaldosCuentaRow;
        });

      const totals = sumRows(rows);
      return [
        {
          key: "flat",
          label: "Estado de Resultados",
          level: "estado",
          totals,
          cuentas: rows,
          children: [],
        },
      ];
    })();

    if (!estadosFinancieros) return fallbackFlat;

    // Solo “Estado de Resultados”
    const estadoKey: "Estado de Resultados" = "Estado de Resultados";
    const er = estadosFinancieros?.[estadoKey];
    if (!er) return fallbackFlat;

    const nodes: SaldosNode[] = [];

    const grupos = Object.keys(er || {});
    const estadoNode: SaldosNode = {
      key: `estado:${estadoKey}`,
      label: estadoKey,
      level: "estado",
      totals: { debe: 0, haber: 0, saldo: 0 },
      cuentas: [],
      children: [],
    };

    for (const grupo of grupos) {
      const subgruposObj = er?.[grupo] || {};
      const subgrupos = Object.keys(subgruposObj);

      const grupoNode: SaldosNode = {
        key: `grupo:${estadoKey}:${grupo}`,
        label: grupo,
        level: "grupo",
        totals: { debe: 0, haber: 0, saldo: 0 },
        cuentas: [],
        children: [],
      };

      for (const subgrupo of subgrupos) {
        const cuentasArr = (subgruposObj?.[subgrupo] || []) as any[];
        const codigos = cuentasArr.map((c) => String(c?.codigo || "")).filter(Boolean);

        const rows: SaldosCuentaRow[] = codigos
          .map((codigo) => buildCuentaRow(codigo, estadoKey))
          .filter(Boolean) as SaldosCuentaRow[];

        if (!rows.length) continue;

        const subTotals = sumRows(rows);

        grupoNode.children.push({
          key: `subgrupo:${estadoKey}:${grupo}:${subgrupo}`,
          label: subgrupo,
          level: "subgrupo",
          totals: subTotals,
          cuentas: rows.sort((a, b) => a.codigo.localeCompare(b.codigo)),
          children: [],
        });

        grupoNode.totals.debe += subTotals.debe;
        grupoNode.totals.haber += subTotals.haber;
        grupoNode.totals.saldo += subTotals.saldo;
      }

      if (!grupoNode.children.length) continue;

      estadoNode.children.push(grupoNode);
      estadoNode.totals.debe += grupoNode.totals.debe;
      estadoNode.totals.haber += grupoNode.totals.haber;
      estadoNode.totals.saldo += grupoNode.totals.saldo;
    }

    if (!estadoNode.children.length) return fallbackFlat;

    nodes.push(estadoNode);
    return nodes;
  }, [saldosPorCuentaFiltrados, estadosFinancieros, cuentasInfoMap]);

  // =========================
  // ✅ PAGINACIÓN (FILAS RESULTADOS)
  // =========================
  const totalItems = filasAsientosResultados.length;

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const startIdx = (pageSafe - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, totalItems);

  const filasPaginadasResultados = filasAsientosResultados.slice(startIdx, endIdx);

  const pageNumbers = useMemo(() => {
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    pages.add(pageSafe);
    pages.add(pageSafe - 1);
    pages.add(pageSafe + 1);
    pages.add(pageSafe - 2);
    pages.add(pageSafe + 2);

    const list = Array.from(pages).filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

    const withDots: (number | "…")[] = [];
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      const prev = list[i - 1];
      if (i > 0 && prev && cur - prev > 1) withDots.push("…");
      withDots.push(cur);
    }
    return withDots;
  }, [pageSafe, totalPages]);

  // Modal data
  const asientoModalData = useMemo(() => {
    if (!asientoModalRef) return null;
    return asientosConReversion.find((a) => a.referencia === asientoModalRef) || null;
  }, [asientoModalRef, asientosConReversion]);

  // =========================
  // ✅ LOAD STATES
  // =========================
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando resultados…</p>
        </div>
      </div>
    );
  }

  if (!balanzaData) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">No se pudieron cargar los datos del Estado de Resultados</p>
        </CardContent>
      </Card>
    );
  }

  // =========================
  // ✅ UI TEXT
  // =========================
  const tipsTitle = "Cómo interpretar tu Estado de Resultados";
  const tipsBody = [
    "Ingresos (4xxx) normalmente aumentan en Haber.",
    "Costos y gastos (5xxx/6xxx) normalmente aumentan en Debe.",
    "Tip: usa los filtros (Ingresos/Egresos → Sub-agrupador → Cuenta) para detectar fugas y entender tu utilidad.",
  ];

  return (
    <div className="space-y-6">
      {/* Header del panel (este vive dentro del Tab) */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Balanza de Resultados</h2>
          <p className="text-muted-foreground">
            Cuentas de ingresos, costos y gastos del período (4xxx, 5xxx, 6xxx). Ideal para entender tu utilidad.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("px-3 py-1", cuadra ? "border-green-400/60" : "border-red-400/60")}>
            {cuadra ? "✓ Cuadrado" : "✗ Descuadrado"}
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            Rango: {format(startDate, "dd/MM/yyyy")} → {format(endDate, "dd/MM/yyyy")}
          </Badge>
        </div>
      </div>

      {/* Alerta fechas futuras */}
      {tieneFechasFuturas && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-yellow-900 dark:text-yellow-200">Asientos con fechas futuras detectados</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Esto puede ser normal para depreciaciones, provisiones o cierres mensuales programados.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <Collapsible open={showTips} onOpenChange={setShowTips}>
        <Card className="border-muted-foreground/15">
          <CollapsibleTrigger asChild>
            <div className="cursor-pointer">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    {tipsTitle}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Tips rápidos para interpretar ingresos, costos y gastos.
                  </CardDescription>
                </div>

                <Button variant="outline" size="sm" className="shrink-0">
                  {showTips ? "Ocultar tips" : "Ver tips"}
                </Button>
              </CardHeader>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {tipsBody.map((t, i) => (
                  <div key={i} className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">Tip {i + 1}:</span> {t}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border bg-muted/10 p-4">
                <p className="text-sm">
                  <span className="font-semibold">Pro-tip BUKIPIN:</span> En resultados, lo importante es detectar{" "}
                  <span className="font-semibold">qué cuenta exacta</span> está afectando tu utilidad. Por eso aquí verás
                  una tabla por <span className="font-semibold">fila afectada</span> (cuenta específica), no solo “asientos”.
                </p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Resultados
          </CardTitle>
          <CardDescription>
            Filtra por Fecha (Día/Mes/Año/Rango) + Agrupador (Ingresos/Egresos) + Sub-agrupador + Cuenta.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Modo fecha */}
            <div className="lg:col-span-3 space-y-2">
              <Label>Filtro de fecha</Label>
              <Select value={dateModeER} onValueChange={(v) => setDateModeER(v as DateMode)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Día</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="year">Año</SelectItem>
                  <SelectItem value="range">Rango específico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* UI fecha */}
            <div className="lg:col-span-5 space-y-2">
              <Label>Selección</Label>

              {dateModeER === "day" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dayER ? format(dayER, "PPP", { locale: es }) : "Elegir día"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dayER}
                      onSelect={(d) => setDayER(d ?? new Date())}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}

              {dateModeER === "month" && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-5">
                    <Select value={String(monthModeER)} onValueChange={(v) => setMonthModeER(v as MonthMode)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Modo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="isolated">Aislado</SelectItem>
                        <SelectItem value="accumulated">Acumulado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {monthModeER === "isolated" ? (
                    <>
                      <div className="md:col-span-4">
                        <Select
                          value={String(monthER.getMonth() + 1).padStart(2, "0")}
                          onValueChange={(v) => {
                            const mi = Number(v) - 1;
                            setMonthER((cur) => setMonthKeepingYear(cur, mi));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Mes" />
                          </SelectTrigger>
                          <SelectContent>
                            {monthOptions.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3">
                        <Select
                          value={String(monthER.getFullYear())}
                          onValueChange={(v) => {
                            const y = Number(v);
                            setMonthER((cur) => new Date(y, cur.getMonth(), 1));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Año" />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map((y) => (
                              <SelectItem key={y} value={String(y)}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="md:col-span-3">
                        <Select
                          value={String(monthFromER.getMonth() + 1).padStart(2, "0")}
                          onValueChange={(v) => {
                            const mi = Number(v) - 1;
                            setMonthFromER((cur) => setMonthKeepingYear(cur, mi));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Mes inicial" />
                          </SelectTrigger>
                          <SelectContent>
                            {monthOptions.map((m) => (
                              <SelectItem key={`from-${m.value}`} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3">
                        <Select
                          value={String(monthToER.getMonth() + 1).padStart(2, "0")}
                          onValueChange={(v) => {
                            const mi = Number(v) - 1;
                            setMonthToER((cur) => setMonthKeepingYear(cur, mi));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Mes final" />
                          </SelectTrigger>
                          <SelectContent>
                            {monthOptions.map((m) => (
                              <SelectItem key={`to-${m.value}`} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3">
                        <Select
                          value={String(monthFromER.getFullYear())}
                          onValueChange={(v) => {
                            const y = Number(v);
                            setMonthFromER((cur) => new Date(y, cur.getMonth(), 1));
                            setMonthToER((cur) => new Date(y, cur.getMonth(), 1));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Año" />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map((y) => (
                              <SelectItem key={`y-${y}`} value={String(y)}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3 flex items-center">
                        <Badge variant="outline" className="w-full justify-center py-2">
                          Máx. 1 año
                        </Badge>
                      </div>
                    </>
                  )}
                </div>
              )}

              {dateModeER === "year" && (
                <Select value={String(yearER)} onValueChange={(v) => setYearER(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar año" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {dateModeER === "range" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {rangeER?.from && rangeER?.to
                        ? `${format(rangeER.from, "dd/MM/yyyy")} - ${format(rangeER.to, "dd/MM/yyyy")}`
                        : "Elegir rango"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={rangeER}
                      onSelect={(r) => setRangeER(r)}
                      numberOfMonths={2}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Agrupador */}
            <div className="lg:col-span-2 space-y-2">
              <Label>Filtro por Agrupador</Label>
              <Select
                value={agrupadorER}
                onValueChange={(v) => {
                  const next = v as AgrupadorER;
                  setAgrupadorER(next);
                  setSubAgrupadorER("todos");
                  setCuentaER("todos");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingresos">Ingresos</SelectItem>
                  <SelectItem value="egresos">Egresos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sub-agrupador */}
            <div className="lg:col-span-2 space-y-2">
              <Label>Filtro sub agrupador</Label>
              <Select
                value={subAgrupadorER}
                onValueChange={(v) => {
                  setSubAgrupadorER(v);
                  setCuentaER("todos");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {erGrupoOptions.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cuenta */}
            <div className="lg:col-span-3 space-y-2">
              <Label>Filtro cuentas</Label>
              <Select value={cuentaER} onValueChange={setCuentaER} disabled={subAgrupadorER === "todos"}>
                <SelectTrigger>
                  <SelectValue placeholder={subAgrupadorER === "todos" ? "Primero elige sub-agrupador" : "Todas"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {erCuentaOptions.map((c) => (
                    <SelectItem key={c.codigo} value={c.codigo}>
                      {c.codigo} - {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Búsqueda */}
            <div className="lg:col-span-12 space-y-2">
              <Label>Búsqueda</Label>
              <Input
                placeholder="Buscar por referencia, descripción o cuenta…"
                value={filtroBusqueda}
                onChange={(e) => setFiltroBusqueda(e.target.value)}
              />
            </div>
          </div>

          {infoFiltroActivoER && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl">
              <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-700 dark:text-blue-300 flex-1">
                Filtros activos:{" "}
                <span className="font-semibold">
                  {agrupadorER === "ingresos" ? "Ingresos" : "Egresos"}
                  {subAgrupadorER !== "todos" ? ` > ${subAgrupadorER}` : ""}
                  {cuentaER !== "todos" ? ` > ${cuentaER}` : ""}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAgrupadorER("ingresos");
                  setSubAgrupadorER("todos");
                  setCuentaER("todos");
                }}
                className="h-7 text-xs"
              >
                Limpiar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Resultados: TABLA de filas afectadas (F.2) */}
      <Collapsible open={asientosOpen} onOpenChange={setAsientosOpen}>
        <Card className="border-muted-foreground/15">
          <CollapsibleTrigger asChild>
            <div className="cursor-pointer select-none">
              <CardHeader className="space-y-2 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <ChevronRight className={cn("h-4 w-4 transition-transform", asientosOpen ? "rotate-90" : "rotate-0")} />
                      Resultados (filas afectadas)
                    </CardTitle>
                    <CardDescription>
                      {asientosOpen ? (
                        <>
                          Mostrando <span className="font-semibold">{totalItems ? startIdx + 1 : 0}</span>–
                          <span className="font-semibold">{endIdx}</span> de{" "}
                          <span className="font-semibold">{totalItems}</span> (25 por página)
                        </>
                      ) : (
                        <>
                          Click para ver la tabla · <span className="font-semibold">{totalItems}</span> filas afectadas (25 por página)
                        </>
                      )}
                    </CardDescription>
                  </div>

                  {asientosOpen && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPage(1);
                        }}
                        disabled={pageSafe === 1}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPage((p) => Math.max(1, p - 1));
                        }}
                        disabled={pageSafe === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <div className="flex items-center gap-1">
                        {pageNumbers.map((n, idx) =>
                          n === "…" ? (
                            <span key={`dots-${idx}`} className="px-2 text-muted-foreground">
                              …
                            </span>
                          ) : (
                            <Button
                              key={n}
                              variant={n === pageSafe ? "default" : "outline"}
                              size="sm"
                              className="h-8 px-3"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPage(n);
                              }}
                            >
                              {n}
                            </Button>
                          )
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPage((p) => Math.min(totalPages, p + 1));
                        }}
                        disabled={pageSafe === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPage(totalPages);
                        }}
                        disabled={pageSafe === totalPages}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent>
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Referencia</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cuenta afectada</TableHead>
                      <TableHead className="text-right">Debe</TableHead>
                      <TableHead className="text-right">Haber</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filasPaginadasResultados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          No hay filas afectadas con los filtros actuales.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filasPaginadasResultados.map((row, idx) => {
                        const cuentaLabel = `${row.mov.cuenta_codigo} - ${row.mov.cuenta_nombre}`;
                        const debe = Number(row.mov.debe || 0);
                        const haber = Number(row.mov.haber || 0);

                        return (
                          <TableRow
                            key={`${row.referencia}-${row.mov.cuenta_codigo}-${idx}`}
                            className={cn("hover:bg-muted/20", row.esCancelado ? "bg-red-50 dark:bg-red-950/20" : "")}
                          >
                            <TableCell className="font-mono text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{row.referencia}</span>
                                {row.esCancelado && (
                                  <Badge className="bg-red-600 hover:bg-red-600 text-white">CANCELADO</Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 truncate">
                                {row.asientoDescripcion}
                              </div>
                            </TableCell>

                            <TableCell className="text-sm">{row.fecha}</TableCell>
                            <TableCell className="text-sm">{row.tipo}</TableCell>

                            <TableCell className="text-sm">
                              <span className="font-mono text-xs">{row.mov.cuenta_codigo}</span>
                              <div className="text-xs text-muted-foreground truncate">{row.mov.cuenta_nombre}</div>
                            </TableCell>

                            <TableCell className="text-right">
                              {debe > 0 ? (
                                <span className="text-green-600 font-medium">{formatCurrency(debe)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              {haber > 0 ? (
                                <span className="text-red-600 font-medium">{formatCurrency(haber)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setAsientoModalRef(row.referencia);
                                  setAsientoModalOpen(true);
                                }}
                              >
                                Ver asiento
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Footer paginación */}
              {totalItems > PAGE_SIZE && (
                <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    Página <span className="font-semibold">{pageSafe}</span> de{" "}
                    <span className="font-semibold">{totalPages}</span>
                  </p>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={pageSafe === 1}>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>

                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe === 1}>
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={pageSafe === totalPages}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>

                    <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={pageSafe === totalPages}>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Modal asiento completo */}
      <Dialog open={asientoModalOpen} onOpenChange={setAsientoModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Asiento {asientoModalData?.referencia || ""}</DialogTitle>
            <DialogDescription>{asientoModalData?.descripcion || "Detalle completo del asiento contable."}</DialogDescription>
          </DialogHeader>

          {!asientoModalData ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No se pudo cargar el asiento.</div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{asientoModalData.fecha}</span>
                <span className="opacity-50"> • </span>
                <span>{asientoModalData.tipo}</span>
              </div>

              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Debe</TableHead>
                      <TableHead className="text-right">Haber</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {asientoModalData.movimientos.map((mov, idx) => (
                      <TableRow
                        key={idx}
                        className={cn("hover:bg-muted/30", mov.esCuentaFiltrada ? "bg-blue-50 dark:bg-blue-950/30" : "")}
                      >
                        <TableCell>
                          <div className="flex items-start gap-2">
                            {mov.esCuentaFiltrada && <span className="mt-1 text-blue-600 dark:text-blue-400 font-bold">●</span>}
                            <div className="min-w-0">
                              <p className="font-mono text-sm">{mov.cuenta_codigo}</p>
                              <p className="text-xs text-muted-foreground truncate">{mov.cuenta_nombre}</p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-sm">{mov.descripcion}</TableCell>

                        <TableCell className="text-right">
                          {mov.debe > 0 ? (
                            <span className="text-green-600 font-medium">{formatCurrency(mov.debe)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          {mov.haber > 0 ? (
                            <span className="text-red-600 font-medium">{formatCurrency(mov.haber)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}

                    <TableRow className="font-bold bg-muted/40">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(asientoModalData.totalDebe)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(asientoModalData.totalHaber)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {asientoModalData.movimientos.some((m) => m.esCuentaFiltrada) && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">●</span>
                    Filas resaltadas = cuentas que coinciden con tu filtro actual.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Saldos por Cuenta */}
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Saldos por Cuenta</CardTitle>
          <CardDescription>
            Vista desplegable por Grupo → Subgrupo → Cuenta, con Debe/Haber acumulado y saldo neto. Útil para validar tu ER.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/30 px-4 py-3">
              <div className="grid grid-cols-12 gap-3 text-xs font-medium text-muted-foreground">
                <div className="col-span-5">Cuenta</div>
                <div className="col-span-2">Naturaleza</div>
                <div className="col-span-2 text-right">Total Debe</div>
                <div className="col-span-2 text-right">Total Haber</div>
                <div className="col-span-1 text-right">Saldo</div>
              </div>
            </div>

            <div className="divide-y">
              {saldosUI.map((estadoNode) => (
                <Collapsible key={estadoNode.key} defaultOpen>
                  <CollapsibleTrigger asChild>
                    <button className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors group">
                      <div className="grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-5 flex items-center gap-2 min-w-0">
                          <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                          <span className="font-semibold truncate">{estadoNode.label}</span>
                          <Badge variant="outline" className="ml-2 hidden sm:inline-flex">Resultados</Badge>
                        </div>

                        <div className="col-span-2">
                          <Badge variant="secondary" className="px-2 py-1">—</Badge>
                        </div>

                        <div className="col-span-2 text-right font-semibold text-green-600">{formatCurrency(estadoNode.totals.debe)}</div>
                        <div className="col-span-2 text-right font-semibold text-red-600">{formatCurrency(estadoNode.totals.haber)}</div>
                        <div className="col-span-1 text-right font-semibold">{formatCurrency(estadoNode.totals.saldo)}</div>
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="bg-background">
                      {estadoNode.children.map((grupoNode) => (
                        <Collapsible key={grupoNode.key}>
                          <CollapsibleTrigger asChild>
                            <button className="w-full text-left px-4 py-3 pl-8 hover:bg-muted/20 transition-colors group">
                              <div className="grid grid-cols-12 gap-3 items-center">
                                <div className="col-span-5 flex items-center gap-2 min-w-0">
                                  <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                                  <span className="font-medium truncate">{grupoNode.label}</span>
                                </div>

                                <div className="col-span-2">
                                  <Badge variant="secondary" className="px-2 py-1">—</Badge>
                                </div>

                                <div className="col-span-2 text-right text-green-600 font-medium">{formatCurrency(grupoNode.totals.debe)}</div>
                                <div className="col-span-2 text-right text-red-600 font-medium">{formatCurrency(grupoNode.totals.haber)}</div>
                                <div className="col-span-1 text-right font-medium">{formatCurrency(grupoNode.totals.saldo)}</div>
                              </div>
                            </button>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="bg-background">
                              {grupoNode.children.map((subNode) => (
                                <Collapsible key={subNode.key}>
                                  <CollapsibleTrigger asChild>
                                    <button className="w-full text-left px-4 py-3 pl-12 hover:bg-muted/10 transition-colors group">
                                      <div className="grid grid-cols-12 gap-3 items-center">
                                        <div className="col-span-5 flex items-center gap-2 min-w-0">
                                          <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                                          <span className="truncate text-sm">{subNode.label}</span>
                                          <Badge variant="outline" className="ml-2 hidden md:inline-flex">{subNode.cuentas.length} cuentas</Badge>
                                        </div>

                                        <div className="col-span-2">
                                          <Badge variant="secondary" className="px-2 py-1">—</Badge>
                                        </div>

                                        <div className="col-span-2 text-right text-green-600 text-sm font-medium">{formatCurrency(subNode.totals.debe)}</div>
                                        <div className="col-span-2 text-right text-red-600 text-sm font-medium">{formatCurrency(subNode.totals.haber)}</div>
                                        <div className="col-span-1 text-right text-sm font-medium">{formatCurrency(subNode.totals.saldo)}</div>
                                      </div>
                                    </button>
                                  </CollapsibleTrigger>

                                  <CollapsibleContent>
                                    <div className="px-4 pb-4 pl-16">
                                      <div className="rounded-xl border overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-muted/30">
                                              <TableHead>Código</TableHead>
                                              <TableHead>Nombre</TableHead>
                                              <TableHead>Naturaleza</TableHead>
                                              <TableHead className="text-right">Debe</TableHead>
                                              <TableHead className="text-right">Haber</TableHead>
                                              <TableHead className="text-right">Saldo</TableHead>
                                            </TableRow>
                                          </TableHeader>

                                          <TableBody>
                                            {subNode.cuentas.map((c) => (
                                              <TableRow key={c.codigo} className="hover:bg-muted/20">
                                                <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                                                <TableCell className="text-sm">
                                                  {c.nombre}
                                                  <div className="text-xs text-muted-foreground mt-0.5">
                                                    {c.codigo.startsWith("4")
                                                      ? "Ingreso"
                                                      : c.codigo.startsWith("5")
                                                      ? "Costo"
                                                      : c.codigo.startsWith("6")
                                                      ? "Gasto"
                                                      : "—"}
                                                  </div>
                                                </TableCell>

                                                <TableCell className="text-xs">
                                                  <Badge variant="secondary" className="px-2 py-1">{c.naturaleza}</Badge>
                                                </TableCell>

                                                <TableCell className="text-right text-green-600">{formatCurrency(c.debe)}</TableCell>
                                                <TableCell className="text-right text-red-600">{formatCurrency(c.haber)}</TableCell>
                                                <TableCell className="text-right font-semibold">{formatCurrency(c.saldo)}</TableCell>
                                              </TableRow>
                                            ))}

                                            <TableRow className="font-bold bg-muted/40">
                                              <TableCell colSpan={3}>Subtotal</TableCell>
                                              <TableCell className="text-right text-green-600">{formatCurrency(subNode.totals.debe)}</TableCell>
                                              <TableCell className="text-right text-red-600">{formatCurrency(subNode.totals.haber)}</TableCell>
                                              <TableCell className="text-right">{formatCurrency(subNode.totals.saldo)}</TableCell>
                                            </TableRow>
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>

            <div className="bg-muted/40 px-4 py-3">
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-7 font-bold">TOTALES</div>
                <div className="col-span-2 text-right font-bold text-green-600">{formatCurrency(totalDebe)}</div>
                <div className="col-span-2 text-right font-bold text-red-600">{formatCurrency(totalHaber)}</div>
                <div className="col-span-1 text-right font-bold">{formatCurrency(Math.abs(totalDebe - totalHaber))}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/10 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Checklist rápido:</span> 1) Filtra Ingresos/Egresos,
              2) Encuentra las cuentas con mayor movimiento, 3) Abre el asiento (“Ver asiento”) para validar lógica y evidencia.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
