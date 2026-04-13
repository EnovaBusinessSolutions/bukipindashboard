// bukipin-dashboard/src/components/Egresos/RegistroEgresosPrecargados.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Package,
  AlertCircle,
  Save,
  Calculator,
  Wallet,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Building2,
  Banknote,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

import { useProductosEgresos } from "@/hooks/useProductosEgresos";
import { useProveedores } from "@/hooks/useProveedores";
import { useTarjetasCorporativasEgresos, validarLimiteCredito } from "@/hooks/useTarjetasCredito";
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

const getProductProveedor = (p: any) => p?.proveedor_principal ?? p?.proveedorPrincipal ?? p?.proveedor ?? "";

const getProductPrecioPromedio = (p: any) => p?.precio_promedio ?? p?.precioPromedio ?? 0;

const getProductUnidad = (p: any) => p?.unidad ?? p?.unidadMedida ?? p?.unidad_medida ?? "";

const getProveedorNombre = (p: any) => p?.nombre ?? p?.name ?? "";
const getProveedorTelefono = (p: any) => p?.telefono ?? p?.phone ?? "";
const getProveedorEmail = (p: any) => p?.email ?? "";
const getProveedorRFC = (p: any) => p?.rfc ?? p?.taxId ?? "";
const getTarjetaInstitucion = (t: any) => String(t?.institucion_financiera ?? t?.institucion ?? "");

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

const humanMetodoPago = (m: string) => {
  if (!m) return "—";
  if (m === "efectivo") return "Efectivo";
  if (m === "bancos") return "Bancos / Transferencia";
  if (m.startsWith("tarjeta_credito_")) return "Tarjeta de crédito";
  return m;
};

const humanTipoPago = (t: string) => {
  if (!t) return "—";
  if (t === "contado") return "Pago total";
  if (t === "credito") return "Crédito";
  if (t === "parcial") return "Pago parcial";
  return t;
};

const money = (n: any) => formatCurrency(toNum(n, 0));

const RegistroEgresosPrecargados = () => {
  const { data: productosRaw = [] } = useProductosEgresos();
  const { proveedores: proveedoresRaw = [], createProveedor } = useProveedores();
  const { data: tarjetasCreditoRaw = [] } = useTarjetasCorporativasEgresos();
  const { data: saldosDisponibles } = useSaldosDisponibles();

  const productos = useMemo(() => productosRaw ?? [], [productosRaw]);
  const proveedores = useMemo(() => proveedoresRaw ?? [], [proveedoresRaw]);
  const tarjetasCredito = useMemo(() => tarjetasCreditoRaw ?? [], [tarjetasCreditoRaw]);

  const [vistaSeleccion, setVistaSeleccion] = useState(true); // true = selección, false = formulario
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

  const qNum = toNum(quantity, 0);
  const upNum = toNum(unitPrice, 0);
  const montoTotalCalc = qNum > 0 && upNum > 0 ? Number((qNum * upNum).toFixed(2)) : 0;

  const montoPagadoCalc =
    paymentType === "contado" ? montoTotalCalc : paymentType === "parcial" ? toNum(paidAmount, 0) : 0;

  const montoPendienteCalc = Math.max(0, montoTotalCalc - montoPagadoCalc);

  const metodoPagoNorm = normalizeMetodoPago(paymentMethod);

  const canSubmit =
    !!selectedType &&
    !!selectedProductId &&
    qNum > 0 &&
    upNum > 0 &&
    !!paymentType &&
    (paymentType === "credito" || paymentType === "parcial" ? !!dueDate : true) &&
    (paymentType === "contado" || paymentType === "parcial" ? !!metodoPagoNorm : true) &&
    (paymentType === "credito" || paymentType === "parcial" ? true : true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const metodoPagoNormLocal = normalizeMetodoPago(paymentMethod);

    if (!selectedProductId || !quantity || !unitPrice || !paymentType) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa todos los campos obligatorios",
        variant: "destructive",
      });
      return;
    }

    // Método de pago requerido si hay pago (contado o parcial)
    if ((paymentType === "contado" || paymentType === "parcial") && !metodoPagoNormLocal) {
      toast({
        title: "⚠️ Método de pago requerido",
        description: "Selecciona un método de pago para el monto pagado.",
        variant: "destructive",
      });
      return;
    }

    // Para crédito/parcial, fecha vencimiento requerida
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
      await apiJson("/api/auth/me", { method: "GET" });

      let proveedorId: string | null = null;

      if (registrarProveedor) {
        if (tipoProveedor === "nuevo") {
          const nuevoProveedor: any = {
            name: supplierName.trim(),
            nombre: supplierName.trim(),
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

      const q = toNum(quantity, 0);
      const up = toNum(unitPrice, 0);

      if (!(q > 0) || !(up > 0)) {
        toast({
          title: "⚠️ Cantidad/Precio inválidos",
          description: "Cantidad y precio unitario deben ser mayores a 0.",
          variant: "destructive",
        });
        return;
      }

      const montoTotal = Number((q * up).toFixed(2));

      const montoPagado =
        paymentType === "contado" ? montoTotal : paymentType === "parcial" ? toNum(paidAmount, 0) : 0;

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
      const financingId = metodoPagoNormLocal.startsWith("tarjeta_credito_")
        ? metodoPagoNormLocal.replace("tarjeta_credito_", "")
        : null;

      if (montoPagado > 0 && (metodoPagoNormLocal === "efectivo" || metodoPagoNormLocal === "bancos")) {
        if (!saldosDisponibles) {
          toast({
            title: "⚠️ Error de validación",
            description: "No se pudieron cargar los saldos disponibles. Intenta nuevamente.",
            variant: "destructive",
          });
          return;
        }
      }

      if (metodoPagoNormLocal === "efectivo" && saldosDisponibles) {
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

      if (metodoPagoNormLocal === "bancos" && saldosDisponibles) {
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

      if (metodoPagoNormLocal?.startsWith("tarjeta_credito_") && tarjetasCredito?.length) {
        const tarjetaId = metodoPagoNormLocal.replace("tarjeta_credito_", "");
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

      const subcuentaIdToSend = selectedType === "costo" ? (getProductSubcuentaId(selectedProduct) || null) : null;

      if (selectedType === "costo" && !subcuentaIdToSend) {
        toast({
          title: "⚠️ Falta subcuenta en el catálogo",
          description:
            "Este costo no tiene subcuenta asignada. Revisa el catálogo para evitar registros contables incorrectos.",
          variant: "destructive",
        });
        return;
      }

      const cuentaCodigoToSend =
        getProductCuentaContable(selectedProduct) || (selectedType === "costo" ? "5001" : "5101");

      const productName = getProductNombre(selectedProduct);

      const subtipo =
        selectedType === "costo" && String(productName || "").toLowerCase().includes("inventario")
          ? "compra_inventario"
          : "precargado";

      const payload: any = {
        tipoEgreso: selectedType,
        subtipoEgreso: subtipo,
        descripcion: productName || "",

        cuentaCodigo: cuentaCodigoToSend,
        subcuentaId: subcuentaIdToSend,

        montoTotal,
        cantidad: q,
        precioUnitario: up,

        tipoPago: paymentType,
        metodoPago: metodoPagoNormLocal || null,
        financingId,

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

        tipo_egreso: selectedType,
        subtipo_egreso: subtipo,
        cuenta_codigo: cuentaCodigoToSend,
        subcuenta_id: subcuentaIdToSend,
        monto_total: montoTotal,
        precio_unitario: up,
        tipo_pago: paymentType,
        metodo_pago: metodoPagoNormLocal || null,
        financing_id: financingId,
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

      const result = await apiJson<{ numero_asiento?: string; egreso_id?: string }>("/api/transacciones/egresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      toast({
        title: "✅ Egreso registrado",
        description: `Egreso registrado correctamente${result?.numero_asiento ? ` con asiento ${result.numero_asiento}` : ""}`,
      });

      window.dispatchEvent(new CustomEvent("bukipin:egreso-creado"));

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

  const headerBadge =
    selectedType === "costo" ? (
      <Badge variant="secondary" className="ml-2">
        Costo
      </Badge>
    ) : selectedType === "gasto" ? (
      <Badge variant="secondary" className="ml-2">
        Gasto
      </Badge>
    ) : null;

  return (
    <Card className="max-w-6xl mx-auto border bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Registro de Costos y Gastos Precargados
              {headerBadge}
            </CardTitle>
            <CardDescription className="mt-1">
              Registra egresos basados en tu catálogo con unidad de medida, control de pagos y proveedor.
            </CardDescription>
          </div>

          {!vistaSeleccion && (
            <Button variant="outline" onClick={handleVolverSeleccion} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {vistaSeleccion ? (
          <div className="space-y-4">
            <Alert className="border-muted-foreground/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Selecciona el tipo de egreso que deseas registrar.</AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() => handleTypeChange("costo")}
                className="text-left"
              >
                <Card className="h-full border hover:border-primary/40 hover:shadow-md transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-destructive/10">
                          <Package className="h-6 w-6 text-destructive" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Costo</CardTitle>
                          <CardDescription>Relacionado directamente con producción/venta.</CardDescription>
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Usa subcuenta desde catálogo</li>
                      <li>• Mejor trazabilidad por unidad</li>
                      <li>• Control de pagos y pendientes</li>
                    </ul>
                  </CardContent>
                </Card>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange("gasto")}
                className="text-left"
              >
                <Card className="h-full border hover:border-primary/40 hover:shadow-md transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-orange-500/10">
                          <Wallet className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Gasto</CardTitle>
                          <CardDescription>Operativos, administrativos y de venta.</CardDescription>
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Clasificación más ordenada</li>
                      <li>• Pago total / parcial / crédito</li>
                      <li>• Proveedor opcional en contado</li>
                    </ul>
                  </CardContent>
                </Card>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert className="border-muted-foreground/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Los productos deben existir en el catálogo para poder seleccionarlos aquí.
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Separator />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT: Form */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Producto */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold">Información del Producto</h3>
                      <Badge variant="outline" className="text-xs">
                        Del catálogo
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="producto">
                          {selectedType === "costo" ? "Costo" : "Gasto"} Precargado <span className="text-destructive">*</span>
                        </Label>

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
                                    <div className="flex items-center justify-between gap-2 w-full">
                                      <span className="truncate">{getProductNombre(producto) || "Sin nombre"}</span>
                                      <span className="text-muted-foreground text-xs shrink-0">
                                        {getProductUnidad(producto) || "unidad"}
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
                            No hay {selectedType}s precargados. Ve al catálogo para agregarlos.
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
                        <Label htmlFor="cantidad">
                          Cantidad <span className="text-destructive">*</span>
                        </Label>
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
                        <Label htmlFor="precio-unitario">
                          Precio Unitario <span className="text-destructive">*</span>
                        </Label>
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

                      <div className="space-y-2 md:col-span-2">
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

                  {/* Pago + Proveedor solo cuando hay producto */}
                  {selectedProduct && (
                    <>
                      <Separator />

                      {/* Pago */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold">Información de Pago</h3>
                          {paymentType ? <Badge variant="secondary">{humanTipoPago(paymentType)}</Badge> : null}
                        </div>

                        <div className="space-y-2">
                          <Label>
                            Tipo de Pago <span className="text-destructive">*</span>
                          </Label>
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
                              <Label htmlFor="metodo-pago">
                                Método de Pago <span className="text-destructive">*</span>
                              </Label>
                              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(normalizeMetodoPago(v))}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar método" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="efectivo">
                                    <div className="flex items-center gap-2">
                                      <Banknote className="h-4 w-4" />
                                      <span>Efectivo</span>
                                      <span className="text-muted-foreground text-xs">
                                        • Disponible: ${money(saldosDisponibles?.efectivo)}
                                      </span>
                                    </div>
                                  </SelectItem>

                                  <SelectItem value="bancos">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4" />
                                      <span>Bancos / Transferencia</span>
                                      <span className="text-muted-foreground text-xs">
                                        • Disponible: ${money(saldosDisponibles?.bancos)}
                                      </span>
                                    </div>
                                  </SelectItem>

                                  {tarjetasCredito?.map((tarjeta: any) => {
                                    const tid = getId(tarjeta);
                                    const limite = tarjeta?.limite_disponible ?? tarjeta?.limiteDisponible ?? 0;
                                    return (
                                      <SelectItem key={tid} value={`tarjeta_credito_${tid}`}>
                                        <div className="flex items-center gap-2">
                                          <CreditCard className="h-4 w-4" />
                                          <span className="truncate">
                                            {tarjeta?.nombre ?? tarjeta?.name ?? "Tarjeta"}
                                            {getTarjetaInstitucion(tarjeta) ? ` - ${getTarjetaInstitucion(tarjeta)}` : ""}
                                          </span>
                                          <span className="text-muted-foreground text-xs">
                                            • Disponible: ${money(limite)}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>

                            {paymentType === "parcial" && (
                              <div className="space-y-2">
                                <Label htmlFor="monto-pagado">
                                  Monto Pagado <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  id="monto-pagado"
                                  type="text"
                                  value={paidAmount}
                                  onChange={(e) => setPaidAmount(onlyNumberDot(e.target.value))}
                                  placeholder="Ej: 500 o 500.50"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Pendiente estimado: ${money(montoPendienteCalc)}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {(paymentType === "credito" || paymentType === "parcial") && (
                          <div className="space-y-2">
                            <Label htmlFor="fecha-vencimiento">
                              Fecha de Vencimiento <span className="text-destructive">*</span>
                            </Label>
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

                      {/* Proveedor */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold">Información del Proveedor</h3>
                          {registrarProveedor ? <Badge variant="secondary">Se registrará</Badge> : <Badge variant="outline">Opcional</Badge>}
                        </div>

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
                          <Alert className="border-muted-foreground/20">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Para pagos a crédito o parciales es obligatorio registrar la información del proveedor.
                            </AlertDescription>
                          </Alert>
                        )}

                        {registrarProveedor && (
                          <div className="space-y-2">
                            <Label>
                              Tipo de Proveedor <span className="text-destructive">*</span>
                            </Label>
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
                            <Label htmlFor="proveedor-select">
                              Seleccionar Proveedor <span className="text-destructive">*</span>
                            </Label>
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
                                        {nombre || "Proveedor"}
                                        {rfc ? ` - ${rfc}` : ""}
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
                              <Label htmlFor="proveedor-nombre">
                                Nombre del Proveedor <span className="text-destructive">*</span>
                              </Label>
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
                          <div className="bg-muted/40 border rounded-lg p-4 space-y-2">
                            <p className="font-semibold">Proveedor seleccionado</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="font-medium">Nombre:</span> {supplierName || "—"}
                              </div>
                              <div>
                                <span className="font-medium">Teléfono:</span> {supplierPhone || "—"}
                              </div>
                              <div>
                                <span className="font-medium">Email:</span> {supplierEmail || "—"}
                              </div>
                              <div>
                                <span className="font-medium">RFC:</span> {supplierRFC || "—"}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Descripción */}
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
                    </>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={handleVolverSeleccion}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="gap-2" disabled={!canSubmit}>
                      <Save className="h-4 w-4" />
                      Registrar Egreso
                    </Button>
                  </div>
                </div>

                {/* RIGHT: Resumen */}
                <div className="lg:col-span-1">
                  <Card className="border shadow-sm lg:sticky lg:top-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Resumen</CardTitle>
                      <CardDescription>Vista rápida del registro</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Producto</span>
                          <span className="font-medium text-right truncate max-w-[180px]">
                            {selectedProduct ? getProductNombre(selectedProduct) : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Unidad</span>
                          <span className="font-medium">
                            {selectedProduct ? getProductUnidad(selectedProduct) || "—" : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Cantidad</span>
                          <span className="font-medium">{qNum > 0 ? qNum : "—"}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Precio unitario</span>
                          <span className="font-medium">${money(upNum)}</span>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Monto total</span>
                          <span className="text-lg font-semibold">${money(montoTotalCalc)}</span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Pagado</span>
                          <span className="font-medium">${money(montoPagadoCalc)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Pendiente</span>
                          <span className="font-medium">${money(montoPendienteCalc)}</span>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Tipo de pago</span>
                          <span className="font-medium">{humanTipoPago(paymentType)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Método</span>
                          <span className="font-medium">{humanMetodoPago(metodoPagoNorm)}</span>
                        </div>
                        {(paymentType === "credito" || paymentType === "parcial") && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Vencimiento</span>
                            <span className="font-medium">{dueDate || "—"}</span>
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Proveedor</span>
                          <span className="font-medium truncate max-w-[180px]">{supplierName || "—"}</span>
                        </div>
                        {registrarProveedor ? (
                          <Badge className="w-fit" variant="secondary">
                            Se guardará proveedor
                          </Badge>
                        ) : (
                          <Badge className="w-fit" variant="outline">
                            Proveedor opcional
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RegistroEgresosPrecargados;
