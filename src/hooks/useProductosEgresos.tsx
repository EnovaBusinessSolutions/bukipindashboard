import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export type ProductoEgreso = {
  id: string;
  user_id?: string; // en Mongo normalmente no se expone, pero lo dejo opcional por compat
  nombre: string;
  descripcion?: string;
  tipo: "gasto" | "costo";
  unidad: string;
  proveedor_principal?: string;
  es_recurrente: boolean;
  subcuenta_id?: string;
  cuenta_contable: string;

  imagen_url?: string;

  // métricas calculadas (pueden venir del backend)
  precio_promedio: number;
  variacion_precio: number;
  total_transacciones: number;
  ultima_compra: string;

  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateProductoEgresoData = {
  nombre: string;
  descripcion?: string;
  tipo: "gasto" | "costo";
  unidad: string;
  proveedor_principal?: string;
  es_recurrente?: boolean;
  subcuenta_id: string;
  cuenta_contable: string;
  imagen?: File;
};

export type UpdateProductoEgresoData = {
  id: string;
  nombre?: string;
  descripcion?: string;
  tipo?: "gasto" | "costo";
  unidad?: string;
  proveedor_principal?: string;
  es_recurrente?: boolean;
  subcuenta_id?: string;
  cuenta_contable?: string;
  imagen?: File;
};

/**
 * Helper: fetch multipart (FormData) con cookies.
 * - NO seteamos Content-Type; el browser pone el boundary.
 */
async function apiFetchForm<T = any>(
  path: string,
  method: "POST" | "PATCH",
  form: FormData
): Promise<T> {
  const res = await fetch(path, {
    method,
    body: form,
    credentials: "include",
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, data });
  }

  return data as T;
}

export const useProductosEgresos = () => {
  return useQuery({
    queryKey: ["productos-egresos"],
    queryFn: async () => {
      // ✅ Backend recomendado: GET /api/productos-egresos?activo=true
      // (y el backend filtra por owner=req.user._id)
      const data = await apiFetch<ProductoEgreso[]>(
        "/api/productos-egresos?activo=true"
      );
      return data || [];
    },
  });
};

export const useCreateProductoEgreso = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData: CreateProductoEgresoData) => {
      // ✅ Si hay imagen => multipart
      const hasImage = !!productData.imagen;

      if (hasImage) {
        const form = new FormData();
        form.append("nombre", productData.nombre);
        if (productData.descripcion) form.append("descripcion", productData.descripcion);
        form.append("tipo", productData.tipo);
        form.append("unidad", productData.unidad);
        if (productData.proveedor_principal) form.append("proveedor_principal", productData.proveedor_principal);
        form.append("es_recurrente", String(productData.es_recurrente ?? false));
        form.append("subcuenta_id", productData.subcuenta_id || "");
        form.append("cuenta_contable", productData.cuenta_contable);
        form.append("imagen", productData.imagen as File);

        // ✅ Backend recomendado: POST /api/productos-egresos (multipart)
        return await apiFetchForm<ProductoEgreso>(
          "/api/productos-egresos",
          "POST",
          form
        );
      }

      // ✅ Sin imagen => JSON normal
      // Backend recomendado: POST /api/productos-egresos (json)
      const payload = {
        nombre: productData.nombre,
        descripcion: productData.descripcion,
        tipo: productData.tipo,
        unidad: productData.unidad,
        proveedor_principal: productData.proveedor_principal,
        es_recurrente: productData.es_recurrente ?? false,
        subcuenta_id: productData.subcuenta_id || null,
        cuenta_contable: productData.cuenta_contable,
      };

      return await apiFetch<ProductoEgreso>("/api/productos-egresos", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["productos-egresos"] });
      toast({
        title: "✅ Producto agregado",
        description: `${data.tipo === "gasto" ? "Gasto" : "Costo"} "${data.nombre}" agregado al catálogo${data.imagen_url ? " con imagen" : ""}`,
      });
    },
    onError: (error: any) => {
      console.error("❌ Error creando producto:", error);
      toast({
        title: "⚠️ Error",
        description: error?.message || "Hubo un problema al agregar el producto",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateProductoEgreso = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData: UpdateProductoEgresoData) => {
      const hasImage = !!productData.imagen;

      if (hasImage) {
        const form = new FormData();
        if (productData.nombre !== undefined) form.append("nombre", productData.nombre);
        if (productData.descripcion !== undefined) form.append("descripcion", productData.descripcion);
        if (productData.tipo !== undefined) form.append("tipo", productData.tipo);
        if (productData.unidad !== undefined) form.append("unidad", productData.unidad);
        if (productData.proveedor_principal !== undefined) form.append("proveedor_principal", productData.proveedor_principal);
        if (productData.es_recurrente !== undefined) form.append("es_recurrente", String(productData.es_recurrente));
        if (productData.subcuenta_id !== undefined) form.append("subcuenta_id", productData.subcuenta_id || "");
        if (productData.cuenta_contable !== undefined) form.append("cuenta_contable", productData.cuenta_contable);
        form.append("imagen", productData.imagen as File);

        // ✅ Backend recomendado: PATCH /api/productos-egresos/:id (multipart)
        return await apiFetchForm<ProductoEgreso>(
          `/api/productos-egresos/${productData.id}`,
          "PATCH",
          form
        );
      }

      // ✅ Sin imagen => JSON normal
      const payload: any = {};
      if (productData.nombre !== undefined) payload.nombre = productData.nombre;
      if (productData.descripcion !== undefined) payload.descripcion = productData.descripcion;
      if (productData.tipo !== undefined) payload.tipo = productData.tipo;
      if (productData.unidad !== undefined) payload.unidad = productData.unidad;
      if (productData.proveedor_principal !== undefined) payload.proveedor_principal = productData.proveedor_principal;
      if (productData.es_recurrente !== undefined) payload.es_recurrente = productData.es_recurrente;
      if (productData.subcuenta_id !== undefined) payload.subcuenta_id = productData.subcuenta_id || null;
      if (productData.cuenta_contable !== undefined) payload.cuenta_contable = productData.cuenta_contable;

      // ✅ Backend recomendado: PATCH /api/productos-egresos/:id (json)
      return await apiFetch<ProductoEgreso>(`/api/productos-egresos/${productData.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["productos-egresos"] });
      toast({
        title: "✅ Producto actualizado",
        description: `${data.tipo === "gasto" ? "Gasto" : "Costo"} "${data.nombre}" actualizado correctamente`,
      });
    },
    onError: (error: any) => {
      console.error("❌ Error actualizando producto:", error);
      toast({
        title: "⚠️ Error",
        description: error?.message || "Hubo un problema al actualizar el producto",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteProductoEgreso = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // ✅ Borrado lógico
      // Backend recomendado: PATCH /api/productos-egresos/:id {activo:false}
      await apiFetch(`/api/productos-egresos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ activo: false }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos-egresos"] });
      toast({
        title: "✅ Producto eliminado",
        description: "El producto ha sido eliminado del catálogo",
      });
    },
    onError: (error: any) => {
      console.error("❌ Error eliminando producto:", error);
      toast({
        title: "⚠️ Error",
        description: error?.message || "Hubo un problema al eliminar el producto",
        variant: "destructive",
      });
    },
  });
};
