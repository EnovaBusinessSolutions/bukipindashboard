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
import { useCuentas } from "@/hooks/useCuentas";
import { Alert, AlertDescription } from "@/components/ui/alert";

const RegistroCargoTarjetaForm = () => {
  const { financiamientos, crearCargoTarjeta } = useFinanciamientos();
  const { data: cuentasData } = useCuentas();
  
  const [formData, setFormData] = useState({
    financiamiento_id: "",
    monto: "",
    cuenta_gasto: "",
    descripcion: "",
    proveedor: "",
  });
  const [fecha, setFecha] = useState<Date>(new Date());

  // Filtrar solo tarjetas de crédito activas
  const tarjetasCredito = financiamientos.filter(
    (f) => f.tipo_credito === "tarjeta_corporativa" && f.estado === "activo"
  );

  const tarjetaSeleccionada = tarjetasCredito.find(
    (f) => f.id === formData.financiamiento_id
  );

  const limiteDisponible = tarjetaSeleccionada
    ? tarjetaSeleccionada.monto_total - tarjetaSeleccionada.saldo_actual
    : 0;

  // Obtener cuentas de gastos (5XXX)
  const cuentasGastos = cuentasData?.cuentasFlat?.filter(
    (c) => c.codigo.startsWith("5")
  ) || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const monto = parseFloat(formData.monto);

    if (monto > limiteDisponible) {
      alert(`El monto excede el límite disponible de $${limiteDisponible.toFixed(2)}`);
      return;
    }

    if (!formData.cuenta_gasto) {
      alert("Selecciona la cuenta contable de gasto");
      return;
    }

    crearCargoTarjeta.mutate({
      financiamiento_id: formData.financiamiento_id,
      monto,
      fecha: format(fecha, "yyyy-MM-dd"),
      cuenta_gasto: formData.cuenta_gasto,
      descripcion: formData.descripcion,
      proveedor: formData.proveedor || undefined,
    }, {
      onSuccess: () => {
        // Reset form
        setFormData({
          financiamiento_id: "",
          monto: "",
          cuenta_gasto: "",
          descripcion: "",
          proveedor: "",
        });
        setFecha(new Date());
      }
    });
  };

  if (tarjetasCredito.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registro de Cargo a Tarjeta</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No hay tarjetas de crédito corporativas disponibles.
              Para utilizar esta opción, primero registra una Tarjeta de Crédito Corporativa.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Cargo a Tarjeta de Crédito</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="financiamiento_id">Tarjeta de Crédito *</Label>
              <Select
                value={formData.financiamiento_id}
                onValueChange={(value) => setFormData({ ...formData, financiamiento_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la tarjeta" />
                </SelectTrigger>
                <SelectContent>
                  {tarjetasCredito.map((f) => (
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

            {formData.financiamiento_id && tarjetaSeleccionada && (
              <div className="col-span-2 p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Límite Total</p>
                    <p className="font-semibold">
                      ${tarjetaSeleccionada.monto_total.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Saldo Utilizado</p>
                    <p className="font-semibold text-destructive">
                      ${tarjetaSeleccionada.saldo_actual.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Límite Disponible</p>
                    <p className="font-semibold text-primary">
                      ${limiteDisponible.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="monto">Monto del Cargo *</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha del Cargo *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fecha && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fecha ? format(fecha, "PPP", { locale: require("date-fns/locale/es") }) : "Selecciona fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={fecha}
                    onSelect={(date) => date && setFecha(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="cuenta_gasto">Cuenta Contable de Gasto *</Label>
              <Select
                value={formData.cuenta_gasto}
                onValueChange={(value) => setFormData({ ...formData, cuenta_gasto: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la cuenta de gasto" />
                </SelectTrigger>
                <SelectContent>
                  {cuentasGastos.map((cuenta) => (
                    <SelectItem key={cuenta.codigo} value={cuenta.codigo}>
                      {cuenta.codigo} - {cuenta.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="descripcion">Descripción del Cargo *</Label>
              <Input
                id="descripcion"
                placeholder="Ej: Compra de materiales, Comida de oficina, etc."
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="proveedor">Proveedor (Opcional)</Label>
              <Input
                id="proveedor"
                placeholder="Nombre del proveedor"
                value={formData.proveedor}
                onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={!formData.financiamiento_id || crearCargoTarjeta.isPending}
          >
            {crearCargoTarjeta.isPending ? "Registrando..." : "Registrar Cargo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistroCargoTarjetaForm;
