import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UtilidadData {
  mes: number;
  ano: number;
  utilidadAntesImpuestos: number;
  ingresos: number;
  costos: number;
  gastos: number;
  depreciacion: number;
  intereses: number;
}

export const useUtilidadAntesImpuestos = (mes: number, ano: number) => {
  return useQuery({
    queryKey: ["utilidad-antes-impuestos", mes, ano],
    queryFn: async (): Promise<UtilidadData> => {
      const fechaInicio = new Date(ano, mes - 1, 1).toISOString();
      const fechaFin = new Date(ano, mes, 0, 23, 59, 59).toISOString();

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

      // Obtener depreciación mensual del mes
      const { data: inversionesData } = await supabase
        .from('inversiones_capex')
        .select('valor_depreciacion_mensual, fecha_inicio_depreciacion, estado')
        .eq('estado', 'activo');

      let depreciacion = 0;
      inversionesData?.forEach((inv) => {
        if (inv.fecha_inicio_depreciacion) {
          const fechaInicioDep = new Date(inv.fecha_inicio_depreciacion);
          const fechaMes = new Date(ano, mes - 1, 15);
          
          if (fechaMes >= fechaInicioDep) {
            depreciacion += inv.valor_depreciacion_mensual || 0;
          }
        }
      });

      // Obtener intereses pagados del mes
      const { data: interesesData } = await supabase
        .from('transacciones_financiamientos')
        .select('interes_pagado')
        .eq('tipo_transaccion', 'cargo_interes')
        .gte('fecha', new Date(ano, mes - 1, 1).toISOString().split('T')[0])
        .lte('fecha', new Date(ano, mes, 0).toISOString().split('T')[0]);

      const intereses = interesesData?.reduce((sum, t) => sum + (t.interes_pagado || 0), 0) || 0;

      // Calcular utilidad antes de impuestos
      const utilidadBruta = ingresos - costos;
      const ebitda = utilidadBruta - gastos;
      const ebit = ebitda - depreciacion;
      const utilidadAntesImpuestos = ebit - intereses;

      return {
        mes,
        ano,
        utilidadAntesImpuestos,
        ingresos,
        costos,
        gastos,
        depreciacion,
        intereses
      };
    }
  });
};
