import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Save } from "lucide-react";

const RegistroEgresos = () => {
  const [formData, setFormData] = useState({
    concepto: "",
    monto: "",
    proveedor: "",
    categoria: "",
    metodoPago: "",
    fecha: "",
    descripcion: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Egreso registrado:", formData);
    // Aquí iría la lógica para registrar el egreso
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Save className="h-5 w-5" />
          Registro de Egresos
        </CardTitle>
        <CardDescription>
          Registra gastos, compras y otros egresos de la empresa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="concepto">Concepto del Gasto</Label>
              <Input
                id="concepto"
                value={formData.concepto}
                onChange={(e) => setFormData({...formData, concepto: e.target.value})}
                placeholder="Ej: Compra de materiales"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto">Monto</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                value={formData.monto}
                onChange={(e) => setFormData({...formData, monto: e.target.value})}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proveedor">Proveedor</Label>
              <Input
                id="proveedor"
                value={formData.proveedor}
                onChange={(e) => setFormData({...formData, proveedor: e.target.value})}
                placeholder="Nombre del proveedor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Select onValueChange={(value) => setFormData({...formData, categoria: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="materiales">Materiales</SelectItem>
                  <SelectItem value="servicios">Servicios</SelectItem>
                  <SelectItem value="gastos-operativos">Gastos Operativos</SelectItem>
                  <SelectItem value="gastos-administrativos">Gastos Administrativos</SelectItem>
                  <SelectItem value="otros">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metodoPago">Método de Pago</Label>
              <Select onValueChange={(value) => setFormData({...formData, metodoPago: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción Adicional</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
              placeholder="Detalles adicionales del gasto..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
            <Button type="submit" className="gap-2">
              <Save className="h-4 w-4" />
              Registrar Egreso
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistroEgresos;