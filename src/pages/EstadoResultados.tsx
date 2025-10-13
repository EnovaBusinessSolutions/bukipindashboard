import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";
import EstadoResultadosOperativo from "@/components/EstadosFinancieros/EstadoResultadosOperativo";
import EstadoResultadosEjecutivo from "@/components/EstadosFinancieros/EstadoResultadosEjecutivo";
import { cn } from "@/lib/utils";

export type PeriodType = "diario" | "mensual" | "anual";

const EstadoResultados = () => {
  const [periodType, setPeriodType] = useState<PeriodType>("mensual");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Calcular fechas de inicio y fin según el tipo de período
  const getDateRange = () => {
    switch (periodType) {
      case "diario":
        return {
          startDate: startOfDay(selectedDate),
          endDate: endOfDay(selectedDate)
        };
      case "mensual":
        return {
          startDate: startOfMonth(selectedDate),
          endDate: endOfMonth(selectedDate)
        };
      case "anual":
        return {
          startDate: startOfYear(selectedDate),
          endDate: endOfYear(selectedDate)
        };
      default:
        return {
          startDate: startOfMonth(selectedDate),
          endDate: endOfMonth(selectedDate)
        };
    }
  };

  const dateRange = getDateRange();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Estado de Resultados</h1>
        <p className="text-muted-foreground">Análisis de ingresos y gastos del período</p>
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
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
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
            {format(dateRange.startDate, "dd/MM/yyyy", { locale: es })} - {format(dateRange.endDate, "dd/MM/yyyy", { locale: es })}
          </div>
        </div>
      </div>

      <Tabs defaultValue="ejecutivo" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="ejecutivo">Formato Ejecutivo</TabsTrigger>
          <TabsTrigger value="operativo">Formato Operativo</TabsTrigger>
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
      </Tabs>
    </div>
  );
};

export default EstadoResultados;