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
  asientos_fecha?: string; // compat común
  fecha_asiento?: string; // compat común
  createdAt?: string; // ISO

  // Posibles variantes
  detalle_asientos?: Array<any>;
  detalles?: Array<any>;
  lines?: Array<any>;
  asientos_contables?: Array<any>;
};

const parseYYYYMMDDLocal = (input: string): Date | null => {
  const s = String(input || "").trim();
  if (!s) return null;

  // Soportar ISO: "2026-01-23T..." -> "2026-01-23"
  const ymd = s.includes("T") ? s.split("T")[0] : s;

  const parts = ymd.split("-");
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

const pickFecha = (a: any): string => {
  return (
    a?.asiento_fecha ||
    a?.fecha ||
    a?.asientos_fecha ||
    a?.fecha_asiento ||
    a?.date ||
    a?.createdAt ||
    ""
  );
};

const pickLines = (a: any): any[] => {
  const lines =
    a?.detalle_asientos ??
    a?.detalles ??
    a?.lines ??
    a?.asientos_contables ??
    [];

  return Array.isArray(lines) ? lines : [];
};

const pickCuentaCodigo = (ln: any): string => {
  const codigo =
    ln?.cuenta_codigo ??
    ln?.cuentaCodigo ??
    ln?.accountCodigo ??
    ln?.codigo ??
    "";

  return String(codigo || "").trim();
};

const pickDebeHaber = (ln: any) => {
  // Compat: debe/haber o debit/credit
  const debe = num(ln?.debe ?? ln?.debit ?? 0);
  const haber = num(ln?.haber ?? ln?.credit ?? 0);
  return { debe, haber };
};

export const useEstadoResultadosMensual = (año?: number, opts?: { debug?: boolean }) => {
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

      const json = await apiFetch(
        `/api/contabilidad/asientos?start=${encodeURIComponent(fechaInicioAño)}&end=${encodeURIComponent(fechaFinAño)}`,
        { method: "GET" }
      );

      const payload = unwrap(json);

      const asientos: ContabilidadAsientoAPI[] =
        payload?.asientos ??
        payload?.items ??
        payload?.data?.asientos ??
        payload?.data?.items ??
        (Array.isArray(payload) ? payload : []);

      // Agrupar líneas por mes (0-11)
      const detallesPorMes = new Map<number, Array<{ cuenta_codigo: string; debe: number; haber: number }>>();

      let debugCounters = {
        totalAsientos: 0,
        asientosSinFecha: 0,
        asientosSinLines: 0,
        lineasSinCodigo: 0,
        lineasProcesadas: 0,
      };

      for (const a of asientos || []) {
        debugCounters.totalAsientos++;

        const ymd = String(pickFecha(a));
        const fecha = parseYYYYMMDDLocal(ymd);
        if (!fecha) {
          debugCounters.asientosSinFecha++;
          continue;
        }

        const mes = fecha.getMonth();
        const lines = pickLines(a);

        if (!lines.length) {
          debugCounters.asientosSinLines++;
          continue;
        }

        for (const ln of lines) {
          const codigo = pickCuentaCodigo(ln);
          if (!codigo) {
            debugCounters.lineasSinCodigo++;
            continue;
          }

          const { debe, haber } = pickDebeHaber(ln);

          if (!detallesPorMes.has(mes)) detallesPorMes.set(mes, []);
          detallesPorMes.get(mes)!.push({ cuenta_codigo: codigo, debe, haber });
          debugCounters.lineasProcesadas++;
        }
      }

      if (opts?.debug) {
        // eslint-disable-next-line no-console
        console.log("[ER Mensual] debugCounters:", debugCounters);
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

          // === INGRESOS ===
          if (codigo === "4001" || codigo === "4004") {
            ingresos += haber - debe;
          } else if (codigo === "4002" || codigo === "4003") {
            ingresos -= debe - haber;
          } else if (codigo.startsWith("41")) {
            ingresos += haber - debe;
          }

          // === COSTOS ===
          else if (codigo === "5001" || codigo === "5002") {
            costos += debe - haber;
          } else if (codigo === "5003" || codigo === "5004") {
            costos -= debe - haber;
          }

          // === GASTOS ===
          else if (codigo === "5109" || codigo === "5110") {
            depreciacion += debe - haber;
          } else if (codigo.startsWith("51") && codigo !== "5109" && codigo !== "5110") {
            gastos += debe - haber;
          }

          // === INTERESES ===
          else if (codigo === "5201") {
            intereses += debe - haber;
          }
        }

        const utilidadBruta = ingresos - costos;
        const ebitda = utilidadBruta - gastos;
        const ebit = ebitda - depreciacion;
        const utilidadAntesImpuestos = ebit - intereses;

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
