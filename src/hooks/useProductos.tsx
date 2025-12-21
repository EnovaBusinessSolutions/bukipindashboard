import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

/**
 * Tipos UI (compat con lo que venías usando)
 * Nota: el backend nuevo usa camelCase: cuentaCodigo, subcuentaId, createdAt, updatedAt.
 * Aquí devolvemos AMBOS (camel + snake) para no romper pantallas legacy.
 */
export type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;

  // legacy opcional (si aún lo usas en UI)
  precio_venta?: number;
  imagen_url?: string | null;

  // ✅ compat: snake y camel
  cuentaCodigo: string;
  cuenta_codigo: string;

  subcuentaId: string | null;
  subcuenta_id: string | null;

  activo: boolean;

  // timestamps compat
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;

  // (legacy supabase)
  user_id?: string | null;

  // métricas opcionales
  cantidad_stock?: number;
  costo_unitario?: number;
  cantidad_comprada?: number;
  valor_total_inventario?: number;
};

export type ProductoConSubcuenta = Producto & {
  subcuenta_nombre?: string | null;
};

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string } | T;
const unwrap = <T,>(json: ApiEnvelope<T>): T => (json as any)?.data ?? (json as T);

const toErrorMessage = (err: any) => {
  if (!err) return "Error desconocido";
  if (typeof err === "string") return err;
  return err?.message || err?.error || "Error desconocido";
};

/** =========================
 * Normalizadores
 * ========================= */
const getId = (p: any) => String(p?.id ?? p?._id ?? "");
const getCuentaCodigo = (p: any) =>
  String(p?.cuentaCodigo ?? p?.accountCode ?? p?.cuenta_codigo ?? p?.cuentaCodigo ?? "4001");
const getSubcuentaId = (p: any) => {
  const v = p?.subcuentaId ?? p?.subcuenta_id ?? null;
  if (v === null || typeof v === "undefined") return null;
  const s = String(v).trim();
  return s ? s : null;
};

function mapProductoConSubcuenta(p: any): ProductoConSubcuenta {
  const id = getId(p);
  const cuentaCodigo = getCuentaCodigo(p);
  const subcuentaId = getSubcuentaId(p);

  const createdAt = p?.createdAt ?? p?.created_at ?? null;
  const updatedAt = p?.updatedAt ?? p?.updated_at ?? null;

  const subcuentaNombre =
    p?.subcuenta?.nombre ??
    p?.subcuentas?.nombre ??
    p?.subcuenta_nombre ??
    null;

  return {
    id,

    nombre: String(p?.nombre ?? p?.name ?? ""),
    descripcion: (p?.descripcion ?? p?.description ?? null) as any,
    precio: Number(p?.precio ?? p?.price ?? 0),

    // legacy opcional
    precio_venta: typeof p?.precio_venta !== "undefined" ? Number(p?.precio_venta) : undefined,
    imagen_url: typeof p?.imagen_url !== "undefined" ? (p?.imagen_url ?? null) : undefined,

    // ✅ compat
    cuentaCodigo,
    cuenta_codigo: cuentaCodigo,

    subcuentaId,
    subcuenta_id: subcuentaId,

    activo:
      typeof p?.activo === "boolean"
        ? p.activo
        : typeof p?.isActive === "boolean"
          ? p.isActive
          : true,

    // timestamps compat
    createdAt: createdAt ?? undefined,
    updatedAt: updatedAt ?? undefined,
    created_at: createdAt ?? undefined,
    updated_at: updatedAt ?? undefined,

    user_id: p?.user_id ?? null,

    subcuenta_nombre: subcuentaNombre,
  };
}

function sortByCreatedDesc(a: any, b: any) {
  const ta = a?.createdAt ?? a?.created_at ?? null;
  const tb = b?.createdAt ?? b?.created_at ?? null;

  const na = ta ? new Date(ta).getTime() : 0;
  const nb = tb ? new Date(tb).getTime() : 0;
  return nb - na;
}

/** =========================
 * Upload helper (FormData)
 * ========================= */
async function uploadProductImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/uploads/product-image", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!res.ok) {
    let msg = `Error subiendo imagen (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.message || j?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  const json = await res.json();
  const url =
    json?.data?.url ||
    json?.url ||
    json?.publicUrl ||
    json?.location ||
    json?.data?.publicUrl;

  if (!url) throw new Error("El backend no devolvió la URL de la imagen.");
  return url;
}

/** Lookup opcional */
async function lookupProductoPorNombre(nombre: string): Promise<ProductoConSubcuenta | null> {
  const res = await fetch(`/api/productos/lookup?nombre=${encodeURIComponent(nombre)}`, {
    method: "GET",
    credentials: "include",
  });

  if (res.status === 404) return null;
  if (!res.ok) return null;

  const json = await res.json();
  const p = unwrap<any>(json);
  if (!p) return null;
  return mapProductoConSubcuenta(p);
}

/** =========================
 * Queries
 * ========================= */

export const useProductos = () => {
  return useQuery({
    queryKey: ["productos"],
    queryFn: async (): Promise<ProductoConSubcuenta[]> => {
      const json = await apiFetch("/api/productos?activo=true", { method: "GET" });
      const data = unwrap<any[]>(json) || [];
      const mapped = data.map(mapProductoConSubcuenta);
      mapped.sort(sortByCreatedDesc);
      return mapped;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

export const useProductosServicios = () => {
  return useQuery({
    queryKey: ["productos-servicios"],
    queryFn: async (): Promise<ProductoConSubcuenta[]> => {
      // OJO: este query param sí es correcto para el backend: cuenta_codigo
      const json = await apiFetch("/api/productos?activo=true&cuenta_codigo=4001", { method: "GET" });
      const data = unwrap<any[]>(json) || [];
      const mapped = data.map(mapProductoConSubcuenta);
      mapped.sort(sortByCreatedDesc);
      return mapped;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

/** =========================
 * Mutations
 * ========================= */

export const useCreateProducto = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      nombre,
      precio,
      precioVenta,
      cantidad,
      descripcion,
      subcuentaId,
      imagen,
    }: {
      nombre: string;
      precio: number;
      precioVenta?: number;
      cantidad?: number; // si existe => compra inventario
      descripcion?: string;
      subcuentaId?: string | null; // ✅ permitir null para "Sin subcuenta"
      imagen?: File;
    }) => {
      const esCompraInventario = cantidad !== undefined;
      const cuentaCodigo = esCompraInventario ? "1005" : "4001";

      let imagenUrl: string | null = null;
      if (imagen) imagenUrl = await uploadProductImage(imagen);

      // Normaliza subcuenta: "" => null
      const subId = subcuentaId ? String(subcuentaId).trim() : null;

      if (esCompraInventario) {
        const costoTotal = Number(precio) * Number(cantidad || 0);

        // 1) lookup opcional
        let productoExistente = await lookupProductoPorNombre(nombre);

        // 2) fallback cache
        if (!productoExistente) {
          const cached = (queryClient.getQueryData(["productos"]) as ProductoConSubcuenta[] | undefined) || [];
          productoExistente =
            cached.find((p) => (p.nombre || "").trim().toLowerCase() === nombre.trim().toLowerCase()) || null;
        }

        if (productoExistente?.id) {
          // ✅ Actualiza producto existente (IMPORTANTE: ahora es PUT, no PATCH)
          const patch: any = {};

          if (descripcion !== undefined) patch.descripcion = descripcion || null;
          if (imagenUrl !== null) patch.imagen_url = imagenUrl; // (si tu backend no lo guarda aún, no rompe)
          if (subcuentaId !== undefined) patch.subcuentaId = subId; // ✅ CAMEL
          if (precioVenta !== undefined) patch.precio_venta = Number(precioVenta);

          // si hay algo que actualizar
          if (Object.keys(patch).length) {
            await apiFetch(`/api/productos/${encodeURIComponent(productoExistente.id)}`, {
              method: "PUT",
              body: JSON.stringify(patch),
            });
          }

          // movimiento de compra
          await apiFetch("/api/movimientos-inventario", {
            method: "POST",
            body: JSON.stringify({
              producto_id: productoExistente.id,
              tipo_movimiento: "compra",
              cantidad: Number(cantidad),
              costo_unitario: Number(precio),
              costo_total: Number(costoTotal),
              descripcion: "Compra adicional de inventario",
            }),
          });

          return { id: productoExistente.id, esActualizacion: true };
        }

        // Producto nuevo (inventario)
        const creadoJson = await apiFetch("/api/productos", {
          method: "POST",
          body: JSON.stringify({
            nombre,
            descripcion: descripcion || null,
            precio: Number(precio),
            cuentaCodigo,              // ✅ CAMEL (backend lo usa)
            subcuentaId: subId,         // ✅ CAMEL (backend lo usa)
            activo: true,

            // extras legacy (si tu modelo los tiene; si no, backend los ignora)
            precio_venta: Number(precioVenta || 0),
            imagen_url: imagenUrl,
          }),
        });

        const creado = mapProductoConSubcuenta(unwrap<any>(creadoJson));
        if (!creado?.id) throw new Error("El backend no devolvió id del producto creado.");

        await apiFetch("/api/movimientos-inventario", {
          method: "POST",
          body: JSON.stringify({
            producto_id: creado.id,
            tipo_movimiento: "compra",
            cantidad: Number(cantidad),
            costo_unitario: Number(precio),
            costo_total: Number(costoTotal),
            descripcion: "Compra inicial - Nuevo producto en inventario",
          }),
        });

        return { ...creado, esActualizacion: false };
      }

      // ===== Servicios (4001) =====
      const json = await apiFetch("/api/productos", {
        method: "POST",
        body: JSON.stringify({
          nombre,
          descripcion: descripcion || null,
          precio: Number(precio),
          cuentaCodigo,              // ✅ CAMEL
          subcuentaId: subId,        // ✅ CAMEL
          activo: true,

          // extras legacy
          precio_venta: Number(precioVenta ?? precio),
          imagen_url: imagenUrl,
        }),
      });

      return mapProductoConSubcuenta(unwrap<any>(json));
    },

    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["productos-servicios"] });

      if (data?.esActualizacion) {
        toast({
          title: "Inventario actualizado",
          description: "Se agregó una nueva compra al producto existente",
        });
      } else {
        toast({
          title: "Producto registrado",
          description: "Se registró correctamente el producto",
        });
      }
    },

    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Error al registrar: " + toErrorMessage(error),
        variant: "destructive",
      });
    },
  });
};

export const useUpdateProducto = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      nombre,
      descripcion,
      precio,
      imagen,
      subcuentaId,
    }: {
      id: string;
      nombre?: string;
      descripcion?: string;
      precio?: number;
      imagen?: File;
      subcuentaId?: string | null; // ✅ permitir null
    }) => {
      if (!id) throw new Error("Falta id del producto.");

      let imagenUrl: string | undefined;
      if (imagen) imagenUrl = await uploadProductImage(imagen);

      const updateData: any = {};

      if (nombre !== undefined) updateData.nombre = nombre;
      if (descripcion !== undefined) updateData.descripcion = descripcion || null;
      if (precio !== undefined) updateData.precio = Number(precio);

      // si tu backend aún no guarda imagen_url, esto no rompe
      if (imagenUrl !== undefined) updateData.imagen_url = imagenUrl;

      // ✅ CLAVE: el backend nuevo espera subcuentaId (camel)
      if (typeof subcuentaId !== "undefined") {
        const v = subcuentaId ? String(subcuentaId).trim() : null;
        updateData.subcuentaId = v; // ✅ CAMEL
      }

      // ✅ CLAVE: tu backend no tiene PATCH, usa PUT
      const json = await apiFetch(`/api/productos/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
      });

      return mapProductoConSubcuenta(unwrap<any>(json));
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["productos-servicios"] });
      toast({
        title: "Producto actualizado",
        description: "El producto se ha actualizado correctamente",
      });
    },

    onError: (error: any) => {
      toast({
        title: "Error",
        description: toErrorMessage(error) || "No se pudo actualizar el producto",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteProducto = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!id) throw new Error("Falta id del producto.");

      // ✅ backend: PUT /api/productos/:id con { activo:false }
      await apiFetch(`/api/productos/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ activo: false }),
      });

      return true;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["productos-servicios"] });
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido desactivado exitosamente",
      });
    },

    onError: (error: any) => {
      toast({
        title: "Error",
        description: toErrorMessage(error) || "Error al eliminar el producto",
        variant: "destructive",
      });
    },
  });
};
