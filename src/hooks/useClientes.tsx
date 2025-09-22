import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Cliente {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  rfc?: string;
  direccion?: string;
  ciudad?: string;
  estado?: string;
  codigo_postal?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  source?: 'dedicated' | 'transaction';
}

export const useClientes = () => {
  return useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      // Obtener clientes de la tabla dedicada
      const { data: dedicatedClients, error: dedicatedError } = await supabase
        .from('clientes')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (dedicatedError) throw dedicatedError;

      // Obtener clientes de las transacciones
      const { data: transactionClients, error: transactionError } = await supabase
        .from('transacciones_ingresos')
        .select(`
          cliente_nombre,
          cliente_email,
          cliente_telefono,
          cliente_rfc,
          created_at
        `)
        .not('cliente_nombre', 'is', null)
        .order('created_at', { ascending: false });

      if (transactionError) throw transactionError;

      // Convertir clientes de transacciones al formato de cliente y deduplicar
      const transactionClientMap = new Map();
      
      transactionClients?.forEach((tc) => {
        const key = `${tc.cliente_nombre}_${tc.cliente_email}_${tc.cliente_telefono}_${tc.cliente_rfc}`.toLowerCase();
        if (!transactionClientMap.has(key)) {
          transactionClientMap.set(key, {
            id: `tx-${Math.random().toString(36).substr(2, 9)}`, // ID temporal
            nombre: tc.cliente_nombre || '',
            email: tc.cliente_email || '',
            telefono: tc.cliente_telefono || '',
            rfc: tc.cliente_rfc || '',
            direccion: '',
            ciudad: '',
            estado: '',
            codigo_postal: '',
            activo: true,
            created_at: tc.created_at,
            updated_at: tc.created_at,
            source: 'transaction'
          });
        }
      });

      // Fusionar clientes dedicados y de transacciones
      const allClients = [
        ...(dedicatedClients?.map(dc => ({ ...dc, source: 'dedicated' })) || []),
        ...Array.from(transactionClientMap.values())
      ];

      // Deduplicar por nombre, email, teléfono - priorizar clientes dedicados
      const finalClients = [];
      const seenKeys = new Set();

      // Primero agregar clientes dedicados
      allClients.filter(c => c.source === 'dedicated').forEach(client => {
        const key = `${client.nombre}_${client.email}_${client.telefono}`.toLowerCase();
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          finalClients.push(client);
        }
      });

      // Luego agregar clientes de transacciones que no están duplicados
      allClients.filter(c => c.source === 'transaction').forEach(client => {
        const key = `${client.nombre}_${client.email}_${client.telefono}`.toLowerCase();
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          finalClients.push(client);
        }
      });

      return finalClients.sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
  });
};

export const useCreateCliente = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cliente: Omit<Cliente, "id" | "created_at" | "updated_at" | "user_id">) => {
      const { data, error } = await supabase
        .from("clientes")
        .insert([{
          ...cliente,
          user_id: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast({
        title: "Cliente creado",
        description: "El cliente ha sido registrado exitosamente.",
      });
    },
    onError: (error) => {
      console.error("Error creating client:", error);
      toast({
        title: "Error",
        description: "No se pudo crear el cliente.",
        variant: "destructive",
      });
    },
  });
};