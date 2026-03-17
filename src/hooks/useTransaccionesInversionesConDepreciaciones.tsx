import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { InversionCapex } from "./useInversiones";

export interface TransaccionInversionCompleta {
  id: string;
  tipo: "alta" | "baja" | "venta" | "depreciacion";
  fecha: string;
  activo: string;
  categoria: string;
  monto?: number;
  descripcion?: string;
  motivo?: string;
  valor_venta?: number;
  inversion_id: string;
  inversion: InversionCapex;
  numero_asiento?: string;
  mes_ano?: string;
  journalEntryId?: string;
}

type AnyJson = any;

const normalizeArray = <T,>(json: AnyJson): T[] => {
  const data = json?.data ?? json?.items ?? json ?? [];
  return Array.isArray(data) ? (data as T[]) : [];
};

const normalizeTransaccion = (row: any): TransaccionInversionCompleta => {
  return {
    id: String(row?.id ?? ""),
    tipo: row?.tipo as "alta" | "baja" | "venta" | "depreciacion",
    fecha: String(row?.fecha ?? ""),
    activo: String(row?.activo ?? ""),
    categoria: String(row?.categoria ?? "otro"),
    monto:
      row?.monto !== undefined && row?.monto !== null
        ? Number(row.monto)
        : undefined,
    descripcion:
      row?.descripcion !== undefined && row?.descripcion !== null
        ? String(row.descripcion)
        : undefined,
    motivo:
      row?.motivo !== undefined && row?.motivo !== null
        ? String(row.motivo)
        : undefined,
    valor_venta:
      row?.valor_venta !== undefined && row?.valor_venta !== null
        ? Number(row.valor_venta)
        : undefined,
    inversion_id: String(row?.inversion_id ?? ""),
    inversion: row?.inversion as InversionCapex,
    numero_asiento:
      row?.numero_asiento !== undefined && row?.numero_asiento !== null
        ? String(row.numero_asiento)
        : undefined,
    mes_ano:
      row?.mes_ano !== undefined && row?.mes_ano !== null
        ? String(row.mes_ano)
        : undefined,
    journalEntryId:
      row?.journalEntryId !== undefined && row?.journalEntryId !== null
        ? String(row.journalEntryId)
        : undefined,
  };
};

export const useTransaccionesInversionesConDepreciaciones = () => {
  const query = useQuery({
    queryKey: ["inversiones-transacciones"],
    queryFn: async (): Promise<TransaccionInversionCompleta[]> => {
      const json: AnyJson = await apiFetch("/api/inversiones/transacciones", {
        method: "GET",
      });

      const rows = normalizeArray<any>(json)
        .map(normalizeTransaccion)
        .filter(
          (row) =>
            row.id &&
            row.tipo &&
            row.fecha &&
            row.activo &&
            row.categoria &&
            row.inversion_id &&
            row.inversion
        );

      rows.sort(
        (a, b) =>
          new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );

      return rows;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    transacciones: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
};