import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TipoTransaccion = 'inversion' | 'depreciacion' | 'depreciacion_simulada' | 'baja' | 'venta';

export interface TransaccionInversion {
  id: string;
  tipo: TipoTransaccion;
  fecha: string;
  activoNombre: string;
  activoId: string;
  monto: number;
  asientoId: string;
  numeroAsiento: string;
  descripcion: string;
  cuentaCodigo?: string;
}

export const useTransaccionesInversiones = () => {
  return useQuery({
    queryKey: ["transacciones-inversiones"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // 1. Obtener todas las inversiones
      const { data: inversiones, error: invError } = await supabase
        .from("inversiones_capex")
        .select("*")
        .eq("user_id", user.id)
        .order("fecha_adquisicion", { ascending: false });

      if (invError) throw invError;

      const transacciones: TransaccionInversion[] = [];

      // 2. Agregar transacciones de inversión inicial
      for (const inv of inversiones || []) {
        const { data: asiento } = await supabase
          .from("asientos_contables")
          .select("id, numero_asiento, fecha, descripcion")
          .eq("numero_asiento", `INV-${inv.id}`)
          .single();

        if (asiento) {
          transacciones.push({
            id: `inv-${inv.id}`,
            tipo: 'inversion',
            fecha: asiento.fecha,
            activoNombre: inv.producto_nombre,
            activoId: inv.id,
            monto: Number(inv.valor_total),
            asientoId: asiento.id,
            numeroAsiento: asiento.numero_asiento,
            descripcion: asiento.descripcion,
            cuentaCodigo: inv.cuenta_codigo,
          });
        }
      }

      // 3. Obtener todos los asientos de depreciación (reales y simulados)
      const { data: asientosDepreciacion, error: depError } = await supabase
        .from("asientos_contables")
        .select(`
          id,
          numero_asiento,
          fecha,
          descripcion,
          detalle_asientos (
            debe,
            haber,
            cuenta_codigo
          )
        `)
        .eq("user_id", user.id)
        .or("numero_asiento.like.DEP-%,numero_asiento.like.SIM-DEP-%")
        .order("fecha", { ascending: false });

      if (depError) throw depError;

      for (const asiento of asientosDepreciacion || []) {
        // Extraer ID de inversión del número de asiento
        // Formato: DEP-{uuid}-YYYYMM o SIM-DEP-{uuid}-YYYYMM
        const partes = asiento.numero_asiento.split('-');
        let inversionId: string;
        let esSimulada = false;

        if (partes[0] === 'SIM') {
          esSimulada = true;
          inversionId = partes[2]; // SIM-DEP-{uuid}-YYYYMM
        } else {
          inversionId = partes[1]; // DEP-{uuid}-YYYYMM
        }

        const inversion = inversiones?.find(i => i.id === inversionId);
        if (!inversion) continue;

        // Calcular monto total del asiento (suma de debe)
        const monto = asiento.detalle_asientos?.reduce(
          (sum: number, d: any) => sum + Number(d.debe || 0),
          0
        ) || 0;

        transacciones.push({
          id: `dep-${asiento.id}`,
          tipo: esSimulada ? 'depreciacion_simulada' : 'depreciacion',
          fecha: asiento.fecha,
          activoNombre: inversion.producto_nombre,
          activoId: inversion.id,
          monto,
          asientoId: asiento.id,
          numeroAsiento: asiento.numero_asiento,
          descripcion: asiento.descripcion,
        });
      }

      // 4. Obtener asientos de baja/venta
      const { data: asientosBaja, error: bajaError } = await supabase
        .from("asientos_contables")
        .select(`
          id,
          numero_asiento,
          fecha,
          descripcion,
          detalle_asientos (
            debe,
            haber,
            cuenta_codigo
          )
        `)
        .eq("user_id", user.id)
        .like("numero_asiento", "BAJA-%")
        .order("fecha", { ascending: false });

      if (bajaError) throw bajaError;

      for (const asiento of asientosBaja || []) {
        // Formato: BAJA-{uuid}
        const inversionId = asiento.numero_asiento.replace('BAJA-', '');
        const inversion = inversiones?.find(i => i.id === inversionId);
        if (!inversion) continue;

        const monto = asiento.detalle_asientos?.reduce(
          (sum: number, d: any) => sum + Number(d.debe || 0),
          0
        ) || 0;

        transacciones.push({
          id: `baja-${asiento.id}`,
          tipo: inversion.estado === 'vendido' ? 'venta' : 'baja',
          fecha: asiento.fecha,
          activoNombre: inversion.producto_nombre,
          activoId: inversion.id,
          monto,
          asientoId: asiento.id,
          numeroAsiento: asiento.numero_asiento,
          descripcion: asiento.descripcion,
        });
      }

      // Ordenar todas las transacciones por fecha (más recientes primero)
      transacciones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      return transacciones;
    },
  });
};
