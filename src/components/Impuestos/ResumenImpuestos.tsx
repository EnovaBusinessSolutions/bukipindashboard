import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEstadoResultadosMensual } from "@/hooks/useEstadoResultadosMensual";

interface TransaccionImpuesto {
  id: string;
  mes: number;
  ano: number;
  utilidad_antes_impuestos: number;
  tasa_isr: number;
  isr_calculado: number;
  isr_real: number;
  diferencia: number;
  observaciones: string | null;
  created_at: string;
  egreso?: {
    tipo_pago: string;
    metodo_pago: string | null;
    monto_pagado: number;
    monto_pendiente: number;
    cuenta_codigo: string;
  } | null;
}

export const ResumenImpuestos = () => {
  const { user } = useAuth();
  const currentDate = new Date();
  const [transacciones, setTransacciones] = useState<TransaccionImpuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesSeleccionado, setMesSeleccionado] = useState<string>("todos");
  const [anoSeleccionado, setAnoSeleccionado] = useState<number>(currentDate.getFullYear());
  const [detalleAsiento, setDetalleAsiento] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Obtener utilidades REALES del año desde asientos contables
  const { data: resultadosMensuales } = useEstadoResultadosMensual(anoSeleccionado);

  useEffect(() => {
    if (!user) return;

    const fetchTransacciones = async () => {
      setLoading(true);
      
      // Construir query con filtros
      let query = supabase
        .from('transacciones_impuestos')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano', anoSeleccionado);
      
      // Aplicar filtro de mes si no es "todos"
      if (mesSeleccionado !== "todos") {
        query = query.eq('mes', parseInt(mesSeleccionado));
      }
      
      const { data: impuestosData, error: impuestosError } = await query.order('created_at', { ascending: false });

      if (impuestosError) {
        console.error("Error fetching transacciones:", impuestosError);
        setTransacciones([]);
      } else {
        // Obtener información de egresos relacionados para cada transacción
        const transaccionesConDetalles = await Promise.all(
          (impuestosData || []).map(async (t) => {
            // Buscar el egreso que corresponde específicamente a este registro
            // Usamos la fecha de creación del impuesto para encontrar el egreso más cercano
            const { data: egresoData } = await supabase
              .from('transacciones_egresos')
              .select('tipo_pago, metodo_pago, monto_pagado, monto_pendiente, cuenta_codigo, created_at')
              .eq('user_id', user.id)
              .eq('tipo_egreso', 'impuesto')
              .eq('subtipo_egreso', 'ISR')
              .ilike('descripcion', `%${meses[t.mes - 1]}%${t.ano}%`)
              .order('created_at', { ascending: false });

            // Buscar el egreso que coincida temporalmente con el registro de impuesto
            const egresoCorrespondiente = egresoData?.find(e => {
              const diffMs = Math.abs(new Date(e.created_at).getTime() - new Date(t.created_at).getTime());
              return diffMs < 5000; // Dentro de 5 segundos
            }) || egresoData?.[0];

            return {
              ...t,
              egreso: egresoCorrespondiente
            };
          })
        );

        setTransacciones(transaccionesConDetalles);
      }
      setLoading(false);
    };

    fetchTransacciones();

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel('transacciones_impuestos_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacciones_impuestos',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchTransacciones();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, mesSeleccionado, anoSeleccionado]);

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

  const verDetalleAsiento = async (transaccion: TransaccionImpuesto) => {
    // Buscar el asiento contable relacionado con los detalles y nombres de cuenta
    const { data: asientoData } = await supabase
      .from('asientos_contables')
      .select(`
        *,
        detalle_asientos (
          *,
          cuentas:cuenta_codigo (
            codigo,
            nombre
          )
        )
      `)
      .eq('user_id', user?.id)
      .ilike('descripcion', `%ISR%${meses[transaccion.mes - 1]}%${transaccion.ano}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (asientoData) {
      setDetalleAsiento({
        ...asientoData,
        transaccion
      });
      setDialogOpen(true);
    }
  };

  // Calcular utilidad acumulada REAL del año (desde asientos contables)
  const mesActual = currentDate.getMonth() + 1; // 1-12
  const añoActual = currentDate.getFullYear();
  
  // Solo acumular hasta el mes actual si estamos en el año actual
  const mesesParaAcumular = anoSeleccionado === añoActual 
    ? resultadosMensuales?.slice(0, mesActual) || []
    : resultadosMensuales || [];

  const utilidadAcumuladaReal = mesesParaAcumular.reduce(
    (sum, mes) => sum + mes.utilidadAntesImpuestos, 
    0
  );

  // ISR teórico que DEBERÍA calcularse (30% por defecto)
  const tasaISR = 0.30;
  const isrTeoricoAcumulado = utilidadAcumuladaReal > 0 
    ? utilidadAcumuladaReal * tasaISR 
    : 0;

  // ISR registrado (lo que YA pagaste)
  const isrRegistradoTotal = transacciones.reduce(
    (sum, t) => sum + Number(t.isr_real), 
    0
  );

  // Diferencia (cuánto falta o sobra)
  const diferencia = isrRegistradoTotal - isrTeoricoAcumulado;

  const totales = {
    utilidad: utilidadAcumuladaReal,
    calculado: isrTeoricoAcumulado,
    real: isrRegistradoTotal,
    diferencia: diferencia
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtra las transacciones por período</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mes-filtro">Mes</Label>
            <Select value={mesSeleccionado} onValueChange={setMesSeleccionado}>
              <SelectTrigger id="mes-filtro">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los meses</SelectItem>
                {meses.map((mes, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                    {mes}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ano-filtro">Año</Label>
            <Select value={anoSeleccionado.toString()} onValueChange={(value) => setAnoSeleccionado(parseInt(value))}>
              <SelectTrigger id="ano-filtro">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>
              Utilidad Acumulada {anoSeleccionado}
              {anoSeleccionado === añoActual && ` (hasta ${meses[mesActual - 1]})`}
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totales.utilidad)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Calculada desde asientos contables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>ISR Teórico (30%)</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totales.calculado)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Sobre utilidad acumulada del año
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>ISR Registrado</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totales.real)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {transacciones.length} pago{transacciones.length !== 1 ? 's' : ''} registrado{transacciones.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-2 ${
          diferencia > 0 ? 'border-amber-500' : 
          diferencia < 0 ? 'border-red-500' : 
          'border-green-500'
        }`}>
          <CardHeader className="pb-3">
            <CardDescription>Diferencia</CardDescription>
            <CardTitle className={`text-2xl ${
              diferencia > 0 ? 'text-amber-600' : 
              diferencia < 0 ? 'text-red-600' : 
              'text-green-600'
            }`}>
              {diferencia > 0 ? '+' : ''}{formatCurrency(diferencia)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {diferencia > 0 && '⚠️ Has pagado más de lo calculado'}
              {diferencia < 0 && `❌ Falta pagar ${formatCurrency(Math.abs(diferencia))}`}
              {diferencia === 0 && '✅ Estás al corriente'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Transacciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Historial de Transacciones
          </CardTitle>
          <CardDescription>
            Registro detallado mensual del ejercicio fiscal actual
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando transacciones...
            </div>
          ) : transacciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay transacciones registradas
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Utilidad</TableHead>
                    <TableHead className="text-right">Tasa</TableHead>
                    <TableHead className="text-right">ISR Calculado</TableHead>
                    <TableHead className="text-right">ISR Registrado</TableHead>
                    <TableHead>Tipo Pago</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Monto Pagado</TableHead>
                    <TableHead className="text-right">Saldo Pendiente</TableHead>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transacciones.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {meses[t.mes - 1]} {t.ano}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(t.utilidad_antes_impuestos)}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.tasa_isr}%
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(t.isr_calculado)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(t.isr_real)}
                      </TableCell>
                      <TableCell>
                        {t.egreso?.tipo_pago === 'contado' ? (
                          <Badge variant="secondary">Pago Total</Badge>
                        ) : t.egreso?.tipo_pago === 'credito' ? (
                          <Badge variant="outline">A Crédito</Badge>
                        ) : t.egreso?.tipo_pago === 'parcial' ? (
                          <Badge className="bg-amber-500">Pago Parcial</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.egreso?.metodo_pago ? (
                          <span className="capitalize">{t.egreso.metodo_pago}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.egreso?.monto_pagado ? (
                          <span className="text-green-600 font-semibold">
                            {formatCurrency(t.egreso.monto_pagado)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">$0.00</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.egreso?.monto_pendiente && t.egreso.monto_pendiente > 0 ? (
                          <span className="text-red-600 font-semibold">
                            {formatCurrency(t.egreso.monto_pendiente)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">$0.00</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono">
                          {t.egreso?.cuenta_codigo || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {t.egreso?.monto_pendiente && t.egreso.monto_pendiente > 0 ? (
                          <Badge variant="destructive">Por Pagar</Badge>
                        ) : t.egreso?.monto_pagado && t.egreso.monto_pagado > 0 ? (
                          <Badge className="bg-green-600">Pagado</Badge>
                        ) : (
                          <Badge variant="secondary">Registrado</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => verDetalleAsiento(t)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notas sobre Asientos Contables */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="text-sm">Asientos Contables</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Cada registro de impuesto genera automáticamente un asiento contable de doble partida:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Debe:</strong> Cuenta 6001 (ISR) - Monto del ISR</li>
            <li><strong>Haber:</strong> Cuenta 1002 (Bancos) o 2001 (Proveedores) según el tipo de pago</li>
          </ul>
          <p className="mt-3">Haz clic en el ícono del ojo para ver el desglose contable de cada transacción.</p>
        </CardContent>
      </Card>

      {/* Dialog para mostrar detalle del asiento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Desglose Contable</DialogTitle>
            <DialogDescription>
              Asiento: {detalleAsiento?.numero_asiento} - {detalleAsiento?.descripcion}
            </DialogDescription>
          </DialogHeader>
          
          {detalleAsiento && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Fecha:</p>
                  <p className="font-medium">{new Date(detalleAsiento.fecha).toLocaleDateString('es-MX')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ISR Registrado:</p>
                  <p className="font-medium">{formatCurrency(detalleAsiento.transaccion.isr_real)}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Debe</TableHead>
                      <TableHead className="text-right">Haber</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleAsiento.detalle_asientos?.map((detalle: any) => (
                      <TableRow key={detalle.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-mono text-sm font-medium">{detalle.cuenta_codigo}</p>
                            <p className="text-xs text-muted-foreground">{detalle.cuentas?.nombre || 'N/A'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{detalle.descripcion}</TableCell>
                        <TableCell className="text-right font-medium">
                          {detalle.debe > 0 ? formatCurrency(detalle.debe) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {detalle.haber > 0 ? formatCurrency(detalle.haber) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(
                          detalleAsiento.detalle_asientos?.reduce((sum: number, d: any) => sum + Number(d.debe), 0) || 0
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(
                          detalleAsiento.detalle_asientos?.reduce((sum: number, d: any) => sum + Number(d.haber), 0) || 0
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
