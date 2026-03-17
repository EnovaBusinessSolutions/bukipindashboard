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
  cuenta_nombre?: string;
  memo?: string;
}

interface AsientoInversion {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string;
  created_at: string;
  detalle_asientos: DetalleAsiento[];
}

type AnyJson = any;

const normalizeDetalle = (d: any, idx: number): DetalleAsiento => ({
  id: String(d?.id ?? `${d?.cuenta_codigo ?? "detalle"}-${idx}`),
  cuenta_codigo: String(d?.cuenta_codigo ?? ""),
  debe: Number(d?.debe ?? 0) || 0,
  haber: Number(d?.haber ?? 0) || 0,
  descripcion: String(d?.descripcion ?? d?.memo ?? ""),
  cuenta: {
    nombre: String(
      d?.cuenta?.nombre ??
        d?.cuenta_nombre ??
        d?.cuenta_codigo ??
        "Cuenta"
    ),
  },
  cuenta_nombre: String(
    d?.cuenta?.nombre ??
      d?.cuenta_nombre ??
      d?.cuenta_codigo ??
      "Cuenta"
  ),
  memo: String(d?.memo ?? d?.descripcion ?? ""),
});

const normalizeAsiento = (a: any): AsientoInversion => ({
  id: String(a?.id ?? a?._id ?? ""),
  numero_asiento: String(
    a?.numero_asiento ?? a?.numeroAsiento ?? a?.numero ?? "Sin folio"
  ),
  descripcion: String(a?.descripcion ?? a?.concepto ?? ""),
  fecha: String(a?.fecha ?? a?.asiento_fecha ?? a?.created_at ?? ""),
  created_at: String(a?.created_at ?? a?.fecha ?? a?.asiento_fecha ?? ""),
  detalle_asientos: Array.isArray(a?.detalle_asientos)
    ? a.detalle_asientos.map((d: any, idx: number) => normalizeDetalle(d, idx))
    : [],
});

const extractAsientos = (json: AnyJson): AsientoInversion[] => {
  if (!json) return [];

  // Prioridad: si backend ya regresa colección explícita
  if (Array.isArray(json?.asientos)) {
    return json.asientos.map(normalizeAsiento).filter((a) => a.id);
  }

  // Compat envelope data
  if (Array.isArray(json?.data)) {
    return json.data.map(normalizeAsiento).filter((a) => a.id);
  }

  // Compat single item en data
  if (json?.data && typeof json.data === "object") {
    const one = normalizeAsiento(json.data);
    return one.id ? [one] : [];
  }

  // Compat single object root
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const one = normalizeAsiento(json);
    return one.id ? [one] : [];
  }

  return [];
};

const buildSourceCandidates = (tipoTransaccion?: string) => {
  if (tipoTransaccion === "baja") {
    return ["inversion_baja", "baja_inversion", "inversion"];
  }
  if (tipoTransaccion === "venta") {
    return ["inversion_venta", "venta_inversion", "inversion_baja", "inversion"];
  }
  return ["inversion", "capex", "inversion_alta"];
};

export const useAsientosInversion = (
  inversionId?: string,
  tipoTransaccion?: string
) => {
  return useQuery({
    queryKey: ["asientos-inversion", inversionId, tipoTransaccion],
    queryFn: async (): Promise<AsientoInversion[] | null> => {
      if (!inversionId) return null;

      const sourceCandidates = buildSourceCandidates(tipoTransaccion);

      // 1) Intentos dirigidos por source
      for (const source of sourceCandidates) {
        try {
          const json = await apiFetch(
            `/api/asientos/by-transaccion?source=${encodeURIComponent(
              source
            )}&id=${encodeURIComponent(inversionId)}`,
            { method: "GET" }
          );

          const asientos = extractAsientos(json);

          if (Array.isArray(asientos) && asientos.length > 0) {
            asientos.sort((a, b) =>
              a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
            );
            return asientos;
          }
        } catch {
          // seguimos con el siguiente source candidato
        }
      }

      // 2) Fallback sin source explícito
      try {
        const json = await apiFetch(
          `/api/asientos/by-transaccion?id=${encodeURIComponent(inversionId)}`,
          { method: "GET" }
        );

        const asientos = extractAsientos(json);

        if (Array.isArray(asientos) && asientos.length > 0) {
          asientos.sort((a, b) =>
            a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
          );
          return asientos;
        }
      } catch (err) {
        console.error("Error fetching asientos inversion:", err);
      }

      return null;
    },
    enabled: !!inversionId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};