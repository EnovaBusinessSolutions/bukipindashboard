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

type TxClienteRow = {
  cliente_nombre: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  cliente_rfc: string | null;
  created_at: string;
};

function safeLower(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

export const useClientes = () => {
  return useQuery({
    queryKey: ["clientes"],
    queryFn: async (): Promise<Cliente[]> => {
      // 1) Clientes dedicados
      const dedicatedJson = await apiFetch("/api/clientes", { method: "GET" });
      const dedicatedClients: Cliente[] = (dedicatedJson as any)?.data ?? dedicatedJson;

      // 2) Clientes inferidos desde transacciones (ingresos)
      //    (solo campos mínimos para no traer toda la transacción)
      const txJson = await apiFetch("/api/ingresos/clientes-min", { method: "GET" });
      const transactionClients: TxClienteRow[] = (txJson as any)?.data ?? txJson;

      // Convertir clientes de transacciones al formato Cliente + deduplicar por key (incluye RFC/email/tel)
      const transactionClientMap = new Map<string, Cliente>();

      (transactionClients || []).forEach((tc) => {
        const nombre = tc.cliente_nombre?.trim() || "";
        if (!nombre) return;

        const keyFull = [
          tc.cliente_nombre,
          tc.cliente_email,
          tc.cliente_telefono,
          tc.cliente_rfc,
        ]
          .map(safeLower)
          .join("_");

        if (!transactionClientMap.has(keyFull)) {
          // id estable derivado del key (para evitar rerenders raros)
          const tempId = `tx-${keyFull.slice(0, 32) || Math.random().toString(36).slice(2, 10)}`;

          transactionClientMap.set(keyFull, {
            id: tempId,
            nombre,
            email: tc.cliente_email?.trim() || "",
            telefono: tc.cliente_telefono?.trim() || "",
            rfc: tc.cliente_rfc?.trim() || "",
            direccion: "",
            ciudad: "",
            estado: "",
            codigo_postal: "",
            activo: true,
            created_at: tc.created_at,
            updated_at: tc.created_at,
            source: "transaction",
          });
        }
      });

      // Fusionar
      const allClients: Cliente[] = [
        ...(dedicatedClients || []).map((dc) => ({ ...dc, source: "dedicated" as const })),
        ...Array.from(transactionClientMap.values()),
      ];

      // Deduplicar por nombre+email+telefono (prioriza dedicated)
      const finalClients: Cliente[] = [];
      const seenKeys = new Set<string>();

      // Primero dedicated
      allClients
        .filter((c) => c.source === "dedicated")
        .forEach((client) => {
          const key = [client.nombre, client.email, client.telefono].map(safeLower).join("_");
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            finalClients.push(client);
          }
        });

      // Luego transaction
      allClients
        .filter((c) => c.source === "transaction")
        .forEach((client) => {
          const key = [client.nombre, client.email, client.telefono].map(safeLower).join("_");
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            finalClients.push(client);
          }
        });

      return finalClients.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    },
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

      const json = await apiFetch("/api/clientes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = (json as any)?.data ?? json;
      return data as Cliente;
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
