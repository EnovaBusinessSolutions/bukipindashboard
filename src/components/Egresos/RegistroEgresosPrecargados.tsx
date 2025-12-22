// bukipin-dashboard/src/components/Egresos/RegistroEgresosPrecargados.tsx
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
  // Backend a veces regresa {ok:true,data:{...}} o payload plano
  return (res?.data ?? res) as T;
};

// -------------------- Helpers robustos (id/_id + snake/camel) --------------------
const getId = (x: any) => String(x?.id ?? x?._id ?? "");
const getProductTipo = (p: any) => p?.tipo ?? p?.tipo_egreso ?? p?.tipoEgreso ?? "";
const getProductNombre = (p: any) => p?.nombre ?? p?.name ?? p?.descripcion ?? "";

const getProductCuentaContable = (p: any) =>
  p?.cuenta_contable ?? p?.cuentaContable ?? p?.cuentaCodigo ?? p?.cuenta_codigo ?? "";

const getProductSubcuentaId = (p: any) => p?.subcuenta_id ?? p?.subcuentaId ?? "";

const getProductProveedor = (p: any) =>
  p?.proveedor_principal ?? p?.proveedorPrincipal ?? p?.proveedor ?? "";

const getProductPrecioPromedio = (p: any) => p?.precio_promedio ?? p?.precioPromedio ?? 0;

const getProductUnidad = (p: any) => p?.unidad ?? p?.unidadMedida ?? p?.unidad_medida ?? "";

const getProveedorNombre = (p: any) => p?.nombre ?? p?.name ?? "";
const getProveedorTelefono = (p: any) => p?.telefono ?? p?.phone ?? "";
const getProveedorEmail = (p: any) => p?.email ?? "";
const getProveedorRFC = (p: any) => p?.rfc ?? p?.taxId ?? "";

// Formateo SOLO display
const formatNumber = (value: string) => {
  if (!value) return "";
  const num = parseFloat(value.replace(/,/g, ""));
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Acepta números y 1 solo punto decimal
const onlyNumberDot = (v: string) => {
  const cleaned = String(v ?? "").replace(/[^\d.]/g, "");
  const [a, ...rest] = cleaned.split(".");
  return rest.length ? `${a}.${rest.join("")}` : a;
};

const toNum = (v: any, def = 0) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : def;
};

// Normaliza método de pago para alinear FE/BE (evita "tarjeta-transferencia")
const normalizeMetodoPago = (m: string) => {
  if (!m) return "";
  if (m === "tarjeta-transferencia") return "bancos"; // compat legado
  return m; // "efectivo" | "bancos" | "tarjeta_credito_<id>"
};

const RegistroEgresosPrecargados = () => {
  const { data: productosRaw = [] } = useProductosEgresos();
  const { proveedores: proveedoresRaw = [], createProveedor } = useProveedores();
  const { data: tarjetasCreditoRaw = [] } = useTarjetasCredito();
  const { data: saldosDisponibles } = useSaldosDisponibles();

  // Normalizamos en memoria para que TODO el componente use ids consistentes
  const productos = useMemo(() => productosRaw ?? [], [productosRaw]);
  const proveedores = useMemo(() => proveedoresRaw ?? [], [proveedoresRaw]);
  const tarjetasCredito = useMemo(() => tarjetasCreditoRaw ?? [], [tarjetasCreditoRaw]);

  const [vistaSeleccion, setVistaSeleccion] = useState(true); // true = tarjetas, false = formulario
  const [selectedType, setSelectedType] = useState(""); // "costo" | "gasto"
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [totalAmount, setTotalAmount] = useState("");

  const [paymentType, setPaymentType] = useState(""); // contado|credito|parcial
  const [paymentMethod, setPaymentMethod] = useState(""); // efectivo|bancos|tarjeta_credito_*
  const [paidAmount, setPaidAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierRFC, setSupplierRFC] = useState("");
  const [description, setDescription] = useState("");

  const [registrarProveedor, setRegistrarProveedor] = useState(false);
  const [tipoProveedor, setTipoProveedor] = useState(""); // "nuevo" | "existente"
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState("");

  const filteredProducts = useMemo(() => {
    return (productos || []).filter((p: any) => getProductTipo(p) === selectedType);
  }, [productos, selectedType]);

  // Para crédito/parcial: proveedor obligatorio
  useEffect(() => {
    if (paymentType === "credito" || paymentType === "parcial") {
      setRegistrarProveedor(true);
      // Si no hay tipo, no lo seteamos forzado; pero evitamos que quede "apagado"
    }
  }, [paymentType]);

  // Mantener totalAmount consistente (solo display)
  useEffect(() => {
    const q = toNum(quantity, 0);
    const up = toNum(unitPrice, 0);
    if (q > 0 && up > 0) {
      setTotalAmount((q * up).toFixed(2));
    } else {
      setTotalAmount("");
    }
  }, [quantity, unitPrice]);

  const resetForm = () => {
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

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setVistaSeleccion(false);
    resetForm();
  };

  const handleVolverSeleccion = () => {
    setVistaSeleccion(true);
    setSelectedType("");
    resetForm();
  };

  const handleProductChange = (productId: string) => {
    const pid = String(productId ?? "");
    setSelectedProductId(pid);

    const product = (productos || []).find((p: any) => getId(p) === pid) ?? null;
    setSelectedProduct(product);

    if (product) {
      setSupplierName(getProductProveedor(product) || "");
      const pp = toNum(getProductPrecioPromedio(product), 0);
      setUnitPrice(pp > 0 ? String(pp) : "");
      // totalAmount se recalcula con useEffect
    } else {
      setSupplierName("");
      setUnitPrice("");
      setTotalAmount("");
    }
  };

  const handleQuantityChange = (newQuantity: string) => {
    setQuantity(onlyNumberDot(newQuantity));
  };

  const handleUnitPriceChange = (price: string) => {
    setUnitPrice(onlyNumberDot(price));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const metodoPagoNorm = normalizeMetodoPago(paymentMethod);

    if (!selectedProductId || !quantity || !unitPrice || !paymentType) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa todos los campos obligatorios",
        variant: "destructive",
      });
      return;
    }

    // Método de pago requerido si hay pago (contado o parcial)
    if ((paymentType === "contado" || paymentType === "parcial") && !metodoPagoNorm) {
      toast({
        title: "⚠️ Método de pago requerido",
        description: "Selecciona un método de pago para el monto pagado.",
        variant: "destructive",
      });
      return;
    }

    // Para crédito/parcial, fecha vencimiento normalmente requerida (E2E contable)
    if ((paymentType === "credito" || paymentType === "parcial") && !dueDate) {
      toast({
        title: "⚠️ Fecha de vencimiento requerida",
        description: "Para crédito o pago parcial, selecciona una fecha de vencimiento.",
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

    if (registrarProveedor && tipoProveedor === "nuevo" && !supplierName.trim()) {
      toast({
        title: "⚠️ Nombre del proveedor requerido",
        description: "Ingresa el nombre del proveedor",
        variant: "destructive",
      });
      return;
    }

    if (registrarProveedor && tipoProveedor === "existente" && !proveedorSeleccionado) {
      toast({
        title: "⚠️ Proveedor no seleccionado",
        description: "Selecciona un proveedor de la lista",
        variant: "destructive",
      });
      return;
    }

    try {
      // ✅ Validar sesión por cookies. Si 401, apiFetch debe lanzar.
      await apiJson("/api/auth/me", { method: "GET" });

      let proveedorId: string | null = null;

      // Crear o seleccionar proveedor si se decidió registrarlo
      if (registrarProveedor) {
        if (tipoProveedor === "nuevo") {
          // Mandamos shape compatible (name + nombre)
          const nuevoProveedor: any = {
            name: supplierName.trim(),
            nombre: supplierName.trim(), // compat
            telefono: supplierPhone || null,
            email: supplierEmail || null,
            rfc: supplierRFC || null,
          };

          const { data: proveedorData, error: proveedorError }: any = await createProveedor(nuevoProveedor);

          if (proveedorError) {
            toast({
              title: "❌ Error al crear proveedor",
              description: proveedorError,
              variant: "destructive",
            });
            return;
          }

          proveedorId = proveedorData ? getId(proveedorData) : null;
        } else if (tipoProveedor === "existente") {
          proveedorId = proveedorSeleccionado;
        }
      }

      // ✅ MONTO TOTAL: SIEMPRE se calcula en submit
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

      // Si hay pago y el método consume saldos, verifica que saldos estén
      if (montoPagado > 0 && (metodoPagoNorm === "efectivo" || metodoPagoNorm === "bancos")) {
        if (!saldosDisponibles) {
          toast({
            title: "⚠️ Error de validación",
            description: "No se pudieron cargar los saldos disponibles. Intenta nuevamente.",
            variant: "destructive",
          });
          return;
        }
      }

      // Validar saldo disponible para efectivo / bancos
      if (metodoPagoNorm === "efectivo" && saldosDisponibles) {
        const disponible = toNum(saldosDisponibles.efectivo, 0);
        if (montoPagado > disponible) {
          toast({
            title: "💰 Saldo insuficiente en efectivo",
            description: `Disponible: $${disponible.toFixed(2)} | Necesitas: $${montoPagado.toFixed(2)}`,
            variant: "destructive",
          });
          return;
        }
      }

      if (metodoPagoNorm === "bancos" && saldosDisponibles) {
        const disponible = toNum(saldosDisponibles.bancos, 0);
        if (montoPagado > disponible) {
          toast({
            title: "🏦 Saldo insuficiente en bancos",
            description: `Disponible: $${disponible.toFixed(2)} | Necesitas: $${montoPagado.toFixed(2)}`,
            variant: "destructive",
          });
          return;
        }
      }

      // Validar límite de crédito si se seleccionó tarjeta de crédito
      if (metodoPagoNorm?.startsWith("tarjeta_credito_") && tarjetasCredito?.length) {
        const tarjetaId = metodoPagoNorm.replace("tarjeta_credito_", "");
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

      // ✅ Para costo: subcuenta es muy importante
      const subcuentaIdToSend = selectedType === "costo" ? (getProductSubcuentaId(selectedProduct) || null) : null;

      if (selectedType === "costo" && !subcuentaIdToSend) {
        toast({
          title: "⚠️ Falta subcuenta en el catálogo",
          description: "Este costo no tiene subcuenta asignada. Revisa el catálogo para evitar registros contables incorrectos.",
          variant: "destructive",
        });
        return;
      }

      const cuentaCodigoToSend = getProductCuentaContable(selectedProduct) || (selectedType === "costo" ? "5001" : "5101");

      const productName = getProductNombre(selectedProduct);

      const subtipo =
        selectedType === "costo" && String(productName || "").toLowerCase().includes("inventario")
          ? "compra_inventario"
          : "precargado";

      // ✅ Payload CANÓNICO camelCase + espejos snake_case para compat (alineación FE/BE)
      const payload: any = {
        // Canon
        tipoEgreso: selectedType,
        subtipoEgreso: subtipo,
        descripcion: productName || "",

        cuentaCodigo: cuentaCodigoToSend,
        subcuentaId: subcuentaIdToSend,

        montoTotal,
        cantidad: qNum,
        precioUnitario: upNum,

        tipoPago: paymentType,
        metodoPago: metodoPagoNorm || null,

        montoPagado,
        montoPendiente,

        fechaVencimiento: paymentType === "credito" || paymentType === "parcial" ? (dueDate || null) : null,

        proveedorId: proveedorId,
        proveedorNombre: supplierName || null,
        proveedorTelefono: supplierPhone || null,
        proveedorEmail: supplierEmail || null,
        proveedorRFC: supplierRFC || null,

        productoEgresoId: selectedProductId,
        comentarios: description || null,

        // Compat legacy (si tu backend aún lee snake_case)
        tipo_egreso: selectedType,
        subtipo_egreso: subtipo,
        cuenta_codigo: cuentaCodigoToSend,
        subcuenta_id: subcuentaIdToSend,
        monto_total: montoTotal,
        precio_unitario: upNum,
        tipo_pago: paymentType,
        metodo_pago: metodoPagoNorm || null,
        monto_pagado: montoPagado,
        monto_pendiente: montoPendiente,
        fecha_vencimiento: paymentType === "credito" || paymentType === "parcial" ? (dueDate || null) : null,
        proveedor_id: proveedorId,
        proveedor_nombre: supplierName || null,
        proveedor_telefono: supplierPhone || null,
        proveedor_email: supplierEmail || null,
        proveedor_rfc: supplierRFC || null,
        producto_egreso_id: selectedProductId,
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

      // Disparar evento para que otras vistas refresquen (tablas/gráficas)
      window.dispatchEvent(new CustomEvent("bukipin:egreso-creado"));

      // Reset completo y volver a selección
      setSelectedType("");
      setVistaSeleccion(true);
      resetForm();
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
          <div className="space-y-4">
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Selecciona el tipo de egreso que deseas registrar</AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                className="cursor-pointer hover:border-primary hover:shadow-lg transition-all"
                onClick={() => handleTypeChange("costo")}
              >
                <CardHeader className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-red-100 rounded-full">
                      <Package className="h-8 w-8 text-red-600" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">Costo</CardTitle>
                  <CardDescription>
                    Directamente relacionado con la producción o venta de productos/servicios
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary hover:shadow-lg transition-all"
                onClick={() => handleTypeChange("gasto")}
              >
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
                          filteredProducts.map((producto: any) => {
                            const pid = getId(producto);
                            return (
                              <SelectItem key={pid} value={pid}>
                                <div className="flex items-center space-x-2">
                                  <span>{getProductNombre(producto) || "Sin nombre"}</span>
                                  <span className="text-muted-foreground text-xs">
                                    - {getProductUnidad(producto) || "unidad"}
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })
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
                    <Input
                      id="unidad"
                      value={selectedProduct ? getProductUnidad(selectedProduct) || "" : ""}
                      placeholder="Se completa automáticamente"
                      disabled
                    />
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
                          <Select
                            value={paymentMethod}
                            onValueChange={(v) => setPaymentMethod(normalizeMetodoPago(v))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="efectivo">
                                Efectivo - Disponible: ${formatCurrency(saldosDisponibles?.efectivo)}
                              </SelectItem>

                              {/* CANÓNICO: bancos */}
                              <SelectItem value="bancos">
                                Bancos / Transferencia - Disponible: ${formatCurrency(saldosDisponibles?.bancos)}
                              </SelectItem>

                              {tarjetasCredito?.map((tarjeta: any) => {
                                const tid = getId(tarjeta);
                                const limite = tarjeta?.limite_disponible ?? tarjeta?.limiteDisponible ?? 0;
                                return (
                                  <SelectItem key={tid} value={`tarjeta_credito_${tid}`}>
                                    {tarjeta?.nombre ?? tarjeta?.name ?? "Tarjeta"} - Disponible: $
                                    {formatCurrency(limite)}
                                  </SelectItem>
                                );
                              })}
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
                        <Label htmlFor="fecha-vencimiento">Fecha de Vencimiento *</Label>
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

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Información del Proveedor</h3>

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

                    {(paymentType === "credito" || paymentType === "parcial") && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Para pagos a crédito o parciales es obligatorio registrar la información del proveedor
                        </AlertDescription>
                      </Alert>
                    )}

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

                    {registrarProveedor && tipoProveedor === "existente" && (
                      <div className="space-y-2">
                        <Label htmlFor="proveedor-select">Seleccionar Proveedor *</Label>
                        <Select
                          value={proveedorSeleccionado}
                          onValueChange={(val) => {
                            setProveedorSeleccionado(val);
                            const proveedor = proveedores.find((p: any) => getId(p) === val);
                            if (proveedor) {
                              setSupplierName(getProveedorNombre(proveedor));
                              setSupplierPhone(getProveedorTelefono(proveedor));
                              setSupplierEmail(getProveedorEmail(proveedor));
                              setSupplierRFC(getProveedorRFC(proveedor));
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            {proveedores.length > 0 ? (
                              proveedores.map((proveedor: any) => {
                                const pid = getId(proveedor);
                                const nombre = getProveedorNombre(proveedor);
                                const rfc = getProveedorRFC(proveedor);
                                return (
                                  <SelectItem key={pid} value={pid}>
                                    {nombre || "Proveedor"}{rfc ? ` - ${rfc}` : ""}
                                  </SelectItem>
                                );
                              })
                            ) : (
                              <SelectItem value="no-proveedores" disabled>
                                No hay proveedores registrados
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

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
