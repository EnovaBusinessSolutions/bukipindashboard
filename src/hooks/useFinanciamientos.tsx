import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export interface Financiamiento {
  id: string;
  _id?: string;

  nombre: string;
  alias?: string;

  descripcion?: string;
  notas?: string;
  condiciones?: string;

  tipo?: string;
  tipo_credito?: string;
  tipo_ui?: string;
  tipoUi?: string;
  tipo_label?: string;
  tipoLabel?: string;

  categoria?: string;
  subtipo?: string;

  institucion?: string;
  institucion_id?: string;
  institucionId?: string;

  institucion_financiera?: string;
  institucion_financiera_id?: string;

  numero_cuenta?: string;
  numeroCuenta?: string;

  numero_contrato?: string;
  numeroContrato?: string;

  referencia?: string;
  cuenta_display?: string;
  cuentaDisplay?: string;

  moneda?: string;
  tipo_cambio?: number;
  tipoCambio?: number;

  linea_credito?: number;
  lineaCredito?: number;

  monto_original?: number;
  montoOriginal?: number;

  monto_dispuesto_inicial?: number;
  montoDispuestoInicial?: number;

  monto_total?: number;
  montoTotalVista?: number;
  monto_total_vista?: number;

  tasa_interes?: number;
  tasa_interes_anual?: number;
  tasaInteresAnual?: number;
  tasa_interes_mensual?: number;
  tasaInteresMensual?: number;

  plazo_meses?: number;
  plazoMeses?: number;

  periodicidad_pago?: string;
  periodicidadPago?: string;

  fecha_inicio?: string;
  fechaInicio?: string;

  fecha_apertura?: string;
  fechaApertura?: string;

  fecha_vencimiento?: string;
  fechaVencimiento?: string;

  fecha_corte?: string | number | null;
  fechaCorte?: string | number | null;

  fecha_pago?: string | number | null;
  fechaPago?: string | number | null;

  saldo_inicial?: number;
  saldo_actual?: number;
  saldoActualVista?: number;
  saldo_actual_vista?: number;

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
  disponible_linea?: number;
  disponibleLinea?: number;

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

  monto_pagado_capital?: number;
  montoPagadoCapital?: number;

  monto_pendiente_capital?: number;
  montoPendienteCapital?: number;

  uso_linea_pct?: number;
  usoLineaPct?: number;

  progreso_pago_pct?: number;
  progresoPagoPct?: number;

  modo_visual?: "uso_linea" | "progreso_pago";
  modoVisual?: "uso_linea" | "progreso_pago";

  descripcion_corta?: string;
  descripcionCorta?: string;
  condiciones_texto?: string;
  condicionesTexto?: string;

  estado?: string;
  estatus?: string;
  estado_ui?: string;
  estadoUi?: string;
  estado_label?: string;
  estadoLabel?: string;

  activo?: boolean;

  user_id?: string;
  owner?: string;

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
  notas?: string;

  metodo_pago?: string;
  metodoPago?: string;

  cuenta_destino?: string;
  cuentaDestino?: string;

  referencia?: string;
  numero_referencia?: string;

  beneficiario?: string;
  institucion?: string;

  journalEntryId?: string;
  source?: string;
  sourceId?: string;

  snapshot_after?: {
    saldo_dispuesto_actual?: number;
    saldo_capital_actual?: number;
    saldo_intereses_actual?: number;
    saldo_moratorios_actual?: number;
    saldo_comisiones_actual?: number;
    saldo_total_actual?: number;
    disponible_actual?: number;
  };

  user_id?: string;
  owner?: string;
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

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  items?: T;
  resumen?: T;
  item?: T;
  message?: string;
} | T;

const asString = (v: unknown, def = ""): string => {
  if (v === undefined || v === null) return def;
  return String(v);
};

const asTrim = (v: unknown, def = ""): string => {
  const s = asString(v, def);
  return s.trim();
};

const toNum = (v: unknown, def = 0): number => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : def;
};

const asBool = (v: unknown, def = false): boolean => {
  if (v === undefined || v === null || v === "") return def;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes", "y", "si", "sí"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return def;
};

const asArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  return [];
};

const unwrap = <T,>(json: ApiEnvelope<T>): T => {
  const anyJson = json as any;
  return anyJson?.data ?? anyJson?.items ?? anyJson?.item ?? (json as T);
};

const getErrorMessage = (error: any, fallback: string) => {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
};

const normalizeTipoUi = (raw: unknown): "simple" | "revolvente" | "tarjeta_corporativa" => {
  const s = asTrim(raw).toLowerCase();
  if (["simple", "credito_simple", "prestamo"].includes(s)) return "simple";
  if (["revolvente", "linea_credito"].includes(s)) return "revolvente";
  if (["tarjeta_corporativa", "tarjeta_credito"].includes(s)) return "tarjeta_corporativa";
  return "simple";
};

const normalizeEstado = (raw: unknown): string => {
  const s = asTrim(raw, "activo").toLowerCase();
  if (!s) return "activo";
  if (s === "pagado") return "liquidado";
  return s;
};

const getTipoLabel = (tipoUi: string): string => {
  if (tipoUi === "simple") return "Crédito Simple";
  if (tipoUi === "revolvente") return "Crédito Revolvente";
  if (tipoUi === "tarjeta_corporativa") return "Tarjeta Corporativa";
  return "Financiamiento";
};

const getEstadoLabel = (estado: string): string => {
  if (estado === "activo") return "ACTIVO";
  if (estado === "liquidado") return "PAGADO";
  if (estado === "vencido") return "VENCIDO";
  if (estado === "cancelado") return "CANCELADO";
  if (estado === "suspendido") return "SUSPENDIDO";
  return estado.toUpperCase() || "ACTIVO";
};

const normalizeFinanciamiento = (raw: any): Financiamiento => {
  const id = asString(raw?.id || raw?._id || "");
  const tipoUi = normalizeTipoUi(raw?.tipo_ui || raw?.tipoUi || raw?.tipo_credito || raw?.tipo);
  const estado = normalizeEstado(raw?.estado_ui || raw?.estadoUi || raw?.estatus || raw?.estado);

  const lineaCredito = toNum(raw?.linea_credito ?? raw?.lineaCredito, 0);
  const montoOriginal = toNum(raw?.monto_original ?? raw?.montoOriginal ?? raw?.saldo_inicial, 0);
  const saldoDispuestoActual = toNum(raw?.saldo_dispuesto_actual ?? raw?.saldoDispuestoActual, 0);
  const saldoCapitalActual = toNum(raw?.saldo_capital_actual ?? raw?.saldoCapitalActual, 0);
  const saldoTotalActual = toNum(
    raw?.saldo_total_actual ?? raw?.saldoTotalActual ?? raw?.saldo_actual,
    0
  );
  const totalAmortizadoCapital = toNum(
    raw?.total_amortizado_capital ?? raw?.totalAmortizadoCapital,
    0
  );
  const disponibleActual = toNum(
    raw?.disponible_actual ?? raw?.disponibleActual ?? raw?.disponible_linea ?? raw?.disponibleLinea,
    Math.max(0, lineaCredito - saldoDispuestoActual)
  );

  const montoTotalVista =
    toNum(raw?.monto_total_vista ?? raw?.montoTotalVista, NaN) ||
    (tipoUi === "simple" ? montoOriginal : lineaCredito);

  const saldoActualVista =
    toNum(raw?.saldo_actual_vista ?? raw?.saldoActualVista, NaN) ||
    (tipoUi === "simple" ? saldoTotalActual : saldoDispuestoActual);

  const montoPagadoCapital =
    toNum(raw?.monto_pagado_capital ?? raw?.montoPagadoCapital, NaN) ||
    (tipoUi === "simple"
      ? Math.max(0, montoOriginal - saldoCapitalActual)
      : totalAmortizadoCapital);

  const montoPendienteCapital =
    toNum(raw?.monto_pendiente_capital ?? raw?.montoPendienteCapital, NaN) ||
    (tipoUi === "simple"
      ? Math.max(0, saldoCapitalActual)
      : Math.max(0, saldoDispuestoActual));

  const usoLineaPct =
    toNum(raw?.uso_linea_pct ?? raw?.usoLineaPct, NaN) ||
    (lineaCredito > 0 ? Math.min(100, (saldoDispuestoActual / lineaCredito) * 100) : 0);

  const progresoPagoPct =
    toNum(raw?.progreso_pago_pct ?? raw?.progresoPagoPct, NaN) ||
    (montoOriginal > 0 ? Math.min(100, (montoPagadoCapital / montoOriginal) * 100) : 0);

  const cuentaDisplay =
    asTrim(raw?.cuenta_display) ||
    asTrim(raw?.cuentaDisplay) ||
    asTrim(raw?.numero_cuenta) ||
    asTrim(raw?.numeroCuenta) ||
    asTrim(raw?.numero_contrato) ||
    asTrim(raw?.numeroContrato) ||
    asTrim(raw?.referencia);

  const condicionesTexto =
    asTrim(raw?.condiciones_texto) ||
    asTrim(raw?.condicionesTexto) ||
    asTrim(raw?.condiciones) ||
    asTrim(raw?.notas) ||
    asTrim(raw?.descripcion);

  const descripcionCorta =
    asTrim(raw?.descripcion_corta) ||
    asTrim(raw?.descripcionCorta) ||
    asTrim(raw?.descripcion) ||
    asTrim(raw?.notas);

  const modoVisual =
    (asTrim(raw?.modo_visual || raw?.modoVisual) as "uso_linea" | "progreso_pago") ||
    (tipoUi === "simple" ? "progreso_pago" : "uso_linea");

  return {
    id,
    _id: raw?._id ? asString(raw._id) : id || undefined,
    alias: asTrim(raw?.alias),

    nombre: asTrim(raw?.nombre),
    descripcion: asTrim(raw?.descripcion),
    notas: asTrim(raw?.notas),
    condiciones: asTrim(raw?.condiciones || condicionesTexto),

    tipo: asTrim(raw?.tipo, "credito_simple"),
    tipo_credito: asTrim(raw?.tipo_credito || tipoUi),
    tipo_ui: tipoUi,
    tipoUi,
    tipo_label: asTrim(raw?.tipo_label || raw?.tipoLabel || getTipoLabel(tipoUi)),
    tipoLabel: asTrim(raw?.tipo_label || raw?.tipoLabel || getTipoLabel(tipoUi)),

    categoria: asTrim(raw?.categoria, "bancario"),
    subtipo: asTrim(raw?.subtipo),

    institucion: asTrim(raw?.institucion || raw?.institucion_financiera),
    institucion_id: asTrim(raw?.institucion_id || raw?.institucionId || raw?.institucion_financiera_id),
    institucionId: asTrim(raw?.institucion_id || raw?.institucionId || raw?.institucion_financiera_id),

    institucion_financiera: asTrim(raw?.institucion_financiera || raw?.institucion),
    institucion_financiera_id: asTrim(raw?.institucion_financiera_id || raw?.institucion_id || raw?.institucionId),

    numero_cuenta: asTrim(raw?.numero_cuenta || raw?.numeroCuenta),
    numeroCuenta: asTrim(raw?.numero_cuenta || raw?.numeroCuenta),

    numero_contrato: asTrim(raw?.numero_contrato || raw?.numeroContrato),
    numeroContrato: asTrim(raw?.numero_contrato || raw?.numeroContrato),

    referencia: asTrim(raw?.referencia),
    cuenta_display: cuentaDisplay,
    cuentaDisplay,

    moneda: asTrim(raw?.moneda, "MXN"),
    tipo_cambio: toNum(raw?.tipo_cambio ?? raw?.tipoCambio, 1),
    tipoCambio: toNum(raw?.tipo_cambio ?? raw?.tipoCambio, 1),

    linea_credito: lineaCredito,
    lineaCredito,

    monto_original: montoOriginal,
    montoOriginal,

    monto_dispuesto_inicial: toNum(raw?.monto_dispuesto_inicial ?? raw?.montoDispuestoInicial, 0),
    montoDispuestoInicial: toNum(raw?.monto_dispuesto_inicial ?? raw?.montoDispuestoInicial, 0),

    monto_total: toNum(raw?.monto_total ?? montoTotalVista, 0),
    monto_total_vista: montoTotalVista,
    montoTotalVista,

    tasa_interes: toNum(raw?.tasa_interes ?? raw?.tasa_interes_anual ?? raw?.tasaInteresAnual, 0),
    tasa_interes_anual: toNum(raw?.tasa_interes_anual ?? raw?.tasaInteresAnual ?? raw?.tasa_interes, 0),
    tasaInteresAnual: toNum(raw?.tasa_interes_anual ?? raw?.tasaInteresAnual ?? raw?.tasa_interes, 0),
    tasa_interes_mensual: toNum(raw?.tasa_interes_mensual ?? raw?.tasaInteresMensual, 0),
    tasaInteresMensual: toNum(raw?.tasa_interes_mensual ?? raw?.tasaInteresMensual, 0),

    plazo_meses: toNum(raw?.plazo_meses ?? raw?.plazoMeses, 0),
    plazoMeses: toNum(raw?.plazo_meses ?? raw?.plazoMeses, 0),

    periodicidad_pago: asTrim(raw?.periodicidad_pago || raw?.periodicidadPago),
    periodicidadPago: asTrim(raw?.periodicidad_pago || raw?.periodicidadPago),

    fecha_inicio: raw?.fecha_inicio ?? raw?.fechaInicio ?? null,
    fechaInicio: raw?.fecha_inicio ?? raw?.fechaInicio ?? null,

    fecha_apertura: raw?.fecha_apertura ?? raw?.fechaApertura ?? null,
    fechaApertura: raw?.fecha_apertura ?? raw?.fechaApertura ?? null,

    fecha_vencimiento: raw?.fecha_vencimiento ?? raw?.fechaVencimiento ?? null,
    fechaVencimiento: raw?.fecha_vencimiento ?? raw?.fechaVencimiento ?? null,

    fecha_corte: raw?.fecha_corte ?? raw?.fechaCorte ?? null,
    fechaCorte: raw?.fecha_corte ?? raw?.fechaCorte ?? null,

    fecha_pago: raw?.fecha_pago ?? raw?.fechaPago ?? null,
    fechaPago: raw?.fecha_pago ?? raw?.fechaPago ?? null,

    saldo_inicial: toNum(raw?.saldo_inicial ?? montoOriginal, 0),
    saldo_actual: toNum(raw?.saldo_actual ?? saldoActualVista, 0),
    saldo_actual_vista: saldoActualVista,
    saldoActualVista,

    saldo_dispuesto_actual: saldoDispuestoActual,
    saldoDispuestoActual: saldoDispuestoActual,

    saldo_capital_actual: saldoCapitalActual,
    saldoCapitalActual: saldoCapitalActual,

    saldo_intereses_actual: toNum(raw?.saldo_intereses_actual ?? raw?.saldoInteresesActual, 0),
    saldoInteresesActual: toNum(raw?.saldo_intereses_actual ?? raw?.saldoInteresesActual, 0),

    saldo_moratorios_actual: toNum(raw?.saldo_moratorios_actual ?? raw?.saldoMoratoriosActual, 0),
    saldoMoratoriosActual: toNum(raw?.saldo_moratorios_actual ?? raw?.saldoMoratoriosActual, 0),

    saldo_comisiones_actual: toNum(raw?.saldo_comisiones_actual ?? raw?.saldoComisionesActual, 0),
    saldoComisionesActual: toNum(raw?.saldo_comisiones_actual ?? raw?.saldoComisionesActual, 0),

    saldo_total_actual: saldoTotalActual,
    saldoTotalActual: saldoTotalActual,

    disponible_actual: disponibleActual,
    disponibleActual: disponibleActual,
    disponible_linea: disponibleActual,
    disponibleLinea: disponibleActual,

    total_dispuesto: toNum(raw?.total_dispuesto ?? raw?.totalDispuesto, 0),
    totalDispuesto: toNum(raw?.total_dispuesto ?? raw?.totalDispuesto, 0),

    total_amortizado_capital: totalAmortizadoCapital,
    totalAmortizadoCapital: totalAmortizadoCapital,

    total_intereses_cargados: toNum(raw?.total_intereses_cargados ?? raw?.totalInteresesCargados, 0),
    totalInteresesCargados: toNum(raw?.total_intereses_cargados ?? raw?.totalInteresesCargados, 0),

    total_intereses_pagados: toNum(raw?.total_intereses_pagados ?? raw?.totalInteresesPagados, 0),
    totalInteresesPagados: toNum(raw?.total_intereses_pagados ?? raw?.totalInteresesPagados, 0),

    total_comisiones_cargadas: toNum(raw?.total_comisiones_cargadas ?? raw?.totalComisionesCargadas, 0),
    totalComisionesCargadas: toNum(raw?.total_comisiones_cargadas ?? raw?.totalComisionesCargadas, 0),

    total_comisiones_pagadas: toNum(raw?.total_comisiones_pagadas ?? raw?.totalComisionesPagadas, 0),
    totalComisionesPagadas: toNum(raw?.total_comisiones_pagadas ?? raw?.totalComisionesPagadas, 0),

    monto_pagado_capital: montoPagadoCapital,
    montoPagadoCapital,
    monto_pendiente_capital: montoPendienteCapital,
    montoPendienteCapital,

    uso_linea_pct: usoLineaPct,
    usoLineaPct,

    progreso_pago_pct: progresoPagoPct,
    progresoPagoPct,

    modo_visual: modoVisual,
    modoVisual,

    descripcion_corta: descripcionCorta,
    descripcionCorta,
    condiciones_texto: condicionesTexto,
    condicionesTexto,

    estado: normalizeEstado(raw?.estado || raw?.estatus || estado),
    estatus: normalizeEstado(raw?.estatus || raw?.estado || estado),
    estado_ui: estado,
    estadoUi: estado,
    estado_label: asTrim(raw?.estado_label || raw?.estadoLabel || getEstadoLabel(estado)),
    estadoLabel: asTrim(raw?.estado_label || raw?.estadoLabel || getEstadoLabel(estado)),

    activo: asBool(raw?.activo, true),

    user_id: asTrim(raw?.user_id || raw?.owner),
    owner: asTrim(raw?.owner || raw?.user_id),

    created_at: raw?.created_at ?? raw?.createdAt ?? null,
    updated_at: raw?.updated_at ?? raw?.updatedAt ?? null,
    createdAt: raw?.createdAt ?? raw?.created_at ?? null,
    updatedAt: raw?.updatedAt ?? raw?.updated_at ?? null,
  };
};

const normalizeTransaccion = (raw: any): TransaccionFinanciamiento => {
  const snapshot = raw?.snapshot_after && typeof raw.snapshot_after === "object"
    ? raw.snapshot_after
    : {};

  return {
    id: asString(raw?.id || raw?._id || ""),
    _id: raw?._id ? asString(raw._id) : undefined,

    financingId: asTrim(raw?.financingId || raw?.financing_id || raw?.financiamiento_id),
    financing_id: asTrim(raw?.financing_id || raw?.financingId || raw?.financiamiento_id),
    financiamiento_id: asTrim(raw?.financiamiento_id || raw?.financingId || raw?.financing_id),

    tipo: asTrim(raw?.tipo || raw?.tipo_transaccion, "otro"),
    tipo_transaccion: asTrim(raw?.tipo_transaccion || raw?.tipo, "otro"),

    subtipo: asTrim(raw?.subtipo),
    estatus: asTrim(raw?.estatus, "aplicado"),

    monto: toNum(raw?.monto, 0),
    fecha: asString(raw?.fecha || raw?.createdAt || raw?.created_at || ""),

    monto_capital: toNum(raw?.monto_capital ?? raw?.montoCapital ?? raw?.capital_pagado, 0),
    montoCapital: toNum(raw?.monto_capital ?? raw?.montoCapital ?? raw?.capital_pagado, 0),
    capital_pagado: toNum(raw?.capital_pagado ?? raw?.monto_capital ?? raw?.montoCapital, 0),

    monto_intereses: toNum(raw?.monto_intereses ?? raw?.montoIntereses ?? raw?.interes_pagado, 0),
    montoIntereses: toNum(raw?.monto_intereses ?? raw?.montoIntereses ?? raw?.interes_pagado, 0),
    interes_pagado: toNum(raw?.interes_pagado ?? raw?.monto_intereses ?? raw?.montoIntereses, 0),

    monto_moratorios: toNum(raw?.monto_moratorios ?? raw?.montoMoratorios, 0),
    montoMoratorios: toNum(raw?.monto_moratorios ?? raw?.montoMoratorios, 0),

    monto_comisiones: toNum(raw?.monto_comisiones ?? raw?.montoComisiones, 0),
    montoComisiones: toNum(raw?.monto_comisiones ?? raw?.montoComisiones, 0),

    monto_iva: toNum(raw?.monto_iva ?? raw?.montoIva, 0),
    montoIva: toNum(raw?.monto_iva ?? raw?.montoIva, 0),

    saldo_restante: toNum(
      raw?.saldo_restante ??
        snapshot?.saldo_total_actual ??
        snapshot?.saldo_capital_actual,
      0
    ),

    descripcion: asTrim(raw?.descripcion),
    notas: asTrim(raw?.notas),

    metodo_pago: asTrim(raw?.metodo_pago || raw?.metodoPago),
    metodoPago: asTrim(raw?.metodoPago || raw?.metodo_pago),

    cuenta_destino: asTrim(raw?.cuenta_destino || raw?.cuentaDestino),
    cuentaDestino: asTrim(raw?.cuentaDestino || raw?.cuenta_destino),

    referencia: asTrim(raw?.referencia || raw?.numero_referencia),
    numero_referencia: asTrim(raw?.numero_referencia || raw?.referencia),

    beneficiario: asTrim(raw?.beneficiario),
    institucion: asTrim(raw?.institucion),

    journalEntryId: asTrim(raw?.journalEntryId),
    source: asTrim(raw?.source),
    sourceId: asTrim(raw?.sourceId),

    snapshot_after: {
      saldo_dispuesto_actual: toNum(snapshot?.saldo_dispuesto_actual, 0),
      saldo_capital_actual: toNum(snapshot?.saldo_capital_actual, 0),
      saldo_intereses_actual: toNum(snapshot?.saldo_intereses_actual, 0),
      saldo_moratorios_actual: toNum(snapshot?.saldo_moratorios_actual, 0),
      saldo_comisiones_actual: toNum(snapshot?.saldo_comisiones_actual, 0),
      saldo_total_actual: toNum(snapshot?.saldo_total_actual, 0),
      disponible_actual: toNum(snapshot?.disponible_actual, 0),
    },

    user_id: asTrim(raw?.user_id || raw?.owner),
    owner: asTrim(raw?.owner || raw?.user_id),

    created_at: raw?.created_at ?? raw?.createdAt ?? null,
    updated_at: raw?.updated_at ?? raw?.updatedAt ?? null,
    createdAt: raw?.createdAt ?? raw?.created_at ?? null,
    updatedAt: raw?.updatedAt ?? raw?.updated_at ?? null,
  };
};

const normalizeResumen = (raw: any): ResumenFinanciamientos => {
  return {
    total: toNum(raw?.total, 0),
    activos: toNum(raw?.activos, 0),
    liquidados: toNum(raw?.liquidados, 0),
    vencidos: toNum(raw?.vencidos, 0),
    cancelados: toNum(raw?.cancelados, 0),
    saldo_total_actual: toNum(raw?.saldo_total_actual, 0),
    saldo_capital_actual: toNum(raw?.saldo_capital_actual, 0),
    saldo_intereses_actual: toNum(raw?.saldo_intereses_actual, 0),
    saldo_moratorios_actual: toNum(raw?.saldo_moratorios_actual, 0),
    saldo_comisiones_actual: toNum(raw?.saldo_comisiones_actual, 0),
    total_dispuesto: toNum(raw?.total_dispuesto, 0),
    total_amortizado_capital: toNum(raw?.total_amortizado_capital, 0),
    disponible_actual: toNum(raw?.disponible_actual, 0),
    linea_credito_total: toNum(raw?.linea_credito_total, 0),
  };
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
      const raw = unwrap<any>(json);
      return asArray<any>(raw).map(normalizeFinanciamiento);
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
      const raw = unwrap<any>(json);
      return asArray<any>(raw).map(normalizeTransaccion);
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
      const raw = unwrap<any>(json);
      return normalizeResumen(raw);
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
      financiamiento: Omit<
        Financiamiento,
        "id" |
        "_id" |
        "user_id" |
        "owner" |
        "created_at" |
        "updated_at" |
        "createdAt" |
        "updatedAt"
      >
    ) => {
      const json = await apiFetch("/api/financiamientos", {
        method: "POST",
        body: JSON.stringify(financiamiento),
      });

      return normalizeFinanciamiento(unwrap<any>(json));
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
        "id" | "_id" | "user_id" | "owner" | "created_at" | "updated_at" | "createdAt" | "updatedAt"
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
        monto_capital: disposicion.monto,
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
      monto_moratorios?: number;
      montoMoratorios?: number;
      monto_comisiones?: number;
      montoComisiones?: number;
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
        monto_moratorios: payload.monto_moratorios ?? payload.montoMoratorios ?? 0,
        monto_comisiones: payload.monto_comisiones ?? payload.montoComisiones ?? 0,
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
    isLoadingFinanciamientos,
    isLoadingTransacciones,
    isLoadingResumen,

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