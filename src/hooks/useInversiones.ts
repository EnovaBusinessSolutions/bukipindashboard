import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
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
  estado: string;
  fecha_baja?: string;
  valor_venta?: number;
  motivo_baja?: string;

  metodo_pago_venta?: string;
  tipo_pago_venta?: string;
  monto_pagado_venta?: number;
  monto_pendiente_venta?: number;
  fecha_vencimiento_venta?: string;
  comprador_nombre?: string;
  comprador_rfc?: string;
  comprador_telefono?: string;
  comprador_email?: string;

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

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string } | T;
const unwrap = <T,>(json: ApiEnvelope<T>): T => (json as any)?.data ?? (json as T);

const toErrorMessage = (err: any) => {
  if (!err) return "Error desconocido";
  if (typeof err === "string") return err;
  return err?.message || err?.error || "Error desconocido";
};

export const useInversiones = () => {
  const queryClient = useQueryClient();

  const inversionesQuery = useQuery({
    queryKey: ["inversiones"],
    queryFn: async (): Promise<InversionCapex[]> => {
      const json = await apiFetch("/api/inversiones", { method: "GET" });
      const data = unwrap<InversionCapex[]>(json) || [];

      // Mantener el orden original del hook (fecha_adquisicion DESC)
      return [...data].sort(
        (a, b) => new Date(b.fecha_adquisicion).getTime() - new Date(a.fecha_adquisicion).getTime()
      );
    },
  });

  const recomendacionesQuery = useQuery({
    queryKey: ["recomendaciones_depreciacion"],
    queryFn: async (): Promise<RecomendacionDepreciacion[]> => {
      const json = await apiFetch("/api/recomendaciones-depreciacion", { method: "GET" });
      const data = unwrap<RecomendacionDepreciacion[]>(json) || [];

      return [...data].sort((a, b) => a.categoria_activo.localeCompare(b.categoria_activo));
    },
  });

  const crearInversion = useMutation({
    mutationFn: async (nuevaInversion: Omit<InversionCapex, "id" | "created_at" | "updated_at">) => {
      const json = await apiFetch("/api/inversiones", {
        method: "POST",
        body: JSON.stringify(nuevaInversion),
      });
      return unwrap<InversionCapex>(json);
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
        description: toErrorMessage(error) || "No se pudo registrar la inversión",
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
      const json = await apiFetch(`/api/inversiones/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(actualizacion),
      });
      return unwrap<InversionCapex>(json);
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
        description: toErrorMessage(error) || "No se pudo actualizar la inversión",
        variant: "destructive",
      });
    },
  });

  const eliminarInversion = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/inversiones/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return true;
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
        description: toErrorMessage(error) || "No se pudo eliminar la inversión",
        variant: "destructive",
      });
    },
  });

  const darDeBajaActivo = useMutation({
    mutationFn: async ({
      id,
      fecha_baja,
      motivo_baja,
      valor_venta,
      estado,
      metodo_pago_venta,
      tipo_pago_venta,
      monto_pagado_venta,
      monto_pendiente_venta,
      fecha_vencimiento_venta,
      comprador_nombre,
      comprador_rfc,
      comprador_telefono,
      comprador_email,
    }: {
      id: string;
      fecha_baja: string;
      motivo_baja: string;
      valor_venta?: number;
      estado: "vendido" | "dado_de_baja";
      metodo_pago_venta?: string;
      tipo_pago_venta?: string;
      monto_pagado_venta?: number;
      monto_pendiente_venta?: number;
      fecha_vencimiento_venta?: string;
      comprador_nombre?: string;
      comprador_rfc?: string;
      comprador_telefono?: string;
      comprador_email?: string;
    }) => {
      const patch: Partial<InversionCapex> = {
        estado,
        fecha_baja,
        motivo_baja,
        valor_venta,
        metodo_pago_venta,
        tipo_pago_venta,
        monto_pagado_venta,
        monto_pendiente_venta,
        fecha_vencimiento_venta,
        comprador_nombre,
        comprador_rfc,
        comprador_telefono,
        comprador_email,
      };

      // Limpieza ligera: evitar mandar undefined (backends estrictos lo agradecen)
      Object.keys(patch).forEach((k) => {
        if ((patch as any)[k] === undefined) delete (patch as any)[k];
      });

      const json = await apiFetch(`/api/inversiones/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });

      return unwrap<InversionCapex>(json);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inversiones"] });
      const mensaje = variables.estado === "vendido" ? "vendido" : "dado de baja";
      toast({
        title: "Activo actualizado",
        description: `El activo ha sido ${mensaje} correctamente`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: toErrorMessage(error) || "No se pudo dar de baja el activo",
        variant: "destructive",
      });
    },
  });

  return {
    inversiones: inversionesQuery.data || [],
    recomendaciones: recomendacionesQuery.data || [],
    isLoading: inversionesQuery.isLoading || recomendacionesQuery.isLoading,

    crearInversion,
    actualizarInversion,
    eliminarInversion,
    darDeBajaActivo,
  };
};
