import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CostoMensual {
  mes: string;
  mesNumero: number;
  [key: string]: number | string; // Para las cuentas dinámicas
}

interface CostoPorCuenta {
  cuenta: string;
  nombreCuenta: string;
  data: { mes: string; monto: number }[];
}

export const useCostosMensuales = (año?: number) => {
  const añoActual = año || new Date().getFullYear();

  return useQuery({
    queryKey: ["costos-mensuales", añoActual],
    queryFn: async () => {
      const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];

      // Primero obtener todas las cuentas de costos
      const { data: cuentasData } = await supabase
        .from('cuentas')
        .select('codigo, nombre')
        .eq('grupo', 'Costos')
        .order('codigo');

      const cuentas = cuentasData || [];
      const costosMensuales: CostoMensual[] = [];
      const costosPorCuenta: CostoPorCuenta[] = [];

      // Inicializar estructura de costos por cuenta
      cuentas.forEach(cuenta => {
        costosPorCuenta.push({
          cuenta: cuenta.codigo,
          nombreCuenta: cuenta.nombre,
          data: []
        });
      });

      // Obtener datos mes por mes
      for (let mes = 0; mes < 12; mes++) {
        const fechaInicio = new Date(añoActual, mes, 1).toISOString();
        const fechaFin = new Date(añoActual, mes + 1, 0, 23, 59, 59).toISOString();

        const costoMes: CostoMensual = {
          mes: meses[mes],
          mesNumero: mes + 1
        };

        let totalMes = 0;

        // Para cada cuenta, obtener el total del mes
        for (const cuenta of cuentas) {
          const { data: transacciones } = await supabase
            .from('transacciones_egresos')
            .select('monto_total')
            .eq('tipo_egreso', 'costo')
            .eq('cuenta_codigo', cuenta.codigo)
            .gte('created_at', fechaInicio)
            .lte('created_at', fechaFin);

          const montoCuenta = transacciones?.reduce((sum, t) => sum + (t.monto_total || 0), 0) || 0;
          costoMes[cuenta.codigo] = montoCuenta;
          totalMes += montoCuenta;

          // Agregar a costos por cuenta
          const cuentaIndex = costosPorCuenta.findIndex(c => c.cuenta === cuenta.codigo);
          if (cuentaIndex !== -1) {
            costosPorCuenta[cuentaIndex].data.push({
              mes: meses[mes],
              monto: montoCuenta
            });
          }
        }

        costoMes['total'] = totalMes;
        costosMensuales.push(costoMes);
      }

      return {
        costosMensuales,
        costosPorCuenta,
        cuentas: cuentas.map(c => ({ codigo: c.codigo, nombre: c.nombre }))
      };
    }
  });
};
