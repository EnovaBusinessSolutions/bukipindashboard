// bukipin-dashboard/src/hooks/useCuentas.ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type Cuenta = {
  codigo: string;
  nombre: string;
  estado_financiero: string;
  grupo: string;
  subgrupo: string;
};

export type EstadosFinancieros = {
  [estado_financiero: string]: {
    [grupo: string]: {
      [subgrupo: string]: Cuenta[];
    };
  };
};

type UseCuentasResponse = {
  estadosFinancieros: EstadosFinancieros;
  cuentasFlat: Cuenta[];
};

// ---------- helpers ----------
const normStr = (v: any) => String(v ?? "").trim();

const normalizeCuenta = (raw: any): Cuenta => {
  const codigo = normStr(
    raw?.codigo ??
      raw?.cuenta_codigo ??
      raw?.accountCodigo ??
      raw?.account_code ??
      raw?.code
  );

  const nombre = normStr(
    raw?.nombre ??
      raw?.cuenta_nombre ??
      raw?.accountNombre ??
      raw?.account_name ??
      raw?.name
  );

  const estado_financiero = normStr(
    raw?.estado_financiero ?? raw?.estadoFinanciero ?? raw?.estado ?? raw?.financial_state
  );

  const grupo = normStr(raw?.grupo ?? raw?.group);
  const subgrupo = normStr(raw?.subgrupo ?? raw?.subgroup);

  return {
    codigo,
    nombre,
    estado_financiero: estado_financiero || "Sin estado",
    grupo: grupo || "Sin grupo",
    subgrupo: subgrupo || "Sin subgrupo",
  };
};

const buildEstadosFinancieros = (cuentas: Cuenta[]): EstadosFinancieros => {
  const estadosFinancieros: EstadosFinancieros = {};

  for (const cuenta of cuentas) {
    const estado_financiero = cuenta.estado_financiero || "Sin estado";
    const grupo = cuenta.grupo || "Sin grupo";
    const subgrupo = cuenta.subgrupo || "Sin subgrupo";

    if (!estadosFinancieros[estado_financiero]) estadosFinancieros[estado_financiero] = {};
    if (!estadosFinancieros[estado_financiero][grupo]) estadosFinancieros[estado_financiero][grupo] = {};
    if (!estadosFinancieros[estado_financiero][grupo][subgrupo]) estadosFinancieros[estado_financiero][grupo][subgrupo] = [];

    estadosFinancieros[estado_financiero][grupo][subgrupo].push(cuenta);
  }

  return estadosFinancieros;
};

function extractCuentasArray(payload: any): any[] {
  // payload ya viene normalizado a (json.data ?? json)
  if (Array.isArray(payload)) return payload;

  // casos típicos
  if (Array.isArray(payload?.cuentas)) return payload.cuentas;
  if (Array.isArray(payload?.items)) return payload.items;

  // si por alguna razón viene anidado
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.cuentas)) return payload.data.cuentas;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;

  return [];
}

// ---------- hook ----------
export const useCuentas = () => {
  return useQuery<UseCuentasResponse>({
    queryKey: ["cuentas"],
    queryFn: async () => {
      /**
       * Endpoint real:
       * GET /api/cuentas
       *
       * Shapes posibles:
       * - [{...}]
       * - { ok:true, data:[...] }
       * - { ok:true, data:{ cuentas:[...] } }
       * - { cuentas:[...] }
       */
      const json = await apiFetch("/api/cuentas", { method: "GET" });

      const payload = (json as any)?.data ?? json; // normalización estándar Bukipin
      const cuentasRaw = extractCuentasArray(payload);

      const cuentasFlat = cuentasRaw.map(normalizeCuenta);

      // Orden defensivo
      cuentasFlat.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));

      // Si backend ya manda estadosFinancieros, úsalo; si no, constrúyelo
      const estadosFinancieros: EstadosFinancieros =
        (payload?.estadosFinancieros && typeof payload.estadosFinancieros === "object")
          ? payload.estadosFinancieros
          : buildEstadosFinancieros(cuentasFlat);

      return { estadosFinancieros, cuentasFlat };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
