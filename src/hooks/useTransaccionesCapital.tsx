import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAccionistas } from "./useAccionistas";

export interface TransaccionCapital {
  id: string;
  user_id: string;
  tipo_movimiento: "aportacion" | "dividendo";
  fecha: string;
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
  accionistaActivo?: boolean;
  accionistaNombreActual?: string;
}

export const useTransaccionesCapital = () => {
  const queryClient = useQueryClient();
  const { accionistas: accionistasActivos } = useAccionistas();

  // Obtener TODOS los accionistas (activos e inactivos)
  const { data: todosAccionistas = [] } = useQuery({
    queryKey: ["accionistas-todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accionistas")
        .select("*")
        .order("nombre");

      if (error) throw error;
      return data;
    },
  });

  const { data: transaccionesBase = [], isLoading } = useQuery({
    queryKey: ["transacciones-capital"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacciones_capital")
        .select("*")
        .order("fecha", { ascending: false });

      if (error) throw error;
      return data as TransaccionCapital[];
    },
  });

  // Enriquecer transacciones con información de accionista
  const transacciones = transaccionesBase.map(t => {
    const accionista = todosAccionistas.find(a => a.id === t.accionista_id);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { data, error } = await supabase
        .from("transacciones_capital")
        .insert({
          user_id: user.id,
          tipo_movimiento: transaccion.tipo_movimiento,
          fecha: transaccion.fecha.toISOString().split("T")[0],
          monto: transaccion.monto,
          socio: transaccion.socio,
          accionista_id: transaccion.accionista_id || null,
          descripcion: transaccion.descripcion || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transacciones-capital"] });
      toast({
        title: "Registro exitoso",
        description: "La transacción de capital se ha registrado correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo registrar la transacción: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Calcular resúmenes (solo transacciones activas)
  const transaccionesActivas = transacciones.filter(t => t.estado === "activo");
  
  const totalAportaciones = transaccionesActivas
    .filter((t) => t.tipo_movimiento === "aportacion")
    .reduce((sum, t) => sum + Number(t.monto), 0);

  const totalDividendos = transaccionesActivas
    .filter((t) => t.tipo_movimiento === "dividendo")
    .reduce((sum, t) => sum + Number(t.monto), 0);

  const capitalSocialTotal = totalAportaciones - totalDividendos;

  // Totales por tipo de socio (activos vs inactivos)
  const totalAportacionesActivos = transaccionesActivas
    .filter((t) => t.tipo_movimiento === "aportacion" && t.accionistaActivo)
    .reduce((sum, t) => sum + Number(t.monto), 0);

  const totalAportacionesInactivos = transaccionesActivas
    .filter((t) => t.tipo_movimiento === "aportacion" && !t.accionistaActivo)
    .reduce((sum, t) => sum + Number(t.monto), 0);

  const totalDividendosActivos = transaccionesActivas
    .filter((t) => t.tipo_movimiento === "dividendo" && t.accionistaActivo)
    .reduce((sum, t) => sum + Number(t.monto), 0);

  const totalDividendosInactivos = transaccionesActivas
    .filter((t) => t.tipo_movimiento === "dividendo" && !t.accionistaActivo)
    .reduce((sum, t) => sum + Number(t.monto), 0);

  const capitalSocialActivos = totalAportacionesActivos - totalDividendosActivos;
  const capitalSocialInactivos = totalAportacionesInactivos - totalDividendosInactivos;

  // Resumen por socio con indicador de activo/inactivo
  const resumenPorSocio = transaccionesActivas.reduce((acc, t) => {
    // Usar accionista_id si existe, sino usar el nombre del socio
    const claveAgrupacion = t.accionista_id 
      ? `${t.accionista_id}|${t.accionistaNombreActual}|${t.accionistaActivo ? 'activo' : 'inactivo'}`
      : `sin_id|${t.socio}|activo`;
    
    if (!acc[claveAgrupacion]) {
      acc[claveAgrupacion] = { 
        aportaciones: 0, 
        dividendos: 0, 
        balance: 0,
        activo: t.accionistaActivo ?? true,
        nombreMostrar: t.accionistaNombreActual || t.socio
      };
    }
    if (t.tipo_movimiento === "aportacion") {
      acc[claveAgrupacion].aportaciones += Number(t.monto);
    } else {
      acc[claveAgrupacion].dividendos += Number(t.monto);
    }
    acc[claveAgrupacion].balance = acc[claveAgrupacion].aportaciones - acc[claveAgrupacion].dividendos;
    return acc;
  }, {} as Record<string, { aportaciones: number; dividendos: number; balance: number; activo: boolean; nombreMostrar: string }>);

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
