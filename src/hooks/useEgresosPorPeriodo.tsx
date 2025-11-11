import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DatosEvolucionSimple {
  periodo: string;
  monto: number;
}

export interface DatosEvolucionCombinada {
  periodo: string;
  costos: number;
  gastos: number;
  costosInventario: number;
  otrosGastos: number;
}

export const useEgresosPorPeriodo = (
  periodFilter: "diario" | "mensual" | "anual",
  tipoEgreso: "total" | "costo" | "gasto" | "costo_inventario" | "otros_gastos" | "combinada",
  fechaEspecificaDiaria?: Date,
  fechaEspecificaMensual?: Date
) => {
  return useQuery({
    queryKey: ['egresos-por-periodo', periodFilter, tipoEgreso, fechaEspecificaDiaria, fechaEspecificaMensual],
    queryFn: async (): Promise<DatosEvolucionSimple[] | DatosEvolucionCombinada[]> => {
      const fechaBase = fechaEspecificaDiaria || new Date();
      const fechaMensual = fechaEspecificaMensual || new Date();
      const currentYear = periodFilter === "diario" ? fechaBase.getFullYear() :
                          periodFilter === "mensual" ? fechaMensual.getFullYear() :
                          new Date().getFullYear();
      const currentMonth = periodFilter === "mensual" ? fechaMensual.getMonth() : new Date().getMonth();

      // Consultar asientos contables del año actual
      const { data: detalles } = await supabase
        .from('detalle_asientos')
        .select('cuenta_codigo, debe, haber, asientos_contables!inner(fecha)')
        .gte('asientos_contables.fecha', `${currentYear}-01-01`)
        .lte('asientos_contables.fecha', `${currentYear}-12-31`);

      // Modo combinada: retornar costos, gastos y costos inventario por separado
      if (tipoEgreso === "combinada") {
        if (periodFilter === "diario") {
          const todayStr = fechaBase.toISOString().split('T')[0];
          let costos5001 = 0;
          let gastos = 0;
          let costosInventario5002 = 0;
          let otrosGastos5204 = 0;

          detalles?.forEach(detalle => {
            if (detalle.asientos_contables.fecha !== todayStr) return;
            const codigo = detalle.cuenta_codigo;
            const monto = (detalle.debe || 0) - (detalle.haber || 0);

            if (codigo === '5001') costos5001 += monto;
            else if (codigo === '5002') costosInventario5002 += monto;
            else if (codigo === '5203' || codigo === '5204') otrosGastos5204 += monto;
            else if ((codigo.startsWith('51') && codigo !== '5109' && codigo !== '5110') || 
                     codigo === '5202' || codigo.startsWith('6')) {
              gastos += monto;
            }
          });

          return [{
            periodo: 'Hoy',
            costos: Math.max(0, costos5001),
            gastos: Math.max(0, gastos),
            costosInventario: Math.max(0, costosInventario5002),
            otrosGastos: Math.max(0, otrosGastos5204)
          }];
        } else if (periodFilter === "mensual") {
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          const costosByDay: Record<number, number> = {};
          const gastosByDay: Record<number, number> = {};
          const costosInventarioByDay: Record<number, number> = {};
          const otrosGastosByDay: Record<number, number> = {};

          detalles?.forEach(detalle => {
            const fecha = new Date(detalle.asientos_contables.fecha);
            if (fecha.getMonth() !== currentMonth || fecha.getFullYear() !== currentYear) return;

            const day = fecha.getDate();
            const codigo = detalle.cuenta_codigo;
            const monto = (detalle.debe || 0) - (detalle.haber || 0);

            if (codigo === '5001') {
              costosByDay[day] = (costosByDay[day] || 0) + monto;
            } else if (codigo === '5002') {
              costosInventarioByDay[day] = (costosInventarioByDay[day] || 0) + monto;
            } else if (codigo === '5203' || codigo === '5204') {
              otrosGastosByDay[day] = (otrosGastosByDay[day] || 0) + monto;
            } else if ((codigo.startsWith('51') && codigo !== '5109' && codigo !== '5110') || 
                       codigo === '5202' || codigo.startsWith('6')) {
              gastosByDay[day] = (gastosByDay[day] || 0) + monto;
            }
          });

          return Array.from({ length: Math.min(30, daysInMonth) }, (_, i) => {
            const day = i + 1;
            return {
              periodo: `Día ${day}`,
              costos: Math.max(0, costosByDay[day] || 0),
              gastos: Math.max(0, gastosByDay[day] || 0),
              costosInventario: Math.max(0, costosInventarioByDay[day] || 0),
              otrosGastos: Math.max(0, otrosGastosByDay[day] || 0)
            };
          });
        } else {
          // Anual
          const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
          const costosByMonth: Record<number, number> = {};
          const gastosByMonth: Record<number, number> = {};
          const costosInventarioByMonth: Record<number, number> = {};
          const otrosGastosByMonth: Record<number, number> = {};

          detalles?.forEach(detalle => {
            const fecha = new Date(detalle.asientos_contables.fecha);
            if (fecha.getFullYear() !== currentYear) return;

            const month = fecha.getMonth();
            const codigo = detalle.cuenta_codigo;
            const monto = (detalle.debe || 0) - (detalle.haber || 0);

            if (codigo === '5001') {
              costosByMonth[month] = (costosByMonth[month] || 0) + monto;
            } else if (codigo === '5002') {
              costosInventarioByMonth[month] = (costosInventarioByMonth[month] || 0) + monto;
            } else if (codigo === '5203' || codigo === '5204') {
              otrosGastosByMonth[month] = (otrosGastosByMonth[month] || 0) + monto;
            } else if ((codigo.startsWith('51') && codigo !== '5109' && codigo !== '5110') || 
                       codigo === '5202' || codigo.startsWith('6')) {
              gastosByMonth[month] = (gastosByMonth[month] || 0) + monto;
            }
          });

          return meses.map((mes, index) => ({
            periodo: mes,
            costos: Math.max(0, costosByMonth[index] || 0),
            gastos: Math.max(0, gastosByMonth[index] || 0),
            costosInventario: Math.max(0, costosInventarioByMonth[index] || 0),
            otrosGastos: Math.max(0, otrosGastosByMonth[index] || 0)
          }));
        }
      }

      // Modo "total": retornar datos combinados para permitir vista única Y desglosada
      if (tipoEgreso === "total") {
        if (periodFilter === "diario") {
          const todayStr = fechaBase.toISOString().split('T')[0];
          let costos5001 = 0;
          let gastos = 0;
          let costosInventario5002 = 0;
          let otrosGastos5204 = 0;

          detalles?.forEach(detalle => {
            if (detalle.asientos_contables.fecha !== todayStr) return;
            const codigo = detalle.cuenta_codigo;
            const monto = (detalle.debe || 0) - (detalle.haber || 0);

            if (codigo === '5001') costos5001 += monto;
            else if (codigo === '5002') costosInventario5002 += monto;
            else if (codigo === '5203' || codigo === '5204') otrosGastos5204 += monto;
            else if ((codigo.startsWith('51') && codigo !== '5109' && codigo !== '5110') || 
                     codigo === '5202' || codigo.startsWith('6')) {
              gastos += monto;
            }
          });

          const total = costos5001 + costosInventario5002 + gastos + otrosGastos5204;

          return [{
            periodo: 'Hoy',
            monto: Math.max(0, total),
            costos: Math.max(0, costos5001),
            gastos: Math.max(0, gastos),
            costosInventario: Math.max(0, costosInventario5002),
            otrosGastos: Math.max(0, otrosGastos5204)
          }] as any;
        } else if (periodFilter === "mensual") {
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          const costosByDay: Record<number, number> = {};
          const gastosByDay: Record<number, number> = {};
          const costosInventarioByDay: Record<number, number> = {};
          const otrosGastosByDay: Record<number, number> = {};

          detalles?.forEach(detalle => {
            const fecha = new Date(detalle.asientos_contables.fecha);
            if (fecha.getMonth() !== currentMonth || fecha.getFullYear() !== currentYear) return;

            const day = fecha.getDate();
            const codigo = detalle.cuenta_codigo;
            const monto = (detalle.debe || 0) - (detalle.haber || 0);

            if (codigo === '5001') {
              costosByDay[day] = (costosByDay[day] || 0) + monto;
            } else if (codigo === '5002') {
              costosInventarioByDay[day] = (costosInventarioByDay[day] || 0) + monto;
            } else if (codigo === '5203' || codigo === '5204') {
              otrosGastosByDay[day] = (otrosGastosByDay[day] || 0) + monto;
            } else if ((codigo.startsWith('51') && codigo !== '5109' && codigo !== '5110') || 
                       codigo === '5202' || codigo.startsWith('6')) {
              gastosByDay[day] = (gastosByDay[day] || 0) + monto;
            }
          });

          return Array.from({ length: Math.min(30, daysInMonth) }, (_, i) => {
            const day = i + 1;
            const costos = Math.max(0, costosByDay[day] || 0);
            const gastos = Math.max(0, gastosByDay[day] || 0);
            const costosInventario = Math.max(0, costosInventarioByDay[day] || 0);
            const otrosGastos = Math.max(0, otrosGastosByDay[day] || 0);
            const total = costos + gastos + costosInventario + otrosGastos;

            return {
              periodo: `Día ${day}`,
              monto: total,
              costos,
              gastos,
              costosInventario,
              otrosGastos
            };
          }) as any;
        } else {
          // Anual
          const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
          const costosByMonth: Record<number, number> = {};
          const gastosByMonth: Record<number, number> = {};
          const costosInventarioByMonth: Record<number, number> = {};
          const otrosGastosByMonth: Record<number, number> = {};

          detalles?.forEach(detalle => {
            const fecha = new Date(detalle.asientos_contables.fecha);
            if (fecha.getFullYear() !== currentYear) return;

            const month = fecha.getMonth();
            const codigo = detalle.cuenta_codigo;
            const monto = (detalle.debe || 0) - (detalle.haber || 0);

            if (codigo === '5001') {
              costosByMonth[month] = (costosByMonth[month] || 0) + monto;
            } else if (codigo === '5002') {
              costosInventarioByMonth[month] = (costosInventarioByMonth[month] || 0) + monto;
            } else if (codigo === '5203' || codigo === '5204') {
              otrosGastosByMonth[month] = (otrosGastosByMonth[month] || 0) + monto;
            } else if ((codigo.startsWith('51') && codigo !== '5109' && codigo !== '5110') || 
                       codigo === '5202' || codigo.startsWith('6')) {
              gastosByMonth[month] = (gastosByMonth[month] || 0) + monto;
            }
          });

          return meses.map((mes, index) => {
            const costos = Math.max(0, costosByMonth[index] || 0);
            const gastos = Math.max(0, gastosByMonth[index] || 0);
            const costosInventario = Math.max(0, costosInventarioByMonth[index] || 0);
            const otrosGastos = Math.max(0, otrosGastosByMonth[index] || 0);
            const total = costos + gastos + costosInventario + otrosGastos;

            return {
              periodo: mes,
              monto: total,
              costos,
              gastos,
              costosInventario,
              otrosGastos
            };
          }) as any;
        }
      }

      // Modo simple: una sola serie de datos (para tipos específicos)
      const filtrarPorCodigo = (codigo: string): boolean => {
        if (tipoEgreso === "costo") return codigo === '5001';
        if (tipoEgreso === "costo_inventario") return codigo === '5002';
        if (tipoEgreso === "otros_gastos") return codigo === '5203' || codigo === '5204';
        if (tipoEgreso === "gasto") return (codigo.startsWith('51') && codigo !== '5109' && codigo !== '5110') || 
                                             codigo === '5202' || codigo.startsWith('6');
        return false;
      };

      if (periodFilter === "diario") {
        const todayStr = fechaBase.toISOString().split('T')[0];
        let total = 0;

        detalles?.forEach(detalle => {
          if (detalle.asientos_contables.fecha !== todayStr) return;
          if (!filtrarPorCodigo(detalle.cuenta_codigo)) return;
          const monto = (detalle.debe || 0) - (detalle.haber || 0);
          total += monto;
        });

        return [{ periodo: 'Hoy', monto: Math.max(0, total) }];
      } else if (periodFilter === "mensual") {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const dataByDay: Record<number, number> = {};

        detalles?.forEach(detalle => {
          const fecha = new Date(detalle.asientos_contables.fecha);
          if (fecha.getMonth() !== currentMonth || fecha.getFullYear() !== currentYear) return;
          if (!filtrarPorCodigo(detalle.cuenta_codigo)) return;

          const day = fecha.getDate();
          const monto = (detalle.debe || 0) - (detalle.haber || 0);
          dataByDay[day] = (dataByDay[day] || 0) + monto;
        });

        return Array.from({ length: Math.min(30, daysInMonth) }, (_, i) => ({
          periodo: `Día ${i + 1}`,
          monto: Math.max(0, dataByDay[i + 1] || 0)
        }));
      } else {
        // Anual
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const dataByMonth: Record<number, number> = {};

        detalles?.forEach(detalle => {
          const fecha = new Date(detalle.asientos_contables.fecha);
          if (fecha.getFullYear() !== currentYear) return;
          if (!filtrarPorCodigo(detalle.cuenta_codigo)) return;

          const month = fecha.getMonth();
          const monto = (detalle.debe || 0) - (detalle.haber || 0);
          dataByMonth[month] = (dataByMonth[month] || 0) + monto;
        });

        return meses.map((mes, index) => ({
          periodo: mes,
          monto: Math.max(0, dataByMonth[index] || 0)
        }));
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
