import React, { useEffect, useMemo, useState } from "react";
import { format, addMonths } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { cn } from "@/lib/utils";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { useInstitucionesFinancieras } from "@/hooks/useInstitucionesFinancieras";
import InstitucionFinancieraSelector from "./InstitucionFinancieraSelector";

type TipoCreditoUI = "" | "simple" | "revolvente" | "tarjeta_corporativa";

type FormDataState = {
  nombre: string;
  descripcion: string;
  tipo_credito: TipoCreditoUI;
  institucion_financiera: string;
  institucion_financiera_id: string;
  numero_cuenta: string;
  monto_total: string;
  tasa_interes: string;
  plazo_meses: string;
  condiciones: string;
};

const INITIAL_FORM: FormDataState = {
  nombre: "",
  descripcion: "",
  tipo_credito: "",
  institucion_financiera: "",
  institucion_financiera_id: "",
  numero_cuenta: "",
  monto_total: "",
  tasa_interes: "",
  plazo_meses: "",
  condiciones: "",
};

const RegistroFinanciamientoForm = () => {
  const { crearFinanciamiento } = useFinanciamientos();
  const { instituciones } = useInstitucionesFinancieras();

  const [step, setStep] = useState<"tipo" | "datos">("tipo");
  const [formData, setFormData] = useState<FormDataState>(INITIAL_FORM);
  const [fechaInicio, setFechaInicio] = useState<Date>(new Date());
  const [fechaVencimiento, setFechaVencimiento] = useState<Date | undefined>();
  const [errorLocal, setErrorLocal] = useState("");

  const selectedInstitucion = useMemo(() => {
    return instituciones.find((inst: any) => inst.id === formData.institucion_financiera_id);
  }, [instituciones, formData.institucion_financiera_id]);

  const esLineaCredito =
    formData.tipo_credito === "tarjeta_corporativa" || formData.tipo_credito === "revolvente";

  const esRevolvente = formData.tipo_credito === "revolvente";
  const esSimple = formData.tipo_credito === "simple";
  const esTarjeta = formData.tipo_credito === "tarjeta_corporativa";
  const isSubmitting = !!crearFinanciamiento?.isPending;

  useEffect(() => {
    if (esSimple && fechaInicio && formData.plazo_meses) {
      const meses = parseInt(formData.plazo_meses, 10);
      if (!Number.isNaN(meses) && meses > 0) {
        setFechaVencimiento(addMonths(fechaInicio, meses));
      } else {
        setFechaVencimiento(undefined);
      }
      return;
    }

    if (esRevolvente && fechaInicio) {
      setFechaVencimiento(addMonths(fechaInicio, 12));
      return;
    }

    if (esTarjeta && fechaInicio) {
      // Se mantiene una vigencia técnica para compatibilidad operativa;
      // la tarjeta nace con límite y saldo usado 0.
      setFechaVencimiento(addMonths(fechaInicio, 60));
      return;
    }

    setFechaVencimiento(undefined);
  }, [fechaInicio, formData.plazo_meses, esSimple, esRevolvente, esTarjeta]);

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setFechaInicio(new Date());
    setFechaVencimiento(undefined);
    setStep("tipo");
    setErrorLocal("");
  };

  const backToTipo = () => {
    setStep("tipo");
    setErrorLocal("");
  };

  const handleTipoCreditoSelect = (tipo: TipoCreditoUI) => {
    setFormData((prev) => ({
      ...INITIAL_FORM,
      ...prev,
      tipo_credito: tipo,
    }));
    setStep("datos");
    setErrorLocal("");
  };

  const mapTipoBackend = (tipo: TipoCreditoUI) => {
    if (tipo === "simple") return "credito_simple";
    if (tipo === "revolvente") return "linea_credito";
    if (tipo === "tarjeta_corporativa") return "tarjeta_credito";
    return "credito_simple";
  };

  const getMontoNumber = () => {
    const n = Number(formData.monto_total);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const getTasaNumber = () => {
    const n = Number(formData.tasa_interes);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const getPlazoMeses = () => {
    if (esSimple) {
      const n = parseInt(formData.plazo_meses, 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }

    if (esRevolvente) return 12;
    if (esTarjeta) return 60;
    return 0;
  };

  const getTituloTipo = () => {
    if (esSimple) return "Crédito Simple";
    if (esRevolvente) return "Crédito Revolvente";
    if (esTarjeta) return "Tarjeta de Crédito Corporativa";
    return "Financiamiento";
  };

  const getTextoSubmit = () => {
    if (esSimple) return "Registrar Préstamo";
    if (esRevolvente) return "Registrar Línea Revolvente";
    if (esTarjeta) return "Registrar Tarjeta Corporativa";
    return "Registrar Financiamiento";
  };

  const buildPayload = () => {
    const monto = getMontoNumber();
    const tasa = getTasaNumber();
    const plazoMeses = getPlazoMeses();

    const fechaInicioStr = format(fechaInicio, "yyyy-MM-dd");
    const fechaVencimientoStr = fechaVencimiento
      ? format(fechaVencimiento, "yyyy-MM-dd")
      : format(addMonths(fechaInicio, plazoMeses || 12), "yyyy-MM-dd");

    const tipoBackend = mapTipoBackend(formData.tipo_credito);
    const institucionNombre = formData.institucion_financiera || selectedInstitucion?.nombre || "";
    const numeroCuentaLimpio = formData.numero_cuenta.trim();

    // Crédito simple nace con deuda viva.
    // Revolvente/tarjeta nacen con línea disponible y saldo usado inicial en 0.
    const montoDispuestoInicial = esLineaCredito ? 0 : monto;

    return {
      // ===== Backend canónico =====
      nombre: formData.nombre.trim(),
      descripcion: formData.descripcion.trim(),
      notas: formData.condiciones.trim(),

      tipo: tipoBackend,
      categoria: "bancario",

      institucion: institucionNombre,
      institucion_id: formData.institucion_financiera_id || undefined,

      numero_cuenta: numeroCuentaLimpio,
      numeroCuenta: numeroCuentaLimpio,

      fecha_inicio: fechaInicioStr,
      fechaInicio: fechaInicioStr,
      fecha_vencimiento: fechaVencimientoStr,
      fechaVencimiento: fechaVencimientoStr,
      fecha_apertura: fechaInicioStr,
      fechaApertura: fechaInicioStr,

      tasa_interes_anual: tasa,
      tasaInteresAnual: tasa,

      plazo_meses: plazoMeses,
      plazoMeses: plazoMeses,

      estatus: "activo",
      activo: true,

      linea_credito: esLineaCredito ? monto : 0,
      lineaCredito: esLineaCredito ? monto : 0,

      monto_original: esLineaCredito ? 0 : monto,
      montoOriginal: esLineaCredito ? 0 : monto,

      monto_dispuesto_inicial: montoDispuestoInicial,
      montoDispuestoInicial: montoDispuestoInicial,

      // ===== Compat legacy =====
      tipo_credito: formData.tipo_credito,
      institucion_financiera: institucionNombre,
      institucion_financiera_id: formData.institucion_financiera_id || undefined,
      monto_total: monto,
      tasa_interes: tasa,
      saldo_inicial: esLineaCredito ? 0 : monto,
      saldo_actual: esLineaCredito ? 0 : monto,
      estado: "activo",
      condiciones: formData.condiciones.trim(),
    };
  };

  const validateForm = () => {
    const monto = getMontoNumber();
    const tasa = getTasaNumber();
    const plazo = getPlazoMeses();

    if (!formData.tipo_credito) return "Debes seleccionar un tipo de financiamiento.";
    if (!formData.nombre.trim()) return "El nombre es requerido.";

    if (!formData.institucion_financiera_id && !formData.institucion_financiera.trim()) {
      return "Debes seleccionar una institución financiera.";
    }

    if (monto <= 0) return "El monto debe ser mayor a 0.";
    if (tasa < 0) return "La tasa de interés no puede ser negativa.";

    if (esSimple) {
      if (plazo <= 0) return "El plazo en meses debe ser mayor a 0.";
      if (!fechaVencimiento) return "No se pudo calcular la fecha de vencimiento.";
    }

    return "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal("");

    const validationError = validateForm();
    if (validationError) {
      setErrorLocal(validationError);
      return;
    }

    const payload = buildPayload();

    crearFinanciamiento.mutate(payload, {
      onSuccess: () => {
        resetForm();
      },
      onError: (error: any) => {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          "No se pudo registrar el financiamiento.";
        setErrorLocal(String(message));
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Nuevo Financiamiento</CardTitle>
      </CardHeader>

      <CardContent>
        {step === "tipo" ? (
          <div className="space-y-4">
            <Label className="text-base">¿Qué tipo de financiamiento deseas registrar?</Label>

            <div className="grid gap-4">
              <Button
                type="button"
                variant="outline"
                className="h-auto p-6 flex flex-col items-start space-y-2 hover:border-primary"
                onClick={() => handleTipoCreditoSelect("simple")}
              >
                <span className="font-semibold text-lg">Crédito Simple</span>
                <span className="text-sm text-muted-foreground text-left">
                  Préstamo con monto fijo que se paga gradualmente con intereses
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-auto p-6 flex flex-col items-start space-y-2 hover:border-primary"
                onClick={() => handleTipoCreditoSelect("revolvente")}
              >
                <span className="font-semibold text-lg">Crédito Revolvente</span>
                <span className="text-sm text-muted-foreground text-left">
                  Línea de crédito que se dispone según necesidad y se libera al pagar
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-auto p-6 flex flex-col items-start space-y-2 hover:border-primary"
                onClick={() => handleTipoCreditoSelect("tarjeta_corporativa")}
              >
                <span className="font-semibold text-lg">Tarjeta de Crédito Corporativa</span>
                <span className="text-sm text-muted-foreground text-left">
                  Tarjeta empresarial con límite de crédito para gastos operativos
                </span>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <p className="text-sm text-muted-foreground">Tipo seleccionado:</p>
                <p className="font-semibold">{getTituloTipo()}</p>
              </div>

              <Button type="button" variant="ghost" onClick={backToTipo} disabled={isSubmitting}>
                Cambiar tipo
              </Button>
            </div>

            {errorLocal ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorLocal}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del {esLineaCredito ? "Instrumento" : "Crédito"} *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nombre: e.target.value }))}
                  placeholder={esLineaCredito ? "Ej: Amex Corporativa" : "Ej: Crédito Equipamiento"}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="institucion">Institución Financiera *</Label>

                <InstitucionFinancieraSelector
                  value={formData.institucion_financiera_id}
                  onChange={(id, nombre) => {
                    setFormData((prev) => ({
                      ...prev,
                      institucion_financiera_id: id,
                      institucion_financiera: nombre,
                    }));
                  }}
                />

                {selectedInstitucion && (
                  <Card className="mt-2 p-3 bg-muted">
                    <div className="flex items-center gap-3">
                      {selectedInstitucion.logo_url ? (
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={selectedInstitucion.logo_url} />
                          <AvatarFallback>
                            {selectedInstitucion.nombre?.[0] || "I"}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}

                      <div className="flex-1">
                        <p className="font-medium">{selectedInstitucion.nombre}</p>

                        {selectedInstitucion.ejecutivo_nombre ? (
                          <p className="text-sm text-muted-foreground">
                            Ejecutivo: {selectedInstitucion.ejecutivo_nombre}
                            {selectedInstitucion.ejecutivo_telefono
                              ? ` • ${selectedInstitucion.ejecutivo_telefono}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero_cuenta">
                  Número de {esLineaCredito ? "Tarjeta/Cuenta" : "Cuenta/Contrato"}
                </Label>
                <Input
                  id="numero_cuenta"
                  value={formData.numero_cuenta}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, numero_cuenta: e.target.value }))
                  }
                  placeholder={esTarjeta ? "**** **** **** 1234" : "Ej: 123456789"}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monto_total">
                  {esLineaCredito ? "Límite de Crédito" : "Monto del Préstamo"} *
                </Label>
                <Input
                  id="monto_total"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monto_total}
                  onChange={(e) => setFormData((prev) => ({ ...prev, monto_total: e.target.value }))}
                  placeholder="0.00"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tasa_interes">Tasa de Interés Anual (%) *</Label>
                <Input
                  id="tasa_interes"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.tasa_interes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tasa_interes: e.target.value }))}
                  placeholder="0.00"
                  required
                  disabled={isSubmitting}
                />
              </div>

              {esSimple && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="plazo_meses">Plazo (meses) *</Label>
                    <Input
                      id="plazo_meses"
                      type="number"
                      min="1"
                      value={formData.plazo_meses}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, plazo_meses: e.target.value }))
                      }
                      placeholder="12"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Fecha de Inicio *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          disabled={isSubmitting}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {fechaInicio ? format(fechaInicio, "PPP") : "Selecciona fecha"}
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={fechaInicio}
                          onSelect={(date) => date && setFechaInicio(date)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label>Fecha de Vencimiento (calculada automáticamente)</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {fechaVencimiento
                          ? format(fechaVencimiento, "PPP")
                          : "Se calculará automáticamente"}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {esRevolvente && (
                <>
                  <div className="space-y-2">
                    <Label>Fecha de Registro *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          disabled={isSubmitting}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {fechaInicio ? format(fechaInicio, "PPP") : "Selecciona fecha"}
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={fechaInicio}
                          onSelect={(date) => date && setFechaInicio(date)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Fecha de Vencimiento (1 año)</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {fechaVencimiento ? format(fechaVencimiento, "PPP") : "Se calculará a 1 año"}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {esTarjeta && (
                <>
                  <div className="space-y-2">
                    <Label>Fecha de Registro *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          disabled={isSubmitting}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {fechaInicio ? format(fechaInicio, "PPP") : "Selecciona fecha"}
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={fechaInicio}
                          onSelect={(date) => date && setFechaInicio(date)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Fecha de Vencimiento</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {fechaVencimiento
                          ? format(fechaVencimiento, "PPP")
                          : "Se calculará automáticamente"}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                placeholder={
                  esLineaCredito
                    ? "Detalles adicionales sobre la línea de crédito..."
                    : "Propósito del préstamo..."
                }
                rows={2}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="condiciones">Condiciones y Términos</Label>
              <Textarea
                id="condiciones"
                value={formData.condiciones}
                onChange={(e) => setFormData((prev) => ({ ...prev, condiciones: e.target.value }))}
                placeholder="Garantías, seguros, comisiones, etc."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={backToTipo}
                className="w-1/3"
                disabled={isSubmitting}
              >
                Atrás
              </Button>

              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Registrando..." : getTextoSubmit()}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default RegistroFinanciamientoForm;