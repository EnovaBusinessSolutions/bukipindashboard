import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  precio_venta?: number;
  imagen_url: string | null;
  cuenta_codigo: string;
  subcuenta_id: string | null;
  activo: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;

  // métricas opcionales (pueden venir del backend o calcularse en otros hooks)
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

// ---- Upload helper (FormData) ----
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

// ---- Lookup helper (opcional) ----
// Si el endpoint no existe o devuelve 404, regresa null (y el hook crea el producto nuevo).
async function lookupProductoPorNombre(nombre: string): Promise<Producto | null> {
  const res = await fetch(`/api/productos/lookup?nombre=${encodeURIComponent(nombre)}`, {
    method: "GET",
    credentials: "include",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    // si el endpoint no existe (404 ya cubierto) o falla, mejor no romper flujo:
    // dejamos que el caller haga fallback.
    return null;
  }

  const json = await res.json();
  return unwrap<Producto>(json) ?? null;
}

function mapProductoConSubcuenta(p: any): ProductoConSubcuenta {
  
  const subcuentaNombre =
    p?.subcuentas?.nombre ?? p?.subcuenta?.nombre ?? p?.subcuenta_nombre ?? null;

  return {
    ...p,
    subcuenta_nombre: subcuentaNombre,
  };
}

// =======================
// Queries
// =======================

export const useProductos = () => {
  return useQuery({
    queryKey: ["productos"],
    queryFn: async (): Promise<ProductoConSubcuenta[]> => {
      const json = await apiFetch("/api/productos?activo=true", { method: "GET" });
      const data = unwrap<any[]>(json) || [];

      // Orden similar al original: created_at DESC (si existe)
      const sorted = [...data].sort((a, b) => {
        const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });

      return sorted.map(mapProductoConSubcuenta);
    },
  });
};

// Hook para obtener solo productos de servicios (precargados) - excluye inventario
export const useProductosServicios = () => {
  return useQuery({
    queryKey: ["productos-servicios"],
    queryFn: async (): Promise<ProductoConSubcuenta[]> => {
      const json = await apiFetch("/api/productos?activo=true&cuenta_codigo=4001", {
        method: "GET",
      });
      const data = unwrap<any[]>(json) || [];

      const sorted = [...data].sort((a, b) => {
        const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });

      return sorted.map(mapProductoConSubcuenta);
    },
  });
};

// =======================
// Mutations
// =======================

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
      subcuentaId?: string;
      imagen?: File;
    }) => {
      const esCompraInventario = cantidad !== undefined;
      const cuentaCodigo = esCompraInventario ? "1005" : "4001";

      // Subir imagen si aplica
      let imagenUrl: string | null = null;
      if (imagen) {
        imagenUrl = await uploadProductImage(imagen);
      }

      if (esCompraInventario) {
        // ===== Inventario: upsert producto por nombre + crear movimiento compra =====
        const costoTotal = precio * Number(cantidad || 0);

        // 1) Intentar lookup por endpoint (si existe)
        let productoExistente: Producto | null = await lookupProductoPorNombre(nombre);

        // 2) Fallback: buscar en cache de react-query si no existe endpoint lookup
        if (!productoExistente) {
          const cached = (queryClient.getQueryData(["productos"]) as ProductoConSubcuenta[] | undefined) || [];
          productoExistente =
            cached.find((p) => (p.nombre || "").trim().toLowerCase() === nombre.trim().toLowerCase()) || null;
        }

        if (productoExistente) {
          // Actualizar info básica si hay cambios relevantes (como en el original)
          const patch: any = { updated_at: new Date().toISOString() };

          if (descripcion) patch.descripcion = descripcion;
          if (imagenUrl) patch.imagen_url = imagenUrl;
          if (subcuentaId !== undefined) patch.subcuenta_id = subcuentaId || null;
          if (precioVenta !== undefined) patch.precio_venta = precioVenta;

          // Solo parchear si hay algo aparte de updated_at
          const keys = Object.keys(patch).filter((k) => k !== "updated_at");
          if (keys.length > 0) {
            await apiFetch(`/api/productos/${encodeURIComponent(productoExistente.id)}`, {
              method: "PATCH",
              body: JSON.stringify(patch),
            });
          }

          // Crear movimiento de compra (trigger/backend calcula stock/costos si aplica)
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

        // Producto nuevo
        const creadoJson = await apiFetch("/api/productos", {
          method: "POST",
          body: JSON.stringify({
            nombre,
            precio: Number(precio),
            precio_venta: Number(precioVenta || 0),
            descripcion: descripcion || null,
            subcuenta_id: subcuentaId || null,
            imagen_url: imagenUrl,
            cuenta_codigo: cuentaCodigo,
            activo: true,
          }),
        });

        const creado = unwrap<Producto>(creadoJson);

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

      // ===== Servicios (cuenta 4001) =====
      const json = await apiFetch("/api/productos", {
        method: "POST",
        body: JSON.stringify({
          nombre,
          precio: Number(precio),
          precio_venta: Number(precioVenta ?? precio), // si no mandan precioVenta, usamos precio
          descripcion: descripcion || null,
          subcuenta_id: subcuentaId || null,
          imagen_url: imagenUrl,
          cuenta_codigo: cuentaCodigo,
          activo: true,
        }),
      });

      return unwrap<Producto>(json);
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
      subcuentaId?: string | null;
    }) => {
      let imagenUrl: string | undefined;

      if (imagen) {
        imagenUrl = await uploadProductImage(imagen);
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (nombre !== undefined) updateData.nombre = nombre;
      if (descripcion !== undefined) updateData.descripcion = descripcion;
      if (precio !== undefined) {
        updateData.precio = Number(precio);
        // Mantengo comportamiento del original: también setea precio_venta = precio
        updateData.precio_venta = Number(precio);
      }
      if (imagenUrl !== undefined) updateData.imagen_url = imagenUrl;
      if (subcuentaId !== undefined) updateData.subcuenta_id = subcuentaId || null;

      const json = await apiFetch(`/api/productos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });

      return unwrap<Producto>(json);
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
      await apiFetch(`/api/productos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ activo: false, updated_at: new Date().toISOString() }),
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
