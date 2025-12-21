import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface SaldosDisponibles {
  efectivo: number;
  bancos: number;
  total: number;
}

type AnyJson = any;

type DetalleAsiento = {
  cuenta_codigo: string; // "1001" | "1002"
  debe?: number | string | null;
  haber?: number | string | null;
};

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

const safeNumber = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const useSaldosDisponibles = () => {
  return useQuery<SaldosDisponibles>({
    queryKey: ["saldos-disponibles"],
    queryFn: async () => {
      /**
       * ✅ E2E: el backend debe filtrar por owner (req.user._id)
       * y regresar detalles de asientos SOLO de las cuentas solicitadas.
       *
       * Endpoint esperado:
       *   GET /api/asientos/detalle?cuentas=1001,1002
       *
       * Respuesta:
       *   [{ cuenta_codigo, debe, haber, ... }]
       *   o { data: [...] }
       */
      const json: AnyJson = await apiFetch("/api/asientos/detalle?cuentas=1001,1002", {
        method: "GET",
      });

      const detalles = normalizeArray<DetalleAsiento>(json);

      let efectivo = 0;
      let bancos = 0;

      for (const d of detalles) {
        const codigo = String(d.cuenta_codigo || "");
        const debe = safeNumber(d.debe);
        const haber = safeNumber(d.haber);
        const saldo = debe - haber;

        if (codigo === "1001") efectivo += saldo;
        else if (codigo === "1002") bancos += saldo;
      }

      return {
        efectivo: Math.max(0, efectivo),
        bancos: Math.max(0, bancos),
        total: Math.max(0, efectivo + bancos),
      };
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
