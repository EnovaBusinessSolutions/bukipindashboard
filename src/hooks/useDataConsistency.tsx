import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ConsistencyResult {
  isConsistent: boolean;
  discrepancias: Discrepancia[];
  totalDiscrepancias: number;
}

interface Discrepancia {
  tipo: string;
  mensaje: string;
  severidad: 'baja' | 'media' | 'alta';
  valorEsperado?: number;
  valorActual?: number;
  diferencia?: number;
  porcentajeDiferencia?: number;
}

/**
 * Hook para validar la consistencia de datos entre tablas operativas y asientos contables
 * 
 * ARQUITECTURA: Este hook verifica que los datos en las tablas operativas (transacciones_*)
 * coincidan con los asientos contables (fuente de verdad). Si hay discrepancias > 1%,
 * se notifica al usuario.
 * 
 * Validaciones:
 * 1. Balance de asientos (Debe = Haber en cada asiento)
 * 2. Total de ingresos (transacciones_ingresos vs detalle_asientos cuenta 4XXX)
 * 3. Total de egresos (transacciones_egresos vs detalle_asientos cuenta 5XXX)
 * 4. Saldo de efectivo y bancos
 */
export const useDataConsistency = (enableNotifications: boolean = true) => {
  return useQuery({
    queryKey: ["data-consistency"],
    queryFn: async (): Promise<ConsistencyResult> => {
      const discrepancias: Discrepancia[] = [];

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { isConsistent: true, discrepancias: [], totalDiscrepancias: 0 };
        }

        // 1. VALIDAR BALANCE DE ASIENTOS (Debe = Haber)
        const { data: asientos } = await supabase
          .from('asientos_contables')
          .select('id, numero_asiento, detalle_asientos(debe, haber)')
          .eq('user_id', user.id);

        asientos?.forEach(asiento => {
          const detalles = (asiento as any).detalle_asientos || [];
          const totalDebe = detalles.reduce((sum: number, d: any) => sum + (d.debe || 0), 0);
          const totalHaber = detalles.reduce((sum: number, d: any) => sum + (d.haber || 0), 0);
          
          const diferencia = Math.abs(totalDebe - totalHaber);
          if (diferencia > 0.01) {
            discrepancias.push({
              tipo: 'Balance de Asiento',
              mensaje: `El asiento ${(asiento as any).numero_asiento} no está balanceado`,
              severidad: 'alta',
              valorEsperado: totalDebe,
              valorActual: totalHaber,
              diferencia,
              porcentajeDiferencia: totalDebe > 0 ? (diferencia / totalDebe) * 100 : 0
            });
          }
        });

        // 2. VALIDAR TOTAL DE INGRESOS
        // Total desde transacciones_ingresos
        const { data: transaccionesIngresos } = await supabase
          .from('transacciones_ingresos')
          .select('monto_neto')
          .eq('user_id', user.id);

        const totalTransaccionesIngresos = transaccionesIngresos?.reduce(
          (sum, t) => sum + (t.monto_neto || 0), 0
        ) || 0;

        // Total desde asientos contables (cuentas 4XXX)
        const { data: detallesIngresos } = await supabase
          .from('detalle_asientos')
          .select('debe, haber, asientos_contables!inner(user_id)')
          .like('cuenta_codigo', '4%')
          .eq('asientos_contables.user_id', user.id);

        const totalAsientosIngresos = detallesIngresos?.reduce(
          (sum, d) => sum + ((d.haber || 0) - (d.debe || 0)), 0
        ) || 0;

        const diferenciaIngresos = Math.abs(totalTransaccionesIngresos - totalAsientosIngresos);
        const porcentajeDifIngresos = totalAsientosIngresos > 0 
          ? (diferenciaIngresos / totalAsientosIngresos) * 100 
          : 0;

        if (porcentajeDifIngresos > 1) {
          discrepancias.push({
            tipo: 'Ingresos',
            mensaje: `Discrepancia en ingresos: ${porcentajeDifIngresos.toFixed(2)}%`,
            severidad: porcentajeDifIngresos > 5 ? 'alta' : 'media',
            valorEsperado: totalAsientosIngresos,
            valorActual: totalTransaccionesIngresos,
            diferencia: diferenciaIngresos,
            porcentajeDiferencia: porcentajeDifIngresos
          });
        }

        // 3. VALIDAR TOTAL DE EGRESOS
        // Total desde transacciones_egresos
        const { data: transaccionesEgresos } = await supabase
          .from('transacciones_egresos')
          .select('monto_total')
          .eq('user_id', user.id);

        const totalTransaccionesEgresos = transaccionesEgresos?.reduce(
          (sum, t) => sum + (t.monto_total || 0), 0
        ) || 0;

        // Total desde asientos contables (cuentas 5XXX)
        const { data: detallesEgresos } = await supabase
          .from('detalle_asientos')
          .select('debe, haber, asientos_contables!inner(user_id)')
          .like('cuenta_codigo', '5%')
          .eq('asientos_contables.user_id', user.id);

        const totalAsientosEgresos = detallesEgresos?.reduce(
          (sum, d) => sum + ((d.debe || 0) - (d.haber || 0)), 0
        ) || 0;

        const diferenciaEgresos = Math.abs(totalTransaccionesEgresos - totalAsientosEgresos);
        const porcentajeDifEgresos = totalAsientosEgresos > 0 
          ? (diferenciaEgresos / totalAsientosEgresos) * 100 
          : 0;

        if (porcentajeDifEgresos > 1) {
          discrepancias.push({
            tipo: 'Egresos',
            mensaje: `Discrepancia en egresos: ${porcentajeDifEgresos.toFixed(2)}%`,
            severidad: porcentajeDifEgresos > 5 ? 'alta' : 'media',
            valorEsperado: totalAsientosEgresos,
            valorActual: totalTransaccionesEgresos,
            diferencia: diferenciaEgresos,
            porcentajeDiferencia: porcentajeDifEgresos
          });
        }

        // 4. VERIFICAR SALDOS DE EFECTIVO Y BANCOS
        const { data: detallesEfectivo } = await supabase
          .from('detalle_asientos')
          .select('cuenta_codigo, debe, haber, asientos_contables!inner(user_id)')
          .in('cuenta_codigo', ['1001', '1002'])
          .eq('asientos_contables.user_id', user.id);

        let efectivo = 0;
        let bancos = 0;

        detallesEfectivo?.forEach(d => {
          const saldo = (d.debe || 0) - (d.haber || 0);
          if (d.cuenta_codigo === '1001') {
            efectivo += saldo;
          } else if (d.cuenta_codigo === '1002') {
            bancos += saldo;
          }
        });

        // Validar que no haya saldos negativos críticos
        if (efectivo < -100) {
          discrepancias.push({
            tipo: 'Saldo Efectivo',
            mensaje: 'Saldo de efectivo negativo detectado',
            severidad: 'alta',
            valorEsperado: 0,
            valorActual: efectivo,
            diferencia: Math.abs(efectivo)
          });
        }

        if (bancos < -100) {
          discrepancias.push({
            tipo: 'Saldo Bancos',
            mensaje: 'Saldo de bancos negativo detectado',
            severidad: 'alta',
            valorEsperado: 0,
            valorActual: bancos,
            diferencia: Math.abs(bancos)
          });
        }

        // Mostrar notificación si hay discrepancias y está habilitado
        if (enableNotifications && discrepancias.length > 0) {
          const discrepanciasAltas = discrepancias.filter(d => d.severidad === 'alta');
          
          if (discrepanciasAltas.length > 0) {
            toast({
              title: "⚠️ Inconsistencias Detectadas",
              description: `Se encontraron ${discrepanciasAltas.length} inconsistencias críticas en los datos contables.`,
              variant: "destructive"
            });
          }
        }

        return {
          isConsistent: discrepancias.length === 0,
          discrepancias,
          totalDiscrepancias: discrepancias.length
        };

      } catch (error) {
        console.error('Error validando consistencia:', error);
        return { 
          isConsistent: false, 
          discrepancias: [{
            tipo: 'Error',
            mensaje: 'Error al validar consistencia de datos',
            severidad: 'alta'
          }], 
          totalDiscrepancias: 1 
        };
      }
    },
    refetchInterval: 60000, // Validar cada minuto
    staleTime: 30000, // Considerar datos válidos por 30 segundos
  });
};
