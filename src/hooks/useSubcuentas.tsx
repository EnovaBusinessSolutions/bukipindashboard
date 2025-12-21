import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

type AnyJson = any;

/**
 * Normaliza respuestas del backend:
 * - payload plano: [...]
 * - { data: [...] }
 * - { ok:true, data:[...] }
 */
const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

const normalize = <T,>(json: AnyJson, fallback: T): T => {
  return (json?.data ?? json ?? fallback) as T;
};

// -----------------------------
// Types (compat + backend nuevo)
// -----------------------------

export type SubcuentaWithCuentaMadre = {
  id: string;

  // display
  nombre: string;

  // compat legacy UI
  cuenta_madre_codigo: string;
  nombreCuentaMadre?: string;

  // backend nuevo / útil para debug
  codigo?: string;
  type?: string;
  category?: string;

  created_at?: string;
  updated_at?: string;
};

// Helpers de normalización de fields
const str = (v: any) => (v == null ? "" : String(v));
const pickId = (x: any) => str(x?.id ?? x?._id);
const pickNombre = (x: any) => str(x?.nombre ?? x?.name ?? "");
const pickCodigo = (x: any) => str(x?.codigo ?? x?.code ?? "");
const pickParent = (x: any) => str(x?.cuenta_madre_codigo ?? x?.cuentaMadreCodigo ?? x?.parentCode ?? "");
const pickCreated = (x: any) => str(x?.created_at ?? x?.createdAt ?? "");
const pickUpdated = (x: any) => str(x?.updated_at ?? x?.updatedAt ?? "");

// -----------------------------
// Queries
// -----------------------------

export const useSubcuentas = () => {
  return useQuery<SubcuentaWithCuentaMadre[]>({
    queryKey: ["subcuentas"],
    queryFn: async () => {
      /**
       * Backend real (nuevo):
       *   GET /api/subcuentas
       * Respuesta:
       *   { ok:true, data:[ AccountSubcuenta ] }
       * donde AccountSubcuenta típicamente trae:
       *   { _id, code/codigo, name/nombre, type, category, parentCode, createdAt, updatedAt }
       */
      const json: AnyJson = await apiFetch("/api/subcuentas", { method: "GET" });
      const items = normalizeArray<any>(json);

      const mapped: SubcuentaWithCuentaMadre[] = items.map((s: any) => {
        const id = pickId(s);
        const parentCode = pickParent(s);

        return {
          id,
          nombre: pickNombre(s),

          // compat con UI anterior:
          cuenta_madre_codigo: parentCode,

          // backend nuevo:
          codigo: pickCodigo(s),
          type: str(s?.type ?? ""),
          category: str(s?.category ?? "general"),

          created_at: pickCreated(s),
          updated_at: pickUpdated(s),

          // si no viene el nombre de la madre, dejamos vacío/placeholder
          nombreCuentaMadre:
            str(s?.cuentaMadre?.nombre ?? s?.cuentas?.nombre ?? s?.nombreCuentaMadre ?? ""),
        };
      });

      // Orden: más nuevas primero (si hay created_at/createdAt)
      mapped.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      return mapped;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

/**
 * Subcuentas inventario:
 * Antes estabas llamando:
 *   /api/subcuentas?cuenta_madre_codigo=1005,1006
 *
 * Pero tu backend nuevo soporta:
 *   ?parentCode=XXXX (uno solo)
 *
 * Para dejarlo E2E sin tocar backend, hacemos:
 *  - GET /api/subcuentas
 *  - filtramos client-side por parentCode in [1005, 1006]
 */
export const useSubcuentasInventario = () => {
  return useQuery<SubcuentaWithCuentaMadre[]>({
    queryKey: ["subcuentas-inventario"],
    queryFn: async () => {
      const json: AnyJson = await apiFetch("/api/subcuentas", { method: "GET" });
      const items = normalizeArray<any>(json);

      const mapped: SubcuentaWithCuentaMadre[] = items.map((s: any) => {
        const id = pickId(s);
        const parentCode = pickParent(s);

        return {
          id,
          nombre: pickNombre(s),
          cuenta_madre_codigo: parentCode,
          codigo: pickCodigo(s),
          type: str(s?.type ?? ""),
          category: str(s?.category ?? "general"),
          created_at: pickCreated(s),
          updated_at: pickUpdated(s),
          nombreCuentaMadre: str(s?.nombreCuentaMadre ?? ""),
        };
      });

      const allowed = new Set(["1005", "1006"]);
      const filtered = mapped.filter((s) => allowed.has(String(s.cuenta_madre_codigo)));

      filtered.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      return filtered;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

// -----------------------------
// Mutations
// -----------------------------

export const useCreateSubcuenta = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      code,
      name,
      type,
      parentCode,
      category,
    }: {
      code: string;
      name: string;
      type: string;
      parentCode: string;
      category?: string;
    }) => {
      /**
       * Backend real (nuevo):
       *   POST /api/subcuentas
       * Body:
       *   { code, name, type, parentCode, category? }
       */
      const json: AnyJson = await apiFetch("/api/subcuentas", {
        method: "POST",
        body: JSON.stringify({
          code,
          name,
          type,
          parentCode,
          category: category ?? "general",
        }),
      });

      return normalize<any>(json, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcuentas"] });
      queryClient.invalidateQueries({ queryKey: ["subcuentas-inventario"] });

      toast({
        title: "Subcuenta creada",
        description: "La subcuenta ha sido creada exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Error al crear la subcuenta: " + (error?.message || "Error desconocido"),
        variant: "destructive",
      });
    },
  });
};

export const useDeleteSubcuenta = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/subcuentas/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcuentas"] });
      queryClient.invalidateQueries({ queryKey: ["subcuentas-inventario"] });

      toast({
        title: "Subcuenta eliminada",
        description: "La subcuenta ha sido eliminada exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Error al eliminar la subcuenta: " + (error?.message || ""),
        variant: "destructive",
      });
    },
  });
};
