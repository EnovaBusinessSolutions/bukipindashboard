import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Calendar, User, DollarSign, CreditCard, Image as ImageIcon, Filter, X, BookOpen, Package } from "lucide-react";
import { useTransaccionesEgresos } from "@/hooks/useTransaccionesEgresos";
import { useCostosVentaInventario } from "@/hooks/useCostosVentaInventario";
import { useComprasInventario } from "@/hooks/useComprasInventario";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCuentas } from "@/hooks/useCuentas";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ResumenEgresos = () => {
  const { transacciones, loading } = useTransaccionesEgresos(200);
  const { data: costosVentaInventario, isLoading: loadingCostosVenta } = useCostosVentaInventario();
  const { data: comprasInventario, isLoading: loadingComprasInventario } = useComprasInventario();
  const { data: cuentasData } = useCuentas();
  const { toast } = useToast();
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingAsientos, setLoadingAsientos] = useState(false);
  const [currentAsientos, setCurrentAsientos] = useState<any>(null);
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

  // Obtener valores únicos para filtros
  const proveedoresUnicos = useMemo(() => {
    const proveedores = new Set<string>();
    transacciones.forEach(t => {
      if (t.proveedor_nombre) proveedores.add(t.proveedor_nombre);
    });
    return Array.from(proveedores).sort();
  }, [transacciones]);

  const anosUnicos = useMemo(() => {
    const anos = new Set<number>();
    transacciones.forEach(t => {
      const fecha = new Date(t.created_at);
      anos.add(fecha.getFullYear());
    });
    return Array.from(anos).sort((a, b) => b - a);
  }, [transacciones]);

  // Filtrar transacciones
  const transaccionesFiltradas = useMemo(() => {
    return transacciones.filter((t) => {
      // Filtrar solo costos y gastos
      if (t.tipo_egreso !== 'costo' && t.tipo_egreso !== 'gasto') return false;
      
      const fecha = new Date(t.created_at);
      
      // Filtro por búsqueda
      if (searchTerm && !t.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !t.proveedor_nombre?.toLowerCase().includes(searchTerm.toLowerCase())) {
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
      if (filterMes !== "todos" && (fecha.getMonth() + 1) !== parseInt(filterMes)) return false;
      
      // Filtro por año
      if (filterAno !== "todos" && fecha.getFullYear() !== parseInt(filterAno)) return false;
      
      // Filtro por rango de fechas
      if (filterFechaInicio && fecha < new Date(filterFechaInicio)) return false;
      if (filterFechaFin && fecha > new Date(filterFechaFin + 'T23:59:59')) return false;
      
      return true;
    });
  }, [transacciones, searchTerm, filterTipo, filterProveedor, filterPago, filterEstado, filterMes, filterAno, filterFechaInicio, filterFechaFin]);

  // Calcular subtotales
  const resumenFiltrado = useMemo(() => {
    const totalCostosVentaInventario = costosVentaInventario?.reduce((sum, c) => sum + c.monto, 0) || 0;
    const totalComprasInventario = comprasInventario?.reduce((sum, c) => sum + c.costo_total, 0) || 0;
    
    return {
      totalTransacciones: transaccionesFiltradas.length,
      montoTotal: transaccionesFiltradas.reduce((sum, t) => sum + t.monto_total, 0),
      montoPagado: transaccionesFiltradas.reduce((sum, t) => sum + t.monto_pagado, 0),
      montoPendiente: transaccionesFiltradas.reduce((sum, t) => sum + t.monto_pendiente, 0),
      totalCostos: transaccionesFiltradas.filter(t => t.tipo_egreso === 'costo').reduce((sum, t) => sum + t.monto_total, 0),
      totalGastos: transaccionesFiltradas.filter(t => t.tipo_egreso === 'gasto').reduce((sum, t) => sum + t.monto_total, 0),
      totalComprasInventario,
      totalCostosVentaInventario,
      totalCostosGlobal: transaccionesFiltradas.filter(t => t.tipo_egreso === 'costo').reduce((sum, t) => sum + t.monto_total, 0) + totalCostosVentaInventario,
    };
  }, [transaccionesFiltradas, costosVentaInventario, comprasInventario]);

  const getTipoEgresoBadge = (tipo: string) => {
    const variants: Record<string, any> = {
      'costo': 'destructive',
      'gasto': 'default',
      'otro': 'secondary'
    };
    return variants[tipo] || 'default';
  };

  const getTipoPagoBadge = (tipo: string) => {
    const variants: Record<string, any> = {
      'contado': 'default',
      'credito': 'secondary',
      'parcial': 'outline'
    };
    return variants[tipo] || 'default';
  };

  const formatMonto = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleViewDetails = async (transaction: any) => {
    setSelectedTransaction(transaction);
    setDetailsOpen(true);
    await loadAsientosContables(transaction.id);
  };

  const loadAsientosContables = async (transaccionId: string) => {
    setLoadingAsientos(true);
    setCurrentAsientos(null);
    try {
      // Buscar el asiento contable relacionado con esta transacción de egreso
      // Buscaremos por descripción que contenga el ID de la transacción
      const { data: asientos, error: asientosError } = await supabase
        .from('asientos_contables')
        .select('*')
        .ilike('descripcion', `%${transaccionId}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (asientosError) {
        console.error("Error loading asiento:", asientosError);
        setLoadingAsientos(false);
        return;
      }

      if (!asientos) {
        console.warn("No se encontró asiento para la transacción:", transaccionId);
        setLoadingAsientos(false);
        return;
      }

      // Obtener los detalles del asiento
      const { data: detalles, error: detallesError } = await supabase
        .from('detalle_asientos')
        .select('*')
        .eq('asiento_id', asientos.id);

      if (detallesError) {
        console.error("Error loading detalles:", detallesError);
        setLoadingAsientos(false);
        return;
      }

      // Obtener nombres de cuentas
      const { data: cuentas } = await supabase
        .from('cuentas')
        .select('codigo, nombre');

      const cuentasMap = new Map(cuentas?.map(c => [c.codigo, c.nombre]) || []);

      // Enriquecer detalles con nombres de cuentas
      const detallesEnriquecidos = detalles?.map(d => ({
        ...d,
        cuenta_nombre: cuentasMap.get(d.cuenta_codigo) || d.cuenta_codigo
      })) || [];

      const asientoCompleto = {
        ...asientos,
        detalles: detallesEnriquecidos
      };
      
      setCurrentAsientos(asientoCompleto);
    } catch (error) {
      console.error("Error en loadAsientosContables:", error);
      toast({
        title: "Error",
        description: "Error inesperado al cargar asientos",
        variant: "destructive"
      });
    } finally {
      setLoadingAsientos(false);
    }
  };

  const handleUploadComprobante = async (file: File) => {
    if (!selectedTransaction) return;
    
    setUploadingComprobante(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedTransaction.id}-${Date.now()}.${fileExt}`;
      const filePath = `comprobantes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('transacciones_egresos')
        .update({ imagen_comprobante: publicUrl })
        .eq('id', selectedTransaction.id);

      if (updateError) throw updateError;

      toast({
        title: "Comprobante cargado",
        description: "El comprobante se ha cargado exitosamente"
      });

      // Actualizar la transacción seleccionada
      setSelectedTransaction({
        ...selectedTransaction,
        imagen_comprobante: publicUrl
      });

    } catch (error: any) {
      console.error('Error uploading comprobante:', error);
      toast({
        title: "Error",
        description: "Error al cargar el comprobante",
        variant: "destructive"
      });
    } finally {
      setUploadingComprobante(false);
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
  };

  const getCuentasAfectadas = (transaction: any) => {
    const cuentas = [];
    
    // Cuenta de debe (gasto o costo)
    if (transaction.cuenta_codigo) {
      const cuenta = cuentasData?.cuentasFlat.find(c => c.codigo === transaction.cuenta_codigo);
      cuentas.push({
        tipo: "Debe (Cargo)",
        codigo: transaction.cuenta_codigo,
        nombre: cuenta?.nombre || "Cuenta de egreso",
        monto: transaction.monto_total
      });
    }
    
    // Cuenta de haber (forma de pago)
    if (transaction.metodo_pago === "efectivo") {
      cuentas.push({
        tipo: "Haber (Abono)",
        codigo: "1001",
        nombre: "Efectivo",
        monto: transaction.monto_pagado
      });
    } else if (transaction.metodo_pago === "transferencia") {
      cuentas.push({
        tipo: "Haber (Abono)",
        codigo: "1002",
        nombre: "Bancos",
        monto: transaction.monto_pagado
      });
    } else if (transaction.metodo_pago === "tarjeta_credito") {
      cuentas.push({
        tipo: "Haber (Abono)",
        codigo: "2102",
        nombre: "Tarjetas de Crédito",
        monto: transaction.monto_pagado
      });
    }
    
    // Si hay monto pendiente, agregar cuenta por pagar
    if (transaction.monto_pendiente > 0) {
      cuentas.push({
        tipo: "Haber (Abono)",
        codigo: "2001",
        nombre: "Cuentas por Pagar",
        monto: transaction.monto_pendiente
      });
    }
    
    return cuentas;
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
                Historial de costos y gastos registrados ({transaccionesFiltradas.length} de {transacciones.filter(t => t.tipo_egreso === 'costo' || t.tipo_egreso === 'gasto').length} transacciones)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
            </Button>
          </div>
          
          {showFilters && (
            <div className="mt-4 space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar</label>
                  <Input
                    placeholder="Buscar por descripción o proveedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
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
                  <Input
                    type="date"
                    value={filterFechaInicio}
                    onChange={(e) => setFilterFechaInicio(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha Fin</label>
                  <Input
                    type="date"
                    value={filterFechaFin}
                    onChange={(e) => setFilterFechaFin(e.target.value)}
                  />
                </div>
                
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={limpiarFiltros}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpiar Filtros
                  </Button>
                </div>
              </div>
              
              {/* Resumen de datos filtrados */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Transacciones</div>
                  <div className="text-lg font-semibold">{resumenFiltrado.totalTransacciones}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Monto Total</div>
                  <div className="text-lg font-semibold text-primary">
                    ${formatMonto(resumenFiltrado.montoTotal)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Pagado</div>
                  <div className="text-lg font-semibold text-green-600">
                    ${formatMonto(resumenFiltrado.montoPagado)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Pendiente</div>
                  <div className="text-lg font-semibold text-yellow-600">
                    ${formatMonto(resumenFiltrado.montoPendiente)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Costos Manuales</div>
                  <div className="text-lg font-semibold text-destructive">
                    ${formatMonto(resumenFiltrado.totalCostos)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Compras Inventario</div>
                  <div className="text-lg font-semibold text-blue-600">
                    ${formatMonto(resumenFiltrado.totalComprasInventario)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Costo Venta Inventario</div>
                  <div className="text-lg font-semibold text-purple-600">
                    ${formatMonto(resumenFiltrado.totalCostosVentaInventario)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Total Gastos</div>
                  <div className="text-lg font-semibold text-orange-600">
                    ${formatMonto(resumenFiltrado.totalGastos)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="egresos-manuales" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="egresos-manuales">
                <FileText className="h-4 w-4 mr-2" />
                Egresos Manuales
              </TabsTrigger>
              <TabsTrigger value="compras-inventario">
                <Package className="h-4 w-4 mr-2" />
                Compras Inventario
              </TabsTrigger>
              <TabsTrigger value="costos-inventario">
                <Package className="h-4 w-4 mr-2" />
                Costos Venta
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="egresos-manuales">
              {transaccionesFiltradas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No hay costos o gastos manuales registrados aún</p>
                  <p className="text-sm mt-2">Los costos y gastos que registres aparecerán aquí</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Imagen</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Asiento</TableHead>
                        <TableHead>Monto Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transaccionesFiltradas.map((transaccion) => (
                        <TableRow key={transaccion.id}>
                          <TableCell>
                            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                              {transaccion.imagen_comprobante ? (
                                <img 
                                  src={transaccion.imagen_comprobante} 
                                  alt="Imagen" 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {new Date(transaccion.created_at).toLocaleDateString('es-MX', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getTipoEgresoBadge(transaccion.tipo_egreso)}>
                              {transaccion.tipo_egreso}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="font-medium truncate">{transaccion.descripcion}</div>
                            {transaccion.comentarios && (
                              <div className="text-xs text-muted-foreground truncate mt-1">
                                {transaccion.comentarios.substring(0, 50)}
                                {transaccion.comentarios.length > 50 && '...'}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {transaccion.proveedor_nombre || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              <BookOpen className="h-3 w-3 mr-1" />
                              EGR-{transaccion.id.substring(0, 8)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold">
                              ${formatMonto(transaccion.monto_total)}
                            </span>
                            {transaccion.monto_pagado > 0 && (
                              <div className="text-xs text-green-600">
                                Pagado: ${formatMonto(transaccion.monto_pagado)}
                              </div>
                            )}
                            {transaccion.monto_pendiente > 0 && (
                              <div className="text-xs text-yellow-600">
                                Pendiente: ${formatMonto(transaccion.monto_pendiente)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {transaccion.monto_pendiente > 0 ? (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                Pendiente
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Pagado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(transaccion)}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Ver Detalle
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="compras-inventario">
              {loadingComprasInventario ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Cargando compras de inventario...</p>
                </div>
              ) : !comprasInventario || comprasInventario.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No hay compras de inventario registradas</p>
                  <p className="text-sm mt-2">Las compras de inventario que realices aparecerán aquí</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead className="text-right">Costo Unitario</TableHead>
                        <TableHead className="text-right">Costo Total</TableHead>
                        <TableHead>Descripción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comprasInventario.map((compra) => (
                        <TableRow key={compra.id}>
                          <TableCell className="whitespace-nowrap">
                            {new Date(compra.fecha).toLocaleDateString('es-MX', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-blue-600" />
                              {compra.producto_nombre}
                            </div>
                          </TableCell>
                          <TableCell>
                            {compra.cantidad}
                          </TableCell>
                          <TableCell className="text-right">
                            ${formatMonto(compra.costo_unitario)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-blue-600">
                              ${formatMonto(compra.costo_total)}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {compra.descripcion || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 p-4 bg-muted rounded-lg flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Total de compras de inventario
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      ${formatMonto(resumenFiltrado.totalComprasInventario)}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="costos-inventario">
              {loadingCostosVenta ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Cargando costos de venta...</p>
                </div>
              ) : !costosVentaInventario || costosVentaInventario.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No hay costos de venta de inventario registrados</p>
                  <p className="text-sm mt-2">Los costos se generan automáticamente al vender productos inventariados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Número de Asiento</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costosVentaInventario.map((costo) => (
                        <TableRow key={costo.id}>
                          <TableCell className="whitespace-nowrap">
                            {new Date(costo.fecha).toLocaleDateString('es-MX', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-purple-600" />
                              {costo.producto_nombre}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {costo.descripcion}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {costo.numero_asiento}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-purple-600">
                              ${formatMonto(costo.monto)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 p-4 bg-muted rounded-lg flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Total de costos de venta de inventario
                    </div>
                    <div className="text-2xl font-bold text-purple-600">
                      ${formatMonto(resumenFiltrado.totalCostosVentaInventario)}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog de detalles */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Egreso</DialogTitle>
            <DialogDescription>
              Información completa de la transacción
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4">
              {/* Información general */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Fecha
                  </div>
                  <div className="font-medium">
                    {new Date(selectedTransaction.created_at).toLocaleString('es-MX', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Tipo de Egreso</div>
                  <Badge variant={getTipoEgresoBadge(selectedTransaction.tipo_egreso)}>
                    {selectedTransaction.tipo_egreso}
                  </Badge>
                  {selectedTransaction.subtipo_egreso && (
                    <span className="text-sm text-muted-foreground ml-2">
                      ({selectedTransaction.subtipo_egreso})
                    </span>
                  )}
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Descripción</div>
                <div className="font-medium">{selectedTransaction.descripcion}</div>
              </div>

              {/* Cantidades y precios */}
              {selectedTransaction.cantidad && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Cantidad</div>
                    <div className="font-medium">{selectedTransaction.cantidad}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Precio Unitario</div>
                    <div className="font-medium">
                      ${formatMonto(selectedTransaction.precio_unitario || 0)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Total</div>
                    <div className="font-medium text-lg">
                      ${formatMonto(selectedTransaction.monto_total)}
                    </div>
                  </div>
                </div>
              )}

              {/* Información de pago */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Información de Pago
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Tipo de Pago</div>
                    <Badge variant={getTipoPagoBadge(selectedTransaction.tipo_pago)}>
                      {selectedTransaction.tipo_pago}
                    </Badge>
                  </div>
                  {selectedTransaction.metodo_pago && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Método de Pago</div>
                      <div className="font-medium">{selectedTransaction.metodo_pago}</div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Monto Pagado</div>
                    <div className="font-medium text-green-600">
                      ${formatMonto(selectedTransaction.monto_pagado)}
                    </div>
                  </div>
                  {selectedTransaction.monto_pendiente > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Monto Pendiente</div>
                      <div className="font-medium text-yellow-600">
                        ${formatMonto(selectedTransaction.monto_pendiente)}
                      </div>
                    </div>
                  )}
                  {selectedTransaction.fecha_vencimiento && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Fecha de Vencimiento</div>
                      <div className="font-medium">
                        {new Date(selectedTransaction.fecha_vencimiento).toLocaleDateString('es-MX')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Información del proveedor */}
              {selectedTransaction.proveedor_nombre && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Información del Proveedor
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Nombre</div>
                      <div className="font-medium">{selectedTransaction.proveedor_nombre}</div>
                    </div>
                    {selectedTransaction.proveedor_telefono && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Teléfono</div>
                        <div className="font-medium">{selectedTransaction.proveedor_telefono}</div>
                      </div>
                    )}
                    {selectedTransaction.proveedor_email && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Email</div>
                        <div className="font-medium">{selectedTransaction.proveedor_email}</div>
                      </div>
                    )}
                    {selectedTransaction.proveedor_rfc && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">RFC</div>
                        <div className="font-medium">{selectedTransaction.proveedor_rfc}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comentarios */}
              {selectedTransaction.comentarios && (
                <div className="border-t pt-4">
                  <div className="text-sm text-muted-foreground mb-2">Comentarios</div>
                  <div className="text-sm bg-muted p-3 rounded-md">
                    {selectedTransaction.comentarios}
                  </div>
                </div>
              )}

              {/* Asientos Contables en Balanza */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Asientos en Balanza de Comprobación
                </h4>
                {loadingAsientos ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Cargando asientos contables...
                  </div>
                ) : !currentAsientos ? (
                  <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center">
                    No se encontraron asientos contables para esta transacción
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Número de Asiento:</span> {currentAsientos.numero_asiento}
                        </div>
                        <div>
                          <span className="font-medium">Fecha:</span>{' '}
                          {new Date(currentAsientos.fecha).toLocaleDateString('es-ES')}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Descripción:</span> {currentAsientos.descripcion}
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-3 text-sm font-medium">Cuenta</th>
                            <th className="text-left p-3 text-sm font-medium">Descripción</th>
                            <th className="text-right p-3 text-sm font-medium">Debe</th>
                            <th className="text-right p-3 text-sm font-medium">Haber</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentAsientos.detalles?.map((detalle: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="p-3 text-sm">
                                <div className="font-medium">{detalle.cuenta_codigo}</div>
                                <div className="text-xs text-muted-foreground">
                                  {detalle.cuenta_nombre}
                                </div>
                              </td>
                              <td className="p-3 text-sm">{detalle.descripcion}</td>
                              <td className="p-3 text-sm text-right font-medium">
                                {detalle.debe > 0 ? `$${formatMonto(detalle.debe)}` : '-'}
                              </td>
                              <td className="p-3 text-sm text-right font-medium">
                                {detalle.haber > 0 ? `$${formatMonto(detalle.haber)}` : '-'}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t-2 bg-muted/50 font-bold">
                            <td colSpan={2} className="p-3 text-sm">
                              TOTALES
                            </td>
                            <td className="p-3 text-sm text-right">
                              ${formatMonto(currentAsientos.detalles?.reduce((sum: number, d: any) => sum + Number(d.debe), 0))}
                            </td>
                            <td className="p-3 text-sm text-right">
                              ${formatMonto(currentAsientos.detalles?.reduce((sum: number, d: any) => sum + Number(d.haber), 0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
                      <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                        💡 Información
                      </p>
                      <p className="text-blue-600 dark:text-blue-400">
                        Este asiento contable refleja cómo esta transacción afecta a las diferentes
                        cuentas en la balanza de comprobación y posteriormente en los estados financieros.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Comprobante fotográfico */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Comprobante Fotográfico
                </h4>
                {selectedTransaction.imagen_comprobante ? (
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
                          if (file) {
                            handleUploadComprobante(file);
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Formatos soportados: JPG, PNG, WEBP (Máx. 5MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ResumenEgresos;