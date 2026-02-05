// bukipin-dashboard/src/pages/BalanzaComprobacion.tsx
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, ChevronRight, Filter, AlertTriangle, Info, BookOpen, ChevronLeft, ChevronsLeft, ChevronsRight } from "lucide-react";
import { format, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { useCuentas } from "@/hooks/useCuentas";

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

function parseFechaFlexible(fecha: string): Date | null {
  if (!fecha) return null;

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

  if (fecha.includes("-")) {
    const dt = new Date(fecha);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  const dt = new Date(fecha);
  if (!Number.isNaN(dt.getTime())) return dt;

  return null;
}

export default function BalanzaComprobacion() {
  // ✅ Solo “Comprobación”
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [filtroBusqueda, setFiltroBusqueda] = useState<string>("");

  // UI
  // ✅ Tips colapsado por default (como tu captura 1)
  const [showTips, setShowTips] = useState<boolean>(false);
  const [asientosOpen, setAsientosOpen] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  // ✅ En comprobación acumulamos “desde siempre”: 10 años atrás
  const startDateAjustado = useMemo(() => new Date(endDate.getFullYear() - 10, 0, 1), [endDate]);

  const { data: balanzaData, isLoading } = useAsientosBalanza(startDateAjustado, endDate);
  const { data: cuentasData } = useCuentas();

  // Reset paginación al cambiar filtros
  useEffect(() => setPage(1), [filtroBusqueda, endDate.getTime()]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

  const movimientos: BalanzaEntry[] = (balanzaData?.movimientos as BalanzaEntry[]) || [];
  const saldosPorCuenta: Record<string, any> = (balanzaData?.saldosPorCuenta as Record<string, any>) || {};
  const cuentasFlat: CuentaFlat[] = (cuentasData?.cuentasFlat as CuentaFlat[]) || [];
  const estadosFinancieros: any = cuentasData?.estadosFinancieros;

  const cuentasInfoMap = useMemo(() => {
    const entries: Array<[string, CuentaInfo]> = (cuentasFlat || []).map((cuenta) => [
      cuenta.codigo,
      { nombre: cuenta.nombre, estado_financiero: cuenta.estado_financiero ?? null },
    ]);
    return new Map<string, CuentaInfo>(entries);
  }, [cuentasFlat]);

  const getNaturaleza = (codigoCuenta?: string) => {
    const d = (codigoCuenta || "").charAt(0);
    if (!d) return "—";
    return ["1", "5", "6"].includes(d) ? "Deudora" : ["2", "3", "4"].includes(d) ? "Acreedora" : "—";
  };

  // ✅ Movimientos “sin filtrar por tipo” (comprobación)
  const movimientosFiltrados = movimientos;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tieneFechasFuturas = movimientosFiltrados.some((mov) => {
    const fechaMov = parseFechaFlexible(mov.fecha);
    if (!fechaMov) return false;
    const dt = new Date(fechaMov);
    dt.setHours(0, 0, 0, 0);
    return dt > today;
  });

  // ✅ Agrupar por asiento (modo “todos”)
  const asientosAgrupados: Record<string, AsientoAgrupado> = {};
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

  const asientosArray = Object.values(asientosAgrupados);

  // Detectar reversión/cancelación (igual a tu archivo)
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

      return { ...asiento, esCancelado: !!asientoReversion, asientoReversion: asientoReversion || null };
    })
    .filter(Boolean) as (AsientoAgrupado & { esCancelado: boolean; asientoReversion: AsientoAgrupado | null })[];

  // Búsqueda
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

  // Totales por saldos (sin filtros especiales)
  const saldosPorCuentaFiltrados = saldosPorCuenta;

  const totalDebe = useMemo(
    () => Object.values(saldosPorCuentaFiltrados).reduce((sum, c: any) => sum + (c?.debe_total || 0), 0),
    [saldosPorCuentaFiltrados]
  );
  const totalHaber = useMemo(
    () => Object.values(saldosPorCuentaFiltrados).reduce((sum, c: any) => sum + (c?.haber_total || 0), 0),
    [saldosPorCuentaFiltrados]
  );
  const diferencia = Math.abs(totalDebe - totalHaber);
  const cuadra = diferencia < 0.01;

  // ===== UI Saldos por Cuenta (igual que tu archivo, sin cambiar lógica) =====
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
      return {
        codigo,
        nombre: info?.nombre || "N/A",
        estado_financiero,
        naturaleza: getNaturaleza(codigo),
        debe: Number(raw?.debe_total || 0),
        haber: Number(raw?.haber_total || 0),
        saldo: Number(raw?.saldo || 0),
      };
    };

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
      return [{ key: "flat", label: "Saldos por cuenta", level: "estado", totals, cuentas: rows, children: [] }];
    })();

    if (!estadosFinancieros) return fallbackFlat;

    const nodes: SaldosNode[] = [];
    const estadoKeys: Array<"Balance General" | "Estado de Resultados"> = ["Balance General", "Estado de Resultados"];

    for (const estadoKey of estadoKeys) {
      const grupos = Object.keys(estadosFinancieros?.[estadoKey] || {});
      const estadoNode: SaldosNode = { key: `estado:${estadoKey}`, label: estadoKey, level: "estado", totals: { debe: 0, haber: 0, saldo: 0 }, cuentas: [], children: [] };

      for (const grupo of grupos) {
        const subgruposObj = estadosFinancieros?.[estadoKey]?.[grupo] || {};
        const subgrupos = Object.keys(subgruposObj);

        const grupoNode: SaldosNode = { key: `grupo:${estadoKey}:${grupo}`, label: grupo, level: "grupo", totals: { debe: 0, haber: 0, saldo: 0 }, cuentas: [], children: [] };

        for (const subgrupo of subgrupos) {
          const cuentasArr = (subgruposObj?.[subgrupo] || []) as any[];
          const codigos = cuentasArr.map((c) => String(c?.codigo || "")).filter(Boolean);

          const rows: SaldosCuentaRow[] = codigos.map((codigo) => buildCuentaRow(codigo, estadoKey)).filter(Boolean) as SaldosCuentaRow[];
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

      if (!estadoNode.children.length) continue;
      nodes.push(estadoNode);
    }

    return nodes.length ? nodes : fallbackFlat;
  }, [saldosPorCuentaFiltrados, estadosFinancieros, cuentasInfoMap]);

  // ===== Paginación asientos =====
  const totalItems = asientosFiltrados.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const startIdx = (pageSafe - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, totalItems);
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

  // ===== Estados de carga =====
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

  if (!movimientosFiltrados || movimientosFiltrados.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-1 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Balanza de Comprobación</h1>
          <p className="text-muted-foreground">Vista completa de todos los movimientos contables.</p>
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

  // ===== Render =====
  const tipsTitle = "Cómo leer una Balanza de Comprobación";
  const tipsBody = [
    "Si Total Debe = Total Haber, la contabilidad está cuadrada (no significa que sea correcta, pero sí consistente).",
    "Cada asiento debe tener el mismo total en Debe y Haber.",
    "Tip: abre un asiento y confirma que las cuentas involucradas tengan sentido (ej. venta: Bancos/Caja vs Ventas).",
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Balanza de Comprobación</h1>
            <p className="text-muted-foreground">
              Vista completa de todas las cuentas al corte del {format(endDate, "dd/MM/yyyy")}. Muestra el saldo acumulado desde el inicio de operaciones.
            </p>
          </div>

          {/* ✅ ELIMINADO: bloque duplicado (captura 2) */}
          {/* 
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("px-3 py-1", cuadra ? "border-green-400/60" : "border-red-400/60")}>
              {cuadra ? "✓ Cuadrado" : "✗ Descuadrado"}
            </Badge>
            <Badge variant="outline" className="px-3 py-1">Corte: {format(endDate, "dd/MM/yyyy")}</Badge>
          </div>
          */}
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
                    Tips rápidos para entender lo que estás viendo (y aprender contabilidad).
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
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Controles (corte + búsqueda) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Fecha de Corte
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha de Corte</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP", { locale: es }) : "Seleccionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(date) => date && setEndDate(date)} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Búsqueda</label>
              <Input placeholder="Buscar…" value={filtroBusqueda} onChange={(e) => setFiltroBusqueda(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
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
            <CardDescription className="text-xs">{cuadra ? "Consistente contablemente" : "Hay diferencia entre debe y haber"}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-bold", cuadra ? "text-green-600" : "text-red-600")}>{cuadra ? "✓ Cuadrado" : "✗ Descuadrado"}</p>
            {!cuadra && <p className="text-sm text-muted-foreground mt-2">Diferencia: {formatCurrency(diferencia)}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Asientos */}
      <Collapsible open={asientosOpen} onOpenChange={setAsientosOpen}>
        <Card className="border-muted-foreground/15">
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
                          <span className="font-semibold">{endIdx}</span> de <span className="font-semibold">{totalItems}</span> (25 por página)
                        </>
                      ) : (
                        <>
                          Click para ver la lista · <span className="font-semibold">{totalItems}</span> asientos encontrados (25 por página)
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
                          !cuadrado && !asientoItem.esCancelado ? "border-red-300" : ""
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

                                      {asientoItem.esCancelado ? (
                                        <Badge className="bg-red-600 hover:bg-red-600 text-white">CANCELADO</Badge>
                                      ) : (
                                        <Badge variant="outline" className={cn(cuadrado ? "border-green-400/60" : "border-red-400/60")}>
                                          {cuadrado ? "Cuadrado" : "Descuadrado"}
                                        </Badge>
                                      )}
                                    </div>

                                    <p className={cn("text-sm mt-1 truncate", asientoItem.esCancelado ? "line-through text-muted-foreground" : "")}>
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
                                    <TableRow key={idx} className="hover:bg-muted/30">
                                      <TableCell>
                                        <div className="min-w-0">
                                          <p className="font-mono text-sm">{mov.cuenta_codigo}</p>
                                          <p className="text-xs text-muted-foreground truncate">{mov.cuenta_nombre}</p>
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
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Saldos por Cuenta (igual que tu panel original) */}
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Saldos por Cuenta</CardTitle>
          <CardDescription>Vista desplegable por Estado Financiero → Grupo → Subgrupo → Cuenta, con Debe/Haber acumulado y saldo neto.</CardDescription>
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
                        </div>

                        <div className="col-span-2">
                          <Badge variant="secondary" className="px-2 py-1">
                            —
                          </Badge>
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
                                  <Badge variant="secondary" className="px-2 py-1">
                                    —
                                  </Badge>
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
                                          <Badge variant="outline" className="ml-2 hidden md:inline-flex">
                                            {subNode.cuentas.length} cuentas
                                          </Badge>
                                        </div>
                                        <div className="col-span-2">
                                          <Badge variant="secondary" className="px-2 py-1">
                                            —
                                          </Badge>
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
                                                <TableCell className="text-sm">{c.nombre}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
