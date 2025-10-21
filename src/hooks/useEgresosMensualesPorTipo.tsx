import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EgresoMensual {
  mes: string;
  mesNumero: number;
  costos: number;
  gastos: number;
  total: number;
}

export const useEgresosMensualesPorTipo = (año?: number) => {
  const añoActual = año || new Date().getFullYear();

  return useQuery({
    queryKey: ["egresos-mensuales-por-tipo", añoActual],
    queryFn: async (): Promise<EgresoMensual[]> => {
      const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];

      const egresosMensuales: EgresoMensual[] = [];

      for (let mes = 0; mes < 12; mes++) {
        const fechaInicio = new Date(añoActual, mes, 1).toISOString();
        const fechaFin = new Date(añoActual, mes + 1, 0, 23, 59, 59).toISOString();

        // Obtener costos del mes
        const { data: costosData } = await supabase
          .from('transacciones_egresos')
          .select('monto_total')
          .eq('tipo_egreso', 'costo')
          .gte('created_at', fechaInicio)
          .lte('created_at', fechaFin);

        const costos = costosData?.reduce((sum, t) => sum + (t.monto_total || 0), 0) || 0;

        // Obtener gastos del mes
        const { data: gastosData } = await supabase
          .from('transacciones_egresos')
          .select('monto_total')
          .eq('tipo_egreso', 'gasto')
          .gte('created_at', fechaInicio)
          .lte('created_at', fechaFin);

        const gastos = gastosData?.reduce((sum, t) => sum + (t.monto_total || 0), 0) || 0;

        egresosMensuales.push({
          mes: meses[mes],
          mesNumero: mes + 1,
          costos,
          gastos,
          total: costos + gastos
        });
      }

      return egresosMensuales;
    }
  });
};
