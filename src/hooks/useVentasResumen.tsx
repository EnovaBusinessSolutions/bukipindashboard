import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface VentasResumen {
  ventasDelDia: number;
  ventasDelMes: number;
  ventasDelAno: number;
}

export const useVentasResumen = () => {
  const [ventasResumen, setVentasResumen] = useState<VentasResumen>({
    ventasDelDia: 0,
    ventasDelMes: 0,
    ventasDelAno: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVentasResumen = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfYear = new Date(today.getFullYear(), 0, 1);

      // Ventas del día
      const { data: ventasDia, error: errorDia } = await supabase
        .from('transacciones_ingresos')
        .select('monto_total')
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000).toISOString());

      if (errorDia) throw errorDia;

      // Ventas del mes
      const { data: ventasMes, error: errorMes } = await supabase
        .from('transacciones_ingresos')
        .select('monto_total')
        .gte('created_at', startOfMonth.toISOString())
        .lt('created_at', new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString());

      if (errorMes) throw errorMes;

      // Ventas del año
      const { data: ventasAno, error: errorAno } = await supabase
        .from('transacciones_ingresos')
        .select('monto_total')
        .gte('created_at', startOfYear.toISOString())
        .lt('created_at', new Date(today.getFullYear() + 1, 0, 1).toISOString());

      if (errorAno) throw errorAno;

      const ventasDelDia = ventasDia?.reduce((sum, venta) => sum + Number(venta.monto_total), 0) || 0;
      const ventasDelMes = ventasMes?.reduce((sum, venta) => sum + Number(venta.monto_total), 0) || 0;
      const ventasDelAno = ventasAno?.reduce((sum, venta) => sum + Number(venta.monto_total), 0) || 0;

      setVentasResumen({
        ventasDelDia,
        ventasDelMes,
        ventasDelAno,
      });
    } catch (err) {
      console.error('Error fetching ventas resumen:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVentasResumen();

    // Configurar realtime para actualizaciones automáticas
    const channel = supabase
      .channel('transacciones-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transacciones_ingresos'
        },
        () => {
          fetchVentasResumen();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { ventasResumen, loading, error, refetch: fetchVentasResumen };
};