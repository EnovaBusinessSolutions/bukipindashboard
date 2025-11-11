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

      // ✅ UNA SOLA CONSULTA PARA TODO EL AÑO (en lugar de 12)
      const fechaInicioAño = `${añoActual}-01-01`;
      const fechaFinAño = `${añoActual}-12-31`;

      const { data: detallesAño } = await supabase
        .from('detalle_asientos')
        .select('cuenta_codigo, debe, haber, asientos_contables!inner(fecha)')
        .gte('asientos_contables.fecha', fechaInicioAño)
        .lte('asientos_contables.fecha', fechaFinAño);

      // Agrupar por mes en frontend
      const detallesPorMes = new Map<number, any[]>();
      
      detallesAño?.forEach(detalle => {
        const mes = new Date(detalle.asientos_contables.fecha).getMonth();
        if (!detallesPorMes.has(mes)) {
          detallesPorMes.set(mes, []);
        }
        detallesPorMes.get(mes)!.push(detalle);
      });

      // Procesar cada mes
      const egresosMensuales: EgresoMensual[] = [];

      for (let mes = 0; mes < 12; mes++) {
        const detallesMes = detallesPorMes.get(mes) || [];
        
        let costos = 0;
        let gastos = 0;

        // Clasificar según el código de cuenta con naturaleza contable correcta
        detallesMes.forEach(detalle => {
          const codigo = detalle.cuenta_codigo;
          const debe = detalle.debe || 0;
          const haber = detalle.haber || 0;
          
          // Costos de Venta (5001, 5002) - Naturaleza deudora
          if (codigo === '5001' || codigo === '5002') {
            costos += debe - haber;
          }
          // Devoluciones/Descuentos sobre Compras (5003, 5004) - RESTAN de costos
          else if (codigo === '5003' || codigo === '5004') {
            costos -= debe - haber;
          }
          // Gastos Operativos (51XX excepto depreciaciones) - Naturaleza deudora
          else if (codigo.startsWith('51') && codigo !== '5109' && codigo !== '5110') {
            gastos += debe - haber;
          }
        });

        egresosMensuales.push({
          mes: meses[mes],
          mesNumero: mes + 1,
          costos: Math.max(0, costos),
          gastos: Math.max(0, gastos),
          total: Math.max(0, costos + gastos)
        });
      }

      return egresosMensuales;
    },
    staleTime: 5 * 60 * 1000, // Cachear por 5 minutos
    gcTime: 10 * 60 * 1000, // Mantener en memoria 10 minutos
    retry: 1, // Solo 1 reintento
    refetchOnWindowFocus: false, // No refrescar al cambiar de ventana
  });
};
