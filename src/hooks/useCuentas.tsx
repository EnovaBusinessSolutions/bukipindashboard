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

const buildEstadosFinancieros = (cuentas: Cuenta[]): EstadosFinancieros => {
  const estadosFinancieros: EstadosFinancieros = {};

  for (const cuenta of cuentas) {
    const estado_financiero = cuenta.estado_financiero || "Sin estado";
    const grupo = cuenta.grupo || "Sin grupo";
    const subgrupo = cuenta.subgrupo || "Sin subgrupo";

    if (!estadosFinancieros[estado_financiero]) {
      estadosFinancieros[estado_financiero] = {};
    }

    if (!estadosFinancieros[estado_financiero][grupo]) {
      estadosFinancieros[estado_financiero][grupo] = {};
    }

    if (!estadosFinancieros[estado_financiero][grupo][subgrupo]) {
      estadosFinancieros[estado_financiero][grupo][subgrupo] = [];
    }

    estadosFinancieros[estado_financiero][grupo][subgrupo].push(cuenta);
  }

  return estadosFinancieros;
};

export const useCuentas = () => {
  return useQuery<UseCuentasResponse>({
    queryKey: ["cuentas"],
    queryFn: async () => {
      /**
       * Endpoint esperado:
       * GET /api/cuentas
       * Respuesta puede ser:
       *  - [{...}, {...}]
       *  - { ok: true, data: [{...}] }
       */
      const json = await apiFetch("/api/cuentas", { method: "GET" });
      const cuentasFlat: Cuenta[] = (json as any)?.data ?? (json as any) ?? [];

      // Orden defensivo (por si backend no ordena)
      cuentasFlat.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));

      const estadosFinancieros = buildEstadosFinancieros(cuentasFlat);

      return { estadosFinancieros, cuentasFlat };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
