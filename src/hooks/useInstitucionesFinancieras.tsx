import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export interface InstitucionFinanciera {
  id: string;
  user_id: string;
  nombre: string;
  logo_url: string | null;
  ejecutivo_nombre: string | null;
  ejecutivo_telefono: string | null;
  ejecutivo_email: string | null;
  telefono_principal: string | null;
  email_principal: string | null;
  direccion: string | null;
  ciudad: string | null;
  estado: string | null;
  codigo_postal: string | null;
  sitio_web: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export const useInstitucionesFinancieras = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch instituciones
  const { data: instituciones, isLoading } = useQuery({
    queryKey: ["instituciones-financieras"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { data, error } = await supabase
        .from("instituciones_financieras")
        .select("*")
        .eq("user_id", user.id)
        .eq("activo", true)
        .order("nombre", { ascending: true });

      if (error) throw error;
      return data as InstitucionFinanciera[];
    },
  });

  // Suscripción en tiempo real
  useEffect(() => {
    const channel = supabase
      .channel("instituciones-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "instituciones_financieras",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["instituciones-financieras"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Crear institución
  const crearInstitucion = useMutation({
    mutationFn: async (data: Omit<InstitucionFinanciera, "id" | "user_id" | "created_at" | "updated_at" | "activo">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Verificar duplicados
      const { data: existente } = await supabase
        .from("instituciones_financieras")
        .select("id")
        .eq("user_id", user.id)
        .eq("nombre", data.nombre)
        .eq("activo", true)
        .single();

      if (existente) {
        throw new Error("Ya existe una institución con ese nombre");
      }

      const { data: nuevaInstitucion, error } = await supabase
        .from("instituciones_financieras")
        .insert({
          ...data,
          user_id: user.id,
          activo: true,
        })
        .select()
        .single();

      if (error) throw error;
      return nuevaInstitucion as InstitucionFinanciera;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instituciones-financieras"] });
      toast({
        title: "✅ Institución creada",
        description: "La institución financiera se registró correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error al crear institución",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Actualizar institución
  const actualizarInstitucion = useMutation({
    mutationFn: async ({ id, ...data }: Partial<InstitucionFinanciera> & { id: string }) => {
      const { error } = await supabase
        .from("instituciones_financieras")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instituciones-financieras"] });
      toast({
        title: "✅ Institución actualizada",
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

  // Eliminar institución (soft delete)
  const eliminarInstitucion = useMutation({
    mutationFn: async (id: string) => {
      // Verificar si tiene créditos activos
      const { data: creditosActivos } = await supabase
        .from("financiamientos")
        .select("id")
        .eq("institucion_financiera_id", id)
        .eq("estado", "activo");

      if (creditosActivos && creditosActivos.length > 0) {
        throw new Error("No se puede eliminar una institución con créditos activos");
      }

      const { error } = await supabase
        .from("instituciones_financieras")
        .update({ activo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instituciones-financieras"] });
      toast({
        title: "✅ Institución eliminada",
        description: "La institución se dio de baja correctamente",
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
    instituciones: instituciones || [],
    isLoading,
    crearInstitucion,
    actualizarInstitucion,
    eliminarInstitucion,
  };
};
