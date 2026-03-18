import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInversiones } from "@/hooks/useInversiones";
import { useDepreciacionesReales } from "@/hooks/useDepreciacionesReales";
import { useDepreciacionesAtrasadas } from "@/hooks/useDepreciacionesAtrasadas";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, BarChart3, Calculator, Landmark, Layers3, PieChart as PieChartIcon, ShieldAlert, Sparkles, TrendingDown, Wallet } from "lucide-react";
import {
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Treemap,
  LabelList,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const BUKIPIN_BLUE = "#0B3A6E";
const BUKIPIN_BLUE_DARK = "#082E57";

const COLORS = [
  "#0B3A6E",
  "#1E4F86",
  "#2C629F",
  "#3B74B5",
  "#5488C7",
  "#6D9CD4",
  "#8DB3E3",
];

const AnalyticaInversiones = () => {
  const { inversiones, isLoading } = useInversiones();
  const { data, isLoading: loadingDepreciaciones } = useDepreciacionesReales();
  const { tieneAtrasadas, totalAtrasadas } = useDepreciacionesAtrasadas();

  const depreciacionesReales = data?.depreciacionesPorInversion || {};
  const periodosRegistrados = data?.periodosRegistrados || {};

  const [periodoDepreciacion, setPeriodoDepreciacion] = useState<"mensual" | "anual">("mensual");
  const [formatoCifras, setFormatoCifras] = useState<"completo" | "miles" | "millones">("completo");

  const formatearCifra = (valor: number, incluirSimbolo: boolean = true): string => {
    let valorFormateado = valor;
    let sufijo = "";

    switch (formatoCifras) {
      case "miles":
        valorFormateado = valor / 1000;
        sufijo = "K";
        break;
      case "millones":
        valorFormateado = valor / 1000000;
        sufijo = "M";
        break;
      default:
        valorFormateado = valor;
        sufijo = "";
    }

    const numeroFormateado = valorFormateado.toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return incluirSimbolo ? `$${numeroFormateado}${sufijo}` : `${numeroFormateado}${sufijo}`;
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

  const inversionesActivas = inversiones.filter((inv) => inv.estado === "activo" && !inv.fecha_baja);

  const inversionPorCategoria = inversionesActivas.reduce((acc: any, inv) => {
    const categoria = getCategoriaLabel(inv.categoria_activo);
    const depreciacionAcumulada = depreciacionesReales?.[inv.id] || 0;

    if (!acc[categoria]) {
      acc[categoria] = {
        name: categoria,
        montoTotal: 0,
        depreciacionAcumulada: 0,
        cantidad: 0,
      };
    }

    acc[categoria].montoTotal += Number(inv.valor_total);
    acc[categoria].depreciacionAcumulada += depreciacionAcumulada;
    acc[categoria].cantidad += 1;
    return acc;
  }, {});

  const dataPorCategoria = Object.values(inversionPorCategoria);

  const totalInvertido = inversionesActivas.reduce((acc, inv) => acc + Number(inv.valor_total), 0);
  const totalDepreciacionAcumulada = Object.values(depreciacionesReales || {}).reduce(
    (acc: number, val) => acc + (val as number),
    0
  );
  const totalActivosNetos = totalInvertido - totalDepreciacionAcumulada;
  const numeroTotalActivos = inversionesActivas.length;

  const treeMapInversionData = dataPorCategoria
    .filter((item: any) => item.montoTotal > 0)
    .map((item: any) => ({
      name: item.name,
      size: item.montoTotal,
      value: item.montoTotal,
    }));

  const treeMapDepreciacionData = dataPorCategoria
    .filter((item: any) => item.depreciacionAcumulada > 0)
    .map((item: any) => ({
      name: item.name,
      size: item.depreciacionAcumulada,
      value: item.depreciacionAcumulada,
    }));

  const treeMapActivoNetoData = dataPorCategoria
    .filter((item: any) => item.montoTotal - item.depreciacionAcumulada > 0)
    .map((item: any) => ({
      name: item.name,
      size: item.montoTotal - item.depreciacionAcumulada,
      value: item.montoTotal - item.depreciacionAcumulada,
    }));

  const totalInversionesTreemap = treeMapInversionData.reduce((acc, item) => acc + item.value, 0);
  const totalDepreciacionTreemap = treeMapDepreciacionData.reduce((acc, item) => acc + item.value, 0);
  const totalActivoNetoTreemap = treeMapActivoNetoData.reduce((acc, item) => acc + item.value, 0);

  const calcularPorcentaje = (valor: number, total: number) => {
    if (total === 0) return "0.0";
    return ((valor / total) * 100).toFixed(1);
  };

  const hoy = new Date();

  const calcularDepreciacionesFuturas = () => {
    const periodos = periodoDepreciacion === "mensual" ? 12 : 20;
    const data: any[] = [];
    const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    for (let i = 0; i < periodos; i++) {
      let nombrePeriodo: string;

      if (periodoDepreciacion === "mensual") {
        const mesActual = hoy.getMonth();
        const anoActual = hoy.getFullYear();
        const mesIndex = (mesActual + i) % 12;
        const anoOffset = Math.floor((mesActual + i) / 12);
        nombrePeriodo = `${mesesNombres[mesIndex]} ${anoActual + anoOffset}`;
      } else {
        const anoActual = hoy.getFullYear();
        const mesActual = hoy.getMonth();
        const mesesRestantesAnoActual = 12 - mesActual;

        if (i === 0) {
          nombrePeriodo = `${anoActual} (${mesesRestantesAnoActual} meses)`;
        } else {
          nombrePeriodo = `${anoActual + i}`;
        }
      }

      const periodo: any = { periodo: nombrePeriodo };

      dataPorCategoria.forEach((cat: any) => {
        periodo[cat.name] = 0;
      });

      data.push(periodo);
    }

    inversionesActivas.forEach((inv) => {
      const categoria = getCategoriaLabel(inv.categoria_activo);
      const fechaInicio = inv.fecha_inicio_depreciacion
        ? new Date(inv.fecha_inicio_depreciacion)
        : new Date(inv.fecha_adquisicion);

      const mesesTranscurridos = Math.max(
        0,
        (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 + (hoy.getMonth() - fechaInicio.getMonth())
      );
      const totalMeses = inv.anos_depreciacion * 12;
      const mesesRestantes = Math.max(0, totalMeses - mesesTranscurridos);

      if (periodoDepreciacion === "mensual") {
        const mesesAMostrar = Math.min(12, mesesRestantes);
        for (let i = 0; i < mesesAMostrar; i++) {
          const fechaProyectada = new Date(hoy);
          fechaProyectada.setMonth(fechaProyectada.getMonth() + i);
          const periodoYYYYMM = `${fechaProyectada.getFullYear()}${String(
            fechaProyectada.getMonth() + 1
          ).padStart(2, "0")}`;

          const yaRegistrado = periodosRegistrados?.[inv.id]?.has(periodoYYYYMM);
          if (!yaRegistrado) {
            data[i][categoria] += inv.valor_depreciacion_mensual || 0;
          }
        }
      } else {
        const anosRestantes = Math.ceil(mesesRestantes / 12);
        const anosAMostrar = Math.min(20, anosRestantes);

        const mesActual = hoy.getMonth();
        const mesesRestantesAnoActual = 12 - mesActual;

        for (let i = 0; i < anosAMostrar; i++) {
          const anoProyectado = hoy.getFullYear() + i;
          let mesesAProcesar = 0;

          if (i === 0) {
            mesesAProcesar = Math.min(mesesRestantesAnoActual, mesesRestantes);
          } else if (i === anosRestantes - 1) {
            mesesAProcesar = mesesRestantes % 12 || 12;
          } else {
            mesesAProcesar = 12;
          }

          let mesesYaRegistrados = 0;
          const mesInicio = i === 0 ? mesActual : 0;
          const mesFin = 12;

          for (let mes = mesInicio; mes < mesFin; mes++) {
            const periodoYYYYMM = `${anoProyectado}${String(mes + 1).padStart(2, "0")}`;
            if (periodosRegistrados?.[inv.id]?.has(periodoYYYYMM)) {
              mesesYaRegistrados++;
            }
          }

          const mesesPendientes = mesesAProcesar - mesesYaRegistrados;
          if (mesesPendientes > 0) {
            data[i][categoria] += (inv.valor_depreciacion_mensual || 0) * mesesPendientes;
          }
        }
      }
    });

    return data;
  };

  const dataDepreciacionesFuturas = calcularDepreciacionesFuturas();
  const categorias = dataPorCategoria.map((cat: any) => cat.name);

  const dataConTotales = dataDepreciacionesFuturas.map((periodo) => {
    const total = categorias.reduce((sum, cat) => sum + (periodo[cat] || 0), 0);
    return { ...periodo, total };
  });

  const renderTreemapContent =
    (totalGeneral: number) =>
    (props: any) => {
      const { x, y, width, height, index, name, value } = props;
      if (!value || typeof value !== "number") return null;

      const bg = COLORS[index % COLORS.length];
      const textColor = "#ffffff";
      const porcentaje = calcularPorcentaje(value, totalGeneral);

      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={12}
            ry={12}
            style={{
              fill: bg,
              stroke: "#ffffff",
              strokeWidth: 3,
            }}
          />
          {width > 90 && height > 70 && (
            <>
              <text
                x={x + width / 2}
                y={y + height / 2 - 20}
                textAnchor="middle"
                fill={textColor}
                fontSize={15}
                fontWeight="700"
              >
                {name || "Sin nombre"}
              </text>
              <text
                x={x + width / 2}
                y={y + height / 2 + 2}
                textAnchor="middle"
                fill={textColor}
                fontSize={13}
                fontWeight="600"
              >
                {formatearCifra(value)}
              </text>
              <text
                x={x + width / 2}
                y={y + height / 2 + 22}
                textAnchor="middle"
                fill={textColor}
                fontSize={12}
                fontWeight="500"
              >
                {`(${porcentaje}%)`}
              </text>
            </>
          )}
        </g>
      );
    };

  if (isLoading || loadingDepreciaciones) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-[28px]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Skeleton className="h-36 w-full rounded-[24px]" />
          <Skeleton className="h-36 w-full rounded-[24px]" />
          <Skeleton className="h-36 w-full rounded-[24px]" />
          <Skeleton className="h-36 w-full rounded-[24px]" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Skeleton className="h-[460px] w-full rounded-[28px]" />
          <Skeleton className="h-[460px] w-full rounded-[28px]" />
          <Skeleton className="h-[460px] w-full rounded-[28px]" />
        </div>
        <Skeleton className="h-[520px] w-full rounded-[28px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(11,58,110,0.08)]">
        <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.10),rgba(255,255,255,1),rgba(11,58,110,0.04))] px-6 py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                style={{
                  borderColor: "rgba(11,58,110,0.12)",
                  backgroundColor: "rgba(11,58,110,0.06)",
                  color: BUKIPIN_BLUE,
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Panel analítico premium de inversiones
              </div>

              <div>
                <CardTitle className="text-2xl font-bold tracking-tight text-slate-950">
                  Resumen de Activos Fijos
                </CardTitle>
                <CardDescription className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  Analiza la composición del CAPEX, la depreciación acumulada real y la proyección
                  futura del activo fijo con visualizaciones ejecutivas alineadas a Bukipin.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 md:min-w-[240px]">
              <Label htmlFor="formato" className="text-sm font-semibold text-slate-700">
                Formato de cifras
              </Label>
              <Select
                value={formatoCifras}
                onValueChange={(value: "completo" | "miles" | "millones") => setFormatoCifras(value)}
              >
                <SelectTrigger id="formato" className="h-11 rounded-2xl border-slate-200 bg-white shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completo">Completo</SelectItem>
                  <SelectItem value="miles">Miles (K)</SelectItem>
                  <SelectItem value="millones">Millones (M)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {tieneAtrasadas && (
        <div
          className="rounded-[24px] border px-4 py-4 shadow-sm"
          style={{
            borderColor: "rgba(220,38,38,0.18)",
            backgroundColor: "rgba(254,242,242,0.92)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: "rgba(220,38,38,0.12)",
                color: "#b91c1c",
              }}
            >
              <ShieldAlert className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">Advertencia de depreciaciones pendientes</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Hay <strong>{totalAtrasadas}</strong> período(s) de depreciación sin registrar. Los análisis
                pueden estar incompletos. Ve a la pestaña <strong>“Depreciaciones”</strong> para
                actualizar la información.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_14px_45px_rgba(11,58,110,0.08)]">
          <CardContent className="p-0">
            <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.07),rgba(255,255,255,1),rgba(11,58,110,0.03))] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Activos fijos brutos
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                    {formatearCifra(totalInvertido)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">Solo activos activos</p>
                </div>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "rgba(11,58,110,0.10)", color: BUKIPIN_BLUE }}
                >
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_14px_45px_rgba(11,58,110,0.08)]">
          <CardContent className="p-0">
            <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(255,255,255,1),rgba(245,158,11,0.03))] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Depreciación acumulada
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-amber-600">
                    {formatearCifra(totalDepreciacionAcumulada)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">Real de asientos contables</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_14px_45px_rgba(11,58,110,0.08)]">
          <CardContent className="p-0">
            <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.08),rgba(255,255,255,1),rgba(59,116,181,0.03))] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Activos netos
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-tight" style={{ color: "#2f63d7" }}>
                    {formatearCifra(totalActivosNetos)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">Valor en libros</p>
                </div>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "rgba(47,99,215,0.10)", color: "#2f63d7" }}
                >
                  <Landmark className="h-5 w-5" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_14px_45px_rgba(11,58,110,0.08)]">
          <CardContent className="p-0">
            <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.07),rgba(255,255,255,1),rgba(11,58,110,0.03))] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Número de activos
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                    {numeroTotalActivos}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">Activos activos</p>
                </div>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "rgba(11,58,110,0.10)", color: BUKIPIN_BLUE }}
                >
                  <Layers3 className="h-5 w-5" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(11,58,110,0.08)]">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "rgba(11,58,110,0.10)", color: BUKIPIN_BLUE }}
              >
                <PieChartIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Inversiones por Categoría</CardTitle>
                <CardDescription className="mt-1">
                  Monto total invertido por tipo de activo
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            {treeMapInversionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={420}>
                <Treemap
                  data={treeMapInversionData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={renderTreemapContent(totalInversionesTreemap) as any}
                />
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[420px] items-center justify-center text-center text-slate-500">
                No hay datos de inversiones para mostrar
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(11,58,110,0.08)]">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Depreciaciones por Categoría</CardTitle>
                <CardDescription className="mt-1">
                  Depreciación acumulada por tipo de activo
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            {treeMapDepreciacionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={420}>
                <Treemap
                  data={treeMapDepreciacionData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={renderTreemapContent(totalDepreciacionTreemap) as any}
                />
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[420px] items-center justify-center text-center text-slate-500">
                No hay datos de depreciación para mostrar
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(11,58,110,0.08)]">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "rgba(47,99,215,0.10)", color: "#2f63d7" }}
              >
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Activo Fijo Neto</CardTitle>
                <CardDescription className="mt-1">
                  Valor en libros por categoría
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            {treeMapActivoNetoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={420}>
                <Treemap
                  data={treeMapActivoNetoData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={renderTreemapContent(totalActivoNetoTreemap) as any}
                />
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[420px] items-center justify-center text-center text-slate-500">
                No hay datos de activo fijo neto para mostrar
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(11,58,110,0.08)]">
        <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(11,58,110,0.08),rgba(255,255,255,1),rgba(11,58,110,0.03))]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "rgba(11,58,110,0.10)", color: BUKIPIN_BLUE }}
              >
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-2xl">Proyección de Depreciaciones</CardTitle>
                <CardDescription className="mt-1">
                  Distribución de depreciaciones{" "}
                  {periodoDepreciacion === "mensual"
                    ? "en los próximos 12 meses"
                    : "por año"}
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 md:min-w-[220px]">
              <Label htmlFor="periodo" className="text-sm font-semibold text-slate-700">
                Vista de proyección
              </Label>
              <Select
                value={periodoDepreciacion}
                onValueChange={(value: "mensual" | "anual") => setPeriodoDepreciacion(value)}
              >
                <SelectTrigger id="periodo" className="h-11 rounded-2xl border-slate-200 bg-white shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={460}>
            <BarChart data={dataConTotales} barCategoryGap={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe5f0" />
              <XAxis
                dataKey="periodo"
                tick={{ fill: "#475569", fontSize: 12 }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={{ stroke: "#cbd5e1" }}
              />
              <YAxis
                tick={{ fill: "#475569", fontSize: 12 }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={{ stroke: "#cbd5e1" }}
                tickFormatter={(value: number) => formatearCifra(value, false)}
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.08)]}
              />
              <Tooltip
                formatter={(value: number) => formatearCifra(value)}
                contentStyle={{
                  borderRadius: 16,
                  border: "1px solid #dbe5f0",
                  boxShadow: "0 12px 30px rgba(11,58,110,0.10)",
                }}
              />
              {categorias.map((categoria: string, index: number) => (
                <Bar
                  key={categoria}
                  dataKey={categoria}
                  stackId="a"
                  fill={COLORS[index % COLORS.length]}
                  radius={[8, 8, 0, 0]}
                >
                  <LabelList
                    dataKey={categoria}
                    position="center"
                    fill="#fff"
                    stroke="#fff"
                    strokeWidth={0.4}
                    fontSize={12}
                    fontWeight="700"
                    formatter={(value: number) => {
                      if (value <= 0) return "";

                      let valorFormateado = value;
                      let sufijo = "";

                      switch (formatoCifras) {
                        case "miles":
                          valorFormateado = value / 1000;
                          sufijo = "K";
                          break;
                        case "millones":
                          valorFormateado = value / 1000000;
                          sufijo = "M";
                          break;
                        default:
                          valorFormateado = value;
                          sufijo = "";
                      }

                      const decimales = formatoCifras === "completo" ? 0 : 1;
                      return `$${valorFormateado.toFixed(decimales)}${sufijo}`;
                    }}
                  />
                </Bar>
              ))}

              <Bar dataKey="total" stackId="a" fill="transparent">
                <LabelList
                  dataKey="total"
                  position="top"
                  offset={-10}
                  fill="#0f172a"
                  fontSize={13}
                  fontWeight="700"
                  formatter={(value: number) => {
                    if (value <= 0) return "";
                    return formatearCifra(value);
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticaInversiones;