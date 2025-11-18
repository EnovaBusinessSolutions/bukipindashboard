import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface TransaccionCapital {
  id: string;
  user_id: string;
  tipo_movimiento: "aportacion" | "dividendo";
  fecha: string;
  monto: number;
  socio: string;
  accionista_id: string | null;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
  estado: string;
  fecha_cancelacion?: string;
  motivo_cancelacion?: string;
  transaccion_cancelacion_id?: string;
}

export const useTransaccionesCapital = () => {
  const queryClient = useQueryClient();

  const { data: transacciones = [], isLoading } = useQuery({
    queryKey: ["transacciones-capital"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacciones_capital")
        .select("*")
        .order("fecha", { ascending: false });

      if (error) throw error;
      return data as TransaccionCapital[];
    },
  });

  const registrarTransaccion = useMutation({
    mutationFn: async (transaccion: {
      tipo_movimiento: "aportacion" | "dividendo";
      fecha: Date;
      monto: number;
      socio: string;
      accionista_id?: string;
      descripcion: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { data, error } = await supabase
        .from("transacciones_capital")
        .insert({
          user_id: user.id,
          tipo_movimiento: transaccion.tipo_movimiento,
          fecha: transaccion.fecha.toISOString().split("T")[0],
          monto: transaccion.monto,
          socio: transaccion.socio,
          accionista_id: transaccion.accionista_id || null,
          descripcion: transaccion.descripcion || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transacciones-capital"] });
      toast({
        title: "Registro exitoso",
        description: "La transacción de capital se ha registrado correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo registrar la transacción: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Calcular resúmenes
  const totalAportaciones = transacciones
    .filter((t) => t.tipo_movimiento === "aportacion")
    .reduce((sum, t) => sum + Number(t.monto), 0);

  const totalDividendos = transacciones
    .filter((t) => t.tipo_movimiento === "dividendo")
    .reduce((sum, t) => sum + Number(t.monto), 0);

  const capitalSocialTotal = totalAportaciones - totalDividendos;

  // Resumen por socio
  const resumenPorSocio = transacciones.reduce((acc, t) => {
    if (!acc[t.socio]) {
      acc[t.socio] = { aportaciones: 0, dividendos: 0, balance: 0 };
    }
    if (t.tipo_movimiento === "aportacion") {
      acc[t.socio].aportaciones += Number(t.monto);
    } else {
      acc[t.socio].dividendos += Number(t.monto);
    }
    acc[t.socio].balance = acc[t.socio].aportaciones - acc[t.socio].dividendos;
    return acc;
  }, {} as Record<string, { aportaciones: number; dividendos: number; balance: number }>);

  return {
    transacciones,
    isLoading,
    registrarTransaccion,
    totalAportaciones,
    totalDividendos,
    capitalSocialTotal,
    resumenPorSocio,
  };
};
