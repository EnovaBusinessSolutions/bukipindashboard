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
  clienteId?: string
  fechaVencimiento?: string
  comentarios?: string
  // Nuevos campos para inventario
  productoId?: string
  cantidadVendida?: number
  precioVenta?: number
  costoPersonalizado?: number
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
    let costoUnitarioProducto = 0
    let nombreProducto = ''
    
    if (requestData.tipoIngreso === 'inventariados' && requestData.productoId && requestData.cantidadVendida) {
      // Verificar que el producto existe
      const { data: producto, error: productoError } = await supabaseClient
        .from('productos')
        .select('nombre')
        .eq('id', requestData.productoId)
        .eq('cuenta_codigo', '1005')
        .single()

      if (productoError || !producto) {
        throw new Error('Producto no encontrado en inventario')
      }

      nombreProducto = producto.nombre
      
      // Calcular costo promedio desde movimientos_inventario
      console.log(`Calculando costo promedio desde movimientos_inventario para ${nombreProducto}...`)
      
      const { data: movimientos, error: movimientosError } = await supabaseClient
        .from('movimientos_inventario')
        .select('costo_unitario, cantidad, tipo_movimiento')
        .eq('producto_id', requestData.productoId)
        .eq('tipo_movimiento', 'compra')
        .order('created_at', { ascending: false })
      
      if (!movimientosError && movimientos && movimientos.length > 0) {
        // Calcular costo promedio ponderado
        let totalCosto = 0
        let totalCantidad = 0
        
        for (const mov of movimientos) {
          if (mov.costo_unitario > 0 && mov.cantidad > 0) {
            totalCosto += mov.costo_unitario * mov.cantidad
            totalCantidad += mov.cantidad
          }
        }
        
        if (totalCantidad > 0) {
          costoUnitarioProducto = totalCosto / totalCantidad
          console.log(`Costo promedio calculado: ${costoUnitarioProducto} (${movimientos.length} movimientos, ${totalCantidad} unidades)`)
        } else {
          console.warn(`No se encontraron movimientos con costo válido. Usando costo 0`)
        }
      } else {
        console.warn(`No se encontraron movimientos de compra para calcular costo. Usando costo 0`)
      }
      
      // Usar costo personalizado si fue proporcionado
      if (requestData.costoPersonalizado && requestData.costoPersonalizado > 0) {
        costoUnitarioProducto = requestData.costoPersonalizado
        console.log(`Usando costo personalizado: ${costoUnitarioProducto}`)
      }
      
      console.log(`Procesando venta - Producto: ${nombreProducto}, Cantidad: ${requestData.cantidadVendida}, Costo unitario: ${costoUnitarioProducto}`)
      
      // Registrar movimiento de inventario (negativo = salida)
      const { error: movimientoError } = await supabaseClient
        .from('movimientos_inventario')
        .insert({
          producto_id: requestData.productoId,
          tipo_movimiento: 'venta',
          cantidad: requestData.cantidadVendida,
          costo_unitario: costoUnitarioProducto,
          costo_total: costoUnitarioProducto * requestData.cantidadVendida,
          descripcion: `Venta de ${nombreProducto}`,
          user_id: userId
        })

      if (movimientoError) {
        throw new Error(`Error al registrar movimiento de inventario: ${movimientoError.message}`)
      }

      console.log(`Movimiento de venta registrado para ${nombreProducto}`)
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
        cuenta_codigo: '1003', // Cuentas por Cobrar
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

    // ========================================================================
    // ASIENTOS CONTABLES PARA VENTAS DE INVENTARIO (Método de Inventario Perpetuo)
    // ========================================================================
    // Para cada venta de inventario, debemos registrar 2 asientos adicionales:
    //
    // 1. RECONOCIMIENTO DEL COSTO DE VENTAS:
    //    - DÉBITO a "5002 - Costo de Ventas Inventario" (Estado de Resultados - Aumenta Gastos)
    //    - CRÉDITO a "1005 - Inventario" (Balance General - Disminuye Activos)
    //
    // Este asiento refleja el COSTO del producto vendido (no el precio de venta).
    // El precio de venta ya fue registrado en el asiento de ingreso como "Ventas" (4001).
    //
    // EJEMPLO NUMÉRICO:
    // Si vendemos 5 unidades de un producto con costo unitario de $100:
    //   - Costo de Venta = 5 × $100 = $500
    //   - DÉBITO: Cuenta 5002 (Costo de Ventas Inventario) = $500
    //   - CRÉDITO: Cuenta 1005 (Inventario) = $500
    //
    // EFECTO EN ESTADOS FINANCIEROS:
    //   Balance General: Disminuye Inventario (Activo) en $500
    //   Estado de Resultados: Aumenta Costo de Ventas (Gasto) en $500
    //   Utilidad Bruta = Ventas - Costo de Ventas
    // ========================================================================
    
    if (requestData.tipoIngreso === 'inventariados' && requestData.productoId && requestData.cantidadVendida && costoUnitarioProducto > 0) {
      // Calcular el costo total de la venta
      const costoVenta = costoUnitarioProducto * requestData.cantidadVendida

      // DÉBITO a Cuenta 5002 - Costo de Ventas Inventario (Aumenta los gastos en el Estado de Resultados)
      detallesAsiento.push({
        asiento_id: asiento.id,
        cuenta_codigo: '5002', // Costo de Ventas Inventario
        debe: costoVenta,
        haber: 0,
        descripcion: `Costo de venta - ${nombreProducto} (${requestData.cantidadVendida} unidades)`
      })

      // CRÉDITO a Cuenta 1005 - Inventario (Disminuye el activo de inventario en el Balance General)
      detallesAsiento.push({
        asiento_id: asiento.id,
        cuenta_codigo: '1005', // Inventario de Mercancías
        debe: 0,
        haber: costoVenta,
        descripcion: `Salida de inventario - ${nombreProducto} (${requestData.cantidadVendida} unidades)`
      })

      console.log(`✅ Asiento de costo de venta de inventario (5002) registrado: $${costoVenta} para ${nombreProducto}`)
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