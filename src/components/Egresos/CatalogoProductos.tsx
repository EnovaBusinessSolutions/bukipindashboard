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
import { useNavigate } from "react-router-dom";
import { useSubcuentas } from "@/hooks/useSubcuentas";

const CatalogoProductos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { data: subcuentasData } = useSubcuentas();
  const subcuentas = subcuentasData || [];

  const [newProduct, setNewProduct] = useState({
    nombre: "",
    descripcion: "",
    tipo: "", // "gasto" o "costo"
    unidad: "",
    categoria: "",
    proveedorPrincipal: "",
    esRecurrente: false,
    subcuentaId: "",
    cuentaContable: "" // Nueva propiedad para la cuenta contable seleccionada
  });

  // Cuentas contables que se verán afectadas según el tipo
  const getCuentasAfectadas = (tipo: string) => {
    if (tipo === "costo") {
      return [
        { codigo: "5001", nombre: "Costo de Ventas", subgrupo: "Costo de Ventas" },
        { codigo: "5002", nombre: "Costo de Ventas Inventario", subgrupo: "Costo de Ventas" },
        { codigo: "5003", nombre: "Devoluciones sobre Compras", subgrupo: "Costo de Ventas" },
        { codigo: "5004", nombre: "Descuentos sobre Compras", subgrupo: "Costo de Ventas" }
      ];
    } else if (tipo === "gasto") {
      return [
        { codigo: "5101", nombre: "Gastos de Venta", subgrupo: "Gastos de Operación" },
        { codigo: "5102", nombre: "Sueldos y Salarios Ventas", subgrupo: "Gastos de Operación" },
        { codigo: "5104", nombre: "Publicidad", subgrupo: "Gastos de Operación" },
        { codigo: "5105", nombre: "Gastos de Administración", subgrupo: "Gastos de Operación" },
        { codigo: "5106", nombre: "Sueldos y Salarios Administración", subgrupo: "Gastos de Operación" },
        { codigo: "5107", nombre: "Renta de Oficinas", subgrupo: "Gastos de Operación" },
        { codigo: "5108", nombre: "Servicios Públicos", subgrupo: "Gastos de Operación" },
        { codigo: "5201", nombre: "Intereses Pagados", subgrupo: "Gastos Financieros" },
        { codigo: "5202", nombre: "Comisiones Bancarias", subgrupo: "Gastos Financieros" }
      ];
    }
    return [];
  };

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

    // Validar cuenta contable (solo para gastos, costos usan 5001 automáticamente)
    if (newProduct.tipo === "gasto" && !newProduct.cuentaContable) {
      toast({
        title: "⚠️ Cuenta contable requerida",
        description: "Selecciona la cuenta contable que se verá afectada por este gasto",
        variant: "destructive"
      });
      return;
    }

    // Validar subcuenta obligatoria - SIEMPRE requerida
    if (!newProduct.subcuentaId) {
      toast({
        title: "⚠️ Subcuenta requerida",
        description: "Es obligatorio seleccionar una subcuenta para registrar este producto",
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
      subcuentaId: "",
      cuentaContable: ""
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
                  <Select value={newProduct.tipo} onValueChange={(value) => {
                    const updatedProduct = {...newProduct, tipo: value, subcuentaId: ""};
                    if (value === "costo") {
                      updatedProduct.cuentaContable = "5001";
                    } else {
                      updatedProduct.cuentaContable = "";
                    }
                    setNewProduct(updatedProduct);
                  }}>
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

              {/* Mostrar selector de cuentas contables solo para gastos */}
              {newProduct.tipo === "gasto" && (
                <div className="space-y-2">
                  <Label htmlFor="cuenta-contable">Cuenta Contable a Afectar *</Label>
                  <Select value={newProduct.cuentaContable} onValueChange={(value) => setNewProduct({...newProduct, cuentaContable: value, subcuentaId: ""})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuenta contable" />
                    </SelectTrigger>
                    <SelectContent>
                      {getCuentasAfectadas(newProduct.tipo).map((cuenta) => (
                        <SelectItem key={cuenta.codigo} value={cuenta.codigo}>
                          {cuenta.codigo} - {cuenta.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!newProduct.cuentaContable && (
                    <p className="text-xs text-muted-foreground">
                      📊 Selecciona la cuenta contable que se verá afectada por este gasto
                    </p>
                  )}
                </div>
              )}

              {/* Mostrar cuenta automática para costos */}
              {newProduct.tipo === "costo" && (
                <div className="space-y-2">
                  <Label>Cuenta Contable Asignada</Label>
                  <div className="p-3 bg-muted rounded-md border">
                    <p className="text-sm font-medium">5001 - Costo de Ventas</p>
                    <p className="text-xs text-muted-foreground">
                      ✓ Cuenta asignada automáticamente para costos
                    </p>
                  </div>
                </div>
              )}

              {/* Selector de subcuenta obligatorio cuando se selecciona cuenta */}
              {newProduct.cuentaContable && (
                <div className="space-y-2 p-4 border rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <Label htmlFor="subcuenta-obligatoria" className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                    Subcuenta Asociada *
                    <span className="text-xs">(Obligatorio)</span>
                  </Label>
                  <Select value={newProduct.subcuentaId} onValueChange={(value) => setNewProduct({...newProduct, subcuentaId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar subcuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcuentas
                        .filter(sub => sub.cuenta_madre_codigo === newProduct.cuentaContable)
                        .map((subcuenta) => (
                          <SelectItem key={subcuenta.id} value={subcuenta.id}>
                            {subcuenta.nombre}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {subcuentas.filter(sub => sub.cuenta_madre_codigo === newProduct.cuentaContable).length === 0 && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                        ⚠️ No hay subcuentas disponibles para esta cuenta
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        Debes crear una subcuenta en el Plan de Cuentas antes de continuar
                      </p>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 text-yellow-800 border-yellow-300 hover:bg-yellow-100"
                        onClick={() => {
                          setIsDialogOpen(false);
                          navigate('/plan-cuentas');
                        }}
                      >
                        Ir al Plan de Cuentas
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    💡 La subcuenta permite un mejor control y análisis contable de este producto
                  </p>
                </div>
              )}

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