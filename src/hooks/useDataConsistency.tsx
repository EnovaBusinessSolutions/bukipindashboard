import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface ConsistencyResult {
  isConsistent: boolean;
  discrepancias: Discrepancia[];
  totalDiscrepancias: number;
}

interface Discrepancia {
  tipo: string;
  mensaje: string;
  severidad: "baja" | "media" | "alta";
  valorEsperado?: number;
  valorActual?: number;
  diferencia?: number;
  porcentajeDiferencia?: number;
}

/**
 * Hook para validar la consistencia de datos entre tablas operativas y asientos contables
 *
 * ARQUITECTURA: verifica que los datos operativos (transacciones_*)
 * coincidan con los asientos contables (fuente de verdad).
 *
 * Validaciones:
 * 1. Balance de asientos (Debe = Haber en cada asiento)
 * 2. Total de ingresos (transacciones_ingresos vs detalle_asientos cuenta 4XXX)
 * 3. Total de egresos (transacciones_egresos vs detalle_asientos cuenta 5XXX)
 * 4. Saldo de efectivo y bancos (1001, 1002)
 */
export const useDataConsistency = (enableNotifications: boolean = true) => {
  return useQuery({
    queryKey: ["data-consistency"],
    queryFn: async (): Promise<ConsistencyResult> => {
      const discrepancias: Discrepancia[] = [];

      try {
        /**
         * 0) Verificar sesión (si 401 => no notificar, solo "consistente" para no molestar)
         * Endpoint esperado: GET /api/auth/me
         */
        let me: any = null;
        try {
          const meJson = await apiFetch("/api/auth/me", { method: "GET" });
          me = meJson?.data ?? meJson;
        } catch (e: any) {
          // Si no hay sesión activa, no levantamos error: simplemente no verificamos.
          return { isConsistent: true, discrepancias: [], totalDiscrepancias: 0 };
        }

        if (!me?.user && !me?._id) {
          return { isConsistent: true, discrepancias: [], totalDiscrepancias: 0 };
        }

        /**
         * 1) VALIDAR BALANCE DE ASIENTOS (Debe = Haber)
         * Endpoint esperado:
         *  GET /api/asientos/with-detalles
         *  -> [{ id, numero_asiento, detalle_asientos:[{debe,haber}] }]
         */
        const asientosJson = await apiFetch("/api/asientos/with-detalles", { method: "GET" });
        const asientos = (asientosJson?.data ?? asientosJson ?? []) as any[];

        asientos.forEach((asiento) => {
          const detalles = asiento?.detalle_asientos || [];
          const totalDebe = detalles.reduce((sum: number, d: any) => sum + (Number(d.debe) || 0), 0);
          const totalHaber = detalles.reduce((sum: number, d: any) => sum + (Number(d.haber) || 0), 0);

          const diferencia = Math.abs(totalDebe - totalHaber);
          if (diferencia > 0.01) {
            discrepancias.push({
              tipo: "Balance de Asiento",
              mensaje: `El asiento ${asiento?.numero_asiento || asiento?.id} no está balanceado`,
              severidad: "alta",
              valorEsperado: totalDebe,
              valorActual: totalHaber,
              diferencia,
              porcentajeDiferencia: totalDebe > 0 ? (diferencia / totalDebe) * 100 : 0,
            });
          }
        });

        /**
         * 2) VALIDAR TOTAL DE INGRESOS
         * 2.1) Total desde transacciones_ingresos
         * Endpoint esperado: GET /api/transacciones/ingresos?fields=monto_neto
         */
        const ingresosTxJson = await apiFetch(
          "/api/transacciones/ingresos?fields=monto_neto",
          { method: "GET" }
        );
        const transaccionesIngresos = (ingresosTxJson?.data ?? ingresosTxJson ?? []) as any[];

        const totalTransaccionesIngresos =
          transaccionesIngresos.reduce((sum, t) => sum + (Number(t.monto_neto) || 0), 0) || 0;

        /**
         * 2.2) Total desde asientos contables (cuentas 4XXX)
         * Endpoint esperado:
         *  GET /api/asientos/detalle/sum?prefix=4
         *  -> { total: number }  // total neto ingresos = haber - debe
         */
        const ingresosAsientosJson = await apiFetch("/api/asientos/detalle/sum?prefix=4", {
          method: "GET",
        });
        const totalAsientosIngresos = Number((ingresosAsientosJson?.data ?? ingresosAsientosJson)?.total) || 0;

        const diferenciaIngresos = Math.abs(totalTransaccionesIngresos - totalAsientosIngresos);
        const porcentajeDifIngresos =
          totalAsientosIngresos > 0 ? (diferenciaIngresos / totalAsientosIngresos) * 100 : 0;

        if (porcentajeDifIngresos > 1) {
          discrepancias.push({
            tipo: "Ingresos",
            mensaje: `Discrepancia en ingresos: ${porcentajeDifIngresos.toFixed(2)}%`,
            severidad: porcentajeDifIngresos > 5 ? "alta" : "media",
            valorEsperado: totalAsientosIngresos,
            valorActual: totalTransaccionesIngresos,
            diferencia: diferenciaIngresos,
            porcentajeDiferencia: porcentajeDifIngresos,
          });
        }

        /**
         * 3) VALIDAR TOTAL DE EGRESOS
         * 3.1) Total desde transacciones_egresos
         * Endpoint esperado: GET /api/transacciones/egresos?fields=monto_total
         */
        const egresosTxJson = await apiFetch(
          "/api/transacciones/egresos?fields=monto_total",
          { method: "GET" }
        );
        const transaccionesEgresos = (egresosTxJson?.data ?? egresosTxJson ?? []) as any[];

        const totalTransaccionesEgresos =
          transaccionesEgresos.reduce((sum, t) => sum + (Number(t.monto_total) || 0), 0) || 0;

        /**
         * 3.2) Total desde asientos contables (cuentas 5XXX)
         * Endpoint esperado:
         *  GET /api/asientos/detalle/sum?prefix=5
         *  -> { total: number } // total neto egresos = debe - haber
         */
        const egresosAsientosJson = await apiFetch("/api/asientos/detalle/sum?prefix=5", {
          method: "GET",
        });
        const totalAsientosEgresos = Number((egresosAsientosJson?.data ?? egresosAsientosJson)?.total) || 0;

        const diferenciaEgresos = Math.abs(totalTransaccionesEgresos - totalAsientosEgresos);
        const porcentajeDifEgresos =
          totalAsientosEgresos > 0 ? (diferenciaEgresos / totalAsientosEgresos) * 100 : 0;

        if (porcentajeDifEgresos > 1) {
          discrepancias.push({
            tipo: "Egresos",
            mensaje: `Discrepancia en egresos: ${porcentajeDifEgresos.toFixed(2)}%`,
            severidad: porcentajeDifEgresos > 5 ? "alta" : "media",
            valorEsperado: totalAsientosEgresos,
            valorActual: totalTransaccionesEgresos,
            diferencia: diferenciaEgresos,
            porcentajeDiferencia: porcentajeDifEgresos,
          });
        }

        /**
         * 4) SALDOS EFECTIVO Y BANCOS (1001, 1002)
         * Endpoint esperado:
         *  GET /api/asientos/detalle/saldos?cuentas=1001,1002
         *  -> { saldos: { "1001": number, "1002": number } }
         * Nota: saldo = (debe - haber) acumulado
         */
        const saldosJson = await apiFetch("/api/asientos/detalle/saldos?cuentas=1001,1002", {
          method: "GET",
        });
        const saldos = (saldosJson?.data ?? saldosJson)?.saldos ?? {};

        const efectivo = Number(saldos["1001"]) || 0;
        const bancos = Number(saldos["1002"]) || 0;

        if (efectivo < -100) {
          discrepancias.push({
            tipo: "Saldo Efectivo",
            mensaje: "Saldo de efectivo negativo detectado",
            severidad: "alta",
            valorEsperado: 0,
            valorActual: efectivo,
            diferencia: Math.abs(efectivo),
          });
        }

        if (bancos < -100) {
          discrepancias.push({
            tipo: "Saldo Bancos",
            mensaje: "Saldo de bancos negativo detectado",
            severidad: "alta",
            valorEsperado: 0,
            valorActual: bancos,
            diferencia: Math.abs(bancos),
          });
        }

        // Notificación si hay discrepancias críticas
        if (enableNotifications && discrepancias.length > 0) {
          const discrepanciasAltas = discrepancias.filter((d) => d.severidad === "alta");
          if (discrepanciasAltas.length > 0) {
            toast({
              title: "⚠️ Inconsistencias Detectadas",
              description: `Se encontraron ${discrepanciasAltas.length} inconsistencias críticas en los datos contables.`,
              variant: "destructive",
            });
          }
        }

        return {
          isConsistent: discrepancias.length === 0,
          discrepancias,
          totalDiscrepancias: discrepancias.length,
        };
      } catch (error) {
        console.error("Error validando consistencia:", error);
        return {
          isConsistent: false,
          discrepancias: [
            {
              tipo: "Error",
              mensaje: "Error al validar consistencia de datos",
              severidad: "alta",
            },
          ],
          totalDiscrepancias: 1,
        };
      }
    },
    refetchInterval: 60000, // cada minuto
    staleTime: 30000, // 30 segundos
  });
};
