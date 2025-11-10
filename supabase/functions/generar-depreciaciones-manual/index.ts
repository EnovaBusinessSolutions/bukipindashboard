import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Obtener parámetros (mes y año opcionales)
    const { mes, ano } = await req.json().catch(() => ({}));
    
    const fechaProceso = mes && ano 
      ? new Date(ano, mes - 1, 1)  // Si se especifica, usar esa fecha
      : new Date(); // Por defecto, mes actual

    const mesFormateado = fechaProceso.getMonth() + 1;
    const anoFormateado = fechaProceso.getFullYear();

    console.log(`Generando depreciaciones para ${mesFormateado}/${anoFormateado} - Usuario: ${user.id}`);

    // Obtener todos los activos activos del usuario
    const { data: activos, error: activosError } = await supabaseClient
      .from('inversiones_capex')
      .select('*')
      .eq('user_id', user.id)
      .eq('estado', 'activo')
      .gt('valor_depreciacion_mensual', 0);

    if (activosError) {
      console.error('Error al obtener activos:', activosError);
      return new Response(JSON.stringify({ error: 'Error al obtener activos' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Se encontraron ${activos?.length || 0} activos activos`);

    const resultados = {
      total_activos: activos?.length || 0,
      asientos_creados: 0,
      asientos_existentes: 0,
      errores: [] as string[],
      detalles: [] as any[],
    };

    // Procesar cada activo
    for (const activo of activos || []) {
      try {
        // Verificar si la fecha de inicio de depreciación es anterior o igual al mes que estamos procesando
        const fechaInicioDate = activo.fecha_inicio_depreciacion 
          ? new Date(activo.fecha_inicio_depreciacion)
          : new Date(activo.fecha_adquisicion);

        const mesInicio = fechaInicioDate.getMonth() + 1;
        const anoInicio = fechaInicioDate.getFullYear();

        // Comparar mes/año, no días exactos - si el año es mayor O (mismo año Y mes mayor o igual)
        const debeGenerarDepreciacion = (anoFormateado > anoInicio) || 
          (anoFormateado === anoInicio && mesFormateado >= mesInicio);

        // Solo generar si el mes procesado es posterior o igual al mes de inicio
        if (debeGenerarDepreciacion) {
          const numeroAsiento = `DEP-${activo.id}-${anoFormateado}${mesFormateado.toString().padStart(2, '0')}`;

          // Verificar si ya existe el asiento
          const { data: asientoExistente } = await supabaseClient
            .from('asientos_contables')
            .select('id')
            .eq('numero_asiento', numeroAsiento)
            .maybeSingle();

          if (asientoExistente) {
            resultados.asientos_existentes++;
            resultados.detalles.push({
              activo: activo.producto_nombre,
              numero_asiento: numeroAsiento,
              estado: 'ya_existe',
            });
            console.log(`Asiento ${numeroAsiento} ya existe`);
            continue;
          }

          // Mapear cuenta de depreciación acumulada
          const cuentaDepreciacionAcumulada = (() => {
            switch (activo.cuenta_codigo || '1206') {
              case '1202': return '1207'; // Edificios
              case '1203': return '1208'; // Maquinaria
              case '1204': return '1209'; // Mobiliario
              case '1205': return '1210'; // Vehículos
              case '1206': return '1211'; // Equipo Cómputo
              case '1212': return '1213'; // Otros
              default: return '1213';
            }
          })();

          // Crear el asiento contable
          const { data: nuevoAsiento, error: asientoError } = await supabaseClient
            .from('asientos_contables')
            .insert({
              user_id: user.id,
              numero_asiento: numeroAsiento,
              descripcion: `Depreciación mensual: ${activo.producto_nombre}`,
              fecha: new Date(anoFormateado, mesFormateado - 1, 
                new Date(anoFormateado, mesFormateado, 0).getDate()), // Último día del mes
            })
            .select()
            .single();

          if (asientoError) {
            console.error(`Error al crear asiento para ${activo.producto_nombre}:`, asientoError);
            resultados.errores.push(`${activo.producto_nombre}: ${asientoError.message}`);
            continue;
          }

          // Crear detalles del asiento
          const detalles = [
            {
              asiento_id: nuevoAsiento.id,
              cuenta_codigo: '5109', // Gasto por Depreciación
              debe: activo.valor_depreciacion_mensual,
              haber: 0,
              descripcion: 'Gasto por depreciación',
            },
            {
              asiento_id: nuevoAsiento.id,
              cuenta_codigo: cuentaDepreciacionAcumulada,
              debe: 0,
              haber: activo.valor_depreciacion_mensual,
              descripcion: `Depreciación acumulada de ${activo.producto_nombre}`,
            },
          ];

          const { error: detallesError } = await supabaseClient
            .from('detalle_asientos')
            .insert(detalles);

          if (detallesError) {
            console.error(`Error al crear detalles para ${activo.producto_nombre}:`, detallesError);
            // Eliminar el asiento si falló crear los detalles
            await supabaseClient.from('asientos_contables').delete().eq('id', nuevoAsiento.id);
            resultados.errores.push(`${activo.producto_nombre}: Error en detalles`);
            continue;
          }

          resultados.asientos_creados++;
          resultados.detalles.push({
            activo: activo.producto_nombre,
            numero_asiento: numeroAsiento,
            monto: activo.valor_depreciacion_mensual,
            estado: 'creado',
          });

          console.log(`Asiento ${numeroAsiento} creado exitosamente`);
        } else {
          console.log(`Activo ${activo.producto_nombre} no aplica para este mes (aún no iniciaba depreciación)`);
        }
      } catch (error) {
        console.error(`Error procesando activo ${activo.producto_nombre}:`, error);
        resultados.errores.push(`${activo.producto_nombre}: ${error.message}`);
      }
    }

    console.log('Resumen:', resultados);

    return new Response(JSON.stringify({
      success: true,
      mes: mesFormateado,
      ano: anoFormateado,
      ...resultados,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error general:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
