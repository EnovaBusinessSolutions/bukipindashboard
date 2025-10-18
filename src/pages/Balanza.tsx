import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BalanzaEntry {
  fecha: string;
  tipo: string;
  descripcion: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: number;
  haber: number;
  referencia: string;
}

const Balanza = () => {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  const { data: balanzaData, isLoading } = useQuery({
    queryKey: ["balanza", startDate, endDate],
    queryFn: async () => {
      const movimientos: BalanzaEntry[] = [];

      // Obtener ingresos
      const { data: ingresos } = await supabase
        .from("transacciones_ingresos")
        .select("*, cuentas(nombre)")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      ingresos?.forEach(ingreso => {
        // Cuenta de efectivo/banco (Debe)
        movimientos.push({
          fecha: format(new Date(ingreso.created_at), "dd/MM/yyyy HH:mm"),
          tipo: "Ingreso",
          descripcion: ingreso.descripcion,
          cuenta_codigo: ingreso.cuenta_principal_codigo,
          cuenta_nombre: (ingreso.cuentas as any)?.nombre || "Efectivo/Bancos",
          debe: ingreso.monto_neto,
          haber: 0,
          referencia: `ING-${ingreso.id.slice(0, 8)}`
        });

        // Cuenta de ingreso (Haber)
        movimientos.push({
          fecha: format(new Date(ingreso.created_at), "dd/MM/yyyy HH:mm"),
          tipo: "Ingreso",
          descripcion: ingreso.descripcion,
          cuenta_codigo: "4001", // Ingresos por ventas
          cuenta_nombre: "Ingresos",
          debe: 0,
          haber: ingreso.monto_neto,
          referencia: `ING-${ingreso.id.slice(0, 8)}`
        });

        // Si hay cuentas por cobrar
        if (ingreso.monto_pendiente > 0) {
          movimientos.push({
            fecha: format(new Date(ingreso.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Ingreso",
            descripcion: `${ingreso.descripcion} (Por cobrar)`,
            cuenta_codigo: "1003",
            cuenta_nombre: "Cuentas por Cobrar",
            debe: ingreso.monto_pendiente,
            haber: 0,
            referencia: `ING-${ingreso.id.slice(0, 8)}`
          });
        }
      });

      // Obtener egresos
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("*, cuentas(nombre)")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      egresos?.forEach(egreso => {
        // Cuenta de gasto/costo (Debe)
        movimientos.push({
          fecha: format(new Date(egreso.created_at), "dd/MM/yyyy HH:mm"),
          tipo: "Egreso",
          descripcion: egreso.descripcion,
          cuenta_codigo: egreso.cuenta_codigo || "5001",
          cuenta_nombre: (egreso.cuentas as any)?.nombre || "Gastos",
          debe: egreso.monto_total,
          haber: 0,
          referencia: `EGR-${egreso.id.slice(0, 8)}`
        });

        // Cuenta de efectivo/banco (Haber)
        if (egreso.monto_pagado > 0) {
          movimientos.push({
            fecha: format(new Date(egreso.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Egreso",
            descripcion: egreso.descripcion,
            cuenta_codigo: egreso.cuenta_codigo || "1001",
            cuenta_nombre: "Efectivo/Bancos",
            debe: 0,
            haber: egreso.monto_pagado,
            referencia: `EGR-${egreso.id.slice(0, 8)}`
          });
        }

        // Si hay cuentas por pagar
        if (egreso.monto_pendiente > 0) {
          movimientos.push({
            fecha: format(new Date(egreso.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Egreso",
            descripcion: `${egreso.descripcion} (Por pagar)`,
            cuenta_codigo: "2001",
            cuenta_nombre: "Cuentas por Pagar",
            debe: 0,
            haber: egreso.monto_pendiente,
            referencia: `EGR-${egreso.id.slice(0, 8)}`
          });
        }
      });

      // Obtener inversiones
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      inversiones?.forEach(inversion => {
        // Cuenta de activo fijo (Debe)
        movimientos.push({
          fecha: format(new Date(inversion.created_at), "dd/MM/yyyy HH:mm"),
          tipo: "Inversión",
          descripcion: inversion.producto_nombre,
          cuenta_codigo: inversion.cuenta_codigo || "1007",
          cuenta_nombre: "Activos Fijos",
          debe: inversion.valor_total,
          haber: 0,
          referencia: `INV-${inversion.id.slice(0, 8)}`
        });

        // Cuenta de efectivo (Haber)
        if (inversion.monto_pagado > 0) {
          movimientos.push({
            fecha: format(new Date(inversion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Inversión",
            descripcion: inversion.producto_nombre,
            cuenta_codigo: "1001",
            cuenta_nombre: "Efectivo/Bancos",
            debe: 0,
            haber: inversion.monto_pagado,
            referencia: `INV-${inversion.id.slice(0, 8)}`
          });
        }

        // Si hay monto pendiente
        if (inversion.monto_pendiente > 0) {
          movimientos.push({
            fecha: format(new Date(inversion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Inversión",
            descripcion: `${inversion.producto_nombre} (Por pagar)`,
            cuenta_codigo: "2001",
            cuenta_nombre: "Cuentas por Pagar",
            debe: 0,
            haber: inversion.monto_pendiente,
            referencia: `INV-${inversion.id.slice(0, 8)}`
          });
        }
      });

      // Calcular totales
      const totalDebe = movimientos.reduce((sum, m) => sum + m.debe, 0);
      const totalHaber = movimientos.reduce((sum, m) => sum + m.haber, 0);

      return {
        movimientos,
        totales: {
          debe: totalDebe,
          haber: totalHaber,
          diferencia: totalDebe - totalHaber
        }
      };
    }
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Balanza de Comprobación</h1>
        <p className="text-muted-foreground">Detalle de todos los movimientos contables y su afectación por cuenta</p>
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
        <div className="text-center py-8">Cargando balanza...</div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Movimientos Contables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead className="text-right">Debe</TableHead>
                      <TableHead className="text-right">Haber</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balanzaData?.movimientos.map((mov, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-sm">{mov.fecha}</TableCell>
                        <TableCell className="text-sm font-mono">{mov.referencia}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            {mov.tipo}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{mov.descripcion}</TableCell>
                        <TableCell className="font-mono text-sm">{mov.cuenta_codigo}</TableCell>
                        <TableCell>{mov.cuenta_nombre}</TableCell>
                        <TableCell className="text-right font-medium">
                          {mov.debe > 0 ? `$${mov.debe.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {mov.haber > 0 ? `$${mov.haber.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6 bg-primary/5">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Total Debe</div>
                  <div className="text-2xl font-bold">
                    ${balanzaData?.totales.debe.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Total Haber</div>
                  <div className="text-2xl font-bold">
                    ${balanzaData?.totales.haber.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Diferencia</div>
                  <div className={cn(
                    "text-2xl font-bold",
                    Math.abs(balanzaData?.totales.diferencia || 0) < 0.01 ? "text-green-600" : "text-red-600"
                  )}>
                    ${Math.abs(balanzaData?.totales.diferencia || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                  {Math.abs(balanzaData?.totales.diferencia || 0) < 0.01 && (
                    <div className="text-sm text-green-600 mt-1">✓ Balanza cuadrada</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Balanza;
