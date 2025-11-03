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

      // ✅ UNA SOLA CONSULTA PARA TODO EL AÑO (en lugar de 12)
      const fechaInicioAño = `${añoActual}-01-01`;
      const fechaFinAño = `${añoActual}-12-31`;

      const { data: detallesAño } = await supabase
        .from('detalle_asientos')
        .select('cuenta_codigo, debe, haber, asientos_contables!inner(fecha)')
        .gte('asientos_contables.fecha', fechaInicioAño)
        .lte('asientos_contables.fecha', fechaFinAño);

      // Agrupar por mes en frontend
      const detallesPorMes = new Map<number, any[]>();
      
      detallesAño?.forEach(detalle => {
        const mes = new Date(detalle.asientos_contables.fecha).getMonth();
        if (!detallesPorMes.has(mes)) {
          detallesPorMes.set(mes, []);
        }
        detallesPorMes.get(mes)!.push(detalle);
      });

      // Procesar cada mes
      const ingresosMensuales: IngresoMensual[] = [];

      for (let mes = 0; mes < 12; mes++) {
        const detallesMes = detallesPorMes.get(mes) || [];
        
        let ventas = 0;
        let otrosIngresos = 0;

        // Clasificar según el código de cuenta (cuentas 4XXX son ingresos)
        detallesMes.forEach(detalle => {
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
          ventas: Math.max(0, ventas),
          otrosIngresos: Math.max(0, otrosIngresos),
          total: Math.max(0, ventas + otrosIngresos)
        });
      }

      return ingresosMensuales;
    },
    staleTime: 5 * 60 * 1000, // Cachear por 5 minutos
    gcTime: 10 * 60 * 1000, // Mantener en memoria 10 minutos
    retry: 1, // Solo 1 reintento
    refetchOnWindowFocus: false, // No refrescar al cambiar de ventana
  });
};
