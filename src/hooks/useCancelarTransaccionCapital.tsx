import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface CancelarTransaccionParams {
  transaccionId: string;
  motivoCancelacion: string;
}

type CancelarTransaccionResponse =
  | { ok: true; numeroAsientoReversion?: string; data?: any }
  | { numeroAsientoReversion?: string; [key: string]: any };

export const useCancelarTransaccionCapital = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transaccionId,
      motivoCancelacion,
    }: CancelarTransaccionParams) => {
      if (!transaccionId) throw new Error("transaccionId es requerido");
      if (!motivoCancelacion?.trim())
        throw new Error("Debes indicar un motivo de cancelación");

      const json = await apiFetch("/api/capital/cancelar", {
        method: "POST",
        body: JSON.stringify({ transaccionId, motivoCancelacion }),
      });

      // Soporta backend que devuelva {ok:true,data:{...}} o payload plano
      const payload = (json as any)?.data ?? json;

      // Validación mínima de respuesta (para UX)
      // Idealmente backend regresa numeroAsientoReversion
      return payload as CancelarTransaccionResponse;
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transacciones-capital"] });
      queryClient.invalidateQueries({ queryKey: ["asientos-capital"] });

      const numeroAsiento =
        (data as any)?.numeroAsientoReversion ||
        (data as any)?.numero_asiento_reversion;

      toast.success("Transacción cancelada exitosamente", {
        description: numeroAsiento
          ? `Se generó el asiento de reversión ${numeroAsiento}`
          : "Se generó el asiento de reversión correctamente",
      });
    },

    onError: (error: any) => {
      console.error("Error al cancelar transacción:", error);
      toast.error("Error al cancelar", {
        description: error?.message || "No se pudo cancelar la transacción",
      });
    },
  });
};
