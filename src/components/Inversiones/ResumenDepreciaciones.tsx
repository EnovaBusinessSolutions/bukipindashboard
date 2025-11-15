import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useInversiones } from "@/hooks/useInversiones";
import { useAsientosDepreciacion } from "@/hooks/useAsientosDepreciacion";
import { useGenerarDepreciaciones } from "@/hooks/useGenerarDepreciaciones";
import { useDepreciacionesAtrasadas } from "@/hooks/useDepreciacionesAtrasadas";
import { Loader2, TrendingDown, Calendar, DollarSign, ChevronDown, FileText, Play, AlertTriangle } from "lucide-react";
import { format, lastDayOfMonth, differenceInDays, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo } from "react";

const ResumenDepreciaciones = () => {
  const { inversiones, isLoading } = useInversiones();
  const [expandedInversiones, setExpandedInversiones] = useState<string[]>([]);
  const { mutate: generarDepreciaciones, isPending } = useGenerarDepreciaciones();
  const { depreciacionesAtrasadas, tieneAtrasadas, totalAtrasadas } = useDepreciacionesAtrasadas();
  
  // Estado para selector de mes/año
  const fechaActual = new Date();
  const [mesSeleccionado, setMesSeleccionado] = useState<string>((fechaActual.getMonth() + 1).toString());
  const [anoSeleccionado, setAnoSeleccionado] = useState<string>(fechaActual.getFullYear().toString());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Filtrar solo activos activos
  const inversionesActivas = inversiones?.filter(inv => inv.estado === 'activo') || [];

  // Calcular totales
  const totalDepreciacionAnual = inversionesActivas.reduce((sum, inv) => sum + (inv.valor_depreciacion_anual || 0), 0);
  const totalDepreciacionMensual = inversionesActivas.reduce((sum, inv) => sum + (inv.valor_depreciacion_mensual || 0), 0);
  const totalValorActivos = inversionesActivas.reduce((sum, inv) => sum + inv.valor_total, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  };

  const toggleExpanded = (inversionId: string) => {
    setExpandedInversiones(prev => 
      prev.includes(inversionId) 
        ? prev.filter(id => id !== inversionId)
        : [...prev, inversionId]
    );
  };

  const handleGenerarDepreciaciones = () => {
    generarDepreciaciones({
      mes: parseInt(mesSeleccionado),
      ano: parseInt(anoSeleccionado),
      origen: 'manual',
    });
  };

  // Validar si el mes seleccionado es pasado
  const mesSeleccionadoNum = parseInt(mesSeleccionado);
  const anoSeleccionadoNum = parseInt(anoSeleccionado);
  const fechaSeleccionada = new Date(anoSeleccionadoNum, mesSeleccionadoNum - 1, 1);
  const primerDiaMesActual = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
  const esMesPasado = fechaSeleccionada < primerDiaMesActual;

  // Generar opciones de meses y años
  const meses = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: new Date(2000, i).toLocaleString('es-MX', { month: 'long' }),
  }));

  const anos = Array.from({ length: 3 }, (_, i) => {
    const ano = fechaActual.getFullYear() + i;
    return { value: ano.toString(), label: ano.toString() };
  });

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
        <div className="text-xs text-muted-foreground text-center py-2">
          No hay asientos de depreciación generados aún
        </div>
      );
    }

    return (
      <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(inversionId)}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium">Asientos de Depreciación Generados ({asientos.length})</span>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        
        <CollapsibleContent className="pt-3 space-y-2">
          {asientos.map((asiento) => {
            // Extraer mes y año del número de asiento (formato: DEP-{id}-YYYYMM)
            const match = asiento.numero_asiento.match(/DEP-.+-(\d{4})(\d{2})/);
            const año = match ? match[1] : "";
            const mes = match ? match[2] : "";
            const fecha = match ? new Date(parseInt(año), parseInt(mes) - 1) : new Date(asiento.fecha);

            return (
              <div key={asiento.id} className="p-3 border border-purple-200 dark:border-purple-900 rounded-lg bg-background">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold">
                      {format(fecha, "MMMM yyyy", { locale: es })}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{asiento.numero_asiento}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(asiento.fecha), "dd/MM/yyyy")}
                  </Badge>
                </div>

                <div className="space-y-2 mt-3">
                  {asiento.detalle_asientos?.map((detalle) => (
                    <div key={detalle.id} className="flex items-start justify-between text-xs">
                      <div className="flex-1">
                        <p className="font-medium">
                          {detalle.cuenta_codigo} - {detalle.cuenta?.nombre}
                        </p>
                        <p className="text-muted-foreground">{detalle.descripcion}</p>
                      </div>
                      <div className="text-right ml-2">
                        {detalle.debe > 0 && (
                          <div className="space-y-0">
                            <p className="text-green-600 font-semibold">
                              {formatCurrency(detalle.debe)}
                            </p>
                            <Badge variant="outline" className="text-[10px] h-4">DEBE</Badge>
                          </div>
                        )}
                        {detalle.haber > 0 && (
                          <div className="space-y-0">
                            <p className="text-blue-600 font-semibold">
                              {formatCurrency(detalle.haber)}
                            </p>
                            <Badge variant="outline" className="text-[10px] h-4">HABER</Badge>
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

  // Componente para calcular datos de cada inversión con depreciación real
  const InversionCard = ({ inversion }: { inversion: any }) => {
    const { data: asientos } = useAsientosDepreciacion(inversion.id);
    
    // Calcular depreciación acumulada REAL sumando asientos generados
    const depreciacionAcumulada = useMemo(() => {
      if (!asientos) return 0;
      return asientos.reduce((total, asiento) => {
        const gastoDepreciacion = asiento.detalle_asientos
          ?.filter(d => d.cuenta_codigo === '5109') // Gasto Depreciación
          .reduce((sum, d) => sum + d.debe, 0) || 0;
        return total + gastoDepreciacion;
      }, 0);
    }, [asientos]);
    
    const valorLibros = Math.max(0, inversion.valor_total - depreciacionAcumulada);
    
    // Extraer último mes depreciado de los asientos
    const extraerMesAnoDeAsiento = (numeroAsiento: string) => {
      const match = numeroAsiento.match(/DEP-.+-(\d{4})(\d{2})/);
      if (!match) return null;
      const año = parseInt(match[1]);
      const mes = parseInt(match[2]);
      return new Date(año, mes - 1, 1);
    };
    
    const ultimoMesDepreciado = asientos && asientos.length > 0 
      ? extraerMesAnoDeAsiento(asientos[0].numero_asiento)
      : null;
    
    // Calcular próxima fecha de depreciación
    const fechaInicio = inversion.fecha_inicio_depreciacion 
      ? new Date(inversion.fecha_inicio_depreciacion) 
      : new Date(inversion.fecha_adquisicion);
    
    let proximaFechaDepreciacion;
    if (ultimoMesDepreciado) {
      // Siguiente mes después del último depreciado
      proximaFechaDepreciacion = lastDayOfMonth(addMonths(ultimoMesDepreciado, 1));
    } else {
      // Si no hay asientos, usar fecha de inicio
      proximaFechaDepreciacion = lastDayOfMonth(fechaInicio);
    }
    
    const hoy = new Date();
    const diasFaltantes = differenceInDays(proximaFechaDepreciacion, hoy);
    
    // Calcular meses transcurridos desde asientos reales
    const mesesDepreciados = asientos?.length || 0;
    const porcentajeDepreciado = inversion.valor_total > 0 ? (depreciacionAcumulada / inversion.valor_total) * 100 : 0;
    
    return (
      <Card key={inversion.id} className="border-2">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Encabezado */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{inversion.producto_nombre}</h3>
                {inversion.descripcion && (
                  <p className="text-sm text-muted-foreground">{inversion.descripcion}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>Categoría: {inversion.categoria_activo}</span>
                  <span>•</span>
                  <span>Adquisición: {format(new Date(inversion.fecha_adquisicion), "dd MMM yyyy", { locale: es })}</span>
                </div>
              </div>
              {inversion.imagen_url && (
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0 ml-4">
                  <img 
                    src={inversion.imagen_url} 
                    alt={inversion.producto_nombre}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* Métricas de Depreciación */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 pt-4 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Valor Original</p>
                <p className="font-semibold">{formatCurrency(inversion.valor_total)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Años Depreciación</p>
                <p className="font-semibold">{inversion.anos_depreciacion} años</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meses Depreciados</p>
                <p className="font-semibold">{mesesDepreciados} meses</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Próxima Depreciación</p>
                <p className="font-semibold text-blue-600">{format(proximaFechaDepreciacion, "dd MMM yyyy", { locale: es })}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {diasFaltantes === 0 ? "Hoy" : diasFaltantes > 0 ? `en ${diasFaltantes} días` : `hace ${Math.abs(diasFaltantes)} días`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Depreciación Acumulada</p>
                <p className="font-semibold text-orange-600">{formatCurrency(depreciacionAcumulada)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor en Libros</p>
                <p className="font-semibold text-green-600">{formatCurrency(valorLibros)}</p>
              </div>
            </div>

            {/* Barra de progreso de depreciación */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progreso de Depreciación</span>
                <span className="font-medium">{porcentajeDepreciado.toFixed(2)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(porcentajeDepreciado, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mensual: {formatCurrency(inversion.valor_depreciacion_mensual || 0)}</span>
                <span>Anual: {formatCurrency(inversion.valor_depreciacion_anual || 0)}</span>
              </div>
            </div>

            {/* Sección de asientos de depreciación */}
            <div className="pt-2">
              <AsientosDepreciacionSection inversionId={inversion.id} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Botón de Generar Depreciaciones */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-purple-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Generar Depreciaciones Manualmente
          </CardTitle>
          <CardDescription>
            Genera los asientos contables de depreciación para el mes seleccionado. 
            Solo puedes generar desde el mes actual en adelante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mes</label>
                <Select value={mesSeleccionado} onValueChange={setMesSeleccionado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((mes) => {
                      const esMesActual = mes.value === (fechaActual.getMonth() + 1).toString() 
                        && anoSeleccionado === fechaActual.getFullYear().toString();
                      
                      return (
                        <SelectItem key={mes.value} value={mes.value}>
                          <div className="flex items-center gap-2">
                            {mes.label}
                            {esMesActual && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">Actual</Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Año</label>
                <Select value={anoSeleccionado} onValueChange={setAnoSeleccionado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anos.map((ano) => (
                      <SelectItem key={ano.value} value={ano.value}>
                        {ano.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  disabled={isPending || inversionesActivas.length === 0}
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Generar Manualmente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Generación Manual de Depreciaciones
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3 text-left">
                    <p className="font-medium text-foreground">
                      Las depreciaciones se generan automáticamente entre los días 28-31 de cada mes.
                    </p>
                    <p>
                      <strong>Usa esta función solo si:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm pl-2">
                      <li>Necesitas registrar depreciaciones de meses anteriores</li>
                      <li>El proceso automático falló por algún motivo</li>
                      <li>Necesitas proyectar depreciaciones futuras</li>
                    </ul>
                    <p className="text-sm text-muted-foreground pt-2">
                      Período seleccionado: <strong>{new Date(parseInt(anoSeleccionado), parseInt(mesSeleccionado) - 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' })}</strong>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Fecha de registro: <strong>Hoy ({format(new Date(), "d 'de' MMMM, yyyy", { locale: es })})</strong>
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleGenerarDepreciaciones}
                    disabled={isPending}
                    className="gap-2"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Generar Ahora
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          
          {esMesPasado && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                ⚠️ No puedes generar depreciaciones de meses pasados. Solo puedes generar desde el mes actual en adelante.
              </AlertDescription>
            </Alert>
          )}
          
          {inversionesActivas.length === 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              No hay activos activos para depreciar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Depreciación Anual Total</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDepreciacionAnual)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Basado en {inversionesActivas.length} activo(s) activo(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Depreciación Mensual Total</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDepreciacionMensual)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Promedio mensual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total de Activos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValorActivos)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Valor original
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ALERTA DE DEPRECIACIONES ATRASADAS */}
      {tieneAtrasadas && (
        <Alert variant="destructive" className="border-l-4 border-red-500">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="space-y-2">
            <p className="font-semibold">
              {totalAtrasadas} Período(s) de Depreciación Sin Registrar
            </p>
            <div className="text-sm space-y-1 mt-2">
              {depreciacionesAtrasadas.slice(0, 5).map((atraso) => {
                const ano = atraso.mesAno.substring(0, 4);
                const mes = atraso.mesAno.substring(4, 6);
                const fecha = new Date(parseInt(ano), parseInt(mes) - 1);
                return (
                  <div key={`${atraso.inversionId}-${atraso.mesAno}`} className="flex justify-between">
                    <span>{atraso.productoNombre}</span>
                    <span className="text-muted-foreground">
                      {fecha.toLocaleString('es-MX', { month: 'long', year: 'numeric' })}
                      {atraso.mesesAtrasados > 0 && ` (${atraso.mesesAtrasados} mes${atraso.mesesAtrasados > 1 ? 'es' : ''} atrás)`}
                    </span>
                  </div>
                );
              })}
              {depreciacionesAtrasadas.length > 5 && (
                <p className="text-muted-foreground italic pt-1">
                  ... y {depreciacionesAtrasadas.length - 5} más
                </p>
              )}
            </div>
            <p className="text-sm mt-3">
              Usa el botón <strong>"Generar Manualmente"</strong> arriba para registrar períodos atrasados.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabla de Depreciaciones por Activo */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Depreciaciones por Activo</CardTitle>
          <CardDescription>
            Detalle de la depreciación acumulada y valor en libros de cada activo activo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inversionesActivas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay inversiones registradas aún
            </div>
          ) : (
            <div className="space-y-4">
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
