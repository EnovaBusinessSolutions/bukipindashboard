import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface TransaccionEgreso {
  id: string;
  tipo_egreso: string;
  subtipo_egreso: string | null;
  descripcion: string;
  concepto: string | null;

  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;

  tipo_pago: string;
  metodo_pago: string | null;

  proveedor_nombre: string | null;

  cantidad: number | null;
  precio_unitario: number | null;

  created_at: string;

  comentarios: string | null;
  fecha_vencimiento: string | null;

  imagen_comprobante: string | null;

  cuenta_codigo: string | null;
  subcuenta_id: string | null;

  estado: string;
}

type AnyJson = any;

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

const toNumber = (v: any) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const toISODate = (d: Date) => d.toISOString().split("T")[0];

const pick = <T = any>(obj: any, keys: string[], fallback: T): T => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return fallback;
};

const normalizeTx = (t: any): TransaccionEgreso => {
  const id = String(pick(t, ["id", "_id"], ""));

  const createdAt = String(
    pick(t, ["created_at", "createdAt", "fecha", "date"], "")
  );

  const montoTotal = toNumber(pick(t, ["monto_total", "montoTotal", "total"], 0));
  const montoPagado = toNumber(pick(t, ["monto_pagado", "montoPagado"], 0));
  const montoPendiente = toNumber(pick(t, ["monto_pendiente", "montoPendiente"], Math.max(montoTotal - montoPagado, 0)));

  return {
    id,
    tipo_egreso: String(pick(t, ["tipo_egreso", "tipoEgreso", "tipo"], "")),
    subtipo_egreso: pick(t, ["subtipo_egreso", "subtipoEgreso"], null) != null ? String(pick(t, ["subtipo_egreso", "subtipoEgreso"], "")) : null,

    descripcion: String(pick(t, ["descripcion", "concepto", "descripcionEgreso"], "")),
    concepto: pick(t, ["concepto"], null) != null ? String(pick(t, ["concepto"], "")) : null,

    monto_total: montoTotal,
    monto_pagado: montoPagado,
    monto_pendiente: montoPendiente,

    tipo_pago: String(pick(t, ["tipo_pago", "tipoPago"], "")),
    metodo_pago: pick(t, ["metodo_pago", "metodoPago"], null) != null ? String(pick(t, ["metodo_pago", "metodoPago"], "")) : null,

    proveedor_nombre:
      pick(t, ["proveedor_nombre", "proveedorNombre"], null) != null
        ? String(pick(t, ["proveedor_nombre", "proveedorNombre"], ""))
        : null,

    cantidad: pick(t, ["cantidad"], null) != null ? toNumber(pick(t, ["cantidad"], 0)) : null,
    precio_unitario:
      pick(t, ["precio_unitario", "precioUnitario"], null) != null
        ? toNumber(pick(t, ["precio_unitario", "precioUnitario"], 0))
        : null,

    created_at: createdAt,

    comentarios: pick(t, ["comentarios"], null) != null ? String(pick(t, ["comentarios"], "")) : null,
    fecha_vencimiento:
      pick(t, ["fecha_vencimiento", "fechaVencimiento"], null) != null
        ? String(pick(t, ["fecha_vencimiento", "fechaVencimiento"], ""))
        : null,

    imagen_comprobante:
      pick(t, ["imagen_comprobante", "imagenComprobante"], null) != null
        ? String(pick(t, ["imagen_comprobante", "imagenComprobante"], ""))
        : null,

    cuenta_codigo: pick(t, ["cuenta_codigo", "cuentaCodigo"], null) != null ? String(pick(t, ["cuenta_codigo", "cuentaCodigo"], "")) : null,
    subcuenta_id: pick(t, ["subcuenta_id", "subcuentaId"], null) != null ? String(pick(t, ["subcuenta_id", "subcuentaId"], "")) : null,

    estado: String(pick(t, ["estado"], "activo")),
  };
};

/**
 * Intenta endpoints en orden (para compat E2E)
 */
const fetchWithFallback = async (paths: string[]) => {
  let lastErr: any = null;

  for (const path of paths) {
    try {
      const json = await apiFetch(path, { method: "GET" });
      return json;
    } catch (e: any) {
      lastErr = e;
      // Si NO es 404, conviene parar (auth/500)
      if (e?.status && e.status !== 404) throw e;
    }
  }

  throw lastErr ?? new Error("No se pudo consultar endpoints de egresos");
};

export const useTransaccionesEgresos = (
  limit: number = 1000,
  periodFilter?: "diario" | "mensual" | "anual",
  fechaDiaria?: Date,
  fechaMensual?: Date
) => {
  return useQuery({
    queryKey: ["transacciones-egresos", limit, periodFilter, fechaDiaria, fechaMensual],
    queryFn: async (): Promise<TransaccionEgreso[]> => {
      const params = new URLSearchParams();
      params.set("estado", "activo");

      // filtros de fecha
      if (periodFilter === "diario" && fechaDiaria) {
        const d = toISODate(fechaDiaria);
        params.set("start", d);
        params.set("end", d);
      } else if (periodFilter === "mensual" && fechaMensual) {
        const year = fechaMensual.getFullYear();
        const month = fechaMensual.getMonth();
        const firstDay = toISODate(new Date(year, month, 1));
        const lastDay = toISODate(new Date(year, month + 1, 0));
        params.set("start", firstDay);
        params.set("end", lastDay);
      } else if (periodFilter === "anual") {
        const year = new Date().getFullYear();
        params.set("start", `${year}-01-01`);
        params.set("end", `${year}-12-31`);
      } else {
        params.set("limit", String(limit));
      }

      const qs = params.toString();

      // ✅ Endpoints a intentar (orden: preferido → fallback)
      const candidates = [
        `/api/egresos/transacciones?${qs}`,              // el que esperabas
        `/api/egresos?${qs}`,                           // fallback común (si montaste router como /api/egresos)
        `/api/expense-transactions?${qs}`,              // fallback común (si tu backend quedó con nombre literal)
      ];

      const json: AnyJson = await fetchWithFallback(candidates);
      const items = normalizeArray<any>(json);

      const mapped = items.map(normalizeTx);

      // ordenar desc por fecha
      mapped.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      return mapped;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
