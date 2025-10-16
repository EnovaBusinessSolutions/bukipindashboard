import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Financiamiento {
  id: string;
  user_id: string;
  nombre: string;
  descripcion?: string;
  tipo_credito: string;
  monto_total: number;
  tasa_interes: number;
  plazo_meses: number;
  fecha_inicio: string;
  fecha_vencimiento: string;
  saldo_inicial: number;
  saldo_actual: number;
  institucion_financiera: string;
  numero_cuenta?: string;
  condiciones?: string;
  subcuenta_id?: string;
  cuenta_codigo?: string;
  estado: string;
  created_at: string;
  updated_at: string;
}

export interface TransaccionFinanciamiento {
  id: string;
  user_id: string;
  financiamiento_id: string;
  tipo_transaccion: string;
  monto: number;
  fecha: string;
  capital_pagado: number;
  interes_pagado: number;
  saldo_restante: number;
  descripcion?: string;
  metodo_pago?: string;
  numero_referencia?: string;
  created_at: string;
}

export const useFinanciamientos = () => {
  const queryClient = useQueryClient();

  const { data: financiamientos = [], isLoading } = useQuery({
    queryKey: ["financiamientos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financiamientos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Financiamiento[];
    },
  });

  const { data: transacciones = [] } = useQuery({
    queryKey: ["transacciones_financiamientos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacciones_financiamientos")
        .select("*")
        .order("fecha", { ascending: false });

      if (error) throw error;
      return data as TransaccionFinanciamiento[];
    },
  });

  const crearFinanciamiento = useMutation({
    mutationFn: async (financiamiento: Omit<Financiamiento, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { data, error } = await supabase
        .from("financiamientos")
        .insert([{ ...financiamiento, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financiamientos"] });
      toast({
        title: "Financiamiento registrado",
        description: "El financiamiento se ha registrado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const crearTransaccion = useMutation({
    mutationFn: async (transaccion: Omit<TransaccionFinanciamiento, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { data, error } = await supabase
        .from("transacciones_financiamientos")
        .insert([{ ...transaccion, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      // Actualizar saldo del financiamiento
      if (transaccion.financiamiento_id && transaccion.saldo_restante !== undefined) {
        await supabase
          .from("financiamientos")
          .update({ saldo_actual: transaccion.saldo_restante })
          .eq("id", transaccion.financiamiento_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transacciones_financiamientos"] });
      queryClient.invalidateQueries({ queryKey: ["financiamientos"] });
      toast({
        title: "Transacción registrada",
        description: "La transacción se ha registrado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    financiamientos,
    transacciones,
    isLoading,
    crearFinanciamiento,
    crearTransaccion,
  };
};
