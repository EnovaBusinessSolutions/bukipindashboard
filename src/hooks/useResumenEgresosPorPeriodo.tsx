import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ResumenPeriodo {
  costosVenta5001: number;      // Costos de Venta (5001)
  costosVenta5002: number;      // Costos de Venta Inventario (5002)
  gastos: number;               // Gastos (51XX, 5202, 5203)
  otrosGastos: number;          // Otros Gastos (6XXX)
  total: number;
}

interface ResumenEgresos {
  dia: ResumenPeriodo;
  mes: ResumenPeriodo;
  anio: ResumenPeriodo;
}

export const useResumenEgresosPorPeriodo = () => {
  return useQuery({
    queryKey: ['resumen-egresos-periodo'],
    queryFn: async (): Promise<ResumenEgresos> => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      // Consultar asientos contables del año actual
      const { data: detallesAnio } = await supabase
        .from('detalle_asientos')
        .select('cuenta_codigo, debe, haber, asientos_contables!inner(fecha)')
        .gte('asientos_contables.fecha', `${currentYear}-01-01`)
        .lte('asientos_contables.fecha', `${currentYear}-12-31`);

      // Función helper para clasificar por período
      const clasificarPorPeriodo = (detalles: any[], filtroFecha: (fecha: string) => boolean): ResumenPeriodo => {
        let costosVenta5001 = 0;      // Costos de Venta (5001)
        let costosVenta5002 = 0;      // Costos de Venta Inventario (5002)
        let gastos = 0;               // Gastos (51XX, 5202, 5203)
        let otrosGastos = 0;          // Otros Gastos (6XXX)

        detalles?.forEach(detalle => {
          const fecha = detalle.asientos_contables.fecha;
          if (!filtroFecha(fecha)) return;

          const codigo = detalle.cuenta_codigo;
          const debe = detalle.debe || 0;
          const haber = detalle.haber || 0;
          const monto = debe - haber;

          // Clasificación por código de cuenta
          if (codigo === '5001') {
            costosVenta5001 += monto;
          } else if (codigo === '5002') {
            costosVenta5002 += monto;
          } else if (codigo.startsWith('51') && codigo !== '5109' && codigo !== '5110') {
            // Solo gastos operativos 51XX, EXCLUYENDO depreciaciones (5109, 5110)
            gastos += monto;
          } else if (codigo.startsWith('52') || codigo.startsWith('6')) {
            // Otros Gastos: 52XX (Intereses, Comisiones, Pérdidas, Otros) + 6XXX
            otrosGastos += monto;
          }
        });

        const total = costosVenta5001 + costosVenta5002 + gastos + otrosGastos;

        return {
          costosVenta5001: Math.max(0, costosVenta5001),
          costosVenta5002: Math.max(0, costosVenta5002),
          gastos: Math.max(0, gastos),
          otrosGastos: Math.max(0, otrosGastos),
          total: Math.max(0, total)
        };
      };

      // Día
      const resumenDia = clasificarPorPeriodo(
        detallesAnio || [],
        (fecha) => fecha === todayStr
      );

      // Mes
      const resumenMes = clasificarPorPeriodo(
        detallesAnio || [],
        (fecha) => {
          const d = new Date(fecha);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }
      );

      // Año
      const resumenAnio = clasificarPorPeriodo(
        detallesAnio || [],
        (fecha) => new Date(fecha).getFullYear() === currentYear
      );

      return {
        dia: resumenDia,
        mes: resumenMes,
        anio: resumenAnio
      };
    },
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
