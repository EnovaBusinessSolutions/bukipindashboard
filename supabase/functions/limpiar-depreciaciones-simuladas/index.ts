import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

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
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Buscando asientos simulados a eliminar...');

    // Buscar todos los asientos simulados del usuario
    const { data: asientosSimulados, error: searchError } = await supabase
      .from('asientos_contables')
      .select('id, numero_asiento')
      .eq('user_id', user.id)
      .like('numero_asiento', 'SIM-DEP-%');

    if (searchError) throw searchError;

    if (!asientosSimulados || asientosSimulados.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No se encontraron depreciaciones simuladas para eliminar',
          detallesEliminados: 0,
          asientosEliminados: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const asientoIds = asientosSimulados.map(a => a.id);
    console.log(`Encontrados ${asientosSimulados.length} asientos simulados`);

    // Primero eliminar los detalles (por foreign key)
    const { error: detallesError, count: detallesCount } = await supabase
      .from('detalle_asientos')
      .delete()
      .in('asiento_id', asientoIds)
      .select('id', { count: 'exact', head: true });

    if (detallesError) throw detallesError;
    console.log(`Eliminados ${detallesCount} detalles de asientos`);

    // Luego eliminar los asientos
    const { error: asientosError } = await supabase
      .from('asientos_contables')
      .delete()
      .in('id', asientoIds);

    if (asientosError) throw asientosError;
    console.log(`Eliminados ${asientosSimulados.length} asientos contables`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Se eliminaron ${asientosSimulados.length} depreciaciones simuladas`,
        detallesEliminados: detallesCount || 0,
        asientosEliminados: asientosSimulados.length,
        asientosEliminadosDetalle: asientosSimulados.map(a => a.numero_asiento),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error en limpiar-depreciaciones-simuladas:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
