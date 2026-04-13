import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  Edit,
  PieChart,
  Plus,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users2,
  Mail,
  Phone,
  BadgePercent,
  FileText,
  Sparkles,
} from "lucide-react";
import { useAccionistas } from "@/hooks/useAccionistas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AjustePorcentaje {
  id: string;
  nombre: string;
  porcentajeActual: number;
  porcentajeNuevo: number;
}

const MAX_ACTIVE_SHAREHOLDERS = 99;

export const FormularioAccionista = () => {
  const {
    accionistas,
    isLoading,
    crearAccionista,
    actualizarAccionista,
    eliminarAccionista,
    redistribuirAccionistas,
  } = useAccionistas();

  // Calcular porcentaje total asignado y disponible
  const porcentajeTotalAsignado = accionistas.reduce(
    (sum, a) => sum + (a.porcentaje_participacion || 0),
    0
  );
  const porcentajeDisponible = 100 - porcentajeTotalAsignado;

  const [modoEdicion, setModoEdicion] = useState(false);
  const [accionistaEditandoId, setAccionistaEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rfc, setRfc] = useState("");
  const accionistasActivos = accionistas.length;
  const limiteAccionistasAlcanzado =
    accionistasActivos >= MAX_ACTIVE_SHAREHOLDERS && !modoEdicion;
  const mayorParticipacion = accionistas.reduce(
    (max, a) => Math.max(max, a.porcentaje_participacion || 0),
    0
  );
  const accionistasConMayorParticipacion = new Set(
    accionistas
      .filter(
        (accionista) =>
          mayorParticipacion > 0 &&
          Math.abs((accionista.porcentaje_participacion || 0) - mayorParticipacion) < 0.01
      )
      .map((accionista) => accionista.id)
  );

  // Validar si el porcentaje excede el límite disponible
  const porcentajeNumerico = parseFloat(porcentaje) || 0;
  const excedeLimite = modoEdicion ? false : porcentajeNumerico > porcentajeDisponible;

  // Estados para el diálogo de dilución
  const [mostrarDialogoDilucion, setMostrarDialogoDilucion] = useState(false);
  const [nuevoAccionistaData, setNuevoAccionistaData] = useState<any>(null);
  const [ajustesPorcentajes, setAjustesPorcentajes] = useState<AjustePorcentaje[]>([]);

  const handleEditar = (accionista: any) => {
    setModoEdicion(true);
    setAccionistaEditandoId(accionista.id);
    setNombre(accionista.nombre);
    setPorcentaje(accionista.porcentaje_participacion?.toString() || "");
    setEmail(accionista.email || "");
    setTelefono(accionista.telefono || "");
    setRfc(accionista.rfc || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelarEdicion = () => {
    setModoEdicion(false);
    setAccionistaEditandoId(null);
    setNombre("");
    setPorcentaje("");
    setEmail("");
    setTelefono("");
    setRfc("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) return;

    if (limiteAccionistasAlcanzado) {
      toast({
        title: "Límite alcanzado",
        description: `No puedes registrar más de ${MAX_ACTIVE_SHAREHOLDERS} accionistas activos.`,
        variant: "destructive",
      });
      return;
    }

    const porcentajeNumerico = porcentaje ? parseFloat(porcentaje) : 0;

    // Validación: No permitir crear si excede el 100%
    if (!modoEdicion) {
      const nuevoTotal = porcentajeTotalAsignado + porcentajeNumerico;
      if (nuevoTotal > 100) {
        toast({
          title: "Error de validación",
          description: `El porcentaje excede el límite. Disponible: ${porcentajeDisponible.toFixed(
            2
          )}%`,
          variant: "destructive",
        });
        return;
      }
    }

    if (modoEdicion && accionistaEditandoId) {
      actualizarAccionista.mutate(
        {
          id: accionistaEditandoId,
          nombre: nombre.trim(),
          porcentaje_participacion: porcentaje ? parseFloat(porcentaje) : 0,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          rfc: rfc.trim() || undefined,
        },
        {
          onSuccess: () => {
            handleCancelarEdicion();
          },
        }
      );
    } else {
      // Si hay accionistas existentes y se especificó un porcentaje, mostrar diálogo de dilución
      if (accionistas.length > 0 && porcentaje && parseFloat(porcentaje) > 0) {
        const nuevoData = {
          nombre: nombre.trim(),
          porcentaje_participacion: parseFloat(porcentaje),
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          rfc: rfc.trim() || undefined,
          activo: true,
        };

        setNuevoAccionistaData(nuevoData);

        // Preparar ajustes iniciales (mantener porcentajes actuales)
        const ajustesIniciales = accionistas.map((a) => ({
          id: a.id,
          nombre: a.nombre,
          porcentajeActual: a.porcentaje_participacion,
          porcentajeNuevo: a.porcentaje_participacion,
        }));

        setAjustesPorcentajes(ajustesIniciales);
        setMostrarDialogoDilucion(true);
      } else {
        // Crear directamente si no hay accionistas o no tiene porcentaje
        crearAccionista.mutate(
          {
            nombre: nombre.trim(),
            porcentaje_participacion: porcentaje ? parseFloat(porcentaje) : 0,
            email: email.trim() || undefined,
            telefono: telefono.trim() || undefined,
            rfc: rfc.trim() || undefined,
          },
          {
            onSuccess: () => {
              setNombre("");
              setPorcentaje("");
              setEmail("");
              setTelefono("");
              setRfc("");
            },
          }
        );
      }
    }
  };

  const actualizarPorcentajeAjuste = (id: string, nuevoPorcentaje: number) => {
    setAjustesPorcentajes((prev) =>
      prev.map((ajuste) =>
        ajuste.id === id ? { ...ajuste, porcentajeNuevo: nuevoPorcentaje } : ajuste
      )
    );
  };

  const confirmarDilucion = async () => {
    // Calcular suma de porcentajes ajustados + nuevo accionista
    const sumaPorcentajes =
      ajustesPorcentajes.reduce((sum, a) => sum + a.porcentajeNuevo, 0) +
      (nuevoAccionistaData?.porcentaje_participacion || 0);

    // Validar que la suma sea EXACTAMENTE 100%
    if (Math.abs(sumaPorcentajes - 100) > 0.01) {
      toast({
        title: "Validación de participación",
        description: `La suma debe ser exactamente 100%. Actual: ${sumaPorcentajes.toFixed(2)}%`,
        variant: "destructive",
      });
      return;
    }

    // Crear el nuevo accionista
    redistribuirAccionistas.mutate(
      {
        nuevoAccionista: nuevoAccionistaData,
        ajustes: ajustesPorcentajes.map((ajuste) => ({
          id: ajuste.id,
          porcentaje_participacion: ajuste.porcentajeNuevo,
        })),
        require_exact_total: true,
      },
      {
        onSuccess: () => {
          // Limpiar formulario y cerrar diÃ¡logo

        setNombre("");
        setPorcentaje("");
        setEmail("");
        setTelefono("");
        setRfc("");
        setMostrarDialogoDilucion(false);
        setNuevoAccionistaData(null);
        setAjustesPorcentajes([]);
        },
      }
    );
  };

  const cancelarDilucion = () => {
    setMostrarDialogoDilucion(false);
    setNuevoAccionistaData(null);
    setAjustesPorcentajes([]);
  };

  const sumaPorcentajes =
    ajustesPorcentajes.reduce((sum, a) => sum + a.porcentajeNuevo, 0) +
    (nuevoAccionistaData?.porcentaje_participacion || 0);
  const esSumaValida = Math.abs(sumaPorcentajes - 100) < 0.01;

  return (
    <>
      {/* Diálogo de Dilución de Acciones */}
      <Dialog open={mostrarDialogoDilucion} onOpenChange={setMostrarDialogoDilucion}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto rounded-[28px] border border-border/60 p-0 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)]">
          <div className="border-b border-border/50 bg-gradient-to-br from-background via-background to-muted/30 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-2.5">
                  <ShieldAlert className="h-5 w-5 text-amber-600" />
                </div>
                Dilución de Acciones
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-3xl text-sm leading-6">
                Estás a punto de registrar un nuevo accionista con participación accionaria.
                Ajusta los porcentajes para redistribuir la estructura societaria y asegurar
                que la suma total final sea exactamente 100%.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-6 px-6 py-6">
            {/* Nuevo Accionista */}
            <div className="rounded-[22px] border border-emerald-500/25 bg-emerald-500/[0.05] p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-500/15 p-2.5">
                  <UserPlus className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Nuevo Accionista Entrante</p>
                  <p className="text-sm text-muted-foreground">
                    Participación que ingresará a la estructura actual.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold">{nuevoAccionistaData?.nombre}</p>
                  <p className="text-sm text-muted-foreground">
                    {nuevoAccionistaData?.email || "Sin email registrado"}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-background/80 px-5 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Participación
                  </p>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                    {nuevoAccionistaData?.porcentaje_participacion}%
                  </p>
                </div>
              </div>
            </div>

            {/* Accionistas Existentes */}
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl border border-primary/15 bg-primary/8 p-2.5">
                  <Users2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Accionistas Actuales</p>
                  <p className="text-sm text-muted-foreground">
                    Ajusta los porcentajes para reflejar la nueva distribución.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {ajustesPorcentajes.map((ajuste) => (
                  <div
                    key={ajuste.id}
                    className="rounded-2xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">{ajuste.nombre}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Participación actual: {ajuste.porcentajeActual}%
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Label htmlFor={`porcentaje-${ajuste.id}`} className="text-sm whitespace-nowrap">
                          Nuevo porcentaje
                        </Label>
                        <Input
                          id={`porcentaje-${ajuste.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={ajuste.porcentajeNuevo}
                          onChange={(e) =>
                            actualizarPorcentajeAjuste(
                              ajuste.id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-28 rounded-xl border-border/60 bg-background text-right"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Validación de Suma */}
            <Alert
              variant={esSumaValida ? "default" : "destructive"}
              className={cn(
                "rounded-2xl border",
                esSumaValida
                  ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                  : "border-destructive/20 bg-destructive/[0.04]"
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{esSumaValida ? "Distribución válida" : "Distribución incorrecta"}</AlertTitle>
              <AlertDescription>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-background/70 px-4 py-3">
                  <span className="text-sm text-muted-foreground">Suma total</span>
                  <span
                    className={cn(
                      "text-2xl font-bold",
                      esSumaValida ? "text-emerald-600" : "text-destructive"
                    )}
                  >
                    {sumaPorcentajes.toFixed(2)}%
                  </span>
                </div>

                {esSumaValida ? (
                  <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
                    La redistribución está lista para aplicarse.
                  </p>
                ) : (
                  <p className="mt-3 text-sm">
                    La suma debe ser exactamente 100% y actualmente{" "}
                    {sumaPorcentajes > 100 ? "excede" : "falta"}{" "}
                    {Math.abs(100 - sumaPorcentajes).toFixed(2)}%.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="border-t border-border/50 px-6 py-5">
            <Button variant="outline" onClick={cancelarDilucion} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={confirmarDilucion}
              disabled={!esSumaValida}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Confirmar Dilución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* Tarjeta de Estado de Participación Societaria */}
        <Card className="overflow-hidden rounded-[26px] border border-border/60 bg-background shadow-[0_20px_60px_-35px_rgba(0,0,0,0.35)]">
          <CardHeader className="border-b border-border/50 bg-gradient-to-br from-background via-background to-muted/25">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="rounded-2xl border border-primary/15 bg-primary/8 p-3">
                <PieChart className="h-5 w-5 text-primary" />
              </div>
              Estado de Participación Societaria
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] p-5 text-center">
                <p className="mb-1 text-sm text-muted-foreground">Total asignado</p>
                <p className="text-3xl font-bold text-sky-600">
                  {porcentajeTotalAsignado.toFixed(2)}%
                </p>
              </div>

              <div
                className={cn(
                  "rounded-2xl border p-5 text-center",
                  porcentajeDisponible === 0
                    ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                    : "border-amber-500/20 bg-amber-500/[0.05]"
                )}
              >
                <p className="mb-1 text-sm text-muted-foreground">Disponible</p>
                <p
                  className={cn(
                    "text-3xl font-bold",
                    porcentajeDisponible === 0 ? "text-emerald-600" : "text-amber-600"
                  )}
                >
                  {porcentajeDisponible.toFixed(2)}%
                </p>
              </div>

              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-5 text-center">
                <p className="mb-1 text-sm text-muted-foreground">Accionistas</p>
                <p className="text-3xl font-bold text-violet-600">
                  {accionistasActivos}/{MAX_ACTIVE_SHAREHOLDERS}
                </p>
              </div>
            </div>

            {limiteAccionistasAlcanzado && (
              <Alert
                variant="destructive"
                className="mt-5 rounded-2xl border border-destructive/20"
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Límite de accionistas alcanzado</AlertTitle>
                <AlertDescription>
                  Ya existen {MAX_ACTIVE_SHAREHOLDERS} accionistas activos. Para registrar uno
                  nuevo primero debes dar de baja o redistribuir la estructura actual.
                </AlertDescription>
              </Alert>
            )}

            {porcentajeDisponible !== 0 && (
              <Alert
                className={cn(
                  "mt-5 rounded-2xl border",
                  porcentajeDisponible > 0
                    ? "border-amber-500/20 bg-amber-500/[0.05]"
                    : "border-destructive/20 bg-destructive/[0.04]"
                )}
                variant={porcentajeDisponible > 0 ? "default" : "destructive"}
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {porcentajeDisponible > 0
                    ? "Participación pendiente por asignar"
                    : "Participación excedida"}
                </AlertTitle>
                <AlertDescription>
                  {porcentajeDisponible > 0
                    ? `Faltan ${porcentajeDisponible.toFixed(2)}% por distribuir entre accionistas.`
                    : `Se ha excedido el límite en ${Math.abs(porcentajeDisponible).toFixed(2)}%.`}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Formulario */}
        <Card className="overflow-hidden rounded-[26px] border border-border/60 bg-background shadow-[0_20px_60px_-35px_rgba(0,0,0,0.35)]">
          <CardHeader className="border-b border-border/50 bg-gradient-to-br from-background via-background to-muted/25">
            <CardTitle className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xl">
                <div className="rounded-2xl border border-primary/15 bg-primary/8 p-3">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p>{modoEdicion ? "Editar Accionista" : "Registrar Nuevo Accionista"}</p>
                  <p className="mt-1 text-sm font-normal text-muted-foreground">
                    Captura y administra la estructura accionaria con un flujo claro y profesional.
                  </p>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">
                    Accionistas activos: {accionistasActivos}/{MAX_ACTIVE_SHAREHOLDERS}
                  </p>
                </div>
              </div>

              {modoEdicion && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelarEdicion}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Accionista *</Label>
                <Input
                  id="nombre"
                  placeholder="Nombre completo"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  className="h-11 rounded-xl border-border/60 bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="porcentaje" className="flex flex-wrap items-center gap-2">
                  <span>% de Participación</span>
                  {!modoEdicion && (
                    <span className="text-xs font-normal text-muted-foreground">
                      Disponible: {porcentajeDisponible.toFixed(2)}%
                    </span>
                  )}
                </Label>

                <div className="flex flex-col gap-2 md:flex-row">
                  <Input
                    id="porcentaje"
                    type="number"
                    step="0.01"
                    min="0"
                    max={modoEdicion ? 100 : porcentajeDisponible}
                    placeholder={modoEdicion ? "0.00" : porcentajeDisponible.toFixed(2)}
                    value={porcentaje}
                    onChange={(e) => setPorcentaje(e.target.value)}
                    className={cn(
                      "h-11 flex-1 rounded-xl border-border/60 bg-background",
                      excedeLimite && "border-destructive"
                    )}
                  />

                  {!modoEdicion && porcentajeDisponible > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPorcentaje(porcentajeDisponible.toFixed(2))}
                      className="h-11 rounded-xl"
                    >
                      <BadgePercent className="mr-2 h-4 w-4" />
                      Asignar todo
                    </Button>
                  )}
                </div>

                {excedeLimite && (
                  <p className="text-xs text-destructive">
                    El porcentaje excede el disponible ({porcentajeDisponible.toFixed(2)}%)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 rounded-xl border-border/60 bg-background pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="telefono"
                      placeholder="(555) 123-4567"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="h-11 rounded-xl border-border/60 bg-background pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rfc">RFC</Label>
                <div className="relative">
                  <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="rfc"
                    placeholder="ABCD123456XYZ"
                    value={rfc}
                    onChange={(e) => setRfc(e.target.value.toUpperCase())}
                    maxLength={13}
                    className="h-11 rounded-xl border-border/60 bg-background pl-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={limiteAccionistasAlcanzado}
                className="h-12 w-full rounded-xl font-semibold"
              >
                <Plus className="mr-2 h-4 w-4" />
                {modoEdicion
                  ? "Actualizar Accionista"
                  : limiteAccionistasAlcanzado
                  ? "Límite alcanzado"
                  : "Registrar Accionista"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista de accionistas */}
        <Card className="overflow-hidden rounded-[26px] border border-border/60 bg-background shadow-[0_20px_60px_-35px_rgba(0,0,0,0.35)]">
          <CardHeader className="border-b border-border/50 bg-gradient-to-br from-background via-background to-muted/25">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="rounded-2xl border border-primary/15 bg-primary/8 p-3">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              Accionistas Registrados
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            {isLoading ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-10 text-center">
                <p className="text-muted-foreground">Cargando accionistas...</p>
              </div>
            ) : accionistas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-10 text-center">
                <p className="text-muted-foreground">
                  No hay accionistas registrados. Registra al menos uno para poder hacer
                  transacciones.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {accionistas.map((accionista) => (
                  <div
                    key={accionista.id}
                    className="rounded-2xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-base font-semibold">{accionista.nombre}</p>
                            {accionistasConMayorParticipacion.has(accionista.id) && (
                              <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                                Mayor participacion actual
                              </p>
                            )}
                          </div>

                          {accionista.porcentaje_participacion > 0 && (
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-sm font-medium text-primary">
                              <BadgePercent className="h-3.5 w-3.5" />
                              {accionista.porcentaje_participacion}% participación
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:flex-wrap md:gap-4">
                          {accionista.email && (
                            <span className="inline-flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5" />
                              {accionista.email}
                            </span>
                          )}
                          {accionista.telefono && (
                            <span className="inline-flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5" />
                              {accionista.telefono}
                            </span>
                          )}
                          {accionista.rfc && (
                            <span className="inline-flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5" />
                              {accionista.rfc}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end lg:self-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditar(accionista)}
                          className="rounded-xl"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => eliminarAccionista.mutate(accionista.id)}
                          className="rounded-xl"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Mostrar "Sin socio asignado" si hay porcentaje disponible */}
                {porcentajeDisponible > 0 && (
                  <div className="rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/[0.05] p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-amber-700 dark:text-amber-400">
                          Participación sin socio asignado
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Este porcentaje permanece disponible para futura asignación.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-amber-500/20 bg-background/80 px-5 py-3 text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Disponible
                        </p>
                        <p className="text-3xl font-bold text-amber-600">
                          {porcentajeDisponible.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};
