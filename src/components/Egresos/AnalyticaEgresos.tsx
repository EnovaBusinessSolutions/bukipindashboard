// bukipin-dashboard/src/components/Egresos/AnalyticaEgresos.tsx
import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Treemap,
} from "recharts";
import { AlertCircle, CalendarIcon, Package } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { useTransaccionesEgresos } from "@/hooks/useTransaccionesEgresos";
import { useCostosVentaInventario } from "@/hooks/useCostosVentaInventario";
import { useResumenEgresosPorPeriodo } from "@/hooks/useResumenEgresosPorPeriodo";
import { useEgresosPorPeriodo, DatosEvolucionSimple } from "@/hooks/useEgresosPorPeriodo";
import { useSubcuentas } from "@/hooks/useSubcuentas";
import { useCuentas } from "@/hooks/useCuentas";
import { useProductosEgresos } from "@/hooks/useProductosEgresos";

/**
 * Helpers (E2E): normalización para tolerar backends con shape:
 * - Array directo
 * - { data: [...] }
 * - { ok: true, data: [...] }
 */
const toNum = (v: any) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const normalizeArray = <T,>(raw: any): T[] => {
  const candidate = Array.isArray(raw) ? raw : raw?.data ?? raw?.items ?? raw?.results ?? [];
  return Array.isArray(candidate) ? candidate : [];
};

const moneyMXN = (n: number, decimales: number) =>
  `$${toNum(n).toLocaleString("es-MX", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`;

// Componente personalizado para el contenido del Treemap (robusto)
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, value, fill, dataTotal, decimales = 2 } = props;

  const v = toNum(value);
  const total = toNum(dataTotal);

  if (!name || total <= 0) return null;

  const porcentaje = ((v / total) * 100).toFixed(1);
  const montoFormateado = moneyMXN(v, decimales);

  const titleFontSize = Math.min(width / 8, height / 4, 20);
  const subtitleFontSize = Math.min(width / 10, height / 6, 16);

  // No mostrar texto si el bloque es muy pequeño
  if (titleFontSize < 12) {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} />
      </g>
    );
  }

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} />

      <text
        x={x + width / 2}
        y={y + height / 2 - titleFontSize / 2}
        textAnchor="middle"
        fill="#ffffff"
        fontSize={titleFontSize}
        fontWeight="bold"
      >
        {name} ({porcentaje}%)
      </text>

      <text
        x={x + width / 2}
        y={y + height / 2 + titleFontSize}
        textAnchor="middle"
        fill="#ffffff"
        fontSize={subtitleFontSize}
        fontWeight="normal"
        opacity="0.9"
      >
        {montoFormateado}
      </text>
    </g>
  );
};

const AnalyticaEgresos = () => {
  const [periodFilter, setPeriodFilter] = useState<"diario" | "mensual" | "anual">("mensual");
  const [formatoMontos, setFormatoMontos] = useState<"normal" | "miles" | "millones">("normal");
  const [decimales, setDecimales] = useState<0 | 1 | 2>(2);
  const [tipoEgreso, setTipoEgreso] = useState<
    "total" | "costo" | "gasto" | "costo_inventario" | "otros_gastos" | "combinada"
  >("total");
  const [vistaTotal, setVistaTotal] = useState<"unica" | "desglosada">("unica");
  const [fechaAnalisisDiario, setFechaAnalisisDiario] = useState<Date>(new Date());
  const [fechaAnalisisMensual, setFechaAnalisisMensual] = useState<Date>(new Date());
  const [vistaAgrupacion, setVistaAgrupacion] = useState<"cuenta" | "subcuenta">("subcuenta");

  // Queries (cast a any para evitar "never" si los hooks no están tipados)
  const transQuery = useTransaccionesEgresos(1000, periodFilter, fechaAnalisisDiario, fechaAnalisisMensual) as any;
  const costosInvQuery = useCostosVentaInventario(periodFilter, fechaAnalisisDiario, fechaAnalisisMensual) as any;
  const resumenQuery = useResumenEgresosPorPeriodo() as any;
  const graficaQuery = useEgresosPorPeriodo(periodFilter, tipoEgreso, fechaAnalisisDiario, fechaAnalisisMensual) as any;

  const subcuentasQuery = useSubcuentas() as any;
  const productosQuery = useProductosEgresos() as any;
  const cuentasQuery = useCuentas() as any;

  // Normalización E2E del shape
  const transacciones = useMemo(() => normalizeArray<any>(transQuery?.data), [transQuery?.data]);
  const costosVentaInventario = useMemo(() => normalizeArray<any>(costosInvQuery?.data), [costosInvQuery?.data]);
  const resumenes = resumenQuery?.data?.data ?? resumenQuery?.data ?? null;

  const subcuentas = useMemo(() => normalizeArray<any>(subcuentasQuery?.data), [subcuentasQuery?.data]);
  const productosEgresos = useMemo(() => normalizeArray<any>(productosQuery?.data), [productosQuery?.data]);
  const cuentasData = cuentasQuery?.data?.data ?? cuentasQuery?.data ?? null;

  const cuentasFlat = useMemo(() => {
    const arr = cuentasData?.cuentasFlat ?? cuentasData?.data?.cuentasFlat ?? [];
    return Array.isArray(arr) ? arr : [];
  }, [cuentasData]);

  const datosGraficaRaw = graficaQuery?.data?.data ?? graficaQuery?.data ?? null;

  const loading =
    !!transQuery?.isLoading || !!costosInvQuery?.isLoading || !!resumenQuery?.isLoading || !!graficaQuery?.isLoading;

  // Formato de montos (escala + decimales)
  const getSufijoFormato = () => {
    if (formatoMontos === "miles") return " (Miles)";
    if (formatoMontos === "millones") return " (Millones)";
    return "";
  };

  const formatearMonto = (monto: number) => {
    let valor = toNum(monto);
    if (formatoMontos === "miles") valor = valor / 1000;
    if (formatoMontos === "millones") valor = valor / 1_000_000;
    // Importante: redondeo consistente
    return Number(valor.toFixed(decimales));
  };

  const formatearParaVisualizacion = (monto: number, incluirSufijo = false) => {
    const sufijo = incluirSufijo ? getSufijoFormato() : "";
    return `${moneyMXN(toNum(monto), decimales)}${sufijo}`;
  };

  const calcularPorcentaje = (monto: number, total: number): string => {
    const t = toNum(total);
    if (t === 0) return "0.0";
    return ((toNum(monto) / t) * 100).toFixed(1);
  };

  // JOIN manual: imagenes por nombre
  const mapaImagenesProductos = useMemo(() => {
    const mapa = new Map<string, string>();
    (productosEgresos || []).forEach((p: any) => {
      const nombre = String(p?.nombre ?? "").toLowerCase().trim();
      if (nombre && p?.imagen_url) {
        mapa.set(nombre, p.imagen_url);
      }
    });
    return mapa;
  }, [productosEgresos]);

  /**
   * Filtrar transacciones operativas:
   * - Costos de venta: 5001, 5003, 5004
   * - Costo inventario: 5002
   * - Gastos: 51XX (excepto 5109, 5110 si aplica)
   * - Otros gastos: 5204
   */
  const filteredTransactions = useMemo(
    () =>
      (transacciones || []).filter((t: any) => {
        const cc = String(t?.cuenta_codigo ?? "");
        if (!cc) return false;

        if (cc === "5001" || cc === "5003" || cc === "5004") return true;
        if (cc === "5002") return true;

        if (cc.startsWith("51") && cc !== "5109" && cc !== "5110") return true;

        if (cc === "5204") return true;

        return false;
      }),
    [transacciones]
  );

  // Filtrar transacciones excluyendo ISR/impuestos (6001) y/o tipo impuesto si existe
  const filteredTransactionsSinImpuestos = useMemo(
    () =>
      (transacciones || []).filter((t: any) => {
        const cc = String(t?.cuenta_codigo ?? "");
        const tipo = String(t?.tipo_egreso ?? "");
        return cc !== "6001" && tipo !== "impuesto";
      }),
    [transacciones]
  );

  /**
   * IMPORTANTÍSIMO E2E:
   * NO depender de t.tipo_egreso para clasificar "costo" si el backend no lo llena.
   * Clasificamos por cuenta_codigo (consistente con el resto del archivo).
   */
  const transaccionesPorTipo = useMemo(() => {
    const costoVenta = filteredTransactions.filter((t: any) => {
      const cc = String(t?.cuenta_codigo ?? "");
      return cc === "5001" || cc === "5003" || cc === "5004";
    });

    const gastos51XX = filteredTransactions.filter((t: any) => {
      const cc = String(t?.cuenta_codigo ?? "");
      return cc.startsWith("51") && cc !== "5109" && cc !== "5110";
    });

    const otrosGastos5204 = filteredTransactions.filter((t: any) => String(t?.cuenta_codigo ?? "") === "5204");

    const costoVentaSinImp = filteredTransactionsSinImpuestos.filter((t: any) => {
      const cc = String(t?.cuenta_codigo ?? "");
      return cc === "5001" || cc === "5003" || cc === "5004";
    });

    const gastos51XXSinImp = filteredTransactionsSinImpuestos.filter((t: any) => {
      const cc = String(t?.cuenta_codigo ?? "");
      return cc.startsWith("51") && cc !== "5109" && cc !== "5110";
    });

    const otrosGastos5204SinImp = filteredTransactionsSinImpuestos.filter(
      (t: any) => String(t?.cuenta_codigo ?? "") === "5204"
    );

    // Devolver por selección
    if (tipoEgreso === "costo_inventario") {
      return {
        costoVenta: [],
        gastos: [],
        otrosGastos: [],
        costosInventario: costosVentaInventario,
        sinImpuestosCostoVenta: [],
        sinImpuestosGastos: [],
        sinImpuestosOtrosGastos: [],
      };
    }

    if (tipoEgreso === "gasto") {
      return {
        costoVenta: [],
        gastos: gastos51XX,
        otrosGastos: [],
        costosInventario: [],
        sinImpuestosCostoVenta: [],
        sinImpuestosGastos: gastos51XXSinImp,
        sinImpuestosOtrosGastos: [],
      };
    }

    if (tipoEgreso === "otros_gastos") {
      return {
        costoVenta: [],
        gastos: [],
        otrosGastos: otrosGastos5204,
        costosInventario: [],
        sinImpuestosCostoVenta: [],
        sinImpuestosGastos: [],
        sinImpuestosOtrosGastos: otrosGastos5204SinImp,
      };
    }

    if (tipoEgreso === "costo") {
      // COSTO = costoVenta (5001/5003/5004) (no depender de tipo_egreso)
      return {
        costoVenta,
        gastos: [],
        otrosGastos: [],
        costosInventario: [],
        sinImpuestosCostoVenta: costoVentaSinImp,
        sinImpuestosGastos: [],
        sinImpuestosOtrosGastos: [],
      };
    }

    // "total" o "combinada"
    return {
      costoVenta,
      gastos: gastos51XX,
      otrosGastos: otrosGastos5204,
      costosInventario: costosVentaInventario,
      sinImpuestosCostoVenta: costoVentaSinImp,
      sinImpuestosGastos: gastos51XXSinImp,
      sinImpuestosOtrosGastos: otrosGastos5204SinImp,
    };
  }, [filteredTransactions, filteredTransactionsSinImpuestos, costosVentaInventario, tipoEgreso]);

  // Datos para gráfica (formateados)
  const datosGraficaFormateados = useMemo(() => {
    if (!datosGraficaRaw) return [];

    // "total" o "combinada": formato combinado esperado
    if (tipoEgreso === "total" || tipoEgreso === "combinada") {
      const arr = normalizeArray<any>(datosGraficaRaw);
      return arr.map((item: any) => ({
        periodo: item?.periodo,
        monto: formatearMonto(toNum(item?.monto)), // vista única
        costos: formatearMonto(toNum(item?.costos)),
        gastos: formatearMonto(toNum(item?.gastos)),
        costosInventario: formatearMonto(toNum(item?.costosInventario)),
        otrosGastos: formatearMonto(toNum(item?.otrosGastos)),
      }));
    }

    const arr = normalizeArray<DatosEvolucionSimple>(datosGraficaRaw);
    return arr.map((item: any) => ({
      periodo: item?.periodo,
      monto: formatearMonto(toNum(item?.monto)),
    }));
  }, [datosGraficaRaw, tipoEgreso, formatoMontos, decimales]);

  // Egresos por Tipo
  const datosEgresosPorTipo = useMemo(() => {
    const data: { tipo: string; monto: number }[] = [];

    const totalCostoVenta = transaccionesPorTipo.costoVenta.reduce((sum: number, t: any) => sum + toNum(t?.monto_total), 0);
    if (totalCostoVenta > 0) data.push({ tipo: "Costo de Venta", monto: formatearMonto(totalCostoVenta) });

    const totalCostosInventario = transaccionesPorTipo.costosInventario.reduce((sum: number, c: any) => sum + toNum(c?.monto), 0);
    if (totalCostosInventario > 0) data.push({ tipo: "Costo Venta Inventario", monto: formatearMonto(totalCostosInventario) });

    const totalGastos = transaccionesPorTipo.gastos.reduce((sum: number, t: any) => sum + toNum(t?.monto_total), 0);
    if (totalGastos > 0) data.push({ tipo: "Gastos", monto: formatearMonto(totalGastos) });

    const totalOtrosGastos = transaccionesPorTipo.otrosGastos.reduce((sum: number, t: any) => sum + toNum(t?.monto_total), 0);
    if (totalOtrosGastos > 0) data.push({ tipo: "Otros Gastos", monto: formatearMonto(totalOtrosGastos) });

    return data;
  }, [transaccionesPorTipo, formatoMontos, decimales]);

  // Métodos de pago utilizados (sin impuestos) + inventario como adquisición
  const datosEstadoPagos = useMemo(() => {
    const grouped: Record<string, number> = {};

    const todasTransacciones = [
      ...transaccionesPorTipo.sinImpuestosCostoVenta,
      ...transaccionesPorTipo.sinImpuestosGastos,
      ...transaccionesPorTipo.sinImpuestosOtrosGastos,
    ];

    todasTransacciones
      .filter((t: any) => toNum(t?.monto_pagado) > 0)
      .forEach((t: any) => {
        const metodo = String(t?.metodo_pago ?? "Sin método especificado");
        const metodoCap = metodo.charAt(0).toUpperCase() + metodo.slice(1);

        grouped[metodoCap] = (grouped[metodoCap] ?? 0) + toNum(t?.monto_pagado);
      });

    const totalCostosInventario = transaccionesPorTipo.costosInventario.reduce((sum: number, c: any) => sum + toNum(c?.monto), 0);
    if (totalCostosInventario > 0) grouped["Adquisición de Inventario"] = (grouped["Adquisición de Inventario"] ?? 0) + totalCostosInventario;

    return Object.entries(grouped)
      .map(([estado, monto]) => ({ estado, monto: formatearMonto(monto) }))
      .sort((a, b) => b.monto - a.monto);
  }, [transaccionesPorTipo, formatoMontos, decimales]);

  // Egresos por Subcuenta (Top 10)
  const datosEgresosPorSubcuenta = useMemo(() => {
    const grouped: Record<string, number> = {};

    const resolveSubName = (prefix: string, subId: any) => {
      if (!subId) return `${prefix} - Sin subcuenta`;
      const s = subcuentas?.find((x: any) => x?.id === subId);
      return s?.nombre ? `${prefix} - ${s.nombre}` : `${prefix} - Sin subcuenta`;
    };

    transaccionesPorTipo.costoVenta.forEach((t: any) => {
      const k = resolveSubName("Costo Venta", t?.subcuenta_id);
      grouped[k] = (grouped[k] ?? 0) + toNum(t?.monto_total);
    });

    transaccionesPorTipo.gastos.forEach((t: any) => {
      const k = resolveSubName("Gastos", t?.subcuenta_id);
      grouped[k] = (grouped[k] ?? 0) + toNum(t?.monto_total);
    });

    transaccionesPorTipo.otrosGastos.forEach((t: any) => {
      const k = resolveSubName("Otros Gastos", t?.subcuenta_id);
      grouped[k] = (grouped[k] ?? 0) + toNum(t?.monto_total);
    });

    const totalCostosInventario = transaccionesPorTipo.costosInventario.reduce((sum: number, c: any) => sum + toNum(c?.monto), 0);
    if (totalCostosInventario > 0) grouped["Costo Venta Inventario"] = (grouped["Costo Venta Inventario"] ?? 0) + totalCostosInventario;

    return Object.entries(grouped)
      .map(([subcuenta, monto]) => ({ subcuenta, monto: formatearMonto(monto) }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 10);
  }, [transaccionesPorTipo, subcuentas, formatoMontos, decimales]);

  // Egresos por Cuenta (Top 15)
  const datosEgresosPorCuenta = useMemo(() => {
    const grouped: Record<string, { codigo: string; nombre: string; monto: number }> = {};

    const agregarACuenta = (codigoCuenta: string, monto: number) => {
      const code = String(codigoCuenta ?? "");
      if (!code) return;

      if (!grouped[code]) {
        const cuenta = cuentasFlat.find((c: any) => String(c?.codigo ?? "") === code);
        grouped[code] = {
          codigo: code,
          nombre: cuenta ? `${cuenta.codigo} - ${cuenta.nombre}` : code,
          monto: 0,
        };
      }
      grouped[code].monto += toNum(monto);
    };

    transaccionesPorTipo.costoVenta.forEach((t: any) => agregarACuenta(t?.cuenta_codigo, t?.monto_total));
    transaccionesPorTipo.gastos.forEach((t: any) => agregarACuenta(t?.cuenta_codigo, t?.monto_total));
    transaccionesPorTipo.otrosGastos.forEach((t: any) => agregarACuenta(t?.cuenta_codigo, t?.monto_total));

    // inventario = 5002
    transaccionesPorTipo.costosInventario.forEach((c: any) => agregarACuenta("5002", c?.monto));

    return Object.values(grouped)
      .map((item) => ({ subcuenta: item.nombre, monto: formatearMonto(item.monto) }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 15);
  }, [transaccionesPorTipo, cuentasFlat, formatoMontos, decimales]);

  // Egresos por Método de Pago (Treemap)
  const datosEgresosPorMetodoPago = useMemo(() => {
    const todasTransacciones = [
      ...transaccionesPorTipo.sinImpuestosCostoVenta,
      ...transaccionesPorTipo.sinImpuestosGastos,
      ...transaccionesPorTipo.sinImpuestosOtrosGastos,
    ];

    const efectivo = todasTransacciones
      .filter((t: any) => String(t?.metodo_pago ?? "") === "efectivo" && toNum(t?.monto_pagado) > 0)
      .reduce((sum: number, t: any) => sum + toNum(t?.monto_pagado), 0);

    const bancosTarjeta = todasTransacciones
      .filter((t: any) => {
        const mp = String(t?.metodo_pago ?? "");
        return mp && mp !== "efectivo" && toNum(t?.monto_pagado) > 0;
      })
      .reduce((sum: number, t: any) => sum + toNum(t?.monto_pagado), 0);

    const costosInventario = transaccionesPorTipo.costosInventario.reduce((sum: number, c: any) => sum + toNum(c?.monto), 0);

    const data = [
      { name: "Efectivo", value: formatearMonto(efectivo), fill: "hsl(180, 50%, 55%)" },
      { name: "Bancos/Tarjeta", value: formatearMonto(bancosTarjeta), fill: "hsl(200, 50%, 55%)" },
    ];

    if (costosInventario > 0) {
      data.push({ name: "Adquisición de Inventario", value: formatearMonto(costosInventario), fill: "hsl(220, 45%, 50%)" });
    }

    return data.filter((item) => toNum(item.value) > 0);
  }, [transaccionesPorTipo, formatoMontos, decimales]);

  // Egresos por Producto (Top 10)
  const datosEgresosPorProducto = useMemo(() => {
    const grouped: Record<
      string,
      {
        nombre: string;
        imagen: string | null;
        monto: number;
        transacciones: number;
        tieneAsignacion: boolean;
        categoria: string;
      }
    > = {};

    // Costos de Venta (5001/5003/5004) -> usar descripcion como “producto”
    transaccionesPorTipo.costoVenta.forEach((t: any) => {
      const desc = String(t?.descripcion ?? "Sin descripción");
      const key = `CV-${desc}`;
      if (!grouped[key]) {
        const joinKey = desc.toLowerCase().trim();
        grouped[key] = {
          nombre: desc,
          imagen: mapaImagenesProductos.get(joinKey) || t?.imagen_comprobante || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: true,
          categoria: "Costo Venta",
        };
      }
      grouped[key].monto += toNum(t?.monto_total);
      grouped[key].transacciones += 1;
    });

    // Gastos (51XX)
    transaccionesPorTipo.gastos.forEach((t: any) => {
      const desc = String(t?.descripcion ?? "Sin descripción");
      const key = `G-${desc}`;
      if (!grouped[key]) {
        const joinKey = desc.toLowerCase().trim();
        grouped[key] = {
          nombre: desc,
          imagen: mapaImagenesProductos.get(joinKey) || t?.imagen_comprobante || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: true,
          categoria: "Gastos",
        };
      }
      grouped[key].monto += toNum(t?.monto_total);
      grouped[key].transacciones += 1;
    });

    // Otros Gastos (5204)
    transaccionesPorTipo.otrosGastos.forEach((t: any) => {
      const desc = String(t?.descripcion ?? "Sin descripción");
      const key = `OG-${desc}`;
      if (!grouped[key]) {
        const joinKey = desc.toLowerCase().trim();
        grouped[key] = {
          nombre: desc,
          imagen: mapaImagenesProductos.get(joinKey) || t?.imagen_comprobante || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: true,
          categoria: "Otros Gastos",
        };
      }
      grouped[key].monto += toNum(t?.monto_total);
      grouped[key].transacciones += 1;
    });

    // Inventario (5002) -> usar producto_nombre
    transaccionesPorTipo.costosInventario.forEach((c: any) => {
      const prod = String(c?.producto_nombre ?? "Sin asignación");
      const key = `CI-${prod}`;
      if (!grouped[key]) {
        grouped[key] = {
          nombre: prod,
          imagen: c?.producto_imagen || null,
          monto: 0,
          transacciones: 0,
          tieneAsignacion: !!c?.producto_nombre,
          categoria: "Costo Venta Inventario",
        };
      }
      grouped[key].monto += toNum(c?.monto);
      grouped[key].transacciones += 1;
    });

    const productosArray = Object.values(grouped).sort((a, b) => b.monto - a.monto);
    const totalGeneralRaw = productosArray.reduce((sum, p) => sum + toNum(p.monto), 0);

    const productosFormateados = productosArray.map((p) => ({ ...p, monto: formatearMonto(p.monto) }));

    return {
      productos: productosFormateados.slice(0, 10),
      totalGeneral: formatearMonto(totalGeneralRaw),
    };
  }, [transaccionesPorTipo, formatoMontos, decimales, mapaImagenesProductos]);

  // Egresos por Proveedor (Top 10)
  const datosEgresosPorProveedorMejorado = useMemo(() => {
    const grouped: Record<
      string,
      {
        nombre: string;
        monto: number;
        transacciones: number;
        tieneAsignacion: boolean;
      }
    > = {};

    const addProv = (prov: string, monto: number, has: boolean) => {
      const key = prov || "Sin proveedor asignado";
      if (!grouped[key]) grouped[key] = { nombre: key, monto: 0, transacciones: 0, tieneAsignacion: has };
      grouped[key].monto += toNum(monto);
      grouped[key].transacciones += 1;
      // si alguna transacción sí tiene asignación, lo mantenemos true
      grouped[key].tieneAsignacion = grouped[key].tieneAsignacion || has;
    };

    transaccionesPorTipo.costoVenta.forEach((t: any) => addProv(String(t?.proveedor_nombre ?? "Sin proveedor asignado"), t?.monto_total, !!t?.proveedor_nombre));
    transaccionesPorTipo.gastos.forEach((t: any) => addProv(String(t?.proveedor_nombre ?? "Sin proveedor asignado"), t?.monto_total, !!t?.proveedor_nombre));
    transaccionesPorTipo.otrosGastos.forEach((t: any) => addProv(String(t?.proveedor_nombre ?? "Sin proveedor asignado"), t?.monto_total, !!t?.proveedor_nombre));

    // Inventario sin proveedor -> agrupar como "Sin proveedor asignado"
    const totalCostosInventario = transaccionesPorTipo.costosInventario.reduce((sum: number, c: any) => sum + toNum(c?.monto), 0);
    if (totalCostosInventario > 0) {
      if (!grouped["Sin proveedor asignado"]) {
        grouped["Sin proveedor asignado"] = { nombre: "Sin proveedor asignado", monto: 0, transacciones: 0, tieneAsignacion: false };
      }
      grouped["Sin proveedor asignado"].monto += totalCostosInventario;
      grouped["Sin proveedor asignado"].transacciones += transaccionesPorTipo.costosInventario.length;
    }

    const proveedoresArray = Object.values(grouped).sort((a, b) => b.monto - a.monto);
    const totalGeneralRaw = proveedoresArray.reduce((sum, p) => sum + toNum(p.monto), 0);

    const proveedoresFormateados = proveedoresArray.map((p) => ({ ...p, monto: formatearMonto(p.monto) }));

    return {
      proveedores: proveedoresFormateados.slice(0, 10),
      totalGeneral: formatearMonto(totalGeneralRaw),
    };
  }, [transaccionesPorTipo, formatoMontos, decimales]);

  // Totales para badges
  const totalEgresosPorTipo = useMemo(() => datosEgresosPorTipo.reduce((sum, item) => sum + toNum(item.monto), 0), [datosEgresosPorTipo]);
  const totalMetodosPago = useMemo(() => datosEstadoPagos.reduce((sum, item) => sum + toNum(item.monto), 0), [datosEstadoPagos]);

  const totalEgresosPorCuentaSubcuenta = useMemo(() => {
    const datos = vistaAgrupacion === "cuenta" ? datosEgresosPorCuenta : datosEgresosPorSubcuenta;
    return datos.reduce((sum, item) => sum + toNum(item.monto), 0);
  }, [vistaAgrupacion, datosEgresosPorCuenta, datosEgresosPorSubcuenta]);

  const totalEgresosPorMetodoPagoTreemap = useMemo(
    () => datosEgresosPorMetodoPago.reduce((sum, item) => sum + toNum(item.value), 0),
    [datosEgresosPorMetodoPago]
  );

  // Resúmenes (blindados)
  const resDia = {
    costosVenta5001: toNum(resumenes?.dia?.costosVenta5001),
    costosVenta5002: toNum(resumenes?.dia?.costosVenta5002),
    gastos: toNum(resumenes?.dia?.gastos),
    otrosGastos: toNum(resumenes?.dia?.otrosGastos),
    total: toNum(resumenes?.dia?.total),
  };

  const resMes = {
    costosVenta5001: toNum(resumenes?.mes?.costosVenta5001),
    costosVenta5002: toNum(resumenes?.mes?.costosVenta5002),
    gastos: toNum(resumenes?.mes?.gastos),
    otrosGastos: toNum(resumenes?.mes?.otrosGastos),
    total: toNum(resumenes?.mes?.total),
  };

  const resAnio = {
    costosVenta5001: toNum(resumenes?.anio?.costosVenta5001),
    costosVenta5002: toNum(resumenes?.anio?.costosVenta5002),
    gastos: toNum(resumenes?.anio?.gastos),
    otrosGastos: toNum(resumenes?.anio?.otrosGastos),
    total: toNum(resumenes?.anio?.total),
  };

  if (loading || !resumenes) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Título Highlights de Egresos */}
      <div>
        <h2 className="text-2xl font-bold text-primary">Highlights de Egresos</h2>
        <p className="text-sm text-muted-foreground">Resumen de costos y gastos por período</p>
      </div>

      {/* Resúmenes por Período */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Día */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-primary">Resumen del Día</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Costos de Venta */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costos de Venta</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{moneyMXN(resDia.costosVenta5001, decimales)}</span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resDia.costosVenta5001, resDia.total)}%
                </Badge>
              </div>
            </div>

            {/* Costos de Venta Inventario */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costo Venta Inventario</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{moneyMXN(resDia.costosVenta5002, decimales)}</span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resDia.costosVenta5002, resDia.total)}%
                </Badge>
              </div>
            </div>

            {/* Gastos */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{moneyMXN(resDia.gastos, decimales)}</span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resDia.gastos, resDia.total)}%
                </Badge>
              </div>
            </div>

            {/* Otros Gastos */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Otros Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{moneyMXN(resDia.otrosGastos, decimales)}</span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resDia.otrosGastos, resDia.total)}%
                </Badge>
              </div>
            </div>

            <div className="h-px bg-border my-2"></div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-primary">Total Egresos</span>
              <span className="text-lg font-bold text-destructive">{moneyMXN(resDia.total, decimales)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Mes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-primary">Resumen del Mes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costos de Venta</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{moneyMXN(resMes.costosVenta5001, decimales)}</span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resMes.costosVenta5001, resMes.total)}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costo Venta Inventario</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{moneyMXN(resMes.costosVenta5002, decimales)}</span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resMes.costosVenta5002, resMes.total)}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{moneyMXN(resMes.gastos, decimales)}</span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resMes.gastos, resMes.total)}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Otros Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{moneyMXN(resMes.otrosGastos, decimales)}</span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resMes.otrosGastos, resMes.total)}%
                </Badge>
              </div>
            </div>

            <div className="h-px bg-border my-2"></div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-primary">Total Egresos</span>
              <span className="text-lg font-bold text-destructive">{moneyMXN(resMes.total, decimales)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Año */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-primary">Resumen del Año</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costos de Venta</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{moneyMXN(resAnio.costosVenta5001, decimales)}</span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resAnio.costosVenta5001, resAnio.total)}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costo Venta Inventario</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{moneyMXN(resAnio.costosVenta5002, decimales)}</span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resAnio.costosVenta5002, resAnio.total)}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{moneyMXN(resAnio.gastos, decimales)}</span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resAnio.gastos, resAnio.total)}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Otros Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{moneyMXN(resAnio.otrosGastos, decimales)}</span>
                <Badge variant="outline" className="text-xs bg-teal-50/50 text-teal-700 border-teal-300">
                  {calcularPorcentaje(resAnio.otrosGastos, resAnio.total)}%
                </Badge>
              </div>
            </div>

            <div className="h-px bg-border my-2"></div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-primary">Total Egresos</span>
              <span className="text-lg font-bold text-destructive">{moneyMXN(resAnio.total, decimales)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Título y Controles Globales */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-primary">Analítica de Egresos</h2>
          <p className="text-sm text-muted-foreground">Análisis detallado con controles personalizables</p>
        </div>

        {/* Panel de Controles */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Período */}
          <Card>
            <CardHeader>
              <CardTitle>Período de Análisis</CardTitle>
              <CardDescription>Selecciona el período</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <RadioGroup
                value={periodFilter}
                onValueChange={(v) => setPeriodFilter(v as "diario" | "mensual" | "anual")}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="diario" id="period-daily" />
                  <Label htmlFor="period-daily" className="cursor-pointer">
                    Diario
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mensual" id="period-monthly" />
                  <Label htmlFor="period-monthly" className="cursor-pointer">
                    Mensual
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="anual" id="period-annual" />
                  <Label htmlFor="period-annual" className="cursor-pointer">
                    Anual
                  </Label>
                </div>
              </RadioGroup>

              {periodFilter === "diario" && (
                <div className="pt-2 border-t">
                  <Label className="text-xs text-muted-foreground mb-2 block">Fecha específica</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !fechaAnalisisDiario && "text-muted-foreground")}
                        size="sm"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(fechaAnalisisDiario, "PPP", { locale: es })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaAnalisisDiario}
                        onSelect={(date) => date && setFechaAnalisisDiario(date)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {periodFilter === "mensual" && (
                <div className="pt-2 border-t">
                  <Label className="text-xs text-muted-foreground mb-2 block">Mes específico</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !fechaAnalisisMensual && "text-muted-foreground")}
                        size="sm"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(fechaAnalisisMensual, "MMMM yyyy", { locale: es })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaAnalisisMensual}
                        onSelect={(date) => date && setFechaAnalisisMensual(date)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tipo de egreso */}
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Egreso</CardTitle>
              <CardDescription>Selecciona qué analizar</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={tipoEgreso} onValueChange={(v) => setTipoEgreso(v as any)} className="flex flex-col gap-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="costo" id="tipo-costo" />
                  <Label htmlFor="tipo-costo" className="cursor-pointer">
                    Costo de Venta
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="costo_inventario" id="tipo-inventario" />
                  <Label htmlFor="tipo-inventario" className="cursor-pointer">
                    Costo Inventario
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gasto" id="tipo-gasto" />
                  <Label htmlFor="tipo-gasto" className="cursor-pointer">
                    Gastos
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="otros_gastos" id="tipo-otros" />
                  <Label htmlFor="tipo-otros" className="cursor-pointer">
                    Otros Gastos
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="total" id="tipo-total" />
                  <Label htmlFor="tipo-total" className="cursor-pointer">
                    Total
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Formato */}
          <Card>
            <CardHeader>
              <CardTitle>Formato de Cifras</CardTitle>
              <CardDescription>Visualización de montos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">Escala</Label>
                <RadioGroup
                  value={formatoMontos}
                  onValueChange={(v) => setFormatoMontos(v as "normal" | "miles" | "millones")}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="normal" id="formato-normal" />
                    <Label htmlFor="formato-normal" className="cursor-pointer">
                      Normal
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="miles" id="formato-miles" />
                    <Label htmlFor="formato-miles" className="cursor-pointer">
                      Miles (K)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="millones" id="formato-millones" />
                    <Label htmlFor="formato-millones" className="cursor-pointer">
                      Millones (M)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-medium mb-3 block">Decimales</Label>
                <RadioGroup
                  value={decimales.toString()}
                  onValueChange={(val) => setDecimales(Number(val) as 0 | 1 | 2)}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="0" id="decimales-0" />
                    <Label htmlFor="decimales-0" className="cursor-pointer">
                      Sin decimales
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="decimales-1" />
                    <Label htmlFor="decimales-1" className="cursor-pointer">
                      1 decimal
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2" id="decimales-2" />
                    <Label htmlFor="decimales-2" className="cursor-pointer">
                      2 decimales
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolución */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div>
                <CardTitle>Evolución de Egresos{getSufijoFormato()}</CardTitle>
                <CardDescription>Tendencia de egresos en el período seleccionado</CardDescription>
              </div>

              {tipoEgreso === "total" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Vista del Total:</span>
                  <Tabs value={vistaTotal} onValueChange={(v) => setVistaTotal(v as any)}>
                    <TabsList>
                      <TabsTrigger value="unica">Línea Única</TabsTrigger>
                      <TabsTrigger value="desglosada">Desglosada</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={datosGraficaFormateados}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]} padding={{ top: 20, bottom: 0 }} />
                <Tooltip
                  formatter={(value: any) => {
                    const v = toNum(value);
                    return [`$${v.toLocaleString("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}${getSufijoFormato()}`, "Monto"];
                  }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--background))",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />

                {tipoEgreso === "total" && vistaTotal === "desglosada" ? (
                  <>
                    <Line type="monotone" dataKey="costos" name="Costos Manuales" stroke="hsl(180, 25%, 50%)" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="gastos" name="Gastos" stroke="hsl(0, 70%, 55%)" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="costosInventario" name="Costo Venta Inventario" stroke="hsl(280, 60%, 55%)" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="otrosGastos" name="Otros Gastos" stroke="hsl(210, 15%, 55%)" strokeWidth={2} dot />
                    <Legend />
                  </>
                ) : tipoEgreso === "combinada" ? (
                  <>
                    <Line type="monotone" dataKey="costos" name="Costos Manuales" stroke="hsl(180, 25%, 50%)" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="gastos" name="Gastos" stroke="hsl(0, 70%, 55%)" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="costosInventario" name="Costo Venta Inventario" stroke="hsl(280, 60%, 55%)" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="otrosGastos" name="Otros Gastos" stroke="hsl(210, 15%, 55%)" strokeWidth={2} dot />
                    <Legend />
                  </>
                ) : (
                  <Line type="monotone" dataKey="monto" stroke="hsl(180, 25%, 50%)" strokeWidth={2} dot />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Egresos por Tipo */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Egresos por Tipo</CardTitle>
                <CardDescription>Distribución de costos y gastos</CardDescription>
              </div>
              <Badge variant="outline" className="text-lg font-bold bg-primary/10 text-primary border-primary/30 px-4 py-2">
                Total: {moneyMXN(totalEgresosPorTipo, decimales)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            {datosEgresosPorTipo.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay datos para mostrar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={datosEgresosPorTipo}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    labelLine
                    dataKey="monto"
                  >
                    {datosEgresosPorTipo.map((_, index) => {
                      const colors = ["hsl(180, 50%, 55%)", "hsl(200, 55%, 50%)", "hsl(160, 45%, 50%)", "hsl(220, 50%, 55%)"];
                      return <Cell key={`cell-${index}`} fill={colors[index % 4]} />;
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [
                      `$${toNum(value).toLocaleString("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`,
                      "Monto",
                    ]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-sm">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Métodos de Pago Utilizados */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Métodos de Pago Utilizados</CardTitle>
                <CardDescription>Desglose de egresos por forma de pago</CardDescription>
              </div>
              <Badge variant="outline" className="text-lg font-bold bg-primary/10 text-primary border-primary/30 px-4 py-2">
                Total: {moneyMXN(totalMetodosPago, decimales)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            {datosEstadoPagos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay datos para mostrar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={datosEstadoPagos} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} labelLine dataKey="monto">
                    <Cell fill="hsl(160, 60%, 45%)" />
                    <Cell fill="hsl(200, 50%, 55%)" />
                    <Cell fill="hsl(220, 45%, 50%)" />
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [
                      `$${toNum(value).toLocaleString("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`,
                      "Monto",
                    ]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-sm">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nuevas Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Egresos por Cuenta/Subcuenta */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{vistaAgrupacion === "cuenta" ? "Egresos por Cuenta" : "Egresos por Subcuenta"}</CardTitle>
                  <CardDescription>
                    {vistaAgrupacion === "cuenta" ? "Agrupación por cuenta contable completa" : "Desglose detallado por subcuentas"}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-lg font-bold bg-primary/10 text-primary border-primary/30 px-4 py-2">
                  Total: {moneyMXN(totalEgresosPorCuentaSubcuenta, decimales)}
                </Badge>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-sm font-medium text-muted-foreground">Agrupar por:</span>
                <Tabs value={vistaAgrupacion} onValueChange={(v) => setVistaAgrupacion(v as "cuenta" | "subcuenta")}>
                  <TabsList className="h-9">
                    <TabsTrigger value="cuenta" className="text-xs">
                      Cuenta
                    </TabsTrigger>
                    <TabsTrigger value="subcuenta" className="text-xs">
                      Subcuenta
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {(() => {
              const datosActuales = vistaAgrupacion === "cuenta" ? datosEgresosPorCuenta : datosEgresosPorSubcuenta;

              if (!datosActuales.length) {
                return (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                    <p>No hay datos para mostrar</p>
                  </div>
                );
              }

              return (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={datosActuales} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={(value: any) => `$${toNum(value).toLocaleString("es-MX")}`}
                      domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]}
                    />
                    <YAxis dataKey="subcuenta" type="category" width={vistaAgrupacion === "cuenta" ? 220 : 150} />
                    <Tooltip
                      formatter={(value: any) => [
                        `$${toNum(value).toLocaleString("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`,
                        "Monto",
                      ]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                    />
                    <Bar dataKey="monto" fill={vistaAgrupacion === "cuenta" ? "hsl(220, 60%, 55%)" : "hsl(180, 50%, 50%)"} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>

        {/* Métodos de Pago Treemap */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Métodos de Pago</CardTitle>
                <CardDescription>Distribución de pagos realizados</CardDescription>
              </div>
              <Badge variant="outline" className="text-lg font-bold bg-primary/10 text-primary border-primary/30 px-4 py-2">
                Total: {moneyMXN(totalEgresosPorMetodoPagoTreemap, decimales)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            {datosEgresosPorMetodoPago.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay datos para mostrar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <Treemap
  data={datosEgresosPorMetodoPago}
  dataKey="value"
  aspectRatio={16 / 9}
  stroke="#fff"
  content={
    <CustomTreemapContent
      dataTotal={datosEgresosPorMetodoPago.reduce((sum, item) => sum + toNum(item.value), 0)}
      decimales={decimales}
    />
  }
>
                  <Tooltip
                    formatter={(value: any) => [
                      `$${toNum(value).toLocaleString("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`,
                      "Pagado",
                    ]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                  />
                </Treemap>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tablas de Detalles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Egresos por Producto */}
        <Card>
          <CardHeader>
            <CardTitle>Egresos por Producto</CardTitle>
            <CardDescription>Top 10 productos con mayor egreso</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {datosEgresosPorProducto.productos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay productos para mostrar</p>
              </div>
            ) : (
              <>
                {datosEgresosPorProducto.productos.map((producto: any) => {
                  const total = toNum(datosEgresosPorProducto.totalGeneral);
                  const porcentaje = total > 0 ? ((toNum(producto.monto) / total) * 100).toFixed(1) : "0.0";

                  return (
                    <div
                      key={producto.nombre}
                      className={`flex items-center gap-3 p-3 border rounded-lg ${
                        !producto.tieneAsignacion ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20" : ""
                      }`}
                    >
                      {producto.imagen ? (
                        <img src={producto.imagen} alt={producto.nombre} className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                      ) : (
                        <div
                          className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${
                            !producto.tieneAsignacion ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"
                          }`}
                        >
                          <Package
                            className={`w-5 h-5 ${
                              !producto.tieneAsignacion ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                            }`}
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{producto.nombre}</p>
                          {!producto.tieneAsignacion && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 flex-shrink-0">
                              Sin asignar
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {producto.transacciones} {producto.transacciones === 1 ? "transacción" : "transacciones"}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-foreground">{formatearParaVisualizacion(producto.monto)}</p>
                      </div>

                      <div className="flex-shrink-0">
                        <Badge variant="outline" className="bg-teal-50/50 text-teal-700 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300">
                          {porcentaje}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="font-semibold text-primary">Total General</span>
                  <span className="text-lg font-bold text-foreground">{formatearParaVisualizacion(datosEgresosPorProducto.totalGeneral, true)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Egresos por Proveedor */}
        <Card>
          <CardHeader>
            <CardTitle>Egresos por Proveedor</CardTitle>
            <CardDescription>Top 10 proveedores por monto de egresos</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {datosEgresosPorProveedorMejorado.proveedores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay proveedores para mostrar</p>
              </div>
            ) : (
              <>
                {datosEgresosPorProveedorMejorado.proveedores.map((proveedor: any) => {
                  const total = toNum(datosEgresosPorProveedorMejorado.totalGeneral);
                  const porcentaje = total > 0 ? ((toNum(proveedor.monto) / total) * 100).toFixed(1) : "0.0";

                  return (
                    <div
                      key={proveedor.nombre}
                      className={`flex items-center gap-3 p-3 border rounded-lg ${
                        !proveedor.tieneAsignacion ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{proveedor.nombre}</p>
                          {!proveedor.tieneAsignacion && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 flex-shrink-0">
                              Sin asignar
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {proveedor.transacciones} {proveedor.transacciones === 1 ? "transacción" : "transacciones"}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-foreground">{formatearParaVisualizacion(proveedor.monto)}</p>
                      </div>

                      <div className="flex-shrink-0">
                        <Badge variant="outline" className="bg-teal-50/50 text-teal-700 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300">
                          {porcentaje}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="font-semibold text-primary">Total General</span>
                  <span className="text-lg font-bold text-foreground">
                    {formatearParaVisualizacion(datosEgresosPorProveedorMejorado.totalGeneral, true)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticaEgresos;
