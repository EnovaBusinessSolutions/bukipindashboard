import { useQuery } from "@tanstack/react-query";
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
  imagen_comprobante: string | null;
  cuenta_codigo: string | null;
  subcuenta_id: string | null;
  producto_imagen_url?: string | null;
}

export const useTransaccionesEgresos = (
  limit: number = 1000,
  periodFilter?: "diario" | "mensual" | "anual",
  fechaDiaria?: Date,
  fechaMensual?: Date
) => {
  return useQuery({
    queryKey: ['transacciones-egresos', limit, periodFilter, fechaDiaria, fechaMensual],
    queryFn: async () => {
      let query = supabase
        .from('transacciones_egresos')
        .select(`
          *,
          productos_egresos!left(imagen_url)
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros de fecha según período
      if (periodFilter === "diario" && fechaDiaria) {
        const fechaStr = fechaDiaria.toISOString().split('T')[0];
        query = query.gte('created_at', `${fechaStr}T00:00:00`)
                     .lte('created_at', `${fechaStr}T23:59:59`);
      } else if (periodFilter === "mensual" && fechaMensual) {
        const year = fechaMensual.getFullYear();
        const month = fechaMensual.getMonth();
        const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
        const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
        query = query.gte('created_at', `${firstDay}T00:00:00`)
                     .lte('created_at', `${lastDay}T23:59:59`);
      } else if (periodFilter === "anual") {
        const year = new Date().getFullYear();
        query = query.gte('created_at', `${year}-01-01T00:00:00`)
                     .lte('created_at', `${year}-12-31T23:59:59`);
      }

      if (!periodFilter) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Procesar datos para extraer imagen_url del JOIN
      const processedData = data?.map((t: any) => ({
        ...t,
        producto_imagen_url: t.productos_egresos?.imagen_url || null,
        productos_egresos: undefined
      })) || [];
      
      return processedData;
    }
  });
};