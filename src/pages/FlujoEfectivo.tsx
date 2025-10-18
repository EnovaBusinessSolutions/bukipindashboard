import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FlujoEfectivo = () => {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  const { data: flujoData, isLoading } = useQuery({
    queryKey: ["flujo-efectivo", startDate, endDate],
    queryFn: async () => {
      // Obtener todas las transacciones de ingresos
      const { data: ingresos, error: ingresosError } = await supabase
        .from("transacciones_ingresos")
        .select("*, cuentas!inner(nombre, codigo)")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .in("cuenta_principal_codigo", ["1001", "1002"]); // Caja y Bancos

      if (ingresosError) throw ingresosError;

      // Obtener todas las transacciones de egresos
      const { data: egresos, error: egresosError } = await supabase
        .from("transacciones_egresos")
        .select("*, cuentas!inner(nombre, codigo)")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .in("cuenta_codigo", ["1001", "1002"]); // Caja y Bancos

      if (egresosError) throw egresosError;

      // Obtener inversiones
      const { data: inversiones, error: inversionesError } = await supabase
        .from("inversiones_capex")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (inversionesError) throw inversionesError;

      // Obtener financiamientos y sus transacciones
      const { data: transFinanciamientos, error: finError } = await supabase
        .from("transacciones_financiamientos")
        .select("*, financiamientos(*)")
        .gte("fecha", format(startDate, "yyyy-MM-dd"))
        .lte("fecha", format(endDate, "yyyy-MM-dd"));

      if (finError) throw finError;

      // Clasificar transacciones
      const actividadesOperativas = [
        ...ingresos?.map(t => ({
          descripcion: t.descripcion,
          monto: t.monto_neto,
          tipo: "Ingreso",
          fecha: t.created_at,
          cuenta: (t.cuentas as any)?.nombre || "Efectivo/Bancos"
        })) || [],
        ...egresos?.filter(e => 
          e.tipo_egreso !== "Inversión" && 
          e.tipo_egreso !== "Financiamiento"
        ).map(t => ({
          descripcion: t.descripcion,
          monto: -t.monto_total,
          tipo: "Egreso",
          fecha: t.created_at,
          cuenta: (t.cuentas as any)?.nombre || "Efectivo/Bancos"
        })) || []
      ];

      const actividadesInversion = [
        ...inversiones?.map(t => ({
          descripcion: t.descripcion || t.producto_nombre,
          monto: -t.monto_pagado,
          tipo: "Inversión",
          fecha: t.created_at,
          cuenta: "Activos Fijos"
        })) || []
      ];

      const actividadesFinanciamiento = [
        ...transFinanciamientos?.map(t => ({
          descripcion: t.descripcion || `${t.tipo_transaccion} - ${(t.financiamientos as any)?.nombre}`,
          monto: t.tipo_transaccion === "desembolso" ? t.monto : -t.monto,
          tipo: t.tipo_transaccion,
          fecha: t.fecha,
          cuenta: "Financiamiento"
        })) || []
      ];

      const totalOperativas = actividadesOperativas.reduce((sum, t) => sum + t.monto, 0);
      const totalInversion = actividadesInversion.reduce((sum, t) => sum + t.monto, 0);
      const totalFinanciamiento = actividadesFinanciamiento.reduce((sum, t) => sum + t.monto, 0);

      return {
        actividadesOperativas,
        actividadesInversion,
        actividadesFinanciamiento,
        totales: {
          operativas: totalOperativas,
          inversion: totalInversion,
          financiamiento: totalFinanciamiento,
          neto: totalOperativas + totalInversion + totalFinanciamiento
        }
      };
    }
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Flujo de Efectivo</h1>
        <p className="text-muted-foreground">Análisis de entradas y salidas de efectivo por actividad</p>
      </div>

      {/* Selector de Fechas */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Fecha Inicio</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP", { locale: es }) : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
                initialFocus
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Fecha Fin</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP", { locale: es }) : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setEndDate(date)}
                initialFocus
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Cargando flujo de efectivo...</div>
      ) : (
        <div className="space-y-6">
          {/* Actividades Operativas */}
          <Card>
            <CardHeader>
              <CardTitle>Actividades Operativas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {flujoData?.actividadesOperativas.map((transaccion, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <div className="font-medium">{transaccion.descripcion}</div>
                      <div className="text-sm text-muted-foreground">
                        {transaccion.cuenta} - {format(new Date(transaccion.fecha), "dd/MM/yyyy")}
                      </div>
                    </div>
                    <div className={cn(
                      "font-bold",
                      transaccion.monto >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      ${Math.abs(transaccion.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-4 font-bold text-lg">
                  <span>Total Actividades Operativas</span>
                  <span className={cn(
                    flujoData?.totales.operativas >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    ${flujoData?.totales.operativas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actividades de Inversión */}
          <Card>
            <CardHeader>
              <CardTitle>Actividades de Inversión</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {flujoData?.actividadesInversion.map((transaccion, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <div className="font-medium">{transaccion.descripcion}</div>
                      <div className="text-sm text-muted-foreground">
                        {transaccion.cuenta} - {format(new Date(transaccion.fecha), "dd/MM/yyyy")}
                      </div>
                    </div>
                    <div className={cn(
                      "font-bold",
                      transaccion.monto >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      ${Math.abs(transaccion.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-4 font-bold text-lg">
                  <span>Total Actividades de Inversión</span>
                  <span className={cn(
                    flujoData?.totales.inversion >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    ${flujoData?.totales.inversion.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actividades de Financiamiento */}
          <Card>
            <CardHeader>
              <CardTitle>Actividades de Financiamiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {flujoData?.actividadesFinanciamiento.map((transaccion, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <div className="font-medium">{transaccion.descripcion}</div>
                      <div className="text-sm text-muted-foreground">
                        {transaccion.cuenta} - {format(new Date(transaccion.fecha), "dd/MM/yyyy")}
                      </div>
                    </div>
                    <div className={cn(
                      "font-bold",
                      transaccion.monto >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      ${Math.abs(transaccion.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-4 font-bold text-lg">
                  <span>Total Actividades de Financiamiento</span>
                  <span className={cn(
                    flujoData?.totales.financiamiento >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    ${flujoData?.totales.financiamiento.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Neto */}
          <Card className="bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center text-2xl font-bold">
                <span>Flujo Neto de Efectivo</span>
                <span className={cn(
                  flujoData?.totales.neto >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  ${flujoData?.totales.neto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FlujoEfectivo;
