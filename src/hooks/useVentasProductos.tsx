import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VentaProductoMensual {
  producto: string;
  mes: string;
  volumen: number;
  monto: number;
  tarifaPromedio: number;
}

export const useVentasProductos = () => {
  return useQuery({
    queryKey: ['ventas-productos'],
    queryFn: async () => {
      // Obtener el año actual
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

      // Consultar movimientos de venta con información del producto
      const { data: movimientos, error } = await supabase
        .from('movimientos_inventario')
        .select(`
          *,
          productos (
            nombre,
            precio_venta
          )
        `)
        .eq('tipo_movimiento', 'venta')
        .gte('created_at', startOfYear.toISOString())
        .lte('created_at', endOfYear.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Agrupar por producto y mes
      const ventasPorProductoYMes = new Map<string, VentaProductoMensual>();

      movimientos?.forEach((mov: any) => {
        const fecha = new Date(mov.created_at);
        const mesKey = fecha.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
        const productoNombre = mov.productos?.nombre || 'Sin nombre';
        const precioVenta = mov.productos?.precio_venta || 0;
        const volumen = Math.abs(mov.cantidad); // Cantidad es negativa en ventas
        const monto = volumen * precioVenta;

        const key = `${productoNombre}-${mesKey}`;
        
        if (ventasPorProductoYMes.has(key)) {
          const existing = ventasPorProductoYMes.get(key)!;
          existing.volumen += volumen;
          existing.monto += monto;
          existing.tarifaPromedio = existing.monto / existing.volumen;
        } else {
          ventasPorProductoYMes.set(key, {
            producto: productoNombre,
            mes: mesKey,
            volumen,
            monto,
            tarifaPromedio: precioVenta
          });
        }
      });

      // Convertir a array y ordenar
      const ventasArray = Array.from(ventasPorProductoYMes.values());
      
      // Ordenar por producto y luego por mes
      ventasArray.sort((a, b) => {
        if (a.producto !== b.producto) {
          return a.producto.localeCompare(b.producto);
        }
        return new Date(a.mes).getTime() - new Date(b.mes).getTime();
      });

      return ventasArray;
    },
  });
};
