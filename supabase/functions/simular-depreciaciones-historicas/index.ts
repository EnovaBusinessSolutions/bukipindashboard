import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SimulacionRequest {
  inversionId: string;
  nombreActivo: string;
  mesesAtras: number;
  valorMensual: number;
  cuentaActivo: string;
  cuentaDepreciacion: string;
}

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
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { simulaciones } = await req.json() as { simulaciones: SimulacionRequest[] };

    if (!simulaciones || !Array.isArray(simulaciones) || simulaciones.length === 0) {
      throw new Error('Se requiere un array de simulaciones');
    }

    const asientosCreados = [];
    const errores = [];

    for (const sim of simulaciones) {
      console.log(`Procesando simulación para: ${sim.nombreActivo} (${sim.mesesAtras} meses)`);

      // Generar asientos para los últimos N meses
      const hoy = new Date();
      
      for (let i = sim.mesesAtras; i >= 1; i--) {
        const fechaDepreciacion = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const ano = fechaDepreciacion.getFullYear();
        const mes = String(fechaDepreciacion.getMonth() + 1).padStart(2, '0');
        const numeroAsiento = `SIM-DEP-${sim.inversionId}-${ano}${mes}`;

        // Verificar si ya existe
        const { data: existente } = await supabase
          .from('asientos_contables')
          .select('id')
          .eq('numero_asiento', numeroAsiento)
          .single();

        if (existente) {
          console.log(`Asiento ${numeroAsiento} ya existe, saltando...`);
          continue;
        }

        try {
          // Crear asiento contable
          const { data: asiento, error: asientoError } = await supabase
            .from('asientos_contables')
            .insert({
              user_id: user.id,
              numero_asiento: numeroAsiento,
              descripcion: `Depreciación mensual simulada: ${sim.nombreActivo}`,
              fecha: fechaDepreciacion.toISOString().split('T')[0],
            })
            .select()
            .single();

          if (asientoError) throw asientoError;

          // Crear detalles del asiento
          const detalles = [
            {
              asiento_id: asiento.id,
              cuenta_codigo: '5109', // Gasto por Depreciación
              debe: sim.valorMensual,
              haber: 0,
              descripcion: 'Gasto por depreciación',
            },
            {
              asiento_id: asiento.id,
              cuenta_codigo: sim.cuentaDepreciacion,
              debe: 0,
              haber: sim.valorMensual,
              descripcion: `Depreciación acumulada de ${sim.nombreActivo}`,
            },
          ];

          // Validar balance antes de insertar
          const totalDebe = detalles.reduce((sum, d) => sum + d.debe, 0);
          const totalHaber = detalles.reduce((sum, d) => sum + d.haber, 0);

          if (Math.abs(totalDebe - totalHaber) > 0.01) {
            throw new Error(
              `Asiento descuadrado: Debe=${totalDebe}, Haber=${totalHaber}`
            );
          }

          const { error: detallesError } = await supabase
            .from('detalle_asientos')
            .insert(detalles);

          if (detallesError) throw detallesError;

          asientosCreados.push({
            numeroAsiento,
            fecha: fechaDepreciacion.toISOString().split('T')[0],
            monto: sim.valorMensual,
            activo: sim.nombreActivo,
          });

          console.log(`✅ Creado: ${numeroAsiento} - $${sim.valorMensual}`);
        } catch (error) {
          console.error(`Error creando ${numeroAsiento}:`, error);
          errores.push({
            numeroAsiento,
            error: error.message,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        asientosCreados,
        totalCreados: asientosCreados.length,
        errores,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error en simular-depreciaciones-historicas:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
