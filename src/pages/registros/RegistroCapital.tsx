import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarIcon,
  Eye,
  FileText,
  Landmark,
  Layers3,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTransaccionesCapital } from "@/hooks/useTransaccionesCapital";
import { useAccionistas } from "@/hooks/useAccionistas";
import { useEstadoResultadosMensual } from "@/hooks/useEstadoResultadosMensual";
import { GraficaWaterfall } from "@/components/Capital/GraficaWaterfall";
import { GraficaRadialKPI } from "@/components/Capital/GraficaRadialKPI";
import { FormularioAccionista } from "@/components/Capital/FormularioAccionista";
import { DialogDetalleTransaccion } from "@/components/Capital/DialogDetalleTransaccion";
import { useCancelarTransaccionCapital } from "@/hooks/useCancelarTransaccionCapital";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

const RegistroCapital = () => {
  const {
    transacciones,
    isLoading,
    registrarTransaccion,
    totalAportaciones,
    totalDividendos,
    capitalNetoVigente,
    resumenPorSocio,
    totalAportacionesActivos,
    totalAportacionesInactivos,
    totalDividendosActivos,
    totalDividendosInactivos,
  } = useTransaccionesCapital();

  const { accionistas } = useAccionistas();
  const { data: resultadosMensuales } = useEstadoResultadosMensual();

  const [tipoMovimiento, setTipoMovimiento] = useState<"aportacion" | "dividendo">("aportacion");
  const [fecha, setFecha] = useState<Date>(new Date());
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [accionistaId, setAccionistaId] = useState("");
  const [accionistaSeleccionado, setAccionistaSeleccionado] = useState<string>("all");
  const [mostrarInactivos, setMostrarInactivos] = useState(true);
  const [filtroTipoResumen, setFiltroTipoResumen] = useState<
    "all" | "aportacion" | "dividendo"
  >("all");
  const [filtroEstadoResumen, setFiltroEstadoResumen] = useState<
    "all" | "activo" | "cancelado"
  >("all");

  // Estados para diálogos
  const [transaccionSeleccionada, setTransaccionSeleccionada] = useState<any>(null);
  const [dialogDetalleOpen, setDialogDetalleOpen] = useState(false);
  const [dialogCancelarOpen, setDialogCancelarOpen] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");

  // Estados para validación de dividendos
  const [dialogValidacionOpen, setDialogValidacionOpen] = useState(false);
  const [datosValidacion, setDatosValidacion] = useState<{
    capitalDisponible: number;
    montoIntentado: number;
    excedente: number;
    accionistaNombre: string;
  } | null>(null);

  const { mutate: cancelarTransaccion, isPending: isCancelando } = useCancelarTransaccionCapital();

  const formatCurrency = (value: number) =>
    `$${Number(value || 0).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const handleVerDetalle = (transaccion: any) => {
    setTransaccionSeleccionada(transaccion);
    setDialogDetalleOpen(true);
  };

  const handleAbrirDialogCancelar = (transaccion: any) => {
    setTransaccionSeleccionada(transaccion);
    setDialogCancelarOpen(true);
    setMotivoCancelacion("");
  };

  const handleConfirmarCancelacion = () => {
    if (!transaccionSeleccionada || !motivoCancelacion.trim()) {
      toast.error("Debes proporcionar un motivo de cancelación");
      return;
    }

    cancelarTransaccion(
      {
        transaccionId: transaccionSeleccionada.id,
        motivoCancelacion: motivoCancelacion.trim(),
      },
      {
        onSuccess: () => {
          setDialogCancelarOpen(false);
          setTransaccionSeleccionada(null);
          setMotivoCancelacion("");
        },
      }
    );
  };

  // Calcular utilidades acumuladas del año actual
  const anioActual = new Date().getFullYear();
  const utilidadesAnioActual =
    resultadosMensuales?.reduce((sum, mes) => sum + mes.utilidadNeta, 0) || 0;

  // Función para calcular capital disponible de un accionista
  const calcularCapitalDisponible = (accionistaIdParam: string) => {
    const transaccionesActivas = transacciones.filter((t) => t.estado === "activo");

    const aportacionesAccionista = transaccionesActivas
      .filter(
        (t) => t.accionista_id === accionistaIdParam && t.tipo_movimiento === "aportacion"
      )
      .reduce((sum, t) => sum + Number(t.monto), 0);

    const dividendosDistribuidosAccionista = transaccionesActivas
      .filter(
        (t) => t.accionista_id === accionistaIdParam && t.tipo_movimiento === "dividendo"
      )
      .reduce((sum, t) => sum + Number(t.monto), 0);

    const accionista = accionistas.find((a) => a.id === accionistaIdParam);
    const porcentaje = accionista?.porcentaje_participacion || 0;

    // Utilidades proporcionales del año actual
    const utilidadesProporcionales = (utilidadesAnioActual * porcentaje) / 100;

    const capitalDisponible =
      aportacionesAccionista + utilidadesProporcionales - dividendosDistribuidosAccionista;

    return {
      aportaciones: aportacionesAccionista,
      utilidades: utilidadesProporcionales,
      dividendosDistribuidos: dividendosDistribuidosAccionista,
      disponible: capitalDisponible,
    };
  };

  const procederConRegistro = () => {
    const accionista = accionistas.find((a) => a.id === accionistaId);
    if (!accionista) return;

    registrarTransaccion.mutate(
      {
        tipo_movimiento: tipoMovimiento,
        fecha,
        monto: parseFloat(monto),
        socio: accionista.nombre,
        accionista_id: accionistaId,
        descripcion: descripcion.trim(),
      },
      {
        onSuccess: () => {
          setMonto("");
          setDescripcion("");
          setAccionistaId("");
          setFecha(new Date());
        },
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accionistaId) {
      return;
    }

    if (!monto || parseFloat(monto) <= 0) {
      return;
    }

    const accionista = accionistas.find((a) => a.id === accionistaId);
    if (!accionista) return;

    // Validar capital disponible solo para dividendos
    if (tipoMovimiento === "dividendo") {
      const { disponible } = calcularCapitalDisponible(accionistaId);
      const montoIntentado = parseFloat(monto);

      if (montoIntentado > disponible) {
        // Mostrar diálogo de advertencia
        setDatosValidacion({
          capitalDisponible: disponible,
          montoIntentado: montoIntentado,
          excedente: montoIntentado - disponible,
          accionistaNombre: accionista.nombre,
        });
        setDialogValidacionOpen(true);
        return;
      }
    }

    // Si pasa la validación o es aportación, proceder
    procederConRegistro();
  };

  const transaccionesResumen = transacciones.filter((t) => {
    if (!mostrarInactivos && t.accionistaActivo === false) return false;
    if (filtroTipoResumen !== "all" && t.tipo_movimiento !== filtroTipoResumen) return false;
    if (filtroEstadoResumen !== "all" && t.estado !== filtroEstadoResumen) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
        {/* Hero / Header */}
        <div className="relative mb-8 overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-background via-background to-muted/40 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.35)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(120,119,198,0.12),transparent_28%),radial-gradient(circle_at_left,rgba(59,130,246,0.10),transparent_22%)]" />
          <div className="relative flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Panel de capital contable
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Registro de Capital
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Registra aportaciones de capital y distribución de dividendos con una
                visualización ejecutiva, clara y profesional para el control societario de
                Bukipin.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <Landmark className="h-4 w-4 text-primary" />
                  Capital neto vigente
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(capitalNetoVigente)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aportaciones activas menos dividendos activos
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                  <ArrowUpRight className="h-4 w-4" />
                  Aportaciones acumuladas
                </div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(totalAportaciones)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Histórico bruto de entradas activas
                </p>
              </div>

              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-rose-700 dark:text-rose-400">
                  <ArrowDownRight className="h-4 w-4" />
                  Dividendos acumulados
                </div>
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                  {formatCurrency(totalDividendos)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Histórico bruto de salidas activas
                </p>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="registro" className="w-full">
          <TabsList className="grid w-full max-w-4xl grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-muted/40 p-2 md:grid-cols-4">
            <TabsTrigger
              value="registro"
              className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Registros de Capital
            </TabsTrigger>
            <TabsTrigger
              value="resumen"
              className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Resumen de Transacciones
            </TabsTrigger>
            <TabsTrigger
              value="analitica"
              className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Analítica
            </TabsTrigger>
            <TabsTrigger
              value="accionistas"
              className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Accionistas
            </TabsTrigger>
          </TabsList>

          {/* Pestaña 1: Registros de Capital */}
          <TabsContent value="registro" className="mt-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Formulario */}
              <Card className="lg:col-span-2 overflow-hidden rounded-[24px] border border-border/60 bg-background shadow-[0_18px_50px_-30px_rgba(0,0,0,0.35)]">
                <CardHeader className="border-b border-border/50 bg-muted/20 pb-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl border border-primary/15 bg-primary/8 p-3">
                      <Layers3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Nuevo Movimiento de Capital</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Captura movimientos societarios con una presentación clara, precisa y
                        alineada al estilo Bukipin.
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Tipo de Movimiento */}
<div className="space-y-3">
  <Label className="text-sm font-medium text-foreground">
    Tipo de movimiento
  </Label>

  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
    <Button
      type="button"
      variant="outline"
      onClick={() => setTipoMovimiento("aportacion")}
      className={cn(
        "group h-auto min-h-[124px] justify-start rounded-2xl border px-5 py-5 text-left transition-all",
        tipoMovimiento === "aportacion"
          ? "border-emerald-500/40 bg-emerald-500/[0.08] shadow-[0_14px_34px_-22px_rgba(16,185,129,0.65)]"
          : "border-border/60 bg-background hover:border-emerald-400/30 hover:bg-emerald-500/[0.03]"
      )}
    >
      <div className="flex w-full items-start gap-4">
        <div
          className={cn(
            "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
            tipoMovimiento === "aportacion"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          <TrendingUp className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-semibold leading-5">
            Aportación de Capital
          </p>
          <p className="whitespace-normal break-words text-xs leading-5 text-muted-foreground">
            Incrementa el capital social y fortalece la posición patrimonial
            de la empresa.
          </p>
        </div>
      </div>
    </Button>

    <Button
      type="button"
      variant="outline"
      onClick={() => setTipoMovimiento("dividendo")}
      className={cn(
        "group h-auto min-h-[124px] justify-start rounded-2xl border px-5 py-5 text-left transition-all",
        tipoMovimiento === "dividendo"
          ? "border-rose-500/40 bg-rose-500/[0.08] shadow-[0_14px_34px_-22px_rgba(244,63,94,0.65)]"
          : "border-border/60 bg-background hover:border-rose-400/30 hover:bg-rose-500/[0.03]"
      )}
    >
      <div className="flex w-full items-start gap-4">
        <div
          className={cn(
            "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
            tipoMovimiento === "dividendo"
              ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          <TrendingDown className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-semibold leading-5">
            Pago de Dividendos
          </p>
          <p className="whitespace-normal break-words text-xs leading-5 text-muted-foreground">
            Registra distribución de utilidades con control y trazabilidad
            sobre capital disponible.
          </p>
        </div>
      </div>
    </Button>
  </div>
</div>

                    {/* Fecha */}
                    <div className="space-y-2">
                      <Label htmlFor="fecha">Fecha</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "h-11 w-full justify-start rounded-xl border-border/60 bg-background text-left font-normal",
                              !fecha && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                            {fecha
                              ? format(fecha, "PPP", { locale: es })
                              : "Seleccionar fecha"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto rounded-2xl border-border/60 p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={fecha}
                            onSelect={(date) => date && setFecha(date)}
                            initialFocus
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Accionista */}
                    <div className="space-y-2">
                      <Label htmlFor="accionista">Accionista *</Label>
                      <Select
                        value={accionistaId}
                        onValueChange={(value) => {
                          setAccionistaId(value);
                        }}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background">
                          <SelectValue placeholder="Selecciona un accionista" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-border/60">
                          {accionistas.length === 0 ? (
                            <div className="p-3 text-sm text-muted-foreground">
                              No hay accionistas registrados. Ve a la pestaña "Accionistas" para
                              registrar uno.
                            </div>
                          ) : (
                            accionistas.map((accionista) => (
                              <SelectItem key={accionista.id} value={accionista.id}>
                                {accionista.nombre}
                                {accionista.porcentaje_participacion > 0 &&
                                  ` (${accionista.porcentaje_participacion}%)`}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Card Informativo de Capital Disponible (solo para dividendos) */}
                    {tipoMovimiento === "dividendo" &&
                      accionistaId &&
                      (() => {
                        const { aportaciones, utilidades, dividendosDistribuidos, disponible } =
                          calcularCapitalDisponible(accionistaId);
                        const accionista = accionistas.find((a) => a.id === accionistaId);
                        const isNegativo = disponible < 0;

                        return (
                          <Card
                            className={cn(
                              "overflow-hidden rounded-2xl border shadow-sm",
                              isNegativo
                                ? "border-destructive/30 bg-destructive/[0.04]"
                                : "border-primary/25 bg-primary/[0.04]"
                            )}
                          >
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-sm">
                                {isNegativo ? (
                                  <ShieldAlert className="h-4 w-4 text-destructive" />
                                ) : (
                                  <Banknote className="h-4 w-4 text-primary" />
                                )}
                                Capital Disponible - {accionista?.nombre}
                              </CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-2 text-sm">
                              <div className="flex items-center justify-between rounded-xl bg-background/70 px-3 py-2">
                                <span className="text-muted-foreground">Aportaciones</span>
                                <span className="font-semibold">{formatCurrency(aportaciones)}</span>
                              </div>

                              <div className="flex items-center justify-between rounded-xl bg-background/70 px-3 py-2">
                                <span className="text-muted-foreground">Utilidades {anioActual}</span>
                                <span className="font-semibold">{formatCurrency(utilidades)}</span>
                              </div>

                              <div className="flex items-center justify-between rounded-xl bg-background/70 px-3 py-2">
                                <span className="text-muted-foreground">Distribuido</span>
                                <span className="font-semibold text-destructive">
                                  -{formatCurrency(dividendosDistribuidos).replace("$", "$")}
                                </span>
                              </div>

                              <div className="mt-2 flex items-center justify-between rounded-2xl border border-border/60 bg-background px-4 py-3">
                                <span className="font-semibold">Disponible</span>
                                <span
                                  className={cn(
                                    "text-lg font-bold",
                                    isNegativo ? "text-destructive" : "text-primary"
                                  )}
                                >
                                  {formatCurrency(disponible)}
                                </span>
                              </div>

                              {isNegativo && (
                                <div className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-3 text-xs text-destructive">
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                                  <p>
                                    Este accionista ya ha recibido más dividendos de lo disponible.
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })()}

                    {/* Monto */}
                    <div className="space-y-2">
                      <Label htmlFor="monto">
                        {tipoMovimiento === "aportacion"
                          ? "Monto de Aportación"
                          : "Monto del Dividendo"}
                      </Label>
                      <Input
                        id="monto"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        required
                        className="h-11 rounded-xl border-border/60 bg-background"
                      />
                    </div>

                    {/* Descripción */}
                    <div className="space-y-2">
                      <Label htmlFor="descripcion">Descripción / Notas</Label>
                      <Textarea
                        id="descripcion"
                        placeholder={
                          tipoMovimiento === "aportacion"
                            ? "Ej: Aportación inicial de capital social"
                            : "Ej: Distribución de utilidades del ejercicio 2024"
                        }
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        rows={4}
                        className="rounded-xl border-border/60 bg-background resize-none"
                      />
                    </div>

                    {/* Botón Submit */}
                    <Button
                      type="submit"
                      className={cn(
                        "h-12 w-full rounded-xl text-sm font-semibold shadow-sm",
                        tipoMovimiento === "aportacion"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-rose-600 hover:bg-rose-700"
                      )}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Registrar {tipoMovimiento === "aportacion" ? "Aportación" : "Dividendo"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Resumen e Información */}
              <div className="space-y-6">
                <Card className="rounded-[24px] border border-border/60 bg-background shadow-[0_16px_45px_-34px_rgba(0,0,0,0.45)]">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-primary/15 bg-primary/8 p-2.5">
                        <FileText className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">Información Operativa</CardTitle>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 p-5">
                    {tipoMovimiento === "aportacion" ? (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
                          <div className="mb-3 flex items-start gap-3">
                            <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-700 dark:text-emerald-400">
                              <TrendingUp className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">Aportación de Capital</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                Incrementa el capital social de la empresa y fortalece la estructura
                                patrimonial.
                              </p>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/60 bg-background/80 p-3 text-xs text-muted-foreground">
                            <p className="mb-1 font-medium text-foreground">Registro contable</p>
                            <p>Debe: Bancos / Caja</p>
                            <p>Haber: Capital Social</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.04] p-4">
                          <div className="mb-3 flex items-start gap-3">
                            <div className="rounded-xl bg-rose-500/15 p-2 text-rose-700 dark:text-rose-400">
                              <TrendingDown className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">Pago de Dividendos</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                Distribuye utilidades a los socios y disminuye el capital contable
                                disponible.
                              </p>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/60 bg-background/80 p-3 text-xs text-muted-foreground">
                            <p className="mb-1 font-medium text-foreground">Registro contable</p>
                            <p>Debe: Utilidades Retenidas</p>
                            <p>Haber: Bancos / Caja</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[24px] border border-border/60 bg-background shadow-[0_16px_45px_-34px_rgba(0,0,0,0.45)]">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-primary/15 bg-primary/8 p-2.5">
                        <Sparkles className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">Historial Reciente</CardTitle>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5">
                    {isLoading ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Cargando...
                      </p>
                    ) : transacciones.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No hay movimientos registrados
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {transacciones.slice(0, 5).map((t) => (
                          <div
                            key={t.id}
                            className="rounded-2xl border border-border/60 bg-muted/[0.22] px-4 py-3 transition-colors hover:bg-muted/[0.35]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{t.socio}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {format(new Date(t.fecha), "dd/MM/yyyy", { locale: es })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p
                                  className={cn(
                                    "text-sm font-bold",
                                    t.tipo_movimiento === "aportacion"
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : "text-rose-700 dark:text-rose-400"
                                  )}
                                >
                                  {formatCurrency(Number(t.monto))}
                                </p>
                                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                  {t.tipo_movimiento === "aportacion"
                                    ? "Aportación"
                                    : "Dividendo"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Pestaña 2: Resumen de Transacciones */}
          <TabsContent value="resumen" className="mt-6">
            <div className="space-y-6">
              <Card className="rounded-[24px] border border-border/60 bg-background shadow-[0_18px_50px_-34px_rgba(0,0,0,0.45)]">
                <CardHeader className="border-b border-border/50">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl border border-primary/15 bg-primary/8 p-3">
                        <Landmark className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Resumen de Movimientos de Capital</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Vista consolidada separando histórico bruto de aportaciones y dividendos
                          contra el capital neto vigente.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5">
                      <Label htmlFor="mostrar-inactivos" className="text-sm">
                        Mostrar inactivos
                      </Label>
                      <Switch
                        id="mostrar-inactivos"
                        checked={mostrarInactivos}
                        onCheckedChange={setMostrarInactivos}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card className="rounded-2xl border border-border/60 bg-gradient-to-br from-background to-muted/25 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Capital Neto Vigente
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(capitalNetoVigente)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Saldo vigente después de dividendos activos
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Aportaciones Acumuladas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(totalAportaciones)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Histórico bruto de movimientos de entrada activos
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Dividendos Acumulados
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                          {formatCurrency(totalDividendos)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Histórico bruto de movimientos de salida activos
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="mb-6 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    El histórico conserva aportaciones y dividendos por separado. El capital neto
                    vigente se calcula restando dividendos activos a las aportaciones activas; no
                    reemplaza ni borra movimientos previos.
                  </div>

                  {/* Tabla de transacciones */}
                  <div className="overflow-hidden rounded-[22px] border border-border/60">
                    <div className="space-y-4 border-b border-border/60 bg-muted/35 px-5 py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <h3 className="font-semibold">Historial Completo de Transacciones</h3>
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                          {transaccionesResumen.length} de {transacciones.length} registro(s)
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Tipo de movimiento
                          </Label>
                          <Select
                            value={filtroTipoResumen}
                            onValueChange={(value: "all" | "aportacion" | "dividendo") =>
                              setFiltroTipoResumen(value)
                            }
                          >
                            <SelectTrigger className="h-10 rounded-xl border-border/60 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-border/60">
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="aportacion">Aportaciones</SelectItem>
                              <SelectItem value="dividendo">Dividendos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Estado
                          </Label>
                          <Select
                            value={filtroEstadoResumen}
                            onValueChange={(value: "all" | "activo" | "cancelado") =>
                              setFiltroEstadoResumen(value)
                            }
                          >
                            <SelectTrigger className="h-10 rounded-xl border-border/60 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-border/60">
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="activo">Activos</SelectItem>
                              <SelectItem value="cancelado">Cancelados</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Lectura rápida
                          </Label>
                          <div className="flex h-10 items-center rounded-xl border border-border/60 bg-background px-3 text-sm text-muted-foreground">
                            Bruto = historial acumulado | Neto = saldo vigente
                          </div>
                        </div>
                      </div>
                    </div>

                    {isLoading ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <p>Cargando transacciones...</p>
                      </div>
                    ) : transacciones.length === 0 ? (
                      <div className="p-10 text-center text-muted-foreground">
                        <p>No hay transacciones registradas</p>
                        <p className="mt-2 text-sm">
                          Las transacciones aparecerán aquí una vez que las registres
                        </p>
                      </div>
                    ) : transaccionesResumen.length === 0 ? (
                      <div className="p-10 text-center text-muted-foreground">
                        <p>No hay transacciones que coincidan con los filtros actuales.</p>
                        <p className="mt-2 text-sm">
                          Ajusta tipo, estado o visibilidad de inactivos para ver más movimientos.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-muted/35">
                            <tr className="border-b border-border/60">
                              <th className="p-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Fecha
                              </th>
                              <th className="p-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Socio
                              </th>
                              <th className="p-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Tipo
                              </th>
                              <th className="p-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Monto
                              </th>
                              <th className="p-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Descripción
                              </th>
                              <th className="p-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Estado
                              </th>
                              <th className="w-[120px] p-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Acciones
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {transaccionesResumen.map((t) => (
                              <tr
                                key={t.id}
                                className="border-b border-border/50 transition-colors hover:bg-muted/20"
                              >
                                <td className="p-4 text-sm">
                                  {format(new Date(t.fecha), "dd/MM/yyyy", { locale: es })}
                                </td>

                                <td className="p-4 text-sm font-medium">
                                  <div className="flex items-center gap-2">
                                    {t.accionistaNombreActual || t.socio}
                                    {!t.accionistaActivo && (
                                      <Badge
                                        variant="outline"
                                        className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
                                      >
                                        <ShieldAlert className="h-3 w-3" />
                                        Inactivo
                                      </Badge>
                                    )}
                                  </div>
                                </td>

                                <td className="p-4">
                                  {t.tipo_movimiento === "aportacion" ? (
                                    <Badge className="gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-600">
                                      <TrendingUp className="h-3 w-3" />
                                      Aportación
                                    </Badge>
                                  ) : (
                                    <Badge className="gap-1.5 rounded-full bg-rose-600 hover:bg-rose-600">
                                      <TrendingDown className="h-3 w-3" />
                                      Dividendo
                                    </Badge>
                                  )}
                                </td>

                                <td className="p-4 text-right font-mono text-sm font-semibold">
                                  {formatCurrency(Number(t.monto))}
                                </td>

                                <td className="max-w-[320px] p-4 text-sm text-muted-foreground">
                                  <div className="line-clamp-2">{t.descripcion || "-"}</div>
                                </td>

                                <td className="p-4 text-center">
                                  {t.estado === "cancelado" ? (
                                    <Badge variant="destructive" className="rounded-full">
                                      Cancelado
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="rounded-full border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400"
                                    >
                                      Activo
                                    </Badge>
                                  )}
                                </td>

                                <td className="p-4">
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleVerDetalle(t)}
                                      className="h-9 w-9 rounded-xl p-0 hover:bg-primary/10"
                                      title="Ver detalle"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>

                                    {t.estado === "activo" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleAbrirDialogCancelar(t)}
                                        className="h-9 w-9 rounded-xl p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                                        title="Cancelar transacción"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Resumen por Socio */}
              <Card className="rounded-[24px] border border-border/60 bg-background shadow-[0_18px_50px_-34px_rgba(0,0,0,0.45)]">
                <CardHeader className="border-b border-border/50">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl border border-primary/15 bg-primary/8 p-3">
                      <Users2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Resumen por Socio / Accionista</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Balance neto por participante, mostrando por separado aportaciones y
                        dividendos históricos activos.
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <div className="overflow-hidden rounded-[22px] border border-border/60">
                    <div className="border-b border-border/60 bg-muted/35 px-4 py-4">
                      <div className="grid grid-cols-4 gap-4 text-sm font-semibold">
                        <div>Socio</div>
                        <div className="text-right">Aportaciones</div>
                        <div className="text-right">Dividendos</div>
                        <div className="text-right">Balance</div>
                      </div>
                    </div>

                    {Object.keys(resumenPorSocio).length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <p>No hay datos disponibles</p>
                      </div>
                    ) : (
                      <div>
                        {Object.entries(resumenPorSocio)
                          .filter(([_, datos]) => mostrarInactivos || datos.activo)
                          .map(([clave, datos]) => (
                            <div
                              key={clave}
                              className={cn(
                                "border-b border-border/50 px-4 py-4 last:border-b-0 transition-colors hover:bg-muted/20",
                                !datos.activo && "bg-amber-500/[0.05]"
                              )}
                            >
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div className="flex items-center gap-2 font-medium">
                                  {datos.nombreMostrar}
                                  {!datos.activo && (
                                    <Badge
                                      variant="outline"
                                      className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
                                    >
                                      <ShieldAlert className="h-3 w-3" />
                                      Inactivo
                                    </Badge>
                                  )}
                                </div>

                                <div className="text-right font-medium text-emerald-700 dark:text-emerald-400">
                                  {formatCurrency(datos.aportaciones)}
                                </div>

                                <div className="text-right font-medium text-rose-700 dark:text-rose-400">
                                  {formatCurrency(datos.dividendos)}
                                </div>

                                <div className="text-right font-semibold">
                                  {formatCurrency(datos.balance)}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pestaña 3: Analítica */}
          <TabsContent value="analitica" className="mt-6">
            <div className="space-y-6">
              {/* Filtro de Accionista */}
              <Card className="rounded-[24px] border border-border/60 bg-background shadow-[0_16px_45px_-34px_rgba(0,0,0,0.45)]">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <Label htmlFor="filtro-accionista" className="whitespace-nowrap font-medium">
                      Ver análisis de:
                    </Label>
                    <Select value={accionistaSeleccionado} onValueChange={setAccionistaSeleccionado}>
                      <SelectTrigger
                        id="filtro-accionista"
                        className="h-11 w-full max-w-md rounded-xl border-border/60 bg-background"
                      >
                        <SelectValue placeholder="Consolidado (Todos los accionistas)" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border/60">
                        <SelectItem value="all">Consolidado (Todos los accionistas)</SelectItem>
                        <SelectItem value="inactivos">Socios Inactivos (Agrupados)</SelectItem>
                        {accionistas.map((accionista) => (
                          <SelectItem key={accionista.id} value={accionista.id}>
                            {accionista.nombre}
                            {accionista.porcentaje_participacion > 0 &&
                              ` (${accionista.porcentaje_participacion}%)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {accionistaSeleccionado === "inactivos" && (
                <Card className="rounded-[24px] border border-amber-500/25 bg-amber-500/[0.05] shadow-none">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-amber-500/12 p-2.5">
                        <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="mb-1 font-semibold text-amber-900 dark:text-amber-100">
                          Vista de Socios Inactivos
                        </h4>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Estás viendo el análisis consolidado de todos los socios marcados como
                          inactivos. Estas transacciones mantienen su trazabilidad completa en el
                          sistema.
                        </p>
                        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                          <strong>Total en este grupo:</strong>{" "}
                          {Object.values(resumenPorSocio).filter((s) => !s.activo).length} socio(s)
                          inactivo(s)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <GraficaWaterfall
                  data={{
                    aportaciones:
                      accionistaSeleccionado === "inactivos"
                        ? totalAportacionesInactivos
                        : accionistaSeleccionado && accionistaSeleccionado !== "all"
                        ? transacciones
                            .filter(
                              (t) =>
                                t.accionista_id === accionistaSeleccionado &&
                                t.tipo_movimiento === "aportacion" &&
                                t.estado === "activo"
                            )
                            .reduce((sum, t) => sum + Number(t.monto), 0)
                        : totalAportaciones,
                    utilidadesHistoricas:
                      accionistaSeleccionado === "inactivos"
                        ? 0
                        : accionistaSeleccionado && accionistaSeleccionado !== "all"
                        ? (() => {
                            const accionista = accionistas.find(
                              (a) => a.id === accionistaSeleccionado
                            );
                            const porcentaje = accionista?.porcentaje_participacion || 0;
                            const utilidadesHistoricasTotales = 0;
                            return (utilidadesHistoricasTotales * porcentaje) / 100;
                          })()
                        : 0,
                    dividendosHistoricos:
                      accionistaSeleccionado === "inactivos"
                        ? transacciones
                            .filter(
                              (t) =>
                                t.tipo_movimiento === "dividendo" &&
                                !t.accionistaActivo &&
                                t.estado === "activo" &&
                                new Date(t.fecha).getFullYear() < anioActual
                            )
                            .reduce((sum, t) => sum + Number(t.monto), 0)
                        : accionistaSeleccionado && accionistaSeleccionado !== "all"
                        ? transacciones
                            .filter(
                              (t) =>
                                t.accionista_id === accionistaSeleccionado &&
                                t.tipo_movimiento === "dividendo" &&
                                t.estado === "activo" &&
                                new Date(t.fecha).getFullYear() < anioActual
                            )
                            .reduce((sum, t) => sum + Number(t.monto), 0)
                        : transacciones
                            .filter(
                              (t) =>
                                t.tipo_movimiento === "dividendo" &&
                                t.estado === "activo" &&
                                new Date(t.fecha).getFullYear() < anioActual
                            )
                            .reduce((sum, t) => sum + Number(t.monto), 0),
                    utilidadesAnioActual:
                      accionistaSeleccionado === "inactivos"
                        ? 0
                        : accionistaSeleccionado && accionistaSeleccionado !== "all"
                        ? (() => {
                            const accionista = accionistas.find(
                              (a) => a.id === accionistaSeleccionado
                            );
                            const porcentaje = accionista?.porcentaje_participacion || 0;
                            return (utilidadesAnioActual * porcentaje) / 100;
                          })()
                        : utilidadesAnioActual,
                    dividendosAnioActual:
                      accionistaSeleccionado === "inactivos"
                        ? transacciones
                            .filter(
                              (t) =>
                                t.tipo_movimiento === "dividendo" &&
                                !t.accionistaActivo &&
                                t.estado === "activo" &&
                                new Date(t.fecha).getFullYear() === anioActual
                            )
                            .reduce((sum, t) => sum + Number(t.monto), 0)
                        : accionistaSeleccionado && accionistaSeleccionado !== "all"
                        ? transacciones
                            .filter(
                              (t) =>
                                t.accionista_id === accionistaSeleccionado &&
                                t.tipo_movimiento === "dividendo" &&
                                t.estado === "activo" &&
                                new Date(t.fecha).getFullYear() === anioActual
                            )
                            .reduce((sum, t) => sum + Number(t.monto), 0)
                        : transacciones
                            .filter(
                              (t) =>
                                t.tipo_movimiento === "dividendo" &&
                                t.estado === "activo" &&
                                new Date(t.fecha).getFullYear() === anioActual
                            )
                            .reduce((sum, t) => sum + Number(t.monto), 0),
                  }}
                  accionistaId={accionistaSeleccionado}
                  accionistaNombre={
                    accionistaSeleccionado === "all"
                      ? undefined
                      : accionistaSeleccionado === "inactivos"
                      ? "Socios Inactivos"
                      : accionistas.find((a) => a.id === accionistaSeleccionado)?.nombre
                  }
                />

                <GraficaRadialKPI
                  aportaciones={
                    accionistaSeleccionado === "inactivos"
                      ? totalAportacionesInactivos
                      : accionistaSeleccionado && accionistaSeleccionado !== "all"
                      ? transacciones
                          .filter(
                            (t) =>
                              t.accionista_id === accionistaSeleccionado &&
                              t.tipo_movimiento === "aportacion" &&
                              t.estado === "activo"
                          )
                          .reduce((sum, t) => sum + Number(t.monto), 0)
                      : totalAportaciones
                  }
                  utilidades={
                    accionistaSeleccionado === "inactivos"
                      ? 0
                      : accionistaSeleccionado && accionistaSeleccionado !== "all"
                      ? (() => {
                          const accionista = accionistas.find(
                            (a) => a.id === accionistaSeleccionado
                          );
                          const porcentaje = accionista?.porcentaje_participacion || 0;
                          return (utilidadesAnioActual * porcentaje) / 100;
                        })()
                      : utilidadesAnioActual
                  }
                  dividendosDistribuidos={
                    accionistaSeleccionado === "inactivos"
                      ? totalDividendosInactivos
                      : accionistaSeleccionado && accionistaSeleccionado !== "all"
                      ? transacciones
                          .filter(
                            (t) =>
                              t.accionista_id === accionistaSeleccionado &&
                              t.tipo_movimiento === "dividendo" &&
                              t.estado === "activo"
                          )
                          .reduce((sum, t) => sum + Number(t.monto), 0)
                      : totalDividendos
                  }
                  accionista={
                    accionistaSeleccionado &&
                    accionistaSeleccionado !== "all" &&
                    accionistaSeleccionado !== "inactivos"
                      ? accionistas.find((a) => a.id === accionistaSeleccionado)
                      : undefined
                  }
                  totalAportaciones={totalAportaciones}
                />
              </div>

              <Card className="rounded-[24px] border border-border/60 bg-background shadow-[0_18px_50px_-34px_rgba(0,0,0,0.45)]">
                <CardHeader className="border-b border-border/50">
                  <CardTitle>
                    Indicadores Clave -{" "}
                    {accionistaSeleccionado === "inactivos"
                      ? "Socios Inactivos"
                      : accionistaSeleccionado && accionistaSeleccionado !== "all"
                      ? accionistas.find((a) => a.id === accionistaSeleccionado)?.nombre
                      : "Consolidado"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="mb-1 text-sm text-muted-foreground">
                        {accionistaSeleccionado === "inactivos"
                          ? "Socios Inactivos"
                          : accionistaSeleccionado && accionistaSeleccionado !== "all"
                          ? "Transacciones"
                          : "Número de Accionistas"}
                      </p>
                      <p className="text-2xl font-bold">
                        {accionistaSeleccionado === "inactivos"
                          ? Object.values(resumenPorSocio).filter((s) => !s.activo).length
                          : accionistaSeleccionado && accionistaSeleccionado !== "all"
                          ? transacciones.filter(
                              (t) =>
                                t.accionista_id === accionistaSeleccionado &&
                                t.estado === "activo"
                            ).length
                          : accionistas.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="mb-1 text-sm text-muted-foreground">Última Aportación</p>
                      <p className="text-lg font-semibold">
                        {(() => {
                          const filtradas =
                            accionistaSeleccionado === "inactivos"
                              ? transacciones.filter(
                                  (t) =>
                                    t.tipo_movimiento === "aportacion" &&
                                    !t.accionistaActivo &&
                                    t.estado === "activo"
                                )
                              : accionistaSeleccionado && accionistaSeleccionado !== "all"
                              ? transacciones.filter(
                                  (t) =>
                                    t.tipo_movimiento === "aportacion" &&
                                    t.accionista_id === accionistaSeleccionado &&
                                    t.estado === "activo"
                                )
                              : transacciones.filter(
                                  (t) =>
                                    t.tipo_movimiento === "aportacion" &&
                                    t.estado === "activo"
                                );
                          const ultima = filtradas[0];
                          return ultima
                            ? format(new Date(ultima.fecha), "dd/MM/yyyy", { locale: es })
                            : "N/A";
                        })()}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="mb-1 text-sm text-muted-foreground">Último Dividendo</p>
                      <p className="text-lg font-semibold">
                        {(() => {
                          const filtradas =
                            accionistaSeleccionado === "inactivos"
                              ? transacciones.filter(
                                  (t) =>
                                    t.tipo_movimiento === "dividendo" &&
                                    !t.accionistaActivo &&
                                    t.estado === "activo"
                                )
                              : accionistaSeleccionado && accionistaSeleccionado !== "all"
                              ? transacciones.filter(
                                  (t) =>
                                    t.tipo_movimiento === "dividendo" &&
                                    t.accionista_id === accionistaSeleccionado &&
                                    t.estado === "activo"
                                )
                              : transacciones.filter(
                                  (t) =>
                                    t.tipo_movimiento === "dividendo" &&
                                    t.estado === "activo"
                                );
                          const ultimo = filtradas[0];
                          return ultimo
                            ? format(new Date(ultimo.fecha), "dd/MM/yyyy", { locale: es })
                            : "N/A";
                        })()}
                      </p>
                    </div>
                  </div>

                  {/* Detalles adicionales por accionista */}
                  {accionistaSeleccionado &&
                    accionistaSeleccionado !== "all" &&
                    accionistaSeleccionado !== "inactivos" &&
                    (() => {
                      const accionista = accionistas.find(
                        (a) => a.id === accionistaSeleccionado
                      );
                      if (!accionista) return null;

                      return (
                        <div className="mt-6 rounded-2xl border border-border/60 bg-muted/20 p-5">
                          <h4 className="mb-4 font-semibold">Información del Accionista</h4>
                          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                            {accionista.porcentaje_participacion > 0 && (
                              <div className="rounded-xl bg-background/70 px-3 py-2">
                                <span className="text-muted-foreground">Participación:</span>
                                <span className="ml-2 font-medium">
                                  {accionista.porcentaje_participacion}%
                                </span>
                              </div>
                            )}
                            {accionista.email && (
                              <div className="rounded-xl bg-background/70 px-3 py-2">
                                <span className="text-muted-foreground">Email:</span>
                                <span className="ml-2 font-medium">{accionista.email}</span>
                              </div>
                            )}
                            {accionista.telefono && (
                              <div className="rounded-xl bg-background/70 px-3 py-2">
                                <span className="text-muted-foreground">Teléfono:</span>
                                <span className="ml-2 font-medium">{accionista.telefono}</span>
                              </div>
                            )}
                            {accionista.rfc && (
                              <div className="rounded-xl bg-background/70 px-3 py-2">
                                <span className="text-muted-foreground">RFC:</span>
                                <span className="ml-2 font-medium">{accionista.rfc}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pestaña 4: Accionistas */}
          <TabsContent value="accionistas" className="mt-6">
            <FormularioAccionista />
          </TabsContent>
        </Tabs>

        {/* Dialog de Detalle */}
        <DialogDetalleTransaccion
          open={dialogDetalleOpen}
          onOpenChange={setDialogDetalleOpen}
          transaccion={transaccionSeleccionada}
        />

        {/* Dialog de Confirmación de Cancelación */}
        <AlertDialog open={dialogCancelarOpen} onOpenChange={setDialogCancelarOpen}>
          <AlertDialogContent className="rounded-[24px] border border-border/60">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro de cancelar esta transacción?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se creará un asiento de reversión para mantener
                la trazabilidad contable.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="my-4">
              <label className="mb-2 block text-sm font-medium">
                Motivo de la cancelación <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Explica por qué se cancela esta transacción..."
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                rows={4}
                className="resize-none rounded-xl border-border/60"
              />
            </div>

            {transaccionSeleccionada && (
              <div className="space-y-1 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm">
                <p>
                  <strong>Fecha:</strong>{" "}
                  {format(new Date(transaccionSeleccionada.fecha), "dd/MM/yyyy", {
                    locale: es,
                  })}
                </p>
                <p>
                  <strong>Socio:</strong> {transaccionSeleccionada.socio}
                </p>
                <p>
                  <strong>Monto:</strong>{" "}
                  {formatCurrency(Number(transaccionSeleccionada.monto))}
                </p>
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCancelando}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmarCancelacion}
                disabled={isCancelando || !motivoCancelacion.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                {isCancelando ? "Cancelando..." : "Confirmar Cancelación"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* AlertDialog para validación de exceso de dividendos */}
        <AlertDialog open={dialogValidacionOpen} onOpenChange={setDialogValidacionOpen}>
          <AlertDialogContent className="rounded-[24px] border border-border/60">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Monto Excede Capital Disponible
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    El monto que intentas distribuir excede el capital disponible del accionista{" "}
                    <strong>{datosValidacion?.accionistaNombre}</strong>:
                  </p>

                  <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/25 p-4 text-sm">
                    <div className="flex justify-between">
                      <span>Capital Disponible:</span>
                      <span className="font-semibold text-primary">
                        {formatCurrency(datosValidacion?.capitalDisponible || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monto a Distribuir:</span>
                      <span className="font-semibold">
                        {formatCurrency(datosValidacion?.montoIntentado || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span>Excedente:</span>
                      <span className="font-bold text-destructive">
                        {formatCurrency(datosValidacion?.excedente || 0)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    ¿Deseas continuar con el registro de todos modos?
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setDialogValidacionOpen(false);
                  setDatosValidacion(null);
                }}
              >
                Cancelar y Ajustar Monto
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setDialogValidacionOpen(false);
                  setDatosValidacion(null);
                  procederConRegistro();
                }}
                className="bg-destructive hover:bg-destructive/90"
              >
                Registrar de Todos Modos
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default RegistroCapital;
