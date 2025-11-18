import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando cancelación de transacción de capital...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtener user_id del token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Error de autenticación' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const { transaccionId, motivoCancelacion } = await req.json();

    if (!transaccionId || !motivoCancelacion) {
      return new Response(
        JSON.stringify({ error: 'Faltan datos requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Usuario ${userId} solicitando cancelar transacción ${transaccionId}`);

    // 1. Obtener la transacción original
    const { data: transaccionOriginal, error: errorTransaccion } = await supabase
      .from('transacciones_capital')
      .select('*')
      .eq('id', transaccionId)
      .eq('user_id', userId)
      .single();

    if (errorTransaccion || !transaccionOriginal) {
      console.error('Error obteniendo transacción:', errorTransaccion);
      return new Response(
        JSON.stringify({ error: 'Transacción no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transaccionOriginal.estado === 'cancelado') {
      return new Response(
        JSON.stringify({ error: 'Esta transacción ya fue cancelada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Transacción original obtenida:', transaccionOriginal);

    // 2. Obtener el asiento contable original
    const { data: asientoOriginal, error: errorAsiento } = await supabase
      .from('asientos_contables')
      .select('*, detalle_asientos(*)')
      .eq('numero_asiento', `CAP-${transaccionId}`)
      .single();

    if (errorAsiento || !asientoOriginal) {
      console.error('Error obteniendo asiento:', errorAsiento);
      return new Response(
        JSON.stringify({ error: 'No se encontró el asiento contable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Asiento original obtenido con', asientoOriginal.detalle_asientos.length, 'detalles');

    // 3. Generar número de asiento para la reversión
    const { data: numeroAsientoData, error: errorNumero } = await supabase
      .rpc('generate_asiento_number', { p_user_id: userId });
    
    if (errorNumero) {
      console.error('Error generando número de asiento:', errorNumero);
    }

    const numeroAsientoReversion = numeroAsientoData || `CAPR-${transaccionId}`;
    console.log('Número de asiento de reversión:', numeroAsientoReversion);

    // 4. Crear la transacción de reversión (valores negativos)
    const { data: transaccionReversion, error: errorReversion } = await supabase
      .from('transacciones_capital')
      .insert({
        user_id: userId,
        tipo_movimiento: transaccionOriginal.tipo_movimiento,
        fecha: new Date().toISOString().split('T')[0],
        monto: -transaccionOriginal.monto, // Negativo para revertir
        socio: transaccionOriginal.socio,
        accionista_id: transaccionOriginal.accionista_id,
        descripcion: `REVERSIÓN: ${transaccionOriginal.descripcion || ''}`,
        estado: 'activo'
      })
      .select()
      .single();

    if (errorReversion) {
      console.error('Error creando transacción de reversión:', errorReversion);
      throw new Error(`Error al crear transacción de reversión: ${errorReversion.message}`);
    }

    console.log('Transacción de reversión creada:', transaccionReversion.id);

    // 5. Crear asiento de reversión (invertir DEBE y HABER)
    const { data: asientoReversion, error: errorAsientoReversion } = await supabase
      .from('asientos_contables')
      .insert({
        user_id: userId,
        numero_asiento: numeroAsientoReversion,
        fecha: new Date().toISOString().split('T')[0],
        descripcion: `REVERSIÓN DE ASIENTO ${asientoOriginal.numero_asiento} - ${motivoCancelacion}`
      })
      .select()
      .single();

    if (errorAsientoReversion) {
      console.error('Error creando asiento de reversión:', errorAsientoReversion);
      throw new Error(`Error al crear asiento de reversión: ${errorAsientoReversion.message}`);
    }

    console.log('Asiento de reversión creado:', asientoReversion.id);

    // 6. Crear detalles del asiento de reversión (invertir debe y haber)
    const detallesReversion = asientoOriginal.detalle_asientos.map((detalle: any) => ({
      asiento_id: asientoReversion.id,
      cuenta_codigo: detalle.cuenta_codigo,
      subcuenta_id: detalle.subcuenta_id,
      debe: detalle.haber, // INVERTIR
      haber: detalle.debe, // INVERTIR
      descripcion: `REVERSIÓN: ${detalle.descripcion}`
    }));

    const { error: errorDetallesReversion } = await supabase
      .from('detalle_asientos')
      .insert(detallesReversion);

    if (errorDetallesReversion) {
      console.error('Error creando detalles de reversión:', errorDetallesReversion);
      throw new Error(`Error al crear detalles de reversión: ${errorDetallesReversion.message}`);
    }

    console.log('Detalles de reversión creados:', detallesReversion.length, 'registros');

    // 7. Marcar la transacción original como cancelada
    const { error: errorActualizacion } = await supabase
      .from('transacciones_capital')
      .update({
        estado: 'cancelado',
        fecha_cancelacion: new Date().toISOString(),
        motivo_cancelacion: motivoCancelacion,
        transaccion_cancelacion_id: transaccionReversion.id
      })
      .eq('id', transaccionId);

    if (errorActualizacion) {
      console.error('Error actualizando estado:', errorActualizacion);
      throw new Error(`Error al actualizar estado: ${errorActualizacion.message}`);
    }

    console.log('✅ Cancelación completada exitosamente');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transacción cancelada exitosamente',
        transaccionReversion: transaccionReversion,
        numeroAsientoReversion: numeroAsientoReversion
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error en cancelar-transaccion-capital:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Error al cancelar la transacción',
        details: error 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
