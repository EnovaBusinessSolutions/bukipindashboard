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
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};

const toISODate = (d: Date) => d.toISOString().split("T")[0];

/**
 * ✅ Backend esperado:
 *   GET /api/egresos/transacciones?estado=activo&limit=...&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Respuesta puede ser:
 *   - payload plano: [...]
 *   - o { ok:true, data:[...] }
 */
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

      // Aplicar filtros de fecha según período
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
        // si no hay filtro, respetamos limit como antes
        params.set("limit", String(limit));
      }

      const json: AnyJson = await apiFetch(`/api/egresos/transacciones?${params.toString()}`, {
        method: "GET",
      });

      const items = normalizeArray<any>(json);

      // Normalización mínima de números/shape
      const mapped: TransaccionEgreso[] = items.map((t: any) => ({
        id: String(t.id),
        tipo_egreso: String(t.tipo_egreso ?? ""),
        subtipo_egreso: t.subtipo_egreso != null ? String(t.subtipo_egreso) : null,
        descripcion: String(t.descripcion ?? ""),
        concepto: t.concepto != null ? String(t.concepto) : null,
        monto_total: toNumber(t.monto_total),
        monto_pagado: toNumber(t.monto_pagado),
        monto_pendiente: toNumber(t.monto_pendiente),
        tipo_pago: String(t.tipo_pago ?? ""),
        metodo_pago: t.metodo_pago != null ? String(t.metodo_pago) : null,
        proveedor_nombre: t.proveedor_nombre != null ? String(t.proveedor_nombre) : null,
        cantidad: t.cantidad != null ? toNumber(t.cantidad) : null,
        precio_unitario: t.precio_unitario != null ? toNumber(t.precio_unitario) : null,
        created_at: String(t.created_at ?? ""),
        comentarios: t.comentarios != null ? String(t.comentarios) : null,
        fecha_vencimiento: t.fecha_vencimiento != null ? String(t.fecha_vencimiento) : null,
        imagen_comprobante: t.imagen_comprobante != null ? String(t.imagen_comprobante) : null,
        cuenta_codigo: t.cuenta_codigo != null ? String(t.cuenta_codigo) : null,
        subcuenta_id: t.subcuenta_id != null ? String(t.subcuenta_id) : null,
        estado: String(t.estado ?? "activo"),
      }));

      // Orden por created_at desc (por si backend no lo hace)
      mapped.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return mapped;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
