import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProductoInventario = {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  precio_venta: number;
  cuenta_codigo: string;
  user_id: string;
  subcuenta_id: string | null;
  subcuenta_nombre?: string;
  // Métricas calculadas desde movimientos
  cantidad_comprada: number;
  cantidad_vendida: number;
  cantidad_stock: number;
  costo_unitario: number;
  valor_total_inventario: number;
  ultimo_movimiento: string | null;
};

export const useInventarioConMovimientos = () => {
  return useQuery({
    queryKey: ["inventario-con-movimientos"],
    queryFn: async () => {
      // 1. Obtener productos de inventario
      const { data: productos, error: productosError } = await supabase
        .from("productos")
        .select(`
          *,
          subcuentas (
            nombre
          )
        `)
        .eq("cuenta_codigo", "1005")
        .eq("activo", true);

      if (productosError) throw productosError;

      // 2. Obtener movimientos activos
      const { data: movimientos, error: movimientosError } = await supabase
        .from("movimientos_inventario")
        .select("*")
        .eq("estado", "activo")
        .order("fecha", { ascending: false });

      if (movimientosError) throw movimientosError;

      // 3. Calcular métricas por producto
      const productosConMetricas: ProductoInventario[] = (productos || []).map(producto => {
        const movimientosProducto = movimientos?.filter(
          m => m.producto_id === producto.id
        ) || [];

        // Calcular compras
        const compras = movimientosProducto.filter(m => m.tipo_movimiento === 'compra');
        const cantidad_comprada = compras.reduce((sum, m) => sum + Number(m.cantidad), 0);
        const costo_total_compras = compras.reduce((sum, m) => sum + Number(m.costo_total), 0);

        // Calcular ventas
        const ventas = movimientosProducto.filter(m => m.tipo_movimiento === 'venta');
        const cantidad_vendida = ventas.reduce((sum, m) => sum + Number(m.cantidad), 0);

        // Calcular ajustes
        const ajustes = movimientosProducto.filter(m => m.tipo_movimiento === 'ajuste');
        const ajuste_cantidad = ajustes.reduce((sum, m) => sum + Number(m.cantidad), 0);

        // Stock actual
        const cantidad_stock = cantidad_comprada - cantidad_vendida + ajuste_cantidad;

        // Costo promedio ponderado
        const costo_unitario = cantidad_comprada > 0 
          ? costo_total_compras / cantidad_comprada 
          : 0;

        // Valor total del inventario
        const valor_total_inventario = cantidad_stock * costo_unitario;

        // Último movimiento
        const ultimo_movimiento = movimientosProducto[0]?.fecha || null;

        return {
          id: producto.id,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          imagen_url: producto.imagen_url,
          precio_venta: Number(producto.precio_venta || 0),
          cuenta_codigo: producto.cuenta_codigo,
          user_id: producto.user_id!,
          subcuenta_id: producto.subcuenta_id,
          subcuenta_nombre: (producto.subcuentas as any)?.nombre,
          cantidad_comprada,
          cantidad_vendida,
          cantidad_stock,
          costo_unitario,
          valor_total_inventario,
          ultimo_movimiento,
        };
      });

      return productosConMetricas;
    },
  });
};
