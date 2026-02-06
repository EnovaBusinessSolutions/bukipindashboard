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

type ContabilidadAsientoAPI = {
  id?: string;
  _id?: string;
  asiento_fecha?: string; // YYYY-MM-DD
  fecha?: string; // compat
  detalle_asientos?: Array<{
    cuenta_codigo?: string | null;
    debe?: number | null;
    haber?: number | null;
  }>;
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

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const unwrap = (json: any) => json?.data ?? json;

export const useEstadoResultadosMensual = (año?: number) => {
  const añoActual = año || new Date().getFullYear();

  return useQuery({
    queryKey: ["estado-resultados-mensual", añoActual],
    queryFn: async (): Promise<ResultadoMensual[]> => {
      const meses = [
        "Enero","Febrero","Marzo","Abril","Mayo","Junio",
        "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
      ];

      const fechaInicioAño = `${añoActual}-01-01`;
      const fechaFinAño = `${añoActual}-12-31`;

      /**
       * ✅ Fuente correcta para mensual:
       * /api/contabilidad/asientos trae asiento_fecha + detalle_asientos (líneas).
       * Así sí podemos agrupar por mes.
       */
      const json = await apiFetch(
        `/api/contabilidad/asientos?start=${encodeURIComponent(fechaInicioAño)}&end=${encodeURIComponent(fechaFinAño)}`,
        { method: "GET" }
      );

      const payload = unwrap(json);

      // Soportar {asientos}, {items}, array plano
      const asientos: ContabilidadAsientoAPI[] =
        payload?.asientos ??
        payload?.items ??
        (Array.isArray(payload) ? payload : []);

      // Agrupar líneas por mes (0-11)
      const detallesPorMes = new Map<number, Array<{ cuenta_codigo: string; debe: number; haber: number }>>();

      for (const a of asientos || []) {
        const ymd = String(a.asiento_fecha ?? a.fecha ?? "");
        const fecha = parseYYYYMMDDLocal(ymd);
        if (!fecha) continue;

        const mes = fecha.getMonth();
        const lines = Array.isArray(a.detalle_asientos) ? a.detalle_asientos : [];

        for (const ln of lines) {
          const codigo = String(ln?.cuenta_codigo ?? "").trim();
          if (!codigo) continue;

          const debe = num(ln?.debe);
          const haber = num(ln?.haber);

          if (!detallesPorMes.has(mes)) detallesPorMes.set(mes, []);
          detallesPorMes.get(mes)!.push({ cuenta_codigo: codigo, debe, haber });
        }
      }

      // Procesar cada mes
      const resultados: ResultadoMensual[] = [];

      for (let mes = 0; mes < 12; mes++) {
        const detallesMes = detallesPorMes.get(mes) || [];

        let ingresos = 0;
        let costos = 0;
        let gastos = 0;
        let depreciacion = 0;
        let intereses = 0;

        for (const detalle of detallesMes) {
          const codigo = String(detalle.cuenta_codigo || "");
          const debe = num(detalle.debe);
          const haber = num(detalle.haber);

          // === INGRESOS (4XXX) ===
          if (codigo === "4001" || codigo === "4004") {
            ingresos += haber - debe;
          } else if (codigo === "4002" || codigo === "4003") {
            ingresos -= debe - haber;
          } else if (codigo.startsWith("41")) {
            ingresos += haber - debe;
          }

          // === COSTOS (50XX) ===
          else if (codigo === "5001" || codigo === "5002") {
            costos += debe - haber;
          } else if (codigo === "5003" || codigo === "5004") {
            costos -= debe - haber;
          }

          // === GASTOS (51XX) ===
          else if (codigo === "5109" || codigo === "5110") {
            depreciacion += debe - haber;
          } else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
            gastos += debe - haber;
          }

          // === INTERESES (5201) ===
          else if (codigo === "5201") {
            intereses += debe - haber;
          }
        }

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
