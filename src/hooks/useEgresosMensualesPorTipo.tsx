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
        const fechaInicio = new Date(añoActual, mes, 1).toISOString().split('T')[0];
        const fechaFin = new Date(añoActual, mes + 1, 0).toISOString().split('T')[0];

        // CONSULTAR DESDE ASIENTOS CONTABLES - ÚNICA FUENTE DE VERDAD
        const { data: detalles } = await supabase
          .from('detalle_asientos')
          .select('cuenta_codigo, debe, haber, asientos_contables!inner(fecha)')
          .gte('asientos_contables.fecha', fechaInicio)
          .lte('asientos_contables.fecha', fechaFin);

        let costos = 0;
        let gastos = 0;

        // Clasificar según el código de cuenta
        detalles?.forEach(detalle => {
          const codigo = detalle.cuenta_codigo;
          // Costos y gastos tienen naturaleza deudora (DEBE aumenta, HABER disminuye)
          const monto = (detalle.debe || 0) - (detalle.haber || 0);
          
          if (codigo.startsWith('5') && parseInt(codigo) >= 5001 && parseInt(codigo) <= 5099) {
            // Costos de venta (5001-5099)
            costos += monto;
          } else if (codigo.startsWith('5') && parseInt(codigo) >= 5100) {
            // Gastos operativos (5100+)
            gastos += monto;
          }
        });

        egresosMensuales.push({
          mes: meses[mes],
          mesNumero: mes + 1,
          costos: Math.max(0, costos), // Asegurar que no sea negativo
          gastos: Math.max(0, gastos),
          total: Math.max(0, costos + gastos)
        });
      }

      return egresosMensuales;
    }
  });
};
