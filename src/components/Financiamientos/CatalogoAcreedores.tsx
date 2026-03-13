import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Edit,
  Trash2,
  Plus,
  Search,
  User,
  Phone,
  Mail,
  Globe,
  Landmark,
  BadgeDollarSign,
  Activity,
  Percent,
  ChevronRight,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useInstitucionesFinancieras,
  InstitucionFinanciera,
} from "@/hooks/useInstitucionesFinancieras";
import { useToast } from "@/hooks/use-toast";

const FINANCIAMIENTOS_ENDPOINT = "/api/financiamientos";

type Financiamiento = {
  id: string;
  _id?: string;
  nombre: string;
  tipo?: string;
  tipo_credito?: string;
  tipo_ui?: string;
  tipoUi?: string;
  estatus?: string;
  estado?: string;
  estado_ui?: string;
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
  monto_total_vista?: number;
  montoTotalVista?: number;
  saldo_total_actual?: number;
  saldoTotalActual?: number;
  saldo_capital_actual?: number;
  saldoCapitalActual?: number;
  saldo_actual?: number;
  saldo_actual_vista?: number;
  saldoActualVista?: number;
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

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const asText = (v: unknown, fallback = "") => {
  if (v === undefined || v === null) return fallback;
  return String(v).trim();
};

const firstFinite = (...values: unknown[]) => {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

const money = (value: number) =>
  `$${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getFinStatus = (f: Financiamiento) =>
  String(f.estado_ui || f.estatus || f.estado || "").toLowerCase();

const getFinTipo = (f: Financiamiento) => {
  const raw = String(f.tipo_ui || f.tipoUi || f.tipo || f.tipo_credito || "").toLowerCase();
  if (["tarjeta_credito", "tarjeta_corporativa", "tarjeta"].includes(raw)) return "tarjeta_corporativa";
  if (["linea_credito", "revolvente", "linea de credito"].includes(raw)) return "revolvente";
  if (["credito_simple", "simple", "prestamo"].includes(raw)) return "simple";
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
    return (
      firstFinite(
        f.linea_credito,
        f.lineaCredito,
        f.monto_total_vista,
        f.montoTotalVista,
        f.monto_total
      ) ?? 0
    );
  }

  return (
    firstFinite(
      f.monto_original,
      f.montoOriginal,
      f.monto_total_vista,
      f.montoTotalVista,
      f.monto_total
    ) ?? 0
  );
};

const getFinSaldo = (f: Financiamiento) =>
  firstFinite(
    f.saldo_total_actual,
    f.saldoTotalActual,
    f.saldo_capital_actual,
    f.saldoCapitalActual,
    f.saldo_actual_vista,
    f.saldoActualVista,
    f.saldo_actual
  ) ?? 0;

const getFinTasa = (f: Financiamiento) =>
  firstFinite(f.tasa_interes_anual, f.tasaInteresAnual, f.tasa_interes) ?? 0;

const getInstitucionMeta = (inst: InstitucionFinanciera) =>
  [inst.alias, inst.codigo, inst.tipo].filter(Boolean).join(" • ");

const KpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accentClass = "text-slate-900",
  iconWrapClass = "bg-slate-100",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  accentClass?: string;
  iconWrapClass?: string;
}) => (
  <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-5">
      <div className="space-y-1">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        <div className={`text-3xl font-semibold tracking-tight ${accentClass}`}>{value}</div>
        <CardDescription className="text-xs">{subtitle}</CardDescription>
      </div>
      <div className={`rounded-xl p-3 ${iconWrapClass}`}>
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
    </CardHeader>
  </Card>
);

const SectionTitle = ({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
}) => (
  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
    <div className="min-w-0">
      <h3 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h3>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
    {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
    {text}
  </div>
);

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
      const json = await apiFetch(FINANCIAMIENTOS_ENDPOINT, { method: "GET" });
      const raw = (json as any)?.data ?? json;
      return Array.isArray(raw) ? (raw as Financiamiento[]) : [];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const institucionesActivas = instituciones.length;

  const financiamientosActivos = useMemo(
    () => financiamientos.filter((f) => getFinStatus(f) === "activo"),
    [financiamientos]
  );

  const creditosActivos = financiamientosActivos.length;

  const montoTotalFinanciado = useMemo(
    () => financiamientos.reduce((acc, f) => acc + getFinMontoBase(f), 0),
    [financiamientos]
  );

  const tasaPromedio = useMemo(() => {
    if (financiamientos.length === 0) return 0;
    return financiamientos.reduce((acc, f) => acc + getFinTasa(f), 0) / financiamientos.length;
  }, [financiamientos]);

  const institucionesFiltradas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return instituciones;

    return instituciones.filter((inst) => {
      const haystack = [
        inst.nombre,
        inst.alias,
        inst.codigo,
        inst.contacto_nombre,
        inst.contactoNombre,
        inst.ejecutivo_nombre,
        inst.telefono,
        inst.telefono_principal,
        inst.email,
        inst.email_principal,
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
          title: "Falta el nombre",
          description: "El nombre de la institución es obligatorio.",
          variant: "destructive",
        });
        return;
      }

      const payload = {
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
      };

      if (editingInstitucion) {
        await actualizarInstitucion.mutateAsync({
          id: editingInstitucion.id,
          ...payload,
        });
      } else {
        await crearInstitucion.mutateAsync(payload);
      }

      setShowDialog(false);
      resetForm();
      setEditingInstitucion(null);
    } catch (error: any) {
      toast({
        title: "Error al guardar",
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

  const selectedInstitucionFinanciamientos = selectedInstitucion
    ? getFinanciamientosByInstitucion(selectedInstitucion.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle
          title="Catálogo de Acreedores Financieros"
          description="Gestiona instituciones financieras, contactos clave y la relación de créditos asociados desde una sola vista."
          right={
            <Button
              onClick={() => handleOpenDialog()}
              className="rounded-xl bg-[#0b4a8b] hover:bg-[#083866]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva Institución
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Instituciones activas"
          value={String(institucionesActivas)}
          subtitle="Acreedores registrados"
          icon={Landmark}
          accentClass="text-slate-900"
          iconWrapClass="bg-sky-50"
        />

        <KpiCard
          title="Créditos activos"
          value={String(creditosActivos)}
          subtitle="Instrumentos vigentes"
          icon={Activity}
          accentClass="text-slate-900"
          iconWrapClass="bg-slate-100"
        />

        <KpiCard
          title="Monto total financiado"
          value={money(montoTotalFinanciado)}
          subtitle="Capital o línea registrada"
          icon={BadgeDollarSign}
          accentClass="text-[#0b4a8b]"
          iconWrapClass="bg-blue-50"
        />

        <KpiCard
          title="Tasa promedio"
          value={`${tasaPromedio.toFixed(2)}%`}
          subtitle="Promedio del portafolio"
          icon={Percent}
          accentClass="text-emerald-600"
          iconWrapClass="bg-emerald-50"
        />
      </div>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-4">
          <SectionTitle
            title="Listado de instituciones"
            description="Consulta, busca y administra acreedores financieros vinculados a tus financiamientos."
            right={
              <div className="relative w-full min-w-[260px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar institución, alias, código o contacto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-xl border-slate-200 pl-10"
                />
              </div>
            }
          />
        </CardHeader>

        <CardContent>
          {isLoadingFin ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : institucionesFiltradas.length === 0 ? (
            <EmptyState text="No se encontraron instituciones con ese criterio." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="h-12">Institución</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Canales</TableHead>
                    <TableHead className="text-center">Créditos Activos</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {institucionesFiltradas.map((institucion) => {
                    const creditosCount = getCreditosCount(institucion.id);
                    const meta = getInstitucionMeta(institucion);

                    return (
                      <TableRow
                        key={institucion.id}
                        className="cursor-pointer transition hover:bg-slate-50/70"
                        onClick={() => setSelectedInstitucion(institucion)}
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-11 w-11 rounded-xl border bg-white">
                              <AvatarImage src={institucion.logo_url || undefined} />
                              <AvatarFallback className="rounded-xl bg-slate-100 text-slate-700">
                                {institucion.nombre?.[0] ? (
                                  institucion.nombre[0].toUpperCase()
                                ) : (
                                  <Building2 className="h-5 w-5" />
                                )}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900">{institucion.nombre}</p>
                              <p className="truncate text-xs text-slate-500">
                                {meta || "Sin metadata"}
                              </p>
                              {institucion.sitio_web && (
                                <a
                                  href={institucion.sitio_web}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 text-xs text-[#0b4a8b] hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Globe className="h-3 w-3" />
                                  Sitio web
                                </a>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          {institucion.contacto_nombre ||
                          institucion.contactoNombre ||
                          institucion.ejecutivo_nombre ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm text-slate-800">
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                <span>
                                  {institucion.contacto_nombre ||
                                    institucion.contactoNombre ||
                                    institucion.ejecutivo_nombre}
                                </span>
                              </div>

                              {(institucion.contacto_puesto || institucion.contactoPuesto) && (
                                <div className="text-xs text-slate-500">
                                  {institucion.contacto_puesto || institucion.contactoPuesto}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">Sin asignar</span>
                          )}
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="space-y-1">
                            {(institucion.telefono || institucion.telefono_principal) && (
                              <div className="flex items-center gap-2 text-xs text-slate-700">
                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                <span>{institucion.telefono || institucion.telefono_principal}</span>
                              </div>
                            )}
                            {(institucion.email || institucion.email_principal) && (
                              <div className="flex items-center gap-2 text-xs text-slate-700">
                                <Mail className="h-3.5 w-3.5 text-slate-400" />
                                <span>{institucion.email || institucion.email_principal}</span>
                              </div>
                            )}
                            {!(institucion.telefono || institucion.telefono_principal || institucion.email || institucion.email_principal) && (
                              <span className="text-sm text-slate-400">Sin canales</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-4 text-center">
                          <Badge
                            variant={creditosCount > 0 ? "default" : "outline"}
                            className={creditosCount > 0 ? "bg-[#0b4a8b] hover:bg-[#0b4a8b]" : ""}
                          >
                            {creditosCount}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-xl"
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
                              className="rounded-xl text-rose-600 hover:text-rose-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                eliminarInstitucion.mutate(institucion.id);
                              }}
                              disabled={creditosCount > 0}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>

                            <ChevronRight className="ml-1 h-4 w-4 text-slate-300" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingInstitucion ? "Editar Institución" : "Nueva Institución"}
            </DialogTitle>
            <DialogDescription>
              {editingInstitucion
                ? "Actualiza la información operativa y comercial del acreedor."
                : "Registra una nueva institución financiera para vincularla a créditos y líneas."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre de la institución *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: BBVA"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alias">Alias</Label>
                <Input
                  id="alias"
                  value={formData.alias}
                  onChange={(e) => setFormData((p) => ({ ...p, alias: e.target.value }))}
                  placeholder="Ej: BBVA Empresas"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Input
                  id="tipo"
                  value={formData.tipo}
                  onChange={(e) => setFormData((p) => ({ ...p, tipo: e.target.value }))}
                  placeholder="banco"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData((p) => ({ ...p, categoria: e.target.value }))}
                  placeholder="financiero"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData((p) => ({ ...p, codigo: e.target.value }))}
                  placeholder="BBVA"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))}
                rows={3}
                className="rounded-xl"
                placeholder="Descripción interna del acreedor, convenios, enfoque comercial, etc."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contacto_nombre">Contacto principal</Label>
                <Input
                  id="contacto_nombre"
                  value={formData.contacto_nombre}
                  onChange={(e) => setFormData((p) => ({ ...p, contacto_nombre: e.target.value }))}
                  placeholder="Nombre del ejecutivo"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contacto_puesto">Puesto</Label>
                <Input
                  id="contacto_puesto"
                  value={formData.contacto_puesto}
                  onChange={(e) => setFormData((p) => ({ ...p, contacto_puesto: e.target.value }))}
                  placeholder="Ej: Ejecutivo PyME"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData((p) => ({ ...p, telefono: e.target.value }))}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sitio_web">Sitio web</Label>
              <Input
                id="sitio_web"
                value={formData.sitio_web}
                onChange={(e) => setFormData((p) => ({ ...p, sitio_web: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas internas</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData((p) => ({ ...p, notas: e.target.value }))}
                rows={4}
                className="rounded-xl"
                placeholder="Condiciones preferenciales, observaciones, proceso de atención, etc."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                  setEditingInstitucion(null);
                }}
              >
                Cancelar
              </Button>

              <Button
                className="rounded-xl bg-[#0b4a8b] hover:bg-[#083866]"
                onClick={handleSave}
                disabled={actualizarInstitucion.isPending || crearInstitucion.isPending}
              >
                {editingInstitucion ? "Guardar cambios" : "Crear institución"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedInstitucion} onOpenChange={() => setSelectedInstitucion(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 rounded-2xl border bg-white">
                <AvatarImage src={selectedInstitucion?.logo_url || undefined} />
                <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-700">
                  {selectedInstitucion?.nombre?.[0] ? (
                    selectedInstitucion.nombre[0].toUpperCase()
                  ) : (
                    <Building2 className="h-6 w-6" />
                  )}
                </AvatarFallback>
              </Avatar>

              <div>
                <DialogTitle className="text-xl">{selectedInstitucion?.nombre}</DialogTitle>
                <DialogDescription>
                  Vista detallada del acreedor financiero y sus instrumentos asociados.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedInstitucion && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="rounded-2xl border border-slate-200 shadow-none">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Contacto</p>
                    <div className="mt-3 space-y-1">
                      <p className="font-medium text-slate-900">
                        {selectedInstitucion.contacto_nombre ||
                          selectedInstitucion.contactoNombre ||
                          selectedInstitucion.ejecutivo_nombre ||
                          "Sin asignar"}
                      </p>
                      <p className="text-sm text-slate-500">
                        {selectedInstitucion.contacto_puesto ||
                          selectedInstitucion.contactoPuesto ||
                          "Sin puesto asignado"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-slate-200 shadow-none">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Canales</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-slate-900">
                        {selectedInstitucion.telefono || selectedInstitucion.telefono_principal || "Sin teléfono"}
                      </p>
                      <p className="text-slate-900">
                        {selectedInstitucion.email || selectedInstitucion.email_principal || "Sin correo"}
                      </p>
                      <p className="text-slate-500">
                        {selectedInstitucion.sitio_web || "Sin sitio web"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-slate-200 shadow-none">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Créditos asociados</p>
                    <div className="mt-3 space-y-1">
                      <p className="text-3xl font-semibold text-slate-900">
                        {selectedInstitucionFinanciamientos.length}
                      </p>
                      <p className="text-sm text-slate-500">
                        {selectedInstitucionFinanciamientos.filter((f) => getFinStatus(f) === "activo").length} activos
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedInstitucion.descripcion && (
                <Card className="rounded-2xl border border-slate-200 shadow-none">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Descripción</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                      {selectedInstitucion.descripcion}
                    </p>
                  </CardContent>
                </Card>
              )}

              {selectedInstitucion.notas && (
                <Card className="rounded-2xl border border-slate-200 shadow-none">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Notas</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                      {selectedInstitucion.notas}
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className="rounded-2xl border border-slate-200 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Financiamientos asociados</CardTitle>
                  <CardDescription>
                    Créditos, líneas y tarjetas vinculadas a esta institución.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {selectedInstitucionFinanciamientos.length === 0 ? (
                    <EmptyState text="No hay financiamientos asociados a esta institución." />
                  ) : (
                    <div className="space-y-3">
                      {selectedInstitucionFinanciamientos.map((f) => (
                        <div
                          key={f.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-medium text-slate-900">{f.nombre}</p>
                              <p className="text-sm text-slate-500">{getFinTipoLabel(f)}</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 md:justify-end">
                              <div className="text-right">
                                <p className="text-xs text-slate-500">Saldo / deuda</p>
                                <p className="font-semibold text-slate-900">{money(getFinSaldo(f))}</p>
                              </div>

                              <Badge
                                variant={getFinStatus(f) === "activo" ? "default" : "secondary"}
                                className={getFinStatus(f) === "activo" ? "bg-[#0b4a8b] hover:bg-[#0b4a8b]" : ""}
                              >
                                {getFinStatus(f) || "sin estatus"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}