// bukipin-dashboard/src/components/Egresos/RegistroEgresosGenerales.tsx
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
import { Wallet, Save, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCuentas } from "@/hooks/useCuentas";
import { useSubcuentas } from "@/hooks/useSubcuentas";
import { useTarjetasCorporativasEgresos, validarLimiteCredito } from "@/hooks/useTarjetasCredito";
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
const getTarjetaInstitucion = (t: any) => String(t?.institucion_financiera ?? t?.institucion ?? "");
const getTarjetaLimiteDisponible = (t: any) => Number(t?.limite_disponible ?? t?.limiteDisponible ?? 0);

// -------------------- Subcuentas robustas --------------------
const getSubCuentaMadre = (s: any) =>
  String(s?.cuenta_madre_codigo ?? s?.cuentaMadreCodigo ?? s?.cuentaCodigo ?? s?.cuenta_codigo ?? "");
const getSubNombre = (s: any) => String(s?.nombre ?? s?.name ?? "Subcuenta");

const RegistroEgresosGenerales = () => {
  /**
   * ✅ FIX SCROLL DOBLE (E2E)
   * En dashboards es común tener:
   *  - main con overflow-y-auto (scroll interno)
   *  - html/body todavía con scroll (scroll externo)
   * Resultado: doble scrollbar + “blanco”/descuadres.
   *
   * Aquí bloqueamos el scroll del documento mientras este form está montado,
   * para que SOLO quede el scroll del contenedor del dashboard.
   *
   * (Si luego quieres hacerlo “global”, lo movemos al DashboardLayout.)
   */
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlHeight = html.style.height;
    const prevBodyHeight = body.style.height;

    // Bloquear scroll externo
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.height = "100%";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.height = prevHtmlHeight;
      body.style.height = prevBodyHeight;
    };
  }, []);

  // ✅ el usuario elige primero si es costo o gasto
  const [tipoEgresoUI, setTipoEgresoUI] = useState<"costo" | "gasto" | "">("");

  const [concept, setConcept] = useState("");
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState("");
  const [subcuentaSeleccionada, setSubcuentaSeleccionada] = useState<string>("__none__");

  const [totalAmount, setTotalAmount] = useState(""); // string UI
  const [paymentType, setPaymentType] = useState(""); // contado|credito|parcial
  const [paymentMethod, setPaymentMethod] = useState(""); // efectivo|bancos|tarjeta_credito_*
  const [paidAmount, setPaidAmount] = useState(""); // string UI
  const [dueDate, setDueDate] = useState("");

  // Proveedor (estilo precargados)
  const [registrarProveedor, setRegistrarProveedor] = useState(false);
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
  const { data: tarjetasCreditoRaw = [] } = useTarjetasCorporativasEgresos();
  const { data: saldosDisponibles } = useSaldosDisponibles();

  const tarjetasCredito = useMemo(() => tarjetasCreditoRaw ?? [], [tarjetasCreditoRaw]);

  const subcuentasArr = useMemo(() => {
    const raw: any = subcuentasData ?? [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  }, [subcuentasData]);

  // ✅ Allowlist EXACTA para "Gasto"
  const GASTO_CODES_ALLOWLIST = useMemo(
    () => new Set(["5101", "5102", "5103", "5104", "5105", "5106", "5107", "5108"]),
    []
  );

  const cuentasFlat = useMemo(() => cuentasData?.cuentasFlat ?? [], [cuentasData]);

  const cuentasGastoPermitidas = useMemo(() => {
    return (cuentasFlat || []).filter((c: any) => GASTO_CODES_ALLOWLIST.has(String(c?.codigo ?? "")));
  }, [cuentasFlat, GASTO_CODES_ALLOWLIST]);

  // Proveedor obligatorio si credito/parcial
  useEffect(() => {
    if (paymentType === "credito" || paymentType === "parcial") {
      setRegistrarProveedor(true);
    }
  }, [paymentType]);

  const resetForm = () => {
    setTipoEgresoUI("");
    setConcept("");
    setCuentaSeleccionada("");
    setSubcuentaSeleccionada("__none__");

    setTotalAmount("");
    setPaymentType("");
    setPaymentMethod("");
    setPaidAmount("");
    setDueDate("");

    setRegistrarProveedor(false);
    setSupplierName("");
    setSupplierPhone("");
    setSupplierEmail("");
    setSupplierRFC("");

    setDescription("");

    setShowConfirmDialog(false);
    setPendingSubmit(null);
  };

  // ✅ Al cambiar Costo/Gasto, forzamos cuenta como pediste
  const handleTipoEgresoChange = (v: "costo" | "gasto") => {
    setTipoEgresoUI(v);

    // reset de cuenta/subcuenta al cambiar tipo
    setSubcuentaSeleccionada("__none__");

    if (v === "costo") {
      // ✅ COSTO = únicamente 5001
      setCuentaSeleccionada("5001");
    } else {
      // ✅ GASTO = debe elegir de allowlist
      setCuentaSeleccionada("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const metodoPagoNorm = normalizeMetodoPago(paymentMethod);

    // ✅ Validaciones UX (antes de pegarle al backend)
    if (!tipoEgresoUI) {
      toast({
        title: "⚠️ Falta seleccionar tipo",
        description: "Selecciona si este registro es Costo o Gasto.",
        variant: "destructive",
      });
      return;
    }

    // ✅ Cuenta:
    if (tipoEgresoUI === "gasto" && !cuentaSeleccionada) {
      toast({
        title: "⚠️ Falta seleccionar cuenta",
        description: "Selecciona una cuenta de gasto válida.",
        variant: "destructive",
      });
      return;
    }

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

    // Contado/parcial requieren método
    if ((paymentType === "contado" || paymentType === "parcial") && !metodoPagoNorm) {
      toast({
        title: "⚠️ Falta método de pago",
        description: "Selecciona el método de pago para contado o pago parcial.",
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

    // Proveedor obligatorio si credito/parcial
    if ((paymentType === "credito" || paymentType === "parcial") && !supplierName.trim()) {
      toast({
        title: "⚠️ Proveedor requerido",
        description: "Para crédito o pago parcial, registra el nombre del proveedor.",
        variant: "destructive",
      });
      return;
    }

    const montoPagado =
      paymentType === "contado" ? montoTotal : paymentType === "parcial" ? toNum(paidAmount, 0) : 0;

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
      // ✅ Verificar sesión por cookies (si expira, apiFetch suele tirar 401)
      await apiJson("/api/auth/me", { method: "GET" });

      // Validar saldos si aplica (efectivo/bancos)
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

      if (metodoPagoNorm === "efectivo" && saldosDisponibles) {
        const disponible = toNum(saldosDisponibles?.efectivo, 0);
        if (montoPagado > disponible) {
          toast({
            title: "💰 Saldo insuficiente en efectivo",
            description: `Disponible: $${formatCurrency(disponible)} | Necesitas: $${formatCurrency(montoPagado)}`,
            variant: "destructive",
          });
          return;
        }
      }

      if (metodoPagoNorm === "bancos" && saldosDisponibles) {
        const disponible = toNum(saldosDisponibles?.bancos, 0);
        if (montoPagado > disponible) {
          toast({
            title: "🏦 Saldo insuficiente en bancos",
            description: `Disponible: $${formatCurrency(disponible)} | Necesitas: $${formatCurrency(montoPagado)}`,
            variant: "destructive",
          });
          return;
        }
      }

      // Validar límite tarjeta crédito
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

        setPendingSubmit({ montoPagado, montoTotal, metodoPagoNorm });
        setShowConfirmDialog(true);
        return;
      }

      await processTransaction(montoPagado, montoTotal, metodoPagoNorm);
    } catch (error: any) {
      console.error("Error al registrar egreso:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo registrar el egreso. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const processTransaction = async (montoPagado: number, montoTotal: number, metodoPagoNorm: string) => {
    setIsSubmitting(true);
    try {
      const montoPendiente = Math.max(0, montoTotal - montoPagado);
      const financingId = metodoPagoNorm.startsWith("tarjeta_credito_")
        ? metodoPagoNorm.replace("tarjeta_credito_", "")
        : null;

      // ✅ Backend exige cantidad y precio_unitario > 0.
      // Para “Generales”, usamos 1 x montoTotal.
      const cantidad = 1;
      const precioUnitario = montoTotal;

      // ✅ Cuenta final:
      const cuentaFinal = tipoEgresoUI === "costo" ? "5001" : cuentaSeleccionada;

      const subcuentaIdToSend =
        subcuentaSeleccionada && subcuentaSeleccionada !== "__none__" ? subcuentaSeleccionada : null;

      // ✅ Payload CANÓNICO + espejos legacy (alineación FE/BE)
      const payload: any = {
        // Canon
        tipoEgreso: tipoEgresoUI,
        subtipoEgreso: "general",

        // ✅ bandera E2E: forzar que el asiento vaya contra 2001 Proveedores
        forceProveedores2001: true,
        force_proveedores_2001: true,

        descripcion: concept.trim(),
        concepto: concept.trim(),

        cuentaCodigo: cuentaFinal,
        subcuentaId: subcuentaIdToSend,

        montoTotal,
        cantidad,
        precioUnitario,

        tipoPago: paymentType,
        metodoPago: metodoPagoNorm || null,
        financingId,
        montoPagado,
        montoPendiente,

        fechaVencimiento: paymentType === "credito" || paymentType === "parcial" ? dueDate || null : null,

        proveedorNombre: registrarProveedor ? supplierName.trim() || null : null,
        proveedorTelefono: registrarProveedor ? supplierPhone || null : null,
        proveedorEmail: registrarProveedor ? supplierEmail || null : null,
        proveedorRFC: registrarProveedor ? supplierRFC || null : null,

        comentarios: description || null,

        // Legacy snake_case (por si tu backend aún lee esto)
        tipo_egreso: tipoEgresoUI,
        subtipo_egreso: "general",
        cuenta_codigo: cuentaFinal,
        subcuenta_id: subcuentaIdToSend,
        monto_total: montoTotal,
        tipo_pago: paymentType,
        metodo_pago: metodoPagoNorm || null,
        financing_id: financingId,
        monto_pagado: montoPagado,
        monto_pendiente: montoPendiente,
        fecha_vencimiento: paymentType === "credito" || paymentType === "parcial" ? dueDate || null : null,
        proveedor_nombre: registrarProveedor ? supplierName.trim() || null : null,
        proveedor_telefono: registrarProveedor ? supplierPhone || null : null,
        proveedor_email: registrarProveedor ? supplierEmail || null : null,
        proveedor_rfc: registrarProveedor ? supplierRFC || null : null,
        precio_unitario: precioUnitario,
      };

      const res = await apiFetch("/api/egresos/transacciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = res?.data ?? res;

      toast({
        title: "✅ Egreso registrado",
        description: `Egreso registrado correctamente${
          result?.numero_asiento ? ` con asiento contable ${result.numero_asiento}` : ""
        }`,
      });

      // 🔔 refrescar otras vistas
      window.dispatchEvent(new CustomEvent("bukipin:egreso-creado"));

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

  // Subcuentas filtradas por cuenta seleccionada
  const subcuentasFiltradas = useMemo(() => {
    if (!cuentaSeleccionada) return [];
    return (subcuentasArr || []).filter((s: any) => getSubCuentaMadre(s) === String(cuentaSeleccionada));
  }, [subcuentasArr, cuentaSeleccionada]);

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

        <CardContent className="px-6 pb-6">
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Consejo: Si este egreso existe en tu catálogo, úsalo en <b>Costos y Gastos Precargados</b> para mantener
              consistencia.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Tipo de Registro *</h3>
              <p className="text-sm text-muted-foreground">
                Define si este movimiento se registrará como <b>Costo</b> o <b>Gasto</b>.
              </p>

              <RadioGroup value={tipoEgresoUI} onValueChange={(v) => handleTipoEgresoChange(v as any)}>
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

            {/* Información del gasto */}
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

                  {tipoEgresoUI === "costo" ? (
                    <Input value="5001 - Costos de venta" disabled />
                  ) : (
                    <Select
                      value={cuentaSeleccionada}
                      onValueChange={(value) => {
                        setCuentaSeleccionada(value);
                        setSubcuentaSeleccionada("__none__");
                      }}
                      disabled={!tipoEgresoUI || tipoEgresoUI !== "gasto"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={!tipoEgresoUI ? "Selecciona primero tipo" : "Seleccionar cuenta"} />
                      </SelectTrigger>
                      <SelectContent>
                        {cuentasGastoPermitidas?.length ? (
                          cuentasGastoPermitidas.map((cuenta: any) => (
                            <SelectItem key={String(cuenta.codigo)} value={String(cuenta.codigo)}>
                              {cuenta.codigo} - {cuenta.nombre}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground">
                            No hay cuentas disponibles (revisa que existan 5101–5108 en tu plan de cuentas).
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Subcuenta (opcional) */}
                {cuentaSeleccionada ? (
                  <div className="space-y-2">
                    <Label htmlFor="subcuenta">Subcuenta</Label>
                    <Select value={subcuentaSeleccionada} onValueChange={setSubcuentaSeleccionada}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar subcuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin subcuenta</SelectItem>
                        {subcuentasFiltradas.length ? (
                          subcuentasFiltradas.map((s: any) => {
                            const sid = getId(s);
                            return (
                              <SelectItem key={sid} value={sid}>
                                {getSubNombre(s)}
                              </SelectItem>
                            );
                          })
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground">No hay subcuentas para esta cuenta.</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Subcuenta</Label>
                    <Input disabled placeholder="Selecciona primero una cuenta" />
                  </div>
                )}

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
                  {!!totalAmount && <p className="text-xs text-muted-foreground">Total: ${formatNumber(totalAmount)}</p>}
                </div>
              </div>
            </div>

            <Separator />

            {/* Pago */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Información de Pago</h3>

              <div className="space-y-2">
                <Label>Tipo de Pago *</Label>
                <RadioGroup
                  value={paymentType}
                  onValueChange={(v) => {
                    setPaymentType(v);
                    if (v !== "parcial") setPaidAmount("");
                    if (v === "contado") setDueDate("");
                    if (v === "credito") setPaymentMethod("");
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
                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(normalizeMetodoPago(v))}>
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
                                  {nombre}
                                  {getTarjetaInstitucion(t) ? ` - ${getTarjetaInstitucion(t)}` : ""}
                                  {` - Disponible: $${formatCurrency(limite)}`}
                                </SelectItem>
                              );
                            })
                          : null}
                      </SelectContent>
                    </Select>
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
                  <Input id="fecha-vencimiento" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              )}
            </div>

            <Separator />

            {/* Proveedor */}
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
                  <AlertDescription>Para pagos a crédito o parciales es obligatorio registrar la información del proveedor.</AlertDescription>
                </Alert>
              )}

              {(registrarProveedor || paymentType === "credito" || paymentType === "parcial") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="proveedor-nombre">
                      Nombre del Proveedor {paymentType === "credito" || paymentType === "parcial" ? "*" : ""}
                    </Label>
                    <Input
                      id="proveedor-nombre"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="Nombre completo o razón social"
                      required={paymentType === "credito" || paymentType === "parcial"}
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
              {paymentMethod?.startsWith("tarjeta_credito_") &&
                tarjetasCredito &&
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
                          {getTarjetaInstitucion(tarjeta) ? ` - ${getTarjetaInstitucion(tarjeta)}` : ""}
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
              onClick={() => {
                if (pendingSubmit) {
                  processTransaction(pendingSubmit.montoPagado, pendingSubmit.montoTotal, pendingSubmit.metodoPagoNorm);
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
