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

  totalDebe?: number | string | null;
  totalHaber?: number | string | null;

  // ✅ si el backend ya manda saldo por cuenta
  saldo?: number | string | null;
};

const safeNumber = (v: any) => {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const pickCuentaCodigo = (d: DetalleAsiento) =>
  String(d?.cuenta_codigo ?? d?.cuentaCodigo ?? "").trim();

const pickDebe = (d: DetalleAsiento) => safeNumber(d?.debe ?? d?.totalDebe);
const pickHaber = (d: DetalleAsiento) => safeNumber(d?.haber ?? d?.totalHaber);

const normalizeDetalles = (json: AnyJson): DetalleAsiento[] => {
  const root = json?.data ?? json;

  // 1) ya viene como array directo
  if (Array.isArray(root)) return root as DetalleAsiento[];

  // 2) wrappers típicos
  const maybeArr = root?.items ?? root?.detalles ?? root?.rows ?? root?.data;
  if (Array.isArray(maybeArr)) return maybeArr as DetalleAsiento[];

  // 3) shape por cuenta: { saldos: { "1001": {...}, "1002": {...} } }
  const saldosObj = root?.saldos ?? root?.balances ?? root?.byAccount;
  if (saldosObj && typeof saldosObj === "object" && !Array.isArray(saldosObj)) {
    return Object.entries(saldosObj).map(([codigo, v]: any) => ({
      cuentaCodigo: String(codigo),
      debe: v?.debe ?? v?.totalDebe ?? 0,
      haber: v?.haber ?? v?.totalHaber ?? 0,
      saldo: v?.saldo ?? null,
    }));
  }

  // 4) nada usable
  return [];
};

export const useSaldosDisponibles = () => {
  return useQuery<SaldosDisponibles>({
    queryKey: ["saldos-disponibles"],
    queryFn: async () => {
      /**
       * Endpoint esperado:
       *   GET /api/asientos/detalle?cuentas=1001,1002
       *
       * Soporta respuestas:
       *   - Array: [{ cuentaCodigo|cuenta_codigo, debe|totalDebe, haber|totalHaber, saldo? }]
       *   - Wrapper: { data: [...] } / { items: [...] } / { detalles: [...] }
       *   - Objeto: { saldos: { "1001": {debe,haber|saldo}, "1002": {...} } }
       */
      const json: AnyJson = await apiFetch(
        "/api/asientos/detalle?cuentas=1001,1002",
        { method: "GET" }
      );

      const detalles = normalizeDetalles(json);

      let efectivo = 0;
      let bancos = 0;

      for (const d of detalles) {
        const codigo = pickCuentaCodigo(d);
        if (!codigo) continue;

        // ✅ si backend manda saldo, úsalo; si no, calcula debe-haber
        const saldo =
          d?.saldo !== undefined && d?.saldo !== null
            ? safeNumber(d.saldo)
            : pickDebe(d) - pickHaber(d);

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
