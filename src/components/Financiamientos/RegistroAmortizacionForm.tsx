import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { Textarea } from "@/components/ui/textarea";
import { useSaldosDisponibles } from "@/hooks/useSaldosDisponibles";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const RegistroAmortizacionForm = () => {
  const { financiamientos, transacciones, crearTransaccion } = useFinanciamientos();
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

  const financiamientoSeleccionado = financiamientos.find(f => f.id === financiamientoId);

  // Función para calcular la cuota mensual de un crédito simple (Amortización Francesa)
  const calcularCuotaMensual = (monto: number, tasaAnual: number, plazoMeses: number) => {
    const tasaMensual = tasaAnual / 12 / 100; // Convertir tasa anual a mensual
    const numerador = tasaMensual * Math.pow(1 + tasaMensual, plazoMeses);
    const denominador = Math.pow(1 + tasaMensual, plazoMeses) - 1;
    return monto * (numerador / denominador);
  };

  // Función para desglosar la cuota en capital e intereses
  const desglosarCuota = (saldoActual: number, cuotaMensual: number, tasaAnual: number) => {
    const tasaMensual = tasaAnual / 12 / 100;
    const interesPeriodo = saldoActual * tasaMensual;
    const capitalAmortizado = cuotaMensual - interesPeriodo;
    
    return {
      interes: Math.max(0, interesPeriodo),
      capital: Math.max(0, capitalAmortizado),
      cuotaTotal: cuotaMensual
    };
  };

  // Calcular saldos desglosados para el financiamiento seleccionado
  const calcularSaldosDesglosados = () => {
    if (!financiamientoSeleccionado) {
      return { capitalPendiente: 0, interesesPendientes: 0 };
    }

    // Filtrar transacciones del financiamiento seleccionado
    const transaccionesFinanciamiento = transacciones.filter(
      t => t.financiamiento_id === financiamientoSeleccionado.id
    );

    // Calcular intereses devengados (todos los cargos de interés)
    const interesesDevengados = transaccionesFinanciamiento
      .filter(t => t.tipo_transaccion === 'cargo_interes')
      .reduce((sum, t) => sum + t.monto, 0);

    // Calcular intereses pagados (incluye amortizaciones Y cargos pagados al momento)
    const interesesPagados = transaccionesFinanciamiento
      .filter(t => t.tipo_transaccion === 'amortizacion' || t.tipo_transaccion === 'cargo_interes')
      .reduce((sum, t) => sum + (t.interes_pagado || 0), 0);

    // Intereses pendientes
    const interesesPendientes = Math.max(0, interesesDevengados - interesesPagados);

    // Capital pendiente = Saldo actual - Intereses pendientes
    const capitalPendiente = Math.max(0, financiamientoSeleccionado.saldo_actual - interesesPendientes);

    return { capitalPendiente, interesesPendientes };
  };

  const { capitalPendiente, interesesPendientes } = calcularSaldosDesglosados();

  // Auto-llenar capital para créditos simples
  useEffect(() => {
    if (!financiamientoSeleccionado) return;
    
    // Solo aplicar para créditos simples
    if (financiamientoSeleccionado.tipo_credito === 'simple') {
      // Cálculo simple: dividir monto total entre plazo
      const capitalMensual = financiamientoSeleccionado.monto_total / financiamientoSeleccionado.plazo_meses;
      
      // Pre-llenar solo el capital
      setCapitalPagado(capitalMensual.toFixed(2));
      setInteresPagado("0"); // Los intereses se registran por separado
      
      // Mostrar notificación informativa
      toast({
        title: "✅ Capital mensual calculado",
        description: `Pago mensual de capital: $${formatCurrency(capitalMensual)}. Los intereses se registran por separado.`,
        duration: 5000,
      });
    } else {
      // Para créditos revolventes y tarjetas, limpiar los campos
      setCapitalPagado("");
      setInteresPagado("");
    }
  }, [financiamientoId, financiamientoSeleccionado, toast]);

  // Calcular monto total automáticamente
  useEffect(() => {
    const capital = parseFloat(capitalPagado) || 0;
    const interes = parseFloat(interesPagado) || 0;
    const total = capital + interes;
    setMonto(total > 0 ? total.toString() : "");
  }, [capitalPagado, interesPagado]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!financiamientoSeleccionado) return;

    const montoTotal = parseFloat(monto);
    const capital = parseFloat(capitalPagado);
    const interes = parseFloat(interesPagado);

    // Validar que no se pague más de lo que debe
    // Capital: Se permite pagar más del saldo (genera saldo a favor en tarjetas de crédito)

    if (interes > interesesPendientes) {
      toast({
        title: "Error en el monto",
        description: `No puedes pagar más intereses de los pendientes. Máximo: $${formatCurrency(interesesPendientes)}`,
        variant: "destructive",
      });
      return;
    }

    // FASE 1: Verificar que los saldos se hayan cargado
    if (!saldos) {
      toast({
        title: "⚠️ Error de validación",
        description: "No se pudieron cargar los saldos disponibles. Intenta nuevamente.",
        variant: "destructive"
      });
      return;
    }

    // FASE 2: Validar fondos suficientes
    if (metodoPago === "efectivo" && montoTotal > saldos.efectivo) {
      toast({
        title: "💰 Saldo insuficiente en efectivo",
        description: `Disponible: $${formatCurrency(saldos.efectivo)} | Necesitas: $${formatCurrency(montoTotal)}`,
        variant: "destructive",
      });
      return;
    }

    if (metodoPago === "transferencia" && montoTotal > saldos.bancos) {
      toast({
        title: "🏦 Saldo insuficiente en bancos",
        description: `Disponible: $${formatCurrency(saldos.bancos)} | Necesitas: $${formatCurrency(montoTotal)}`,
        variant: "destructive",
      });
      return;
    }

    const nuevoSaldo = Math.max(0, financiamientoSeleccionado.saldo_actual - capital);

    crearTransaccion.mutate({
      financiamiento_id: financiamientoId,
      tipo_transaccion: "amortizacion",
      monto: montoTotal,
      fecha: format(fecha, "yyyy-MM-dd"),
      capital_pagado: capital,
      interes_pagado: interes,
      saldo_restante: nuevoSaldo,
      metodo_pago: metodoPago,
      numero_referencia: numeroReferencia,
      descripcion,
    });

    // Reset form
    setFinanciamientoId("");
    setMonto("");
    setCapitalPagado("");
    setInteresPagado("");
    setMetodoPago("");
    setNumeroReferencia("");
    setDescripcion("");
    setFecha(new Date());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Amortización</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="financiamiento">Financiamiento *</Label>
            <Select value={financiamientoId} onValueChange={setFinanciamientoId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un financiamiento" />
              </SelectTrigger>
              <SelectContent>
                {financiamientos
                  .filter(f => f.estado === "activo" && f.saldo_actual > 0)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nombre} - Saldo: ${f.saldo_actual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {financiamientoSeleccionado?.tipo_credito === 'simple' && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 <strong>Crédito Simple:</strong> El capital mensual se calcula automáticamente (${formatCurrency(financiamientoSeleccionado.monto_total)} ÷ {financiamientoSeleccionado.plazo_meses} meses = ${formatCurrency(financiamientoSeleccionado.monto_total / financiamientoSeleccionado.plazo_meses)}). Los intereses se registran por separado.
              </p>
            </div>
          )}

          {financiamientoSeleccionado && (
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg space-y-3 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  <span className="font-medium">Institución:</span> {financiamientoSeleccionado.institucion_financiera}
                </p>
                <p className="text-xs text-muted-foreground">
                  Tasa: {financiamientoSeleccionado.tasa_interes}%
                </p>
              </div>
              
              <div className="h-px bg-blue-200 dark:bg-blue-800"></div>
              
              {/* Saldos Desglosados */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-gray-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-muted-foreground mb-1">Capital Pendiente</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    ${capitalPendiente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                
                <div className="bg-white dark:bg-gray-950 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                  <p className="text-xs text-muted-foreground mb-1">Intereses Pendientes</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    ${interesesPendientes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              
              {/* Saldo Total */}
              <div className="bg-white dark:bg-gray-950 p-3 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Saldo Total a Pagar:</p>
                  <p className="text-xl font-bold text-foreground">
                    ${financiamientoSeleccionado.saldo_actual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              
              {/* Indicador de intereses pendientes */}
              {interesesPendientes > 0 && (
                <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 p-2 rounded-lg border border-orange-200 dark:border-orange-800">
                  <span className="font-medium">⚠️ Tienes intereses pendientes</span>
                  <span className="text-muted-foreground">
                    ({((interesesPendientes / financiamientoSeleccionado.saldo_actual) * 100).toFixed(1)}% del saldo total)
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capital">Capital Pagado *</Label>
              <Input
                id="capital"
                type="number"
                step="0.01"
                value={capitalPagado}
                onChange={(e) => setCapitalPagado(e.target.value)}
                placeholder={`Pendiente: $${capitalPendiente.toLocaleString('es-MX', { minimumFractionDigits: 2 })} (puedes pagar más)`}
                required
              />
              <p className="text-xs text-muted-foreground">
                Capital pendiente: ${capitalPendiente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interes">Interés Pagado *</Label>
              <Input
                id="interes"
                type="number"
                step="0.01"
                max={interesesPendientes}
                value={interesPagado}
                onChange={(e) => {
                  const valor = parseFloat(e.target.value) || 0;
                  if (valor <= interesesPendientes) {
                    setInteresPagado(e.target.value);
                  } else {
                    setInteresPagado(interesesPendientes.toString());
                    toast({
                      title: "Límite alcanzado",
                      description: `No puedes pagar más de $${interesesPendientes.toLocaleString('es-MX', { minimumFractionDigits: 2 })} en intereses`,
                      variant: "destructive",
                    });
                  }
                }}
                placeholder={`Máx: $${interesesPendientes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                required
              />
            <p className="text-xs text-muted-foreground">
              Intereses pendientes: ${interesesPendientes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Previsualización del Saldo Restante */}
          {financiamientoSeleccionado && (capitalPagado || interesPagado) && (
            <div className="col-span-2 p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg space-y-3 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                  📊 Previsualización después del pago
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-gray-950 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                <p className="text-xs text-muted-foreground mb-1">
                  {(capitalPendiente - (parseFloat(capitalPagado) || 0)) < 0 ? "Saldo a Favor" : "Capital que quedará"}
                </p>
                <p className={`text-lg font-bold ${
                  (capitalPendiente - (parseFloat(capitalPagado) || 0)) < 0 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-purple-600 dark:text-purple-400"
                }`}>
                  ${Math.abs(capitalPendiente - (parseFloat(capitalPagado) || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
                
                <div className="bg-white dark:bg-gray-950 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                  <p className="text-xs text-muted-foreground mb-1">Intereses que quedarán</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    ${Math.max(0, interesesPendientes - (parseFloat(interesPagado) || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              
              <div className={cn(
                "p-3 rounded-lg border-2",
                (capitalPendiente - (parseFloat(capitalPagado) || 0)) <= 0 && (interesesPendientes - (parseFloat(interesPagado) || 0)) === 0
                  ? "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700"
                  : "bg-white dark:bg-gray-950 border-purple-300 dark:border-purple-700"
              )}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {(capitalPendiente - (parseFloat(capitalPagado) || 0)) <= 0 && (interesesPendientes - (parseFloat(interesPagado) || 0)) === 0
                      ? `✅ Deuda liquidada completamente${(capitalPendiente - (parseFloat(capitalPagado) || 0)) < 0 ? " (con saldo a favor)" : ""}`
                      : "Saldo Total que quedará:"
                    }
                  </p>
                  {((capitalPendiente - (parseFloat(capitalPagado) || 0)) > 0 || (interesesPendientes - (parseFloat(interesPagado) || 0)) > 0) && (
                    <p className="text-xl font-bold text-foreground">
                      ${(Math.max(0, capitalPendiente - (parseFloat(capitalPagado) || 0)) + Math.max(0, interesesPendientes - (parseFloat(interesPagado) || 0))).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 col-span-2">
            <Label htmlFor="monto">Monto Total del Pago (calculado automáticamente)</Label>
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
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">
                    Efectivo {saldos && `(Disponible: $${saldos.efectivo.toLocaleString('es-MX', { minimumFractionDigits: 2 })})`}
                  </SelectItem>
                  <SelectItem value="transferencia">
                    Transferencia/Bancos {saldos && `(Disponible: $${saldos.bancos.toLocaleString('es-MX', { minimumFractionDigits: 2 })})`}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha del Pago *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
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
            />
          </div>

          <Button type="submit" className="w-full">
            Registrar Amortización
          </Button>

          {/* Advertencia para pagos en efectivo */}
          <AlertDialog open={mostrarAdvertenciaEfectivo} onOpenChange={setMostrarAdvertenciaEfectivo}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>⚠️ Advertencia: Pago en Efectivo</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    Has seleccionado <strong>Efectivo</strong> como método de pago para esta amortización.
                  </p>
                  <p className="text-amber-600 dark:text-amber-400">
                    Ten en cuenta que los pagos a instituciones financieras <strong>regularmente se realizan por transferencia bancaria</strong>.
                  </p>
                  <p>
                    ¿Estás seguro de que deseas continuar con el pago en efectivo?
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setMetodoPago("")}>
                  Cancelar y cambiar
                </AlertDialogCancel>
                <AlertDialogAction onClick={() => setMostrarAdvertenciaEfectivo(false)}>
                  Sí, continuar con efectivo
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
