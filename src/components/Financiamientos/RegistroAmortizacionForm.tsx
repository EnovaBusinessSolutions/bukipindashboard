import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { cn, formatCurrency } from "@/lib/utils";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { useSaldosDisponibles } from "@/hooks/useSaldosDisponibles";
import { useToast } from "@/hooks/use-toast";

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const getTipoUi = (f: any) => {
  const raw = String(f?.tipo || f?.tipo_credito || "").toLowerCase();
  if (raw === "tarjeta_credito" || raw === "tarjeta_corporativa") return "tarjeta_corporativa";
  if (raw === "linea_credito" || raw === "revolvente") return "revolvente";
  if (raw === "credito_simple" || raw === "simple" || raw === "prestamo") return "simple";
  return raw || "otro";
};

const getEstatus = (f: any) => String(f?.estatus || f?.estado || "").toLowerCase();

const getInstitucion = (f: any) => f?.institucion || f?.institucion_financiera || "Sin institución";

const getMontoOriginal = (f: any) =>
  toNum(f?.monto_original ?? f?.montoOriginal ?? f?.monto_total, 0);

const getPlazoMeses = (f: any) =>
  toNum(f?.plazo_meses ?? f?.plazoMeses, 0);

const getTasaAnual = (f: any) =>
  toNum(f?.tasa_interes_anual ?? f?.tasaInteresAnual ?? f?.tasa_interes, 0);

const getSaldoCapitalActual = (f: any) =>
  toNum(f?.saldo_capital_actual ?? f?.saldoCapitalActual ?? f?.saldo_actual, 0);

const getSaldoInteresesActual = (f: any) =>
  toNum(f?.saldo_intereses_actual ?? f?.saldoInteresesActual, 0);

const getSaldoTotalActual = (f: any) =>
  toNum(
    f?.saldo_total_actual ??
      f?.saldoTotalActual ??
      getSaldoCapitalActual(f) + getSaldoInteresesActual(f),
    0
  );

const RegistroAmortizacionForm = () => {
  const {
    financiamientos,
    crearAmortizacion,
  } = useFinanciamientos();

  const { data: saldos } = useSaldosDisponibles();
  const { toast } = useToast();

  const [financiamientoId, setFinanciamientoId] = useState("");
  const [monto, setMonto] = useState("");
  const [capitalPagado, setCapitalPagado] = useState("");
  const [interesPagado, setInteresPagado] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [numeroReferencia, setNumeroReferencia] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState<Date>(new Date());
  const [mostrarAdvertenciaEfectivo, setMostrarAdvertenciaEfectivo] = useState(false);
  const [errorLocal, setErrorLocal] = useState("");

  const isSubmitting = !!crearAmortizacion.isPending;

  const financiamientosActivos = useMemo(() => {
    return financiamientos.filter((f: any) => {
      const estatus = getEstatus(f);
      const saldo = getSaldoTotalActual(f);
      return estatus === "activo" && saldo > 0;
    });
  }, [financiamientos]);

  const financiamientoSeleccionado = useMemo(() => {
    return financiamientosActivos.find((f: any) => f.id === financiamientoId);
  }, [financiamientosActivos, financiamientoId]);

  const tipoSeleccionado = financiamientoSeleccionado ? getTipoUi(financiamientoSeleccionado) : "";
  const esCreditoSimple = tipoSeleccionado === "simple";

  const capitalPendiente = financiamientoSeleccionado ? getSaldoCapitalActual(financiamientoSeleccionado) : 0;
  const interesesPendientes = financiamientoSeleccionado ? getSaldoInteresesActual(financiamientoSeleccionado) : 0;
  const saldoTotalPendiente = financiamientoSeleccionado ? getSaldoTotalActual(financiamientoSeleccionado) : 0;

  useEffect(() => {
    if (!financiamientoSeleccionado) {
      setCapitalPagado("");
      setInteresPagado("");
      return;
    }

    if (esCreditoSimple) {
      const montoOriginal = getMontoOriginal(financiamientoSeleccionado);
      const plazo = getPlazoMeses(financiamientoSeleccionado);
      const capitalMensual = plazo > 0 ? montoOriginal / plazo : 0;
      const capitalSugerido = Math.min(capitalPendiente, capitalMensual);

      setCapitalPagado(capitalSugerido > 0 ? capitalSugerido.toFixed(2) : "");
      setInteresPagado("");

      if (capitalSugerido > 0) {
        toast({
          title: "✅ Capital mensual sugerido",
          description: `Pago sugerido de capital: $${formatCurrency(capitalSugerido)}.`,
          duration: 3500,
        });
      }
    } else {
      setCapitalPagado("");
      setInteresPagado("");
    }
  }, [financiamientoId]); // intencional: solo al cambiar financiamiento

  useEffect(() => {
    const capital = toNum(capitalPagado, 0);
    const interes = toNum(interesPagado, 0);
    const total = capital + interes;
    setMonto(total > 0 ? total.toFixed(2) : "");
  }, [capitalPagado, interesPagado]);

  const resetForm = () => {
    setFinanciamientoId("");
    setMonto("");
    setCapitalPagado("");
    setInteresPagado("");
    setMetodoPago("");
    setNumeroReferencia("");
    setDescripcion("");
    setFecha(new Date());
    setMostrarAdvertenciaEfectivo(false);
    setErrorLocal("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal("");

    if (!financiamientoSeleccionado) {
      setErrorLocal("Debes seleccionar un financiamiento.");
      return;
    }

    const capital = toNum(capitalPagado, 0);
    const interes = toNum(interesPagado, 0);
    const montoTotal = capital + interes;

    if (capital <= 0 && interes <= 0) {
      setErrorLocal("Debes capturar un monto de capital o interés mayor a 0.");
      return;
    }

    if (interes > interesesPendientes) {
      setErrorLocal(
        `No puedes pagar más intereses de los pendientes. Máximo: $${formatCurrency(interesesPendientes)}`
      );
      return;
    }

    if (!metodoPago) {
      setErrorLocal("Debes seleccionar un método de pago.");
      return;
    }

    if (!saldos) {
      setErrorLocal("No se pudieron cargar los saldos disponibles. Intenta nuevamente.");
      return;
    }

    if (metodoPago === "efectivo" && montoTotal > toNum(saldos?.efectivo, 0)) {
      setErrorLocal(
        `Saldo insuficiente en efectivo. Disponible: $${formatCurrency(
          toNum(saldos?.efectivo, 0)
        )} | Necesitas: $${formatCurrency(montoTotal)}`
      );
      return;
    }

    if (metodoPago === "transferencia" && montoTotal > toNum(saldos?.bancos, 0)) {
      setErrorLocal(
        `Saldo insuficiente en bancos. Disponible: $${formatCurrency(
          toNum(saldos?.bancos, 0)
        )} | Necesitas: $${formatCurrency(montoTotal)}`
      );
      return;
    }

    crearAmortizacion.mutate(
      {
        financiamiento_id: financiamientoId,
        monto: montoTotal,
        fecha: format(fecha, "yyyy-MM-dd"),
        monto_capital: capital,
        monto_intereses: interes,
        metodo_pago: metodoPago,
        referencia: numeroReferencia || undefined,
        descripcion: descripcion || undefined,
      },
      {
        onSuccess: () => {
          resetForm();
        },
        onError: (error: any) => {
          setErrorLocal(
            error?.response?.data?.message ||
              error?.message ||
              "No se pudo registrar la amortización."
          );
        },
      }
    );
  };

  const saldoCapitalDespues = Math.max(0, capitalPendiente - toNum(capitalPagado, 0));
  const saldoInteresesDespues = Math.max(0, interesesPendientes - toNum(interesPagado, 0));
  const saldoTotalDespues = saldoCapitalDespues + saldoInteresesDespues;
  const tasaAnual = financiamientoSeleccionado ? getTasaAnual(financiamientoSeleccionado) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Amortización</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorLocal ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorLocal}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="financiamiento">Financiamiento *</Label>
            <Select value={financiamientoId} onValueChange={setFinanciamientoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un financiamiento" />
              </SelectTrigger>
              <SelectContent>
                {financiamientosActivos.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nombre} - {getInstitucion(f)} - Saldo: $
                    {getSaldoTotalActual(f).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {esCreditoSimple && financiamientoSeleccionado && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 <strong>Crédito Simple:</strong> Se sugiere un capital mensual aproximado de $
                {formatCurrency(
                  Math.min(
                    capitalPendiente,
                    getPlazoMeses(financiamientoSeleccionado) > 0
                      ? getMontoOriginal(financiamientoSeleccionado) / getPlazoMeses(financiamientoSeleccionado)
                      : 0
                  )
                )}
                . Los intereses se capturan aparte.
              </p>
            </div>
          )}

          {financiamientoSeleccionado && (
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg space-y-3 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  <span className="font-medium">Institución:</span> {getInstitucion(financiamientoSeleccionado)}
                </p>
                <p className="text-xs text-muted-foreground">Tasa anual: {tasaAnual.toFixed(2)}%</p>
              </div>

              <div className="h-px bg-blue-200 dark:bg-blue-800" />

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-gray-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-muted-foreground mb-1">Capital Pendiente</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    ${capitalPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-950 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                  <p className="text-xs text-muted-foreground mb-1">Intereses Pendientes</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    ${interesesPendientes.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-950 p-3 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Saldo Total a Pagar:</p>
                  <p className="text-xl font-bold text-foreground">
                    ${saldoTotalPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {interesesPendientes > 0 && saldoTotalPendiente > 0 && (
                <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 p-2 rounded-lg border border-orange-200 dark:border-orange-800">
                  <span className="font-medium">⚠️ Tienes intereses pendientes</span>
                  <span className="text-muted-foreground">
                    ({((interesesPendientes / saldoTotalPendiente) * 100).toFixed(1)}% del saldo total)
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capital">
                Capital Pagado * {esCreditoSimple && <span className="text-xs text-muted-foreground">(Sugerido)</span>}
              </Label>
              <Input
                id="capital"
                type="number"
                step="0.01"
                min="0"
                value={capitalPagado}
                onChange={(e) => setCapitalPagado(e.target.value)}
                placeholder={`Pendiente: $${capitalPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
                disabled={isSubmitting}
                required
              />
              <p className="text-xs text-muted-foreground">
                Capital pendiente: ${capitalPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interes">
                Interés Pagado * {esCreditoSimple && <span className="text-xs text-muted-foreground">(Opcional)</span>}
              </Label>
              <Input
                id="interes"
                type="number"
                step="0.01"
                min="0"
                max={interesesPendientes || undefined}
                value={interesPagado}
                onChange={(e) => {
                  const valor = toNum(e.target.value, 0);
                  if (valor <= interesesPendientes) {
                    setInteresPagado(e.target.value);
                  } else {
                    setInteresPagado(interesesPendientes.toString());
                    toast({
                      title: "Límite alcanzado",
                      description: `No puedes pagar más de $${interesesPendientes.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      })} en intereses`,
                      variant: "destructive",
                    });
                  }
                }}
                placeholder={`Máx: $${interesesPendientes.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
                disabled={isSubmitting}
                required
              />
              <p className="text-xs text-muted-foreground">
                Intereses pendientes: ${interesesPendientes.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </p>
            </div>

            {financiamientoSeleccionado && (capitalPagado || interesPagado) && (
              <div className="col-span-2 p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg space-y-3 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                    📊 Previsualización después del pago
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-950 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-xs text-muted-foreground mb-1">Capital que quedará</p>
                    <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                      ${saldoCapitalDespues.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-950 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="text-xs text-muted-foreground mb-1">Intereses que quedarán</p>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      ${saldoInteresesDespues.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "p-3 rounded-lg border-2",
                    saldoTotalDespues === 0
                      ? "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700"
                      : "bg-white dark:bg-gray-950 border-purple-300 dark:border-purple-700"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {saldoTotalDespues === 0 ? "✅ Deuda liquidada completamente" : "Saldo Total que quedará:"}
                    </p>
                    {saldoTotalDespues > 0 && (
                      <p className="text-xl font-bold text-foreground">
                        ${saldoTotalDespues.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 col-span-2">
              <Label htmlFor="monto">Monto Total del Pago</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                value={monto}
                disabled
                className="bg-muted cursor-not-allowed"
                placeholder="Se calculará automáticamente"
              />
              <p className="text-xs text-muted-foreground">
                Este monto se calcula sumando el capital + interés pagados
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metodo_pago">Método de Pago *</Label>
              <Select
                value={metodoPago}
                onValueChange={(value) => {
                  setMetodoPago(value);
                  if (value === "efectivo") {
                    setMostrarAdvertenciaEfectivo(true);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">
                    Efectivo {saldos ? `(Disponible: $${toNum(saldos.efectivo, 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })})` : ""}
                  </SelectItem>
                  <SelectItem value="transferencia">
                    Transferencia/Bancos {saldos ? `(Disponible: $${toNum(saldos.bancos, 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })})` : ""}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha del Pago *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" type="button" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fecha ? format(fecha, "PPP") : "Selecciona fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={fecha}
                    onSelect={(date) => date && setFecha(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="numero_referencia">Número de Referencia</Label>
              <Input
                id="numero_referencia"
                value={numeroReferencia}
                onChange={(e) => setNumeroReferencia(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              disabled={isSubmitting}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : "Registrar Amortización"}
          </Button>

          <AlertDialog open={mostrarAdvertenciaEfectivo} onOpenChange={setMostrarAdvertenciaEfectivo}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>⚠️ Advertencia: Pago en Efectivo</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    Has seleccionado <strong>Efectivo</strong> como método de pago para esta amortización.
                  </p>
                  <p className="text-amber-600 dark:text-amber-400">
                    Los pagos a instituciones financieras regularmente se realizan por transferencia bancaria.
                  </p>
                  <p>¿Deseas continuar con el pago en efectivo?</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setMetodoPago("")}>
                  Cancelar y cambiar
                </AlertDialogCancel>
                <AlertDialogAction onClick={() => setMostrarAdvertenciaEfectivo(false)}>
                  Sí, continuar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistroAmortizacionForm;