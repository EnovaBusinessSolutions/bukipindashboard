import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, TrendingUp, TrendingDown } from "lucide-react";

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
  const [transacciones, setTransacciones] = useState<TransaccionImpuesto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchTransacciones = async () => {
      setLoading(true);
      const currentYear = new Date().getFullYear();
      
      // Obtener transacciones de impuestos del ejercicio fiscal actual
      const { data: impuestosData, error: impuestosError } = await supabase
        .from('transacciones_impuestos')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano', currentYear)
        .order('mes', { ascending: false });

      if (impuestosError) {
        console.error("Error fetching transacciones:", impuestosError);
        setTransacciones([]);
      } else {
        // Obtener información de egresos relacionados para cada transacción
        const transaccionesConDetalles = await Promise.all(
          (impuestosData || []).map(async (t) => {
            const { data: egresoData } = await supabase
              .from('transacciones_egresos')
              .select('tipo_pago, metodo_pago, monto_pagado, monto_pendiente, cuenta_codigo')
              .eq('user_id', user.id)
              .eq('tipo_egreso', 'impuesto')
              .eq('subtipo_egreso', 'ISR')
              .ilike('descripcion', `%${meses[t.mes - 1]}%${t.ano}%`)
              .maybeSingle();

            return {
              ...t,
              egreso: egresoData
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
  }, [user]);

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

  const totales = transacciones.reduce(
    (acc, t) => ({
      utilidad: acc.utilidad + Number(t.utilidad_antes_impuestos),
      calculado: acc.calculado + Number(t.isr_calculado),
      real: acc.real + Number(t.isr_real),
      diferencia: acc.diferencia + Number(t.diferencia)
    }),
    { utilidad: 0, calculado: 0, real: 0, diferencia: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Utilidad Total</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totales.utilidad)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>ISR Calculado</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totales.calculado)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>ISR Registrado</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totales.real)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Diferencia</CardDescription>
            <CardTitle className={`text-2xl flex items-center gap-2 ${totales.diferencia > 0 ? 'text-red-600' : totales.diferencia < 0 ? 'text-green-600' : ''}`}>
              {totales.diferencia > 0 && <TrendingUp className="h-5 w-5" />}
              {totales.diferencia < 0 && <TrendingDown className="h-5 w-5" />}
              {formatCurrency(Math.abs(totales.diferencia))}
            </CardTitle>
          </CardHeader>
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
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead>Tipo Pago</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Monto Pagado</TableHead>
                    <TableHead className="text-right">Saldo Pendiente</TableHead>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transacciones.map((t) => (
                    <TableRow key={t.id}>
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
                      <TableCell className={`text-right font-semibold ${
                        t.diferencia > 0 ? 'text-red-600' : 
                        t.diferencia < 0 ? 'text-green-600' : ''
                      }`}>
                        {t.diferencia > 0 ? '+' : ''}
                        {formatCurrency(t.diferencia)}
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
          <p className="mt-3">Estos asientos se reflejan automáticamente en tu Balance General y en la Balanza de Comprobación.</p>
        </CardContent>
      </Card>
    </div>
  );
};
