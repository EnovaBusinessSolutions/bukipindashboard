import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

/**
 * Nota: el backend puede regresar distintas variantes de keys.
 * Mantengo el type canonical + opcionales legacy para que TS no “pelee”
 * y quede E2E estable con payloads viejos/nuevos.
 */
export type ProductoEgreso = {
  id: string;
  user_id?: string;

  nombre: string;
  descripcion?: string;

  tipo: "gasto" | "costo";

  // canonical
  unidad: string;
  proveedor_principal?: string;
  es_recurrente: boolean;
  subcuenta_id?: string | null;
  cuenta_contable: string;

  imagen_url?: string | null;

  precio_promedio: number;
  variacion_precio: number;
  total_transacciones: number;
  ultima_compra: string | null;

  activo: boolean;
  created_at: string;
  updated_at: string;

  // legacy (opcionales)
  unidad_medida?: string;
  unidadMedida?: string;
  proveedorPrincipal?: string;
  esRecurrente?: boolean;
  subcuentaId?: string | null;
  cuentaCodigo?: string;
  cuentaContable?: string;
  imagenUrl?: string | null;
  imageUrl?: string | null;
};

export type CreateProductoEgresoData = {
  nombre: string;
  descripcion?: string;
  tipo: "gasto" | "costo";

  // canonical
  unidad: string;
  proveedor_principal?: string;
  es_recurrente?: boolean;
  subcuenta_id?: string | null;
  cuenta_contable: string;
  imagen?: File;

  // legacy compat (opcionales)
  unidad_medida?: string;
  proveedorPrincipal?: string;
  esRecurrente?: boolean;
  subcuentaId?: string | null;
  cuentaCodigo?: string;
  cuentaContable?: string;
};

export type UpdateProductoEgresoData = {
  id: string;

  nombre?: string;
  descripcion?: string;
  tipo?: "gasto" | "costo";

  // canonical
  unidad?: string;
  proveedor_principal?: string;
  es_recurrente?: boolean;
  subcuenta_id?: string | null;
  cuenta_contable?: string;
  imagen?: File;

  // legacy compat (opcionales)
  unidad_medida?: string;
  proveedorPrincipal?: string;
  esRecurrente?: boolean;
  subcuentaId?: string | null;
  cuentaCodigo?: string;
  cuentaContable?: string;
};

/**
 * ✅ Unwrap universal:
 * Soporta backend que responde:
 * - { ok:true, data: ... }
 * - { ok:true, data: { items: [...] } }
 * - payload directo (...)
 */
function unwrap<T>(json: any): T {
  return (json?.data ?? json) as T;
}

/**
 * Devuelve SIEMPRE un array, aunque el backend mande:
 * - [...]
 * - { items: [...] }
 * - { results: [...] }
 * - { data: [...] }
 */
function unwrapArray<T>(json: any): T[] {
  const data = unwrap<any>(json);

  if (Array.isArray(data)) return data as T[];

  if (Array.isArray(data?.items)) return data.items as T[];
  if (Array.isArray(data?.results)) return data.results as T[];
  if (Array.isArray(data?.rows)) return data.rows as T[];
  if (Array.isArray(data?.data)) return data.data as T[];

  return [];
}

/**
 * Helper: fetch multipart (FormData) con cookies.
 * - NO seteamos Content-Type; el browser pone el boundary.
 * - Unwrap al final para devolver el objeto real.
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
    headers: {
      Accept: "application/json",
    },
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!res.ok) {
    const msg = json?.message || json?.error || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, data: json });
  }

  return unwrap<T>(json);
}

export const useProductosEgresos = () => {
  return useQuery({
    queryKey: ["productos-egresos", { activo: true }],
    queryFn: async () => {
      const json = await apiFetch<any>("/api/productos-egresos?activo=true");
      return unwrapArray<ProductoEgreso>(json);
    },
  });
};

export const useCreateProductoEgreso = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData: CreateProductoEgresoData) => {
      // ✅ canonical + fallbacks legacy
      const unidad = productData.unidad ?? productData.unidad_medida ?? "";
      const proveedor =
        productData.proveedor_principal ?? productData.proveedorPrincipal ?? "";
      const esRec = productData.es_recurrente ?? productData.esRecurrente ?? false;
      const subcuenta =
        productData.subcuenta_id ?? productData.subcuentaId ?? null;
      const cuenta =
        productData.cuenta_contable ??
        productData.cuentaContable ??
        productData.cuentaCodigo ??
        "";

      const hasImage = !!productData.imagen;

      if (hasImage) {
        const form = new FormData();
        form.append("nombre", productData.nombre);
        if (productData.descripcion) form.append("descripcion", productData.descripcion);
        form.append("tipo", productData.tipo);

        form.append("unidad", unidad);
        form.append("unidad_medida", unidad); // legacy compat

        if (proveedor) {
          form.append("proveedor_principal", proveedor);
          form.append("proveedorPrincipal", proveedor); // legacy compat
        }

        form.append("es_recurrente", String(esRec));
        form.append("esRecurrente", String(esRec)); // legacy compat

        // para gasto puede ser null/""; para costo normalmente viene con valor
        form.append("subcuenta_id", subcuenta ? String(subcuenta) : "");
        form.append("subcuentaId", subcuenta ? String(subcuenta) : ""); // legacy compat

        form.append("cuenta_contable", cuenta);
        form.append("cuentaCodigo", cuenta); // legacy compat
        form.append("cuentaContable", cuenta); // legacy compat

        form.append("imagen", productData.imagen as File);

        return await apiFetchForm<ProductoEgreso>("/api/productos-egresos", "POST", form);
      }

      const payload: any = {
        nombre: productData.nombre,
        descripcion: productData.descripcion,
        tipo: productData.tipo,

        // canonical
        unidad,
        proveedor_principal: proveedor || undefined,
        es_recurrente: esRec,
        subcuenta_id: subcuenta || null,
        cuenta_contable: cuenta,
      };

      // legacy compat (por si el backend lo usa)
      payload.unidad_medida = unidad;
      payload.proveedorPrincipal = proveedor || "";
      payload.esRecurrente = esRec;
      payload.subcuentaId = subcuenta || null;
      payload.cuentaCodigo = cuenta;
      payload.cuentaContable = cuenta;

      const json = await apiFetch<any>("/api/productos-egresos", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return unwrap<ProductoEgreso>(json);
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["productos-egresos"] });
      toast({
        title: "✅ Producto agregado",
        description: `${data.tipo === "gasto" ? "Gasto" : "Costo"} "${data.nombre}" agregado al catálogo${
          data.imagen_url ? " con imagen" : ""
        }`,
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

      // ✅ canonical + fallbacks legacy (solo si vienen)
      const unidad = productData.unidad ?? productData.unidad_medida;
      const proveedor = productData.proveedor_principal ?? productData.proveedorPrincipal;
      const esRec = productData.es_recurrente ?? productData.esRecurrente;
      const subcuenta = productData.subcuenta_id ?? productData.subcuentaId;
      const cuenta =
        productData.cuenta_contable ??
        productData.cuentaContable ??
        productData.cuentaCodigo;

      if (hasImage) {
        const form = new FormData();

        if (productData.nombre !== undefined) form.append("nombre", productData.nombre);
        if (productData.descripcion !== undefined) form.append("descripcion", productData.descripcion);
        if (productData.tipo !== undefined) form.append("tipo", productData.tipo);

        if (unidad !== undefined) {
          form.append("unidad", unidad);
          form.append("unidad_medida", unidad); // legacy
        }

        if (proveedor !== undefined) {
          form.append("proveedor_principal", proveedor || "");
          form.append("proveedorPrincipal", proveedor || ""); // legacy
        }

        if (esRec !== undefined) {
          form.append("es_recurrente", String(esRec));
          form.append("esRecurrente", String(esRec)); // legacy
        }

        if (subcuenta !== undefined) {
          form.append("subcuenta_id", subcuenta ? String(subcuenta) : "");
          form.append("subcuentaId", subcuenta ? String(subcuenta) : ""); // legacy
        }

        if (cuenta !== undefined) {
          form.append("cuenta_contable", cuenta || "");
          form.append("cuentaCodigo", cuenta || ""); // legacy
          form.append("cuentaContable", cuenta || ""); // legacy
        }

        form.append("imagen", productData.imagen as File);

        return await apiFetchForm<ProductoEgreso>(
          `/api/productos-egresos/${productData.id}`,
          "PATCH",
          form
        );
      }

      const payload: any = {};
      if (productData.nombre !== undefined) payload.nombre = productData.nombre;
      if (productData.descripcion !== undefined) payload.descripcion = productData.descripcion;
      if (productData.tipo !== undefined) payload.tipo = productData.tipo;

      if (unidad !== undefined) {
        payload.unidad = unidad;
        payload.unidad_medida = unidad; // legacy
      }

      if (proveedor !== undefined) {
        payload.proveedor_principal = proveedor;
        payload.proveedorPrincipal = proveedor; // legacy
      }

      if (esRec !== undefined) {
        payload.es_recurrente = esRec;
        payload.esRecurrente = esRec; // legacy
      }

      if (subcuenta !== undefined) {
        payload.subcuenta_id = subcuenta || null;
        payload.subcuentaId = subcuenta || null; // legacy
      }

      if (cuenta !== undefined) {
        payload.cuenta_contable = cuenta;
        payload.cuentaCodigo = cuenta; // legacy
        payload.cuentaContable = cuenta; // legacy
      }

      const json = await apiFetch<any>(`/api/productos-egresos/${productData.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      return unwrap<ProductoEgreso>(json);
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
