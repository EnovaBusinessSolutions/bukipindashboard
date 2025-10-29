import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, ChevronDown, ChevronRight } from "lucide-react";
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

interface AsientoAgrupado {
  referencia: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  movimientos: BalanzaEntry[];
  totalDebe: number;
  totalHaber: number;
  categoriaFlujo?: string;
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

      // Obtener transacciones de capital
      const { data: capital } = await supabase
        .from("transacciones_capital")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      capital?.forEach(transaccion => {
        if (transaccion.tipo_movimiento === 'aportacion') {
          // Aportación: Debe en Efectivo, Haber en Capital Social
          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Capital",
            descripcion: `Aportación de ${transaccion.socio}`,
            cuenta_codigo: "1001",
            cuenta_nombre: "Efectivo/Bancos",
            debe: transaccion.monto,
            haber: 0,
            referencia: `CAP-${transaccion.id.slice(0, 8)}`
          });

          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Capital",
            descripcion: `Aportación de ${transaccion.socio}`,
            cuenta_codigo: "3001",
            cuenta_nombre: "Capital Social",
            debe: 0,
            haber: transaccion.monto,
            referencia: `CAP-${transaccion.id.slice(0, 8)}`
          });
        } else if (transaccion.tipo_movimiento === 'dividendo') {
          // Dividendo: Debe en Utilidades Retenidas, Haber en Efectivo
          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Capital",
            descripcion: `Dividendo pagado a ${transaccion.socio}`,
            cuenta_codigo: "3002",
            cuenta_nombre: "Utilidades Retenidas",
            debe: transaccion.monto,
            haber: 0,
            referencia: `DIV-${transaccion.id.slice(0, 8)}`
          });

          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Capital",
            descripcion: `Dividendo pagado a ${transaccion.socio}`,
            cuenta_codigo: "1001",
            cuenta_nombre: "Efectivo/Bancos",
            debe: 0,
            haber: transaccion.monto,
            referencia: `DIV-${transaccion.id.slice(0, 8)}`
          });
        }
      });

      // Obtener transacciones de financiamientos
      const { data: financiamientos } = await supabase
        .from("transacciones_financiamientos")
        .select("*, financiamientos(nombre, tipo_credito, cuenta_codigo)")
        .gte("fecha", startDate.toISOString().split('T')[0])
        .lte("fecha", endDate.toISOString().split('T')[0])
        .order("fecha", { ascending: true });

      financiamientos?.forEach(transaccion => {
        const financiamiento = transaccion.financiamientos as any;
        const cuentaCredito = financiamiento?.cuenta_codigo || "2101";

        if (transaccion.tipo_transaccion === 'disposicion') {
          // Disposición: Debe en Bancos, Haber en Crédito
          movimientos.push({
            fecha: format(new Date(transaccion.fecha), "dd/MM/yyyy"),
            tipo: "Financiamiento",
            descripcion: `Disposición ${financiamiento?.nombre || 'crédito'}`,
            cuenta_codigo: "1002",
            cuenta_nombre: "Bancos",
            debe: transaccion.monto,
            haber: 0,
            referencia: `FIN-${transaccion.id.slice(0, 8)}`
          });

          movimientos.push({
            fecha: format(new Date(transaccion.fecha), "dd/MM/yyyy"),
            tipo: "Financiamiento",
            descripcion: `Disposición ${financiamiento?.nombre || 'crédito'}`,
            cuenta_codigo: cuentaCredito,
            cuenta_nombre: "Crédito Bancario",
            debe: 0,
            haber: transaccion.monto,
            referencia: `FIN-${transaccion.id.slice(0, 8)}`
          });
        } else if (transaccion.tipo_transaccion === 'amortizacion') {
          // Amortización de capital: Debe en Crédito, Haber en Bancos
          if (transaccion.capital_pagado > 0) {
            movimientos.push({
              fecha: format(new Date(transaccion.fecha), "dd/MM/yyyy"),
              tipo: "Financiamiento",
              descripcion: `Amortización ${financiamiento?.nombre || 'crédito'}`,
              cuenta_codigo: cuentaCredito,
              cuenta_nombre: "Crédito Bancario",
              debe: transaccion.capital_pagado,
              haber: 0,
              referencia: `FIN-${transaccion.id.slice(0, 8)}`
            });

            movimientos.push({
              fecha: format(new Date(transaccion.fecha), "dd/MM/yyyy"),
              tipo: "Financiamiento",
              descripcion: `Amortización ${financiamiento?.nombre || 'crédito'}`,
              cuenta_codigo: "1002",
              cuenta_nombre: "Bancos",
              debe: 0,
              haber: transaccion.capital_pagado,
              referencia: `FIN-${transaccion.id.slice(0, 8)}`
            });
          }

          // Pago de intereses: Debe en Gastos Financieros, Haber en Bancos
          if (transaccion.interes_pagado > 0) {
            movimientos.push({
              fecha: format(new Date(transaccion.fecha), "dd/MM/yyyy"),
              tipo: "Financiamiento",
              descripcion: `Intereses ${financiamiento?.nombre || 'crédito'}`,
              cuenta_codigo: "5301",
              cuenta_nombre: "Gastos Financieros",
              debe: transaccion.interes_pagado,
              haber: 0,
              referencia: `INT-${transaccion.id.slice(0, 8)}`
            });

            movimientos.push({
              fecha: format(new Date(transaccion.fecha), "dd/MM/yyyy"),
              tipo: "Financiamiento",
              descripcion: `Intereses ${financiamiento?.nombre || 'crédito'}`,
              cuenta_codigo: "1002",
              cuenta_nombre: "Bancos",
              debe: 0,
              haber: transaccion.interes_pagado,
              referencia: `INT-${transaccion.id.slice(0, 8)}`
            });
          }
        } else if (transaccion.tipo_transaccion === 'cargo_interes') {
          // Cargo de interés sin pago: Debe en Gastos Financieros, Haber en Crédito
          if (transaccion.interes_pagado > 0) {
            movimientos.push({
              fecha: format(new Date(transaccion.fecha), "dd/MM/yyyy"),
              tipo: "Financiamiento",
              descripcion: `Cargo intereses ${financiamiento?.nombre || 'crédito'}`,
              cuenta_codigo: "5301",
              cuenta_nombre: "Gastos Financieros",
              debe: transaccion.interes_pagado,
              haber: 0,
              referencia: `CIN-${transaccion.id.slice(0, 8)}`
            });

            movimientos.push({
              fecha: format(new Date(transaccion.fecha), "dd/MM/yyyy"),
              tipo: "Financiamiento",
              descripcion: `Cargo intereses ${financiamiento?.nombre || 'crédito'}`,
              cuenta_codigo: cuentaCredito,
              cuenta_nombre: "Crédito Bancario",
              debe: 0,
              haber: transaccion.interes_pagado,
              referencia: `CIN-${transaccion.id.slice(0, 8)}`
            });
          }
        }
      });

      // Obtener transacciones de impuestos
      const { data: impuestos } = await supabase
        .from("transacciones_impuestos")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      impuestos?.forEach(impuesto => {
        // Provisión de ISR: Debe en ISR, Haber en Impuestos por Pagar
        if (impuesto.isr_real > 0) {
          movimientos.push({
            fecha: format(new Date(impuesto.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Impuesto",
            descripcion: `ISR ${impuesto.mes}/${impuesto.ano}`,
            cuenta_codigo: "6001",
            cuenta_nombre: "ISR",
            debe: impuesto.isr_real,
            haber: 0,
            referencia: `ISR-${impuesto.id.slice(0, 8)}`
          });

          movimientos.push({
            fecha: format(new Date(impuesto.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Impuesto",
            descripcion: `ISR ${impuesto.mes}/${impuesto.ano}`,
            cuenta_codigo: "2002",
            cuenta_nombre: "Impuestos por Pagar",
            debe: 0,
            haber: impuesto.isr_real,
            referencia: `ISR-${impuesto.id.slice(0, 8)}`
          });
        }
      });

      // Calcular y registrar depreciaciones mensuales
      const { data: inversionesActivas } = await supabase
        .from("inversiones_capex")
        .select("*")
        .eq("estado", "activo")
        .not("fecha_inicio_depreciacion", "is", null);

      // Agrupar depreciaciones por mes
      const depreciaciones: Record<string, number> = {};
      
      inversionesActivas?.forEach(inversion => {
        if (!inversion.fecha_inicio_depreciacion || !inversion.valor_depreciacion_mensual) return;

        const inicioDepr = new Date(inversion.fecha_inicio_depreciacion);
        const finPeriodo = endDate;

        // Iterar por cada mes desde el inicio de depreciación hasta el fin del periodo
        let fechaActual = new Date(inicioDepr);
        while (fechaActual <= finPeriodo && fechaActual >= startDate) {
          const mesKey = format(fechaActual, "yyyy-MM");
          
          if (!depreciaciones[mesKey]) {
            depreciaciones[mesKey] = 0;
          }
          depreciaciones[mesKey] += Number(inversion.valor_depreciacion_mensual);

          // Avanzar al siguiente mes
          fechaActual.setMonth(fechaActual.getMonth() + 1);
        }
      });

      // Crear asientos de depreciación por mes
      Object.entries(depreciaciones).forEach(([mesKey, monto]) => {
        const [ano, mes] = mesKey.split('-');
        const fechaDep = new Date(Number(ano), Number(mes) - 1, 1);

        movimientos.push({
          fecha: format(fechaDep, "dd/MM/yyyy"),
          tipo: "Depreciación",
          descripcion: `Depreciación del mes ${mes}/${ano}`,
          cuenta_codigo: "5201",
          cuenta_nombre: "Depreciaciones",
          debe: monto,
          haber: 0,
          referencia: `DEP-${mesKey}`
        });

        movimientos.push({
          fecha: format(fechaDep, "dd/MM/yyyy"),
          tipo: "Depreciación",
          descripcion: `Depreciación del mes ${mes}/${ano}`,
          cuenta_codigo: "1304",
          cuenta_nombre: "Depreciación Acumulada",
          debe: 0,
          haber: monto,
          referencia: `DEP-${mesKey}`
        });
      });

      // Obtener transacciones de cobros y pagos
      const { data: cobrosPagos } = await supabase
        .from("transacciones_cobros_pagos")
        .select("*")
        .gte("fecha", startDate.toISOString().split('T')[0])
        .lte("fecha", endDate.toISOString().split('T')[0])
        .order("fecha", { ascending: true });

      cobrosPagos?.forEach(transaccion => {
        if (transaccion.tipo_transaccion === 'cobro') {
          // Cobro: Debe en Efectivo/Bancos, Haber en Cuentas por Cobrar
          const esEfectivo = transaccion.metodo_pago === 'efectivo';
          const cuentaCaja = esEfectivo ? '1001' : '1002';
          const nombreCaja = esEfectivo ? 'Efectivo' : 'Bancos';

          movimientos.push({
            fecha: format(new Date(transaccion.fecha), "dd/MM/yyyy"),
            tipo: "Cobro",
            descripcion: transaccion.descripcion || 'Cobro de cuenta',
            cuenta_codigo: cuentaCaja,
            cuenta_nombre: nombreCaja,
            debe: transaccion.monto,
            haber: 0,
            referencia: `COB-${transaccion.id.slice(0, 8)}`
          });

          movimientos.push({
            fecha: format(new Date(transaccion.fecha), "dd/MM/yyyy"),
            tipo: "Cobro",
            descripcion: transaccion.descripcion || 'Cobro de cuenta',
            cuenta_codigo: "1003",
            cuenta_nombre: "Cuentas por Cobrar",
            debe: 0,
            haber: transaccion.monto,
            referencia: `COB-${transaccion.id.slice(0, 8)}`
          });
        } else if (transaccion.tipo_transaccion === 'pago') {
          // Pago: Debe en Cuentas por Pagar, Haber en Efectivo/Bancos
          const esEfectivo = transaccion.metodo_pago === 'efectivo';
          const cuentaCaja = esEfectivo ? '1001' : '1002';
          const nombreCaja = esEfectivo ? 'Efectivo' : 'Bancos';

          movimientos.push({
            fecha: format(new Date(transaccion.fecha), "dd/MM/yyyy"),
            tipo: "Pago",
            descripcion: transaccion.descripcion || 'Pago de cuenta',
            cuenta_codigo: "2001",
            cuenta_nombre: "Cuentas por Pagar",
            debe: transaccion.monto,
            haber: 0,
            referencia: `PAG-${transaccion.id.slice(0, 8)}`
          });

          movimientos.push({
            fecha: format(new Date(transaccion.fecha), "dd/MM/yyyy"),
            tipo: "Pago",
            descripcion: transaccion.descripcion || 'Pago de cuenta',
            cuenta_codigo: cuentaCaja,
            cuenta_nombre: nombreCaja,
            debe: 0,
            haber: transaccion.monto,
            referencia: `PAG-${transaccion.id.slice(0, 8)}`
          });
        }
      });

      // Agrupar movimientos por referencia
      const asientosMap = new Map<string, AsientoAgrupado>();
      
      movimientos.forEach(mov => {
        if (!asientosMap.has(mov.referencia)) {
          // Determinar categoría de flujo de efectivo
          let categoriaFlujo: string | undefined;
          const afectaEfectivo = movimientos.some(m => 
            m.referencia === mov.referencia && 
            (m.cuenta_codigo === '1001' || m.cuenta_codigo === '1002')
          );
          
          if (afectaEfectivo) {
            if (mov.tipo === 'Inversión') {
              categoriaFlujo = 'Inversión';
            } else if (mov.tipo === 'Financiamiento') {
              categoriaFlujo = 'Financiamiento';
            } else if (mov.tipo === 'Capital') {
              categoriaFlujo = 'Financiamiento';
            } else {
              categoriaFlujo = 'Operativo';
            }
          }
          
          asientosMap.set(mov.referencia, {
            referencia: mov.referencia,
            fecha: mov.fecha,
            tipo: mov.tipo,
            descripcion: mov.descripcion,
            movimientos: [],
            totalDebe: 0,
            totalHaber: 0,
            categoriaFlujo
          });
        }
        
        const asiento = asientosMap.get(mov.referencia)!;
        asiento.movimientos.push(mov);
        asiento.totalDebe += mov.debe;
        asiento.totalHaber += mov.haber;
      });

      const asientosAgrupados = Array.from(asientosMap.values());

      // Calcular totales
      const totalDebe = movimientos.reduce((sum, m) => sum + m.debe, 0);
      const totalHaber = movimientos.reduce((sum, m) => sum + m.haber, 0);

      return {
        asientos: asientosAgrupados,
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
              <CardTitle>Asientos Contables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {balanzaData?.asientos.map((asiento, index) => (
                  <Collapsible key={index} className="border rounded-lg">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4 flex-1">
                          <ChevronRight className="h-4 w-4 transition-transform [&[data-state=open]]:rotate-90" />
                          <div className="text-left">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm font-medium">{asiento.referencia}</span>
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {asiento.tipo}
                              </span>
                              {asiento.categoriaFlujo && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                  Flujo: {asiento.categoriaFlujo}
                                </span>
                              )}
                              <span className="text-sm text-muted-foreground">{asiento.fecha}</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">{asiento.descripcion}</div>
                          </div>
                        </div>
                        <div className="flex gap-6 mr-4">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Debe</div>
                            <div className="font-medium">
                              ${asiento.totalDebe.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Haber</div>
                            <div className="font-medium">
                              ${asiento.totalHaber.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t bg-muted/30">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Código</TableHead>
                              <TableHead>Cuenta</TableHead>
                              <TableHead className="text-right">Debe</TableHead>
                              <TableHead className="text-right">Haber</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {asiento.movimientos.map((mov, movIndex) => (
                              <TableRow key={movIndex}>
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
                    </CollapsibleContent>
                  </Collapsible>
                ))}
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
