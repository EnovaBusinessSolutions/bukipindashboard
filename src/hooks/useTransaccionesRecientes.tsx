import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TransaccionIngreso {
  id: string;
  descripcion: string;
  monto_total: number;
  monto_neto: number;
  monto_descuento: number;
  tipo_ingreso: string;
  metodo_pago: string;
  tipo_pago: string;
  cuenta_principal_codigo: string;
  subcuenta_id: string | null;
  created_at: string;
  comentarios?: string | null;
  asiento_fecha?: string | null; // Fecha del asiento contable relacionado
  subcuentas?: {
    nombre: string;
  } | null;
  cuentas?: {
    nombre: string;
  } | null;
}

export const useTransaccionesRecientes = (limit: number = 10) => {
  const [transacciones, setTransacciones] = useState<TransaccionIngreso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransacciones = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('transacciones_ingresos')
        .select(`
          *,
          asiento:asientos_contables!transaccion_ingreso_id(fecha)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      // Mapear la fecha del asiento a la transacción
      const transaccionesConFecha = (data || []).map((t: any) => ({
        ...t,
        asiento_fecha: Array.isArray(t.asiento) && t.asiento.length > 0 ? t.asiento[0].fecha : null
      }));

      setTransacciones(transaccionesConFecha as any);
    } catch (err) {
      console.error('Error fetching transacciones:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransacciones();

    // Configurar realtime para actualizaciones automáticas
    const channel = supabase
      .channel('transacciones-recientes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacciones_ingresos'
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