import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

export type Subcuenta = {
  id: string;
  nombre: string;
  cuenta_madre_codigo: string;
  created_at: string;
  updated_at: string;
};

export type SubcuentaWithCuentaMadre = Subcuenta & {
  nombreCuentaMadre: string;
};

type AnyJson = any;

const normalize = <T,>(json: AnyJson, fallback: T): T => {
  return (json?.data ?? json ?? fallback) as T;
};

const normalizeArray = <T,>(json: AnyJson): T[] => {
  shown: {
    // (noop) just to keep TS from complaining in some setups
  };
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

export const useSubcuentas = () => {
  return useQuery<SubcuentaWithCuentaMadre[]>({
    queryKey: ["subcuentas"],
    queryFn: async () => {
      /**
       * ✅ Backend esperado:
       *   GET /api/subcuentas
       * Respuesta:
       *   [{ id, nombre, cuenta_madre_codigo, cuentaMadre?: { nombre } }]
       *   o { data: [...] }
       */
      const json: AnyJson = await apiFetch("/api/subcuentas", { method: "GET" });
      const items = normalizeArray<any>(json);

      const mapped: SubcuentaWithCuentaMadre[] = items.map((s: any) => ({
        id: String(s.id),
        nombre: String(s.nombre ?? ""),
        cuenta_madre_codigo: String(s.cuenta_madre_codigo ?? s.cuentaMadreCodigo ?? ""),
        created_at: String(s.created_at ?? ""),
        updated_at: String(s.updated_at ?? ""),
        // soporta varios shapes:
        nombreCuentaMadre:
          s?.cuentaMadre?.nombre ||
          s?.cuentas?.nombre || // compat si en backend lo llamas "cuentas"
          s?.nombreCuentaMadre ||
          "Cuenta no encontrada",
      }));

      // Orden desc por created_at (si tu backend ya lo manda ordenado, esto no estorba)
      mapped.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

      return mapped;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

// Hook específico para subcuentas de inventario
export const useSubcuentasInventario = () => {
  return useQuery<SubcuentaWithCuentaMadre[]>({
    queryKey: ["subcuentas-inventario"],
    queryFn: async () => {
      /**
       * ✅ Backend esperado:
       *   GET /api/subcuentas?cuenta_madre_codigo=1005,1006
       * o si prefieres:
       *   GET /api/subcuentas/inventario
       */
      const json: AnyJson = await apiFetch(
        "/api/subcuentas?cuenta_madre_codigo=1005,1006",
        { method: "GET" }
      );

      const items = normalizeArray<any>(json);

      const mapped: SubcuentaWithCuentaMadre[] = items.map((s: any) => ({
        id: String(s.id),
        nombre: String(s.nombre ?? ""),
        cuenta_madre_codigo: String(s.cuenta_madre_codigo ?? s.cuentaMadreCodigo ?? ""),
        created_at: String(s.created_at ?? ""),
        updated_at: String(s.updated_at ?? ""),
        nombreCuentaMadre:
          s?.cuentaMadre?.nombre ||
          s?.cuentas?.nombre ||
          s?.nombreCuentaMadre ||
          "Cuenta no encontrada",
      }));

      mapped.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      return mapped;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

export const useCreateSubcuenta = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      nombre,
      cuentaMadreCodigo,
    }: {
      nombre: string;
      cuentaMadreCodigo: string;
    }) => {
      /**
       * ✅ Backend esperado:
       *   POST /api/subcuentas
       * Body: { nombre, cuenta_madre_codigo }
       * Respuesta: objeto creado o { data: objeto }
       */
      const json: AnyJson = await apiFetch("/api/subcuentas", {
        method: "POST",
        body: JSON.stringify({
          nombre,
          cuenta_madre_codigo: cuentaMadreCodigo,
        }),
      });

      return normalize<Subcuenta>(json, {} as any);
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
        description:
          "Error al crear la subcuenta: " + (error?.message || "Error desconocido"),
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
      /**
       * ✅ Backend esperado:
       *   DELETE /api/subcuentas/:id
       */
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
