import React, { useState } from "react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const RegistroCargoInteresForm = () => {
  const { financiamientos, crearTransaccion } = useFinanciamientos();
  const { data: saldos } = useSaldosDisponibles();
  const [financiamientoId, setFinanciamientoId] = useState("");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState<Date>(new Date());
  const [tipoPago, setTipoPago] = useState<"pagado" | "pendiente">("pendiente");
  const [metodoPago, setMetodoPago] = useState("");
  const [mostrarAdvertenciaEfectivo, setMostrarAdvertenciaEfectivo] = useState(false);

  const financiamientoSeleccionado = financiamientos.find(f => f.id === financiamientoId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!financiamientoSeleccionado) return;

    const montoInteres = parseFloat(monto);
    
    // Validar solo si el tipo de pago es "pagado"
    if (tipoPago === "pagado") {
      // FASE 1: Verificar que los saldos se hayan cargado
      if (!saldos) {
        toast.error("Error de validación", {
          description: "No se pudieron cargar los saldos disponibles. Intenta nuevamente."
        });
        return;
      }

      // FASE 2: Validar saldo disponible según método de pago
      if (metodoPago === "efectivo") {
        if (montoInteres > saldos.efectivo) {
          toast.error("💰 Saldo insuficiente en efectivo", {
            description: `Disponible: $${saldos.efectivo.toLocaleString('es-MX', { minimumFractionDigits: 2 })} | Necesitas: $${montoInteres.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
          });
          return;
        }
      }
      
      if (metodoPago === "transferencia") {
        if (montoInteres > saldos.bancos) {
          toast.error("🏦 Saldo insuficiente en bancos", {
            description: `Disponible: $${saldos.bancos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} | Necesitas: $${montoInteres.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
          });
          return;
        }
      }
    }
    
    // Si es PENDIENTE: aumenta el saldo
    // Si es PAGADO: NO aumenta el saldo
    const nuevoSaldo = tipoPago === "pendiente" 
      ? financiamientoSeleccionado.saldo_actual + montoInteres
      : financiamientoSeleccionado.saldo_actual;

    // Mejorar la construcción de la descripción final
    const descripcionFinal = descripcion.trim() 
      ? `${descripcion.trim()} (${tipoPago === "pagado" ? "Pagado" : "Pendiente"})`
      : `Cargo de intereses (${tipoPago === "pagado" ? "Pagado" : "Pendiente"})`;

    crearTransaccion.mutate({
      financiamiento_id: financiamientoId,
      tipo_transaccion: "cargo_interes",
      monto: montoInteres,
      fecha: format(fecha, "yyyy-MM-dd"),
      capital_pagado: 0,
      interes_pagado: tipoPago === "pagado" ? montoInteres : 0,
      saldo_restante: nuevoSaldo,
      metodo_pago: tipoPago === "pagado" ? metodoPago : null,
      descripcion: descripcionFinal,
    });

    // Reset form
    setFinanciamientoId("");
    setMonto("");
    setTipoPago("pendiente");
    setMetodoPago("");
    setDescripcion("");
    setFecha(new Date());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Cargo por Intereses</CardTitle>
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
                  .filter(f => f.estado === "activo")
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nombre} - {f.institucion_financiera}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {financiamientoSeleccionado && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm">
                <span className="font-medium">Institución:</span> {financiamientoSeleccionado.institucion_financiera}
              </p>
              <p className="text-sm">
                <span className="font-medium">Saldo Actual:</span> ${financiamientoSeleccionado.saldo_actual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm">
                <span className="font-medium">Tasa:</span> {financiamientoSeleccionado.tasa_interes}%
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="monto">Monto del Cargo *</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoPago">Tipo de Pago *</Label>
            <Select value={tipoPago} onValueChange={(value: "pagado" | "pendiente") => setTipoPago(value)} required>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente (se acumula al saldo)</SelectItem>
                <SelectItem value="pagado">Pagado (reducir efectivo/bancos)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoPago === "pagado" && (
            <div className="space-y-2">
              <Label htmlFor="metodoPago">Método de Pago *</Label>
              <Select 
                value={metodoPago} 
                onValueChange={(value) => {
                  setMetodoPago(value);
                  // Si elige efectivo, mostrar advertencia
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
                    <div className="flex items-center justify-between w-full">
                      <span>Efectivo</span>
                      <span className="text-xs text-muted-foreground ml-4">
                        (Disponible: ${saldos?.efectivo.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'})
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="transferencia">
                    <div className="flex items-center justify-between w-full">
                      <span>Transferencia</span>
                      <span className="text-xs text-muted-foreground ml-4">
                        (Disponible: ${saldos?.bancos.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'})
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Fecha del Cargo *</Label>
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

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalla el motivo del cargo (intereses ordinarios, moratorios, comisión, etc.)"
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full">
            Registrar Cargo
          </Button>
        </form>

        {/* Advertencia para pagos en efectivo */}
        <AlertDialog open={mostrarAdvertenciaEfectivo} onOpenChange={setMostrarAdvertenciaEfectivo}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>⚠️ Advertencia: Pago en Efectivo</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Has seleccionado <strong>Efectivo</strong> como método de pago.
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
              <AlertDialogCancel onClick={() => {
                setMetodoPago("");
                setMostrarAdvertenciaEfectivo(false);
              }}>
                Cambiar a Transferencia
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                setMostrarAdvertenciaEfectivo(false);
              }}>
                Continuar con Efectivo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default RegistroCargoInteresForm;
