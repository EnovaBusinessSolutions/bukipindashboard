import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInversiones } from "@/hooks/useInversiones";
import { Loader2, TrendingDown, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ResumenDepreciaciones = () => {
  const { inversiones, isLoading } = useInversiones();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Calcular totales
  const totalDepreciacionAnual = inversiones?.reduce((sum, inv) => sum + (inv.valor_depreciacion_anual || 0), 0) || 0;
  const totalDepreciacionMensual = inversiones?.reduce((sum, inv) => sum + (inv.valor_depreciacion_mensual || 0), 0) || 0;
  const totalValorActivos = inversiones?.reduce((sum, inv) => sum + inv.valor_total, 0) || 0;

  // Calcular depreciación acumulada para cada inversión
  const inversionesConDepreciacion = inversiones?.map(inv => {
    const fechaInicio = inv.fecha_inicio_depreciacion ? new Date(inv.fecha_inicio_depreciacion) : new Date(inv.fecha_adquisicion);
    const hoy = new Date();
    const mesesTranscurridos = Math.max(0, (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 + (hoy.getMonth() - fechaInicio.getMonth()));
    const depreciacionAcumulada = (inv.valor_depreciacion_mensual || 0) * mesesTranscurridos;
    const valorLibros = Math.max(0, inv.valor_total - depreciacionAcumulada);

    return {
      ...inv,
      mesesTranscurridos,
      depreciacionAcumulada,
      valorLibros,
      porcentajeDepreciado: inv.valor_total > 0 ? (depreciacionAcumulada / inv.valor_total) * 100 : 0
    };
  }) || [];

  // Ordenar por fecha de adquisición (más recientes primero)
  const inversionesOrdenadas = [...inversionesConDepreciacion].sort((a, b) => 
    new Date(b.fecha_adquisicion).getTime() - new Date(a.fecha_adquisicion).getTime()
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
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
              Basado en {inversiones?.length || 0} activo(s)
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
            Detalle de la depreciación acumulada y valor en libros de cada inversión
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
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t">
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
