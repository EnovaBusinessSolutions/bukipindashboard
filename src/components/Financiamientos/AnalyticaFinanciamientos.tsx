import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
  Treemap,
  ReferenceLine,
  LineChart,
  Line,
} from "recharts";

import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { useInstitucionesFinancieras } from "@/hooks/useInstitucionesFinancieras";

const COLORS = [
  "hsl(180, 50%, 55%)",
  "hsl(180, 45%, 45%)",
  "hsl(180, 55%, 65%)",
  "hsl(180, 40%, 40%)",
  "hsl(180, 60%, 70%)",
];

type PeriodoAmortizacion = "mensual" | "anual";
type FormatoVisualizacion = "normal" | "miles" | "millones";
type TipoDeudaAcreedor = "total" | "capital" | "intereses";
type TipoGastoFinanciero = "total" | "simple" | "revolvente" | "tarjeta" | "combinada";

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const safeDate = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const yyyyMm = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const getTipoUi = (f: any) => {
  const raw = String(f?.tipo || f?.tipo_credito || "").toLowerCase();
  if (raw === "tarjeta_credito" || raw === "tarjeta_corporativa") return "tarjeta_corporativa";
  if (raw === "linea_credito" || raw === "revolvente") return "revolvente";
  if (raw === "credito_simple" || raw === "simple" || raw === "prestamo") return "simple";
  if (raw === "arrendamiento") return "arrendamiento";
  return raw || "otro";
};

const getTipoCreditoLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    simple: "Crédito Simple",
    arrendamiento: "Arrendamiento",
    revolvente: "Crédito Revolvente",
    tarjeta_corporativa: "Tarjeta Corporativa",
    otro: "Otro",
  };
  return labels[tipo] || tipo;
};

const getEstatus = (f: any) => String(f?.estatus || f?.estado || "").toLowerCase();

const getInstitucion = (f: any) => f?.institucion || f?.institucion_financiera || "Acreedor";

const getInstitucionId = (f: any) =>
  String(f?.institucion_id || f?.institucionId || f?.institucion_financiera_id || getInstitucion(f));

const getLineaTotal = (f: any) =>
  toNum(f?.linea_credito ?? f?.lineaCredito ?? f?.monto_total, 0);

const getMontoOriginal = (f: any) =>
  toNum(f?.monto_original ?? f?.montoOriginal ?? f?.saldo_inicial ?? f?.monto_total, 0);

const getSaldoCapital = (f: any) =>
  toNum(f?.saldo_capital_actual ?? f?.saldoCapitalActual ?? f?.saldo_actual, 0);

const getSaldoIntereses = (f: any) =>
  toNum(f?.saldo_intereses_actual ?? f?.saldoInteresesActual, 0);

const getSaldoTotal = (f: any) =>
  toNum(
    f?.saldo_total_actual ??
      f?.saldoTotalActual ??
      (getSaldoCapital(f) + getSaldoIntereses(f)),
    0
  );

const getDisponible = (f: any) => {
  const d = Number(f?.disponible_actual ?? f?.disponibleActual);
  if (Number.isFinite(d)) return Math.max(0, d);
  return Math.max(0, getLineaTotal(f) - getSaldoCapital(f));
};

const getTasa = (f: any) =>
  toNum(f?.tasa_interes_anual ?? f?.tasaInteresAnual ?? f?.tasa_interes, 0);

const getFechaVencimiento = (f: any) =>
  safeDate(f?.fecha_vencimiento || f?.fechaVencimiento || null);

const getFechaInicio = (f: any) =>
  safeDate(f?.fecha_inicio || f?.fechaInicio || f?.fecha_apertura || f?.fechaApertura || null);

const getTxTipo = (t: any) => String(t?.tipo || t?.tipo_transaccion || "").toLowerCase();

const getTxFinanciamientoId = (t: any) =>
  String(t?.financingId || t?.financing_id || t?.financiamiento_id || "");

const getTxMonto = (t: any) => toNum(t?.monto, 0);
const getTxMontoCapital = (t: any) =>
  toNum(t?.monto_capital ?? t?.montoCapital ?? t?.capital_pagado, 0);
const getTxMontoIntereses = (t: any) =>
  toNum(t?.monto_intereses ?? t?.montoIntereses ?? t?.interes_pagado, 0);

const getTxFecha = (t: any) =>
  safeDate(t?.fecha || t?.created_at || t?.createdAt || null);

const AnalyticaFinanciamientos = () => {
  const { financiamientos, transacciones, resumen, isLoading } = useFinanciamientos();
  const { instituciones } = useInstitucionesFinancieras();

  const [periodoAmortizacion, setPeriodoAmortizacion] = useState<PeriodoAmortizacion>("mensual");
  const [formatoVisualizacion, setFormatoVisualizacion] = useState<FormatoVisualizacion>("normal");
  const [decimales, setDecimales] = useState<number>(2);

  const [creditoAmortizacion, setCreditoAmortizacion] = useState<string>("todos");
  const [creditoSimpleSeleccionado, setCreditoSimpleSeleccionado] = useState<string>("todos");
  const [creditoRevolventeSeleccionado, setCreditoRevolventeSeleccionado] = useState<string>("todos");

  const [periodoGastosFinancieros, setPeriodoGastosFinancieros] = useState<PeriodoAmortizacion>("mensual");
  const [tipoGastoFinanciero, setTipoGastoFinanciero] = useState<TipoGastoFinanciero>("total");

  const [tipoDeudaAcreedor, setTipoDeudaAcreedor] = useState<TipoDeudaAcreedor>("total");
  const [acreedorSeleccionado, setAcreedorSeleccionado] = useState<string | null>(null);

  const formatearValor = (valor: number): string => {
    if (formatoVisualizacion === "miles") {
      return `${(valor / 1000).toFixed(decimales)}K`;
    }
    if (formatoVisualizacion === "millones") {
      return `${(valor / 1_000_000).toFixed(decimales)}M`;
    }
    return valor.toLocaleString("es-MX", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
  };

  const formatearValorCompleto = (valor: number): string => {
    return `$${valor.toLocaleString("es-MX", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })}`;
  };

  const CustomTooltipWaterfall = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const chartData = payload[0].payload;
    const displayValue = chartData.isTotal
      ? chartData.start
      : chartData.name.includes("(-)")
      ? -chartData.start
      : chartData.start;

    return (
      <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
        <p className="font-semibold text-foreground mb-1">{chartData.name}</p>
        <p className={`text-sm ${displayValue >= 0 ? "text-green-600" : "text-red-600"}`}>
          {formatearValorCompleto(Math.abs(displayValue))}
        </p>
      </div>
    );
  };

  const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, name: nodeName } = props;
    if (width < 80 || height < 80) return null;

    const currentNode = props?.payload ?? null;
    const name = currentNode?.name ?? nodeName ?? "";
    const value = Number(currentNode?.value ?? 0);
    const percentage = Number(currentNode?.percentage ?? 0);
    const color = currentNode?.color ?? COLORS[0];

    const formattedValue =
      formatoVisualizacion === "miles"
        ? `${(value / 1000).toFixed(1)}K`
        : formatoVisualizacion === "millones"
        ? `${(value / 1_000_000).toFixed(2)}M`
        : value.toLocaleString("es-MX", { minimumFractionDigits: 0 });

    return (
      <g>
        <rect x={x} y={y} width={width} height={height} style={{ fill: color, stroke: "#fff", strokeWidth: 2 }} />
        <text x={x + width / 2} y={y + height / 2 - 20} textAnchor="middle" fill="#fff" fontSize={14} fontWeight="bold">
          {name}
        </text>
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" fill="#fff" fontSize={16} fontWeight="bold">
          ${formattedValue}
        </text>
        <text x={x + width / 2} y={y + height / 2 + 20} textAnchor="middle" fill="#fff" fontSize={13}>
          {percentage.toFixed(1)}%
        </text>
      </g>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const financiamientosActivos = (financiamientos || []).filter((f: any) => getEstatus(f) === "activo");

  const tarjetasCorporativas = financiamientosActivos.filter((f: any) => getTipoUi(f) === "tarjeta_corporativa");
  const creditosRevolventes = financiamientosActivos.filter((f: any) => getTipoUi(f) === "revolvente");
  const creditosSimples = financiamientosActivos.filter((f: any) => {
    const tipo = getTipoUi(f);
    return tipo !== "tarjeta_corporativa" && tipo !== "revolvente";
  });

  const deudaTarjetas = tarjetasCorporativas.reduce((sum: number, f: any) => sum + getSaldoCapital(f), 0);
  const deudaRevolvente = creditosRevolventes.reduce((sum: number, f: any) => sum + getSaldoCapital(f), 0);

  const totalOriginalSimples = creditosSimples.reduce((sum: number, f: any) => sum + getMontoOriginal(f), 0);
  const deudaSimples = creditosSimples.reduce((sum: number, f: any) => sum + getSaldoCapital(f), 0);
  const totalPagadoSimples = Math.max(0, totalOriginalSimples - deudaSimples);

  const totalDeuda = toNum(resumen?.saldo_total_actual, deudaSimples + deudaTarjetas + deudaRevolvente);
  const totalOriginal = totalOriginalSimples;
  const totalPagado = totalPagadoSimples;

  const creditosSimplesFiltrados =
    creditoSimpleSeleccionado === "todos"
      ? creditosSimples
      : creditosSimples.filter((f: any) => f.id === creditoSimpleSeleccionado);

  const totalOriginalSimplesFiltrado = creditosSimplesFiltrados.reduce((sum: number, f: any) => sum + getMontoOriginal(f), 0);
  const deudaSimplesFiltrada = creditosSimplesFiltrados.reduce((sum: number, f: any) => sum + getSaldoCapital(f), 0);
  const totalPagadoSimplesFiltrado = Math.max(0, totalOriginalSimplesFiltrado - deudaSimplesFiltrada);

  const dataComparacionSimples = [
    { name: "Monto Original", valor: totalOriginalSimplesFiltrado, color: "hsl(180, 50%, 55%)" },
    { name: "Monto Pagado", valor: totalPagadoSimplesFiltrado, color: "hsl(142, 76%, 36%)" },
    { name: "Saldo Pendiente", valor: deudaSimplesFiltrada, color: "hsl(0, 70%, 55%)" },
  ];

  const creditosRevolventesYTarjetas = [...creditosRevolventes, ...tarjetasCorporativas];
  const creditosRevolventesFiltrados =
    creditoRevolventeSeleccionado === "todos"
      ? creditosRevolventesYTarjetas
      : creditosRevolventesYTarjetas.filter((f: any) => f.id === creditoRevolventeSeleccionado);

  const lineaTotal = creditosRevolventesFiltrados.reduce((sum: number, f: any) => sum + getLineaTotal(f), 0);
  const lineaUtilizada = creditosRevolventesFiltrados.reduce((sum: number, f: any) => sum + getSaldoCapital(f), 0);
  const lineaDisponible = Math.max(0, lineaTotal - lineaUtilizada);

  interface ChartDataWaterfall {
    name: string;
    value: number;
    start: number;
    fill: string;
    isTotal: boolean;
  }

  const waterfallRevolvente: ChartDataWaterfall[] = [
    { name: "Línea Total", value: 0, start: lineaTotal, fill: "hsl(180, 50%, 55%)", isTotal: true },
    { name: "(-) Línea Utilizada", value: lineaDisponible, start: lineaUtilizada, fill: "hsl(0, 70%, 55%)", isTotal: false },
    { name: "= Línea Disponible", value: 0, start: lineaDisponible, fill: "hsl(142, 76%, 36%)", isTotal: true },
  ];

  const renderCustomLabel = (props: any) => {
    const { x, y, width, index } = props;
    const entry = waterfallRevolvente[index];
    if (!entry) return null;
    const displayValue = entry.start;

    return (
      <text
        x={x + width / 2}
        y={y - 5}
        fill="hsl(var(--foreground))"
        textAnchor="middle"
        dominantBaseline="bottom"
        fontSize={12}
        fontWeight="bold"
      >
        ${formatearValor(displayValue)}
      </text>
    );
  };

  const porTipo = financiamientosActivos.reduce((acc: Record<string, { tipo: string; saldo: number; count: number }>, f: any) => {
    const tipo = getTipoUi(f);
    const saldoReal = getSaldoTotal(f);
    if (!acc[tipo]) acc[tipo] = { tipo, saldo: 0, count: 0 };
    acc[tipo].saldo += saldoReal;
    acc[tipo].count += 1;
    return acc;
  }, {});

  const dataPorTipo = Object.values(porTipo);
  const totalDeudaPorTipo = dataPorTipo.reduce((sum, item) => sum + Number(item.saldo || 0), 0);

  const treemapData = dataPorTipo.map((item, index) => ({
    name: getTipoCreditoLabel(item.tipo),
    value: Number(item.saldo || 0),
    percentage: totalDeudaPorTipo > 0 ? (Number(item.saldo || 0) / totalDeudaPorTipo) * 100 : 0,
    color: COLORS[index % COLORS.length],
  }));

  const calcularAmortizacionesFuturas = () => {
    const hoy = new Date();
    let fechaVencimientoMaxima = new Date(hoy);

    financiamientosActivos.forEach((credito: any) => {
      const fv = getFechaVencimiento(credito);
      if (fv && fv > fechaVencimientoMaxima) fechaVencimientoMaxima = fv;
    });

    const anoInicio = hoy.getFullYear();
    const anoVencimiento = fechaVencimientoMaxima.getFullYear();
    const anosNecesarios = Math.max(1, anoVencimiento - anoInicio + 1);
    const anosMinimos = 5;

    const periodos = periodoAmortizacion === "mensual" ? 12 : Math.max(anosMinimos, anosNecesarios);

    const financiamientosFiltradosAmort =
      creditoAmortizacion === "todos"
        ? financiamientosActivos
        : financiamientosActivos.filter((f: any) => f.id === creditoAmortizacion);

    const data: any[] = [];
    const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    for (let i = 0; i < periodos; i++) {
      let nombrePeriodo: string;
      if (periodoAmortizacion === "mensual") {
        const mesActual = hoy.getMonth();
        const anoActual = hoy.getFullYear();
        const mesIndex = (mesActual + i) % 12;
        const anoOffset = Math.floor((mesActual + i) / 12);
        nombrePeriodo = `${mesesNombres[mesIndex]} ${anoActual + anoOffset}`;
      } else {
        nombrePeriodo = `${hoy.getFullYear() + i}`;
      }

      const periodo: any = { periodo: nombrePeriodo };
      financiamientosFiltradosAmort.forEach((f: any) => {
        periodo[f.nombre] = 0;
      });
      data.push(periodo);
    }

    financiamientosFiltradosAmort.forEach((credito: any) => {
      const tipo = getTipoUi(credito);
      const fechaVencimiento = getFechaVencimiento(credito);
      const saldoBase = getSaldoCapital(credito);

      if (!fechaVencimiento || saldoBase <= 0) return;

      if (tipo === "simple" || tipo === "arrendamiento") {
        const plazo = Math.max(1, toNum(credito?.plazo_meses ?? credito?.plazoMeses, 1));

        const txs = (transacciones || []).filter((t: any) => {
          return getTxFinanciamientoId(t) === credito.id && getTxTipo(t) === "amortizacion";
        });

        const pagosRealizados = txs.length;
        const mesesPendientesPorPagar = Math.max(0, plazo - pagosRealizados);
        const amortizacionMensual =
          mesesPendientesPorPagar > 0 ? saldoBase / mesesPendientesPorPagar : 0;

        if (periodoAmortizacion === "mensual") {
          const mesesAMostrar = Math.min(periodos - 1, mesesPendientesPorPagar);
          for (let i = 1; i <= mesesAMostrar; i++) {
            data[i][credito.nombre] += amortizacionMensual;
          }
        } else {
          const anoVenc = fechaVencimiento.getFullYear();
          const anoIni = hoy.getFullYear();
          const anosRestantes = Math.max(1, anoVenc - anoIni + 1);
          const anosAMostrar = Math.min(periodos, anosRestantes);

          const mesesRestantesAnoActual = 12 - hoy.getMonth();
          let mesesContados = 0;

          for (let i = 0; i < anosAMostrar; i++) {
            let mesesEnEsteAno: number;

            if (i === 0) {
              mesesEnEsteAno = Math.min(mesesRestantesAnoActual, mesesPendientesPorPagar);
            } else if (mesesContados + 12 <= mesesPendientesPorPagar) {
              mesesEnEsteAno = 12;
            } else {
              mesesEnEsteAno = Math.max(0, mesesPendientesPorPagar - mesesContados);
            }

            data[i][credito.nombre] += amortizacionMensual * mesesEnEsteAno;
            mesesContados += mesesEnEsteAno;
            if (mesesContados >= mesesPendientesPorPagar) break;
          }
        }
      } else if (tipo === "revolvente") {
        const mesesHastaVencimiento = Math.max(
          0,
          (fechaVencimiento.getFullYear() - hoy.getFullYear()) * 12 +
            (fechaVencimiento.getMonth() - hoy.getMonth())
        );

        if (periodoAmortizacion === "mensual" && mesesHastaVencimiento < periodos) {
          data[mesesHastaVencimiento][credito.nombre] += saldoBase;
        } else if (periodoAmortizacion === "anual") {
          const anosHastaVencimiento = Math.floor(mesesHastaVencimiento / 12);
          if (anosHastaVencimiento < periodos) {
            data[anosHastaVencimiento][credito.nombre] += saldoBase;
          }
        }
      } else if (tipo === "tarjeta_corporativa") {
        const fechaActual = new Date();
        const mesActual = fechaActual.getMonth();
        const anoActual = fechaActual.getFullYear();

        const pagosEnMesActual = (transacciones || []).filter((t: any) => {
          const ft = getTxFecha(t);
          return (
            getTxFinanciamientoId(t) === credito.id &&
            getTxTipo(t) === "amortizacion" &&
            ft &&
            ft.getMonth() === mesActual &&
            ft.getFullYear() === anoActual
          );
        });

        const indice = pagosEnMesActual.length > 0 ? 1 : 0;

        if (periodoAmortizacion === "mensual" && indice < periodos) {
          data[indice][credito.nombre] += saldoBase;
        } else if (periodoAmortizacion === "anual") {
          data[0][credito.nombre] += saldoBase;
        }
      }
    });

    return data;
  };

  const calcularDeudaPorAcreedor = () => {
    const deudaPorInstitucion: Record<
      string,
      { total: number; capital: number; intereses: number; logo?: string; nombre: string }
    > = {};

    financiamientosActivos
      .filter((f: any) => getSaldoTotal(f) > 0)
      .forEach((f: any) => {
        const key = getInstitucionId(f);
        const institucion = (instituciones || []).find((i: any) => String(i.id) === key);

        const capitalPendiente = getSaldoCapital(f);
        const interesesPendientes = getSaldoIntereses(f);

        if (!deudaPorInstitucion[key]) {
          deudaPorInstitucion[key] = {
            total: 0,
            capital: 0,
            intereses: 0,
            logo: institucion?.logo_url || undefined,
            nombre: institucion?.nombre || getInstitucion(f),
          };
        }

        deudaPorInstitucion[key].total += getSaldoTotal(f);
        deudaPorInstitucion[key].capital += capitalPendiente;
        deudaPorInstitucion[key].intereses += interesesPendientes;
      });

    const valorOrden =
      tipoDeudaAcreedor === "total"
        ? "total"
        : tipoDeudaAcreedor === "capital"
        ? "capital"
        : "intereses";

    const acreedoresOrdenados = Object.entries(deudaPorInstitucion)
      .map(([key, data]) => ({ id: key, ...data, saldo: (data as any)[valorOrden] as number }))
      .filter((a) => a.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo);

    const top5 = acreedoresOrdenados.slice(0, 5);
    const resto = acreedoresOrdenados.slice(5);

    if (resto.length > 0) {
      const saldoOtros = resto.reduce((sum, a) => sum + a.saldo, 0);
      top5.push({
        id: "otros",
        nombre: "Otros Acreedores",
        saldo: saldoOtros,
        total: resto.reduce((sum, a) => sum + a.total, 0),
        capital: resto.reduce((sum, a) => sum + a.capital, 0),
        intereses: resto.reduce((sum, a) => sum + a.intereses, 0),
        logo: undefined,
      });
    }

    const total = top5.reduce((sum, a) => sum + a.saldo, 0);
    return top5.map((a) => ({ ...a, porcentaje: total > 0 ? (a.saldo / total) * 100 : 0 }));
  };

  const calcularCreditosPorAcreedor = (acreedorId: string) => {
    const creditosDelAcreedor = financiamientosActivos
      .filter((f: any) => getSaldoTotal(f) > 0)
      .filter((f: any) => getInstitucionId(f) === acreedorId)
      .map((f: any) => {
        const capitalPendiente = getSaldoCapital(f);
        const interesesPendientes = getSaldoIntereses(f);

        const saldo =
          tipoDeudaAcreedor === "total"
            ? getSaldoTotal(f)
            : tipoDeudaAcreedor === "capital"
            ? capitalPendiente
            : interesesPendientes;

        return {
          id: f.id,
          nombre: f.nombre,
          tipo_credito: getTipoUi(f),
          total: getSaldoTotal(f),
          capital: capitalPendiente,
          intereses: interesesPendientes,
          saldo,
        };
      })
      .filter((c) => c.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo);

    const total = creditosDelAcreedor.reduce((sum, c) => sum + c.saldo, 0);
    return creditosDelAcreedor.map((c) => ({ ...c, porcentaje: total > 0 ? (c.saldo / total) * 100 : 0 }));
  };

  const acreedoresTop = calcularDeudaPorAcreedor();
  const creditosDetalle = acreedorSeleccionado ? calcularCreditosPorAcreedor(acreedorSeleccionado) : [];
  const nombreAcreedorSeleccionado = acreedorSeleccionado
    ? acreedoresTop.find((a) => a.id === acreedorSeleccionado)?.nombre || ""
    : "";

  const dataAmortizacionesFuturas = calcularAmortizacionesFuturas();
  const nombresCreditos =
    (creditoAmortizacion === "todos"
      ? financiamientosActivos
      : financiamientosActivos.filter((f: any) => f.id === creditoAmortizacion)
    ).map((f: any) => f.nombre);

  const dataGastosFinancieros = useMemo(() => {
    const byPeriod = new Map<
      string,
      { periodo: string; simple: number; revolvente: number; tarjeta: number; total: number }
    >();

    (transacciones || []).forEach((t: any) => {
      const tipo = getTxTipo(t);

      const isInterestMovement =
        tipo === "cargo_intereses" ||
        tipo === "cargo_interes" ||
        tipo === "pago_intereses";

      if (!isInterestMovement) return;

      const fecha = getTxFecha(t);
      if (!fecha) return;

      const periodo =
        periodoGastosFinancieros === "mensual"
          ? yyyyMm(fecha)
          : String(fecha.getFullYear());

      if (!byPeriod.has(periodo)) {
        byPeriod.set(periodo, {
          periodo,
          simple: 0,
          revolvente: 0,
          tarjeta: 0,
          total: 0,
        });
      }

      const row = byPeriod.get(periodo)!;
      const financingId = getTxFinanciamientoId(t);
      const fin = financiamientos.find((f: any) => String(f.id) === financingId);
      const tipoFin = fin ? getTipoUi(fin) : "otro";
      const monto = getTxMontoIntereses(t) || getTxMonto(t);

      if (tipoFin === "tarjeta_corporativa") row.tarjeta += monto;
      else if (tipoFin === "revolvente") row.revolvente += monto;
      else row.simple += monto;

      row.total += monto;
    });

    const list = Array.from(byPeriod.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));

    return list.map((d) => {
      if (periodoGastosFinancieros === "mensual") {
        const [y, m] = d.periodo.split("-");
        const nombresMeses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
        return {
          ...d,
          periodoFormateado: `${nombresMeses[Math.max(0, Number(m) - 1)]} ${y}`,
        };
      }

      return { ...d, periodoFormateado: d.periodo };
    });
  }, [transacciones, financiamientos, periodoGastosFinancieros]);

  const limiteYAxis = useMemo(() => {
    if (!dataAmortizacionesFuturas.length) return 0;
    const valorMax = Math.max(
      ...dataAmortizacionesFuturas.map((p: any) =>
        nombresCreditos.reduce((sum: number, nombre: string) => sum + Number(p[nombre] || 0), 0)
      ),
      0
    );
    return valorMax * 1.2;
  }, [dataAmortizacionesFuturas, nombresCreditos]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Créditos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{financiamientosActivos.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Deuda Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalDeuda.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalPagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">% Pagado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalOriginal > 0 ? ((totalPagado / totalOriginal) * 100).toFixed(1) : 0}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Estado Vencimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                {(() => {
                  const hoy = new Date();
                  hoy.setHours(0, 0, 0, 0);

                  const creditosVencidos = financiamientosActivos.filter((f: any) => {
                    const fv = getFechaVencimiento(f);
                    if (!fv) return false;
                    fv.setHours(0, 0, 0, 0);
                    return fv < hoy && getSaldoTotal(f) > 0;
                  });

                  if (!creditosVencidos.length) {
                    return (
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-green-600">✓</div>
                        <div className="text-sm text-green-600">Al día</div>
                      </div>
                    );
                  }

                  const montoAtrasado = creditosVencidos.reduce((sum: number, f: any) => sum + getSaldoTotal(f), 0);
                  const diasAtraso = Math.max(
                    ...creditosVencidos.map((f: any) => {
                      const fv = getFechaVencimiento(f)!;
                      fv.setHours(0, 0, 0, 0);
                      return Math.floor((hoy.getTime() - fv.getTime()) / (1000 * 60 * 60 * 24));
                    })
                  );

                  return (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-red-600">⚠</div>
                        <div className="text-sm text-red-600 font-semibold">Atrasado</div>
                      </div>
                      <div className="text-lg font-bold text-red-600">{diasAtraso} días</div>
                      <div className="text-xs text-muted-foreground">
                        ${montoAtrasado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2 border-l pl-4">
                <div className="text-xs font-medium text-muted-foreground mb-2">Configuración Visual</div>

                <div className="space-y-1">
                  <Label htmlFor="formato-global" className="text-xs text-muted-foreground">
                    Formato:
                  </Label>
                  <Select value={formatoVisualizacion} onValueChange={(v) => setFormatoVisualizacion(v as FormatoVisualizacion)}>
                    <SelectTrigger id="formato-global" className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="miles">Miles (K)</SelectItem>
                      <SelectItem value="millones">Millones (M)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="decimales-global" className="text-xs text-muted-foreground">
                    Decimales:
                  </Label>
                  <Select value={String(decimales)} onValueChange={(v) => setDecimales(Number(v))}>
                    <SelectTrigger id="decimales-global" className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 decimales</SelectItem>
                      <SelectItem value="1">1 decimal</SelectItem>
                      <SelectItem value="2">2 decimales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Deuda por Tipo de Crédito</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <Treemap data={treemapData} dataKey="value" stroke="#fff" content={<CustomTreemapContent />} />
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Resumen Deuda</CardTitle>
                {acreedorSeleccionado && (
                  <>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-sm text-muted-foreground">{nombreAcreedorSeleccionado}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {acreedorSeleccionado && (
                  <Button variant="outline" size="sm" onClick={() => setAcreedorSeleccionado(null)} className="h-8">
                    ← Volver
                  </Button>
                )}

                <Label className="text-xs text-muted-foreground">Mostrar:</Label>
                <Select value={tipoDeudaAcreedor} onValueChange={(v) => setTipoDeudaAcreedor(v as TipoDeudaAcreedor)}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Deuda Total</SelectItem>
                    <SelectItem value="capital">Solo Capital</SelectItem>
                    <SelectItem value="intereses">Solo Intereses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {!acreedorSeleccionado ? (
                <>
                  {acreedoresTop.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No hay deuda pendiente con acreedores</p>
                  ) : (
                    acreedoresTop.map((a) => (
                      <div
                        key={a.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
                          a.id !== "otros" ? "cursor-pointer" : ""
                        }`}
                        onClick={() => {
                          if (a.id !== "otros") setAcreedorSeleccionado(a.id);
                        }}
                      >
                        <div className="flex-shrink-0">
                          {a.logo ? (
                            <img src={a.logo} alt={a.nombre} className="w-12 h-12 object-contain rounded-md bg-white p-1 border" />
                          ) : (
                            <div className="w-12 h-12 rounded-md bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg border">
                              {a.nombre.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{a.nombre}</p>
                          <p className="text-xs text-muted-foreground">{a.porcentaje.toFixed(1)}% del total</p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">${formatearValor(a.saldo)}</p>
                          <p className="text-xs text-muted-foreground">adeudado</p>
                        </div>
                      </div>
                    ))
                  )}
                </>
              ) : (
                <>
                  {creditosDetalle.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No hay créditos activos para este acreedor</p>
                  ) : (
                    creditosDetalle.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg border">
                            {c.tipo_credito === "simple"
                              ? "💳"
                              : c.tipo_credito === "revolvente"
                              ? "🔄"
                              : c.tipo_credito === "tarjeta_corporativa"
                              ? "💰"
                              : "📋"}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{c.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {getTipoCreditoLabel(c.tipo_credito)} • {c.porcentaje.toFixed(1)}% del total
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">${formatearValor(c.saldo)}</p>
                          <p className="text-xs text-muted-foreground">adeudado</p>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {((acreedoresTop.length > 0 && !acreedorSeleccionado) || (creditosDetalle.length > 0 && acreedorSeleccionado)) && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    Total {tipoDeudaAcreedor === "total" ? "Deuda" : tipoDeudaAcreedor === "capital" ? "Capital" : "Intereses"}:
                  </span>
                  <span className="text-lg font-bold text-red-600">
                    $
                    {formatearValor(
                      acreedorSeleccionado
                        ? creditosDetalle.reduce((sum, c) => sum + c.saldo, 0)
                        : acreedoresTop.reduce((sum, a) => sum + a.saldo, 0)
                    )}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Comportamiento Crédito Simple</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="filtro-credito-simple" className="text-xs">
                  Crédito:
                </Label>
                <Select value={creditoSimpleSeleccionado} onValueChange={setCreditoSimpleSeleccionado}>
                  <SelectTrigger id="filtro-credito-simple" className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {creditosSimples.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nombre} {getSaldoCapital(f) === 0 ? "(Saldo: $0)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CardDescription>Monto original vs. pagado</CardDescription>
          </CardHeader>

          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dataComparacionSimples} layout="vertical" margin={{ top: 5, right: 15, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `$${formatearValor(v)}`} />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip formatter={(v: number) => formatearValorCompleto(v)} contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="valor" radius={[0, 8, 8, 0]}>
                  {dataComparacionSimples.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="valor"
                    position="right"
                    formatter={(v: number) => `$${formatearValor(v)}`}
                    style={{ fill: "hsl(var(--foreground))", fontSize: "12px", fontWeight: "bold" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Comportamiento Revolvente/Tarjetas</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="filtro-credito-revolvente" className="text-xs">
                  Crédito:
                </Label>
                <Select value={creditoRevolventeSeleccionado} onValueChange={setCreditoRevolventeSeleccionado}>
                  <SelectTrigger id="filtro-credito-revolvente" className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {creditosRevolventesYTarjetas.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nombre} {getSaldoCapital(f) === 0 ? "(Sin disposiciones)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CardDescription>Capacidad y utilización de líneas de crédito</CardDescription>
          </CardHeader>

          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={waterfallRevolvente} margin={{ top: 20, right: 30, left: 60, bottom: 20 }} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--foreground))" }} />
                <YAxis
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]}
                  tickFormatter={(v) => `$${formatearValor(v)}`}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip content={<CustomTooltipWaterfall />} />

                <Bar dataKey="value" stackId="a" fill="transparent" fillOpacity={0} stroke="transparent" strokeOpacity={0} isAnimationActive={false} />
                <Bar dataKey="start" stackId="a" radius={[8, 8, 0, 0]} label={renderCustomLabel}>
                  {waterfallRevolvente.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>

                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Amortizaciones Futuras por Crédito</CardTitle>
              <CardDescription>Proyección de pagos pendientes hasta el vencimiento de todos los créditos</CardDescription>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="credito-amortizacion">Crédito:</Label>
                <Select value={creditoAmortizacion} onValueChange={setCreditoAmortizacion}>
                  <SelectTrigger id="credito-amortizacion" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {financiamientosActivos.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nombre} {getSaldoCapital(f) === 0 ? "(Sin disposiciones)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="periodo-amortizacion">Periodo:</Label>
                <Select value={periodoAmortizacion} onValueChange={(v) => setPeriodoAmortizacion(v as PeriodoAmortizacion)}>
                  <SelectTrigger id="periodo-amortizacion" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={dataAmortizacionesFuturas}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis domain={[0, limiteYAxis]} allowDataOverflow={false} />
              <Tooltip formatter={(v: number) => formatearValorCompleto(v)} />
              <Legend />

              {nombresCreditos.map((nombre: string, index: number) => {
                const esUltimaBarra = index === nombresCreditos.length - 1;
                return (
                  <Bar key={nombre} dataKey={nombre} stackId="a" fill={COLORS[index % COLORS.length]}>
                    <LabelList
                      dataKey={nombre}
                      position="center"
                      fill="#fff"
                      fontSize={11}
                      fontWeight="bold"
                      formatter={(v: number) => (v === 0 ? "" : `$${formatearValor(v)}`)}
                    />
                    {esUltimaBarra && (
                      <LabelList
                        content={(props: any) => {
                          const { x, y, width, index: dataIndex } = props;
                          if (dataIndex === undefined) return null;

                          const periodo = dataAmortizacionesFuturas[dataIndex];
                          const total = nombresCreditos.reduce((sum, n) => sum + Number(periodo[n] || 0), 0);
                          if (total === 0) return null;

                          return (
                            <text x={x + width / 2} y={y - 5} fill="#000" textAnchor="middle" fontSize={12} fontWeight="bold">
                              {`$${formatearValor(total)}`}
                            </text>
                          );
                        }}
                      />
                    )}
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Evolución de Gastos Financieros</CardTitle>
              <CardDescription>Intereses registrados en movimientos de financiamientos</CardDescription>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="tipo-gasto">Tipo:</Label>
                <Select value={tipoGastoFinanciero} onValueChange={(v) => setTipoGastoFinanciero(v as TipoGastoFinanciero)}>
                  <SelectTrigger id="tipo-gasto" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total</SelectItem>
                    <SelectItem value="simple">Créditos Simples</SelectItem>
                    <SelectItem value="revolvente">Líneas Revolventes</SelectItem>
                    <SelectItem value="tarjeta">Tarjetas Corporativas</SelectItem>
                    <SelectItem value="combinada">Combinada (Todas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="periodo-gastos">Periodo:</Label>
                <Select value={periodoGastosFinancieros} onValueChange={(v) => setPeriodoGastosFinancieros(v as PeriodoAmortizacion)}>
                  <SelectTrigger id="periodo-gastos" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {dataGastosFinancieros.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No hay gastos financieros registrados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={dataGastosFinancieros}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodoFormateado" angle={-45} textAnchor="end" height={80} />
                <YAxis
                  domain={[
                    0,
                    (() => {
                      if (!dataGastosFinancieros.length) return 100;
                      let maxValor = 0;

                      if (tipoGastoFinanciero === "total") maxValor = Math.max(...dataGastosFinancieros.map((d: any) => Number(d.total || 0)));
                      else if (tipoGastoFinanciero === "simple") maxValor = Math.max(...dataGastosFinancieros.map((d: any) => Number(d.simple || 0)));
                      else if (tipoGastoFinanciero === "revolvente") maxValor = Math.max(...dataGastosFinancieros.map((d: any) => Number(d.revolvente || 0)));
                      else if (tipoGastoFinanciero === "tarjeta") maxValor = Math.max(...dataGastosFinancieros.map((d: any) => Number(d.tarjeta || 0)));
                      else maxValor = Math.max(...dataGastosFinancieros.map((d: any) => Math.max(Number(d.simple || 0), Number(d.revolvente || 0), Number(d.tarjeta || 0))));

                      return Math.ceil(maxValor * 1.2);
                    })(),
                  ]}
                  allowDataOverflow={false}
                  tickFormatter={(v) => `$${formatearValor(v)}`}
                />
                <Tooltip formatter={(v: number) => formatearValorCompleto(v)} />
                <Legend />

                {tipoGastoFinanciero === "total" && (
                  <Line type="monotone" dataKey="total" stroke="hsl(180, 50%, 55%)" strokeWidth={3} name="Total Intereses" dot={{ r: 4 }} activeDot={{ r: 6 }}>
                    <LabelList dataKey="total" position="top" fill="#000" fontSize={11} fontWeight="bold" formatter={(v: number) => (v === 0 ? "" : `$${formatearValor(v)}`)} />
                  </Line>
                )}

                {tipoGastoFinanciero === "simple" && (
                  <Line type="monotone" dataKey="simple" stroke="hsl(180, 50%, 55%)" strokeWidth={3} name="Créditos Simples" dot={{ r: 4 }} activeDot={{ r: 6 }}>
                    <LabelList dataKey="simple" position="top" fill="#000" fontSize={11} fontWeight="bold" formatter={(v: number) => (v === 0 ? "" : `$${formatearValor(v)}`)} />
                  </Line>
                )}

                {tipoGastoFinanciero === "revolvente" && (
                  <Line type="monotone" dataKey="revolvente" stroke="hsl(180, 45%, 45%)" strokeWidth={3} name="Líneas Revolventes" dot={{ r: 4 }} activeDot={{ r: 6 }}>
                    <LabelList dataKey="revolvente" position="top" fill="#000" fontSize={11} fontWeight="bold" formatter={(v: number) => (v === 0 ? "" : `$${formatearValor(v)}`)} />
                  </Line>
                )}

                {tipoGastoFinanciero === "tarjeta" && (
                  <Line type="monotone" dataKey="tarjeta" stroke="hsl(180, 55%, 65%)" strokeWidth={3} name="Tarjetas Corporativas" dot={{ r: 4 }} activeDot={{ r: 6 }}>
                    <LabelList dataKey="tarjeta" position="top" fill="#000" fontSize={11} fontWeight="bold" formatter={(v: number) => (v === 0 ? "" : `$${formatearValor(v)}`)} />
                  </Line>
                )}

                {tipoGastoFinanciero === "combinada" && (
                  <>
                    <Line type="monotone" dataKey="simple" stroke="hsl(180, 50%, 55%)" strokeWidth={2} name="Créditos Simples" dot={{ r: 3 }} activeDot={{ r: 5 }}>
                      <LabelList dataKey="simple" position="top" fill="#000" fontSize={10} fontWeight="bold" formatter={(v: number) => (v === 0 ? "" : `$${formatearValor(v)}`)} />
                    </Line>
                    <Line type="monotone" dataKey="revolvente" stroke="hsl(180, 45%, 45%)" strokeWidth={2} name="Líneas Revolventes" dot={{ r: 3 }} activeDot={{ r: 5 }}>
                      <LabelList dataKey="revolvente" position="top" fill="#000" fontSize={10} fontWeight="bold" formatter={(v: number) => (v === 0 ? "" : `$${formatearValor(v)}`)} />
                    </Line>
                    <Line type="monotone" dataKey="tarjeta" stroke="hsl(180, 55%, 65%)" strokeWidth={2} name="Tarjetas Corporativas" dot={{ r: 3 }} activeDot={{ r: 5 }}>
                      <LabelList dataKey="tarjeta" position="top" fill="#000" fontSize={10} fontWeight="bold" formatter={(v: number) => (v === 0 ? "" : `$${formatearValor(v)}`)} />
                    </Line>
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticaFinanciamientos;