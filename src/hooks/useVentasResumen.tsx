import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface VentasResumen {
  ventasDelDia: number;
  ventasDelMes: number;
  ventasDelAno: number;
  descuentosDelDia: number;
  descuentosDelMes: number;
  descuentosDelAno: number;
  ingresoNetoDelDia: number;
  ingresoNetoDelMes: number;
  ingresoNetoDelAno: number;
}

export const useVentasResumen = () => {
  const [ventasResumen, setVentasResumen] = useState<VentasResumen>({
    ventasDelDia: 0,
    ventasDelMes: 0,
    ventasDelAno: 0,
    descuentosDelDia: 0,
    descuentosDelMes: 0,
    descuentosDelAno: 0,
    ingresoNetoDelDia: 0,
    ingresoNetoDelMes: 0,
    ingresoNetoDelAno: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVentasResumen = async () => {
    try {
      setLoading(true);
      setError(null);

      // Simplificar: obtener todas las transacciones sin filtros de fecha primero para debug
      const { data: todasLasVentas, error: errorTodasVentas } = await supabase
        .from('transacciones_ingresos')
        .select('monto_total, monto_descuento, created_at');

      if (errorTodasVentas) {
        console.error('Error fetching todas las ventas:', errorTodasVentas);
        throw errorTodasVentas;
      }

      console.log('Todas las ventas encontradas:', todasLasVentas);

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfYear = new Date(today.getFullYear(), 0, 1);

      console.log('Fechas de filtro:', {
        startOfDay: startOfDay.toISOString(),
        startOfMonth: startOfMonth.toISOString(),
        startOfYear: startOfYear.toISOString()
      });

      // Calcular totales usando las ventas obtenidas
      const ventasDelDia = todasLasVentas?.filter(venta => {
        const fechaVenta = new Date(venta.created_at);
        return fechaVenta >= startOfDay;
      }).reduce((sum, venta) => sum + Number(venta.monto_total), 0) || 0;

      const ventasDelMes = todasLasVentas?.filter(venta => {
        const fechaVenta = new Date(venta.created_at);
        return fechaVenta >= startOfMonth;
      }).reduce((sum, venta) => sum + Number(venta.monto_total), 0) || 0;

      const ventasDelAno = todasLasVentas?.filter(venta => {
        const fechaVenta = new Date(venta.created_at);
        return fechaVenta >= startOfYear;
      }).reduce((sum, venta) => sum + Number(venta.monto_total), 0) || 0;

      // Calcular descuentos
      const descuentosDelDia = todasLasVentas?.filter(venta => {
        const fechaVenta = new Date(venta.created_at);
        return fechaVenta >= startOfDay;
      }).reduce((sum, venta) => sum + Number(venta.monto_descuento || 0), 0) || 0;

      const descuentosDelMes = todasLasVentas?.filter(venta => {
        const fechaVenta = new Date(venta.created_at);
        return fechaVenta >= startOfMonth;
      }).reduce((sum, venta) => sum + Number(venta.monto_descuento || 0), 0) || 0;

      const descuentosDelAno = todasLasVentas?.filter(venta => {
        const fechaVenta = new Date(venta.created_at);
        return fechaVenta >= startOfYear;
      }).reduce((sum, venta) => sum + Number(venta.monto_descuento || 0), 0) || 0;

      // Calcular ingresos netos (ventas - descuentos)
      const ingresoNetoDelDia = ventasDelDia - descuentosDelDia;
      const ingresoNetoDelMes = ventasDelMes - descuentosDelMes;
      const ingresoNetoDelAno = ventasDelAno - descuentosDelAno;

      console.log('Resumen calculado:', { 
        ventasDelDia, ventasDelMes, ventasDelAno,
        descuentosDelDia, descuentosDelMes, descuentosDelAno,
        ingresoNetoDelDia, ingresoNetoDelMes, ingresoNetoDelAno
      });

      setVentasResumen({
        ventasDelDia,
        ventasDelMes,
        ventasDelAno,
        descuentosDelDia,
        descuentosDelMes,
        descuentosDelAno,
        ingresoNetoDelDia,
        ingresoNetoDelMes,
        ingresoNetoDelAno,
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