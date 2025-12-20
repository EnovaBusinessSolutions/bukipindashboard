import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export interface Financiamiento {
  id: string;
  user_id: string;
  nombre: string;
  descripcion?: string;
  tipo_credito: string;
  monto_total: number;
  tasa_interes: number;
  plazo_meses: number;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_vencimiento: string; // YYYY-MM-DD
  saldo_inicial: number;
  saldo_actual: number;
  institucion_financiera: string;
  institucion_financiera_id?: string;
  numero_cuenta?: string;
  condiciones?: string;
  subcuenta_id?: string;
  cuenta_codigo?: string;
  estado: string;
  created_at: string;
  updated_at: string;
}

export interface TransaccionFinanciamiento {
  id: string;
  user_id: string;
  financiamiento_id: string;
  tipo_transaccion: string; // desembolso | amortizacion | cargo_interes | disposicion | etc.
  monto: number;
  fecha: string; // YYYY-MM-DD
  capital_pagado: number;
  interes_pagado: number;
  saldo_restante: number;
  descripcion?: string;
  metodo_pago?: string; // efectivo | transferencia | etc.
  numero_referencia?: string;
  created_at: string;
}

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string } | T;

const unwrap = <T,>(json: ApiEnvelope<T>): T => {
  // soporta {ok:true,data} o payload plano
  return (json as any)?.data ?? (json as T);
};

export const useFinanciamientos = () => {
  const queryClient = useQueryClient();

  const {
    data: financiamientos = [],
    isLoading: isLoadingFinanciamientos,
    error: financiamientosError,
  } = useQuery({
    queryKey: ["financiamientos"],
    queryFn: async () => {
      const json = await apiFetch("/api/financiamientos", { method: "GET" });
      return unwrap<Financiamiento[]>(json) || [];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const {
    data: transacciones = [],
    isLoading: isLoadingTransacciones,
    error: transaccionesError,
  } = useQuery({
    queryKey: ["transacciones_financiamientos"],
    queryFn: async () => {
      const json = await apiFetch("/api/financiamientos/transacciones", { method: "GET" });
      return unwrap<TransaccionFinanciamiento[]>(json) || [];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  /**
   * CREAR FINANCIAMIENTO
   * Backend debe encargarse de:
   * - Si tipo_credito = tarjeta_corporativa o revolvente: NO crear asientos ni transacción inicial
   * - Si crédito simple: crear transacción desembolso + asientos contables (1002 vs 2101, etc.)
   */
  const crearFinanciamiento = useMutation({
    mutationFn: async (
      financiamiento: Omit<Financiamiento, "id" | "user_id" | "created_at" | "updated_at">
    ) => {
      const json = await apiFetch("/api/financiamientos", {
        method: "POST",
        body: JSON.stringify(financiamiento),
      });

      return unwrap<Financiamiento>(json);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financiamientos"] });
      queryClient.invalidateQueries({ queryKey: ["transacciones_financiamientos"] });

      toast({
        title: "Financiamiento registrado",
        description: "El financiamiento se ha registrado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo registrar el financiamiento.",
        variant: "destructive",
      });
    },
  });

  /**
   * CREAR TRANSACCIÓN DE FINANCIAMIENTO
   * Backend debe encargarse de:
   * - actualizar saldo_actual del financiamiento
   * - si tipo_transaccion = amortizacion: crear asiento (2101 + 5201 + 1001/1002)
   * - si tipo_transaccion = cargo_interes: crear asiento (5201 y 2101 o 1001/1002)
   */
  const crearTransaccion = useMutation({
    mutationFn: async (
      transaccion: Omit<TransaccionFinanciamiento, "id" | "user_id" | "created_at">
    ) => {
      const json = await apiFetch("/api/financiamientos/transacciones", {
        method: "POST",
        body: JSON.stringify(transaccion),
      });

      return unwrap<TransaccionFinanciamiento>(json);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transacciones_financiamientos"] });
      queryClient.invalidateQueries({ queryKey: ["financiamientos"] });

      toast({
        title: "Transacción registrada",
        description: "La transacción se ha registrado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo registrar la transacción.",
        variant: "destructive",
      });
    },
  });

  /**
   * CREAR DISPOSICIÓN (línea revolvente / tarjeta)
   * Backend debe:
   * - validar límite disponible
   * - crear transacción tipo "disposicion"
   * - actualizar saldo_actual
   * - crear asiento (DEBE 1001/1002, HABER 2101)
   */
  const crearDisposicion = useMutation({
    mutationFn: async (disposicion: {
      financiamiento_id: string;
      monto: number;
      fecha: string; // YYYY-MM-DD
      metodo_pago: string; // efectivo | bancos | etc.
      descripcion?: string;
      numero_referencia?: string;
    }) => {
      const json = await apiFetch("/api/financiamientos/disposiciones", {
        method: "POST",
        body: JSON.stringify(disposicion),
      });

      return unwrap<{ success: boolean }>(json);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financiamientos"] });
      queryClient.invalidateQueries({ queryKey: ["transacciones_financiamientos"] });

      toast({
        title: "Disposición registrada",
        description: "La disposición se ha registrado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo registrar la disposición.",
        variant: "destructive",
      });
    },
  });

  return {
    financiamientos,
    transacciones,
    isLoading: isLoadingFinanciamientos || isLoadingTransacciones,
    financiamientosError,
    transaccionesError,
    crearFinanciamiento,
    crearTransaccion,
    crearDisposicion,
  };
};
