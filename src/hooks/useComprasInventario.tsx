import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CompraInventario {
  id: string;
  fecha: string;
  producto_nombre: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
  descripcion: string;
  user_id: string;
}

/**
 * Hook para obtener las compras de inventario desde movimientos_inventario
 * 
 * Este hook consulta los movimientos de tipo 'compra' activos y los une con
 * la información del producto para mostrar la analítica completa de compras.
 */
export const useComprasInventario = () => {
  return useQuery({
    queryKey: ['compras-inventario'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movimientos_inventario')
        .select(`
          id,
          fecha,
          cantidad,
          costo_unitario,
          costo_total,
          descripcion,
          user_id,
          productos (
            nombre
          )
        `)
        .eq('tipo_movimiento', 'compra')
        .eq('estado', 'activo')
        .order('fecha', { ascending: false });

      if (error) {
        console.error('Error fetching compras inventario:', error);
        throw error;
      }

      // Transformar los datos para que sean más fáciles de usar
      const compras: CompraInventario[] = (data || []).map(movimiento => ({
        id: movimiento.id,
        fecha: movimiento.fecha,
        producto_nombre: movimiento.productos?.nombre || 'Producto sin nombre',
        cantidad: movimiento.cantidad,
        costo_unitario: movimiento.costo_unitario,
        costo_total: movimiento.costo_total,
        descripcion: movimiento.descripcion || '',
        user_id: movimiento.user_id || ''
      }));

      return compras;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};
