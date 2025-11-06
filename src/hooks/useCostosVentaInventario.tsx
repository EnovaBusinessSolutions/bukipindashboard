import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CostoVentaInventario {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
  numero_asiento: string;
  producto_nombre: string;
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
          detalle_asientos!inner(
            id,
            cuenta_codigo,
            debe,
            haber,
            descripcion
          )
        `)
        .eq('detalle_asientos.cuenta_codigo', '5002')
        .order('fecha', { ascending: false });

      if (asientosError) {
        console.error('Error fetching costos venta:', asientosError);
        throw asientosError;
      }

      // Procesar los asientos para extraer la información de costos de venta
      const costosVenta: CostoVentaInventario[] = [];

      asientos?.forEach((asiento: any) => {
        // Buscar el detalle que corresponde al costo de venta (cuenta 5002)
        const detalleCosto = asiento.detalle_asientos?.find(
          (detalle: any) => detalle.cuenta_codigo === '5002' && detalle.debe > 0
        );

        if (detalleCosto) {
          // Extraer el nombre del producto de la descripción
          let productoNombre = 'Producto Inventariado';
          const descripcionAsiento = asiento.descripcion || '';
          
          // La descripción del asiento generalmente tiene el formato "Venta: [Nombre Producto]"
          if (descripcionAsiento.includes('Venta:')) {
            productoNombre = descripcionAsiento.split('Venta:')[1]?.trim() || productoNombre;
          }

          costosVenta.push({
            id: asiento.id,
            fecha: asiento.fecha,
            descripcion: detalleCosto.descripcion || asiento.descripcion,
            monto: Number(detalleCosto.debe),
            numero_asiento: asiento.numero_asiento,
            producto_nombre: productoNombre
          });
        }
      });

      return costosVenta;
    }
  });
};
