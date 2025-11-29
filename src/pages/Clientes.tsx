import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertCircle, Edit, Plus, Search, Trash2, Users, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import ResumenTransaccionesClientes from "@/components/Clientes/ResumenTransaccionesClientes";
import AnalyticaClientesNueva from "@/components/Clientes/AnalyticaClientesNueva";

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
  source?: 'dedicated' | 'transaction';
}

const Clientes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    rfc: "",
    direccion: "",
    ciudad: "",
    estado: "",
    codigo_postal: "",
    activo: true
  });

  const queryClient = useQueryClient();

  // Fetch clients from transactions and dedicated clients table
  const { data: clientes = [], isLoading, error } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      // Get clients from dedicated table
      const { data: dedicatedClients, error: dedicatedError } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

      if (dedicatedError) throw dedicatedError;

      // Get clients from transactions
      const { data: transactionClients, error: transactionError } = await supabase
        .from('transacciones_ingresos')
        .select(`
          cliente_nombre,
          cliente_email,
          cliente_telefono,
          cliente_rfc,
          created_at
        `)
        .not('cliente_nombre', 'is', null)
        .order('created_at', { ascending: false });

      if (transactionError) throw transactionError;

      // Convert transaction clients to client format and deduplicate
      const transactionClientMap = new Map();
      
      transactionClients?.forEach((tc) => {
        const key = `${tc.cliente_nombre}_${tc.cliente_email}_${tc.cliente_telefono}`.toLowerCase();
        if (!transactionClientMap.has(key)) {
          transactionClientMap.set(key, {
            id: `tx-${Math.random().toString(36).substr(2, 9)}`, // temporary ID
            nombre: tc.cliente_nombre || '',
            email: tc.cliente_email || '',
            telefono: tc.cliente_telefono || '',
            rfc: tc.cliente_rfc || '',
            direccion: '',
            ciudad: '',
            estado: '',
            codigo_postal: '',
            activo: true,
            created_at: tc.created_at,
            updated_at: tc.created_at,
            source: 'transaction'
          });
        }
      });

      const transactionClientsFormatted = Array.from(transactionClientMap.values());
      
      // Combine both sources, filtering out transaction clients that match dedicated clients
      const dedicatedClientsWithSource = (dedicatedClients || []).map(c => ({ ...c, source: 'dedicated' as const }));
      
      // Create a set of keys from dedicated clients for deduplication
      const dedicatedKeys = new Set(
        dedicatedClientsWithSource.map(c => 
          `${c.nombre}_${c.email}_${c.telefono}`.toLowerCase()
        )
      );
      
      // Filter out transaction clients that already exist as dedicated clients
      const uniqueTransactionClients = transactionClientsFormatted.filter(tc => {
        const key = `${tc.nombre}_${tc.email}_${tc.telefono}`.toLowerCase();
        return !dedicatedKeys.has(key);
      });
      
      // Combine both sources
      const allClients = [
        ...dedicatedClientsWithSource,
        ...uniqueTransactionClients
      ];

      return allClients.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: typeof formData) => {
      const { data, error } = await supabase
        .from('clientes')
        .insert([{
          ...clientData,
          user_id: '00000000-0000-0000-0000-000000000000' // Temporal user ID
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast.success("Cliente creado exitosamente");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        if (error.message.includes('email')) {
          toast.error("Ya existe un cliente con ese email");
        } else if (error.message.includes('telefono')) {
          toast.error("Ya existe un cliente con ese teléfono");
        } else if (error.message.includes('rfc')) {
          toast.error("Ya existe un cliente con ese RFC");
        } else {
          toast.error("Ya existe un cliente con esos datos");
        }
      } else {
        toast.error("Error al crear cliente: " + error.message);
      }
    }
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { data: updatedData, error } = await supabase
        .from('clientes')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return updatedData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast.success("Cliente actualizado exitosamente");
      resetForm();
      setIsDialogOpen(false);
      setEditingClient(null);
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        if (error.message.includes('email')) {
          toast.error("Ya existe un cliente con ese email");
        } else if (error.message.includes('telefono')) {
          toast.error("Ya existe un cliente con ese teléfono");
        } else if (error.message.includes('rfc')) {
          toast.error("Ya existe un cliente con ese RFC");
        } else {
          toast.error("Ya existe un cliente con esos datos");
        }
      } else {
        toast.error("Error al actualizar cliente: " + error.message);
      }
    }
  });

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast.success("Cliente eliminado exitosamente");
    },
    onError: (error: any) => {
      toast.error("Error al eliminar cliente: " + error.message);
    }
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
      activo: true
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingClient(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (client: Cliente) => {
    setFormData({
      nombre: client.nombre,
      email: client.email || "",
      telefono: client.telefono || "",
      rfc: client.rfc || "",
      direccion: client.direccion || "",
      ciudad: client.ciudad || "",
      estado: client.estado || "",
      codigo_postal: client.codigo_postal || "",
      activo: client.activo
    });
    setEditingClient(client);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    if (editingClient) {
      updateClientMutation.mutate({ id: editingClient.id, data: formData });
    } else {
      createClientMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string, nombre: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar el cliente "${nombre}"?`)) {
      deleteClientMutation.mutate(id);
    }
  };

  const filteredClients = clientes.filter(client =>
    client.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (client.telefono && client.telefono.includes(searchTerm)) ||
    (client.rfc && client.rfc.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) return <div className="p-6">Cargando clientes...</div>;
  if (error) return <div className="p-6 text-destructive">Error al cargar clientes</div>;

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b bg-background">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-8 w-8" />
              Base de Datos de Clientes
            </h1>
            <p className="text-muted-foreground mt-2">
              Gestiona la información de todos tus clientes
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? "Editar Cliente" : "Nuevo Cliente"}
                </DialogTitle>
                <DialogDescription>
                  {editingClient ? "Modifica los datos del cliente" : "Registra un nuevo cliente en el sistema"}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                      placeholder="Nombre completo del cliente"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                      placeholder="555-123-4567"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="rfc">RFC</Label>
                    <Input
                      id="rfc"
                      value={formData.rfc}
                      onChange={(e) => setFormData(prev => ({ ...prev, rfc: e.target.value.toUpperCase() }))}
                      placeholder="XAXX010101000"
                      maxLength={13}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Textarea
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                    placeholder="Calle, número, colonia..."
                    rows={2}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <Input
                      id="ciudad"
                      value={formData.ciudad}
                      onChange={(e) => setFormData(prev => ({ ...prev, ciudad: e.target.value }))}
                      placeholder="Ciudad"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Input
                      id="estado"
                      value={formData.estado}
                      onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                      placeholder="Estado"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="codigo_postal">Código Postal</Label>
                    <Input
                      id="codigo_postal"
                      value={formData.codigo_postal}
                      onChange={(e) => setFormData(prev => ({ ...prev, codigo_postal: e.target.value }))}
                      placeholder="12345"
                      maxLength={5}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="activo"
                    checked={formData.activo}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, activo: checked }))}
                  />
                  <Label htmlFor="activo">Cliente activo</Label>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={createClientMutation.isPending || updateClientMutation.isPending}>
                    {editingClient ? "Actualizar" : "Crear"} Cliente
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="base-datos" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="base-datos">Base de Datos</TabsTrigger>
            <TabsTrigger value="transacciones">Transacciones</TabsTrigger>
            <TabsTrigger value="analitica">Analítica</TabsTrigger>
          </TabsList>

          <TabsContent value="base-datos">
            <div className="space-y-6">
              {/* Search and Stats */}
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar por nombre, email, teléfono o RFC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="flex gap-4">
                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{clientes.length}</div>
                      <div className="text-xs text-muted-foreground">Total Clientes</div>
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {clientes.filter(c => c.source === 'dedicated').length}
                      </div>
                      <div className="text-xs text-muted-foreground">En Base de Datos</div>
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {clientes.filter(c => c.source === 'transaction').length}
                      </div>
                      <div className="text-xs text-muted-foreground">De Ventas</div>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Clients Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Lista de Clientes</CardTitle>
                  <CardDescription>
                    Administra todos los clientes registrados. Los clientes de "Ventas" provienen de transacciones registradas y pueden ser convertidos a registros permanentes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredClients.length === 0 ? (
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
                            <TableHead>Origen</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredClients.map((client) => (
                            <TableRow key={client.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{client.nombre}</span>
                                  {!client.activo && (
                                    <Badge variant="secondary">Inactivo</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{client.email || "-"}</TableCell>
                              <TableCell>{client.telefono || "-"}</TableCell>
                              <TableCell>{client.rfc || "-"}</TableCell>
                              <TableCell>
                                <Badge variant={client.source === 'dedicated' ? "default" : "outline"}>
                                  {client.source === 'dedicated' ? "Base de Datos" : "Ventas"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={client.activo ? "default" : "secondary"}>
                                  {client.activo ? "Activo" : "Inactivo"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  {client.source === 'dedicated' ? (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEditDialog(client)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDelete(client.id, client.nombre)}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setFormData({
                                          nombre: client.nombre,
                                          email: client.email || "",
                                          telefono: client.telefono || "",
                                          rfc: client.rfc || "",
                                          direccion: "",
                                          ciudad: "",
                                          estado: "",
                                          codigo_postal: "",
                                          activo: true
                                        });
                                        setEditingClient(null);
                                        setIsDialogOpen(true);
                                      }}
                                      className="text-green-600 hover:text-green-700"
                                    >
                                      <Edit className="h-4 w-4 mr-1" />
                                      Editar
                                    </Button>
                                  )}
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
          </TabsContent>

          <TabsContent value="transacciones">
            <ResumenTransaccionesClientes />
          </TabsContent>

          <TabsContent value="analitica">
            <AnalyticaClientesNueva />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Clientes;