import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useInversiones } from "@/hooks/useInversiones";
import { useAsientosDepreciacion } from "@/hooks/useAsientosDepreciacion";
import { useDepreciacionesAtrasadas } from "@/hooks/useDepreciacionesAtrasadas";
import {
  Loader2,
  TrendingDown,
  Calendar,
  DollarSign,
  ChevronDown,
  FileText,
  Landmark,
  BarChart3,
  Clock3,
  ShieldAlert,
  Layers3,
  ArrowRight,
  Image as ImageIcon,
} from "lucide-react";
import { format, lastDayOfMonth, differenceInDays, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo } from "react";

const BUKIPIN_BLUE = "#0B3A6E";
const BUKIPIN_BLUE_DARK = "#082E57";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
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

const ResumenDepreciaciones = () => {
  const { inversiones, isLoading } = useInversiones();
  const [expandedInversiones, setExpandedInversiones] = useState<string[]>([]);
  const { depreciacionesAtrasadas, tieneAtrasadas, totalAtrasadas } = useDepreciacionesAtrasadas();

  const fechaActual = new Date();

  const inversionesActivas = inversiones?.filter((inv) => inv.estado === "activo") || [];

  const totalDepreciacionAnual = inversionesActivas.reduce(
    (sum, inv) => sum + (inv.valor_depreciacion_anual || 0),
    0
  );
  const totalDepreciacionMensual = inversionesActivas.reduce(
    (sum, inv) => sum + (inv.valor_depreciacion_mensual || 0),
    0
  );
  const totalValorActivos = inversionesActivas.reduce((sum, inv) => sum + inv.valor_total, 0);

  // Indicadores de próxima depreciación
  const finDelMesActual = lastDayOfMonth(fechaActual);
  const diasParaProxDepreciacion = differenceInDays(finDelMesActual, fechaActual);
  const depreciacionEsperadaEsteMes = inversionesActivas
    .filter((inv) => (inv.valor_depreciacion_mensual || 0) > 0)
    .reduce((sum, inv) => sum + (inv.valor_depreciacion_mensual || 0), 0);

  const toggleExpanded = (inversionId: string) => {
    setExpandedInversiones((prev) =>
      prev.includes(inversionId) ? prev.filter((id) => id !== inversionId) : [...prev, inversionId]
    );
  };

  const AsientosDepreciacionSection = ({ inversionId }: { inversionId: string }) => {
    const { data: asientos, isLoading } = useAsientosDepreciacion(inversionId);
    const isExpanded = expandedInversiones.includes(inversionId);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      );
    }

    if (!asientos || asientos.length === 0) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-center text-xs text-slate-500">
          No hay asientos de depreciación generados aún.
        </div>
      );
    }

    return (
      <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(inversionId)}>
        <CollapsibleTrigger
          className="flex w-full items-center justify-between rounded-[20px] border px-4 py-3 text-left transition-colors"
          style={{
            borderColor: "rgba(11,58,110,0.14)",
            backgroundColor: "rgba(11,58,110,0.05)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: "rgba(11,58,110,0.10)", color: BUKIPIN_BLUE }}
            >
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Asientos de depreciación generados
              </p>
              <p className="text-xs text-slate-500">{asientos.length} registro(s) contable(s)</p>
            </div>
          </div>

          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-3 space-y-3">
          {asientos.map((asiento) => {
            const match = asiento.numero_asiento.match(/DEP-.+-(\d{4})(\d{2})/);
            const año = match ? match[1] : "";
            const mes = match ? match[2] : "";
            const fecha = match ? new Date(parseInt(año), parseInt(mes) - 1) : new Date(asiento.fecha);

            return (
              <div
                key={asiento.id}
                className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold capitalize text-slate-900">
                      {format(fecha, "MMMM yyyy", { locale: es })}
                    </p>
                    <p className="text-xs font-mono text-slate-500">{asiento.numero_asiento}</p>
                  </div>

                  <Badge variant="outline" className="w-fit">
                    {format(new Date(asiento.fecha), "dd/MM/yyyy")}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {asiento.detalle_asientos?.map((detalle) => (
                    <div
                      key={detalle.id}
                      className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900">
                          {detalle.cuenta_codigo} - {detalle.cuenta?.nombre}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{detalle.descripcion}</p>
                      </div>

                      <div className="text-right">
                        {detalle.debe > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-emerald-600">
                              {formatCurrency(detalle.debe)}
                            </p>
                            <Badge variant="outline" className="h-5 text-[10px]">
                              DEBE
                            </Badge>
                          </div>
                        )}
                        {detalle.haber > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold" style={{ color: BUKIPIN_BLUE }}>
                              {formatCurrency(detalle.haber)}
                            </p>
                            <Badge variant="outline" className="h-5 text-[10px]">
                              HABER
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const InversionCard = ({ inversion }: { inversion: any }) => {
    const { data: asientos } = useAsientosDepreciacion(inversion.id);

    const depreciacionAcumulada = useMemo(() => {
      if (!asientos) return 0;
      return asientos.reduce((total, asiento) => {
        const gastoDepreciacion =
          asiento.detalle_asientos
            ?.filter((d) => d.cuenta_codigo === "5109")
            .reduce((sum, d) => sum + d.debe, 0) || 0;
        return total + gastoDepreciacion;
      }, 0);
    }, [asientos]);

    const valorLibros = Math.max(0, inversion.valor_total - depreciacionAcumulada);

    const extraerMesAnoDeAsiento = (numeroAsiento: string) => {
      const match = numeroAsiento.match(/DEP-.+-(\d{4})(\d{2})/);
      if (!match) return null;
      const año = parseInt(match[1]);
      const mes = parseInt(match[2]);
      return new Date(año, mes - 1, 1);
    };

    const ultimoMesDepreciado =
      asientos && asientos.length > 0 ? extraerMesAnoDeAsiento(asientos[0].numero_asiento) : null;

    const fechaInicio = inversion.fecha_inicio_depreciacion
      ? new Date(inversion.fecha_inicio_depreciacion)
      : new Date(inversion.fecha_adquisicion);

    let proximaFechaDepreciacion;
    if (ultimoMesDepreciado) {
      proximaFechaDepreciacion = lastDayOfMonth(addMonths(ultimoMesDepreciado, 1));
    } else {
      proximaFechaDepreciacion = lastDayOfMonth(fechaInicio);
    }

    const hoy = new Date();
    const diasFaltantes = differenceInDays(proximaFechaDepreciacion, hoy);

    const mesesDepreciados = asientos?.length || 0;
    const porcentajeDepreciado =
      inversion.valor_total > 0 ? (depreciacionAcumulada / inversion.valor_total) * 100 : 0;

    const fechaAdquisicion = new Date(inversion.fecha_adquisicion);

    return (
      <Card className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_14px_45px_rgba(11,58,110,0.08)]">
        <CardContent className="p-0">
          <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.07),rgba(255,255,255,1),rgba(11,58,110,0.03))] px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: "rgba(11,58,110,0.10)", color: BUKIPIN_BLUE }}
                  >
                    <Layers3 className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-slate-950">
                      {inversion.producto_nombre}
                    </h3>
                    {inversion.descripcion && (
                      <p className="mt-1 text-sm leading-6 text-slate-500">{inversion.descripcion}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge variant="outline">{inversion.categoria_activo}</Badge>
                      <span>Adquisición: {format(fechaAdquisicion, "dd MMM yyyy", { locale: es })}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                {inversion.imagen_url ? (
                  <div className="h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                    <img
                      src={inversion.imagen_url}
                      alt={inversion.producto_nombre}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 shadow-sm">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5 px-5 py-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Valor original
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {formatCurrency(inversion.valor_total)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Años depreciación
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {inversion.anos_depreciacion} años
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Meses depreciados
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {mesesDepreciados} meses
                </p>
              </div>

              <div
                className="rounded-2xl border p-4"
                style={{
                  borderColor: "rgba(11,58,110,0.14)",
                  backgroundColor: "rgba(11,58,110,0.05)",
                }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Próxima depreciación
                </p>
                <p className="mt-2 text-sm font-semibold" style={{ color: BUKIPIN_BLUE }}>
                  {format(proximaFechaDepreciacion, "dd MMM yyyy", { locale: es })}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {diasFaltantes === 0
                    ? "Hoy"
                    : diasFaltantes > 0
                      ? `en ${diasFaltantes} días`
                      : `hace ${Math.abs(diasFaltantes)} días`}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Depreciación acumulada
                </p>
                <p className="mt-2 text-sm font-semibold text-amber-700">
                  {formatCurrency(depreciacionAcumulada)}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Valor en libros
                </p>
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  {formatCurrency(valorLibros)}
                </p>
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Progreso de depreciación</p>
                  <p className="text-xs text-slate-500">
                    Seguimiento real basado en asientos generados
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {porcentajeDepreciado.toFixed(2)}%
                </p>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0B3A6E,#356AA3)] transition-all duration-500"
                  style={{ width: `${Math.min(porcentajeDepreciado, 100)}%` }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>Mensual: {formatCurrency(inversion.valor_depreciacion_mensual || 0)}</span>
                <span>Anual: {formatCurrency(inversion.valor_depreciacion_anual || 0)}</span>
              </div>
            </div>

            <AsientosDepreciacionSection inversionId={inversion.id} />
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          <span className="text-sm text-slate-600">Cargando depreciaciones...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryMetricCard
          title="Depreciación anual total"
          value={formatCurrency(totalDepreciacionAnual)}
          subtitle={`Basado en ${inversionesActivas.length} activo(s) activo(s)`}
          icon={<TrendingDown className="h-5 w-5" />}
        />

        <SummaryMetricCard
          title="Depreciación mensual total"
          value={formatCurrency(totalDepreciacionMensual)}
          subtitle="Promedio mensual estimado"
          icon={<Calendar className="h-5 w-5" />}
        />

        <SummaryMetricCard
          title="Valor total de activos"
          value={formatCurrency(totalValorActivos)}
          subtitle="Valor original acumulado"
          icon={<DollarSign className="h-5 w-5" />}
        />

        <SummaryMetricCard
          title="Días para próxima depreciación"
          value={diasParaProxDepreciacion === 0 ? "Hoy" : `${diasParaProxDepreciacion} días`}
          subtitle={`Último día del mes: ${format(finDelMesActual, "dd MMM yyyy", { locale: es })}`}
          icon={<Clock3 className="h-5 w-5" />}
        />

        <SummaryMetricCard
          title="Depreciación esperada este mes"
          value={formatCurrency(depreciacionEsperadaEsteMes)}
          subtitle={`${inversionesActivas.filter((i) => (i.valor_depreciacion_mensual || 0) > 0).length} activo(s) elegible(s)`}
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      {tieneAtrasadas && (
        <PremiumNotice
          destructive
          icon={<ShieldAlert className="h-5 w-5" />}
          title={`${totalAtrasadas} período(s) de depreciación sin registrar`}
          description={
            <div className="space-y-2">
              <div className="space-y-1">
                {depreciacionesAtrasadas.slice(0, 5).map((atraso) => {
                  const ano = atraso.mesAno.substring(0, 4);
                  const mes = atraso.mesAno.substring(4, 6);
                  const fecha = new Date(parseInt(ano), parseInt(mes) - 1);

                  return (
                    <div
                      key={`${atraso.inversionId}-${atraso.mesAno}`}
                      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-slate-800">{atraso.productoNombre}</span>
                      <span className="text-slate-500">
                        {fecha.toLocaleString("es-MX", { month: "long", year: "numeric" })}
                        {atraso.mesesAtrasados > 0 &&
                          ` (${atraso.mesesAtrasados} mes${atraso.mesesAtrasados > 1 ? "es" : ""} atrás)`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {depreciacionesAtrasadas.length > 5 && (
                <p className="italic text-slate-500">
                  ... y {depreciacionesAtrasadas.length - 5} más
                </p>
              )}

              <p className="pt-1 text-sm text-slate-600">
                Las depreciaciones pendientes se registrarán automáticamente al final de cada mes.
              </p>
            </div>
          }
        />
      )}

      <Card className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(11,58,110,0.08)]">
        <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.08),rgba(255,255,255,1),rgba(11,58,110,0.03))] px-6 py-5">
          <SectionHeader
            icon={<BarChart3 className="h-5 w-5" />}
            title="Historial de Depreciaciones por Activo"
            subtitle="Detalle de depreciación acumulada, valor en libros y trazabilidad contable por cada activo activo."
          />
        </CardHeader>

        <CardContent className="px-5 py-5 md:px-6 md:py-6">
          {inversionesActivas.length === 0 ? (
            <div className="py-16">
              <div className="flex flex-col items-center justify-center text-center">
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "rgba(11,58,110,0.08)", color: BUKIPIN_BLUE }}
                >
                  <Clock3 className="h-6 w-6" />
                </div>
                <p className="text-base font-semibold text-slate-900">
                  No hay inversiones activas registradas
                </p>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Cuando existan activos activos con depreciación aplicable, aparecerán aquí con su
                  historial y métricas financieras.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {inversionesActivas.map((inversion) => (
                <InversionCard key={inversion.id} inversion={inversion} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumenDepreciaciones;
