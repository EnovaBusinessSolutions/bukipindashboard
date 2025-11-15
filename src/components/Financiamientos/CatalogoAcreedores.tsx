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
import { Building2, Edit, Trash2, Plus, Search, User, Phone, Mail, Upload } from "lucide-react";
import { useInstitucionesFinancieras, InstitucionFinanciera } from "@/hooks/useInstitucionesFinancieras";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function CatalogoAcreedores() {
  const { instituciones, crearInstitucion, actualizarInstitucion, eliminarInstitucion } =
    useInstitucionesFinancieras();
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingInstitucion, setEditingInstitucion] = useState<InstitucionFinanciera | null>(null);
  const [selectedInstitucion, setSelectedInstitucion] = useState<InstitucionFinanciera | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nombre: "",
    logo_url: "",
    ejecutivo_nombre: "",
    ejecutivo_telefono: "",
    ejecutivo_email: "",
    telefono_principal: "",
    email_principal: "",
    direccion: "",
    ciudad: "",
    estado: "",
    codigo_postal: "",
    sitio_web: "",
    notas: "",
  });

  // Obtener financiamientos por institución
  const { data: financiamientos } = useQuery({
    queryKey: ["financiamientos-por-institucion"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("financiamientos")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data;
    },
  });

  // Calcular métricas
  const institucionesActivas = instituciones.length;
  const creditosActivos = financiamientos?.filter((f) => f.estado === "activo").length || 0;
  const montoTotalFinanciado = financiamientos?.reduce((acc, f) => acc + f.monto_total, 0) || 0;
  const tasaPromedio =
    financiamientos && financiamientos.length > 0
      ? financiamientos.reduce((acc, f) => acc + f.tasa_interes, 0) / financiamientos.length
      : 0;

  const institucionesFiltradas = instituciones.filter((inst) =>
    inst.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (institucion?: InstitucionFinanciera) => {
    if (institucion) {
      setEditingInstitucion(institucion);
      setFormData({
        nombre: institucion.nombre,
        logo_url: institucion.logo_url || "",
        ejecutivo_nombre: institucion.ejecutivo_nombre || "",
        ejecutivo_telefono: institucion.ejecutivo_telefono || "",
        ejecutivo_email: institucion.ejecutivo_email || "",
        telefono_principal: institucion.telefono_principal || "",
        email_principal: institucion.email_principal || "",
        direccion: institucion.direccion || "",
        ciudad: institucion.ciudad || "",
        estado: institucion.estado || "",
        codigo_postal: institucion.codigo_postal || "",
        sitio_web: institucion.sitio_web || "",
        notas: institucion.notas || "",
      });
      // Si tiene logo, mostrar preview
      if (institucion.logo_url) {
        setLogoPreview(institucion.logo_url);
      }
    } else {
      setEditingInstitucion(null);
      setFormData({
        nombre: "",
        logo_url: "",
        ejecutivo_nombre: "",
        ejecutivo_telefono: "",
        ejecutivo_email: "",
        telefono_principal: "",
        email_principal: "",
        direccion: "",
        ciudad: "",
        estado: "",
        codigo_postal: "",
        sitio_web: "",
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
      // Validar tamaño (máx 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "❌ Archivo muy grande",
          description: "El logo debe pesar menos de 2MB",
          variant: "destructive"
        });
        return;
      }

      // Validar tipo
      if (!file.type.startsWith('image/')) {
        toast({
          title: "❌ Tipo de archivo inválido",
          description: "Solo se permiten imágenes",
          variant: "destructive"
        });
        return;
      }

      setLogoFile(file);
      
      // Crear preview
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
      const filePath = `instituciones/${fileName}`;

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
    try {
      let logoUrl = formData.logo_url;
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
      }

      if (editingInstitucion) {
        await actualizarInstitucion.mutateAsync({
          id: editingInstitucion.id,
          ...formData,
          logo_url: logoUrl,
        });
      } else {
        await crearInstitucion.mutateAsync({ ...formData, logo_url: logoUrl });
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

  const getCreditosCount = (institucionId: string) => {
    return financiamientos?.filter(
      (f) => f.institucion_financiera_id === institucionId && f.estado === "activo"
    ).length || 0;
  };

  const getFinanciamientosByInstitucion = (institucionId: string) => {
    return financiamientos?.filter((f) => f.institucion_financiera_id === institucionId) || [];
  };

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Instituciones Activas</CardDescription>
            <CardTitle className="text-3xl">{institucionesActivas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Créditos Activos</CardDescription>
            <CardTitle className="text-3xl">{creditosActivos}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Monto Total Financiado</CardDescription>
            <CardTitle className="text-3xl">
              ${montoTotalFinanciado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Tasa Promedio</CardDescription>
            <CardTitle className="text-3xl">{tasaPromedio.toFixed(2)}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Barra de búsqueda y acciones */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar institución..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Institución
        </Button>
      </div>

      {/* Tabla de instituciones */}
      <Card>
        <CardHeader>
          <CardTitle>Catálogo de Acreedores Financieros</CardTitle>
          <CardDescription>
            Gestiona las instituciones financieras con las que trabajas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institución</TableHead>
                <TableHead>Ejecutivo</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-center">Créditos Activos</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institucionesFiltradas.map((institucion) => {
                const creditosCount = getCreditosCount(institucion.id);
                return (
                  <TableRow
                    key={institucion.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedInstitucion(institucion)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={institucion.logo_url || undefined} />
                          <AvatarFallback>
                            <Building2 className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{institucion.nombre}</p>
                          {institucion.sitio_web && (
                            <a
                              href={institucion.sitio_web}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Sitio web →
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {institucion.ejecutivo_nombre ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{institucion.ejecutivo_nombre}</span>
                          </div>
                          {institucion.ejecutivo_telefono && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {institucion.ejecutivo_telefono}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {institucion.telefono_principal && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{institucion.telefono_principal}</span>
                          </div>
                        )}
                        {institucion.email_principal && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{institucion.email_principal}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={creditosCount > 0 ? "default" : "outline"}>
                        {creditosCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDialog(institucion);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            eliminarInstitucion.mutate(institucion.id);
                          }}
                          disabled={creditosCount > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog para crear/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInstitucion ? "Editar Institución" : "Nueva Institución"}
            </DialogTitle>
            <DialogDescription>
              {editingInstitucion
                ? "Modifica los datos de la institución financiera"
                : "Registra una nueva institución financiera"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de la Institución *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: BBVA Bancomer"
              />
            </div>

            <div className="space-y-2">
              <Label>Logo de la Institución</Label>
              
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
                      <span className="font-semibold text-primary">Click para subir</span> o arrastra aquí
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, SVG (máx. 2MB)
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      disabled={uploading}
                    />
                  </label>
                </div>
              )}

              <div className="pt-2">
                <Label htmlFor="logo_url" className="text-xs text-muted-foreground">
                  O ingresa una URL directamente
                </Label>
                <Input
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://ejemplo.com/logo.png"
                  disabled={!!logoFile || uploading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ejecutivo_nombre">Nombre del Ejecutivo</Label>
                <Input
                  id="ejecutivo_nombre"
                  value={formData.ejecutivo_nombre}
                  onChange={(e) => setFormData({ ...formData, ejecutivo_nombre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ejecutivo_telefono">Teléfono del Ejecutivo</Label>
                <Input
                  id="ejecutivo_telefono"
                  value={formData.ejecutivo_telefono}
                  onChange={(e) =>
                    setFormData({ ...formData, ejecutivo_telefono: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ejecutivo_email">Email del Ejecutivo</Label>
              <Input
                id="ejecutivo_email"
                type="email"
                value={formData.ejecutivo_email}
                onChange={(e) => setFormData({ ...formData, ejecutivo_email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefono_principal">Teléfono Principal</Label>
                <Input
                  id="telefono_principal"
                  value={formData.telefono_principal}
                  onChange={(e) =>
                    setFormData({ ...formData, telefono_principal: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_principal">Email Principal</Label>
                <Input
                  id="email_principal"
                  type="email"
                  value={formData.email_principal}
                  onChange={(e) => setFormData({ ...formData, email_principal: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="codigo_postal">Código Postal</Label>
                <Input
                  id="codigo_postal"
                  value={formData.codigo_postal}
                  onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sitio_web">Sitio Web</Label>
              <Input
                id="sitio_web"
                value={formData.sitio_web}
                onChange={(e) => setFormData({ ...formData, sitio_web: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={uploading || actualizarInstitucion.isPending || crearInstitucion.isPending}>
                {uploading ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-spin" />
                    Subiendo logo...
                  </>
                ) : editingInstitucion ? "Guardar Cambios" : "Crear Institución"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de detalle de institución */}
      <Dialog open={!!selectedInstitucion} onOpenChange={() => setSelectedInstitucion(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={selectedInstitucion?.logo_url || undefined} />
                <AvatarFallback>
                  <Building2 className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle>{selectedInstitucion?.nombre}</DialogTitle>
                <DialogDescription>Detalle de la institución financiera</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedInstitucion && (
            <div className="space-y-6">
              {/* Información de contacto */}
              <div className="grid grid-cols-2 gap-4">
                {selectedInstitucion.ejecutivo_nombre && (
                  <div>
                    <Label className="text-muted-foreground">Ejecutivo de Cuenta</Label>
                    <p className="font-medium">{selectedInstitucion.ejecutivo_nombre}</p>
                    {selectedInstitucion.ejecutivo_telefono && (
                      <p className="text-sm text-muted-foreground">
                        {selectedInstitucion.ejecutivo_telefono}
                      </p>
                    )}
                    {selectedInstitucion.ejecutivo_email && (
                      <p className="text-sm text-primary">{selectedInstitucion.ejecutivo_email}</p>
                    )}
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Contacto General</Label>
                  {selectedInstitucion.telefono_principal && (
                    <p className="text-sm">{selectedInstitucion.telefono_principal}</p>
                  )}
                  {selectedInstitucion.email_principal && (
                    <p className="text-sm text-primary">{selectedInstitucion.email_principal}</p>
                  )}
                </div>
              </div>

              {/* Dirección */}
              {selectedInstitucion.direccion && (
                <div>
                  <Label className="text-muted-foreground">Dirección</Label>
                  <p className="text-sm">{selectedInstitucion.direccion}</p>
                  <p className="text-sm text-muted-foreground">
                    {[
                      selectedInstitucion.ciudad,
                      selectedInstitucion.estado,
                      selectedInstitucion.codigo_postal,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              )}

              {/* Notas */}
              {selectedInstitucion.notas && (
                <div>
                  <Label className="text-muted-foreground">Notas</Label>
                  <p className="text-sm whitespace-pre-wrap">{selectedInstitucion.notas}</p>
                </div>
              )}

              {/* Financiamientos */}
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Financiamientos Asociados
                </Label>
                <div className="space-y-2">
                  {getFinanciamientosByInstitucion(selectedInstitucion.id).map((f) => (
                    <Card key={f.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{f.nombre}</p>
                            <p className="text-sm text-muted-foreground">
                              {f.tipo_credito === "simple"
                                ? "Crédito Simple"
                                : f.tipo_credito === "revolvente"
                                  ? "Crédito Revolvente"
                                  : "Tarjeta Corporativa"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              ${f.saldo_actual.toLocaleString("es-MX")}
                            </p>
                            <Badge variant={f.estado === "activo" ? "default" : "secondary"}>
                              {f.estado}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
