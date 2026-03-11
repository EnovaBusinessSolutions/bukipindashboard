import React, { useMemo } from "react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const getTipoUi = (f: any) => {
  const raw = String(f?.tipo || f?.tipo_credito || "").toLowerCase();

  if (raw === "tarjeta_credito" || raw === "tarjeta_corporativa") return "tarjeta_corporativa";
  if (raw === "linea_credito" || raw === "revolvente") return "revolvente";
  if (raw === "credito_simple" || raw === "simple" || raw === "prestamo") return "simple";
  if (raw === "arrendamiento") return "arrendamiento";

  return raw || "otro";
};

const getTipoCreditoLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    simple: "Crédito Simple",
    arrendamiento: "Arrendamiento",
    revolvente: "Crédito Revolvente",
    tarjeta_corporativa: "Tarjeta Corporativa",
    otro: "Otro",
  };
  return labels[tipo] || tipo;
};

const getEstatus = (f: any) => String(f?.estatus || f?.estado || "").toLowerCase();

const getEstadoBadgeVariant = (
  estado: string
): "default" | "secondary" | "destructive" => {
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    activo: "default",
    liquidado: "secondary",
    pagado: "secondary",
    vencido: "destructive",
    cancelado: "destructive",
    suspendido: "destructive",
  };
  return variants[estado] || "default";
};

const getInstitucion = (f: any) =>
  f?.institucion || f?.institucion_financiera || "Sin institución";

const getMontoBase = (f: any) => {
  const tipo = getTipoUi(f);

  if (tipo === "tarjeta_corporativa" || tipo === "revolvente") {
    return toNum(f?.linea_credito ?? f?.lineaCredito ?? f?.monto_total, 0);
  }

  return toNum(f?.monto_original ?? f?.montoOriginal ?? f?.monto_total, 0);
};

const getSaldoPendiente = (f: any) => {
  const tipo = getTipoUi(f);

  if (tipo === "tarjeta_corporativa" || tipo === "revolvente") {
    return toNum(
      f?.saldo_dispuesto_actual ??
        f?.saldoDispuestoActual ??
        f?.saldo_capital_actual ??
        f?.saldoCapitalActual ??
        f?.saldo_actual,
      0
    );
  }

  return toNum(
    f?.saldo_capital_actual ??
      f?.saldoCapitalActual ??
      f?.saldo_total_actual ??
      f?.saldoTotalActual ??
      f?.saldo_actual,
    0
  );
};

const getDisponible = (f: any) => {
  const disponible = Number(f?.disponible_actual ?? f?.disponibleActual);
  if (Number.isFinite(disponible)) return Math.max(0, disponible);

  const monto = getMontoBase(f);
  const saldo = getSaldoPendiente(f);
  return Math.max(0, monto - saldo);
};

const getMontoPagado = (f: any) => {
  const monto = getMontoBase(f);
  const saldo = getSaldoPendiente(f);
  return Math.max(0, monto - saldo);
};

const getTasa = (f: any) =>
  toNum(f?.tasa_interes_anual ?? f?.tasaInteresAnual ?? f?.tasa_interes, 0);

const getPlazo = (f: any) =>
  toNum(f?.plazo_meses ?? f?.plazoMeses, 0);

const getFechaInicio = (f: any) =>
  f?.fecha_inicio || f?.fechaInicio || f?.fecha_apertura || f?.fechaApertura || null;

const getFechaVencimiento = (f: any) =>
  f?.fecha_vencimiento || f?.fechaVencimiento || null;

const formatDateSafe = (value: any) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return format(d, "dd/MM/yyyy");
};

const percentage = (num: number, den: number) => {
  if (!den || den <= 0) return 0;
  return (num / den) * 100;
};

const DetalleCreditosFinanciamientos = () => {
  const { financiamientos, isLoading } = useFinanciamientos();

  const { creditosActivos, creditosPagados, creditosVencidos } = useMemo(() => {
    const activos = financiamientos.filter((f: any) => getEstatus(f) === "activo");
    const pagados = financiamientos.filter((f: any) => {
      const estatus = getEstatus(f);
      return estatus === "liquidado" || estatus === "pagado";
    });
    const vencidos = financiamientos.filter((f: any) => getEstatus(f) === "vencido");

    return {
      creditosActivos: activos,
      creditosPagados: pagados,
      creditosVencidos: vencidos,
    };
  }, [financiamientos]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Créditos Activos ({creditosActivos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {creditosActivos.map((f: any) => {
              const tipo = getTipoUi(f);
              const montoBase = getMontoBase(f);
              const saldoPendiente = getSaldoPendiente(f);
              const montoPagado = getMontoPagado(f);
              const disponible = getDisponible(f);
              const estatus = getEstatus(f);
              const tasa = getTasa(f);
              const plazo = getPlazo(f);

              const esLinea = tipo === "tarjeta_corporativa" || tipo === "revolvente";
              const pctUtilizado = percentage(saldoPendiente, montoBase);
              const pctPagado = percentage(montoPagado, montoBase);

              return (
                <div key={f.id} className="border rounded-lg p-6 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h4 className="font-semibold text-lg">{f.nombre}</h4>
                      <p className="text-sm text-muted-foreground">{getInstitucion(f)}</p>
                      {(f.numero_cuenta || f.numeroCuenta) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Cuenta: {f.numero_cuenta || f.numeroCuenta}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap justify-end">
                      <Badge>{getTipoCreditoLabel(tipo)}</Badge>
                      <Badge variant={getEstadoBadgeVariant(estatus)}>
                        {estatus.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {f.descripcion && (
                    <p className="text-sm text-muted-foreground">{f.descripcion}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {esLinea ? "Línea Total" : "Monto Original"}
                      </p>
                      <p className="font-semibold">
                        ${montoBase.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        {esLinea ? "Monto Utilizado" : "Saldo Pendiente"}
                      </p>
                      <p className="font-semibold text-red-600">
                        ${saldoPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Tasa de Interés</p>
                      <p className="font-semibold">{tasa.toFixed(2)}% anual</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Plazo</p>
                      <p className="font-semibold">{plazo || 0} meses</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha de Inicio</p>
                      <p className="text-sm">{formatDateSafe(getFechaInicio(f))}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Fecha de Vencimiento</p>
                      <p className="text-sm">{formatDateSafe(getFechaVencimiento(f))}</p>
                    </div>
                  </div>

                  {(f.notas || f.condiciones) && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Condiciones / Notas</p>
                      <p className="text-sm bg-muted p-2 rounded">
                        {f.notas || f.condiciones}
                      </p>
                    </div>
                  )}

                  {esLinea ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Uso de Línea de Crédito</span>
                        <span className="font-medium">{pctUtilizado.toFixed(1)}% utilizado</span>
                      </div>

                      <div className="w-full bg-green-100 rounded-full h-3 flex overflow-hidden">
                        <div
                          className="bg-green-500 h-3 transition-all"
                          style={{
                            width: `${percentage(disponible, montoBase)}%`,
                          }}
                          title="Línea Disponible"
                        />
                        <div
                          className="bg-red-500 h-3 transition-all"
                          style={{
                            width: `${pctUtilizado}%`,
                          }}
                          title="Saldo Utilizado"
                        />
                      </div>

                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 bg-green-500 rounded" />
                          Disponible: ${disponible.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </span>

                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 bg-red-500 rounded" />
                          Utilizado: ${saldoPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progreso de Pago</span>
                        <span className="font-medium">{pctPagado.toFixed(1)}% completado</span>
                      </div>

                      <div className="w-full bg-muted rounded-full h-3">
                        <div
                          className="bg-primary h-3 rounded-full transition-all"
                          style={{
                            width: `${pctPagado}%`,
                          }}
                        />
                      </div>

                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          Pagado: ${montoPagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </span>
                        <span>
                          Pendiente: ${saldoPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {creditosActivos.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No hay créditos activos
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {creditosPagados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Créditos Pagados ({creditosPagados.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {creditosPagados.map((f: any) => {
                const montoBase = getMontoBase(f);

                return (
                  <div key={f.id} className="border rounded-lg p-4 opacity-75">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{f.nombre}</h4>
                        <p className="text-sm text-muted-foreground">{getInstitucion(f)}</p>
                      </div>
                      <Badge variant="secondary">PAGADO</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Monto Total</p>
                        <p className="font-medium">
                          ${montoBase.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Fecha de Inicio</p>
                        <p className="text-sm">{formatDateSafe(getFechaInicio(f))}</p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Fecha de Vencimiento</p>
                        <p className="text-sm">{formatDateSafe(getFechaVencimiento(f))}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {creditosVencidos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">
              Créditos Vencidos ({creditosVencidos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {creditosVencidos.map((f: any) => {
                const saldoPendiente = getSaldoPendiente(f);
                const tasa = getTasa(f);

                return (
                  <div key={f.id} className="border border-red-300 rounded-lg p-4 bg-red-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-red-900">{f.nombre}</h4>
                        <p className="text-sm text-red-700">{getInstitucion(f)}</p>
                      </div>
                      <Badge variant="destructive">VENCIDO</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-red-600">Saldo Pendiente</p>
                        <p className="font-bold text-red-900">
                          ${saldoPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-red-600">Tasa</p>
                        <p className="font-medium">{tasa.toFixed(2)}%</p>
                      </div>

                      <div>
                        <p className="text-xs text-red-600">Fecha de Vencimiento</p>
                        <p className="text-sm font-medium">
                          {formatDateSafe(getFechaVencimiento(f))}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DetalleCreditosFinanciamientos;