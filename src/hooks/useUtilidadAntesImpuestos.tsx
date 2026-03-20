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

type DetalleAsiento = {
  cuenta_codigo?: string;
  cuentaCodigo?: string;
  code?: string;
  debe?: number | null;
  debit?: number | null;
  haber?: number | null;
  credit?: number | null;
  fecha?: string;
  asiento_fecha?: string;
};

const asNumber = (v: any, def = 0) => {
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : def;
};

const getCodigoBase = (codigo: string) => {
  const s = String(codigo || "").trim();
  if (!s) return "";
  return s.includes("-") ? s.split("-")[0].trim() : s;
};

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const direct = json?.data ?? json;

  if (Array.isArray(direct)) return direct as T[];

  if (Array.isArray(json?.data?.detalles)) return json.data.detalles as T[];
  if (Array.isArray(json?.detalles)) return json.detalles as T[];
  if (Array.isArray(json?.detalle_asientos)) return json.detalle_asientos as T[];

  if (Array.isArray(json?.data?.detalle_asientos)) return json.data.detalle_asientos as T[];
  if (Array.isArray(json?.items)) return json.items as T[];

  return [];
};

export const useUtilidadAntesImpuestos = (mes: number, ano: number) => {
  return useQuery({
    queryKey: ["utilidad-antes-impuestos", mes, ano],
    enabled: Number.isFinite(mes) && Number.isFinite(ano) && mes >= 1 && mes <= 12,
    queryFn: async (): Promise<UtilidadData> => {
      const fechaInicio = new Date(ano, mes - 1, 1).toISOString().split("T")[0];
      const fechaFin = new Date(ano, mes, 0).toISOString().split("T")[0];

      const json: AnyJson = await apiFetch(
        `/api/contabilidad/detalle-asientos?start=${encodeURIComponent(fechaInicio)}&end=${encodeURIComponent(fechaFin)}`,
        { method: "GET" }
      );

      const detalles = normalizeArray<DetalleAsiento>(json);

      let ingresos = 0;
      let costos = 0;
      let gastos = 0;
      let depreciacion = 0;
      let intereses = 0;

      detalles.forEach((detalle) => {
        const codigoRaw = String(
          detalle.cuenta_codigo ?? detalle.cuentaCodigo ?? detalle.code ?? ""
        ).trim();

        const codigo = getCodigoBase(codigoRaw);
        if (!codigo) return;

        const debe = asNumber(detalle.debe ?? detalle.debit, 0);
        const haber = asNumber(detalle.haber ?? detalle.credit, 0);
        const saldo = debe - haber;

        // Ingresos (cuentas 4xxx) - naturaleza acreedora
        if (codigo.startsWith("4")) {
          ingresos += Math.abs(saldo);
        }
        // Costos / gastos / depreciación / intereses (familia 5xxx)
        else if (codigo.startsWith("5")) {
          const n = parseInt(codigo, 10);

          // Costos (5001-5099)
          if (Number.isFinite(n) && n >= 5001 && n <= 5099) {
            costos += Math.abs(saldo);
          }
          // Depreciación (5109, 5110)
          else if (codigo === "5109" || codigo === "5110") {
            depreciacion += Math.abs(saldo);
          }
          // Gastos (51xx excepto depreciaciones)
          else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
            gastos += Math.abs(saldo);
          }
          // Intereses (5111-5199, 5201)
          else if ((Number.isFinite(n) && n >= 5111 && n <= 5199) || codigo === "5201") {
            intereses += Math.abs(saldo);
          }
        }
      });

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