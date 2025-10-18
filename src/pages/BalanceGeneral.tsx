import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import BalanceGeneralEjecutivo from "@/components/EstadosFinancieros/BalanceGeneralEjecutivo";
import BalanceGeneralOperativo from "@/components/EstadosFinancieros/BalanceGeneralOperativo";
import BalanceGeneralAnalitico from "@/components/EstadosFinancieros/BalanceGeneralAnalitico";

const BalanceGeneral = () => {
  const [cutoffDate, setCutoffDate] = useState<Date>(new Date());

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Balance General</h1>
        <p className="text-muted-foreground">Estado de la situación financiera</p>
      </div>

      {/* Selector de Fecha de Corte */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Fecha de Corte</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !cutoffDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {cutoffDate ? format(cutoffDate, "PPP", { locale: es }) : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={cutoffDate}
                onSelect={(date) => date && setCutoffDate(date)}
                initialFocus
                className="pointer-events-auto"
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex-1 min-w-[300px] flex items-end">
          <div className="text-sm text-muted-foreground bg-background p-3 rounded-md border w-full">
            El balance mostrará los saldos acumulados hasta la fecha seleccionada
          </div>
        </div>
      </div>

      <Tabs defaultValue="ejecutivo" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="ejecutivo">Formato Ejecutivo</TabsTrigger>
          <TabsTrigger value="operativo">Formato Operativo</TabsTrigger>
          <TabsTrigger value="analitico">Formato Analítico</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ejecutivo" className="mt-6">
          <BalanceGeneralEjecutivo cutoffDate={cutoffDate} />
        </TabsContent>
        
        <TabsContent value="operativo" className="mt-6">
          <BalanceGeneralOperativo cutoffDate={cutoffDate} />
        </TabsContent>
        
        <TabsContent value="analitico" className="mt-6">
          <BalanceGeneralAnalitico cutoffDate={cutoffDate} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BalanceGeneral;
