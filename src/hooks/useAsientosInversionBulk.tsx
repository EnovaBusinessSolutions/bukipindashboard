import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type BulkAsientosResponse = string[] | { ok?: boolean; data?: string[]; items?: string[] };

const unwrapIds = (json: BulkAsientosResponse): string[] => {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.items)) return json.items;
  return [];
};

export const useAsientosInversionBulk = () => {
  return useQuery({
    queryKey: ["asientos-inversion-bulk"],
    queryFn: async (): Promise<Set<string>> => {
      try {
        const json = await apiFetch("/api/inversiones/asientos/bulk", {
          method: "GET",
        });

        const ids = unwrapIds(json)
          .map((id) => String(id || "").trim())
          .filter(Boolean);

        return new Set(ids);
      } catch (err) {
        console.error("Error fetching asientos inversion bulk:", err);
        return new Set<string>();
      }
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};