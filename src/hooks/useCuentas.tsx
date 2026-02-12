// bukipin-dashboard/src/hooks/useCuentas.tsx
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
    raw?.estado_financiero ??
      raw?.estadoFinanciero ??
      raw?.estado ??
      raw?.financial_state
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

/**
 * Desenvuelve respuestas tipo:
 * - {ok:true,data:[...]}
 * - {ok:true,data:{...}}
 * - {ok:true,data:{ok:true,data:[...]}}
 * - payload plano
 *
 * Lo hace en loop (máx 3 niveles) para que no falle si el backend envuelve varias veces.
 */
function unwrapDeep(input: any) {
  let cur = input;

  for (let i = 0; i < 3; i++) {
    if (!cur || typeof cur !== "object") break;
    if ("data" in cur) {
      const next = (cur as any).data;
      // si data viene null/undefined, ya no seguimos
      if (next == null) break;
      cur = next;
      continue;
    }
    break;
  }

  return cur;
}

function extractCuentasArray(payload: any): any[] {
  // payload puede ser array, objeto con cuentas, objeto con items, etc.
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  // casos típicos
  if (Array.isArray((payload as any).cuentas)) return (payload as any).cuentas;
  if (Array.isArray((payload as any).items)) return (payload as any).items;

  // si por alguna razón viene anidado
  if (Array.isArray((payload as any).data)) return (payload as any).data;
  if (Array.isArray((payload as any).data?.cuentas)) return (payload as any).data.cuentas;
  if (Array.isArray((payload as any).data?.items)) return (payload as any).data.items;

  return [];
}

function safeObject(obj: any): obj is Record<string, any> {
  return !!obj && typeof obj === "object" && !Array.isArray(obj);
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

      // ✅ unwrap profundo (por si viene envuelto más de una vez)
      const payload = unwrapDeep(json);

      // ✅ extraer array real (o [] si no se puede)
      const cuentasRaw = extractCuentasArray(payload);

      // ✅ blindaje definitivo: jamás map si no es array
      const cuentasFlat = Array.isArray(cuentasRaw) ? cuentasRaw.map(normalizeCuenta) : [];

      // Orden defensivo
      cuentasFlat.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));

      // estadosFinancieros: si backend manda algo utilizable, úsalo; si no, construir
      let estadosFinancieros: EstadosFinancieros | null = null;

      // puede venir en el payload o en json original (por wrappers raros)
      const ef1 = safeObject(payload) ? (payload as any).estadosFinancieros : null;
      const ef2 = safeObject(json) ? (json as any).estadosFinancieros : null;

      const candidate = safeObject(ef1) ? ef1 : safeObject(ef2) ? ef2 : null;

      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        estadosFinancieros = candidate as EstadosFinancieros;
      } else {
        estadosFinancieros = buildEstadosFinancieros(cuentasFlat);
      }

      return { estadosFinancieros, cuentasFlat };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
