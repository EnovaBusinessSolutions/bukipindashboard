import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

type NewInstitutionForm = {
  nombre: string;
  alias: string;
  tipo: string;
  categoria: string;
  codigo: string;
  descripcion: string;
  telefono: string;
  email: string;
  sitio_web: string;
  contacto_nombre: string;
  contacto_puesto: string;
  notas: string;
};

const INITIAL_FORM: NewInstitutionForm = {
  nombre: "",
  alias: "",
  tipo: "banco",
  categoria: "financiero",
  codigo: "",
  descripcion: "",
  telefono: "",
  email: "",
  sitio_web: "",
  contacto_nombre: "",
  contacto_puesto: "",
  notas: "",
};

export default function InstitucionFinancieraSelector({
  value,
  onChange,
}: InstitucionFinancieraSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [formData, setFormData] = useState<NewInstitutionForm>(INITIAL_FORM);

  const { instituciones, crearInstitucion } = useInstitucionesFinancieras();
  const { toast } = useToast();

  const selectedInstitucion = useMemo(() => {
    return instituciones.find((inst) => inst.id === value);
  }, [instituciones, value]);

  const resetForm = () => {
    setFormData(INITIAL_FORM);
  };

  const closeDialog = () => {
    setShowNewDialog(false);
    resetForm();
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
      const nuevaInstitucion = await crearInstitucion.mutateAsync({
        nombre: formData.nombre.trim(),
        alias: formData.alias.trim(),
        tipo: formData.tipo,
        categoria: formData.categoria,
        codigo: formData.codigo.trim(),
        descripcion: formData.descripcion.trim(),
        telefono: formData.telefono.trim(),
        email: formData.email.trim(),
        sitio_web: formData.sitio_web.trim(),
        contacto_nombre: formData.contacto_nombre.trim(),
        contacto_puesto: formData.contacto_puesto.trim(),
        notas: formData.notas.trim(),
      });

      onChange(nuevaInstitucion.id, nuevaInstitucion.nombre);
      closeDialog();
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "❌ Error al crear institución",
        description: error?.message || "Error inesperado",
        variant: "destructive",
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
              <div className="flex items-center gap-2 min-w-0">
                {selectedInstitucion.logo_url ? (
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={selectedInstitucion.logo_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {selectedInstitucion.nombre?.[0] || "I"}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="text-xs">
                      {selectedInstitucion.nombre?.[0] || "I"}
                    </AvatarFallback>
                  </Avatar>
                )}

                <span className="truncate">{selectedInstitucion.nombre}</span>
              </div>
            ) : (
              "Seleccionar institución..."
            )}

            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder="Buscar institución..." />
            <CommandEmpty>No se encontró la institución.</CommandEmpty>

            <CommandGroup>
              {instituciones.map((institucion) => (
                <CommandItem
                  key={institucion.id}
                  value={`${institucion.nombre} ${institucion.alias || ""} ${institucion.codigo || ""}`}
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

                  <div className="flex items-center gap-2 min-w-0">
                    {institucion.logo_url ? (
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={institucion.logo_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {institucion.nombre?.[0] || "I"}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="text-xs">
                          {institucion.nombre?.[0] || "I"}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className="min-w-0">
                      <div className="truncate">{institucion.nombre}</div>
                      {(institucion.tipo || institucion.codigo) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {[institucion.tipo, institucion.codigo].filter(Boolean).join(" • ")}
                        </div>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}

              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  resetForm();
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

      <Dialog
        open={showNewDialog}
        onOpenChange={(v) => {
          setShowNewDialog(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Institución Financiera</DialogTitle>
            <DialogDescription>
              Registra los datos básicos de la institución financiera
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre de la Institución *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  placeholder="Ej: BBVA"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alias">Alias</Label>
                <Input
                  id="alias"
                  value={formData.alias}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, alias: e.target.value }))
                  }
                  placeholder="Ej: BBVA Empresas"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Input
                  id="tipo"
                  value={formData.tipo}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tipo: e.target.value }))
                  }
                  placeholder="banco"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, categoria: e.target.value }))
                  }
                  placeholder="financiero"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, codigo: e.target.value }))
                  }
                  placeholder="BBVA"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, descripcion: e.target.value }))
                }
                placeholder="Información general de la institución..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, telefono: e.target.value }))
                  }
                  placeholder="(555) 000-0000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="info@institucion.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sitio_web">Sitio Web</Label>
              <Input
                id="sitio_web"
                value={formData.sitio_web}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sitio_web: e.target.value }))
                }
                placeholder="https://www.institucion.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contacto_nombre">Contacto</Label>
                <Input
                  id="contacto_nombre"
                  value={formData.contacto_nombre}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, contacto_nombre: e.target.value }))
                  }
                  placeholder="Nombre del ejecutivo o contacto"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contacto_puesto">Puesto</Label>
                <Input
                  id="contacto_puesto"
                  value={formData.contacto_puesto}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, contacto_puesto: e.target.value }))
                  }
                  placeholder="Ej: Ejecutivo PyME"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notas: e.target.value }))
                }
                placeholder="Información adicional..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>

              <Button onClick={handleCreate} disabled={crearInstitucion.isPending}>
                {crearInstitucion.isPending ? "Creando..." : "Crear Institución"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}