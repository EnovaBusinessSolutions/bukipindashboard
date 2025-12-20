import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

import { apiFetch } from "@/lib/api";
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
    tipo_pago: string; // contado|credito|parcial
    metodo_pago: string | null; // transferencia|efectivo|null
    monto_pagado: number;
    monto_pendiente: number;
    cuenta_codigo: string;
  } | null;
}

type AsientoDetalle = {
  id: string;
  cuenta_codigo: string;
  descripcion: string;
  debe: number;
  haber: number;
  cuentas?: {
    codigo: string;
    nombre: string;
  } | null;
};

type AsientoContable = {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string; // YYYY-MM-DD
  detalle_asientos: AsientoDetalle[];
};

const meses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function normalize<T = any>(json: any): T {
  return (json?.data ?? json) as T;
}

export const ResumenImpuestos = () => {
  const currentDate = new Date();

  const [mesSeleccionado, setMesSeleccionado] = useState<string>("todos");
  const [anoSeleccionado, setAnoSeleccionado] = useState<number>(currentDate.getFullYear());

  const [detalleAsiento, setDetalleAsiento] = useState<(AsientoContable & { transaccion: TransaccionImpuesto }) | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  // Utilidades reales desde asientos contables (este hook debe ya estar migrado a backend)
  const { data: resultadosMensuales } = useEstadoResultadosMensual(anoSeleccionado);

  const { data: transacciones = [], isFetching: loading } = useQuery({
    queryKey: ["impuestos-resumen", anoSeleccionado, mesSeleccionado],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("ano", String(anoSeleccionado));
      if (mesSeleccionado !== "todos") qs.set("mes", mesSeleccionado);

      const json = await apiFetch(`/api/impuestos/isr/resumen?${qs.toString()}`);
      return normalize<TransaccionImpuesto[]>(json) ?? [];
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value || 0);

  const verDetalleAsiento = async (transaccion: TransaccionImpuesto) => {
    const qs = new URLSearchParams();
    qs.set("mes", String(transaccion.mes));
    qs.set("ano", String(transaccion.ano));

    const json = await apiFetch(`/api/impuestos/isr/asiento?${qs.toString()}`);
    const asiento = normalize<AsientoContable | null>(json);

    if (asiento) {
      setDetalleAsiento({
        ...(asiento as any),
        transaccion,
      });
      setDialogOpen(true);
    }
  };

  // ====== Totales ======
  const mesActual = currentDate.getMonth() + 1; // 1-12
  const anoActual = currentDate.getFullYear();

  const mesesParaAcumular =
    anoSeleccionado === anoActual ? resultadosMensuales?.slice(0, mesActual) || [] : resultadosMensuales || [];

  const utilidadAcumuladaReal = mesesParaAcumular.reduce((sum: number, m: any) => sum + (m.utilidadAntesImpuestos || 0), 0);

  const tasaISR = 0.3;
  const isrTeoricoAcumulado = utilidadAcumuladaReal > 0 ? utilidadAcumuladaReal * tasaISR : 0;

  const isrRegistradoTotal = transacciones.reduce((sum, t) => sum + Number(t.isr_real || 0), 0);

  const diferencia = isrRegistradoTotal - isrTeoricoAcumulado;

  const totales = useMemo(
    () => ({
      utilidad: utilidadAcumuladaReal,
      calculado: isrTeoricoAcumulado,
      real: isrRegistradoTotal,
      diferencia,
    }),
    [utilidadAcumuladaReal, isrTeoricoAcumulado, isrRegistradoTotal, diferencia]
  );

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
              {anoSeleccionado === anoActual && ` (hasta ${meses[mesActual - 1]})`}
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totales.utilidad)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Calculada desde asientos contables</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>ISR Teórico (30%)</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totales.calculado)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Sobre utilidad acumulada del año</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>ISR Registrado</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totales.real)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {transacciones.length} pago{transacciones.length !== 1 ? "s" : ""} registrado{transacciones.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card
          className={`border-2 ${
            diferencia > 0 ? "border-amber-500" : diferencia < 0 ? "border-red-500" : "border-green-500"
          }`}
        >
          <CardHeader className="pb-3">
            <CardDescription>Diferencia</CardDescription>
            <CardTitle
              className={`text-2xl ${
                diferencia > 0 ? "text-amber-600" : diferencia < 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {diferencia > 0 ? "+" : ""}
              {formatCurrency(diferencia)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {diferencia > 0 && "⚠️ Has pagado más de lo calculado"}
              {diferencia < 0 && `❌ Falta pagar ${formatCurrency(Math.abs(diferencia))}`}
              {diferencia === 0 && "✅ Estás al corriente"}
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
          <CardDescription>Registro detallado mensual del ejercicio fiscal actual</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando transacciones...</div>
          ) : transacciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay transacciones registradas</div>
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
                      <TableCell className="text-right">{formatCurrency(t.utilidad_antes_impuestos)}</TableCell>
                      <TableCell className="text-right">{t.tasa_isr}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.isr_calculado)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(t.isr_real)}</TableCell>

                      <TableCell>
                        {t.egreso?.tipo_pago === "contado" ? (
                          <Badge variant="secondary">Pago Total</Badge>
                        ) : t.egreso?.tipo_pago === "credito" ? (
                          <Badge variant="outline">A Crédito</Badge>
                        ) : t.egreso?.tipo_pago === "parcial" ? (
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
                          <span className="text-green-600 font-semibold">{formatCurrency(t.egreso.monto_pagado)}</span>
                        ) : (
                          <span className="text-muted-foreground">$0.00</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {t.egreso?.monto_pendiente && t.egreso.monto_pendiente > 0 ? (
                          <span className="text-red-600 font-semibold">{formatCurrency(t.egreso.monto_pendiente)}</span>
                        ) : (
                          <span className="text-muted-foreground">$0.00</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="text-xs font-mono">{t.egreso?.cuenta_codigo || "-"}</span>
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
                          title="Ver desglose contable"
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
            <li>
              <strong>Debe:</strong> Cuenta 6001 (ISR) - Monto del ISR
            </li>
            <li>
              <strong>Haber:</strong> Cuenta 1002 (Bancos) o 2001 (Proveedores) según el tipo de pago
            </li>
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
                  <p className="font-medium">{new Date(detalleAsiento.fecha).toLocaleDateString("es-MX")}</p>
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
                    {detalleAsiento.detalle_asientos?.map((detalle) => (
                      <TableRow key={detalle.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-mono text-sm font-medium">{detalle.cuenta_codigo}</p>
                            <p className="text-xs text-muted-foreground">{detalle.cuentas?.nombre || "N/A"}</p>
                          </div>
                        </TableCell>
                        <TableCell>{detalle.descripcion}</TableCell>
                        <TableCell className="text-right font-medium">{detalle.debe > 0 ? formatCurrency(detalle.debe) : "-"}</TableCell>
                        <TableCell className="text-right font-medium">{detalle.haber > 0 ? formatCurrency(detalle.haber) : "-"}</TableCell>
                      </TableRow>
                    ))}

                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(detalleAsiento.detalle_asientos?.reduce((sum, d) => sum + Number(d.debe || 0), 0) || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(detalleAsiento.detalle_asientos?.reduce((sum, d) => sum + Number(d.haber || 0), 0) || 0)}
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
