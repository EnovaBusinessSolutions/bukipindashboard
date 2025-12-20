import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Filter, Package2, Edit, Trash2, Eye, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import FriendlySubcuentaSelector from "@/components/ui/friendly-subcuenta-selector";

// ✅ Supabase eliminado (no se usa aquí)
import {
  useProductosEgresos,
  useCreateProductoEgreso,
  useUpdateProductoEgreso,
  useDeleteProductoEgreso,
  CreateProductoEgresoData,
  UpdateProductoEgresoData,
} from "@/hooks/useProductosEgresos";

const CatalogoProductos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const navigate = useNavigate();

  // Use data hooks (estos son los que deben estar migrados a Mongo)
  const { data: productosEgresos = [], isLoading } = useProductosEgresos();
  const createProducto = useCreateProductoEgreso();
  const updateProducto = useUpdateProductoEgreso();
  const deleteProducto = useDeleteProductoEgreso();

  const [newProduct, setNewProduct] = useState({
    nombre: "",
    descripcion: "",
    tipo: "", // "gasto" o "costo"
    unidad: "",
    proveedorPrincipal: "",
    esRecurrente: false,
    subcuentaId: "",
    cuentaContable: "",
    imagen: null as File | null,
  });

  const getCuentasAfectadas = (tipo: string) => {
    if (tipo === "costo") {
      return [
        { codigo: "5001", nombre: "Costo de Ventas", subgrupo: "Costo de Ventas" },
        { codigo: "5002", nombre: "Costo de Ventas Inventario", subgrupo: "Costo de Ventas" },
        { codigo: "5003", nombre: "Devoluciones sobre Compras", subgrupo: "Costo de Ventas" },
        { codigo: "5004", nombre: "Descuentos sobre Compras", subgrupo: "Costo de Ventas" },
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
        { codigo: "5201", nombre: "Gastos Financieros", subgrupo: "Gastos Financieros" },
        { codigo: "5202", nombre: "Comisiones Bancarias", subgrupo: "Gastos Financieros" },
      ];
    }
    return [];
  };

  const gastos = productosEgresos.filter((p: any) => p.tipo === "gasto");
  const costos = productosEgresos.filter((p: any) => p.tipo === "costo");

  const filteredGastos = gastos.filter((producto: any) =>
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (producto.proveedor_principal && producto.proveedor_principal.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredCostos = costos.filter((producto: any) =>
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (producto.proveedor_principal && producto.proveedor_principal.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getVariationColor = (variacion: number) => {
    if (variacion > 20) return "text-destructive";
    if (variacion > 10) return "text-yellow-600";
    return "text-green-600";
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newProduct.nombre || !newProduct.tipo || !newProduct.unidad) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa al menos el nombre, tipo y unidad",
        variant: "destructive",
      });
      return;
    }

    if (newProduct.tipo === "gasto" && !newProduct.cuentaContable) {
      toast({
        title: "⚠️ Cuenta contable requerida",
        description: "Selecciona la cuenta contable que se verá afectada por este gasto",
        variant: "destructive",
      });
      return;
    }

    if (newProduct.tipo === "costo" && !newProduct.subcuentaId) {
      toast({
        title: "⚠️ Subcuenta requerida",
        description: "Es obligatorio seleccionar una subcuenta para registrar un costo",
        variant: "destructive",
      });
      return;
    }

    const createData: CreateProductoEgresoData = {
      nombre: newProduct.nombre,
      descripcion: newProduct.descripcion,
      tipo: newProduct.tipo as "gasto" | "costo",
      unidad: newProduct.unidad,
      proveedor_principal: newProduct.proveedorPrincipal,
      es_recurrente: newProduct.esRecurrente,
      subcuenta_id: newProduct.subcuentaId,
      cuenta_contable: newProduct.cuentaContable,
      imagen: newProduct.imagen || undefined,
    };

    createProducto.mutate(createData, {
      onSuccess: () => {
        setNewProduct({
          nombre: "",
          descripcion: "",
          tipo: "",
          unidad: "",
          proveedorPrincipal: "",
          esRecurrente: false,
          subcuentaId: "",
          cuentaContable: "",
          imagen: null,
        });
        setIsDialogOpen(false);
      },
    });
  };

  const handleEditProduct = (producto: any) => {
    setEditingProduct({
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion || "",
      tipo: producto.tipo,
      unidad: producto.unidad,
      proveedorPrincipal: producto.proveedor_principal || "",
      esRecurrente: producto.es_recurrente,
      subcuentaId: producto.subcuenta_id || "",
      cuentaContable: producto.cuenta_contable,
      imagen: null,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProduct.nombre || !editingProduct.tipo || !editingProduct.unidad) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa al menos el nombre, tipo y unidad",
        variant: "destructive",
      });
      return;
    }

    const updateData: UpdateProductoEgresoData = {
      id: editingProduct.id,
      nombre: editingProduct.nombre,
      descripcion: editingProduct.descripcion,
      tipo: editingProduct.tipo,
      unidad: editingProduct.unidad,
      proveedor_principal: editingProduct.proveedorPrincipal,
      es_recurrente: editingProduct.esRecurrente,
      subcuenta_id: editingProduct.subcuentaId,
      cuenta_contable: editingProduct.cuentaContable,
      imagen: editingProduct.imagen || undefined,
    };

    updateProducto.mutate(updateData, {
      onSuccess: () => {
        setEditingProduct(null);
        setIsEditDialogOpen(false);
      },
    });
  };

  const renderProductCard = (producto: any) => (
    <Card key={producto.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex gap-3 items-start">
          {producto.imagen_url ? (
            <img
              src={producto.imagen_url}
              alt={producto.nombre}
              className="w-16 h-16 object-cover rounded-md border"
            />
          ) : (
            <div className="w-16 h-16 bg-muted rounded-md border flex items-center justify-center">
              <Package2 className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <CardTitle className="text-lg">{producto.nombre}</CardTitle>
            <CardDescription className="mt-1">
              {producto.descripcion || "Sin descripción"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Proveedor principal:</span>
          <span className="font-medium">{producto.proveedor_principal || "No especificado"}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Unidad:</span>
          <span className="font-medium">{producto.unidad}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Precio promedio:</span>
          <span className="font-semibold">
            ${producto.precio_promedio?.toLocaleString() || 0}/{producto.unidad}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Variación de precio:</span>
          <span className={`font-medium ${getVariationColor(producto.variacion_precio || 0)}`}>
            ±{producto.variacion_precio || 0}%
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Transacciones:</span>
          <span>{producto.total_transacciones || 0}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Última compra:</span>
          <span>{producto.ultima_compra ? new Date(producto.ultima_compra).toLocaleDateString() : "-"}</span>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => {
              if (producto.total_transacciones > 0) {
                navigate(`/egresos/analytics/${producto.id}`);
              } else {
                toast({
                  title: "📊 Sin datos suficientes",
                  description: `No hay transacciones registradas para "${producto.nombre}" aún.`,
                  variant: "default",
                });
              }
            }}
          >
            <Eye className="h-3 w-3 mr-1" />
            Analíticas
          </Button>

          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditProduct(producto)}>
            <Edit className="h-3 w-3 mr-1" />
            Editar
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={() => deleteProducto.mutate(producto.id)}
          >
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

          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Gasto/Costo</DialogTitle>
              <DialogDescription>Agrega un nuevo item al catálogo de gastos o costos</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={newProduct.nombre}
                    onChange={(e) => setNewProduct({ ...newProduct, nombre: e.target.value })}
                    placeholder="Nombre del producto/servicio"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select
                    value={newProduct.tipo}
                    onValueChange={(value) => {
                      const updatedProduct = { ...newProduct, tipo: value, subcuentaId: "" };
                      if (value === "costo") updatedProduct.cuentaContable = "5001";
                      else updatedProduct.cuentaContable = "";
                      setNewProduct(updatedProduct);
                    }}
                  >
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

              {newProduct.tipo === "gasto" && (
                <div className="space-y-2">
                  <Label htmlFor="cuenta-contable">Cuenta Contable a Afectar *</Label>
                  <Select
                    value={newProduct.cuentaContable}
                    onValueChange={(value) => setNewProduct({ ...newProduct, cuentaContable: value, subcuentaId: "" })}
                  >
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
                </div>
              )}

              {newProduct.tipo === "costo" && (
                <div className="space-y-2">
                  <Label>Cuenta Contable Asignada</Label>
                  <div className="p-3 bg-muted rounded-md border">
                    <p className="text-sm font-medium">5001 - Costo de Ventas</p>
                    <p className="text-xs text-muted-foreground">✓ Cuenta asignada automáticamente para costos</p>
                  </div>
                </div>
              )}

              {newProduct.tipo && (
                <FriendlySubcuentaSelector
                  value={newProduct.subcuentaId}
                  onValueChange={(subcuentaId, cuentaCodigo) =>
                    setNewProduct({ ...newProduct, subcuentaId, cuentaContable: cuentaCodigo })
                  }
                  accountType={newProduct.tipo as "gasto" | "costo"}
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={newProduct.descripcion}
                  onChange={(e) => setNewProduct({ ...newProduct, descripcion: e.target.value })}
                  placeholder="Descripción del producto/servicio"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imagen">Imagen (Opcional)</Label>
                <Input
                  id="imagen"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setNewProduct({ ...newProduct, imagen: file });
                  }}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unidad">Unidad de Medida *</Label>
                <Select value={newProduct.unidad} onValueChange={(value) => setNewProduct({ ...newProduct, unidad: value })}>
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
                <Label htmlFor="proveedor">Proveedor Principal</Label>
                <Input
                  id="proveedor"
                  value={newProduct.proveedorPrincipal}
                  onChange={(e) => setNewProduct({ ...newProduct, proveedorPrincipal: e.target.value })}
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

      {/* Gastos */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Catálogo de Gastos</h2>
          <Badge variant="secondary">{filteredGastos.length}</Badge>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredGastos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGastos.map(renderProductCard)}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <Package2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm
                  ? "No se encontraron gastos que coincidan con la búsqueda"
                  : "Aún no has agregado gastos al catálogo"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Costos */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Catálogo de Costos</h2>
          <Badge variant="secondary">{filteredCostos.length}</Badge>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCostos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCostos.map(renderProductCard)}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <Package2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm
                  ? "No se encontraron costos que coincidan con la búsqueda"
                  : "Aún no has agregado costos al catálogo"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Diálogo de Edición (se queda igual, porque depende del estado local) */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Gasto/Costo</DialogTitle>
            <DialogDescription>Modifica la información del producto o servicio</DialogDescription>
          </DialogHeader>

          {editingProduct && (
            <form onSubmit={handleUpdateProduct} className="space-y-4">
              {/* (tu formulario de edición sigue igual, no tocamos lógica de supabase aquí) */}
              {/* ... */}
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <Edit className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CatalogoProductos;
