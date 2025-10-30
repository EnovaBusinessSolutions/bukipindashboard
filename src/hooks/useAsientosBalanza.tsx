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
      // Consultar detalle_asientos con JOIN a asientos_contables y cuentas
      const { data: detalles, error } = await supabase
        .from("detalle_asientos")
        .select(`
          *,
          asientos_contables!inner(
            fecha,
            descripcion,
            numero_asiento
          )
        `)
        .gte("asientos_contables.fecha", startDate.toISOString().split("T")[0])
        .lte("asientos_contables.fecha", endDate.toISOString().split("T")[0])
        .order("asientos_contables.fecha", { ascending: true });

      if (error) {
        console.error("Error fetching detalle_asientos:", error);
        throw error;
      }

      // Obtener información de cuentas
      const { data: cuentasData } = await supabase
        .from("cuentas")
        .select("codigo, nombre");

      const cuentasMap = new Map(
        cuentasData?.map(c => [c.codigo, c.nombre]) || []
      );

      // Transformar los detalles a BalanzaEntry
      const movimientos: BalanzaEntry[] = (detalles || []).map((detalle: any) => {
        const asiento = detalle.asientos_contables;
        const numeroAsiento = asiento?.numero_asiento || "";
        
        // Determinar tipo basado en el prefijo del número de asiento
        let tipo = "Otro";
        if (numeroAsiento.startsWith("ING-")) tipo = "Ingreso";
        else if (numeroAsiento.startsWith("EGR-")) tipo = "Egreso";
        else if (numeroAsiento.startsWith("INV-")) tipo = "Inversión";
        else if (numeroAsiento.startsWith("CAP-")) tipo = "Capital";
        else if (numeroAsiento.startsWith("FIN-")) tipo = "Financiamiento";
        else if (numeroAsiento.startsWith("IMP-") || numeroAsiento.startsWith("ISR-")) tipo = "Impuesto";
        else if (numeroAsiento.startsWith("COB-")) tipo = "Cobro";
        else if (numeroAsiento.startsWith("PAG-")) tipo = "Pago";
        else if (numeroAsiento.startsWith("DEP-")) tipo = "Depreciación";

        return {
          fecha: asiento?.fecha ? format(new Date(asiento.fecha), "dd/MM/yyyy") : "",
          tipo,
          descripcion: detalle.descripcion || asiento?.descripcion || "",
          cuenta_codigo: detalle.cuenta_codigo,
          cuenta_nombre: cuentasMap.get(detalle.cuenta_codigo) || detalle.cuenta_codigo,
          debe: Number(detalle.debe) || 0,
          haber: Number(detalle.haber) || 0,
          referencia: numeroAsiento,
        };
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
        const primerDigito = cuenta.cuenta_codigo.charAt(0);
        
        // Cuentas de naturaleza deudora (Activos, Costos, Gastos, Impuestos)
        if (["1", "5", "6"].includes(primerDigito)) {
          cuenta.saldo = cuenta.debe_total - cuenta.haber_total;
        }
        // Cuentas de naturaleza acreedora (Pasivos, Capital, Ingresos)
        else if (["2", "3", "4"].includes(primerDigito)) {
          cuenta.saldo = cuenta.haber_total - cuenta.debe_total;
        }
      });

      return {
        movimientos,
        saldosPorCuenta,
      };
    },
  });
};
