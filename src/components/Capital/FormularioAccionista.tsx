import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, UserPlus, Trash2, Edit, AlertTriangle } from "lucide-react";
import { useAccionistas, Accionista } from "@/hooks/useAccionistas";
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

export const FormularioAccionista = () => {
  const { accionistas, isLoading, crearAccionista, actualizarAccionista, eliminarAccionista } = useAccionistas();
  
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
  
  // Validar si el porcentaje excede el límite disponible
  const porcentajeNumerico = parseFloat(porcentaje) || 0;
  const excedeLimite = modoEdicion 
    ? false 
    : porcentajeNumerico > porcentajeDisponible;

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    const porcentajeNumerico = porcentaje ? parseFloat(porcentaje) : 0;
    
    // Validación: No permitir crear si excede el 100%
    if (!modoEdicion) {
      const nuevoTotal = porcentajeTotalAsignado + porcentajeNumerico;
      if (nuevoTotal > 100) {
        toast({
          title: "Error de validación",
          description: `El porcentaje excede el límite. Disponible: ${porcentajeDisponible.toFixed(2)}%`,
          variant: "destructive",
        });
        return;
      }
    }

    if (modoEdicion && accionistaEditandoId) {
      actualizarAccionista.mutate({
        id: accionistaEditandoId,
        nombre: nombre.trim(),
        porcentaje_participacion: porcentaje ? parseFloat(porcentaje) : 0,
        email: email.trim() || undefined,
        telefono: telefono.trim() || undefined,
        rfc: rfc.trim() || undefined,
      }, {
        onSuccess: () => {
          handleCancelarEdicion();
        }
      });
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
        const ajustesIniciales = accionistas.map(a => ({
          id: a.id,
          nombre: a.nombre,
          porcentajeActual: a.porcentaje_participacion,
          porcentajeNuevo: a.porcentaje_participacion,
        }));
        
        setAjustesPorcentajes(ajustesIniciales);
        setMostrarDialogoDilucion(true);
      } else {
        // Crear directamente si no hay accionistas o no tiene porcentaje
        crearAccionista.mutate({
          nombre: nombre.trim(),
          porcentaje_participacion: porcentaje ? parseFloat(porcentaje) : 0,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          rfc: rfc.trim() || undefined,
          activo: true,
        }, {
          onSuccess: () => {
            setNombre("");
            setPorcentaje("");
            setEmail("");
            setTelefono("");
            setRfc("");
          }
        });
      }
    }
  };

  const actualizarPorcentajeAjuste = (id: string, nuevoPorcentaje: number) => {
    setAjustesPorcentajes(prev => 
      prev.map(ajuste => 
        ajuste.id === id 
          ? { ...ajuste, porcentajeNuevo: nuevoPorcentaje }
          : ajuste
      )
    );
  };

  const confirmarDilucion = async () => {
    // Calcular suma de porcentajes ajustados + nuevo accionista
    const sumaPorcentajes = ajustesPorcentajes.reduce((sum, a) => sum + a.porcentajeNuevo, 0) + 
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
    crearAccionista.mutate(nuevoAccionistaData, {
      onSuccess: () => {
        // Actualizar porcentajes de accionistas existentes
        ajustesPorcentajes.forEach(ajuste => {
          if (ajuste.porcentajeNuevo !== ajuste.porcentajeActual) {
            actualizarAccionista.mutate({
              id: ajuste.id,
              porcentaje_participacion: ajuste.porcentajeNuevo,
            });
          }
        });

        // Limpiar formulario y cerrar diálogo
        setNombre("");
        setPorcentaje("");
        setEmail("");
        setTelefono("");
        setRfc("");
        setMostrarDialogoDilucion(false);
        setNuevoAccionistaData(null);
        setAjustesPorcentajes([]);
      }
    });
  };

  const cancelarDilucion = () => {
    setMostrarDialogoDilucion(false);
    setNuevoAccionistaData(null);
    setAjustesPorcentajes([]);
  };

  const sumaPorcentajes = ajustesPorcentajes.reduce((sum, a) => sum + a.porcentajeNuevo, 0) + 
                          (nuevoAccionistaData?.porcentaje_participacion || 0);
  const esSumaValida = Math.abs(sumaPorcentajes - 100) < 0.01;

  return (
    <>
      {/* Diálogo de Dilución de Acciones */}
      <Dialog open={mostrarDialogoDilucion} onOpenChange={setMostrarDialogoDilucion}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Dilución de Acciones - Nuevo Accionista
            </DialogTitle>
            <DialogDescription>
              Estás a punto de registrar un nuevo accionista con participación accionaria. 
              Esto implica una redistribución de porcentajes entre todos los accionistas.
              Ajusta los porcentajes para que la suma total sea 100%.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nuevo Accionista */}
            <div className="p-4 border-2 border-green-500 rounded-lg bg-green-50 dark:bg-green-950/20">
              <p className="font-semibold text-lg mb-2">Nuevo Accionista (Entrante)</p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{nuevoAccionistaData?.nombre}</p>
                  <p className="text-sm text-muted-foreground">
                    {nuevoAccionistaData?.email || "Sin email"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">
                    {nuevoAccionistaData?.porcentaje_participacion}%
                  </p>
                  <p className="text-xs text-muted-foreground">Participación</p>
                </div>
              </div>
            </div>

            {/* Accionistas Existentes */}
            <div>
              <p className="font-semibold text-lg mb-3">Accionistas Actuales - Ajustar Porcentajes</p>
              <div className="space-y-3">
                {ajustesPorcentajes.map((ajuste) => (
                  <div key={ajuste.id} className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex-1">
                        <p className="font-medium">{ajuste.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          Actual: {ajuste.porcentajeActual}%
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`porcentaje-${ajuste.id}`} className="text-sm">
                          Nuevo %:
                        </Label>
                        <Input
                          id={`porcentaje-${ajuste.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={ajuste.porcentajeNuevo}
                          onChange={(e) => actualizarPorcentajeAjuste(ajuste.id, parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Validación de Suma */}
            <Alert variant={esSumaValida ? "default" : "destructive"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {esSumaValida ? "✓ Suma correcta" : "⚠ Suma incorrecta"}
              </AlertTitle>
              <AlertDescription>
                <div className="flex justify-between items-center mt-2">
                  <span>Total:</span>
                  <span className={`text-xl font-bold ${esSumaValida ? 'text-green-600' : 'text-red-600'}`}>
                    {sumaPorcentajes.toFixed(2)}%
                  </span>
                </div>
                {esSumaValida ? (
                  <p className="text-sm mt-2 text-green-600">
                    ✓ La distribución es válida
                  </p>
                ) : (
                  <p className="text-sm mt-2">
                    ⚠️ Debe ser exactamente 100% ({sumaPorcentajes > 100 ? 'excede' : 'falta'} {Math.abs(100 - sumaPorcentajes).toFixed(2)}%)
                  </p>
                )}
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cancelarDilucion}>
              Cancelar
            </Button>
            <Button 
              onClick={confirmarDilucion}
              disabled={!esSumaValida}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Confirmar Dilución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* Tarjeta de Estado de Participación Societaria */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-lg">Estado de Participación Societaria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <p className="text-sm text-muted-foreground mb-1">Total Asignado</p>
                <p className="text-2xl font-bold text-blue-600">
                  {porcentajeTotalAsignado.toFixed(2)}%
                </p>
              </div>
              
              <div className={cn(
                "text-center p-4 border rounded-lg",
                porcentajeDisponible === 0 
                  ? "bg-green-50 dark:bg-green-950/20" 
                  : "bg-orange-50 dark:bg-orange-950/20"
              )}>
                <p className="text-sm text-muted-foreground mb-1">Disponible</p>
                <p className={cn(
                  "text-2xl font-bold",
                  porcentajeDisponible === 0 ? "text-green-600" : "text-orange-600"
                )}>
                  {porcentajeDisponible.toFixed(2)}%
                </p>
              </div>
              
              <div className="text-center p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/20">
                <p className="text-sm text-muted-foreground mb-1">Accionistas</p>
                <p className="text-2xl font-bold text-purple-600">
                  {accionistas.length}
                </p>
              </div>
            </div>
            
            {porcentajeDisponible !== 0 && (
              <Alert className="mt-4" variant={porcentajeDisponible > 0 ? "default" : "destructive"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {porcentajeDisponible > 0 
                    ? "Participación incompleta" 
                    : "Participación excedida"}
                </AlertTitle>
                <AlertDescription>
                  {porcentajeDisponible > 0 
                    ? `Faltan ${porcentajeDisponible.toFixed(2)}% por asignar a accionistas` 
                    : `Se ha excedido el límite en ${Math.abs(porcentajeDisponible).toFixed(2)}%`}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {modoEdicion ? "Editar Accionista" : "Registrar Nuevo Accionista"}
            </div>
            {modoEdicion && (
              <Button variant="ghost" size="sm" onClick={handleCancelarEdicion}>
                Cancelar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Accionista *</Label>
              <Input
                id="nombre"
                placeholder="Nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="porcentaje">
                % de Participación
                {!modoEdicion && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (Disponible: {porcentajeDisponible.toFixed(2)}%)
                  </span>
                )}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="porcentaje"
                  type="number"
                  step="0.01"
                  min="0"
                  max={modoEdicion ? 100 : porcentajeDisponible}
                  placeholder={modoEdicion ? "0.00" : porcentajeDisponible.toFixed(2)}
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value)}
                  className={cn("flex-1", excedeLimite && "border-destructive")}
                />
                {!modoEdicion && porcentajeDisponible > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPorcentaje(porcentajeDisponible.toFixed(2))}
                  >
                    Asignar todo ({porcentajeDisponible.toFixed(2)}%)
                  </Button>
                )}
              </div>
              {excedeLimite && (
                <p className="text-xs text-destructive">
                  El porcentaje excede el disponible ({porcentajeDisponible.toFixed(2)}%)
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  placeholder="(555) 123-4567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfc">RFC</Label>
              <Input
                id="rfc"
                placeholder="ABCD123456XYZ"
                value={rfc}
                onChange={(e) => setRfc(e.target.value.toUpperCase())}
                maxLength={13}
              />
            </div>

            <Button type="submit" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {modoEdicion ? "Actualizar Accionista" : "Registrar Accionista"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accionistas Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-4">Cargando accionistas...</p>
          ) : accionistas.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No hay accionistas registrados. Registra al menos uno para poder hacer transacciones.
            </p>
          ) : (
            <div className="space-y-2">
              {accionistas.map((accionista) => (
                <div key={accionista.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium">{accionista.nombre}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      {accionista.porcentaje_participacion > 0 && (
                        <span>{accionista.porcentaje_participacion}% participación</span>
                      )}
                      {accionista.email && <span>{accionista.email}</span>}
                      {accionista.telefono && <span>{accionista.telefono}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditar(accionista)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminarAccionista.mutate(accionista.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {/* Mostrar "Sin socio asignado" si hay porcentaje disponible */}
              {porcentajeDisponible > 0 && (
                <div className="flex items-center justify-between p-3 border-2 border-dashed border-orange-400 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                  <div className="flex-1">
                    <p className="font-medium text-orange-700 dark:text-orange-400">
                      Sin socio asignado
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Participación pendiente de asignar
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-orange-600">
                      {porcentajeDisponible.toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Disponible</p>
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
