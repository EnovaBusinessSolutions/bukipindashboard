import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface GenerarDepreciacionesParams {
  mes?: number;
  ano?: number;
}

interface GenerarDepreciacionesResponse {
  success: boolean;
  mes: number;
  ano: number;
  total_activos: number;
  asientos_creados: number;
  asientos_existentes: number;
  errores: string[];
  detalles: Array<{
    activo: string;
    numero_asiento: string;
    monto?: number;
    estado: 'creado' | 'ya_existe';
  }>;
}

export const useGenerarDepreciaciones = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: GenerarDepreciacionesParams = {}) => {
      const { data, error } = await supabase.functions.invoke('generar-depreciaciones-manual', {
        body: params,
      });

      if (error) {
        throw error;
      }

      return data as GenerarDepreciacionesResponse;
    },
    onSuccess: (data) => {
      // Invalidar queries relacionadas para refrescar la UI
      queryClient.invalidateQueries({ queryKey: ['asientos-depreciacion'] });
      queryClient.invalidateQueries({ queryKey: ['asientos-contables'] });

      // Mostrar resumen en toast
      const mesNombre = new Date(data.ano, data.mes - 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' });
      
      if (data.asientos_creados > 0) {
        toast({
          title: "✅ Depreciaciones generadas",
          description: `Se crearon ${data.asientos_creados} asiento(s) para ${mesNombre}. ${
            data.asientos_existentes > 0 ? `${data.asientos_existentes} ya existían.` : ''
          }`,
          variant: "default",
        });
      } else if (data.asientos_existentes > 0) {
        toast({
          title: "ℹ️ Sin cambios",
          description: `Todos los asientos de ${mesNombre} ya estaban generados (${data.asientos_existentes}).`,
          variant: "default",
        });
      } else {
        toast({
          title: "⚠️ Sin asientos",
          description: `No se encontraron activos para depreciar en ${mesNombre}.`,
          variant: "default",
        });
      }

      // Si hubo errores, mostrarlos
      if (data.errores && data.errores.length > 0) {
        toast({
          title: "⚠️ Algunos errores",
          description: `${data.errores.length} error(es) al procesar. Revisa la consola.`,
          variant: "destructive",
        });
        console.error("Errores al generar depreciaciones:", data.errores);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudieron generar las depreciaciones: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};
