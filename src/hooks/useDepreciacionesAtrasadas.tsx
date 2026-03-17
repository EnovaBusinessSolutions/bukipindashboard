import { useMemo } from "react";
import { useInversiones } from "./useInversiones";
import { useDepreciacionesReales } from "./useDepreciacionesReales";

interface DepreciacionAtrasada {
  inversionId: string;
  productoNombre: string;
  mesAno: string; // YYYYMM
  mesesAtrasados: number;
}

const isValidDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const monthKey = (year: number, month1to12: number) =>
  `${year}${String(month1to12).padStart(2, "0")}`;

const monthDiff = (from: Date, to: Date) => {
  const fromIndex = from.getFullYear() * 12 + from.getMonth();
  const toIndex = to.getFullYear() * 12 + to.getMonth();
  return toIndex - fromIndex;
};

const normalizePeriodos = (raw: any): string[] => {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((p) => String(p || "").trim())
      .filter((p) => /^\d{6}$/.test(p));
  }

  if (raw instanceof Set) {
    return Array.from(raw)
      .map((p) => String(p || "").trim())
      .filter((p) => /^\d{6}$/.test(p));
  }

  if (typeof raw === "object") {
    return Object.values(raw)
      .flatMap((value) => {
        if (Array.isArray(value)) return value;
        if (value instanceof Set) return Array.from(value);
        if (typeof value === "string") return [value];
        return [];
      })
      .map((p) => String(p || "").trim())
      .filter((p) => /^\d{6}$/.test(p));
  }

  return [];
};

export const useDepreciacionesAtrasadas = () => {
  const { inversiones, isLoading: loadingInversiones } = useInversiones();
  const { data, isLoading: loadingDepreciaciones } = useDepreciacionesReales();

  const depreciacionesAtrasadas = useMemo<DepreciacionAtrasada[]>(() => {
    const periodosPorInversion = data?.periodosRegistrados;
    if (!Array.isArray(inversiones) || !periodosPorInversion) return [];

    const hoy = new Date();
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const atrasadas: DepreciacionAtrasada[] = [];

    const activosConDepreciacion = inversiones.filter(
      (inv) =>
        inv?.estado === "activo" &&
        Number(inv?.valor_depreciacion_mensual || 0) > 0
    );

    for (const inversion of activosConDepreciacion) {
      const fechaBase =
        isValidDate(inversion.fecha_inicio_depreciacion) ||
        isValidDate(inversion.fecha_adquisicion);

      if (!fechaBase) continue;

      const inicioMes = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), 1);

      // Si la fecha de inicio es el mes actual o futura, no hay atrasos
      if (inicioMes >= inicioMesActual) continue;

      const periodosRegistrados = new Set(
        normalizePeriodos(periodosPorInversion[inversion.id])
      );

      let iterador = new Date(inicioMes);

      while (iterador < inicioMesActual) {
        const key = monthKey(iterador.getFullYear(), iterador.getMonth() + 1);

        if (!periodosRegistrados.has(key)) {
          atrasadas.push({
            inversionId: inversion.id,
            productoNombre: inversion.producto_nombre,
            mesAno: key,
            mesesAtrasados: monthDiff(iterador, inicioMesActual),
          });
        }

        iterador = new Date(iterador.getFullYear(), iterador.getMonth() + 1, 1);
      }
    }

    atrasadas.sort((a, b) => {
      if (b.mesesAtrasados !== a.mesesAtrasados) {
        return b.mesesAtrasados - a.mesesAtrasados;
      }
      return a.productoNombre.localeCompare(b.productoNombre, "es");
    });

    return atrasadas;
  }, [inversiones, data]);

  return {
    depreciacionesAtrasadas,
    tieneAtrasadas: depreciacionesAtrasadas.length > 0,
    totalAtrasadas: depreciacionesAtrasadas.length,
    isLoading: loadingInversiones || loadingDepreciaciones,
  };
};