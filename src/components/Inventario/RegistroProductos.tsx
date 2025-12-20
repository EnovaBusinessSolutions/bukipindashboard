import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import {
  Plus,
  Image as ImageIcon,
  Trash2,
  Package,
  CreditCard,
  Wallet,
  AlertCircle,
  ArrowLeft,
  Search,
} from "lucide-react";

import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";
import { useSubcuentasInventario } from "@/hooks/useSubcuentas";
import { useProveedores } from "@/hooks/useProveedores";
import { useSaldosDisponibles } from "@/hooks/useSaldosDisponibles";
import { useTarjetasCredito, validarLimiteCredito } from "@/hooks/useTarjetasCredito";
import { actualizarSaldoTarjetaCredito, extraerIdTarjetaCredito } from "@/lib/tarjetaCreditoUtils";
import { useCreateProducto } from "@/hooks/useProductos";

type ProductoForm = {
  nombre: string;
  descripcion: string;
  precio: number;
  precioVenta: number;
  cantidad: number;
  proveedor?: string; // nombre (solo cuando proveedor nuevo)
  ubicacion?: string;
  subcuentaId?: string;

  metodoPago: string; // efectivo|bancos|tarjeta_credito_<id>
  tipoPago: string; // contado|parcial|pendiente
  montoPagado: number;
  montoPendiente?: number;
  fechaVencimiento?: string;
};

type FlowStep = "select_type" | "select_existing" | "form";

function normalize<T = any>(json: any): T {
  return (json?.data ?? json) as T;
}

const RegistroProductos = () => {
  const [flowStep, setFlowStep] = useState<FlowStep>("select_type");
  const [selectedProducto, setSelectedProducto] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Proveedores (nuevo/existente/ninguno)
  const [tipoProveedor, setTipoProveedor] = useState(""); // "nuevo" | "existente" | "ninguno"
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState("");
  const [proveedorTelefono, setProveedorTelefono] = useState("");
  const [proveedorEmail, setProveedorEmail] = useState("");
  const [proveedorRFC, setProveedorRFC] = useState("");

  const { data: productosInventario, isLoading: loadingInventario } = useInventarioConMovimientos();
  const { data: subcuentasInventario } = useSubcuentasInventario();
  const { proveedores, createProveedor } = useProveedores();

  const createProducto = useCreateProducto();

  const { data: saldosDisponibles, isLoading: loadingSaldos } = useSaldosDisponibles();
  const { data: tarjetasCredito } = useTarjetasCredito();

  // Productos existentes con movimientos (compras o ventas)
  const productosExistentes =
    productosInventario?.filter((p: any) => p.cantidad_comprada > 0 || p.cantidad_vendida > 0) || [];

  const filteredProductos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return productosExistentes;
    return productosExistentes.filter((p: any) => (p.nombre || "").toLowerCase().includes(term));
  }, [productosExistentes, searchTerm]);

  const { register, handleSubmit, reset, setValue, watch } = useForm<ProductoForm>({
    defaultValues: {
      tipoPago: "contado",
      metodoPago: "efectivo",
      montoPagado: 0,
    },
  });

  const tipoPago = watch("tipoPago");
  const metodoPago = watch("metodoPago");

  const precio = watch("precio") || 0;
  const cantidad = watch("cantidad") || 0;
  const montoPagado = watch("montoPagado") || 0;

  const montoTotal = (precio || 0) * (cantidad || 0);
  const montoPendiente = Math.max(0, montoTotal - (montoPagado || 0));

  // Autocompletar monto pagado según tipo de pago
  useEffect(() => {
    if (!Number.isFinite(montoTotal)) return;
    if (tipoPago === "contado") setValue("montoPagado", montoTotal);
    if (tipoPago === "pendiente") setValue("montoPagado", 0);
    // parcial: lo ingresa el usuario
  }, [tipoPago, montoTotal, setValue]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImage(file);

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSelectExisting = (producto: any) => {
    setSelectedProducto(producto);

    setValue("nombre", producto.nombre);
    setValue("descripcion", producto.descripcion || "");
    setValue("subcuentaId", producto.subcuenta_id || "");
    setValue("precioVenta", producto.precio_venta || 0);

    if (producto.imagen_url) setImagePreview(producto.imagen_url);

    setFlowStep("form");
  };

  const handleNewProduct = () => {
    setSelectedProducto(null);
    reset();
    clearImage();
    setFlowStep("form");
  };

  const handleBackToSelection = () => {
    if (flowStep === "form") setFlowStep(selectedProducto ? "select_existing" : "select_type");
    else if (flowStep === "select_existing") setFlowStep("select_type");

    if (flowStep === "select_existing") setSearchTerm("");
  };

  // ====== Validaciones de saldo (sin Supabase) ======
  const getSaldoDisponible = () => {
    if (!saldosDisponibles) return 0;
    if (metodoPago === "efectivo") return saldosDisponibles.efectivo || 0;
    if (metodoPago === "bancos") return saldosDisponibles.bancos || 0;
    return 0; // tarjetas se validan con su hook
  };

  const validarFondos = () => {
    if (!(tipoPago === "contado" || tipoPago === "parcial")) return { ok: true as const };

    const pagoActual = tipoPago === "contado" ? montoTotal : montoPagado;
    if (!pagoActual || pagoActual <= 0) return { ok: true as const };

    // Efectivo / bancos: validamos con saldosDisponibles
    if (metodoPago === "efectivo" || metodoPago === "bancos") {
      const disponible = getSaldoDisponible();
      if (pagoActual > disponible) {
        return {
          ok: false as const,
          title: metodoPago === "efectivo" ? "💰 Saldo insuficiente en efectivo" : "🏦 Saldo insuficiente en bancos",
          description: `Disponible: ${formatCurrency(disponible)} | Necesitas: ${formatCurrency(pagoActual)}`,
        };
      }
    }

    // Tarjeta crédito: validamos con helper existente
    if (metodoPago?.startsWith("tarjeta_credito_") && tarjetasCredito) {
      const tarjetaId = metodoPago.replace("tarjeta_credito_", "");
      const validacion = validarLimiteCredito(tarjetaId, pagoActual, tarjetasCredito);
      if (!validacion.valido) {
        return {
          ok: false as const,
          title: "⚠️ Límite de crédito excedido",
          description: validacion.mensaje,
        };
      }
    }

    return { ok: true as const };
  };

  // ====== Backend: crear cuenta por pagar (sin Supabase) ======
  async function crearCuentaPorPagarInventario(payload: {
    tipo_egreso: "compra_inventario";
    descripcion: string;
    monto_total: number;
    monto_pagado: number;
    monto_pendiente: number;
    tipo_pago: "contado" | "parcial" | "pendiente";
    metodo_pago: string | null;
    proveedor_id: string | null;
    proveedor_nombre: string | null;
    proveedor_telefono: string | null;
    proveedor_email: string | null;
    proveedor_rfc: string | null;
    fecha_vencimiento: string | null;
    subcuenta_id: string | null;
    cuenta_codigo: string; // inventario/cxp según tu contabilidad (mantengo "1005" como en tu código)
    cantidad: number;
    precio_unitario: number;
    producto_id?: string | null;
  }) {
    const json = await apiFetch("/api/egresos", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return normalize(json);
  }

  const onSubmit = async (data: ProductoForm) => {
    // Si parcial/pendiente -> proveedor obligatorio
    if (tipoPago === "parcial" || tipoPago === "pendiente") {
      if (!tipoProveedor) {
        toast({
          title: "⚠️ Tipo de proveedor requerido",
          description: "Selecciona si es un proveedor nuevo o existente",
          variant: "destructive",
        });
        return;
      }

      if (tipoProveedor === "nuevo" && (!data.proveedor || data.proveedor.trim() === "")) {
        toast({
          title: "⚠️ Nombre del proveedor requerido",
          description: "Ingresa el nombre del proveedor",
          variant: "destructive",
        });
        return;
      }

      if (tipoProveedor === "existente" && !proveedorSeleccionado) {
        toast({
          title: "⚠️ Proveedor no seleccionado",
          description: "Selecciona un proveedor de la lista",
          variant: "destructive",
        });
        return;
      }

      if (tipoPago === "parcial") {
        if (!data.montoPagado || data.montoPagado <= 0) {
          toast({
            title: "⚠️ Monto pagado requerido",
            description: "Ingresa cuánto vas a pagar ahora",
            variant: "destructive",
          });
          return;
        }
        if (data.montoPagado > montoTotal) {
          toast({
            title: "⚠️ Monto inválido",
            description: "El monto pagado no puede ser mayor al total",
            variant: "destructive",
          });
          return;
        }
      }

      if ((tipoPago === "parcial" || tipoPago === "pendiente") && !data.fechaVencimiento) {
        toast({
          title: "⚠️ Fecha de vencimiento requerida",
          description: "Ingresa la fecha de vencimiento del saldo pendiente",
          variant: "destructive",
        });
        return;
      }
    }

    // Validar fondos si hay pago (contado/parcial)
    const fondos = validarFondos();
    if (!fondos.ok) {
      toast({ title: fondos.title, description: fondos.description, variant: "destructive" });
      return;
    }

    // Determinar proveedor (crear o usar existente)
    let proveedorId: string | null = null;
    let proveedorNombre: string | null = (data.proveedor || "").trim() || null;

    if (tipoProveedor && tipoProveedor !== "ninguno") {
      if (tipoProveedor === "nuevo") {
        const nuevoProveedor = {
          nombre: (data.proveedor || "").trim(),
          telefono: proveedorTelefono || null,
          email: proveedorEmail || null,
          rfc: proveedorRFC || null,
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

        proveedorId = proveedorData?.id || null;
        proveedorNombre = proveedorData?.nombre || proveedorNombre;
      } else if (tipoProveedor === "existente") {
        proveedorId = proveedorSeleccionado;
        const proveedor = proveedores?.find((p: any) => p.id === proveedorSeleccionado);
        proveedorNombre = proveedor?.nombre || proveedorNombre;
      }
    }

    if ((tipoPago === "parcial" || tipoPago === "pendiente") && !proveedorId) {
      toast({
        title: "⚠️ Proveedor requerido",
        description: "Debes seleccionar o crear un proveedor para pagos parciales o pendientes",
        variant: "destructive",
      });
      return;
    }

    // ====== Crear/actualizar producto (sin Supabase) ======
    // Nota: si selectedProducto existe, idealmente tu backend debe interpretarlo como "restock".
    // Por eso envío productId opcional (si tu hook lo soporta).
    await createProducto.mutateAsync({
      productId: selectedProducto?.id || undefined, // <- si tu hook no lo soporta, puedes ignorarlo en el backend
      nombre: data.nombre,
      precio: data.precio,
      precioVenta: data.precioVenta,
      cantidad: data.cantidad,
      descripcion: data.descripcion,
      subcuentaId: data.subcuentaId,
      imagen: selectedImage || undefined,
    } as any);

    // Actualizar saldo tarjeta de crédito si se usó y hubo pago
    if ((tipoPago === "contado" || tipoPago === "parcial") && montoPagado > 0) {
      const tarjetaId = extraerIdTarjetaCredito(data.metodoPago);
      if (tarjetaId) {
        // OJO: esta utilidad debe estar ya migrada a backend (si antes era Supabase).
        await actualizarSaldoTarjetaCredito(
          tarjetaId,
          montoPagado,
          `Compra de inventario: ${data.cantidad} unidades de ${data.nombre}`
        );
      }
    }

    // Crear cuenta por pagar si aplica (parcial o pendiente) y hay saldo pendiente
    if ((tipoPago === "parcial" || tipoPago === "pendiente") && montoPendiente > 0) {
      try {
        await crearCuentaPorPagarInventario({
          tipo_egreso: "compra_inventario",
          descripcion: `Compra de ${data.cantidad} unidades de ${data.nombre}`,
          monto_total: montoTotal,
          monto_pagado: tipoPago === "pendiente" ? 0 : montoPagado,
          monto_pendiente: montoPendiente,
          tipo_pago: tipoPago as any,
          metodo_pago: tipoPago === "parcial" ? data.metodoPago : null,

          proveedor_id: proveedorId,
          proveedor_nombre: proveedorNombre,
          proveedor_telefono: proveedorTelefono || null,
          proveedor_email: proveedorEmail || null,
          proveedor_rfc: proveedorRFC || null,

          fecha_vencimiento: data.fechaVencimiento || null,
          subcuenta_id: data.subcuentaId || null,

          cuenta_codigo: "1005",
          cantidad: data.cantidad,
          precio_unitario: data.precio,
          producto_id: selectedProducto?.id || null,
        });

        toast({
          title: "✅ Cuenta por pagar creada",
          description: `Saldo pendiente: ${formatCurrency(montoPendiente)} | Proveedor: ${proveedorNombre || "N/A"}`,
        });
      } catch (e: any) {
        console.error(e);
        toast({
          title: "⚠️ Advertencia",
          description: "Producto registrado, pero falló la creación de la cuenta por pagar.",
          variant: "destructive",
        });
      }
    }

    toast({ title: "✅ Registro completado", description: "Producto y compra registrados correctamente." });

    // Reset
    reset();
    clearImage();
    setSelectedProducto(null);
    setFlowStep("select_type");
    setTipoProveedor("");
    setProveedorSeleccionado("");
    setProveedorTelefono("");
    setProveedorEmail("");
    setProveedorRFC("");
  };

  // Paso 1: seleccionar tipo
  if (flowStep === "select_type") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Tipo de Registro de Compra
            </CardTitle>
            <CardDescription>
              Selecciona si vas a registrar un producto nuevo o una compra adicional de un producto existente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                onClick={() => setFlowStep("select_existing")}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                    <Search className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Producto Existente</h3>
                  <p className="text-sm text-muted-foreground">
                    Compra adicional de un producto que ya tienes en inventario. Se calculará automáticamente el costo
                    promedio ponderado.
                  </p>
                  <div className="mt-4">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      Recomendado para restock
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                onClick={handleNewProduct}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                    <Plus className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Producto Nuevo</h3>
                  <p className="text-sm text-muted-foreground">
                    Registrar un producto completamente nuevo en tu inventario. Necesitarás proporcionar toda la
                    información del producto.
                  </p>
                  <div className="mt-4">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      Primera vez
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Paso 2: seleccionar producto existente
  if (flowStep === "select_existing") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleBackToSelection} className="mr-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Seleccionar Producto Existente
                </CardTitle>
                <CardDescription>Busca y selecciona el producto al que quieres agregar stock</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos en inventario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {loadingInventario ? (
                <div className="text-center py-8 text-muted-foreground">Cargando productos...</div>
              ) : filteredProductos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProductos.map((producto: any) => (
                    <Card
                      key={producto.id}
                      className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                      onClick={() => handleSelectExisting(producto)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {producto.imagen_url ? (
                            <img
                              src={producto.imagen_url}
                              alt={producto.nombre}
                              className="w-16 h-16 object-cover rounded"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                              <Package className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm mb-1 truncate">{producto.nombre}</h3>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {producto.descripcion || "Sin descripción"}
                            </p>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Stock: {producto.cantidad_stock || 0}</span>
                              <span className="font-medium text-primary">{formatCurrency(producto.costo_unitario || 0)}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">
                    {searchTerm ? "No se encontraron productos" : "No hay productos en inventario"}
                  </p>
                  <Button variant="outline" onClick={handleNewProduct}>
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar Producto Nuevo
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Paso 3: formulario
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBackToSelection} className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                {selectedProducto ? `Agregar Stock: ${selectedProducto.nombre}` : "Registrar Producto Nuevo"}
              </CardTitle>
              <CardDescription>
                {selectedProducto
                  ? "Registra la compra adicional de este producto."
                  : "Registra un producto completamente nuevo para control de inventario"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Info producto */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground border-b pb-2">Información del Producto</h3>

                {selectedProducto && (
                  <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                    <div className="flex items-start gap-2">
                      <Package className="h-4 w-4 text-primary mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-primary">Producto Existente</p>
                        <p className="text-muted-foreground mt-1">
                          Stock actual: {selectedProducto.cantidad_stock || 0} | Costo actual:{" "}
                          {formatCurrency(selectedProducto.costo_unitario || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="nombre">Nombre del Producto *</Label>
                  <Input
                    id="nombre"
                    {...register("nombre", { required: true })}
                    placeholder="Ej: Camiseta para inventario"
                    readOnly={!!selectedProducto}
                    className={selectedProducto ? "bg-muted" : ""}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="precio">Precio Unitario de Compra *</Label>
                    <Input
                      id="precio"
                      type="number"
                      step="0.01"
                      {...register("precio", { required: true, valueAsNumber: true })}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label htmlFor="precioVenta">Precio de Venta Sugerido</Label>
                    <Input
                      id="precioVenta"
                      type="number"
                      step="0.01"
                      {...register("precioVenta", { valueAsNumber: true })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Este precio se usará por defecto al vender</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="cantidad">Cantidad a Comprar *</Label>
                  <Input
                    id="cantidad"
                    type="number"
                    min="1"
                    {...register("cantidad", { required: true, valueAsNumber: true })}
                    placeholder="1"
                  />
                </div>

                {montoTotal > 0 && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <p className="text-sm font-medium">Monto Total: {formatCurrency(montoTotal)}</p>

                    {(tipoPago === "contado" || tipoPago === "parcial") &&
                      !loadingSaldos &&
                      (metodoPago === "efectivo" || metodoPago === "bancos") && (
                        <div className="pt-2 border-t">
                          <Badge
                            variant={
                              (tipoPago === "contado" ? montoTotal : montoPagado) <= getSaldoDisponible()
                                ? "default"
                                : "destructive"
                            }
                          >
                            {(tipoPago === "contado" ? montoTotal : montoPagado) <= getSaldoDisponible()
                              ? "✓ Fondos suficientes"
                              : "✗ Fondos insuficientes"}
                          </Badge>
                        </div>
                      )}
                  </div>
                )}

                <div>
                  <Label htmlFor="subcuenta">Subcuenta de Inventario (Opcional)</Label>
                  <Select
                    onValueChange={(value) => setValue("subcuentaId", value)}
                    defaultValue={selectedProducto?.subcuenta_id}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          subcuentasInventario && subcuentasInventario.length > 0
                            ? "Seleccionar subcuenta de inventario"
                            : "No hay subcuentas - se asignará a Inventario General"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {subcuentasInventario?.map((subcuenta: any) => (
                        <SelectItem key={subcuenta.id} value={subcuenta.id}>
                          {subcuenta.nombre} ({subcuenta.nombreCuentaMadre})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Se registrará en cuentas de Inventario</p>
                </div>
              </div>

              {/* Info pago */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground border-b pb-2">Información de Pago</h3>

                <div className="space-y-4">
                  <Label className="font-medium">Estado del Pago *</Label>
                  <RadioGroup value={tipoPago} onValueChange={(value) => setValue("tipoPago", value)} defaultValue="contado">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="contado" id="contado-inv" />
                      <Label htmlFor="contado-inv" className="cursor-pointer">
                        Pago total
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="parcial" id="parcial-inv" />
                      <Label htmlFor="parcial-inv" className="cursor-pointer">
                        Pago parcial
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="pendiente" id="pendiente-inv" />
                      <Label htmlFor="pendiente-inv" className="cursor-pointer">
                        Quedó pendiente en su totalidad
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {(tipoPago === "contado" || tipoPago === "parcial") && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <Label className="font-medium">Método de Pago *</Label>
                      <RadioGroup
                        value={metodoPago}
                        onValueChange={(value) => setValue("metodoPago", value)}
                        defaultValue="efectivo"
                      >
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="efectivo" id="efectivo-inv" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Wallet className="h-4 w-4 text-primary" />
                                <Label htmlFor="efectivo-inv" className="cursor-pointer">
                                  Efectivo
                                </Label>
                              </div>
                              <div className="text-sm">
                                {loadingSaldos ? (
                                  <span className="text-muted-foreground">Cargando...</span>
                                ) : (
                                  <span className="text-green-600 font-medium">
                                    Disponible: {formatCurrency(saldosDisponibles?.efectivo || 0)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="bancos" id="bancos-inv" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <CreditCard className="h-4 w-4 text-primary" />
                                <Label htmlFor="bancos-inv" className="cursor-pointer">
                                  Bancos
                                </Label>
                              </div>
                              <div className="text-sm">
                                {loadingSaldos ? (
                                  <span className="text-muted-foreground">Cargando...</span>
                                ) : (
                                  <span className="text-green-600 font-medium">
                                    Disponible: {formatCurrency(saldosDisponibles?.bancos || 0)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {tarjetasCredito && tarjetasCredito.length > 0 &&
                          tarjetasCredito.map((tarjeta: any) => (
                            <div key={tarjeta.id} className="flex items-center space-x-3">
                              <RadioGroupItem value={`tarjeta_credito_${tarjeta.id}`} id={`tarjeta-inv-${tarjeta.id}`} />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <CreditCard className="h-4 w-4 text-purple-600" />
                                    <Label htmlFor={`tarjeta-inv-${tarjeta.id}`} className="cursor-pointer">
                                      {tarjeta.nombre}
                                    </Label>
                                  </div>
                                  <Badge variant="outline">
                                    Disponible: {formatCurrency(tarjeta.limite_disponible || 0)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                      </RadioGroup>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <Label htmlFor="montoPagado">Monto Pagado *</Label>
                  <Input
                    id="montoPagado"
                    type="number"
                    step="0.01"
                    {...register("montoPagado", { required: true, valueAsNumber: true })}
                    placeholder="0.00"
                    readOnly={tipoPago === "contado" || tipoPago === "pendiente"}
                    className={tipoPago === "contado" || tipoPago === "pendiente" ? "bg-muted" : ""}
                  />
                  {tipoPago === "parcial" && (
                    <p className="text-xs text-muted-foreground mt-1">Introduce el monto pagado parcialmente</p>
                  )}
                </div>

                {/* Proveedor */}
                <div className="space-y-4 ml-0 p-4 border rounded-lg bg-muted/50">
                  {(tipoPago === "parcial" || tipoPago === "pendiente") ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>Se registrará como cuenta por pagar (proveedor obligatorio)</AlertDescription>
                    </Alert>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>Proveedor opcional (recomendado)</AlertDescription>
                    </Alert>
                  )}

                  {(tipoPago === "parcial" || tipoPago === "pendiente") && montoPendiente > 0 && (
                    <div className="p-3 bg-background border rounded-lg">
                      <p className="text-sm font-medium">Monto Pendiente: {formatCurrency(montoPendiente)}</p>
                    </div>
                  )}

                  {(tipoPago === "parcial" || tipoPago === "pendiente") && (
                    <div>
                      <Label htmlFor="fechaVencimiento">Fecha de Vencimiento *</Label>
                      <Input id="fechaVencimiento" type="date" {...register("fechaVencimiento")} />
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <Label>
                      ¿Proveedor nuevo o existente? {(tipoPago === "parcial" || tipoPago === "pendiente") ? "*" : ""}
                    </Label>
                    <RadioGroup
                      value={tipoProveedor}
                      onValueChange={(value) => {
                        setTipoProveedor(value);
                        if (value === "nuevo") setProveedorSeleccionado("");
                        if (value === "existente") {
                          setValue("proveedor", "");
                          setProveedorTelefono("");
                          setProveedorEmail("");
                          setProveedorRFC("");
                        }
                        if (value === "ninguno") {
                          setProveedorSeleccionado("");
                          setValue("proveedor", "");
                          setProveedorTelefono("");
                          setProveedorEmail("");
                          setProveedorRFC("");
                        }
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nuevo" id="proveedor-nuevo" />
                        <Label htmlFor="proveedor-nuevo">Proveedor Nuevo</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="existente" id="proveedor-existente" />
                        <Label htmlFor="proveedor-existente">Proveedor Existente</Label>
                      </div>
                      {tipoPago === "contado" && (
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="ninguno" id="proveedor-ninguno" />
                          <Label htmlFor="proveedor-ninguno">Sin Proveedor</Label>
                        </div>
                      )}
                    </RadioGroup>
                  </div>

                  {tipoProveedor === "nuevo" && (
                    <div className="space-y-4 p-3 bg-background rounded-lg border">
                      <h4 className="text-sm font-semibold">Datos del Nuevo Proveedor</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="proveedor-nombre">Nombre del Proveedor *</Label>
                          <Input id="proveedor-nombre" {...register("proveedor")} placeholder="Razón social / nombre" />
                        </div>
                        <div>
                          <Label htmlFor="proveedor-telefono">Teléfono</Label>
                          <Input
                            id="proveedor-telefono"
                            value={proveedorTelefono}
                            onChange={(e) => setProveedorTelefono(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="proveedor-email">Email</Label>
                          <Input
                            id="proveedor-email"
                            type="email"
                            value={proveedorEmail}
                            onChange={(e) => setProveedorEmail(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="proveedor-rfc">RFC</Label>
                          <Input id="proveedor-rfc" value={proveedorRFC} onChange={(e) => setProveedorRFC(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  )}

                  {tipoProveedor === "existente" && (
                    <div className="space-y-2">
                      <Label htmlFor="proveedor-select">Seleccionar Proveedor *</Label>
                      <Select value={proveedorSeleccionado} onValueChange={setProveedorSeleccionado}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {proveedores && proveedores.length > 0 ? (
                            proveedores.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nombre}
                                {p.telefono ? ` - ${p.telefono}` : ""}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-proveedores" disabled>
                              No hay proveedores registrados
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Proveedores desde Cobros y Pagos</p>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <Label htmlFor="ubicacion">Ubicación en Almacén</Label>
                  <Input id="ubicacion" {...register("ubicacion")} placeholder="Ej: Estante A-1" />
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div className="mt-6">
              <Label htmlFor="descripcion">Descripción del Producto</Label>
              <Textarea
                id="descripcion"
                {...register("descripcion")}
                placeholder="Descripción, características, marca, modelo..."
                className="min-h-16"
              />
            </div>

            {/* Imagen */}
            <div className="mt-6">
              <Label htmlFor="imagen">Imagen del Producto (Opcional)</Label>
              <div className="mt-2">
                {imagePreview ? (
                  <div className="relative w-full max-w-xs">
                    <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded-md border" />
                    {!selectedProducto && (
                      <Button type="button" variant="destructive" size="sm" className="absolute top-2 right-2" onClick={clearImage}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full max-w-xs h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-muted-foreground/50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ImageIcon className="h-6 w-6 mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Click para subir</span>
                      </p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-6">
              <Button type="submit" disabled={createProducto.isPending} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {createProducto.isPending ? "Registrando..." : selectedProducto ? "Agregar Stock" : "Registrar Producto"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegistroProductos;
