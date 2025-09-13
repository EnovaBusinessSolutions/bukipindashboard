import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Package2, Edit, Trash2, Eye } from "lucide-react";

const CatalogoProductos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // Datos de ejemplo de productos para compras/gastos
  const productos = [
    {
      id: 1,
      nombre: "Materiales de Construcción",
      categoria: "materiales",
      proveedor: "Proveedor A",
      ultimoPrecio: 1250.00,
      ultimaCompra: "2024-01-15",
      stock: 45,
      unidad: "kg"
    },
    {
      id: 2,
      nombre: "Equipo de Oficina",
      categoria: "equipos",
      proveedor: "Proveedor B",
      ultimoPrecio: 3500.00,
      ultimaCompra: "2024-01-10",
      stock: 8,
      unidad: "pza"
    },
    {
      id: 3,
      nombre: "Servicios de Mantenimiento",
      categoria: "servicios",
      proveedor: "Proveedor C",
      ultimoPrecio: 2800.00,
      ultimaCompra: "2024-01-08",
      stock: 0,
      unidad: "servicio"
    },
    {
      id: 4,
      nombre: "Insumos Químicos",
      categoria: "materiales",
      proveedor: "Proveedor D",
      ultimoPrecio: 980.00,
      ultimaCompra: "2024-01-12",
      stock: 120,
      unidad: "lt"
    }
  ];

  const filteredProducts = productos.filter(producto => {
    const matchesSearch = producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         producto.proveedor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || producto.categoria === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (categoria: string) => {
    const colors = {
      materiales: "bg-blue-100 text-blue-800",
      equipos: "bg-green-100 text-green-800",
      servicios: "bg-purple-100 text-purple-800"
    };
    return colors[categoria as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos o proveedores..."
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
          Agregar Producto
        </Button>
      </div>

      {/* Filtros de categoría */}
      <div className="flex gap-2 flex-wrap">
        <Badge 
          variant={filterCategory === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilterCategory("all")}
        >
          Todos
        </Badge>
        <Badge 
          variant={filterCategory === "materiales" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilterCategory("materiales")}
        >
          Materiales
        </Badge>
        <Badge 
          variant={filterCategory === "equipos" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilterCategory("equipos")}
        >
          Equipos
        </Badge>
        <Badge 
          variant={filterCategory === "servicios" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilterCategory("servicios")}
        >
          Servicios
        </Badge>
      </div>

      {/* Lista de productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((producto) => (
          <Card key={producto.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{producto.nombre}</CardTitle>
                <Badge className={getCategoryColor(producto.categoria)}>
                  {producto.categoria}
                </Badge>
              </div>
              <CardDescription>
                Proveedor: {producto.proveedor}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Último precio:</span>
                <span className="font-semibold">${producto.ultimoPrecio.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Última compra:</span>
                <span>{new Date(producto.ultimaCompra).toLocaleDateString()}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Stock:</span>
                <span className={producto.stock === 0 ? "text-destructive" : ""}>
                  {producto.stock} {producto.unidad}
                </span>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1">
                  <Eye className="h-3 w-3 mr-1" />
                  Ver
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
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Package2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No se encontraron productos que coincidan con los filtros
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CatalogoProductos;