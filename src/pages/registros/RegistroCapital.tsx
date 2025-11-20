import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Plus, TrendingUp, TrendingDown, FileText, Eye, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTransaccionesCapital } from "@/hooks/useTransaccionesCapital";
import { useAccionistas } from "@/hooks/useAccionistas";
import { useEstadoResultadosMensual } from "@/hooks/useEstadoResultadosMensual";
import { GraficaWaterfall } from "@/components/Capital/GraficaWaterfall";
import { GraficaRadialKPI } from "@/components/Capital/GraficaRadialKPI";
import { FormularioAccionista } from "@/components/Capital/FormularioAccionista";
import { DialogDetalleTransaccion } from "@/components/Capital/DialogDetalleTransaccion";
import { useCancelarTransaccionCapital } from "@/hooks/useCancelarTransaccionCapital";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Eliminar FilaTransaccionExpandible - ya no se usa

const RegistroCapital = () => {
  const {
    transacciones,
    isLoading,
    registrarTransaccion,
    totalAportaciones,
    totalDividendos,
    capitalSocialTotal,
    resumenPorSocio,
    totalAportacionesActivos,
    totalAportacionesInactivos,
    totalDividendosActivos,
    totalDividendosInactivos,
  } = useTransaccionesCapital();

  const { accionistas } = useAccionistas();
  const { data: resultadosMensuales } = useEstadoResultadosMensual();

  const [tipoMovimiento, setTipoMovimiento] = useState<"aportacion" | "dividendo">("aportacion");
  const [fecha, setFecha] = useState<Date>(new Date());
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [accionistaId, setAccionistaId] = useState("");
  const [accionistaSeleccionado, setAccionistaSeleccionado] = useState<string>("all");
  const [mostrarInactivos, setMostrarInactivos] = useState(true);

  // Estados para diálogos
  const [transaccionSeleccionada, setTransaccionSeleccionada] = useState<any>(null);
  const [dialogDetalleOpen, setDialogDetalleOpen] = useState(false);
  const [dialogCancelarOpen, setDialogCancelarOpen] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  
  // Estados para validación de dividendos
  const [dialogValidacionOpen, setDialogValidacionOpen] = useState(false);
  const [datosValidacion, setDatosValidacion] = useState<{
    capitalDisponible: number;
    montoIntentado: number;
    excedente: number;
    accionistaNombre: string;
  } | null>(null);

  const { mutate: cancelarTransaccion, isPending: isCancelando } = useCancelarTransaccionCapital();

  const handleVerDetalle = (transaccion: any) => {
    setTransaccionSeleccionada(transaccion);
    setDialogDetalleOpen(true);
  };

  const handleAbrirDialogCancelar = (transaccion: any) => {
    setTransaccionSeleccionada(transaccion);
    setDialogCancelarOpen(true);
    setMotivoCancelacion("");
  };

  const handleConfirmarCancelacion = () => {
    if (!transaccionSeleccionada || !motivoCancelacion.trim()) {
      toast.error("Debes proporcionar un motivo de cancelación");
      return;
    }

    cancelarTransaccion({
      transaccionId: transaccionSeleccionada.id,
      motivoCancelacion: motivoCancelacion.trim()
    }, {
      onSuccess: () => {
        setDialogCancelarOpen(false);
        setTransaccionSeleccionada(null);
        setMotivoCancelacion("");
      }
    });
  };

  // Calcular utilidades acumuladas del año actual
  const anioActual = new Date().getFullYear();
  const utilidadesAnioActual = resultadosMensuales?.reduce((sum, mes) => sum + mes.utilidadNeta, 0) || 0;

  // Función para calcular capital disponible de un accionista
  const calcularCapitalDisponible = (accionistaIdParam: string) => {
    const transaccionesActivas = transacciones.filter(t => t.estado === "activo");
    
    const aportacionesAccionista = transaccionesActivas
      .filter(t => t.accionista_id === accionistaIdParam && t.tipo_movimiento === "aportacion")
      .reduce((sum, t) => sum + Number(t.monto), 0);
    
    const dividendosDistribuidosAccionista = transaccionesActivas
      .filter(t => t.accionista_id === accionistaIdParam && t.tipo_movimiento === "dividendo")
      .reduce((sum, t) => sum + Number(t.monto), 0);
    
    const accionista = accionistas.find(a => a.id === accionistaIdParam);
    const porcentaje = accionista?.porcentaje_participacion || 0;
    
    // Utilidades proporcionales del año actual
    const utilidadesProporcionales = (utilidadesAnioActual * porcentaje) / 100;
    
    const capitalDisponible = aportacionesAccionista + utilidadesProporcionales - dividendosDistribuidosAccionista;
    
    return {
      aportaciones: aportacionesAccionista,
      utilidades: utilidadesProporcionales,
      dividendosDistribuidos: dividendosDistribuidosAccionista,
      disponible: capitalDisponible
    };
  };

  const procederConRegistro = () => {
    const accionista = accionistas.find(a => a.id === accionistaId);
    if (!accionista) return;

    registrarTransaccion.mutate({
      tipo_movimiento: tipoMovimiento,
      fecha,
      monto: parseFloat(monto),
      socio: accionista.nombre,
      accionista_id: accionistaId,
      descripcion: descripcion.trim(),
    }, {
      onSuccess: () => {
        setMonto("");
        setDescripcion("");
        setAccionistaId("");
        setAccionistaSeleccionado("");
        setFecha(new Date());
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accionistaId) {
      return;
    }

    if (!monto || parseFloat(monto) <= 0) {
      return;
    }

    const accionista = accionistas.find(a => a.id === accionistaId);
    if (!accionista) return;

    // Validar capital disponible solo para dividendos
    if (tipoMovimiento === "dividendo") {
      const { disponible } = calcularCapitalDisponible(accionistaId);
      const montoIntentado = parseFloat(monto);
      
      if (montoIntentado > disponible) {
        // Mostrar diálogo de advertencia
        setDatosValidacion({
          capitalDisponible: disponible,
          montoIntentado: montoIntentado,
          excedente: montoIntentado - disponible,
          accionistaNombre: accionista.nombre
        });
        setDialogValidacionOpen(true);
        return;
      }
    }

    // Si pasa la validación o es aportación, proceder
    procederConRegistro();
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Registro de Capital</h1>
        <p className="text-muted-foreground">Registra aportaciones de capital y distribución de dividendos</p>
      </div>

      <Tabs defaultValue="registro" className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          <TabsTrigger value="registro">Registros de Capital</TabsTrigger>
          <TabsTrigger value="resumen">Resumen de Transacciones</TabsTrigger>
          <TabsTrigger value="analitica">Analítica</TabsTrigger>
          <TabsTrigger value="accionistas">Accionistas</TabsTrigger>
        </TabsList>

        {/* Pestaña 1: Registros de Capital */}
        <TabsContent value="registro" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nuevo Movimiento de Capital</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tipo de Movimiento */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant={tipoMovimiento === "aportacion" ? "default" : "outline"}
                  onClick={() => setTipoMovimiento("aportacion")}
                  className="h-20 flex flex-col items-center justify-center gap-2"
                >
                  <TrendingUp className="h-6 w-6" />
                  <span>Aportación de Capital</span>
                </Button>
                <Button
                  type="button"
                  variant={tipoMovimiento === "dividendo" ? "default" : "outline"}
                  onClick={() => setTipoMovimiento("dividendo")}
                  className="h-20 flex flex-col items-center justify-center gap-2"
                >
                  <TrendingDown className="h-6 w-6" />
                  <span>Pago de Dividendos</span>
                </Button>
              </div>

              {/* Fecha */}
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fecha && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fecha ? format(fecha, "PPP", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fecha}
                      onSelect={(date) => date && setFecha(date)}
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Accionista */}
              <div className="space-y-2">
                <Label htmlFor="accionista">Accionista *</Label>
                <Select value={accionistaId} onValueChange={(value) => {
                  setAccionistaId(value);
                  const accionista = accionistas.find(a => a.id === value);
                  setAccionistaSeleccionado(accionista?.nombre || "");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un accionista" />
                  </SelectTrigger>
                  <SelectContent>
                    {accionistas.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No hay accionistas registrados. Ve a la pestaña "Accionistas" para registrar uno.
                      </div>
                    ) : (
                      accionistas.map((accionista) => (
                        <SelectItem key={accionista.id} value={accionista.id}>
                          {accionista.nombre}
                          {accionista.porcentaje_participacion > 0 && 
                            ` (${accionista.porcentaje_participacion}%)`
                          }
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Card Informativo de Capital Disponible (solo para dividendos) */}
              {tipoMovimiento === "dividendo" && accionistaId && (() => {
                const { aportaciones, utilidades, dividendosDistribuidos, disponible } = calcularCapitalDisponible(accionistaId);
                const accionista = accionistas.find(a => a.id === accionistaId);
                const isNegativo = disponible < 0;
                
                return (
                  <Card className={cn(
                    "border-2",
                    isNegativo ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5"
                  )}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {isNegativo && <AlertTriangle className="h-4 w-4 text-destructive" />}
                        Capital Disponible - {accionista?.nombre}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Aportaciones:</span>
                        <span className="font-medium">
                          ${aportaciones.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Utilidades {anioActual}:</span>
                        <span className="font-medium">
                          ${utilidades.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Distribuido:</span>
                        <span className="font-medium text-destructive">
                          -${dividendosDistribuidos.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between items-center">
                        <span className="font-semibold">Disponible:</span>
                        <span className={cn(
                          "text-lg font-bold",
                          isNegativo ? "text-destructive" : "text-primary"
                        )}>
                          ${disponible.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {isNegativo && (
                        <div className="flex items-start gap-2 mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <p>Este accionista ya ha recibido más dividendos de lo disponible</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Monto */}
              <div className="space-y-2">
                <Label htmlFor="monto">
                  {tipoMovimiento === "aportacion" ? "Monto de Aportación" : "Monto del Dividendo"}
                </Label>
                <Input
                  id="monto"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                />
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción / Notas</Label>
                <Textarea
                  id="descripcion"
                  placeholder={
                    tipoMovimiento === "aportacion"
                      ? "Ej: Aportación inicial de capital social"
                      : "Ej: Distribución de utilidades del ejercicio 2024"
                  }
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Botón Submit */}
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Registrar {tipoMovimiento === "aportacion" ? "Aportación" : "Dividendo"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resumen e Información */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tipoMovimiento === "aportacion" ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Aportación de Capital</p>
                      <p className="text-xs text-muted-foreground">
                        Incrementa el capital social de la empresa. Se registra en la cuenta de capital contable.
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Registro contable:</p>
                    <p>• Debe: Bancos / Caja</p>
                    <p>• Haber: Capital Social</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <TrendingDown className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Pago de Dividendos</p>
                      <p className="text-xs text-muted-foreground">
                        Distribución de utilidades a los socios. Reduce el capital contable de la empresa.
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Registro contable:</p>
                    <p>• Debe: Utilidades Retenidas</p>
                    <p>• Haber: Bancos / Caja</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historial Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
              ) : transacciones.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay movimientos registrados
                </p>
              ) : (
                <div className="space-y-2">
                  {transacciones.slice(0, 5).map((t) => (
                    <div key={t.id} className="text-sm border-b pb-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{t.socio}</span>
                        <span className={t.tipo_movimiento === "aportacion" ? "text-green-600" : "text-red-600"}>
                          ${Number(t.monto).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(t.fecha), "dd/MM/yyyy", { locale: es })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </div>
      </TabsContent>

      {/* Pestaña 2: Resumen de Transacciones */}
      <TabsContent value="resumen" className="mt-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Resumen de Movimientos de Capital</CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="mostrar-inactivos" className="text-sm">
                    Mostrar inactivos
                  </Label>
                  <Switch
                    id="mostrar-inactivos"
                    checked={mostrarInactivos}
                    onCheckedChange={setMostrarInactivos}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Capital Social Total
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-primary">
                      ${capitalSocialTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Aportaciones acumuladas</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Aportaciones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">
                      ${totalAportaciones.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">En el periodo</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Dividendos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-600">
                      ${totalDividendos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Distribuidos en el periodo</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabla de transacciones */}
              <div className="border rounded-lg">
                <div className="p-4 border-b bg-muted/50">
                  <h3 className="font-semibold">Historial de Transacciones</h3>
                </div>
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>Cargando transacciones...</p>
                  </div>
                ) : transacciones.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>No hay transacciones registradas</p>
                    <p className="text-sm mt-2">Las transacciones aparecerán aquí una vez que las registres</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-3 text-left text-sm font-medium">Fecha</th>
                          <th className="p-3 text-left text-sm font-medium">Socio</th>
                          <th className="p-3 text-left text-sm font-medium">Tipo</th>
                          <th className="p-3 text-right text-sm font-medium">Monto</th>
                          <th className="p-3 text-left text-sm font-medium">Descripción</th>
                          <th className="p-3 text-center text-sm font-medium">Estado</th>
                          <th className="p-3 text-center text-sm font-medium w-[120px]">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transacciones.map((t) => (
                          <tr key={t.id} className="border-b hover:bg-muted/50">
                            <td className="p-3 text-sm">
                              {format(new Date(t.fecha), "dd/MM/yyyy", { locale: es })}
                            </td>
                            <td className="p-3 text-sm font-medium">
                              <div className="flex items-center gap-2">
                                {t.accionistaNombreActual || t.socio}
                                {!t.accionistaActivo && (
                                  <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-600">
                                    ⚠️ Inactivo
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              {t.tipo_movimiento === "aportacion" ? (
                                <Badge className="bg-green-500">
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  Aportación
                                </Badge>
                              ) : (
                                <Badge className="bg-red-500">
                                  <TrendingDown className="w-3 h-3 mr-1" />
                                  Dividendo
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono text-sm">
                              ${Number(t.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {t.descripcion || "-"}
                            </td>
                            <td className="p-3 text-center">
                              {t.estado === 'cancelado' ? (
                                <Badge variant="destructive">Cancelado</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950/20 dark:text-green-400">
                                  Activo
                                </Badge>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleVerDetalle(t)}
                                  className="h-8 w-8 p-0"
                                  title="Ver detalle"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {t.estado === 'activo' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAbrirDialogCancelar(t)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Cancelar transacción"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resumen por Socio */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen por Socio / Accionista</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <div className="p-4 border-b bg-muted/50">
                  <div className="grid grid-cols-4 gap-4 font-semibold text-sm">
                    <div>Socio</div>
                    <div className="text-right">Aportaciones</div>
                    <div className="text-right">Dividendos</div>
                    <div className="text-right">Balance</div>
                  </div>
                </div>
                {Object.keys(resumenPorSocio).length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>No hay datos disponibles</p>
                  </div>
                ) : (
                  <div>
                    {Object.entries(resumenPorSocio)
                      .filter(([_, datos]) => mostrarInactivos || datos.activo)
                      .map(([clave, datos]) => (
                      <div 
                        key={clave} 
                        className={cn(
                          "p-4 border-b last:border-b-0 hover:bg-muted/50",
                          !datos.activo && "bg-yellow-50/50 dark:bg-yellow-900/10"
                        )}
                      >
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div className="font-medium flex items-center gap-2">
                            {datos.nombreMostrar}
                            {!datos.activo && (
                              <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-600">
                                ⚠️ Inactivo
                              </Badge>
                            )}
                          </div>
                          <div className="text-right text-green-600">
                            ${datos.aportaciones.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-right text-red-600">
                            ${datos.dividendos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-right font-semibold">
                            ${datos.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Pestaña 3: Analítica */}
      <TabsContent value="analitica" className="mt-6">
        <div className="space-y-6">
          {/* Filtro de Accionista */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Label htmlFor="filtro-accionista" className="whitespace-nowrap">
                  Ver análisis de:
                </Label>
                <Select 
                  value={accionistaSeleccionado} 
                  onValueChange={setAccionistaSeleccionado}
                >
                  <SelectTrigger id="filtro-accionista" className="w-full max-w-md">
                    <SelectValue placeholder="Consolidado (Todos los accionistas)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Consolidado (Todos los accionistas)</SelectItem>
                    <SelectItem value="inactivos">
                      ⚠️ Socios Inactivos (Agrupados)
                    </SelectItem>
                    {accionistas.map((accionista) => (
                      <SelectItem key={accionista.id} value={accionista.id}>
                        {accionista.nombre}
                        {accionista.porcentaje_participacion > 0 && 
                          ` (${accionista.porcentaje_participacion}%)`
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {accionistaSeleccionado === "inactivos" && (
            <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-yellow-100 p-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-700" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                      Vista de Socios Inactivos
                    </h4>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Estás viendo el análisis consolidado de todos los socios marcados como inactivos. 
                      Estas transacciones mantienen su trazabilidad completa en el sistema.
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-2">
                      <strong>Total en este grupo:</strong> {Object.values(resumenPorSocio)
                        .filter(s => !s.activo)
                        .length} socio(s) inactivo(s)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GraficaWaterfall 
              data={{
                aportaciones: 
                  accionistaSeleccionado === "inactivos"
                    ? totalAportacionesInactivos
                    : accionistaSeleccionado && accionistaSeleccionado !== "all"
                      ? transacciones
                          .filter(t => t.accionista_id === accionistaSeleccionado && t.tipo_movimiento === "aportacion" && t.estado === "activo")
                          .reduce((sum, t) => sum + Number(t.monto), 0)
                      : totalAportaciones,
                utilidadesHistoricas: 
                  accionistaSeleccionado === "inactivos"
                    ? 0 // Inactivos no reciben utilidades proporcionales históricas
                    : accionistaSeleccionado && accionistaSeleccionado !== "all"
                      ? (() => {
                          const accionista = accionistas.find(a => a.id === accionistaSeleccionado);
                          const porcentaje = accionista?.porcentaje_participacion || 0;
                          
                          // Por ahora, empezamos con 0 hasta tener data histórica completa
                          // TODO: En fase 2, consultar utilidades de años anteriores desde BD
                          const utilidadesHistoricasTotales = 0; 
                          
                          return (utilidadesHistoricasTotales * porcentaje) / 100;
                        })()
                      : 0, // Consolidado: mantener en 0 por ahora
                dividendosHistoricos: 
                  accionistaSeleccionado === "inactivos"
                    ? transacciones
                        .filter(t => t.tipo_movimiento === "dividendo" && !t.accionistaActivo && t.estado === "activo" && new Date(t.fecha).getFullYear() < anioActual)
                        .reduce((sum, t) => sum + Number(t.monto), 0)
                    : accionistaSeleccionado && accionistaSeleccionado !== "all"
                      ? transacciones
                          .filter(t => t.accionista_id === accionistaSeleccionado && t.tipo_movimiento === "dividendo" && t.estado === "activo" && new Date(t.fecha).getFullYear() < anioActual)
                          .reduce((sum, t) => sum + Number(t.monto), 0)
                      : transacciones
                          .filter(t => t.tipo_movimiento === "dividendo" && t.estado === "activo" && new Date(t.fecha).getFullYear() < anioActual)
                          .reduce((sum, t) => sum + Number(t.monto), 0),
                utilidadesAnioActual: 
                  accionistaSeleccionado === "inactivos"
                    ? 0 // Inactivos no reciben utilidades proporcionales
                    : accionistaSeleccionado && accionistaSeleccionado !== "all"
                      ? (() => {
                          const accionista = accionistas.find(a => a.id === accionistaSeleccionado);
                          const porcentaje = accionista?.porcentaje_participacion || 0;
                          return (utilidadesAnioActual * porcentaje) / 100;
                        })()
                      : utilidadesAnioActual, // Consolidado: total completo
                dividendosAnioActual: 
                  accionistaSeleccionado === "inactivos"
                    ? transacciones
                        .filter(t => t.tipo_movimiento === "dividendo" && !t.accionistaActivo && t.estado === "activo" && new Date(t.fecha).getFullYear() === anioActual)
                        .reduce((sum, t) => sum + Number(t.monto), 0)
                    : accionistaSeleccionado && accionistaSeleccionado !== "all"
                      ? transacciones
                          .filter(t => t.accionista_id === accionistaSeleccionado && t.tipo_movimiento === "dividendo" && t.estado === "activo" && new Date(t.fecha).getFullYear() === anioActual)
                          .reduce((sum, t) => sum + Number(t.monto), 0)
                      : transacciones
                          .filter(t => t.tipo_movimiento === "dividendo" && t.estado === "activo" && new Date(t.fecha).getFullYear() === anioActual)
                          .reduce((sum, t) => sum + Number(t.monto), 0),
              }}
              accionistaId={accionistaSeleccionado}
              accionistaNombre={
                accionistaSeleccionado === "all" ? undefined :
                accionistaSeleccionado === "inactivos" ? "Socios Inactivos" :
                accionistas.find(a => a.id === accionistaSeleccionado)?.nombre
              }
            />
            
            <GraficaRadialKPI
              aportaciones={
                accionistaSeleccionado === "inactivos"
                  ? totalAportacionesInactivos
                  : accionistaSeleccionado && accionistaSeleccionado !== "all"
                    ? transacciones
                        .filter(t => t.accionista_id === accionistaSeleccionado && t.tipo_movimiento === "aportacion" && t.estado === "activo")
                        .reduce((sum, t) => sum + Number(t.monto), 0)
                    : totalAportaciones
              }
              utilidades={
                accionistaSeleccionado === "inactivos"
                  ? 0 // Inactivos no reciben utilidades proporcionales
                  : accionistaSeleccionado && accionistaSeleccionado !== "all"
                    ? (() => {
                        const accionista = accionistas.find(a => a.id === accionistaSeleccionado);
                        const porcentaje = accionista?.porcentaje_participacion || 0;
                        return (utilidadesAnioActual * porcentaje) / 100;
                      })()
                    : utilidadesAnioActual // Consolidado: total completo
              }
              dividendosDistribuidos={
                accionistaSeleccionado === "inactivos"
                  ? totalDividendosInactivos
                  : accionistaSeleccionado && accionistaSeleccionado !== "all"
                    ? transacciones
                        .filter(t => t.accionista_id === accionistaSeleccionado && t.tipo_movimiento === "dividendo" && t.estado === "activo")
                        .reduce((sum, t) => sum + Number(t.monto), 0)
                    : totalDividendos
              }
              accionista={accionistaSeleccionado && accionistaSeleccionado !== "all" && accionistaSeleccionado !== "inactivos"
                ? accionistas.find(a => a.id === accionistaSeleccionado)
                : undefined}
              totalAportaciones={totalAportaciones}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Indicadores Clave - {
                  accionistaSeleccionado === "inactivos"
                    ? "⚠️ Socios Inactivos"
                    : accionistaSeleccionado && accionistaSeleccionado !== "all"
                      ? accionistas.find(a => a.id === accionistaSeleccionado)?.nombre 
                      : "Consolidado"
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">
                    {accionistaSeleccionado === "inactivos"
                      ? "Socios Inactivos"
                      : accionistaSeleccionado && accionistaSeleccionado !== "all" 
                        ? "Transacciones" 
                        : "Número de Accionistas"}
                  </p>
                  <p className="text-2xl font-bold">
                    {accionistaSeleccionado === "inactivos"
                      ? Object.values(resumenPorSocio).filter(s => !s.activo).length
                      : accionistaSeleccionado && accionistaSeleccionado !== "all"
                        ? transacciones.filter(t => t.accionista_id === accionistaSeleccionado && t.estado === "activo").length
                        : accionistas.length
                    }
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Última Aportación</p>
                  <p className="text-lg font-semibold">
                    {(() => {
                      const filtradas = accionistaSeleccionado === "inactivos"
                        ? transacciones.filter(t => t.tipo_movimiento === "aportacion" && !t.accionistaActivo && t.estado === "activo")
                        : accionistaSeleccionado && accionistaSeleccionado !== "all"
                          ? transacciones.filter(t => t.tipo_movimiento === "aportacion" && t.accionista_id === accionistaSeleccionado && t.estado === "activo")
                          : transacciones.filter(t => t.tipo_movimiento === "aportacion" && t.estado === "activo");
                      const ultima = filtradas[0];
                      return ultima
                        ? format(new Date(ultima.fecha), "dd/MM/yyyy", { locale: es })
                        : "N/A";
                    })()}
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Último Dividendo</p>
                  <p className="text-lg font-semibold">
                    {(() => {
                      const filtradas = accionistaSeleccionado === "inactivos"
                        ? transacciones.filter(t => t.tipo_movimiento === "dividendo" && !t.accionistaActivo && t.estado === "activo")
                        : accionistaSeleccionado && accionistaSeleccionado !== "all"
                          ? transacciones.filter(t => t.tipo_movimiento === "dividendo" && t.accionista_id === accionistaSeleccionado && t.estado === "activo")
                          : transacciones.filter(t => t.tipo_movimiento === "dividendo" && t.estado === "activo");
                      const ultimo = filtradas[0];
                      return ultimo
                        ? format(new Date(ultimo.fecha), "dd/MM/yyyy", { locale: es })
                        : "N/A";
                    })()}
                  </p>
                </div>
              </div>

              {/* Detalles adicionales por accionista */}
              {accionistaSeleccionado && accionistaSeleccionado !== "all" && accionistaSeleccionado !== "inactivos" && (() => {
                const accionista = accionistas.find(a => a.id === accionistaSeleccionado);
                if (!accionista) return null;
                return (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-3">Información del Accionista</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {accionista.porcentaje_participacion > 0 && (
                        <div>
                          <span className="text-muted-foreground">Participación:</span>
                          <span className="ml-2 font-medium">{accionista.porcentaje_participacion}%</span>
                        </div>
                      )}
                      {accionista.email && (
                        <div>
                          <span className="text-muted-foreground">Email:</span>
                          <span className="ml-2 font-medium">{accionista.email}</span>
                        </div>
                      )}
                      {accionista.telefono && (
                        <div>
                          <span className="text-muted-foreground">Teléfono:</span>
                          <span className="ml-2 font-medium">{accionista.telefono}</span>
                        </div>
                      )}
                      {accionista.rfc && (
                        <div>
                          <span className="text-muted-foreground">RFC:</span>
                          <span className="ml-2 font-medium">{accionista.rfc}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Pestaña 4: Accionistas */}
      <TabsContent value="accionistas" className="mt-6">
        <FormularioAccionista />
      </TabsContent>
    </Tabs>

    {/* Dialog de Detalle */}
    <DialogDetalleTransaccion
      open={dialogDetalleOpen}
      onOpenChange={setDialogDetalleOpen}
      transaccion={transaccionSeleccionada}
    />

    {/* Dialog de Confirmación de Cancelación */}
    <AlertDialog open={dialogCancelarOpen} onOpenChange={setDialogCancelarOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro de cancelar esta transacción?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Se creará un asiento de reversión para mantener
            la trazabilidad contable.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="my-4">
          <label className="text-sm font-medium mb-2 block">
            Motivo de la cancelación <span className="text-red-500">*</span>
          </label>
          <Textarea
            placeholder="Explica por qué se cancela esta transacción..."
            value={motivoCancelacion}
            onChange={(e) => setMotivoCancelacion(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        {transaccionSeleccionada && (
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <p><strong>Fecha:</strong> {format(new Date(transaccionSeleccionada.fecha), "dd/MM/yyyy", { locale: es })}</p>
            <p><strong>Socio:</strong> {transaccionSeleccionada.socio}</p>
            <p><strong>Monto:</strong> ${Number(transaccionSeleccionada.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCancelando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmarCancelacion}
            disabled={isCancelando || !motivoCancelacion.trim()}
            className="bg-red-600 hover:bg-red-700"
          >
            {isCancelando ? "Cancelando..." : "Confirmar Cancelación"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* AlertDialog para validación de exceso de dividendos */}
    <AlertDialog open={dialogValidacionOpen} onOpenChange={setDialogValidacionOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Monto Excede Capital Disponible
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                El monto que intentas distribuir excede el capital disponible del accionista{" "}
                <strong>{datosValidacion?.accionistaNombre}</strong>:
              </p>
              
              <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Capital Disponible:</span>
                  <span className="font-semibold text-primary">
                    ${datosValidacion?.capitalDisponible.toLocaleString("es-MX", { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Monto a Distribuir:</span>
                  <span className="font-semibold">
                    ${datosValidacion?.montoIntentado.toLocaleString("es-MX", { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span>Excedente:</span>
                  <span className="font-bold text-destructive">
                    ${datosValidacion?.excedente.toLocaleString("es-MX", { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </span>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                ¿Deseas continuar con el registro de todos modos?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => {
            setDialogValidacionOpen(false);
            setDatosValidacion(null);
          }}>
            Cancelar y Ajustar Monto
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setDialogValidacionOpen(false);
              setDatosValidacion(null);
              procederConRegistro();
            }}
            className="bg-destructive hover:bg-destructive/90"
          >
            Registrar de Todos Modos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  );
};

export default RegistroCapital;
