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
import { useProductosEgresos } from "@/hooks/useProductosEgresos";
import { useProveedores } from "@/hooks/useProveedores";
import { supabase } from "@/integrations/supabase/client";
const RegistroEgresosPrecargados = () => {
  const { data: productos = [] } = useProductosEgresos();
  const { proveedores, createProveedor } = useProveedores();
  const [selectedType, setSelectedType] = useState(""); // "costo" or "gasto"
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState("1");
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
  
  // Nuevos estados para el manejo de proveedores
  const [registrarProveedor, setRegistrarProveedor] = useState(false);
  const [tipoProveedor, setTipoProveedor] = useState(""); // "nuevo" o "existente"
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState("");

  // Filter products based on selected type
  const filteredProducts = productos.filter(p => p.tipo === selectedType);
  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    // Reset product selection when type changes
    setSelectedProductId("");
    setSelectedProduct(null);
    setSupplierName("");
    setUnitPrice("");
    setTotalAmount("");
  };
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const product = productos.find(p => p.id === productId);
    setSelectedProduct(product);
    if (product) {
      // Auto-fill data from catalog
      setSupplierName(product.proveedor_principal || "");
      setUnitPrice(product.precio_promedio?.toString() || "");

      // Recalculate total
      if (quantity && product.precio_promedio) {
        const total = (product.precio_promedio * parseFloat(quantity)).toFixed(2);
        setTotalAmount(total);
      }
    }
  };
  // Función para formatear números con separador de miles
  const formatNumber = (value: string) => {
    if (!value) return "";
    const num = parseFloat(value.replace(/,/g, ''));
    if (isNaN(num)) return "";
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleQuantityChange = (newQuantity: string) => {
    const cleanValue = newQuantity.replace(/,/g, '');
    setQuantity(cleanValue);
    if (unitPrice && cleanValue) {
      const total = (parseFloat(unitPrice.replace(/,/g, '')) * parseFloat(cleanValue)).toFixed(2);
      setTotalAmount(total);
    }
  };
  const handleUnitPriceChange = (price: string) => {
    const cleanValue = price.replace(/,/g, '');
    setUnitPrice(cleanValue);
    if (quantity && cleanValue) {
      const total = (parseFloat(cleanValue) * parseFloat(quantity.replace(/,/g, ''))).toFixed(2);
      setTotalAmount(total);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !quantity || !unitPrice || !paymentType) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa todos los campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    // Validar proveedor obligatorio para crédito y parcial
    if ((paymentType === "credito" || paymentType === "parcial") && !registrarProveedor) {
      toast({
        title: "⚠️ Proveedor requerido",
        description: "Para pagos a crédito o parciales es obligatorio registrar el proveedor",
        variant: "destructive"
      });
      return;
    }

    // Validar selección de proveedor si se decidió registrarlo
    if (registrarProveedor && !tipoProveedor) {
      toast({
        title: "⚠️ Tipo de proveedor requerido",
        description: "Selecciona si es un proveedor nuevo o existente",
        variant: "destructive"
      });
      return;
    }

    // Validar datos del proveedor si es nuevo
    if (registrarProveedor && tipoProveedor === "nuevo" && !supplierName) {
      toast({
        title: "⚠️ Nombre del proveedor requerido",
        description: "Ingresa el nombre del proveedor",
        variant: "destructive"
      });
      return;
    }

    // Validar selección de proveedor existente
    if (registrarProveedor && tipoProveedor === "existente" && !proveedorSeleccionado) {
      toast({
        title: "⚠️ Proveedor no seleccionado",
        description: "Selecciona un proveedor de la lista",
        variant: "destructive"
      });
      return;
    }
    try {
      // Obtener usuario autenticado primero
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "❌ Error de autenticación",
          description: "Debes iniciar sesión para registrar egresos",
          variant: "destructive"
        });
        return;
      }

      let proveedorId = null;

      // Crear o seleccionar proveedor si se decidió registrarlo
      if (registrarProveedor) {
        if (tipoProveedor === "nuevo") {
          const nuevoProveedor = {
            nombre: supplierName,
            telefono: supplierPhone || null,
            email: supplierEmail || null,
            rfc: supplierRFC || null,
            direccion: null,
            ciudad: null,
            estado: null,
            codigo_postal: null
          };

          const { data: proveedorData, error: proveedorError } = await createProveedor(nuevoProveedor);
          
          if (proveedorError) {
            toast({
              title: "❌ Error al crear proveedor",
              description: proveedorError,
              variant: "destructive"
            });
            return;
          }

          proveedorId = proveedorData?.id;
        } else if (tipoProveedor === "existente") {
          proveedorId = proveedorSeleccionado;
        }
      }

      const montoTotal = parseFloat(totalAmount) || 0;
      const montoPagado = paymentType === "contado" ? montoTotal : paymentType === "parcial" ? parseFloat(paidAmount) || 0 : 0;
      const montoPendiente = montoTotal - montoPagado;
      
      const { data, error } = await supabase.from('transacciones_egresos').insert({
        user_id: user.id,
        tipo_egreso: selectedType,
        subtipo_egreso: 'precargado',
        descripcion: selectedProduct?.nombre || '',
        producto_egreso_id: selectedProductId,
        cantidad: parseFloat(quantity),
        precio_unitario: parseFloat(unitPrice),
        monto_total: montoTotal,
        monto_pagado: montoPagado,
        monto_pendiente: montoPendiente,
        tipo_pago: paymentType,
        metodo_pago: paymentMethod || null,
        fecha_vencimiento: dueDate || null,
        proveedor_id: proveedorId,
        proveedor_nombre: supplierName || null,
        proveedor_telefono: supplierPhone || null,
        proveedor_email: supplierEmail || null,
        proveedor_rfc: supplierRFC || null,
        comentarios: description || null
      });
      if (error) throw error;
      toast({
        title: "✅ Egreso registrado",
        description: "El costo/gasto precargado se ha registrado correctamente"
      });

      // Limpiar formulario
      setSelectedType("");
      setSelectedProductId("");
      setSelectedProduct(null);
      setQuantity("1");
      setUnitPrice("");
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
      setRegistrarProveedor(false);
      setTipoProveedor("");
      setProveedorSeleccionado("");
    } catch (error) {
      console.error('Error al registrar egreso:', error);
      toast({
        title: "❌ Error",
        description: "No se pudo registrar el egreso. Intenta nuevamente.",
        variant: "destructive"
      });
    }
  };
  return <Card className="max-w-5xl mx-auto mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Registro de Costos y Gastos Precargados
        </CardTitle>
        <CardDescription>
          Registra gastos y costos de productos precargados del catálogo con unidades de medida específicas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pb-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Los productos deben estar registrados en el catálogo para poder seleccionarlos aquí.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selección de Tipo */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Tipo de Egreso</h3>
            
            <div className="space-y-2">
              <Label>¿Qué tipo de egreso vas a registrar? *</Label>
              <RadioGroup value={selectedType} onValueChange={handleTypeChange}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="costo" id="tipo-costo" />
                  <Label htmlFor="tipo-costo">Costo</Label>
                  <span className="text-xs text-muted-foreground">(Directamente relacionado con la producción)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gasto" id="tipo-gasto" />
                  <Label htmlFor="tipo-gasto">Gasto</Label>
                  <span className="text-xs text-muted-foreground">(Gastos operativos y administrativos)</span>
                </div>
              </RadioGroup>
            </div>
          </div>

          {selectedType && <>
              <Separator />
              
              {/* Selección de Producto */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Información del Producto</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="producto">{selectedType === "costo" ? "Costo" : "Gasto"} Precargado *</Label>
                    <Select value={selectedProductId} onValueChange={handleProductChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Seleccionar ${selectedType} del catálogo`} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredProducts.length > 0 ? filteredProducts.map(producto => <SelectItem key={producto.id} value={producto.id}>
                              <div className="flex items-center space-x-2">
                                <span>{producto.nombre}</span>
                                <span className="text-muted-foreground text-xs">
                                  - {producto.unidad}
                                </span>
                              </div>
                            </SelectItem>) : <SelectItem value="no-products" disabled>
                            No hay {selectedType}s en el catálogo
                          </SelectItem>}
                      </SelectContent>
                    </Select>
                    {filteredProducts.length === 0 && <p className="text-sm text-yellow-600">
                        No hay {selectedType}s precargados. Ve al catálogo de costos y gastos para agregar {selectedType}s.
                      </p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unidad">Unidad de Medida</Label>
                    <Input id="unidad" value={selectedProduct?.unidad || ""} placeholder="Se completa automáticamente" disabled />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cantidad">Cantidad *</Label>
                    <Input 
                      id="cantidad" 
                      type="text" 
                      value={quantity ? formatNumber(quantity) : ''} 
                      onChange={e => handleQuantityChange(e.target.value)} 
                      placeholder="0.00" 
                      required 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="precio-unitario">Precio Unitario *</Label>
                    <Input 
                      id="precio-unitario" 
                      type="text" 
                      value={unitPrice ? formatNumber(unitPrice) : ''} 
                      onChange={e => handleUnitPriceChange(e.target.value)} 
                      placeholder="0.00" 
                      required 
                    />
                    {selectedProduct && selectedProduct.precio_promedio > 0 && <p className="text-xs text-muted-foreground">
                        Precio promedio del catálogo: ${formatNumber(selectedProduct.precio_promedio.toString())}
                      </p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="total">Monto Total</Label>
                    <div className="flex items-center space-x-2">
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="total" 
                        type="text" 
                        value={totalAmount ? formatNumber(totalAmount) : ''} 
                        placeholder="0.00" 
                        disabled 
                        className="bg-muted"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>}

          {selectedProduct && <>
              <Separator />

              {/* Información de Pago */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Información de Pago</h3>
                
                <div className="space-y-2">
                  <Label>Tipo de Pago *</Label>
                  <RadioGroup value={paymentType} onValueChange={setPaymentType}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="contado" id="contado" />
                      <Label htmlFor="contado">Pago Total</Label>
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

            {(paymentType === "contado" || paymentType === "parcial") && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {paymentType === "parcial" && <div className="space-y-2">
                    <Label htmlFor="monto-pagado">Monto Pagado</Label>
                    <Input 
                      id="monto-pagado" 
                      type="text" 
                      value={paidAmount ? formatNumber(paidAmount) : ''} 
                      onChange={e => {
                        const cleanValue = e.target.value.replace(/,/g, '');
                        setPaidAmount(cleanValue);
                      }} 
                      placeholder="0.00" 
                    />
                  </div>}
              </div>}

            {(paymentType === "credito" || paymentType === "parcial") && <div className="space-y-2">
                <Label htmlFor="fecha-vencimiento">Fecha de Vencimiento</Label>
                <Input id="fecha-vencimiento" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>}
          </div>

          <Separator />

          {/* Información del Proveedor */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información del Proveedor</h3>
            
            {/* Solo mostrar opción de registrar para pago total */}
            {paymentType === "contado" && (
              <div className="space-y-2">
                <Label>¿Deseas registrar información del proveedor?</Label>
                <RadioGroup value={registrarProveedor ? "si" : "no"} onValueChange={(val) => {
                  setRegistrarProveedor(val === "si");
                  if (val === "no") {
                    setTipoProveedor("");
                    setProveedorSeleccionado("");
                    setSupplierName("");
                    setSupplierPhone("");
                    setSupplierEmail("");
                    setSupplierRFC("");
                  }
                }}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="no-proveedor" />
                    <Label htmlFor="no-proveedor">No, continuar sin proveedor</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="si" id="si-proveedor" />
                    <Label htmlFor="si-proveedor">Sí, registrar proveedor</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Para crédito y parcial, siempre obligatorio */}
            {(paymentType === "credito" || paymentType === "parcial") && (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Para pagos a crédito o parciales es obligatorio registrar la información del proveedor
                  </AlertDescription>
                </Alert>
                {!registrarProveedor && setRegistrarProveedor(true)}
              </>
            )}

            {/* Selección de tipo de proveedor */}
            {registrarProveedor && (
              <div className="space-y-2">
                <Label>Tipo de Proveedor *</Label>
                <RadioGroup value={tipoProveedor} onValueChange={(val) => {
                  setTipoProveedor(val);
                  if (val === "nuevo") {
                    setProveedorSeleccionado("");
                    setSupplierName("");
                    setSupplierPhone("");
                    setSupplierEmail("");
                    setSupplierRFC("");
                  } else if (val === "existente") {
                    setSupplierName("");
                    setSupplierPhone("");
                    setSupplierEmail("");
                    setSupplierRFC("");
                  }
                }}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nuevo" id="proveedor-nuevo" />
                    <Label htmlFor="proveedor-nuevo">Nuevo Proveedor</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="existente" id="proveedor-existente" />
                    <Label htmlFor="proveedor-existente">Proveedor Existente</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Seleccionar proveedor existente */}
            {registrarProveedor && tipoProveedor === "existente" && (
              <div className="space-y-2">
                <Label htmlFor="proveedor-select">Seleccionar Proveedor *</Label>
                <Select value={proveedorSeleccionado} onValueChange={(val) => {
                  setProveedorSeleccionado(val);
                  const proveedor = proveedores.find(p => p.id === val);
                  if (proveedor) {
                    setSupplierName(proveedor.nombre);
                    setSupplierPhone(proveedor.telefono || "");
                    setSupplierEmail(proveedor.email || "");
                    setSupplierRFC(proveedor.rfc || "");
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.length > 0 ? (
                      proveedores.map(proveedor => (
                        <SelectItem key={proveedor.id} value={proveedor.id}>
                          {proveedor.nombre}
                          {proveedor.rfc && ` - ${proveedor.rfc}`}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-proveedores" disabled>
                        No hay proveedores registrados
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Formulario para nuevo proveedor o mostrar datos del existente */}
            {registrarProveedor && tipoProveedor === "nuevo" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="proveedor-nombre">Nombre del Proveedor *</Label>
                  <Input 
                    id="proveedor-nombre" 
                    value={supplierName} 
                    onChange={e => setSupplierName(e.target.value)} 
                    placeholder="Nombre completo o razón social"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proveedor-telefono">Teléfono</Label>
                  <Input 
                    id="proveedor-telefono" 
                    value={supplierPhone} 
                    onChange={e => setSupplierPhone(e.target.value)} 
                    placeholder="Número de teléfono" 
                  />
                  <p className="text-xs text-muted-foreground">No puede repetirse con otro proveedor</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proveedor-email">Email</Label>
                  <Input 
                    id="proveedor-email" 
                    type="email" 
                    value={supplierEmail} 
                    onChange={e => setSupplierEmail(e.target.value)} 
                    placeholder="correo@ejemplo.com" 
                  />
                  <p className="text-xs text-muted-foreground">No puede repetirse con otro proveedor</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proveedor-rfc">RFC</Label>
                  <Input 
                    id="proveedor-rfc" 
                    value={supplierRFC} 
                    onChange={e => setSupplierRFC(e.target.value)} 
                    placeholder="RFC del proveedor" 
                  />
                  <p className="text-xs text-muted-foreground">No puede repetirse con otro proveedor</p>
                </div>
              </div>
            )}

            {/* Mostrar datos del proveedor existente seleccionado */}
            {registrarProveedor && tipoProveedor === "existente" && proveedorSeleccionado && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="font-semibold">Datos del proveedor seleccionado:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium">Nombre:</span> {supplierName}</div>
                  {supplierPhone && <div><span className="font-medium">Teléfono:</span> {supplierPhone}</div>}
                  {supplierEmail && <div><span className="font-medium">Email:</span> {supplierEmail}</div>}
                  {supplierRFC && <div><span className="font-medium">RFC:</span> {supplierRFC}</div>}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción Adicional</Label>
            <Textarea id="descripcion" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalles adicionales del gasto..." rows={3} />
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
              </>}
        </form>
      </CardContent>
    </Card>;
};
export default RegistroEgresosPrecargados;