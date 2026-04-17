// bukipin-dashboard/src/hooks/useDepositosGarantia.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TipoDeposito = "recibido" | "realizado";

export interface DepositoGarantia {
  id: string;
  tipo: TipoDeposito;
  entidad_nombre: string;
  entidad_rfc: string;
  entidad_tipo: "empresa" | "persona";
  saldo_actual: number;
  fecha_inicio: string | null;
  referencia: string;
  estado: "activo" | "liquidado";
  created_at: string | null;
}

export interface DepositoMovimiento {
  id: string;
  deposito_id: string;
  entidad_nombre: string;
  tipo_movimiento: "nuevo" | "aumento" | "disminucion" | "devolucion" | "liquidacion";
  monto: number;
  monto_con_signo: number;
  metodo_pago: "caja" | "bancos";
  fecha: string | null;
  referencia: string;
  created_at: string | null;
}

export interface ResumenDepositos {
  total_saldo: number;
  total_entidades: number;
  total_movimientos: number;
}

export interface NuevoDepositoPayload {
  tipo: TipoDeposito;
  entidad_nombre: string;
  entidad_rfc?: string;
  entidad_tipo?: "empresa" | "persona";
  monto_inicial: number;
  metodo_pago?: "caja" | "bancos";
  fecha?: string;
  referencia?: string;
}

export interface NuevoMovimientoPayload {
  tipo_movimiento: "aumento" | "disminucion" | "devolucion" | "liquidacion";
  monto: number;
  metodo_pago?: "caja" | "bancos";
  fecha?: string;
  referencia?: string;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export const useDepositosResumen = () => {
  return useQuery({
    queryKey: ["depositos-garantia-resumen"],
    queryFn: async () => {
      const json = await apiFetch("/api/depositos-garantia/resumen", { method: "GET" });
      const data = json?.data ?? json ?? {};
      return {
        recibidos: (data.recibidos ?? {}) as ResumenDepositos,
        realizados: (data.realizados ?? {}) as ResumenDepositos,
      };
    },
    staleTime: 30_000,
  });
};

export const useDepositos = (tipo: TipoDeposito, estado: "activo" | "liquidado" | "todos" = "activo") => {
  return useQuery({
    queryKey: ["depositos-garantia", tipo, estado],
    queryFn: async () => {
      const json = await apiFetch(`/api/depositos-garantia?tipo=${tipo}&estado=${estado}`, { method: "GET" });
      const raw = json?.data ?? json ?? [];
      return Array.isArray(raw) ? (raw as DepositoGarantia[]) : [];
    },
    staleTime: 30_000,
  });
};

export const useDepositoDetalle = (id: string | null) => {
  return useQuery({
    queryKey: ["depositos-garantia-detalle", id],
    queryFn: async () => {
      const json = await apiFetch(`/api/depositos-garantia/${id}`, { method: "GET" });
      return json?.data ?? json ?? null;
    },
    enabled: !!id,
    staleTime: 15_000,
  });
};

export const useDepositosMovimientos = (tipo?: TipoDeposito) => {
  return useQuery({
    queryKey: ["depositos-garantia-movimientos", tipo ?? "todos"],
    queryFn: async () => {
      const url = tipo
        ? `/api/depositos-garantia/movimientos?tipo=${tipo}`
        : "/api/depositos-garantia/movimientos";
      const json = await apiFetch(url, { method: "GET" });
      const raw = json?.data ?? json ?? [];
      const totales = json?.totales ?? { entradas: 0, salidas: 0, neto: 0 };
      return { movimientos: Array.isArray(raw) ? (raw as DepositoMovimiento[]) : [], totales };
    },
    staleTime: 30_000,
  });
};

export const useDepositosAnalitica = (tipo: TipoDeposito) => {
  return useQuery({
    queryKey: ["depositos-garantia-analitica", tipo],
    queryFn: async () => {
      const json = await apiFetch(`/api/depositos-garantia/analitica?tipo=${tipo}`, { method: "GET" });
      const raw = json?.data ?? json ?? [];
      return Array.isArray(raw) ? raw : [];
    },
    staleTime: 30_000,
  });
};

export const useDepositosMutations = () => {
  const qc = useQueryClient();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["depositos-garantia"] });
    qc.invalidateQueries({ queryKey: ["depositos-garantia-resumen"] });
    qc.invalidateQueries({ queryKey: ["depositos-garantia-movimientos"] });
    qc.invalidateQueries({ queryKey: ["depositos-garantia-analitica"] });
    qc.invalidateQueries({ queryKey: ["depositos-garantia-detalle"] });
  };

  const crearDeposito = useMutation({
    mutationFn: async (payload: NuevoDepositoPayload) => {
      const json = await apiFetch("/api/depositos-garantia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!json?.ok) throw new Error(json?.message || "Error al crear depósito");
      return json.data;
    },
    onSuccess: invalidateAll,
  });

  const agregarMovimiento = useMutation({
    mutationFn: async ({ depositoId, payload }: { depositoId: string; payload: NuevoMovimientoPayload }) => {
      const json = await apiFetch(`/api/depositos-garantia/${depositoId}/movimiento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!json?.ok) throw new Error(json?.message || "Error al registrar movimiento");
      return json.data;
    },
    onSuccess: invalidateAll,
  });

  return { crearDeposito, agregarMovimiento };
};
