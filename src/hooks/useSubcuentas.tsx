import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type Subcuenta = {
  id: string;
  nombre: string;
  cuenta_madre_codigo: string;
  user_id: string | null; // Nullable para prototipo
  created_at: string;
  updated_at: string;
};

export type SubcuentaWithCuentaMadre = Subcuenta & {
  nombreCuentaMadre: string;
};

export const useSubcuentas = () => {
  return useQuery({
    queryKey: ["subcuentas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcuentas")
        .select(`
          *,
          cuentas!subcuentas_cuenta_madre_codigo_fkey (nombre)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform to include cuenta madre name
      const subcuentasWithCuentaMadre: SubcuentaWithCuentaMadre[] = data?.map((subcuenta: any) => ({
        ...subcuenta,
        nombreCuentaMadre: subcuenta.cuentas?.nombre || "Cuenta no encontrada"
      })) || [];

      return subcuentasWithCuentaMadre;
    },
  });
};

export const useCreateSubcuenta = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ nombre, cuentaMadreCodigo }: { nombre: string; cuentaMadreCodigo: string }) => {
      // Para prototipo - no enviar user_id ya que es nullable
      const { data, error } = await supabase
        .from("subcuentas")
        .insert({
          nombre,
          cuenta_madre_codigo: cuentaMadreCodigo,
          // user_id se queda como null para prototipo
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcuentas"] });
      toast({
        title: "Subcuenta creada",
        description: "La subcuenta ha sido creada exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Error al crear la subcuenta: " + (error.message || "Error desconocido"),
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
      const { error } = await supabase
        .from("subcuentas")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcuentas"] });
      toast({
        title: "Subcuenta eliminada",
        description: "La subcuenta ha sido eliminada exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Error al eliminar la subcuenta",
        variant: "destructive",
      });
    },
  });
};