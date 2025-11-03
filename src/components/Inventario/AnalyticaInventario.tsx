import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Package, 
  Activity,
  AlertCircle,
  Target,
  Zap,
  TrendingUp
} from "lucide-react";
import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";
import GraficaHistorialInventario from "./GraficaHistorialInventario";
import TablaRotacionInventario from "./TablaRotacionInventario";

const AnalyticaInventario = () => {
  const { data: productosInventario, isLoading } = useInventarioConMovimientos();

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Cargando analítica de inventario...
      </div>
    );
  }

  // Calcular métricas principales (ya vienen calculados desde useInventarioConMovimientos)
  const valorTotalInventario = productosInventario?.reduce((total, producto) => 
    total + (producto.valor_total_inventario || 0), 0
  ) || 0;

  const totalUnidades = productosInventario?.reduce((total, producto) => 
    total + (producto.cantidad_stock || 0), 0
  ) || 0;

  const costoPromedioGeneral = valorTotalInventario > 0 && totalUnidades > 0 
    ? valorTotalInventario / totalUnidades : 0;

  const productosConMovimiento = productosInventario?.filter(p => 
    (p.cantidad_comprada || 0) > (p.cantidad_stock || 0)
  ).length || 0;

  const rotacionInventario = (productosInventario?.length || 0) > 0 
    ? (productosConMovimiento / (productosInventario?.length || 1)) * 100 : 0;

  const formatPrice = (precio: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(precio);
  };

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valor Total Inventario</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(valorTotalInventario)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Unidades</p>
                <p className="text-2xl font-bold text-primary">{totalUnidades.toLocaleString()}</p>
              </div>
              <Package className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Costo Promedio</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(costoPromedioGeneral)}</p>
              </div>
              <Target className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rotación</p>
                <p className="text-2xl font-bold text-primary">{rotacionInventario.toFixed(1)}%</p>
              </div>
              <Activity className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfica histórica de inventario */}
      <GraficaHistorialInventario />

      {/* Tabla de rotación de inventario */}
      <TablaRotacionInventario />

      {/* Alertas y recomendaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              Alertas de Inventario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(productosInventario?.filter(p => (p.cantidad_stock || 0) <= 10).length || 0) > 0 ? (
              <div>
                <h4 className="font-medium text-muted-foreground mb-2">Productos con Stock Bajo:</h4>
                <div className="space-y-2">
                  {(productosInventario || [])
                    .filter(p => (p.cantidad_stock || 0) <= 10 && (p.cantidad_stock || 0) > 0)
                    .slice(0, 5)
                    .map(producto => (
                      <div key={producto.id} className="flex items-center justify-between p-2 bg-muted/50 rounded border">
                        <span className="text-sm">{producto.nombre}</span>
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          {producto.cantidad_stock} unidades
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {(productosInventario?.filter(p => (p.cantidad_stock || 0) === 0).length || 0) > 0 ? (
              <div>
                <h4 className="font-medium text-muted-foreground mb-2">Productos Agotados:</h4>
                <div className="space-y-2">
                  {(productosInventario || [])
                    .filter(p => (p.cantidad_stock || 0) === 0)
                    .slice(0, 3)
                    .map(producto => (
                      <div key={producto.id} className="flex items-center justify-between p-2 bg-muted/50 rounded border">
                        <span className="text-sm">{producto.nombre}</span>
                        <Badge variant="destructive">
                          Agotado
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {(productosInventario?.filter(p => (p.cantidad_stock || 0) <= 10 || (p.cantidad_stock || 0) === 0).length || 0) === 0 && (
              <div className="text-center py-4 text-primary">
                <Zap className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">¡Todo está bien!</p>
                <p className="text-sm text-muted-foreground">No hay alertas de inventario en este momento.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <TrendingUp className="h-5 w-5" />
              Recomendaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 bg-card rounded-lg border">
                <h4 className="font-medium text-primary mb-1">Control de Costos</h4>
                <p className="text-sm text-muted-foreground">
                  El sistema calcula automáticamente el costo promedio ponderado para optimizar tu control de inventario.
                </p>
              </div>

              <div className="p-3 bg-card rounded-lg border">
                <h4 className="font-medium text-primary mb-1">Productos Rentables</h4>
                <p className="text-sm text-muted-foreground">
                  Revisa la tabla de rotación para identificar productos de rápida o lenta salida.
                </p>
              </div>

              <div className="p-3 bg-card rounded-lg border">
                <h4 className="font-medium text-primary mb-1">Rotación de Inventario</h4>
                <p className="text-sm text-muted-foreground">
                  Tu rotación actual es {rotacionInventario.toFixed(1)}%. Una rotación alta indica buena gestión de inventario.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticaInventario;