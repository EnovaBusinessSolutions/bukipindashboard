import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface ProveedorStats {
  totalProveedores: number;
  proveedoresActivos: number;
  totalTransacciones: number;
  montoTotalGastado: number;
  topProveedores: Array<{
    proveedor_id: string;
    proveedor_nombre: string;
    total_transacciones: number;
    monto_total: number;
  }>;
}

type AnyJson = any;

const apiJson = async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
  const res: AnyJson = await apiFetch(url, init);
  return (res?.data ?? res) as T;
};

export const useProveedoresAnalytics = () => {
  const [stats, setStats] = useState<ProveedorStats>({
    totalProveedores: 0,
    proveedoresActivos: 0,
    totalTransacciones: 0,
    montoTotalGastado: 0,
    topProveedores: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);

      /**
       * ✅ Endpoint recomendado (E2E):
       * GET /api/proveedores/analytics
       * Respuesta:
       * {
       *   totalProveedores,
       *   proveedoresActivos,
       *   totalTransacciones,
       *   montoTotalGastado,
       *   topProveedores: [{ proveedor_id, proveedor_nombre, total_transacciones, monto_total }]
       * }
       *
       * Debe venir filtrado por owner (req.user._id)
       */
      const data = await apiJson<ProveedorStats>("/api/proveedores/analytics", { method: "GET" });

      setStats({
        totalProveedores: Number(data?.totalProveedores) || 0,
        proveedoresActivos: Number(data?.proveedoresActivos) || 0,
        totalTransacciones: Number(data?.totalTransacciones) || 0,
        montoTotalGastado: Number(data?.montoTotalGastado) || 0,
        topProveedores: Array.isArray(data?.topProveedores) ? data.topProveedores : [],
      });
    } catch (error) {
      console.error("Error fetching provider stats:", error);
      // Mantener stats actuales; loading se apaga
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
  }, []);

  return { stats, loading, refetch: fetchStats };
};
