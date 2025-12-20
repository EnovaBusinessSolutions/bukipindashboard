import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface GenerarDepreciacionesParams {
  mes?: number;
  ano?: number;
  origen?: "automatico" | "manual";
}

interface GenerarDepreciacionesResponse {
  success: boolean;
  mes: number; // 1-12
  ano: number;
  total_activos: number;
  asientos_creados: number;
  asientos_existentes: number;
  errores: string[];
  detalles: Array<{
    activo: string;
    numero_asiento: string;
    monto?: number;
    estado: "creado" | "ya_existe";
  }>;
}

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string } | T;

const unwrap = <T,>(json: ApiEnvelope<T>): T => {
  return (json as any)?.data ?? (json as T);
};

export const useGenerarDepreciaciones = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: GenerarDepreciacionesParams = {}) => {
      const payload: GenerarDepreciacionesParams = {
        ...params,
        origen: params.origen || "manual",
      };

      const json = await apiFetch("/api/depreciaciones/generar", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return unwrap<GenerarDepreciacionesResponse>(json);
    },
    onSuccess: (data) => {
      // invalidaciones (idénticas a tu versión)
      queryClient.invalidateQueries({ queryKey: ["asientos-depreciacion"] });
      queryClient.invalidateQueries({ queryKey: ["asientos-depreciacion-all"] });
      queryClient.invalidateQueries({ queryKey: ["inversiones"] });
      queryClient.invalidateQueries({ queryKey: ["asientos-contables"] });

      const mesNombre = new Date(data.ano, data.mes - 1).toLocaleString("es-MX", {
        month: "long",
        year: "numeric",
      });

      // Mensajes según resultado
      if (data.asientos_creados > 0 && data.asientos_existentes === 0) {
        toast({
          title: "✅ Depreciaciones generadas",
          description: `Se crearon ${data.asientos_creados} asiento(s) para ${mesNombre}.`,
        });
      } else if (data.asientos_creados === 0 && data.asientos_existentes > 0) {
        toast({
          title: "ℹ️ Sin cambios",
          description: `Las depreciaciones de ${mesNombre} ya fueron generadas anteriormente (${data.asientos_existentes} asiento(s)).`,
        });
      } else if (data.asientos_creados > 0 && data.asientos_existentes > 0) {
        toast({
          title: "⚠️ Parcialmente generado",
          description: `${data.asientos_creados} nuevo(s), ${data.asientos_existentes} ya existían para ${mesNombre}.`,
        });
      } else {
        toast({
          title: "⚠️ Sin asientos",
          description: `No se encontraron activos que requieran depreciación en ${mesNombre}.`,
        });
      }

      // Mostrar errores si hubo
      if (data.errores && data.errores.length > 0) {
        toast({
          title: "⚠️ Algunos errores",
          description: `${data.errores.length} error(es). Revisa la consola para detalles.`,
          variant: "destructive",
        });
        console.error("Errores al generar depreciaciones:", data.errores);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `No se pudieron generar las depreciaciones: ${error?.message || "Error desconocido"}`,
        variant: "destructive",
      });
    },
  });
};
