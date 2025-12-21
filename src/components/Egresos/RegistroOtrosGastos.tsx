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

type AnyJson = any;

const apiJson = async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
  const res: AnyJson = await apiFetch(url, init);
  return (res?.data ?? res) as T;
};

const onlyNumberDot = (v: string) => v.replace(/[^\d.]/g, "");

const RegistroOtrosGastos = () => {
  const [concept, setConcept] = useState("");
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
  const [pendingSubmit, setPendingSubmit] = useState<{ montoPagado: number; montoTotal: number } | null>(null);
  const [esProveedorRecurrente, setEsProveedorRecurrente] = useState(false);

  const { data: tarjetasCredito } = useTarjetasCredito();
  const { data: saldosDisponibles } = useSaldosDisponibles();

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!concept.trim() || !totalAmount || !paymentType) {
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

    // Validar proveedor si hay monto pendiente
    if ((paymentType === "credito" || paymentType === "parcial") && !supplierName.trim()) {
      toast({
        title: "⚠️ Proveedor requerido",
        description: "Debes proporcionar el nombre del proveedor para pagos a crédito o parciales",
        variant: "destructive",
      });
      return;
    }

    try {
      // ✅ Validar sesión por cookies (E2E backend)
      await apiJson("/api/auth/me", { method: "GET" });

      const montoTotal = parseFloat((totalAmount || "0").replace(/,/g, "")) || 0;
      const montoPagado =
        paymentType === "contado"
          ? montoTotal
          : paymentType === "parcial"
          ? parseFloat((paidAmount || "0").replace(/,/g, "")) || 0
          : 0;

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
            description: `Disponible: $${formatCurrency(saldosDisponibles.efectivo)} | Necesitas: $${formatCurrency(
              montoPagado
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
            description: `Disponible: $${formatCurrency(saldosDisponibles.bancos)} | Necesitas: $${formatCurrency(
              montoPagado
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

        // Confirmación antes de ejecutar el cargo
        setPendingSubmit({ montoPagado, montoTotal });
        setShowConfirmDialog(true);
        return;
      }

      await processTransaction(montoPagado, montoTotal);
    } catch (error) {
      console.error("Error al registrar gasto:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo registrar el gasto. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const processTransaction = async (montoPagado: number, montoTotal: number) => {
    const montoPendiente = Math.max(0, montoTotal - montoPagado);

    // TODOS los otros gastos van a la cuenta 5204
    const cuentaCodigo = "5204";

    
    const payload = {
      tipo_egreso: "otro",
      subtipo_egreso: "otros_gastos",
      descripcion: concept,
      concepto: concept,
      cuenta_codigo: cuentaCodigo,
      monto_total: montoTotal,
      tipo_pago: paymentType,
      metodo_pago: paymentMethod || null,
      monto_pagado: montoPagado,
      monto_pendiente: montoPendiente,
      fecha_vencimiento: dueDate || null,
      proveedor_nombre: supplierName || null,
      proveedor_telefono: supplierPhone || null,
      proveedor_email: supplierEmail || null,
      proveedor_rfc: supplierRFC || null,
      es_proveedor_recurrente: esProveedorRecurrente,
      comentarios: description || null,
    };

    const result = await apiJson<{ numero_asiento?: string }>(`/api/transacciones/egresos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    toast({
      title: "✅ Gasto registrado",
      description: `Gasto registrado correctamente con asiento contable ${result?.numero_asiento || ""}`,
    });

    resetForm();
  };

  return (
    <>
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

        <CardContent className="p-6 pt-0">
          <form onSubmit={handleSubmit} className="space-y-6 pb-4">
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
                  <Label htmlFor="monto-total">Monto Total *</Label>
                  <Input
                    id="monto-total"
                    type="text"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(onlyNumberDot(e.target.value))}
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
                <RadioGroup
                  value={paymentType}
                  onValueChange={(v) => {
                    setPaymentType(v);
                    // reset relacionados
                    setPaymentMethod("");
                    setPaidAmount("");
                    setDueDate("");
                    if (v === "contado") {
                      setSupplierName("");
                      setSupplierPhone("");
                      setSupplierEmail("");
                      setSupplierRFC("");
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

            {/* Información del Proveedor - SOLO cuando hay monto pendiente */}
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

                {/* Pregunta sobre recurrencia */}
                <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="es-recurrente"
                      checked={esProveedorRecurrente}
                      onChange={(e) => setEsProveedorRecurrente(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
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
              <Button type="button" variant="outline" onClick={resetForm}>
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
              {paymentMethod?.startsWith("tarjeta_credito_") && tarjetasCredito && (() => {
                const tarjetaId = paymentMethod.replace("tarjeta_credito_", "");
                const tarjeta = tarjetasCredito.find((t: any) => t.id === tarjetaId);
                if (!tarjeta) return null;

                const cargo = pendingSubmit?.montoPagado || 0;
                const despues = (tarjeta.limite_disponible ?? 0) - cargo;

                return (
                  <>
                    <div className="space-y-2 my-4">
                      <p>
                        <strong>Tarjeta:</strong> {tarjeta.nombre}
                      </p>
                      <p>
                        <strong>Límite disponible actual:</strong> ${(tarjeta.limite_disponible ?? 0).toFixed(2)}
                      </p>
                      <p>
                        <strong>Monto del cargo:</strong> ${cargo.toFixed(2)}
                      </p>
                      <p>
                        <strong>Límite disponible después:</strong> ${despues.toFixed(2)}
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
              onClick={() => {
                setShowConfirmDialog(false);
                setPendingSubmit(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={async () => {
                if (!pendingSubmit) return;
                try {
                  await processTransaction(pendingSubmit.montoPagado, pendingSubmit.montoTotal);
                } finally {
                  setShowConfirmDialog(false);
                  setPendingSubmit(null);
                }
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RegistroOtrosGastos;
