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

      const costosMensuales: CostoMensual[] = [];
      const costosPorCuentaMap = new Map<string, CostoPorCuenta>();

      // Obtener datos mes por mes
      for (let mes = 0; mes < 12; mes++) {
        const fechaInicio = new Date(añoActual, mes, 1).toISOString();
        const fechaFin = new Date(añoActual, mes + 1, 0, 23, 59, 59).toISOString();

        // Obtener todas las transacciones de costos del mes con su cuenta
        const { data: transacciones } = await supabase
          .from('transacciones_egresos')
          .select('monto_total, cuenta_codigo, subcuenta_id')
          .eq('tipo_egreso', 'costo')
          .gte('created_at', fechaInicio)
          .lte('created_at', fechaFin);

        const costoMes: CostoMensual = {
          mes: meses[mes],
          mesNumero: mes + 1
        };

        let totalMes = 0;
        const costosDelMes = new Map<string, number>();

        // Agrupar por cuenta_codigo
        if (transacciones) {
          for (const trans of transacciones) {
            const monto = trans.monto_total || 0;
            totalMes += monto;

            // Si tiene cuenta_codigo, agrupar por esa cuenta
            if (trans.cuenta_codigo) {
              const montoActual = costosDelMes.get(trans.cuenta_codigo) || 0;
              costosDelMes.set(trans.cuenta_codigo, montoActual + monto);
            }
          }
        }

        // Agregar los costos agrupados al objeto del mes
        costosDelMes.forEach((monto, cuenta) => {
          costoMes[cuenta] = monto;

          // Actualizar el mapa de costos por cuenta
          if (!costosPorCuentaMap.has(cuenta)) {
            costosPorCuentaMap.set(cuenta, {
              cuenta,
              nombreCuenta: cuenta,
              data: []
            });
          }
          costosPorCuentaMap.get(cuenta)!.data.push({
            mes: meses[mes],
            monto
          });
        });

        costoMes['total'] = totalMes;
        costosMensuales.push(costoMes);
      }

      // Obtener nombres de las cuentas
      const cuentasCodigos = Array.from(costosPorCuentaMap.keys());
      const { data: cuentasData } = await supabase
        .from('cuentas')
        .select('codigo, nombre')
        .in('codigo', cuentasCodigos);

      // Actualizar nombres de cuentas
      const cuentasMap = new Map(cuentasData?.map(c => [c.codigo, c.nombre]) || []);
      costosPorCuentaMap.forEach((value, key) => {
        value.nombreCuenta = cuentasMap.get(key) || key;
      });

      // Rellenar meses faltantes con 0 para cada cuenta
      const costosPorCuenta = Array.from(costosPorCuentaMap.values());
      costosPorCuenta.forEach(cuenta => {
        meses.forEach((mes, index) => {
          if (!cuenta.data.find(d => d.mes === mes)) {
            cuenta.data.splice(index, 0, { mes, monto: 0 });
          }
        });
      });

      const cuentas = costosPorCuenta.map(c => ({ 
        codigo: c.cuenta, 
        nombre: c.nombreCuenta 
      }));

      return {
        costosMensuales,
        costosPorCuenta,
        cuentas
      };
    }
  });
};
