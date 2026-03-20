import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import {
  Building2,
  Edit,
  Trash2,
  Plus,
  Search,
  Phone,
  Mail,
  Upload,
  Globe,
  CreditCard,
  FileText,
  Copy,
  Sparkles,
  ShieldCheck,
  Landmark,
  MapPinned,
  Image as ImageIcon,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

export type AutoridadFiscal = {
  id: string;
  nombre: string;
  rfc?: string;
  logo_url?: string;
  pais: string;
  telefono?: string;
  email?: string;
  sitio_web?: string;
  direccion?: string;
  cuenta_bancaria?: string;
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
};

type AutoridadForm = {
  nombre: string;
  rfc: string;
  logo_url: string;
  pais: string;
  telefono: string;
  email: string;
  sitio_web: string;
  direccion: string;
  cuenta_bancaria: string;
  notas: string;
};

function normalizeAutoridades(json: any): AutoridadFiscal[] {
  const payload = json?.data ?? json;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.autoridades)) return payload.autoridades;
  return [];
}

function pickMostCommonCountry(list: AutoridadFiscal[]): string {
  if (!list.length) return "N/A";
  const counts = new Map<string, number>();
  for (const a of list) {
    const k = a.pais || "N/A";
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let best = "N/A";
  let bestCount = 0;
  counts.forEach((v, k) => {
    if (v > bestCount) {
      best = k;
      bestCount = v;
    }
  });
  return best;
}

export default function CatalogoAutoridadesFiscales() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingAutoridad, setEditingAutoridad] = useState<AutoridadFiscal | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedAutoridad, setSelectedAutoridad] = useState<AutoridadFiscal | null>(null);

  const [formData, setFormData] = useState<AutoridadForm>({
    nombre: "",
    rfc: "",
    logo_url: "",
    pais: "México",
    telefono: "",
    email: "",
    sitio_web: "",
    direccion: "",
    cuenta_bancaria: "",
    notas: "",
  });

  const paisesComunes = ["México", "Estados Unidos", "España", "Reino Unido", "Canadá", "Otro"];

  const { data: autoridades = [], isLoading } = useQuery({
    queryKey: ["autoridades-fiscales"],
    queryFn: async () => {
      const json = await apiFetch("/api/impuestos/autoridades-fiscales");
      return normalizeAutoridades(json);
    },
  });

  const autoridadesFiltradas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return autoridades;
    return autoridades.filter((aut) => {
      const n = (aut.nombre || "").toLowerCase();
      const p = (aut.pais || "").toLowerCase();
      return n.includes(term) || p.includes(term);
    });
  }, [autoridades, searchTerm]);

  const paisPrincipal = useMemo(() => pickMostCommonCountry(autoridades), [autoridades]);
  const conLogo = useMemo(() => autoridades.filter((a) => !!a.logo_url).length, [autoridades]);

  const crearAutoridad = useMutation({
    mutationFn: async (payload: Omit<AutoridadFiscal, "id">) => {
      const json = await apiFetch("/api/impuestos/autoridades-fiscales", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autoridades-fiscales"] });
      toast({ title: "✅ Autoridad creada" });
    },
    onError: (err: any) => {
      toast({
        title: "❌ Error al crear",
        description: err?.message || "Error inesperado",
        variant: "destructive",
      });
    },
  });

  const actualizarAutoridad = useMutation({
    mutationFn: async (payload: AutoridadFiscal) => {
      const json = await apiFetch(`/api/impuestos/autoridades-fiscales/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autoridades-fiscales"] });
      toast({ title: "✅ Autoridad actualizada" });
    },
    onError: (err: any) => {
      toast({
        title: "❌ Error al actualizar",
        description: err?.message || "Error inesperado",
        variant: "destructive",
      });
    },
  });

  const eliminarAutoridad = useMutation({
    mutationFn: async (id: string) => {
      const json = await apiFetch(`/api/impuestos/autoridades-fiscales/${id}`, {
        method: "DELETE",
      });
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autoridades-fiscales"] });
      toast({ title: "🗑️ Autoridad eliminada" });
    },
    onError: (err: any) => {
      toast({
        title: "❌ Error al eliminar",
        description: err?.message || "Error inesperado",
        variant: "destructive",
      });
    },
  });

  const handleViewDetails = (autoridad: AutoridadFiscal) => {
    setSelectedAutoridad(autoridad);
    setShowDetailsDialog(true);
  };

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
        cuenta_bancaria: autoridad.cuenta_bancaria || "",
        notas: autoridad.notas || "",
      });
      setLogoPreview(autoridad.logo_url || null);
      setLogoFile(null);
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
        cuenta_bancaria: "",
        notas: "",
      });
      setLogoFile(null);
      setLogoPreview(null);
    }

    setShowDialog(true);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "❌ Archivo muy grande",
        description: "El logo debe pesar menos de 2MB",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "❌ Tipo de archivo inválido",
        description: "Solo se permiten imágenes",
        variant: "destructive",
      });
      return;
    }

    setLogoFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return formData.logo_url || null;

    try {
      setUploading(true);

      const fd = new FormData();
      fd.append("file", logoFile);

      const res = await fetch("/api/uploads/autoridades-fiscales/logo", {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg = json?.message || json?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const payload = json?.data ?? json;
      const url = payload?.url || payload?.publicUrl || payload?.logo_url;

      if (!url) throw new Error("El backend no devolvió url del logo.");

      toast({
        title: "✅ Logo subido",
        description: "El logo se ha guardado correctamente",
      });

      return url;
    } catch (error: any) {
      toast({
        title: "❌ Error al subir logo",
        description: error?.message || "Error inesperado",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast({
        title: "❌ Campo requerido",
        description: "El nombre de la autoridad fiscal es obligatorio",
        variant: "destructive",
      });
      return;
    }

    try {
      let logoUrl = formData.logo_url || "";

      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) logoUrl = uploadedUrl;
      }

      const payloadBase = {
        nombre: formData.nombre.trim(),
        rfc: formData.rfc.trim() || "",
        logo_url: logoUrl || "",
        pais: formData.pais || "México",
        telefono: formData.telefono.trim() || "",
        email: formData.email.trim() || "",
        sitio_web: formData.sitio_web.trim() || "",
        direccion: formData.direccion.trim() || "",
        cuenta_bancaria: formData.cuenta_bancaria.trim() || "",
        notas: formData.notas || "",
      };

      if (editingAutoridad) {
        await actualizarAutoridad.mutateAsync({
          id: editingAutoridad.id,
          ...payloadBase,
        });
      } else {
        await crearAutoridad.mutateAsync(payloadBase);
      }

      setShowDialog(false);
      setLogoFile(null);
      setLogoPreview(null);
    } catch (error: any) {
      toast({
        title: "❌ Error al guardar",
        description: error?.message || "Error inesperado",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-emerald-50/70 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_24%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              Catálogo fiscal premium
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Gestión de autoridades fiscales
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-[15px]">
                Centraliza las autoridades fiscales con una vista más ejecutiva, ordenada y profesional para mantener
                la operación contable y tributaria bajo una experiencia premium Bukipin.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[560px]">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Autoridades</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">{autoridades.length}</p>
              <p className="mt-1 text-xs text-slate-500">registradas actualmente</p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <MapPinned className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">País principal</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">{paisPrincipal}</p>
              <p className="mt-1 text-xs text-slate-500">mayor presencia en el catálogo</p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <ImageIcon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Con logo</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">{conLogo}</p>
              <p className="mt-1 text-xs text-slate-500">identidad visual cargada</p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra búsqueda + CTA */}
      <Card className="overflow-hidden rounded-3xl border-slate-200/70 bg-white/95 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nombre o país..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 pl-11 text-slate-800 shadow-sm transition-all hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/20"
              />
            </div>

            <Button
              onClick={() => handleOpenDialog()}
              className="h-12 rounded-2xl bg-slate-900 px-5 text-white shadow-[0_16px_40px_-20px_rgba(15,23,42,0.65)] transition-all hover:bg-slate-800"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva Autoridad
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden rounded-3xl border-slate-200/70 bg-white/95 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-slate-900 via-emerald-600 to-cyan-500" />
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Landmark className="h-5 w-5 text-emerald-600" />
            Catálogo de Autoridades Fiscales
          </CardTitle>
          <CardDescription className="text-slate-600">
            Gestiona autoridades fiscales de distintos países con una vista más clara y premium.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-slate-200/80">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/90">
                  <TableRow className="border-slate-200 hover:bg-transparent">
                    <TableHead className="h-12 whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                      Autoridad
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                      RFC / Identificador
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                      País
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                      Contacto
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-slate-500">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : autoridadesFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-14">
                        <div className="flex flex-col items-center justify-center gap-3 text-center">
                          <div className="rounded-2xl bg-slate-100 p-3 text-slate-500">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">No hay autoridades fiscales registradas</p>
                            <p className="mt-1 text-sm text-slate-500">
                              Haz clic en “Nueva Autoridad” para comenzar a construir tu catálogo.
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    autoridadesFiltradas.map((autoridad, index) => (
                      <TableRow
                        key={autoridad.id}
                        className={`cursor-pointer border-slate-200 transition-colors hover:bg-emerald-50/40 ${
                          index % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                        }`}
                        onClick={() => handleViewDetails(autoridad)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-11 w-11 rounded-2xl border border-slate-200">
                              <AvatarImage src={autoridad.logo_url || undefined} />
                              <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-600">
                                <Building2 className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>

                            <div className="space-y-1">
                              <p className="font-semibold text-slate-900">{autoridad.nombre}</p>
                              {autoridad.sitio_web ? (
                                <a
                                  href={autoridad.sitio_web}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-emerald-700 transition-colors hover:text-emerald-800 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Globe className="h-3 w-3" />
                                  Sitio web
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">Sin sitio web</span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {autoridad.rfc ? (
                            <span className="inline-flex rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-sm font-medium text-slate-700">
                              {autoridad.rfc}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">Sin RFC</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">
                            {autoridad.pais}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1.5">
                            {autoridad.telefono && (
                              <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Phone className="h-3 w-3 text-slate-400" />
                                <span>{autoridad.telefono}</span>
                              </div>
                            )}
                            {autoridad.email && (
                              <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Mail className="h-3 w-3 text-slate-400" />
                                <span>{autoridad.email}</span>
                              </div>
                            )}
                            {!autoridad.telefono && !autoridad.email && (
                              <span className="text-xs text-slate-400">Sin contacto registrado</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 rounded-xl border border-transparent p-0 text-slate-600 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
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
                              className="h-9 w-9 rounded-xl border border-transparent p-0 text-slate-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog crear/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-3xl border-slate-200 bg-white p-0 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.45)]">
          <div className="overflow-hidden rounded-3xl">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-700 px-6 py-5 text-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  {editingAutoridad ? "Editar Autoridad Fiscal" : "Nueva Autoridad Fiscal"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-slate-200">
                  {editingAutoridad
                    ? "Modifica los datos de la autoridad fiscal."
                    : "Registra una nueva autoridad fiscal en tu catálogo."}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-semibold text-slate-900">Información general</p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="nombre" className="text-[13px] font-semibold text-slate-700">
                          Nombre de la Autoridad *
                        </Label>
                        <Input
                          id="nombre"
                          value={formData.nombre}
                          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                          placeholder="Ej: SAT - Servicio de Administración Tributaria"
                          className="h-11 rounded-2xl border-slate-200 bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="rfc" className="text-[13px] font-semibold text-slate-700">
                            RFC / Identificador Fiscal
                          </Label>
                          <Input
                            id="rfc"
                            value={formData.rfc}
                            onChange={(e) => setFormData({ ...formData, rfc: e.target.value })}
                            placeholder="Ej: SAT970701NN3"
                            className="h-11 rounded-2xl border-slate-200 bg-white"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="pais" className="text-[13px] font-semibold text-slate-700">
                            País
                          </Label>
                          <select
                            id="pais"
                            value={formData.pais}
                            onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-all focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500/20"
                          >
                            {paisesComunes.map((pais) => (
                              <option key={pais} value={pais}>
                                {pais}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-cyan-600" />
                      <p className="text-sm font-semibold text-slate-900">Contacto y localización</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="telefono" className="text-[13px] font-semibold text-slate-700">
                          Teléfono
                        </Label>
                        <Input
                          id="telefono"
                          value={formData.telefono}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                          placeholder="Ej: 55 5555 5555"
                          className="h-11 rounded-2xl border-slate-200 bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-[13px] font-semibold text-slate-700">
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="Ej: contacto@sat.gob.mx"
                          className="h-11 rounded-2xl border-slate-200 bg-white"
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="sitio_web" className="text-[13px] font-semibold text-slate-700">
                          Sitio Web
                        </Label>
                        <Input
                          id="sitio_web"
                          value={formData.sitio_web}
                          onChange={(e) => setFormData({ ...formData, sitio_web: e.target.value })}
                          placeholder="Ej: https://www.sat.gob.mx"
                          className="h-11 rounded-2xl border-slate-200 bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="direccion" className="text-[13px] font-semibold text-slate-700">
                          Dirección
                        </Label>
                        <Input
                          id="direccion"
                          value={formData.direccion}
                          onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                          placeholder="Dirección física de la autoridad"
                          className="h-11 rounded-2xl border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-violet-600" />
                      <p className="text-sm font-semibold text-slate-900">Información bancaria y notas</p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="cuenta_bancaria" className="text-[13px] font-semibold text-slate-700">
                          Cuenta Bancaria / CLABE
                        </Label>
                        <Input
                          id="cuenta_bancaria"
                          value={formData.cuenta_bancaria}
                          onChange={(e) => setFormData({ ...formData, cuenta_bancaria: e.target.value })}
                          placeholder="Ej: 012180001234567890"
                          className="h-11 rounded-2xl border-slate-200 bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notas" className="text-[13px] font-semibold text-slate-700">
                          Notas
                        </Label>
                        <Textarea
                          id="notas"
                          value={formData.notas}
                          onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                          placeholder="Notas adicionales..."
                          rows={4}
                          className="rounded-2xl border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Upload className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-semibold text-slate-900">Logo de la autoridad</p>
                    </div>

                    {logoPreview ? (
                      <div className="space-y-4">
                        <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <img src={logoPreview} alt="Preview" className="h-full w-full object-contain p-4" />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute right-3 top-3 h-8 w-8 rounded-xl"
                            onClick={() => {
                              setLogoFile(null);
                              setLogoPreview(null);
                              setFormData({ ...formData, logo_url: "" });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <label className="block cursor-pointer">
                          <div className="flex h-11 items-center justify-center rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100/70">
                            Reemplazar logo
                          </div>
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                        </label>
                      </div>
                    ) : (
                      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center transition-colors hover:border-emerald-300 hover:bg-emerald-50/40">
                        <label className="cursor-pointer">
                          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                            <Upload className="h-6 w-6" />
                          </div>
                          <p className="text-sm font-medium text-slate-700">Haz clic para subir una imagen</p>
                          <p className="mt-1 text-xs text-slate-500">PNG, JPG hasta 2MB</p>
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50 via-cyan-50 to-white p-5 shadow-[0_16px_40px_-30px_rgba(37,99,235,0.25)]">
                    <div className="mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-semibold text-slate-900">Recomendaciones</p>
                    </div>
                    <div className="space-y-2 text-sm leading-6 text-slate-600">
                      <p>• Usa el nombre oficial de la autoridad fiscal.</p>
                      <p>• Agrega RFC o identificador para facilitar trazabilidad.</p>
                      <p>• Mantén el contacto y cuenta bancaria actualizados.</p>
                      <p>• Sube logotipo cuando exista para una experiencia más profesional.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-200 pt-5 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  className="h-11 rounded-2xl border-slate-200 px-5"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={uploading}
                  className="h-11 rounded-2xl bg-slate-900 px-5 text-white hover:bg-slate-800"
                >
                  {uploading ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog detalles */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-3xl border-slate-200 bg-white p-0 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.45)]">
          {selectedAutoridad && (
            <div className="overflow-hidden rounded-3xl">
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-700 px-6 py-6 text-white">
                <DialogHeader>
                  <div className="flex items-start gap-4">
                    {selectedAutoridad.logo_url ? (
                      <img
                        src={selectedAutoridad.logo_url}
                        alt={selectedAutoridad.nombre}
                        className="h-16 w-16 rounded-2xl border border-white/20 bg-white object-contain p-2"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                        <Building2 className="h-8 w-8 text-white/90" />
                      </div>
                    )}

                    <div className="flex-1">
                      <DialogTitle className="text-2xl font-semibold tracking-tight">
                        {selectedAutoridad.nombre}
                      </DialogTitle>
                      <Badge className="mt-3 rounded-full bg-white/15 text-white hover:bg-white/15">
                        {selectedAutoridad.pais}
                      </Badge>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="space-y-5 p-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      Información General
                    </div>
                    <div className="space-y-4 text-sm">
                      <div>
                        <span className="text-slate-500">RFC / Identificador</span>
                        <p className="mt-1 font-medium text-slate-900">
                          {selectedAutoridad.rfc || "No especificado"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">País</span>
                        <p className="mt-1 font-medium text-slate-900">{selectedAutoridad.pais}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Phone className="h-4 w-4 text-cyan-600" />
                      Contacto
                    </div>
                    <div className="space-y-4 text-sm">
                      <div>
                        <span className="text-slate-500">Teléfono</span>
                        <p className="mt-1 font-medium text-slate-900">
                          {selectedAutoridad.telefono || "No especificado"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Email</span>
                        <p className="mt-1 font-medium text-slate-900">
                          {selectedAutoridad.email || "No especificado"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Globe className="h-4 w-4 text-violet-600" />
                    Presencia y localización
                  </div>
                  <div className="space-y-4 text-sm">
                    <div>
                      <span className="text-slate-500">Sitio Web</span>
                      {selectedAutoridad.sitio_web ? (
                        <a
                          href={selectedAutoridad.sitio_web}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center gap-2 font-medium text-emerald-700 hover:underline"
                        >
                          <Globe className="h-4 w-4" />
                          {selectedAutoridad.sitio_web}
                        </a>
                      ) : (
                        <p className="mt-1 font-medium text-slate-900">No especificado</p>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-500">Dirección</span>
                      <p className="mt-1 font-medium text-slate-900">
                        {selectedAutoridad.direccion || "No especificado"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CreditCard className="h-4 w-4 text-amber-600" />
                    Información Bancaria
                  </div>

                  <div className="text-sm">
                    <span className="text-slate-500">Cuenta Bancaria / CLABE</span>
                    {selectedAutoridad.cuenta_bancaria ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono font-medium text-slate-900 shadow-sm">
                          {selectedAutoridad.cuenta_bancaria}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 rounded-xl border border-slate-200 bg-white px-3 hover:bg-slate-50"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedAutoridad.cuenta_bancaria || "");
                            toast({ title: "✅ Cuenta copiada al portapapeles" });
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-1 font-medium text-slate-900">No especificado</p>
                    )}
                  </div>
                </div>

                {selectedAutoridad.notas && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      Notas
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {selectedAutoridad.notas}
                    </p>
                  </div>
                )}

                <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-200 pt-5 sm:flex-row">
                  <Button
                    variant="outline"
                    className="h-11 rounded-2xl border-slate-200 px-5"
                    onClick={() => {
                      setShowDetailsDialog(false);
                      handleOpenDialog(selectedAutoridad);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    onClick={() => setShowDetailsDialog(false)}
                    className="h-11 rounded-2xl bg-slate-900 px-5 text-white hover:bg-slate-800"
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}