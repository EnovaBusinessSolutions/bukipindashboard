import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Wallet, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCuentas } from "@/hooks/useCuentas";
import { useSubcuentas } from "@/hooks/useSubcuentas";
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
import { formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

const RegistroEgresosGenerales = () => {
  // ✅ NUEVO: el usuario elige primero si es costo o gasto
  const [tipoEgresoUI, setTipoEgresoUI] = useState<"costo" | "gasto" | "">("");

  const [concept, setConcept] = useState("");
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState("");
  const [subcuentaSeleccionada, setSubcuentaSeleccionada] = useState("");
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: cuentasData } = useCuentas();
  const { data: subcuentasData } = useSubcuentas();
  const { data: tarjetasCredito } = useTarjetasCredito();
  const { data: saldosDisponibles } = useSaldosDisponibles();

  const resetForm = () => {
    setTipoEgresoUI("");
    setConcept("");
    setCuentaSeleccionada("");
    setSubcuentaSeleccionada("");
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ Validaciones UX (antes de pegarle al backend)
    if (!tipoEgresoUI) {
      toast({
        title: "⚠️ Falta seleccionar tipo",
        description: "Selecciona si este registro es Costo o Gasto.",
        variant: "destructive",
      });
      return;
    }

    if (!concept || !cuentaSeleccionada || !totalAmount || !paymentType) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa todos los campos obligatorios",
        variant: "destructive",
      });
      return;
    }

    const montoTotal = Number(totalAmount || 0);
    if (!(montoTotal > 0)) {
      toast({
        title: "⚠️ Monto inválido",
        description: "El monto total debe ser mayor a 0.",
        variant: "destructive",
      });
      return;
    }

    // Contado/parcial requieren método
    if ((paymentType === "contado" || paymentType === "parcial") && !paymentMethod) {
      toast({
        title: "⚠️ Falta método de pago",
        description: "Selecciona el método de pago para contado o pago parcial.",
        variant: "destructive",
      });
      return;
    }

    const montoPagado =
      paymentType === "contado"
        ? montoTotal
        : paymentType === "parcial"
          ? Number(paidAmount || 0)
          : 0;

    if (paymentType === "parcial") {
      if (!(montoPagado > 0) || !(montoPagado < montoTotal)) {
        toast({
          title: "⚠️ Pago parcial inválido",
          description: "En pago parcial, el monto pagado debe ser mayor a 0 y menor al total.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      // FASE 1: Verificar saldos cargados (si aplica)
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

      // FASE 2: Validar saldo efectivo
      if (paymentMethod === "efectivo") {
        if (montoPagado > (saldosDisponibles?.efectivo ?? 0)) {
          toast({
            title: "💰 Saldo insuficiente en efectivo",
            description: `Disponible: $${formatCurrency(saldosDisponibles?.efectivo ?? 0)} | Necesitas: $${formatCurrency(montoPagado)}`,
            variant: "destructive",
          });
          return;
        }
      }

      // Validar saldo bancos
      if (paymentMethod === "tarjeta-transferencia") {
        if (montoPagado > (saldosDisponibles?.bancos ?? 0)) {
          toast({
            title: "🏦 Saldo insuficiente en bancos",
            description: `Disponible: $${formatCurrency(saldosDisponibles?.bancos ?? 0)} | Necesitas: $${formatCurrency(montoPagado)}`,
            variant: "destructive",
          });
          return;
        }
      }

      // Validar límite tarjeta crédito
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

        setPendingSubmit({ montoPagado, montoTotal });
        setShowConfirmDialog(true);
        return;
      }

      await processTransaction(montoPagado, montoTotal);
    } catch (error) {
      console.error("Error al registrar egreso:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo registrar el egreso. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const processTransaction = async (montoPagado: number, montoTotal: number) => {
    setIsSubmitting(true);
    try {
      const montoPendiente = Math.max(0, montoTotal - montoPagado);

      // ✅ IMPORTANTÍSIMO:
      // Tu backend exige cantidad y precio_unitario > 0.
      // Para “Generales”, usamos 1 x montoTotal para pasar validación sin inventar.
      const cantidad = 1;
      const precioUnitario = montoTotal;

      const payload = {
        // ✅ ahora lo decide el usuario (no lo inferimos por cuenta)
        tipo_egreso: tipoEgresoUI, // "costo" | "gasto"
        subtipo_egreso: "general",

        // ✅ bandera E2E: forzar que el asiento vaya contra 2001 Proveedores
        force_proveedores_2001: true,

        descripcion: concept,
        concepto: concept,

        cuenta_codigo: cuentaSeleccionada,
        subcuenta_id: subcuentaSeleccionada || null,

        monto_total: montoTotal,
        cantidad,
        precio_unitario: precioUnitario,

        tipo_pago: paymentType,
        metodo_pago: paymentMethod || null,
        monto_pagado: montoPagado,
        monto_pendiente: montoPendiente,

        fecha_vencimiento: dueDate || null,

        proveedor_nombre: supplierName || null,
        proveedor_telefono: supplierPhone || null,
        proveedor_email: supplierEmail || null,
        proveedor_rfc: supplierRFC || null,

        comentarios: description || null,
      };

      // ✅ OJO: este es el endpoint correcto del router que me mostraste
      const res = await apiFetch("/api/egresos/transacciones", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const result = res?.data ?? res;

      toast({
        title: "✅ Egreso registrado",
        description: `Egreso registrado correctamente${result?.numero_asiento ? ` con asiento contable ${result.numero_asiento}` : ""}`,
      });

      resetForm();
    } catch (error: any) {
      console.error("❌ Error al registrar egreso:", error);

      const msg =
        error?.status === 401
          ? "Tu sesión expiró. Inicia sesión nuevamente."
          : error?.message
            ? String(error.message)
            : "No se pudo registrar el egreso. Intenta nuevamente.";

      toast({
        title: "❌ Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="max-w-5xl mx-auto border-0 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Registro de Costos y Gastos Generales
          </CardTitle>
          <CardDescription>Registra egresos generales que no tienen un segmento específico en el catálogo</CardDescription>
        </CardHeader>

        <CardContent className="p-6 pt-0">
          <form onSubmit={handleSubmit} className="space-y-6 pb-4">
            {/* ✅ NUEVO BLOQUE (primero que el usuario ve): tipo costo/gasto */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Tipo de Registro *</h3>
              <p className="text-sm text-muted-foreground">
                Define si este movimiento se registrará como <b>Costo</b> o <b>Gasto</b>.
              </p>

              <RadioGroup value={tipoEgresoUI} onValueChange={(v) => setTipoEgresoUI(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="costo" id="tipo-costo" />
                  <Label htmlFor="tipo-costo">Costo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gasto" id="tipo-gasto" />
                  <Label htmlFor="tipo-gasto">Gasto</Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

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
                    placeholder="Ej: Servicios de electricidad"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cuenta">Cuenta *</Label>
                  <Select
                    value={cuentaSeleccionada}
                    onValueChange={(value) => {
                      setCuentaSeleccionada(value);
                      setSubcuentaSeleccionada("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {cuentasData?.cuentasFlat?.map((cuenta: any) => (
                        <SelectItem key={cuenta.codigo} value={cuenta.codigo}>
                          {cuenta.codigo} - {cuenta.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {cuentaSeleccionada && (
                  <div className="space-y-2">
                    <Label htmlFor="subcuenta">Subcuenta</Label>
                    <Select value={subcuentaSeleccionada} onValueChange={setSubcuentaSeleccionada}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar subcuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {subcuentasData?.filter((sub: any) => sub.cuenta_madre_codigo === cuentaSeleccionada).length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">No hay subcuentas para esta cuenta.</div>
                        ) : (
                          subcuentasData
                            ?.filter((sub: any) => sub.cuenta_madre_codigo === cuentaSeleccionada)
                            .map((subcuenta: any) => (
                              <SelectItem key={subcuenta.id} value={subcuenta.id}>
                                {subcuenta.nombre}
                              </SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
                    <Label htmlFor="metodo-pago">Método de Pago *</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="efectivo">
                          Efectivo - Disponible: ${formatCurrency(saldosDisponibles?.efectivo ?? 0)}
                        </SelectItem>
                        <SelectItem value="tarjeta-transferencia">
                          Bancos - Disponible: ${formatCurrency(saldosDisponibles?.bancos ?? 0)}
                        </SelectItem>
                        {tarjetasCredito && tarjetasCredito.length > 0
                          ? tarjetasCredito.map((tarjeta: any) => (
                              <SelectItem key={tarjeta.id} value={`tarjeta_credito_${tarjeta.id}`}>
                                {tarjeta.nombre} - Disponible: ${formatCurrency(tarjeta.limite_disponible ?? 0)}
                              </SelectItem>
                            ))
                          : null}
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentType === "parcial" && (
                    <div className="space-y-2">
                      <Label htmlFor="monto-pagado">Monto Pagado *</Label>
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
                  <Input id="fecha-vencimiento" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" className="gap-2" disabled={isSubmitting}>
                <Save className="h-4 w-4" />
                {isSubmitting ? "Registrando..." : "Registrar Egreso"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pago con tarjeta de crédito</AlertDialogTitle>
            <AlertDialogDescription>
              {paymentMethod?.startsWith("tarjeta_credito_") && tarjetasCredito && (() => {
                const tarjetaId = paymentMethod.replace("tarjeta_credito_", "");
                const tarjeta = tarjetasCredito.find((t: any) => t.id === tarjetaId);
                return tarjeta ? (
                  <>
                    <div className="space-y-2 my-4">
                      <p><strong>Tarjeta:</strong> {tarjeta.nombre}</p>
                      <p><strong>Límite disponible actual:</strong> ${Number(tarjeta.limite_disponible ?? 0).toFixed(2)}</p>
                      <p><strong>Monto del cargo:</strong> ${Number(pendingSubmit?.montoPagado ?? 0).toFixed(2)}</p>
                      <p><strong>Límite disponible después:</strong> ${(Number(tarjeta.limite_disponible ?? 0) - Number(pendingSubmit?.montoPagado ?? 0)).toFixed(2)}</p>
                    </div>
                    <p>¿Deseas continuar con este pago?</p>
                  </>
                ) : null;
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
              onClick={() => {
                if (pendingSubmit) {
                  processTransaction(pendingSubmit.montoPagado, pendingSubmit.montoTotal);
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

export default RegistroEgresosGenerales;
