import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ResultadoMensual {
  mes: string;
  mesNumero: number;
  ingresos: number;
  costos: number;
  gastos: number;
  utilidadBruta: number;
  ebitda: number;
  depreciacion: number;
  ebit: number;
  intereses: number;
  utilidadAntesImpuestos: number;
  impuestos: number;
  utilidadNeta: number;
  margenBruto: number;
  margenEBITDA: number;
  margenEBIT: number;
  margenNeto: number;
}

export const useEstadoResultadosMensual = (año?: number) => {
  const añoActual = año || new Date().getFullYear();

  return useQuery({
    queryKey: ["estado-resultados-mensual", añoActual],
    queryFn: async (): Promise<ResultadoMensual[]> => {
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

      // Agrupar por mes en frontend usando Map
      const detallesPorMes = new Map<number, any[]>();
      
      detallesAño?.forEach(detalle => {
        const mes = new Date(detalle.asientos_contables.fecha).getMonth();
        if (!detallesPorMes.has(mes)) {
          detallesPorMes.set(mes, []);
        }
        detallesPorMes.get(mes)!.push(detalle);
      });

      // Procesar cada mes (sin más consultas async)
      const resultados: ResultadoMensual[] = [];

      for (let mes = 0; mes < 12; mes++) {
        const detallesMes = detallesPorMes.get(mes) || [];

        let ingresos = 0;
        let costos = 0;
        let gastos = 0;
        let depreciacion = 0;
        let intereses = 0;

        detallesMes.forEach(detalle => {
          const codigo = detalle.cuenta_codigo;
          const debe = detalle.debe || 0;
          const haber = detalle.haber || 0;
          
          // === INGRESOS (Cuentas 4XXX) ===
          // Ventas (4001, 4004) - Naturaleza acreedora
          if (codigo === '4001' || codigo === '4004') {
            ingresos += haber - debe;
          }
          // Devoluciones y Descuentos sobre Ventas (4002, 4003) - RESTAN
          else if (codigo === '4002' || codigo === '4003') {
            ingresos -= debe - haber;
          }
          // Otros Ingresos (41XX) - Naturaleza acreedora
          else if (codigo.startsWith('41')) {
            ingresos += haber - debe;
          }
          
          // === COSTOS (Cuentas 50XX) ===
          // Costo de Ventas (5001, 5002) - Naturaleza deudora
          else if (codigo === '5001' || codigo === '5002') {
            costos += debe - haber;
          }
          // Devoluciones/Descuentos sobre Compras (5003, 5004) - RESTAN de costos
          else if (codigo === '5003' || codigo === '5004') {
            costos -= debe - haber;
          }
          
          // === GASTOS (Cuentas 51XX) ===
          // Depreciación (5109, 5110) - separada para cálculo de EBITDA
          else if (codigo === '5109' || codigo === '5110') {
            depreciacion += debe - haber;
          }
          // Gastos Operativos (5101-5108, 5202, 5203)
          else if ((codigo.startsWith('51') && codigo !== '5109' && codigo !== '5110') || 
                   codigo === '5202' || codigo === '5203') {
            gastos += debe - haber;
          }
          
          // === INTERESES (Cuenta 5201, 5111-5199) ===
          else if (codigo === '5201' || (codigo.startsWith('51') && parseInt(codigo) >= 5111)) {
            intereses += debe - haber;
          }
        });

        // Calcular utilidades y márgenes según estructura contable
        const utilidadBruta = ingresos - costos;
        const ebitda = utilidadBruta - gastos;
        const ebit = ebitda - depreciacion;
        const utilidadAntesImpuestos = ebit - intereses;
        
        // Calcular impuestos (30% estimado sobre utilidad antes de impuestos positiva)
        const impuestos = utilidadAntesImpuestos > 0 ? utilidadAntesImpuestos * 0.30 : 0;
        const utilidadNeta = utilidadAntesImpuestos - impuestos;

        const margenBruto = ingresos > 0 ? (utilidadBruta / ingresos) * 100 : 0;
        const margenEBITDA = ingresos > 0 ? (ebitda / ingresos) * 100 : 0;
        const margenEBIT = ingresos > 0 ? (ebit / ingresos) * 100 : 0;
        const margenNeto = ingresos > 0 ? (utilidadNeta / ingresos) * 100 : 0;

        resultados.push({
          mes: meses[mes],
          mesNumero: mes + 1,
          ingresos,
          costos,
          gastos,
          utilidadBruta,
          ebitda,
          depreciacion,
          ebit,
          intereses,
          utilidadAntesImpuestos,
          impuestos,
          utilidadNeta,
          margenBruto,
          margenEBITDA,
          margenEBIT,
          margenNeto
        });
      }

      return resultados;
    },
    staleTime: 5 * 60 * 1000, // Cachear por 5 minutos
    gcTime: 10 * 60 * 1000, // Mantener en memoria 10 minutos
    retry: 1, // Solo 1 reintento
    refetchOnWindowFocus: false, // No refrescar al cambiar de ventana
  });
};
