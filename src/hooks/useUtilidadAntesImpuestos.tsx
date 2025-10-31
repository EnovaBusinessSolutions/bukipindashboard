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
      const fechaInicio = new Date(ano, mes - 1, 1).toISOString().split('T')[0];
      const fechaFin = new Date(ano, mes, 0).toISOString().split('T')[0];

      // OBTENER TODO DESDE ASIENTOS CONTABLES - ÚNICA FUENTE DE VERDAD
      const { data: detalles } = await supabase
        .from('detalle_asientos')
        .select('cuenta_codigo, debe, haber, asientos_contables!inner(fecha)')
        .gte('asientos_contables.fecha', fechaInicio)
        .lte('asientos_contables.fecha', fechaFin);

      let ingresos = 0;
      let costos = 0;
      let gastos = 0;
      let depreciacion = 0;
      let intereses = 0;

      detalles?.forEach(detalle => {
        const codigo = detalle.cuenta_codigo;
        const saldo = (detalle.debe || 0) - (detalle.haber || 0);
        
        // Ingresos (cuentas 4xxx) - naturaleza acreedora
        if (codigo.startsWith('4')) {
          ingresos += Math.abs(saldo);
        }
        // Costos (cuentas 5001-5099) - naturaleza deudora
        else if (codigo.startsWith('5') && parseInt(codigo) >= 5001 && parseInt(codigo) <= 5099) {
          costos += Math.abs(saldo);
        }
        // Depreciación (cuentas 5109, 5110)
        else if (codigo === '5109' || codigo === '5110') {
          depreciacion += Math.abs(saldo);
        }
        // Gastos (cuentas 5100-5108, 5202, 5203) - naturaleza deudora
        else if ((codigo.startsWith('5') && parseInt(codigo) >= 5100 && parseInt(codigo) <= 5108) || 
                 codigo === '5202' || codigo === '5203') {
          gastos += Math.abs(saldo);
        }
        // Intereses (cuentas 5111-5199, 5201)
        else if ((codigo.startsWith('5') && parseInt(codigo) >= 5111 && parseInt(codigo) <= 5199) || 
                 codigo === '5201') {
          intereses += Math.abs(saldo);
        }
      });

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
