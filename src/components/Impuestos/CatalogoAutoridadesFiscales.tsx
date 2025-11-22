import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Building2, Edit, Trash2, Plus, Search, Phone, Mail, Upload, Globe } from "lucide-react";
import { useAutoridadesFiscales, AutoridadFiscal } from "@/hooks/useAutoridadesFiscales";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function CatalogoAutoridadesFiscales() {
  const { autoridades, crearAutoridad, actualizarAutoridad, eliminarAutoridad } = useAutoridadesFiscales();
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingAutoridad, setEditingAutoridad] = useState<AutoridadFiscal | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nombre: "",
    rfc: "",
    logo_url: "",
    pais: "México",
    telefono: "",
    email: "",
    sitio_web: "",
    direccion: "",
    notas: "",
  });

  const autoridadesFiltradas = autoridades.filter((aut) =>
    aut.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    aut.pais.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (autoridad?: AutoridadFiscal) => {
    if (autoridad) {
      setEditingAutoridad(autoridad);
      setFormData({
        nombre: autoridad.nombre,
        rfc: autoridad.rfc || "",
        logo_url: autoridad.logo_url || "",
        pais: autoridad.pais,
        telefono: autoridad.telefono || "",
        email: autoridad.email || "",
        sitio_web: autoridad.sitio_web || "",
        direccion: autoridad.direccion || "",
        notas: autoridad.notas || "",
      });
      if (autoridad.logo_url) {
        setLogoPreview(autoridad.logo_url);
      }
    } else {
      setEditingAutoridad(null);
      setFormData({
        nombre: "",
        rfc: "",
        logo_url: "",
        pais: "México",
        telefono: "",
        email: "",
        sitio_web: "",
        direccion: "",
        notas: "",
      });
      setLogoFile(null);
      setLogoPreview(null);
    }
    setShowDialog(true);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "❌ Archivo muy grande",
          description: "El logo debe pesar menos de 2MB",
          variant: "destructive"
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "❌ Tipo de archivo inválido",
          description: "Solo se permiten imágenes",
          variant: "destructive"
        });
        return;
      }

      setLogoFile(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return formData.logo_url;

    try {
      setUploading(true);
      
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `autoridades-fiscales/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, logoFile);

      if (uploadError) {
        toast({
          title: "❌ Error al subir logo",
          description: uploadError.message,
          variant: "destructive"
        });
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      toast({
        title: "✅ Logo subido",
        description: "El logo se ha guardado correctamente"
      });

      return publicUrl;
    } catch (error: any) {
      toast({
        title: "❌ Error inesperado",
        description: error.message,
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre) {
      toast({
        title: "❌ Campo requerido",
        description: "El nombre de la autoridad fiscal es obligatorio",
        variant: "destructive"
      });
      return;
    }

    try {
      let logoUrl = formData.logo_url;
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
      }

      if (editingAutoridad) {
        await actualizarAutoridad.mutateAsync({
          id: editingAutoridad.id,
          ...formData,
          logo_url: logoUrl,
        });
      } else {
        await crearAutoridad.mutateAsync({ ...formData, logo_url: logoUrl });
      }
      setShowDialog(false);
      setLogoFile(null);
      setLogoPreview(null);
    } catch (error: any) {
      toast({
        title: "❌ Error al guardar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const paisesComunes = ["México", "Estados Unidos", "España", "Reino Unido", "Canadá", "Otro"];

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Autoridades Registradas</CardDescription>
            <CardTitle className="text-3xl">{autoridades.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>País Principal</CardDescription>
            <CardTitle className="text-2xl">
              {autoridades.length > 0 
                ? autoridades.reduce((acc, aut) => {
                    acc[aut.pais] = (acc[aut.pais] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>).constructor === Object
                  ? Object.entries(autoridades.reduce((acc, aut) => {
                      acc[aut.pais] = (acc[aut.pais] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>))
                    .sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A"
                  : "N/A"
                : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Con Logo</CardDescription>
            <CardTitle className="text-3xl">
              {autoridades.filter(a => a.logo_url).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Barra de búsqueda y acciones */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar autoridad fiscal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Autoridad
        </Button>
      </div>

      {/* Tabla de autoridades */}
      <Card>
        <CardHeader>
          <CardTitle>Catálogo de Autoridades Fiscales</CardTitle>
          <CardDescription>
            Gestiona las autoridades fiscales de diferentes países
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Autoridad</TableHead>
                <TableHead>RFC/Identificador</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {autoridadesFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No hay autoridades fiscales registradas. Haz clic en "Nueva Autoridad" para agregar una.
                  </TableCell>
                </TableRow>
              ) : (
                autoridadesFiltradas.map((autoridad) => (
                  <TableRow key={autoridad.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={autoridad.logo_url || undefined} />
                          <AvatarFallback>
                            <Building2 className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{autoridad.nombre}</p>
                          {autoridad.sitio_web && (
                            <a
                              href={autoridad.sitio_web}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Globe className="h-3 w-3" />
                              Sitio web
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {autoridad.rfc ? (
                        <span className="font-mono text-sm">{autoridad.rfc}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin RFC</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{autoridad.pais}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {autoridad.telefono && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{autoridad.telefono}</span>
                          </div>
                        )}
                        {autoridad.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{autoridad.email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDialog(autoridad);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            eliminarAutoridad.mutate(autoridad.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog para crear/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAutoridad ? "Editar Autoridad Fiscal" : "Nueva Autoridad Fiscal"}
            </DialogTitle>
            <DialogDescription>
              {editingAutoridad
                ? "Modifica los datos de la autoridad fiscal"
                : "Registra una nueva autoridad fiscal"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de la Autoridad *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: SAT - Servicio de Administración Tributaria"
              />
            </div>

            <div className="space-y-2">
              <Label>Logo de la Autoridad</Label>
              
              {logoPreview && (
                <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                  <img 
                    src={logoPreview} 
                    alt="Preview" 
                    className="w-full h-full object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => {
                      setLogoFile(null);
                      setLogoPreview(null);
                      setFormData({ ...formData, logo_url: "" });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {!logoPreview && (
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <label className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-1">
                      Haz clic para subir una imagen
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG hasta 2MB
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoSelect}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rfc">RFC / Identificador Fiscal</Label>
                <Input
                  id="rfc"
                  value={formData.rfc}
                  onChange={(e) => setFormData({ ...formData, rfc: e.target.value })}
                  placeholder="Ej: SAT970701NN3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pais">País</Label>
                <select
                  id="pais"
                  value={formData.pais}
                  onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                  className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background"
                >
                  {paisesComunes.map(pais => (
                    <option key={pais} value={pais}>{pais}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="Ej: 55 5555 5555"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Ej: contacto@sat.gob.mx"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sitio_web">Sitio Web</Label>
              <Input
                id="sitio_web"
                value={formData.sitio_web}
                onChange={(e) => setFormData({ ...formData, sitio_web: e.target.value })}
                placeholder="Ej: https://www.sat.gob.mx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Dirección física de la autoridad"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Notas adicionales..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={uploading}>
              {uploading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
