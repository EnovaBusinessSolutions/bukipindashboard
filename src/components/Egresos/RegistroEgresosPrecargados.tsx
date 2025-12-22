import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, AlertCircle, Save, Calculator, Wallet, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

import { useProductosEgresos } from "@/hooks/useProductosEgresos";
import { useProveedores } from "@/hooks/useProveedores";
import { useTarjetasCredito, validarLimiteCredito } from "@/hooks/useTarjetasCredito";
import { useSaldosDisponibles } from "@/hooks/useSaldosDisponibles";
import { formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

type AnyJson = any;

const apiJson = async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
  const res: AnyJson = await apiFetch(url, init);
  // Tu backend / apiFetch a veces regresa {ok:true,data:{...}} o payload plano
  return (res?.data ?? res) as T;
};

// Función para formatear números con separador de miles (solo para display)
const formatNumber = (value: string) => {
  if (!value) return "";
  const num = parseFloat(value.replace(/,/g, ""));
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const onlyNumberDot = (v: string) => v.replace(/[^\d.]/g, "");

const toNum = (v: any, def = 0) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : def;
};

// Helpers para soportar varios shapes (snake/camel) del catálogo
const getProductCuentaContable = (p: any) =>
  p?.cuenta_contable ?? p?.cuentaContable ?? p?.cuentaCodigo ?? p?.cuenta_codigo ?? "";

const getProductSubcuentaId = (p: any) =>
  p?.subcuenta_id ?? p?.subcuentaId ?? p?.subcuenta_id ?? "";

const getProductProveedor = (p: any) =>
  p?.proveedor_principal ?? p?.proveedorPrincipal ?? p?.proveedor ?? "";

const getProductPrecioPromedio = (p: any) =>
  p?.precio_promedio ?? p?.precioPromedio ?? p?.precio_promedio ?? 0;

const getProductUnidad = (p: any) => p?.unidad ?? p?.unidadMedida ?? p?.unidad_medida ?? "";

const RegistroEgresosPrecargados = () => {
  const { data: productos = [] } = useProductosEgresos();
  const { proveedores, createProveedor } = useProveedores();
  const { data: tarjetasCredito } = useTarjetasCredito();
  const { data: saldosDisponibles } = useSaldosDisponibles();

  const [vistaSeleccion, setVistaSeleccion] = useState(true); // true = mostrar tarjetas, false = mostrar formulario
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

  const filteredProducts = useMemo(
    () => productos.filter((p: any) => p.tipo === selectedType),
    [productos, selectedType]
  );

  // Para crédito/parcial: proveedor siempre obligatorio (sin setState en render)
  useEffect(() => {
    if (paymentType === "credito" || paymentType === "parcial") {
      setRegistrarProveedor(true);
    }
  }, [paymentType]);

  // Mantener totalAmount consistente aunque el usuario edite inputs
  useEffect(() => {
    const q = toNum(quantity, 0);
    const up = toNum(unitPrice, 0);
    if (q > 0 && up > 0) {
      setTotalAmount((q * up).toFixed(2));
    } else {
      setTotalAmount("");
    }
  }, [quantity, unitPrice]);

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setVistaSeleccion(false);

    // Reset product selection when type changes
    setSelectedProductId("");
    setSelectedProduct(null);

    // Reset some fields
    setSupplierName("");
    setUnitPrice("");
    setTotalAmount("");
    setPaymentType("");
    setPaymentMethod("");
    setPaidAmount("");
    setDueDate("");
    setRegistrarProveedor(false);
    setTipoProveedor("");
    setProveedorSeleccionado("");
  };

  const handleVolverSeleccion = () => {
    setVistaSeleccion(true);
    setSelectedType("");

    // Resetear todos los campos del formulario
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
  };

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const product = productos.find((p: any) => p.id === productId);
    setSelectedProduct(product);

    if (product) {
      // Auto-fill data from catalog
      setSupplierName(getProductProveedor(product) || "");
      const pp = toNum(getProductPrecioPromedio(product), 0);
      setUnitPrice(pp > 0 ? String(pp) : "");

      // totalAmount se recalcula por useEffect(quantity, unitPrice)
    }
  };

  const handleQuantityChange = (newQuantity: string) => {
    const cleanValue = onlyNumberDot(newQuantity);
    setQuantity(cleanValue);
  };

  const handleUnitPriceChange = (price: string) => {
    const cleanValue = onlyNumberDot(price);
    setUnitPrice(cleanValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId || !quantity || !unitPrice || !paymentType) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa todos los campos obligatorios",
        variant: "destructive",
      });
      return;
    }

    // Método de pago requerido si hay pago (contado o parcial)
    if ((paymentType === "contado" || paymentType === "parcial") && !paymentMethod) {
      toast({
        title: "⚠️ Método de pago requerido",
        description: "Selecciona un método de pago para el monto pagado.",
        variant: "destructive",
      });
      return;
    }

    // Validar selección de proveedor si se decidió registrarlo
    if (registrarProveedor && !tipoProveedor) {
      toast({
        title: "⚠️ Tipo de proveedor requerido",
        description: "Selecciona si es un proveedor nuevo o existente",
        variant: "destructive",
      });
      return;
    }

    // Validar datos del proveedor si es nuevo
    if (registrarProveedor && tipoProveedor === "nuevo" && !supplierName.trim()) {
      toast({
        title: "⚠️ Nombre del proveedor requerido",
        description: "Ingresa el nombre del proveedor",
        variant: "destructive",
      });
      return;
    }

    // Validar selección de proveedor existente
    if (registrarProveedor && tipoProveedor === "existente" && !proveedorSeleccionado) {
      toast({
        title: "⚠️ Proveedor no seleccionado",
        description: "Selecciona un proveedor de la lista",
        variant: "destructive",
      });
      return;
    }

    try {
      // ✅ Validar sesión por cookies (E2E backend). Si 401, apiFetch debe lanzar.
      await apiJson("/api/auth/me", { method: "GET" });

      let proveedorId: string | null = null;

      // Crear o seleccionar proveedor si se decidió registrarlo
      if (registrarProveedor) {
        if (tipoProveedor === "nuevo") {
          const nuevoProveedor = {
            nombre: supplierName.trim(),
            telefono: supplierPhone || null,
            email: supplierEmail || null,
            rfc: supplierRFC || null,
            direccion: null,
            ciudad: null,
            estado: null,
            codigo_postal: null,
          };

          const { data: proveedorData, error: proveedorError } = await createProveedor(nuevoProveedor);

          if (proveedorError) {
            toast({
              title: "❌ Error al crear proveedor",
              description: proveedorError,
              variant: "destructive",
            });
            return;
          }

          proveedorId = proveedorData?.id ?? null;
        } else if (tipoProveedor === "existente") {
          proveedorId = proveedorSeleccionado;
        }
      }

      // ✅ MONTO TOTAL: SIEMPRE se calcula en submit (no depende de totalAmount)
      const qNum = toNum(quantity, 0);
      const upNum = toNum(unitPrice, 0);

      if (!(qNum > 0) || !(upNum > 0)) {
        toast({
          title: "⚠️ Cantidad/Precio inválidos",
          description: "Cantidad y precio unitario deben ser mayores a 0.",
          variant: "destructive",
        });
        return;
      }

      const montoTotal = Number((qNum * upNum).toFixed(2));

      const montoPagado =
        paymentType === "contado"
          ? montoTotal
          : paymentType === "parcial"
          ? toNum(paidAmount, 0)
          : 0;

      if (paymentType === "parcial") {
        if (!(montoPagado > 0) || montoPagado >= montoTotal) {
          toast({
            title: "⚠️ Monto pagado inválido",
            description: "En pago parcial, el monto pagado debe ser mayor a 0 y menor al total.",
            variant: "destructive",
          });
          return;
        }
      }

      const montoPendiente = Math.max(0, montoTotal - montoPagado);

      // FASE 1: Verificar que los saldos se hayan cargado
      if (montoPagado > 0 && (paymentMethod === "efectivo" || paymentMethod === "tarjeta-transferencia")) {
        if (!saldosDisponibles) {
          toast({
            title: "⚠️ Error de validación",
            description: "No se pudieron cargar los saldos disponibles. Intenta nuevamente.",
            variant: "destructive",
          });
          return;
        }
      }

      // FASE 2: Validar saldo disponible para efectivo o bancos
      if (paymentMethod === "efectivo" && saldosDisponibles) {
        if (montoPagado > (saldosDisponibles.efectivo ?? 0)) {
          toast({
            title: "💰 Saldo insuficiente en efectivo",
            description: `Disponible: $${(saldosDisponibles.efectivo ?? 0).toFixed(2)} | Necesitas: $${montoPagado.toFixed(
              2
            )}`,
            variant: "destructive",
          });
          return;
        }
      }

      if (paymentMethod === "tarjeta-transferencia" && saldosDisponibles) {
        if (montoPagado > (saldosDisponibles.bancos ?? 0)) {
          toast({
            title: "🏦 Saldo insuficiente en bancos",
            description: `Disponible: $${(saldosDisponibles.bancos ?? 0).toFixed(2)} | Necesitas: $${montoPagado.toFixed(
              2
            )}`,
            variant: "destructive",
          });
          return;
        }
      }

      // Validar límite de crédito si se seleccionó tarjeta de crédito
      if (paymentMethod?.startsWith("tarjeta_credito_") && tarjetasCredito) {
        const tarjetaId = paymentMethod.replace("tarjeta_credito_", "");
        const validacion = validarLimiteCredito(tarjetaId, montoPagado, tarjetasCredito);

        if (!validacion.valido) {
          toast({
            title: "⚠️ Límite de crédito excedido",
            description: validacion.mensaje,
            variant: "destructive",
          });
          return;
        }
      }

      // ✅ Para costo: subcuenta es MUY importante (sale del catálogo)
      const subcuentaIdToSend =
        selectedType === "costo" ? (getProductSubcuentaId(selectedProduct) || null) : null;

      const cuentaCodigoToSend =
        getProductCuentaContable(selectedProduct) || (selectedType === "costo" ? "5001" : "5101");

      // ✅ Registrar egreso en tu backend
      const payload = {
        tipo_egreso: selectedType,
        subtipo_egreso:
          selectedType === "costo" && (selectedProduct?.nombre || "").toLowerCase().includes("inventario")
            ? "compra_inventario"
            : "precargado",

        descripcion: selectedProduct?.nombre || "",

        cuenta_codigo: cuentaCodigoToSend,
        subcuenta_id: subcuentaIdToSend,

        monto_total: montoTotal,
        cantidad: qNum,
        precio_unitario: upNum,

        tipo_pago: paymentType,
        metodo_pago: paymentMethod || null,

        monto_pagado: montoPagado,
        monto_pendiente: montoPendiente,

        fecha_vencimiento: paymentType === "credito" || paymentType === "parcial" ? (dueDate || null) : null,

        proveedor_id: proveedorId,
        proveedor_nombre: supplierName || null,
        proveedor_telefono: supplierPhone || null,
        proveedor_email: supplierEmail || null,
        proveedor_rfc: supplierRFC || null,

        producto_egreso_id: selectedProductId,
        comentarios: description || null,
      };

      const result = await apiJson<{ numero_asiento?: string; egreso_id?: string }>(
        "/api/transacciones/egresos",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      toast({
        title: "✅ Egreso registrado",
        description: `Egreso registrado correctamente${result?.numero_asiento ? ` con asiento ${result.numero_asiento}` : ""}`,
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
      setVistaSeleccion(true);
    } catch (error) {
      console.error("Error al registrar egreso:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo registrar el egreso. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="max-w-5xl mx-auto border-0 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Registro de Costos y Gastos Precargados
        </CardTitle>
        <CardDescription>
          Registra gastos y costos de productos precargados del catálogo con unidades de medida específicas
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {vistaSeleccion ? (
          // VISTA DE SELECCIÓN CON TARJETAS
          <div className="space-y-4">
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Selecciona el tipo de egreso que deseas registrar</AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* TARJETA DE COSTO */}
              <Card className="cursor-pointer hover:border-primary hover:shadow-lg transition-all" onClick={() => handleTypeChange("costo")}>
                <CardHeader className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-red-100 rounded-full">
                      <Package className="h-8 w-8 text-red-600" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">Costo</CardTitle>
                  <CardDescription>Directamente relacionado con la producción o venta de productos/servicios</CardDescription>
                </CardHeader>
              </Card>

              {/* TARJETA DE GASTO */}
              <Card className="cursor-pointer hover:border-primary hover:shadow-lg transition-all" onClick={() => handleTypeChange("gasto")}>
                <CardHeader className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-orange-100 rounded-full">
                      <Wallet className="h-8 w-8 text-orange-600" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">Gasto</CardTitle>
                  <CardDescription>Gastos operativos, administrativos y de venta</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        ) : (
          // VISTA DE FORMULARIO
          <div className="space-y-4">
            <Button variant="ghost" onClick={handleVolverSeleccion} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a selección de tipo
            </Button>

            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Los productos deben estar registrados en el catálogo para poder seleccionarlos aquí.</AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                        {filteredProducts.length > 0 ? (
                          filteredProducts.map((producto: any) => (
                            <SelectItem key={producto.id} value={producto.id}>
                              <div className="flex items-center space-x-2">
                                <span>{producto.nombre}</span>
                                <span className="text-muted-foreground text-xs">- {getProductUnidad(producto) || "unidad"}</span>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-products" disabled>
                            No hay {selectedType}s en el catálogo
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    {filteredProducts.length === 0 && (
                      <p className="text-sm text-yellow-600">
                        No hay {selectedType}s precargados. Ve al catálogo de costos y gastos para agregar {selectedType}s.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unidad">Unidad de Medida</Label>
                    <Input id="unidad" value={getProductUnidad(selectedProduct) || ""} placeholder="Se completa automáticamente" disabled />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cantidad">Cantidad *</Label>
                    <Input
                      id="cantidad"
                      type="text"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      placeholder="Ej: 10 o 10.5"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="precio-unitario">Precio Unitario *</Label>
                    <Input
                      id="precio-unitario"
                      type="text"
                      value={unitPrice}
                      onChange={(e) => handleUnitPriceChange(e.target.value)}
                      placeholder="Ej: 100 o 100.50"
                      required
                    />
                    {selectedProduct && toNum(getProductPrecioPromedio(selectedProduct), 0) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Precio promedio del catálogo: ${formatNumber(String(getProductPrecioPromedio(selectedProduct)))}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="total">Monto Total</Label>
                    <div className="flex items-center space-x-2">
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="total"
                        type="text"
                        value={totalAmount ? formatNumber(totalAmount) : ""}
                        placeholder="0.00"
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {selectedProduct && (
                <>
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

                    {(paymentType === "contado" || paymentType === "parcial") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="metodo-pago">Método de Pago</Label>
                          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="efectivo">
                                Efectivo - Disponible: ${formatCurrency(saldosDisponibles?.efectivo)}
                              </SelectItem>
                              <SelectItem value="tarjeta-transferencia">
                                Bancos - Disponible: ${formatCurrency(saldosDisponibles?.bancos)}
                              </SelectItem>
                              {tarjetasCredito?.map((tarjeta: any) => (
                                <SelectItem key={tarjeta.id} value={`tarjeta_credito_${tarjeta.id}`}>
                                  {tarjeta.nombre} - Disponible: ${formatCurrency(tarjeta.limite_disponible)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {paymentType === "parcial" && (
                          <div className="space-y-2">
                            <Label htmlFor="monto-pagado">Monto Pagado</Label>
                            <Input
                              id="monto-pagado"
                              type="text"
                              value={paidAmount}
                              onChange={(e) => setPaidAmount(onlyNumberDot(e.target.value))}
                              placeholder="Ej: 500 o 500.50"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {(paymentType === "credito" || paymentType === "parcial") && (
                      <div className="space-y-2">
                        <Label htmlFor="fecha-vencimiento">Fecha de Vencimiento</Label>
                        <Input id="fecha-vencimiento" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Información del Proveedor */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Información del Proveedor</h3>

                    {/* Solo mostrar opción de registrar para pago total */}
                    {paymentType === "contado" && (
                      <div className="space-y-2">
                        <Label>¿Deseas registrar información del proveedor?</Label>
                        <RadioGroup
                          value={registrarProveedor ? "si" : "no"}
                          onValueChange={(val) => {
                            const si = val === "si";
                            setRegistrarProveedor(si);
                            if (!si) {
                              setTipoProveedor("");
                              setProveedorSeleccionado("");
                              setSupplierName("");
                              setSupplierPhone("");
                              setSupplierEmail("");
                              setSupplierRFC("");
                            }
                          }}
                        >
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
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Para pagos a crédito o parciales es obligatorio registrar la información del proveedor
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Selección de tipo de proveedor */}
                    {registrarProveedor && (
                      <div className="space-y-2">
                        <Label>Tipo de Proveedor *</Label>
                        <RadioGroup
                          value={tipoProveedor}
                          onValueChange={(val) => {
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
                          }}
                        >
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
                        <Select
                          value={proveedorSeleccionado}
                          onValueChange={(val) => {
                            setProveedorSeleccionado(val);
                            const proveedor = proveedores.find((p: any) => p.id === val);
                            if (proveedor) {
                              setSupplierName(proveedor.nombre);
                              setSupplierPhone(proveedor.telefono || "");
                              setSupplierEmail(proveedor.email || "");
                              setSupplierRFC(proveedor.rfc || "");
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            {proveedores.length > 0 ? (
                              proveedores.map((proveedor: any) => (
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

                    {/* Formulario para nuevo proveedor */}
                    {registrarProveedor && tipoProveedor === "nuevo" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="proveedor-nombre">Nombre del Proveedor *</Label>
                          <Input
                            id="proveedor-nombre"
                            value={supplierName}
                            onChange={(e) => setSupplierName(e.target.value)}
                            placeholder="Nombre completo o razón social"
                            required
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
                          <p className="text-xs text-muted-foreground">No puede repetirse con otro proveedor</p>
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
                          <p className="text-xs text-muted-foreground">No puede repetirse con otro proveedor</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="proveedor-rfc">RFC</Label>
                          <Input
                            id="proveedor-rfc"
                            value={supplierRFC}
                            onChange={(e) => setSupplierRFC(e.target.value)}
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
                          <div>
                            <span className="font-medium">Nombre:</span> {supplierName}
                          </div>
                          {supplierPhone && (
                            <div>
                              <span className="font-medium">Teléfono:</span> {supplierPhone}
                            </div>
                          )}
                          {supplierEmail && (
                            <div>
                              <span className="font-medium">Email:</span> {supplierEmail}
                            </div>
                          )}
                          {supplierRFC && (
                            <div>
                              <span className="font-medium">RFC:</span> {supplierRFC}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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
                    <Button type="button" variant="outline" onClick={handleVolverSeleccion}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="gap-2">
                      <Save className="h-4 w-4" />
                      Registrar Egreso
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RegistroEgresosPrecargados;
