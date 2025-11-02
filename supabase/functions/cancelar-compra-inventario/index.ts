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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token!);

    if (!user) {
      console.error('No se pudo autenticar al usuario');
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { movimientoId, motivoCancelacion } = await req.json();
    console.log('Cancelando movimiento:', movimientoId, 'Usuario:', user.id);

    // 1. Obtener movimiento original
    const { data: movimientoOriginal, error: errorMovimiento } = await supabase
      .from('movimientos_inventario')
      .select('*, productos(*)')
      .eq('id', movimientoId)
      .maybeSingle();

    if (errorMovimiento || !movimientoOriginal) {
      console.error('Error al obtener movimiento:', errorMovimiento);
      return new Response(
        JSON.stringify({ error: 'Movimiento no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar que el movimiento no esté ya cancelado
    if (movimientoOriginal.estado === 'cancelado') {
      return new Response(
        JSON.stringify({ 
          error: 'Este movimiento ya ha sido cancelado',
          movimiento_reversion_id: movimientoOriginal.movimiento_reversion_id
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar que sea una compra
    if (movimientoOriginal.tipo_movimiento !== 'compra') {
      return new Response(
        JSON.stringify({ error: 'Solo se pueden cancelar compras de inventario' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Obtener asiento contable original
    const { data: asientoOriginal, error: errorAsiento } = await supabase
      .from('asientos_contables')
      .select('*, detalle_asientos(*, cuentas(nombre))')
      .eq('numero_asiento', `COMP-INV-${movimientoId}`)
      .maybeSingle();

    if (errorAsiento) {
      console.error('Error al obtener asiento:', errorAsiento);
    }

    // 3. Generar número de asiento de reversión
    const { data: numeroAsientoData, error: errorNumero } = await supabase
      .rpc('generate_asiento_number', { p_user_id: user.id });
    
    if (errorNumero) {
      console.error('Error al generar número de asiento:', errorNumero);
    }

    const numeroAsientoReversion = numeroAsientoData || `REV-COMP-INV-${movimientoId}`;
    console.log('Número de asiento de reversión:', numeroAsientoReversion);

    // 4. Crear movimiento de reversión
    const { data: movimientoReversion, error: errorReversion } = await supabase
      .from('movimientos_inventario')
      .insert({
        user_id: user.id,
        producto_id: movimientoOriginal.producto_id,
        tipo_movimiento: 'ajuste',
        cantidad: -movimientoOriginal.cantidad,
        costo_unitario: movimientoOriginal.costo_unitario,
        costo_total: -movimientoOriginal.costo_total,
        fecha: new Date().toISOString().split('T')[0],
        descripcion: `CANCELACIÓN: ${movimientoOriginal.descripcion} - Motivo: ${motivoCancelacion}`
      })
      .select()
      .single();

    if (errorReversion) {
      console.error('Error al crear movimiento de reversión:', errorReversion);
      throw errorReversion;
    }

    console.log('Movimiento de reversión creado:', movimientoReversion.id);

    // 4b. Marcar el movimiento original como cancelado
    const { error: errorActualizacion } = await supabase
      .from('movimientos_inventario')
      .update({
        estado: 'cancelado',
        motivo_cancelacion: motivoCancelacion,
        fecha_cancelacion: new Date().toISOString(),
        movimiento_reversion_id: movimientoReversion.id
      })
      .eq('id', movimientoId);

    if (errorActualizacion) {
      console.error('Error al marcar movimiento como cancelado:', errorActualizacion);
      throw errorActualizacion;
    }

    console.log(`Movimiento ${movimientoId} marcado como cancelado`);

    // 5. Crear asiento contable de reversión (si existe el original)
    if (asientoOriginal) {
      const { data: asientoReversion, error: errorAsientoRev } = await supabase
        .from('asientos_contables')
        .insert({
          user_id: user.id,
          numero_asiento: numeroAsientoReversion,
          descripcion: `REVERSIÓN: ${asientoOriginal.descripcion}`,
          fecha: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (errorAsientoRev) {
        console.error('Error al crear asiento de reversión:', errorAsientoRev);
        throw errorAsientoRev;
      }

      console.log('Asiento de reversión creado:', asientoReversion.id);

      // 6. Crear detalles invertidos
      const detallesReversion = asientoOriginal.detalle_asientos.map((detalle: any) => ({
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
        console.error('Error al crear detalles de asiento:', errorDetalles);
        throw errorDetalles;
      }

      console.log('Detalles de asiento creados');
    }

    // 7. Actualizar stock del producto
    const { data: producto } = await supabase
      .from('productos')
      .select('cantidad_stock, costo_unitario, valor_total_inventario')
      .eq('id', movimientoOriginal.producto_id)
      .single();

    if (producto) {
      const nuevaCantidad = (Number(producto.cantidad_stock) || 0) - Number(movimientoOriginal.cantidad);
      const nuevoValorTotal = (Number(producto.valor_total_inventario) || 0) - Number(movimientoOriginal.costo_total);
      const nuevoCostoPromedio = nuevaCantidad > 0 ? nuevoValorTotal / nuevaCantidad : 0;

      console.log('Actualizando producto:', {
        nuevaCantidad,
        nuevoValorTotal,
        nuevoCostoPromedio
      });

      const { error: errorUpdateProducto } = await supabase
        .from('productos')
        .update({
          cantidad_stock: nuevaCantidad,
          valor_total_inventario: nuevoValorTotal,
          costo_unitario: nuevoCostoPromedio
        })
        .eq('id', movimientoOriginal.producto_id);

      if (errorUpdateProducto) {
        console.error('Error al actualizar producto:', errorUpdateProducto);
      }
    }

    // 8. Si hay transacción de egreso asociada, eliminarla
    const { data: transaccionesEgreso } = await supabase
      .from('transacciones_egresos')
      .select('id')
      .eq('tipo_egreso', 'compra_inventario')
      .ilike('descripcion', `%${movimientoOriginal.productos?.nombre}%`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (transaccionesEgreso && transaccionesEgreso.length > 0) {
      console.log('Eliminando transacción de egreso:', transaccionesEgreso[0].id);
      await supabase
        .from('transacciones_egresos')
        .delete()
        .eq('id', transaccionesEgreso[0].id);
    }

    console.log('Cancelación completada exitosamente');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Compra de inventario cancelada correctamente',
        movimientoReversionId: movimientoReversion.id,
        numeroAsientoReversion
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en cancelar-compra-inventario:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
