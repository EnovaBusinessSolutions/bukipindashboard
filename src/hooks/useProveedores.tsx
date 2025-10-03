import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Proveedor {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  rfc: string | null;
  direccion: string | null;
  ciudad: string | null;
  estado: string | null;
  codigo_postal: string | null;
  activo: boolean;
  created_at: string;
}

export const useProveedores = () => {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProveedores = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('proveedores')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (fetchError) throw fetchError;

      setProveedores((data as any) || []);
    } catch (err) {
      console.error('Error fetching proveedores:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProveedores();

    const channel = supabase
      .channel('proveedores-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proveedores'
        },
        () => {
          fetchProveedores();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createProveedor = async (proveedor: Omit<Proveedor, 'id' | 'created_at' | 'activo'>) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return { data: null, error: 'Usuario no autenticado' };
      }
      
      const { data, error: insertError } = await supabase
        .from('proveedores')
        .insert({
          nombre: proveedor.nombre,
          telefono: proveedor.telefono,
          email: proveedor.email,
          rfc: proveedor.rfc,
          direccion: proveedor.direccion,
          ciudad: proveedor.ciudad,
          estado: proveedor.estado,
          codigo_postal: proveedor.codigo_postal,
          user_id: user.id,
          activo: true
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return { data, error: null };
    } catch (err: any) {
      console.error('Error creating proveedor:', err);
      
      // Detectar errores de duplicados
      if (err.code === '23505') {
        if (err.message.includes('unique_rfc_per_user_idx')) {
          return { data: null, error: 'Ya existe un proveedor con este RFC' };
        }
        if (err.message.includes('unique_email_per_user_idx')) {
          return { data: null, error: 'Ya existe un proveedor con este correo electrónico' };
        }
        if (err.message.includes('unique_telefono_per_user_idx')) {
          return { data: null, error: 'Ya existe un proveedor con este teléfono' };
        }
      }
      
      // Errores de RLS
      if (err.code === '42501') {
        return { data: null, error: 'No tienes permisos para crear proveedores. Por favor inicia sesión.' };
      }
      
      return { data: null, error: err.message || 'Error al crear proveedor' };
    }
  };

  const updateProveedor = async (id: string, proveedor: Omit<Proveedor, 'id' | 'created_at' | 'activo'>) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return { data: null, error: 'Usuario no autenticado' };
      }
      
      const { data, error: updateError } = await supabase
        .from('proveedores')
        .update({
          nombre: proveedor.nombre,
          telefono: proveedor.telefono,
          email: proveedor.email,
          rfc: proveedor.rfc,
          direccion: proveedor.direccion,
          ciudad: proveedor.ciudad,
          estado: proveedor.estado,
          codigo_postal: proveedor.codigo_postal
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return { data, error: null };
    } catch (err: any) {
      console.error('Error updating proveedor:', err);
      
      // Detectar errores de duplicados
      if (err.code === '23505') {
        if (err.message.includes('unique_rfc_per_user_idx')) {
          return { data: null, error: 'Ya existe un proveedor con este RFC' };
        }
        if (err.message.includes('unique_email_per_user_idx')) {
          return { data: null, error: 'Ya existe un proveedor con este correo electrónico' };
        }
        if (err.message.includes('unique_telefono_per_user_idx')) {
          return { data: null, error: 'Ya existe un proveedor con este teléfono' };
        }
      }
      
      return { data: null, error: err.message || 'Error al actualizar proveedor' };
    }
  };

  const deleteProveedor = async (id: string) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return { error: 'Usuario no autenticado' };
      }
      
      const { error: deleteError } = await supabase
        .from('proveedores')
        .update({ activo: false })
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      return { error: null };
    } catch (err: any) {
      console.error('Error deleting proveedor:', err);
      return { error: err.message || 'Error al eliminar proveedor' };
    }
  };

  return { 
    proveedores, 
    loading, 
    error, 
    refetch: fetchProveedores,
    createProveedor,
    updateProveedor,
    deleteProveedor
  };
};
