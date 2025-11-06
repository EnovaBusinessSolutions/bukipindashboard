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

export const useCostosVentaInventario = () => {
  return useQuery({
    queryKey: ["costos-venta-inventario"],
    queryFn: async (): Promise<CostoVentaInventario[]> => {
      // Obtener todos los asientos que tienen movimientos en la cuenta 5002 (Costo de Ventas Inventario)
      const { data: asientos, error: asientosError } = await supabase
        .from('asientos_contables')
        .select(`
          id,
          numero_asiento,
          descripcion,
          fecha,
          detalle_asientos(
            id,
            cuenta_codigo,
            debe,
            haber,
            descripcion
          )
        `)
        .order('fecha', { ascending: false });

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
        // Buscar el detalle que corresponde al costo de venta (cuenta 5002)
        const detalleCosto = asiento.detalle_asientos?.find(
          (detalle: any) => detalle.cuenta_codigo === '5002' && detalle.debe > 0
        );

        if (!detalleCosto) continue;

        // Extraer el nombre del producto de la descripción
        let productoNombre = 'Producto Inventariado';
        let productoImagen: string | null = null;
        let cantidad: number | null = null;
        let costoUnitario: number | null = null;
        
        const descripcionAsiento = asiento.descripcion || '';
        
        // La descripción del asiento generalmente tiene el formato "Venta: [Nombre Producto]"
        if (descripcionAsiento.includes('Venta:')) {
          productoNombre = descripcionAsiento.split('Venta:')[1]?.trim() || productoNombre;
        }

        // Buscar TODOS los movimientos de inventario del día
        const { data: movimientos } = await supabase
          .from('movimientos_inventario')
          .select('id, cantidad, producto_id')
          .eq('tipo_movimiento', 'venta')
          .eq('fecha', asiento.fecha)
          .eq('estado', 'activo')
          .ilike('descripcion', `%${productoNombre}%`);

        if (movimientos && movimientos.length > 0) {
          // Sumar todas las cantidades del día
          cantidad = movimientos.reduce((sum, m) => sum + Math.abs(Number(m.cantidad)), 0);
          
          // Usar el producto_id del primer movimiento
          const primerMovimiento = movimientos[0];
          
          // CALCULAR el costo unitario promedio = monto total / cantidad total
          if (cantidad > 0) {
            costoUnitario = Number(detalleCosto.debe) / cantidad;
          }
          
          // Obtener datos del producto con una query separada
          if (primerMovimiento.producto_id) {
            const { data: producto } = await supabase
              .from('productos')
              .select('nombre, imagen_url')
              .eq('id', primerMovimiento.producto_id)
              .maybeSingle();
            
            if (producto) {
              productoNombre = producto.nombre;
              productoImagen = producto.imagen_url;
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
