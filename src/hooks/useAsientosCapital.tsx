import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface DetalleAsiento {
  id: string;
  cuenta_codigo: string;
  debe: number;
  haber: number;
  descripcion: string;
  cuenta?: {
    nombre: string;
  };
}

interface AsientoCapital {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string;
  created_at: string;
  detalle_asientos: DetalleAsiento[];
}

type UseAsientosCapitalParams = {
  transaccionId?: string | null;
  asientoId?: string | null;
};

const toNumber = (v: unknown) => {
  const n =
    typeof v === "number"
      ? v
      : Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const useAsientosCapital = ({
  transaccionId,
  asientoId,
}: UseAsientosCapitalParams) => {
  return useQuery({
    queryKey: ["asientos-capital", transaccionId || null, asientoId || null],
    enabled: !!transaccionId || !!asientoId,
    queryFn: async (): Promise<AsientoCapital | null> => {
      let json: any = null;

      // 1) Si ya tenemos el ID real del asiento, usamos la ruta directa
      if (asientoId) {
        json = await apiFetch(`/api/asientos/${encodeURIComponent(asientoId)}`, {
          method: "GET",
        });
      }
      // 2) Fallback: buscar por transacción de capital
      else if (transaccionId) {
        json = await apiFetch(
          `/api/asientos/by-transaccion?source=capital&id=${encodeURIComponent(transaccionId)}`,
          { method: "GET" }
        );
      } else {
        return null;
      }

      const asientoRaw =
        json?.data ??
        json?.asiento ??
        json?.item ??
        json ??
        null;

      if (!asientoRaw) return null;

      const detallesRaw = Array.isArray(asientoRaw.detalle_asientos)
        ? asientoRaw.detalle_asientos
        : Array.isArray(asientoRaw.detalles)
          ? asientoRaw.detalles
          : [];

      const detalle_asientos: DetalleAsiento[] = detallesRaw.map((d: any, index: number) => ({
        id: String(
          d?.id ??
          `${asientoRaw.id || "asiento"}-${index}`
        ),
        cuenta_codigo: String(d?.cuenta_codigo ?? ""),
        debe: toNumber(d?.debe),
        haber: toNumber(d?.haber),
        descripcion: String(d?.descripcion ?? d?.memo ?? ""),
        cuenta: {
          nombre: String(
            d?.cuenta_nombre ??
            d?.cuenta?.nombre ??
            d?.cuenta_codigo ??
            ""
          ),
        },
      }));

      const asiento: AsientoCapital = {
        id: String(asientoRaw.id ?? ""),
        numero_asiento: String(
          asientoRaw.numero_asiento ??
          asientoRaw.numeroAsiento ??
          ""
        ),
        descripcion: String(
          asientoRaw.descripcion ??
          asientoRaw.concepto ??
          ""
        ),
        fecha: String(
          asientoRaw.asiento_fecha ??
          asientoRaw.fecha ??
          ""
        ),
        created_at: String(asientoRaw.created_at ?? ""),
        detalle_asientos,
      };

      return asiento;
    },
  });
};