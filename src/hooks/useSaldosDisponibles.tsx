import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface SaldosDisponibles {
  efectivo: number;
  bancos: number;
  total: number;
}

type AnyJson = any;

type DetalleAsiento = {
  cuenta_codigo?: string;
  cuentaCodigo?: string;

  debe?: number | string | null;
  haber?: number | string | null;

  // soportes comunes si el backend ya agrega totales
  totalDebe?: number | string | null;
  totalHaber?: number | string | null;
};

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data =
    json?.data ??
    json?.items ??
    json?.detalles ??
    json ??
    [];
  return Array.isArray(data) ? (data as T[]) : [];
};

const safeNumber = (v: any) => {
  if (v === null || v === undefined) return 0;
  // soporta "1,234.56"
  const s = String(v).replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const pickCuentaCodigo = (d: DetalleAsiento) =>
  String(d?.cuenta_codigo ?? d?.cuentaCodigo ?? "").trim();

const pickDebe = (d: DetalleAsiento) =>
  safeNumber(d?.debe ?? d?.totalDebe);

const pickHaber = (d: DetalleAsiento) =>
  safeNumber(d?.haber ?? d?.totalHaber);

export const useSaldosDisponibles = () => {
  return useQuery<SaldosDisponibles>({
    queryKey: ["saldos-disponibles"],
    queryFn: async () => {
      /**
       * Endpoint esperado:
       *   GET /api/asientos/detalle?cuentas=1001,1002
       *
       * Respuesta (cualquiera de estas):
       *   [{ cuenta_codigo|cuentaCodigo, debe|totalDebe, haber|totalHaber }]
       *   o { data: [...] } / { items: [...] } / { detalles: [...] }
       */
      const json: AnyJson = await apiFetch("/api/asientos/detalle?cuentas=1001,1002", {
        method: "GET",
      });

      const detalles = normalizeArray<DetalleAsiento>(json);

      let efectivo = 0;
      let bancos = 0;

      for (const d of detalles) {
        const codigo = pickCuentaCodigo(d);
        const debe = pickDebe(d);
        const haber = pickHaber(d);
        const saldo = debe - haber;

        if (codigo === "1001") efectivo += saldo;
        else if (codigo === "1002") bancos += saldo;
      }

      const ef = Math.max(0, efectivo);
      const ba = Math.max(0, bancos);

      return {
        efectivo: ef,
        bancos: ba,
        total: Math.max(0, ef + ba),
      };
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
