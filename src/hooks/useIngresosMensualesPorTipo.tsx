import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface IngresoMensual {
  mes: string;
  mesNumero: number;
  ventas: number;
  otrosIngresos: number;
  total: number;
}

export const useIngresosMensualesPorTipo = (año?: number) => {
  const añoActual = año || new Date().getFullYear();

  return useQuery({
    queryKey: ["ingresos-mensuales-por-tipo", añoActual],
    queryFn: async (): Promise<IngresoMensual[]> => {
      const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];

      const ingresosMensuales: IngresoMensual[] = [];

      for (let mes = 0; mes < 12; mes++) {
        const fechaInicio = new Date(añoActual, mes, 1).toISOString();
        const fechaFin = new Date(añoActual, mes + 1, 0, 23, 59, 59).toISOString();

        // Obtener ventas del mes
        const { data: ventasData } = await supabase
          .from('transacciones_ingresos')
          .select('monto_neto')
          .eq('tipo_ingreso', 'venta')
          .gte('created_at', fechaInicio)
          .lte('created_at', fechaFin);

        const ventas = ventasData?.reduce((sum, t) => sum + (t.monto_neto || 0), 0) || 0;

        // Obtener otros ingresos del mes
        const { data: otrosData } = await supabase
          .from('transacciones_ingresos')
          .select('monto_neto')
          .neq('tipo_ingreso', 'venta')
          .gte('created_at', fechaInicio)
          .lte('created_at', fechaFin);

        const otrosIngresos = otrosData?.reduce((sum, t) => sum + (t.monto_neto || 0), 0) || 0;

        ingresosMensuales.push({
          mes: meses[mes],
          mesNumero: mes + 1,
          ventas,
          otrosIngresos,
          total: ventas + otrosIngresos
        });
      }

      return ingresosMensuales;
    }
  });
};
