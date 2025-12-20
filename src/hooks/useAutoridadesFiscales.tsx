import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

export interface AutoridadFiscal {
  id: string;
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

type ApiList<T> = { ok?: boolean; data?: T } | T;

export const useAutoridadesFiscales = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ✅ LISTAR
  const { data: autoridades = [], isLoading } = useQuery({
    queryKey: ["autoridades-fiscales"],
    queryFn: async (): Promise<AutoridadFiscal[]> => {
      const json = await apiFetch("/api/autoridades-fiscales", { method: "GET" });
      const rows = (json as any)?.data ?? json;
      return Array.isArray(rows) ? (rows as AutoridadFiscal[]) : [];
    },
  });

  // (Opcional) Si quieres forzar refetch al montar, aquí está.
  useEffect(() => {
    // no-op por ahora
  }, []);

  // ✅ CREAR
  const crearAutoridad = useMutation({
    mutationFn: async (
      payload: Omit<AutoridadFiscal, "id" | "created_at" | "updated_at" | "activo">
    ): Promise<AutoridadFiscal> => {
      const json = await apiFetch("/api/autoridades-fiscales", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const autoridad = (json as any)?.data ?? json;
      if (!autoridad?.id) throw new Error("Respuesta inválida al crear autoridad fiscal");
      return autoridad as AutoridadFiscal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autoridades-fiscales"] });
      toast({
        title: "✅ Autoridad creada",
        description: "La autoridad fiscal se registró correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al crear autoridad",
        description: error?.message || "No se pudo crear la autoridad fiscal",
        variant: "destructive",
      });
    },
  });

  // ✅ ACTUALIZAR
  const actualizarAutoridad = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutoridadFiscal> & { id: string }) => {
      const json = await apiFetch(`/api/autoridades-fiscales/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });

      // Si backend devuelve {ok:true}, no necesitamos más.
      return (json as any)?.data ?? json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autoridades-fiscales"] });
      toast({
        title: "✅ Autoridad actualizada",
        description: "Los cambios se guardaron correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al actualizar",
        description: error?.message || "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    },
  });

  // ✅ ELIMINAR (soft delete)
  const eliminarAutoridad = useMutation({
    mutationFn: async (id: string) => {
      // Backend debe validar:
      // - si tiene impuestos asociados, bloquear
      // - si no, hacer soft delete activo=false
      await apiFetch(`/api/autoridades-fiscales/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autoridades-fiscales"] });
      toast({
        title: "✅ Autoridad eliminada",
        description: "La autoridad fiscal se dio de baja correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al eliminar",
        description: error?.message || "No se pudo eliminar la autoridad fiscal",
        variant: "destructive",
      });
    },
  });

  return {
    autoridades,
    isLoading,
    crearAutoridad,
    actualizarAutoridad,
    eliminarAutoridad,
  };
};
