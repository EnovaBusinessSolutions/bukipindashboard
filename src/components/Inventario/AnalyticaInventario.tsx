import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  Activity,
  AlertCircle,
  Target,
  Zap
} from "lucide-react";
import { useProductos } from "@/hooks/useProductos";

const AnalyticaInventario = () => {
  const { data: productos, isLoading } = useProductos();

  // Filtrar solo productos de inventario
  const productosInventario = productos?.filter(producto => 
    (producto.cantidad_stock && producto.cantidad_stock > 0) || 
    (producto.cantidad_comprada && producto.cantidad_comprada > 0)
  ) || [];

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Cargando analítica de inventario...
      </div>
    );
  }

  // Calcular métricas principales
  const valorTotalInventario = productosInventario.reduce((total, producto) => 
    total + (producto.valor_total_inventario || 0), 0
  );

  const totalUnidades = productosInventario.reduce((total, producto) => 
    total + (producto.cantidad_stock || 0), 0
  );

  const costoPromedioGeneral = valorTotalInventario > 0 && totalUnidades > 0 
    ? valorTotalInventario / totalUnidades : 0;

  const productosConMovimiento = productosInventario.filter(p => 
    (p.cantidad_comprada || 0) > (p.cantidad_stock || 0)
  ).length;

  const rotacionInventario = productosInventario.length > 0 
    ? (productosConMovimiento / productosInventario.length) * 100 : 0;

  // Datos para gráficos
  const datosValorPorProducto = productosInventario
    .sort((a, b) => (b.valor_total_inventario || 0) - (a.valor_total_inventario || 0))
    .slice(0, 5)
    .map(producto => ({
      nombre: producto.nombre.length > 15 ? producto.nombre.substring(0, 15) + '...' : producto.nombre,
      valor: producto.valor_total_inventario || 0,
      cantidad: producto.cantidad_stock || 0
    }));

  const datosDistribucionStock = productosInventario.map(producto => {
    const stockActual = producto.cantidad_stock || 0;
    const stockMinimo = 10; // Configurable en el futuro
    
    let nivel = 'Alto';
    let color = '#22c55e';
    
    if (stockActual === 0) {
      nivel = 'Agotado';
      color = '#ef4444';
    } else if (stockActual <= stockMinimo) {
      nivel = 'Bajo';
      color = '#f97316';
    } else if (stockActual <= stockMinimo * 2) {
      nivel = 'Medio';
      color = '#eab308';
    }
    
    return {
      nombre: producto.nombre,
      nivel,
      valor: stockActual,
      color
    };
  });

  const resumenNiveles = datosDistribucionStock.reduce((acc, item) => {
    const existing = acc.find(a => a.nivel === item.nivel);
    if (existing) {
      existing.cantidad += 1;
    } else {
      acc.push({ nivel: item.nivel, cantidad: 1, color: item.color });
    }
    return acc;
  }, [] as any[]);

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
                <p className="text-2xl font-bold text-green-600">{formatPrice(valorTotalInventario)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Unidades</p>
                <p className="text-2xl font-bold text-blue-600">{totalUnidades.toLocaleString()}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Costo Promedio</p>
                <p className="text-2xl font-bold text-purple-600">{formatPrice(costoPromedioGeneral)}</p>
              </div>
              <Target className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rotación</p>
                <p className="text-2xl font-bold text-orange-600">{rotacionInventario.toFixed(1)}%</p>
              </div>
              <Activity className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de productos por valor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Top 5 Productos por Valor
            </CardTitle>
            <CardDescription>
              Productos con mayor valor total en inventario
            </CardDescription>
          </CardHeader>
          <CardContent>
            {datosValorPorProducto.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={datosValorPorProducto}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="nombre" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tickFormatter={(value) => formatPrice(value)} />
                  <Tooltip formatter={(value) => [formatPrice(Number(value)), "Valor"]} />
                  <Bar dataKey="valor" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay datos de productos para mostrar
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribución de niveles de stock */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Distribución Niveles de Stock
            </CardTitle>
            <CardDescription>
              Clasificación de productos por nivel de stock
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resumenNiveles.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={resumenNiveles}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ nivel, cantidad, percent }) => 
                      `${nivel}: ${cantidad} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cantidad"
                  >
                    {resumenNiveles.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay datos de stock para mostrar
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas y recomendaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              Alertas de Inventario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {productosInventario.filter(p => (p.cantidad_stock || 0) <= 10).length > 0 ? (
              <div>
                <h4 className="font-medium text-orange-800 mb-2">Productos con Stock Bajo:</h4>
                <div className="space-y-2">
                  {productosInventario
                    .filter(p => (p.cantidad_stock || 0) <= 10 && (p.cantidad_stock || 0) > 0)
                    .slice(0, 5)
                    .map(producto => (
                      <div key={producto.id} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                        <span className="text-sm">{producto.nombre}</span>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          {producto.cantidad_stock} unidades
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {productosInventario.filter(p => (p.cantidad_stock || 0) === 0).length > 0 ? (
              <div>
                <h4 className="font-medium text-red-800 mb-2">Productos Agotados:</h4>
                <div className="space-y-2">
                  {productosInventario
                    .filter(p => (p.cantidad_stock || 0) === 0)
                    .slice(0, 3)
                    .map(producto => (
                      <div key={producto.id} className="flex items-center justify-between p-2 bg-red-50 rounded">
                        <span className="text-sm">{producto.nombre}</span>
                        <Badge variant="destructive">
                          Agotado
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {productosInventario.filter(p => (p.cantidad_stock || 0) <= 10 || (p.cantidad_stock || 0) === 0).length === 0 && (
              <div className="text-center py-4 text-green-600">
                <Zap className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">¡Todo está bien!</p>
                <p className="text-sm">No hay alertas de inventario en este momento.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <TrendingUp className="h-5 w-5" />
              Recomendaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-1">Control de Costos</h4>
                <p className="text-sm text-blue-700">
                  El sistema calcula automáticamente el costo promedio ponderado para optimizar tu control de inventario.
                </p>
              </div>

              <div className="p-3 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-1">Productos Rentables</h4>
                <p className="text-sm text-green-700">
                  Los productos con mayor valor representan {((datosValorPorProducto.length / productosInventario.length) * 100).toFixed(0)}% del inventario total.
                </p>
              </div>

              <div className="p-3 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-1">Rotación de Inventario</h4>
                <p className="text-sm text-purple-700">
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