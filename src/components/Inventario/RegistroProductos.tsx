import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Image, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useProductos, useCreateProducto } from "@/hooks/useProductos";
import { useSubcuentas } from "@/hooks/useSubcuentas";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type ProductoForm = {
  nombre: string;
  descripcion: string;
  precio: number;
  subcuentaId?: string;
};

const RegistroProductos = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const { data: productos, isLoading: loadingProductos } = useProductos();
  const { data: subcuentas } = useSubcuentas();
  const createProducto = useCreateProducto();

  const { register, handleSubmit, reset, setValue, watch } = useForm<ProductoForm>();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const onSubmit = async (data: ProductoForm) => {
    await createProducto.mutateAsync({
      nombre: data.nombre,
      precio: data.precio,
      descripcion: data.descripcion,
      subcuentaId: data.subcuentaId,
      imagen: selectedImage || undefined,
    });
    reset();
    clearImage();
  };

  const formatPrice = (precio: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(precio);
  };

  return (
    <div className="space-y-6">
      {/* Formulario de registro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-600" />
            Registrar Nuevo Producto
          </CardTitle>
          <CardDescription>
            Agrega productos para la venta con toda su información
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Información básica */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="nombre">Nombre del Producto *</Label>
                  <Input
                    id="nombre"
                    {...register("nombre", { required: true })}
                    placeholder="Ej: Camiseta básica"
                  />
                </div>

                <div>
                  <Label htmlFor="precio">Precio de Venta *</Label>
                  <Input
                    id="precio"
                    type="number"
                    step="0.01"
                    {...register("precio", { required: true, valueAsNumber: true })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="subcuenta">Subcuenta (Opcional)</Label>
                  <Select onValueChange={(value) => setValue("subcuentaId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar subcuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcuentas?.map((subcuenta) => (
                        <SelectItem key={subcuenta.id} value={subcuenta.id}>
                          {subcuenta.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Imagen y descripción */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="imagen">Imagen del Producto</Label>
                  <div className="mt-2">
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-40 object-cover rounded-md border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={clearImage}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-muted-foreground/50">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Image className="h-8 w-8 mb-4 text-muted-foreground" />
                          <p className="mb-2 text-sm text-muted-foreground">
                            <span className="font-semibold">Click para subir</span>
                          </p>
                          <p className="text-xs text-muted-foreground">PNG, JPG (MAX. 800x400px)</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleImageUpload}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    {...register("descripcion")}
                    placeholder="Descripción detallada del producto..."
                    className="min-h-20"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={createProducto.isPending}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {createProducto.isPending ? "Registrando..." : "Registrar Producto"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista de productos registrados */}
      <Card>
        <CardHeader>
          <CardTitle>Productos Registrados</CardTitle>
          <CardDescription>
            Lista de todos los productos disponibles para la venta
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingProductos ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando productos...
            </div>
          ) : productos && productos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imagen</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Subcuenta</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map((producto) => (
                  <TableRow key={producto.id}>
                    <TableCell>
                      {producto.imagen_url ? (
                        <img
                          src={producto.imagen_url}
                          alt={producto.nombre}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <Image className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{producto.nombre}</p>
                        {producto.descripcion && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {producto.descripcion}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatPrice(producto.precio)}
                    </TableCell>
                    <TableCell>
                      {producto.subcuenta_nombre ? (
                        <Badge variant="outline">{producto.subcuenta_nombre}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={producto.activo ? "default" : "secondary"}>
                        {producto.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay productos registrados aún
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RegistroProductos;