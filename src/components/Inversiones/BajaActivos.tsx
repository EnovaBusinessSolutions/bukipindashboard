import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInversiones } from "@/hooks/useInversiones";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import {
  TrendingDown,
  FileText,
  RotateCcw,
  CalendarIcon,
  Landmark,
  Wallet,
  ArrowRightLeft,
  Receipt,
  ArrowUpRight,
  Clock3,
  ShieldAlert,
  UserRound,
  BadgeDollarSign,
  Image as ImageIcon,
  Layers3,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAsientosInversion } from "@/hooks/useAsientosInversion";
import { useClientes, useCreateCliente } from "@/hooks/useClientes";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

const BUKIPIN_BLUE = "#0B3A6E";

const formatMoney = (value?: number | null) =>
  Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const safeDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const SummaryMetricCard = ({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
}) => {
  return (
    <Card className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(11,58,110,0.08)]">
      <CardContent className="p-0">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.08),rgba(255,255,255,1),rgba(11,58,110,0.03))] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {title}
              </p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
              {subtitle ? <p className="mt-2 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
            </div>

            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "rgba(11,58,110,0.10)", color: BUKIPIN_BLUE }}
            >
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const EmptyState = ({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) => {
  return (
    <div className="py-16">
      <div className="flex flex-col items-center justify-center text-center">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "rgba(11,58,110,0.08)", color: BUKIPIN_BLUE }}
        >
          {icon}
        </div>
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
};

const SectionHeader = ({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) => {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "rgba(11,58,110,0.10)", color: BUKIPIN_BLUE }}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-950">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
};

const DetailStat = ({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: React.ReactNode;
  accent?: "default" | "blue" | "green" | "amber";
}) => {
  const className =
    accent === "blue"
      ? "border-[rgba(11,58,110,0.14)] bg-[rgba(11,58,110,0.05)]"
      : accent === "green"
        ? "border-emerald-200 bg-emerald-50/80"
        : accent === "amber"
          ? "border-amber-200 bg-amber-50/80"
          : "border-slate-200 bg-slate-50/70";

  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
};

const BajaActivos = () => {
  const { inversiones, isLoading, darDeBajaActivo } = useInversiones();
  const { data: clientes } = useClientes();
  const crearCliente = useCreateCliente();

  const [selectedInversion, setSelectedInversion] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [asientoDialogOpen, setAsientoDialogOpen] = useState(false);
  const [selectedAsientoInversion, setSelectedAsientoInversion] = useState<any>(null);
  const [tipoBaja, setTipoBaja] = useState<"vendido" | "dado_de_baja">("dado_de_baja");
  const [fechaBaja, setFechaBaja] = useState<Date>(new Date());
  const [motivo, setMotivo] = useState("");
  const [valorVenta, setValorVenta] = useState("");

  const [tipoPago, setTipoPago] = useState<"contado" | "credito" | "parcial">("contado");
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo");
  const [montoPagado, setMontoPagado] = useState<string>("");
  const [montoPendiente, setMontoPendiente] = useState<string>("0");
  const [fechaVencimiento, setFechaVencimiento] = useState<Date | undefined>(undefined);

  const [tipoComprador, setTipoComprador] = useState<"nuevo" | "recurrente">("nuevo");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>("");
  const [guardarComoCliente, setGuardarComoCliente] = useState(false);
  const [compradorNombre, setCompradorNombre] = useState("");
  const [compradorRfc, setCompradorRfc] = useState("");
  const [compradorTelefono, setCompradorTelefono] = useState("");
  const [compradorEmail, setCompradorEmail] = useState("");

  const inversionesActivas = inversiones.filter((inv) => inv.estado === "activo");
  const inversionesBaja = inversiones.filter(
    (inv) => inv.estado === "dado_de_baja" || inv.estado === "vendido"
  );

  const { data: asientoData } = useAsientosInversion(
    selectedAsientoInversion?.id,
    selectedAsientoInversion?.estado === "vendido" ? "venta" : "baja"
  );

  const totalActivosDisponibles = inversionesActivas.length;
  const totalHistorialBajas = inversionesBaja.length;
  const totalVendidos = inversionesBaja.filter((inv) => inv.estado === "vendido").length;
  const totalBajasDirectas = inversionesBaja.filter((inv) => inv.estado === "dado_de_baja").length;

  const resetDialogState = () => {
    setDialogOpen(false);
    setSelectedInversion(null);
    setMotivo("");
    setValorVenta("");
    setTipoBaja("dado_de_baja");
    setFechaBaja(new Date());
    setTipoPago("contado");
    setMetodoPago("efectivo");
    setMontoPagado("");
    setMontoPendiente("0");
    setFechaVencimiento(undefined);
    setTipoComprador("nuevo");
    setClienteSeleccionado("");
    setGuardarComoCliente(false);
    setCompradorNombre("");
    setCompradorRfc("");
    setCompradorTelefono("");
    setCompradorEmail("");
  };

  const handleSubmit = async () => {
    if (!selectedInversion || !motivo) return;

    if (tipoBaja === "vendido") {
      const venta = parseFloat(valorVenta);
      if (!venta || venta <= 0) {
        return;
      }

      const pagado = parseFloat(montoPagado) || 0;
      const pendiente = parseFloat(montoPendiente) || 0;

      if (tipoPago === "contado" && Math.abs(pagado - venta) > 0.01) {
        return;
      }

      if (tipoPago === "credito" && pagado !== 0) {
        return;
      }

      if (tipoPago === "parcial" && Math.abs(pagado + pendiente - venta) > 0.01) {
        return;
      }

      if (pendiente > 0 && !fechaVencimiento) {
        return;
      }

      if (tipoComprador === "nuevo" && guardarComoCliente && compradorNombre) {
        try {
          await crearCliente.mutateAsync({
            nombre: compradorNombre,
            rfc: compradorRfc || undefined,
            telefono: compradorTelefono || undefined,
            email: compradorEmail || undefined,
          });
        } catch (error) {
          console.error("Error al guardar cliente:", error);
        }
      }
    }

    darDeBajaActivo.mutate(
      {
        id: selectedInversion.id,
        fecha_baja: format(fechaBaja, "yyyy-MM-dd"),
        motivo_baja: motivo,
        valor_venta: tipoBaja === "vendido" && valorVenta ? parseFloat(valorVenta) : undefined,
        estado: tipoBaja,
        metodo_pago_venta:
          tipoBaja === "vendido" && (tipoPago === "contado" || tipoPago === "parcial")
            ? metodoPago
            : undefined,
        tipo_pago_venta: tipoBaja === "vendido" ? tipoPago : undefined,
        monto_pagado_venta: tipoBaja === "vendido" ? parseFloat(montoPagado) || 0 : undefined,
        monto_pendiente_venta:
          tipoBaja === "vendido" ? parseFloat(montoPendiente) || 0 : undefined,
        fecha_vencimiento_venta:
          tipoBaja === "vendido" && fechaVencimiento
            ? format(fechaVencimiento, "yyyy-MM-dd")
            : undefined,
        comprador_nombre: tipoBaja === "vendido" && compradorNombre ? compradorNombre : undefined,
        comprador_rfc: tipoBaja === "vendido" && compradorRfc ? compradorRfc : undefined,
        comprador_telefono:
          tipoBaja === "vendido" && compradorTelefono ? compradorTelefono : undefined,
        comprador_email: tipoBaja === "vendido" && compradorEmail ? compradorEmail : undefined,
      },
      {
        onSuccess: () => {
          resetDialogState();
        },
      }
    );
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

  const calcularDepreciacionAcumulada = (inversion: any, fechaHasta?: Date) => {
    const fechaAdquisicion = new Date(inversion.fecha_adquisicion);
    const fechaCalculo = fechaHasta || new Date();
    const mesesTranscurridos = Math.floor(
      (fechaCalculo.getTime() - fechaAdquisicion.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    return Math.min(
      mesesTranscurridos * (inversion.valor_depreciacion_mensual || 0),
      inversion.valor_total
    );
  };

  const calcularValorLibros = (inversion: any, fechaHasta?: Date) => {
    return inversion.valor_total - calcularDepreciacionAcumulada(inversion, fechaHasta);
  };

  const calcularGananciaPerdida = (inversion: any) => {
    if (inversion.estado !== "vendido" || !inversion.valor_venta) return null;
    const fechaBaja = inversion.fecha_baja ? new Date(inversion.fecha_baja) : new Date();
    const valorLibros = calcularValorLibros(inversion, fechaBaja);
    return inversion.valor_venta - valorLibros;
  };

  const ventaNum = parseFloat(valorVenta) || 0;
  const pagadoNum = parseFloat(montoPagado) || 0;
  const pendienteNum = parseFloat(montoPendiente) || 0;
  const valorLibrosSeleccionado = selectedInversion ? calcularValorLibros(selectedInversion) : 0;

  const validacionVentaInvalida =
    tipoBaja === "vendido" &&
    (!valorVenta || parseFloat(valorVenta) <= 0 || !motivo || darDeBajaActivo.isPending);

  const validacionBajaInvalida = tipoBaja === "dado_de_baja" && (!motivo || darDeBajaActivo.isPending);

  if (isLoading) {
    return (
      <Card className="rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(11,58,110,0.06)]">
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryMetricCard
          title="Activos disponibles"
          value={`${totalActivosDisponibles}`}
          subtitle="Activos actualmente vigentes y elegibles para baja o venta."
          icon={<Layers3 className="h-5 w-5" />}
        />
        <SummaryMetricCard
          title="Historial total"
          value={`${totalHistorialBajas}`}
          subtitle="Total histórico de movimientos de baja registrados."
          icon={<Receipt className="h-5 w-5" />}
        />
        <SummaryMetricCard
          title="Activos vendidos"
          value={`${totalVendidos}`}
          subtitle="Movimientos cerrados mediante venta del activo."
          icon={<BadgeDollarSign className="h-5 w-5" />}
        />
        <SummaryMetricCard
          title="Bajas directas"
          value={`${totalBajasDirectas}`}
          subtitle="Activos retirados sin generar una venta asociada."
          icon={<TrendingDown className="h-5 w-5" />}
        />
      </div>

      <Tabs defaultValue="disponibles" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-[22px] border border-slate-200 bg-white p-1 shadow-sm">
          <TabsTrigger value="disponibles" className="rounded-[16px] py-3 text-sm font-semibold">
            Activos Disponibles ({inversionesActivas.length})
          </TabsTrigger>
          <TabsTrigger value="historial" className="rounded-[16px] py-3 text-sm font-semibold">
            Historial de Bajas ({inversionesBaja.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disponibles" className="mt-6">
          <Card className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(11,58,110,0.08)]">
            <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.08),rgba(255,255,255,1),rgba(11,58,110,0.03))] px-6 py-5">
              <SectionHeader
                icon={<ArrowRightLeft className="h-5 w-5" />}
                title="Activos Disponibles para Baja"
                subtitle="Registra la venta o retiro definitivo de activos fijos. Solo se muestran activos en estado activo."
              />
            </CardHeader>

            <CardContent className="px-4 py-4 md:px-6 md:py-5">
              <div className="overflow-hidden rounded-[24px] border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Activo
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Categoría
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Valor Original
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Valor en Libros
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Depreciación Acumulada
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Fecha Adquisición
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 text-right">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {inversionesActivas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <EmptyState
                            title="No hay activos activos para dar de baja"
                            description="Cuando existan activos en estado activo, aparecerán aquí listos para registrar su venta o baja."
                            icon={<Clock3 className="h-6 w-6" />}
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      inversionesActivas.map((inversion) => {
                        const valorLibros = calcularValorLibros(inversion);
                        const depreciacionAcumulada = calcularDepreciacionAcumulada(inversion);

                        return (
                          <TableRow key={inversion.id} className="hover:bg-slate-50/70">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-11 w-11 ring-1 ring-slate-200">
                                  <AvatarImage
                                    src={inversion.imagen_url || ""}
                                    alt={inversion.producto_nombre}
                                  />
                                  <AvatarFallback className="bg-slate-100 text-slate-500">
                                    {inversion.producto_nombre.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-900">
                                    {inversion.producto_nombre}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="text-slate-700">
                              {getCategoriaLabel(inversion.categoria_activo)}
                            </TableCell>

                            <TableCell className="font-medium text-slate-800">
                              ${formatMoney(inversion.valor_total)}
                            </TableCell>

                            <TableCell className="font-semibold text-slate-900">
                              ${valorLibros.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </TableCell>

                            <TableCell className="text-slate-500">
                              ${depreciacionAcumulada.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </TableCell>

                            <TableCell className="text-slate-700">
                              {format(new Date(inversion.fecha_adquisicion), "dd/MM/yyyy")}
                            </TableCell>

                            <TableCell>
                              <div className="flex justify-end">
                                <Dialog
                                  open={dialogOpen && selectedInversion?.id === inversion.id}
                                  onOpenChange={(open) => {
                                    if (open) {
                                      setSelectedInversion(inversion);
                                      setDialogOpen(true);
                                    } else {
                                      resetDialogState();
                                    }
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      className="h-10 rounded-xl text-white"
                                      style={{ backgroundColor: BUKIPIN_BLUE }}
                                      onClick={() => {
                                        setSelectedInversion(inversion);
                                        setDialogOpen(true);
                                      }}
                                    >
                                      <TrendingDown className="mr-2 h-4 w-4" />
                                      Venta / Baja
                                    </Button>
                                  </DialogTrigger>

                                  <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-[30px] border border-slate-200 bg-white p-0 shadow-[0_24px_70px_rgba(11,58,110,0.12)]">
                                    <DialogHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.08),rgba(255,255,255,1),rgba(11,58,110,0.03))] px-6 py-5">
                                      <div className="flex items-start gap-4">
                                        <div
                                          className="flex h-12 w-12 items-center justify-center rounded-2xl"
                                          style={{
                                            backgroundColor: "rgba(11,58,110,0.10)",
                                            color: BUKIPIN_BLUE,
                                          }}
                                        >
                                          <ArrowUpRight className="h-5 w-5" />
                                        </div>
                                        <div>
                                          <DialogTitle className="text-xl font-bold text-slate-950">
                                            Venta o Baja de Activo
                                          </DialogTitle>
                                          <DialogDescription className="mt-1 text-sm text-slate-500">
                                            Registra el retiro o venta del activo seleccionado y genera
                                            el impacto contable correspondiente.
                                          </DialogDescription>
                                        </div>
                                      </div>
                                    </DialogHeader>

                                    <div className="space-y-6 px-6 py-6">
                                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                        <DetailStat
                                          label="Activo"
                                          value={inversion.producto_nombre}
                                          accent="blue"
                                        />
                                        <DetailStat
                                          label="Valor original"
                                          value={`$${formatMoney(inversion.valor_total)}`}
                                        />
                                        <DetailStat
                                          label="Valor en libros"
                                          value={`$${valorLibros.toLocaleString("es-MX", {
                                            minimumFractionDigits: 2,
                                          })}`}
                                          accent="green"
                                        />
                                        <DetailStat
                                          label="Depreciación acumulada"
                                          value={`$${depreciacionAcumulada.toLocaleString("es-MX", {
                                            minimumFractionDigits: 2,
                                          })}`}
                                          accent="amber"
                                        />
                                      </div>

                                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                        <div className="space-y-2">
                                          <Label className="text-sm font-semibold text-slate-700">
                                            Tipo de Baja *
                                          </Label>
                                          <Select
                                            value={tipoBaja}
                                            onValueChange={(value: any) => setTipoBaja(value)}
                                          >
                                            <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="dado_de_baja">
                                                Baja de Activo (Sin Venta)
                                              </SelectItem>
                                              <SelectItem value="vendido">
                                                Venta de Activo (Con Ingreso)
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        <div className="space-y-2">
                                          <Label className="text-sm font-semibold text-slate-700">
                                            Fecha de Baja *
                                          </Label>
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="outline"
                                                className={cn(
                                                  "h-12 w-full justify-start rounded-2xl border-slate-200 bg-white text-left font-normal shadow-sm",
                                                  !fechaBaja && "text-muted-foreground"
                                                )}
                                              >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {fechaBaja ? (
                                                  format(fechaBaja, "dd/MM/yyyy")
                                                ) : (
                                                  <span>Selecciona fecha</span>
                                                )}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                              <Calendar
                                                mode="single"
                                                selected={fechaBaja}
                                                onSelect={(date) => date && setFechaBaja(date)}
                                                initialFocus
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        </div>
                                      </div>

                                      {tipoBaja === "vendido" && (
                                        <div className="space-y-6 rounded-[24px] border border-slate-200 bg-slate-50/50 p-5">
                                          <div className="flex items-center gap-3">
                                            <div
                                              className="flex h-10 w-10 items-center justify-center rounded-2xl"
                                              style={{
                                                backgroundColor: "rgba(11,58,110,0.10)",
                                                color: BUKIPIN_BLUE,
                                              }}
                                            >
                                              <Wallet className="h-5 w-5" />
                                            </div>
                                            <div>
                                              <h4 className="text-sm font-semibold text-slate-900">
                                                Información de venta
                                              </h4>
                                              <p className="text-xs text-slate-500">
                                                Configura precio, forma de cobro y datos del comprador.
                                              </p>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                            <div className="space-y-2">
                                              <Label className="text-sm font-semibold text-slate-700">
                                                Valor de Venta *
                                              </Label>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={valorVenta}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  setValorVenta(val);
                                                  if (tipoPago === "contado") {
                                                    setMontoPagado(val);
                                                    setMontoPendiente("0");
                                                  } else if (tipoPago === "credito") {
                                                    setMontoPagado("0");
                                                    setMontoPendiente(val);
                                                  }
                                                }}
                                                placeholder="0.00"
                                                className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                                              />
                                            </div>

                                            <div className="space-y-2">
                                              <Label className="text-sm font-semibold text-slate-700">
                                                Tipo de Pago *
                                              </Label>
                                              <Select
                                                value={tipoPago}
                                                onValueChange={(value: any) => {
                                                  setTipoPago(value);
                                                  if (value === "contado") {
                                                    setMontoPagado(valorVenta);
                                                    setMontoPendiente("0");
                                                  } else if (value === "credito") {
                                                    setMontoPagado("0");
                                                    setMontoPendiente(valorVenta);
                                                  } else {
                                                    setMontoPagado("");
                                                    setMontoPendiente("");
                                                  }
                                                }}
                                              >
                                                <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="contado">Pago de Contado</SelectItem>
                                                  <SelectItem value="credito">Venta a Crédito</SelectItem>
                                                  <SelectItem value="parcial">Pago Parcial</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                            <DetailStat
                                              label="Precio de venta"
                                              value={`$${formatMoney(ventaNum)}`}
                                              accent="blue"
                                            />
                                            <DetailStat
                                              label="Monto pagado"
                                              value={`$${formatMoney(pagadoNum)}`}
                                              accent="green"
                                            />
                                            <DetailStat
                                              label="Pendiente"
                                              value={`$${formatMoney(pendienteNum)}`}
                                              accent="amber"
                                            />
                                          </div>

                                          {(tipoPago === "contado" || tipoPago === "parcial") && (
                                            <div className="space-y-2">
                                              <Label className="text-sm font-semibold text-slate-700">
                                                Método de Pago *
                                              </Label>
                                              <Select
                                                value={metodoPago}
                                                onValueChange={(value: any) => setMetodoPago(value)}
                                              >
                                                <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="efectivo">Efectivo</SelectItem>
                                                  <SelectItem value="transferencia">
                                                    Transferencia / Tarjeta
                                                  </SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          )}

                                          {(tipoPago === "parcial" || tipoPago === "contado") && (
                                            <div className="space-y-2">
                                              <Label className="text-sm font-semibold text-slate-700">
                                                Monto Pagado *
                                              </Label>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={montoPagado}
                                                onChange={(e) => {
                                                  setMontoPagado(e.target.value);
                                                  if (tipoPago === "parcial") {
                                                    const venta = parseFloat(valorVenta) || 0;
                                                    const pagado = parseFloat(e.target.value) || 0;
                                                    setMontoPendiente((venta - pagado).toFixed(2));
                                                  }
                                                }}
                                                placeholder="0.00"
                                                disabled={tipoPago === "contado"}
                                                className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                                              />
                                            </div>
                                          )}

                                          {(tipoPago === "parcial" || tipoPago === "credito") && (
                                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                              <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-700">
                                                  Monto Pendiente
                                                </Label>
                                                <Input
                                                  type="number"
                                                  step="0.01"
                                                  value={montoPendiente}
                                                  disabled
                                                  placeholder="0.00"
                                                  className="h-12 rounded-2xl border-slate-200 bg-slate-50 shadow-sm"
                                                />
                                              </div>

                                              <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-700">
                                                  Fecha de Vencimiento *
                                                </Label>
                                                <Popover>
                                                  <PopoverTrigger asChild>
                                                    <Button
                                                      variant="outline"
                                                      className={cn(
                                                        "h-12 w-full justify-start rounded-2xl border-slate-200 bg-white text-left font-normal shadow-sm",
                                                        !fechaVencimiento && "text-muted-foreground"
                                                      )}
                                                    >
                                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                                      {fechaVencimiento ? (
                                                        format(fechaVencimiento, "dd/MM/yyyy")
                                                      ) : (
                                                        <span>Selecciona fecha</span>
                                                      )}
                                                    </Button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                      mode="single"
                                                      selected={fechaVencimiento}
                                                      onSelect={(date) => setFechaVencimiento(date)}
                                                      initialFocus
                                                    />
                                                  </PopoverContent>
                                                </Popover>
                                              </div>
                                            </div>
                                          )}

                                          <div className="space-y-4 rounded-[22px] border border-slate-200 bg-white p-4">
                                            <div className="flex items-center gap-3">
                                              <div
                                                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                                                style={{
                                                  backgroundColor: "rgba(11,58,110,0.10)",
                                                  color: BUKIPIN_BLUE,
                                                }}
                                              >
                                                <UserRound className="h-5 w-5" />
                                              </div>
                                              <div>
                                                <h4 className="text-sm font-semibold text-slate-900">
                                                  Datos del comprador
                                                </h4>
                                                <p className="text-xs text-slate-500">
                                                  Vincula un cliente existente o registra uno nuevo.
                                                </p>
                                              </div>
                                            </div>

                                            <RadioGroup
                                              value={tipoComprador}
                                              onValueChange={(value: any) => {
                                                setTipoComprador(value);
                                                if (value === "recurrente") {
                                                  setClienteSeleccionado("");
                                                  setCompradorNombre("");
                                                  setCompradorRfc("");
                                                  setCompradorTelefono("");
                                                  setCompradorEmail("");
                                                }
                                              }}
                                              className="grid grid-cols-1 gap-3 md:grid-cols-2"
                                            >
                                              <Label
                                                htmlFor="nuevo"
                                                className={cn(
                                                  "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all shadow-sm",
                                                  tipoComprador === "nuevo"
                                                    ? "border-[rgba(11,58,110,0.20)] bg-[rgba(11,58,110,0.05)]"
                                                    : "border-slate-200 bg-white hover:border-slate-300"
                                                )}
                                              >
                                                <RadioGroupItem value="nuevo" id="nuevo" />
                                                <div>
                                                  <p className="text-sm font-semibold text-slate-900">
                                                    Cliente Nuevo
                                                  </p>
                                                  <p className="text-xs text-slate-500">
                                                    Captura manualmente los datos.
                                                  </p>
                                                </div>
                                              </Label>

                                              <Label
                                                htmlFor="recurrente"
                                                className={cn(
                                                  "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all shadow-sm",
                                                  tipoComprador === "recurrente"
                                                    ? "border-[rgba(11,58,110,0.20)] bg-[rgba(11,58,110,0.05)]"
                                                    : "border-slate-200 bg-white hover:border-slate-300"
                                                )}
                                              >
                                                <RadioGroupItem value="recurrente" id="recurrente" />
                                                <div>
                                                  <p className="text-sm font-semibold text-slate-900">
                                                    Cliente Recurrente
                                                  </p>
                                                  <p className="text-xs text-slate-500">
                                                    Selecciona un cliente ya registrado.
                                                  </p>
                                                </div>
                                              </Label>
                                            </RadioGroup>

                                            {tipoComprador === "recurrente" ? (
                                              <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-700">
                                                  Seleccionar Cliente
                                                </Label>
                                                <Select
                                                  value={clienteSeleccionado}
                                                  onValueChange={(value) => {
                                                    setClienteSeleccionado(value);
                                                    const cliente = clientes?.find((c) => c.id === value);
                                                    if (cliente) {
                                                      setCompradorNombre(cliente.nombre || "");
                                                      setCompradorRfc(cliente.rfc || "");
                                                      setCompradorTelefono(cliente.telefono || "");
                                                      setCompradorEmail(cliente.email || "");
                                                    }
                                                  }}
                                                >
                                                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm">
                                                    <SelectValue placeholder="Selecciona un cliente" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {clientes?.map((cliente) => (
                                                      <SelectItem key={cliente.id} value={cliente.id}>
                                                        {cliente.nombre}
                                                        {cliente.rfc ? ` - ${cliente.rfc}` : ""}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                            ) : (
                                              <>
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                  <div className="space-y-2">
                                                    <Label className="text-sm font-semibold text-slate-700">
                                                      Nombre
                                                    </Label>
                                                    <Input
                                                      value={compradorNombre}
                                                      onChange={(e) => setCompradorNombre(e.target.value)}
                                                      placeholder="Nombre del comprador"
                                                      className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                                                    />
                                                  </div>

                                                  <div className="space-y-2">
                                                    <Label className="text-sm font-semibold text-slate-700">
                                                      RFC
                                                    </Label>
                                                    <Input
                                                      value={compradorRfc}
                                                      onChange={(e) => setCompradorRfc(e.target.value)}
                                                      placeholder="RFC"
                                                      className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                                                    />
                                                  </div>

                                                  <div className="space-y-2">
                                                    <Label className="text-sm font-semibold text-slate-700">
                                                      Teléfono
                                                    </Label>
                                                    <Input
                                                      value={compradorTelefono}
                                                      onChange={(e) => setCompradorTelefono(e.target.value)}
                                                      placeholder="Teléfono"
                                                      className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                                                    />
                                                  </div>

                                                  <div className="space-y-2">
                                                    <Label className="text-sm font-semibold text-slate-700">
                                                      Email
                                                    </Label>
                                                    <Input
                                                      type="email"
                                                      value={compradorEmail}
                                                      onChange={(e) => setCompradorEmail(e.target.value)}
                                                      placeholder="email@ejemplo.com"
                                                      className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                                                    />
                                                  </div>
                                                </div>

                                                {compradorNombre && (
                                                  <div className="flex items-center space-x-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                                                    <Checkbox
                                                      id="guardarCliente"
                                                      checked={guardarComoCliente}
                                                      onCheckedChange={(checked) =>
                                                        setGuardarComoCliente(checked as boolean)
                                                      }
                                                    />
                                                    <Label
                                                      htmlFor="guardarCliente"
                                                      className="cursor-pointer text-sm font-normal"
                                                    >
                                                      Guardar como cliente recurrente
                                                    </Label>
                                                  </div>
                                                )}
                                              </>
                                            )}
                                          </div>

                                          {tipoBaja === "vendido" && valorVenta && (
                                            <div
                                              className="rounded-[22px] border p-4"
                                              style={{
                                                borderColor: "rgba(11,58,110,0.14)",
                                                backgroundColor: "rgba(11,58,110,0.05)",
                                              }}
                                            >
                                              <p className="text-sm font-semibold text-slate-900">
                                                Resultado estimado de la operación
                                              </p>
                                              <p className="mt-2 text-sm text-slate-600">
                                                Valor en libros actual:{" "}
                                                <strong>${formatMoney(valorLibrosSeleccionado)}</strong>
                                              </p>
                                              <p className="mt-1 text-sm text-slate-600">
                                                Diferencia vs venta:{" "}
                                                <strong>
                                                  ${formatMoney((parseFloat(valorVenta) || 0) - valorLibrosSeleccionado)}
                                                </strong>
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-slate-700">
                                          Motivo / Observaciones *
                                        </Label>
                                        <Textarea
                                          value={motivo}
                                          onChange={(e) => setMotivo(e.target.value)}
                                          placeholder="Describe el motivo de la baja o venta..."
                                          rows={4}
                                          className="rounded-2xl border-slate-200 shadow-sm resize-none"
                                        />
                                      </div>
                                    </div>

                                    <DialogFooter className="border-t border-slate-100 px-6 py-4">
                                      <Button
                                        variant="outline"
                                        className="rounded-2xl"
                                        onClick={resetDialogState}
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        className="rounded-2xl text-white"
                                        style={{ backgroundColor: BUKIPIN_BLUE }}
                                        onClick={handleSubmit}
                                        disabled={
                                          tipoBaja === "vendido"
                                            ? validacionVentaInvalida
                                            : validacionBajaInvalida
                                        }
                                      >
                                        Confirmar {tipoBaja === "vendido" ? "Venta" : "Baja"}
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="mt-6">
          <Card className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(11,58,110,0.08)]">
            <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.08),rgba(255,255,255,1),rgba(11,58,110,0.03))] px-6 py-5">
              <SectionHeader
                icon={<Receipt className="h-5 w-5" />}
                title="Historial de Bajas"
                subtitle="Consulta el historial completo de activos dados de baja o vendidos, junto con sus datos financieros y contables."
              />
            </CardHeader>

            <CardContent className="px-4 py-4 md:px-6 md:py-5">
              <div className="overflow-hidden rounded-[24px] border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Activo
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Categoría
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Estado
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Fecha Baja
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Valor Original
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Valor en Libros
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Valor Venta
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Método Pago
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Tipo Pago
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Pagado / Pendiente
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Ganancia / Pérdida
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Cliente
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Motivo
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 text-right">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {inversionesBaja.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14}>
                          <EmptyState
                            title="No hay activos dados de baja en el historial"
                            description="Cuando existan movimientos de baja o venta, aparecerán aquí con su detalle financiero, comercial y contable."
                            icon={<Clock3 className="h-6 w-6" />}
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      inversionesBaja
                        .sort((a, b) => {
                          const fechaA = a.fecha_baja ? new Date(a.fecha_baja).getTime() : 0;
                          const fechaB = b.fecha_baja ? new Date(b.fecha_baja).getTime() : 0;
                          return fechaB - fechaA;
                        })
                        .map((inversion) => {
                          const fechaBaja = inversion.fecha_baja
                            ? new Date(inversion.fecha_baja)
                            : new Date();
                          const valorLibros = calcularValorLibros(inversion, fechaBaja);
                          const gananciaPerdida = calcularGananciaPerdida(inversion);
                          const reactivo =
                            new Date(inversion.updated_at) >
                            new Date(inversion.fecha_baja || inversion.created_at);

                          return (
                            <TableRow key={inversion.id} className="hover:bg-slate-50/70">
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-11 w-11 ring-1 ring-slate-200">
                                    <AvatarImage
                                      src={inversion.imagen_url || ""}
                                      alt={inversion.producto_nombre}
                                    />
                                    <AvatarFallback className="bg-slate-100 text-slate-500">
                                      {inversion.producto_nombre.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-semibold text-slate-900">
                                    {inversion.producto_nombre}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell>{getCategoriaLabel(inversion.categoria_activo)}</TableCell>

                              <TableCell>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant={inversion.estado === "vendido" ? "default" : "secondary"}
                                  >
                                    {inversion.estado === "vendido" ? "Vendido" : "Dado de Baja"}
                                  </Badge>

                                  {reactivo && (
                                    <Badge variant="outline" className="text-xs">
                                      <RotateCcw className="mr-1 h-3 w-3" />
                                      Reactivado
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                {inversion.fecha_baja
                                  ? format(new Date(inversion.fecha_baja), "dd/MM/yyyy")
                                  : "-"}
                              </TableCell>

                              <TableCell>${formatMoney(inversion.valor_total)}</TableCell>

                              <TableCell>${formatMoney(valorLibros)}</TableCell>

                              <TableCell>
                                {inversion.valor_venta
                                  ? `$${Number(inversion.valor_venta).toLocaleString("es-MX", {
                                      minimumFractionDigits: 2,
                                    })}`
                                  : "-"}
                              </TableCell>

                              <TableCell>
                                {inversion.metodo_pago_venta ? (
                                  <Badge variant="outline">
                                    {inversion.metodo_pago_venta === "efectivo"
                                      ? "Efectivo"
                                      : "Transferencia"}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>

                              <TableCell>
                                {inversion.tipo_pago_venta ? (
                                  <Badge variant="secondary">
                                    {inversion.tipo_pago_venta === "contado"
                                      ? "Contado"
                                      : inversion.tipo_pago_venta === "credito"
                                        ? "Crédito"
                                        : "Parcial"}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>

                              <TableCell>
                                {inversion.monto_pagado_venta !== undefined ||
                                inversion.monto_pendiente_venta !== undefined ? (
                                  <div className="text-sm">
                                    <div className="text-emerald-600">
                                      Pagado: $
                                      {(inversion.monto_pagado_venta || 0).toLocaleString("es-MX", {
                                        minimumFractionDigits: 2,
                                      })}
                                    </div>
                                    {(inversion.monto_pendiente_venta || 0) > 0 && (
                                      <div className="text-amber-600">
                                        Pendiente: $
                                        {inversion.monto_pendiente_venta.toLocaleString("es-MX", {
                                          minimumFractionDigits: 2,
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>

                              <TableCell>
                                {gananciaPerdida !== null ? (
                                  <span
                                    className={
                                      gananciaPerdida >= 0
                                        ? "font-semibold text-emerald-600"
                                        : "font-semibold text-red-600"
                                    }
                                  >
                                    ${Math.abs(gananciaPerdida).toLocaleString("es-MX", {
                                      minimumFractionDigits: 2,
                                    })}
                                    {gananciaPerdida >= 0 ? " ↑" : " ↓"}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </TableCell>

                              <TableCell>
                                {inversion.comprador_nombre ? (
                                  <div className="text-sm">
                                    <div className="font-medium">{inversion.comprador_nombre}</div>
                                    {inversion.comprador_telefono && (
                                      <div className="text-muted-foreground">
                                        {inversion.comprador_telefono}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>

                              <TableCell className="max-w-xs truncate">
                                {inversion.motivo_baja || "-"}
                              </TableCell>

                              <TableCell>
                                <div className="flex justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 rounded-xl"
                                    onClick={() => {
                                      setSelectedAsientoInversion(inversion);
                                      setAsientoDialogOpen(true);
                                    }}
                                  >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Ver Asiento
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={asientoDialogOpen} onOpenChange={setAsientoDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-[30px] border border-slate-200 bg-white p-0 shadow-[0_24px_70px_rgba(11,58,110,0.12)]">
          <DialogHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.08),rgba(255,255,255,1),rgba(11,58,110,0.03))] px-6 py-5">
            <SectionHeader
              icon={<Landmark className="h-5 w-5" />}
              title="Historial de Asientos Contables de Baja"
              subtitle="Consulta el detalle contable generado por la venta o baja del activo."
            />
          </DialogHeader>

          <div className="px-6 py-6">
            {asientoData && asientoData.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {asientoData.length} {asientoData.length === 1 ? "asiento" : "asientos"}
                  </Badge>
                </div>

                <Accordion type="single" collapsible defaultValue="item-0" className="space-y-3">
                  {asientoData.map((asiento, index) => (
                    <AccordionItem
                      value={`item-${index}`}
                      key={asiento.id}
                      className="overflow-hidden rounded-[22px] border border-slate-200 bg-white"
                    >
                      <AccordionTrigger className="px-5 py-4 hover:no-underline">
                        <div className="flex w-full flex-col items-start gap-2 text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{asiento.numero_asiento}</Badge>
                            <span className="text-xs text-slate-500">
                              {format(new Date(asiento.created_at), "dd/MM/yyyy HH:mm")}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-slate-800">
                            {asiento.descripcion}
                          </span>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-5 pb-5">
                        <div className="overflow-hidden rounded-[18px] border border-slate-200">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                <TableHead>Cuenta</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead className="text-right">Debe</TableHead>
                                <TableHead className="text-right">Haber</TableHead>
                              </TableRow>
                            </TableHeader>

                            <TableBody>
                              {asiento.detalle_asientos.map((detalle: any) => (
                                <TableRow key={detalle.id}>
                                  <TableCell className="font-mono text-sm">
                                    {detalle.cuenta_codigo}
                                    <br />
                                    <span className="text-xs text-muted-foreground">
                                      {detalle.cuenta?.nombre}
                                    </span>
                                  </TableCell>

                                  <TableCell className="text-sm">{detalle.descripcion}</TableCell>

                                  <TableCell className="text-right font-medium">
                                    {detalle.debe > 0
                                      ? `$${Number(detalle.debe).toLocaleString("es-MX", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      : "-"}
                                  </TableCell>

                                  <TableCell className="text-right font-medium">
                                    {detalle.haber > 0
                                      ? `$${Number(detalle.haber).toLocaleString("es-MX", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      : "-"}
                                  </TableCell>
                                </TableRow>
                              ))}

                              <TableRow className="bg-muted/50 font-semibold">
                                <TableCell colSpan={2}>Total</TableCell>
                                <TableCell className="text-right">
                                  $
                                  {asiento.detalle_asientos
                                    .reduce((sum: number, d: any) => sum + Number(d.debe), 0)
                                    .toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right">
                                  $
                                  {asiento.detalle_asientos
                                    .reduce((sum: number, d: any) => sum + Number(d.haber), 0)
                                    .toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ) : (
              <div
                className="rounded-[24px] border px-4 py-5"
                style={{
                  borderColor: "rgba(11,58,110,0.14)",
                  backgroundColor: "rgba(11,58,110,0.05)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: "rgba(11,58,110,0.10)", color: BUKIPIN_BLUE }}
                  >
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      No se encontró el asiento contable para esta baja
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Es posible que aún no se haya generado o que el registro todavía no esté
                      disponible.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-100 px-6 py-4">
            <Button variant="outline" className="rounded-2xl" onClick={() => setAsientoDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BajaActivos;