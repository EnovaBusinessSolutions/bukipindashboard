import { useMemo, useState } from "react";
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
import { Building2, Edit, Trash2, Plus, Search, User, Phone, Mail } from "lucide-react";
import { useInstitucionesFinancieras, InstitucionFinanciera } from "@/hooks/useInstitucionesFinancieras";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const FINANCIAMIENTOS_ENDPOINT = "/api/financiamientos";

type Financiamiento = {
  id: string;
  _id?: string;
  nombre: string;
  tipo?: string;
  tipo_credito?: string;
  estatus?: string;
  estado?: string;
  institucion?: string;
  institucion_id?: string | null;
  institucionId?: string | null;
  institucion_financiera?: string;
  institucion_financiera_id?: string | null;
  monto_original?: number;
  montoOriginal?: number;
  linea_credito?: number;
  lineaCredito?: number;
  monto_total?: number;
  saldo_total_actual?: number;
  saldoTotalActual?: number;
  saldo_capital_actual?: number;
  saldoCapitalActual?: number;
  saldo_actual?: number;
  tasa_interes_anual?: number;
  tasaInteresAnual?: number;
  tasa_interes?: number;
};

type FormState = {
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

const INITIAL_FORM: FormState = {
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

async function apiJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || `Error HTTP ${res.status}`;
    throw new Error(msg);
  }

  return (json?.data ?? json) as T;
}

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const getFinStatus = (f: Financiamiento) => String(f.estatus || f.estado || "").toLowerCase();

const getFinTipo = (f: Financiamiento) => {
  const raw = String(f.tipo || f.tipo_credito || "").toLowerCase();
  if (raw === "tarjeta_credito" || raw === "tarjeta_corporativa") return "tarjeta_corporativa";
  if (raw === "linea_credito" || raw === "revolvente") return "revolvente";
  if (raw === "credito_simple" || raw === "simple" || raw === "prestamo") return "simple";
  return raw || "otro";
};

const getFinTipoLabel = (f: Financiamiento) => {
  const tipo = getFinTipo(f);
  if (tipo === "simple") return "Crédito Simple";
  if (tipo === "revolvente") return "Crédito Revolvente";
  if (tipo === "tarjeta_corporativa") return "Tarjeta Corporativa";
  return "Financiamiento";
};

const getFinInstitucionId = (f: Financiamiento) =>
  String(
    f.institucion_id ||
      f.institucionId ||
      f.institucion_financiera_id ||
      f.institucion ||
      f.institucion_financiera ||
      ""
  );

const getFinMontoBase = (f: Financiamiento) => {
  const tipo = getFinTipo(f);
  if (tipo === "revolvente" || tipo === "tarjeta_corporativa") {
    return toNum(f.linea_credito ?? f.lineaCredito ?? f.monto_total, 0);
  }
  return toNum(f.monto_original ?? f.montoOriginal ?? f.monto_total, 0);
};

const getFinSaldo = (f: Financiamiento) =>
  toNum(f.saldo_total_actual ?? f.saldoTotalActual ?? f.saldo_capital_actual ?? f.saldoCapitalActual ?? f.saldo_actual, 0);

const getFinTasa = (f: Financiamiento) =>
  toNum(f.tasa_interes_anual ?? f.tasaInteresAnual ?? f.tasa_interes, 0);

export default function CatalogoAcreedores() {
  const { instituciones, crearInstitucion, actualizarInstitucion, eliminarInstitucion } =
    useInstitucionesFinancieras();

  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingInstitucion, setEditingInstitucion] = useState<InstitucionFinanciera | null>(null);
  const [selectedInstitucion, setSelectedInstitucion] = useState<InstitucionFinanciera | null>(null);
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);

  const { toast } = useToast();

  const { data: financiamientos = [], isLoading: isLoadingFin } = useQuery({
    queryKey: ["financiamientos-por-institucion"],
    queryFn: async () => {
      return await apiJSON<Financiamiento[]>(FINANCIAMIENTOS_ENDPOINT);
    },
  });

  const institucionesActivas = instituciones.length;
  const creditosActivos = financiamientos.filter((f) => getFinStatus(f) === "activo").length || 0;
  const montoTotalFinanciado =
    financiamientos.reduce((acc, f) => acc + getFinMontoBase(f), 0) || 0;

  const tasaPromedio =
    financiamientos.length > 0
      ? financiamientos.reduce((acc, f) => acc + getFinTasa(f), 0) / financiamientos.length
      : 0;

  const institucionesFiltradas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return instituciones;
    return instituciones.filter((inst) => {
      const haystack = [
        inst.nombre,
        inst.alias,
        inst.codigo,
        inst.contacto_nombre,
        inst.telefono,
        inst.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [instituciones, searchTerm]);

  const resetForm = () => {
    setFormData(INITIAL_FORM);
  };

  const handleOpenDialog = (institucion?: InstitucionFinanciera) => {
    if (institucion) {
      setEditingInstitucion(institucion);
      setFormData({
        nombre: institucion.nombre || "",
        alias: institucion.alias || "",
        tipo: institucion.tipo || "banco",
        categoria: institucion.categoria || "financiero",
        codigo: institucion.codigo || "",
        descripcion: institucion.descripcion || "",
        telefono: institucion.telefono || institucion.telefono_principal || "",
        email: institucion.email || institucion.email_principal || "",
        sitio_web: institucion.sitio_web || institucion.sitioWeb || "",
        contacto_nombre:
          institucion.contacto_nombre ||
          institucion.contactoNombre ||
          institucion.ejecutivo_nombre ||
          "",
        contacto_puesto:
          institucion.contacto_puesto ||
          institucion.contactoPuesto ||
          "",
        notas: institucion.notas || "",
      });
    } else {
      setEditingInstitucion(null);
      resetForm();
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.nombre.trim()) {
        toast({
          title: "❌ Falta el nombre",
          description: "El nombre de la institución es obligatorio.",
          variant: "destructive",
        });
        return;
      }

      if (editingInstitucion) {
        await actualizarInstitucion.mutateAsync({
          id: editingInstitucion.id,
          nombre: formData.nombre.trim(),
          alias: formData.alias.trim(),
          tipo: formData.tipo.trim(),
          categoria: formData.categoria.trim(),
          codigo: formData.codigo.trim(),
          descripcion: formData.descripcion.trim(),
          telefono: formData.telefono.trim(),
          email: formData.email.trim(),
          sitio_web: formData.sitio_web.trim(),
          contacto_nombre: formData.contacto_nombre.trim(),
          contacto_puesto: formData.contacto_puesto.trim(),
          notas: formData.notas.trim(),
        });
      } else {
        await crearInstitucion.mutateAsync({
          nombre: formData.nombre.trim(),
          alias: formData.alias.trim(),
          tipo: formData.tipo.trim(),
          categoria: formData.categoria.trim(),
          codigo: formData.codigo.trim(),
          descripcion: formData.descripcion.trim(),
          telefono: formData.telefono.trim(),
          email: formData.email.trim(),
          sitio_web: formData.sitio_web.trim(),
          contacto_nombre: formData.contacto_nombre.trim(),
          contacto_puesto: formData.contacto_puesto.trim(),
          notas: formData.notas.trim(),
        });
      }

      setShowDialog(false);
      resetForm();
      setEditingInstitucion(null);
    } catch (error: any) {
      toast({
        title: "❌ Error al guardar",
        description: error?.message || "Error inesperado",
        variant: "destructive",
      });
    }
  };

  const getCreditosCount = (institucionId: string) => {
    return financiamientos.filter(
      (f) => getFinInstitucionId(f) === institucionId && getFinStatus(f) === "activo"
    ).length;
  };

  const getFinanciamientosByInstitucion = (institucionId: string) => {
    return financiamientos.filter((f) => getFinInstitucionId(f) === institucionId);
  };

  return (
    <div className="space-y-6">
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

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de Acreedores Financieros</CardTitle>
          <CardDescription>Gestiona las instituciones financieras con las que trabajas</CardDescription>
        </CardHeader>

        <CardContent>
          {isLoadingFin ? (
            <div className="text-sm text-muted-foreground">Cargando financiamientos…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institución</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Canales</TableHead>
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
                              {institucion.nombre?.[0] ? institucion.nombre[0].toUpperCase() : <Building2 className="h-5 w-5" />}
                            </AvatarFallback>
                          </Avatar>

                          <div>
                            <p className="font-medium">{institucion.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {[institucion.alias, institucion.codigo, institucion.tipo].filter(Boolean).join(" • ") || "Sin metadata"}
                            </p>
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
                        {institucion.contacto_nombre || institucion.ejecutivo_nombre ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">
                                {institucion.contacto_nombre ||
                                  institucion.contactoNombre ||
                                  institucion.ejecutivo_nombre}
                              </span>
                            </div>
                            {(institucion.contacto_puesto || institucion.contactoPuesto) && (
                              <div className="text-xs text-muted-foreground">
                                {institucion.contacto_puesto || institucion.contactoPuesto}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin asignar</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          {(institucion.telefono || institucion.telefono_principal) && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">
                                {institucion.telefono || institucion.telefono_principal}
                              </span>
                            </div>
                          )}
                          {(institucion.email || institucion.email_principal) && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">
                                {institucion.email || institucion.email_principal}
                              </span>
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

                {institucionesFiltradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No se encontraron instituciones
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={showDialog}
        onOpenChange={(v) => {
          setShowDialog(v);
          if (!v) {
            resetForm();
            setEditingInstitucion(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInstitucion ? "Editar Institución" : "Nueva Institución"}</DialogTitle>
            <DialogDescription>
              {editingInstitucion
                ? "Modifica los datos de la institución financiera"
                : "Registra una nueva institución financiera"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre de la Institución *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: BBVA"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alias">Alias</Label>
                <Input
                  id="alias"
                  value={formData.alias}
                  onChange={(e) => setFormData((p) => ({ ...p, alias: e.target.value }))}
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
                  onChange={(e) => setFormData((p) => ({ ...p, tipo: e.target.value }))}
                  placeholder="banco"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData((p) => ({ ...p, categoria: e.target.value }))}
                  placeholder="financiero"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData((p) => ({ ...p, codigo: e.target.value }))}
                  placeholder="BBVA"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contacto_nombre">Contacto</Label>
                <Input
                  id="contacto_nombre"
                  value={formData.contacto_nombre}
                  onChange={(e) => setFormData((p) => ({ ...p, contacto_nombre: e.target.value }))}
                  placeholder="Nombre del ejecutivo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contacto_puesto">Puesto</Label>
                <Input
                  id="contacto_puesto"
                  value={formData.contacto_puesto}
                  onChange={(e) => setFormData((p) => ({ ...p, contacto_puesto: e.target.value }))}
                  placeholder="Ej: Ejecutivo PyME"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData((p) => ({ ...p, telefono: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sitio_web">Sitio Web</Label>
              <Input
                id="sitio_web"
                value={formData.sitio_web}
                onChange={(e) => setFormData((p) => ({ ...p, sitio_web: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData((p) => ({ ...p, notas: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                  setEditingInstitucion(null);
                }}
              >
                Cancelar
              </Button>

              <Button
                onClick={handleSave}
                disabled={actualizarInstitucion.isPending || crearInstitucion.isPending}
              >
                {editingInstitucion ? "Guardar Cambios" : "Crear Institución"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedInstitucion} onOpenChange={() => setSelectedInstitucion(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={selectedInstitucion?.logo_url || undefined} />
                <AvatarFallback>
                  {selectedInstitucion?.nombre?.[0]
                    ? selectedInstitucion.nombre[0].toUpperCase()
                    : <Building2 className="h-6 w-6" />}
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
              <div className="grid grid-cols-2 gap-4">
                {(selectedInstitucion.contacto_nombre ||
                  selectedInstitucion.contactoNombre ||
                  selectedInstitucion.ejecutivo_nombre) && (
                  <div>
                    <Label className="text-muted-foreground">Contacto</Label>
                    <p className="font-medium">
                      {selectedInstitucion.contacto_nombre ||
                        selectedInstitucion.contactoNombre ||
                        selectedInstitucion.ejecutivo_nombre}
                    </p>
                    {(selectedInstitucion.contacto_puesto || selectedInstitucion.contactoPuesto) && (
                      <p className="text-sm text-muted-foreground">
                        {selectedInstitucion.contacto_puesto || selectedInstitucion.contactoPuesto}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground">Canales</Label>
                  {(selectedInstitucion.telefono || selectedInstitucion.telefono_principal) && (
                    <p className="text-sm">{selectedInstitucion.telefono || selectedInstitucion.telefono_principal}</p>
                  )}
                  {(selectedInstitucion.email || selectedInstitucion.email_principal) && (
                    <p className="text-sm text-primary">{selectedInstitucion.email || selectedInstitucion.email_principal}</p>
                  )}
                  {selectedInstitucion.sitio_web && (
                    <p className="text-sm">{selectedInstitucion.sitio_web}</p>
                  )}
                </div>
              </div>

              {selectedInstitucion.descripcion && (
                <div>
                  <Label className="text-muted-foreground">Descripción</Label>
                  <p className="text-sm whitespace-pre-wrap">{selectedInstitucion.descripcion}</p>
                </div>
              )}

              {selectedInstitucion.notas && (
                <div>
                  <Label className="text-muted-foreground">Notas</Label>
                  <p className="text-sm whitespace-pre-wrap">{selectedInstitucion.notas}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground mb-2 block">Financiamientos Asociados</Label>
                <div className="space-y-2">
                  {getFinanciamientosByInstitucion(selectedInstitucion.id).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay financiamientos asociados</p>
                  ) : (
                    getFinanciamientosByInstitucion(selectedInstitucion.id).map((f) => (
                      <Card key={f.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{f.nombre}</p>
                              <p className="text-sm text-muted-foreground">
                                {getFinTipoLabel(f)}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="font-medium">
                                ${getFinSaldo(f).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </p>
                              <Badge variant={getFinStatus(f) === "activo" ? "default" : "secondary"}>
                                {getFinStatus(f) || "sin estatus"}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}