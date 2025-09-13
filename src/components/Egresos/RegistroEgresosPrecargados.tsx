import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, AlertCircle, Save, Calculator } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const RegistroEgresosPrecargados = () => {
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitMeasure, setUnitMeasure] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
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

  const handleQuantityChange = (newQuantity: string) => {
    setQuantity(newQuantity);
    if (unitPrice && newQuantity) {
      const total = (parseFloat(unitPrice) * parseFloat(newQuantity)).toFixed(2);
      setTotalAmount(total);
    }
  };

  const handleUnitPriceChange = (price: string) => {
    setUnitPrice(price);
    if (quantity && price) {
      const total = (parseFloat(price) * parseFloat(quantity)).toFixed(2);
      setTotalAmount(total);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct || !quantity || !unitPrice || !paymentType) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa todos los campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    console.log("Egreso precargado registrado:", {
      selectedProduct,
      quantity,
      unitMeasure,
      unitPrice,
      totalAmount,
      paymentType,
      paymentMethod,
      paidAmount,
      dueDate,
      supplierName,
      supplierPhone,
      supplierEmail,
      supplierRFC,
      description
    });

    toast({
      title: "Egreso registrado",
      description: "El costo/gasto precargado se ha registrado correctamente"
    });
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Registro de Costos y Gastos Precargados
        </CardTitle>
        <CardDescription>
          Registra gastos y costos de productos precargados del catálogo con unidades de medida específicas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Los productos deben estar registrados en el catálogo para poder seleccionarlos aquí.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selección de Producto */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información del Producto</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="producto">Producto Precargado *</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto del catálogo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cemento">Cemento - kg</SelectItem>
                    <SelectItem value="gasolina">Gasolina - litros</SelectItem>
                    <SelectItem value="acero">Varillas de Acero - metros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cantidad">Cantidad *</Label>
                <Input
                  id="cantidad"
                  type="number"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unidad">Unidad de Medida</Label>
                <Input
                  id="unidad"
                  value={unitMeasure}
                  onChange={(e) => setUnitMeasure(e.target.value)}
                  placeholder="kg, litros, metros, etc."
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="precio-unitario">Precio Unitario *</Label>
                <Input
                  id="precio-unitario"
                  type="number"
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => handleUnitPriceChange(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total">Monto Total</Label>
                <div className="flex items-center space-x-2">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="total"
                    type="number"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0.00"
                    disabled
                  />
                </div>
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
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
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
            <h3 className="text-lg font-semibold">Información del Proveedor</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proveedor-nombre">Nombre del Proveedor</Label>
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
                  placeholder="RFC del proveedor"
                />
              </div>
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
              Registrar Egreso
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistroEgresosPrecargados;