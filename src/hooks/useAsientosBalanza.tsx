import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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

interface SaldoCuenta {
  cuenta_codigo: string;
  debe_total: number;
  haber_total: number;
  saldo: number;
}

export const useAsientosBalanza = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ["asientos-balanza", startDate, endDate],
    queryFn: async () => {
      const movimientos: BalanzaEntry[] = [];

      // Obtener ingresos
      const { data: ingresos } = await supabase
        .from("transacciones_ingresos")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      ingresos?.forEach(ingreso => {
        // Efectivo/Banco (Debe)
        if (ingreso.monto_pagado > 0) {
          movimientos.push({
            fecha: format(new Date(ingreso.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Ingreso",
            descripcion: ingreso.descripcion,
            cuenta_codigo: "1001",
            cuenta_nombre: "Efectivo/Bancos",
            debe: ingreso.monto_pagado,
            haber: 0,
            referencia: `ING-${ingreso.id.slice(0, 8)}`
          });
        }

        // Cuentas por Cobrar (Debe)
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

        // Descuentos (Debe)
        if (ingreso.monto_descuento > 0) {
          movimientos.push({
            fecha: format(new Date(ingreso.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Ingreso",
            descripcion: `Descuento - ${ingreso.descripcion}`,
            cuenta_codigo: "5300",
            cuenta_nombre: "Descuentos sobre Ventas",
            debe: ingreso.monto_descuento,
            haber: 0,
            referencia: `ING-${ingreso.id.slice(0, 8)}`
          });
        }

        // Ingresos (Haber) - usar monto_total
        movimientos.push({
          fecha: format(new Date(ingreso.created_at), "dd/MM/yyyy HH:mm"),
          tipo: "Ingreso",
          descripcion: ingreso.descripcion,
          cuenta_codigo: "4001",
          cuenta_nombre: "Ingresos",
          debe: 0,
          haber: ingreso.monto_total,
          referencia: `ING-${ingreso.id.slice(0, 8)}`
        });
      });

      // Obtener egresos
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      egresos?.forEach(egreso => {
        // Debe en Gasto/Costo
        movimientos.push({
          fecha: format(new Date(egreso.created_at), "dd/MM/yyyy HH:mm"),
          tipo: "Egreso",
          descripcion: egreso.descripcion,
          cuenta_codigo: egreso.cuenta_codigo || "5001",
          cuenta_nombre: egreso.tipo_egreso === "costo" ? "Costo de Ventas" : "Gastos",
          debe: egreso.monto_total,
          haber: 0,
          referencia: `EGR-${egreso.id.slice(0, 8)}`
        });

        // Haber en Efectivo/Bancos
        if (egreso.monto_pagado > 0) {
          movimientos.push({
            fecha: format(new Date(egreso.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Egreso",
            descripcion: egreso.descripcion,
            cuenta_codigo: "1001",
            cuenta_nombre: "Efectivo/Bancos",
            debe: 0,
            haber: egreso.monto_pagado,
            referencia: `EGR-${egreso.id.slice(0, 8)}`
          });
        }

        // Haber en Cuentas por Pagar
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
        // Activo Fijo (Debe)
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

        // Efectivo (Haber)
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

        // Cuentas por Pagar (Haber)
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
          // Efectivo (Debe)
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

          // Capital Social (Haber)
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
          // Utilidades Retenidas (Debe)
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

          // Efectivo (Haber)
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

      // Obtener financiamientos
      const { data: financiamientos } = await supabase
        .from("transacciones_financiamientos")
        .select("*, financiamientos(nombre, tipo_credito, cuenta_codigo)")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      financiamientos?.forEach(transaccion => {
        const financiamiento = transaccion.financiamientos as any;
        const cuentaCredito = financiamiento?.cuenta_codigo || "2101";

        if (transaccion.tipo_transaccion === 'desembolso' || transaccion.tipo_transaccion === 'disposicion') {
          // Bancos (Debe)
          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Financiamiento",
            descripcion: `Desembolso ${financiamiento?.nombre || 'crédito'}`,
            cuenta_codigo: "1002",
            cuenta_nombre: "Bancos",
            debe: transaccion.monto,
            haber: 0,
            referencia: `FIN-${transaccion.id.slice(0, 8)}`
          });

          // Crédito (Haber)
          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Financiamiento",
            descripcion: `Desembolso ${financiamiento?.nombre || 'crédito'}`,
            cuenta_codigo: cuentaCredito,
            cuenta_nombre: "Crédito Bancario",
            debe: 0,
            haber: transaccion.monto,
            referencia: `FIN-${transaccion.id.slice(0, 8)}`
          });
        } else if (transaccion.tipo_transaccion === 'amortizacion') {
          // Crédito (Debe)
          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Financiamiento",
            descripcion: `Amortización ${financiamiento?.nombre || 'crédito'}`,
            cuenta_codigo: cuentaCredito,
            cuenta_nombre: "Crédito Bancario",
            debe: transaccion.capital_pagado || 0,
            haber: 0,
            referencia: `FIN-${transaccion.id.slice(0, 8)}`
          });

          // Bancos (Haber)
          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Financiamiento",
            descripcion: `Amortización ${financiamiento?.nombre || 'crédito'}`,
            cuenta_codigo: "1002",
            cuenta_nombre: "Bancos",
            debe: 0,
            haber: transaccion.capital_pagado || 0,
            referencia: `FIN-${transaccion.id.slice(0, 8)}`
          });

          // Interés (Debe)
          if (transaccion.interes_pagado > 0) {
            movimientos.push({
              fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
              tipo: "Financiamiento",
              descripcion: `Interés ${financiamiento?.nombre || 'crédito'}`,
              cuenta_codigo: "5111",
              cuenta_nombre: "Gastos Financieros",
              debe: transaccion.interes_pagado,
              haber: 0,
              referencia: `FIN-${transaccion.id.slice(0, 8)}`
            });

            // Bancos (Haber)
            movimientos.push({
              fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
              tipo: "Financiamiento",
              descripcion: `Interés ${financiamiento?.nombre || 'crédito'}`,
              cuenta_codigo: "1002",
              cuenta_nombre: "Bancos",
              debe: 0,
              haber: transaccion.interes_pagado,
              referencia: `FIN-${transaccion.id.slice(0, 8)}`
            });
          }
        } else if (transaccion.tipo_transaccion === 'cargo_interes') {
          // Interés (Debe)
          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Financiamiento",
            descripcion: `Cargo por interés ${financiamiento?.nombre || 'crédito'}`,
            cuenta_codigo: "5111",
            cuenta_nombre: "Gastos Financieros",
            debe: transaccion.interes_pagado || 0,
            haber: 0,
            referencia: `FIN-${transaccion.id.slice(0, 8)}`
          });

          // Bancos (Haber)
          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Financiamiento",
            descripcion: `Cargo por interés ${financiamiento?.nombre || 'crédito'}`,
            cuenta_codigo: "1002",
            cuenta_nombre: "Bancos",
            debe: 0,
            haber: transaccion.interes_pagado || 0,
            referencia: `FIN-${transaccion.id.slice(0, 8)}`
          });
        }
      });

      // Obtener impuestos
      const { data: impuestos } = await supabase
        .from("transacciones_impuestos")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      impuestos?.forEach(impuesto => {
        // ISR (Debe)
        movimientos.push({
          fecha: format(new Date(impuesto.created_at), "dd/MM/yyyy HH:mm"),
          tipo: "Impuesto",
          descripcion: `ISR ${impuesto.mes}/${impuesto.ano}`,
          cuenta_codigo: "5200",
          cuenta_nombre: "ISR",
          debe: impuesto.isr_real,
          haber: 0,
          referencia: `IMP-${impuesto.id.slice(0, 8)}`
        });

        // Bancos (Haber)
        movimientos.push({
          fecha: format(new Date(impuesto.created_at), "dd/MM/yyyy HH:mm"),
          tipo: "Impuesto",
          descripcion: `Pago ISR ${impuesto.mes}/${impuesto.ano}`,
          cuenta_codigo: "1002",
          cuenta_nombre: "Bancos",
          debe: 0,
          haber: impuesto.isr_real,
          referencia: `IMP-${impuesto.id.slice(0, 8)}`
        });
      });

      // Obtener cobros/pagos
      const { data: cobrosPagos } = await supabase
        .from("transacciones_cobros_pagos")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      cobrosPagos?.forEach(transaccion => {
        if (transaccion.tipo_transaccion === 'cobro') {
          // Bancos (Debe)
          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Cobro",
            descripcion: transaccion.descripcion || 'Cobro',
            cuenta_codigo: "1002",
            cuenta_nombre: "Bancos",
            debe: transaccion.monto,
            haber: 0,
            referencia: `COB-${transaccion.id.slice(0, 8)}`
          });

          // Cuentas por Cobrar (Haber)
          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Cobro",
            descripcion: transaccion.descripcion || 'Cobro',
            cuenta_codigo: "1003",
            cuenta_nombre: "Cuentas por Cobrar",
            debe: 0,
            haber: transaccion.monto,
            referencia: `COB-${transaccion.id.slice(0, 8)}`
          });
        } else if (transaccion.tipo_transaccion === 'pago') {
          // Cuentas por Pagar (Debe)
          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Pago",
            descripcion: transaccion.descripcion || 'Pago',
            cuenta_codigo: "2001",
            cuenta_nombre: "Cuentas por Pagar",
            debe: transaccion.monto,
            haber: 0,
            referencia: `PAG-${transaccion.id.slice(0, 8)}`
          });

          // Bancos (Haber)
          movimientos.push({
            fecha: format(new Date(transaccion.created_at), "dd/MM/yyyy HH:mm"),
            tipo: "Pago",
            descripcion: transaccion.descripcion || 'Pago',
            cuenta_codigo: "1002",
            cuenta_nombre: "Bancos",
            debe: 0,
            haber: transaccion.monto,
            referencia: `PAG-${transaccion.id.slice(0, 8)}`
          });
        }
      });

      // Calcular saldos por cuenta
      const saldosPorCuenta: { [key: string]: SaldoCuenta } = {};

      movimientos.forEach((mov) => {
        const codigo = mov.cuenta_codigo;
        if (!saldosPorCuenta[codigo]) {
          saldosPorCuenta[codigo] = {
            cuenta_codigo: codigo,
            debe_total: 0,
            haber_total: 0,
            saldo: 0,
          };
        }
        saldosPorCuenta[codigo].debe_total += mov.debe;
        saldosPorCuenta[codigo].haber_total += mov.haber;
      });

      // Calcular saldo según naturaleza de la cuenta
      Object.values(saldosPorCuenta).forEach((cuenta) => {
        const codigo = cuenta.cuenta_codigo;
        
        if (codigo.startsWith("1")) {
          // Activos: Debe - Haber
          cuenta.saldo = cuenta.debe_total - cuenta.haber_total;
        } else if (codigo.startsWith("2") || codigo.startsWith("3")) {
          // Pasivos y Capital: Haber - Debe
          cuenta.saldo = cuenta.haber_total - cuenta.debe_total;
        } else if (codigo.startsWith("4")) {
          // Ingresos: Haber - Debe
          cuenta.saldo = cuenta.haber_total - cuenta.debe_total;
        } else if (codigo.startsWith("5")) {
          // Egresos/Gastos: Debe - Haber
          cuenta.saldo = cuenta.debe_total - cuenta.haber_total;
        }
      });

      return { movimientos, saldosPorCuenta };
    },
  });
};
