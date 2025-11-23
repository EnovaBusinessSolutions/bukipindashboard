import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const { transaccionId, motivoCancelacion } = await req.json();
    console.log('Cancelando egreso:', transaccionId);

    if (!transaccionId || !motivoCancelacion) {
      throw new Error('Se requiere transaccionId y motivoCancelacion');
    }

    // 1. Obtener la transacción original
    const { data: transaccion, error: transaccionError } = await supabase
      .from('transacciones_egresos')
      .select('*')
      .eq('id', transaccionId)
      .single();

    if (transaccionError || !transaccion) {
      throw new Error('Transacción no encontrada');
    }

    if (transaccion.estado === 'cancelado') {
      throw new Error('La transacción ya está cancelada');
    }

    // 2. Buscar el asiento contable original
    const { data: asientoOriginal, error: asientoError } = await supabase
      .from('asientos_contables')
      .select('*, detalle_asientos(*)')
      .eq('numero_asiento', `EGR-${transaccionId}`)
      .single();

    if (asientoError) {
      console.warn('No se encontró asiento contable para esta transacción');
    }

    // 2.5 Verificar si ya existe un asiento de cancelación
    const numeroAsientoReversion = `CANC-EGR-${transaccionId}`;
    const { data: cancelacionExistente } = await supabase
      .from('asientos_contables')
      .select('numero_asiento')
      .eq('numero_asiento', numeroAsientoReversion)
      .maybeSingle();

    if (cancelacionExistente) {
      throw new Error('Esta transacción ya tiene un asiento de cancelación registrado');
    }

    // 3. Crear asiento de reversión si existe asiento original
    if (asientoOriginal) {
      const { data: asientoReversion, error: asientoReversionError } = await supabase
        .from('asientos_contables')
        .insert({
          user_id: user.id,
          numero_asiento: numeroAsientoReversion,
          descripcion: `Reversión: ${transaccion.descripcion} (Cancelado: ${motivoCancelacion})`,
          fecha: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (asientoReversionError) {
        throw asientoReversionError;
      }

      // Crear detalles invertidos (DEBE <-> HABER)
      const detallesReversion = asientoOriginal.detalle_asientos.map((detalle: any) => ({
        asiento_id: asientoReversion.id,
        cuenta_codigo: detalle.cuenta_codigo,
        subcuenta_id: detalle.subcuenta_id,
        debe: detalle.haber, // Invertido
        haber: detalle.debe, // Invertido
        descripcion: `Reversión: ${detalle.descripcion}`
      }));

      const { error: detallesError } = await supabase
        .from('detalle_asientos')
        .insert(detallesReversion);

      if (detallesError) {
        throw detallesError;
      }

      console.log('Asiento de reversión creado:', numeroAsientoReversion);
    }

    // 4. Si hubo pago con tarjeta de crédito, revertir el saldo
    if (transaccion.metodo_pago?.startsWith('tarjeta_credito_')) {
      const tarjetaId = transaccion.metodo_pago.replace('tarjeta_credito_', '');
      
      const { data: tarjeta } = await supabase
        .from('financiamientos')
        .select('saldo_actual')
        .eq('id', tarjetaId)
        .single();

      if (tarjeta) {
        await supabase
          .from('financiamientos')
          .update({
            saldo_actual: tarjeta.saldo_actual - transaccion.monto_pagado
          })
          .eq('id', tarjetaId);
        
        console.log('Saldo de tarjeta revertido');
      }
    }

    // 5. Marcar la transacción como cancelada
    const { error: updateError } = await supabase
      .from('transacciones_egresos')
      .update({
        estado: 'cancelado',
        motivo_cancelacion: motivoCancelacion,
        fecha_cancelacion: new Date().toISOString()
      })
      .eq('id', transaccionId);

    if (updateError) {
      throw updateError;
    }

    console.log('Transacción marcada como cancelada');

    return new Response(
      JSON.stringify({
        success: true,
        mensaje: 'Egreso cancelado exitosamente',
        transaccionId,
        asiento_reversion: asientoOriginal ? `CANC-EGR-${transaccionId}` : null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error en cancelar-egreso:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Error desconocido',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
