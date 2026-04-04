// dashboard-src/src/hooks/useInventarioConMovimientos.tsx
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

type ApiEnvelope<T> = { ok?: boolean; data?: any; message?: string } | T;

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

/** ✅ Normaliza cualquier shape para devolver un array */
function asArray<T = any>(json: ApiEnvelope<any>): T[] {
  const j: any = json as any;

  // {ok:true, data:[...]}
  if (Array.isArray(j?.data)) return j.data as T[];

  // {ok:true, data:{items:[...]}}
  if (Array.isArray(j?.data?.items)) return j.data.items as T[];

  // {ok:true, data:{movimientos:[...]}}
  if (Array.isArray(j?.data?.movimientos)) return j.data.movimientos as T[];

  // ✅ extras comunes (productos)
  if (Array.isArray(j?.data?.productos)) return j.data.productos as T[];
  if (Array.isArray(j?.data?.products)) return j.data.products as T[];
  if (Array.isArray(j?.data?.result)) return j.data.result as T[];

  // array directo
  if (Array.isArray(j)) return j as T[];

  // {items:[...]}
  if (Array.isArray(j?.items)) return j.items as T[];

  // {movimientos:[...]}
  if (Array.isArray(j?.movimientos)) return j.movimientos as T[];

  // ✅ extras directos
  if (Array.isArray(j?.productos)) return j.productos as T[];
  if (Array.isArray(j?.products)) return j.products as T[];
  if (Array.isArray(j?.result)) return j.result as T[];

  return [];
}

type MovimientoLike = any;

const getMovId = (m: MovimientoLike) => String(m?.id ?? m?._id ?? "");

/** ✅ productoId (incluye cuando viene como string o ObjectId o nested) */
const getMovProductoId = (m: MovimientoLike) =>
  String(
    m?.producto_id ??
      m?.productoId ??
      m?.productId ??
      m?.productoIdString ??
      m?.productIdString ??
      m?.producto ??
      m?.product ??
      m?.producto?._id ??
      m?.product?._id ??
      m?.productoId?._id ??
      m?.productId?._id ??
      ""
  );

const getMovTipo = (m: MovimientoLike) =>
  String(m?.tipo_movimiento ?? m?.tipoMovimiento ?? m?.tipo ?? m?.type ?? "")
    .toLowerCase()
    .trim();

const getMovFecha = (m: MovimientoLike) =>
  String(m?.fecha ?? m?.date ?? m?.createdAt ?? m?.created_at ?? m?.updatedAt ?? m?.updated_at ?? "").trim();

const getMovCantidad = (m: MovimientoLike) =>
  num(
    m?.cantidad ??
      m?.qty ??
      m?.quantity ??
      m?.unidades ??
      m?.units ??
      // ✅ a veces viene nested
      m?.detalle?.cantidad ??
      m?.detalle?.qty ??
      m?.payload?.cantidad ??
      m?.data?.cantidad ??
      // ✅ alias común en ventas inventariadas
      m?.cantidadVendida ??
      m?.cantidad_vendida
  );

/** -------------------------
 * ✅ Helpers deep (dot paths)
 * ------------------------- */
function getByPath(obj: any, path: string) {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** lee el primer número >0 desde paths (dot paths) */
function pickNumberDeep(obj: any, paths: string[]): number {
  for (const path of paths) {
    const v = getByPath(obj, path);
    const n = num(v);
    if (n > 0) return n;
  }
  return 0;
}

/**
 * ✅ Costo TOTAL (root + deep aliases)
 */
const getMovCostoTotal = (m: MovimientoLike) => {
  const root =
    num(
      m?.costo_total ??
        m?.costoTotal ??
        m?.total ??
        m?.monto_total ??
        m?.montoTotal ??
        m?.importe_total ??
        m?.importeTotal ??
        m?.amount ??
        m?.monto ??
        m?.importe ??
        m?.totalCompra ??
        m?.total_compra
    ) || 0;
  if (root > 0) return root;

  return pickNumberDeep(m, [
    "detalle.costo_total",
    "detalle.costoTotal",
    "detalle.total",
    "detalle.monto_total",
    "detalle.montoTotal",
    "detalle.importe_total",
    "detalle.importeTotal",
    "detalle.amount",
    "payload.costo_total",
    "payload.costoTotal",
    "payload.total",
    "payload.monto_total",
    "payload.montoTotal",
    "data.costo_total",
    "data.costoTotal",
    "data.total",
    "data.monto_total",
    "data.montoTotal",
    "meta.total",
    "meta.totalCompra",
    "meta.total_compra",
    "items.0.total",
    "items.0.monto",
    "items.0.importe",
  ]);
};

/**
 * ✅ Costo UNITARIO (root + deep aliases)
 */
const getMovCostoUnit = (m: MovimientoLike) => {
  const root =
    num(
      m?.costo_unitario ??
        m?.costoUnitario ??
        m?.unitCost ??
        m?.costoUnit ??
        m?.costoCompra ??
        m?.costo_compra ??
        m?.precio_unitario ??
        m?.precioUnitario ??
        m?.unitPrice ??
        m?.precio ??
        m?.price ??
        m?.precioUnitarioCompra ??
        m?.precio_unitario_compra
    ) || 0;
  if (root > 0) return root;

  return pickNumberDeep(m, [
    "detalle.costo_unitario",
    "detalle.costoUnitario",
    "detalle.unitCost",
    "detalle.unit_cost",
    "detalle.costoCompra",
    "detalle.costo_compra",
    "detalle.precioUnitario",
    "detalle.precio_unitario",
    "detalle.unitPrice",
    "detalle.unit_price",
    "detalle.precioUnitarioCompra",
    "detalle.precio_unitario_compra",
    "payload.costo_unitario",
    "payload.costoUnitario",
    "payload.unitCost",
    "payload.costoCompra",
    "payload.costo_compra",
    "payload.precioUnitario",
    "payload.precio_unitario",
    "payload.precioUnitarioCompra",
    "payload.precio_unitario_compra",
    "data.costo_unitario",
    "data.costoUnitario",
    "data.unitCost",
    "data.costoCompra",
    "data.costo_compra",
    "data.precioUnitario",
    "data.precio_unitario",
    "data.precioUnitarioCompra",
    "data.precio_unitario_compra",
    "items.0.costo_unitario",
    "items.0.costoUnitario",
    "items.0.unitCost",
    "items.0.precioUnitario",
    "items.0.precioUnitarioCompra",
    "items.0.precio",
    "items.0.price",
  ]);
};

/**
 * ✅ Costo unitario efectivo:
 * - si viene unitario, úsalo
 * - si viene total y qty > 0, usa total/qty
 */
function getEffectiveUnitCost(m: MovimientoLike): number {
  const qty = getMovCantidad(m);
  const unit = getMovCostoUnit(m);
  if (unit > 0) return unit;

  const total = getMovCostoTotal(m);
  if (total > 0 && qty > 0) return total / qty;

  const alt =
    num(m?.costo) ||
    num(m?.cost) ||
    num(m?.purchaseCost) ||
    num(m?.precioCompra) ||
    num(m?.precio_compra) ||
    num(m?.detalle?.costo) ||
    num(m?.payload?.costo) ||
    0;

  if (alt > 0) return alt;
  return 0;
}

/** ✅ Cancelación robusta */
function isCancelled(m: any): boolean {
  const c =
    m?.cancelado ??
    m?.isCanceled ??
    m?.isCancelled ??
    m?.canceled ??
    m?.cancelled ??
    m?.anulado ??
    m?.isAnulado ??
    false;

  if (typeof c === "boolean") return c;

  const st = String(m?.estado ?? m?.status ?? "").toLowerCase();
  if (st === "cancelado" || st === "cancelled" || st === "canceled" || st === "anulado") return true;

  return false;
}

/** ✅ movimientos activos (no cancelados) */
function isActiveMovimiento(m: any): boolean {
  if (isCancelled(m)) return false;

  const st = String(m?.estado ?? m?.status ?? "activo").toLowerCase().trim();

  // aceptamos "activo" o vacío (legacy)
  if (!st) return true;
  if (st === "activo") return true;

  // cualquier otro status lo consideramos NO activo
  return false;
}

/** Trae productos inventariados (preferir inventario=1/true; fallback cuenta 1005) */
async function fetchProductosInventario() {
  // ✅ 1) preferidos: inventario=1 e inventario=true (muchos backends solo aceptan "true")
  const tries = ["/api/productos?inventario=1", "/api/productos?inventario=true"];

  for (const url of tries) {
    try {
      const json = await apiFetch(url, { method: "GET" });
      const arr = asArray<any>(json);
      if (arr.length) return arr;
    } catch (_) {}
  }

  // ✅ 2) fallback: cuenta_codigo=1005 (si tu backend lo soporta)
  try {
    const params = new URLSearchParams();
    params.set("cuenta_codigo", "1005");
    params.set("activo", "true");
    params.set("include", "subcuentas");
    const json = await apiFetch(`/api/productos?${params.toString()}`, { method: "GET" });
    return asArray<any>(json);
  } catch (_) {
    return [];
  }
}

/** Trae movimientos inventario (preferir /api/movimientos-inventario; fallbacks legacy si existen) */
async function fetchMovimientosInventario() {
  // ✅ 1) endpoint real (backend nuevo)
  try {
    const params = new URLSearchParams();
    params.set("limit", "5000");
    params.set("order", "fecha:desc");
    // algunos backends usan estado; otros ignoran. No estorba.
    params.set("estado", "activo");

    const json = await apiFetch(`/api/movimientos-inventario?${params.toString()}`, { method: "GET" });
    const arr = asArray<any>(json);
    if (arr.length) return arr;
  } catch (_) {}

  // ✅ 2) fallback legacy: /api/inventario/movimientos (si existiera)
  try {
    const params = new URLSearchParams();
    params.set("limit", "5000");
    params.set("order", "fecha:desc");
    params.set("estado", "activo");

    const json = await apiFetch(`/api/inventario/movimientos?${params.toString()}`, { method: "GET" });
    const arr = asArray<any>(json);
    if (arr.length) return arr;
  } catch (_) {}

  // ✅ 3) fallback legacy por tipo
  const tipos: Array<"compra" | "venta" | "ajuste"> = ["compra", "venta", "ajuste"];
  const out: any[] = [];

  for (const tipo of tipos) {
    try {
      const params = new URLSearchParams();
      params.set("tipo", tipo);
      params.set("estado", "activo");
      params.set("order", "fecha:desc");
      params.set("limit", "5000");

      const json = await apiFetch(`/api/inventario/movimientos?${params.toString()}`, { method: "GET" });
      out.push(...asArray<any>(json));
    } catch (_) {}
  }

  return out;
}

export const useInventarioConMovimientos = () => {
  return useQuery({
    queryKey: ["inventario-con-movimientos"],

    queryFn: async (): Promise<ProductoInventario[]> => {
      // 1) Productos inventario
      const productosRaw = await fetchProductosInventario();

      const productos = productosRaw
        .map((p) => ({
          raw: p,
          id: getId(p),
          cuentaCodigo: getCuentaCodigo(p),
          activo: getActivo(p),
        }))
        // ojo: tu filtro permite 1005 o vacío (legacy). Lo dejamos igual para no romper.
        .filter((p) => p.id && (p.cuentaCodigo === "1005" || !p.cuentaCodigo) && p.activo !== false)
        .map((p) => p.raw);

      // 2) Movimientos (E2E real)
      const movimientosRaw = await fetchMovimientosInventario();

      // Filtrar activos + con productoId
      const movimientos0 = movimientosRaw
        .filter((m) => isActiveMovimiento(m))
        .filter((m) => !!getMovProductoId(m));

      // Deduplicar por id
      const seen = new Set<string>();
      const movimientos = movimientos0.filter((m) => {
        const id = getMovId(m);
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

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

      // ✅ 3.5) FALLBACK E2E: si productos viene vacío pero hay movimientos,
      // crear "productos base" desde lo poblado en el movimiento (product/producto)
      let productosBase: any[] = productos;

      if (productosBase.length === 0 && movimientos.length > 0) {
        const byId = new Map<string, any>();

        for (const m of movimientos) {
          const pid = getMovProductoId(m);
          if (!pid) continue;

          const embedded =
            m?.product ??
            m?.producto ??
            (m?.productId && typeof m.productId === "object" ? m.productId : null) ??
            (m?.productoId && typeof m.productoId === "object" ? m.productoId : null) ??
            null;

          if (embedded && typeof embedded === "object") {
            const eid = String((embedded as any)?._id ?? (embedded as any)?.id ?? pid);
            byId.set(pid, {
              ...embedded,
              _id: (embedded as any)?._id ?? eid,
              id: (embedded as any)?.id ?? eid,
            });
          } else {
            // placeholder mínimo para que se vea en UI (y métricas se calculan igual)
            byId.set(pid, {
              _id: pid,
              id: pid,
              nombre: "Producto",
              cuenta_codigo: "1005",
              activo: true,
            });
          }
        }

        productosBase = Array.from(byId.values());
      }

      // 4) Calcular métricas por producto
      const productosConMetricas: ProductoInventario[] = productosBase.map((producto: any) => {
        const productoId = getId(producto);
        const movimientosProducto = movimientosPorProducto.get(productoId) || [];

        // ✅ normalizar tipos
        const compras = movimientosProducto.filter((m) => {
          const t = getMovTipo(m);
          return t === "compra" || t === "entrada";
        });

        const ventas = movimientosProducto.filter((m) => {
          const t = getMovTipo(m);
          return t === "venta" || t === "salida";
        });

        const ajustes = movimientosProducto.filter((m) => getMovTipo(m) === "ajuste");

        const cantidad_comprada = compras.reduce((sum, m) => sum + getMovCantidad(m), 0);
        const cantidad_vendida = ventas.reduce((sum, m) => sum + getMovCantidad(m), 0);

        // Ajustes: por compat, si alguna vez viene delta negativo, lo respetamos
        const ajuste_cantidad = ajustes.reduce((sum, m) => {
          const delta =
            num(m?.delta ?? m?.cantidad_delta ?? m?.cantidadDelta ?? m?.ajuste ?? m?.adjustment) || getMovCantidad(m);
          return sum + delta;
        }, 0);

        const cantidad_stock = cantidad_comprada - cantidad_vendida + ajuste_cantidad;

        // ✅ Costo promedio ponderado (solo compras con costo válido)
        let totalCost = 0;
        let totalQty = 0;

        for (const m of compras) {
          const qty = getMovCantidad(m);
          const unit = getEffectiveUnitCost(m);
          if (qty > 0 && unit > 0) {
            totalQty += qty;
            totalCost += unit * qty;
          }
        }

        let costo_unitario = totalQty > 0 ? totalCost / totalQty : 0;

        // ✅ Fallback FINAL: si no se pudo desde movimientos, usa el costoCompra guardado en el producto
        if (costo_unitario <= 0) {
          const fallback =
            num(producto?.costoCompra) ||
            num(producto?.costo_compra) ||
            num(producto?.precioCompra) ||
            num(producto?.precio_compra) ||
            0;

          if (fallback > 0) costo_unitario = fallback;
        }

        const valor_total_inventario = cantidad_stock * costo_unitario;

        const ultimo_movimiento = movimientosProducto[0] ? getMovFecha(movimientosProducto[0]) : null;

        // ===== ROTACIÓN =====
        const fecha_primera_compra = compras.length > 0 ? getMovFecha(compras[compras.length - 1]) : null;
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

        // ✅ precio de venta robusto
        const precio_venta = num(
          producto?.precio_venta ??
            producto?.precioVenta ??
            producto?.precio_venta_sugerido ??
            producto?.precioVentaSugerido ??
            0
        );

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

    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};