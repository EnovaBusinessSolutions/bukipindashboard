import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TransaccionEgreso {
  id: string;
  tipo_egreso: string;
  subtipo_egreso: string | null;
  descripcion: string;
  concepto: string | null;
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;
  tipo_pago: string;
  metodo_pago: string | null;
  proveedor_nombre: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
  created_at: string;
  comentarios: string | null;
  fecha_vencimiento: string | null;
}

export const useTransaccionesEgresos = (limit: number = 10) => {
  const [transacciones, setTransacciones] = useState<TransaccionEgreso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransacciones = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('transacciones_egresos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      setTransacciones((data as any) || []);
    } catch (err) {
      console.error('Error fetching transacciones egresos:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransacciones();

    // Configurar realtime para actualizaciones automáticas
    const channel = supabase
      .channel('transacciones-egresos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacciones_egresos'
        },
        () => {
          fetchTransacciones();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit]);

  return { transacciones, loading, error, refetch: fetchTransacciones };
};