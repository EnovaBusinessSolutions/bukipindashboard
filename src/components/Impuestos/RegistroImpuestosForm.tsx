import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useUtilidadAntesImpuestos } from "@/hooks/useUtilidadAntesImpuestos";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export const RegistroImpuestosForm = () => {
  const { user } = useAuth();
  const currentDate = new Date();
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(currentDate.getMonth() + 1);
  const [anoSeleccionado, setAnoSeleccionado] = useState<number>(currentDate.getFullYear());
  const [tasaISR, setTasaISR] = useState<string>("30");
  const [isrReal, setIsrReal] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("");
  const [registroExistente, setRegistroExistente] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [proveedorNombre, setProveedorNombre] = useState<string>("SAT - Servicio de Administración Tributaria");
  const [proveedorRfc, setProveedorRfc] = useState<string>("SAT970701NN3");
  const [metodoPago, setMetodoPago] = useState<string>("transferencia");

  const { data: utilidadData, isLoading } = useUtilidadAntesImpuestos(mesSeleccionado, anoSeleccionado);

  useEffect(() => {
    const verificarRegistroExistente = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('transacciones_impuestos')
        .select('*')
        .eq('user_id', user.id)
        .eq('mes', mesSeleccionado)
        .eq('ano', anoSeleccionado)
        .maybeSingle();

      if (data) {
        setRegistroExistente(data);
        setTasaISR(data.tasa_isr.toString());
        setIsrReal(data.isr_real.toString());
        setObservaciones(data.observaciones || "");
      } else {
        setRegistroExistente(null);
        setIsrReal("");
        setObservaciones("");
        setMetodoPago("transferencia");
      }
    };

    verificarRegistroExistente();
  }, [mesSeleccionado, anoSeleccionado, user]);

  const utilidadAntesImpuestos = utilidadData?.utilidadAntesImpuestos || 0;
  const isrCalculado = (utilidadAntesImpuestos * parseFloat(tasaISR || "0")) / 100;

  const isPeriodoPasado = () => {
    const periodoSeleccionado = new Date(anoSeleccionado, mesSeleccionado - 1);
    const mesActual = new Date(currentDate.getFullYear(), currentDate.getMonth());
    return periodoSeleccionado < mesActual;
  };

  const diasRestantesMes = () => {
    const ultimoDiaMes = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const diaActual = currentDate.getDate();
    return ultimoDiaMes - diaActual;
  };

  const mostrarAlertaCierreMes = mesSeleccionado === currentDate.getMonth() + 1 && 
                                  anoSeleccionado === currentDate.getFullYear() && 
                                  diasRestantesMes() <= 5;

  const handleGuardarRegistro = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para guardar el registro",
        variant: "destructive"
      });
      return;
    }

    if (isPeriodoPasado() && !registroExistente) {
      toast({
        title: "Error",
        description: "No puedes crear registros para períodos pasados",
        variant: "destructive"
      });
      return;
    }

    if (!isrReal || parseFloat(isrReal) < 0) {
      toast({
        title: "Error",
        description: "Debes ingresar el monto real de ISR",
        variant: "destructive"
      });
      return;
    }

    if (!metodoPago) {
      toast({
        title: "Error",
        description: "Debes seleccionar el método de pago",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      const diferencia = parseFloat(isrReal) - isrCalculado;
      const datosRegistro = {
        user_id: user.id,
        mes: mesSeleccionado,
        ano: anoSeleccionado,
        utilidad_antes_impuestos: utilidadAntesImpuestos,
        tasa_isr: parseFloat(tasaISR),
        isr_calculado: isrCalculado,
        isr_real: parseFloat(isrReal),
        diferencia: diferencia,
        observaciones: observaciones || null
      };

      let transaccionId: string;

      if (registroExistente) {
        const { error } = await supabase
          .from('transacciones_impuestos')
          .update(datosRegistro)
          .eq('id', registroExistente.id);

        if (error) throw error;
        transaccionId = registroExistente.id;

        toast({
          title: "Registro actualizado",
          description: "El registro de ISR se ha actualizado correctamente"
        });
      } else {
        // Crear transacción de egreso (pago inmediato)
        const { data: egresoData, error: egresoError } = await supabase
          .from('transacciones_egresos')
          .insert({
            user_id: user.id,
            tipo_egreso: 'impuesto',
            subtipo_egreso: 'ISR',
            descripcion: `ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado}`,
            cuenta_codigo: '5200',
            monto_total: parseFloat(isrReal),
            monto_pagado: parseFloat(isrReal),
            monto_pendiente: 0,
            tipo_pago: 'contado',
            metodo_pago: metodoPago,
            fecha_vencimiento: null,
            proveedor_nombre: proveedorNombre,
            proveedor_rfc: proveedorRfc,
            comentarios: observaciones
          })
          .select()
          .single();

        if (egresoError) throw egresoError;
        const { data: newTransaction, error } = await supabase
          .from('transacciones_impuestos')
          .insert(datosRegistro)
          .select()
          .single();

        if (error) throw error;
        transaccionId = newTransaction.id;

        // Crear asiento contable (doble partida)
        const numeroAsiento = await generarNumeroAsiento();
        const fechaAsiento = new Date(anoSeleccionado, mesSeleccionado - 1, 1);

        const { data: asiento, error: asientoError } = await supabase
          .from('asientos_contables')
          .insert({
            user_id: user.id,
            numero_asiento: numeroAsiento,
            descripcion: `ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado}`,
            fecha: fechaAsiento.toISOString().split('T')[0]
          })
          .select()
          .single();

        if (asientoError) throw asientoError;

        // Detalles del asiento (doble partida) - Pago inmediato
        const detalles = [
          {
            asiento_id: asiento.id,
            cuenta_codigo: '5200', // ISR por pagar
            descripcion: `ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado}`,
            debe: parseFloat(isrReal),
            haber: 0
          },
          {
            asiento_id: asiento.id,
            cuenta_codigo: '1100', // Bancos
            descripcion: `Pago ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado}`,
            debe: 0,
            haber: parseFloat(isrReal)
          }
        ];

        const { error: detallesError } = await supabase
          .from('detalle_asientos')
          .insert(detalles);

        if (detallesError) throw detallesError;

        toast({
          title: "Registro guardado",
          description: "El pago de ISR se registró correctamente con su asiento contable"
        });
      }

      // Recargar datos
      const { data } = await supabase
        .from('transacciones_impuestos')
        .select('*')
        .eq('user_id', user.id)
        .eq('mes', mesSeleccionado)
        .eq('ano', anoSeleccionado)
        .maybeSingle();

      if (data) setRegistroExistente(data);

    } catch (error) {
      console.error("Error al guardar registro:", error);
      toast({
        title: "Error",
        description: "Hubo un error al guardar el registro",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const generarNumeroAsiento = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_asiento_number', {
      p_user_id: user?.id
    });

    if (error) throw error;
    return data;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value);
  };

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  return (
    <div className="space-y-6">
      {/* Alertas */}
      {isPeriodoPasado() && !registroExistente && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No puedes crear nuevos registros para períodos pasados. Solo puedes modificar registros existentes.
          </AlertDescription>
        </Alert>
      )}

      {mostrarAlertaCierreMes && (
        <Alert className="border-amber-500 bg-amber-500/10">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-600 dark:text-amber-400">
            ¡Atención! Faltan {diasRestantesMes()} días para el cierre de mes. Asegúrate de registrar el ISR antes de que termine el mes.
          </AlertDescription>
        </Alert>
      )}

      {registroExistente && (
        <Alert className="border-green-500 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600 dark:text-green-400">
            Ya existe un registro de ISR para este período. Puedes modificarlo si es necesario.
          </AlertDescription>
        </Alert>
      )}

      {/* Selector de Período */}
      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
          <CardDescription>Selecciona el mes y año del registro</CardDescription>
        </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mes">Mes</Label>
              <Select 
                value={mesSeleccionado.toString()} 
                onValueChange={(value) => setMesSeleccionado(parseInt(value))}
                disabled={true}
              >
                <SelectTrigger id="mes" className="bg-muted text-muted-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((mes, index) => {
                    const mesNumero = index + 1;
                    const mesActual = currentDate.getMonth() + 1;
                    
                    return (
                      <SelectItem 
                        key={mesNumero} 
                        value={mesNumero.toString()}
                        disabled={mesNumero !== mesActual}
                      >
                        {mes}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ano">Año</Label>
              <Select 
                value={anoSeleccionado.toString()} 
                onValueChange={(value) => setAnoSeleccionado(parseInt(value))}
                disabled={true}
              >
                <SelectTrigger id="ano" className="bg-muted text-muted-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={currentDate.getFullYear().toString()}>
                    {currentDate.getFullYear()}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
      </Card>

      {/* Cálculo de ISR */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Cálculo de ISR
          </CardTitle>
          <CardDescription>
            Cálculo automático basado en la utilidad antes de impuestos del período seleccionado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando datos del período...
            </div>
          ) : (
            <>
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Ingresos:</span>
                  <span className="font-semibold">{formatCurrency(utilidadData?.ingresos || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Costos:</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(utilidadData?.costos || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Gastos:</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(utilidadData?.gastos || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Depreciación:</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(utilidadData?.depreciacion || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Intereses:</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(utilidadData?.intereses || 0)}</span>
                </div>
                <div className="pt-3 border-t border-border flex justify-between items-center">
                  <span className="font-semibold">Utilidad Antes de Impuestos:</span>
                  <span className="text-xl font-bold text-foreground">
                    {formatCurrency(utilidadAntesImpuestos)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tasa-isr">Tasa de ISR (%)</Label>
                <Input
                  id="tasa-isr"
                  type="number"
                  placeholder="Ej: 30"
                  value={tasaISR}
                  onChange={(e) => setTasaISR(e.target.value)}
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>

              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">ISR Calculado:</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(isrCalculado)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {tasaISR}% de {formatCurrency(utilidadAntesImpuestos)}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ISR Real a Pagar */}
      <Card>
        <CardHeader>
          <CardTitle>ISR Real a Pagar</CardTitle>
          <CardDescription>
            Ingresa el monto real de ISR que pagarás (puede diferir del cálculo automático)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="isr-real">Monto Real de ISR *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsrReal(isrCalculado.toFixed(2))}
                className="text-xs"
              >
                Usar ISR Calculado
              </Button>
            </div>
            <Input
              id="isr-real"
              type="text"
              placeholder="Ingresa el monto real a pagar"
              value={isrReal}
              onChange={(e) => {
                const value = e.target.value.replace(/,/g, '').replace(/[^\d.]/g, '');
                // Permitir vacío, números con o sin punto decimal
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setIsrReal(value);
                }
              }}
              onBlur={(e) => {
                // Al perder foco, formatear el número si es válido
                const num = parseFloat(isrReal);
                if (!isNaN(num)) {
                  setIsrReal(num.toFixed(2));
                }
              }}
              maxLength={20}
            />
            {isrReal && !isNaN(parseFloat(isrReal)) && (
              <p className="text-sm text-muted-foreground">
                {parseFloat(isrReal).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
              </p>
            )}
          </div>

          {isrReal && parseFloat(isrReal) !== isrCalculado && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                El monto real difiere del calculado por{" "}
                <span className="font-semibold">
                  {formatCurrency(Math.abs(parseFloat(isrReal) - isrCalculado))}
                </span>
                {parseFloat(isrReal) > isrCalculado ? " (mayor)" : " (menor)"}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="metodo-pago">Método de Pago *</Label>
            <Select value={metodoPago} onValueChange={setMetodoPago}>
              <SelectTrigger id="metodo-pago">
                <SelectValue placeholder="Selecciona el método de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proveedor-nombre">Proveedor</Label>
            <Input
              id="proveedor-nombre"
              type="text"
              value={proveedorNombre}
              onChange={(e) => setProveedorNombre(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proveedor-rfc">RFC del Proveedor</Label>
            <Input
              id="proveedor-rfc"
              type="text"
              value={proveedorRfc}
              onChange={(e) => setProveedorRfc(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea
              id="observaciones"
              placeholder="Agrega notas o comentarios sobre este registro..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
            />
          </div>

          <Button 
            className="w-full" 
            onClick={handleGuardarRegistro}
            disabled={!isrReal || isSaving || (isPeriodoPasado() && !registroExistente)}
          >
            {isSaving ? "Guardando..." : registroExistente ? "Actualizar Registro" : "Guardar Registro"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
