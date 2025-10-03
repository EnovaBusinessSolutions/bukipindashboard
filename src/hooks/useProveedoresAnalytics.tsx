import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProveedorStats {
  totalProveedores: number;
  proveedoresActivos: number;
  totalTransacciones: number;
  montoTotalGastado: number;
  topProveedores: Array<{
    proveedor_id: string;
    proveedor_nombre: string;
    total_transacciones: number;
    monto_total: number;
  }>;
}

export const useProveedoresAnalytics = () => {
  const [stats, setStats] = useState<ProveedorStats>({
    totalProveedores: 0,
    proveedoresActivos: 0,
    totalTransacciones: 0,
    montoTotalGastado: 0,
    topProveedores: []
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Obtener total de proveedores
      const { count: totalProveedores } = await supabase
        .from('proveedores')
        .select('*', { count: 'exact', head: true });

      // Obtener proveedores activos
      const { count: proveedoresActivos } = await supabase
        .from('proveedores')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true);

      // Obtener estadísticas de transacciones
      const { data: transacciones } = await supabase
        .from('transacciones_egresos')
        .select('proveedor_id, proveedor_nombre, monto_total')
        .not('proveedor_id', 'is', null);

      const totalTransacciones = transacciones?.length || 0;
      const montoTotalGastado = transacciones?.reduce((sum, t) => sum + (t.monto_total || 0), 0) || 0;

      // Calcular top proveedores
      const proveedoresMap = new Map<string, {
        proveedor_id: string;
        proveedor_nombre: string;
        total_transacciones: number;
        monto_total: number;
      }>();

      transacciones?.forEach(t => {
        if (t.proveedor_id && t.proveedor_nombre) {
          const existing = proveedoresMap.get(t.proveedor_id);
          if (existing) {
            existing.total_transacciones += 1;
            existing.monto_total += t.monto_total || 0;
          } else {
            proveedoresMap.set(t.proveedor_id, {
              proveedor_id: t.proveedor_id,
              proveedor_nombre: t.proveedor_nombre,
              total_transacciones: 1,
              monto_total: t.monto_total || 0
            });
          }
        }
      });

      const topProveedores = Array.from(proveedoresMap.values())
        .sort((a, b) => b.monto_total - a.monto_total)
        .slice(0, 5);

      setStats({
        totalProveedores: totalProveedores || 0,
        proveedoresActivos: proveedoresActivos || 0,
        totalTransacciones,
        montoTotalGastado,
        topProveedores
      });
    } catch (error) {
      console.error('Error fetching provider stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Subscribe to changes in both tables
    const proveedoresChannel = supabase
      .channel('proveedores-analytics-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proveedores'
        },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacciones_egresos'
        },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(proveedoresChannel);
    };
  }, []);

  return { stats, loading, refetch: fetchStats };
};
