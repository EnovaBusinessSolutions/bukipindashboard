import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

export interface InstitucionFinanciera {
  id: string;
  _id?: string | null;

  nombre: string;
  alias?: string;
  slug?: string;

  tipo?: string;
  categoria?: string;
  codigo?: string;

  descripcion?: string;

  telefono?: string;
  email?: string;
  sitio_web?: string;
  sitioWeb?: string;

  contacto_nombre?: string;
  contactoNombre?: string;
  contacto_puesto?: string;
  contactoPuesto?: string;

  notas?: string;

  activo: boolean;
  scope?: "system" | "user" | string;
  isSystem?: boolean;

  owner?: string | null;
  user_id?: string;

  created_at?: string | null;
  updated_at?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  // Compat legacy/UI vieja
  logo_url?: string | null;
  ejecutivo_nombre?: string | null;
  ejecutivo_telefono?: string | null;
  ejecutivo_email?: string | null;
  telefono_principal?: string | null;
  email_principal?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  estado?: string | null;
  codigo_postal?: string | null;
}

type ApiEnvelope<T> = { ok?: boolean; data?: T; items?: T; message?: string } | T;
const unwrap = <T,>(json: ApiEnvelope<T>): T => (json as any)?.data ?? (json as T);

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

const getErrorMessage = (error: any, fallback: string) => {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
};

const normalizeInstitucion = (raw: any): InstitucionFinanciera => {
  const nombre = raw?.nombre || "";
  const telefono = raw?.telefono || raw?.telefono_principal || null;
  const email = raw?.email || raw?.email_principal || null;
  const sitioWeb = raw?.sitio_web || raw?.sitioWeb || null;
  const contactoNombre = raw?.contacto_nombre || raw?.contactoNombre || raw?.ejecutivo_nombre || null;
  const contactoPuesto = raw?.contacto_puesto || raw?.contactoPuesto || null;

  return {
    id: String(raw?.id || raw?._id || ""),
    _id: raw?._id ?? null,

    nombre,
    alias: raw?.alias || "",
    slug: raw?.slug || "",
    tipo: raw?.tipo || "otro",
    categoria: raw?.categoria || "otro",
    codigo: raw?.codigo || "",
    descripcion: raw?.descripcion || "",

    telefono,
    email,
    sitio_web: sitioWeb,
    sitioWeb,

    contacto_nombre: contactoNombre,
    contactoNombre,
    contacto_puesto: contactoPuesto,
    contactoPuesto,

    notas: raw?.notas || "",
    activo: raw?.activo !== false,
    scope: raw?.scope || "user",
    isSystem: !!raw?.isSystem,
    owner: raw?.owner ?? null,
    user_id: raw?.user_id ?? undefined,

    created_at: raw?.created_at || raw?.createdAt || null,
    updated_at: raw?.updated_at || raw?.updatedAt || null,
    createdAt: raw?.createdAt || raw?.created_at || null,
    updatedAt: raw?.updatedAt || raw?.updated_at || null,

    // Compat legacy para componentes que aún lean estos campos
    logo_url: raw?.logo_url ?? null,
    ejecutivo_nombre: contactoNombre,
    ejecutivo_telefono: raw?.ejecutivo_telefono ?? null,
    ejecutivo_email: raw?.ejecutivo_email ?? null,
    telefono_principal: telefono,
    email_principal: email,
    direccion: raw?.direccion ?? null,
    ciudad: raw?.ciudad ?? null,
    estado: raw?.estado ?? null,
    codigo_postal: raw?.codigo_postal ?? null,
  };
};

export const useInstitucionesFinancieras = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["instituciones-financieras"],
    queryFn: async () => {
      const json = await apiFetch("/api/instituciones-financieras", { method: "GET" });
      const data = unwrap<any[]>(json) || [];

      return data
        .map(normalizeInstitucion)
        .filter((i) => i.activo !== false)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    const t = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["instituciones-financieras"] });
    }, 60_000);

    return () => clearInterval(t);
  }, [queryClient]);

  const crearInstitucion = useMutation({
    mutationFn: async (
      payload: Partial<InstitucionFinanciera> & { nombre: string }
    ) => {
      const existentes =
        queryClient.getQueryData<InstitucionFinanciera[]>(["instituciones-financieras"]) || [];

      const yaExiste = existentes.some(
        (i) => i.activo !== false && norm(i.nombre) === norm(payload.nombre)
      );

      if (yaExiste) {
        throw new Error("Ya existe una institución con ese nombre");
      }

      const body = {
        nombre: payload.nombre,
        alias: payload.alias ?? "",
        tipo: payload.tipo ?? "banco",
        categoria: payload.categoria ?? "financiero",
        codigo: payload.codigo ?? "",
        descripcion: payload.descripcion ?? "",
        telefono: payload.telefono ?? payload.telefono_principal ?? "",
        email: payload.email ?? payload.email_principal ?? "",
        sitio_web: payload.sitio_web ?? payload.sitioWeb ?? "",
        contacto_nombre:
          payload.contacto_nombre ??
          payload.contactoNombre ??
          payload.ejecutivo_nombre ??
          "",
        contacto_puesto:
          payload.contacto_puesto ??
          payload.contactoPuesto ??
          "",
        notas: payload.notas ?? "",
        activo: payload.activo ?? true,
      };

      const json = await apiFetch("/api/instituciones-financieras", {
        method: "POST",
        body: JSON.stringify(body),
      });

      return normalizeInstitucion(unwrap<any>(json));
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
        description: getErrorMessage(error, "No se pudo crear la institución"),
        variant: "destructive",
      });
    },
  });

  const actualizarInstitucion = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<InstitucionFinanciera> & { id: string }) => {
      const body = {
        ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
        ...(patch.alias !== undefined ? { alias: patch.alias } : {}),
        ...(patch.tipo !== undefined ? { tipo: patch.tipo } : {}),
        ...(patch.categoria !== undefined ? { categoria: patch.categoria } : {}),
        ...(patch.codigo !== undefined ? { codigo: patch.codigo } : {}),
        ...(patch.descripcion !== undefined ? { descripcion: patch.descripcion } : {}),
        ...(patch.telefono !== undefined || patch.telefono_principal !== undefined
          ? { telefono: patch.telefono ?? patch.telefono_principal ?? "" }
          : {}),
        ...(patch.email !== undefined || patch.email_principal !== undefined
          ? { email: patch.email ?? patch.email_principal ?? "" }
          : {}),
        ...(patch.sitio_web !== undefined || patch.sitioWeb !== undefined
          ? { sitio_web: patch.sitio_web ?? patch.sitioWeb ?? "" }
          : {}),
        ...(patch.contacto_nombre !== undefined ||
        patch.contactoNombre !== undefined ||
        patch.ejecutivo_nombre !== undefined
          ? {
              contacto_nombre:
                patch.contacto_nombre ??
                patch.contactoNombre ??
                patch.ejecutivo_nombre ??
                "",
            }
          : {}),
        ...(patch.contacto_puesto !== undefined || patch.contactoPuesto !== undefined
          ? {
              contacto_puesto:
                patch.contacto_puesto ??
                patch.contactoPuesto ??
                "",
            }
          : {}),
        ...(patch.notas !== undefined ? { notas: patch.notas } : {}),
        ...(patch.activo !== undefined ? { activo: patch.activo } : {}),
      };

      const json = await apiFetch(`/api/instituciones-financieras/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      return normalizeInstitucion(unwrap<any>(json));
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
        description: getErrorMessage(error, "No se pudieron guardar los cambios"),
        variant: "destructive",
      });
    },
  });

  const eliminarInstitucion = useMutation({
    mutationFn: async (id: string) => {
      const p = new URLSearchParams();
      p.set("institucion_id", id);
      p.set("estatus", "activo");

      const finJson = await apiFetch(`/api/financiamientos?${p.toString()}`, {
        method: "GET",
      });

      const creditos = unwrap<any[]>(finJson) || [];

      if (creditos.length > 0) {
        throw new Error("No se puede eliminar una institución con financiamientos activos");
      }

      await apiFetch(`/api/instituciones-financieras/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      return { ok: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instituciones-financieras"] });
      toast({
        title: "✅ Institución eliminada",
        description: "La institución se eliminó correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al eliminar",
        description: getErrorMessage(error, "No se pudo eliminar la institución"),
        variant: "destructive",
      });
    },
  });

  return {
    instituciones: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    crearInstitucion,
    actualizarInstitucion,
    eliminarInstitucion,
  };
};