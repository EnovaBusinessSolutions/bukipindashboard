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
      // Determinar qué cuentas filtrar
      const cuentasFiltro = filtroMetodoPago === "consolidado" 
        ? ["1001", "1002"] 
        : filtroMetodoPago === "efectivo" 
          ? ["1001"] 
          : ["1002"];

      // Obtener todos los asientos que afectan efectivo/bancos
      const { data: asientos } = await supabase
        .from("asientos_contables")
        .select(`
          id,
          numero_asiento,
          fecha,
          descripcion,
          detalle_asientos(cuenta_codigo, debe, haber, descripcion)
        `)
        .gte("fecha", startDate.toISOString().split('T')[0])
        .lte("fecha", endDate.toISOString().split('T')[0])
        .order("fecha", { ascending: false });

      const ingresos: any[] = [];
      const egresos: any[] = [];
      const inversiones: any[] = [];
      const financiamientos: any[] = [];
      const amortizaciones: any[] = [];

      // Procesar cada asiento
      asientos?.forEach((asiento: any) => {
        const detalles = asiento.detalle_asientos || [];
        
        // Ver si afecta efectivo/bancos según filtro
        let impactoEfectivo = 0;
        let impactoBancos = 0;
        let afectaEfectivo = false;
        let afectaBancos = false;
        let metodoPago = "";

        detalles.forEach((det: any) => {
          if (det.cuenta_codigo === "1001") {
            afectaEfectivo = true;
            impactoEfectivo = (det.debe || 0) - (det.haber || 0);
            metodoPago = "efectivo";
          } else if (det.cuenta_codigo === "1002") {
            afectaBancos = true;
            impactoBancos = (det.debe || 0) - (det.haber || 0);
            metodoPago = "bancos";
          }
        });

        // Filtrar según método de pago
        if (!afectaEfectivo && !afectaBancos) return;
        if (filtroMetodoPago === "efectivo" && !afectaEfectivo) return;
        if (filtroMetodoPago === "bancos" && !afectaBancos) return;

        const montoTotal = impactoEfectivo + impactoBancos;
        if (montoTotal === 0) return;

        // Clasificar según contrapartidas
        let clasificado = false;

        detalles.forEach((det: any) => {
          const codigo = det.cuenta_codigo;
          if (codigo === "1001" || codigo === "1002") return;

          const transaccion = {
            id: asiento.id,
            created_at: asiento.fecha,
            descripcion: asiento.descripcion,
            metodo_pago: metodoPago,
            monto_total: Math.abs(montoTotal),
            monto_pagado: Math.abs(montoTotal)
          };

          // Ingresos (4XXX)
          if (codigo.startsWith("4") && montoTotal > 0) {
            ingresos.push({
              ...transaccion,
              tipo_ingreso: "venta",
              cliente_nombre: ""
            });
            clasificado = true;
          }
          // Egresos (5XXX, 6XXX)
          else if ((codigo.startsWith("5") || codigo.startsWith("6")) && montoTotal < 0) {
            egresos.push({
              ...transaccion,
              tipo_egreso: codigo.startsWith("5") ? "costo" : "gasto"
            });
            clasificado = true;
          }
          // Inversiones (1004, 15XX)
          else if ((codigo === "1004" || codigo.startsWith("15")) && montoTotal < 0) {
            inversiones.push({
              ...transaccion,
              producto_nombre: asiento.descripcion,
              categoria_activo: "activo_fijo",
              valor_total: Math.abs(montoTotal)
            });
            clasificado = true;
          }
          // Financiamientos
          else if (codigo.startsWith("20") || codigo.startsWith("21")) {
            if (montoTotal > 0) {
              financiamientos.push({
                ...transaccion,
                nombre: asiento.descripcion,
                institucion_financiera: "N/A",
                tipo_credito: "credito",
                saldo_inicial: montoTotal
              });
            } else {
              amortizaciones.push({
                ...transaccion,
                capital_pagado: Math.abs(montoTotal),
                interes_pagado: 0,
                financiamientos: { nombre: asiento.descripcion }
              });
            }
            clasificado = true;
          }
          // Capital (3001, 3002)
          else if (codigo === "3001" || codigo === "3002") {
            if (montoTotal > 0) {
              financiamientos.push({
                ...transaccion,
                nombre: "Aportación de Capital",
                institucion_financiera: "N/A",
                tipo_credito: "capital",
                saldo_inicial: montoTotal
              });
            }
            clasificado = true;
          }
        });
      });

      return {
        ingresos,
        egresos,
        inversiones,
        financiamientos,
        amortizaciones,
        intereses: []
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
                <TableHead className="text-right">Monto de Transacción</TableHead>
                <TableHead className="text-right">Monto Cobrado/Pagado</TableHead>
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
                <TableHead className="text-right">Monto de Transacción</TableHead>
                <TableHead className="text-right">Monto Cobrado/Pagado</TableHead>
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
                <TableHead className="text-right">Monto de Transacción</TableHead>
                <TableHead className="text-right">Monto Cobrado/Pagado</TableHead>
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
                <TableHead className="text-right">Monto Cobrado/Pagado</TableHead>
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
                  <TableHead className="text-right">Monto Cobrado/Pagado</TableHead>
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
