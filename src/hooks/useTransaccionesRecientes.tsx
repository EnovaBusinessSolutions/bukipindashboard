import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface TransaccionIngreso {
  id: string;
  descripcion: string;
  monto_total: number;
  monto_neto: number;
  monto_descuento: number;
  tipo_ingreso: string;
  metodo_pago: string;
  tipo_pago: string;
  cuenta_principal_codigo: string;
  subcuenta_id: string | null;
  created_at: string;
  comentarios?: string | null;

  // ✅ en el frontend lo seguimos exponiendo igual
  asiento_fecha?: string | null;

  // ✅ FECHA LÍMITE / VENCIMIENTO (E2E)
  // canónico + aliases
  fechaLimite?: string | null;
  fecha_limite?: string | null;
  fecha_vencimiento?: string | null; // YYYY-MM-DD (para UI)
  fechaVencimiento?: string | null;

  subcuentas?: { nombre: string } | null;
  cuentas?: { nombre: string } | null;
}

type AnyJson = any;

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

function isDateOnlyYMD(v: any) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
}

/**
 * ✅ Resolver fecha límite robusto:
 * - acepta Date/ISO/YYY-MM-DD
 * - ignora "" (string vacío)
 * - devuelve YYYY-MM-DD o null
 */
function resolveFechaLimiteYMD(tx: any): string | null {
  const pickNonEmpty = (...vals: any[]) => {
    for (const v of vals) {
      if (v === null || v === undefined) continue;
      const s = String(v).trim();
      if (s) return v;
    }
    return null;
  };

  const raw = pickNonEmpty(
    tx?.fechaLimite,
    tx?.fecha_limite,
    tx?.fecha_vencimiento,
    tx?.fechaVencimiento,
    tx?.dueDate,
    tx?.due_date
  );

  if (!raw) return null;

  const s = String(raw).trim();
  if (isDateOnlyYMD(s)) return s;

  try {
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

export const useTransaccionesRecientes = (limit: number = 10) => {
  const [transacciones, setTransacciones] = useState<TransaccionIngreso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransacciones = async () => {
    try {
      setLoading(true);
      setError(null);

      const json: AnyJson = await apiFetch(
        `/api/transacciones/ingresos/recientes?limit=${encodeURIComponent(String(limit))}`,
        { method: "GET" }
      );

      const rows = normalizeArray<TransaccionIngreso>(json);

      const safeRows = rows.map((t: any) => {
        const fechaLimiteYMD = resolveFechaLimiteYMD(t);

        return {
          ...t,

          // ✅ compat asiento_fecha
          asiento_fecha:
            t.asiento_fecha ??
            (Array.isArray(t.asiento) && t.asiento.length > 0 ? t.asiento[0]?.fecha ?? null : null),

          // ✅ E2E fecha límite para UI
          // Guardamos canónico si viene en ISO / Date string
          fechaLimite: t.fechaLimite ?? t.fecha_limite ?? null,
          fecha_limite: t.fecha_limite ?? t.fechaLimite ?? null,

          // la UI del modal/resumen puede usar esto directo
          fecha_vencimiento: fechaLimiteYMD,
          fechaVencimiento: fechaLimiteYMD,
        };
      });

      setTransacciones(safeRows);
    } catch (err: any) {
      console.error("Error fetching transacciones recientes:", err);
      setError(err?.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchTransacciones();

    const intervalMs = 30_000; // 30s
    const timer = window.setInterval(() => {
      if (!mounted) return;
      fetchTransacciones();
    }, intervalMs);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  return { transacciones, loading, error, refetch: fetchTransacciones };
};