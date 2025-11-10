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
    queryClient.invalidateQueries({ queryKey: ['asientos-depreciacion'] });
    queryClient.invalidateQueries({ queryKey: ['asientos-depreciacion-all'] });
    queryClient.invalidateQueries({ queryKey: ['inversiones'] });
    queryClient.invalidateQueries({ queryKey: ['asientos-contables'] });

      const mesNombre = new Date(data.ano, data.mes - 1).toLocaleString('es-MX', { 
        month: 'long', 
        year: 'numeric' 
      });
      
      // Mensajes según resultado
      if (data.asientos_creados > 0 && data.asientos_existentes === 0) {
        // Todos nuevos - éxito total
        toast({
          title: "✅ Depreciaciones generadas",
          description: `Se crearon ${data.asientos_creados} asiento(s) para ${mesNombre}.`,
        });
      } else if (data.asientos_creados === 0 && data.asientos_existentes > 0) {
        // Todos ya existen
        toast({
          title: "ℹ️ Sin cambios",
          description: `Las depreciaciones de ${mesNombre} ya fueron generadas anteriormente (${data.asientos_existentes} asiento(s)).`,
        });
      } else if (data.asientos_creados > 0 && data.asientos_existentes > 0) {
        // Mixto
        toast({
          title: "⚠️ Parcialmente generado",
          description: `${data.asientos_creados} nuevo(s), ${data.asientos_existentes} ya existían para ${mesNombre}.`,
        });
      } else {
        // Sin activos
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
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudieron generar las depreciaciones: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};
