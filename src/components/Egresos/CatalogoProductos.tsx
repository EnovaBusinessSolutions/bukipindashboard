import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Package2, Edit, Trash2, Eye } from "lucide-react";

const CatalogoProductos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // Datos de ejemplo de productos para gastos y costos
  const gastos = [
    {
      id: 1,
      nombre: "Servicios de Mantenimiento",
      descripcion: "Mantenimiento de equipos y maquinaria",
      imagen: "/placeholder.svg",
      proveedorPrincipal: "Proveedor C",
      precioPromedio: 2800.00,
      ultimaCompra: "2024-01-08",
      totalTransacciones: 12,
      variacionPrecio: 15.5, // porcentaje de variación
      unidad: "servicio"
    },
    {
      id: 2,
      nombre: "Servicios Profesionales",
      descripcion: "Consultoría y asesoría especializada",
      imagen: "/placeholder.svg",
      proveedorPrincipal: "Consultor A",
      precioPromedio: 4200.00,
      ultimaCompra: "2024-01-14",
      totalTransacciones: 8,
      variacionPrecio: 8.2,
      unidad: "hora"
    },
    {
      id: 3,
      nombre: "Servicios Públicos",
      descripcion: "Electricidad, agua, internet",
      imagen: "/placeholder.svg",
      proveedorPrincipal: "CFE",
      precioPromedio: 1850.00,
      ultimaCompra: "2024-01-12",
      totalTransacciones: 24,
      variacionPrecio: 12.1,
      unidad: "mes"
    }
  ];

  const costos = [
    {
      id: 4,
      nombre: "Materiales de Construcción",
      descripcion: "Cemento, varillas, ladrillos",
      imagen: "/placeholder.svg",
      proveedorPrincipal: "Proveedor A",
      precioPromedio: 1250.00,
      ultimaCompra: "2024-01-15",
      totalTransacciones: 18,
      variacionPrecio: 22.3,
      unidad: "kg"
    },
    {
      id: 5,
      nombre: "Insumos Químicos",
      descripcion: "Productos químicos para procesos",
      imagen: "/placeholder.svg",
      proveedorPrincipal: "Proveedor D",
      precioPromedio: 980.00,
      ultimaCompra: "2024-01-12",
      totalTransacciones: 15,
      variacionPrecio: 18.7,
      unidad: "lt"
    },
    {
      id: 6,
      nombre: "Materia Prima",
      descripcion: "Materiales base para producción",
      imagen: "/placeholder.svg",
      proveedorPrincipal: "Proveedor E",
      precioPromedio: 3200.00,
      ultimaCompra: "2024-01-10",
      totalTransacciones: 22,
      variacionPrecio: 9.8,
      unidad: "ton"
    }
  ];

  const allProducts = [...gastos, ...costos];
  
  const filteredGastos = gastos.filter(producto => 
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producto.proveedorPrincipal.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredCostos = costos.filter(producto => 
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producto.proveedorPrincipal.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getVariationColor = (variacion: number) => {
    if (variacion > 20) return "text-destructive";
    if (variacion > 10) return "text-yellow-600";
    return "text-green-600";
  };

  const renderProductCard = (producto: any) => (
    <Card key={producto.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex gap-3 items-start">
          <img 
            src={producto.imagen} 
            alt={producto.nombre}
            className="w-16 h-16 object-cover rounded-md border"
          />
          <div className="flex-1">
            <CardTitle className="text-lg">{producto.nombre}</CardTitle>
            <CardDescription className="mt-1">
              {producto.descripcion}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Proveedor principal:</span>
          <span className="font-medium">{producto.proveedorPrincipal}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Precio promedio:</span>
          <span className="font-semibold">${producto.precioPromedio.toLocaleString()}/{producto.unidad}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Variación de precio:</span>
          <span className={`font-medium ${getVariationColor(producto.variacionPrecio)}`}>
            ±{producto.variacionPrecio}%
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Transacciones:</span>
          <span>{producto.totalTransacciones}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Última compra:</span>
          <span>{new Date(producto.ultimaCompra).toLocaleDateString()}</span>
        </div>
        
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" className="flex-1">
            <Eye className="h-3 w-3 mr-1" />
            Analíticas
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            <Edit className="h-3 w-3 mr-1" />
            Editar
          </Button>
          <Button size="sm" variant="outline" className="text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar gastos o costos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        
        <Button className="gap-2">
          <Package2 className="h-4 w-4" />
          Agregar Gasto/Costo
        </Button>
      </div>

      {/* Sección de Gastos */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Catálogo de Gastos</h2>
          <Badge variant="secondary">{filteredGastos.length}</Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGastos.map(renderProductCard)}
        </div>

        {filteredGastos.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Package2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No se encontraron gastos que coincidan con la búsqueda
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sección de Costos */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Catálogo de Costos</h2>
          <Badge variant="secondary">{filteredCostos.length}</Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCostos.map(renderProductCard)}
        </div>

        {filteredCostos.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Package2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No se encontraron costos que coincidan con la búsqueda
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CatalogoProductos;