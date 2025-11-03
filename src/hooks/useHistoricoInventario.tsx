import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, parseISO, subMonths, startOfYear, eachDayOfInterval, endOfMonth, eachMonthOfInterval, endOfYear } from "date-fns";
import { es } from "date-fns/locale";

export type DatoHistoricoMes = {
  mes: string;
  stock: number;
  compras: number;
  ventas: number;
  stock_valor: number;
  compras_valor: number;
  ventas_valor: number;
};

type Periodo = "mensual" | "anual";

export const useHistoricoInventario = (
  productoId: string | null, 
  periodo: Periodo = "anual"
) => {
  return useQuery({
    queryKey: ["historico-inventario", productoId, periodo],
    queryFn: async () => {
      // Determinar fecha de inicio según período
      const fechaInicio = periodo === "mensual" 
        ? startOfMonth(new Date())
        : startOfYear(new Date());

      // Construir query base
      let query = supabase
        .from("movimientos_inventario")
        .select("*")
        .eq("estado", "activo")
        .gte("fecha", format(fechaInicio, "yyyy-MM-dd"))
        .order("fecha", { ascending: true });

      // Si hay producto específico, filtrar por él; sino, obtener todos
      if (productoId && productoId !== "total") {
        query = query.eq("producto_id", productoId);
      }

      const { data: movimientos, error } = await query;

      if (error) throw error;

      // Generar todos los períodos según el tipo seleccionado
      let todosPeriodos: DatoHistoricoMes[];
      
      if (periodo === "mensual") {
        // Generar todos los días del mes actual
        const diasDelMes = eachDayOfInterval({
          start: startOfMonth(new Date()),
          end: endOfMonth(new Date())
        });
        
        todosPeriodos = diasDelMes.map(dia => ({
          mes: format(dia, "dd MMM", { locale: es }),
          stock: 0,
          compras: 0,
          ventas: 0,
          stock_valor: 0,
          compras_valor: 0,
          ventas_valor: 0,
        }));
      } else {
        // Generar todos los meses del año actual
        const mesesDelAno = eachMonthOfInterval({
          start: startOfYear(new Date()),
          end: endOfYear(new Date())
        });
        
        todosPeriodos = mesesDelAno.map(mes => ({
          mes: format(mes, "MMM yyyy", { locale: es }),
          stock: 0,
          compras: 0,
          ventas: 0,
          stock_valor: 0,
          compras_valor: 0,
          ventas_valor: 0,
        }));
      }

      // Agrupar movimientos por período
      const movimientosPorPeriodo: Record<string, DatoHistoricoMes> = {};
      
      movimientos?.forEach((movimiento) => {
        const fecha = parseISO(movimiento.fecha);
        const periodoKey = periodo === "mensual" 
          ? format(fecha, "dd MMM", { locale: es })
          : format(startOfMonth(fecha), "MMM yyyy", { locale: es });

        if (!movimientosPorPeriodo[periodoKey]) {
          movimientosPorPeriodo[periodoKey] = {
            mes: periodoKey,
            stock: 0,
            compras: 0,
            ventas: 0,
            stock_valor: 0,
            compras_valor: 0,
            ventas_valor: 0,
          };
        }

        const cantidad = Number(movimiento.cantidad);
        const costoTotal = Number(movimiento.costo_total);
        const costoUnitario = Number(movimiento.costo_unitario);

        if (movimiento.tipo_movimiento === "compra") {
          movimientosPorPeriodo[periodoKey].compras += cantidad;
          movimientosPorPeriodo[periodoKey].compras_valor += costoTotal;
        } else if (movimiento.tipo_movimiento === "venta") {
          movimientosPorPeriodo[periodoKey].ventas += cantidad;
          movimientosPorPeriodo[periodoKey].ventas_valor += cantidad * costoUnitario;
        } else if (movimiento.tipo_movimiento === "ajuste") {
          if (cantidad > 0) {
            movimientosPorPeriodo[periodoKey].compras += cantidad;
            movimientosPorPeriodo[periodoKey].compras_valor += costoTotal;
          } else {
            movimientosPorPeriodo[periodoKey].ventas += Math.abs(cantidad);
            movimientosPorPeriodo[periodoKey].ventas_valor += Math.abs(cantidad) * costoUnitario;
          }
        }
      });

      // Combinar todos los períodos con los movimientos
      const datosHistoricos = todosPeriodos.map(periodo => {
        const movimiento = movimientosPorPeriodo[periodo.mes];
        return movimiento || periodo;
      });

      // Calcular stock acumulado
      let stockAcumulado = 0;
      let stockValorAcumulado = 0;
      datosHistoricos.forEach((dato) => {
        stockAcumulado += dato.compras - dato.ventas;
        stockValorAcumulado += dato.compras_valor - dato.ventas_valor;
        dato.stock = stockAcumulado;
        dato.stock_valor = stockValorAcumulado;
      });

      return datosHistoricos;
    },
    enabled: true, // Siempre habilitado para soportar "total"
  });
};
