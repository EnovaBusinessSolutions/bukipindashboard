import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { Users, Package } from "lucide-react";
import { format, startOfMonth, startOfYear, endOfMonth, eachDayOfInterval, eachMonthOfInterval } from "date-fns";
import { es } from "date-fns/locale";

interface TransaccionIngreso {
  id: string;
  cliente_nombre: string | null;
  descripcion: string;
  monto_neto: number;
  created_at: string;
  estado: string;
}

export default function AnalyticaClientesNueva() {
  const [evolucionPeriodo, setEvolucionPeriodo] = useState<"mes" | "año">("mes");
  const [comprasPeriodo, setComprasPeriodo] = useState<"mes-curso" | "mes-acum" | "año-acum">("mes-acum");
  const [ventasPeriodo, setVentasPeriodo] = useState<"mes-acum" | "año-acum">("mes-acum");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>("todos");
  const [tipoVisualizacion, setTipoVisualizacion] = useState<"ventas" | "unidades">("ventas");

  // Fetch transacciones
  const { data: transacciones = [], isLoading } = useQuery({
    queryKey: ["transacciones-analitica-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacciones_ingresos")
        .select("*")
        .eq("estado", "activo")
        .not("cliente_nombre", "is", null)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as TransaccionIngreso[];
    },
  });

  // ============ SECCIÓN 1: HIGHLIGHTS (KPIs) ============
  const kpis = useMemo(() => {
    const hoy = new Date();
    const inicioMes = startOfMonth(hoy);
    const inicioAño = startOfYear(hoy);

    const calcularKPIs = (transaccionesFiltradas: TransaccionIngreso[]) => {
      const clientesUnicos = new Set(transaccionesFiltradas.map(t => t.cliente_nombre));
      const productosVendidos = transaccionesFiltradas.length;
      return { clientes: clientesUnicos.size, productos: productosVendidos };
    };

    const hoyTransacciones = transacciones.filter(t => 
      new Date(t.created_at).toDateString() === hoy.toDateString()
    );
    const mesTransacciones = transacciones.filter(t => 
      new Date(t.created_at) >= inicioMes
    );
    const añoTransacciones = transacciones.filter(t => 
      new Date(t.created_at) >= inicioAño
    );

    return {
      dia: calcularKPIs(hoyTransacciones),
      mes: calcularKPIs(mesTransacciones),
      año: calcularKPIs(añoTransacciones),
    };
  }, [transacciones]);

  // ============ SECCIÓN 2: GRÁFICA DE LÍNEA - EVOLUCIÓN DE CLIENTES ============
  const datosEvolucion = useMemo(() => {
    const hoy = new Date();
    
    if (evolucionPeriodo === "mes") {
      const inicioMes = startOfMonth(hoy);
      const diasDelMes = eachDayOfInterval({ start: inicioMes, end: hoy });
      
      return diasDelMes.map(dia => {
        const transaccionesDia = transacciones.filter(t => {
          const fechaT = new Date(t.created_at);
          return fechaT <= dia && fechaT >= inicioMes;
        });
        const clientesUnicos = new Set(transaccionesDia.map(t => t.cliente_nombre));
        
        return {
          fecha: format(dia, "dd MMM", { locale: es }),
          clientes: clientesUnicos.size,
        };
      });
    } else {
      const inicioAño = startOfYear(hoy);
      const mesesDelAño = eachMonthOfInterval({ start: inicioAño, end: hoy });
      
      return mesesDelAño.map(mes => {
        const finDeMes = endOfMonth(mes);
        const transaccionesMes = transacciones.filter(t => {
          const fechaT = new Date(t.created_at);
          return fechaT <= finDeMes && fechaT >= inicioAño;
        });
        const clientesUnicos = new Set(transaccionesMes.map(t => t.cliente_nombre));
        
        return {
          fecha: format(mes, "MMM", { locale: es }),
          clientes: clientesUnicos.size,
        };
      });
    }
  }, [transacciones, evolucionPeriodo]);

  // Calcular máximo para eje Y (120% del valor máximo)
  const maxClientes = useMemo(() => {
    if (datosEvolucion.length === 0) return 10;
    const max = Math.max(...datosEvolucion.map(d => d.clientes));
    return Math.ceil(max * 1.2);
  }, [datosEvolucion]);

  // ============ SECCIÓN 3: BARRAS HORIZONTALES - CLIENTES POR COMPRAS ============
  const datosClientesPorCompras = useMemo(() => {
    let transaccionesFiltradas = transacciones;
    const hoy = new Date();

    if (comprasPeriodo === "mes-curso") {
      transaccionesFiltradas = transacciones.filter(t => {
        const fechaT = new Date(t.created_at);
        return fechaT.getMonth() === hoy.getMonth() && 
               fechaT.getFullYear() === hoy.getFullYear();
      });
    } else if (comprasPeriodo === "mes-acum") {
      transaccionesFiltradas = transacciones.filter(t => 
        new Date(t.created_at) >= startOfMonth(hoy)
      );
    } else if (comprasPeriodo === "año-acum") {
      transaccionesFiltradas = transacciones.filter(t => 
        new Date(t.created_at) >= startOfYear(hoy)
      );
    }

    const clientesMap = new Map<string, number>();
    transaccionesFiltradas.forEach(t => {
      const nombre = t.cliente_nombre || "Sin nombre";
      clientesMap.set(nombre, (clientesMap.get(nombre) || 0) + 1);
    });

    return Array.from(clientesMap.entries())
      .map(([cliente, compras]) => ({ cliente, compras }))
      .sort((a, b) => b.compras - a.compras)
      .slice(0, 10);
  }, [transacciones, comprasPeriodo]);

  // ============ SECCIÓN 4: BARRAS VERTICALES - VENTAS POR PRODUCTO POR CLIENTE ============
  const clientesUnicos = useMemo(() => {
    const clientes = new Set(transacciones.map(t => t.cliente_nombre).filter(Boolean));
    return Array.from(clientes).sort() as string[];
  }, [transacciones]);

  const datosVentasPorProducto = useMemo(() => {
    let transaccionesFiltradas = transacciones;
    const hoy = new Date();

    if (ventasPeriodo === "mes-acum") {
      transaccionesFiltradas = transacciones.filter(t => 
        new Date(t.created_at) >= startOfMonth(hoy)
      );
    } else if (ventasPeriodo === "año-acum") {
      transaccionesFiltradas = transacciones.filter(t => 
        new Date(t.created_at) >= startOfYear(hoy)
      );
    }

    if (clienteSeleccionado !== "todos") {
      transaccionesFiltradas = transaccionesFiltradas.filter(
        t => t.cliente_nombre === clienteSeleccionado
      );
    }

    const productosMap = new Map<string, { total: number; unidades: number }>();
    transaccionesFiltradas.forEach(t => {
      const producto = t.descripcion || "Sin descripción";
      const actual = productosMap.get(producto) || { total: 0, unidades: 0 };
      productosMap.set(producto, {
        total: actual.total + t.monto_neto,
        unidades: actual.unidades + 1
      });
    });

    return Array.from(productosMap.entries())
      .map(([producto, datos]) => ({ 
        producto: producto.length > 30 ? producto.substring(0, 30) + "..." : producto, 
        total: datos.total,
        unidades: datos.unidades
      }))
      .sort((a, b) => tipoVisualizacion === "ventas" ? b.total - a.total : b.unidades - a.unidades)
      .slice(0, 10);
  }, [transacciones, ventasPeriodo, clienteSeleccionado, tipoVisualizacion]);

  const maxVentasProducto = useMemo(() => {
    if (datosVentasPorProducto.length === 0) return 10;
    const valores = datosVentasPorProducto.map(d => 
      tipoVisualizacion === "ventas" ? d.total : d.unidades
    );
    const max = Math.max(...valores);
    return Math.ceil(max * 1.2);
  }, [datosVentasPorProducto, tipoVisualizacion]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Cargando analíticas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SECCIÓN 1: HIGHLIGHTS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Únicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Hoy</span>
                <span className="text-2xl font-bold">{kpis.dia.clientes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Mes</span>
                <span className="text-xl font-semibold">{kpis.mes.clientes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Año</span>
                <span className="text-lg font-medium">{kpis.año.clientes}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos/Servicios Vendidos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Hoy</span>
                <span className="text-2xl font-bold">{kpis.dia.productos}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Mes</span>
                <span className="text-xl font-semibold">{kpis.mes.productos}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Año</span>
                <span className="text-lg font-medium">{kpis.año.productos}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECCIÓN 2: EVOLUCIÓN DE CLIENTES */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Evolución de Clientes</CardTitle>
              <CardDescription>Número de clientes únicos acumulados</CardDescription>
            </div>
            <Tabs value={evolucionPeriodo} onValueChange={(v) => setEvolucionPeriodo(v as "mes" | "año")}>
              <TabsList>
                <TabsTrigger value="mes">Mes en curso</TabsTrigger>
                <TabsTrigger value="año">Año</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={datosEvolucion}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="fecha" className="text-xs" />
              <YAxis className="text-xs" domain={[0, maxClientes]} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px"
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="clientes" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Clientes"
                dot={{ fill: "hsl(var(--primary))" }}
              >
                <LabelList 
                  dataKey="clientes" 
                  position="top" 
                  className="text-xs fill-foreground font-medium"
                  offset={8}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* SECCIÓN 3: CLIENTES POR COMPRAS */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Clientes por Número de Compras</CardTitle>
              <CardDescription>Top 10 clientes ordenados por actividad</CardDescription>
            </div>
            <Select value={comprasPeriodo} onValueChange={(v) => setComprasPeriodo(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes-curso">Mes en curso</SelectItem>
                <SelectItem value="mes-acum">Mes acumulado</SelectItem>
                <SelectItem value="año-acum">Año acumulado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={datosClientesPorCompras} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" className="text-xs" />
              <YAxis dataKey="cliente" type="category" width={150} className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px"
                }}
              />
              <Bar dataKey="compras" fill="hsl(var(--primary))" name="Compras">
                <LabelList 
                  dataKey="compras" 
                  position="right" 
                  className="text-xs fill-foreground font-medium"
                  offset={5}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* SECCIÓN 4: VENTAS POR PRODUCTO POR CLIENTE */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Ventas por Producto por Cliente</CardTitle>
              <CardDescription>Total de ventas por producto</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={clienteSeleccionado} onValueChange={setClienteSeleccionado}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los clientes</SelectItem>
                  {clientesUnicos.map(cliente => (
                    <SelectItem key={cliente} value={cliente}>{cliente}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ventasPeriodo} onValueChange={(v) => setVentasPeriodo(v as any)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes-acum">Mes acumulado</SelectItem>
                  <SelectItem value="año-acum">Año acumulado</SelectItem>
                </SelectContent>
              </Select>
              <Tabs value={tipoVisualizacion} onValueChange={(v) => setTipoVisualizacion(v as "ventas" | "unidades")}>
                <TabsList>
                  <TabsTrigger value="ventas">Ventas ($)</TabsTrigger>
                  <TabsTrigger value="unidades">Unidades</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={datosVentasPorProducto}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="producto" className="text-xs" angle={-45} textAnchor="end" height={120} />
              <YAxis 
                className="text-xs" 
                domain={[0, maxVentasProducto]}
                tickFormatter={(value) => tipoVisualizacion === "ventas" ? formatCurrency(value) : value.toString()} 
              />
              <Tooltip 
                formatter={(value: number) => tipoVisualizacion === "ventas" ? formatCurrency(value) : value.toString()}
                contentStyle={{ 
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px"
                }}
              />
              <Bar 
                dataKey={tipoVisualizacion === "ventas" ? "total" : "unidades"} 
                fill="hsl(var(--primary))" 
                name={tipoVisualizacion === "ventas" ? "Total Ventas" : "Unidades Vendidas"}
              >
                <LabelList 
                  dataKey={tipoVisualizacion === "ventas" ? "total" : "unidades"} 
                  position="top" 
                  formatter={(value: number) => tipoVisualizacion === "ventas" ? formatCurrency(value) : value.toString()}
                  className="text-xs fill-foreground font-medium"
                  offset={5}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
