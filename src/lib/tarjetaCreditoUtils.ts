import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Actualiza el saldo de una tarjeta de crédito después de una transacción
 * @param tarjetaId ID de la tarjeta de crédito (financiamiento)
 * @param montoTransaccion Monto de la transacción
 * @returns Promise con el resultado de la actualización
 */
export const actualizarSaldoTarjetaCredito = async (tarjetaId: string, montoTransaccion: number) => {
  try {
    // Obtener el saldo actual de la tarjeta
    const { data: tarjeta, error: fetchError } = await supabase
      .from("financiamientos")
      .select("saldo_actual, monto_total")
      .eq("id", tarjetaId)
      .single();

    if (fetchError) throw fetchError;
    if (!tarjeta) throw new Error("Tarjeta no encontrada");

    const nuevoSaldo = tarjeta.saldo_actual + montoTransaccion;

    // Actualizar el saldo de la tarjeta
    const { error: updateError } = await supabase
      .from("financiamientos")
      .update({ saldo_actual: nuevoSaldo })
      .eq("id", tarjetaId);

    if (updateError) throw updateError;

    return { success: true, nuevoSaldo };
  } catch (error: any) {
    console.error("Error al actualizar saldo de tarjeta:", error);
    toast({
      title: "Error",
      description: "No se pudo actualizar el saldo de la tarjeta de crédito",
      variant: "destructive"
    });
    return { success: false, error: error.message };
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
