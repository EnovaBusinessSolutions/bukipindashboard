import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface EgresoMensual {
  mes: string;
  mesNumero: number;
  costos: number;
  gastos: number;
  total: number;
}

type DetalleAsientoAPI = {
  cuenta_codigo: string;
  debe: number | null;
  haber: number | null;
  asientos_contables: {
    fecha: string; // YYYY-MM-DD
  };
};

export const useEgresosMensualesPorTipo = (año?: number) => {
  const añoActual = año || new Date().getFullYear();

  return useQuery({
    queryKey: ["egresos-mensuales-por-tipo", añoActual],
    queryFn: async (): Promise<EgresoMensual[]> => {
      const meses = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
      ];

      // UNA sola consulta para todo el año
      const fechaInicioAño = `${añoActual}-01-01`;
      const fechaFinAño = `${añoActual}-12-31`;

      /**
       * Endpoint esperado:
       * GET /api/contabilidad/detalle-asientos?start=YYYY-MM-DD&end=YYYY-MM-DD
       * Debe regresar (ideal): { ok:true, data:[{ cuenta_codigo,debe,haber, asientos_contables:{fecha}}] }
       * Se soporta payload plano usando json.data ?? json
       */
      const json = await apiFetch(
        `/api/contabilidad/detalle-asientos?start=${encodeURIComponent(
          fechaInicioAño
        )}&end=${encodeURIComponent(fechaFinAño)}`,
        { method: "GET" }
      );

      const detallesAño = (json?.data ?? json ?? []) as DetalleAsientoAPI[];

      // Agrupar por mes en frontend
      const detallesPorMes = new Map<number, DetalleAsientoAPI[]>();

      detallesAño.forEach((detalle) => {
        const fechaStr = detalle?.asientos_contables?.fecha;
        if (!fechaStr) return;

        // Parse robusto YYYY-MM-DD (evitar offsets por timezone)
        const parts = fechaStr.split("-");
        if (parts.length !== 3) return;

        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1; // 0-11
        const d = Number(parts[2]);
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return;

        const fecha = new Date(y, m, d);
        const mes = fecha.getMonth();

        if (!detallesPorMes.has(mes)) detallesPorMes.set(mes, []);
        detallesPorMes.get(mes)!.push(detalle);
      });

      const egresosMensuales: EgresoMensual[] = [];

      for (let mes = 0; mes < 12; mes++) {
        const detallesMes = detallesPorMes.get(mes) || [];

        let costos = 0;
        let gastos = 0;

        // Clasificar según el código de cuenta con naturaleza contable correcta
        detallesMes.forEach((detalle) => {
          const codigo = String(detalle.cuenta_codigo || "");
          const debe = Number(detalle.debe) || 0;
          const haber = Number(detalle.haber) || 0;

          // Costos de Venta (5001, 5002) - Naturaleza deudora
          if (codigo === "5001" || codigo === "5002") {
            costos += debe - haber;
          }
          // Devoluciones/Descuentos sobre Compras (5003, 5004) - RESTAN de costos
          else if (codigo === "5003" || codigo === "5004") {
            costos -= debe - haber;
          }
          // Gastos Operativos (51XX excepto depreciaciones) - Naturaleza deudora
          else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
            gastos += debe - haber;
          }
        });

        const costosFinal = Math.max(0, costos);
        const gastosFinal = Math.max(0, gastos);

        egresosMensuales.push({
          mes: meses[mes],
          mesNumero: mes + 1,
          costos: costosFinal,
          gastos: gastosFinal,
          total: Math.max(0, costosFinal + gastosFinal),
        });
      }

      return egresosMensuales;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
