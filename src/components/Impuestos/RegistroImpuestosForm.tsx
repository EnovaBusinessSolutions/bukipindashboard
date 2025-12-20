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

import { Calculator, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

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

  // Utilidad del periodo (este hook debe ya estar migrado a backend; este archivo no usa supabase)
  const { data: utilidadData, isLoading } = useUtilidadAntesImpuestos(mesSeleccionado, anoSeleccionado);

  const utilidadAntesImpuestos = utilidadData?.utilidadAntesImpuestos || 0;
  const isrCalculado =
    utilidadAntesImpuestos > 0 ? (utilidadAntesImpuestos * parseFloat(tasaISR || "0")) / 100 : 0;

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

  // ===== Authorities (E2E, sin hook supabase) =====
  const { data: autoridades = [] } = useQuery({
    queryKey: ["autoridades-fiscales"],
    queryFn: async () => {
      const json = await apiFetch("/api/impuestos/autoridades-fiscales");
      return normalizeArray<AutoridadFiscal>(json);
    },
  });

  // ===== Registros existentes del periodo =====
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

  // Reset fields si cambia periodo y no hay registros
  useEffect(() => {
    if (!registroExistente) {
      setIsrReal("");
      setObservaciones("");
      setTipoPago("total");
      setFechaVencimiento("");
      setMetodoPago("transferencia");
      setMontoPagado("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSeleccionado, anoSeleccionado, registroExistente?.registros?.length]);

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

    // Bloqueo: si hay pérdidas, sólo permitir registrar 0.00
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

        // Datos base
        utilidad_antes_impuestos: utilidadAntesImpuestos,
        tasa_isr: parseFloat(tasaISR || "0"),
        isr_calculado: isrCalculado,
        isr_real_total: parseFloat(isrReal),

        // UI/Flujo de pago
        tipo_pago: tipoPago, // total | parcial | credito
        metodo_pago: tipoPago === "total" || tipoPago === "parcial" ? metodoPago : null, // transferencia | efectivo
        monto_pagado: tipoPago === "total" ? parseFloat(isrReal) : tipoPago === "parcial" ? parseFloat(montoPagado) : 0,
        fecha_vencimiento: tipoPago === "credito" || tipoPago === "parcial" ? fechaVencimiento : null,

        // Autoridad
        autoridad_id: autoridadSeleccionada,

        // Extra
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

      // Limpiar formulario
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
      {/* Alertas */}
      {isPeriodoPasado() && !registroExistente && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No puedes crear nuevos registros para períodos pasados. Solo puedes modificar registros existentes.
          </AlertDescription>
        </Alert>
      )}

      {mostrarAlertaCierreMes && (
        <Alert className="border-amber-500 bg-amber-500/10">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-600 dark:text-amber-400">
            ¡Atención! Faltan {diasRestantesMes()} días para el cierre de mes. Asegúrate de registrar el ISR antes de que termine el mes.
          </AlertDescription>
        </Alert>
      )}

      {utilidadAntesImpuestos < 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ Este período tiene pérdidas ({formatCurrencyUI(utilidadAntesImpuestos)}). No se calcula ISR sobre resultados negativos. Puedes registrar
            un pago de $0.00 para documentar el período.
          </AlertDescription>
        </Alert>
      )}

      {registroExistente && (
        <Alert className="border-blue-500 bg-blue-500/10">
          <CheckCircle2 className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-600 dark:text-blue-400">
            Has registrado un total acumulado de {formatCurrencyUI(registroExistente.total_acumulado)} de ISR para {meses[mesSeleccionado - 1]}{" "}
            {anoSeleccionado} ({registroExistente.registros.length} registro{registroExistente.registros.length > 1 ? "s" : ""}). Puedes continuar agregando
            pagos adicionales.
          </AlertDescription>
        </Alert>
      )}

      {/* Selector de Período */}
      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
          <CardDescription>Selecciona el mes y año del registro</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mes">Mes</Label>
            <Select value={mesSeleccionado.toString()} onValueChange={(v) => setMesSeleccionado(parseInt(v))} disabled>
              <SelectTrigger id="mes" className="bg-muted text-muted-foreground">
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
              <SelectTrigger id="ano" className="bg-muted text-muted-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={currentDate.getFullYear().toString()}>{currentDate.getFullYear()}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cálculo de ISR */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Cálculo de ISR
          </CardTitle>
          <CardDescription>Cálculo automático basado en la utilidad antes de impuestos del período seleccionado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando datos del período...</div>
          ) : (
            <>
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Ingresos:</span>
                  <span className="font-semibold">{formatCurrencyUI(utilidadData?.ingresos || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Costos:</span>
                  <span className="font-semibold text-red-600">-{formatCurrencyUI(utilidadData?.costos || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Gastos:</span>
                  <span className="font-semibold text-red-600">-{formatCurrencyUI(utilidadData?.gastos || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Depreciación:</span>
                  <span className="font-semibold text-red-600">-{formatCurrencyUI(utilidadData?.depreciacion || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Intereses:</span>
                  <span className="font-semibold text-red-600">-{formatCurrencyUI(utilidadData?.intereses || 0)}</span>
                </div>
                <div className="pt-3 border-t border-border flex justify-between items-center">
                  <span className="font-semibold">Utilidad Antes de Impuestos:</span>
                  <span className="text-xl font-bold text-foreground">{formatCurrencyUI(utilidadAntesImpuestos)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tasa-isr">Tasa de ISR (%)</Label>
                <Input
                  id="tasa-isr"
                  type="number"
                  placeholder="Ej: 30"
                  value={tasaISR}
                  onChange={(e) => setTasaISR(e.target.value)}
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>

              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  {utilidadAntesImpuestos > 0 ? `ISR Calculado (${tasaISR}%)` : "Sin impuesto (pérdida del período)"}
                </p>
                <p className="text-2xl font-bold text-primary">{formatCurrencyUI(isrCalculado)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {utilidadAntesImpuestos > 0
                    ? `${tasaISR}% de ${formatCurrencyUI(utilidadAntesImpuestos)}`
                    : "No se genera ISR con resultados negativos"}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ISR Real a Pagar */}
      <Card>
        <CardHeader>
          <CardTitle>Monto Total del ISR</CardTitle>
          <CardDescription>
            Ingresa el monto TOTAL del ISR que corresponde a este período (este es el importe del impuesto, no lo que pagarás ahora)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="isr-real" className="text-base font-semibold">
                Monto TOTAL del ISR *
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsrReal(isrCalculado.toFixed(2))} className="text-xs">
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
              className="text-lg font-semibold"
            />

            {isrReal && !isNaN(parseFloat(isrReal)) && (
              <p className="text-sm font-medium text-primary">
                {parseFloat(isrReal).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
              </p>
            )}

            <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded border border-blue-200 dark:border-blue-800">
              ℹ️ <strong>Importante:</strong> Este es el monto total del impuesto que te corresponde pagar. En el siguiente paso elegirás cómo realizarás el pago.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo-pago" className="text-base font-semibold">
              ¿Cómo realizarás el pago de este ISR? *
            </Label>
            <Select value={tipoPago} onValueChange={setTipoPago}>
              <SelectTrigger id="tipo-pago">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">✓ Pago Total - Pagaré el 100% AHORA</SelectItem>
                <SelectItem value="parcial">⚡ Pago Parcial - Pagaré una PARTE ahora y el resto después</SelectItem>
                <SelectItem value="credito">📅 A Crédito - NO pagaré nada ahora (solo registrar la deuda)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoPago === "credito" && (
            <div className="space-y-2">
              <Label htmlFor="fecha-vencimiento">Fecha de Vencimiento *</Label>
              <Input id="fecha-vencimiento" type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
            </div>
          )}

          {(tipoPago === "total" || tipoPago === "parcial") && (
            <>
              <div className="space-y-2">
                <Label htmlFor="metodo-pago">Método de Pago *</Label>
                <Select value={metodoPago} onValueChange={setMetodoPago}>
                  <SelectTrigger id="metodo-pago">
                    <SelectValue placeholder="Selecciona el método de pago" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoPago === "parcial" && (
                <>
                  <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                    <Label htmlFor="monto-pagado" className="text-base font-bold text-blue-900 dark:text-blue-100">
                      💰 ¿Cuánto vas a pagar AHORA? *
                    </Label>
                    <Input
                      id="monto-pagado"
                      type="text"
                      placeholder="Ingresa solo el monto que pagarás en este momento"
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
                      className="text-lg font-bold border-2"
                    />
                    {montoPagado && !isNaN(parseFloat(montoPagado)) && (
                      <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                        ✓ Pagarás: {parseFloat(montoPagado).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                      </p>
                    )}
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 bg-white/50 dark:bg-black/20 p-2 rounded">
                      ⚠️ Este NO es el total del ISR, es solo lo que vas a pagar en este momento. El resto quedará como saldo pendiente.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fecha-vencimiento-parcial">Fecha de Vencimiento del Saldo *</Label>
                    <Input
                      id="fecha-vencimiento-parcial"
                      type="date"
                      value={fechaVencimiento}
                      onChange={(e) => setFechaVencimiento(e.target.value)}
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="autoridad-fiscal">Autoridad Fiscal *</Label>
            <Select value={autoridadSeleccionada} onValueChange={setAutoridadSeleccionada}>
              <SelectTrigger id="autoridad-fiscal">
                <SelectValue placeholder="Selecciona una autoridad fiscal" />
              </SelectTrigger>
              <SelectContent>
                {autoridades.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
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

            {autoridadSeleccionada && (
              <p className="text-xs text-muted-foreground">RFC: {autoridades.find((a) => a.id === autoridadSeleccionada)?.rfc || "N/A"}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea
              id="observaciones"
              placeholder="Agrega notas o comentarios sobre este registro..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            className="w-full"
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

          {loadingRegistros && (
            <p className="text-xs text-muted-foreground text-center pt-2">Actualizando registros...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
