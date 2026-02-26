import React from "react";
import { AlertCircle, Package, Plus, RefreshCw, ShoppingCart } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  // data
  subcuentas: any[];
  productosServicios: any[];
  loadingProductosServicios: boolean;

  // actions
  refetchProductosServicios: () => void;
  toast: (args: any) => void;

  // create dialog
  isProductDialogOpen: boolean;
  setIsProductDialogOpen: (v: boolean) => void;

  productName: string;
  setProductName: (v: string) => void;

  productImage: File | null;
  setProductImage: (f: File | null) => void;

  productPrice: string;
  setProductPrice: (v: string) => void;

  productSubcuenta: string;
  setProductSubcuenta: (v: string) => void;

  productDescription: string;
  setProductDescription: (v: string) => void;

  handleSubmitProduct: () => void;
  isSubmittingProduct: boolean;

  // edit dialog
  isEditDialogOpen: boolean;
  setIsEditDialogOpen: (v: boolean) => void;

  editProductName: string;
  setEditProductName: (v: string) => void;

  editProductPrice: string;
  setEditProductPrice: (v: string) => void;

  editProductDescription: string;
  setEditProductDescription: (v: string) => void;

  editProductSubcuenta: string;
  setEditProductSubcuenta: (v: string) => void;

  handleEditImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  editImagePreview: string;

  handleUpdateProduct: () => void;
  handleOpenEditDialog: (producto: any) => void;

  deleteProducto: { mutate: (id: any) => void };
};

export default function TabCatalogoProductos(props: Props) {
  const {
    subcuentas,
    productosServicios,
    loadingProductosServicios,

    refetchProductosServicios,
    toast,

    isProductDialogOpen,
    setIsProductDialogOpen,

    productName,
    setProductName,

    setProductImage,

    productPrice,
    setProductPrice,

    productSubcuenta,
    setProductSubcuenta,

    productDescription,
    setProductDescription,

    handleSubmitProduct,
    isSubmittingProduct,

    isEditDialogOpen,
    setIsEditDialogOpen,

    editProductName,
    setEditProductName,

    editProductPrice,
    setEditProductPrice,

    editProductDescription,
    setEditProductDescription,

    editProductSubcuenta,
    setEditProductSubcuenta,

    handleEditImageChange,
    editImagePreview,

    handleUpdateProduct,
    handleOpenEditDialog,

    deleteProducto,
  } = props;

  // ✅ robusto id/_id para no romper si backend manda _id
  const subId = (s: any) => String(s?.id ?? s?._id ?? "").trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Catálogo de Productos
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchProductosServicios();
                toast({
                  title: "Actualizado",
                  description: "La lista de productos se ha actualizado correctamente",
                });
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>

            {/* Nuevo producto */}
            <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Producto
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Agregar Nuevo Producto</DialogTitle>
                  <DialogDescription>
                    Completa la información del producto para agregarlo al catálogo.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="product-name" className="text-right">
                      Nombre
                    </Label>
                    <Input
                      id="product-name"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="col-span-3"
                      placeholder="Nombre del producto"
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="product-image" className="text-right">
                      Imagen
                    </Label>
                    <Input
                      id="product-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProductImage(e.target.files?.[0] || null)}
                      className="col-span-3"
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="product-price" className="text-right">
                      Precio
                    </Label>
                    <Input
                      id="product-price"
                      type="number"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      className="col-span-3"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="product-account" className="text-right">
                      Cuenta
                    </Label>
                    <div className="col-span-3 flex items-center p-2 border rounded-md bg-muted/50">
                      <span className="text-sm font-medium">4001 - Ventas</span>
                      <span className="text-xs text-muted-foreground ml-2">(cuenta fija)</span>
                    </div>
                  </div>

                  {/* Subcuenta */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="product-subcuenta" className="text-right">
                      Subcuenta
                    </Label>
                    <Select
                      value={productSubcuenta}
                      onValueChange={(v) => setProductSubcuenta(v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Sin subcuenta (usar cuenta principal)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin subcuenta (usar cuenta principal)</SelectItem>
                        {subcuentas
                          .filter((s) => String(s?.cuenta_madre_codigo ?? "") === "4001")
                          .map((s) => (
                            <SelectItem key={subId(s)} value={subId(s)}>
                              {s?.nombre}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="product-description" className="text-right">
                      Descripción
                    </Label>
                    <Textarea
                      id="product-description"
                      value={productDescription}
                      onChange={(e) => setProductDescription(e.target.value)}
                      className="col-span-3"
                      placeholder="Descripción opcional del producto"
                      rows={3}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsProductDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmitProduct} disabled={isSubmittingProduct}>
                    {isSubmittingProduct ? "Guardando..." : "Guardar Producto"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Editar producto */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Editar Producto</DialogTitle>
                  <DialogDescription>Modifica la información del producto.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-product-name" className="text-right">
                      Nombre *
                    </Label>
                    <Input
                      id="edit-product-name"
                      value={editProductName}
                      onChange={(e) => setEditProductName(e.target.value)}
                      className="col-span-3"
                      placeholder="Ej: Consultoría, Producto X"
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-product-price" className="text-right">
                      Precio *
                    </Label>
                    <Input
                      id="edit-product-price"
                      type="number"
                      value={editProductPrice}
                      onChange={(e) => setEditProductPrice(e.target.value)}
                      className="col-span-3"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-product-image" className="text-right">
                      Imagen
                    </Label>
                    <div className="col-span-3 space-y-2">
                      <Input
                        id="edit-product-image"
                        type="file"
                        accept="image/*"
                        onChange={handleEditImageChange}
                      />
                      {editImagePreview && (
                        <div className="aspect-square w-24 mx-auto">
                          <img
                            src={editImagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover rounded-md"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-product-description" className="text-right">
                      Descripción
                    </Label>
                    <Textarea
                      id="edit-product-description"
                      value={editProductDescription}
                      onChange={(e) => setEditProductDescription(e.target.value)}
                      className="col-span-3"
                      placeholder="Descripción opcional del producto"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-product-subcuenta" className="text-right">
                      Subcuenta
                    </Label>
                    <Select
                      value={editProductSubcuenta || "none"}
                      onValueChange={(v) => setEditProductSubcuenta(v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Sin subcuenta (usar cuenta principal)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin subcuenta (usar cuenta principal)</SelectItem>
                        {subcuentas
                          .filter((s) => String(s?.cuenta_madre_codigo ?? "") === "4001")
                          .map((s) => (
                            <SelectItem key={subId(s)} value={subId(s)}>
                              {s?.nombre}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateProduct} disabled={isSubmittingProduct}>
                    {isSubmittingProduct ? "Actualizando..." : "Actualizar Producto"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardTitle>

        <CardDescription>
          Gestiona el catálogo de productos y servicios con cuentas contables asignadas
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Recomendación:</strong> Asignar subcuentas a cada producto ayuda a llevar un mejor control contable.
            La cuenta predeterminada es "4001 - Ventas".
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {loadingProductosServicios ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : productosServicios.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay productos de servicios registrados aún
            </div>
          ) : (
            <div className="space-y-6">
              {/* Productos con subcuentas */}
              {subcuentas
                .filter((s) => String(s?.cuenta_madre_codigo ?? "") === "4001")
                .map((subcuenta) => {
                  const sid = subId(subcuenta);
                  const productosSubcuenta = productosServicios.filter(
                    (p: any) => String(p?.subcuenta_id ?? p?.subcuentaId ?? "") === sid
                  );
                  if (productosSubcuenta.length === 0) return null;

                  return (
                    <Card key={sid}>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <Package className="mr-2 h-5 w-5" />
                          Subcuenta: {subcuenta.nombre}
                        </CardTitle>
                        <CardDescription>
                          {productosSubcuenta.length} producto{productosSubcuenta.length !== 1 ? "s" : ""}
                        </CardDescription>
                      </CardHeader>

                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {productosSubcuenta.map((producto: any) => (
                            <div key={producto.id ?? producto._id} className="border rounded-lg p-4 space-y-3">
                              {producto.imagen_url && (
                                <div className="aspect-square w-full max-w-24 mx-auto">
                                  <img
                                    src={producto.imagen_url}
                                    alt={producto.nombre}
                                    className="w-full h-full object-cover rounded-md"
                                  />
                                </div>
                              )}

                              <div>
                                <h4 className="font-semibold">{producto.nombre}</h4>
                                {producto.descripcion && (
                                  <p className="text-sm text-muted-foreground">{producto.descripcion}</p>
                                )}
                                <p className="text-lg font-bold text-primary">
                                  ${Number(producto.precio || 0).toFixed(2)}
                                </p>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenEditDialog(producto)}
                                  className="flex-1"
                                >
                                  Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteProducto.mutate(producto.id ?? producto._id)}
                                  className="flex-1 text-destructive hover:text-destructive"
                                >
                                  Eliminar
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

              {/* Productos sin subcuenta */}
              {(() => {
                const productosSinSubcuenta = productosServicios.filter(
                  (p: any) => !String(p?.subcuenta_id ?? p?.subcuentaId ?? "").trim()
                );
                if (productosSinSubcuenta.length === 0) return null;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        Cuenta General: 4001 - Ventas
                      </CardTitle>
                      <CardDescription>
                        {productosSinSubcuenta.length} producto{productosSinSubcuenta.length !== 1 ? "s" : ""} sin
                        subcuenta específica
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {productosSinSubcuenta.map((producto: any) => (
                          <div key={producto.id ?? producto._id} className="border rounded-lg p-4 space-y-3">
                            {producto.imagen_url && (
                              <div className="aspect-square w-full max-w-24 mx-auto">
                                <img
                                  src={producto.imagen_url}
                                  alt={producto.nombre}
                                  className="w-full h-full object-cover rounded-md"
                                />
                              </div>
                            )}

                            <div>
                              <h4 className="font-semibold">{producto.nombre}</h4>
                              {producto.descripcion && (
                                <p className="text-sm text-muted-foreground">{producto.descripcion}</p>
                              )}
                              <p className="text-lg font-bold text-primary">
                                ${Number(producto.precio || 0).toFixed(2)}
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditDialog(producto)}
                                className="flex-1"
                              >
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteProducto.mutate(producto.id ?? producto._id)}
                                className="flex-1 text-destructive hover:text-destructive"
                              >
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}