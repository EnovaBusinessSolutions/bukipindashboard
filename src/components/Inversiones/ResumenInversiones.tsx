import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  Eye,
  ImageIcon,
  RotateCcw,
  ShoppingCart,
  Trash2,
  TrendingDown,
  TrendingUp,
  Landmark,
  Wallet,
  BarChart3,
  ShieldAlert,
  ArrowUpRight,
  Clock3,
  FileSpreadsheet,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useInversiones } from "@/hooks/useInversiones";
import {
  useTransaccionesInversionesConDepreciaciones,
  type TransaccionInversionCompleta,
} from "@/hooks/useTransaccionesInversionesConDepreciaciones";
import { useAsientosInversion } from "@/hooks/useAsientosInversion";
import { useAsientosInversionBulk } from "@/hooks/useAsientosInversionBulk";
import { useAsientosDepreciacion } from "@/hooks/useAsientosDepreciacion";
import { useDepreciacionesAtrasadas } from "@/hooks/useDepreciacionesAtrasadas";

const BUKIPIN_BLUE = "#0B3A6E";
const BUKIPIN_BLUE_DARK = "#082E57";

const safeDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatMoney = (value?: number | null) =>
  Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
        <div className="flex h-full flex-col justify-between">
          <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.07),rgba(255,255,255,1),rgba(11,58,110,0.03))] px-5 py-4">
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
        </div>
      </CardContent>
    </Card>
  );
};

const PremiumNotice = ({
  title,
  description,
  destructive = false,
  icon,
}: {
  title: string;
  description: React.ReactNode;
  destructive?: boolean;
  icon: React.ReactNode;
}) => {
  return (
    <div
      className="rounded-[24px] border px-4 py-4 shadow-sm"
      style={{
        borderColor: destructive ? "rgba(220,38,38,0.18)" : "rgba(11,58,110,0.14)",
        backgroundColor: destructive ? "rgba(254,242,242,0.92)" : "rgba(11,58,110,0.05)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: destructive ? "rgba(220,38,38,0.12)" : "rgba(11,58,110,0.10)",
            color: destructive ? "#b91c1c" : BUKIPIN_BLUE,
          }}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <div className="mt-1 text-sm leading-6 text-slate-600">{description}</div>
        </div>
      </div>
    </div>
  );
};

const DetailInfoCard = ({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: React.ReactNode;
  accent?: "default" | "blue" | "green" | "purple";
}) => {
  const styles =
    accent === "blue"
      ? "border-[rgba(11,58,110,0.15)] bg-[rgba(11,58,110,0.05)]"
      : accent === "green"
        ? "border-emerald-200 bg-emerald-50/80"
        : accent === "purple"
          ? "border-violet-200 bg-violet-50/80"
          : "border-slate-200 bg-slate-50/70";

  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
};

const ResumenInversiones = () => {
  const {
    inversiones,
    isLoading: loadingInversiones,
    eliminarInversion,
    actualizarInversion,
  } = useInversiones();

  const {
    transacciones,
    isLoading: loadingTransacciones,
  } = useTransaccionesInversionesConDepreciaciones();

  const { tieneAtrasadas, totalAtrasadas } = useDepreciacionesAtrasadas();

  const [selectedTransaccion, setSelectedTransaccion] =
    useState<TransaccionInversionCompleta | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);

  const { data: asientoInversion, isLoading: loadingAsiento } = useAsientosInversion(
    selectedTransaccion?.inversion_id,
    selectedTransaccion?.tipo === "depreciacion" ? undefined : selectedTransaccion?.tipo
  );

  const { data: asientosDepreciacion } = useAsientosDepreciacion(
    selectedTransaccion?.tipo === "depreciacion" ? selectedTransaccion?.inversion_id : undefined
  );

  const {
    data: inversionesConAsientos,
    isLoading: loadingAsientos,
  } = useAsientosInversionBulk();

  const isLoading = loadingInversiones || loadingTransacciones;

  const totalInvertido = useMemo(
    () => inversiones.reduce((acc, inv) => acc + Number(inv.valor_total || 0), 0),
    [inversiones]
  );

  const valorActivosActivos = useMemo(
    () =>
      inversiones
        .filter((inv) => inv.estado === "activo")
        .reduce((acc, inv) => acc + Number(inv.valor_total || 0), 0),
    [inversiones]
  );

  const totalTransacciones = transacciones.length;
  const transaccionesAlta = transacciones.filter((t) => t.tipo === "alta").length;
  const transaccionesBaja = transacciones.filter((t) => t.tipo === "baja").length;
  const transaccionesVenta = transacciones.filter((t) => t.tipo === "venta").length;
  const transaccionesDepreciacion = transacciones.filter((t) => t.tipo === "depreciacion").length;

  const inversionesSinAsientos = useMemo(() => {
    return inversiones.filter((inv) => !inversionesConAsientos?.has(inv.id));
  }, [inversiones, inversionesConAsientos]);

  const handleEliminar = (id: string) => {
    eliminarInversion.mutate(id);
  };

  const handleReactivar = (inversionId: string) => {
    actualizarInversion.mutate({
      id: inversionId,
      actualizacion: {
        estado: "activo",
      },
    });
  };

  const openDetalle = (transaccion: TransaccionInversionCompleta) => {
    setSelectedTransaccion(transaccion);
    setDetalleOpen(true);
  };

  const closeDetalle = (open: boolean) => {
    setDetalleOpen(open);
    if (!open) {
      setSelectedTransaccion(null);
    }
  };

  const getTipoTransaccionIcon = (tipo: string) => {
    switch (tipo) {
      case "alta":
        return <TrendingUp className="h-4 w-4" />;
      case "baja":
        return <TrendingDown className="h-4 w-4" />;
      case "venta":
        return <ShoppingCart className="h-4 w-4" />;
      case "depreciacion":
        return <Calendar className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTipoTransaccionLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      alta: "Alta",
      baja: "Baja",
      venta: "Venta",
      depreciacion: "Depreciación",
    };
    return labels[tipo] || tipo;
  };

  const getTipoTransaccionVariant = (
    tipo: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      alta: "default",
      baja: "destructive",
      venta: "secondary",
      depreciacion: "outline",
    };
    return variants[tipo] || "default";
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

  const selectedFecha = safeDate(selectedTransaccion?.fecha);

  const selectedAsientoDepreciacion =
    selectedTransaccion?.tipo === "depreciacion" && selectedTransaccion?.numero_asiento
      ? asientosDepreciacion?.find(
          (a: any) => a?.numero_asiento === selectedTransaccion.numero_asiento
        )
      : null;

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
      {tieneAtrasadas && (
        <PremiumNotice
          destructive
          icon={<AlertTriangle className="h-5 w-5" />}
          title={`${totalAtrasadas} depreciación(es) atrasada(s) detectada(s)`}
          description={
            <>
              Algunos activos no tienen depreciaciones registradas para períodos anteriores. Se
              recomienda revisarlos para mantener la trazabilidad financiera al día.
            </>
          }
        />
      )}

      {!loadingAsientos && inversionesSinAsientos.length > 0 && (
        <PremiumNotice
          destructive
          icon={<ShieldAlert className="h-5 w-5" />}
          title="Inversiones históricas sin asiento automático"
          description={
            <>
              Hay <strong>{inversionesSinAsientos.length}</strong> inversión(es) registrada(s) antes
              de la implementación de asientos automáticos. Estas inversiones no afectan la balanza
              de comprobación. Se recomienda eliminarlas y registrarlas nuevamente.
            </>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryMetricCard
          title="Total invertido"
          value={`$${formatMoney(totalInvertido)}`}
          subtitle="Capital total registrado históricamente en activos CAPEX."
          icon={<Wallet className="h-5 w-5" />}
        />

        <SummaryMetricCard
          title="Valor activos activos"
          value={`$${formatMoney(valorActivosActivos)}`}
          subtitle="Valor acumulado de activos que siguen vigentes y operativos."
          icon={<Landmark className="h-5 w-5" />}
        />

        <SummaryMetricCard
          title="Total transacciones"
          value={`${totalTransacciones}`}
          subtitle={`${transaccionesAlta} altas • ${transaccionesDepreciacion} depreciaciones • ${transaccionesBaja} bajas • ${transaccionesVenta} ventas`}
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      <Card className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(11,58,110,0.08)]">
        <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.08),rgba(255,255,255,1),rgba(11,58,110,0.03))] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                style={{
                  borderColor: "rgba(11,58,110,0.12)",
                  backgroundColor: "rgba(11,58,110,0.06)",
                  color: BUKIPIN_BLUE,
                }}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Resumen ejecutivo CAPEX
              </div>

              <div>
                <CardTitle className="text-2xl font-bold tracking-tight text-slate-950">
                  Historial de Transacciones CAPEX
                </CardTitle>
                <CardDescription className="mt-1 text-sm leading-6 text-slate-600">
                  Registro cronológico y financiero de todas las transacciones relacionadas con
                  inversiones, depreciaciones, bajas y ventas.
                </CardDescription>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:min-w-[300px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-500">
                  Altas
                </p>
                <p className="mt-2 text-xl font-bold text-slate-900">{transaccionesAlta}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-500">
                  Depreciaciones
                </p>
                <p className="mt-2 text-xl font-bold text-slate-900">{transaccionesDepreciacion}</p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 py-4 md:px-6 md:py-5">
          <div className="overflow-hidden rounded-[24px] border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="h-12 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Fecha
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Tipo
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Activo
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Categoría
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Monto
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Mes/Año
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Descripción
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 text-right">
                    Detalle
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {transacciones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div
                          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                          style={{ backgroundColor: "rgba(11,58,110,0.08)", color: BUKIPIN_BLUE }}
                        >
                          <Clock3 className="h-6 w-6" />
                        </div>
                        <p className="text-base font-semibold text-slate-900">
                          Aún no hay transacciones registradas
                        </p>
                        <p className="mt-1 max-w-md text-sm text-slate-500">
                          Cuando se registren altas, depreciaciones, bajas o ventas de activos,
                          aparecerán aquí con su detalle financiero y contable.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  transacciones.map((transaccion) => {
                    const fecha = safeDate(transaccion.fecha);

                    return (
                      <TableRow key={transaccion.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-medium text-slate-700">
                          {fecha ? format(fecha, "dd/MM/yyyy") : "-"}
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={getTipoTransaccionVariant(transaccion.tipo)} className="h-8 px-3">
                              <div className="flex items-center gap-1.5">
                                {getTipoTransaccionIcon(transaccion.tipo)}
                                {getTipoTransaccionLabel(transaccion.tipo)}
                              </div>
                            </Badge>

                            {transaccion.inversion.estado === "activo" &&
                              (transaccion.tipo === "baja" || transaccion.tipo === "venta") && (
                                <Badge variant="outline" className="text-xs">
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  Reactivado
                                </Badge>
                              )}
                          </div>
                        </TableCell>

                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-11 w-11 ring-1 ring-slate-200">
                              <AvatarImage
                                src={transaccion.inversion.imagen_url || ""}
                                alt={transaccion.activo}
                              />
                              <AvatarFallback className="bg-slate-100 text-slate-500">
                                <ImageIcon className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {transaccion.activo}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-slate-700">
                          {getCategoriaLabel(transaccion.categoria)}
                        </TableCell>

                        <TableCell>
                          {transaccion.tipo === "alta" && transaccion.monto !== undefined && (
                            <span className="font-semibold text-emerald-600">
                              ${formatMoney(transaccion.monto)}
                            </span>
                          )}

                          {transaccion.tipo === "venta" && transaccion.valor_venta !== undefined && (
                            <span className="font-semibold" style={{ color: BUKIPIN_BLUE }}>
                              ${formatMoney(transaccion.valor_venta)}
                            </span>
                          )}

                          {transaccion.tipo === "depreciacion" && transaccion.monto !== undefined && (
                            <span className="font-semibold text-violet-600">
                              ${formatMoney(transaccion.monto)}
                            </span>
                          )}

                          {transaccion.tipo === "baja" && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {transaccion.tipo === "depreciacion" && transaccion.mes_ano ? (
                            <Badge
                              variant="secondary"
                              className="border border-violet-200 bg-violet-50 text-violet-700"
                            >
                              {transaccion.mes_ano}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>

                        <TableCell className="max-w-xs truncate text-slate-600">
                          {transaccion.tipo === "alta" && transaccion.descripcion}
                          {transaccion.tipo === "depreciacion" && transaccion.descripcion}
                          {(transaccion.tipo === "baja" || transaccion.tipo === "venta") &&
                            transaccion.motivo}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-xl"
                              onClick={() => openDetalle(transaccion)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {transaccion.tipo === "alta" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-9 rounded-xl">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-[26px]">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar inversión?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente la
                                      inversión "{transaccion.activo}" y todas sus transacciones
                                      asociadas.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-2xl">
                                      Cancelar
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleEliminar(transaccion.inversion_id)}
                                      className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}

                            {(transaccion.tipo === "baja" || transaccion.tipo === "venta") && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-9 rounded-xl">
                                    <RotateCcw className="h-4 w-4" style={{ color: BUKIPIN_BLUE }} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-[26px]">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Reactivar activo?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción revertirá la{" "}
                                      {transaccion.tipo === "venta" ? "venta" : "baja"} del activo "
                                      {transaccion.activo}". El activo volverá a estado activo y
                                      podrás darlo de baja nuevamente para generar los asientos
                                      contables correctos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-2xl">
                                      Cancelar
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      className="rounded-2xl text-white"
                                      style={{ backgroundColor: BUKIPIN_BLUE }}
                                      onClick={() => handleReactivar(transaccion.inversion_id)}
                                    >
                                      Reactivar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
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

      <Dialog open={detalleOpen} onOpenChange={closeDetalle}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-[30px] border border-slate-200 bg-white p-0 shadow-[0_24px_70px_rgba(11,58,110,0.12)]">
          <DialogHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.08),rgba(255,255,255,1),rgba(11,58,110,0.03))] px-6 py-5">
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "rgba(11,58,110,0.10)", color: BUKIPIN_BLUE }}
              >
                <ArrowUpRight className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-950">
                  Detalle de Transacción
                  {selectedTransaccion
                    ? ` - ${getTipoTransaccionLabel(selectedTransaccion.tipo)}`
                    : ""}
                </DialogTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Información general del movimiento y su impacto contable asociado.
                </p>
              </div>
            </div>
          </DialogHeader>

          {selectedTransaccion && (
            <div className="space-y-6 px-6 py-6">
              {selectedTransaccion.inversion.imagen_url && (
                <div className="overflow-hidden rounded-[24px] border border-slate-200 shadow-sm">
                  <img
                    src={selectedTransaccion.inversion.imagen_url}
                    alt={selectedTransaccion.activo}
                    className="h-72 w-full object-cover"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DetailInfoCard
                  label="Tipo de transacción"
                  accent="blue"
                  value={
                    <Badge variant={getTipoTransaccionVariant(selectedTransaccion.tipo)}>
                      <div className="flex items-center gap-1.5">
                        {getTipoTransaccionIcon(selectedTransaccion.tipo)}
                        {getTipoTransaccionLabel(selectedTransaccion.tipo)}
                      </div>
                    </Badge>
                  }
                />

                <DetailInfoCard
                  label="Fecha"
                  value={selectedFecha ? format(selectedFecha, "dd/MM/yyyy") : "-"}
                />

                <DetailInfoCard label="Activo" value={selectedTransaccion.activo} />

                <DetailInfoCard
                  label="Categoría"
                  value={getCategoriaLabel(selectedTransaccion.categoria)}
                />

                {selectedTransaccion.tipo === "alta" && (
                  <>
                    <DetailInfoCard
                      label="Valor total"
                      accent="green"
                      value={
                        <span className="text-emerald-600">
                          ${formatMoney(selectedTransaccion.monto)}
                        </span>
                      }
                    />

                    <DetailInfoCard
                      label="Depreciación anual"
                      value={`$${formatMoney(
                        selectedTransaccion.inversion.valor_depreciacion_anual || 0
                      )}`}
                    />

                    {!!selectedTransaccion.inversion.proveedor_nombre && (
                      <>
                        <DetailInfoCard
                          label="Proveedor"
                          value={selectedTransaccion.inversion.proveedor_nombre}
                        />

                        <DetailInfoCard
                          label="RFC"
                          value={selectedTransaccion.inversion.proveedor_rfc || "N/A"}
                        />
                      </>
                    )}
                  </>
                )}

                {selectedTransaccion.tipo === "venta" && (
                  <>
                    <DetailInfoCard
                      label="Valor de venta"
                      accent="blue"
                      value={
                        <span style={{ color: BUKIPIN_BLUE }}>
                          ${formatMoney(selectedTransaccion.valor_venta || 0)}
                        </span>
                      }
                    />

                    <DetailInfoCard
                      label="Valor original"
                      value={`$${formatMoney(selectedTransaccion.inversion.valor_total)}`}
                    />
                  </>
                )}

                {selectedTransaccion.tipo === "depreciacion" && (
                  <>
                    <DetailInfoCard
                      label="Monto depreciado"
                      accent="purple"
                      value={
                        <span className="text-violet-600">
                          ${formatMoney(selectedTransaccion.monto || 0)}
                        </span>
                      }
                    />

                    <DetailInfoCard
                      label="Periodo"
                      value={selectedTransaccion.mes_ano || "-"}
                    />
                  </>
                )}
              </div>

              {selectedTransaccion.tipo === "alta" && selectedTransaccion.descripcion && (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Descripción
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {selectedTransaccion.descripcion}
                  </p>
                </div>
              )}

              {(selectedTransaccion.tipo === "baja" || selectedTransaccion.tipo === "venta") &&
                selectedTransaccion.motivo && (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Motivo
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {selectedTransaccion.motivo}
                    </p>
                  </div>
                )}

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: "rgba(11,58,110,0.10)", color: BUKIPIN_BLUE }}
                  >
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">Historial de Asientos Contables</h3>
                    <p className="text-sm text-slate-500">
                      Visualiza el detalle contable generado por esta transacción.
                    </p>
                  </div>
                </div>

                {loadingAsiento ? (
                  <Skeleton className="h-32 w-full rounded-[24px]" />
                ) : selectedTransaccion.tipo === "depreciacion" && !asientosDepreciacion ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                  </div>
                ) : selectedTransaccion.tipo === "depreciacion" &&
                  selectedTransaccion.numero_asiento ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="border-violet-200 bg-violet-50 text-violet-700"
                      >
                        Asiento de Depreciación
                      </Badge>

                      <Badge variant="outline">{selectedTransaccion.numero_asiento}</Badge>

                      {selectedTransaccion.mes_ano && (
                        <Badge variant="secondary">{selectedTransaccion.mes_ano}</Badge>
                      )}
                    </div>

                    <div className="rounded-[24px] border border-violet-200 bg-violet-50/50 p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="mb-1 text-sm font-semibold text-slate-900">
                            {selectedTransaccion.descripcion}
                          </p>
                          <div className="text-xs text-slate-500">
                            Periodo: {selectedTransaccion.mes_ano || "-"}
                          </div>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="mb-1 text-xs text-slate-500">Monto de Depreciación</p>
                          <p className="text-2xl font-bold text-violet-700">
                            ${formatMoney(selectedTransaccion.monto || 0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedAsientoDepreciacion?.detalle_asientos?.length > 0 && (
                      <div className="overflow-hidden rounded-[24px] border border-slate-200">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                              <TableHead>Cuenta</TableHead>
                              <TableHead className="text-right">Debe</TableHead>
                              <TableHead className="text-right">Haber</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {selectedAsientoDepreciacion.detalle_asientos.map(
                              (detalle: any, idx: number) => (
                                <TableRow key={detalle?.id ?? `${detalle?.cuenta_codigo}-${idx}`}>
                                  <TableCell>
                                    <div>
                                      <div className="text-sm font-medium text-slate-900">
                                        {detalle?.cuenta_codigo} -{" "}
                                        {detalle?.cuenta?.nombre ||
                                          detalle?.cuenta_nombre ||
                                          "Cuenta"}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        {detalle?.descripcion || detalle?.memo || ""}
                                      </div>
                                    </div>
                                  </TableCell>

                                  <TableCell className="text-right font-mono">
                                    {Number(detalle?.debe || 0) > 0 ? (
                                      <span className="font-medium text-emerald-600">
                                        ${formatMoney(detalle?.debe || 0)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>

                                  <TableCell className="text-right font-mono">
                                    {Number(detalle?.haber || 0) > 0 ? (
                                      <span className="font-medium text-red-600">
                                        ${formatMoney(detalle?.haber || 0)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    <div className="rounded-[20px] bg-slate-50 p-4 text-sm text-slate-600">
                      Los asientos de depreciación se generan mensualmente y se reflejan
                      automáticamente en la Balanza de Comprobación.
                    </div>
                  </div>
                ) : Array.isArray(asientoInversion) && asientoInversion.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {asientoInversion.length}{" "}
                        {asientoInversion.length === 1 ? "asiento" : "asientos"}
                      </Badge>
                    </div>

                    <Accordion
                      type="single"
                      collapsible
                      defaultValue="item-0"
                      className="space-y-3"
                    >
                      {asientoInversion.map((asiento: any, index: number) => {
                        const asientoFecha = safeDate(
                          asiento?.created_at || asiento?.fecha || asiento?.asiento_fecha
                        );

                        return (
                          <AccordionItem
                            value={`item-${index}`}
                            key={asiento?.id ?? `asiento-${index}`}
                            className="overflow-hidden rounded-[22px] border border-slate-200 bg-white"
                          >
                            <AccordionTrigger className="px-5 py-4 hover:no-underline">
                              <div className="flex w-full flex-col items-start gap-2 text-left">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">
                                    {asiento?.numero_asiento || "Sin folio"}
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    {asientoFecha ? format(asientoFecha, "dd/MM/yyyy HH:mm") : "-"}
                                  </span>
                                </div>
                                <span className="text-sm font-medium text-slate-800">
                                  {asiento?.descripcion || "Asiento contable"}
                                </span>
                              </div>
                            </AccordionTrigger>

                            <AccordionContent className="px-5 pb-5">
                              <div className="overflow-hidden rounded-[18px] border border-slate-200">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                      <TableHead>Cuenta</TableHead>
                                      <TableHead className="text-right">Debe</TableHead>
                                      <TableHead className="text-right">Haber</TableHead>
                                    </TableRow>
                                  </TableHeader>

                                  <TableBody>
                                    {(asiento?.detalle_asientos || []).map(
                                      (detalle: any, idx: number) => (
                                        <TableRow
                                          key={detalle?.id ?? `${detalle?.cuenta_codigo}-${idx}`}
                                        >
                                          <TableCell>
                                            <div>
                                              <div className="text-sm font-medium text-slate-900">
                                                {detalle?.cuenta_codigo} -{" "}
                                                {detalle?.cuenta?.nombre ||
                                                  detalle?.cuenta_nombre ||
                                                  "Cuenta"}
                                              </div>
                                              <div className="text-xs text-slate-500">
                                                {detalle?.descripcion || detalle?.memo || ""}
                                              </div>
                                            </div>
                                          </TableCell>

                                          <TableCell className="text-right font-mono">
                                            {Number(detalle?.debe || 0) > 0 ? (
                                              <span className="text-emerald-600">
                                                ${formatMoney(detalle?.debe || 0)}
                                              </span>
                                            ) : (
                                              "-"
                                            )}
                                          </TableCell>

                                          <TableCell className="text-right font-mono">
                                            {Number(detalle?.haber || 0) > 0 ? (
                                              <span className="text-red-600">
                                                ${formatMoney(detalle?.haber || 0)}
                                              </span>
                                            ) : (
                                              "-"
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>

                    <div className="rounded-[20px] bg-slate-50 p-4 text-sm text-slate-600">
                      Los asientos se generan automáticamente al{" "}
                      {selectedTransaccion.tipo === "alta"
                        ? "registrar la inversión"
                        : selectedTransaccion.tipo === "venta"
                          ? "vender el activo"
                          : "dar de baja el activo"}{" "}
                      y se reflejan en la Balanza de Comprobación.
                    </div>
                  </div>
                ) : (
                  <Alert className="rounded-[20px] border-slate-200">
                    <AlertDescription>
                      No hay asientos contables registrados para esta transacción.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResumenInversiones;