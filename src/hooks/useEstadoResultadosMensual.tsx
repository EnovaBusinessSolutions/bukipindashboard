import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

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

type DetalleAsientoAPI = {
  cuenta_codigo: string;
  debe: number | null;
  haber: number | null;
  asientos_contables: {
    fecha: string; // YYYY-MM-DD
  };
};

const parseYYYYMMDDLocal = (yyyyMmDd: string): Date | null => {
  const parts = (yyyyMmDd || "").split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m, d);
};

export const useEstadoResultadosMensual = (año?: number) => {
  const añoActual = año || new Date().getFullYear();

  return useQuery({
    queryKey: ["estado-resultados-mensual", añoActual],
    queryFn: async (): Promise<ResultadoMensual[]> => {
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

      // ✅ UNA SOLA CONSULTA PARA TODO EL AÑO
      const fechaInicioAño = `${añoActual}-01-01`;
      const fechaFinAño = `${añoActual}-12-31`;

      /**
       * Endpoint esperado:
       * GET /api/contabilidad/detalle-asientos?start=YYYY-MM-DD&end=YYYY-MM-DD
       * Devuelve { ok:true, data:[...] } o payload plano [...]
       */
      const json = await apiFetch(
        `/api/contabilidad/detalle-asientos?start=${encodeURIComponent(fechaInicioAño)}&end=${encodeURIComponent(
          fechaFinAño
        )}`,
        { method: "GET" }
      );

      const detallesAño = (json?.data ?? json ?? []) as DetalleAsientoAPI[];

      // Agrupar por mes en frontend usando Map
      const detallesPorMes = new Map<number, DetalleAsientoAPI[]>();

      detallesAño.forEach((detalle) => {
        const fecha = parseYYYYMMDDLocal(detalle.asientos_contables?.fecha || "");
        if (!fecha) return;
        const mes = fecha.getMonth();
        if (!detallesPorMes.has(mes)) detallesPorMes.set(mes, []);
        detallesPorMes.get(mes)!.push(detalle);
      });

      // Procesar cada mes (sin más consultas)
      const resultados: ResultadoMensual[] = [];

      for (let mes = 0; mes < 12; mes++) {
        const detallesMes = detallesPorMes.get(mes) || [];

        let ingresos = 0;
        let costos = 0;
        let gastos = 0;
        let depreciacion = 0;
        let intereses = 0;

        detallesMes.forEach((detalle) => {
          const codigo = String(detalle.cuenta_codigo || "");
          const debe = Number(detalle.debe) || 0;
          const haber = Number(detalle.haber) || 0;

          // === INGRESOS (Cuentas 4XXX) ===
          // Ventas (4001, 4004) - naturaleza acreedora
          if (codigo === "4001" || codigo === "4004") {
            ingresos += haber - debe;
          }
          // Devoluciones/Descuentos sobre Ventas (4002, 4003) - RESTAN
          else if (codigo === "4002" || codigo === "4003") {
            ingresos -= debe - haber;
          }
          // Otros Ingresos (41XX) - naturaleza acreedora
          else if (codigo.startsWith("41")) {
            ingresos += haber - debe;
          }

          // === COSTOS (Cuentas 50XX) ===
          // Costo de Ventas (5001, 5002) - naturaleza deudora
          else if (codigo === "5001" || codigo === "5002") {
            costos += debe - haber;
          }
          // Devoluciones/Descuentos sobre Compras (5003, 5004) - RESTAN
          else if (codigo === "5003" || codigo === "5004") {
            costos -= debe - haber;
          }

          // === GASTOS (Cuentas 51XX) ===
          // Depreciación (5109, 5110) - separada para EBITDA
          else if (codigo === "5109" || codigo === "5110") {
            depreciacion += debe - haber;
          }
          // Gastos operativos (51XX excepto depreciaciones)
          else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
            gastos += debe - haber;
          }

          // === INTERESES ===
          // ✅ Regla segura: solo 5201 (Intereses)
          else if (codigo === "5201") {
            intereses += debe - haber;
          }

          // ⚠️ Si quieres mantener tu regla original (NO recomendado), descomenta:
          // else if (codigo === "5201" || (codigo.startsWith("51") && parseInt(codigo, 10) >= 5111)) {
          //   intereses += debe - haber;
          // }
        });

        // Calcular utilidades y márgenes
        const utilidadBruta = ingresos - costos;
        const ebitda = utilidadBruta - gastos;
        const ebit = ebitda - depreciacion;
        const utilidadAntesImpuestos = ebit - intereses;

        // Impuestos estimados (30% si hay utilidad positiva)
        const impuestos = utilidadAntesImpuestos > 0 ? utilidadAntesImpuestos * 0.3 : 0;
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
          margenNeto,
        });
      }

      return resultados;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
