import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export interface AutoridadFiscal {
  id: string;
  user_id: string;
  nombre: string;
  rfc: string | null;
  logo_url: string | null;
  pais: string;
  telefono: string | null;
  email: string | null;
  sitio_web: string | null;
  direccion: string | null;
  notas: string | null;
  cuenta_bancaria: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export const useAutoridadesFiscales = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch autoridades
  const { data: autoridades, isLoading } = useQuery({
    queryKey: ["autoridades-fiscales"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { data, error } = await supabase
        .from("autoridades_fiscales" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("activo", true)
        .order("nombre", { ascending: true });

      if (error) throw error;
      return data as unknown as AutoridadFiscal[];
    },
  });

  // Suscripción en tiempo real
  useEffect(() => {
    const channel = supabase
      .channel("autoridades-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "autoridades_fiscales",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["autoridades-fiscales"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Crear autoridad
  const crearAutoridad = useMutation({
    mutationFn: async (data: Omit<AutoridadFiscal, "id" | "user_id" | "created_at" | "updated_at" | "activo">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Verificar duplicados
      const { data: existente } = await supabase
        .from("autoridades_fiscales" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("nombre", data.nombre)
        .eq("activo", true)
        .single();

      if (existente) {
        throw new Error("Ya existe una autoridad fiscal con ese nombre");
      }

      const { data: nuevaAutoridad, error } = await supabase
        .from("autoridades_fiscales" as any)
        .insert({
          ...data,
          user_id: user.id,
          activo: true,
        })
        .select()
        .single();

      if (error) throw error;
      return nuevaAutoridad as unknown as AutoridadFiscal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autoridades-fiscales"] });
      toast({
        title: "✅ Autoridad creada",
        description: "La autoridad fiscal se registró correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error al crear autoridad",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Actualizar autoridad
  const actualizarAutoridad = useMutation({
    mutationFn: async ({ id, ...data }: Partial<AutoridadFiscal> & { id: string }) => {
      const { error } = await supabase
        .from("autoridades_fiscales" as any)
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autoridades-fiscales"] });
      toast({
        title: "✅ Autoridad actualizada",
        description: "Los cambios se guardaron correctamente",
      });
    },
    onError: () => {
      toast({
        title: "❌ Error al actualizar",
        description: "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    },
  });

  // Eliminar autoridad (soft delete)
  const eliminarAutoridad = useMutation({
    mutationFn: async (id: string) => {
      // Verificar si tiene registros de impuestos asociados
      const { data: impuestosAsociados } = await supabase
        .from("transacciones_egresos")
        .select("id")
        .eq("tipo_egreso", "impuesto")
        .ilike("proveedor_nombre", `%${id}%`);

      if (impuestosAsociados && impuestosAsociados.length > 0) {
        throw new Error("No se puede eliminar una autoridad con registros de impuestos asociados");
      }

      const { error } = await supabase
        .from("autoridades_fiscales" as any)
        .update({ activo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autoridades-fiscales"] });
      toast({
        title: "✅ Autoridad eliminada",
        description: "La autoridad fiscal se dio de baja correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    autoridades: autoridades || [],
    isLoading,
    crearAutoridad,
    actualizarAutoridad,
    eliminarAutoridad,
  };
};
