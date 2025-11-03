import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VentaProductoMensual {
  producto: string;
  mes: string;
  mesNumero: number;
  volumen: number;
  monto: number;
  tarifaPromedio: number;
}

interface VentasPorMes {
  mes: string;
  mesNumero: number;
  [producto: string]: number | string; // volumen por cada producto
}

export const useVentasProductos = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['ventas-productos'],
    enabled,
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
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

      movimientos?.forEach((mov: any) => {
        const fecha = new Date(mov.created_at);
        const mesNumero = fecha.getMonth();
        const mesKey = meses[mesNumero];
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
            mesNumero,
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
        return a.mesNumero - b.mesNumero;
      });

      // Crear estructura para gráfica: agrupar por mes
      const ventasPorMesMap = new Map<string, any>();
      
      ventasArray.forEach(venta => {
        if (!ventasPorMesMap.has(venta.mes)) {
          ventasPorMesMap.set(venta.mes, {
            mes: venta.mes,
            mesNumero: venta.mesNumero
          });
        }
        const mesData = ventasPorMesMap.get(venta.mes);
        mesData[`${venta.producto}_volumen`] = venta.volumen;
        mesData[`${venta.producto}_monto`] = venta.monto;
      });

      const ventasPorMes = Array.from(ventasPorMesMap.values())
        .sort((a, b) => a.mesNumero - b.mesNumero);

      return {
        ventasDetalladas: ventasArray,
        ventasPorMes,
        productos: Array.from(new Set(ventasArray.map(v => v.producto)))
      };
    },
  });
};
