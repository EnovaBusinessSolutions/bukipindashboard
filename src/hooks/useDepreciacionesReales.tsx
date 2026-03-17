import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type DepreciacionesRealesResult = {
  depreciacionesPorInversion: Record<string, number>;
  periodosRegistrados: Record<string, Set<string>>;
};

type AnyJson = any;

const normalizeArray = (json: AnyJson): any[] => {
  const data = json?.data ?? json?.items ?? json ?? [];
  return Array.isArray(data) ? data : [];
};

const toNumber = (value: any) => {
  const n =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const toYYYYMM = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const extractInversionId = (asiento: any): string | null => {
  const direct =
    asiento?.inversion_id ??
    asiento?.inversionId ??
    asiento?.sourceId ??
    asiento?.transaccionId ??
    null;

  if (direct) return String(direct);

  if (Array.isArray(asiento?.references)) {
    const ref = asiento.references.find((r: any) =>
      ["inversion", "capex"].includes(String(r?.source || "").toLowerCase())
    );
    if (ref?.id) return String(ref.id);
  }

  const numero = String(
    asiento?.numero_asiento ?? asiento?.numeroAsiento ?? asiento?.numero ?? ""
  ).trim();

  const match = numero.match(/DEP-([a-f0-9-]+)-(\d{6})/i);
  if (match?.[1]) return match[1];

  return null;
};

const extractPeriodo = (asiento: any): string | null => {
  const explicit =
    asiento?.periodo ??
    asiento?.mes_ano ??
    asiento?.mesAno ??
    null;

  if (explicit && /^\d{6}$/.test(String(explicit))) {
    return String(explicit);
  }

  const numero = String(
    asiento?.numero_asiento ?? asiento?.numeroAsiento ?? asiento?.numero ?? ""
  ).trim();

  const match = numero.match(/DEP-[a-f0-9-]+-(\d{6})/i);
  if (match?.[1]) return match[1];

  return toYYYYMM(
    asiento?.fecha ??
      asiento?.asiento_fecha ??
      asiento?.created_at ??
      asiento?.createdAt ??
      null
  );
};

const extractMontoDepreciacion = (asiento: any) => {
  const detalles = Array.isArray(asiento?.detalle_asientos)
    ? asiento.detalle_asientos
    : Array.isArray(asiento?.detalles)
      ? asiento.detalles
      : [];

  const monto5109 = detalles
    .filter((d: any) => String(d?.cuenta_codigo ?? "") === "5109")
    .reduce((sum: number, d: any) => sum + toNumber(d?.debe), 0);

  if (monto5109 > 0) return monto5109;

  const totalDebe = detalles.reduce(
    (sum: number, d: any) => sum + toNumber(d?.debe),
    0
  );

  return totalDebe;
};

const pareceDepreciacion = (asiento: any) => {
  const numero = String(
    asiento?.numero_asiento ?? asiento?.numeroAsiento ?? asiento?.numero ?? ""
  ).toLowerCase();

  const descripcion = String(
    asiento?.descripcion ?? asiento?.concepto ?? ""
  ).toLowerCase();

  const source = String(asiento?.source ?? "").toLowerCase();

  return (
    numero.includes("dep") ||
    descripcion.includes("depreci") ||
    source.includes("depreci")
  );
};

export const useDepreciacionesReales = () => {
  return useQuery({
    queryKey: ["depreciaciones-reales"],
    queryFn: async (): Promise<DepreciacionesRealesResult> => {
      try {
        const json = await apiFetch("/api/asientos/depreciaciones", {
          method: "GET",
        });

        const asientos = normalizeArray(json);

        const depreciacionesPorInversion: Record<string, number> = {};
        const periodosRegistrados: Record<string, Set<string>> = {};

        asientos.forEach((asiento: any) => {
          if (!pareceDepreciacion(asiento)) return;

          const inversionId = extractInversionId(asiento);
          const periodoYYYYMM = extractPeriodo(asiento);

          if (!inversionId || !periodoYYYYMM) return;

          const montoDepreciacion = extractMontoDepreciacion(asiento);

          depreciacionesPorInversion[inversionId] =
            (depreciacionesPorInversion[inversionId] || 0) + montoDepreciacion;

          if (!periodosRegistrados[inversionId]) {
            periodosRegistrados[inversionId] = new Set<string>();
          }

          periodosRegistrados[inversionId].add(periodoYYYYMM);
        });

        return { depreciacionesPorInversion, periodosRegistrados };
      } catch (error) {
        console.error("Error fetching depreciaciones reales:", error);
        return { depreciacionesPorInversion: {}, periodosRegistrados: {} };
      }
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};