import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Receipt, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const RegistroOtrosGastos = () => {
  const [concept, setConcept] = useState("");
  const [category, setCategory] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierRFC, setSupplierRFC] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!concept || !category || !totalAmount || !paymentType) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa todos los campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    try {
      const montoTotal = parseFloat(totalAmount);
      const montoPagado = paymentType === "contado" ? montoTotal : (paymentType === "parcial" ? parseFloat(paidAmount) || 0 : 0);
      const montoPendiente = montoTotal - montoPagado;

      const { data, error } = await supabase
        .from('transacciones_egresos')
        .insert({
          tipo_egreso: 'otro',
          subtipo_egreso: category,
          descripcion: concept,
          concepto: concept,
          monto_total: montoTotal,
          monto_pagado: montoPagado,
          monto_pendiente: montoPendiente,
          tipo_pago: paymentType,
          metodo_pago: paymentMethod || null,
          fecha_vencimiento: dueDate || null,
          proveedor_nombre: supplierName || null,
          proveedor_telefono: supplierPhone || null,
          proveedor_email: supplierEmail || null,
          proveedor_rfc: supplierRFC || null,
          comentarios: description || null,
          user_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      toast({
        title: "✅ Gasto registrado",
        description: "El gasto fuera de operación se ha registrado correctamente"
      });

      // Limpiar formulario
      setConcept("");
      setCategory("");
      setTotalAmount("");
      setPaymentType("");
      setPaymentMethod("");
      setPaidAmount("");
      setDueDate("");
      setSupplierName("");
      setSupplierPhone("");
      setSupplierEmail("");
      setSupplierRFC("");
      setDescription("");
    } catch (error) {
      console.error('Error al registrar gasto:', error);
      toast({
        title: "❌ Error",
        description: "No se pudo registrar el gasto. Intenta nuevamente.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Registro de Otros Gastos
        </CardTitle>
        <CardDescription>
          Registra gastos que están fuera de la operación normal para poder identificarlos separadamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información del Gasto */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información del Gasto</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="concepto">Concepto del Gasto *</Label>
                <Input
                  id="concepto"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Ej: Donaciones, multas, gastos personales"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="donaciones">Donaciones</SelectItem>
                    <SelectItem value="multas-sanciones">Multas y Sanciones</SelectItem>
                    <SelectItem value="gastos-personales">Gastos Personales</SelectItem>
                    <SelectItem value="eventos-especiales">Eventos Especiales</SelectItem>
                    <SelectItem value="regalos-cortesias">Regalos y Cortesías</SelectItem>
                    <SelectItem value="perdidas-extraordinarias">Pérdidas Extraordinarias</SelectItem>
                    <SelectItem value="gastos-legales">Gastos Legales</SelectItem>
                    <SelectItem value="entretenimiento">Entretenimiento</SelectItem>
                    <SelectItem value="viajes-personales">Viajes Personales</SelectItem>
                    <SelectItem value="otros-no-operativos">Otros No Operativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monto-total">Monto Total *</Label>
                <Input
                  id="monto-total"
                  type="number"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Información de Pago */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información de Pago</h3>
            
            <div className="space-y-2">
              <Label>Tipo de Pago *</Label>
              <RadioGroup value={paymentType} onValueChange={setPaymentType}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="contado" id="contado" />
                  <Label htmlFor="contado">Contado</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="credito" id="credito" />
                  <Label htmlFor="credito">Crédito</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="parcial" id="parcial" />
                  <Label htmlFor="parcial">Pago Parcial</Label>
                </div>
              </RadioGroup>
            </div>

            {(paymentType === "contado" || paymentType === "parcial") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metodo-pago">Método de Pago</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo (Caja - 1001)</SelectItem>
                      <SelectItem value="tarjeta-transferencia">Tarjeta/Transferencia (Bancos - 1002)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentType === "parcial" && (
                  <div className="space-y-2">
                    <Label htmlFor="monto-pagado">Monto Pagado</Label>
                    <Input
                      id="monto-pagado"
                      type="number"
                      step="0.01"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            )}

            {(paymentType === "credito" || paymentType === "parcial") && (
              <div className="space-y-2">
                <Label htmlFor="fecha-vencimiento">Fecha de Vencimiento</Label>
                <Input
                  id="fecha-vencimiento"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Información del Proveedor */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información del Proveedor/Beneficiario</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proveedor-nombre">Nombre del Proveedor/Beneficiario</Label>
                <Input
                  id="proveedor-nombre"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Nombre completo o razón social"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proveedor-telefono">Teléfono</Label>
                <Input
                  id="proveedor-telefono"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  placeholder="Número de teléfono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proveedor-email">Email</Label>
                <Input
                  id="proveedor-email"
                  type="email"
                  value={supplierEmail}
                  onChange={(e) => setSupplierEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proveedor-rfc">RFC</Label>
                <Input
                  id="proveedor-rfc"
                  value={supplierRFC}
                  onChange={(e) => setSupplierRFC(e.target.value)}
                  placeholder="RFC del proveedor/beneficiario"
                />
              </div>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Nota:</strong> Estos gastos se registran separadamente para identificar egresos que no forman parte de la operación normal del negocio.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción Adicional</Label>
            <Textarea
              id="descripcion"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              Registrar Gasto
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistroOtrosGastos;