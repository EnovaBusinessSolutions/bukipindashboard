import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Upload, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useInstitucionesFinancieras } from "@/hooks/useInstitucionesFinancieras";
import { useToast } from "@/hooks/use-toast";

interface InstitucionFinancieraSelectorProps {
  value?: string;
  onChange: (id: string, nombre: string) => void;
}

export default function InstitucionFinancieraSelector({
  value,
  onChange,
}: InstitucionFinancieraSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { instituciones, crearInstitucion } = useInstitucionesFinancieras();
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

  const selectedInstitucion = instituciones.find((inst) => inst.id === value);

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

  const handleCreate = async () => {
    if (!formData.nombre.trim()) {
      toast({
        title: "⚠️ Campo requerido",
        description: "El nombre de la institución es obligatorio",
        variant: "destructive",
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

      await crearInstitucion.mutateAsync({ ...formData, logo_url: logoUrl }, {
        onSuccess: (nuevaInstitucion) => {
          onChange(nuevaInstitucion.id, nuevaInstitucion.nombre);
          setShowNewDialog(false);
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
        },
      });
    } catch (error: any) {
      toast({
        title: "❌ Error al crear institución",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedInstitucion ? (
              <div className="flex items-center gap-2">
                {selectedInstitucion.logo_url && (
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={selectedInstitucion.logo_url} />
                    <AvatarFallback className="text-xs">
                      {selectedInstitucion.nombre[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span>{selectedInstitucion.nombre}</span>
              </div>
            ) : (
              "Seleccionar institución..."
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Buscar institución..." />
            <CommandEmpty>No se encontró la institución.</CommandEmpty>
            <CommandGroup>
              {instituciones.map((institucion) => (
                <CommandItem
                  key={institucion.id}
                  value={institucion.nombre}
                  onSelect={() => {
                    onChange(institucion.id, institucion.nombre);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === institucion.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2">
                    {institucion.logo_url && (
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={institucion.logo_url} />
                        <AvatarFallback className="text-xs">
                          {institucion.nombre[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span>{institucion.nombre}</span>
                  </div>
                </CommandItem>
              ))}
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  setShowNewDialog(true);
                }}
                className="border-t"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="font-medium">Nueva Institución</span>
              </CommandItem>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Institución Financiera</DialogTitle>
            <DialogDescription>
              Registra los datos de la institución financiera
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
                  placeholder="Nombre completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ejecutivo_telefono">Teléfono del Ejecutivo</Label>
                <Input
                  id="ejecutivo_telefono"
                  value={formData.ejecutivo_telefono}
                  onChange={(e) => setFormData({ ...formData, ejecutivo_telefono: e.target.value })}
                  placeholder="(555) 123-4567"
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
                placeholder="ejecutivo@banco.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefono_principal">Teléfono Principal</Label>
                <Input
                  id="telefono_principal"
                  value={formData.telefono_principal}
                  onChange={(e) => setFormData({ ...formData, telefono_principal: e.target.value })}
                  placeholder="(555) 000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_principal">Email Principal</Label>
                <Input
                  id="email_principal"
                  type="email"
                  value={formData.email_principal}
                  onChange={(e) => setFormData({ ...formData, email_principal: e.target.value })}
                  placeholder="info@banco.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Calle, número, colonia"
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
                placeholder="https://www.banco.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Información adicional..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={uploading || crearInstitucion.isPending}>
                {uploading ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-spin" />
                    Subiendo logo...
                  </>
                ) : crearInstitucion.isPending ? (
                  "Creando..."
                ) : (
                  "Crear Institución"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
