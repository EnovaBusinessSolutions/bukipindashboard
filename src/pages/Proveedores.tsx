import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Building2, Plus, Search, Edit, Trash2, Users, TrendingUp, ShoppingCart, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useProveedores } from "@/hooks/useProveedores";
import { useProveedoresAnalytics } from "@/hooks/useProveedoresAnalytics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResumenTransaccionesProveedores from "@/components/Proveedores/ResumenTransaccionesProveedores";
import AnalyticaProveedoresNueva from "@/components/Proveedores/AnalyticaProveedoresNueva";

const Proveedores = () => {
  const { proveedores, loading, createProveedor, updateProveedor, deleteProveedor } = useProveedores();
  const { stats, loading: statsLoading } = useProveedoresAnalytics();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<any>(null);
  
  // Form states
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [rfc, setRfc] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [estado, setEstado] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");

  const resetForm = () => {
    setNombre("");
    setTelefono("");
    setEmail("");
    setRfc("");
    setDireccion("");
    setCiudad("");
    setEstado("");
    setCodigoPostal("");
    setEditingProveedor(null);
  };

  const handleEdit = (proveedor: any) => {
    setEditingProveedor(proveedor);
    setNombre(proveedor.nombre);
    setTelefono(proveedor.telefono || "");
    setEmail(proveedor.email || "");
    setRfc(proveedor.rfc || "");
    setDireccion(proveedor.direccion || "");
    setCiudad(proveedor.ciudad || "");
    setEstado(proveedor.estado || "");
    setCodigoPostal(proveedor.codigo_postal || "");
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      toast({
        title: "⚠️ Campo requerido",
        description: "El nombre del proveedor es obligatorio",
        variant: "destructive"
      });
      return;
    }

    const proveedorData = {
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      rfc: rfc.trim() || null,
      direccion: direccion.trim() || null,
      ciudad: ciudad.trim() || null,
      estado: estado.trim() || null,
      codigo_postal: codigoPostal.trim() || null
    };

    try {
      if (editingProveedor) {
        const { error } = await updateProveedor(editingProveedor.id, proveedorData);
        if (error) {
          toast({
            title: "❌ Error",
            description: error,
            variant: "destructive"
          });
          return;
        }
        toast({
          title: "✅ Proveedor actualizado",
          description: "Los datos del proveedor se han actualizado correctamente"
        });
      } else {
        const { error } = await createProveedor(proveedorData);
        if (error) {
          toast({
            title: "❌ Error",
            description: error,
            variant: "destructive"
          });
          return;
        }
        toast({
          title: "✅ Proveedor registrado",
          description: "El proveedor se ha registrado correctamente"
        });
      }
      
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error al guardar proveedor:", error);
      toast({
        title: "❌ Error",
        description: "Ocurrió un error al guardar el proveedor",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este proveedor?")) {
      return;
    }

    const { error } = await deleteProveedor(id);
    if (error) {
      toast({
        title: "❌ Error",
        description: error,
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "✅ Proveedor eliminado",
      description: "El proveedor se ha eliminado correctamente"
    });
  };

  const filteredProveedores = proveedores.filter((proveedor) =>
    proveedor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (proveedor.rfc && proveedor.rfc.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (proveedor.email && proveedor.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="w-full">
      <div className="p-6 border-b bg-background">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Base de Datos Proveedores</h1>
            <p className="text-muted-foreground mt-2">
              Gestiona la información de tus proveedores
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Proveedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProveedor ? "Editar Proveedor" : "Registrar Nuevo Proveedor"}
                </DialogTitle>
                <DialogDescription>
                  {editingProveedor 
                    ? "Actualiza la información del proveedor" 
                    : "Completa los datos del nuevo proveedor"}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="nombre">Nombre / Razón Social *</Label>
                    <Input
                      id="nombre"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Nombre completo o razón social"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Número de teléfono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="rfc">RFC</Label>
                    <Input
                      id="rfc"
                      value={rfc}
                      onChange={(e) => setRfc(e.target.value.toUpperCase())}
                      placeholder="RFC del proveedor"
                      maxLength={13}
                    />
                  </div>

                  <Separator className="md:col-span-2" />

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="direccion">Dirección</Label>
                    <Input
                      id="direccion"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      placeholder="Calle y número"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <Input
                      id="ciudad"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      placeholder="Ciudad"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Input
                      id="estado"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      placeholder="Estado"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="codigo-postal">Código Postal</Label>
                    <Input
                      id="codigo-postal"
                      value={codigoPostal}
                      onChange={(e) => setCodigoPostal(e.target.value)}
                      placeholder="00000"
                      maxLength={5}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setIsDialogOpen(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingProveedor ? "Actualizar" : "Registrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <Tabs defaultValue="base-datos" className="space-y-6">
          <TabsList>
            <TabsTrigger value="base-datos">Base de Datos</TabsTrigger>
            <TabsTrigger value="transacciones">Transacciones</TabsTrigger>
            <TabsTrigger value="analitica">Analítica</TabsTrigger>
          </TabsList>

          <TabsContent value="base-datos" className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Proveedores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {statsLoading ? "..." : stats.totalProveedores}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.proveedoresActivos} activos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Transacciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {statsLoading ? "..." : stats.totalTransacciones}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total de compras registradas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monto Total Gastado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {statsLoading ? "..." : `$${stats.montoTotalGastado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                En todas las transacciones
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Proveedor Principal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-bold truncate">
                  {statsLoading ? "..." : stats.topProveedores[0]?.proveedor_nombre || "N/A"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.topProveedores[0] ? `$${stats.topProveedores[0].monto_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : "Sin datos"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top 5 Proveedores */}
        {!statsLoading && stats.topProveedores.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top 5 Proveedores por Monto
              </CardTitle>
              <CardDescription>
                Los proveedores con mayor volumen de compras
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topProveedores.map((proveedor, index) => (
                  <div key={proveedor.proveedor_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{proveedor.proveedor_nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {proveedor.total_transacciones} transacciones
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        ${proveedor.monto_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Proveedores Registrados
            </CardTitle>
            <CardDescription>
              Lista completa de proveedores y su información de contacto
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, RFC o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando proveedores...
              </div>
            ) : filteredProveedores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "No se encontraron proveedores" : "No hay proveedores registrados"}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>RFC</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProveedores.map((proveedor) => (
                      <TableRow key={proveedor.id}>
                        <TableCell className="font-medium">{proveedor.nombre}</TableCell>
                        <TableCell>{proveedor.rfc || "-"}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {proveedor.telefono && <div>{proveedor.telefono}</div>}
                            {proveedor.email && (
                              <div className="text-muted-foreground">{proveedor.email}</div>
                            )}
                            {!proveedor.telefono && !proveedor.email && "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {proveedor.ciudad && proveedor.estado
                              ? `${proveedor.ciudad}, ${proveedor.estado}`
                              : proveedor.ciudad || proveedor.estado || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={proveedor.activo ? "default" : "secondary"}>
                            {proveedor.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(proveedor)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(proveedor.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="transacciones">
            <ResumenTransaccionesProveedores />
          </TabsContent>

          <TabsContent value="analitica">
            <AnalyticaProveedoresNueva />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Proveedores;
