import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface Proveedor {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  rfc: string | null;
  direccion: string | null;
  ciudad: string | null;
  estado: string | null;
  codigo_postal: string | null;
  activo: boolean;
  created_at: string;
}

type AnyJson = any;

const apiJson = async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
  const res: AnyJson = await apiFetch(url, init);
  return (res?.data ?? res) as T;
};

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

type ProveedorUpsert = Omit<Proveedor, "id" | "created_at" | "activo">;

const mapBackendError = (err: any): string => {
  // Nuestra convención recomendada: backend devuelve { error: { code, message } } o { message }
  const code = err?.error?.code ?? err?.code;
  const message = err?.error?.message ?? err?.message;

  // Si tu backend implementa conflictos como 409 con codes:
  if (code === "DUPLICATE_RFC") return "Ya existe un proveedor con este RFC";
  if (code === "DUPLICATE_EMAIL") return "Ya existe un proveedor con este correo electrónico";
  if (code === "DUPLICATE_TELEFONO") return "Ya existe un proveedor con este teléfono";

  // Auth
  if (code === "UNAUTHENTICATED" || code === 401) {
    return "Usuario no autenticado. Por favor inicia sesión.";
  }

  return message || "Error desconocido";
};

export const useProveedores = () => {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProveedores = async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ E2E: backend filtra por owner en servidor
      // Recomendado: ordenar por nombre ya desde backend, pero aquí también soportamos ordenar por si acaso
      const json = await apiJson<AnyJson>("/api/proveedores?activo=true", { method: "GET" });
      const arr = normalizeArray<Proveedor>(json);

      arr.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
      setProveedores(arr);
    } catch (err: any) {
      console.error("Error fetching proveedores:", err);
      setError(mapBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProveedores();
    
  }, []);

  const createProveedor = async (proveedor: ProveedorUpsert) => {
    try {
      // ✅ validar sesión
      await apiJson("/api/auth/me", { method: "GET" });

      const data = await apiJson<Proveedor>("/api/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: proveedor.nombre,
          telefono: proveedor.telefono ?? null,
          email: proveedor.email ?? null,
          rfc: proveedor.rfc ?? null,
          direccion: proveedor.direccion ?? null,
          ciudad: proveedor.ciudad ?? null,
          estado: proveedor.estado ?? null,
          codigo_postal: proveedor.codigo_postal ?? null,
        }),
      });

      // refrescar lista
      await fetchProveedores();
      return { data, error: null as string | null };
    } catch (err: any) {
      console.error("Error creating proveedor:", err);
      return { data: null, error: mapBackendError(err) };
    }
  };

  const updateProveedor = async (id: string, proveedor: ProveedorUpsert) => {
    try {
      await apiJson("/api/auth/me", { method: "GET" });

      const data = await apiJson<Proveedor>(`/api/proveedores/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: proveedor.nombre,
          telefono: proveedor.telefono ?? null,
          email: proveedor.email ?? null,
          rfc: proveedor.rfc ?? null,
          direccion: proveedor.direccion ?? null,
          ciudad: proveedor.ciudad ?? null,
          estado: proveedor.estado ?? null,
          codigo_postal: proveedor.codigo_postal ?? null,
        }),
      });

      await fetchProveedores();
      return { data, error: null as string | null };
    } catch (err: any) {
      console.error("Error updating proveedor:", err);
      return { data: null, error: mapBackendError(err) };
    }
  };

  const deleteProveedor = async (id: string) => {
    try {
      await apiJson("/api/auth/me", { method: "GET" });

      // ✅ Soft delete desde backend
      await apiJson(`/api/proveedores/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      await fetchProveedores();
      return { error: null as string | null };
    } catch (err: any) {
      console.error("Error deleting proveedor:", err);
      return { error: mapBackendError(err) };
    }
  };

  return {
    proveedores,
    loading,
    error,
    refetch: fetchProveedores,
    createProveedor,
    updateProveedor,
    deleteProveedor,
  };
};
