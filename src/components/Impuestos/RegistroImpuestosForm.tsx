import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  WalletCards,
  Landmark,
  ShieldCheck,
  CalendarDays,
  Receipt,
  Percent,
  Info,
} from "lucide-react";

import { useUtilidadAntesImpuestos } from "@/hooks/useUtilidadAntesImpuestos";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { formatCurrency as formatCurrencyUI } from "@/lib/utils";

type AutoridadFiscal = {
  id: string;
  nombre: string;
  rfc?: string;
  logo_url?: string;
  pais: string;
};

type TxImpuesto = {
  id: string;
  mes: number;
  ano: number;
  isr_calculado: number;
  isr_real: number;
  createdAt?: string;
  created_at?: string;
};

function normalizeArray<T = any>(json: any): T[] {
  const payload = json?.data ?? json;
  if (Array.isArray(payload)) return payload;
  return [];
}

const meses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const glassCard =
  "relative overflow-hidden border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/70 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm";
const sectionGlow =
  "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-sky-400/50 before:to-transparent";
const metricCard =
  "rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-br from-white to-slate-50 dark:from-slate-950 dark:to-slate-900 shadow-sm";
const softPanel =
  "rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/80 dark:bg-slate-900/60";

export const RegistroImpuestosForm = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentDate = new Date();
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(currentDate.getMonth() + 1);
  const [anoSeleccionado, setAnoSeleccionado] = useState<number>(currentDate.getFullYear());

  const [tasaISR, setTasaISR] = useState<string>("30");
  const [isrReal, setIsrReal] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("");

  const [isSaving, setIsSaving] = useState(false);
  const [tipoPago, setTipoPago] = useState<string>("total");
  const [fechaVencimiento, setFechaVencimiento] = useState<string>("");
  const [autoridadSeleccionada, setAutoridadSeleccionada] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState<string>("transferencia");
  const [montoPagado, setMontoPagado] = useState<string>("");

  const { data: utilidadData, isLoading } = useUtilidadAntesImpuestos(mesSeleccionado, anoSeleccionado);

  const { data: autoridades = [] } = useQuery({
    queryKey: ["autoridades-fiscales"],
    queryFn: async () => {
      const json = await apiFetch("/api/impuestos/autoridades-fiscales");
      return normalizeArray<AutoridadFiscal>(json);
    },
  });

  const { data: registrosPeriodo = [], isFetching: loadingRegistros } = useQuery({
    queryKey: ["impuestos-isr-registros", mesSeleccionado, anoSeleccionado],
    queryFn: async () => {
      const json = await apiFetch(
        `/api/impuestos/isr/registros?mes=${encodeURIComponent(mesSeleccionado)}&ano=${encodeURIComponent(
          anoSeleccionado
        )}`
      );
      return normalizeArray<TxImpuesto>(json);
    },
  });

  const utilidadAntesImpuestos = utilidadData?.utilidadAntesImpuestos || 0;
  const isrCalculado =
    utilidadAntesImpuestos > 0 ? (utilidadAntesImpuestos * parseFloat(tasaISR || "0")) / 100 : 0;

  const autoridadActiva = useMemo(() => {
    return autoridades.find((a) => a.id === autoridadSeleccionada) || null;
  }, [autoridades, autoridadSeleccionada]);

  const isPeriodoPasado = () => {
    const periodoSeleccionado = new Date(anoSeleccionado, mesSeleccionado - 1);
    const mesActual = new Date(currentDate.getFullYear(), currentDate.getMonth());
    return periodoSeleccionado < mesActual;
  };

  const diasRestantesMes = () => {
    const ultimoDiaMes = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const diaActual = currentDate.getDate();
    return ultimoDiaMes - diaActual;
  };

  const mostrarAlertaCierreMes =
    mesSeleccionado === currentDate.getMonth() + 1 &&
    anoSeleccionado === currentDate.getFullYear() &&
    diasRestantesMes() <= 5;

  const registroExistente = useMemo(() => {
    if (!registrosPeriodo?.length) return null;
    const totalAcumulado = registrosPeriodo.reduce((sum, reg) => sum + Number(reg.isr_real || 0), 0);
    const ultimo = registrosPeriodo[0];
    return {
      registros: registrosPeriodo,
      total_acumulado: totalAcumulado,
      ultimo_registro: ultimo,
    };
  }, [registrosPeriodo]);

  const saldoPendientePreview = useMemo(() => {
    const total = parseFloat(isrReal || "0");
    const parcial = parseFloat(montoPagado || "0");
    if (tipoPago === "total") return 0;
    if (tipoPago === "credito") return Number.isFinite(total) ? total : 0;
    if (tipoPago === "parcial") {
      if (!Number.isFinite(total) || !Number.isFinite(parcial)) return 0;
      return Math.max(0, total - parcial);
    }
    return 0;
  }, [tipoPago, isrReal, montoPagado]);

  useEffect(() => {
    if (!registroExistente) {
      setIsrReal("");
      setObservaciones("");
      setTipoPago("total");
      setFechaVencimiento("");
      setMetodoPago("transferencia");
      setMontoPagado("");
    }
  }, [mesSeleccionado, anoSeleccionado, registroExistente]);

  const handleGuardarRegistro = async () => {
    if (isPeriodoPasado()) {
      toast({
        title: "Error",
        description: "No puedes crear registros para períodos pasados",
        variant: "destructive",
      });
      return;
    }

    if (!isrReal || isNaN(parseFloat(isrReal)) || parseFloat(isrReal) < 0) {
      toast({
        title: "Error",
        description: "Debes ingresar el monto real de ISR",
        variant: "destructive",
      });
      return;
    }

    if (!autoridadSeleccionada) {
      toast({
        title: "Error",
        description: "Debes seleccionar una autoridad fiscal",
        variant: "destructive",
      });
      return;
    }

    if (tipoPago === "credito" && !fechaVencimiento) {
      toast({
        title: "Error",
        description: "Debes ingresar la fecha de vencimiento para pago a crédito",
        variant: "destructive",
      });
      return;
    }

    if ((tipoPago === "total" || tipoPago === "parcial") && !metodoPago) {
      toast({
        title: "Error",
        description: "Debes seleccionar el método de pago",
        variant: "destructive",
      });
      return;
    }

    if (tipoPago === "parcial") {
      if (!montoPagado || isNaN(parseFloat(montoPagado)) || parseFloat(montoPagado) <= 0) {
        toast({
          title: "Error",
          description: "Debes ingresar el monto pagado",
          variant: "destructive",
        });
        return;
      }

      if (parseFloat(montoPagado) > parseFloat(isrReal)) {
        toast({
          title: "Error",
          description: "El monto pagado no puede ser mayor al ISR total",
          variant: "destructive",
        });
        return;
      }

      if (!fechaVencimiento) {
        toast({
          title: "Error",
          description: "Debes ingresar la fecha de vencimiento para el saldo pendiente",
          variant: "destructive",
        });
        return;
      }
    }

    if (utilidadAntesImpuestos <= 0 && parseFloat(isrReal || "0") !== 0) {
      toast({
        title: "Error",
        description: "Con pérdidas del período, solo puedes registrar ISR total de $0.00",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const pagoIndex = (registroExistente?.registros?.length || 0) + 1;

      const body = {
        mes: mesSeleccionado,
        ano: anoSeleccionado,
        utilidad_antes_impuestos: utilidadAntesImpuestos,
        tasa_isr: parseFloat(tasaISR || "0"),
        isr_calculado: isrCalculado,
        isr_real_total: parseFloat(isrReal),
        tipo_pago: tipoPago,
        metodo_pago: tipoPago === "total" || tipoPago === "parcial" ? metodoPago : null,
        monto_pagado:
          tipoPago === "total" ? parseFloat(isrReal) : tipoPago === "parcial" ? parseFloat(montoPagado) : 0,
        fecha_vencimiento: tipoPago === "credito" || tipoPago === "parcial" ? fechaVencimiento : null,
        autoridad_id: autoridadSeleccionada,
        observaciones: observaciones || null,
        pago_index: pagoIndex,
      };

      await apiFetch("/api/impuestos/isr/registros", {
        method: "POST",
        body: JSON.stringify(body),
      });

      toast({
        title: "Registro guardado",
        description:
          tipoPago === "total"
            ? "El pago de ISR se registró correctamente con su asiento contable"
            : tipoPago === "credito"
            ? "La cuenta por pagar de ISR se registró correctamente con su asiento contable"
            : "El pago parcial de ISR y su cuenta por pagar se registraron correctamente",
      });

      setIsrReal("");
      setObservaciones("");
      setTipoPago("total");
      setFechaVencimiento("");
      setMetodoPago("transferencia");
      setMontoPagado("");

      await queryClient.invalidateQueries({ queryKey: ["impuestos-isr-registros", mesSeleccionado, anoSeleccionado] });
    } catch (err: any) {
      const msg = err?.message || "Hubo un error al guardar el registro";
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {isPeriodoPasado() && !registroExistente && (
        <Alert variant="destructive" className="border-red-300/70 shadow-sm">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No puedes crear nuevos registros para períodos pasados. Solo puedes modificar registros existentes.
          </AlertDescription>
        </Alert>
      )}

      {mostrarAlertaCierreMes && (
        <Alert className="border-amber-300 bg-amber-50/80 text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            ¡Atención! Faltan {diasRestantesMes()} días para el cierre de mes. Asegúrate de registrar el ISR antes de que termine el mes.
          </AlertDescription>
        </Alert>
      )}

      {utilidadAntesImpuestos < 0 && (
        <Alert variant="destructive" className="shadow-sm">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Este período tiene pérdidas ({formatCurrencyUI(utilidadAntesImpuestos)}). No se calcula ISR sobre resultados negativos. Puedes registrar un pago de
            $0.00 para documentar el período.
          </AlertDescription>
        </Alert>
      )}

      {registroExistente && (
        <Alert className="border-sky-300 bg-sky-50/80 text-sky-900 shadow-sm dark:border-sky-800 dark:bg-sky-950/20 dark:text-sky-300">
          <CheckCircle2 className="h-4 w-4 text-sky-600" />
          <AlertDescription>
            Has registrado un total acumulado de {formatCurrencyUI(registroExistente.total_acumulado)} de ISR para {meses[mesSeleccionado - 1]} {anoSeleccionado} (
            {registroExistente.registros.length} registro{registroExistente.registros.length > 1 ? "s" : ""}). Puedes continuar agregando pagos adicionales.
          </AlertDescription>
        </Alert>
      )}

      <Card className={`${glassCard} ${sectionGlow}`}>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                <Sparkles className="h-3.5 w-3.5" />
                Registro fiscal del período
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Configura el período y el contexto fiscal</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6">
                Bukipin calcula la base fiscal desde tus asientos contables y te ayuda a registrar el ISR con una experiencia clara, profesional y lista para
                auditoría.
              </CardDescription>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[460px]">
              <div className={metricCard}>
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
                    <CalendarDays className="h-4 w-4 text-sky-600" />
                    Período
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{meses[mesSeleccionado - 1]}</p>
                  <p className="text-xs text-slate-500">{anoSeleccionado}</p>
                </div>
              </div>

              <div className={metricCard}>
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    Utilidad
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrencyUI(utilidadAntesImpuestos)}</p>
                  <p className="text-xs text-slate-500">Base antes de ISR</p>
                </div>
              </div>

              <div className={metricCard}>
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Percent className="h-4 w-4 text-indigo-600" />
                    Tasa
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tasaISR || "0"}%</p>
                  <p className="text-xs text-slate-500">Editable</p>
                </div>
              </div>

              <div className={metricCard}>
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Receipt className="h-4 w-4 text-violet-600" />
                    ISR estimado
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrencyUI(isrCalculado)}</p>
                  <p className="text-xs text-slate-500">Cálculo automático</p>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={`${softPanel} p-5`}>
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-sky-600" />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Período contable</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mes">Mes</Label>
                <Select value={mesSeleccionado.toString()} onValueChange={(v) => setMesSeleccionado(parseInt(v))} disabled>
                  <SelectTrigger id="mes" className="h-12 rounded-xl bg-white/80 dark:bg-slate-950/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((mes, index) => {
                      const mesNumero = index + 1;
                      const mesActual = currentDate.getMonth() + 1;
                      return (
                        <SelectItem key={mesNumero} value={mesNumero.toString()} disabled={mesNumero !== mesActual}>
                          {mes}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ano">Año</Label>
                <Select value={anoSeleccionado.toString()} onValueChange={(v) => setAnoSeleccionado(parseInt(v))} disabled>
                  <SelectTrigger id="ano" className="h-12 rounded-xl bg-white/80 dark:bg-slate-950/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={currentDate.getFullYear().toString()}>{currentDate.getFullYear()}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 p-5 text-white shadow-lg">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-sky-400/20 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-indigo-400/20 blur-2xl" />

            <div className="relative space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Vista ejecutiva
              </div>

              <div>
                <p className="text-sm text-sky-100/80">Estado del período</p>
                <h3 className="text-2xl font-bold">{isPeriodoPasado() ? "Período cerrado" : "Período activo"}</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-sky-100/70">Registros del mes</p>
                  <p className="mt-1 text-xl font-bold">{registroExistente?.registros.length || 0}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-sky-100/70">Acumulado ISR</p>
                  <p className="mt-1 text-lg font-bold">{formatCurrencyUI(registroExistente?.total_acumulado || 0)}</p>
                </div>
              </div>

              <p className="text-xs leading-5 text-sky-100/80">
                Mantén tus registros fiscales documentados con claridad y respaldo contable automático dentro del flujo operativo de Bukipin.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`${glassCard} ${sectionGlow}`}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 shadow-sm dark:bg-sky-950/40 dark:text-sky-300">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-2xl">Cálculo de ISR</CardTitle>
              <CardDescription>Cálculo automático basado en la utilidad antes de impuestos del período seleccionado</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
              Cargando datos del período...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                <div className={`${softPanel} p-5`}>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Desglose contable del período</p>
                      <p className="text-xs text-slate-500">Base utilizada para construir la utilidad antes de impuestos</p>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      {meses[mesSeleccionado - 1]} {anoSeleccionado}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: "Ingresos", value: utilidadData?.ingresos || 0, negative: false },
                      { label: "Costos", value: utilidadData?.costos || 0, negative: true },
                      { label: "Gastos", value: utilidadData?.gastos || 0, negative: true },
                      { label: "Depreciación", value: utilidadData?.depreciacion || 0, negative: true },
                      { label: "Intereses", value: utilidadData?.intereses || 0, negative: true },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
                      >
                        <span className="text-sm text-slate-600 dark:text-slate-300">{item.label}</span>
                        <span
                          className={`text-sm font-semibold ${
                            item.negative ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {item.negative ? "-" : ""}
                          {formatCurrencyUI(item.value)}
                        </span>
                      </div>
                    ))}

                    <div className="mt-2 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 px-4 py-4 dark:border-sky-900 dark:from-sky-950/30 dark:to-indigo-950/20">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
                            Utilidad antes de impuestos
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Resultado final del período previo al cálculo de ISR</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{formatCurrencyUI(utilidadAntesImpuestos)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5 shadow-sm dark:border-indigo-900 dark:from-indigo-950/30 dark:via-slate-950 dark:to-sky-950/20">
                    <div className="mb-3 flex items-center gap-2">
                      <Percent className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                      <Label htmlFor="tasa-isr" className="text-sm font-semibold">
                        Tasa de ISR (%)
                      </Label>
                    </div>

                    <Input
                      id="tasa-isr"
                      type="number"
                      placeholder="Ej: 30"
                      value={tasaISR}
                      onChange={(e) => setTasaISR(e.target.value)}
                      step="0.01"
                      min="0"
                      max="100"
                      className="h-12 rounded-xl border-indigo-200 bg-white/90 text-lg font-semibold shadow-sm dark:border-indigo-800 dark:bg-slate-950/60"
                    />

                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Ajusta la tasa si deseas documentar un escenario fiscal diferente al valor base.
                    </p>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-600 via-sky-700 to-slate-900 p-5 text-white shadow-lg">
                    <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                        <Sparkles className="h-3.5 w-3.5" />
                        Resultado automático
                      </div>

                      <p className="text-sm text-sky-100/80">
                        {utilidadAntesImpuestos > 0 ? `ISR Calculado (${tasaISR}%)` : "Sin impuesto por pérdida"}
                      </p>
                      <p className="mt-2 text-4xl font-bold tracking-tight">{formatCurrencyUI(isrCalculado)}</p>
                      <p className="mt-3 text-xs leading-5 text-sky-100/80">
                        {utilidadAntesImpuestos > 0
                          ? `${tasaISR}% de ${formatCurrencyUI(utilidadAntesImpuestos)}`
                          : "No se genera ISR cuando el período cierra con resultados negativos."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className={`${glassCard} ${sectionGlow}`}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 shadow-sm dark:bg-violet-950/40 dark:text-violet-300">
              <WalletCards className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-2xl">Monto total y estrategia de pago</CardTitle>
              <CardDescription>
                Registra el importe fiscal del período y define si lo liquidarás completo, parcial o a crédito
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2 space-y-4">
              <div className={`${softPanel} p-5`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Label htmlFor="isr-real" className="text-base font-semibold">
                    Monto TOTAL del ISR *
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsrReal(isrCalculado.toFixed(2))}
                    className="rounded-full border-sky-200 bg-white/80 px-4 shadow-sm hover:bg-sky-50 dark:border-sky-800 dark:bg-slate-950/50"
                  >
                    Usar ISR Calculado
                  </Button>
                </div>

                <Input
                  id="isr-real"
                  type="text"
                  placeholder="Ingresa el importe total del ISR"
                  value={isrReal}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, "").replace(/[^\d.]/g, "");
                    if (value === "" || /^\d*\.?\d*$/.test(value)) setIsrReal(value);
                  }}
                  onBlur={() => {
                    const num = parseFloat(isrReal);
                    if (!isNaN(num)) setIsrReal(num.toFixed(2));
                  }}
                  maxLength={20}
                  className="h-14 rounded-2xl bg-white/90 text-2xl font-bold shadow-sm dark:bg-slate-950/60"
                />

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {isrReal && !isNaN(parseFloat(isrReal)) && (
                      <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">
                        {parseFloat(isrReal).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                      </p>
                    )}
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300">
                    <Info className="h-3.5 w-3.5" />
                    Define el monto fiscal total y después el flujo de pago
                  </div>
                </div>
              </div>

              <div className={`${softPanel} p-5`}>
                <Label htmlFor="tipo-pago" className="mb-3 block text-base font-semibold">
                  ¿Cómo realizarás el pago de este ISR? *
                </Label>

                <Select value={tipoPago} onValueChange={setTipoPago}>
                  <SelectTrigger id="tipo-pago" className="h-12 rounded-xl bg-white/90 dark:bg-slate-950/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">✓ Pago Total - Pagaré el 100% AHORA</SelectItem>
                    <SelectItem value="parcial">⚡ Pago Parcial - Pagaré una PARTE ahora y el resto después</SelectItem>
                    <SelectItem value="credito">📅 A Crédito - NO pagaré nada ahora (solo registrar la deuda)</SelectItem>
                  </SelectContent>
                </Select>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div
                    className={`rounded-2xl border p-4 transition-all ${
                      tipoPago === "total"
                        ? "border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/20"
                        : "border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/40"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pago total</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Liquidación inmediata</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Ideal para dejar el período al corriente desde este momento.</p>
                  </div>

                  <div
                    className={`rounded-2xl border p-4 transition-all ${
                      tipoPago === "parcial"
                        ? "border-amber-300 bg-amber-50 shadow-sm dark:border-amber-800 dark:bg-amber-950/20"
                        : "border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/40"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pago parcial</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Liquidez controlada</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Pagas una parte ahora y registras el resto como saldo pendiente.</p>
                  </div>

                  <div
                    className={`rounded-2xl border p-4 transition-all ${
                      tipoPago === "credito"
                        ? "border-violet-300 bg-violet-50 shadow-sm dark:border-violet-800 dark:bg-violet-950/20"
                        : "border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/40"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">A crédito</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Solo registras la obligación</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">No se paga ahora; Bukipin deja documentada la cuenta por pagar.</p>
                  </div>
                </div>
              </div>

              {(tipoPago === "total" || tipoPago === "parcial") && (
                <div className={`${softPanel} p-5`}>
                  <div className="mb-3 flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-sky-600" />
                    <Label htmlFor="metodo-pago" className="text-base font-semibold">
                      Método de Pago *
                    </Label>
                  </div>

                  <Select value={metodoPago} onValueChange={setMetodoPago}>
                    <SelectTrigger id="metodo-pago" className="h-12 rounded-xl bg-white/90 dark:bg-slate-950/60">
                      <SelectValue placeholder="Selecciona el método de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {tipoPago === "parcial" && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm dark:border-emerald-900 dark:from-emerald-950/20 dark:to-slate-950">
                    <Label htmlFor="monto-pagado" className="mb-3 block text-base font-bold text-emerald-900 dark:text-emerald-200">
                      ¿Cuánto vas a pagar ahora? *
                    </Label>

                    <Input
                      id="monto-pagado"
                      type="text"
                      placeholder="Ingresa el monto a pagar en este momento"
                      value={montoPagado}
                      onChange={(e) => {
                        const value = e.target.value.replace(/,/g, "").replace(/[^\d.]/g, "");
                        if (value === "" || /^\d*\.?\d*$/.test(value)) setMontoPagado(value);
                      }}
                      onBlur={() => {
                        const num = parseFloat(montoPagado);
                        if (!isNaN(num)) setMontoPagado(num.toFixed(2));
                      }}
                      maxLength={20}
                      className="h-12 rounded-xl border-emerald-200 bg-white/90 text-lg font-bold shadow-sm dark:border-emerald-800 dark:bg-slate-950/60"
                    />

                    {montoPagado && !isNaN(parseFloat(montoPagado)) && (
                      <p className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        Pagarás ahora: {parseFloat(montoPagado).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm dark:border-amber-900 dark:from-amber-950/20 dark:to-slate-950">
                    <Label htmlFor="fecha-vencimiento-parcial" className="mb-3 block text-base font-semibold text-amber-900 dark:text-amber-200">
                      Fecha de vencimiento del saldo *
                    </Label>
                    <Input
                      id="fecha-vencimiento-parcial"
                      type="date"
                      value={fechaVencimiento}
                      onChange={(e) => setFechaVencimiento(e.target.value)}
                      className="h-12 rounded-xl bg-white/90 shadow-sm dark:bg-slate-950/60"
                    />

                    <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
                      El resto quedará documentado como una obligación fiscal pendiente con vencimiento definido.
                    </p>
                  </div>
                </div>
              )}

              {tipoPago === "credito" && (
                <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm dark:border-violet-900 dark:from-violet-950/20 dark:to-slate-950">
                  <Label htmlFor="fecha-vencimiento" className="mb-3 block text-base font-semibold text-violet-900 dark:text-violet-200">
                    Fecha de vencimiento *
                  </Label>
                  <Input
                    id="fecha-vencimiento"
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    className="h-12 rounded-xl bg-white/90 shadow-sm dark:bg-slate-950/60"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-5 text-white shadow-lg">
                <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl" />
                <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-sky-400/20 blur-2xl" />

                <div className="relative space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-100">
                    <Receipt className="h-3.5 w-3.5" />
                    Resumen de pago
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-300">ISR total</p>
                    <p className="mt-1 text-3xl font-bold">{formatCurrencyUI(parseFloat(isrReal || "0") || 0)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Pagas ahora</p>
                      <p className="mt-1 text-lg font-bold">
                        {formatCurrencyUI(
                          tipoPago === "total"
                            ? parseFloat(isrReal || "0") || 0
                            : tipoPago === "parcial"
                            ? parseFloat(montoPagado || "0") || 0
                            : 0
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Saldo pendiente</p>
                      <p className="mt-1 text-lg font-bold">{formatCurrencyUI(saldoPendientePreview)}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Modalidad</p>
                    <p className="mt-1 text-sm font-semibold">
                      {tipoPago === "total" ? "Pago total" : tipoPago === "parcial" ? "Pago parcial" : "Registro a crédito"}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {tipoPago === "total"
                        ? "El período queda liquidado contablemente."
                        : tipoPago === "parcial"
                        ? "Se generará pago + cuenta por pagar."
                        : "Se generará únicamente la obligación fiscal."}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`${softPanel} p-5`}>
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-sky-600" />
                  <Label htmlFor="autoridad-fiscal" className="text-base font-semibold">
                    Autoridad Fiscal *
                  </Label>
                </div>

                <Select value={autoridadSeleccionada} onValueChange={setAutoridadSeleccionada}>
                  <SelectTrigger id="autoridad-fiscal" className="h-12 rounded-xl bg-white/90 dark:bg-slate-950/60">
                    <SelectValue placeholder="Selecciona una autoridad fiscal" />
                  </SelectTrigger>
                  <SelectContent>
                    {autoridades.length === 0 ? (
                      <div className="px-3 py-5 text-center text-sm text-muted-foreground">
                        No hay autoridades fiscales registradas.
                        <br />
                        Ve al tab "Catálogo" para agregar una.
                      </div>
                    ) : (
                      autoridades.map((aut) => (
                        <SelectItem key={aut.id} value={aut.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={aut.logo_url || undefined} />
                              <AvatarFallback className="text-xs">{aut.nombre.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span>{aut.nombre}</span>
                            {aut.pais !== "México" && <span className="text-xs text-muted-foreground">({aut.pais})</span>}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {autoridadActiva && (
                  <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-800">
                        <AvatarImage src={autoridadActiva.logo_url || undefined} />
                        <AvatarFallback>{autoridadActiva.nombre.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{autoridadActiva.nombre}</p>
                        <p className="text-xs text-slate-500">
                          RFC: {autoridadActiva.rfc || "N/A"} {autoridadActiva.pais !== "México" ? `· ${autoridadActiva.pais}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={`${softPanel} p-5`}>
                <Label htmlFor="observaciones" className="mb-3 block text-base font-semibold">
                  Observaciones
                </Label>
                <Textarea
                  id="observaciones"
                  placeholder="Agrega notas, contexto fiscal o comentarios internos..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={5}
                  className="rounded-2xl bg-white/90 shadow-sm dark:bg-slate-950/60"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white to-slate-50 px-4 py-4 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Listo para registrar el movimiento fiscal</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bukipin generará automáticamente el respaldo contable del ISR según la modalidad seleccionada.
                </p>
              </div>

              <Button
                className="h-12 rounded-2xl bg-gradient-to-r from-sky-600 via-sky-700 to-slate-900 px-8 text-base font-semibold text-white shadow-lg shadow-sky-900/20 transition-all hover:scale-[1.01] hover:from-sky-700 hover:via-sky-800 hover:to-slate-950"
                onClick={handleGuardarRegistro}
                disabled={
                  !isrReal ||
                  isSaving ||
                  isPeriodoPasado() ||
                  (utilidadAntesImpuestos <= 0 && parseFloat(isrReal || "0") !== 0)
                }
              >
                {isSaving ? "Guardando..." : "Guardar Nuevo Registro"}
              </Button>
            </div>

            {loadingRegistros && (
              <p className="pt-3 text-center text-xs text-slate-500 dark:text-slate-400">Actualizando registros...</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};