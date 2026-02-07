// bukipin-dashboard/src/pages/EstadoResultados.tsx
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, RefreshCw } from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import { es } from "date-fns/locale";
import EstadoResultadosOperativo from "@/components/EstadosFinancieros/EstadoResultadosOperativo";
import EstadoResultadosEjecutivo from "@/components/EstadosFinancieros/EstadoResultadosEjecutivo";
import EstadoResultadosAnalitico from "@/components/EstadosFinancieros/EstadoResultadosAnalitico";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export type PeriodType = "rango"; // compat: ya no usamos diario/mensual/anual
type TabKey = "ejecutivo" | "operativo" | "analitico";

function startYMDLocal(d: Date) {
  return startOfDay(d);
}
function endYMDLocal(d: Date) {
  return endOfDay(d);
}

const EstadoResultados = () => {
  // ✅ UI de filtros (draft)
  const [draftStart, setDraftStart] = useState<Date>(() => startOfMonth(new Date()));
  const [draftEnd, setDraftEnd] = useState<Date>(() => endOfMonth(new Date()));

  // ✅ rango aplicado (source of truth para queries)
  const [appliedStart, setAppliedStart] = useState<Date>(() => startOfMonth(new Date()));
  const [appliedEnd, setAppliedEnd] = useState<Date>(() => endOfMonth(new Date()));

  // mantenemos periodType por compat (los hijos lo reciben, aunque ya no se usa para agrupar)
  const [periodType] = useState<PeriodType>("rango");

  const [tab, setTab] = useState<TabKey>("ejecutivo");
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    // ✅ Refrescar TODO lo relacionado a ER y contabilidad sin depender de keys exactas
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "estado-resultados-mensual",
    });
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) && String(q.queryKey[0] || "").startsWith("estado-resultados"),
    });
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && String(q.queryKey[0] || "").startsWith("contabilidad"),
    });

    // Mantener los que ya tenías por si algún panel los usa
    queryClient.invalidateQueries({ queryKey: ["asientos-balanza"] });
    queryClient.invalidateQueries({ queryKey: ["cuentas"] });
  };

  // ✅ Normaliza por seguridad (si el usuario invierte fechas)
  const safeDraft = useMemo(() => {
    const s = startYMDLocal(draftStart || new Date());
    const e = endYMDLocal(draftEnd || new Date());
    if (s.getTime() <= e.getTime()) return { start: s, end: e };
    return { start: startYMDLocal(draftEnd), end: endYMDLocal(draftStart) };
  }, [draftStart, draftEnd]);

  const dateRange = useMemo(() => {
    const s = startYMDLocal(appliedStart || new Date());
    const e = endYMDLocal(appliedEnd || new Date());
    if (s.getTime() <= e.getTime()) return { startDate: s, endDate: e };
    return { startDate: startYMDLocal(appliedEnd), endDate: endYMDLocal(appliedStart) };
  }, [appliedStart, appliedEnd]);

  const rangoLabel = useMemo(() => {
    return `${format(dateRange.startDate, "dd/MM/yyyy", { locale: es })} - ${format(
      dateRange.endDate,
      "dd/MM/yyyy",
      { locale: es }
    )}`;
  }, [dateRange.startDate, dateRange.endDate]);

  const applyRange = () => {
    setAppliedStart(safeDraft.start);
    setAppliedEnd(safeDraft.end);
  };

  const setQuickHoy = () => {
    const now = new Date();
    setDraftStart(startOfDay(now));
    setDraftEnd(endOfDay(now));
  };

  const setQuickMes = () => {
    const now = new Date();
    setDraftStart(startOfMonth(now));
    setDraftEnd(endOfMonth(now));
  };

  const setQuickAnio = () => {
    const now = new Date();
    setDraftStart(startOfYear(now));
    setDraftEnd(endOfYear(now));
  };

  const canApply = useMemo(() => {
    const aS = startYMDLocal(appliedStart).getTime();
    const aE = endYMDLocal(appliedEnd).getTime();
    const dS = safeDraft.start.getTime();
    const dE = safeDraft.end.getTime();
    return aS !== dS || aE !== dE;
  }, [appliedStart, appliedEnd, safeDraft.start, safeDraft.end]);

  return (
    <div className="container mx-auto p-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Estado de Resultados</h1>
          <p className="text-muted-foreground">
            Reporte por <span className="font-semibold text-foreground">rango de fechas</span> (sin agrupadores)
          </p>
          <div className="mt-2 inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border bg-muted/30">
            <span className="text-muted-foreground">Rango aplicado:</span>
            <span className="font-semibold text-foreground">{rangoLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refrescar
          </Button>
        </div>
      </div>

      {/* FILTROS PRO */}
      <div className="mb-6 rounded-xl border bg-muted/30 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Filtros</p>
            <p className="text-xs text-muted-foreground">
              Selecciona un rango de fechas específico para consultar todo el Estado de Resultados.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button type="button" variant="outline" size="sm" onClick={setQuickHoy}>
              Hoy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={setQuickMes}>
              Este mes
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={setQuickAnio}>
              Este año
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* FECHA INICIO */}
          <div className="min-w-[220px]">
            <label className="text-sm font-medium mb-2 block">Fecha inicio</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !draftStart && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {draftStart ? format(draftStart, "PPP", { locale: es }) : "Seleccionar fecha inicio"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={draftStart}
                  onSelect={(date) => date && setDraftStart(date)}
                  initialFocus
                  className="pointer-events-auto"
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* FECHA FIN */}
          <div className="min-w-[220px]">
            <label className="text-sm font-medium mb-2 block">Fecha fin</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !draftEnd && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {draftEnd ? format(draftEnd, "PPP", { locale: es }) : "Seleccionar fecha fin"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={draftEnd}
                  onSelect={(date) => date && setDraftEnd(date)}
                  initialFocus
                  className="pointer-events-auto"
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* ACCIONES */}
          <div className="min-w-[220px] flex flex-col">
            <label className="text-sm font-medium mb-2 block">Acciones</label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="flex-1"
                onClick={applyRange}
                disabled={!canApply}
                title={!canApply ? "El rango ya está aplicado" : "Aplicar rango"}
              >
                Aplicar
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraftStart(appliedStart);
                  setDraftEnd(appliedEnd);
                }}
                disabled={!canApply}
                title={!canApply ? "No hay cambios por revertir" : "Revertir cambios"}
              >
                Revertir
              </Button>
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              Rango seleccionado:{" "}
              <span className="font-semibold text-foreground">
                {format(safeDraft.start, "dd/MM/yyyy", { locale: es })} -{" "}
                {format(safeDraft.end, "dd/MM/yyyy", { locale: es })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="ejecutivo">Formato Ejecutivo</TabsTrigger>
          <TabsTrigger value="operativo">Formato Operativo</TabsTrigger>
          <TabsTrigger value="analitico">Formato Analítico</TabsTrigger>
        </TabsList>

        <TabsContent value="ejecutivo" className="mt-6">
          <EstadoResultadosEjecutivo
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            periodType={periodType}
          />
        </TabsContent>

        <TabsContent value="operativo" className="mt-6">
          <EstadoResultadosOperativo
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            periodType={periodType}
          />
        </TabsContent>

        <TabsContent value="analitico" className="mt-6">
          <EstadoResultadosAnalitico
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            periodType={periodType}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EstadoResultados;
