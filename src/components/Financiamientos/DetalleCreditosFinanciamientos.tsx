import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const DetalleCreditosFinanciamientos = () => {
  const { financiamientos, isLoading } = useFinanciamientos();

  const getTipoCreditoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      simple: "Crédito Simple",
      arrendamiento: "Arrendamiento",
      revolvente: "Crédito Revolvente",
      tarjeta_corporativa: "Tarjeta Corporativa",
    };
    return labels[tipo] || tipo;
  };

  const getEstadoBadgeVariant = (estado: string): "default" | "secondary" | "destructive" => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      activo: "default",
      pagado: "secondary",
      vencido: "destructive",
    };
    return variants[estado] || "default";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const creditosActivos = financiamientos.filter(f => f.estado === "activo");
  const creditosPagados = financiamientos.filter(f => f.estado === "pagado");
  const creditosVencidos = financiamientos.filter(f => f.estado === "vencido");

  return (
    <div className="space-y-6">
      {/* Créditos Activos */}
      <Card>
        <CardHeader>
          <CardTitle>Créditos Activos ({creditosActivos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {creditosActivos.map((f) => (
              <div key={f.id} className="border rounded-lg p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-lg">{f.nombre}</h4>
                    <p className="text-sm text-muted-foreground">{f.institucion_financiera}</p>
                    {f.numero_cuenta && (
                      <p className="text-xs text-muted-foreground mt-1">Cuenta: {f.numero_cuenta}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Badge>{getTipoCreditoLabel(f.tipo_credito)}</Badge>
                    <Badge variant={getEstadoBadgeVariant(f.estado)}>{f.estado.toUpperCase()}</Badge>
                  </div>
                </div>

                {f.descripcion && (
                  <p className="text-sm text-muted-foreground">{f.descripcion}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Monto Original</p>
                    <p className="font-semibold">${f.monto_total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo Actual</p>
                    <p className="font-semibold text-red-600">${f.saldo_actual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tasa de Interés</p>
                    <p className="font-semibold">{f.tasa_interes}% anual</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Plazo</p>
                    <p className="font-semibold">{f.plazo_meses} meses</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha de Inicio</p>
                    <p className="text-sm">{format(new Date(f.fecha_inicio), "dd/MM/yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha de Vencimiento</p>
                    <p className="text-sm">{format(new Date(f.fecha_vencimiento), "dd/MM/yyyy")}</p>
                  </div>
                </div>

                {f.condiciones && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Condiciones</p>
                    <p className="text-sm bg-muted p-2 rounded">{f.condiciones}</p>
                  </div>
                )}

                {/* Barra de progreso diferente para tarjetas y créditos revolventes */}
                {f.tipo_credito === "tarjeta_corporativa" || f.tipo_credito === "revolvente" ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Uso de Línea de Crédito</span>
                      <span className="font-medium">
                        {(f.saldo_actual / f.monto_total * 100).toFixed(1)}% utilizado
                      </span>
                    </div>
                    <div className="w-full bg-green-100 rounded-full h-3 flex overflow-hidden">
                      <div
                        className="bg-green-500 h-3 transition-all"
                        style={{
                          width: `${((f.monto_total - f.saldo_actual) / f.monto_total) * 100}%`,
                        }}
                        title="Línea Disponible"
                      />
                      <div
                        className="bg-red-500 h-3 transition-all"
                        style={{
                          width: `${(f.saldo_actual / f.monto_total) * 100}%`,
                        }}
                        title="Saldo Pendiente"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-green-500 rounded"></span>
                        Disponible: ${(f.monto_total - f.saldo_actual).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-red-500 rounded"></span>
                        Pendiente: ${f.saldo_actual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progreso de Pago</span>
                      <span className="font-medium">
                        {((f.monto_total - f.saldo_actual) / f.monto_total * 100).toFixed(1)}% completado
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-primary h-3 rounded-full transition-all"
                        style={{
                          width: `${((f.monto_total - f.saldo_actual) / f.monto_total) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Pagado: ${(f.monto_total - f.saldo_actual).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      <span>Pendiente: ${f.saldo_actual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {creditosActivos.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No hay créditos activos
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Créditos Pagados */}
      {creditosPagados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Créditos Pagados ({creditosPagados.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {creditosPagados.map((f) => (
                <div key={f.id} className="border rounded-lg p-4 opacity-75">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">{f.nombre}</h4>
                      <p className="text-sm text-muted-foreground">{f.institucion_financiera}</p>
                    </div>
                    <Badge variant="secondary">PAGADO</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Monto Total</p>
                      <p className="font-medium">${f.monto_total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha de Inicio</p>
                      <p className="text-sm">{format(new Date(f.fecha_inicio), "dd/MM/yyyy")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha de Vencimiento</p>
                      <p className="text-sm">{format(new Date(f.fecha_vencimiento), "dd/MM/yyyy")}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Créditos Vencidos */}
      {creditosVencidos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Créditos Vencidos ({creditosVencidos.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {creditosVencidos.map((f) => (
                <div key={f.id} className="border border-red-300 rounded-lg p-4 bg-red-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-red-900">{f.nombre}</h4>
                      <p className="text-sm text-red-700">{f.institucion_financiera}</p>
                    </div>
                    <Badge variant="destructive">VENCIDO</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <div>
                      <p className="text-xs text-red-600">Saldo Pendiente</p>
                      <p className="font-bold text-red-900">${f.saldo_actual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-red-600">Tasa</p>
                      <p className="font-medium">{f.tasa_interes}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-red-600">Fecha de Vencimiento</p>
                      <p className="text-sm font-medium">{format(new Date(f.fecha_vencimiento), "dd/MM/yyyy")}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DetalleCreditosFinanciamientos;
