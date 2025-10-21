import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface IngresoMensual {
  mes: string;
  mesNumero: number;
  ventas: number;
  otrosIngresos: number;
  total: number;
}

interface DetalleIngreso {
  tipo_ingreso: string;
  monto: number;
  cuenta_principal_codigo: string;
}

export const useIngresosMensualesPorTipo = (año?: number) => {
  const añoActual = año || new Date().getFullYear();

  return useQuery({
    queryKey: ["ingresos-mensuales-por-tipo", añoActual],
    queryFn: async (): Promise<IngresoMensual[]> => {
      const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];

      const ingresosMensuales: IngresoMensual[] = [];

      for (let mes = 0; mes < 12; mes++) {
        const fechaInicio = new Date(añoActual, mes, 1).toISOString();
        const fechaFin = new Date(añoActual, mes + 1, 0, 23, 59, 59).toISOString();

        // Obtener TODAS las transacciones de ingresos del mes con su clasificación
        const { data: ingresosData } = await supabase
          .from('transacciones_ingresos')
          .select('tipo_ingreso, monto_neto, cuenta_principal_codigo')
          .gte('created_at', fechaInicio)
          .lte('created_at', fechaFin);

        let ventas = 0;
        let otrosIngresos = 0;

        // Clasificar según el cuenta_principal_codigo (4001 es ventas)
        if (ingresosData) {
          ingresosData.forEach(ingreso => {
            const monto = ingreso.monto_neto || 0;
            
            // Si la cuenta empieza con 4001, es venta
            if (ingreso.cuenta_principal_codigo && ingreso.cuenta_principal_codigo.startsWith('4001')) {
              ventas += monto;
            } else {
              // Todo lo demás son otros ingresos
              otrosIngresos += monto;
            }
          });
        }

        ingresosMensuales.push({
          mes: meses[mes],
          mesNumero: mes + 1,
          ventas,
          otrosIngresos,
          total: ventas + otrosIngresos
        });
      }

      return ingresosMensuales;
    }
  });
};
