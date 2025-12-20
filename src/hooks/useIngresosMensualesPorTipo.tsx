import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface IngresoMensual {
  mes: string;
  mesNumero: number;
  ventas: number;
  otrosIngresos: number;
  total: number;
}

type DetalleAsientoAPI = {
  cuenta_codigo: string;
  debe: number | string | null;
  haber: number | string | null;
  // Recomendado: el backend lo manda plano para evitar joins
  asiento_fecha: string; // YYYY-MM-DD
};

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string } | T;
const unwrap = <T,>(json: ApiEnvelope<T>): T => (json as any)?.data ?? (json as T);

export const useIngresosMensualesPorTipo = (año?: number) => {
  const añoActual = año || new Date().getFullYear();

  return useQuery({
    queryKey: ["ingresos-mensuales-por-tipo", añoActual],
    queryFn: async (): Promise<IngresoMensual[]> => {
      const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
      ];

      // ✅ UNA SOLA CONSULTA PARA TODO EL AÑO (en lugar de 12)
      const fechaInicioAño = `${añoActual}-01-01`;
      const fechaFinAño = `${añoActual}-12-31`;

      const params = new URLSearchParams();
      params.set("from", fechaInicioAño);
      params.set("to", fechaFinAño);

      const json = await apiFetch(`/api/contabilidad/detalle-asientos?${params.toString()}`, {
        method: "GET",
      });

      const detallesAño = unwrap<DetalleAsientoAPI[]>(json) || [];

      // Agrupar por mes en frontend
      const detallesPorMes = new Map<number, DetalleAsientoAPI[]>();

      detallesAño.forEach((detalle) => {
        const fecha = new Date(detalle.asiento_fecha);
        const mes = fecha.getMonth();
        if (!detallesPorMes.has(mes)) detallesPorMes.set(mes, []);
        detallesPorMes.get(mes)!.push(detalle);
      });

      // Procesar cada mes
      const ingresosMensuales: IngresoMensual[] = [];

      for (let mes = 0; mes < 12; mes++) {
        const detallesMes = detallesPorMes.get(mes) || [];

        let ventas = 0;
        let otrosIngresos = 0;

        // Clasificar según el código de cuenta con naturaleza contable correcta
        detallesMes.forEach((detalle) => {
          const codigo = detalle.cuenta_codigo;
          const debe = Number(detalle.debe) || 0;
          const haber = Number(detalle.haber) || 0;

          // Ventas (cuenta 4001 y 4004) - Naturaleza acreedora
          if (codigo === "4001" || codigo === "4004") {
            ventas += haber - debe;
          }
          // Devoluciones y Descuentos sobre Ventas (4002, 4003) - RESTAN de ventas
          else if (codigo === "4002" || codigo === "4003") {
            ventas -= debe - haber;
          }
          // Otros Ingresos (41XX) - Naturaleza acreedora
          else if (codigo.startsWith("41")) {
            otrosIngresos += haber - debe;
          }
        });

        const ventasSafe = Math.max(0, ventas);
        const otrosSafe = Math.max(0, otrosIngresos);

        ingresosMensuales.push({
          mes: meses[mes],
          mesNumero: mes + 1,
          ventas: ventasSafe,
          otrosIngresos: otrosSafe,
          total: Math.max(0, ventasSafe + otrosSafe),
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
