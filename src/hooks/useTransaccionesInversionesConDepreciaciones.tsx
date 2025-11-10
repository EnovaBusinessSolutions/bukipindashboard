import { useMemo } from "react";
import { useInversiones } from "./useInversiones";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InversionCapex } from "./useInversiones";

export interface TransaccionInversionCompleta {
  id: string;
  tipo: 'alta' | 'baja' | 'venta' | 'depreciacion';
  fecha: string;
  activo: string;
  categoria: string;
  monto?: number;
  descripcion?: string;
  motivo?: string;
  valor_venta?: number;
  inversion_id: string;
  inversion: InversionCapex;
  numero_asiento?: string;
  mes_ano?: string;
}

export const useTransaccionesInversionesConDepreciaciones = () => {
  const { inversiones, isLoading: loadingInversiones } = useInversiones();
  
  // Obtener todos los asientos de depreciación
  const { data: asientosDepreciacion, isLoading: loadingAsientos } = useQuery({
    queryKey: ['asientos-depreciacion-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asientos_contables")
        .select(`
          id,
          numero_asiento,
          descripcion,
          fecha,
          detalle_asientos (
            id,
            cuenta_codigo,
            debe,
            haber,
            descripcion
          )
        `)
        .like("numero_asiento", "DEP-%")
        .order("fecha", { ascending: false });

      if (error) {
        console.error("Error fetching asientos depreciacion:", error);
        return [];
      }

      return data || [];
    },
    enabled: inversiones.length > 0,
  });

  const transacciones = useMemo(() => {
    const resultado: TransaccionInversionCompleta[] = [];
    
    inversiones.forEach((inversion) => {
      // Transacción de alta (registro inicial)
      resultado.push({
        id: `alta-${inversion.id}`,
        tipo: 'alta',
        fecha: inversion.fecha_adquisicion,
        activo: inversion.producto_nombre,
        categoria: inversion.categoria_activo,
        monto: inversion.valor_total,
        descripcion: inversion.descripcion,
        inversion_id: inversion.id,
        inversion,
      });
      
      // Agregar depreciaciones si el activo está activo o dado de baja
      if (inversion.estado === 'activo' || inversion.estado === 'dado_de_baja') {
        const asientosInversion = asientosDepreciacion?.filter(
          asiento => asiento.numero_asiento.includes(inversion.id)
        ) || [];
        
        asientosInversion.forEach((asiento: any) => {
          // Extraer mes y año del número de asiento (formato: DEP-{id}-YYYYMM)
          const match = asiento.numero_asiento.match(/DEP-.+-(\d{4})(\d{2})/);
          const año = match ? match[1] : "";
          const mes = match ? match[2] : "";
          
          // Calcular fecha: Último día del mes del periodo
          const fechaDepreciacion = match 
            ? new Date(parseInt(año), parseInt(mes), 0) // Último día del mes
            : new Date(asiento.fecha);
          
          const mesAno = match 
            ? new Date(parseInt(año), parseInt(mes) - 1).toLocaleString('es-MX', { 
                month: 'long', 
                year: 'numeric' 
              })
            : "";
          
          // Calcular monto de depreciación sumando DEBE de cuenta 5109
          const montoDepreciacion = asiento.detalle_asientos
            ?.filter((d: any) => d.cuenta_codigo === '5109')
            .reduce((sum: number, d: any) => sum + d.debe, 0) || 0;
          
          resultado.push({
            id: `dep-${asiento.id}`,
            tipo: 'depreciacion',
            fecha: fechaDepreciacion.toISOString().split('T')[0],
            activo: inversion.producto_nombre,
            categoria: inversion.categoria_activo,
            monto: montoDepreciacion,
            descripcion: asiento.descripcion,
            numero_asiento: asiento.numero_asiento,
            mes_ano: mesAno,
            inversion_id: inversion.id,
            inversion,
          });
        });
      }
      
      // Transacción de baja o venta (si aplica)
      if (inversion.estado === 'dado_de_baja' && inversion.fecha_baja) {
        resultado.push({
          id: `baja-${inversion.id}`,
          tipo: 'baja',
          fecha: inversion.fecha_baja,
          activo: inversion.producto_nombre,
          categoria: inversion.categoria_activo,
          motivo: inversion.motivo_baja,
          inversion_id: inversion.id,
          inversion,
        });
      } else if (inversion.estado === 'vendido' && inversion.fecha_baja) {
        resultado.push({
          id: `venta-${inversion.id}`,
          tipo: 'venta',
          fecha: inversion.fecha_baja,
          activo: inversion.producto_nombre,
          categoria: inversion.categoria_activo,
          valor_venta: inversion.valor_venta,
          motivo: inversion.motivo_baja,
          inversion_id: inversion.id,
          inversion,
        });
      }
    });
    
    // Ordenar por fecha descendente (más reciente primero)
    return resultado.sort((a, b) => {
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
  }, [inversiones, asientosDepreciacion]);
  
  return {
    transacciones,
    isLoading: loadingInversiones || loadingAsientos,
  };
};
