import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Accionista {
  id: string;
  user_id: string;
  nombre: string;
  porcentaje_participacion: number;
  email?: string;
  telefono?: string;
  rfc?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export const useAccionistas = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accionistas = [], isLoading } = useQuery({
    queryKey: ["accionistas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accionistas")
        .select("*")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      return data as Accionista[];
    },
  });

  const crearAccionista = useMutation({
    mutationFn: async (accionista: Omit<Accionista, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuario no autenticado");

      const { data, error } = await supabase
        .from("accionistas")
        .insert([{ ...accionista, user_id: userData.user.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accionistas"] });
      toast({
        title: "Accionista creado",
        description: "El accionista ha sido registrado exitosamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo crear el accionista: " + error.message,
        variant: "destructive",
      });
    },
  });

  const actualizarAccionista = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Accionista> & { id: string }) => {
      const { data, error } = await supabase
        .from("accionistas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accionistas"] });
      toast({
        title: "Accionista actualizado",
        description: "Los datos del accionista han sido actualizados",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el accionista: " + error.message,
        variant: "destructive",
      });
    },
  });

  const eliminarAccionista = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("accionistas")
        .update({ activo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accionistas"] });
      toast({
        title: "Accionista eliminado",
        description: "El accionista ha sido dado de baja",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el accionista: " + error.message,
        variant: "destructive",
      });
    },
  });

  return {
    accionistas,
    isLoading,
    crearAccionista,
    actualizarAccionista,
    eliminarAccionista,
  };
};
