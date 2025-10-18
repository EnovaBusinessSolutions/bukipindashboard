import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface ResumenTransaccionesProps {
  startDate: Date;
  endDate: Date;
  filtroMetodoPago: "consolidado" | "efectivo" | "bancos";
}

const ResumenTransacciones = ({ startDate, endDate, filtroMetodoPago }: ResumenTransaccionesProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ["resumen-transacciones", startDate, endDate, filtroMetodoPago],
    queryFn: async () => {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Ingresos
      const { data: ingresos } = await supabase
        .from("transacciones_ingresos")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: false });

      // Filtrar ingresos según método de pago
      const ingresosFiltrados = filtroMetodoPago === "consolidado" 
        ? ingresos 
        : ingresos?.filter(ing => ing.metodo_pago === filtroMetodoPago);

      // Egresos
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: false });

      // Filtrar egresos según método de pago
      const egresosFiltrados = filtroMetodoPago === "consolidado" 
        ? egresos 
        : egresos?.filter(egr => egr.metodo_pago === filtroMetodoPago);

      // Inversiones
      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: false });

      // Filtrar inversiones según método de pago
      const inversionesFiltradas = filtroMetodoPago === "consolidado" 
        ? inversiones 
        : inversiones?.filter(inv => inv.metodo_pago === filtroMetodoPago);

      // Financiamientos (siempre asumimos que son bancos)
      const { data: financiamientos } = await supabase
        .from("financiamientos")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: false });

      // Filtrar financiamientos: solo si es consolidado o bancos
      const financiamientosFiltrados = (filtroMetodoPago === "consolidado" || filtroMetodoPago === "bancos") 
        ? financiamientos 
        : [];

      // Amortizaciones
      const { data: amortizaciones } = await supabase
        .from("transacciones_financiamientos")
        .select("*, financiamientos(nombre)")
        .eq("tipo_transaccion", "amortizacion")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: false });

      // Filtrar amortizaciones según método de pago
      const amortizacionesFiltradas = filtroMetodoPago === "consolidado" 
        ? amortizaciones 
        : amortizaciones?.filter(amort => amort.metodo_pago === filtroMetodoPago);

      // Cargos de interés
      const { data: intereses } = await supabase
        .from("transacciones_financiamientos")
        .select("*, financiamientos(nombre)")
        .eq("tipo_transaccion", "cargo_interes")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: false });

      // Filtrar intereses según método de pago
      const interesesFiltrados = filtroMetodoPago === "consolidado" 
        ? intereses 
        : intereses?.filter(int => int.metodo_pago === filtroMetodoPago);

      return {
        ingresos: ingresosFiltrados || [],
        egresos: egresosFiltrados || [],
        inversiones: inversionesFiltradas || [],
        financiamientos: financiamientosFiltrados || [],
        amortizaciones: amortizacionesFiltradas || [],
        intereses: interesesFiltrados || []
      };
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: es });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ingresos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ingresos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Monto Total</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.ingresos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No hay ingresos registrados</TableCell>
                </TableRow>
              ) : (
                data?.ingresos.map((ingreso) => (
                  <TableRow key={ingreso.id}>
                    <TableCell>{formatDate(ingreso.created_at)}</TableCell>
                    <TableCell>{ingreso.descripcion}</TableCell>
                    <TableCell>{ingreso.cliente_nombre || "-"}</TableCell>
                    <TableCell><Badge variant="outline">{ingreso.metodo_pago}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(ingreso.monto_total)}</TableCell>
                    <TableCell className="text-right text-finance-success font-medium">{formatCurrency(ingreso.monto_pagado)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Egresos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Egresos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Monto Total</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.egresos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No hay egresos registrados</TableCell>
                </TableRow>
              ) : (
                data?.egresos.map((egreso) => (
                  <TableRow key={egreso.id}>
                    <TableCell>{formatDate(egreso.created_at)}</TableCell>
                    <TableCell>{egreso.descripcion}</TableCell>
                    <TableCell><Badge>{egreso.tipo_egreso}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{egreso.metodo_pago || "-"}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(egreso.monto_total)}</TableCell>
                    <TableCell className="text-right text-destructive font-medium">{formatCurrency(egreso.monto_pagado)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Inversiones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Inversiones</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.inversiones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No hay inversiones registradas</TableCell>
                </TableRow>
              ) : (
                data?.inversiones.map((inversion) => (
                  <TableRow key={inversion.id}>
                    <TableCell>{formatDate(inversion.created_at)}</TableCell>
                    <TableCell>{inversion.producto_nombre}</TableCell>
                    <TableCell><Badge>{inversion.categoria_activo}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{inversion.metodo_pago || "-"}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(inversion.valor_total)}</TableCell>
                    <TableCell className="text-right text-destructive font-medium">{formatCurrency(inversion.monto_pagado)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Financiamientos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Financiamientos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Institución</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.financiamientos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">No hay financiamientos registrados</TableCell>
                </TableRow>
              ) : (
                data?.financiamientos.map((financiamiento) => (
                  <TableRow key={financiamiento.id}>
                    <TableCell>{formatDate(financiamiento.created_at)}</TableCell>
                    <TableCell>{financiamiento.nombre}</TableCell>
                    <TableCell>{financiamiento.institucion_financiera}</TableCell>
                    <TableCell><Badge>{financiamiento.tipo_credito}</Badge></TableCell>
                    <TableCell className="text-right text-finance-success font-medium">{formatCurrency(financiamiento.saldo_inicial)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Amortizaciones */}
      {(data?.amortizaciones && data.amortizaciones.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Amortizaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Financiamiento</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Capital</TableHead>
                  <TableHead className="text-right">Interés</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.amortizaciones.map((amort: any) => (
                  <TableRow key={amort.id}>
                    <TableCell>{formatDate(amort.created_at)}</TableCell>
                    <TableCell>{amort.financiamientos?.nombre || "-"}</TableCell>
                    <TableCell><Badge variant="outline">{amort.metodo_pago || "-"}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(amort.capital_pagado || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(amort.interes_pagado || 0)}</TableCell>
                    <TableCell className="text-right text-destructive font-medium">
                      {formatCurrency((amort.capital_pagado || 0) + (amort.interes_pagado || 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResumenTransacciones;
