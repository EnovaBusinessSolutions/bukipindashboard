import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { Alert, AlertDescription } from "@/components/ui/alert";

const RegistroDisposicionForm = () => {
  const { financiamientos } = useFinanciamientos();
  const [formData, setFormData] = useState({
    financiamiento_id: "",
    monto: "",
    descripcion: "",
    metodo_pago: "",
    numero_referencia: "",
  });
  const [fecha, setFecha] = useState<Date>(new Date());

  // Filtrar solo créditos revolventes (no tarjetas de crédito)
  const lineasRevolventes = financiamientos.filter(
    (f) => f.tipo_credito === "revolvente" && f.estado === "activo"
  );

  const financiamientoSeleccionado = lineasRevolventes.find(
    (f) => f.id === formData.financiamiento_id
  );

  const limiteDisponible = financiamientoSeleccionado
    ? financiamientoSeleccionado.monto_total - financiamientoSeleccionado.saldo_actual
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const monto = parseFloat(formData.monto);

    if (monto > limiteDisponible) {
      alert(`El monto excede el límite disponible de $${limiteDisponible.toFixed(2)}`);
      return;
    }

    // TODO: Implementar la lógica para registrar la disposición
    console.log("Registrando disposición:", {
      ...formData,
      fecha: format(fecha, "yyyy-MM-dd"),
      monto,
    });

    // Reset form
    setFormData({
      financiamiento_id: "",
      monto: "",
      descripcion: "",
      metodo_pago: "",
      numero_referencia: "",
    });
    setFecha(new Date());
  };

  if (lineasRevolventes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registro de Disposición</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No hay líneas de crédito revolventes disponibles para disponer.
              Para utilizar esta opción, primero registra un Crédito Revolvente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Disposición</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="financiamiento_id">Línea de Crédito *</Label>
              <Select
                value={formData.financiamiento_id}
                onValueChange={(value) => setFormData({ ...formData, financiamiento_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la línea de crédito" />
                </SelectTrigger>
                <SelectContent>
                  {lineasRevolventes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nombre} - {f.institucion_financiera} (Disponible: $
                      {(f.monto_total - f.saldo_actual).toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      })}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {financiamientoSeleccionado && (
              <div className="col-span-2 p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Límite Total:</span>
                  <span className="font-medium">
                    ${financiamientoSeleccionado.monto_total.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo Utilizado:</span>
                  <span className="font-medium text-red-600">
                    ${financiamientoSeleccionado.saldo_actual.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Límite Disponible:</span>
                  <span className="font-semibold text-green-600">
                    ${limiteDisponible.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="monto">Monto a Disponer *</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                placeholder="0.00"
                required
                max={limiteDisponible}
              />
              {formData.monto && parseFloat(formData.monto) > limiteDisponible && (
                <p className="text-sm text-red-600">
                  El monto excede el límite disponible
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Fecha de Disposición *</Label>
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
              <Label htmlFor="metodo_pago">Método de Pago</Label>
              <Select
                value={formData.metodo_pago}
                onValueChange={(value) => setFormData({ ...formData, metodo_pago: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="domiciliacion">Domiciliación</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_referencia">Número de Referencia</Label>
              <Input
                id="numero_referencia"
                value={formData.numero_referencia}
                onChange={(e) => setFormData({ ...formData, numero_referencia: e.target.value })}
                placeholder="Folio, referencia o número de operación"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción *</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Describe el propósito de esta disposición..."
              rows={3}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={!formData.financiamiento_id}>
            Registrar Disposición
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistroDisposicionForm;
