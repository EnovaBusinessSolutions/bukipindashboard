import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export interface DeudorFinanciero {
  id: string;
  _id?: string;
  nombre: string;
  rfc: string;
  tipo: "persona" | "empresa";
  contacto?: string;
  telefono?: string;
  email?: string;
  comentarios?: string;
  activo: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const unwrap = <T,>(json: any): T => json?.data ?? json?.items ?? json?.item ?? json;
const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const asTrim = (v: unknown, def = "") => (v === undefined || v === null ? def : String(v).trim());

const normalize = (raw: any): DeudorFinanciero => ({
  id: asTrim(raw?.id || raw?._id),
  _id: raw?._id ? String(raw._id) : undefined,
  nombre: asTrim(raw?.nombre),
  rfc: asTrim(raw?.rfc).toUpperCase(),
  tipo: asTrim(raw?.tipo, "persona") === "empresa" ? "empresa" : "persona",
  contacto: asTrim(raw?.contacto),
  telefono: asTrim(raw?.telefono),
  email: asTrim(raw?.email),
  comentarios: asTrim(raw?.comentarios),
  activo: raw?.activo !== false,
  createdAt: raw?.createdAt ?? null,
  updatedAt: raw?.updatedAt ?? null,
});

export const useDeudoresFinancieros = (q = "", activo?: boolean) => {
  const queryClient = useQueryClient();
  const url = `/api/deudores-financieros?q=${encodeURIComponent(q)}${
    activo === undefined ? "" : `&activo=${activo ? "1" : "0"}`
  }`;

  const { data: deudores = [], isLoading, error } = useQuery({
    queryKey: ["deudores_financieros", q, activo],
    queryFn: async () => {
      const json = await apiFetch(url, { method: "GET" });
      return asArray<any>(unwrap<any>(json)).map(normalize);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["deudores_financieros"] });

  const crearDeudor = useMutation({
    mutationFn: async (payload: Omit<DeudorFinanciero, "id" | "_id" | "createdAt" | "updatedAt">) => {
      const json = await apiFetch("/api/deudores-financieros", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return normalize(unwrap<any>(json));
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Deudor registrado", description: "El deudor se registró correctamente." });
    },
    onError: (error: any) =>
      toast({
        title: "Error",
        description: error?.response?.data?.message || error?.message || "No se pudo registrar el deudor.",
        variant: "destructive",
      }),
  });

  const actualizarDeudor = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<DeudorFinanciero> & { id: string }) => {
      const json = await apiFetch(`/api/deudores-financieros/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return normalize(unwrap<any>(json));
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Deudor actualizado", description: "Los cambios se guardaron correctamente." });
    },
    onError: (error: any) =>
      toast({
        title: "Error",
        description: error?.response?.data?.message || error?.message || "No se pudo actualizar el deudor.",
        variant: "destructive",
      }),
  });

  return {
    deudores,
    isLoading,
    error,
    crearDeudor,
    actualizarDeudor,
    refresh,
  };
};
