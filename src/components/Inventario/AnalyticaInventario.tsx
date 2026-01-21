import React, { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Package,
  Activity,
  AlertCircle,
  Target,
  Zap,
  TrendingUp,
  Boxes,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";
import GraficaHistorialInventario from "./GraficaHistorialInventario";
import TablaRotacionInventario from "./TablaRotacionInventario";
import { formatCurrency } from "@/lib/utils";

const n = (v: any) => {
  const num = Number(v ?? 0);
  return Number.isFinite(num) ? num : 0;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const AnalyticaInventario = () => {
  const { data: productosInventario = [], isLoading } = useInventarioConMovimientos();

  const metrics = useMemo(() => {
    const items = productosInventario || [];

    // Totales base (stock puede ser negativo si vendiste sin stock)
    const valorTotalInventario = items.reduce((acc, p) => acc + n(p.valor_total_inventario), 0);
    const totalUnidades = items.reduce((acc, p) => acc + n(p.cantidad_stock), 0);

    // Para costo promedio "usable", ignoramos stock <= 0 (no representa inventario disponible)
    const unidadesPositivas = items.reduce((acc, p) => {
      const s = n(p.cantidad_stock);
      return acc + (s > 0 ? s : 0);
    }, 0);

    const valorInventarioPositivo = items.reduce((acc, p) => {
      const s = n(p.cantidad_stock);
      const v = n(p.valor_total_inventario);
      return acc + (s > 0 ? v : 0);
    }, 0);

    const costoPromedioGeneral = unidadesPositivas > 0 ? valorInventarioPositivo / unidadesPositivas : 0;

    // Rotación: SKUs con alguna salida/venta (cantidad_vendida > 0) sobre total SKUs
    const totalSkus = items.length;
    const skusConVentas = items.filter((p) => n(p.cantidad_vendida) > 0).length;
    const rotacionInventario = totalSkus > 0 ? (skusConVentas / totalSkus) * 100 : 0;

    // Alertas
    const stockBajo = items.filter((p) => {
      const s = n(p.cantidad_stock);
      return s > 0 && s <= 10;
    }).length;

    const agotados = items.filter((p) => n(p.cantidad_stock) === 0).length;
    const negativos = items.filter((p) => n(p.cantidad_stock) < 0).length;

    // Top lists (para tarjetas de alertas)
    const topBajoStock = items
      .filter((p) => {
        const s = n(p.cantidad_stock);
        return s > 0 && s <= 10;
      })
      .sort((a, b) => n(a.cantidad_stock) - n(b.cantidad_stock))
      .slice(0, 6);

    const topAgotados = items
      .filter((p) => n(p.cantidad_stock) === 0)
      .slice(0, 5);

    const topNegativos = items
      .filter((p) => n(p.cantidad_stock) < 0)
      .sort((a, b) => n(a.cantidad_stock) - n(b.cantidad_stock)) // más negativo primero
      .slice(0, 5);

    // “Salud” general (heurística simple)
    const salud =
      negativos > 0 ? "critica" : agotados > 0 ? "media" : stockBajo > 0 ? "atencion" : "ok";

    return {
      valorTotalInventario,
      totalUnidades,
      costoPromedioGeneral,
      totalSkus,
      skusConVentas,
      rotacionInventario: clamp(rotacionInventario, 0, 100),
      stockBajo,
      agotados,
      negativos,
      topBajoStock,
      topAgotados,
      topNegativos,
      salud,
    };
  }, [productosInventario]);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando analítica de inventario...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-muted/60">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Valor total inventario</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(metrics.valorTotalInventario)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Basado en costo promedio ponderado
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-primary shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted/60">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Unidades en stock</p>
                <p className="text-2xl font-bold text-primary">{metrics.totalUnidades.toLocaleString("es-MX")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Suma de existencias por producto
                </p>
              </div>
              <Package className="h-8 w-8 text-primary shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted/60">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Costo promedio</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(metrics.costoPromedioGeneral)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Calculado solo con stock positivo
                </p>
              </div>
              <Target className="h-8 w-8 text-primary shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted/60">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Rotación</p>
                <p className="text-2xl font-bold text-primary">{metrics.rotacionInventario.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.skusConVentas} de {metrics.totalSkus} SKUs con salidas/ventas
                </p>
              </div>
              <Activity className="h-8 w-8 text-primary shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs secundarios (más contexto pro) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-muted/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">SKUs registrados</p>
                <p className="text-xl font-bold">{metrics.totalSkus}</p>
              </div>
              <Boxes className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Stock bajo</p>
                <p className="text-xl font-bold text-orange-600">{metrics.stockBajo}</p>
              </div>
              <TriangleAlert className="h-6 w-6 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Agotados</p>
                <p className="text-xl font-bold text-red-600">{metrics.agotados}</p>
              </div>
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Inventario negativo</p>
                <p className="text-xl font-bold text-red-600">{metrics.negativos}</p>
              </div>
              <AlertCircle className="h-6 w-6 text-red-600" />
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
        {/* Alertas */}
        <Card className="border-muted/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              Alertas de inventario
            </CardTitle>
            <CardDescription>Prioriza compras y ajustes con base en existencias reales</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Salud general */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Estado general</p>
                <p className="text-xs text-muted-foreground">
                  Basado en stock bajo, agotados y negativos
                </p>
              </div>

              {metrics.salud === "ok" ? (
                <Badge className="bg-green-100 text-green-800">OK</Badge>
              ) : metrics.salud === "atencion" ? (
                <Badge className="bg-orange-100 text-orange-800">Atención</Badge>
              ) : metrics.salud === "media" ? (
                <Badge className="bg-red-100 text-red-800">Urgente</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">Crítica</Badge>
              )}
            </div>

            {/* Negativos (máxima prioridad) */}
            {metrics.negativos > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Inventario negativo (prioridad alta)</h4>
                <div className="space-y-2">
                  {metrics.topNegativos.map((p: any) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded border bg-red-50/60 dark:bg-red-950/20"
                    >
                      <span className="text-sm">{p.nombre}</span>
                      <Badge variant="destructive">{n(p.cantidad_stock)} unidades</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Esto indica que se registraron salidas/ventas sin stock suficiente. Se recomienda ajustar o comprar para corregir.
                </p>
              </div>
            )}

            {/* Bajo stock */}
            {metrics.stockBajo > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-orange-600">Productos con stock bajo</h4>
                <div className="space-y-2">
                  {metrics.topBajoStock.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-muted/40 rounded border">
                      <span className="text-sm">{p.nombre}</span>
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">
                        {n(p.cantidad_stock)} unidades
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agotados */}
            {metrics.agotados > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Productos agotados</h4>
                <div className="space-y-2">
                  {metrics.topAgotados.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-muted/40 rounded border">
                      <span className="text-sm">{p.nombre}</span>
                      <Badge variant="destructive">Agotado</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Todo OK */}
            {metrics.negativos === 0 && metrics.agotados === 0 && metrics.stockBajo === 0 && (
              <div className="text-center py-6 text-primary">
                <Zap className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">¡Todo está bien!</p>
                <p className="text-sm text-muted-foreground">
                  No hay alertas de inventario en este momento.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recomendaciones */}
        <Card className="border-muted/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Recomendaciones
            </CardTitle>
            <CardDescription>Acciones sugeridas con base en tus datos actuales</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-3">
              {/* recomendación dinámica 1 */}
              <div className="p-3 bg-card rounded-lg border">
                <h4 className="font-medium text-primary mb-1">Control de costos</h4>
                <p className="text-sm text-muted-foreground">
                  Tu costo promedio general es <span className="font-medium">{formatCurrency(metrics.costoPromedioGeneral)}</span>. Mantén compras consistentes para evitar variaciones grandes.
                </p>
              </div>

              {/* recomendación dinámica 2 */}
              <div className="p-3 bg-card rounded-lg border">
                <h4 className="font-medium text-primary mb-1">Rotación</h4>
                <p className="text-sm text-muted-foreground">
                  Rotación actual: <span className="font-medium">{metrics.rotacionInventario.toFixed(1)}%</span>.{" "}
                  {metrics.rotacionInventario >= 60
                    ? "Buen nivel: muchos productos están saliendo."
                    : metrics.rotacionInventario >= 30
                      ? "Nivel medio: revisa productos con salida lenta."
                      : "Nivel bajo: conviene revisar demanda y ajustar compras."}
                </p>
              </div>

              {/* recomendación dinámica 3 */}
              {metrics.negativos > 0 ? (
                <div className="p-3 bg-card rounded-lg border">
                  <h4 className="font-medium text-red-600 mb-1">Corrige inventario negativo</h4>
                  <p className="text-sm text-muted-foreground">
                    Tienes <span className="font-medium text-red-600">{metrics.negativos}</span> productos con stock negativo.
                    Prioriza compras o ajustes para que tu inventario y contabilidad reflejen la realidad.
                  </p>
                </div>
              ) : metrics.agotados > 0 ? (
                <div className="p-3 bg-card rounded-lg border">
                  <h4 className="font-medium text-orange-600 mb-1">Reabastecimiento</h4>
                  <p className="text-sm text-muted-foreground">
                    Hay <span className="font-medium">{metrics.agotados}</span> productos agotados. Si son de alta demanda,
                    reabastece para evitar pérdida de ventas.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-card rounded-lg border">
                  <h4 className="font-medium text-primary mb-1">Operación saludable</h4>
                  <p className="text-sm text-muted-foreground">
                    Tu inventario no presenta alertas críticas. Mantén revisiones semanales y usa el historial para detectar tendencias.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticaInventario;
