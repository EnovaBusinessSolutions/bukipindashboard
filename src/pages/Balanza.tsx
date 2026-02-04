// bukipin-dashboard/src/pages/Balanza.tsx
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { useCuentas } from "@/hooks/useCuentas";
import { Badge } from "@/components/ui/badge";

interface BalanzaEntry {
  fecha: string; // normalmente "dd/MM/yyyy" (pero lo hacemos robusto)
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

const Balanza = () => {
  const [pestanaActiva, setPestanaActiva] = useState<string>("todos");
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroEstadoFinanciero, setFiltroEstadoFinanciero] = useState<string>("todos");
  const [filtroBusqueda, setFiltroBusqueda] = useState<string>("");

  // Filtros jerárquicos
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<string>("todos");
  const [subgrupoSeleccionado, setSubgrupoSeleccionado] = useState<string>("todos");
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>("todos");

  // Educación / Tips
  const [showTips, setShowTips] = useState<boolean>(true);

  // Dropdown Asientos
  const [asientosOpen, setAsientosOpen] = useState<boolean>(false); // inicia colapsado

  // Paginación
  const [page, setPage] = useState<number>(1);

  // Para Balanza de Comprobación y Balance General, ajustar startDate a 10 años atrás para acumular todo
  const startDateAjustado = useMemo(() => {
    return pestanaActiva === "balance" || pestanaActiva === "todos"
      ? new Date(endDate.getFullYear() - 10, 0, 1)
      : startDate;
  }, [pestanaActiva, startDate, endDate]);

  // Hook principal
  const { data: balanzaData, isLoading } = useAsientosBalanza(startDateAjustado, endDate);
  const { data: cuentasData } = useCuentas();

  // ✅ IMPORTANTE: NO PONER hooks después de returns tempranos.
  // Por eso todos los useMemo/useEffect van antes de cualquier return.

  // Reset de filtros jerárquicos al cambiar pestaña
  useEffect(() => {
    setGrupoSeleccionado("todos");
    setSubgrupoSeleccionado("todos");
    setCuentaSeleccionada("todos");
    setPage(1);
  }, [pestanaActiva]);

  // Reset de página cuando cambian filtros
  useEffect(() => {
    setPage(1);
  }, [
    filtroTipo,
    filtroEstado,
    filtroEstadoFinanciero,
    filtroBusqueda,
    grupoSeleccionado,
    subgrupoSeleccionado,
    cuentaSeleccionada,
    startDateAjustado.getTime(),
    endDate.getTime(),
  ]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
  };

  const getNaturaleza = (codigoCuenta?: string) => {
    const d = (codigoCuenta || "").charAt(0);
    if (!d) return "—";
    // simplificado: 1,5,6 suelen ser deudoras; 2,3,4 acreedoras
    return ["1", "5", "6"].includes(d) ? "Deudora" : ["2", "3", "4"].includes(d) ? "Acreedora" : "—";
  };

  // Data safe (para que no reviente antes de cargar)
  const movimientos: BalanzaEntry[] = (balanzaData?.movimientos as BalanzaEntry[]) || [];
  const saldosPorCuenta: Record<string, any> = (balanzaData?.saldosPorCuenta as Record<string, any>) || {};

  const cuentasFlat: CuentaFlat[] = (cuentasData?.cuentasFlat as CuentaFlat[]) || [];
  const estadosFinancieros: any = cuentasData?.estadosFinancieros;

  // ✅ Map tipado (se van rojos de nombre/estado_financiero + error new Map)
  const cuentasInfoMap = useMemo(() => {
    const entries: Array<[string, CuentaInfo]> = (cuentasFlat || []).map((cuenta) => [
      cuenta.codigo,
      { nombre: cuenta.nombre, estado_financiero: cuenta.estado_financiero ?? null },
    ]);
    return new Map<string, CuentaInfo>(entries);
  }, [cuentasFlat]);

  // Grupos según pestaña activa
  const gruposDisponibles = useMemo(() => {
    if (!estadosFinancieros) return [];

    const estadoKey =
      pestanaActiva === "balance" ? "Balance General" : pestanaActiva === "resultados" ? "Estado de Resultados" : null;

    if (!estadoKey) {
      const bg = Object.keys(estadosFinancieros["Balance General"] || {});
      const er = Object.keys(estadosFinancieros["Estado de Resultados"] || {});
      return [...bg, ...er].filter((v, i, a) => a.indexOf(v) === i);
    }

    return Object.keys(estadosFinancieros[estadoKey] || {});
  }, [estadosFinancieros, pestanaActiva]);

  const subgruposDisponibles = useMemo(() => {
    if (grupoSeleccionado === "todos" || !estadosFinancieros) return [];

    const estadoKey =
      pestanaActiva === "balance" ? "Balance General" : pestanaActiva === "resultados" ? "Estado de Resultados" : null;

    if (!estadoKey) {
      const subgruposBG = Object.keys(estadosFinancieros["Balance General"]?.[grupoSeleccionado] || {});
      const subgruposER = Object.keys(estadosFinancieros["Estado de Resultados"]?.[grupoSeleccionado] || {});
      return [...subgruposBG, ...subgruposER].filter((v, i, a) => a.indexOf(v) === i);
    }

    return Object.keys(estadosFinancieros[estadoKey]?.[grupoSeleccionado] || {});
  }, [estadosFinancieros, grupoSeleccionado, pestanaActiva]);

  const cuentasDisponibles = useMemo(() => {
    if (subgrupoSeleccionado === "todos" || !estadosFinancieros) return [];

    const estadoKey =
      pestanaActiva === "balance" ? "Balance General" : pestanaActiva === "resultados" ? "Estado de Resultados" : null;

    if (!estadoKey) {
      const cuentasBG = estadosFinancieros["Balance General"]?.[grupoSeleccionado]?.[subgrupoSeleccionado] || [];
      const cuentasER = estadosFinancieros["Estado de Resultados"]?.[grupoSeleccionado]?.[subgrupoSeleccionado] || [];
      return [...cuentasBG, ...cuentasER];
    }

    return estadosFinancieros[estadoKey]?.[grupoSeleccionado]?.[subgrupoSeleccionado] || [];
  }, [estadosFinancieros, grupoSeleccionado, subgrupoSeleccionado, pestanaActiva]);

  // Filtrar movimientos por pestaña
  let movimientosFiltrados: BalanzaEntry[] = movimientos;

  if (pestanaActiva === "resultados") {
    movimientosFiltrados = movimientos.filter((mov) => ["4", "5", "6"].includes((mov.cuenta_codigo || "").charAt(0)));
  } else if (pestanaActiva === "balance") {
    movimientosFiltrados = movimientos.filter((mov) => ["1", "2", "3"].includes((mov.cuenta_codigo || "").charAt(0)));
  }

  // Aplicar filtros jerárquicos (movimientos)
  if (cuentaSeleccionada !== "todos") {
    movimientosFiltrados = movimientosFiltrados.filter((mov) => mov.cuenta_codigo === cuentaSeleccionada);
  } else if (subgrupoSeleccionado !== "todos" && cuentasDisponibles.length > 0) {
    const codigosCuentas = (cuentasDisponibles as any[]).map((c: any) => c.codigo);
    movimientosFiltrados = movimientosFiltrados.filter((mov) => codigosCuentas.includes(mov.cuenta_codigo));
  } else if (grupoSeleccionado !== "todos" && estadosFinancieros) {
    const estadoKey =
      pestanaActiva === "balance" ? "Balance General" : pestanaActiva === "resultados" ? "Estado de Resultados" : null;

    if (estadoKey) {
      const todasCuentasGrupo = Object.values(estadosFinancieros[estadoKey]?.[grupoSeleccionado] || {}).flat();
      const codigosCuentas = (todasCuentasGrupo as any[]).map((c: any) => c.codigo);
      movimientosFiltrados = movimientosFiltrados.filter((mov) => codigosCuentas.includes(mov.cuenta_codigo));
    } else {
      const todasCuentasBG = Object.values(estadosFinancieros["Balance General"]?.[grupoSeleccionado] || {}).flat();
      const todasCuentasER = Object.values(estadosFinancieros["Estado de Resultados"]?.[grupoSeleccionado] || {}).flat();
      const codigosCuentas = [...(todasCuentasBG as any[]), ...(todasCuentasER as any[])].map((c: any) => c.codigo);
      movimientosFiltrados = movimientosFiltrados.filter((mov) => codigosCuentas.includes(mov.cuenta_codigo));
    }
  }

  // Filtrar saldos por pestaña
  let saldosPorCuentaFiltrados: Record<string, any> = saldosPorCuenta;

  if (pestanaActiva === "resultados") {
    const codigosResultados = Object.keys(saldosPorCuenta).filter((codigo) => ["4", "5", "6"].includes(codigo.charAt(0)));
    saldosPorCuentaFiltrados = Object.fromEntries(codigosResultados.map((codigo) => [codigo, saldosPorCuenta[codigo]]));
  } else if (pestanaActiva === "balance") {
    const codigosBalance = Object.keys(saldosPorCuenta).filter((codigo) => ["1", "2", "3"].includes(codigo.charAt(0)));
    saldosPorCuentaFiltrados = Object.fromEntries(codigosBalance.map((codigo) => [codigo, saldosPorCuenta[codigo]]));
  }

  // Aplicar filtros jerárquicos a saldos
  if (cuentaSeleccionada !== "todos") {
    const codigo = cuentaSeleccionada;
    saldosPorCuentaFiltrados = saldosPorCuentaFiltrados[codigo] ? { [codigo]: saldosPorCuentaFiltrados[codigo] } : {};
  } else if (subgrupoSeleccionado !== "todos" && cuentasDisponibles.length > 0) {
    const codigosCuentas = (cuentasDisponibles as any[]).map((c: any) => c.codigo);
    saldosPorCuentaFiltrados = Object.fromEntries(
      Object.entries(saldosPorCuentaFiltrados).filter(([codigo]) => codigosCuentas.includes(codigo))
    );
  } else if (grupoSeleccionado !== "todos" && estadosFinancieros) {
    const estadoKey =
      pestanaActiva === "balance" ? "Balance General" : pestanaActiva === "resultados" ? "Estado de Resultados" : null;

    if (estadoKey) {
      const todasCuentasGrupo = Object.values(estadosFinancieros[estadoKey]?.[grupoSeleccionado] || {}).flat();
      const codigosCuentas = (todasCuentasGrupo as any[]).map((c: any) => c.codigo);
      saldosPorCuentaFiltrados = Object.fromEntries(
        Object.entries(saldosPorCuentaFiltrados).filter(([codigo]) => codigosCuentas.includes(codigo))
      );
    } else {
      const todasCuentasBG = Object.values(estadosFinancieros["Balance General"]?.[grupoSeleccionado] || {}).flat();
      const todasCuentasER = Object.values(estadosFinancieros["Estado de Resultados"]?.[grupoSeleccionado] || {}).flat();
      const codigosCuentas = [...(todasCuentasBG as any[]), ...(todasCuentasER as any[])].map((c: any) => c.codigo);
      saldosPorCuentaFiltrados = Object.fromEntries(
        Object.entries(saldosPorCuentaFiltrados).filter(([codigo]) => codigosCuentas.includes(codigo))
      );
    }
  }

  // Fechas futuras
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tieneFechasFuturas = movimientosFiltrados.some((mov) => {
    const fechaMov = parseFechaFlexible(mov.fecha);
    if (!fechaMov) return false;
    const dt = new Date(fechaMov);
    dt.setHours(0, 0, 0, 0);
    return dt > today;
  });

  // Agrupar por asiento (siempre calculado, aunque luego mostremos vacío)
  const asientosAgrupados: Record<string, AsientoAgrupado> = {};

  if (pestanaActiva === "todos") {
    movimientosFiltrados.forEach((mov) => {
      if (!mov.referencia) return;
      if (!asientosAgrupados[mov.referencia]) {
        asientosAgrupados[mov.referencia] = {
          referencia: mov.referencia,
          fecha: mov.fecha,
          tipo: mov.tipo,
          descripcion: mov.descripcion,
          movimientos: [],
          totalDebe: 0,
          totalHaber: 0,
        };
      }
      asientosAgrupados[mov.referencia].movimientos.push(mov);
      asientosAgrupados[mov.referencia].totalDebe += mov.debe || 0;
      asientosAgrupados[mov.referencia].totalHaber += mov.haber || 0;
    });
  } else {
    const referenciasRelevantes = new Set(movimientosFiltrados.map((m) => m.referencia).filter(Boolean));

    referenciasRelevantes.forEach((referencia) => {
      const movimientosCompletos = movimientos.filter((m) => m.referencia === referencia);

      // guard: por si algo llega raro
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
        movimientos: movimientosCompletos.map((mov) => ({ ...mov, esCuentaFiltrada: codigosFiltrados.has(mov.cuenta_codigo) })),
        totalDebe: movimientosCompletos.reduce((sum, m) => sum + (m.debe || 0), 0),
        totalHaber: movimientosCompletos.reduce((sum, m) => sum + (m.haber || 0), 0),
        efectoNetoCuentaFiltrada,
      };
    });
  }

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

  // Filtros globales
  let asientosFiltrados = asientosConReversion;

  if (filtroTipo !== "todos") asientosFiltrados = asientosFiltrados.filter((a) => a.tipo === filtroTipo);

  if (filtroEstado !== "todos") {
    asientosFiltrados = asientosFiltrados.filter((a) => {
      const diferencia = Math.abs((a.totalDebe || 0) - (a.totalHaber || 0));
      if (filtroEstado === "cuadrado") return diferencia < 0.01;
      if (filtroEstado === "descuadrado") return diferencia >= 0.01;
      return true;
    });
  }

  if (filtroEstadoFinanciero !== "todos") {
    asientosFiltrados = asientosFiltrados.filter((a) =>
      a.movimientos.some((mov) => {
        const primerDigito = (mov.cuenta_codigo || "").charAt(0);
        if (filtroEstadoFinanciero === "balance") return ["1", "2", "3"].includes(primerDigito);
        if (filtroEstadoFinanciero === "resultados") return ["4", "5", "6"].includes(primerDigito);
        return true;
      })
    );
  }

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

  const tiposUnicos = useMemo(() => {
    return Array.from(new Set(asientosConReversion.map((a) => a.tipo).filter(Boolean))).sort();
  }, [asientosConReversion]);

  // Totales (basados en saldos filtrados)
  const totalDebe = useMemo(() => {
    return Object.values(saldosPorCuentaFiltrados).reduce((sum, cuenta: any) => sum + (cuenta?.debe_total || 0), 0);
  }, [saldosPorCuentaFiltrados]);

  const totalHaber = useMemo(() => {
    return Object.values(saldosPorCuentaFiltrados).reduce((sum, cuenta: any) => sum + (cuenta?.haber_total || 0), 0);
  }, [saldosPorCuentaFiltrados]);

  const diferencia = Math.abs(totalDebe - totalHaber);
  const cuadra = diferencia < 0.01;

  /* =========================
     ✅ NUEVO: Saldos por Cuenta estilo Plan de Cuentas (desplegable)
     ========================= */

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
    // 1) Normalizar saldosPorCuentaFiltrados a un map por codigo
    const saldoMap = new Map<string, any>();

    // Caso A: viene como Record<codigo, data>
    for (const [k, v] of Object.entries(saldosPorCuentaFiltrados || {})) {
      const codigo = String((v as any)?.cuenta_codigo ?? k ?? "");
      if (!codigo) continue;
      saldoMap.set(codigo, v);
    }

    // Caso B: viene como "valores" con cuenta_codigo
    for (const v of Object.values(saldosPorCuentaFiltrados || {})) {
      const codigo = String((v as any)?.cuenta_codigo ?? "");
      if (!codigo) continue;
      if (!saldoMap.has(codigo)) saldoMap.set(codigo, v);
    }

    const estadoKeys: Array<"Balance General" | "Estado de Resultados"> =
      pestanaActiva === "balance"
        ? ["Balance General"]
        : pestanaActiva === "resultados"
        ? ["Estado de Resultados"]
        : ["Balance General", "Estado de Resultados"];

    const sumRows = (rows: SaldosCuentaRow[]) => {
      return rows.reduce(
        (acc, r) => {
          acc.debe += r.debe || 0;
          acc.haber += r.haber || 0;
          acc.saldo += r.saldo || 0;
          return acc;
        },
        { debe: 0, haber: 0, saldo: 0 }
      );
    };

    const buildCuentaRow = (
      codigo: string,
      estado_financiero: "Balance General" | "Estado de Resultados" | "—"
    ): SaldosCuentaRow | null => {
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

    // Fallback si no hay estadosFinancieros (mostrar plano)
    const fallbackFlat: SaldosNode[] = (() => {
      const rows: SaldosCuentaRow[] = Array.from(saldoMap.keys())
        .sort((a, b) => a.localeCompare(b))
        .map((codigo) => {
          const info = cuentasInfoMap.get(codigo);
          const raw = saldoMap.get(codigo);
          const estado = ((info?.estado_financiero as any) || "—") as any;
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
          label: "Saldos por cuenta",
          level: "estado",
          totals,
          cuentas: rows,
          children: [],
        },
      ];
    })();

    if (!estadosFinancieros) return fallbackFlat;

    // 2) Construir estructura ESTADO -> GRUPO -> SUBGRUPO -> CUENTAS
    const nodes: SaldosNode[] = [];

    for (const estadoKey of estadoKeys) {
      const grupos = Object.keys(estadosFinancieros?.[estadoKey] || {});
      const estadoNode: SaldosNode = {
        key: `estado:${estadoKey}`,
        label: estadoKey,
        level: "estado",
        totals: { debe: 0, haber: 0, saldo: 0 },
        cuentas: [],
        children: [],
      };

      for (const grupo of grupos) {
        const subgruposObj = estadosFinancieros?.[estadoKey]?.[grupo] || {};
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

          // Respetar filtro actual: solo mostrar subgrupo si tiene al menos 1 cuenta en saldos filtrados
          if (!rows.length) continue;

          const subTotals = sumRows(rows);

          const subNode: SaldosNode = {
            key: `subgrupo:${estadoKey}:${grupo}:${subgrupo}`,
            label: subgrupo,
            level: "subgrupo",
            totals: subTotals,
            cuentas: rows.sort((a, b) => a.codigo.localeCompare(b.codigo)),
            children: [],
          };

          grupoNode.children.push(subNode);
          grupoNode.totals.debe += subTotals.debe;
          grupoNode.totals.haber += subTotals.haber;
          grupoNode.totals.saldo += subTotals.saldo;
        }

        // Respetar filtro: solo mostrar grupo si tiene hijos
        if (!grupoNode.children.length) continue;

        estadoNode.children.push(grupoNode);
        estadoNode.totals.debe += grupoNode.totals.debe;
        estadoNode.totals.haber += grupoNode.totals.haber;
        estadoNode.totals.saldo += grupoNode.totals.saldo;
      }

      // Respetar filtro: solo mostrar estado si tiene hijos
      if (!estadoNode.children.length) continue;

      nodes.push(estadoNode);
    }

    if (!nodes.length) return fallbackFlat;

    return nodes;
  }, [saldosPorCuentaFiltrados, estadosFinancieros, pestanaActiva, cuentasInfoMap]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(asientosFiltrados.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const startIdx = (pageSafe - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, asientosFiltrados.length);
  const asientosPaginados = asientosFiltrados.slice(startIdx, endIdx);

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

  const getDescripcionPestana = () => {
    switch (pestanaActiva) {
      case "todos":
        return `Vista completa de todas las cuentas al corte del ${format(endDate, "dd/MM/yyyy")}. Muestra el saldo acumulado desde el inicio de operaciones.`;
      case "resultados":
        return "Cuentas de ingresos, costos y gastos del período (4xxx, 5xxx, 6xxx). Ideal para entender tu utilidad.";
      case "balance":
        return `Cuentas de activos, pasivos y capital al corte de ${format(endDate, "PPP", { locale: es })} (1xxx, 2xxx, 3xxx). Ideal para ver tu posición financiera.`;
      default:
        return "Vista detallada de todos los movimientos contables del periodo.";
    }
  };

  const tipsTitle =
    pestanaActiva === "todos"
      ? "Cómo leer una Balanza de Comprobación"
      : pestanaActiva === "resultados"
      ? "Cómo interpretar tu Estado de Resultados"
      : "Cómo interpretar tu Balance General";

  const tipsBody =
    pestanaActiva === "todos"
      ? [
          "Si Total Debe = Total Haber, la contabilidad está cuadrada (no significa que sea correcta, pero sí consistente).",
          "Cada asiento debe tener el mismo total en Debe y Haber.",
          "Tip: abre un asiento y confirma que las cuentas involucradas tengan sentido (ej. venta: Bancos/Caja vs Ventas).",
        ]
      : pestanaActiva === "resultados"
      ? [
          "Ingresos (4xxx) normalmente aumentan en Haber.",
          "Costos y gastos (5xxx/6xxx) normalmente aumentan en Debe.",
          "Tip: usa los filtros jerárquicos para revisar por grupo → subgrupo → cuenta y detectar fugas de gasto.",
        ]
      : [
          "Activos (1xxx) normalmente aumentan en Debe.",
          "Pasivos (2xxx) y capital (3xxx) normalmente aumentan en Haber.",
          "Tip: revisa Bancos (1002), Caja (1001), CxC (1003) e Inventario (1005) y confirma que reflejen la realidad.",
        ];

  const infoFiltroActivo = grupoSeleccionado !== "todos" || subgrupoSeleccionado !== "todos" || cuentaSeleccionada !== "todos";

  // ✅ AHORA SÍ: returns condicionales DESPUÉS de todos los hooks/memos
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando balanza…</p>
        </div>
      </div>
    );
  }

  if (!balanzaData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">No se pudieron cargar los datos de la balanza</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si no hay movimientos (después de filtros base)
  if (!movimientosFiltrados || movimientosFiltrados.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-1 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Balanza de Comprobación</h1>
          <p className="text-muted-foreground">Vista detallada de todos los movimientos contables del periodo.</p>
        </div>

        <Card>
          <CardContent className="p-12">
            <div className="text-center space-y-2">
              <p className="text-xl font-medium text-muted-foreground">No hay movimientos contables registrados</p>
              <p className="text-sm text-muted-foreground">Comienza registrando transacciones para ver la balanza.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Pro */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Balanza de Comprobación</h1>
            <p className="text-muted-foreground">{getDescripcionPestana()}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("px-3 py-1", cuadra ? "border-green-400/60" : "border-red-400/60")}>
              {cuadra ? "✓ Cuadrado" : "✗ Descuadrado"}
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              Corte: {format(endDate, "dd/MM/yyyy")}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={pestanaActiva} onValueChange={setPestanaActiva}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="todos">Balanza de Comprobación</TabsTrigger>
          <TabsTrigger value="resultados">Balanza de Resultados</TabsTrigger>
          <TabsTrigger value="balance">Balanza de Balance</TabsTrigger>
        </TabsList>

        <TabsContent value={pestanaActiva} className="space-y-6 mt-6">
          {/* Alerta de fechas futuras */}
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

          {/* Tips / Aprende */}
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
                        Tips rápidos para que el usuario entienda lo que está viendo (y aprenda contabilidad).
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
                      <span className="font-semibold">Pro-tip BUKIPIN:</span>{" "}
                      Si algo “cuadra” pero se ve raro (por ejemplo, una venta moviendo una cuenta equivocada), revisa la{" "}
                      <span className="font-semibold">referencia del asiento</span> y confirma la lógica:{" "}
                      <span className="font-semibold">qué aumentó y qué disminuyó</span>.
                    </p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Controles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                {pestanaActiva === "todos" ? "Fecha de Corte" : "Filtros de Análisis"}
              </CardTitle>
              {pestanaActiva !== "todos" && (
                <CardDescription>Filtra por grupo → subgrupo → cuenta para un análisis más limpio y rápido.</CardDescription>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {pestanaActiva === "todos" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Fecha de Corte</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "PPP", { locale: es }) : "Seleccionar"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={(date) => date && setEndDate(date)}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tipo de Transacción</label>
                      <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          {tiposUnicos.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Estado del Asiento</label>
                      <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="cuadrado">Cuadrado</SelectItem>
                          <SelectItem value="descuadrado">Descuadrado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Estado Financiero</label>
                      <Select value={filtroEstadoFinanciero} onValueChange={setFiltroEstadoFinanciero}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="balance">Balance General</SelectItem>
                          <SelectItem value="resultados">Estado de Resultados</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Búsqueda</label>
                      <Input placeholder="Buscar…" value={filtroBusqueda} onChange={(e) => setFiltroBusqueda(e.target.value)} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Fecha Inicio (no aplica en balance) */}
                    {pestanaActiva !== "balance" && (
                      <div className="space-y-2">
                        <Label htmlFor="start-date">Fecha Inicio</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              id="start-date"
                              variant="outline"
                              className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {startDate ? format(startDate, "PPP", { locale: es }) : "Seleccionar"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={startDate}
                              onSelect={(date) => date && setStartDate(date)}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="end-date">{pestanaActiva === "balance" ? "Fecha de Corte" : "Fecha Fin"}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="end-date"
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "PPP", { locale: es }) : "Seleccionar"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={(date) => date && setEndDate(date)}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Grupo</Label>
                      <Select
                        value={grupoSeleccionado}
                        onValueChange={(value) => {
                          setGrupoSeleccionado(value);
                          setSubgrupoSeleccionado("todos");
                          setCuentaSeleccionada("todos");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos los Grupos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos los Grupos</SelectItem>
                          {gruposDisponibles.map((grupo) => (
                            <SelectItem key={grupo} value={grupo}>
                              {grupo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Subgrupo</Label>
                      <Select
                        value={subgrupoSeleccionado}
                        onValueChange={(value) => {
                          setSubgrupoSeleccionado(value);
                          setCuentaSeleccionada("todos");
                        }}
                        disabled={grupoSeleccionado === "todos"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos los Subgrupos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos los Subgrupos</SelectItem>
                          {subgruposDisponibles.map((subgrupo) => (
                            <SelectItem key={subgrupo} value={subgrupo}>
                              {subgrupo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Cuenta</Label>
                      <Select
                        value={cuentaSeleccionada}
                        onValueChange={setCuentaSeleccionada}
                        disabled={subgrupoSeleccionado === "todos"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todas las Cuentas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todas las Cuentas</SelectItem>
                          {(cuentasDisponibles as any[]).map((cuenta: any) => (
                            <SelectItem key={cuenta.codigo} value={cuenta.codigo}>
                              {cuenta.codigo} - {cuenta.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Indicador filtros */}
                  {infoFiltroActivo && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl">
                      <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-blue-700 dark:text-blue-300 flex-1">
                        Filtros activos:{" "}
                        <span className="font-semibold">
                          {grupoSeleccionado !== "todos" && grupoSeleccionado}
                          {subgrupoSeleccionado !== "todos" && ` > ${subgrupoSeleccionado}`}
                          {cuentaSeleccionada !== "todos" && ` > ${cuentaSeleccionada}`}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setGrupoSeleccionado("todos");
                          setSubgrupoSeleccionado("todos");
                          setCuentaSeleccionada("todos");
                        }}
                        className="h-7 text-xs"
                      >
                        Limpiar
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Resumen top (solo en “todos”) */}
          {pestanaActiva === "todos" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-muted-foreground/15">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Debe</CardTitle>
                  <CardDescription className="text-xs">Acumulado del periodo (según filtros)</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalDebe)}</p>
                </CardContent>
              </Card>

              <Card className="border-muted-foreground/15">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Haber</CardTitle>
                  <CardDescription className="text-xs">Acumulado del periodo (según filtros)</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(totalHaber)}</p>
                </CardContent>
              </Card>

              <Card className={cn("border-muted-foreground/15", cuadra ? "border-green-500/40" : "border-red-500/40")}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Estado</CardTitle>
                  <CardDescription className="text-xs">
                    {cuadra ? "Consistente contablemente" : "Hay diferencia entre debe y haber"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={cn("text-2xl font-bold", cuadra ? "text-green-600" : "text-red-600")}>
                    {cuadra ? "✓ Cuadrado" : "✗ Descuadrado"}
                  </p>
                  {!cuadra && <p className="text-sm text-muted-foreground mt-2">Diferencia: {formatCurrency(diferencia)}</p>}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Asientos Contables (Dropdown colapsable) */}
          <Collapsible open={asientosOpen} onOpenChange={setAsientosOpen}>
            <Card className="border-muted-foreground/15">
              {/* Header clickable */}
              <CollapsibleTrigger asChild>
                <div className="cursor-pointer select-none">
                  <CardHeader className="space-y-2 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          <ChevronRight className={cn("h-4 w-4 transition-transform", asientosOpen ? "rotate-90" : "rotate-0")} />
                          Asientos Contables
                        </CardTitle>

                        <CardDescription>
                          {asientosOpen ? (
                            <>
                              Mostrando <span className="font-semibold">{asientosFiltrados.length ? startIdx + 1 : 0}</span>–
                              <span className="font-semibold">{endIdx}</span> de{" "}
                              <span className="font-semibold">{asientosFiltrados.length}</span> (25 por página)
                            </>
                          ) : (
                            <>
                              Click para ver la lista ·{" "}
                              <span className="font-semibold">{asientosFiltrados.length}</span> asientos encontrados (25 por página)
                            </>
                          )}
                        </CardDescription>
                      </div>

                      {/* Paginación arriba SOLO cuando está abierto */}
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

              {/* Content */}
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-3">
                    {asientosPaginados.map((asiento) => {
                      const diff = Math.abs((asiento.totalDebe || 0) - (asiento.totalHaber || 0));
                      const cuadrado = diff < 0.01;
                      const asientoItem = asiento as any;

                      return (
                        <Collapsible key={asiento.referencia}>
                          <Card
                            className={cn(
                              "border-muted-foreground/15 overflow-hidden",
                              asientoItem.esCancelado ? "border-red-300 bg-red-50 dark:bg-red-950/20" : "",
                              !cuadrado && !asientoItem.esCancelado && pestanaActiva === "todos" ? "border-red-300" : ""
                            )}
                          >
                            <CollapsibleTrigger asChild>
                              <div className="cursor-pointer group">
                                <CardHeader className="hover:bg-muted/40 transition-colors">
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />

                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="text-sm font-semibold">{asiento.referencia}</p>

                                          {asientoItem.esCancelado && (
                                            <Badge className="bg-red-600 hover:bg-red-600 text-white">CANCELADO</Badge>
                                          )}

                                          {!asientoItem.esCancelado && pestanaActiva === "todos" && (
                                            <Badge
                                              variant="outline"
                                              className={cn(cuadrado ? "border-green-400/60" : "border-red-400/60")}
                                            >
                                              {cuadrado ? "Cuadrado" : "Descuadrado"}
                                            </Badge>
                                          )}

                                          {/* Futuro */}
                                          {(() => {
                                            const fechaAsiento = parseFechaFlexible(asiento.fecha);
                                            if (!fechaAsiento) return null;
                                            const hoy = new Date();
                                            hoy.setHours(0, 0, 0, 0);
                                            const fa = new Date(fechaAsiento);
                                            fa.setHours(0, 0, 0, 0);
                                            return fa > hoy ? (
                                              <Badge
                                                variant="outline"
                                                className="bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700"
                                              >
                                                Futuro
                                              </Badge>
                                            ) : null;
                                          })()}
                                        </div>

                                        <p
                                          className={cn(
                                            "text-sm mt-1 truncate",
                                            asientoItem.esCancelado ? "line-through text-muted-foreground" : ""
                                          )}
                                        >
                                          {asiento.descripcion}
                                        </p>

                                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                          <span>{asiento.fecha}</span>
                                          <span className="opacity-50">•</span>
                                          <span>{asiento.tipo}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="hidden md:flex items-center gap-6 shrink-0">
                                      <div className="text-right">
                                        <p className="text-sm font-semibold text-green-600">{formatCurrency(asiento.totalDebe)}</p>
                                        <p className="text-xs text-muted-foreground">Debe</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-semibold text-red-600">{formatCurrency(asiento.totalHaber)}</p>
                                        <p className="text-xs text-muted-foreground">Haber</p>
                                      </div>

                                      {pestanaActiva !== "todos" && asiento.efectoNetoCuentaFiltrada && (
                                        <div className="text-right">
                                          <div
                                            className={cn(
                                              "flex items-center justify-end gap-1 text-sm font-bold",
                                              asiento.efectoNetoCuentaFiltrada.esAumento ? "text-green-600" : "text-red-600"
                                            )}
                                          >
                                            {asiento.efectoNetoCuentaFiltrada.esAumento ? "↑" : "↓"}
                                            <span>{formatCurrency(Math.abs(asiento.efectoNetoCuentaFiltrada.neto))}</span>
                                          </div>
                                          <p className="text-xs text-muted-foreground">Efecto Neto</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Totales en móvil */}
                                  <div className="md:hidden mt-3 grid grid-cols-2 gap-3">
                                    <div className="rounded-lg border bg-muted/20 p-3">
                                      <p className="text-xs text-muted-foreground">Debe</p>
                                      <p className="text-sm font-semibold text-green-600">{formatCurrency(asiento.totalDebe)}</p>
                                    </div>
                                    <div className="rounded-lg border bg-muted/20 p-3">
                                      <p className="text-xs text-muted-foreground">Haber</p>
                                      <p className="text-sm font-semibold text-red-600">{formatCurrency(asiento.totalHaber)}</p>
                                    </div>
                                  </div>
                                </CardHeader>
                              </div>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <CardContent className="pt-0">
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
                                      {asiento.movimientos.map((mov, idx) => (
                                        <TableRow
                                          key={idx}
                                          className={cn("hover:bg-muted/30", mov.esCuentaFiltrada ? "bg-blue-50 dark:bg-blue-950/30" : "")}
                                        >
                                          <TableCell>
                                            <div className="flex items-start gap-2">
                                              {mov.esCuentaFiltrada && (
                                                <span className="mt-1 text-blue-600 dark:text-blue-400 font-bold">●</span>
                                              )}
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
                                        <TableCell className="text-right text-green-600">{formatCurrency(asiento.totalDebe)}</TableCell>
                                        <TableCell className="text-right text-red-600">{formatCurrency(asiento.totalHaber)}</TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </div>

                                {/* Leyenda */}
                                {pestanaActiva !== "todos" && asiento.movimientos.some((m) => m.esCuentaFiltrada) && (
                                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                                    <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                      <span className="text-blue-600 dark:text-blue-400 font-bold">●</span>
                                      Filas resaltadas = cuentas que coinciden con tu filtro actual.
                                    </p>
                                  </div>
                                )}

                                {/* Reversión */}
                                {asientoItem.asientoReversion && (
                                  <div className="mt-4 p-4 bg-orange-100 dark:bg-orange-950/40 rounded-xl border border-orange-300 dark:border-orange-800">
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                                        ↩️ Asiento de Reversión: {asientoItem.asientoReversion.referencia}
                                      </span>
                                      <span className="text-xs text-orange-600 dark:text-orange-400">
                                        ({asientoItem.asientoReversion.fecha})
                                      </span>
                                    </div>

                                    <div className="rounded-xl border overflow-hidden bg-background/40">
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
                                          {asientoItem.asientoReversion.movimientos.map((mov: any, idx: number) => (
                                            <TableRow key={idx} className="hover:bg-muted/30">
                                              <TableCell>
                                                <p className="font-mono text-xs">{mov.cuenta_codigo}</p>
                                                <p className="text-xs text-muted-foreground">{mov.cuenta_nombre}</p>
                                              </TableCell>
                                              <TableCell className="text-xs">{mov.descripcion}</TableCell>
                                              <TableCell className="text-right">
                                                {mov.debe > 0 ? (
                                                  <span className="text-green-600 font-medium text-xs">{formatCurrency(mov.debe)}</span>
                                                ) : (
                                                  <span className="text-muted-foreground">—</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {mov.haber > 0 ? (
                                                  <span className="text-red-600 font-medium text-xs">{formatCurrency(mov.haber)}</span>
                                                ) : (
                                                  <span className="text-muted-foreground">—</span>
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          ))}

                                          <TableRow className="font-bold bg-muted/40">
                                            <TableCell colSpan={2}>Total Reversión</TableCell>
                                            <TableCell className="text-right text-green-600 text-xs">
                                              {formatCurrency(asientoItem.asientoReversion.totalDebe)}
                                            </TableCell>
                                            <TableCell className="text-right text-red-600 text-xs">
                                              {formatCurrency(asientoItem.asientoReversion.totalHaber)}
                                            </TableCell>
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      );
                    })}
                  </div>

                  {/* Paginación (footer) */}
                  {asientosFiltrados.length > PAGE_SIZE && (
                    <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm text-muted-foreground">
                        Página <span className="font-semibold">{pageSafe}</span> de{" "}
                        <span className="font-semibold">{totalPages}</span>
                      </p>

                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={pageSafe === 1}>
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={pageSafe === 1}
                        >
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

          {/* ✅ Saldos por Cuenta (Estilo Plan de Cuentas / Desplegable) */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>Saldos por Cuenta</CardTitle>
              <CardDescription>
                Vista desplegable por Estado Financiero → Grupo → Subgrupo → Cuenta, con Debe/Haber acumulado y saldo neto.
                Útil para verificar alineación contable con trazabilidad (igual que Plan de Cuentas).
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Encabezado tipo tabla */}
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
                      {/* ESTADO */}
                      <CollapsibleTrigger asChild>
                        <button className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors group">
                          <div className="grid grid-cols-12 gap-3 items-center">
                            <div className="col-span-5 flex items-center gap-2 min-w-0">
                              <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                              <span className="font-semibold truncate">{estadoNode.label}</span>
                              <Badge variant="outline" className="ml-2 hidden sm:inline-flex">
                                {estadoNode.label === "Balance General" ? "Balance" : "Resultados"}
                              </Badge>
                            </div>

                            <div className="col-span-2">
                              <Badge variant="secondary" className="px-2 py-1">
                                —
                              </Badge>
                            </div>

                            <div className="col-span-2 text-right font-semibold text-green-600">
                              {formatCurrency(estadoNode.totals.debe)}
                            </div>
                            <div className="col-span-2 text-right font-semibold text-red-600">
                              {formatCurrency(estadoNode.totals.haber)}
                            </div>
                            <div className="col-span-1 text-right font-semibold">{formatCurrency(estadoNode.totals.saldo)}</div>
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="bg-background">
                          {estadoNode.children.map((grupoNode) => (
                            <Collapsible key={grupoNode.key}>
                              {/* GRUPO */}
                              <CollapsibleTrigger asChild>
                                <button className="w-full text-left px-4 py-3 pl-8 hover:bg-muted/20 transition-colors group">
                                  <div className="grid grid-cols-12 gap-3 items-center">
                                    <div className="col-span-5 flex items-center gap-2 min-w-0">
                                      <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                                      <span className="font-medium truncate">{grupoNode.label}</span>
                                    </div>

                                    <div className="col-span-2">
                                      <Badge variant="secondary" className="px-2 py-1">
                                        —
                                      </Badge>
                                    </div>

                                    <div className="col-span-2 text-right text-green-600 font-medium">
                                      {formatCurrency(grupoNode.totals.debe)}
                                    </div>
                                    <div className="col-span-2 text-right text-red-600 font-medium">
                                      {formatCurrency(grupoNode.totals.haber)}
                                    </div>
                                    <div className="col-span-1 text-right font-medium">{formatCurrency(grupoNode.totals.saldo)}</div>
                                  </div>
                                </button>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <div className="bg-background">
                                  {grupoNode.children.map((subNode) => (
                                    <Collapsible key={subNode.key}>
                                      {/* SUBGRUPO */}
                                      <CollapsibleTrigger asChild>
                                        <button className="w-full text-left px-4 py-3 pl-12 hover:bg-muted/10 transition-colors group">
                                          <div className="grid grid-cols-12 gap-3 items-center">
                                            <div className="col-span-5 flex items-center gap-2 min-w-0">
                                              <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                                              <span className="truncate text-sm">{subNode.label}</span>
                                              <Badge variant="outline" className="ml-2 hidden md:inline-flex">
                                                {subNode.cuentas.length} cuentas
                                              </Badge>
                                            </div>

                                            <div className="col-span-2">
                                              <Badge variant="secondary" className="px-2 py-1">
                                                —
                                              </Badge>
                                            </div>

                                            <div className="col-span-2 text-right text-green-600 text-sm font-medium">
                                              {formatCurrency(subNode.totals.debe)}
                                            </div>
                                            <div className="col-span-2 text-right text-red-600 text-sm font-medium">
                                              {formatCurrency(subNode.totals.haber)}
                                            </div>
                                            <div className="col-span-1 text-right text-sm font-medium">
                                              {formatCurrency(subNode.totals.saldo)}
                                            </div>
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
                                                        {c.codigo.startsWith("1")
                                                          ? "Activo"
                                                          : c.codigo.startsWith("2")
                                                          ? "Pasivo"
                                                          : c.codigo.startsWith("3")
                                                          ? "Capital"
                                                          : c.codigo.startsWith("4")
                                                          ? "Ingreso"
                                                          : c.codigo.startsWith("5")
                                                          ? "Costo"
                                                          : c.codigo.startsWith("6")
                                                          ? "Gasto"
                                                          : "—"}
                                                      </div>
                                                    </TableCell>

                                                    <TableCell className="text-xs">
                                                      <Badge variant="secondary" className="px-2 py-1">
                                                        {c.naturaleza}
                                                      </Badge>
                                                    </TableCell>

                                                    <TableCell className="text-right text-green-600">{formatCurrency(c.debe)}</TableCell>
                                                    <TableCell className="text-right text-red-600">{formatCurrency(c.haber)}</TableCell>
                                                    <TableCell className="text-right font-semibold">{formatCurrency(c.saldo)}</TableCell>
                                                  </TableRow>
                                                ))}

                                                <TableRow className="font-bold bg-muted/40">
                                                  <TableCell colSpan={3}>Subtotal</TableCell>
                                                  <TableCell className="text-right text-green-600">
                                                    {formatCurrency(subNode.totals.debe)}
                                                  </TableCell>
                                                  <TableCell className="text-right text-red-600">
                                                    {formatCurrency(subNode.totals.haber)}
                                                  </TableCell>
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

                {/* Totales globales del panel (respetando filtros) */}
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
                  <span className="font-semibold text-foreground">Checklist rápido:</span> 1) Total Debe = Total Haber, 2) Asientos
                  “Cuadrados”, 3) Saldos de Bancos/Caja/CxC/Inventario coherentes. Si algo no se ve lógico, abre el asiento y valida
                  las cuentas.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Balanza;
