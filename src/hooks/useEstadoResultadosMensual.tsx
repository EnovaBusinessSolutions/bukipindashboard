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

      const resultados: ResultadoMensual[] = [];

      for (let mes = 0; mes < 12; mes++) {
        const fechaInicio = new Date(añoActual, mes, 1).toISOString().split('T')[0];
        const fechaFin = new Date(añoActual, mes + 1, 0).toISOString().split('T')[0];

        // OBTENER TODO DESDE ASIENTOS CONTABLES - ÚNICA FUENTE DE VERDAD
        const { data: detalles } = await supabase
          .from('detalle_asientos')
          .select('cuenta_codigo, debe, haber, asientos_contables!inner(fecha)')
          .gte('asientos_contables.fecha', fechaInicio)
          .lte('asientos_contables.fecha', fechaFin);

        let ingresos = 0;
        let costos = 0;
        let gastos = 0;
        let depreciacion = 0;
        let intereses = 0;

        detalles?.forEach(detalle => {
          const codigo = detalle.cuenta_codigo;
          const saldo = (detalle.debe || 0) - (detalle.haber || 0);
          
          // Ingresos (cuentas 4xxx) - naturaleza acreedora
          if (codigo.startsWith('4')) {
            ingresos += Math.abs(saldo);
          }
          // Costos (cuentas 5001-5099) - naturaleza deudora
          else if (codigo.startsWith('5') && parseInt(codigo) >= 5001 && parseInt(codigo) <= 5099) {
            costos += Math.abs(saldo);
          }
          // Depreciación (cuentas 5109, 5110)
          else if (codigo === '5109' || codigo === '5110') {
            depreciacion += Math.abs(saldo);
          }
          // Gastos (cuentas 5100-5108, 5202, 5203) - naturaleza deudora
          else if ((codigo.startsWith('5') && parseInt(codigo) >= 5100 && parseInt(codigo) <= 5108) || 
                   codigo === '5202' || codigo === '5203') {
            gastos += Math.abs(saldo);
          }
          // Intereses (cuentas 5111-5199, 5201)
          else if ((codigo.startsWith('5') && parseInt(codigo) >= 5111 && parseInt(codigo) <= 5199) || 
                   codigo === '5201') {
            intereses += Math.abs(saldo);
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
    }
  });
};
