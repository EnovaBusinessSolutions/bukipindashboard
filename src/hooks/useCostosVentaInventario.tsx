import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DetalleAsiento {
  cuenta_codigo: string;
  cuenta_nombre: string | null;
  debe: number;
  haber: number;
  descripcion: string | null;
}

interface CostoVentaInventario {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
  numero_asiento: string;
  producto_nombre: string;
  producto_imagen: string | null;
  cantidad: number | null;
  costo_unitario: number | null;
  detalles_asiento: DetalleAsiento[];
}

// Función helper para redondear a 2 decimales
const redondear = (num: number) => Math.round(num * 100) / 100;

export const useCostosVentaInventario = (
  periodFilter?: "diario" | "mensual" | "anual",
  fechaDiaria?: Date,
  fechaMensual?: Date
) => {
  return useQuery({
    queryKey: ["costos-venta-inventario", periodFilter, fechaDiaria, fechaMensual],
    queryFn: async (): Promise<CostoVentaInventario[]> => {
      // Obtener todos los asientos que tienen movimientos en cuentas de costos (50XX)
      let query = supabase
        .from('asientos_contables')
        .select(`
          id,
          numero_asiento,
          descripcion,
          fecha,
          user_id,
          detalle_asientos(
            id,
            cuenta_codigo,
            debe,
            haber,
            descripcion
          )
        `)
        .order('fecha', { ascending: false });

      // Aplicar filtros de fecha
      if (periodFilter === "diario" && fechaDiaria) {
        const fechaStr = fechaDiaria.toISOString().split('T')[0];
        query = query.eq('fecha', fechaStr);
      } else if (periodFilter === "mensual" && fechaMensual) {
        const year = fechaMensual.getFullYear();
        const month = fechaMensual.getMonth();
        const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
        const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
        query = query.gte('fecha', firstDay).lte('fecha', lastDay);
      } else if (periodFilter === "anual") {
        const year = new Date().getFullYear();
        query = query.gte('fecha', `${year}-01-01`).lte('fecha', `${year}-12-31`);
      }

      const { data: asientos, error: asientosError } = await query;

      if (asientosError) {
        console.error('Error fetching costos venta:', asientosError);
        throw asientosError;
      }

      // Obtener nombres de cuentas
      const { data: cuentas } = await supabase
        .from('cuentas')
        .select('codigo, nombre');

      const cuentasMap = new Map(cuentas?.map(c => [c.codigo, c.nombre]) || []);

      // Procesar los asientos para extraer la información de costos de venta
      const costosVenta: CostoVentaInventario[] = [];

      for (const asiento of asientos || []) {
        // Buscar TODAS las cuentas de costos de venta (50XX)
        const detalleCosto = asiento.detalle_asientos?.find(
          (detalle: any) => detalle.cuenta_codigo?.startsWith('50') && detalle.debe > 0
        );

        if (!detalleCosto) continue;

        // Extraer el nombre del producto de la descripción
        let productoNombre = 'Producto Inventariado';
        let productoImagen: string | null = null;
        let cantidad: number | null = null;
        let costoUnitario: number | null = null;
        
        const descripcionAsiento = asiento.descripcion || '';
        
        // Extraer el nombre del producto según el tipo de asiento
        if (descripcionAsiento.includes('Venta:')) {
          productoNombre = descripcionAsiento.split('Venta:')[1]?.trim() || productoNombre;
        } else if (descripcionAsiento.includes('Egreso:')) {
          productoNombre = descripcionAsiento.split('Egreso:')[1]?.trim() || productoNombre;
        }

        // Buscar el movimiento de inventario con redondeo a 2 decimales
        const montoBuscado = redondear(Number(detalleCosto.debe));
        
        const { data: movimientos } = await supabase
          .from('movimientos_inventario')
          .select('id, cantidad, producto_id, costo_total')
          .eq('tipo_movimiento', 'venta')
          .eq('fecha', asiento.fecha)
          .eq('estado', 'activo')
          .ilike('descripcion', `%${productoNombre}%`);
        
        // Filtrar en JavaScript comparando montos redondeados
        const movimiento = movimientos?.find(m => 
          redondear(Number(m.costo_total)) === montoBuscado
        ) || null;

        if (movimiento && movimiento.cantidad) {
          cantidad = Math.abs(Number(movimiento.cantidad));
          
          // CALCULAR el costo unitario = monto total / cantidad
          if (cantidad > 0) {
            costoUnitario = Number(detalleCosto.debe) / cantidad;
          }
          
          // Obtener datos del producto con una query separada
          if (movimiento.producto_id) {
            const { data: producto } = await supabase
              .from('productos')
              .select('nombre, imagen_url')
              .eq('id', movimiento.producto_id)
              .maybeSingle();
            
            if (producto) {
              productoNombre = producto.nombre;
              productoImagen = producto.imagen_url;
            }
          }
        }

        // Si no encontramos imagen en inventario, buscar en productos_egresos
        if (!productoImagen && detalleCosto) {
          // Buscar la transacción de egreso relacionada por descripción y monto (con redondeo)
          const descripcionBusqueda = asiento.descripcion.replace('Egreso: ', '').replace('Venta: ', '').trim();
          const montoBuscadoEgreso = redondear(Number(detalleCosto.debe));
          
          const { data: transaccionesEgresos } = await supabase
            .from('transacciones_egresos')
            .select('producto_egreso_id, cantidad, precio_unitario, monto_total')
            .eq('descripcion', descripcionBusqueda)
            .eq('user_id', asiento.user_id);
          
          // Filtrar por monto redondeado
          const transaccionEgreso = transaccionesEgresos?.find(te =>
            redondear(Number(te.monto_total)) === montoBuscadoEgreso
          ) || null;
          
          if (transaccionEgreso?.producto_egreso_id) {
            const { data: productoEgreso } = await supabase
              .from('productos_egresos')
              .select('nombre, imagen_url')
              .eq('id', transaccionEgreso.producto_egreso_id)
              .maybeSingle();
            
            if (productoEgreso) {
              productoNombre = productoEgreso.nombre;
              productoImagen = productoEgreso.imagen_url;
              
              // Calcular cantidad y costo unitario desde transacciones_egresos
              if (transaccionEgreso.cantidad) {
                cantidad = Math.abs(Number(transaccionEgreso.cantidad));
                if (cantidad > 0) {
                  costoUnitario = Number(detalleCosto.debe) / cantidad;
                }
              }
            }
          }
        }

        // Obtener todos los detalles del asiento con nombres de cuenta
        const detallesAsiento: DetalleAsiento[] = asiento.detalle_asientos?.map((detalle: any) => ({
          cuenta_codigo: detalle.cuenta_codigo,
          cuenta_nombre: cuentasMap.get(detalle.cuenta_codigo) || null,
          debe: Number(detalle.debe),
          haber: Number(detalle.haber),
          descripcion: detalle.descripcion
        })) || [];

        costosVenta.push({
          id: asiento.id,
          fecha: asiento.fecha,
          descripcion: detalleCosto.descripcion || asiento.descripcion,
          monto: Number(detalleCosto.debe),
          numero_asiento: asiento.numero_asiento,
          producto_nombre: productoNombre,
          producto_imagen: productoImagen,
          cantidad,
          costo_unitario: costoUnitario,
          detalles_asiento: detallesAsiento
        });
      }

      return costosVenta;
    }
  });
};
