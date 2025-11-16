import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { useInstitucionesFinancieras } from "@/hooks/useInstitucionesFinancieras";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import InstitucionFinancieraSelector from "./InstitucionFinancieraSelector";

const RegistroFinanciamientoForm = () => {
  const { crearFinanciamiento } = useFinanciamientos();
  const { instituciones } = useInstitucionesFinancieras();
  const [step, setStep] = useState<'tipo' | 'datos'>("tipo");
  const [formData, setFormData] = useState({
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
  });
  const [fechaInicio, setFechaInicio] = useState<Date>(new Date());
  const [fechaVencimiento, setFechaVencimiento] = useState<Date>();

  const selectedInstitucion = instituciones.find((inst) => inst.id === formData.institucion_financiera_id);

  // Calcular automáticamente la fecha de vencimiento
  useEffect(() => {
    if (formData.tipo_credito === "simple" && fechaInicio && formData.plazo_meses) {
      const meses = parseInt(formData.plazo_meses);
      if (!isNaN(meses) && meses > 0) {
        const nuevaFechaVencimiento = addMonths(fechaInicio, meses);
        setFechaVencimiento(nuevaFechaVencimiento);
      }
    } else if (formData.tipo_credito === "revolvente" && fechaInicio) {
      // Para crédito revolvente: vencimiento a 1 año (12 meses)
      const nuevaFechaVencimiento = addMonths(fechaInicio, 12);
      setFechaVencimiento(nuevaFechaVencimiento);
    }
  }, [fechaInicio, formData.plazo_meses, formData.tipo_credito]);

  const handleTipoCreditoSelect = (tipo: string) => {
    setFormData({ ...formData, tipo_credito: tipo });
    setStep("datos");
  };

  const handleBack = () => {
    setStep("tipo");
    setFormData({
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
    });
  };

  const esLineaCredito = formData.tipo_credito === "tarjeta_corporativa" || formData.tipo_credito === "revolvente";
  const esRevolvente = formData.tipo_credito === "revolvente";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const monto = parseFloat(formData.monto_total);
    
    // Para líneas de crédito (tarjeta y revolvente)
    if (esLineaCredito) {
      crearFinanciamiento.mutate({
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        tipo_credito: formData.tipo_credito,
        institucion_financiera: formData.institucion_financiera,
        institucion_financiera_id: formData.institucion_financiera_id || undefined,
        numero_cuenta: formData.numero_cuenta,
        monto_total: monto, // Límite de crédito
        tasa_interes: parseFloat(formData.tasa_interes),
        plazo_meses: 1, // No aplica pero es requerido
        fecha_inicio: format(fechaInicio, "yyyy-MM-dd"),
        fecha_vencimiento: fechaVencimiento 
          ? format(fechaVencimiento, "yyyy-MM-dd") 
          : format(addMonths(fechaInicio, formData.tipo_credito === "revolvente" ? 12 : 60), "yyyy-MM-dd"),
        saldo_inicial: 0,
        saldo_actual: 0,
        condiciones: formData.condiciones,
        estado: "activo",
      });
    } else {
      // Para créditos simples
      if (!fechaVencimiento) {
        return;
      }
      
      crearFinanciamiento.mutate({
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        tipo_credito: formData.tipo_credito,
        institucion_financiera: formData.institucion_financiera,
        institucion_financiera_id: formData.institucion_financiera_id || undefined,
        numero_cuenta: formData.numero_cuenta,
        monto_total: monto,
        tasa_interes: parseFloat(formData.tasa_interes),
        plazo_meses: parseInt(formData.plazo_meses),
        fecha_inicio: format(fechaInicio, "yyyy-MM-dd"),
        fecha_vencimiento: format(fechaVencimiento, "yyyy-MM-dd"),
        saldo_inicial: monto,
        saldo_actual: monto,
        condiciones: formData.condiciones,
        estado: "activo",
      });
    }

    // Reset form
    setFormData({
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
    });
    setFechaInicio(new Date());
    setFechaVencimiento(undefined);
    setStep("tipo");
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
                <p className="font-semibold">
                  {formData.tipo_credito === "simple" && "Crédito Simple"}
                  {formData.tipo_credito === "revolvente" && "Crédito Revolvente"}
                  {formData.tipo_credito === "tarjeta_corporativa" && "Tarjeta de Crédito Corporativa"}
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={handleBack}>
                Cambiar tipo
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del {esLineaCredito ? "Instrumento" : "Crédito"} *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder={esLineaCredito ? "Ej: Amex Corporativa" : "Ej: Crédito Equipamiento"}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="institucion">Institución Financiera *</Label>
                <InstitucionFinancieraSelector
                  value={formData.institucion_financiera_id}
                  onChange={(id, nombre) => {
                    setFormData({ 
                      ...formData, 
                      institucion_financiera_id: id,
                      institucion_financiera: nombre 
                    });
                  }}
                />
                {selectedInstitucion && (
                  <Card className="mt-2 p-3 bg-muted">
                    <div className="flex items-center gap-3">
                      {selectedInstitucion.logo_url && (
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={selectedInstitucion.logo_url} />
                          <AvatarFallback>{selectedInstitucion.nombre[0]}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{selectedInstitucion.nombre}</p>
                        {selectedInstitucion.ejecutivo_nombre && (
                          <p className="text-sm text-muted-foreground">
                            Ejecutivo: {selectedInstitucion.ejecutivo_nombre}
                            {selectedInstitucion.ejecutivo_telefono && ` • ${selectedInstitucion.ejecutivo_telefono}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* Mostrar número de cuenta solo para tarjeta corporativa y créditos simples, NO para revolvente */}
              {!esRevolvente && (
                <div className="space-y-2">
                  <Label htmlFor="numero_cuenta">Número de {esLineaCredito ? "Tarjeta/Cuenta" : "Cuenta/Contrato"}</Label>
                  <Input
                    id="numero_cuenta"
                    value={formData.numero_cuenta}
                    onChange={(e) => setFormData({ ...formData, numero_cuenta: e.target.value })}
                    placeholder={esLineaCredito ? "**** **** **** 1234" : "Ej: 123456789"}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="monto_total">{esLineaCredito ? "Límite de Crédito" : "Monto del Préstamo"} *</Label>
                <Input
                  id="monto_total"
                  type="number"
                  step="0.01"
                  value={formData.monto_total}
                  onChange={(e) => setFormData({ ...formData, monto_total: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tasa_interes">Tasa de Interés Anual (%) *</Label>
                <Input
                  id="tasa_interes"
                  type="number"
                  step="0.01"
                  value={formData.tasa_interes}
                  onChange={(e) => setFormData({ ...formData, tasa_interes: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Campos de fecha para crédito revolvente */}
              {esRevolvente && (
                <>
                  <div className="space-y-2">
                    <Label>Fecha de Registro *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
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

              {!esLineaCredito && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="plazo_meses">Plazo (meses) *</Label>
                    <Input
                      id="plazo_meses"
                      type="number"
                      value={formData.plazo_meses}
                      onChange={(e) => setFormData({ ...formData, plazo_meses: e.target.value })}
                      placeholder="12"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Fecha de Inicio *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
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
                        {fechaVencimiento ? format(fechaVencimiento, "PPP") : "Se calculará automáticamente"}
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
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder={esLineaCredito ? "Detalles adicionales sobre la línea de crédito..." : "Propósito del préstamo..."}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="condiciones">Condiciones y Términos</Label>
              <Textarea
                id="condiciones"
                value={formData.condiciones}
                onChange={(e) => setFormData({ ...formData, condiciones: e.target.value })}
                placeholder="Garantías, seguros, comisiones, etc."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleBack} className="w-1/3">
                Atrás
              </Button>
              <Button type="submit" className="flex-1">
                Registrar {esLineaCredito ? "Línea de Crédito" : "Préstamo"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default RegistroFinanciamientoForm;
