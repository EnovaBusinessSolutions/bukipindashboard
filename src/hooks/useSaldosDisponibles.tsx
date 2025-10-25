import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SaldosDisponibles {
  efectivo: number;
  bancos: number;
  total: number;
}

export const useSaldosDisponibles = () => {
  return useQuery({
    queryKey: ["saldos-disponibles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Obtener ingresos por método de pago
      const { data: ingresos } = await supabase
        .from("transacciones_ingresos")
        .select("monto_pagado, metodo_pago")
        .eq("user_id", user.id);

      // Obtener egresos por método de pago
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("monto_pagado, metodo_pago")
        .eq("user_id", user.id);

      // Obtener inversiones por método de pago
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("monto_pagado, metodo_pago")
        .eq("user_id", user.id);

      // Obtener movimientos de capital
      const { data: capital } = await supabase
        .from("transacciones_capital")
        .select("monto, tipo_movimiento")
        .eq("user_id", user.id);

      // Calcular saldo de efectivo (1001)
      const ingresosEfectivo = ingresos?.filter(i => i.metodo_pago === "efectivo")
        .reduce((sum, i) => sum + Number(i.monto_pagado), 0) || 0;
      
      const egresosEfectivo = egresos?.filter(e => e.metodo_pago === "efectivo")
        .reduce((sum, e) => sum + Number(e.monto_pagado), 0) || 0;
      
      const inversionesEfectivo = inversiones?.filter(i => i.metodo_pago === "efectivo")
        .reduce((sum, i) => sum + Number(i.monto_pagado), 0) || 0;

      const efectivo = ingresosEfectivo - egresosEfectivo - inversionesEfectivo;

      // Calcular saldo de bancos (1002)
      const ingresosBancos = ingresos?.filter(i => i.metodo_pago === "transferencia")
        .reduce((sum, i) => sum + Number(i.monto_pagado), 0) || 0;
      
      const egresosBancos = egresos?.filter(e => e.metodo_pago === "transferencia")
        .reduce((sum, e) => sum + Number(e.monto_pagado), 0) || 0;
      
      const inversionesBancos = inversiones?.filter(i => i.metodo_pago === "transferencia")
        .reduce((sum, i) => sum + Number(i.monto_pagado), 0) || 0;

      // Agregar capital social a bancos (aportaciones)
      const capitalAportaciones = capital?.filter(c => c.tipo_movimiento === "aportacion")
        .reduce((sum, c) => sum + Number(c.monto), 0) || 0;
      
      const capitalRetiros = capital?.filter(c => c.tipo_movimiento === "retiro")
        .reduce((sum, c) => sum + Number(c.monto), 0) || 0;

      const bancos = ingresosBancos - egresosBancos - inversionesBancos + capitalAportaciones - capitalRetiros;

      const saldos: SaldosDisponibles = {
        efectivo: Math.max(0, efectivo),
        bancos: Math.max(0, bancos),
        total: Math.max(0, efectivo + bancos)
      };

      return saldos;
    },
  });
};
