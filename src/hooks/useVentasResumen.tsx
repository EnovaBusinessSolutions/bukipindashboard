import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface VentasResumen {
  ventasDelDia: number;
  ventasDelMes: number;
  ventasDelAno: number;
  otrosIngresosDelDia: number;
  otrosIngresosDelMes: number;
  otrosIngresosDelAno: number;
  descuentosDelDia: number;
  descuentosDelMes: number;
  descuentosDelAno: number;
  ingresoNetoDelDia: number;
  ingresoNetoDelMes: number;
  ingresoNetoDelAno: number;
  totalIngresosDelDia: number;
  totalIngresosDelMes: number;
  totalIngresosDelAno: number;
}

/**
 * Hook para obtener resumen de ventas DESDE ASIENTOS CONTABLES (Única Fuente de Verdad)
 * 
 * ARQUITECTURA: Este hook consulta ÚNICAMENTE la balanza de comprobación (asientos_contables + detalle_asientos)
 * para garantizar consistencia con los estados financieros.
 * 
 * Cuentas utilizadas:
 * - 4001: Ventas (Ingresos por ventas de productos/servicios)
 * - 4003: Descuentos sobre ventas
 * - 4004 y otras 4XXX: Otros ingresos (extraordinarios, donaciones, etc.)
 */
export const useVentasResumen = () => {
  const [ventasResumen, setVentasResumen] = useState<VentasResumen>({
    ventasDelDia: 0,
    ventasDelMes: 0,
    ventasDelAno: 0,
    otrosIngresosDelDia: 0,
    otrosIngresosDelMes: 0,
    otrosIngresosDelAno: 0,
    descuentosDelDia: 0,
    descuentosDelMes: 0,
    descuentosDelAno: 0,
    ingresoNetoDelDia: 0,
    ingresoNetoDelMes: 0,
    ingresoNetoDelAno: 0,
    totalIngresosDelDia: 0,
    totalIngresosDelMes: 0,
    totalIngresosDelAno: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVentasResumen = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().split('T')[0];
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];

      // OBTENER DATOS DESDE ASIENTOS CONTABLES (ÚNICA FUENTE DE VERDAD)
      // Obtener todos los detalles de ingresos (cuentas 4XXX)
      const { data: detalles, error: errorDetalles } = await supabase
        .from('detalle_asientos')
        .select('cuenta_codigo, debe, haber, asientos_contables!inner(fecha, user_id)')
        .gte('asientos_contables.fecha', startOfYear)
        .like('cuenta_codigo', '4%');

      if (errorDetalles) {
        console.error('Error fetching detalles de ingresos:', errorDetalles);
        throw errorDetalles;
      }

      // Si no hay datos, retornar ceros
      if (!detalles || detalles.length === 0) {
        setVentasResumen({
          ventasDelDia: 0,
          ventasDelMes: 0,
          ventasDelAno: 0,
          otrosIngresosDelDia: 0,
          otrosIngresosDelMes: 0,
          otrosIngresosDelAno: 0,
          descuentosDelDia: 0,
          descuentosDelMes: 0,
          descuentosDelAno: 0,
          ingresoNetoDelDia: 0,
          ingresoNetoDelMes: 0,
          ingresoNetoDelAno: 0,
          totalIngresosDelDia: 0,
          totalIngresosDelMes: 0,
          totalIngresosDelAno: 0,
        });
        return;
      }

      // Calcular totales por periodo
      let ventasDelDia = 0;
      let ventasDelMes = 0;
      let ventasDelAno = 0;
      let otrosIngresosDelDia = 0;
      let otrosIngresosDelMes = 0;
      let otrosIngresosDelAno = 0;
      let descuentosDelDia = 0;
      let descuentosDelMes = 0;
      let descuentosDelAno = 0;

      detalles.forEach(detalle => {
        const fechaAsiento = detalle.asientos_contables.fecha;
        
        // Cuenta 4003: Descuentos sobre Ventas (tiene naturaleza DEUDORA en contra-cuenta de ingresos)
        // El DEBE aumenta los descuentos (reduce ingresos)
        if (detalle.cuenta_codigo === '4003') {
          const montoDescuento = (detalle.debe || 0) - (detalle.haber || 0);
          
          if (fechaAsiento >= startOfDay) {
            descuentosDelDia += montoDescuento;
          }
          if (fechaAsiento >= startOfMonth) {
            descuentosDelMes += montoDescuento;
          }
          if (fechaAsiento >= startOfYear) {
            descuentosDelAno += montoDescuento;
          }
        } else if (detalle.cuenta_codigo === '4001') {
          // Cuenta 4001: Ventas normales (naturaleza ACREEDORA)
          const montoVenta = (detalle.haber || 0) - (detalle.debe || 0);

          if (fechaAsiento >= startOfDay) {
            ventasDelDia += montoVenta;
          }
          if (fechaAsiento >= startOfMonth) {
            ventasDelMes += montoVenta;
          }
          if (fechaAsiento >= startOfYear) {
            ventasDelAno += montoVenta;
          }
        } else {
          // Otras cuentas 4XXX: Otros ingresos (naturaleza ACREEDORA)
          const montoOtros = (detalle.haber || 0) - (detalle.debe || 0);

          if (fechaAsiento >= startOfDay) {
            otrosIngresosDelDia += montoOtros;
          }
          if (fechaAsiento >= startOfMonth) {
            otrosIngresosDelMes += montoOtros;
          }
          if (fechaAsiento >= startOfYear) {
            otrosIngresosDelAno += montoOtros;
          }
        }
      });

      // Calcular ingresos netos (ventas - descuentos)
      const ingresoNetoDelDia = Math.max(0, ventasDelDia - descuentosDelDia);
      const ingresoNetoDelMes = Math.max(0, ventasDelMes - descuentosDelMes);
      const ingresoNetoDelAno = Math.max(0, ventasDelAno - descuentosDelAno);

      setVentasResumen({
        ventasDelDia: Math.max(0, ventasDelDia),
        ventasDelMes: Math.max(0, ventasDelMes),
        ventasDelAno: Math.max(0, ventasDelAno),
        otrosIngresosDelDia: Math.max(0, otrosIngresosDelDia),
        otrosIngresosDelMes: Math.max(0, otrosIngresosDelMes),
        otrosIngresosDelAno: Math.max(0, otrosIngresosDelAno),
        descuentosDelDia,
        descuentosDelMes,
        descuentosDelAno,
        ingresoNetoDelDia,
        ingresoNetoDelMes,
        ingresoNetoDelAno,
        totalIngresosDelDia: ingresoNetoDelDia + otrosIngresosDelDia,
        totalIngresosDelMes: ingresoNetoDelMes + otrosIngresosDelMes,
        totalIngresosDelAno: ingresoNetoDelAno + otrosIngresosDelAno,
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
    // Escuchar cambios en asientos_contables (fuente de verdad)
    const channel = supabase
      .channel('asientos-changes-ventas')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asientos_contables'
        },
        () => {
          fetchVentasResumen();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'detalle_asientos'
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