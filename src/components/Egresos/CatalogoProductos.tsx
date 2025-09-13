import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, Package2, Edit, Trash2, Eye, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const CatalogoProductos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    nombre: "",
    descripcion: "",
    tipo: "", // "gasto" o "costo"
    unidad: "",
    categoria: "",
    proveedorPrincipal: "",
    esRecurrente: false,
    subcuentaId: ""
  });

  // Mock data para subcuentas - en producción vendría de la base de datos
  const subcuentas = [
    { id: "1", nombre: "Gastos de Oficina", cuenta_madre_codigo: "5001" },
    { id: "2", nombre: "Servicios Públicos", cuenta_madre_codigo: "5002" },
    { id: "3", nombre: "Materia Prima Principal", cuenta_madre_codigo: "4001" }
  ];

  // Catálogos vacíos para comenzar desde cero
  const gastos: any[] = [];
  const costos: any[] = [];

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

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newProduct.nombre || !newProduct.tipo || !newProduct.unidad) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa al menos el nombre, tipo y unidad",
        variant: "destructive"
      });
      return;
    }

    // Validar subcuenta para productos recurrentes
    if (newProduct.esRecurrente && !newProduct.subcuentaId) {
      toast({
        title: "⚠️ Subcuenta requerida",
        description: "Para productos recurrentes es obligatorio asignar una subcuenta para llevar un mejor control analítico",
        variant: "destructive"
      });
      return;
    }

    console.log("Nuevo producto agregado:", newProduct);
    
    toast({
      title: "Producto agregado",
      description: `${newProduct.tipo === "gasto" ? "Gasto" : "Costo"} "${newProduct.nombre}" agregado al catálogo`
    });

    // Reset form
    setNewProduct({
      nombre: "",
      descripcion: "",
      tipo: "",
      unidad: "",
      categoria: "",
      proveedorPrincipal: "",
      esRecurrente: false,
      subcuentaId: ""
    });
    setIsDialogOpen(false);
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
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Gasto/Costo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Gasto/Costo</DialogTitle>
              <DialogDescription>
                Agrega un nuevo item al catálogo de gastos o costos
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={newProduct.nombre}
                    onChange={(e) => setNewProduct({...newProduct, nombre: e.target.value})}
                    placeholder="Nombre del producto/servicio"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select value={newProduct.tipo} onValueChange={(value) => setNewProduct({...newProduct, tipo: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gasto">Gasto</SelectItem>
                      <SelectItem value="costo">Costo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={newProduct.descripcion}
                  onChange={(e) => setNewProduct({...newProduct, descripcion: e.target.value})}
                  placeholder="Descripción del producto/servicio"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unidad">Unidad de Medida *</Label>
                  <Select value={newProduct.unidad} onValueChange={(value) => setNewProduct({...newProduct, unidad: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                      <SelectItem value="litros">Litros (L)</SelectItem>
                      <SelectItem value="metros">Metros (m)</SelectItem>
                      <SelectItem value="piezas">Piezas (pz)</SelectItem>
                      <SelectItem value="horas">Horas (hrs)</SelectItem>
                      <SelectItem value="servicios">Servicios</SelectItem>
                      <SelectItem value="otros">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría</Label>
                  <Select value={newProduct.categoria} onValueChange={(value) => setNewProduct({...newProduct, categoria: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="materias-primas">Materias Primas</SelectItem>
                      <SelectItem value="servicios-publicos">Servicios Públicos</SelectItem>
                      <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="administrativos">Administrativos</SelectItem>
                      <SelectItem value="otros">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proveedor">Proveedor Principal</Label>
                <Input
                  id="proveedor"
                  value={newProduct.proveedorPrincipal}
                  onChange={(e) => setNewProduct({...newProduct, proveedorPrincipal: e.target.value})}
                  placeholder="Nombre del proveedor"
                />
              </div>

              {/* Checkbox para producto recurrente */}
              <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/50">
                <Checkbox
                  id="recurrente"
                  checked={newProduct.esRecurrente}
                  onCheckedChange={(checked) => setNewProduct({...newProduct, esRecurrente: !!checked})}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="recurrente" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Producto recurrente
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Para productos que se compran frecuentemente es recomendable asignar una subcuenta para análisis detallado
                  </p>
                </div>
              </div>

              {/* Selector de subcuenta */}
              {newProduct.esRecurrente && (
                <div className="space-y-2 p-4 border rounded-lg bg-primary/5">
                  <Label htmlFor="subcuenta" className="flex items-center gap-2">
                    Subcuenta *
                    <span className="text-xs text-muted-foreground">(Obligatorio para productos recurrentes)</span>
                  </Label>
                  <Select value={newProduct.subcuentaId} onValueChange={(value) => setNewProduct({...newProduct, subcuentaId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar subcuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcuentas.map((subcuenta) => (
                        <SelectItem key={subcuenta.id} value={subcuenta.id}>
                          {subcuenta.nombre} ({subcuenta.cuenta_madre_codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    💡 Si no tienes la subcuenta que necesitas, ve al Plan de Cuentas para crearla
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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