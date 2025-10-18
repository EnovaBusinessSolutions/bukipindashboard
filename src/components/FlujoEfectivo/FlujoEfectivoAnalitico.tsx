import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";
import { format } from "date-fns";

interface FlujoEfectivoAnaliticoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
}

interface Transaccion {
  fecha: string;
  referencia: string;
  tipo: string;
  descripcion: string;
  monto: number;
  categoria: string;
}

const FlujoEfectivoAnalitico = ({ startDate, endDate }: FlujoEfectivoAnaliticoProps) => {
  const { data: transacciones, isLoading } = useQuery({
    queryKey: ["flujo-efectivo-analitico", startDate, endDate],
    queryFn: async () => {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();
      const trans: Transaccion[] = [];

      // Ingresos
      const { data: ingresos } = await supabase
        .from("transacciones_ingresos")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      ingresos?.forEach(ing => {
        if (ing.monto_pagado > 0) {
          trans.push({
            fecha: format(new Date(ing.created_at), "dd/MM/yyyy"),
            referencia: `ING-${ing.id.slice(0, 8)}`,
            tipo: "Cobro",
            descripcion: ing.descripcion,
            monto: ing.monto_pagado,
            categoria: "Operativo"
          });
        }
      });

      // Egresos
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      egresos?.forEach(egr => {
        if (egr.monto_pagado > 0) {
          trans.push({
            fecha: format(new Date(egr.created_at), "dd/MM/yyyy"),
            referencia: `EGR-${egr.id.slice(0, 8)}`,
            tipo: "Pago",
            descripcion: egr.descripcion,
            monto: -egr.monto_pagado,
            categoria: "Operativo"
          });
        }
      });

      // Inversiones
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      inversiones?.forEach(inv => {
        if (inv.monto_pagado > 0) {
          trans.push({
            fecha: format(new Date(inv.created_at), "dd/MM/yyyy"),
            referencia: `INV-${inv.id.slice(0, 8)}`,
            tipo: "Inversión",
            descripcion: inv.producto_nombre,
            monto: -inv.monto_pagado,
            categoria: "Inversión"
          });
        }
      });

      // Financiamientos - Disposiciones
      const { data: financiamientos } = await supabase
        .from("financiamientos")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      financiamientos?.forEach(fin => {
        if (fin.saldo_inicial > 0) {
          trans.push({
            fecha: format(new Date(fin.created_at), "dd/MM/yyyy"),
            referencia: `FIN-${fin.id.slice(0, 8)}`,
            tipo: "Disposición",
            descripcion: fin.nombre,
            monto: fin.saldo_inicial,
            categoria: "Financiamiento"
          });
        }
      });

      // Financiamientos - Pagos
      const { data: pagos } = await supabase
        .from("transacciones_financiamientos")
        .select("*, financiamientos(nombre)")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      pagos?.forEach(pago => {
        const monto = (pago.capital_pagado || 0) + (pago.interes_pagado || 0);
        if (monto > 0) {
          trans.push({
            fecha: format(new Date(pago.created_at), "dd/MM/yyyy"),
            referencia: `PAG-${pago.id.slice(0, 8)}`,
            tipo: pago.tipo_transaccion === 'amortizacion' ? 'Amortización' : 'Interés',
            descripcion: (pago.financiamientos as any)?.nombre || pago.descripcion || "",
            monto: -monto,
            categoria: "Financiamiento"
          });
        }
      });

      return trans.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const porCategoria = {
    operativo: transacciones?.filter(t => t.categoria === 'Operativo') || [],
    inversion: transacciones?.filter(t => t.categoria === 'Inversión') || [],
    financiamiento: transacciones?.filter(t => t.categoria === 'Financiamiento') || []
  };

  const totales = {
    operativo: porCategoria.operativo.reduce((sum, t) => sum + t.monto, 0),
    inversion: porCategoria.inversion.reduce((sum, t) => sum + t.monto, 0),
    financiamiento: porCategoria.financiamiento.reduce((sum, t) => sum + t.monto, 0)
  };

  const totalGeneral = totales.operativo + totales.inversion + totales.financiamiento;

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Vista detallada de cada transacción que afecta el efectivo, con su fecha, referencia y categoría.
        </AlertDescription>
      </Alert>

      {/* Actividades Operativas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-green-600">Actividades Operativas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porCategoria.operativo.map((trans, index) => (
                <TableRow key={index}>
                  <TableCell className="text-sm">{trans.fecha}</TableCell>
                  <TableCell className="font-mono text-sm">{trans.referencia}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      trans.tipo === 'Cobro' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                    }`}>
                      {trans.tipo}
                    </span>
                  </TableCell>
                  <TableCell>{trans.descripcion}</TableCell>
                  <TableCell className={`text-right font-medium ${trans.monto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${Math.abs(trans.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={4}>Total Actividades Operativas</TableCell>
                <TableCell className={`text-right ${totales.operativo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totales.operativo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Actividades de Inversión */}
      <Card>
        <CardHeader>
          <CardTitle className="text-blue-600">Actividades de Inversión</CardTitle>
        </CardHeader>
        <CardContent>
          {porCategoria.inversion.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCategoria.inversion.map((trans, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-sm">{trans.fecha}</TableCell>
                    <TableCell className="font-mono text-sm">{trans.referencia}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">
                        {trans.tipo}
                      </span>
                    </TableCell>
                    <TableCell>{trans.descripcion}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      ${Math.abs(trans.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={4}>Total Actividades de Inversión</TableCell>
                  <TableCell className={`text-right ${totales.inversion >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${totales.inversion.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">
              No hay movimientos en este período
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actividades de Financiamiento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-purple-600">Actividades de Financiamiento</CardTitle>
        </CardHeader>
        <CardContent>
          {porCategoria.financiamiento.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCategoria.financiamiento.map((trans, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-sm">{trans.fecha}</TableCell>
                    <TableCell className="font-mono text-sm">{trans.referencia}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        trans.tipo === 'Disposición' ? 'bg-green-500/10 text-green-600' : 'bg-purple-500/10 text-purple-600'
                      }`}>
                        {trans.tipo}
                      </span>
                    </TableCell>
                    <TableCell>{trans.descripcion}</TableCell>
                    <TableCell className={`text-right font-medium ${trans.monto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${Math.abs(trans.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={4}>Total Actividades de Financiamiento</TableCell>
                  <TableCell className={`text-right ${totales.financiamiento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${totales.financiamiento.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">
              No hay movimientos en este período
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total General */}
      <Card className="bg-primary/5">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 items-center">
            <span className="text-2xl font-bold">Flujo Neto Total de Efectivo</span>
            <span className={`text-2xl font-bold text-right ${totalGeneral >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FlujoEfectivoAnalitico;
