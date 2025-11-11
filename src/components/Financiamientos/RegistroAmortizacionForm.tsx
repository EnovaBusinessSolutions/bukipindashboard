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
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

const RegistroAmortizacionForm = () => {
  const { financiamientos, crearTransaccion } = useFinanciamientos();
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

  const financiamientoSeleccionado = financiamientos.find(f => f.id === financiamientoId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!financiamientoSeleccionado) return;

    const montoTotal = parseFloat(monto);
    const capital = parseFloat(capitalPagado);
    const interes = parseFloat(interesPagado);

    // Validar fondos suficientes
    if (metodoPago === "efectivo" && saldos && montoTotal > saldos.efectivo) {
      toast({
        title: "Fondos insuficientes",
        description: `No tienes suficiente efectivo. Disponible: $${formatCurrency(saldos.efectivo)}`,
        variant: "destructive",
      });
      return;
    }

    if (metodoPago === "transferencia" && saldos && montoTotal > saldos.bancos) {
      toast({
        title: "Fondos insuficientes",
        description: `No tienes suficiente saldo en bancos. Disponible: $${formatCurrency(saldos.bancos)}`,
        variant: "destructive",
      });
      return;
    }

    const nuevoSaldo = financiamientoSeleccionado.saldo_actual - capital;

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capital">Capital Pagado *</Label>
              <Input
                id="capital"
                type="number"
                step="0.01"
                value={capitalPagado}
                onChange={(e) => setCapitalPagado(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interes">Interés Pagado *</Label>
              <Input
                id="interes"
                type="number"
                step="0.01"
                value={interesPagado}
                onChange={(e) => setInteresPagado(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="monto">Monto Total del Pago *</Label>
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
              <Label htmlFor="metodo_pago">Método de Pago *</Label>
              <Select value={metodoPago} onValueChange={setMetodoPago} required>
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
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistroAmortizacionForm;
