import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type ProductoEgreso = {
  id: string;
  user_id: string;
  nombre: string;
  descripcion?: string;
  tipo: "gasto" | "costo";
  unidad: string;
  proveedor_principal?: string;
  es_recurrente: boolean;
  subcuenta_id?: string;
  cuenta_contable: string;
  imagen_url?: string;
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

export const useProductosEgresos = () => {
  return useQuery({
    queryKey: ["productos-egresos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos_egresos")
        .select("*")
        .eq("activo", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProductoEgreso[];
    },
  });
};

export const useCreateProductoEgreso = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (productData: CreateProductoEgresoData) => {
      console.log("🔍 Starting product creation with data:", productData);
      
      let imagenUrl = null;

      // Subir imagen si se seleccionó una
      if (productData.imagen) {
        console.log("📸 Uploading image...");
        const fileExt = productData.imagen.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, productData.imagen);

        if (uploadError) {
          console.error("❌ Error uploading image:", uploadError);
          throw new Error("Error al subir la imagen");
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(uploadData.path);
        
        imagenUrl = publicUrl;
        console.log("✅ Image uploaded successfully:", imagenUrl);
      }

      const insertData = {
        nombre: productData.nombre,
        descripcion: productData.descripcion,
        tipo: productData.tipo,
        unidad: productData.unidad,
        proveedor_principal: productData.proveedor_principal,
        es_recurrente: productData.es_recurrente || false,
        subcuenta_id: productData.subcuenta_id || null,
        cuenta_contable: productData.cuenta_contable,
        imagen_url: imagenUrl,
        user_id: null, // Set to null for prototype
      };

      console.log("💾 Inserting product data:", insertData);

      // Insertar producto en la base de datos
      const { data, error } = await supabase
        .from("productos_egresos")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("❌ Database insertion error:", error);
        throw error;
      }
      
      console.log("✅ Product created successfully:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("🎉 Mutation success, invalidating queries...");
      queryClient.invalidateQueries({ queryKey: ["productos-egresos"] });
      toast({
        title: "✅ Producto agregado",
        description: `${data.tipo === "gasto" ? "Gasto" : "Costo"} "${data.nombre}" agregado al catálogo${data.imagen_url ? " con imagen" : ""}`
      });
    },
    onError: (error) => {
      console.error("❌ Mutation error:", error);
      toast({
        title: "⚠️ Error",
        description: "Hubo un problema al agregar el producto",
        variant: "destructive"
      });
    }
  });
};

export const useUpdateProductoEgreso = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (productData: UpdateProductoEgresoData) => {
      console.log("🔍 Starting product update with data:", productData);
      
      let imagenUrl: string | undefined = undefined;

      // Subir nueva imagen si se seleccionó una
      if (productData.imagen) {
        console.log("📸 Uploading new image...");
        const fileExt = productData.imagen.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, productData.imagen);

        if (uploadError) {
          console.error("❌ Error uploading image:", uploadError);
          throw new Error("Error al subir la imagen");
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(uploadData.path);
        
        imagenUrl = publicUrl;
        console.log("✅ Image uploaded successfully:", imagenUrl);
      }

      const updateData: any = {
        nombre: productData.nombre,
        descripcion: productData.descripcion,
        tipo: productData.tipo,
        unidad: productData.unidad,
        proveedor_principal: productData.proveedor_principal,
        es_recurrente: productData.es_recurrente,
        subcuenta_id: productData.subcuenta_id || null,
        cuenta_contable: productData.cuenta_contable,
      };

      if (imagenUrl) {
        updateData.imagen_url = imagenUrl;
      }

      console.log("💾 Updating product data:", updateData);

      // Actualizar producto en la base de datos
      const { data, error } = await supabase
        .from("productos_egresos")
        .update(updateData)
        .eq("id", productData.id)
        .select()
        .single();

      if (error) {
        console.error("❌ Database update error:", error);
        throw error;
      }
      
      console.log("✅ Product updated successfully:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("🎉 Update success, invalidating queries...");
      queryClient.invalidateQueries({ queryKey: ["productos-egresos"] });
      toast({
        title: "✅ Producto actualizado",
        description: `${data.tipo === "gasto" ? "Gasto" : "Costo"} "${data.nombre}" actualizado correctamente`
      });
    },
    onError: (error) => {
      console.error("❌ Update error:", error);
      toast({
        title: "⚠️ Error",
        description: "Hubo un problema al actualizar el producto",
        variant: "destructive"
      });
    }
  });
};

export const useDeleteProductoEgreso = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("productos_egresos")
        .update({ activo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos-egresos"] });
      toast({
        title: "✅ Producto eliminado",
        description: "El producto ha sido eliminado del catálogo"
      });
    },
    onError: (error) => {
      console.error("Error deleting product:", error);
      toast({
        title: "⚠️ Error",
        description: "Hubo un problema al eliminar el producto",
        variant: "destructive"
      });
    }
  });
};