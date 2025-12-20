import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string } | T;
const unwrap = <T,>(json: ApiEnvelope<T>): T => (json as any)?.data ?? (json as T);

type FinanciamientoLite = {
  id: string;
  saldo_actual: number;
  monto_total: number;
  nombre: string;
  institucion_financiera: string;
};

type AsientoCreado = {
  id: string;
  numero_asiento?: string;
};

/**
 * Actualiza el saldo de una tarjeta de crédito después de una transacción
 * y genera el asiento contable correspondiente (solo el HABER a 2101).
 *
 * Contabilidad (como estaba):
 * - El débito (gasto/activo) se registró en la transacción original (egreso/capex/etc).
 * - Aquí solo registramos la deuda: HABER a 2101 (Pasivo Bancario / Tarjetas).
 */
export const actualizarSaldoTarjetaCredito = async (
  tarjetaId: string,
  montoTransaccion: number,
  descripcion?: string
): Promise<{ success: boolean; nuevoSaldo?: number; error?: string }> => {
  try {
    if (!tarjetaId) throw new Error("tarjetaId requerido");
    const monto = Number(montoTransaccion);
    if (!Number.isFinite(monto) || monto === 0) {
      throw new Error("montoTransaccion inválido");
    }

    // 1) Obtener tarjeta (financiamiento)
    const tarjetaJson = await apiFetch(`/api/financiamientos/${encodeURIComponent(tarjetaId)}`, {
      method: "GET",
    });
    const tarjeta = unwrap<FinanciamientoLite>(tarjetaJson);

    if (!tarjeta) throw new Error("Tarjeta no encontrada");

    const saldoActual = Number(tarjeta.saldo_actual || 0);
    const limite = Number(tarjeta.monto_total || 0);

    // 2) Calcular nuevo saldo (saldo_actual representa deuda/uso)
    let nuevoSaldo = saldoActual + monto;

    // Evitar saldo negativo (pago mayor a la deuda): lo clamp a 0
    if (nuevoSaldo < 0) nuevoSaldo = 0;

    // Evitar exceder límite si aplica
    if (Number.isFinite(limite) && limite > 0 && nuevoSaldo > limite) {
      throw new Error(`Límite excedido. Disponible: $${Math.max(0, limite - saldoActual).toFixed(2)}`);
    }

    // 3) Actualizar saldo en backend
    await apiFetch(`/api/financiamientos/${encodeURIComponent(tarjetaId)}`, {
      method: "PATCH",
      body: JSON.stringify({ saldo_actual: nuevoSaldo }),
    });

    // 4) Crear asiento contable SOLO por el pasivo (2101) si es un cargo (monto > 0)
    // Si monto < 0 (pago), normalmente el asiento se genera en el flujo de pago/amortización.
    // Aquí respetamos tu intención original: "uso de tarjeta = genera deuda".
    if (monto > 0) {
      const asientoBody = {
        fecha: new Date().toISOString().split("T")[0],
        descripcion: descripcion || `Cargo a tarjeta: ${tarjeta.nombre} - ${tarjeta.institucion_financiera}`,
        detalles: [
          {
            cuenta_codigo: "2101",
            debe: 0,
            haber: monto,
            descripcion: `Cargo tarjeta ${tarjeta.nombre}`,
          },
        ],
      };

      const asientoJson = await apiFetch(`/api/contabilidad/asientos`, {
        method: "POST",
        body: JSON.stringify(asientoBody),
      });

      // No es obligatorio usarlo, pero sirve para debug
      unwrap<AsientoCreado>(asientoJson);
    }

    return { success: true, nuevoSaldo };
  } catch (error: any) {
    console.error("Error al actualizar saldo de tarjeta:", error);

    toast({
      title: "Error",
      description: error?.message || "No se pudo actualizar el saldo de la tarjeta de crédito",
      variant: "destructive",
    });

    return { success: false, error: error?.message || "Error desconocido" };
  }
};

/**
 * Extrae el ID de la tarjeta de crédito del método de pago
 * @param metodoPago Valor del método de pago que contiene el ID
 * @returns ID de la tarjeta o null si no es una tarjeta de crédito
 */
export const extraerIdTarjetaCredito = (metodoPago: string): string | null => {
  if (metodoPago?.startsWith("tarjeta_credito_")) {
    return metodoPago.replace("tarjeta_credito_", "");
  }
  return null;
};
