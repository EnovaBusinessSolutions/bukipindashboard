import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Actualiza el saldo de una tarjeta de crédito después de una transacción
 * y genera el asiento contable correspondiente
 * @param tarjetaId ID de la tarjeta de crédito (financiamiento)
 * @param montoTransaccion Monto de la transacción
 * @param descripcion Descripción de la transacción
 * @returns Promise con el resultado de la actualización
 */
export const actualizarSaldoTarjetaCredito = async (
  tarjetaId: string, 
  montoTransaccion: number,
  descripcion?: string
) => {
  try {
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado");

    // Obtener el saldo actual de la tarjeta
    const { data: tarjeta, error: fetchError } = await supabase
      .from("financiamientos")
      .select("saldo_actual, monto_total, nombre, institucion_financiera")
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

    // Generar asiento contable por el uso de la tarjeta
    // Débito: Cuenta de gasto/activo (ya se hizo en la transacción original)
    // Crédito: Pasivo Bancario (2101) - aquí se genera la deuda
    
    const { data: numeroAsiento } = await supabase
      .rpc('generate_asiento_number', { p_user_id: user.id });

    if (numeroAsiento) {
      const { data: asiento } = await supabase
        .from("asientos_contables")
        .insert([{
          user_id: user.id,
          numero_asiento: numeroAsiento,
          fecha: new Date().toISOString().split('T')[0],
          descripcion: descripcion || `Cargo a tarjeta: ${tarjeta.nombre} - ${tarjeta.institucion_financiera}`,
        }])
        .select()
        .single();

      if (asiento) {
        // Crédito a Pasivo Bancario (se genera la deuda)
        await supabase
          .from("detalle_asientos")
          .insert([{
            asiento_id: asiento.id,
            cuenta_codigo: "2101",
            debe: 0,
            haber: montoTransaccion,
            descripcion: `Cargo tarjeta ${tarjeta.nombre}`,
          }]);

        // El débito ya se registró en la transacción original (egreso/activo)
        // Solo ajustamos el método de pago, no duplicamos el débito
      }
    }

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
