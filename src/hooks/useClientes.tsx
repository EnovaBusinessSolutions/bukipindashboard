import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export interface Cliente {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  rfc?: string;
  direccion?: string;
  ciudad?: string;
  estado?: string;
  codigo_postal?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  source?: "dedicated" | "transaction";
}

/**
 * ✅ Shapes soportados para clientes “min” desde ingresos:
 * - Nuevo recomendado: { id, nombre, telefono, email, rfc }
 * - Legacy: { cliente_nombre, cliente_telefono, cliente_email, cliente_rfc, created_at }
 */
type TxClienteRow = {
  id?: string;
  _id?: string;
  nombre?: string | null;
  name?: string | null;
  telefono?: string | null;
  phone?: string | null;
  email?: string | null;
  rfc?: string | null;
  created_at?: string | null;

  // legacy
  cliente_nombre?: string | null;
  cliente_email?: string | null;
  cliente_telefono?: string | null;
  cliente_rfc?: string | null;
};

type AnyJson = any;

function safeLower(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function asTrim(v: any) {
  return String(v ?? "").trim();
}

function normalizeArray<T>(json: AnyJson): T[] {
  const data = json?.data ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
}

function getClientIdAny(c: any) {
  const id = c?.id ?? c?._id;
  return id ? String(id) : "";
}

function normalizeDedicatedClient(raw: any): Cliente | null {
  const id = getClientIdAny(raw);
  const nombre = asTrim(raw?.nombre ?? raw?.name);
  if (!id || !nombre) return null;

  return {
    id,
    nombre,
    email: asTrim(raw?.email) || "",
    telefono: asTrim(raw?.telefono ?? raw?.phone) || "",
    rfc: asTrim(raw?.rfc) || "",
    direccion: asTrim(raw?.direccion) || "",
    ciudad: asTrim(raw?.ciudad) || "",
    estado: asTrim(raw?.estado) || "",
    codigo_postal: asTrim(raw?.codigo_postal ?? raw?.codigoPostal) || "",
    activo: raw?.activo ?? true,
    created_at: raw?.created_at ?? raw?.createdAt ?? new Date().toISOString(),
    updated_at: raw?.updated_at ?? raw?.updatedAt ?? raw?.created_at ?? raw?.createdAt ?? new Date().toISOString(),
    source: "dedicated",
  };
}

function normalizeTxClient(raw: TxClienteRow): Cliente | null {
  const nombre =
    asTrim(raw?.nombre ?? raw?.name ?? raw?.cliente_nombre) || "";

  if (!nombre) return null;

  const email = asTrim(raw?.email ?? raw?.cliente_email) || "";
  const telefono = asTrim(raw?.telefono ?? raw?.phone ?? raw?.cliente_telefono) || "";
  const rfc = asTrim(raw?.rfc ?? raw?.cliente_rfc) || "";

  // Si backend ya manda id, úsalo. Si no, genera uno estable
  const backendId = getClientIdAny(raw);
  const keyFull = [nombre, email, telefono, rfc].map(safeLower).join("_");
  const tempId = backendId || `tx-${keyFull.slice(0, 32) || Math.random().toString(36).slice(2, 10)}`;

  const createdAt = asTrim(raw?.created_at) || new Date().toISOString();

  return {
    id: tempId,
    nombre,
    email,
    telefono,
    rfc,
    direccion: "",
    ciudad: "",
    estado: "",
    codigo_postal: "",
    activo: true,
    created_at: createdAt,
    updated_at: createdAt,
    source: "transaction",
  };
}

export const useClientes = () => {
  return useQuery<Cliente[]>({
    queryKey: ["clientes"],
    queryFn: async () => {
      // 1) Clientes dedicados
      const dedicatedJson: AnyJson = await apiFetch("/api/clientes", { method: "GET" });
      const dedicatedArr = normalizeArray<any>(dedicatedJson);

      const dedicatedClients: Cliente[] = dedicatedArr
        .map(normalizeDedicatedClient)
        .filter(Boolean) as Cliente[];

      // 2) Clientes mínimos desde ingresos (backend nuevo o legacy)
      const txJson: AnyJson = await apiFetch("/api/ingresos/clientes-min", { method: "GET" });
      const txArr = normalizeArray<TxClienteRow>(txJson);

      const txClients: Cliente[] = txArr
        .map(normalizeTxClient)
        .filter(Boolean) as Cliente[];

      // 3) Fusionar y deduplicar (prioriza dedicated)
      const finalClients: Cliente[] = [];
      const seenKeys = new Set<string>();

      const keyOf = (c: Cliente) =>
        [c.nombre, c.email, c.telefono, c.rfc].map(safeLower).join("_");

      // Primero dedicated
      for (const c of dedicatedClients) {
        const key = keyOf(c);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          finalClients.push(c);
        }
      }

      // Luego transaction
      for (const c of txClients) {
        const key = keyOf(c);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          finalClients.push(c);
        }
      }

      return finalClients.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

export const useCreateCliente = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      cliente: Omit<Cliente, "id" | "created_at" | "updated_at" | "activo" | "source">
    ) => {
      const payload = {
        ...cliente,
        activo: true,
      };

      const json: AnyJson = await apiFetch("/api/clientes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Soporta {ok:true,data} o payload plano
      const raw = (json as any)?.data ?? json;

      const normalized = normalizeDedicatedClient(raw);
      if (!normalized) {
        // fallback mínimo para no romper
        return {
          id: String(raw?.id ?? raw?._id ?? ""),
          nombre: String(raw?.nombre ?? raw?.name ?? cliente.nombre ?? "Sin nombre"),
          email: raw?.email ?? cliente.email ?? "",
          telefono: raw?.telefono ?? raw?.phone ?? cliente.telefono ?? "",
          rfc: raw?.rfc ?? cliente.rfc ?? "",
          direccion: raw?.direccion ?? cliente.direccion ?? "",
          ciudad: raw?.ciudad ?? cliente.ciudad ?? "",
          estado: raw?.estado ?? cliente.estado ?? "",
          codigo_postal: raw?.codigo_postal ?? raw?.codigoPostal ?? cliente.codigo_postal ?? "",
          activo: true,
          created_at: raw?.created_at ?? raw?.createdAt ?? new Date().toISOString(),
          updated_at: raw?.updated_at ?? raw?.updatedAt ?? new Date().toISOString(),
          source: "dedicated",
        } as Cliente;
      }

      return normalized;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast({
        title: "Cliente creado",
        description: "El cliente ha sido registrado exitosamente.",
      });
    },
    onError: (error: any) => {
      console.error("Error creating client:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo crear el cliente.",
        variant: "destructive",
      });
    },
  });
};
