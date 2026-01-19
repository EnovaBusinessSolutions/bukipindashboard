// bukipin-dashboard/src/components/Egresos/RegistroOtrosGastos.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Receipt, Save, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTarjetasCredito, validarLimiteCredito } from "@/hooks/useTarjetasCredito";
import { useSaldosDisponibles } from "@/hooks/useSaldosDisponibles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

type AnyJson = any;

const apiJson = async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
  const res: AnyJson = await apiFetch(url, init);
  return (res?.data ?? res) as T;
};

// -------------------- Helpers UI/Number --------------------
const onlyNumberDot = (v: string) => {
  const cleaned = String(v ?? "").replace(/[^\d.]/g, "");
  const [a, ...rest] = cleaned.split(".");
  return rest.length ? `${a}.${rest.join("")}` : a;
};

const toNum = (v: any, def = 0) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : def;
};

const formatNumber = (value: string) => {
  if (!value) return "";
  const num = parseFloat(String(value).replace(/,/g, ""));
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// -------------------- Canonical método pago (FE/BE) --------------------
// Canon: "efectivo" | "bancos" | "tarjeta_credito_<id>"
// Compat legado: "tarjeta-transferencia" => "bancos"
const normalizeMetodoPago = (m: string) => {
  const s = String(m ?? "").trim();
  if (!s) return "";
  if (s === "tarjeta-transferencia" || s === "transferencia") return "bancos";
  return s;
};

// -------------------- Helpers robustos (ids/props) --------------------
const getId = (x: any) => String(x?.id ?? x?._id ?? "");
const getTarjetaNombre = (t: any) => String(t?.nombre ?? t?.name ?? "Tarjeta");
const getTarjetaLimiteDisponible = (t: any) => Number(t?.limite_disponible ?? t?.limiteDisponible ?? 0);

const RegistroOtrosGastos = () => {
  const [concept, setConcept] = useState("");
  const [totalAmount, setTotalAmount] = useState("");

  const [paymentType, setPaymentType] = useState<"contado" | "credito" | "parcial" | "">("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierRFC, setSupplierRFC] = useState("");

  const [description, setDescription] = useState("");

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<{
    montoPagado: number;
    montoTotal: number;
    metodoPagoNorm: string;
  } | null>(null);

  const [esProveedorRecurrente, setEsProveedorRecurrente] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: tarjetasCreditoRaw } = useTarjetasCredito();
  const { data: saldosDisponibles } = useSaldosDisponibles();

  const tarjetasCredito = useMemo(() => {
    const raw: any = tarjetasCreditoRaw ?? [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  }, [tarjetasCreditoRaw]);

  // Proveedor obligatorio si credito/parcial
  useEffect(() => {
    if (paymentType !== "credito" && paymentType !== "parcial") {
      if (!supplierName.trim()) setEsProveedorRecurrente(false);
    }
  }, [paymentType, supplierName]);

  const resetForm = () => {
    setConcept("");
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

    setShowConfirmDialog(false);
    setPendingSubmit(null);
    setEsProveedorRecurrente(false);
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const metodoPagoNorm = normalizeMetodoPago(paymentMethod);

    if (!concept.trim() || !totalAmount || !paymentType) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa todos los campos obligatorios.",
        variant: "destructive",
      });
      return;
    }

    const montoTotal = toNum(totalAmount, 0);
    if (!(montoTotal > 0)) {
      toast({
        title: "⚠️ Monto inválido",
        description: "El monto total debe ser mayor a 0.",
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

    // Crédito/parcial requieren vencimiento (consistencia E2E)
    if ((paymentType === "credito" || paymentType === "parcial") && !dueDate) {
      toast({
        title: "⚠️ Fecha de vencimiento requerida",
        description: "Para crédito o pago parcial, selecciona una fecha de vencimiento.",
        variant: "destructive",
      });
      return;
    }

    // Proveedor requerido si hay monto pendiente (credito/parcial)
    if ((paymentType === "credito" || paymentType === "parcial") && !supplierName.trim()) {
      toast({
        title: "⚠️ Proveedor requerido",
        description: "Debes proporcionar el nombre del proveedor/beneficiario para crédito o pago parcial.",
        variant: "destructive",
      });
      return;
    }

    const montoPagado =
      paymentType === "contado" ? montoTotal : paymentType === "parcial" ? toNum(paidAmount, 0) : 0;

    if (paymentType === "parcial") {
      if (!(montoPagado > 0)) {
        toast({
          title: "⚠️ Monto pagado requerido",
          description: "En pago parcial, el monto pagado debe ser mayor a 0.",
          variant: "destructive",
        });
        return;
      }
      if (!(montoPagado < montoTotal)) {
        toast({
          title: "⚠️ Monto pagado inválido",
          description: "En pago parcial, el monto pagado debe ser menor al monto total.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // ✅ Validar sesión por cookies (E2E backend)
      await apiJson("/api/auth/me", { method: "GET" });

      // Validación de saldos (solo aplica si pagas ahora y es efectivo/bancos)
      const requiereValidacionSaldos =
        montoPagado > 0 && (metodoPagoNorm === "efectivo" || metodoPagoNorm === "bancos");

      if (requiereValidacionSaldos && !saldosDisponibles) {
        toast({
          title: "⚠️ Error de validación",
          description: "No se pudieron cargar los saldos disponibles. Intenta nuevamente.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (metodoPagoNorm === "efectivo" && saldosDisponibles) {
        const disponible = Number(saldosDisponibles?.efectivo ?? 0);
        if (montoPagado > disponible) {
          toast({
            title: "💰 Saldo insuficiente en efectivo",
            description: `Disponible: $${formatCurrency(disponible)} | Necesitas: $${formatCurrency(montoPagado)}`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      if (metodoPagoNorm === "bancos" && saldosDisponibles) {
        const disponible = Number(saldosDisponibles?.bancos ?? 0);
        if (montoPagado > disponible) {
          toast({
            title: "🏦 Saldo insuficiente en bancos",
            description: `Disponible: $${formatCurrency(disponible)} | Necesitas: $${formatCurrency(montoPagado)}`,
            variant: "destructive",
          });
          setIsSubmitting(false);
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
          setIsSubmitting(false);
          return;
        }

        // Confirmación antes de ejecutar el cargo
        setPendingSubmit({ montoPagado, montoTotal, metodoPagoNorm });
        setShowConfirmDialog(true);
        setIsSubmitting(false);
        return;
      }

      await processTransaction(montoPagado, montoTotal, metodoPagoNorm);
    } catch (error) {
      console.error("Error al registrar gasto:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo registrar el gasto. Intenta nuevamente.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const processTransaction = async (montoPagado: number, montoTotal: number, metodoPagoNorm: string) => {
    const montoPendiente = Math.max(0, montoTotal - montoPagado);

    // ✅ Backend exige cantidad y precio_unitario > 0.
    // Para “Otros gastos”, usamos 1 x montoTotal.
    const cantidad = 1;
    const precioUnitario = montoTotal;

    // ✅ TODOS los otros gastos van a la cuenta 5204
    const cuentaCodigo = "5204";

    // ✅ Payload CANÓNICO + espejos legacy (alineación FE/BE)
    // IMPORTANT: NO duplicar keys dentro del objeto (TypeScript marca rojo)
    const payload: any = {
      // Canon
      tipoEgreso: "otro",
      subtipoEgreso: "otros_gastos",

      descripcion: concept.trim(),
      concepto: concept.trim(),

      cuentaCodigo,
      subcuentaId: null,

      montoTotal,
      cantidad,
      precioUnitario,

      tipoPago: paymentType,
      metodoPago: metodoPagoNorm || null,
      montoPagado,
      montoPendiente,

      fechaVencimiento: paymentType === "credito" || paymentType === "parcial" ? (dueDate || null) : null,

      proveedorNombre: supplierName ? supplierName.trim() : null,
      proveedorTelefono: supplierPhone || null,
      proveedorEmail: supplierEmail || null,
      proveedorRFC: supplierRFC || null,
      esProveedorRecurrente: !!esProveedorRecurrente,

      comentarios: description || null,

      // Legacy snake_case (por compat)
      tipo_egreso: "otro",
      subtipo_egreso: "otros_gastos",
      cuenta_codigo: cuentaCodigo,
      cuentaPrincipalCodigo: cuentaCodigo,
      monto_total: montoTotal,
      tipo_pago: paymentType,
      metodo_pago: metodoPagoNorm || null,
      monto_pagado: montoPagado,
      monto_pendiente: montoPendiente,
      fecha_vencimiento: paymentType === "credito" || paymentType === "parcial" ? (dueDate || null) : null,
      proveedor_nombre: supplierName ? supplierName.trim() : null,
      proveedor_telefono: supplierPhone || null,
      proveedor_email: supplierEmail || null,
      proveedor_rfc: supplierRFC || null,
      es_proveedor_recurrente: !!esProveedorRecurrente,
      precio_unitario: precioUnitario,
      // ✅ No repetimos `cantidad` aquí (ya va en canonical). Evita el error ts(1117)
    };

    try {
      setIsSubmitting(true);

      // ⚠️ Ruta canonical (tu app ya trae esta para otros egresos)
      const result = await apiJson<{ numero_asiento?: string }>(`/api/egresos/transacciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      toast({
        title: "✅ Gasto registrado",
        description: `Gasto registrado correctamente${
          result?.numero_asiento ? ` con asiento contable ${result.numero_asiento}` : ""
        }`,
      });

      // 🔔 refrescar otras vistas
      window.dispatchEvent(new CustomEvent("bukipin:egreso-creado"));

      resetForm();
    } catch (error) {
      console.error("Error al guardar transacción de otros gastos:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo registrar el gasto. Revisa tu conexión o intenta nuevamente.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const metodoPagoLabel = (m: string) => {
    const mm = normalizeMetodoPago(m);
    if (mm === "efectivo") return "Efectivo";
    if (mm === "bancos") return "Bancos / Transferencia";
    if (mm.startsWith("tarjeta_credito_")) return "Tarjeta de crédito";
    return "Método";
  };

  return (
    <>
      {/* ✅ Sin hacks de scroll: el layout global ya controla el único scroll */}
      <Card className="max-w-5xl mx-auto border-0 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Registro de Otros Gastos
          </CardTitle>
          <CardDescription>
            Registra gastos que están fuera de la operación normal para poder identificarlos separadamente
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Estos egresos se registran siempre en la cuenta <b>5204</b> para mantener consistencia contable.
            </AlertDescription>
          </Alert>

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
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monto-total">Monto Total *</Label>
                  <Input
                    id="monto-total"
                    type="text"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(onlyNumberDot(e.target.value))}
                    placeholder="0.00"
                    required
                    disabled={isSubmitting}
                  />
                  {!!totalAmount && <p className="text-xs text-muted-foreground">Total: ${formatNumber(totalAmount)}</p>}
                </div>
              </div>

              {/* Cuenta contable fija */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cuenta contable (fija)</Label>
                  <Input value="5204" disabled />
                </div>
              </div>
            </div>

            <Separator />

            {/* Información de Pago */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Información de Pago</h3>

              <div className="space-y-2">
                <Label>Tipo de Pago *</Label>
                <RadioGroup
                  value={paymentType}
                  onValueChange={(v) => {
                    const vv = v as any;
                    setPaymentType(vv);

                    // reset relacionados
                    setPaymentMethod("");
                    setPaidAmount("");
                    setDueDate("");

                    // si vuelve a contado, dejamos proveedor opcional pero no borramos si ya lo capturó
                    if (vv === "contado") {
                      setEsProveedorRecurrente(false);
                    }
                  }}
                >
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
                    <Label htmlFor="metodo-pago">Método de Pago *</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(v) => setPaymentMethod(normalizeMetodoPago(v))}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="efectivo">
                          Efectivo - Disponible: ${formatCurrency(saldosDisponibles?.efectivo ?? 0)}
                        </SelectItem>

                        <SelectItem value="bancos">
                          Bancos / Transferencia - Disponible: ${formatCurrency(saldosDisponibles?.bancos ?? 0)}
                        </SelectItem>

                        {tarjetasCredito?.length
                          ? tarjetasCredito.map((t: any) => {
                              const tid = getId(t);
                              const nombre = getTarjetaNombre(t);
                              const limite = getTarjetaLimiteDisponible(t);
                              return (
                                <SelectItem key={tid} value={`tarjeta_credito_${tid}`}>
                                  {nombre} - Disponible: ${formatCurrency(limite)}
                                </SelectItem>
                              );
                            })
                          : null}
                      </SelectContent>
                    </Select>

                    {!!paymentMethod && (
                      <p className="text-xs text-muted-foreground">
                        Método seleccionado: <b>{metodoPagoLabel(paymentMethod)}</b>
                      </p>
                    )}
                  </div>

                  {paymentType === "parcial" && (
                    <div className="space-y-2">
                      <Label htmlFor="monto-pagado">Monto Pagado *</Label>
                      <Input
                        id="monto-pagado"
                        type="text"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(onlyNumberDot(e.target.value))}
                        placeholder="0.00"
                        disabled={isSubmitting}
                      />
                      {!!paidAmount && (
                        <p className="text-xs text-muted-foreground">
                          Pagado: ${formatNumber(paidAmount)} | Pendiente: $
                          {formatNumber(String(Math.max(0, toNum(totalAmount, 0) - toNum(paidAmount, 0)).toFixed(2)))}
                        </p>
                      )}
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
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Proveedor/Beneficiario */}
            {(paymentType === "credito" || paymentType === "parcial") && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Información del Proveedor/Beneficiario *</h3>
                <p className="text-sm text-muted-foreground">
                  Requerido para pagos a crédito o parciales para gestionar cuentas por pagar
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="proveedor-nombre">Nombre del Proveedor *</Label>
                    <Input
                      id="proveedor-nombre"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="Nombre completo o razón social"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="proveedor-telefono">Teléfono</Label>
                    <Input
                      id="proveedor-telefono"
                      value={supplierPhone}
                      onChange={(e) => setSupplierPhone(e.target.value)}
                      placeholder="Número de teléfono"
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="proveedor-rfc">RFC</Label>
                    <Input
                      id="proveedor-rfc"
                      value={supplierRFC}
                      onChange={(e) => setSupplierRFC(e.target.value)}
                      placeholder="RFC del proveedor/beneficiario"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Recurrencia */}
                <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="es-recurrente"
                      checked={esProveedorRecurrente}
                      onChange={(e) => setEsProveedorRecurrente(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                      disabled={isSubmitting}
                    />
                    <div className="flex-1">
                      <Label htmlFor="es-recurrente" className="font-semibold cursor-pointer">
                        ¿Es un proveedor recurrente?
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Si marcas esta opción, guardaremos este proveedor en tu catálogo para futuras transacciones.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Nota:</strong> Esta información es necesaria para gestionar correctamente las cuentas por pagar.
                  </p>
                </div>
              </div>
            )}

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción Adicional</Label>
              <Textarea
                id="descripcion"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalles adicionales del gasto..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" className="gap-2" disabled={isSubmitting}>
                <Save className="h-4 w-4" />
                {isSubmitting ? "Guardando..." : "Registrar Gasto"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Confirmación tarjeta */}
      <AlertDialog
        open={showConfirmDialog}
        onOpenChange={(open) => {
          setShowConfirmDialog(open);
          if (!open) setPendingSubmit(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pago con tarjeta de crédito</AlertDialogTitle>
            <AlertDialogDescription>
              {paymentMethod?.startsWith("tarjeta_credito_") &&
                tarjetasCredito?.length &&
                (() => {
                  const tarjetaId = normalizeMetodoPago(paymentMethod).replace("tarjeta_credito_", "");
                  const tarjeta = (tarjetasCredito as any[])?.find((t) => getId(t) === tarjetaId);
                  if (!tarjeta) return null;

                  const limiteActual = getTarjetaLimiteDisponible(tarjeta);
                  const cargo = Number(pendingSubmit?.montoPagado ?? 0);
                  const limiteDespues = limiteActual - cargo;

                  return (
                    <>
                      <div className="space-y-2 my-4">
                        <p>
                          <strong>Tarjeta:</strong> {getTarjetaNombre(tarjeta)}
                        </p>
                        <p>
                          <strong>Límite disponible actual:</strong> ${limiteActual.toFixed(2)}
                        </p>
                        <p>
                          <strong>Monto del cargo:</strong> ${cargo.toFixed(2)}
                        </p>
                        <p>
                          <strong>Límite disponible después:</strong> ${limiteDespues.toFixed(2)}
                        </p>
                      </div>
                      <p>¿Deseas continuar con este pago?</p>
                    </>
                  );
                })()}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isSubmitting}
              onClick={() => {
                setShowConfirmDialog(false);
                setPendingSubmit(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={isSubmitting}
              onClick={async () => {
                if (!pendingSubmit) return;
                try {
                  await processTransaction(
                    pendingSubmit.montoPagado,
                    pendingSubmit.montoTotal,
                    pendingSubmit.metodoPagoNorm
                  );
                } finally {
                  setShowConfirmDialog(false);
                  setPendingSubmit(null);
                }
              }}
            >
              {isSubmitting ? "Procesando..." : "Continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RegistroOtrosGastos;
