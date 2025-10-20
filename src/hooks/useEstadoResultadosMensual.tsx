import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ResultadoMensual {
  mes: string;
  mesNumero: number;
  ingresos: number;
  costos: number;
  gastos: number;
  utilidadBruta: number;
  ebitda: number;
  depreciacion: number;
  ebit: number;
  intereses: number;
  utilidadAntesImpuestos: number;
  impuestos: number;
  utilidadNeta: number;
  margenBruto: number;
  margenEBITDA: number;
  margenEBIT: number;
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

        // Obtener depreciación mensual del mes
        const { data: inversionesData } = await supabase
          .from('inversiones_capex')
          .select('valor_depreciacion_mensual, fecha_inicio_depreciacion, fecha_baja, estado')
          .eq('estado', 'activo');

        let depreciacion = 0;
        inversionesData?.forEach((inv) => {
          if (inv.fecha_inicio_depreciacion) {
            const fechaInicioDep = new Date(inv.fecha_inicio_depreciacion);
            const fechaMes = new Date(añoActual, mes, 15);
            
            // Solo agregar depreciación si el mes está después del inicio de depreciación
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
          .gte('fecha', new Date(añoActual, mes, 1).toISOString().split('T')[0])
          .lte('fecha', new Date(añoActual, mes + 1, 0).toISOString().split('T')[0]);

        const intereses = interesesData?.reduce((sum, t) => sum + (t.interes_pagado || 0), 0) || 0;

        // Calcular utilidades y márgenes según estructura contable
        const utilidadBruta = ingresos - costos;
        const ebitda = utilidadBruta - gastos;
        const ebit = ebitda - depreciacion;
        const utilidadAntesImpuestos = ebit - intereses;
        
        // Calcular impuestos (30% estimado sobre utilidad antes de impuestos positiva)
        const impuestos = utilidadAntesImpuestos > 0 ? utilidadAntesImpuestos * 0.30 : 0;
        const utilidadNeta = utilidadAntesImpuestos - impuestos;

        const margenBruto = ingresos > 0 ? (utilidadBruta / ingresos) * 100 : 0;
        const margenEBITDA = ingresos > 0 ? (ebitda / ingresos) * 100 : 0;
        const margenEBIT = ingresos > 0 ? (ebit / ingresos) * 100 : 0;
        const margenNeto = ingresos > 0 ? (utilidadNeta / ingresos) * 100 : 0;

        resultados.push({
          mes: meses[mes],
          mesNumero: mes + 1,
          ingresos,
          costos,
          gastos,
          utilidadBruta,
          ebitda,
          depreciacion,
          ebit,
          intereses,
          utilidadAntesImpuestos,
          impuestos,
          utilidadNeta,
          margenBruto,
          margenEBITDA,
          margenEBIT,
          margenNeto
        });
      }

      return resultados;
    }
  });
};
