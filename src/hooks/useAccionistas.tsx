import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface Accionista {
  id: string;
  // en backend multi-tenant, el owner se resuelve por req.user; no hace falta mandarlo desde frontend
  nombre: string;
  porcentaje_participacion: number;
  email?: string;
  telefono?: string;
  rfc?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

type CrearAccionistaInput = {
  nombre: string;
  porcentaje_participacion: number;
  email?: string;
  telefono?: string;
  rfc?: string;
};

type ActualizarAccionistaInput = Partial<Omit<Accionista, "created_at" | "updated_at">> & {
  id: string;
};

type RedistribucionAccionistasInput = {
  nuevoAccionista?: CrearAccionistaInput;
  ajustes: Array<{
    id: string;
    porcentaje_participacion: number;
  }>;
  require_exact_total?: boolean;
};

export const useAccionistas = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accionistas = [], isLoading } = useQuery({
    queryKey: ["accionistas"],
    queryFn: async () => {
      // Debe regresar { data: Accionista[] } o Accionista[]
      const json = await apiFetch("/api/accionistas", { method: "GET" });
      const payload: any = (json as any)?.data ?? json;
      return (payload ?? []) as Accionista[];
    },
    staleTime: 60_000,
  });

  const crearAccionista = useMutation({
    mutationFn: async (accionista: CrearAccionistaInput) => {
      // Debe regresar { data: Accionista } o Accionista
      const json = await apiFetch("/api/accionistas", {
        method: "POST",
        body: JSON.stringify(accionista),
      });

      const payload: any = (json as any)?.data ?? json;
      return payload as Accionista;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accionistas"] });
      queryClient.invalidateQueries({ queryKey: ["accionistas-todos"] });
      toast({
        title: "Accionista creado",
        description: "El accionista ha sido registrado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo crear el accionista: " + (error?.message || "Error desconocido"),
        variant: "destructive",
      });
    },
  });

  const actualizarAccionista = useMutation({
    mutationFn: async ({ id, ...updates }: ActualizarAccionistaInput) => {
      // Debe regresar { data: Accionista } o Accionista
      const json = await apiFetch(`/api/accionistas/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });

      const payload: any = (json as any)?.data ?? json;
      return payload as Accionista;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accionistas"] });
      queryClient.invalidateQueries({ queryKey: ["accionistas-todos"] });
      toast({
        title: "Accionista actualizado",
        description: "Los datos del accionista han sido actualizados",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el accionista: " + (error?.message || "Error desconocido"),
        variant: "destructive",
      });
    },
  });

  const eliminarAccionista = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete -> activo:false
      await apiFetch(`/api/accionistas/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accionistas"] });
      queryClient.invalidateQueries({ queryKey: ["accionistas-todos"] });
      toast({
        title: "Accionista eliminado",
        description: "El accionista ha sido dado de baja",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el accionista: " + (error?.message || "Error desconocido"),
        variant: "destructive",
      });
    },
  });

  const redistribuirAccionistas = useMutation({
    mutationFn: async (payload: RedistribucionAccionistasInput) => {
      const json = await apiFetch("/api/accionistas/redistribucion", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const response: any = (json as any)?.data ?? json;
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accionistas"] });
      queryClient.invalidateQueries({ queryKey: ["accionistas-todos"] });
      toast({
        title: "Redistribución aplicada",
        description: "La estructura accionaria se actualizó correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          "No se pudo aplicar la redistribución: " + (error?.message || "Error desconocido"),
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
    redistribuirAccionistas,
  };
};
