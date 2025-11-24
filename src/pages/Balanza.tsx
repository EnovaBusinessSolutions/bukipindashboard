import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, ChevronDown, ChevronRight, Filter, AlertTriangle } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { useCuentas } from "@/hooks/useCuentas";
import { Badge } from "@/components/ui/badge";
import { CardDescription } from "@/components/ui/card";

interface BalanzaEntry {
  fecha: string;
  tipo: string;
  descripcion: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: number;
  haber: number;
  referencia: string;
  esCuentaFiltrada?: boolean;
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
  const [pestanaActiva, setPestanaActiva] = useState<string>("todos");
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroEstadoFinanciero, setFiltroEstadoFinanciero] = useState<string>("todos");
  const [filtroBusqueda, setFiltroBusqueda] = useState<string>("");
  
  // Filtros jerárquicos
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<string>("todos");
  const [subgrupoSeleccionado, setSubgrupoSeleccionado] = useState<string>("todos");
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>("todos");

  // Para Balanza de Comprobación y Balance General, ajustar startDate a 10 años atrás para acumular todo
  const startDateAjustado = (pestanaActiva === "balance" || pestanaActiva === "todos")
    ? new Date(endDate.getFullYear() - 10, 0, 1) 
    : startDate;

  // Usar el hook simplificado que lee de detalle_asientos
  const { data: balanzaData, isLoading } = useAsientosBalanza(startDateAjustado, endDate);
  const { data: cuentasData } = useCuentas();

  // Extraer grupos disponibles según pestaña activa
  const gruposDisponibles = useMemo(() => {
    if (!cuentasData?.estadosFinancieros) return [];
    
    const estadoKey = pestanaActiva === "balance" ? "Balance General" : 
                      pestanaActiva === "resultados" ? "Estado de Resultados" : null;
    
    if (!estadoKey) {
      // Para "todos", combinar ambos estados financieros
      return [
        ...Object.keys(cuentasData.estadosFinancieros["Balance General"] || {}),
        ...Object.keys(cuentasData.estadosFinancieros["Estado de Resultados"] || {})
      ].filter((v, i, a) => a.indexOf(v) === i); // unique
    }
    
    return Object.keys(cuentasData.estadosFinancieros[estadoKey] || {});
  }, [cuentasData, pestanaActiva]);

  // Extraer subgrupos según grupo seleccionado
  const subgruposDisponibles = useMemo(() => {
    if (grupoSeleccionado === "todos" || !cuentasData?.estadosFinancieros) return [];
    
    const estadoKey = pestanaActiva === "balance" ? "Balance General" : 
                      pestanaActiva === "resultados" ? "Estado de Resultados" : null;
    
    if (!estadoKey) {
      // Para "todos", buscar en ambos estados
      const subgruposBG = Object.keys(cuentasData.estadosFinancieros["Balance General"]?.[grupoSeleccionado] || {});
      const subgruposER = Object.keys(cuentasData.estadosFinancieros["Estado de Resultados"]?.[grupoSeleccionado] || {});
      return [...subgruposBG, ...subgruposER].filter((v, i, a) => a.indexOf(v) === i);
    }
    
    return Object.keys(cuentasData.estadosFinancieros[estadoKey]?.[grupoSeleccionado] || {});
  }, [cuentasData, grupoSeleccionado, pestanaActiva]);

  // Extraer cuentas según subgrupo seleccionado
  const cuentasDisponibles = useMemo(() => {
    if (subgrupoSeleccionado === "todos" || !cuentasData?.estadosFinancieros) return [];
    
    const estadoKey = pestanaActiva === "balance" ? "Balance General" : 
                      pestanaActiva === "resultados" ? "Estado de Resultados" : null;
    
    if (!estadoKey) {
      // Para "todos", buscar en ambos estados
      const cuentasBG = cuentasData.estadosFinancieros["Balance General"]?.[grupoSeleccionado]?.[subgrupoSeleccionado] || [];
      const cuentasER = cuentasData.estadosFinancieros["Estado de Resultados"]?.[grupoSeleccionado]?.[subgrupoSeleccionado] || [];
      return [...cuentasBG, ...cuentasER];
    }
    
    return cuentasData.estadosFinancieros[estadoKey]?.[grupoSeleccionado]?.[subgrupoSeleccionado] || [];
  }, [cuentasData, grupoSeleccionado, subgrupoSeleccionado, pestanaActiva]);

  // Limpiar filtros jerárquicos al cambiar de pestaña
  useEffect(() => {
    setGrupoSeleccionado("todos");
    setSubgrupoSeleccionado("todos");
    setCuentaSeleccionada("todos");
  }, [pestanaActiva]);

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

  // Filtrar movimientos según pestaña activa
  let movimientosFiltrados = movimientos;
  if (pestanaActiva === "resultados") {
    movimientosFiltrados = movimientos.filter(mov => 
      ["4", "5", "6"].includes(mov.cuenta_codigo.charAt(0))
    );
  } else if (pestanaActiva === "balance") {
    movimientosFiltrados = movimientos.filter(mov => 
      ["1", "2", "3"].includes(mov.cuenta_codigo.charAt(0))
    );
  }

  // Aplicar filtros jerárquicos
  if (cuentaSeleccionada !== "todos") {
    // Si hay cuenta específica, solo mostrar esa
    movimientosFiltrados = movimientosFiltrados.filter(mov => 
      mov.cuenta_codigo === cuentaSeleccionada
    );
  } else if (subgrupoSeleccionado !== "todos" && cuentasDisponibles.length > 0) {
    // Si hay subgrupo, filtrar por cuentas de ese subgrupo
    const codigosCuentas = cuentasDisponibles.map(c => c.codigo);
    movimientosFiltrados = movimientosFiltrados.filter(mov => 
      codigosCuentas.includes(mov.cuenta_codigo)
    );
  } else if (grupoSeleccionado !== "todos" && cuentasData?.estadosFinancieros) {
    // Si hay grupo, filtrar por cuentas de ese grupo
    const estadoKey = pestanaActiva === "balance" ? "Balance General" : 
                      pestanaActiva === "resultados" ? "Estado de Resultados" : null;
    
    if (estadoKey) {
      const todasCuentasGrupo = Object.values(
        cuentasData.estadosFinancieros[estadoKey]?.[grupoSeleccionado] || {}
      ).flat();
      const codigosCuentas = todasCuentasGrupo.map((c: any) => c.codigo);
      movimientosFiltrados = movimientosFiltrados.filter(mov => 
        codigosCuentas.includes(mov.cuenta_codigo)
      );
    } else {
      // Para "todos", buscar en ambos estados
      const todasCuentasBG = Object.values(
        cuentasData.estadosFinancieros["Balance General"]?.[grupoSeleccionado] || {}
      ).flat();
      const todasCuentasER = Object.values(
        cuentasData.estadosFinancieros["Estado de Resultados"]?.[grupoSeleccionado] || {}
      ).flat();
      const codigosCuentas = [...todasCuentasBG, ...todasCuentasER].map((c: any) => c.codigo);
      movimientosFiltrados = movimientosFiltrados.filter(mov => 
        codigosCuentas.includes(mov.cuenta_codigo)
      );
    }
  }

  // Filtrar saldos según pestaña activa
  let saldosPorCuentaFiltrados = saldosPorCuenta;
  if (pestanaActiva === "resultados") {
    const codigosResultados = Object.keys(saldosPorCuenta).filter(codigo => 
      ["4", "5", "6"].includes(codigo.charAt(0))
    );
    saldosPorCuentaFiltrados = Object.fromEntries(
      codigosResultados.map(codigo => [codigo, saldosPorCuenta[codigo]])
    );
  } else if (pestanaActiva === "balance") {
    const codigosBalance = Object.keys(saldosPorCuenta).filter(codigo => 
      ["1", "2", "3"].includes(codigo.charAt(0))
    );
    saldosPorCuentaFiltrados = Object.fromEntries(
      codigosBalance.map(codigo => [codigo, saldosPorCuenta[codigo]])
    );
  }

  // Aplicar filtros jerárquicos a saldos
  if (cuentaSeleccionada !== "todos") {
    const codigo = cuentaSeleccionada;
    saldosPorCuentaFiltrados = saldosPorCuentaFiltrados[codigo] ? 
      { [codigo]: saldosPorCuentaFiltrados[codigo] } : {};
  } else if (subgrupoSeleccionado !== "todos" && cuentasDisponibles.length > 0) {
    const codigosCuentas = cuentasDisponibles.map(c => c.codigo);
    saldosPorCuentaFiltrados = Object.fromEntries(
      Object.entries(saldosPorCuentaFiltrados).filter(([codigo]) => 
        codigosCuentas.includes(codigo)
      )
    );
  } else if (grupoSeleccionado !== "todos" && cuentasData?.estadosFinancieros) {
    const estadoKey = pestanaActiva === "balance" ? "Balance General" : 
                      pestanaActiva === "resultados" ? "Estado de Resultados" : null;
    
    if (estadoKey) {
      const todasCuentasGrupo = Object.values(
        cuentasData.estadosFinancieros[estadoKey]?.[grupoSeleccionado] || {}
      ).flat();
      const codigosCuentas = todasCuentasGrupo.map((c: any) => c.codigo);
      saldosPorCuentaFiltrados = Object.fromEntries(
        Object.entries(saldosPorCuentaFiltrados).filter(([codigo]) => 
          codigosCuentas.includes(codigo)
        )
      );
    } else {
      const todasCuentasBG = Object.values(
        cuentasData.estadosFinancieros["Balance General"]?.[grupoSeleccionado] || {}
      ).flat();
      const todasCuentasER = Object.values(
        cuentasData.estadosFinancieros["Estado de Resultados"]?.[grupoSeleccionado] || {}
      ).flat();
      const codigosCuentas = [...todasCuentasBG, ...todasCuentasER].map((c: any) => c.codigo);
      saldosPorCuentaFiltrados = Object.fromEntries(
        Object.entries(saldosPorCuentaFiltrados).filter(([codigo]) => 
          codigosCuentas.includes(codigo)
        )
      );
    }
  }

  // Crear Map con toda la información de las cuentas
  const cuentasInfoMap = new Map(
    cuentasData?.cuentasFlat?.map(cuenta => [
      cuenta.codigo,
      {
        nombre: cuenta.nombre,
        estado_financiero: cuenta.estado_financiero
      }
    ]) || []
  );

  // Detectar si hay movimientos con fechas futuras
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tieneFechasFuturas = movimientosFiltrados.some(mov => {
    const [dia, mes, ano] = mov.fecha.split('/');
    const fechaMov = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    return fechaMov > today;
  });

  // Si no hay movimientos, mostrar mensaje
  if (!movimientosFiltrados || movimientosFiltrados.length === 0) {
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
  // Para pestañas filtradas (resultados/balance), incluir TODOS los movimientos del asiento completo
  const asientosAgrupados: Record<string, AsientoAgrupado> = {};

  if (pestanaActiva === "todos") {
    // En "Balanza de Comprobación", mantener comportamiento original
    movimientosFiltrados.forEach((mov) => {
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
  } else {
    // En pestañas filtradas, mostrar asiento completo con todas sus cuentas
    // 1. Obtener referencias únicas de asientos que pasaron el filtro
    const referenciasRelevantes = new Set(movimientosFiltrados.map(m => m.referencia));
    
    // 2. Para cada referencia, incluir TODOS sus movimientos (sin filtro de cuenta)
    referenciasRelevantes.forEach(referencia => {
      // Obtener TODOS los movimientos de este asiento (sin filtro de cuenta)
      const movimientosCompletos = movimientos.filter(m => m.referencia === referencia);
      
      // Identificar cuáles movimientos cumplieron el filtro (para resaltarlos)
      const codigosFiltrados = new Set(
        movimientosFiltrados
          .filter(m => m.referencia === referencia)
          .map(m => m.cuenta_codigo)
      );
      
      asientosAgrupados[referencia] = {
        referencia,
        fecha: movimientosCompletos[0].fecha,
        tipo: movimientosCompletos[0].tipo,
        descripcion: movimientosCompletos[0].descripcion,
        movimientos: movimientosCompletos.map(mov => ({
          ...mov,
          esCuentaFiltrada: codigosFiltrados.has(mov.cuenta_codigo)
        })),
        totalDebe: movimientosCompletos.reduce((sum, m) => sum + m.debe, 0),
        totalHaber: movimientosCompletos.reduce((sum, m) => sum + m.haber, 0),
      };
    });
  }

  const asientosArray = Object.values(asientosAgrupados);
  
  // Identificar y asociar asientos de reversión con sus originales
  const asientosConReversion = asientosArray.map(asiento => {
    const descripcionLower = asiento.descripcion.toLowerCase();
    const esReversion = descripcionLower.includes('reversión:') || 
                        descripcionLower.includes('reversion:') ||
                        descripcionLower.includes('cancelación de egreso:') ||
                        descripcionLower.includes('cancelacion de egreso:');
    
    // Si es un asiento de reversión, no lo mostramos directamente
    if (esReversion) {
      return null;
    }
    
    // Buscar si este asiento tiene una reversión asociada (case-insensitive)
    const asientoReversion = asientosArray.find(a => {
      const aDescLower = a.descripcion.toLowerCase();
      if (!aDescLower.includes('reversión:') && 
          !aDescLower.includes('reversion:') && 
          !aDescLower.includes('cancelación de egreso:') &&
          !aDescLower.includes('cancelacion de egreso:')) return false;
      
      // Comparar por número de asiento (ID único) en lugar de descripción
      // La reversión tiene formato CANC-EGR-{id} o CANC-ING-{id}
      // El asiento original tiene formato EGR-{id} o ING-{id}
      
      // Extraer el ID del asiento original
      const matchOriginal = asiento.referencia.match(/^([A-Z]+)-(.+)$/);
      if (!matchOriginal) return false;
      
      const idOriginal = matchOriginal[2]; // Ejemplo: "b4087dfc-9d59-4de5-923a-1265004c0ec2"
      
      // Verificar si el número de asiento de reversión contiene este ID
      return a.referencia.includes(idOriginal);
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

  // Calcular totales basados en saldos filtrados
  const totalDebe = Object.values(saldosPorCuentaFiltrados).reduce(
    (sum, cuenta) => sum + cuenta.debe_total,
    0
  );
  const totalHaber = Object.values(saldosPorCuentaFiltrados).reduce(
    (sum, cuenta) => sum + cuenta.haber_total,
    0
  );
  const diferencia = Math.abs(totalDebe - totalHaber);
  const cuadra = diferencia < 0.01;

  const tiposUnicos = Array.from(new Set(asientosConReversion.map((a) => a.tipo))).sort();

  // Textos según pestaña activa
  const getDescripcionPestana = () => {
    switch (pestanaActiva) {
      case "todos":
        return `Vista completa de todas las cuentas al corte del ${format(endDate, "dd/MM/yyyy")}. Muestra el saldo acumulado desde el inicio de operaciones.`;
      case "resultados":
        return "Cuentas de ingresos, costos y gastos del período seleccionado (Cuentas 4xxx, 5xxx, 6xxx)";
      case "balance":
        return `Cuentas de activos, pasivos y capital al corte de ${format(endDate, "PPP", { locale: es })} (Cuentas 1xxx, 2xxx, 3xxx)`;
      default:
        return "Vista detallada de todos los movimientos contables del periodo";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Balanza de Comprobación</h1>
        <p className="text-muted-foreground mt-2">
          {getDescripcionPestana()}
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={pestanaActiva} onValueChange={setPestanaActiva}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="todos">Balanza de Comprobación</TabsTrigger>
          <TabsTrigger value="resultados">Balanza de Resultados</TabsTrigger>
          <TabsTrigger value="balance">Balanza de Balance</TabsTrigger>
        </TabsList>

        <TabsContent value={pestanaActiva} className="space-y-6 mt-6">

      {/* Alerta de fechas futuras */}
      {tieneFechasFuturas && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-yellow-900 dark:text-yellow-200">
                Asientos con fechas futuras detectados
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Esta balanza incluye asientos contables con fechas posteriores a hoy. 
                Esto es normal para depreciaciones mensuales o proyecciones.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {pestanaActiva === "todos" ? "Fecha de Corte" : "Filtros de Análisis"}
          </CardTitle>
          {pestanaActiva !== "todos" && (
            <CardDescription>
              {pestanaActiva === "balance" 
                ? "Navega desde grupos hasta cuentas específicas para analizar tu posición financiera"
                : "Filtra por grupos, subgrupos y cuentas para análisis detallado"}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Para Balanza de Comprobación (todos) - Filtros originales */}
          {pestanaActiva === "todos" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha de Corte</label>
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
                        className="pointer-events-auto"
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
            </>
          ) : (
            /* Para Balanza de Resultados y Balance - Filtros jerárquicos */
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Selectores de Fecha */}
                {pestanaActiva !== "balance" && (
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Fecha Inicio</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="start-date"
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
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="end-date">
                    {pestanaActiva === "balance" ? "Fecha de Corte" : "Fecha Fin"}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="end-date"
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
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Filtro de Grupo */}
                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <Select 
                    value={grupoSeleccionado} 
                    onValueChange={(value) => {
                      setGrupoSeleccionado(value);
                      setSubgrupoSeleccionado("todos");
                      setCuentaSeleccionada("todos");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los Grupos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los Grupos</SelectItem>
                      {gruposDisponibles.map(grupo => (
                        <SelectItem key={grupo} value={grupo}>{grupo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Subgrupo */}
                <div className="space-y-2">
                  <Label>Subgrupo</Label>
                  <Select 
                    value={subgrupoSeleccionado} 
                    onValueChange={(value) => {
                      setSubgrupoSeleccionado(value);
                      setCuentaSeleccionada("todos");
                    }}
                    disabled={grupoSeleccionado === "todos"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los Subgrupos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los Subgrupos</SelectItem>
                      {subgruposDisponibles.map(subgrupo => (
                        <SelectItem key={subgrupo} value={subgrupo}>{subgrupo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Cuenta */}
                <div className="space-y-2">
                  <Label>Cuenta</Label>
                  <Select 
                    value={cuentaSeleccionada} 
                    onValueChange={setCuentaSeleccionada}
                    disabled={subgrupoSeleccionado === "todos"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las Cuentas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas las Cuentas</SelectItem>
                      {cuentasDisponibles.map(cuenta => (
                        <SelectItem key={cuenta.codigo} value={cuenta.codigo}>
                          {cuenta.codigo} - {cuenta.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Indicador de filtros activos */}
              {(grupoSeleccionado !== "todos" || subgrupoSeleccionado !== "todos" || cuentaSeleccionada !== "todos") && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-blue-600 dark:text-blue-400 flex-1">
                    Filtros activos: {grupoSeleccionado !== "todos" && grupoSeleccionado}
                    {subgrupoSeleccionado !== "todos" && ` > ${subgrupoSeleccionado}`}
                    {cuentaSeleccionada !== "todos" && ` > ${cuentaSeleccionada}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setGrupoSeleccionado("todos");
                      setSubgrupoSeleccionado("todos");
                      setCuentaSeleccionada("todos");
                    }}
                    className="h-7 text-xs"
                  >
                    Limpiar filtros
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Resumen - Solo para Balanza de Comprobación */}
      {pestanaActiva === "todos" && (
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
      )}

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
                      : (cuadrado || pestanaActiva !== "todos") ? "" : "border-red-300"
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
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs text-muted-foreground">{asiento.fecha}</p>
                                    {(() => {
                                      const [dia, mes, ano] = asiento.fecha.split('/');
                                      const fechaAsiento = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
                                      const hoy = new Date();
                                      hoy.setHours(0, 0, 0, 0);
                                      return fechaAsiento > hoy ? (
                                        <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700">
                                          Futuro
                                        </Badge>
                                      ) : null;
                                    })()}
                                  </div>
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
                            {!cuadrado && !asientoItem.esCancelado && pestanaActiva === "todos" && (
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
                              <TableRow 
                                key={idx}
                                className={mov.esCuentaFiltrada ? "bg-blue-50 dark:bg-blue-950/30" : ""}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {mov.esCuentaFiltrada && (
                                      <span className="text-blue-600 dark:text-blue-400 font-bold">●</span>
                                    )}
                                    <div>
                                      <p className="font-mono text-sm">{mov.cuenta_codigo}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {mov.cuenta_nombre}
                                      </p>
                                    </div>
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
                        
                        {/* Leyenda solo en pestañas filtradas */}
                        {pestanaActiva !== "todos" && asiento.movimientos.some(m => m.esCuentaFiltrada) && (
                          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                              <span className="text-blue-600 dark:text-blue-400 font-bold">●</span>
                              Las filas resaltadas son las cuentas que coinciden con tu filtro actual
                            </p>
                          </div>
                        )}
                        
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
                <TableHead>Nombre de Cuenta</TableHead>
                <TableHead>Estado Financiero</TableHead>
                <TableHead className="text-right">Total Debe</TableHead>
                <TableHead className="text-right">Total Haber</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.values(saldosPorCuentaFiltrados)
                .sort((a, b) => a.cuenta_codigo.localeCompare(b.cuenta_codigo))
                .map((cuenta) => {
                  const infoCompleta = cuentasInfoMap.get(cuenta.cuenta_codigo);
                  return (
                    <TableRow key={cuenta.cuenta_codigo}>
                      <TableCell className="font-mono text-xs">{cuenta.cuenta_codigo}</TableCell>
                      <TableCell className="text-sm">
                        {infoCompleta?.nombre || 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {infoCompleta?.estado_financiero || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(cuenta.debe_total)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(cuenta.haber_total)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(cuenta.saldo)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={3}>TOTALES</TableCell>
                <TableCell className="text-right text-green-600">
                  {formatCurrency(totalDebe)}
                </TableCell>
                <TableCell className="text-right text-red-600">
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Balanza;
