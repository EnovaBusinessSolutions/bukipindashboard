import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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

      // Detectar transacciones canceladas PRIMERO
      const transaccionesCanceladas: any[] = [];
      const asientosReversiones = new Set<string>();

      asientos?.forEach((asiento: any) => {
        // Detectar si es un asiento de reversión
        if (asiento.descripcion.includes('REVERSIÓN:') || 
            asiento.numero_asiento.startsWith('REV-')) {
          
          // Extraer el nombre del producto de la descripción
          const descripcionReversion = asiento.descripcion.replace('REVERSIÓN: Compra de inventario: ', '');
          
          // Buscar asiento original con el mismo producto en fechas cercanas
          const asientoOriginal = asientos.find((a: any) => 
            a.descripcion.includes(`Compra de inventario: ${descripcionReversion}`) &&
            !a.descripcion.includes('REVERSIÓN:') &&
            a.numero_asiento.startsWith('COMP-INV-') &&
            // Buscar en un rango de 7 días antes de la reversión
            new Date(a.fecha) <= new Date(asiento.fecha)
          );
          
          if (asientoOriginal) {
            // Marcar ambos como procesados para no duplicar
            asientosReversiones.add(asiento.id);
            asientosReversiones.add(asientoOriginal.id);
            
            // Obtener detalles de ambos asientos
            const detallesOriginal = asientoOriginal.detalle_asientos || [];
            const detallesReversion = asiento.detalle_asientos || [];
            
            // Calcular impacto en efectivo/bancos
            let montoOriginal = 0;
            let montoReversion = 0;
            let metodoPago = "";
            
            detallesOriginal.forEach((det: any) => {
              if (det.cuenta_codigo === "1001" || det.cuenta_codigo === "1002") {
                montoOriginal = (det.debe || 0) - (det.haber || 0);
                metodoPago = det.cuenta_codigo === "1001" ? "efectivo" : "bancos";
              }
            });
            
            // Aplicar filtro de método de pago
            const metodoCumpleFiltro = 
              filtroMetodoPago === "consolidado" || 
              (filtroMetodoPago === "efectivo" && metodoPago === "efectivo") ||
              (filtroMetodoPago === "bancos" && metodoPago === "bancos");
            
            if (!metodoCumpleFiltro) return;
            
            detallesReversion.forEach((det: any) => {
              if (det.cuenta_codigo === "1001" || det.cuenta_codigo === "1002") {
                montoReversion = (det.debe || 0) - (det.haber || 0);
              }
            });
            
            // Extraer motivo de cancelación de la descripción
            let motivoCancelacion = "No especificado";
            if (asiento.descripcion.includes('Motivo: ')) {
              motivoCancelacion = asiento.descripcion.split('Motivo: ')[1];
            }
            
            // Agregar a transacciones canceladas
            transaccionesCanceladas.push({
              id: `cancelacion-${asientoOriginal.numero_asiento}`,
              movimiento_id: asientoOriginal.numero_asiento.replace('COMP-INV-', ''),
              fecha_original: asientoOriginal.fecha,
              fecha_cancelacion: asiento.fecha,
              descripcion: descripcionReversion,
              motivo_cancelacion: motivoCancelacion,
              metodo_pago: metodoPago,
              monto_original: Math.abs(montoOriginal),
              monto_reversion: Math.abs(montoReversion),
              monto_neto: 0,
              asiento_original: asientoOriginal,
              asiento_reversion: asiento,
              detalles_original: detallesOriginal,
              detalles_reversion: detallesReversion
            });
          }
        }
      });

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
        
        // Excluir asientos que son parte de reversiones detectadas
        if (asientosReversiones.has(asiento.id)) return;
        
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
          // Compras de Inventario (1005, 1006) ✅ CRÍTICO - AHORA INCLUIDO
          else if ((codigo === "1005" || codigo === "1006") && montoTotal < 0) {
            egresos.push({
              ...transaccion,
              tipo_egreso: "compra_inventario"
            });
            clasificado = true;
          }
          // Egresos operativos (5XXX, 6XXX)
          else if ((codigo.startsWith("5") || codigo.startsWith("6")) && montoTotal < 0) {
            egresos.push({
              ...transaccion,
              tipo_egreso: codigo.startsWith("5") ? "costo" : "gasto"
            });
            clasificado = true;
          }
          // Pagos a proveedores y pasivos (2001-2006) - DETECTAR PRIMERO
          else if (["2001", "2002", "2003", "2004", "2005", "2006"].includes(codigo) && montoTotal < 0) {
            egresos.push({
              ...transaccion,
              tipo_egreso: "pago_proveedor"
            });
            clasificado = true;
          }
          // Inversiones (12XX, 13XX activos fijos y diferidos)
          else if (((codigo.startsWith("12") && parseInt(codigo) >= 1201) || codigo.startsWith("13")) && montoTotal < 0) {
            inversiones.push({
              ...transaccion,
              producto_nombre: asiento.descripcion,
              categoria_activo: codigo.startsWith("12") ? "activo_fijo" : "activo_diferido",
              valor_total: Math.abs(montoTotal)
            });
            clasificado = true;
          }
          // Financiamientos (excluir CxP 2001-2006)
          else if ((codigo.startsWith("20") || codigo.startsWith("21")) && 
                   !["2001", "2002", "2003", "2004", "2005", "2006"].includes(codigo)) {
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
        intereses: [],
        transaccionesCanceladas
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

      {/* Transacciones Canceladas */}
      {(data?.transaccionesCanceladas && data.transaccionesCanceladas.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Compras de Inventario Canceladas
              <Badge variant="outline" className="text-xs">Neto: $0.00</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {data.transaccionesCanceladas.map((cancelacion: any) => (
                <AccordionItem key={cancelacion.id} value={cancelacion.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex justify-between items-center w-full pr-4">
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary">Cancelada</Badge>
                        <span className="font-medium">{cancelacion.descripcion}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(cancelacion.fecha_original)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{cancelacion.metodo_pago}</Badge>
                        <span className="font-mono text-muted-foreground">
                          {formatCurrency(0)}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      {/* Asiento Original */}
                      <div className="border rounded-lg p-4 bg-red-50/50 dark:bg-red-950/20">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold text-sm">
                            📥 Transacción Original (Salida)
                          </h4>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(cancelacion.fecha_original)}
                          </span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cuenta</TableHead>
                              <TableHead className="text-right">Debe</TableHead>
                              <TableHead className="text-right">Haber</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cancelacion.detalles_original.map((det: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="text-sm">
                                  {det.cuenta_codigo} - {det.descripcion}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {det.debe > 0 ? formatCurrency(det.debe) : "-"}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {det.haber > 0 ? formatCurrency(det.haber) : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-medium bg-red-100/50 dark:bg-red-900/30">
                              <TableCell>Impacto en Efectivo/Bancos</TableCell>
                              <TableCell className="text-right">-</TableCell>
                              <TableCell className="text-right text-destructive">
                                -{formatCurrency(cancelacion.monto_original)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      {/* Asiento de Reversión */}
                      <div className="border rounded-lg p-4 bg-green-50/50 dark:bg-green-950/20">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold text-sm">
                            📤 Reversión (Entrada)
                          </h4>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(cancelacion.fecha_cancelacion)}
                          </span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cuenta</TableHead>
                              <TableHead className="text-right">Debe</TableHead>
                              <TableHead className="text-right">Haber</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cancelacion.detalles_reversion.map((det: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="text-sm">
                                  {det.cuenta_codigo} - {det.descripcion}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {det.debe > 0 ? formatCurrency(det.debe) : "-"}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {det.haber > 0 ? formatCurrency(det.haber) : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-medium bg-green-100/50 dark:bg-green-900/30">
                              <TableCell>Impacto en Efectivo/Bancos</TableCell>
                              <TableCell className="text-right text-finance-success">
                                +{formatCurrency(cancelacion.monto_reversion)}
                              </TableCell>
                              <TableCell className="text-right">-</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      {/* Resultado Neto */}
                      <div className="border-2 border-primary/30 rounded-lg p-4 bg-primary/5">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-bold text-sm mb-1">💰 Impacto Neto</h4>
                            <p className="text-xs text-muted-foreground">
                              <strong>Motivo:</strong> {cancelacion.motivo_cancelacion}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              {formatCurrency(0)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              (Sin impacto en flujo de efectivo)
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

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
