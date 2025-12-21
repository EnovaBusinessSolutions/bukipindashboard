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

  subcuentas?: { nombre: string } | null;
  cuentas?: { nombre: string } | null;
}

type AnyJson = any;

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

export const useTransaccionesRecientes = (limit: number = 10) => {
  const [transacciones, setTransacciones] = useState<TransaccionIngreso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransacciones = async () => {
    try {
      setLoading(true);
      setError(null);

      /**
       * ✅ Backend esperado (canonical):
       * GET /api/transacciones/ingresos/recientes?limit=10
       *
       * Debe devolver:
       * [
       *  { ...transaccion, asiento_fecha, subcuentas?, cuentas? }
       * ]
       * o { ok:true, data:[...] }
       */
      const json: AnyJson = await apiFetch(
        `/api/transacciones/ingresos/recientes?limit=${encodeURIComponent(String(limit))}`,
        { method: "GET" }
      );

      const rows = normalizeArray<TransaccionIngreso>(json);

      // Si backend aún no manda asiento_fecha, soportamos compat:
      const safeRows = rows.map((t: any) => ({
        ...t,
        asiento_fecha:
          t.asiento_fecha ??
          (Array.isArray(t.asiento) && t.asiento.length > 0 ? t.asiento[0]?.fecha ?? null : null),
      }));

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

    
    // Si no lo quieres, ponlo en null o comenta este bloque.
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
