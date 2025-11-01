import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtener user_id del token de autenticación
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { transaccionId, motivoCancelacion } = await req.json();

    if (!transaccionId || !motivoCancelacion) {
      return new Response(
        JSON.stringify({ error: 'Faltan datos requeridos: transaccionId y motivoCancelacion' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Obtener la transacción original
    const { data: transaccionOriginal, error: errorTransaccion } = await supabase
      .from('transacciones_ingresos')
      .select('*')
      .eq('id', transaccionId)
      .eq('user_id', userId)
      .single();

    if (errorTransaccion || !transaccionOriginal) {
      console.error('Error al obtener transacción:', errorTransaccion);
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

    // 2. Obtener el asiento contable original
    const { data: asientoOriginal, error: errorAsiento } = await supabase
      .from('asientos_contables')
      .select('*, detalle_asientos(*)')
      .eq('transaccion_ingreso_id', transaccionId)
      .single();

    if (errorAsiento || !asientoOriginal) {
      console.error('Error al obtener asiento:', errorAsiento);
      return new Response(
        JSON.stringify({ error: 'No se encontró el asiento contable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Generar número de asiento para la reversión
    const { data: numeroAsientoData } = await supabase
      .rpc('generate_asiento_number', { p_user_id: userId });
    
    const numeroAsientoReversion = numeroAsientoData || `REV-${transaccionId}`;

    // 4. Crear la transacción de reversión (valores negativos)
    const { data: transaccionReversion, error: errorReversion } = await supabase
      .from('transacciones_ingresos')
      .insert({
        user_id: userId,
        tipo_ingreso: transaccionOriginal.tipo_ingreso,
        descripcion: `CANCELACIÓN: ${transaccionOriginal.descripcion}`,
        cuenta_principal_codigo: transaccionOriginal.cuenta_principal_codigo,
        subcuenta_id: transaccionOriginal.subcuenta_id,
        monto_total: -transaccionOriginal.monto_total,
        monto_descuento: -transaccionOriginal.monto_descuento,
        monto_neto: -transaccionOriginal.monto_neto,
        metodo_pago: transaccionOriginal.metodo_pago,
        tipo_pago: transaccionOriginal.tipo_pago,
        monto_pagado: -transaccionOriginal.monto_pagado,
        monto_pendiente: -transaccionOriginal.monto_pendiente,
        cliente_nombre: transaccionOriginal.cliente_nombre,
        cliente_telefono: transaccionOriginal.cliente_telefono,
        cliente_email: transaccionOriginal.cliente_email,
        cliente_rfc: transaccionOriginal.cliente_rfc,
        comentarios: `Reversión por cancelación: ${motivoCancelacion}`,
        estado: 'activo'
      })
      .select()
      .single();

    if (errorReversion) {
      console.error('Error al crear transacción de reversión:', errorReversion);
      throw errorReversion;
    }

    // 5. Crear el asiento contable de reversión
    const { data: asientoReversion, error: errorAsientoReversion } = await supabase
      .from('asientos_contables')
      .insert({
        user_id: userId,
        numero_asiento: numeroAsientoReversion,
        descripcion: `REVERSIÓN: ${asientoOriginal.descripcion}`,
        fecha: new Date().toISOString().split('T')[0],
        transaccion_ingreso_id: transaccionReversion.id
      })
      .select()
      .single();

    if (errorAsientoReversion) {
      console.error('Error al crear asiento de reversión:', errorAsientoReversion);
      throw errorAsientoReversion;
    }

    // 6. Crear detalles del asiento (invertir debe y haber)
    const detallesReversion = (asientoOriginal as any).detalle_asientos.map((detalle: any) => ({
      asiento_id: asientoReversion.id,
      cuenta_codigo: detalle.cuenta_codigo,
      subcuenta_id: detalle.subcuenta_id,
      debe: detalle.haber, // Invertir
      haber: detalle.debe, // Invertir
      descripcion: `Reversión: ${detalle.descripcion}`
    }));

    const { error: errorDetalles } = await supabase
      .from('detalle_asientos')
      .insert(detallesReversion);

    if (errorDetalles) {
      console.error('Error al crear detalles de reversión:', errorDetalles);
      throw errorDetalles;
    }

    // 7. Si es venta de inventario, revertir el movimiento
    if (transaccionOriginal.tipo_ingreso === 'inventariados') {
      const { data: movimientoOriginal } = await supabase
        .from('movimientos_inventario')
        .select('*')
        .eq('descripcion', `Venta de ${transaccionOriginal.descripcion}`)
        .eq('tipo_movimiento', 'venta')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (movimientoOriginal) {
        // Crear movimiento de reversión (entrada de inventario)
        await supabase
          .from('movimientos_inventario')
          .insert({
            user_id: userId,
            producto_id: movimientoOriginal.producto_id,
            tipo_movimiento: 'entrada',
            cantidad: Math.abs(movimientoOriginal.cantidad),
            costo_unitario: movimientoOriginal.costo_unitario,
            costo_total: Math.abs(movimientoOriginal.costo_total),
            fecha: new Date().toISOString().split('T')[0],
            descripcion: `Reversión de venta cancelada`
          });

        // Actualizar stock del producto
        const { data: producto } = await supabase
          .from('productos')
          .select('cantidad_stock')
          .eq('id', movimientoOriginal.producto_id)
          .single();

        if (producto) {
          await supabase
            .from('productos')
            .update({ 
              cantidad_stock: (producto.cantidad_stock || 0) + Math.abs(movimientoOriginal.cantidad) 
            })
            .eq('id', movimientoOriginal.producto_id);
        }
      }
    }

    // 8. Marcar la transacción original como cancelada
    const { error: errorUpdate } = await supabase
      .from('transacciones_ingresos')
      .update({
        estado: 'cancelado',
        fecha_cancelacion: new Date().toISOString(),
        motivo_cancelacion: motivoCancelacion,
        transaccion_cancelacion_id: transaccionReversion.id
      })
      .eq('id', transaccionId);

    if (errorUpdate) {
      console.error('Error al actualizar transacción original:', errorUpdate);
      throw errorUpdate;
    }

    console.log('Transacción cancelada exitosamente:', {
      transaccionOriginalId: transaccionId,
      transaccionReversionId: transaccionReversion.id,
      numeroAsientoReversion
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transacción cancelada correctamente',
        transaccionOriginalId: transaccionId,
        transaccionReversionId: transaccionReversion.id,
        numeroAsientoReversion
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error en cancelar-ingreso:', error);
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
