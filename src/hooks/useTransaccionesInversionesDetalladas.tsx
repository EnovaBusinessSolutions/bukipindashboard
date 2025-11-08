import { useMemo } from "react";
import { useInversiones } from "./useInversiones";
import type { InversionCapex } from "./useInversiones";

export interface TransaccionInversion {
  id: string;
  tipo: 'alta' | 'baja' | 'venta';
  fecha: string;
  activo: string;
  categoria: string;
  monto?: number;
  descripcion?: string;
  motivo?: string;
  valor_venta?: number;
  inversion_id: string;
  inversion: InversionCapex;
}

export const useTransaccionesInversionesDetalladas = () => {
  const { inversiones, isLoading } = useInversiones();

  const transacciones = useMemo(() => {
    const resultado: TransaccionInversion[] = [];

    inversiones.forEach((inversion) => {
      // Transacción de alta (registro inicial)
      resultado.push({
        id: `alta-${inversion.id}`,
        tipo: 'alta',
        fecha: inversion.fecha_adquisicion,
        activo: inversion.producto_nombre,
        categoria: inversion.categoria_activo,
        monto: inversion.valor_total,
        descripcion: inversion.descripcion,
        inversion_id: inversion.id,
        inversion,
      });

      // Transacción de baja o venta (si aplica)
      if (inversion.estado === 'dado_de_baja' && inversion.fecha_baja) {
        resultado.push({
          id: `baja-${inversion.id}`,
          tipo: 'baja',
          fecha: inversion.fecha_baja,
          activo: inversion.producto_nombre,
          categoria: inversion.categoria_activo,
          motivo: inversion.motivo_baja,
          inversion_id: inversion.id,
          inversion,
        });
      } else if (inversion.estado === 'vendido' && inversion.fecha_baja) {
        resultado.push({
          id: `venta-${inversion.id}`,
          tipo: 'venta',
          fecha: inversion.fecha_baja,
          activo: inversion.producto_nombre,
          categoria: inversion.categoria_activo,
          valor_venta: inversion.valor_venta,
          motivo: inversion.motivo_baja,
          inversion_id: inversion.id,
          inversion,
        });
      }
    });

    // Ordenar por fecha descendente (más reciente primero)
    return resultado.sort((a, b) => {
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
  }, [inversiones]);

  return {
    transacciones,
    isLoading,
  };
};
