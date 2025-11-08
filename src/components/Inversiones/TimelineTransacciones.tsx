import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTransaccionesInversiones, TipoTransaccion } from "@/hooks/useTransaccionesInversiones";
import { useAsientosInversion } from "@/hooks/useAsientosInversion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Eye, Trash2, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import SimuladorDepreciaciones from "./SimuladorDepreciaciones";

const TimelineTransacciones = () => {
  const { data: transacciones, isLoading } = useTransaccionesInversiones();
  const [selectedAsientoId, setSelectedAsientoId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleLimpiarSimulaciones = async () => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data, error } = await supabase.functions.invoke(
        'limpiar-depreciaciones-simuladas',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;

      toast.success(`Se eliminaron ${data.asientosEliminados} depreciaciones simuladas`);
      queryClient.invalidateQueries({ queryKey: ["transacciones-inversiones"] });
    } catch (error: any) {
      console.error('Error limpiando simulaciones:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  const transaccionesSimuladas = transacciones?.filter(t => t.tipo === 'depreciacion_simulada') || [];
  const totalInvertido = transacciones?.filter(t => t.tipo === 'inversion').reduce((sum, t) => sum + t.monto, 0) || 0;
  const totalDepreciado = transacciones?.filter(t => t.tipo === 'depreciacion' || t.tipo === 'depreciacion_simulada').reduce((sum, t) => sum + t.monto, 0) || 0;

  const getTipoBadge = (tipo: TipoTransaccion) => {
    const configs = {
      inversion: { icon: TrendingUp, label: "Inversión", variant: "default" as const },
      depreciacion: { icon: Activity, label: "Depreciación", variant: "secondary" as const },
      depreciacion_simulada: { icon: Activity, label: "Depreciación (Simulada)", variant: "outline" as const },
      baja: { icon: TrendingDown, label: "Baja de Activo", variant: "destructive" as const },
      venta: { icon: TrendingDown, label: "Venta de Activo", variant: "secondary" as const },
    };
    const config = configs[tipo];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Agrupar transacciones por mes
  const transaccionesPorMes = transacciones?.reduce((acc, t) => {
    const mesAno = format(new Date(t.fecha), "MMMM yyyy", { locale: es });
    if (!acc[mesAno]) acc[mesAno] = [];
    acc[mesAno].push(t);
    return acc;
  }, {} as Record<string, typeof transacciones>) || {};

  return (
    <div className="space-y-6">
      {/* Simulador */}
      <SimuladorDepreciaciones />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Invertido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalInvertido.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Depreciado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalDepreciado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Transacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transacciones?.length || 0}</div>
          </CardContent>
        </Card>

        {transaccionesSimuladas.length > 0 && (
          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Simulaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{transaccionesSimuladas.length}</div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="mt-2 w-full"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpiar Simuladas
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar depreciaciones simuladas?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminarán {transaccionesSimuladas.length} depreciaciones simuladas.
                      <br /><br />
                      <strong>Las inversiones y depreciaciones reales NO se afectarán.</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLimpiarSimulaciones} disabled={isDeleting}>
                      Eliminar Simulaciones
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline de Transacciones</CardTitle>
          <CardDescription>
            Historial completo de inversiones, depreciaciones y bajas de activos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(transaccionesPorMes).map(([mes, transaccionesMes]) => (
              <div key={mes}>
                <h3 className="text-lg font-semibold mb-3 capitalize">{mes}</h3>
                <div className="space-y-3">
                  {transaccionesMes.map((transaccion) => (
                    <Card key={transaccion.id} className={transaccion.tipo === 'depreciacion_simulada' ? 'border-orange-200 bg-orange-50/30' : ''}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              {getTipoBadge(transaccion.tipo)}
                              <span className="font-semibold">{transaccion.activoNombre}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(transaccion.fecha), "dd 'de' MMMM, yyyy", { locale: es })}
                            </div>
                            <div className="text-lg font-bold">
                              ${transaccion.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <DetalleAsientoDialog asientoId={transaccion.asientoId} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Componente separado para mostrar el detalle del asiento
const DetalleAsientoDialog = ({ asientoId }: { asientoId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [detalles, setDetalles] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadDetalles = async () => {
    setLoading(true);
    try {
      const { data: asiento, error } = await supabase
        .from("asientos_contables")
        .select(`
          id,
          numero_asiento,
          descripcion,
          fecha,
          detalle_asientos (
            id,
            cuenta_codigo,
            debe,
            haber,
            descripcion
          )
        `)
        .eq("id", asientoId)
        .single();

      if (error) throw error;

      // Obtener nombres de cuentas
      const cuentasCodigos = asiento.detalle_asientos.map((d: any) => d.cuenta_codigo);
      const { data: cuentas } = await supabase
        .from("cuentas")
        .select("codigo, nombre")
        .in("codigo", cuentasCodigos);

      const cuentasMap = new Map(cuentas?.map(c => [c.codigo, c.nombre]) || []);

      asiento.detalle_asientos = asiento.detalle_asientos.map((d: any) => ({
        ...d,
        cuenta_nombre: cuentasMap.get(d.cuenta_codigo) || d.cuenta_codigo,
      }));

      setDetalles(asiento);
    } catch (error) {
      console.error('Error cargando detalles:', error);
      toast.error('Error cargando detalles del asiento');
    } finally {
      setLoading(false);
    }
  };

  const totalDebe = detalles?.detalle_asientos?.reduce((sum: number, d: any) => sum + Number(d.debe), 0) || 0;
  const totalHaber = detalles?.detalle_asientos?.reduce((sum: number, d: any) => sum + Number(d.haber), 0) || 0;
  const cuadrado = Math.abs(totalDebe - totalHaber) < 0.01;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={loadDetalles}>
          <Eye className="h-4 w-4 mr-1" />
          Ver Asiento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle del Asiento Contable</DialogTitle>
        </DialogHeader>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : detalles ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Número:</span>{" "}
                <span className="font-medium">{detalles.numero_asiento}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Fecha:</span>{" "}
                <span className="font-medium">
                  {format(new Date(detalles.fecha), "dd/MM/yyyy")}
                </span>
              </div>
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
                {detalles.detalle_asientos.map((detalle: any) => (
                  <TableRow key={detalle.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">
                          {detalle.cuenta_codigo} - {detalle.cuenta_nombre}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {detalle.descripcion}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {detalle.debe > 0 ? (
                        <span className="text-green-600">
                          ${Number(detalle.debe).toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {detalle.haber > 0 ? (
                        <span className="text-blue-600">
                          ${Number(detalle.haber).toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/50">
                  <TableCell>Totales</TableCell>
                  <TableCell className="text-right font-mono text-green-600">
                    ${totalDebe.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-blue-600">
                    ${totalHaber.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Alert variant={cuadrado ? "default" : "destructive"}>
              <AlertDescription>
                {cuadrado ? "✅ Asiento Cuadrado" : "❌ Asiento Descuadrado"} |
                Debe: ${totalDebe.toFixed(2)} | Haber: ${totalHaber.toFixed(2)}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default TimelineTransacciones;
