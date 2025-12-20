import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

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

  // Métricas de rotación
  fecha_primera_compra: string | null;
  fecha_ultima_venta: string | null;
  dias_promedio_rotacion: number | undefined;
  estado_rotacion: "alta" | "media" | "baja" | "muy_baja" | "sin_movimiento" | undefined;
};

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string } | T;
const unwrap = <T,>(json: ApiEnvelope<T>): T => (json as any)?.data ?? (json as T);

type ProductoApi = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  imagen_url?: string | null;
  precio_venta?: number | string | null;
  cuenta_codigo: string;
  user_id: string;
  subcuenta_id?: string | null;
  activo?: boolean;
  subcuentas?: { nombre?: string | null } | null;
};

type MovimientoApi = {
  id: string;
  producto_id: string;
  tipo_movimiento: "compra" | "venta" | "ajuste";
  cantidad: number | string;
  costo_total?: number | string | null;
  costo_unitario?: number | string | null;
  fecha: string;
  estado?: string;
};

const num = (v: any) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const useInventarioConMovimientos = () => {
  return useQuery({
    queryKey: ["inventario-con-movimientos"],
    queryFn: async (): Promise<ProductoInventario[]> => {
      // 1) Productos inventario (cuenta 1005)
      const productosParams = new URLSearchParams();
      productosParams.set("cuenta_codigo", "1005");
      productosParams.set("activo", "true");
      // opcional (si tu backend soporta populate/include)
      productosParams.set("include", "subcuentas");

      const productosJson = await apiFetch(`/api/productos?${productosParams.toString()}`, {
        method: "GET",
      });

      const productos = (unwrap<ProductoApi[]>(productosJson) || []).filter(
        (p) => p.cuenta_codigo === "1005" && p.activo !== false
      );

      // 2) Movimientos activos (desc)
      const movParams = new URLSearchParams();
      movParams.set("estado", "activo");
      movParams.set("order", "fecha:desc");

      const movimientosJson = await apiFetch(`/api/movimientos-inventario?${movParams.toString()}`, {
        method: "GET",
      });

      const movimientos = (unwrap<MovimientoApi[]>(movimientosJson) || []).filter(
        (m) => (m.estado ?? "activo") === "activo"
      );

      // 3) Indexar movimientos por producto (para performance)
      const movimientosPorProducto = new Map<string, MovimientoApi[]>();
      for (const m of movimientos) {
        if (!m?.producto_id) continue;
        const arr = movimientosPorProducto.get(m.producto_id) || [];
        arr.push(m);
        movimientosPorProducto.set(m.producto_id, arr);
      }

      // Asegurar que queden ordenados DESC por fecha (por si el backend no lo garantiza)
      for (const [k, arr] of movimientosPorProducto.entries()) {
        arr.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        movimientosPorProducto.set(k, arr);
      }

      // 4) Calcular métricas por producto
      const productosConMetricas: ProductoInventario[] = productos.map((producto) => {
        const movimientosProducto = movimientosPorProducto.get(producto.id) || [];

        const compras = movimientosProducto.filter((m) => m.tipo_movimiento === "compra");
        const ventas = movimientosProducto.filter((m) => m.tipo_movimiento === "venta");
        const ajustes = movimientosProducto.filter((m) => m.tipo_movimiento === "ajuste");

        const cantidad_comprada = compras.reduce((sum, m) => sum + num(m.cantidad), 0);
        const costo_total_compras = compras.reduce((sum, m) => sum + num(m.costo_total), 0);

        const cantidad_vendida = ventas.reduce((sum, m) => sum + num(m.cantidad), 0);

        // Ajustes: pueden ser + o -
        const ajuste_cantidad = ajustes.reduce((sum, m) => sum + num(m.cantidad), 0);

        const cantidad_stock = cantidad_comprada - cantidad_vendida + ajuste_cantidad;

        // Costo promedio ponderado (solo compras)
        const costo_unitario = cantidad_comprada > 0 ? costo_total_compras / cantidad_comprada : 0;

        const valor_total_inventario = cantidad_stock * costo_unitario;

        const ultimo_movimiento = movimientosProducto[0]?.fecha || null;

        // ===== ROTACIÓN =====

        // primera compra: la más vieja => compras ordenadas DESC, entonces la última del array es la más vieja
        const fecha_primera_compra = compras.length > 0 ? compras[compras.length - 1].fecha : null;

        // última venta: la más nueva => ventas ordenadas DESC, entonces [0]
        const fecha_ultima_venta = ventas.length > 0 ? ventas[0].fecha : null;

        let dias_promedio_rotacion: number | undefined = undefined;
        let estado_rotacion:
          | "alta"
          | "media"
          | "baja"
          | "muy_baja"
          | "sin_movimiento"
          | undefined = undefined;

        if (fecha_primera_compra && cantidad_vendida > 0) {
          const diasTranscurridos = Math.floor(
            (Date.now() - new Date(fecha_primera_compra).getTime()) / (1000 * 60 * 60 * 24)
          );

          const stock_promedio = (cantidad_comprada + cantidad_stock) / 2;

          const ciclos_rotacion = stock_promedio > 0 ? cantidad_vendida / stock_promedio : 0;

          if (ciclos_rotacion > 0) {
            dias_promedio_rotacion = diasTranscurridos / ciclos_rotacion;

            if (dias_promedio_rotacion < 30) estado_rotacion = "alta";
            else if (dias_promedio_rotacion < 60) estado_rotacion = "media";
            else if (dias_promedio_rotacion < 90) estado_rotacion = "baja";
            else estado_rotacion = "muy_baja";
          } else {
            estado_rotacion = "sin_movimiento";
          }
        } else {
          estado_rotacion = "sin_movimiento";
        }

        return {
          id: producto.id,
          nombre: producto.nombre,
          descripcion: producto.descripcion ?? null,
          imagen_url: producto.imagen_url ?? null,
          precio_venta: num(producto.precio_venta),
          cuenta_codigo: producto.cuenta_codigo,
          user_id: producto.user_id,
          subcuenta_id: producto.subcuenta_id ?? null,
          subcuenta_nombre: producto.subcuentas?.nombre ?? undefined,

          cantidad_comprada,
          cantidad_vendida,
          cantidad_stock,
          costo_unitario,
          valor_total_inventario,
          ultimo_movimiento,

          fecha_primera_compra,
          fecha_ultima_venta,
          dias_promedio_rotacion,
          estado_rotacion,
        };
      });

      return productosConMetricas;
    },
  });
};
