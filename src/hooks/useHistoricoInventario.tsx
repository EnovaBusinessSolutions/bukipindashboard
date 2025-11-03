import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export type DatoHistoricoMes = {
  mes: string;
  stock: number;
  compras: number;
  ventas: number;
};

export const useHistoricoInventario = (productoId: string | null) => {
  return useQuery({
    queryKey: ["historico-inventario", productoId],
    queryFn: async () => {
      if (!productoId) return [];

      // Obtener todos los movimientos del producto
      const { data: movimientos, error } = await supabase
        .from("movimientos_inventario")
        .select("*")
        .eq("producto_id", productoId)
        .eq("estado", "activo")
        .order("fecha", { ascending: true });

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
          };
        }

        const cantidad = Number(movimiento.cantidad);

        if (movimiento.tipo_movimiento === "compra") {
          acc[mesKey].compras += cantidad;
        } else if (movimiento.tipo_movimiento === "venta") {
          acc[mesKey].ventas += cantidad;
        } else if (movimiento.tipo_movimiento === "ajuste") {
          // Los ajustes pueden ser positivos o negativos
          acc[mesKey].compras += cantidad > 0 ? cantidad : 0;
          acc[mesKey].ventas += cantidad < 0 ? Math.abs(cantidad) : 0;
        }

        return acc;
      }, {} as Record<string, DatoHistoricoMes>);

      // Convertir a array y calcular stock acumulado
      const datosHistoricos = Object.keys(movimientosPorMes || {})
        .sort()
        .map((mesKey) => movimientosPorMes![mesKey]);

      // Calcular stock acumulado mes a mes
      let stockAcumulado = 0;
      datosHistoricos.forEach((dato) => {
        stockAcumulado += dato.compras - dato.ventas;
        dato.stock = stockAcumulado;
      });

      return datosHistoricos;
    },
    enabled: !!productoId,
  });
};
