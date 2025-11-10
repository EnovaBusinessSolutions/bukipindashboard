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

    const payload = await req.json();
    console.log('Payload recibido:', payload);

    // Extraer datos del payload
    const {
      tipo_egreso,
      subtipo_egreso,
      descripcion,
      concepto,
      cuenta_codigo,
      subcuenta_id,
      monto_total,
      cantidad,
      precio_unitario,
      tipo_pago,
      metodo_pago,
      monto_pagado,
      monto_pendiente,
      fecha_vencimiento,
      proveedor_nombre,
      proveedor_telefono,
      proveedor_email,
      proveedor_rfc,
      producto_egreso_id,
      proveedor_id,
      es_proveedor_recurrente,
      comentarios
    } = payload;

    // Validaciones básicas
    if (!tipo_egreso || !descripcion || !monto_total || !tipo_pago) {
      throw new Error('Faltan campos requeridos');
    }

    const montoTotal = parseFloat(monto_total);
    const montoPagado = parseFloat(monto_pagado || 0);
    const montoPendiente = parseFloat(monto_pendiente || 0);

    // Validar que el monto cuadre
    if (Math.abs(montoTotal - (montoPagado + montoPendiente)) > 0.01) {
      throw new Error('El monto total no cuadra con pagado + pendiente');
    }

    // 1. Crear transacción de egreso
    const { data: transaccion, error: transaccionError } = await supabase
      .from('transacciones_egresos')
      .insert({
        user_id: user.id,
        tipo_egreso,
        subtipo_egreso,
        descripcion,
        concepto,
        cuenta_codigo,
        subcuenta_id,
        monto_total: montoTotal,
        cantidad: cantidad ? parseFloat(cantidad) : null,
        precio_unitario: precio_unitario ? parseFloat(precio_unitario) : null,
        tipo_pago,
        metodo_pago,
        monto_pagado: montoPagado,
        monto_pendiente: montoPendiente,
        fecha_vencimiento,
        proveedor_nombre,
        proveedor_telefono,
        proveedor_email,
        proveedor_rfc,
        producto_egreso_id,
        proveedor_id,
        comentarios
      })
      .select()
      .single();

    if (transaccionError) {
      console.error('Error creando transacción:', transaccionError);
      throw transaccionError;
    }

    console.log('Transacción creada:', transaccion.id);

    // 2. Si es proveedor recurrente Y hay información de proveedor, guardarlo en la tabla proveedores
    let proveedorIdGuardado = proveedor_id || null;

    if (es_proveedor_recurrente && proveedor_nombre) {
      console.log('Guardando proveedor recurrente:', proveedor_nombre);
      
      // Verificar si ya existe el proveedor por nombre o RFC
      const { data: proveedorExistente, error: errorBusqueda } = await supabase
        .from('proveedores')
        .select('id')
        .eq('user_id', user.id)
        .or(`nombre.ilike.${proveedor_nombre},rfc.eq.${proveedor_rfc || ''}`)
        .single();

      if (proveedorExistente) {
        // Ya existe, usar ese ID
        proveedorIdGuardado = proveedorExistente.id;
        console.log('Proveedor ya existía:', proveedorIdGuardado);
      } else {
        // No existe, crear nuevo
        const { data: nuevoProveedor, error: errorProveedor } = await supabase
          .from('proveedores')
          .insert({
            user_id: user.id,
            nombre: proveedor_nombre,
            telefono: proveedor_telefono || null,
            email: proveedor_email || null,
            rfc: proveedor_rfc || null,
            activo: true
          })
          .select()
          .single();

        if (errorProveedor) {
          console.error('Error guardando proveedor:', errorProveedor);
          // No lanzar error, solo loggear - el gasto debe registrarse de todas formas
        } else {
          proveedorIdGuardado = nuevoProveedor.id;
          console.log('Proveedor creado:', proveedorIdGuardado);
        }
      }
    }

    // 3. Generar asiento contable
    const numeroAsiento = `EGR-${transaccion.id}`;
    
    const { data: asiento, error: asientoError } = await supabase
      .from('asientos_contables')
      .insert({
        user_id: user.id,
        numero_asiento: numeroAsiento,
        descripcion: `Egreso: ${descripcion}`,
        fecha: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (asientoError) {
      console.error('Error creando asiento:', asientoError);
      throw asientoError;
    }

    console.log('Asiento creado:', asiento.id);

    // 3. Crear detalles del asiento
    const detalles = [];

    // DEBE: Cuenta de costo/gasto o inventario
    let cuentaDebe = cuenta_codigo;
    
    // Para compra de inventario, usar cuenta 1005
    if (subtipo_egreso === 'compra_inventario') {
      cuentaDebe = '1005';
    }

    detalles.push({
      asiento_id: asiento.id,
      cuenta_codigo: cuentaDebe,
      subcuenta_id: subcuenta_id || null,
      debe: montoTotal,
      haber: 0,
      descripcion: tipo_egreso === 'costo' ? 'Costo registrado' : 'Gasto registrado'
    });

    // HABER: Contrapartidas según forma de pago
    if (tipo_pago === 'contado') {
      // Pago completo
      if (metodo_pago === 'efectivo') {
        detalles.push({
          asiento_id: asiento.id,
          cuenta_codigo: '1001',
          subcuenta_id: null,
          debe: 0,
          haber: montoPagado,
          descripcion: 'Pago en efectivo'
        });
      } else if (metodo_pago === 'tarjeta-transferencia') {
        detalles.push({
          asiento_id: asiento.id,
          cuenta_codigo: '1002',
          subcuenta_id: null,
          debe: 0,
          haber: montoPagado,
          descripcion: 'Pago por transferencia/tarjeta débito'
        });
      } else if (metodo_pago?.startsWith('tarjeta_credito_')) {
        // Tarjeta de crédito
        const tarjetaId = metodo_pago.replace('tarjeta_credito_', '');
        
        // Actualizar saldo de tarjeta de crédito
        const { data: tarjeta } = await supabase
          .from('financiamientos')
          .select('saldo_actual')
          .eq('id', tarjetaId)
          .single();

        if (tarjeta) {
          await supabase
            .from('financiamientos')
            .update({
              saldo_actual: tarjeta.saldo_actual + montoPagado
            })
            .eq('id', tarjetaId);
        }

        detalles.push({
          asiento_id: asiento.id,
          cuenta_codigo: '2102',
          subcuenta_id: null,
          debe: 0,
          haber: montoPagado,
          descripcion: 'Pago con tarjeta de crédito'
        });
      }
    } else if (tipo_pago === 'credito') {
      // Todo a crédito
      detalles.push({
        asiento_id: asiento.id,
        cuenta_codigo: subtipo_egreso === 'compra_inventario' ? '2002' : '2001',
        subcuenta_id: null,
        debe: 0,
        haber: montoTotal,
        descripcion: `Cuenta por pagar${proveedor_nombre ? ' - ' + proveedor_nombre : ''}`
      });
    } else if (tipo_pago === 'parcial') {
      // Pago parcial
      if (montoPagado > 0) {
        if (metodo_pago === 'efectivo') {
          detalles.push({
            asiento_id: asiento.id,
            cuenta_codigo: '1001',
            subcuenta_id: null,
            debe: 0,
            haber: montoPagado,
            descripcion: 'Pago parcial en efectivo'
          });
        } else if (metodo_pago === 'tarjeta-transferencia') {
          detalles.push({
            asiento_id: asiento.id,
            cuenta_codigo: '1002',
            subcuenta_id: null,
            debe: 0,
            haber: montoPagado,
            descripcion: 'Pago parcial por transferencia'
          });
        } else if (metodo_pago?.startsWith('tarjeta_credito_')) {
          const tarjetaId = metodo_pago.replace('tarjeta_credito_', '');
          
          const { data: tarjeta } = await supabase
            .from('financiamientos')
            .select('saldo_actual')
            .eq('id', tarjetaId)
            .single();

          if (tarjeta) {
            await supabase
              .from('financiamientos')
              .update({
                saldo_actual: tarjeta.saldo_actual + montoPagado
              })
              .eq('id', tarjetaId);
          }

          detalles.push({
            asiento_id: asiento.id,
            cuenta_codigo: '2102',
            subcuenta_id: null,
            debe: 0,
            haber: montoPagado,
            descripcion: 'Pago parcial con tarjeta de crédito'
          });
        }
      }

      // Saldo pendiente a cuentas por pagar
      if (montoPendiente > 0) {
        detalles.push({
          asiento_id: asiento.id,
          cuenta_codigo: subtipo_egreso === 'compra_inventario' ? '2002' : '2001',
          subcuenta_id: null,
          debe: 0,
          haber: montoPendiente,
          descripcion: `Saldo pendiente por pagar${proveedor_nombre ? ' - ' + proveedor_nombre : ''}`
        });
      }
    }

    // Insertar todos los detalles
    const { error: detallesError } = await supabase
      .from('detalle_asientos')
      .insert(detalles);

    if (detallesError) {
      console.error('Error creando detalles:', detallesError);
      throw detallesError;
    }

    console.log('Detalles del asiento creados');

    // Validar que el asiento cuadre
    const totalDebe = detalles.reduce((sum, d) => sum + d.debe, 0);
    const totalHaber = detalles.reduce((sum, d) => sum + d.haber, 0);

    if (Math.abs(totalDebe - totalHaber) > 0.01) {
      console.error('¡ASIENTO NO CUADRADO!', { totalDebe, totalHaber, detalles });
      throw new Error(`Asiento no balanceado: DEBE=${totalDebe} HABER=${totalHaber}`);
    }

    console.log('Asiento balanceado correctamente:', { totalDebe, totalHaber });

    return new Response(
      JSON.stringify({
        success: true,
        transaccion_id: transaccion.id,
        asiento_id: asiento.id,
        numero_asiento: numeroAsiento,
        mensaje: 'Egreso registrado exitosamente con asiento contable'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error en registrar-egreso:', error);
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
