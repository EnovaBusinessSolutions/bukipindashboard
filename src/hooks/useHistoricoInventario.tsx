import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, parseISO, subMonths, startOfYear } from "date-fns";
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

      // Agrupar por mes
      const movimientosPorMes = movimientos?.reduce((acc, movimiento) => {
        const fecha = parseISO(movimiento.fecha);
        const mesKey = format(startOfMonth(fecha), "yyyy-MM");
        const mesLabel = format(startOfMonth(fecha), "MMM yyyy", { locale: es });

        if (!acc[mesKey]) {
          acc[mesKey] = {
            mes: mesLabel,
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
          acc[mesKey].compras += cantidad;
          acc[mesKey].compras_valor += costoTotal;
        } else if (movimiento.tipo_movimiento === "venta") {
          acc[mesKey].ventas += cantidad;
          acc[mesKey].ventas_valor += cantidad * costoUnitario;
        } else if (movimiento.tipo_movimiento === "ajuste") {
          // Los ajustes pueden ser positivos o negativos
          if (cantidad > 0) {
            acc[mesKey].compras += cantidad;
            acc[mesKey].compras_valor += costoTotal;
          } else {
            acc[mesKey].ventas += Math.abs(cantidad);
            acc[mesKey].ventas_valor += Math.abs(cantidad) * costoUnitario;
          }
        }

        return acc;
      }, {} as Record<string, DatoHistoricoMes>);

      // Convertir a array y calcular stock acumulado
      const datosHistoricos = Object.keys(movimientosPorMes || {})
        .sort()
        .map((mesKey) => movimientosPorMes![mesKey]);

      // Calcular stock acumulado mes a mes
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
