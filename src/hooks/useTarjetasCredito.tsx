import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TarjetaCredito {
  id: string;
  nombre: string;
  institucion_financiera: string;
  monto_total: number;
  saldo_actual: number;
  limite_disponible: number;
}

export const useTarjetasCredito = () => {
  return useQuery({
    queryKey: ["tarjetas-credito"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financiamientos")
        .select("*")
        .eq("tipo_credito", "tarjeta_corporativa")
        .eq("estado", "activo")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calcular límite disponible para cada tarjeta
      const tarjetas: TarjetaCredito[] = (data || []).map((t) => ({
        id: t.id,
        nombre: t.nombre,
        institucion_financiera: t.institucion_financiera,
        monto_total: t.monto_total,
        saldo_actual: t.saldo_actual,
        limite_disponible: t.monto_total - t.saldo_actual,
      }));

      return tarjetas;
    },
  });
};

export const validarLimiteCredito = (tarjetaId: string, montoTransaccion: number, tarjetas: TarjetaCredito[]) => {
  const tarjeta = tarjetas.find(t => t.id === tarjetaId);
  
  if (!tarjeta) {
    return {
      valido: false,
      mensaje: "Tarjeta de crédito no encontrada"
    };
  }

  if (montoTransaccion > tarjeta.limite_disponible) {
    return {
      valido: false,
      mensaje: `Límite de crédito excedido. Disponible: $${tarjeta.limite_disponible.toFixed(2)} / Solicitado: $${montoTransaccion.toFixed(2)}`
    };
  }

  return {
    valido: true,
    mensaje: "Límite de crédito válido"
  };
};
