import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useAccionistas } from "./useAccionistas";

export interface TransaccionCapital {
  id: string;
  user_id: string;
  tipo_movimiento: "aportacion" | "dividendo";
  fecha: string; // YYYY-MM-DD
  monto: number;
  socio: string;
  accionista_id: string | null;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
  estado: string;
  fecha_cancelacion?: string;
  motivo_cancelacion?: string;
  transaccion_cancelacion_id?: string;

  // enriquecidos
  accionistaActivo?: boolean;
  accionistaNombreActual?: string;
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

export const useTransaccionesCapital = () => {
  const queryClient = useQueryClient();

  // (Se sigue usando en otros lados, aunque aquí no es estrictamente necesario)
  const { accionistas: accionistasActivos } = useAccionistas();

  /**
   * ✅ Backend esperado:
   *   GET  /api/accionistas?include_inactive=1
   *   GET  /api/capital/transacciones
   *   POST /api/capital/transacciones
   *
   * Respuesta puede ser:
   *   payload plano: [...]
   *   o { ok:true, data:[...] }
   */

  // Obtener TODOS los accionistas (activos e inactivos)
  const { data: todosAccionistas = [] } = useQuery<any[]>({
    queryKey: ["accionistas-todos"],
    queryFn: async () => {
      const json: AnyJson = await apiFetch("/api/accionistas?include_inactive=1", {
        method: "GET",
      });
      const items = normalizeArray<any>(json);

      // Orden por nombre (si backend no lo hace)
      items.sort((a, b) => String(a?.nombre ?? "").localeCompare(String(b?.nombre ?? "")));
      return items;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: transaccionesBase = [], isLoading } = useQuery<TransaccionCapital[]>({
    queryKey: ["transacciones-capital"],
    queryFn: async () => {
      const json: AnyJson = await apiFetch("/api/capital/transacciones", { method: "GET" });
      const items = normalizeArray<any>(json);

      // Normalizamos shape + números
      const mapped: TransaccionCapital[] = items.map((t: any) => ({
        id: String(t.id),
        user_id: String(t.user_id ?? ""),
        tipo_movimiento: t.tipo_movimiento,
        fecha: String(t.fecha ?? ""),
        monto: toNumber(t.monto),
        socio: String(t.socio ?? ""),
        accionista_id: t.accionista_id ? String(t.accionista_id) : null,
        descripcion: t.descripcion != null ? String(t.descripcion) : null,
        created_at: String(t.created_at ?? ""),
        updated_at: String(t.updated_at ?? ""),
        estado: String(t.estado ?? "activo"),
        fecha_cancelacion: t.fecha_cancelacion ? String(t.fecha_cancelacion) : undefined,
        motivo_cancelacion: t.motivo_cancelacion ? String(t.motivo_cancelacion) : undefined,
        transaccion_cancelacion_id: t.transaccion_cancelacion_id
          ? String(t.transaccion_cancelacion_id)
          : undefined,
      }));

      // Orden por fecha desc
      mapped.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      return mapped;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Enriquecer transacciones con información de accionista
  const transacciones: TransaccionCapital[] = (transaccionesBase || []).map((t) => {
    const accionista = (todosAccionistas || []).find((a) => String(a.id) === String(t.accionista_id));
    return {
      ...t,
      accionistaActivo: accionista?.activo ?? true,
      accionistaNombreActual: accionista?.nombre ?? t.socio,
    };
  });

  const registrarTransaccion = useMutation({
    mutationFn: async (transaccion: {
      tipo_movimiento: "aportacion" | "dividendo";
      fecha: Date;
      monto: number;
      socio: string;
      accionista_id?: string;
      descripcion: string;
    }) => {
      const payload = {
        tipo_movimiento: transaccion.tipo_movimiento,
        fecha: toISODate(transaccion.fecha),
        monto: transaccion.monto,
        socio: transaccion.socio,
        accionista_id: transaccion.accionista_id || null,
        descripcion: transaccion.descripcion || null,
      };

      const json: AnyJson = await apiFetch("/api/capital/transacciones", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Acepta {data} o plano
      const data = json?.data ?? json;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transacciones-capital"] });
      toast({
        title: "Registro exitoso",
        description: "La transacción de capital se ha registrado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `No se pudo registrar la transacción: ${error?.message || "Error desconocido"}`,
        variant: "destructive",
      });
    },
  });

  // Calcular resúmenes (solo transacciones activas)
  const transaccionesActivas = transacciones.filter((t) => t.estado === "activo");

  const totalAportaciones = transaccionesActivas
    .filter((t) => t.tipo_movimiento === "aportacion")
    .reduce((sum, t) => sum + toNumber(t.monto), 0);

  const totalDividendos = transaccionesActivas
    .filter((t) => t.tipo_movimiento === "dividendo")
    .reduce((sum, t) => sum + toNumber(t.monto), 0);

  const capitalSocialTotal = totalAportaciones - totalDividendos;

  // Totales por tipo de socio (activos vs inactivos)
  const totalAportacionesActivos = transaccionesActivas
    .filter((t) => t.tipo_movimiento === "aportacion" && t.accionistaActivo)
    .reduce((sum, t) => sum + toNumber(t.monto), 0);

  const totalAportacionesInactivos = transaccionesActivas
    .filter((t) => t.tipo_movimiento === "aportacion" && !t.accionistaActivo)
    .reduce((sum, t) => sum + toNumber(t.monto), 0);

  const totalDividendosActivos = transaccionesActivas
    .filter((t) => t.tipo_movimiento === "dividendo" && t.accionistaActivo)
    .reduce((sum, t) => sum + toNumber(t.monto), 0);

  const totalDividendosInactivos = transaccionesActivas
    .filter((t) => t.tipo_movimiento === "dividendo" && !t.accionistaActivo)
    .reduce((sum, t) => sum + toNumber(t.monto), 0);

  const capitalSocialActivos = totalAportacionesActivos - totalDividendosActivos;
  const capitalSocialInactivos = totalAportacionesInactivos - totalDividendosInactivos;

  // Resumen por socio con indicador de activo/inactivo
  const resumenPorSocio = transaccionesActivas.reduce(
    (acc, t) => {
      const claveAgrupacion = t.accionista_id
        ? `${t.accionista_id}|${t.accionistaNombreActual}|${t.accionistaActivo ? "activo" : "inactivo"}`
        : `sin_id|${t.socio}|activo`;

      if (!acc[claveAgrupacion]) {
        acc[claveAgrupacion] = {
          aportaciones: 0,
          dividendos: 0,
          balance: 0,
          activo: t.accionistaActivo ?? true,
          nombreMostrar: t.accionistaNombreActual || t.socio,
        };
      }

      if (t.tipo_movimiento === "aportacion") {
        acc[claveAgrupacion].aportaciones += toNumber(t.monto);
      } else {
        acc[claveAgrupacion].dividendos += toNumber(t.monto);
      }

      acc[claveAgrupacion].balance =
        acc[claveAgrupacion].aportaciones - acc[claveAgrupacion].dividendos;

      return acc;
    },
    {} as Record<
      string,
      { aportaciones: number; dividendos: number; balance: number; activo: boolean; nombreMostrar: string }
    >
  );

  return {
    transacciones,
    isLoading,
    registrarTransaccion,

    totalAportaciones,
    totalDividendos,
    capitalSocialTotal,

    resumenPorSocio,

    totalAportacionesActivos,
    totalAportacionesInactivos,
    totalDividendosActivos,
    totalDividendosInactivos,
    capitalSocialActivos,
    capitalSocialInactivos,
  };
};
