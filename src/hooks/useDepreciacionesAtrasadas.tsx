import { useMemo } from "react";
import { useInversiones } from "./useInversiones";
import { useDepreciacionesReales } from "./useDepreciacionesReales";
import { differenceInMonths, startOfMonth } from "date-fns";

interface DepreciacionAtrasada {
  inversionId: string;
  productoNombre: string;
  mesAno: string; // "YYYYMM"
  mesesAtrasados: number;
}

export const useDepreciacionesAtrasadas = () => {
  const { inversiones, isLoading: loadingInversiones } = useInversiones();
  const { data, isLoading: loadingDepreciaciones } = useDepreciacionesReales();
  
  const depreciacionesAtrasadas = useMemo(() => {
    if (!inversiones || !data?.periodosRegistrados) return [];

    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const anoActual = hoy.getFullYear();
    const atrasadas: DepreciacionAtrasada[] = [];

    // Solo revisar activos activos con depreciación
    const activosConDepreciacion = inversiones.filter(
      inv => inv.estado === 'activo' && (inv.valor_depreciacion_mensual || 0) > 0
    );

    for (const inversion of activosConDepreciacion) {
      const fechaInicio = inversion.fecha_inicio_depreciacion
        ? new Date(inversion.fecha_inicio_depreciacion)
        : new Date(inversion.fecha_adquisicion);

      const inicioMes = fechaInicio.getMonth() + 1;
      const inicioAno = fechaInicio.getFullYear();

      // Calcular todos los meses desde inicio hasta mes anterior (no incluir mes actual)
      const mesesEsperados: string[] = [];
      let mesIterador = inicioMes;
      let anoIterador = inicioAno;

      while (
        anoIterador < anoActual ||
        (anoIterador === anoActual && mesIterador < mesActual)
      ) {
        mesesEsperados.push(`${anoIterador}${mesIterador.toString().padStart(2, '0')}`);
        
        mesIterador++;
        if (mesIterador > 12) {
          mesIterador = 1;
          anoIterador++;
        }
      }

      // Comparar con períodos registrados
      const periodosRegistradosData = data.periodosRegistrados[inversion.id] || [];
      const periodosRegistrados = Array.isArray(periodosRegistradosData) 
        ? periodosRegistradosData 
        : Array.from(periodosRegistradosData);
      
      for (const mesEsperado of mesesEsperados) {
        if (!periodosRegistrados.includes(mesEsperado)) {
          const ano = parseInt(mesEsperado.substring(0, 4));
          const mes = parseInt(mesEsperado.substring(4, 6));
          
          // Calcular meses de atraso
          const fechaEsperada = new Date(ano, mes - 1, 1);
          const mesesAtrasados = differenceInMonths(startOfMonth(hoy), startOfMonth(fechaEsperada));

          atrasadas.push({
            inversionId: inversion.id,
            productoNombre: inversion.producto_nombre,
            mesAno: mesEsperado,
            mesesAtrasados,
          });
        }
      }
    }

    return atrasadas;
  }, [inversiones, data]);

  const tieneAtrasadas = depreciacionesAtrasadas.length > 0;
  const totalAtrasadas = depreciacionesAtrasadas.length;

  return {
    depreciacionesAtrasadas,
    tieneAtrasadas,
    totalAtrasadas,
    isLoading: loadingInversiones || loadingDepreciaciones,
  };
};
