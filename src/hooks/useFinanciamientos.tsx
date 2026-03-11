import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export interface Financiamiento {
  id: string;
  _id?: string;

  nombre: string;
  descripcion?: string;
  notas?: string;

  tipo?: string;
  tipo_credito?: string;

  categoria?: string;

  institucion?: string;
  institucion_id?: string;
  institucionId?: string;

  institucion_financiera?: string;
  institucion_financiera_id?: string;

  numero_cuenta?: string;
  numeroCuenta?: string;

  numero_contrato?: string;
  numeroContrato?: string;

  moneda?: string;
  tipo_cambio?: number;
  tipoCambio?: number;

  linea_credito?: number;
  lineaCredito?: number;

  monto_original?: number;
  montoOriginal?: number;

  monto_dispuesto_inicial?: number;
  montoDispuestoInicial?: number;

  monto_total?: number; // compat legacy
  tasa_interes?: number; // compat legacy
  tasa_interes_anual?: number;
  tasaInteresAnual?: number;

  plazo_meses?: number;
  plazoMeses?: number;

  fecha_inicio?: string;
  fechaInicio?: string;

  fecha_apertura?: string;
  fechaApertura?: string;

  fecha_vencimiento?: string;
  fechaVencimiento?: string;

  saldo_inicial?: number; // compat legacy
  saldo_actual?: number; // compat legacy

  saldo_dispuesto_actual?: number;
  saldoDispuestoActual?: number;

  saldo_capital_actual?: number;
  saldoCapitalActual?: number;

  saldo_intereses_actual?: number;
  saldoInteresesActual?: number;

  saldo_moratorios_actual?: number;
  saldoMoratoriosActual?: number;

  saldo_comisiones_actual?: number;
  saldoComisionesActual?: number;

  saldo_total_actual?: number;
  saldoTotalActual?: number;

  disponible_actual?: number;
  disponibleActual?: number;

  total_dispuesto?: number;
  totalDispuesto?: number;

  total_amortizado_capital?: number;
  totalAmortizadoCapital?: number;

  total_intereses_cargados?: number;
  totalInteresesCargados?: number;

  total_intereses_pagados?: number;
  totalInteresesPagados?: number;

  total_comisiones_cargadas?: number;
  totalComisionesCargadas?: number;

  total_comisiones_pagadas?: number;
  totalComisionesPagadas?: number;

  condiciones?: string; // compat legacy

  estado?: string; // compat legacy
  estatus?: string;
  activo?: boolean;

  user_id?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransaccionFinanciamiento {
  id: string;
  _id?: string;

  financingId?: string;
  financing_id?: string;
  financiamiento_id?: string;

  tipo?: string;
  tipo_transaccion?: string;

  subtipo?: string;
  estatus?: string;

  monto: number;
  fecha: string;

  monto_capital?: number;
  montoCapital?: number;
  capital_pagado?: number;

  monto_intereses?: number;
  montoIntereses?: number;
  interes_pagado?: number;

  monto_moratorios?: number;
  montoMoratorios?: number;

  monto_comisiones?: number;
  montoComisiones?: number;

  monto_iva?: number;
  montoIva?: number;

  saldo_restante?: number;

  descripcion?: string;
  metodo_pago?: string;
  metodoPago?: string;

  cuenta_destino?: string;
  cuentaDestino?: string;

  referencia?: string;
  numero_referencia?: string;

  beneficiario?: string;
  institucion?: string;

  user_id?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export interface ResumenFinanciamientos {
  total: number;
  activos: number;
  liquidados: number;
  vencidos: number;
  cancelados: number;
  saldo_total_actual: number;
  saldo_capital_actual: number;
  saldo_intereses_actual: number;
  saldo_moratorios_actual: number;
  saldo_comisiones_actual: number;
  total_dispuesto: number;
  total_amortizado_capital: number;
  disponible_actual: number;
  linea_credito_total: number;
}

type ApiEnvelope<T> = { ok?: boolean; data?: T; items?: T; resumen?: T; message?: string } | T;

const unwrap = <T,>(json: ApiEnvelope<T>): T => {
  return (json as any)?.data ?? (json as T);
};

const getErrorMessage = (error: any, fallback: string) => {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
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

  const {
    data: resumen = {
      total: 0,
      activos: 0,
      liquidados: 0,
      vencidos: 0,
      cancelados: 0,
      saldo_total_actual: 0,
      saldo_capital_actual: 0,
      saldo_intereses_actual: 0,
      saldo_moratorios_actual: 0,
      saldo_comisiones_actual: 0,
      total_dispuesto: 0,
      total_amortizado_capital: 0,
      disponible_actual: 0,
      linea_credito_total: 0,
    },
    isLoading: isLoadingResumen,
    error: resumenError,
  } = useQuery({
    queryKey: ["resumen_financiamientos"],
    queryFn: async () => {
      const json = await apiFetch("/api/financiamientos/resumen", { method: "GET" });
      return unwrap<ResumenFinanciamientos>(json);
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["financiamientos"] });
    queryClient.invalidateQueries({ queryKey: ["transacciones_financiamientos"] });
    queryClient.invalidateQueries({ queryKey: ["resumen_financiamientos"] });
  };

  const crearFinanciamiento = useMutation({
    mutationFn: async (
      financiamiento: Omit<Financiamiento, "id" | "_id" | "user_id" | "created_at" | "updated_at" | "createdAt" | "updatedAt">
    ) => {
      const json = await apiFetch("/api/financiamientos", {
        method: "POST",
        body: JSON.stringify(financiamiento),
      });

      return unwrap<Financiamiento>(json);
    },
    onSuccess: () => {
      refreshAll();

      toast({
        title: "Financiamiento registrado",
        description: "El financiamiento se ha registrado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo registrar el financiamiento."),
        variant: "destructive",
      });
    },
  });

  const crearTransaccion = useMutation({
    mutationFn: async (
      transaccion: Omit<
        TransaccionFinanciamiento,
        "id" | "_id" | "user_id" | "created_at" | "updated_at" | "createdAt" | "updatedAt"
      >
    ) => {
      const financingId =
        transaccion.financingId ||
        transaccion.financing_id ||
        transaccion.financiamiento_id;

      if (!financingId) {
        throw new Error("financingId es requerido para registrar un movimiento.");
      }

      const payload = {
        ...transaccion,
        financingId,
      };

      const json = await apiFetch(`/api/financiamientos/${financingId}/movimientos`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return unwrap<any>(json);
    },
    onSuccess: () => {
      refreshAll();

      toast({
        title: "Movimiento registrado",
        description: "La transacción se ha registrado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo registrar la transacción."),
        variant: "destructive",
      });
    },
  });

  const crearDisposicion = useMutation({
    mutationFn: async (disposicion: {
      financiamiento_id?: string;
      financingId?: string;
      financing_id?: string;
      monto: number;
      fecha: string;
      metodo_pago?: string;
      metodoPago?: string;
      descripcion?: string;
      numero_referencia?: string;
      referencia?: string;
      cuenta_destino?: string;
      cuentaDestino?: string;
      beneficiario?: string;
    }) => {
      const financingId =
        disposicion.financingId ||
        disposicion.financing_id ||
        disposicion.financiamiento_id;

      if (!financingId) {
        throw new Error("financingId es requerido para registrar una disposición.");
      }

      const payload = {
        monto: disposicion.monto,
        fecha: disposicion.fecha,
        metodo_pago: disposicion.metodo_pago ?? disposicion.metodoPago ?? "",
        referencia: disposicion.referencia ?? disposicion.numero_referencia ?? "",
        cuenta_destino: disposicion.cuenta_destino ?? disposicion.cuentaDestino ?? "",
        beneficiario: disposicion.beneficiario ?? "",
        descripcion: disposicion.descripcion ?? "",
      };

      const json = await apiFetch(`/api/financiamientos/${financingId}/disposicion`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return unwrap<any>(json);
    },
    onSuccess: () => {
      refreshAll();

      toast({
        title: "Disposición registrada",
        description: "La disposición se ha registrado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo registrar la disposición."),
        variant: "destructive",
      });
    },
  });

  const crearAmortizacion = useMutation({
    mutationFn: async (payload: {
      financiamiento_id?: string;
      financingId?: string;
      financing_id?: string;
      monto: number;
      fecha: string;
      monto_capital?: number;
      montoCapital?: number;
      monto_intereses?: number;
      montoIntereses?: number;
      metodo_pago?: string;
      metodoPago?: string;
      referencia?: string;
      descripcion?: string;
    }) => {
      const financingId =
        payload.financingId ||
        payload.financing_id ||
        payload.financiamiento_id;

      if (!financingId) {
        throw new Error("financingId es requerido para registrar una amortización.");
      }

      const body = {
        monto: payload.monto,
        fecha: payload.fecha,
        monto_capital: payload.monto_capital ?? payload.montoCapital ?? payload.monto,
        monto_intereses: payload.monto_intereses ?? payload.montoIntereses ?? 0,
        metodo_pago: payload.metodo_pago ?? payload.metodoPago ?? "",
        referencia: payload.referencia ?? "",
        descripcion: payload.descripcion ?? "",
      };

      const json = await apiFetch(`/api/financiamientos/${financingId}/amortizacion`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      return unwrap<any>(json);
    },
    onSuccess: () => {
      refreshAll();

      toast({
        title: "Amortización registrada",
        description: "La amortización se ha registrado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo registrar la amortización."),
        variant: "destructive",
      });
    },
  });

  const crearCargoInteres = useMutation({
    mutationFn: async (payload: {
      financiamiento_id?: string;
      financingId?: string;
      financing_id?: string;
      monto: number;
      fecha: string;
      monto_intereses?: number;
      montoIntereses?: number;
      monto_moratorios?: number;
      montoMoratorios?: number;
      monto_comisiones?: number;
      montoComisiones?: number;
      referencia?: string;
      descripcion?: string;
    }) => {
      const financingId =
        payload.financingId ||
        payload.financing_id ||
        payload.financiamiento_id;

      if (!financingId) {
        throw new Error("financingId es requerido para registrar un cargo por intereses.");
      }

      const body = {
        monto: payload.monto,
        fecha: payload.fecha,
        monto_intereses: payload.monto_intereses ?? payload.montoIntereses ?? payload.monto,
        monto_moratorios: payload.monto_moratorios ?? payload.montoMoratorios ?? 0,
        monto_comisiones: payload.monto_comisiones ?? payload.montoComisiones ?? 0,
        referencia: payload.referencia ?? "",
        descripcion: payload.descripcion ?? "",
      };

      const json = await apiFetch(`/api/financiamientos/${financingId}/intereses`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      return unwrap<any>(json);
    },
    onSuccess: () => {
      refreshAll();

      toast({
        title: "Cargo registrado",
        description: "El cargo por intereses se ha registrado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo registrar el cargo por intereses."),
        variant: "destructive",
      });
    },
  });

  return {
    financiamientos,
    transacciones,
    resumen,
    isLoading: isLoadingFinanciamientos || isLoadingTransacciones || isLoadingResumen,
    financiamientosError,
    transaccionesError,
    resumenError,
    crearFinanciamiento,
    crearTransaccion,
    crearDisposicion,
    crearAmortizacion,
    crearCargoInteres,
    refreshAll,
  };
};