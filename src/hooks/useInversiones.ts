import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface InversionCapex {
  id: string;
  user_id: string;
  producto_nombre: string;
  descripcion?: string;
  imagen_url?: string;
  valor_total: number;
  monto_pagado: number;
  monto_pendiente: number;
  tipo_pago: string;
  metodo_pago?: string;
  anos_depreciacion: number;
  valor_depreciacion_anual?: number;
  valor_depreciacion_mensual?: number;
  fecha_adquisicion: string;
  fecha_inicio_depreciacion?: string;
  proveedor_nombre?: string;
  proveedor_email?: string;
  proveedor_telefono?: string;
  proveedor_rfc?: string;
  categoria_activo: string;
  subcuenta_id?: string;
  cuenta_codigo?: string;
  comentarios?: string;
  created_at: string;
  updated_at: string;
}

export interface RecomendacionDepreciacion {
  id: string;
  categoria_activo: string;
  anos_recomendados: number;
  anos_minimos: number;
  anos_maximos: number;
  descripcion?: string;
  created_at: string;
}

export const useInversiones = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: inversiones = [], isLoading } = useQuery({
    queryKey: ["inversiones", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inversiones_capex")
        .select("*")
        .eq("user_id", user?.id)
        .order("fecha_adquisicion", { ascending: false });

      if (error) throw error;
      return data as InversionCapex[];
    },
    enabled: !!user?.id,
  });

  const { data: recomendaciones = [] } = useQuery({
    queryKey: ["recomendaciones_depreciacion"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recomendaciones_depreciacion")
        .select("*")
        .order("categoria_activo");

      if (error) throw error;
      return data as RecomendacionDepreciacion[];
    },
  });

  const crearInversion = useMutation({
    mutationFn: async (nuevaInversion: Omit<InversionCapex, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("inversiones_capex")
        .insert([{ ...nuevaInversion, user_id: user?.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inversiones"] });
      toast({
        title: "Inversión registrada",
        description: "La inversión CAPEX se ha registrado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar la inversión",
        variant: "destructive",
      });
    },
  });

  const actualizarInversion = useMutation({
    mutationFn: async ({
      id,
      actualizacion,
    }: {
      id: string;
      actualizacion: Partial<InversionCapex>;
    }) => {
      const { data, error } = await supabase
        .from("inversiones_capex")
        .update(actualizacion)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inversiones"] });
      toast({
        title: "Inversión actualizada",
        description: "La inversión se ha actualizado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la inversión",
        variant: "destructive",
      });
    },
  });

  const eliminarInversion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("inversiones_capex")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inversiones"] });
      toast({
        title: "Inversión eliminada",
        description: "La inversión se ha eliminado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la inversión",
        variant: "destructive",
      });
    },
  });

  return {
    inversiones,
    recomendaciones,
    isLoading,
    crearInversion,
    actualizarInversion,
    eliminarInversion,
  };
};
