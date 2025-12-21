import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  LabelList,
} from "recharts";
import { Loader2, TrendingUp, Package } from "lucide-react";
import {
  isToday,
  isThisMonth,
  isThisYear,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
  eachMonthOfInterval,
  eachDayOfInterval,
} from "date-fns";
import { es } from "date-fns/locale";

interface TransaccionEgreso {
  id: string;
  proveedor_nombre: string | null;
  descripcion: string;
  monto_total: number;
  cantidad: number | null;
  created_at: string;
}

export default function AnalyticaProveedoresNueva() {
  const [periodoEvolucion, setPeriodoEvolucion] = useState<"mensual" | "anual">("mensual");
  const [periodoCompras, setPeriodoCompras] = useState<"mes_actual" | "mes_acumulado" | "año_acumulado">(
    "mes_actual"
  );
  const [comprasPeriodo, setComprasPeriodo] = useState<"mensual" | "anual">("mensual");
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>("todos");
  const [tipoVisualizacion, setTipoVisualizacion] = useState<"gastos" | "unidades">("gastos");

  const { data: transacciones, isLoading } = useQuery({
    queryKey: ["transacciones-egresos-analytics"],
    queryFn: async () => {
      
      const json = await apiFetch("/api/analytics/proveedores/egresos", {
        method: "GET",
      });

      const payload: any = (json as any)?.data ?? json;
      return (payload ?? []) as TransaccionEgreso[];
    },
    staleTime: 60_000,
  });

  const kpis = useMemo(() => {
    if (!transacciones)
      return {
        hoy: { proveedores: 0, productos: 0 },
        mes: { proveedores: 0, productos: 0 },
        año: { proveedores: 0, productos: 0 },
      };

    const hoy = transacciones.filter((t) => isToday(new Date(t.created_at)));
    const mes = transacciones.filter((t) => isThisMonth(new Date(t.created_at)));
    const año = transacciones.filter((t) => isThisYear(new Date(t.created_at)));

    return {
      hoy: {
        proveedores: new Set(hoy.map((t) => t.proveedor_nombre)).size,
        productos: hoy.reduce((sum, t) => sum + (t.cantidad || 1), 0),
      },
      mes: {
        proveedores: new Set(mes.map((t) => t.proveedor_nombre)).size,
        productos: mes.reduce((sum, t) => sum + (t.cantidad || 1), 0),
      },
      año: {
        proveedores: new Set(año.map((t) => t.proveedor_nombre)).size,
        productos: año.reduce((sum, t) => sum + (t.cantidad || 1), 0),
      },
    };
  }, [transacciones]);

  const datosEvolucion = useMemo(() => {
    if (!transacciones || transacciones.length === 0) return [];

    const ahora = new Date();
    let periodos: Date[] = [];

    if (periodoEvolucion === "mensual") {
      periodos = eachDayOfInterval({
        start: startOfMonth(ahora),
        end: endOfMonth(ahora),
      });
    } else {
      periodos = eachMonthOfInterval({
        start: startOfYear(ahora),
        end: endOfYear(ahora),
      });
    }

    return periodos.map((periodo) => {
      const proveedoresHastaPeriodo = transacciones
        .filter((t) => new Date(t.created_at) <= periodo)
        .map((t) => t.proveedor_nombre);

      const proveedoresUnicos = new Set(proveedoresHastaPeriodo).size;

      return {
        periodo:
          periodoEvolucion === "mensual"
            ? format(periodo, "d MMM", { locale: es })
            : format(periodo, "MMM", { locale: es }),
        proveedores: proveedoresUnicos,
      };
    });
  }, [transacciones, periodoEvolucion]);

  const maxProveedores = useMemo(() => {
    if (datosEvolucion.length === 0) return 10;
    const max = Math.max(...datosEvolucion.map((d) => d.proveedores));
    return Math.ceil(max * 1.2);
  }, [datosEvolucion]);

  const datosProveedoresPorCompras = useMemo(() => {
    if (!transacciones) return [];

    let transaccionesFiltradas = transacciones;

    if (periodoCompras === "mes_actual") {
      transaccionesFiltradas = transacciones.filter((t) => isThisMonth(new Date(t.created_at)));
    } else if (periodoCompras === "mes_acumulado") {
      transaccionesFiltradas = transacciones.filter((t) => new Date(t.created_at) <= endOfMonth(new Date()));
    } else if (periodoCompras === "año_acumulado") {
      transaccionesFiltradas = transacciones.filter((t) => new Date(t.created_at) <= endOfYear(new Date()));
    }

    const proveedoresMap = new Map<string, number>();

    transaccionesFiltradas.forEach((transaccion) => {
      const proveedor = transaccion.proveedor_nombre || "Sin proveedor";
      proveedoresMap.set(proveedor, (proveedoresMap.get(proveedor) || 0) + 1);
    });

    return Array.from(proveedoresMap.entries())
      .map(([proveedor, compras]) => ({ proveedor, compras }))
      .sort((a, b) => b.compras - a.compras)
      .slice(0, 10);
  }, [transacciones, periodoCompras]);

  const maxComprasProveedores = useMemo(() => {
    if (datosProveedoresPorCompras.length === 0) return 10;
    const max = Math.max(...datosProveedoresPorCompras.map((d) => d.compras));
    return Math.ceil(max * 1.2);
  }, [datosProveedoresPorCompras]);

  const proveedoresUnicos = useMemo(() => {
    if (!transacciones) return [];
    return Array.from(new Set(transacciones.map((t) => t.proveedor_nombre).filter(Boolean))).sort();
  }, [transacciones]);

  const datosComprasPorProducto = useMemo(() => {
    if (!transacciones) return [];

    let transaccionesFiltradas = transacciones;

    if (proveedorSeleccionado !== "todos") {
      transaccionesFiltradas = transaccionesFiltradas.filter((t) => t.proveedor_nombre === proveedorSeleccionado);
    }

    if (comprasPeriodo === "mensual") {
      transaccionesFiltradas = transaccionesFiltradas.filter((t) => new Date(t.created_at) <= endOfMonth(new Date()));
    } else {
      transaccionesFiltradas = transaccionesFiltradas.filter((t) => new Date(t.created_at) <= endOfYear(new Date()));
    }

    const productosMap = new Map<string, { total: number; unidades: number }>();

    transaccionesFiltradas.forEach((transaccion) => {
      const producto = transaccion.descripcion || "Sin descripción";
      const actual = productosMap.get(producto) || { total: 0, unidades: 0 };
      productosMap.set(producto, {
        total: actual.total + transaccion.monto_total,
        unidades: actual.unidades + (transaccion.cantidad || 1),
      });
    });

    return Array.from(productosMap.entries())
      .map(([producto, data]) => ({ producto, ...data }))
      .sort((a, b) => (tipoVisualizacion === "gastos" ? b.total - a.total : b.unidades - a.unidades))
      .slice(0, 10);
  }, [transacciones, comprasPeriodo, proveedorSeleccionado, tipoVisualizacion]);

  const maxComprasProducto = useMemo(() => {
    if (datosComprasPorProducto.length === 0) return 10;
    const valores = datosComprasPorProducto.map((d) => (tipoVisualizacion === "gastos" ? d.total : d.unidades));
    const max = Math.max(...valores);
    return Math.ceil(max * 1.2);
  }, [datosComprasPorProducto, tipoVisualizacion]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proveedores Únicos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold">{kpis.hoy.proveedores}</div>
                <p className="text-xs text-muted-foreground">Hoy</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{kpis.mes.proveedores}</div>
                <p className="text-xs text-muted-foreground">Este mes</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{kpis.año.proveedores}</div>
                <p className="text-xs text-muted-foreground">Este año</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos/Servicios Comprados</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold">{kpis.hoy.productos}</div>
                <p className="text-xs text-muted-foreground">Hoy</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{kpis.mes.productos}</div>
                <p className="text-xs text-muted-foreground">Este mes</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{kpis.año.productos}</div>
                <p className="text-xs text-muted-foreground">Este año</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evolución de Proveedores */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Evolución de Proveedores</CardTitle>
              <CardDescription>Crecimiento acumulado de proveedores únicos</CardDescription>
            </div>
            <Select value={periodoEvolucion} onValueChange={(value: "mensual" | "anual") => setPeriodoEvolucion(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensual">Mes en curso</SelectItem>
                <SelectItem value="anual">Año en curso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={datosEvolucion}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" className="text-xs" />
              <YAxis className="text-xs" domain={[0, maxProveedores]} />
              <Tooltip />
              <Line type="monotone" dataKey="proveedores" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }}>
                <LabelList dataKey="proveedores" position="top" className="text-xs fill-foreground" />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Proveedores por Compras */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Top Proveedores por Número de Compras</CardTitle>
              <CardDescription>Proveedores con mayor número de transacciones</CardDescription>
            </div>
            <Select value={periodoCompras} onValueChange={(value: any) => setPeriodoCompras(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes_actual">Mes actual</SelectItem>
                <SelectItem value="mes_acumulado">Mes acumulado</SelectItem>
                <SelectItem value="año_acumulado">Año acumulado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={datosProveedoresPorCompras} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" className="text-xs" domain={[0, maxComprasProveedores]} />
              <YAxis dataKey="proveedor" type="category" width={150} className="text-xs" />
              <Tooltip />
              <Bar dataKey="compras" fill="hsl(var(--primary))">
                <LabelList dataKey="compras" position="right" className="text-xs fill-foreground" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Compras por Producto por Proveedor */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div>
              <CardTitle>Compras por Producto por Proveedor</CardTitle>
              <CardDescription>Análisis de compras por producto/servicio</CardDescription>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={proveedorSeleccionado} onValueChange={setProveedorSeleccionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los proveedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los proveedores</SelectItem>
                  {proveedoresUnicos.map((proveedor) => (
                    <SelectItem key={proveedor} value={proveedor}>
                      {proveedor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={comprasPeriodo} onValueChange={(value: "mensual" | "anual") => setComprasPeriodo(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual acumulado</SelectItem>
                  <SelectItem value="anual">Anual acumulado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tipoVisualizacion} onValueChange={(value: "gastos" | "unidades") => setTipoVisualizacion(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gastos">Gastos ($)</SelectItem>
                  <SelectItem value="unidades">Unidades</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={datosComprasPorProducto}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="producto" className="text-xs" angle={-45} textAnchor="end" height={120} />
              <YAxis
                className="text-xs"
                domain={[0, maxComprasProducto]}
                tickFormatter={(value) => (tipoVisualizacion === "gastos" ? formatCurrency(value) : value.toString())}
              />
              <Tooltip formatter={(value: number) => (tipoVisualizacion === "gastos" ? formatCurrency(value) : value)} />
              <Bar dataKey={tipoVisualizacion === "gastos" ? "total" : "unidades"} fill="hsl(var(--primary))">
                <LabelList
                  dataKey={tipoVisualizacion === "gastos" ? "total" : "unidades"}
                  position="top"
                  className="text-xs fill-foreground"
                  formatter={(value: number) => (tipoVisualizacion === "gastos" ? formatCurrency(value) : value)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
