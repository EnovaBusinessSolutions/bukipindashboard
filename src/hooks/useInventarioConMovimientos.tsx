import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ProductoInventario = {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  precio_venta: number;

  // compat
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

const num = (v: any) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const strOrNull = (v: any) => {
  if (v === null || typeof v === "undefined") return null;
  const s = String(v).trim();
  return s ? s : null;
};

const getId = (p: any) => String(p?.id ?? p?._id ?? "");
const getCuentaCodigo = (p: any) =>
  String(p?.cuentaCodigo ?? p?.accountCode ?? p?.cuenta_codigo ?? p?.cuentaCodigo ?? "");
const getActivo = (p: any) => {
  if (typeof p?.activo === "boolean") return p.activo;
  if (typeof p?.isActive === "boolean") return p.isActive;
  return true;
};
const getUserId = (p: any) => String(p?.user_id ?? p?.userId ?? p?.owner ?? "");

type MovimientoLike = any;
const getMovProductoId = (m: MovimientoLike) => String(m?.producto_id ?? m?.productoId ?? m?.productId ?? "");
const getMovTipo = (m: MovimientoLike) =>
  String(m?.tipo_movimiento ?? m?.tipoMovimiento ?? m?.tipo ?? "").toLowerCase().trim();
const getMovFecha = (m: MovimientoLike) =>
  String(m?.fecha ?? m?.createdAt ?? m?.created_at ?? m?.updatedAt ?? "").trim();
const getMovEstado = (m: MovimientoLike) => String(m?.estado ?? "activo").toLowerCase().trim();
const getMovCantidad = (m: MovimientoLike) => num(m?.cantidad);
const getMovCostoTotal = (m: MovimientoLike) => num(m?.costo_total ?? m?.costoTotal);
const getMovCostoUnit = (m: MovimientoLike) => num(m?.costo_unitario ?? m?.costoUnitario);

export const useInventarioConMovimientos = () => {
  return useQuery({
    queryKey: ["inventario-con-movimientos"],

    queryFn: async (): Promise<ProductoInventario[]> => {
      // 1) Productos inventario (cuenta 1005)
      // ✅ El backend espera cuenta_codigo (query param), pero responde con cuentaCodigo (camel) en data normalizada.
      const productosParams = new URLSearchParams();
      productosParams.set("cuenta_codigo", "1005");
      productosParams.set("activo", "true");
      // Nota: si el backend no soporta include, no pasa nada
      productosParams.set("include", "subcuentas");

      const productosJson = await apiFetch(`/api/productos?${productosParams.toString()}`, {
        method: "GET",
      });

      const productosRaw = unwrap<any[]>(productosJson) || [];

      const productos = productosRaw
        .map((p) => ({
          raw: p,
          id: getId(p),
          cuentaCodigo: getCuentaCodigo(p),
          activo: getActivo(p),
        }))
        .filter((p) => p.id && p.cuentaCodigo === "1005" && p.activo !== false)
        .map((p) => p.raw);

      // 2) Movimientos activos (desc)
      const movParams = new URLSearchParams();
      movParams.set("estado", "activo");
      movParams.set("order", "fecha:desc");

      const movimientosJson = await apiFetch(`/api/movimientos-inventario?${movParams.toString()}`, {
        method: "GET",
      });

      const movimientosRaw = unwrap<any[]>(movimientosJson) || [];

      const movimientos = movimientosRaw
        .filter((m) => getMovEstado(m) === "activo")
        .filter((m) => getMovProductoId(m)); // debe traer producto id

      // 3) Indexar movimientos por producto
      const movimientosPorProducto = new Map<string, MovimientoLike[]>();

      for (const m of movimientos) {
        const pid = getMovProductoId(m);
        const arr = movimientosPorProducto.get(pid) || [];
        arr.push(m);
        movimientosPorProducto.set(pid, arr);
      }

      // Ordenar DESC por fecha
      for (const [k, arr] of movimientosPorProducto.entries()) {
        arr.sort((a, b) => {
          const fa = getMovFecha(a);
          const fb = getMovFecha(b);
          const ta = fa ? new Date(fa).getTime() : 0;
          const tb = fb ? new Date(fb).getTime() : 0;
          return tb - ta;
        });
        movimientosPorProducto.set(k, arr);
      }

      // 4) Calcular métricas por producto
      const productosConMetricas: ProductoInventario[] = productos.map((producto: any) => {
        const productoId = getId(producto);
        const movimientosProducto = movimientosPorProducto.get(productoId) || [];

        const compras = movimientosProducto.filter((m) => getMovTipo(m) === "compra");
        const ventas = movimientosProducto.filter((m) => getMovTipo(m) === "venta");
        const ajustes = movimientosProducto.filter((m) => getMovTipo(m) === "ajuste");

        const cantidad_comprada = compras.reduce((sum, m) => sum + getMovCantidad(m), 0);
        const costo_total_compras = compras.reduce((sum, m) => {
          const ct = getMovCostoTotal(m);
          // si por alguna razón no viene costo_total, intentamos costo_unitario * cantidad
          if (ct > 0) return sum + ct;
          const cu = getMovCostoUnit(m);
          const qty = getMovCantidad(m);
          return sum + cu * qty;
        }, 0);

        const cantidad_vendida = ventas.reduce((sum, m) => sum + getMovCantidad(m), 0);

        // Ajustes: pueden ser + o -
        const ajuste_cantidad = ajustes.reduce((sum, m) => sum + getMovCantidad(m), 0);

        const cantidad_stock = cantidad_comprada - cantidad_vendida + ajuste_cantidad;

        // Costo promedio ponderado (solo compras)
        const costo_unitario = cantidad_comprada > 0 ? costo_total_compras / cantidad_comprada : 0;

        const valor_total_inventario = cantidad_stock * costo_unitario;

        const ultimo_movimiento = movimientosProducto[0] ? getMovFecha(movimientosProducto[0]) : null;

        // ===== ROTACIÓN =====
        // compras están en el orden del array (DESC), entonces la más vieja es la última
        const fecha_primera_compra =
          compras.length > 0 ? getMovFecha(compras[compras.length - 1]) : null;

        // ventas en DESC, entonces la más nueva es [0]
        const fecha_ultima_venta = ventas.length > 0 ? getMovFecha(ventas[0]) : null;

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

        // ===== MAPEO producto (compat camel + snake) =====
        const nombre = String(producto?.nombre ?? producto?.name ?? "");
        const descripcion = (producto?.descripcion ?? producto?.description ?? null) as any;

        const imagen_url = (producto?.imagen_url ?? producto?.imagenUrl ?? null) as any;

        const precio_venta = num(producto?.precio_venta ?? producto?.precioVenta ?? 0);

        const cuenta_codigo = getCuentaCodigo(producto) || "1005";
        const user_id = getUserId(producto);

        const subcuenta_id = strOrNull(producto?.subcuentaId ?? producto?.subcuenta_id ?? null);

        const subcuenta_nombre =
          producto?.subcuenta?.nombre ??
          producto?.subcuentas?.nombre ??
          producto?.subcuenta_nombre ??
          undefined;

        return {
          id: productoId,
          nombre,
          descripcion,
          imagen_url,
          precio_venta,
          cuenta_codigo,
          user_id,
          subcuenta_id,
          subcuenta_nombre,

          cantidad_comprada,
          cantidad_vendida,
          cantidad_stock,
          costo_unitario,
          valor_total_inventario,
          ultimo_movimiento: ultimo_movimiento || null,

          fecha_primera_compra: fecha_primera_compra || null,
          fecha_ultima_venta: fecha_ultima_venta || null,
          dias_promedio_rotacion,
          estado_rotacion,
        };
      });

      return productosConMetricas;
    },

    // ✅ para no estar pegando cada ratito
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
