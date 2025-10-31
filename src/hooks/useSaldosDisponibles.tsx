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

      // OBTENER TODO DESDE ASIENTOS CONTABLES - ÚNICA FUENTE DE VERDAD
      // Obtener saldo acumulado de efectivo (cuenta 1001) y bancos (cuenta 1002)
      const { data: detalles } = await supabase
        .from("detalle_asientos")
        .select("cuenta_codigo, debe, haber, asientos_contables!inner(user_id)")
        .in("cuenta_codigo", ["1001", "1002"])
        .eq("asientos_contables.user_id", user.id);

      let efectivo = 0;
      let bancos = 0;

      detalles?.forEach(detalle => {
        const saldo = (detalle.debe || 0) - (detalle.haber || 0);
        
        if (detalle.cuenta_codigo === "1001") {
          efectivo += saldo;
        } else if (detalle.cuenta_codigo === "1002") {
          bancos += saldo;
        }
      });

      const saldos: SaldosDisponibles = {
        efectivo: Math.max(0, efectivo),
        bancos: Math.max(0, bancos),
        total: Math.max(0, efectivo + bancos)
      };

      return saldos;
    },
  });
};
