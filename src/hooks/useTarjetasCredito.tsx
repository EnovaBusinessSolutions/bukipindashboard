import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface TarjetaCredito {
  id: string;
  nombre: string;
  institucion_financiera: string;
  monto_total: number;
  saldo_actual: number;
  limite_disponible: number;
}

type AnyJson = any;

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

const toNumber = (v: any) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};

export const useTarjetasCredito = () => {
  return useQuery<TarjetaCredito[]>({
    queryKey: ["tarjetas-credito"],
    queryFn: async () => {
      /**
       * ✅ Backend esperado:
       *   GET /api/financiamientos/tarjetas-credito
       * Respuesta:
       *   [{ id, nombre, institucion_financiera, monto_total, saldo_actual, ... }]
       *   o { data: [...] }
       */
      const json: AnyJson = await apiFetch("/api/financiamientos/tarjetas-credito", {
        method: "GET",
      });

      const items = normalizeArray<any>(json);

      // Calcular límite disponible para cada tarjeta (si no viene)
      const tarjetas: TarjetaCredito[] = items.map((t: any) => {
        const monto_total = toNumber(t.monto_total);
        const saldo_actual = toNumber(t.saldo_actual);

        const limite_disponible =
          typeof t.limite_disponible === "number" || t.limite_disponible != null
            ? toNumber(t.limite_disponible)
            : monto_total - saldo_actual;

        return {
          id: String(t.id),
          nombre: String(t.nombre ?? ""),
          institucion_financiera: String(t.institucion_financiera ?? ""),
          monto_total,
          saldo_actual,
          limite_disponible,
        };
      });

      // si backend no ordena, aquí los ordenamos por "created_at" desc si existe
      tarjetas.sort((a: any, b: any) => {
        const da = String((a as any)?.created_at ?? "");
        const db = String((b as any)?.created_at ?? "");
        return db.localeCompare(da);
      });

      return tarjetas;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

export const validarLimiteCredito = (
  tarjetaId: string,
  montoTransaccion: number,
  tarjetas: TarjetaCredito[]
) => {
  const tarjeta = tarjetas.find((t) => t.id === tarjetaId);

  if (!tarjeta) {
    return {
      valido: false,
      mensaje: "Tarjeta de crédito no encontrada",
    };
  }

  if (montoTransaccion > tarjeta.limite_disponible) {
    return {
      valido: false,
      mensaje: `Límite de crédito excedido. Disponible: $${tarjeta.limite_disponible.toFixed(
        2
      )} / Solicitado: $${montoTransaccion.toFixed(2)}`,
    };
  }

  return {
    valido: true,
    mensaje: "Límite de crédito válido",
  };
};
