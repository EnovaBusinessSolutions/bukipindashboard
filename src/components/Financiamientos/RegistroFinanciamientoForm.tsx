import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";

const RegistroFinanciamientoForm = () => {
  const { crearFinanciamiento } = useFinanciamientos();
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    tipo_credito: "",
    institucion_financiera: "",
    numero_cuenta: "",
    monto_total: "",
    tasa_interes: "",
    plazo_meses: "",
    condiciones: "",
  });
  const [fechaInicio, setFechaInicio] = useState<Date>(new Date());
  const [fechaVencimiento, setFechaVencimiento] = useState<Date>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fechaVencimiento) {
      return;
    }

    const monto = parseFloat(formData.monto_total);
    
    crearFinanciamiento.mutate({
      nombre: formData.nombre,
      descripcion: formData.descripcion,
      tipo_credito: formData.tipo_credito,
      institucion_financiera: formData.institucion_financiera,
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

    // Reset form
    setFormData({
      nombre: "",
      descripcion: "",
      tipo_credito: "",
      institucion_financiera: "",
      numero_cuenta: "",
      monto_total: "",
      tasa_interes: "",
      plazo_meses: "",
      condiciones: "",
    });
    setFechaInicio(new Date());
    setFechaVencimiento(undefined);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Nuevo Financiamiento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Financiamiento *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo_credito">Tipo de Crédito *</Label>
              <Select
                value={formData.tipo_credito}
                onValueChange={(value) => setFormData({ ...formData, tipo_credito: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Crédito Simple</SelectItem>
                  <SelectItem value="arrendamiento">Arrendamiento</SelectItem>
                  <SelectItem value="revolvente">Crédito Revolvente</SelectItem>
                  <SelectItem value="tarjeta_corporativa">Tarjeta de Crédito Corporativa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="institucion">Institución Financiera *</Label>
              <Input
                id="institucion"
                value={formData.institucion_financiera}
                onChange={(e) => setFormData({ ...formData, institucion_financiera: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_cuenta">Número de Cuenta/Contrato</Label>
              <Input
                id="numero_cuenta"
                value={formData.numero_cuenta}
                onChange={(e) => setFormData({ ...formData, numero_cuenta: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto_total">Monto Total *</Label>
              <Input
                id="monto_total"
                type="number"
                step="0.01"
                value={formData.monto_total}
                onChange={(e) => setFormData({ ...formData, monto_total: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tasa_interes">Tasa de Interés (%) *</Label>
              <Input
                id="tasa_interes"
                type="number"
                step="0.01"
                value={formData.tasa_interes}
                onChange={(e) => setFormData({ ...formData, tasa_interes: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plazo_meses">Plazo (meses) *</Label>
              <Input
                id="plazo_meses"
                type="number"
                value={formData.plazo_meses}
                onChange={(e) => setFormData({ ...formData, plazo_meses: e.target.value })}
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

            <div className="space-y-2">
              <Label>Fecha de Vencimiento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaVencimiento ? format(fechaVencimiento, "PPP") : "Selecciona fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={fechaVencimiento}
                    onSelect={setFechaVencimiento}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="condiciones">Condiciones del Crédito</Label>
            <Textarea
              id="condiciones"
              value={formData.condiciones}
              onChange={(e) => setFormData({ ...formData, condiciones: e.target.value })}
              placeholder="Incluye información sobre garantías, seguros, comisiones, etc."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full">
            Registrar Financiamiento
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistroFinanciamientoForm;
