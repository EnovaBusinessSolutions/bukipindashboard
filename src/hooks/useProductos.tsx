import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  cantidad_stock?: number;
  costo_unitario?: number;
  cantidad_comprada?: number;
  valor_total_inventario?: number;
};

export type ProductoConSubcuenta = Producto & {
  subcuenta_nombre?: string;
};

export const useProductos = () => {
  return useQuery({
    queryKey: ["productos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select(`
          *,
          subcuentas (nombre)
        `)
        .eq("activo", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform to include subcuenta name
      const productosConSubcuenta: ProductoConSubcuenta[] = data?.map((producto: any) => ({
        ...producto,
        subcuenta_nombre: producto.subcuentas?.nombre || null
      })) || [];

      return productosConSubcuenta;
    },
  });
};

// Hook para obtener solo productos de servicios (precargados) - excluye inventario
export const useProductosServicios = () => {
  return useQuery({
    queryKey: ["productos-servicios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select(`
          *,
          subcuentas (nombre)
        `)
        .eq("activo", true)
        .eq("cuenta_codigo", "4001") // Solo productos de servicios, no inventario
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform to include subcuenta name
      const productosConSubcuenta: ProductoConSubcuenta[] = data?.map((producto: any) => ({
        ...producto,
        subcuenta_nombre: producto.subcuentas?.nombre || null
      })) || [];

      return productosConSubcuenta;
    },
  });
};

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
      imagen 
    }: { 
      nombre: string; 
      precio: number;
      precioVenta?: number;
      cantidad?: number;
      descripcion?: string;
      subcuentaId?: string;
      imagen?: File;
    }) => {
      const esCompraInventario = cantidad !== undefined;
      const cuentaCodigo = esCompraInventario ? "1005" : "4001";
      
      if (esCompraInventario) {
        // Buscar producto existente
        const { data: productoExistente, error: searchError } = await supabase
          .from("productos")
          .select("*")
          .eq("nombre", nombre)
          .eq("activo", true)
          .single();

        if (searchError && searchError.code !== 'PGRST116') {
          throw new Error(`Error al buscar producto: ${searchError.message}`);
        }

        let imagenUrl = null;

        if (imagen) {
          const fileExt = imagen.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `productos/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, imagen);

          if (uploadError) throw new Error(`Error al subir imagen: ${uploadError.message}`);

          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

          imagenUrl = publicUrl;
        }

        const costoTotal = precio * cantidad!;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuario no autenticado");

        if (productoExistente) {
          // Producto existe - solo actualizar info básica si hay imagen o descripción
          if (imagenUrl || descripcion || precioVenta !== undefined) {
            const { error: updateError } = await supabase
              .from("productos")
              .update({
                descripcion: descripcion || productoExistente.descripcion,
                imagen_url: imagenUrl || productoExistente.imagen_url,
                subcuenta_id: subcuentaId || productoExistente.subcuenta_id,
                precio_venta: precioVenta !== undefined ? precioVenta : productoExistente.precio_venta,
                updated_at: new Date().toISOString()
              })
              .eq("id", productoExistente.id);

            if (updateError) throw updateError;
          }

          // Crear movimiento (el trigger calcula todo automáticamente)
          const { error: movimientoError } = await supabase
            .from("movimientos_inventario")
            .insert({
              producto_id: productoExistente.id,
              user_id: user.id,
              tipo_movimiento: 'compra',
              cantidad: cantidad!,
              costo_unitario: precio,
              costo_total: costoTotal,
              descripcion: `Compra adicional de inventario`
            });

          if (movimientoError) throw movimientoError;

          return {
            id: productoExistente.id,
            esActualizacion: true
          };
        } else {
          // Producto nuevo
          const { data, error } = await supabase
            .from("productos")
            .insert({
              nombre,
              precio,
              precio_venta: precioVenta || 0,
              descripcion: descripcion || null,
              subcuenta_id: subcuentaId || null,
              imagen_url: imagenUrl,
              cuenta_codigo: cuentaCodigo,
              user_id: null
            })
            .select()
            .single();

          if (error) throw error;

          // Crear movimiento inicial
          const { error: movimientoError } = await supabase
            .from("movimientos_inventario")
            .insert({
              producto_id: data.id,
              user_id: user.id,
              tipo_movimiento: 'compra',
              cantidad: cantidad!,
              costo_unitario: precio,
              costo_total: costoTotal,
              descripcion: 'Compra inicial - Nuevo producto en inventario'
            });

          if (movimientoError) throw movimientoError;

          return { ...data, esActualizacion: false };
        }
      } else {
        // Productos de servicios (cuenta 4001)
        let imagenUrl = null;

        if (imagen) {
          const fileExt = imagen.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `productos/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, imagen);

          if (uploadError) throw new Error(`Error al subir imagen: ${uploadError.message}`);

          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

          imagenUrl = publicUrl;
        }

        const { data, error } = await supabase
          .from("productos")
          .insert({
            nombre,
            precio,
            descripcion: descripcion || null,
            subcuenta_id: subcuentaId || null,
            imagen_url: imagenUrl,
            cuenta_codigo: cuentaCodigo,
            user_id: null
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      
      if (data.esActualizacion) {
        toast({
          title: "Inventario actualizado",
          description: `Se agregó nueva compra al producto existente`,
        });
      } else {
        toast({
          title: "Producto agregado al inventario",
          description: `Se creó un nuevo producto en el inventario`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Error al registrar compra: " + (error.message || "Error desconocido"),
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
      imagen 
    }: { 
      id: string; 
      nombre?: string; 
      descripcion?: string; 
      precio?: number; 
      imagen?: File 
    }) => {
      let imagenUrl: string | undefined;

      // Si hay una nueva imagen, subirla
      if (imagen) {
        const fileExt = imagen.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `productos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, imagen);

        if (uploadError) {
          throw new Error(`Error al subir imagen: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        imagenUrl = publicUrl;
      }

      // Preparar objeto de actualización solo con campos definidos
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (nombre !== undefined) updateData.nombre = nombre;
      if (descripcion !== undefined) updateData.descripcion = descripcion;
      if (precio !== undefined) {
        updateData.precio = precio;
        updateData.precio_venta = precio;
      }
      if (imagenUrl !== undefined) updateData.imagen_url = imagenUrl;

      const { data, error } = await supabase
        .from("productos")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      toast({
        title: "Producto actualizado",
        description: "El producto se ha actualizado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el producto",
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
      const { error } = await supabase
        .from("productos")
        .update({ activo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido desactivado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Error al eliminar el producto",
        variant: "destructive",
      });
    },
  });
};