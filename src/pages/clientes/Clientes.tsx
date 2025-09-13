import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, User, Mail, Phone, FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Cliente {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  rfc?: string;
  direccion?: string;
  ciudad?: string;
  estado?: string;
  codigo_postal?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

const Clientes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    rfc: "",
    direccion: "",
    ciudad: "",
    estado: "",
    codigo_postal: "",
    activo: true,
  });

  const queryClient = useQueryClient();

  // Fetch clientes
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nombre");
      
      if (error) throw error;
      return data as Cliente[];
    },
  });

  // Create/Update cliente mutation
  const saveClienteMutation = useMutation({
    mutationFn: async (clienteData: typeof formData & { id?: string }) => {
      const { id, ...data } = clienteData;
      
      if (id) {
        const { data: result, error } = await supabase
          .from("clientes")
          .update(data)
          .eq("id", id)
          .select()
          .single();
        
        if (error) throw error;
        return result;
      } else {
        const { data: result, error } = await supabase
          .from("clientes")
          .insert([{ ...data, user_id: "00000000-0000-0000-0000-000000000000" }])
          .select()
          .single();
        
        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setIsDialogOpen(false);
      setEditingClient(null);
      resetForm();
      toast.success(editingClient ? "Cliente actualizado" : "Cliente creado exitosamente");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        if (error.message.includes("email")) {
          toast.error("Este email ya está registrado para otro cliente");
        } else if (error.message.includes("telefono")) {
          toast.error("Este teléfono ya está registrado para otro cliente");
        } else if (error.message.includes("rfc")) {
          toast.error("Este RFC ya está registrado para otro cliente");
        } else {
          toast.error("Ya existe un cliente con estos datos");
        }
      } else {
        toast.error("Error al guardar cliente: " + error.message);
      }
    },
  });

  // Delete cliente mutation
  const deleteClienteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente eliminado exitosamente");
    },
    onError: (error: any) => {
      toast.error("Error al eliminar cliente: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      nombre: "",
      email: "",
      telefono: "",
      rfc: "",
      direccion: "",
      ciudad: "",
      estado: "",
      codigo_postal: "",
      activo: true,
    });
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingClient(cliente);
    setFormData({
      nombre: cliente.nombre,
      email: cliente.email || "",
      telefono: cliente.telefono || "",
      rfc: cliente.rfc || "",
      direccion: cliente.direccion || "",
      ciudad: cliente.ciudad || "",
      estado: cliente.estado || "",
      codigo_postal: cliente.codigo_postal || "",
      activo: cliente.activo,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    const dataToSave = {
      ...formData,
      email: formData.email.trim() || null,
      telefono: formData.telefono.trim() || null,
      rfc: formData.rfc.trim() || null,
      direccion: formData.direccion.trim() || null,
      ciudad: formData.ciudad.trim() || null,
      estado: formData.estado.trim() || null,
      codigo_postal: formData.codigo_postal.trim() || null,
    };

    if (editingClient) {
      saveClienteMutation.mutate({ ...dataToSave, id: editingClient.id });
    } else {
      saveClienteMutation.mutate(dataToSave);
    }
  };

  const filteredClientes = clientes.filter(cliente =>
    cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.telefono?.includes(searchTerm) ||
    cliente.rfc?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const clientesActivos = clientes.filter(c => c.activo).length;
  const totalClientes = clientes.length;

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Base de Datos de Clientes</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona todos los clientes de la empresa
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClientes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{clientesActivos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Inactivos</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{totalClientes - clientesActivos}</div>
            </CardContent>
          </Card>
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingClient(null);
                resetForm();
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? "Editar Cliente" : "Nuevo Cliente"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rfc">RFC</Label>
                  <Input
                    id="rfc"
                    value={formData.rfc}
                    onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Textarea
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <Input
                      id="ciudad"
                      value={formData.ciudad}
                      onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Input
                      id="estado"
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="codigo_postal">Código Postal</Label>
                  <Input
                    id="codigo_postal"
                    value={formData.codigo_postal}
                    onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="activo"
                    checked={formData.activo}
                    onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
                  />
                  <Label htmlFor="activo">Cliente activo</Label>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingClient(null);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saveClienteMutation.isPending}>
                    {saveClienteMutation.isPending ? "Guardando..." : editingClient ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabla de clientes */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
            <CardDescription>
              {filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''} encontrado{filteredClientes.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando clientes...
              </div>
            ) : filteredClientes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "No se encontraron clientes con ese criterio" : "No hay clientes registrados"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>RFC</TableHead>
                      <TableHead>Ciudad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{cliente.nombre}</span>
                            {!cliente.activo && (
                              <Badge variant="secondary" className="text-xs">
                                Inactivo
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {cliente.email && <Mail className="h-3 w-3 text-muted-foreground" />}
                            <span className="text-sm">{cliente.email || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {cliente.telefono && <Phone className="h-3 w-3 text-muted-foreground" />}
                            <span className="text-sm">{cliente.telefono || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {cliente.rfc && <FileText className="h-3 w-3 text-muted-foreground" />}
                            <span className="text-sm font-mono">{cliente.rfc || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{cliente.ciudad || "-"}</TableCell>
                        <TableCell>
                          {cliente.activo ? (
                            <Badge variant="default" className="bg-primary/10 text-primary">
                              Activo
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              Inactivo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(cliente)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm("¿Está seguro de eliminar este cliente?")) {
                                  deleteClienteMutation.mutate(cliente.id);
                                }
                              }}
                              disabled={deleteClienteMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
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
      </div>
    </div>
  );
};

export default Clientes;