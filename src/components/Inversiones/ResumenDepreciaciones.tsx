import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useInversiones } from "@/hooks/useInversiones";
import { useAsientosDepreciacion } from "@/hooks/useAsientosDepreciacion";
import { Loader2, TrendingDown, Calendar, DollarSign, ChevronDown, FileText } from "lucide-react";
import { format, lastDayOfMonth, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

const ResumenDepreciaciones = () => {
  const { inversiones, isLoading } = useInversiones();
  const [expandedInversiones, setExpandedInversiones] = useState<string[]>([]);

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

  // Calcular depreciación acumulada para cada inversión
  const inversionesConDepreciacion = inversionesActivas.map(inv => {
    const fechaInicio = inv.fecha_inicio_depreciacion ? new Date(inv.fecha_inicio_depreciacion) : new Date(inv.fecha_adquisicion);
    const hoy = new Date();
    const mesesTranscurridos = Math.max(0, (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 + (hoy.getMonth() - fechaInicio.getMonth()));
    const depreciacionAcumulada = (inv.valor_depreciacion_mensual || 0) * mesesTranscurridos;
    const valorLibros = Math.max(0, inv.valor_total - depreciacionAcumulada);
    
    // Calcular próxima fecha de depreciación (último día del mes actual)
    const proximaFechaDepreciacion = lastDayOfMonth(hoy);
    const diasFaltantes = differenceInDays(proximaFechaDepreciacion, hoy);

    return {
      ...inv,
      mesesTranscurridos,
      depreciacionAcumulada,
      valorLibros,
      porcentajeDepreciado: inv.valor_total > 0 ? (depreciacionAcumulada / inv.valor_total) * 100 : 0,
      proximaFechaDepreciacion,
      diasFaltantes
    };
  });

  // Ordenar por fecha de adquisición (más recientes primero)
  const inversionesOrdenadas = [...inversionesConDepreciacion].sort((a, b) => 
    new Date(b.fecha_adquisicion).getTime() - new Date(a.fecha_adquisicion).getTime()
  );

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

  return (
    <div className="space-y-6">
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

      {/* Tabla de Depreciaciones por Activo */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Depreciaciones por Activo</CardTitle>
          <CardDescription>
            Detalle de la depreciación acumulada y valor en libros de cada activo activo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inversionesOrdenadas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay inversiones registradas aún
            </div>
          ) : (
            <div className="space-y-4">
              {inversionesOrdenadas.map((inversion) => (
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
                          <p className="text-xs text-muted-foreground">Meses Transcurridos</p>
                          <p className="font-semibold">{inversion.mesesTranscurridos} meses</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Próxima Depreciación</p>
                          <p className="font-semibold text-blue-600">{format(inversion.proximaFechaDepreciacion, "dd MMM yyyy", { locale: es })}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {inversion.diasFaltantes === 0 ? "Hoy" : 
                             inversion.diasFaltantes === 1 ? "Mañana" : 
                             `Faltan ${inversion.diasFaltantes} días`}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Depreciación Acumulada</p>
                          <p className="font-semibold text-orange-600">{formatCurrency(inversion.depreciacionAcumulada)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Valor en Libros</p>
                          <p className="font-semibold text-green-600">{formatCurrency(inversion.valorLibros)}</p>
                        </div>
                      </div>

                      {/* Barra de Progreso */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progreso de Depreciación</span>
                          <span>{inversion.porcentajeDepreciado.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-orange-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(inversion.porcentajeDepreciado, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Información de Depreciación */}
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                          <p className="text-xs text-muted-foreground">Depreciación Anual</p>
                          <p className="font-semibold text-blue-600">{formatCurrency(inversion.valor_depreciacion_anual || 0)}</p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                          <p className="text-xs text-muted-foreground">Depreciación Mensual</p>
                          <p className="font-semibold text-purple-600">{formatCurrency(inversion.valor_depreciacion_mensual || 0)}</p>
                        </div>
                      </div>

                      {/* Asientos de Depreciación */}
                      <div className="pt-4 border-t">
                        <AsientosDepreciacionSection inversionId={inversion.id} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumenDepreciaciones;
