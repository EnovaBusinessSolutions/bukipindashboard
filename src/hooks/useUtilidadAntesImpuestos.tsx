import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface UtilidadData {
  mes: number;
  ano: number;
  utilidadAntesImpuestos: number;
  ingresos: number;
  costos: number;
  gastos: number;
  depreciacion: number;
  intereses: number;
}

type AnyJson = any;

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

export const useUtilidadAntesImpuestos = (mes: number, ano: number) => {
  return useQuery({
    queryKey: ["utilidad-antes-impuestos", mes, ano],
    enabled: Number.isFinite(mes) && Number.isFinite(ano) && mes >= 1 && mes <= 12,
    queryFn: async (): Promise<UtilidadData> => {
      const fechaInicio = new Date(ano, mes - 1, 1).toISOString().split("T")[0];
      const fechaFin = new Date(ano, mes, 0).toISOString().split("T")[0];

      /**
       * ✅ Backend esperado:
       * GET /api/contabilidad/detalle-asientos?start=YYYY-MM-DD&end=YYYY-MM-DD
       * Devuelve:
       * [
       *   { cuenta_codigo, debe, haber, fecha } ...
       * ]
       * o { ok:true, data:[...] }
       */
      const json: AnyJson = await apiFetch(
        `/api/contabilidad/detalle-asientos?start=${encodeURIComponent(fechaInicio)}&end=${encodeURIComponent(fechaFin)}`,
        { method: "GET" }
      );

      const detalles = normalizeArray<{
        cuenta_codigo: string;
        debe?: number | null;
        haber?: number | null;
        fecha?: string; // opcional
      }>(json);

      let ingresos = 0;
      let costos = 0;
      let gastos = 0;
      let depreciacion = 0;
      let intereses = 0;

      detalles.forEach((detalle) => {
        const codigo = String(detalle.cuenta_codigo || "");
        const debe = Number(detalle.debe || 0);
        const haber = Number(detalle.haber || 0);
        const saldo = debe - haber;

        // Ingresos (cuentas 4xxx) - naturaleza acreedora
        if (codigo.startsWith("4")) {
          ingresos += Math.abs(saldo);
        }
        // Costos (cuentas 5001-5099) - naturaleza deudora
        else if (codigo.startsWith("5")) {
          const n = parseInt(codigo, 10);
          if (Number.isFinite(n) && n >= 5001 && n <= 5099) {
            costos += Math.abs(saldo);
          }
          // Depreciación (cuentas 5109, 5110)
          else if (codigo === "5109" || codigo === "5110") {
            depreciacion += Math.abs(saldo);
          }
          // Gastos (cuentas 51XX excepto depreciaciones) - naturaleza deudora
          else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
            gastos += Math.abs(saldo);
          }
          // Intereses (cuentas 5111-5199, 5201)
          else if ((Number.isFinite(n) && n >= 5111 && n <= 5199) || codigo === "5201") {
            intereses += Math.abs(saldo);
          }
        }
      });

      // Calcular utilidad antes de impuestos
      const utilidadBruta = ingresos - costos;
      const ebitda = utilidadBruta - gastos;
      const ebit = ebitda - depreciacion;
      const utilidadAntesImpuestos = ebit - intereses;

      return {
        mes,
        ano,
        utilidadAntesImpuestos,
        ingresos,
        costos,
        gastos,
        depreciacion,
        intereses,
      };
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
