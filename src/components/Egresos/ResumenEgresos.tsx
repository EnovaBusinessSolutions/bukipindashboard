// bukipin-dashboard/src/components/Egresos/ResumenEgresos.tsx
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Calendar,
  User,
  CreditCard,
  Image as ImageIcon,
  Filter,
  X,
  BookOpen,
  Package,
  AlertCircle,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTransaccionesEgresos } from "@/hooks/useTransaccionesEgresos";
import { useCostosVentaInventario } from "@/hooks/useCostosVentaInventario";
import { useProductosEgresos } from "@/hooks/useProductosEgresos";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCuentas } from "@/hooks/useCuentas";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";

type AsientoDetalle = {
  cuenta_codigo: string;
  cuenta_nombre?: string;
  descripcion?: string;
  debe: number;
  haber: number;
};

type Asiento = {
  id?: string;
  numero_asiento: string;
  fecha?: string;
  descripcion?: string;
  detalles?: AsientoDetalle[];
};

const ResumenEgresos = () => {
  const { data: transacciones = [], isLoading: loading } = useTransaccionesEgresos(200);
  const { data: costosVentaInventario, isLoading: loadingCostosVenta } = useCostosVentaInventario();
  const { data: productosEgresos = [] } = useProductosEgresos();
  const { data: cuentasData } = useCuentas();
  const { toast } = useToast();

  // Crear mapa de imágenes de productos por nombre para JOIN manual
  const mapaImagenesProductos = useMemo(() => {
    const mapa = new Map<string, string>();
    (productosEgresos || []).forEach((p: any) => {
      if (p.imagen_url) {
        mapa.set(String(p.nombre || "").toLowerCase().trim(), p.imagen_url);
      }
    });
    return mapa;
  }, [productosEgresos]);

  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingAsientos, setLoadingAsientos] = useState(false);
  const [currentAsientos, setCurrentAsientos] = useState<Asiento | null>(null);
  const [uploadingComprobante, setUploadingComprobante] = useState(false);

  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterProveedor, setFilterProveedor] = useState<string>("todos");
  const [filterPago, setFilterPago] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterMes, setFilterMes] = useState<string>("todos");
  const [filterAno, setFilterAno] = useState<string>("todos");
  const [filterFechaInicio, setFilterFechaInicio] = useState<string>("");
  const [filterFechaFin, setFilterFechaFin] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategoriaContable, setFilterCategoriaContable] = useState<string>("todos");

  // Estados para cancelación
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [transaccionACancelar, setTransaccionACancelar] = useState<any>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [isCanceling, setIsCanceling] = useState(false);

  // Obtener valores únicos para filtros
  const proveedoresUnicos = useMemo(() => {
    const proveedores = new Set<string>();
    transacciones.forEach((t: any) => {
      if (t.proveedor_nombre) proveedores.add(t.proveedor_nombre);
    });
    return Array.from(proveedores).sort();
  }, [transacciones]);

  const anosUnicos = useMemo(() => {
    const anos = new Set<number>();
    transacciones.forEach((t: any) => {
      const fecha = new Date(t.created_at);
      anos.add(fecha.getFullYear());
    });
    return Array.from(anos).sort((a, b) => b - a);
  }, [transacciones]);

  // Filtrar transacciones
  const transaccionesFiltradas = useMemo(() => {
    return transacciones.filter((t: any) => {
      // Filtrar solo costos y gastos
      if (t.tipo_egreso !== "costo" && t.tipo_egreso !== "gasto" && t.tipo_egreso !== "otro") return false;

      const fecha = new Date(t.created_at);

      // Filtro por búsqueda
      if (
        searchTerm &&
        !String(t.descripcion || "").toLowerCase().includes(searchTerm.toLowerCase()) &&
        !String(t.proveedor_nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Filtro por tipo
      if (filterTipo !== "todos" && t.tipo_egreso !== filterTipo) return false;

      // Filtro por proveedor
      if (filterProveedor !== "todos" && t.proveedor_nombre !== filterProveedor) return false;

      // Filtro por tipo de pago
      if (filterPago !== "todos" && t.tipo_pago !== filterPago) return false;

      // Filtro por estado
      if (filterEstado === "pagado" && t.monto_pendiente > 0) return false;
      if (filterEstado === "pendiente" && t.monto_pendiente === 0) return false;

      // Filtro por mes
      if (filterMes !== "todos" && fecha.getMonth() + 1 !== parseInt(filterMes)) return false;

      // Filtro por año
      if (filterAno !== "todos" && fecha.getFullYear() !== parseInt(filterAno)) return false;

      // Filtro por rango de fechas
      if (filterFechaInicio && fecha < new Date(filterFechaInicio)) return false;
      if (filterFechaFin && fecha > new Date(filterFechaFin + "T23:59:59")) return false;

      return true;
    });
  }, [
    transacciones,
    searchTerm,
    filterTipo,
    filterProveedor,
    filterPago,
    filterEstado,
    filterMes,
    filterAno,
    filterFechaInicio,
    filterFechaFin,
  ]);

  // Filtrar costos de venta directos (5001, 5003, 5004)
  const transaccionesCostosVenta = useMemo(() => {
    return transaccionesFiltradas.filter(
      (t: any) => t.cuenta_codigo === "5001" || t.cuenta_codigo === "5003" || t.cuenta_codigo === "5004"
    );
  }, [transaccionesFiltradas]);

  // Filtrar solo gastos operativos (5101-5108)
  const transaccionesGastos = useMemo(() => {
    return transaccionesFiltradas.filter(
      (t: any) =>
        t.cuenta_codigo &&
        String(t.cuenta_codigo).startsWith("51") &&
        t.cuenta_codigo !== "5109" &&
        t.cuenta_codigo !== "5110"
    );
  }, [transaccionesFiltradas]);

  // Filtrar solo otros gastos (cuenta 5204)
  const transaccionesOtrosGastos = useMemo(() => {
    return transaccionesFiltradas.filter((t: any) => t.cuenta_codigo === "5204");
  }, [transaccionesFiltradas]);

  // Unificar TODAS las transacciones de egresos
  const transaccionesEgresosUnificadas = useMemo(() => {
    // 1. Costos de inventario (5002) del hook
    const costosConDetalle =
      costosVentaInventario?.map((c: any) => ({
        id: c.id,
        created_at: c.fecha,
        tipo_egreso: "costo",
        descripcion: c.producto_nombre,
        cuenta_codigo: c.detalles_asiento?.find((d: any) => String(d.cuenta_codigo).startsWith("50"))?.cuenta_codigo || "50XX",
        monto_total: Number(c.monto) || 0,
        proveedor_nombre: null,
        imagen_url: c.producto_imagen,
        cantidad: c.cantidad,
        costo_unitario: c.costo_unitario,
        numero_asiento: c.numero_asiento,
        detalles_asiento: c.detalles_asiento || [],
        tipo_pago: null,
        metodo_pago: null,
        monto_pagado: Number(c.monto) || 0,
        monto_pendiente: 0,
        estado: "activo",
        imagen_comprobante: null,
      })) || [];

    // 2. Costos de venta directos (5001, 5003, 5004)
    const costosVentaDirectos = transaccionesCostosVenta.map((cv: any) => ({
      id: cv.id,
      created_at: cv.created_at,
      tipo_egreso: cv.tipo_egreso,
      descripcion: cv.descripcion,
      cuenta_codigo: cv.cuenta_codigo,
      monto_total: Number(cv.monto_total) || 0,
      proveedor_nombre: cv.proveedor_nombre,
      imagen_url: mapaImagenesProductos.get(String(cv.descripcion || "").toLowerCase().trim()) || cv.imagen_comprobante || null,
      cantidad: cv.cantidad,
      costo_unitario: cv.precio_unitario,
      numero_asiento: null,
      detalles_asiento: [],
      tipo_pago: cv.tipo_pago,
      metodo_pago: cv.metodo_pago,
      monto_pagado: Number(cv.monto_pagado) || 0,
      monto_pendiente: Number(cv.monto_pendiente) || 0,
      estado: cv.estado || "activo",
      imagen_comprobante: cv.imagen_comprobante || null,
    }));

    // 3. Gastos operativos (5101-5108)
    const gastosConDetalle = transaccionesGastos.map((g: any) => ({
      id: g.id,
      created_at: g.created_at,
      tipo_egreso: g.tipo_egreso,
      descripcion: g.descripcion,
      cuenta_codigo: g.cuenta_codigo,
      monto_total: Number(g.monto_total) || 0,
      proveedor_nombre: g.proveedor_nombre,
      imagen_url: mapaImagenesProductos.get(String(g.descripcion || "").toLowerCase().trim()) || g.imagen_comprobante || null,
      cantidad: g.cantidad,
      costo_unitario: g.precio_unitario,
      numero_asiento: null,
      detalles_asiento: [],
      tipo_pago: g.tipo_pago,
      metodo_pago: g.metodo_pago,
      monto_pagado: Number(g.monto_pagado) || 0,
      monto_pendiente: Number(g.monto_pendiente) || 0,
      estado: g.estado || "activo",
      imagen_comprobante: g.imagen_comprobante || null,
    }));

    // 4. Otros gastos (5204)
    const otrosGastosConDetalle = transaccionesOtrosGastos.map((og: any) => ({
      id: og.id,
      created_at: og.created_at,
      tipo_egreso: og.tipo_egreso,
      descripcion: og.descripcion,
      cuenta_codigo: og.cuenta_codigo,
      monto_total: Number(og.monto_total) || 0,
      proveedor_nombre: og.proveedor_nombre,
      imagen_url: mapaImagenesProductos.get(String(og.descripcion || "").toLowerCase().trim()) || og.imagen_comprobante || null,
      cantidad: og.cantidad,
      costo_unitario: og.precio_unitario,
      numero_asiento: null,
      detalles_asiento: [],
      tipo_pago: og.tipo_pago,
      metodo_pago: og.metodo_pago,
      monto_pagado: Number(og.monto_pagado) || 0,
      monto_pendiente: Number(og.monto_pendiente) || 0,
      estado: og.estado || "activo",
      imagen_comprobante: og.imagen_comprobante || null,
    }));

    return [...costosConDetalle, ...costosVentaDirectos, ...gastosConDetalle, ...otrosGastosConDetalle].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [costosVentaInventario, transaccionesCostosVenta, transaccionesGastos, transaccionesOtrosGastos, mapaImagenesProductos]);

  // Aplicar filtro de categoría contable
  const transaccionesFiltadasPorCategoria = useMemo(() => {
    if (filterCategoriaContable === "todos") return transaccionesEgresosUnificadas;
    if (filterCategoriaContable === "costos") return transaccionesEgresosUnificadas.filter((t: any) => String(t.cuenta_codigo || "").startsWith("50"));
    if (filterCategoriaContable === "gastos") return transaccionesEgresosUnificadas.filter((t: any) => String(t.cuenta_codigo || "").startsWith("51"));
    if (filterCategoriaContable === "otros_gastos") return transaccionesEgresosUnificadas.filter((t: any) => t.cuenta_codigo === "5204");
    return transaccionesEgresosUnificadas;
  }, [transaccionesEgresosUnificadas, filterCategoriaContable]);

  // Calcular subtotales
  const resumenFiltrado = useMemo(() => {
    const totalCostos = transaccionesEgresosUnificadas
      .filter((t: any) => String(t.cuenta_codigo || "").startsWith("50"))
      .reduce((sum: number, t: any) => sum + (Number(t.monto_total) || 0), 0);

    const totalGastos = transaccionesEgresosUnificadas
      .filter((t: any) => String(t.cuenta_codigo || "").startsWith("51"))
      .reduce((sum: number, t: any) => sum + (Number(t.monto_total) || 0), 0);

    const totalOtrosGastos = transaccionesEgresosUnificadas
      .filter((t: any) => t.cuenta_codigo === "5204")
      .reduce((sum: number, t: any) => sum + (Number(t.monto_total) || 0), 0);

    return {
      totalTransacciones: transaccionesEgresosUnificadas.length,
      montoTotal: transaccionesEgresosUnificadas.reduce((sum: number, t: any) => sum + (Number(t.monto_total) || 0), 0),
      montoPagado: transaccionesEgresosUnificadas.reduce((sum: number, t: any) => sum + (Number(t.monto_pagado) || 0), 0),
      montoPendiente: transaccionesEgresosUnificadas.reduce((sum: number, t: any) => sum + (Number(t.monto_pendiente) || 0), 0),
      totalCostos,
      totalGastos,
      totalOtrosGastos,
      totalGlobalEgresos: totalCostos + totalGastos + totalOtrosGastos,
    };
  }, [transaccionesEgresosUnificadas]);

  const formatMonto = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getTipoEgresoDisplay = (transaccion: any) => {
    const codigo = transaccion.cuenta_codigo;

    if (codigo === "5001" || codigo === "5003" || codigo === "5004") {
      return { label: "Costos de Venta", className: "bg-red-100 text-red-700 border-red-300" };
    }
    if (codigo === "5002") {
      return { label: "Costo de Venta Inventario", className: "bg-purple-100 text-purple-700 border-purple-300" };
    }
    if (codigo === "5204") {
      return { label: "Otros Gastos", className: "bg-gray-100 text-gray-700 border-gray-300" };
    }
    if (String(codigo || "").startsWith("51")) {
      return { label: "Gastos Operativos", className: "bg-orange-100 text-orange-700 border-orange-300" };
    }
    return { label: "Sin categoría", className: "bg-gray-50 text-gray-600 border-gray-200" };
  };

  const loadAsientosContables = async (transaccionId: string) => {
    setLoadingAsientos(true);
    setCurrentAsientos(null);

    try {
      
      const numeroAsientoBuscado = `EGR-${transaccionId}`;

      const json = await apiFetch(`/api/journal/asientos/by-ref/${encodeURIComponent(numeroAsientoBuscado)}`, {
        method: "GET",
      });

      const asiento = (json?.data ?? json) as Asiento | null;
      setCurrentAsientos(asiento || null);
    } catch (error: any) {
      console.error("Error en loadAsientosContables:", error);
      toast({
        title: "Error",
        description: error?.status === 404 ? "No se encontró asiento para esta transacción" : "Error inesperado al cargar asientos",
        variant: "destructive",
      });
      setCurrentAsientos(null);
    } finally {
      setLoadingAsientos(false);
    }
  };

  const handleUploadComprobante = async (file: File) => {
    if (!selectedTransaction) return;

    // validación simple
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: "Máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingComprobante(true);
    try {
      // 1) subir archivo al backend (multipart) -> retorna URL pública
      const form = new FormData();
      form.append("file", file);
      form.append("transaccionId", selectedTransaction.id);

      // Nota: apiFetch probablemente hace JSON, así que aquí usamos fetch nativo con credentials.
      const resp = await fetch("/api/uploads/comprobante-egreso", {
        method: "POST",
        credentials: "include",
        body: form,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw Object.assign(new Error(text || "Upload failed"), { status: resp.status });
      }

      const uploadJson = await resp.json();
      const publicUrl = uploadJson?.data?.publicUrl ?? uploadJson?.publicUrl;
      if (!publicUrl) throw new Error("El backend no devolvió publicUrl");

      // 2) guardar URL en la transacción
      await apiFetch(`/api/egresos/${encodeURIComponent(selectedTransaction.id)}/comprobante`, {
        method: "PATCH",
        body: JSON.stringify({ imagen_comprobante: publicUrl }),
      });

      toast({
        title: "Comprobante cargado",
        description: "El comprobante se ha cargado exitosamente",
      });

      // actualizar local
      setSelectedTransaction((prev: any) => ({
        ...prev,
        imagen_comprobante: publicUrl,
        imagen_url: prev?.imagen_url || publicUrl,
      }));
    } catch (error: any) {
      console.error("Error uploading comprobante:", error);
      toast({
        title: "Error",
        description: error?.status === 401 ? "Tu sesión expiró. Inicia sesión nuevamente." : "Error al cargar el comprobante",
        variant: "destructive",
      });
    } finally {
      setUploadingComprobante(false);
    }
  };

  const handleCancelarTransaccion = async () => {
    if (!transaccionACancelar || !motivoCancelacion.trim()) {
      toast({
        title: "Error",
        description: "Por favor proporciona un motivo de cancelación",
        variant: "destructive",
      });
      return;
    }

    setIsCanceling(true);
    try {
      await apiFetch(`/api/egresos/${encodeURIComponent(transaccionACancelar.id)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ motivoCancelacion }),
      });

      toast({
        title: "Transacción cancelada",
        description: "La transacción ha sido cancelada exitosamente",
      });

      setIsCancelDialogOpen(false);
      setMotivoCancelacion("");
      setTransaccionACancelar(null);

      // en vez de reload duro, podrías invalidar queries si usas react-query.
      window.location.reload();
    } catch (error: any) {
      console.error("Error cancelando transacción:", error);
      toast({
        title: "Error",
        description: error?.status === 404 ? "No se encontró la transacción" : "No se pudo cancelar la transacción",
        variant: "destructive",
      });
    } finally {
      setIsCanceling(false);
    }
  };

  const limpiarFiltros = () => {
    setSearchTerm("");
    setFilterTipo("todos");
    setFilterProveedor("todos");
    setFilterPago("todos");
    setFilterEstado("todos");
    setFilterMes("todos");
    setFilterAno("todos");
    setFilterFechaInicio("");
    setFilterFechaFin("");
    setFilterCategoriaContable("todos");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Egresos</CardTitle>
          <CardDescription>Cargando transacciones...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Resumen de Egresos</CardTitle>
              <CardDescription>
                Historial de costos y gastos registrados ({transaccionesFiltradas.length} de{" "}
                {transacciones.filter((t: any) => t.tipo_egreso === "costo" || t.tipo_egreso === "gasto").length} transacciones)
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar</label>
                  <Input placeholder="Buscar por descripción o proveedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de Egreso</label>
                  <Select value={filterTipo} onValueChange={setFilterTipo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="costo">Costos</SelectItem>
                      <SelectItem value="gasto">Gastos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Proveedor</label>
                  <Select value={filterProveedor} onValueChange={setFilterProveedor}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {proveedoresUnicos.map((prov) => (
                        <SelectItem key={prov} value={prov}>
                          {prov}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de Pago</label>
                  <Select value={filterPago} onValueChange={setFilterPago}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="contado">Contado</SelectItem>
                      <SelectItem value="credito">Crédito</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoría Contable</label>
                  <Select value={filterCategoriaContable} onValueChange={setFilterCategoriaContable}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="costos">Costos de Venta (5001-5004)</SelectItem>
                      <SelectItem value="gastos">Gastos Operativos (5101-5108)</SelectItem>
                      <SelectItem value="otros_gastos">Otros Gastos (5204)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado de Pago</label>
                  <Select value={filterEstado} onValueChange={setFilterEstado}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pagado">Pagado</SelectItem>
                      <SelectItem value="pendiente">Con Saldo Pendiente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Mes</label>
                  <Select value={filterMes} onValueChange={setFilterMes}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="1">Enero</SelectItem>
                      <SelectItem value="2">Febrero</SelectItem>
                      <SelectItem value="3">Marzo</SelectItem>
                      <SelectItem value="4">Abril</SelectItem>
                      <SelectItem value="5">Mayo</SelectItem>
                      <SelectItem value="6">Junio</SelectItem>
                      <SelectItem value="7">Julio</SelectItem>
                      <SelectItem value="8">Agosto</SelectItem>
                      <SelectItem value="9">Septiembre</SelectItem>
                      <SelectItem value="10">Octubre</SelectItem>
                      <SelectItem value="11">Noviembre</SelectItem>
                      <SelectItem value="12">Diciembre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Año</label>
                  <Select value={filterAno} onValueChange={setFilterAno}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {anosUnicos.map((ano) => (
                        <SelectItem key={ano} value={ano.toString()}>
                          {ano}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha Inicio</label>
                  <Input type="date" value={filterFechaInicio} onChange={(e) => setFilterFechaInicio(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha Fin</label>
                  <Input type="date" value={filterFechaFin} onChange={(e) => setFilterFechaFin(e.target.value)} />
                </div>

                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="w-full">
                    <X className="h-4 w-4 mr-2" />
                    Limpiar Filtros
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Transacciones</div>
                  <div className="text-lg font-semibold">{resumenFiltrado.totalTransacciones}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Monto Total</div>
                  <div className="text-lg font-semibold text-primary">${formatMonto(resumenFiltrado.montoTotal)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Pagado</div>
                  <div className="text-lg font-semibold text-green-600">${formatMonto(resumenFiltrado.montoPagado)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Pendiente</div>
                  <div className="text-lg font-semibold text-yellow-600">${formatMonto(resumenFiltrado.montoPendiente)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Costos de Venta (5001-5004)</div>
                  <div className="text-lg font-semibold text-purple-600">${formatMonto(resumenFiltrado.totalCostos)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Gastos Operativos (5101-5108)</div>
                  <div className="text-lg font-semibold text-orange-600">${formatMonto(resumenFiltrado.totalGastos)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Otros Gastos (5204)</div>
                  <div className="text-lg font-semibold text-gray-600">${formatMonto(resumenFiltrado.totalOtrosGastos)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Total de Egresos</div>
                  <div className="text-lg font-semibold text-primary">${formatMonto(resumenFiltrado.totalGlobalEgresos)}</div>
                </div>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {transaccionesFiltadasPorCategoria.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No hay egresos registrados</p>
              <p className="text-sm mt-2">Los costos (5001-5004) y gastos (5101-5108) aparecerán aquí</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Imagen</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Tipo de Egreso</TableHead>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Costo Unit.</TableHead>
                    <TableHead className="text-right">Monto Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {transaccionesFiltadasPorCategoria.map((transaccion: any) => (
                    <TableRow key={transaccion.id}>
                      <TableCell>
                        <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center border">
                          {transaccion.imagen_url ? (
                            <img
                              src={transaccion.imagen_url}
                              alt={transaccion.descripcion}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        {new Date(transaccion.created_at).toLocaleDateString("es-MX", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">{transaccion.descripcion}</div>
                        <div className="text-xs text-muted-foreground">
                          {String(transaccion.cuenta_codigo || "").startsWith("50") ? "Costo de Venta" : "Gasto Operativo"}
                        </div>
                      </TableCell>

                      <TableCell>
                        {(() => {
                          const tipoInfo = getTipoEgresoDisplay(transaccion);
                          return (
                            <Badge variant="outline" className={`${tipoInfo.className} text-xs font-medium`}>
                              {tipoInfo.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={String(transaccion.cuenta_codigo || "").startsWith("50") ? "destructive" : "default"}
                          className="font-mono text-xs"
                        >
                          {transaccion.cuenta_codigo || "N/A"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {transaccion.proveedor_nombre ? (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{transaccion.proveedor_nombre}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground opacity-50" />
                            <span className="text-xs text-muted-foreground italic">Sin proveedor asignado</span>
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {transaccion.cantidad ? <span className="font-medium">{transaccion.cantidad}</span> : <span className="text-muted-foreground text-xs">-</span>}
                      </TableCell>

                      <TableCell className="text-right">
                        {transaccion.costo_unitario ? (
                          <span className="font-medium">${formatMonto(Number(transaccion.costo_unitario) || 0)}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <span className={`font-semibold ${String(transaccion.cuenta_codigo || "").startsWith("50") ? "text-purple-600" : "text-orange-600"}`}>
                          ${formatMonto(Number(transaccion.monto_total) || 0)}
                        </span>

                        {Number(transaccion.monto_pagado) > 0 && Number(transaccion.monto_pagado) < Number(transaccion.monto_total) && (
                          <div className="text-xs text-green-600">Pagado: ${formatMonto(Number(transaccion.monto_pagado) || 0)}</div>
                        )}
                        {Number(transaccion.monto_pendiente) > 0 && (
                          <div className="text-xs text-yellow-600">Pendiente: ${formatMonto(Number(transaccion.monto_pendiente) || 0)}</div>
                        )}
                      </TableCell>

                      <TableCell>
                        {transaccion.estado === "cancelado" ? <Badge variant="destructive">❌ Cancelada</Badge> : <Badge variant="outline">✅ Activa</Badge>}
                      </TableCell>

                      <TableCell>
                        <div className="flex gap-2">
                          {/* Ver Detalle */}
                          <Dialog
                            onOpenChange={(open) => {
                              if (open) {
                                setSelectedTransaction(transaccion);
                                loadAsientosContables(transaccion.id);
                              } else {
                                setCurrentAsientos(null);
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="Ver detalles completos">
                                <FileText className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>

                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Detalles de la Transacción</DialogTitle>
                                <DialogDescription>Información completa y asientos contables</DialogDescription>
                              </DialogHeader>

                              {selectedTransaction && (
                                <Tabs defaultValue="general" className="w-full">
                                  <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="general">Información General</TabsTrigger>
                                    <TabsTrigger value="registros">Registros Contables</TabsTrigger>
                                  </TabsList>

                                  <TabsContent value="general" className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <h4 className="font-semibold text-sm mb-2">Información General</h4>
                                        <div className="space-y-1 text-sm">
                                          <p>
                                            <span className="font-medium">Descripción:</span> {selectedTransaction.descripcion}
                                          </p>
                                          <p>
                                            <span className="font-medium">Tipo:</span> {selectedTransaction.tipo_egreso}
                                          </p>
                                          <p>
                                            <span className="font-medium">Método de Pago:</span> {selectedTransaction.metodo_pago || "N/A"}
                                          </p>
                                          <p>
                                            <span className="font-medium">Tipo de Pago:</span> {selectedTransaction.tipo_pago || "N/A"}
                                          </p>
                                          <p>
                                            <span className="font-medium">Fecha:</span> {new Date(selectedTransaction.created_at).toLocaleDateString("es-ES")}
                                          </p>
                                        </div>
                                      </div>

                                      <div>
                                        <h4 className="font-semibold text-sm mb-2">Montos</h4>
                                        <div className="space-y-1 text-sm">
                                          <p>
                                            <span className="font-medium">Total:</span> ${formatMonto(Number(selectedTransaction.monto_total) || 0)}
                                          </p>
                                          <p>
                                            <span className="font-medium">Pagado:</span> ${formatMonto(Number(selectedTransaction.monto_pagado) || 0)}
                                          </p>
                                          <p>
                                            <span className="font-medium">Pendiente:</span> ${formatMonto(Number(selectedTransaction.monto_pendiente) || 0)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    {selectedTransaction.proveedor_nombre && (
                                      <div>
                                        <h4 className="font-semibold text-sm mb-2">Información del Proveedor</h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                          <p>
                                            <span className="font-medium">Nombre:</span> {selectedTransaction.proveedor_nombre}
                                          </p>
                                          {selectedTransaction.proveedor_telefono && (
                                            <p>
                                              <span className="font-medium">Teléfono:</span> {selectedTransaction.proveedor_telefono}
                                            </p>
                                          )}
                                          {selectedTransaction.proveedor_email && (
                                            <p>
                                              <span className="font-medium">Email:</span> {selectedTransaction.proveedor_email}
                                            </p>
                                          )}
                                          {selectedTransaction.proveedor_rfc && (
                                            <p>
                                              <span className="font-medium">RFC:</span> {selectedTransaction.proveedor_rfc}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {selectedTransaction.comentarios && (
                                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md">
                                        <p className="font-medium text-blue-700 dark:text-blue-300 text-sm mb-1">💬 Comentarios</p>
                                        <p className="text-blue-600 dark:text-blue-400 text-sm">{selectedTransaction.comentarios}</p>
                                      </div>
                                    )}
                                  </TabsContent>

                                  <TabsContent value="registros" className="space-y-4">
                                    {loadingAsientos ? (
                                      <div className="text-center py-8">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                        <p className="mt-2 text-sm text-muted-foreground">Cargando asientos contables...</p>
                                      </div>
                                    ) : currentAsientos?.detalles?.length ? (
                                      <div>
                                        <div className="border-b pb-3 mb-4">
                                          <h4 className="font-semibold text-base">Asiento Contable</h4>
                                          <p className="text-sm text-muted-foreground mt-1">Asiento #{currentAsientos.numero_asiento}</p>
                                        </div>

                                        <div className="overflow-x-auto">
                                          <table className="w-full text-sm border rounded-lg overflow-hidden">
                                            <thead className="bg-muted">
                                              <tr>
                                                <th className="p-3 text-left">Cuenta</th>
                                                <th className="p-3 text-left">Descripción</th>
                                                <th className="p-3 text-right">Debe</th>
                                                <th className="p-3 text-right">Haber</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {currentAsientos.detalles.map((detalle, idx) => (
                                                <tr key={idx} className="border-b last:border-0">
                                                  <td className="p-3">
                                                    <div className="font-mono font-semibold">{detalle.cuenta_codigo}</div>
                                                    <div className="text-xs text-muted-foreground">{detalle.cuenta_nombre}</div>
                                                  </td>
                                                  <td className="p-3">{detalle.descripcion}</td>
                                                  <td className="p-3 text-right">
                                                    {detalle.debe > 0 ? (
                                                      <span className="text-red-600 font-semibold">${formatMonto(Number(detalle.debe) || 0)}</span>
                                                    ) : (
                                                      <span className="text-muted-foreground">-</span>
                                                    )}
                                                  </td>
                                                  <td className="p-3 text-right">
                                                    {detalle.haber > 0 ? (
                                                      <span className="text-green-600 font-semibold">${formatMonto(Number(detalle.haber) || 0)}</span>
                                                    ) : (
                                                      <span className="text-muted-foreground">-</span>
                                                    )}
                                                  </td>
                                                </tr>
                                              ))}
                                              <tr className="border-t-2 bg-muted/50 font-bold">
                                                <td colSpan={2} className="p-3">
                                                  TOTALES
                                                </td>
                                                <td className="p-3 text-right text-red-600">
                                                  ${formatMonto(currentAsientos.detalles.reduce((sum, d) => sum + (Number(d.debe) || 0), 0))}
                                                </td>
                                                <td className="p-3 text-right text-green-600">
                                                  ${formatMonto(currentAsientos.detalles.reduce((sum, d) => sum + (Number(d.haber) || 0), 0))}
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="p-8 bg-muted/50 rounded-lg text-center">
                                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                        <p className="text-sm text-muted-foreground">No se encontraron registros contables para esta transacción</p>
                                      </div>
                                    )}
                                  </TabsContent>
                                </Tabs>
                              )}

                              {/* Comprobante fotográfico */}
                              <div className="border-t pt-4 mt-6">
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                  <ImageIcon className="h-4 w-4" />
                                  Comprobante Fotográfico
                                </h4>

                                {selectedTransaction?.imagen_comprobante ? (
                                  <div className="space-y-2">
                                    <div className="rounded-lg overflow-hidden border">
                                      <img
                                        src={selectedTransaction.imagen_comprobante}
                                        alt="Comprobante"
                                        className="w-full h-auto max-h-96 object-contain bg-muted"
                                      />
                                    </div>
                                    <a
                                      href={selectedTransaction.imagen_comprobante}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary hover:underline inline-block"
                                    >
                                      Ver imagen completa en nueva pestaña
                                    </a>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="p-4 bg-muted/50 rounded-lg text-center text-sm text-muted-foreground">
                                      No hay comprobante cargado para esta transacción
                                    </div>

                                    <div className="flex flex-col items-center gap-2">
                                      <label htmlFor="comprobante-upload" className="cursor-pointer">
                                        <div className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium inline-flex items-center gap-2">
                                          <ImageIcon className="h-4 w-4" />
                                          {uploadingComprobante ? "Cargando..." : "Cargar Comprobante"}
                                        </div>
                                      </label>
                                      <input
                                        id="comprobante-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        disabled={uploadingComprobante}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleUploadComprobante(file);
                                        }}
                                      />
                                      <p className="text-xs text-muted-foreground">Formatos soportados: JPG, PNG, WEBP (Máx. 5MB)</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>

                          {/* Cancelar */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                            disabled={transaccion.estado === "cancelado" || isCanceling}
                            onClick={() => {
                              setTransaccionACancelar(transaccion);
                              setIsCancelDialogOpen(true);
                            }}
                            title={transaccion.estado === "cancelado" ? "Transacción ya cancelada" : "Cancelar transacción"}
                          >
                            ❌
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Costos de Venta (5001-5004)</div>
                    <div className="text-lg font-bold text-purple-600">${formatMonto(resumenFiltrado.totalCostos)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Gastos Operativos (5101-5108)</div>
                    <div className="text-lg font-bold text-orange-600">${formatMonto(resumenFiltrado.totalGastos)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Total de Egresos</div>
                    <div className="text-lg font-bold text-primary">${formatMonto(resumenFiltrado.totalGlobalEgresos)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de cancelación */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Transacción</DialogTitle>
            <DialogDescription>Esta acción creará un asiento de reversión y marcará la transacción como cancelada.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Motivo de Cancelación *</Label>
              <Textarea
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                placeholder="Describe el motivo de la cancelación..."
                rows={4}
              />
            </div>

            {transaccionACancelar && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <p className="font-medium mb-2">Transacción a cancelar:</p>
                <p>
                  <span className="font-medium">Descripción:</span> {transaccionACancelar.descripcion}
                </p>
                <p>
                  <span className="font-medium">Monto:</span> ${formatMonto(Number(transaccionACancelar.monto_total) || 0)}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCancelDialogOpen(false);
                setMotivoCancelacion("");
                setTransaccionACancelar(null);
              }}
              disabled={isCanceling}
            >
              Cerrar
            </Button>
            <Button variant="destructive" onClick={handleCancelarTransaccion} disabled={isCanceling || !motivoCancelacion.trim()}>
              {isCanceling ? "Cancelando..." : "Confirmar Cancelación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog legacy (mantenido por compat) */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Egreso</DialogTitle>
            <DialogDescription>Información completa de la transacción</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Este modal ya no se usa (los detalles están en el botón de documento). Puedes eliminarlo más adelante sin afectar funcionalidad.
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ResumenEgresos;
