import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ResultadoMensual {
  mes: string;
  mesNumero: number;
  ingresos: number;
  costos: number;
  gastos: number;
  utilidadBruta: number;
  utilidadOperativa: number;
  utilidadNeta: number;
  margenBruto: number;
  margenEBITDA: number;
  margenNeto: number;
}

export const useEstadoResultadosMensual = (año?: number) => {
  const añoActual = año || new Date().getFullYear();

  return useQuery({
    queryKey: ["estado-resultados-mensual", añoActual],
    queryFn: async (): Promise<ResultadoMensual[]> => {
      const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];

      const resultados: ResultadoMensual[] = [];

      for (let mes = 0; mes < 12; mes++) {
        const fechaInicio = new Date(añoActual, mes, 1).toISOString();
        const fechaFin = new Date(añoActual, mes + 1, 0, 23, 59, 59).toISOString();

        // Obtener ingresos del mes
        const { data: ingresosData } = await supabase
          .from('transacciones_ingresos')
          .select('monto_neto')
          .gte('created_at', fechaInicio)
          .lte('created_at', fechaFin);

        const ingresos = ingresosData?.reduce((sum, t) => sum + (t.monto_neto || 0), 0) || 0;

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

        // Calcular utilidades y márgenes
        const utilidadBruta = ingresos - costos;
        const utilidadOperativa = utilidadBruta - gastos;
        const utilidadNeta = utilidadOperativa;

        const margenBruto = ingresos > 0 ? (utilidadBruta / ingresos) * 100 : 0;
        const margenEBITDA = ingresos > 0 ? (utilidadOperativa / ingresos) * 100 : 0; // Simplificado como margen operativo
        const margenNeto = ingresos > 0 ? (utilidadNeta / ingresos) * 100 : 0;

        resultados.push({
          mes: meses[mes],
          mesNumero: mes + 1,
          ingresos,
          costos,
          gastos,
          utilidadBruta,
          utilidadOperativa,
          utilidadNeta,
          margenBruto,
          margenEBITDA,
          margenNeto
        });
      }

      return resultados;
    }
  });
};
