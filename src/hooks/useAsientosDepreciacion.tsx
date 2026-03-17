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

interface AsientoDepreciacion {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string;
  created_at?: string;
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

const normalizeAsiento = (a: any): AsientoDepreciacion => ({
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

const extractAsientos = (json: AnyJson): AsientoDepreciacion[] => {
  if (!json) return [];

  if (Array.isArray(json?.asientos)) {
    return json.asientos.map(normalizeAsiento).filter((a) => a.id);
  }

  if (Array.isArray(json?.data)) {
    return json.data.map(normalizeAsiento).filter((a) => a.id);
  }

  if (json?.data && typeof json.data === "object") {
    const one = normalizeAsiento(json.data);
    return one.id ? [one] : [];
  }

  if (json && typeof json === "object" && !Array.isArray(json)) {
    const one = normalizeAsiento(json);
    return one.id ? [one] : [];
  }

  return [];
};

const sortAsientosDesc = (rows: AsientoDepreciacion[]) => {
  rows.sort((a, b) =>
    (a.created_at || a.fecha || "") < (b.created_at || b.fecha || "")
      ? 1
      : (a.created_at || a.fecha || "") > (b.created_at || b.fecha || "")
        ? -1
        : 0
  );
  return rows;
};

export const useAsientosDepreciacion = (inversionId?: string) => {
  return useQuery({
    queryKey: ["asientos-depreciacion", inversionId],
    queryFn: async (): Promise<AsientoDepreciacion[]> => {
      if (!inversionId) return [];

      const sourceCandidates = [
        "depreciacion_inversion",
        "inversion_depreciacion",
      ];

      const encontrados: AsientoDepreciacion[] = [];

      // 1) Intentos por source explícito
      for (const source of sourceCandidates) {
        try {
          const json = await apiFetch(
            `/api/asientos/by-transaccion?source=${encodeURIComponent(
              source
            )}&id=${encodeURIComponent(inversionId)}&include_all=1`,
            { method: "GET" }
          );

          const asientos = extractAsientos(json);
          if (Array.isArray(asientos) && asientos.length > 0) {
            encontrados.push(...asientos);
          }
        } catch {
          // seguimos intentando
        }
      }

      // 2) Fallback por id sin source, por si backend lo encuentra por references/sourceId/transaccionId
      if (encontrados.length === 0) {
        try {
          const json = await apiFetch(
            `/api/asientos/by-transaccion?id=${encodeURIComponent(
              inversionId
            )}&include_all=1`,
            { method: "GET" }
          );

          const asientos = extractAsientos(json);
          if (Array.isArray(asientos) && asientos.length > 0) {
            encontrados.push(...asientos);
          }
        } catch (err) {
          console.error("Error fetching asientos depreciacion:", err);
        }
      }

      // 3) Filtrado best-effort para quedarnos con asientos que parezcan de depreciación
      const filtrados = encontrados.filter((a) => {
        const numero = String(a.numero_asiento || "").toLowerCase();
        const descripcion = String(a.descripcion || "").toLowerCase();

        return (
          numero.includes("dep") ||
          descripcion.includes("depreci")
        );
      });

      // 4) Deduplicar por id
      const uniqueMap = new Map<string, AsientoDepreciacion>();
      (filtrados.length > 0 ? filtrados : encontrados).forEach((a) => {
        if (a.id) uniqueMap.set(a.id, a);
      });

      return sortAsientosDesc(Array.from(uniqueMap.values()));
    },
    enabled: !!inversionId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};