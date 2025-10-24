import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CreditCard, TrendingUp, Calendar } from "lucide-react";

interface TransaccionesTarjetaCreditoProps {
  financiamientoId: string;
  nombreTarjeta: string;
  limiteCredito: number;
  saldoActual: number;
}

const TransaccionesTarjetaCredito = ({ 
  financiamientoId, 
  nombreTarjeta,
  limiteCredito,
  saldoActual 
}: TransaccionesTarjetaCreditoProps) => {
  
  // Obtener todas las transacciones donde se usó esta tarjeta
  const { data: transacciones, isLoading } = useQuery({
    queryKey: ["transacciones-tarjeta", financiamientoId],
    queryFn: async () => {
      const metodoPagoBuscar = `tarjeta_credito_${financiamientoId}`;
      
      // Buscar en transacciones_egresos
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .eq("metodo_pago", metodoPagoBuscar)
        .order("created_at", { ascending: false });

      // Buscar en inversiones_capex
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("*")
        .eq("metodo_pago", metodoPagoBuscar)
        .order("created_at", { ascending: false });

      const todasTransacciones = [
        ...(egresos || []).map(e => ({
          id: e.id,
          fecha: e.created_at,
          descripcion: e.descripcion,
          monto: e.monto_pagado,
          tipo: 'egreso' as const,
          proveedor: e.proveedor_nombre
        })),
        ...(inversiones || []).map(i => ({
          id: i.id,
          fecha: i.fecha_adquisicion,
          descripcion: i.producto_nombre,
          monto: i.monto_pagado,
          tipo: 'capex' as const,
          proveedor: i.proveedor_nombre
        }))
      ];

      return todasTransacciones.sort((a, b) => 
        new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );
    }
  });

  const limiteDisponible = limiteCredito - saldoActual;
  const porcentajeUso = (saldoActual / limiteCredito) * 100;

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Límite de Crédito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${limiteCredito.toLocaleString('es-MX')}</div>
            <p className="text-xs text-muted-foreground mt-1">Línea aprobada</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Saldo Utilizado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${saldoActual.toLocaleString('es-MX')}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {porcentajeUso.toFixed(1)}% del límite
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Crédito Disponible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${limiteDisponible.toLocaleString('es-MX')}</div>
            <p className="text-xs text-muted-foreground mt-1">Puede utilizar</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de transacciones */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones de {nombreTarjeta}</CardTitle>
          <CardDescription>
            Historial de compras y pagos realizados con esta tarjeta
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando transacciones...</div>
          ) : !transacciones || transacciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay transacciones registradas con esta tarjeta
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transacciones.map((transaccion) => (
                  <TableRow key={transaccion.id}>
                    <TableCell>
                      {format(new Date(transaccion.fecha), "dd MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>{transaccion.descripcion}</TableCell>
                    <TableCell>{transaccion.proveedor || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={transaccion.tipo === 'egreso' ? 'secondary' : 'default'}>
                        {transaccion.tipo === 'egreso' ? 'Egreso' : 'CAPEX'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${transaccion.monto.toLocaleString('es-MX')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransaccionesTarjetaCredito;
