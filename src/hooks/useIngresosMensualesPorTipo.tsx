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
        const fechaInicio = new Date(añoActual, mes, 1).toISOString().split('T')[0];
        const fechaFin = new Date(añoActual, mes + 1, 0).toISOString().split('T')[0];

        // CONSULTAR DESDE ASIENTOS CONTABLES - ÚNICA FUENTE DE VERDAD
        const { data: detalles } = await supabase
          .from('detalle_asientos')
          .select('cuenta_codigo, debe, haber, asientos_contables!inner(fecha)')
          .gte('asientos_contables.fecha', fechaInicio)
          .lte('asientos_contables.fecha', fechaFin);

        let ventas = 0;
        let otrosIngresos = 0;

        // Clasificar según el código de cuenta (cuentas 4XXX son ingresos)
        detalles?.forEach(detalle => {
          const codigo = detalle.cuenta_codigo;
          // Las cuentas de ingreso tienen naturaleza acreedora (HABER aumenta, DEBE disminuye)
          const monto = (detalle.haber || 0) - (detalle.debe || 0);
          
          if (codigo.startsWith('4001')) {
            // Ventas
            ventas += monto;
          } else if (codigo.startsWith('4')) {
            // Otros ingresos (4002, 4003, etc.)
            otrosIngresos += monto;
          }
        });

        ingresosMensuales.push({
          mes: meses[mes],
          mesNumero: mes + 1,
          ventas: Math.max(0, ventas), // Asegurar que no sea negativo
          otrosIngresos: Math.max(0, otrosIngresos),
          total: Math.max(0, ventas + otrosIngresos)
        });
      }

      return ingresosMensuales;
    }
  });
};
