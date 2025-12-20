import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
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

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string; error?: any } | T;
const unwrap = <T,>(json: ApiEnvelope<T>): T => (json as any)?.data ?? (json as T);

const normalizeCliente = (c: any): Cliente => ({
  id: c?.id ?? c?._id,
  nombre: c?.nombre ?? "",
  email: c?.email ?? undefined,
  telefono: c?.telefono ?? undefined,
  rfc: c?.rfc ?? undefined,
  direccion: c?.direccion ?? undefined,
  ciudad: c?.ciudad ?? undefined,
  estado: c?.estado ?? undefined,
  codigo_postal: c?.codigo_postal ?? c?.codigoPostal ?? undefined,
  activo: typeof c?.activo === "boolean" ? c.activo : true,
  created_at: c?.created_at ?? c?.createdAt ?? new Date().toISOString(),
  updated_at: c?.updated_at ?? c?.updatedAt ?? new Date().toISOString(),
});

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

  // Fetch clientes (backend)
  const {
    data: clientes = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const json = await apiFetch("/api/clientes", { method: "GET" });
      const list = unwrap<any[]>(json) || [];
      return list.map(normalizeCliente).sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
  });

  // Create/Update cliente mutation (backend)
  const saveClienteMutation = useMutation({
    mutationFn: async (clienteData: typeof formData & { id?: string }) => {
      const { id, ...payload } = clienteData;

      // Normalizar strings vacíos a null (igual que antes)
      const body = {
        ...payload,
        email: payload.email.trim() || null,
        telefono: payload.telefono.trim() || null,
        rfc: payload.rfc.trim() || null,
        direccion: payload.direccion.trim() || null,
        ciudad: payload.ciudad.trim() || null,
        estado: payload.estado.trim() || null,
        codigo_postal: payload.codigo_postal.trim() || null,
      };

      if (id) {
        const json = await apiFetch(`/api/clientes/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        return normalizeCliente(unwrap<any>(json));
      }

      const json = await apiFetch("/api/clientes", {
        method: "POST",
        body: JSON.stringify(body),
      });

      return normalizeCliente(unwrap<any>(json));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setIsDialogOpen(false);
      setEditingClient(null);
      resetForm();
      toast.success(editingClient ? "Cliente actualizado" : "Cliente creado exitosamente");
    },
    onError: (err: any) => {
      const msg = String(err?.message || err || "");

      // Detección “best-effort” de duplicados
      if (msg.toLowerCase().includes("duplicate") || msg.includes("E11000") || msg.includes("23505")) {
        if (msg.toLowerCase().includes("email")) {
          toast.error("Este email ya está registrado para otro cliente");
          return;
        }
        if (msg.toLowerCase().includes("telefono") || msg.toLowerCase().includes("phone")) {
          toast.error("Este teléfono ya está registrado para otro cliente");
          return;
        }
        if (msg.toLowerCase().includes("rfc")) {
          toast.error("Este RFC ya está registrado para otro cliente");
          return;
        }
        toast.error("Ya existe un cliente con estos datos");
        return;
      }

      toast.error("Error al guardar cliente: " + msg);
    },
  });

  // Delete cliente mutation (backend)
  const deleteClienteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/clientes/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente eliminado exitosamente");
    },
    onError: (err: any) => {
      toast.error("Error al eliminar cliente: " + (err?.message || "Error desconocido"));
    },
  });

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

    if (editingClient) {
      saveClienteMutation.mutate({ ...formData, id: editingClient.id });
    } else {
      saveClienteMutation.mutate(formData);
    }
  };

  const filteredClientes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return clientes;

    return clientes.filter((cliente) => {
      return (
        cliente.nombre.toLowerCase().includes(q) ||
        cliente.email?.toLowerCase().includes(q) ||
        cliente.telefono?.includes(searchTerm) ||
        cliente.rfc?.toLowerCase().includes(q)
      );
    });
  }, [clientes, searchTerm]);

  const clientesActivos = clientes.filter((c) => c.activo).length;
  const totalClientes = clientes.length;

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Base de Datos de Clientes</h1>
        <p className="text-muted-foreground mt-2">Gestiona todos los clientes de la empresa</p>
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

          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingClient(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingClient(null);
                  resetForm();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingClient ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
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
                    {saveClienteMutation.isPending
                      ? "Guardando..."
                      : editingClient
                        ? "Actualizar"
                        : "Crear"}
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
              {filteredClientes.length} cliente{filteredClientes.length !== 1 ? "s" : ""} encontrado
              {filteredClientes.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando clientes...</div>
            ) : isError ? (
              <div className="text-center py-8 text-destructive">
                Error al cargar clientes: {(error as any)?.message || "Error desconocido"}
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
                            <Badge variant="secondary">Inactivo</Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(cliente)}>
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
