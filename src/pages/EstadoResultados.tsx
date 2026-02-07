import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";
import EstadoResultadosOperativo from "@/components/EstadosFinancieros/EstadoResultadosOperativo";
import EstadoResultadosEjecutivo from "@/components/EstadosFinancieros/EstadoResultadosEjecutivo";
import EstadoResultadosAnalitico from "@/components/EstadosFinancieros/EstadoResultadosAnalitico";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export type PeriodType = "diario" | "mensual" | "anual";
type TabKey = "ejecutivo" | "operativo" | "analitico";

const EstadoResultados = () => {
  const [periodType, setPeriodType] = useState<PeriodType>("mensual");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [tab, setTab] = useState<TabKey>("ejecutivo");
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    // ✅ Refrescar TODO lo relacionado a ER y contabilidad sin depender de keys exactas
    queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "estado-resultados-mensual" });
    queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && String(q.queryKey[0] || "").startsWith("estado-resultados") });
    queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && String(q.queryKey[0] || "").startsWith("contabilidad") });

    // Mantener los que ya tenías por si algún panel los usa
    queryClient.invalidateQueries({ queryKey: ["asientos-balanza"] });
    queryClient.invalidateQueries({ queryKey: ["cuentas"] });
  };

  const dateRange = useMemo(() => {
    const base = selectedDate || new Date();

    switch (periodType) {
      case "diario":
        return {
          startDate: startOfDay(base),
          endDate: endOfDay(base),
        };
      case "mensual":
        return {
          startDate: startOfMonth(base),
          endDate: endOfMonth(base),
        };
      case "anual":
        return {
          startDate: startOfYear(base),
          endDate: endOfYear(base),
        };
      default:
        return {
          startDate: startOfMonth(base),
          endDate: endOfMonth(base),
        };
    }
  }, [periodType, selectedDate]);

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Estado de Resultados</h1>
          <p className="text-muted-foreground">Análisis de ingresos y gastos del período</p>
        </div>

        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refrescar
        </Button>
      </div>

      {/* Selector de Período */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Tipo de Período</label>
          <Select value={periodType} onValueChange={(value) => setPeriodType(value as PeriodType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diario</SelectItem>
              <SelectItem value="mensual">Mensual (Acumulado)</SelectItem>
              <SelectItem value="anual">Anual (Acumulado)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Fecha</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP", { locale: es }) : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className="pointer-events-auto"
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Rango de Consulta</label>
          <div className="text-sm text-muted-foreground bg-background p-3 rounded-md border">
            {format(dateRange.startDate, "dd/MM/yyyy", { locale: es })} -{" "}
            {format(dateRange.endDate, "dd/MM/yyyy", { locale: es })}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="ejecutivo">Formato Ejecutivo</TabsTrigger>
          <TabsTrigger value="operativo">Formato Operativo</TabsTrigger>
          <TabsTrigger value="analitico">Formato Analítico</TabsTrigger>
        </TabsList>

        <TabsContent value="ejecutivo" className="mt-6">
          <EstadoResultadosEjecutivo startDate={dateRange.startDate} endDate={dateRange.endDate} periodType={periodType} />
        </TabsContent>

        <TabsContent value="operativo" className="mt-6">
          <EstadoResultadosOperativo startDate={dateRange.startDate} endDate={dateRange.endDate} periodType={periodType} />
        </TabsContent>

        <TabsContent value="analitico" className="mt-6">
          <EstadoResultadosAnalitico startDate={dateRange.startDate} endDate={dateRange.endDate} periodType={periodType} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EstadoResultados;
