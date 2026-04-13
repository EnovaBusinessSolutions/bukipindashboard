import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface CancelarTransaccionParams {
  transaccionId: string;
  motivoCancelacion: string;
}

type CancelarTransaccionResponse =
  | {
      ok: true;
      numeroAsientoReversion?: string;
      numero_asiento_reversion?: string;
      data?: unknown;
    }
  | {
      numeroAsientoReversion?: string;
      numero_asiento_reversion?: string;
      data?: unknown;
    };

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo cancelar la transaccion";

export const useCancelarTransaccionCapital = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transaccionId,
      motivoCancelacion,
    }: CancelarTransaccionParams) => {
      if (!transaccionId) throw new Error("transaccionId es requerido");
      if (!motivoCancelacion?.trim()) {
        throw new Error("Debes indicar un motivo de cancelacion");
      }

      const json = await apiFetch("/api/capital/cancelar", {
        method: "POST",
        body: JSON.stringify({ transaccionId, motivoCancelacion }),
      });

      return json as CancelarTransaccionResponse;
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transacciones-capital"] });
      queryClient.invalidateQueries({ queryKey: ["asientos-capital"] });
      queryClient.invalidateQueries({ queryKey: ["asientos-balanza"] });

      const numeroAsiento =
        data.numeroAsientoReversion ||
        data.numero_asiento_reversion;

      toast.success("Transaccion cancelada exitosamente", {
        description: numeroAsiento
          ? `Se genero el asiento de reversion ${numeroAsiento}`
          : "Se genero el asiento de reversion correctamente",
      });
    },

    onError: (error: unknown) => {
      console.error("Error al cancelar transaccion:", error);
      toast.error("Error al cancelar", {
        description: getErrorMessage(error),
      });
    },
  });
};
