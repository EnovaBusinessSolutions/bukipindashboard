import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  imagen_url: string | null;
  cuenta_codigo: string;
  subcuenta_id: string | null;
  activo: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  cantidad?: number;
  costo_promedio?: number;
  costo_total?: number;
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

export const useCreateProducto = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      nombre, 
      precio, 
      descripcion, 
      subcuentaId, 
      imagen 
    }: { 
      nombre: string; 
      precio: number;
      descripcion?: string;
      subcuentaId?: string;
      imagen?: File;
    }) => {
      let imagenUrl = null;

      // Subir imagen si existe
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

        // Obtener URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        imagenUrl = publicUrl;
      }

      // Crear producto
      const { data, error } = await supabase
        .from("productos")
        .insert({
          nombre,
          precio,
          descripcion: descripcion || null,
          subcuenta_id: subcuentaId || null,
          imagen_url: imagenUrl,
          cuenta_codigo: "1005", // Inventario de Mercancías
          user_id: null // Para prototipo
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      toast({
        title: "Producto creado",
        description: "El producto ha sido creado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Error al crear el producto: " + (error.message || "Error desconocido"),
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