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
import { formatCurrency } from "@/lib/utils";

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
  const [tipoPago, setTipoPago] = useState<string>("total");
  const [fechaVencimiento, setFechaVencimiento] = useState<string>("");
  const [proveedorNombre, setProveedorNombre] = useState<string>("SAT - Servicio de Administración Tributaria");
  const [proveedorRfc, setProveedorRfc] = useState<string>("SAT970701NN3");
  const [metodoPago, setMetodoPago] = useState<string>("transferencia");
  const [montoPagado, setMontoPagado] = useState<string>("");

  const { data: utilidadData, isLoading } = useUtilidadAntesImpuestos(mesSeleccionado, anoSeleccionado);

  useEffect(() => {
    const verificarRegistrosExistentes = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('transacciones_impuestos')
        .select('*')
        .eq('user_id', user.id)
        .eq('mes', mesSeleccionado)
        .eq('ano', anoSeleccionado)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        // Calcular el total acumulado de todos los registros
        const totalAcumulado = data.reduce((sum, reg) => sum + Number(reg.isr_real), 0);
        setRegistroExistente({
          registros: data,
          total_acumulado: totalAcumulado,
          ultimo_registro: data[0]
        });
      } else {
        setRegistroExistente(null);
        setIsrReal("");
        setObservaciones("");
        setTipoPago("total");
        setFechaVencimiento("");
        setMetodoPago("transferencia");
        setMontoPagado("");
      }
    };

    verificarRegistrosExistentes();
  }, [mesSeleccionado, anoSeleccionado, user]);

  const utilidadAntesImpuestos = utilidadData?.utilidadAntesImpuestos || 0;
  // ✅ Solo calcular ISR si hay utilidad positiva
  const isrCalculado = utilidadAntesImpuestos > 0 
    ? (utilidadAntesImpuestos * parseFloat(tasaISR || "0")) / 100 
    : 0;

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

    if (isPeriodoPasado()) {
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

    if (tipoPago === "credito" && !fechaVencimiento) {
      toast({
        title: "Error",
        description: "Debes ingresar la fecha de vencimiento para pago a crédito",
        variant: "destructive"
      });
      return;
    }

    if ((tipoPago === "total" || tipoPago === "parcial") && !metodoPago) {
      toast({
        title: "Error",
        description: "Debes seleccionar el método de pago",
        variant: "destructive"
      });
      return;
    }

    if (tipoPago === "parcial") {
      if (!montoPagado || parseFloat(montoPagado) <= 0) {
        toast({
          title: "Error",
          description: "Debes ingresar el monto pagado",
          variant: "destructive"
        });
        return;
      }
      
      if (parseFloat(montoPagado) > parseFloat(isrReal)) {
        toast({
          title: "Error",
          description: "El monto pagado no puede ser mayor al ISR total",
          variant: "destructive"
        });
        return;
      }

      if (!fechaVencimiento) {
        toast({
          title: "Error",
          description: "Debes ingresar la fecha de vencimiento para el saldo pendiente",
          variant: "destructive"
        });
        return;
      }
    }

    // FASE 1: Validar saldo disponible antes de registrar
    let montoPagadoFinal = 0;
    if (tipoPago === "total") {
      montoPagadoFinal = parseFloat(isrReal);
    } else if (tipoPago === "parcial") {
      montoPagadoFinal = parseFloat(montoPagado);
    }

    if (montoPagadoFinal > 0 && (tipoPago === "total" || tipoPago === "parcial")) {
      if (metodoPago === "efectivo") {
        const { data: detalles } = await supabase
          .from("detalle_asientos")
          .select("cuenta_codigo, debe, haber, asientos_contables!inner(user_id)")
          .eq("cuenta_codigo", "1001")
          .eq("asientos_contables.user_id", user.id);

        if (!detalles) {
          toast({
            title: "⚠️ Error de validación",
            description: "No se pudieron cargar los saldos disponibles. Intenta nuevamente.",
            variant: "destructive"
          });
          setIsSaving(false);
          return;
        }

        let efectivo = 0;
        detalles.forEach(detalle => {
          efectivo += (detalle.debe || 0) - (detalle.haber || 0);
        });

        if (montoPagadoFinal > efectivo) {
          toast({
            title: "💰 Saldo insuficiente en efectivo",
            description: `Disponible: $${formatCurrency(efectivo)} | Necesitas: $${formatCurrency(montoPagadoFinal)}`,
            variant: "destructive"
          });
          setIsSaving(false);
          return;
        }
      }

      if (metodoPago === "transferencia") {
        const { data: detalles } = await supabase
          .from("detalle_asientos")
          .select("cuenta_codigo, debe, haber, asientos_contables!inner(user_id)")
          .eq("cuenta_codigo", "1002")
          .eq("asientos_contables.user_id", user.id);

        if (!detalles) {
          toast({
            title: "⚠️ Error de validación",
            description: "No se pudieron cargar los saldos disponibles. Intenta nuevamente.",
            variant: "destructive"
          });
          setIsSaving(false);
          return;
        }

        let bancos = 0;
        detalles.forEach(detalle => {
          bancos += (detalle.debe || 0) - (detalle.haber || 0);
        });

        if (montoPagadoFinal > bancos) {
          toast({
            title: "🏦 Saldo insuficiente en bancos",
            description: `Disponible: $${formatCurrency(bancos)} | Necesitas: $${formatCurrency(montoPagadoFinal)}`,
            variant: "destructive"
          });
          setIsSaving(false);
          return;
        }
      }
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

      // Siempre crear un nuevo registro (nunca actualizar)
      let montoPagadoFinal = 0;
      let montoPendienteFinal = 0;
      let tipoPagoFinal = '';
      
      if (tipoPago === "total") {
        montoPagadoFinal = parseFloat(isrReal);
        montoPendienteFinal = 0;
        tipoPagoFinal = 'contado';
      } else if (tipoPago === "credito") {
        montoPagadoFinal = 0;
        montoPendienteFinal = parseFloat(isrReal);
        tipoPagoFinal = 'credito';
      } else if (tipoPago === "parcial") {
        montoPagadoFinal = parseFloat(montoPagado);
        montoPendienteFinal = parseFloat(isrReal) - parseFloat(montoPagado);
        tipoPagoFinal = 'parcial';
      }

      const { data: egresoData, error: egresoError } = await supabase
        .from('transacciones_egresos')
        .insert({
          user_id: user.id,
          tipo_egreso: 'impuesto',
          subtipo_egreso: 'ISR',
          descripcion: `ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado} - Pago ${registroExistente ? registroExistente.registros.length + 1 : 1}`,
          cuenta_codigo: '6001',
          monto_total: parseFloat(isrReal),
          monto_pagado: montoPagadoFinal,
          monto_pendiente: montoPendienteFinal,
          tipo_pago: tipoPagoFinal,
          metodo_pago: (tipoPago === "total" || tipoPago === "parcial") ? metodoPago : null,
          fecha_vencimiento: (tipoPago === "credito" || tipoPago === "parcial") ? fechaVencimiento : null,
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

      // Crear asiento contable (doble partida)
      const numeroAsiento = await generarNumeroAsiento();
      const fechaAsiento = new Date(anoSeleccionado, mesSeleccionado - 1, 1);

      const { data: asiento, error: asientoError } = await supabase
        .from('asientos_contables')
        .insert({
          user_id: user.id,
          numero_asiento: numeroAsiento,
          descripcion: `ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado} - Pago ${registroExistente ? registroExistente.registros.length + 1 : 1}`,
          fecha: fechaAsiento.toISOString().split('T')[0]
        })
        .select()
        .single();

      if (asientoError) throw asientoError;

      // Detalles del asiento (doble partida)
      let detalles;
      
      if (tipoPago === "total") {
        // Pago total: Debe ISR / Haber Bancos
        detalles = [
          {
            asiento_id: asiento.id,
            cuenta_codigo: '6001', // ISR (gasto)
            descripcion: `ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado} - Pago ${registroExistente ? registroExistente.registros.length + 1 : 1}`,
            debe: parseFloat(isrReal),
            haber: 0
          },
          {
            asiento_id: asiento.id,
            cuenta_codigo: '1002', // Bancos
            descripcion: `Pago ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado}`,
            debe: 0,
            haber: parseFloat(isrReal)
          }
        ];
      } else if (tipoPago === "credito") {
        // Pago a crédito: Debe ISR / Haber Proveedores (cuenta por pagar)
        detalles = [
          {
            asiento_id: asiento.id,
            cuenta_codigo: '6001', // ISR (gasto)
            descripcion: `ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado} - Pago ${registroExistente ? registroExistente.registros.length + 1 : 1}`,
            debe: parseFloat(isrReal),
            haber: 0
          },
          {
            asiento_id: asiento.id,
            cuenta_codigo: '2001', // Proveedores (pasivo - cuenta por pagar)
            descripcion: `Cuenta por pagar ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado}`,
            debe: 0,
            haber: parseFloat(isrReal)
          }
        ];
      } else {
        // Pago parcial: Debe ISR / Haber Bancos (pagado) + Haber Proveedores (pendiente)
        detalles = [
          {
            asiento_id: asiento.id,
            cuenta_codigo: '6001', // ISR (gasto)
            descripcion: `ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado} - Pago ${registroExistente ? registroExistente.registros.length + 1 : 1}`,
            debe: parseFloat(isrReal),
            haber: 0
          },
          {
            asiento_id: asiento.id,
            cuenta_codigo: '1002', // Bancos
            descripcion: `Pago parcial ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado}`,
            debe: 0,
            haber: montoPagadoFinal
          },
          {
            asiento_id: asiento.id,
            cuenta_codigo: '2001', // Proveedores (pasivo - cuenta por pagar)
            descripcion: `Saldo pendiente ISR ${meses[mesSeleccionado - 1]} ${anoSeleccionado}`,
            debe: 0,
            haber: montoPendienteFinal
          }
        ];
      }

      const { error: detallesError } = await supabase
        .from('detalle_asientos')
        .insert(detalles);

      if (detallesError) throw detallesError;

      let descripcionToast = "";
      if (tipoPago === "total") {
        descripcionToast = "El pago de ISR se registró correctamente con su asiento contable";
      } else if (tipoPago === "credito") {
        descripcionToast = "La cuenta por pagar de ISR se registró correctamente con su asiento contable";
      } else {
        descripcionToast = "El pago parcial de ISR y su cuenta por pagar se registraron correctamente";
      }

      toast({
        title: "Registro guardado",
        description: descripcionToast
      });

      // Limpiar formulario
      setIsrReal("");
      setObservaciones("");
      setTipoPago("total");
      setFechaVencimiento("");
      setMetodoPago("transferencia");
      setMontoPagado("");

      // Recargar datos
      const { data } = await supabase
        .from('transacciones_impuestos')
        .select('*')
        .eq('user_id', user.id)
        .eq('mes', mesSeleccionado)
        .eq('ano', anoSeleccionado)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const totalAcumulado = data.reduce((sum, reg) => sum + Number(reg.isr_real), 0);
        setRegistroExistente({
          registros: data,
          total_acumulado: totalAcumulado,
          ultimo_registro: data[0]
        });
      }

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

      {utilidadAntesImpuestos < 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ Este período tiene pérdidas ({formatCurrency(utilidadAntesImpuestos)}). 
            No se calcula ISR sobre resultados negativos. Puedes registrar un pago de $0.00 
            para documentar el período, o esperar a tener utilidades positivas.
          </AlertDescription>
        </Alert>
      )}

      {registroExistente && (
        <Alert className="border-blue-500 bg-blue-500/10">
          <CheckCircle2 className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-600 dark:text-blue-400">
            Has registrado un total acumulado de {formatCurrency(registroExistente.total_acumulado)} de ISR para {meses[mesSeleccionado - 1]} {anoSeleccionado} 
            ({registroExistente.registros.length} registro{registroExistente.registros.length > 1 ? 's' : ''}). 
            Puedes continuar agregando pagos adicionales.
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
                <p className="text-sm text-muted-foreground mb-2">
                  {utilidadAntesImpuestos > 0 
                    ? `ISR Calculado (${tasaISR}%)` 
                    : 'Sin impuesto (pérdida del período)'}
                </p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(isrCalculado)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {utilidadAntesImpuestos > 0 
                    ? `${tasaISR}% de ${formatCurrency(utilidadAntesImpuestos)}`
                    : 'No se genera ISR con resultados negativos'}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ISR Real a Pagar */}
      <Card>
        <CardHeader>
          <CardTitle>Monto Total del ISR</CardTitle>
          <CardDescription>
            Ingresa el monto TOTAL del ISR que corresponde a este período (este es el importe del impuesto, no lo que pagarás ahora)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="isr-real" className="text-base font-semibold">Monto TOTAL del ISR *</Label>
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
              placeholder="Ingresa el importe total del ISR"
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
              className="text-lg font-semibold"
            />
            {isrReal && !isNaN(parseFloat(isrReal)) && (
              <p className="text-sm font-medium text-primary">
                {parseFloat(isrReal).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
              </p>
            )}
            <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded border border-blue-200 dark:border-blue-800">
              ℹ️ <strong>Importante:</strong> Este es el monto total del impuesto que te corresponde pagar. En el siguiente paso elegirás cómo realizarás el pago.
            </p>
          </div>

          {isrReal && (
            (() => {
              const montoAnterior = registroExistente ? registroExistente.total_acumulado : 0;
              const faltantePrevio = isrCalculado - montoAnterior;
              const nuevoMonto = parseFloat(isrReal);
              const totalConNuevo = montoAnterior + nuevoMonto;
              const diferenciaFinal = totalConNuevo - isrCalculado;
              
              return (parseFloat(isrReal) !== isrCalculado || registroExistente) && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    <span className="font-semibold">Análisis del registro:</span>
                  </p>
                  <div className="text-sm text-amber-600 dark:text-amber-400 space-y-1">
                    <div className="flex justify-between">
                      <span>ISR según cálculo del período:</span>
                      <span className="font-semibold">{formatCurrency(isrCalculado)}</span>
                    </div>
                    {registroExistente && (
                      <>
                        <div className="flex justify-between">
                          <span>Ya has registrado (total acumulado):</span>
                          <span className="font-semibold">{formatCurrency(montoAnterior)}</span>
                        </div>
                        <div className="flex justify-between text-xs pt-1 border-t border-amber-500/20">
                          <span>Te {faltantePrevio >= 0 ? 'faltaba' : 'sobraba'}:</span>
                          <span className="font-medium">{formatCurrency(Math.abs(faltantePrevio))}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between pt-1 border-t border-amber-500/20">
                      <span>Vas a registrar ahora:</span>
                      <span className="font-semibold">{formatCurrency(nuevoMonto)}</span>
                    </div>
                    <div className="flex justify-between font-semibold bg-amber-500/20 p-2 rounded">
                      <span>Total que tendrás registrado:</span>
                      <span>{formatCurrency(totalConNuevo)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t-2 border-amber-500/30">
                      <span className="font-semibold">
                        Diferencia final vs cálculo:
                      </span>
                      <span className="font-bold">
                        {diferenciaFinal > 0 ? "+" : ""}
                        {formatCurrency(diferenciaFinal)}
                      </span>
                    </div>
                    <p className="text-xs pt-1 italic">
                      {Math.abs(diferenciaFinal) < 0.01
                        ? '✓ Coincidirá exactamente con el cálculo'
                        : diferenciaFinal > 0 
                          ? `${formatCurrency(Math.abs(diferenciaFinal))} por encima del cálculo`
                          : `${formatCurrency(Math.abs(diferenciaFinal))} por debajo del cálculo`
                      }
                    </p>
                  </div>
                </div>
              );
            })()
          )}

          <div className="space-y-2">
            <Label htmlFor="tipo-pago" className="text-base font-semibold">¿Cómo realizarás el pago de este ISR? *</Label>
            <Select value={tipoPago} onValueChange={setTipoPago}>
              <SelectTrigger id="tipo-pago">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">✓ Pago Total - Pagaré el 100% AHORA</SelectItem>
                <SelectItem value="parcial">⚡ Pago Parcial - Pagaré una PARTE ahora y el resto después</SelectItem>
                <SelectItem value="credito">📅 A Crédito - NO pagaré nada ahora (solo registrar la deuda)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoPago === "credito" && (
            <div className="space-y-2">
              <Label htmlFor="fecha-vencimiento">Fecha de Vencimiento *</Label>
              <Input
                id="fecha-vencimiento"
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
            </div>
          )}

          {(tipoPago === "total" || tipoPago === "parcial") && (
            <>
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

              {tipoPago === "parcial" && (
                <>
                  <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                    <Label htmlFor="monto-pagado" className="text-base font-bold text-blue-900 dark:text-blue-100">
                      💰 ¿Cuánto vas a pagar AHORA? *
                    </Label>
                    <Input
                      id="monto-pagado"
                      type="text"
                      placeholder="Ingresa solo el monto que pagarás en este momento"
                      value={montoPagado}
                      onChange={(e) => {
                        const value = e.target.value.replace(/,/g, '').replace(/[^\d.]/g, '');
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          setMontoPagado(value);
                        }
                      }}
                      onBlur={(e) => {
                        const num = parseFloat(montoPagado);
                        if (!isNaN(num)) {
                          setMontoPagado(num.toFixed(2));
                        }
                      }}
                      maxLength={20}
                      className="text-lg font-bold border-2"
                    />
                    {montoPagado && !isNaN(parseFloat(montoPagado)) && (
                      <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                        ✓ Pagarás: {parseFloat(montoPagado).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                      </p>
                    )}
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 bg-white/50 dark:bg-black/20 p-2 rounded">
                      ⚠️ Este NO es el total del ISR, es solo lo que vas a pagar en este momento. El resto quedará como saldo pendiente.
                    </p>
                  </div>

                  {montoPagado && isrReal && parseFloat(montoPagado) > 0 && parseFloat(isrReal) > 0 && (
                    <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-lg border-2 border-amber-400 dark:border-amber-700">
                      <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
                        📊 Resumen del Pago Parcial
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-black/20 rounded">
                          <span className="text-sm font-medium">Monto TOTAL de ISR:</span>
                          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {formatCurrency(parseFloat(isrReal))}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-green-100 dark:bg-green-900/30 rounded">
                          <span className="text-sm font-medium text-green-800 dark:text-green-300">✓ Pagarás AHORA:</span>
                          <span className="text-lg font-bold text-green-700 dark:text-green-400">
                            {formatCurrency(parseFloat(montoPagado))}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-red-100 dark:bg-red-900/30 rounded border-t-2 border-red-300 dark:border-red-700">
                          <span className="text-sm font-medium text-red-800 dark:text-red-300">📅 Quedará PENDIENTE:</span>
                          <span className="text-xl font-bold text-red-700 dark:text-red-400">
                            {formatCurrency(parseFloat(isrReal) - parseFloat(montoPagado))}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-3 italic font-medium">
                        ✓ El saldo pendiente se registrará como cuenta por pagar y deberás liquidarlo antes de la fecha de vencimiento.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="fecha-vencimiento-parcial">Fecha de Vencimiento del Saldo *</Label>
                    <Input
                      id="fecha-vencimiento-parcial"
                      type="date"
                      value={fechaVencimiento}
                      onChange={(e) => setFechaVencimiento(e.target.value)}
                    />
                  </div>
                </>
              )}
            </>
          )}

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
            disabled={
              !isrReal || 
              isSaving || 
              isPeriodoPasado() ||
              (utilidadAntesImpuestos <= 0 && parseFloat(isrReal || "0") !== 0)
            }
          >
            {isSaving ? "Guardando..." : "Guardar Nuevo Registro"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
