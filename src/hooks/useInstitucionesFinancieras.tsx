import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

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

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string } | T;
const unwrap = <T,>(json: ApiEnvelope<T>): T => (json as any)?.data ?? (json as T);

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

export const useInstitucionesFinancieras = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["instituciones-financieras"],
    queryFn: async () => {
      const json = await apiFetch("/api/instituciones-financieras", { method: "GET" });
      const data = unwrap<InstitucionFinanciera[]>(json) || [];
      return data.filter((i) => i.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
  });

  // (Opcional) Si quieres refrescar cada X tiempo en lugar de realtime:
  useEffect(() => {
    // Si no quieres polling, borra este efecto
    const t = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["instituciones-financieras"] });
    }, 60_000);
    return () => clearInterval(t);
  }, [queryClient]);

  const crearInstitucion = useMutation({
    mutationFn: async (
      payload: Omit<InstitucionFinanciera, "id" | "user_id" | "created_at" | "updated_at" | "activo">
    ) => {
      // Verificar duplicados (frontend guardrail; backend debe validar también)
      const existentes = queryClient.getQueryData<InstitucionFinanciera[]>(["instituciones-financieras"]) || [];
      const yaExiste = existentes.some((i) => i.activo !== false && norm(i.nombre) === norm(payload.nombre));
      if (yaExiste) throw new Error("Ya existe una institución con ese nombre");

      const json = await apiFetch("/api/instituciones-financieras", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return unwrap<InstitucionFinanciera>(json);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instituciones-financieras"] });
      toast({
        title: "✅ Institución creada",
        description: "La institución financiera se registró correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al crear institución",
        description: error?.message || "No se pudo crear la institución",
        variant: "destructive",
      });
    },
  });

  const actualizarInstitucion = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<InstitucionFinanciera> & { id: string }) => {
      const json = await apiFetch(`/api/instituciones-financieras/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return unwrap<InstitucionFinanciera>(json);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instituciones-financieras"] });
      toast({
        title: "✅ Institución actualizada",
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

  const eliminarInstitucion = useMutation({
    mutationFn: async (id: string) => {
      // Validar si tiene créditos activos (E2E sin Supabase)
      const p = new URLSearchParams();
      p.set("institucion_financiera_id", id);
      p.set("estado", "activo");

      const finJson = await apiFetch(`/api/financiamientos?${p.toString()}`, { method: "GET" });
      const creditos = unwrap<any[]>(finJson) || [];

      if (creditos.length > 0) {
        throw new Error("No se puede eliminar una institución con créditos activos");
      }

      // Soft delete en backend (DELETE que marca activo=false)
      await apiFetch(`/api/instituciones-financieras/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      return { ok: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instituciones-financieras"] });
      toast({
        title: "✅ Institución eliminada",
        description: "La institución se dio de baja correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al eliminar",
        description: error?.message || "No se pudo eliminar la institución",
        variant: "destructive",
      });
    },
  });

  return {
    instituciones: query.data || [],
    isLoading: query.isLoading,
    crearInstitucion,
    actualizarInstitucion,
    eliminarInstitucion,
  };
};
