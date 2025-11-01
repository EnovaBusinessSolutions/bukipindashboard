import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, ChevronDown, ChevronRight, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";

interface BalanzaEntry {
  fecha: string;
  tipo: string;
  descripcion: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: number;
  haber: number;
  referencia: string;
}

interface AsientoAgrupado {
  referencia: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  movimientos: BalanzaEntry[];
  totalDebe: number;
  totalHaber: number;
  categoriaFlujo?: string;
}

const Balanza = () => {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroEstadoFinanciero, setFiltroEstadoFinanciero] = useState<string>("todos");
  const [filtroBusqueda, setFiltroBusqueda] = useState<string>("");

  // Usar el hook simplificado que lee de detalle_asientos
  const { data: balanzaData, isLoading } = useAsientosBalanza(startDate, endDate);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando balanza...</p>
        </div>
      </div>
    );
  }

  if (!balanzaData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              No se pudieron cargar los datos de la balanza
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { movimientos, saldosPorCuenta } = balanzaData;

  // Si no hay movimientos, mostrar mensaje
  if (!movimientos || movimientos.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Balanza de Comprobación</h1>
          <p className="text-muted-foreground mb-6">
            Vista detallada de todos los movimientos contables del periodo
          </p>
        </div>
        <Card>
          <CardContent className="p-12">
            <div className="text-center space-y-2">
              <p className="text-xl font-medium text-muted-foreground">
                No hay movimientos contables registrados
              </p>
              <p className="text-sm text-muted-foreground">
                Comienza registrando transacciones para ver la balanza de comprobación
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Agrupar movimientos por referencia (asiento)
  const asientosAgrupados: Record<string, AsientoAgrupado> = {};

  movimientos.forEach((mov) => {
    if (!asientosAgrupados[mov.referencia]) {
      asientosAgrupados[mov.referencia] = {
        referencia: mov.referencia,
        fecha: mov.fecha,
        tipo: mov.tipo,
        descripcion: mov.descripcion,
        movimientos: [],
        totalDebe: 0,
        totalHaber: 0,
      };
    }

    asientosAgrupados[mov.referencia].movimientos.push(mov);
    asientosAgrupados[mov.referencia].totalDebe += mov.debe;
    asientosAgrupados[mov.referencia].totalHaber += mov.haber;
  });

  const asientosArray = Object.values(asientosAgrupados);
  
  // Identificar y asociar asientos de reversión con sus originales
  const asientosConReversion = asientosArray.map(asiento => {
    const esReversion = asiento.descripcion.includes('REVERSIÓN:');
    
    // Si es un asiento de reversión, no lo mostramos directamente
    if (esReversion) {
      return null;
    }
    
    // Buscar si este asiento tiene una reversión asociada
    const asientoReversion = asientosArray.find(a => {
      if (!a.descripcion.includes('REVERSIÓN:')) return false;
      
      // La reversión contiene "REVERSIÓN: " + descripción original
      const descripcionOriginal = a.descripcion.replace('REVERSIÓN: ', '');
      return descripcionOriginal.includes(asiento.descripcion.substring(0, 30)) ||
             asiento.descripcion.includes(descripcionOriginal.substring(0, 30));
    });
    
    return {
      ...asiento,
      esCancelado: !!asientoReversion,
      asientoReversion: asientoReversion || null
    };
  }).filter(Boolean) as (AsientoAgrupado & { esCancelado: boolean; asientoReversion: AsientoAgrupado | null })[];

  // Aplicar filtros
  let asientosFiltrados = asientosConReversion;

  if (filtroTipo !== "todos") {
    asientosFiltrados = asientosFiltrados.filter((a) => a.tipo === filtroTipo);
  }

  if (filtroEstado !== "todos") {
    asientosFiltrados = asientosFiltrados.filter((a) => {
      const diferencia = Math.abs(a.totalDebe - a.totalHaber);
      if (filtroEstado === "cuadrado") return diferencia < 0.01;
      if (filtroEstado === "descuadrado") return diferencia >= 0.01;
      return true;
    });
  }

  if (filtroEstadoFinanciero !== "todos") {
    asientosFiltrados = asientosFiltrados.filter((a) => {
      return a.movimientos.some((mov) => {
        const primerDigito = mov.cuenta_codigo.charAt(0);
        if (filtroEstadoFinanciero === "balance") {
          return ["1", "2", "3"].includes(primerDigito);
        } else if (filtroEstadoFinanciero === "resultados") {
          return ["4", "5", "6"].includes(primerDigito);
        }
        return true;
      });
    });
  }

  if (filtroBusqueda) {
    const busquedaLower = filtroBusqueda.toLowerCase();
    asientosFiltrados = asientosFiltrados.filter(
      (a) =>
        a.descripcion.toLowerCase().includes(busquedaLower) ||
        a.referencia.toLowerCase().includes(busquedaLower) ||
        a.movimientos.some(
          (m) =>
            m.cuenta_nombre.toLowerCase().includes(busquedaLower) ||
            m.cuenta_codigo.toLowerCase().includes(busquedaLower)
        )
    );
  }

  // Calcular totales
  const totalDebe = Object.values(saldosPorCuenta).reduce(
    (sum, cuenta) => sum + cuenta.debe_total,
    0
  );
  const totalHaber = Object.values(saldosPorCuenta).reduce(
    (sum, cuenta) => sum + cuenta.haber_total,
    0
  );
  const diferencia = Math.abs(totalDebe - totalHaber);
  const cuadra = diferencia < 0.01;

  const tiposUnicos = Array.from(new Set(asientosConReversion.map((a) => a.tipo))).sort();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Balanza de Comprobación</h1>
        <p className="text-muted-foreground mt-2">
          Vista detallada de todos los movimientos contables del periodo
        </p>
      </div>

      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros y Rango de Fechas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Inicio</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP", { locale: es }) : "Seleccionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Fin</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP", { locale: es }) : "Seleccionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Transacción</label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {tiposUnicos.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Estado del Asiento</label>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="cuadrado">Cuadrado</SelectItem>
                  <SelectItem value="descuadrado">Descuadrado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Estado Financiero</label>
              <Select
                value={filtroEstadoFinanciero}
                onValueChange={setFiltroEstadoFinanciero}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="balance">Balance General</SelectItem>
                  <SelectItem value="resultados">Estado de Resultados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Búsqueda</label>
              <Input
                placeholder="Buscar..."
                value={filtroBusqueda}
                onChange={(e) => setFiltroBusqueda(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Debe</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalDebe)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Haber</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalHaber)}</p>
          </CardContent>
        </Card>

        <Card className={cuadra ? "border-green-500" : "border-red-500"}>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${cuadra ? "text-green-600" : "text-red-600"}`}>
              {cuadra ? "✓ Cuadrado" : "✗ Descuadrado"}
            </p>
            {!cuadra && (
              <p className="text-sm text-muted-foreground mt-2">
                Diferencia: {formatCurrency(diferencia)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Asientos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Asientos Contables ({asientosFiltrados.length} de {asientosConReversion.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {asientosFiltrados.map((asiento) => {
              const diferencia = Math.abs(asiento.totalDebe - asiento.totalHaber);
              const cuadrado = diferencia < 0.01;

              const asientoItem = asiento as any;
              
              return (
                <Collapsible key={asiento.referencia}>
                  <Card className={
                    asientoItem.esCancelado 
                      ? "border-red-300 bg-red-50 dark:bg-red-950/20" 
                      : cuadrado ? "" : "border-red-300"
                  }>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1">
                              <div className="flex items-center gap-2">
                                {asientoItem.esCancelado && (
                                  <span className="text-lg">❌</span>
                                )}
                                <div>
                                  <p className="text-sm font-medium">{asiento.referencia}</p>
                                  <p className="text-xs text-muted-foreground">{asiento.fecha}</p>
                                </div>
                              </div>
                              <div className="md:col-span-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {asientoItem.esCancelado && (
                                    <span className="px-3 py-1 rounded-md text-xs font-bold bg-red-500 text-white shadow-sm">
                                      CANCELADO
                                    </span>
                                  )}
                                  <p className={`text-sm ${asientoItem.esCancelado ? 'line-through text-muted-foreground' : ''}`}>
                                    {asiento.descripcion}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-green-600">
                                  {formatCurrency(asiento.totalDebe)}
                                </p>
                                <p className="text-xs text-muted-foreground">Debe</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-red-600">
                                  {formatCurrency(asiento.totalHaber)}
                                </p>
                                <p className="text-xs text-muted-foreground">Haber</p>
                              </div>
                            </div>
                            {!cuadrado && !asientoItem.esCancelado && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                Descuadrado
                              </span>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cuenta</TableHead>
                              <TableHead>Descripción</TableHead>
                              <TableHead className="text-right">Debe</TableHead>
                              <TableHead className="text-right">Haber</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {asiento.movimientos.map((mov, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <div>
                                    <p className="font-mono text-sm">{mov.cuenta_codigo}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {mov.cuenta_nombre}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>{mov.descripcion}</TableCell>
                                <TableCell className="text-right">
                                  {mov.debe > 0 && (
                                    <span className="text-green-600 font-medium">
                                      {formatCurrency(mov.debe)}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {mov.haber > 0 && (
                                    <span className="text-red-600 font-medium">
                                      {formatCurrency(mov.haber)}
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-bold bg-muted/50">
                              <TableCell colSpan={2}>Total</TableCell>
                              <TableCell className="text-right text-green-600">
                                {formatCurrency(asiento.totalDebe)}
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                {formatCurrency(asiento.totalHaber)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                        
                        {/* Mostrar asiento de reversión si existe */}
                        {asientoItem.asientoReversion && (
                          <div className="mt-4 p-4 bg-orange-100 dark:bg-orange-950/40 rounded-md border border-orange-300 dark:border-orange-800">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                                ↩️ Asiento de Reversión: {asientoItem.asientoReversion.referencia}
                              </span>
                              <span className="text-xs text-orange-600 dark:text-orange-400">
                                ({asientoItem.asientoReversion.fecha})
                              </span>
                            </div>
                            
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Cuenta</TableHead>
                                  <TableHead>Descripción</TableHead>
                                  <TableHead className="text-right">Debe</TableHead>
                                  <TableHead className="text-right">Haber</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {asientoItem.asientoReversion.movimientos.map((mov: any, idx: number) => (
                                  <TableRow key={idx}>
                                    <TableCell>
                                      <div>
                                        <p className="font-mono text-xs">{mov.cuenta_codigo}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {mov.cuenta_nombre}
                                        </p>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs">{mov.descripcion}</TableCell>
                                    <TableCell className="text-right">
                                      {mov.debe > 0 && (
                                        <span className="text-green-600 font-medium text-xs">
                                          {formatCurrency(mov.debe)}
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {mov.haber > 0 && (
                                        <span className="text-red-600 font-medium text-xs">
                                          {formatCurrency(mov.haber)}
                                        </span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="font-bold bg-muted/50">
                                  <TableCell colSpan={2}>Total Reversión</TableCell>
                                  <TableCell className="text-right text-green-600 text-xs">
                                    {formatCurrency(asientoItem.asientoReversion.totalDebe)}
                                  </TableCell>
                                  <TableCell className="text-right text-red-600 text-xs">
                                    {formatCurrency(asientoItem.asientoReversion.totalHaber)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Saldos por Cuenta */}
      <Card>
        <CardHeader>
          <CardTitle>Saldos por Cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Total Debe</TableHead>
                <TableHead>Total Haber</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.values(saldosPorCuenta)
                .sort((a, b) => a.cuenta_codigo.localeCompare(b.cuenta_codigo))
                .map((cuenta) => (
                  <TableRow key={cuenta.cuenta_codigo}>
                    <TableCell className="font-mono">{cuenta.cuenta_codigo}</TableCell>
                    <TableCell className="text-green-600">
                      {formatCurrency(cuenta.debe_total)}
                    </TableCell>
                    <TableCell className="text-red-600">
                      {formatCurrency(cuenta.haber_total)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(cuenta.saldo)}
                    </TableCell>
                  </TableRow>
                ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell>TOTALES</TableCell>
                <TableCell className="text-green-600">
                  {formatCurrency(totalDebe)}
                </TableCell>
                <TableCell className="text-red-600">
                  {formatCurrency(totalHaber)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Math.abs(totalDebe - totalHaber))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Balanza;
