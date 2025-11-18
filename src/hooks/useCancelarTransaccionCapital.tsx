import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CancelarTransaccionParams {
  transaccionId: string;
  motivoCancelacion: string;
}

export const useCancelarTransaccionCapital = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transaccionId, motivoCancelacion }: CancelarTransaccionParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No hay sesión activa");
      }

      const response = await supabase.functions.invoke('cancelar-transaccion-capital', {
        body: {
          transaccionId,
          motivoCancelacion
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Error al cancelar la transacción');
      }

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transacciones-capital"] });
      queryClient.invalidateQueries({ queryKey: ["asientos-capital"] });
      
      toast.success("Transacción cancelada exitosamente", {
        description: `Se generó el asiento de reversión ${data.numeroAsientoReversion}`
      });
    },
    onError: (error: Error) => {
      console.error("Error al cancelar transacción:", error);
      toast.error("Error al cancelar", {
        description: error.message
      });
    }
  });
};
