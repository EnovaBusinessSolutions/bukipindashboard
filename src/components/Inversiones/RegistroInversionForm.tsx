import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInversiones } from "@/hooks/useInversiones";
import { useProveedores } from "@/hooks/useProveedores";
import { useTarjetasCredito, validarLimiteCredito } from "@/hooks/useTarjetasCredito";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { actualizarSaldoTarjetaCredito, extraerIdTarjetaCredito } from "@/lib/tarjetaCreditoUtils";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import {
  CalendarIcon,
  Camera,
  Building2,
  CreditCard,
  FileText,
  Landmark,
  Package,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wallet,
  BadgeCheck,
  Image as ImageIcon,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PreviewCuentasContables from "./PreviewCuentasContables";

const categoriaOptions = [
  { value: "equipo_computo", label: "Equipo de Cómputo", icon: "💻" },
  { value: "maquinaria", label: "Maquinaria", icon: "⚙️" },
  { value: "vehiculos", label: "Vehículos", icon: "🚘" },
  { value: "mobiliario", label: "Mobiliario", icon: "🪑" },
  { value: "edificios", label: "Edificios", icon: "🏢" },
  { value: "equipo_oficina", label: "Equipo de Oficina", icon: "🗂️" },
  { value: "otro", label: "Otro", icon: "📦" },
];

const cuentaMap: Record<string, string> = {
  equipo_computo: "1206",
  maquinaria: "1203",
  vehiculos: "1205",
  mobiliario: "1204",
  edificios: "1202",
  equipo_oficina: "1204",
  otro: "1212",
};

const initialFormData = {
  producto_nombre: "",
  descripcion: "",
  valor_total: "",
  monto_pagado: "",
  tipo_pago: "",
  metodo_pago: "",
  proveedor_nombre: "",
  proveedor_email: "",
  proveedor_telefono: "",
  proveedor_rfc: "",
  cuenta_codigo: "",
  comentarios: "",
};

const SectionShell = ({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50/60 px-5 py-4 md:px-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3A6E]/8 text-[#0B3A6E] shadow-sm">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] md:text-base font-semibold text-slate-900">{title}</h3>
            {subtitle ? <p className="mt-1 text-xs md:text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="px-5 py-5 md:px-6 md:py-6">{children}</div>
    </div>
  );
};

const StatMiniCard = ({
  label,
  value,
  hint,
  accent = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "success" | "warning";
}) => {
  const accentClasses =
    accent === "success"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-700"
      : accent === "warning"
        ? "border-amber-200 bg-amber-50/70 text-amber-700"
        : "border-slate-200 bg-slate-50/80 text-slate-700";

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm", accentClasses)}>
      <p className="text-[11px] uppercase tracking-[0.12em] font-semibold opacity-80">{label}</p>
      <p className="mt-2 text-lg md:text-xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs opacity-80">{hint}</p> : null}
    </div>
  );
};

const RegistroInversionForm = () => {
  const { crearInversion, recomendaciones } = useInversiones();
  const { proveedores } = useProveedores();
  const { data: tarjetasCredito } = useTarjetasCredito();
  const { data: saldosDisponibles } = useSaldosDisponibles();

  const [fecha] = useState<Date>(new Date());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<any>(null);
  const [categoriaActivo, setCategoriaActivo] = useState<string>("");
  const [anosDepreciacion, setAnosDepreciacion] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagenUrl, setImagenUrl] = useState<string>("");
  const [valorTotalDisplay, setValorTotalDisplay] = useState<string>("");
  const [montoPagadoDisplay, setMontoPagadoDisplay] = useState<string>("");
  const [tipoProveedor, setTipoProveedor] = useState<string>("");
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>("");

  const [fechaVencimiento, setFechaVencimiento] = useState<Date | undefined>();
  const [formData, setFormData] = useState(initialFormData);

  const recomendacion = recomendaciones.find((r) => r.categoria_activo === categoriaActivo);

  const formatNumber = (value: string) => {
    if (!value) return "";
    const num = parseFloat(value.replace(/,/g, ""));
    if (isNaN(num)) return "";
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getCategoriaLabel = (categoria: string) => {
    const labels: Record<string, string> = {
      equipo_computo: "Equipo de Cómputo",
      maquinaria: "Maquinaria",
      vehiculos: "Vehículos",
      mobiliario: "Mobiliario",
      edificios: "Edificios",
      equipo_oficina: "Equipo de Oficina",
      otro: "Otro",
    };
    return labels[categoria] || categoria;
  };

  const categoriaMeta = useMemo(
    () => categoriaOptions.find((item) => item.value === categoriaActivo),
    [categoriaActivo]
  );

  const resetForm = () => {
    setFormData(initialFormData);
    setCategoriaActivo("");
    setAnosDepreciacion(null);
    setImagenUrl("");
    setFechaVencimiento(undefined);
    setValorTotalDisplay("");
    setMontoPagadoDisplay("");
    setTipoProveedor("");
    setProveedorSeleccionado("");
  };

  const handleCategoriaChange = (value: string) => {
    setCategoriaActivo(value);
    const rec = recomendaciones.find((r) => r.categoria_activo === value);
    if (rec) setAnosDepreciacion(rec.anos_recomendados);

    setFormData((prev) => ({
      ...prev,
      cuenta_codigo: cuentaMap[value] || "1212",
    }));
  };

  const handleValorTotalChange = (value: string) => {
    const cleanValue = value.replace(/[^\d.]/g, "");
    setValorTotalDisplay(cleanValue);
    setFormData((prev) => ({ ...prev, valor_total: cleanValue }));
  };

  const handleValorTotalBlur = () => {
    if (formData.valor_total) setValorTotalDisplay(formatNumber(formData.valor_total));
  };

  const handleValorTotalFocus = () => {
    setValorTotalDisplay(formData.valor_total);
  };

  const handleMontoPagadoChange = (value: string) => {
    const cleanValue = value.replace(/[^\d.]/g, "");
    setMontoPagadoDisplay(cleanValue);
    setFormData((prev) => ({ ...prev, monto_pagado: cleanValue }));
  };

  const handleMontoPagadoBlur = () => {
    if (formData.monto_pagado) setMontoPagadoDisplay(formatNumber(formData.monto_pagado));
  };

  const handleMontoPagadoFocus = () => {
    setMontoPagadoDisplay(formData.monto_pagado);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Archivo inválido",
        description: "Selecciona una imagen (PNG/JPG/WebP).",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const json = await apiFetch("/api/uploads/activos", {
        method: "POST",
        body: fd,
      });

      const payload: any = (json as any)?.data ?? json;
      const url = payload?.url;

      if (!url) {
        throw new Error("El servidor no devolvió la URL de la imagen.");
      }

      setImagenUrl(url);
      toast({
        title: "Imagen cargada",
        description: "La imagen se ha cargado correctamente",
      });
    } catch (error: any) {
      console.error("Error upload imagen activo:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo cargar la imagen",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const calcularMontoPendiente = () => {
    const valorTotal = parseFloat(formData.valor_total) || 0;
    const montoPagado = parseFloat(formData.monto_pagado) || 0;
    return valorTotal - montoPagado;
  };

  const valorTotalNum = parseFloat(formData.valor_total) || 0;
  const montoPagadoNum =
    formData.tipo_pago === "total"
      ? valorTotalNum
      : formData.tipo_pago === "credito"
        ? 0
        : parseFloat(formData.monto_pagado) || 0;
  const montoPendienteNum = valorTotalNum - montoPagadoNum;

  const submitInversion = async (payloadForm: typeof formData, montoPagado: number, valorTotal: number) => {
    const valorDepreciacionAnual = valorTotal / (anosDepreciacion || 1);
    const valorDepreciacionMensual = valorDepreciacionAnual / 12;

    crearInversion.mutate(
      {
        ...payloadForm,
        categoria_activo: categoriaActivo,
        anos_depreciacion: anosDepreciacion || 0,
        valor_total: valorTotal,
        monto_pagado: montoPagado,
        monto_pendiente: valorTotal - montoPagado,
        valor_depreciacion_anual: valorDepreciacionAnual,
        valor_depreciacion_mensual: valorDepreciacionMensual,
        fecha_adquisicion: format(fecha, "yyyy-MM-dd"),
        fecha_inicio_depreciacion: format(fecha, "yyyy-MM-dd"),
        fecha_vencimiento: fechaVencimiento ? format(fechaVencimiento, "yyyy-MM-dd") : null,
        imagen_url: imagenUrl,
      } as any,
      {
        onSuccess: async () => {
          const tarjetaId = extraerIdTarjetaCredito(payloadForm.metodo_pago);
          if (tarjetaId && montoPagado > 0) {
            await actualizarSaldoTarjetaCredito(
              tarjetaId,
              montoPagado,
              `Pago de inversión: ${payloadForm.producto_nombre}`
            );
          }
          resetForm();
          setShowConfirmDialog(false);
          setPendingSubmit(null);
        },
        onError: (error: any) => {
          console.error("Error al registrar inversión:", error);

          let errorMessage = "Error al registrar la inversión";

          if (error?.message) {
            if (error.message.includes("Para pago total")) {
              errorMessage = error.message;
            } else if (error.message.includes("asiento")) {
              errorMessage = "Error al generar el asiento contable: " + error.message;
            } else {
              errorMessage = error.message;
            }
          }

          toast({
            title: "❌ Error",
            description: errorMessage,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cuenta_codigo) {
      toast({
        title: "Error de validación",
        description:
          "No se pudo determinar la cuenta contable. Por favor selecciona nuevamente la categoría.",
        variant: "destructive",
      });
      return;
    }

    const valorTotal = parseFloat(formData.valor_total);
    const montoPagado =
      formData.tipo_pago === "total"
        ? valorTotal
        : formData.tipo_pago === "credito"
          ? 0
          : parseFloat(formData.monto_pagado);

    if (
      montoPagado > 0 &&
      (formData.metodo_pago === "efectivo" || formData.metodo_pago === "transferencia")
    ) {
      if (!saldosDisponibles) {
        toast({
          title: "⚠️ Error de validación",
          description: "No se pudieron cargar los saldos disponibles. Intenta nuevamente.",
          variant: "destructive",
        });
        return;
      }
    }

    if (formData.metodo_pago === "efectivo") {
      if (montoPagado > saldosDisponibles.efectivo) {
        toast({
          title: "💰 Saldo insuficiente en efectivo",
          description: `Disponible: $${formatCurrency(saldosDisponibles.efectivo)} | Necesitas: $${formatCurrency(montoPagado)}`,
          variant: "destructive",
        });
        return;
      }
    }

    if (formData.metodo_pago === "transferencia") {
      if (montoPagado > saldosDisponibles.bancos) {
        toast({
          title: "🏦 Saldo insuficiente en bancos",
          description: `Disponible: $${formatCurrency(saldosDisponibles.bancos)} | Necesitas: $${formatCurrency(montoPagado)}`,
          variant: "destructive",
        });
        return;
      }
    }

    if (formData.metodo_pago?.startsWith("tarjeta_credito_") && tarjetasCredito) {
      const tarjetaId = formData.metodo_pago.replace("tarjeta_credito_", "");
      const validacion = validarLimiteCredito(tarjetaId, montoPagado, tarjetasCredito);

      if (!validacion.valido) {
        toast({
          title: "⚠️ Límite de crédito excedido",
          description: validacion.mensaje,
          variant: "destructive",
        });
        return;
      }

      setPendingSubmit({ formData, montoPagado, valorTotal });
      setShowConfirmDialog(true);
      return;
    }

    await submitInversion(formData, montoPagado, valorTotal);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <div className="xl:col-span-8 2xl:col-span-9 space-y-6">
        <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_16px_60px_rgba(2,6,23,0.08)] rounded-3xl">
          <CardHeader className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(11,58,110,0.08),_transparent_35%),linear-gradient(135deg,rgba(255,255,255,1),rgba(248,250,252,0.92))] px-6 py-6 md:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#0B3A6E]/10 bg-[#0B3A6E]/5 px-3 py-1 text-xs font-semibold text-[#0B3A6E]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Registro premium de activos CAPEX
                </div>

                <div>
                  <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight text-slate-950">
                    Registro de Inversión CAPEX
                  </CardTitle>
                  <CardDescription className="mt-2 max-w-3xl text-sm md:text-[15px] leading-6 text-slate-600">
                    Registra activos fijos con una experiencia más clara, profesional y contablemente alineada.
                    Define categoría, valor, pago, proveedor y depreciación desde un solo flujo.
                  </CardDescription>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-full lg:min-w-[420px] lg:max-w-[520px]">
                <StatMiniCard
                  label="Cuenta contable"
                  value={formData.cuenta_codigo || "Pendiente"}
                  hint={categoriaActivo ? "Asignada por categoría" : "Selecciona categoría"}
                />
                <StatMiniCard
                  label="Depreciación"
                  value={anosDepreciacion ? `${anosDepreciacion} años` : "Pendiente"}
                  hint="Aplicación automática"
                  accent={anosDepreciacion ? "success" : "default"}
                />
                <StatMiniCard
                  label="Fecha de registro"
                  value={format(fecha, "dd/MM/yyyy")}
                  hint="Se registra hoy"
                  accent="default"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-4 py-5 md:px-6 md:py-6 lg:px-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <SectionShell
                icon={<Package className="h-5 w-5" />}
                title="Categoría del activo"
                subtitle="Selecciona el tipo de activo para configurar automáticamente la cuenta contable y la depreciación sugerida."
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">
                      ¿Qué tipo de activo fijo vas a registrar? *
                    </Label>
                    <Select value={categoriaActivo} onValueChange={handleCategoriaChange} required>
                      <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm">
                        <SelectValue placeholder="Selecciona la categoría del activo" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriaOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            <span className="flex items-center gap-2">
                              <span>{item.icon}</span>
                              <span>{item.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {categoriaActivo ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-[#0B3A6E]/10 bg-[#0B3A6E]/5 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0B3A6E]/80">
                          Categoría seleccionada
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {categoriaMeta?.icon} {getCategoriaLabel(categoriaActivo)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700/80">
                          Cuenta contable
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{formData.cuenta_codigo}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700/80">
                          Depreciación sugerida
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {anosDepreciacion ? `${anosDepreciacion} años` : "Pendiente"}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </SectionShell>

              {categoriaActivo && (
                <>
                  <SectionShell
                    icon={<FileText className="h-5 w-5" />}
                    title="Información del activo"
                    subtitle="Captura los datos principales del bien que se va a capitalizar."
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="producto_nombre" className="text-sm font-semibold text-slate-700">
                          Nombre del activo *
                        </Label>
                        <Input
                          id="producto_nombre"
                          value={formData.producto_nombre}
                          onChange={(e) => setFormData((prev) => ({ ...prev, producto_nombre: e.target.value }))}
                          placeholder="Ej: Computadora Dell XPS 15"
                          required
                          className="h-11 rounded-2xl border-slate-200 shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="valor_total" className="text-sm font-semibold text-slate-700">
                          Valor total del activo *
                        </Label>
                        <Input
                          id="valor_total"
                          type="text"
                          value={valorTotalDisplay || formData.valor_total}
                          onChange={(e) => handleValorTotalChange(e.target.value)}
                          onBlur={handleValorTotalBlur}
                          onFocus={handleValorTotalFocus}
                          placeholder="Ej: 25000.00"
                          required
                          className="h-11 rounded-2xl border-slate-200 shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="anos_depreciacion" className="text-sm font-semibold text-slate-700">
                          Años de depreciación *
                        </Label>
                        <Input
                          id="anos_depreciacion"
                          type="number"
                          value={anosDepreciacion || ""}
                          disabled
                          className="h-11 rounded-2xl border-slate-200 bg-slate-50 text-slate-700 shadow-sm"
                          required
                        />
                        <p className="text-xs text-slate-500">
                          Establecido automáticamente según la categoría del activo.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="fecha_adquisicion" className="text-sm font-semibold text-slate-700">
                          Fecha de adquisición *
                        </Label>
                        <Input
                          id="fecha_adquisicion"
                          type="text"
                          value={format(fecha, "PPP")}
                          disabled
                          className="h-11 rounded-2xl border-slate-200 bg-slate-50 text-slate-700 shadow-sm"
                        />
                        <p className="text-xs text-slate-500">Se registrará automáticamente con la fecha de hoy.</p>
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="descripcion" className="text-sm font-semibold text-slate-700">
                          Descripción del activo
                        </Label>
                        <Textarea
                          id="descripcion"
                          value={formData.descripcion}
                          onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                          placeholder="Descripción detallada del activo"
                          rows={3}
                          className="rounded-2xl border-slate-200 shadow-sm resize-none"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-3">
                        <Label htmlFor="imagen" className="text-sm font-semibold text-slate-700">
                          Fotografía del activo
                        </Label>

                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm text-slate-600">
                                <Camera className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">Sube evidencia visual del activo</p>
                                <p className="text-xs text-slate-500">
                                  JPG, PNG o WebP. Esto ayuda a documentar mejor la inversión.
                                </p>
                              </div>
                            </div>

                            <Input
                              id="imagen"
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              disabled={uploading}
                              className="max-w-full md:max-w-[320px] rounded-2xl border-slate-200 bg-white shadow-sm"
                            />
                          </div>

                          <div className="mt-4">
                            {imagenUrl ? (
                              <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                                <img
                                  src={imagenUrl}
                                  alt="Preview"
                                  className="h-20 w-20 rounded-xl object-cover border border-slate-200"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900">Imagen cargada correctamente</p>
                                  <p className="text-xs text-slate-500 truncate">
                                    El activo ya cuenta con fotografía asociada.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                                <ImageIcon className="h-4 w-4 text-slate-400" />
                                <p className="text-sm text-slate-500">Aún no has cargado una imagen para este activo.</p>
                              </div>
                            )}
                          </div>

                          {uploading ? (
                            <p className="mt-3 text-xs text-slate-500">Subiendo imagen…</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </SectionShell>

                  <SectionShell
                    icon={<Wallet className="h-5 w-5" />}
                    title="Información de pago"
                    subtitle="Define cómo se pagó la inversión para generar el impacto contable correcto."
                  >
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700">
                          ¿Cómo se pagó el activo? *
                        </Label>
                        <Select
                          value={formData.tipo_pago}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              tipo_pago: value,
                              metodo_pago: value === "credito" ? "" : prev.metodo_pago,
                              monto_pagado: value === "credito" ? "" : prev.monto_pagado,
                            }))
                          }
                          required
                        >
                          <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm">
                            <SelectValue placeholder="Selecciona el tipo de pago" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="total">Pago Total</SelectItem>
                            <SelectItem value="parcial">Pago Parcial</SelectItem>
                            <SelectItem value="credito">Crédito Total</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.tipo_pago ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <StatMiniCard
                            label="Valor total"
                            value={`$${formatNumber((valorTotalNum || 0).toString()) || "0.00"}`}
                          />
                          <StatMiniCard
                            label="Monto pagado"
                            value={`$${formatNumber((montoPagadoNum || 0).toString()) || "0.00"}`}
                            accent={montoPagadoNum > 0 ? "success" : "default"}
                          />
                          <StatMiniCard
                            label="Pendiente"
                            value={`$${formatNumber((montoPendienteNum || 0).toString()) || "0.00"}`}
                            accent={montoPendienteNum > 0 ? "warning" : "success"}
                          />
                        </div>
                      ) : null}

                      {formData.tipo_pago === "total" && (
                        <div className="space-y-2">
                          <Label htmlFor="metodo_pago_total" className="text-sm font-semibold text-slate-700">
                            Método de pago *
                          </Label>
                          <Select
                            value={formData.metodo_pago}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, metodo_pago: value }))}
                            required
                          >
                            <SelectTrigger
                              id="metodo_pago_total"
                              className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                            >
                              <SelectValue placeholder="Seleccionar método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="efectivo">
                                Efectivo - Disponible: ${saldosDisponibles?.efectivo.toFixed(2) || "0.00"}
                              </SelectItem>
                              <SelectItem value="transferencia">
                                Bancos - Disponible: ${saldosDisponibles?.bancos.toFixed(2) || "0.00"}
                              </SelectItem>
                              {tarjetasCredito && tarjetasCredito.length > 0
                                ? tarjetasCredito.map((tarjeta) => (
                                    <SelectItem key={tarjeta.id} value={`tarjeta_credito_${tarjeta.id}`}>
                                      {tarjeta.nombre} - Disponible: ${tarjeta.limite_disponible.toFixed(2)}
                                    </SelectItem>
                                  ))
                                : null}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {formData.tipo_pago === "parcial" && (
                        <div className="space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                              <Label htmlFor="monto_pagado" className="text-sm font-semibold text-slate-700">
                                Monto pagado *
                              </Label>
                              <Input
                                id="monto_pagado"
                                type="text"
                                value={montoPagadoDisplay || formData.monto_pagado}
                                onChange={(e) => handleMontoPagadoChange(e.target.value)}
                                onBlur={handleMontoPagadoBlur}
                                onFocus={handleMontoPagadoFocus}
                                placeholder="Ej: 10000.00"
                                required
                                className="h-11 rounded-2xl border-slate-200 shadow-sm"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="metodo_pago_parcial" className="text-sm font-semibold text-slate-700">
                                Método de pago *
                              </Label>
                              <Select
                                value={formData.metodo_pago}
                                onValueChange={(value) => setFormData((prev) => ({ ...prev, metodo_pago: value }))}
                                required
                              >
                                <SelectTrigger
                                  id="metodo_pago_parcial"
                                  className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                                >
                                  <SelectValue placeholder="Seleccionar método" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="efectivo">
                                    Efectivo - Disponible: ${saldosDisponibles?.efectivo.toFixed(2) || "0.00"}
                                  </SelectItem>
                                  <SelectItem value="transferencia">
                                    Bancos - Disponible: ${saldosDisponibles?.bancos.toFixed(2) || "0.00"}
                                  </SelectItem>
                                  {tarjetasCredito && tarjetasCredito.length > 0
                                    ? tarjetasCredito.map((tarjeta) => (
                                        <SelectItem key={tarjeta.id} value={`tarjeta_credito_${tarjeta.id}`}>
                                          {tarjeta.nombre} - Disponible: ${tarjeta.limite_disponible.toFixed(2)}
                                        </SelectItem>
                                      ))
                                    : null}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {formData.monto_pagado && formData.valor_total ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
                              <p className="text-sm font-semibold text-amber-900">
                                Monto pendiente: ${formatNumber(calcularMontoPendiente().toString())}
                              </p>
                              <p className="mt-1 text-xs text-amber-800/80">
                                Este saldo quedará registrado como obligación pendiente del activo.
                              </p>
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700">Fecha de vencimiento *</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={cn(
                                    "h-12 w-full justify-start rounded-2xl border-slate-200 bg-white text-left font-normal shadow-sm",
                                    !fechaVencimiento && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {fechaVencimiento ? format(fechaVencimiento, "PPP") : <span>Selecciona fecha</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={fechaVencimiento}
                                  onSelect={setFechaVencimiento}
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      )}

                      {formData.tipo_pago === "credito" && (
                        <div className="space-y-5">
                          <div className="rounded-2xl border border-[#0B3A6E]/10 bg-[#0B3A6E]/5 p-4 shadow-sm">
                            <p className="text-sm font-semibold text-[#0B3A6E]">
                              Monto total a crédito: $
                              {formData.valor_total ? formatNumber(formData.valor_total) : "0.00"}
                            </p>
                            <p className="mt-1 text-xs text-[#0B3A6E]/80">
                              Se registrará como pasivo pendiente para liquidación posterior.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700">Fecha de vencimiento *</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={cn(
                                    "h-12 w-full justify-start rounded-2xl border-slate-200 bg-white text-left font-normal shadow-sm",
                                    !fechaVencimiento && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {fechaVencimiento ? format(fechaVencimiento, "PPP") : <span>Selecciona fecha</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={fechaVencimiento}
                                  onSelect={setFechaVencimiento}
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionShell>

                  <SectionShell
                    icon={<Building2 className="h-5 w-5" />}
                    title="Información del proveedor"
                    subtitle="Asocia el proveedor existente o captura uno nuevo para dejar trazabilidad completa."
                  >
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700">Tipo de proveedor</Label>
                        <RadioGroup
                          value={tipoProveedor}
                          onValueChange={(val) => {
                            setTipoProveedor(val);

                            if (val === "nuevo") {
                              setProveedorSeleccionado("");
                              setFormData((prev) => ({
                                ...prev,
                                proveedor_nombre: "",
                                proveedor_telefono: "",
                                proveedor_email: "",
                                proveedor_rfc: "",
                              }));
                            } else if (val === "existente") {
                              setFormData((prev) => ({
                                ...prev,
                                proveedor_nombre: "",
                                proveedor_telefono: "",
                                proveedor_email: "",
                                proveedor_rfc: "",
                              }));
                            }
                          }}
                          className="grid grid-cols-1 md:grid-cols-2 gap-3"
                        >
                          <Label
                            htmlFor="proveedor-nuevo-inv"
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all shadow-sm",
                              tipoProveedor === "nuevo"
                                ? "border-[#0B3A6E]/30 bg-[#0B3A6E]/5"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            )}
                          >
                            <RadioGroupItem value="nuevo" id="proveedor-nuevo-inv" />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Nuevo proveedor</p>
                              <p className="text-xs text-slate-500">Captura la información manualmente.</p>
                            </div>
                          </Label>

                          <Label
                            htmlFor="proveedor-existente-inv"
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all shadow-sm",
                              tipoProveedor === "existente"
                                ? "border-[#0B3A6E]/30 bg-[#0B3A6E]/5"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            )}
                          >
                            <RadioGroupItem value="existente" id="proveedor-existente-inv" />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Proveedor existente</p>
                              <p className="text-xs text-slate-500">Usa un proveedor ya registrado en Bukipin.</p>
                            </div>
                          </Label>
                        </RadioGroup>
                      </div>

                      {tipoProveedor === "existente" && (
                        <div className="space-y-2">
                          <Label htmlFor="proveedor-select-inv" className="text-sm font-semibold text-slate-700">
                            Seleccionar proveedor *
                          </Label>
                          <Select
                            value={proveedorSeleccionado}
                            onValueChange={(val) => {
                              setProveedorSeleccionado(val);
                              const proveedor = proveedores.find((p) => p.id === val);
                              if (proveedor) {
                                setFormData((prev) => ({
                                  ...prev,
                                  proveedor_nombre: proveedor.nombre,
                                  proveedor_telefono: proveedor.telefono || "",
                                  proveedor_email: proveedor.email || "",
                                  proveedor_rfc: proveedor.rfc || "",
                                }));
                              }
                            }}
                          >
                            <SelectTrigger
                              id="proveedor-select-inv"
                              className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                            >
                              <SelectValue placeholder="Seleccionar proveedor" />
                            </SelectTrigger>
                            <SelectContent>
                              {proveedores && proveedores.length > 0 ? (
                                proveedores.map((proveedor) => (
                                  <SelectItem key={proveedor.id} value={proveedor.id}>
                                    {proveedor.nombre}
                                    {proveedor.rfc ? ` - ${proveedor.rfc}` : ""}
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

                      {tipoProveedor === "existente" && proveedorSeleccionado ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm">
                          <div className="space-y-1">
                            <Label className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Nombre</Label>
                            <p className="text-sm font-semibold text-slate-900">{formData.proveedor_nombre}</p>
                          </div>
                          {formData.proveedor_telefono ? (
                            <div className="space-y-1">
                              <Label className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Teléfono</Label>
                              <p className="text-sm font-semibold text-slate-900">{formData.proveedor_telefono}</p>
                            </div>
                          ) : null}
                          {formData.proveedor_email ? (
                            <div className="space-y-1">
                              <Label className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Email</Label>
                              <p className="text-sm font-semibold text-slate-900">{formData.proveedor_email}</p>
                            </div>
                          ) : null}
                          {formData.proveedor_rfc ? (
                            <div className="space-y-1">
                              <Label className="text-[11px] uppercase tracking-[0.12em] text-slate-500">RFC</Label>
                              <p className="text-sm font-semibold text-slate-900">{formData.proveedor_rfc}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {tipoProveedor === "nuevo" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-2">
                            <Label htmlFor="proveedor_nombre" className="text-sm font-semibold text-slate-700">
                              Nombre del proveedor
                            </Label>
                            <Input
                              id="proveedor_nombre"
                              value={formData.proveedor_nombre}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, proveedor_nombre: e.target.value }))
                              }
                              placeholder="Nombre del proveedor"
                              className="h-11 rounded-2xl border-slate-200 shadow-sm"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="proveedor_telefono" className="text-sm font-semibold text-slate-700">
                              Teléfono
                            </Label>
                            <Input
                              id="proveedor_telefono"
                              value={formData.proveedor_telefono}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, proveedor_telefono: e.target.value }))
                              }
                              placeholder="Teléfono de contacto"
                              className="h-11 rounded-2xl border-slate-200 shadow-sm"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="proveedor_email" className="text-sm font-semibold text-slate-700">
                              Email
                            </Label>
                            <Input
                              id="proveedor_email"
                              type="email"
                              value={formData.proveedor_email}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, proveedor_email: e.target.value }))
                              }
                              placeholder="email@proveedor.com"
                              className="h-11 rounded-2xl border-slate-200 shadow-sm"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="proveedor_rfc" className="text-sm font-semibold text-slate-700">
                              RFC
                            </Label>
                            <Input
                              id="proveedor_rfc"
                              value={formData.proveedor_rfc}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, proveedor_rfc: e.target.value }))
                              }
                              placeholder="RFC del proveedor"
                              className="h-11 rounded-2xl border-slate-200 shadow-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionShell>

                  <SectionShell
                    icon={<Receipt className="h-5 w-5" />}
                    title="Comentarios adicionales"
                    subtitle="Agrega notas relevantes para auditoría, seguimiento interno o contexto del activo."
                  >
                    <div className="space-y-2">
                      <Label htmlFor="comentarios" className="text-sm font-semibold text-slate-700">
                        Comentarios
                      </Label>
                      <Textarea
                        id="comentarios"
                        value={formData.comentarios}
                        onChange={(e) => setFormData((prev) => ({ ...prev, comentarios: e.target.value }))}
                        placeholder="Notas o comentarios adicionales sobre la inversión"
                        rows={3}
                        className="rounded-2xl border-slate-200 shadow-sm resize-none"
                      />
                    </div>
                  </SectionShell>

                  <div className="sticky bottom-0 z-10 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-md">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B3A6E]/8 text-[#0B3A6E]">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Registro contable listo para procesarse</p>
                          <p className="text-xs text-slate-500">
                            Bukipin generará el asiento correspondiente según la categoría y forma de pago.
                          </p>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={crearInversion.isPending}
                        className="h-12 rounded-2xl px-6 text-sm font-semibold shadow-lg bg-[#0B3A6E] hover:bg-[#082E57]"
                      >
                        {crearInversion.isPending ? "Registrando..." : "Registrar inversión"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="xl:col-span-4 2xl:col-span-3 space-y-6">
        <div className="xl:sticky xl:top-6 space-y-6">
          {categoriaActivo && formData.valor_total && formData.tipo_pago ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white shadow-[0_16px_50px_rgba(2,6,23,0.08)] overflow-hidden">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3A6E]/8 text-[#0B3A6E]">
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Vista previa contable</h3>
                    <p className="text-xs text-slate-500">Impacto estimado antes de registrar</p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <PreviewCuentasContables
                  categoriaActivo={categoriaActivo}
                  valorTotal={valorTotalNum}
                  tipoPago={formData.tipo_pago}
                  metodoPago={formData.metodo_pago}
                  montoPagado={montoPagadoNum}
                  montoPendiente={montoPendienteNum}
                  anosDepreciacion={anosDepreciacion}
                  fechaAdquisicion={fecha}
                />
              </div>
            </div>
          ) : (
            <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-[0_16px_50px_rgba(2,6,23,0.06)]">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3A6E]/8 text-[#0B3A6E]">
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Vista previa contable</CardTitle>
                    <CardDescription className="text-xs">
                      Completa categoría, monto y tipo de pago para ver el impacto contable.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-[0_16px_50px_rgba(2,6,23,0.08)] overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3A6E]/8 text-[#0B3A6E]">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Recomendaciones de depreciación</CardTitle>
                  <CardDescription className="text-xs">
                    Años sugeridos según normativas fiscales mexicanas.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-4 py-4">
              <div className="overflow-auto max-h-[calc(100vh-22rem)] pr-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs text-slate-500">Categoría</TableHead>
                      <TableHead className="text-xs text-center text-slate-500">Años</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recomendaciones.map((rec) => {
                      const active = rec.categoria_activo === categoriaActivo;
                      return (
                        <TableRow
                          key={rec.id}
                          className={cn(
                            "transition-colors",
                            active ? "bg-[#0B3A6E]/5 hover:bg-[#0B3A6E]/5" : "hover:bg-slate-50/80"
                          )}
                        >
                          <TableCell className="text-xs font-medium py-3 text-slate-700">
                            {getCategoriaLabel(rec.categoria_activo)}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                                active
                                  ? "bg-[#0B3A6E] text-white"
                                  : "bg-slate-100 text-slate-700"
                              )}
                            >
                              {rec.anos_recomendados}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {categoriaActivo && recomendacion ? (
                <div className="mt-4 rounded-2xl border border-[#0B3A6E]/10 bg-[#0B3A6E]/5 p-4">
                  <p className="text-sm font-semibold text-slate-900">{getCategoriaLabel(categoriaActivo)}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Rango: {recomendacion.anos_minimos} - {recomendacion.anos_maximos} años
                  </p>
                  {recomendacion.descripcion ? (
                    <p className="mt-2 text-xs leading-5 text-slate-600">{recomendacion.descripcion}</p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="rounded-3xl border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pago con tarjeta de crédito</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSubmit?.formData?.metodo_pago?.startsWith("tarjeta_credito_") &&
                tarjetasCredito &&
                (() => {
                  const tarjetaId = pendingSubmit.formData.metodo_pago.replace("tarjeta_credito_", "");
                  const tarjeta = tarjetasCredito.find((t) => t.id === tarjetaId);

                  return tarjeta ? (
                    <>
                      <div className="my-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left">
                        <p>
                          <strong>Tarjeta:</strong> {tarjeta.nombre}
                        </p>
                        <p>
                          <strong>Límite disponible actual:</strong> ${tarjeta.limite_disponible.toFixed(2)}
                        </p>
                        <p>
                          <strong>Monto del cargo:</strong> ${pendingSubmit?.montoPagado?.toFixed(2)}
                        </p>
                        <p>
                          <strong>Límite disponible después:</strong>{" "}
                          {(tarjeta.limite_disponible - (pendingSubmit?.montoPagado || 0)).toFixed(2)}
                        </p>
                      </div>
                      <p>¿Deseas continuar con este pago?</p>
                    </>
                  ) : null;
                })()}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowConfirmDialog(false);
                setPendingSubmit(null);
              }}
              className="rounded-2xl"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-[#0B3A6E] hover:bg-[#082E57]"
              onClick={async () => {
                if (pendingSubmit) {
                  const { formData: pendingFormData, montoPagado, valorTotal } = pendingSubmit;
                  await submitInversion(pendingFormData, montoPagado, valorTotal);
                }
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RegistroInversionForm;