import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RegistroIngresoRequest {
  tipoIngreso: 'precargados' | 'inventariados' | 'general' | 'otros'
  descripcion: string
  montoTotal: number
  montoDescuento?: number
  cuentaPrincipalCodigo: string
  subcuentaId?: string
  metodoPago: 'efectivo' | 'bancos'
  tipoPago: 'contado' | 'parcial' | 'credito'
  montoPagado: number
  montoPendiente?: number
  clienteNombre?: string
  clienteTelefono?: string
  clienteEmail?: string
  clienteRFC?: string
  fechaVencimiento?: string
  comentarios?: string
  // Nuevos campos para inventario
  productoId?: string
  cantidadVendida?: number
  precioVenta?: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role for backend operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Resolve user (optional). We allow no auth for testing and use a fallback user id.
    let userId: string | null = null
    const authHeader = req.headers.get('Authorization')

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
        if (!userError && user) {
          userId = user.id
          console.log('User authenticated:', user.id)
        } else {
          console.warn('Auth warning (continuing with fallback):', userError?.message || 'No user')
        }
      } catch (e) {
        console.warn('JWT parse error (continuing with fallback):', e)
      }
    } else {
      console.warn('No authorization header, using fallback user id')
    }

    // Fallback user id for non-authenticated testing flows
    if (!userId) {
      userId = Deno.env.get('TEST_DEFAULT_USER_ID') || '00000000-0000-0000-0000-000000000000'
    }

    const requestData: RegistroIngresoRequest = await req.json()
    
    console.log('Registrando ingreso:', requestData)

    // Validar datos
    if (!requestData.descripcion || requestData.montoTotal <= 0) {
      throw new Error('Datos inválidos')
    }

    const montoDescuento = requestData.montoDescuento || 0
    const montoNeto = requestData.montoTotal - montoDescuento
    const montoPendiente = montoNeto - requestData.montoPagado

    // Manejo especial para ventas de inventario
    if (requestData.tipoIngreso === 'inventariados' && requestData.productoId && requestData.cantidadVendida) {
      // Verificar y actualizar stock del producto
      const { data: producto, error: productoError } = await supabaseClient
        .from('productos')
        .select('cantidad_stock, costo_unitario, nombre')
        .eq('id', requestData.productoId)
        .single()

      if (productoError || !producto) {
        throw new Error('Producto no encontrado en inventario')
      }

      const stockActual = producto.cantidad_stock || 0
      if (stockActual < requestData.cantidadVendida) {
        throw new Error(`Stock insuficiente. Disponible: ${stockActual}, Solicitado: ${requestData.cantidadVendida}`)
      }

      // Actualizar stock del producto
      const nuevoStock = stockActual - requestData.cantidadVendida
      const { error: updateStockError } = await supabaseClient
        .from('productos')
        .update({ cantidad_stock: nuevoStock })
        .eq('id', requestData.productoId)

      if (updateStockError) {
        throw new Error(`Error al actualizar stock: ${updateStockError.message}`)
      }

      // Registrar movimiento de inventario
      const { error: movimientoError } = await supabaseClient
        .from('movimientos_inventario')
        .insert({
          producto_id: requestData.productoId,
          tipo_movimiento: 'venta',
          cantidad: -requestData.cantidadVendida, // Negativo porque es salida
          costo_unitario: producto.costo_unitario || 0,
          costo_total: (producto.costo_unitario || 0) * requestData.cantidadVendida,
          descripcion: `Venta de ${producto.nombre} - Stock anterior: ${stockActual}, Stock actual: ${nuevoStock}`,
          user_id: userId
        })

      if (movimientoError) {
        console.warn('Error al registrar movimiento de inventario:', movimientoError.message)
        // No fallar la transacción por esto, pero logear el error
      }

      console.log(`Stock actualizado para producto ${requestData.productoId}: ${stockActual} -> ${nuevoStock}`)
    }

    // 1. Crear la transacción de ingreso
    const { data: transaccion, error: transaccionError } = await supabaseClient
      .from('transacciones_ingresos')
      .insert({
        user_id: userId,
        tipo_ingreso: requestData.tipoIngreso,
        descripcion: requestData.descripcion,
        monto_total: requestData.montoTotal,
        monto_descuento: montoDescuento,
        monto_neto: montoNeto,
        cuenta_principal_codigo: requestData.cuentaPrincipalCodigo,
        subcuenta_id: requestData.subcuentaId || null,
        metodo_pago: requestData.metodoPago,
        tipo_pago: requestData.tipoPago,
        monto_pagado: requestData.montoPagado,
        monto_pendiente: montoPendiente,
        cliente_nombre: requestData.clienteNombre || null,
        cliente_telefono: requestData.clienteTelefono || null,
        cliente_email: requestData.clienteEmail || null,
        cliente_rfc: requestData.clienteRFC || null,
        fecha_vencimiento: requestData.fechaVencimiento || null,
        comentarios: requestData.comentarios || null
      })
      .select()
      .single()

    if (transaccionError) {
      throw new Error(`Error al crear transacción: ${transaccionError.message}`)
    }

    // 2. Generar número de asiento
    const { data: numeroAsiento, error: numeroError } = await supabaseClient
      .rpc('generate_asiento_number', { p_user_id: userId })

    if (numeroError) {
      throw new Error(`Error al generar número de asiento: ${numeroError.message}`)
    }

    // 3. Crear el asiento contable
    const { data: asiento, error: asientoError } = await supabaseClient
      .from('asientos_contables')
      .insert({
        transaccion_ingreso_id: transaccion.id,
        user_id: userId,
        numero_asiento: numeroAsiento,
        descripcion: `Venta: ${requestData.descripcion}`
      })
      .select()
      .single()

    if (asientoError) {
      throw new Error(`Error al crear asiento: ${asientoError.message}`)
    }

    // 4. Crear los detalles del asiento contable
    const detallesAsiento = []

    // Débito a Caja o Bancos (lo que efectivamente recibimos)
    const cuentaCajaBancos = requestData.metodoPago === 'efectivo' ? '1001' : '1002'
    detallesAsiento.push({
      asiento_id: asiento.id,
      cuenta_codigo: cuentaCajaBancos,
      debe: requestData.montoPagado,
      haber: 0,
      descripcion: `${requestData.metodoPago === 'efectivo' ? 'Caja' : 'Bancos'} - ${requestData.descripcion}`
    })

    // Si hay descuento, débito a Descuento sobre ventas
    if (montoDescuento > 0) {
      detallesAsiento.push({
        asiento_id: asiento.id,
        cuenta_codigo: '4003', // Descuento sobre ventas
        debe: montoDescuento,
        haber: 0,
        descripcion: `Descuento aplicado - ${requestData.descripcion}`
      })
    }

    // Si queda pendiente, débito a Cuentas por Cobrar
    if (montoPendiente > 0) {
      detallesAsiento.push({
        asiento_id: asiento.id,
        cuenta_codigo: '1201', // Cuentas por Cobrar
        debe: montoPendiente,
        haber: 0,
        descripcion: `Cuenta por cobrar - ${requestData.clienteNombre || 'Cliente'} - ${requestData.descripcion}`
      })
    }

    // Crédito a la cuenta de ventas (el monto total de la venta)
    detallesAsiento.push({
      asiento_id: asiento.id,
      cuenta_codigo: requestData.cuentaPrincipalCodigo,
      subcuenta_id: requestData.subcuentaId || null,
      debe: 0,
      haber: requestData.montoTotal,
      descripcion: requestData.descripcion
    })

    // Para ventas de inventario, registrar el costo de ventas
    if (requestData.tipoIngreso === 'inventariados' && requestData.productoId && requestData.cantidadVendida) {
      // Obtener información del producto nuevamente para el costo
      const { data: productoInfo, error: productoInfoError } = await supabaseClient
        .from('productos')
        .select('costo_unitario, nombre')
        .eq('id', requestData.productoId)
        .single()

      if (!productoInfoError && productoInfo) {
        const costoVenta = (productoInfo.costo_unitario || 0) * requestData.cantidadVendida

        // Débito a Costo de Ventas
        detallesAsiento.push({
          asiento_id: asiento.id,
          cuenta_codigo: '5001', // Compras (Costo de Ventas)
          debe: costoVenta,
          haber: 0,
          descripcion: `Costo de venta - ${productoInfo.nombre} (${requestData.cantidadVendida} unidades)`
        })

        // Crédito a Inventario (reducir el inventario contablemente)
        detallesAsiento.push({
          asiento_id: asiento.id,
          cuenta_codigo: '1005', // Inventario
          debe: 0,
          haber: costoVenta,
          descripcion: `Salida de inventario - ${productoInfo.nombre} (${requestData.cantidadVendida} unidades)`
        })

        console.log(`Registrando costo de venta: ${costoVenta} para producto ${productoInfo.nombre}`)
      }
    }

    // Insertar todos los detalles
    const { error: detallesError } = await supabaseClient
      .from('detalle_asientos')
      .insert(detallesAsiento)

    if (detallesError) {
      throw new Error(`Error al crear detalles del asiento: ${detallesError.message}`)
    }

    console.log('Ingreso registrado exitosamente:', {
      transaccion: transaccion.id,
      asiento: asiento.numero_asiento,
      detalles: detallesAsiento.length
    })

    return new Response(
      JSON.stringify({
        success: true,
        transaccionId: transaccion.id,
        numeroAsiento: asiento.numero_asiento,
        mensaje: 'Ingreso registrado correctamente'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error en registrar-ingreso:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})