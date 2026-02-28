import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Clock, Eye, TrendingUp } from "lucide-react";
import { es } from "date-fns/locale";

type Props = {
  loadingTransacciones: boolean;
  todasTransacciones: any[];

  // filtros
  filtroMesTransaccion: string;
  setFiltroMesTransaccion: (v: string) => void;
  filtroAnoTransaccion: string;
  setFiltroAnoTransaccion: (v: string) => void;
  filtroEstadoTransaccion: string;
  setFiltroEstadoTransaccion: (v: string) => void;
  filtroMetodoPago: string;
  setFiltroMetodoPago: (v: string) => void;
  filtroTipoIngreso: string;
  setFiltroTipoIngreso: (v: string) => void;
  filtroClienteTransaccion: string;
  setFiltroClienteTransaccion: (v: string) => void;
  ordenMontoTransaccion: string;
  setOrdenMontoTransaccion: (v: string) => void;

  // helpers
  safeDate: (value: any) => Date | null;
  safeFormatDate: (value: any, fmt: string, opts?: any) => string;
  formatCurrency: (n: number) => string;

  // acciones
  onOpenDetalleContable: (transaccionId: string) => void;
  onResetFiltros: () => void;
};

export default function PanelResumenTransacciones({
  loadingTransacciones,
  todasTransacciones,
  filtroMesTransaccion,
  setFiltroMesTransaccion,
  filtroAnoTransaccion,
  setFiltroAnoTransaccion,
  filtroEstadoTransaccion,
  setFiltroEstadoTransaccion,
  filtroMetodoPago,
  setFiltroMetodoPago,
  filtroTipoIngreso,
  setFiltroTipoIngreso,
  filtroClienteTransaccion,
  setFiltroClienteTransaccion,
  ordenMontoTransaccion,
  setOrdenMontoTransaccion,
  safeDate,
  safeFormatDate,
  formatCurrency,
  onOpenDetalleContable,
  onResetFiltros,
}: Props) {
  if (loadingTransacciones) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando transacciones...</div>
      </div>
    );
  }

  const total = todasTransacciones?.length || 0;

  const pagadas = (todasTransacciones || []).filter((t: any) => t.monto_pendiente === 0).length || 0;
  const parciales = (todasTransacciones || []).filter((t: any) => t.monto_pendiente > 0 && t.monto_pagado > 0).length || 0;
  const sinPagar = (todasTransacciones || []).filter((t: any) => t.monto_pagado === 0 && t.monto_pendiente > 0).length || 0;

  let transaccionesFiltradas = todasTransacciones || [];

  if (filtroMesTransaccion !== "todos") {
    transaccionesFiltradas = transaccionesFiltradas.filter((t: any) => {
      const d = safeDate(t.created_at);
      if (!d) return false;
      const mes = d.getMonth() + 1;
      return mes === parseInt(filtroMesTransaccion);
    });
  }

  if (filtroAnoTransaccion !== "todos") {
    transaccionesFiltradas = transaccionesFiltradas.filter((t: any) => {
      const d = safeDate(t.created_at);
      if (!d) return false;
      const ano = d.getFullYear();
      return ano === parseInt(filtroAnoTransaccion);
    });
  }

  if (filtroClienteTransaccion !== "todos") {
    transaccionesFiltradas = transaccionesFiltradas.filter((t: any) => t.cliente_nombre === filtroClienteTransaccion);
  }

  if (filtroTipoIngreso !== "todos") {
    transaccionesFiltradas = transaccionesFiltradas.filter((t: any) => t.tipo_ingreso === filtroTipoIngreso);
  }

  if (filtroEstadoTransaccion !== "todos") {
    transaccionesFiltradas = transaccionesFiltradas.filter((t: any) => {
      if (filtroEstadoTransaccion === "completado") return t.monto_pendiente === 0;
      if (filtroEstadoTransaccion === "enProgreso") return t.monto_pendiente > 0 && t.monto_pagado > 0;
      if (filtroEstadoTransaccion === "sinPagar") return t.monto_pagado === 0 && t.monto_pendiente > 0;
      return true;
    });
  }

  if (filtroMetodoPago !== "todos") {
    transaccionesFiltradas = transaccionesFiltradas.filter((t: any) => t.metodo_pago === filtroMetodoPago);
  }

  if (ordenMontoTransaccion === "menorMayor") {
    transaccionesFiltradas = [...transaccionesFiltradas].sort((a: any, b: any) => (a.monto_neto || 0) - (b.monto_neto || 0));
  } else if (ordenMontoTransaccion === "mayorMenor") {
    transaccionesFiltradas = [...transaccionesFiltradas].sort((a: any, b: any) => (b.monto_neto || 0) - (a.monto_neto || 0));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transacciones</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completamente Pagadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{pagadas}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Parciales</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{parciales}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Pagar</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{sinPagar}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Historial Completo de Transacciones
          </CardTitle>
          <CardDescription>
            Trazabilidad de todas las transacciones de ingresos, desde su creación hasta su liquidación
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="filtro-mes-transaccion" className="mb-2 block">Mes</Label>
              <Select value={filtroMesTransaccion} onValueChange={setFiltroMesTransaccion}>
                <SelectTrigger id="filtro-mes-transaccion" className="bg-background">
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="todos">Todos los meses</SelectItem>
                  <SelectItem value="1">Enero</SelectItem>
                  <SelectItem value="2">Febrero</SelectItem>
                  <SelectItem value="3">Marzo</SelectItem>
                  <SelectItem value="4">Abril</SelectItem>
                  <SelectItem value="5">Mayo</SelectItem>
                  <SelectItem value="6">Junio</SelectItem>
                  <SelectItem value="7">Julio</SelectItem>
                  <SelectItem value="8">Agosto</SelectItem>
                  <SelectItem value="9">Septiembre</SelectItem>
                  <SelectItem value="10">Octubre</SelectItem>
                  <SelectItem value="11">Noviembre</SelectItem>
                  <SelectItem value="12">Diciembre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filtro-ano-transaccion" className="mb-2 block">Año</Label>
              <Select value={filtroAnoTransaccion} onValueChange={setFiltroAnoTransaccion}>
                <SelectTrigger id="filtro-ano-transaccion" className="bg-background">
                  <SelectValue placeholder="Todos los años" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="todos">Todos los años</SelectItem>
                  {Array.from(new Set((todasTransacciones || [])
                    .map((t: any) => safeDate(t.created_at)?.getFullYear())
                    .filter((y: any) => typeof y === "number")))
                    .sort((a: any, b: any) => b - a)
                    .map((year: any) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filtro-cliente-transaccion" className="mb-2 block">Cliente</Label>
              <Select value={filtroClienteTransaccion} onValueChange={setFiltroClienteTransaccion}>
                <SelectTrigger id="filtro-cliente-transaccion" className="bg-background">
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="todos">Todos los clientes</SelectItem>
                  {Array.from(new Set((todasTransacciones || [])
                    .map((t: any) => t.cliente_nombre)
                    .filter(Boolean)))
                    .sort()
                    .map((cliente: any) => (
                      <SelectItem key={cliente} value={cliente!}>
                        {cliente}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filtro-tipo-ingreso" className="mb-2 block">Tipo de Ingreso</Label>
              <Select value={filtroTipoIngreso} onValueChange={setFiltroTipoIngreso}>
                <SelectTrigger id="filtro-tipo-ingreso" className="bg-background">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  {Array.from(new Set((todasTransacciones || []).map((t: any) => t.tipo_ingreso)))
                    .sort()
                    .map((tipo: any) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filtro-estado-transaccion" className="mb-2 block">Estado</Label>
              <Select value={filtroEstadoTransaccion} onValueChange={setFiltroEstadoTransaccion}>
                <SelectTrigger id="filtro-estado-transaccion" className="bg-background">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                  <SelectItem value="enProgreso">En Progreso</SelectItem>
                  <SelectItem value="sinPagar">Sin Pagar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filtro-metodo-pago" className="mb-2 block">Método de Pago</Label>
              <Select value={filtroMetodoPago} onValueChange={setFiltroMetodoPago}>
                <SelectTrigger id="filtro-metodo-pago" className="bg-background">
                  <SelectValue placeholder="Todos los métodos" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="todos">Todos los métodos</SelectItem>
                  {Array.from(new Set((todasTransacciones || [])
                    .map((t: any) => t.metodo_pago)
                    .filter(Boolean)))
                    .sort()
                    .map((metodo: any) => (
                      <SelectItem key={metodo} value={metodo!}>
                        {metodo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="orden-monto-transaccion" className="mb-2 block">Ordenar por Monto</Label>
              <Select value={ordenMontoTransaccion} onValueChange={setOrdenMontoTransaccion}>
                <SelectTrigger id="orden-monto-transaccion" className="bg-background">
                  <SelectValue placeholder="Sin ordenar" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="ninguno">Sin ordenar (Por fecha)</SelectItem>
                  <SelectItem value="menorMayor">Menor a Mayor</SelectItem>
                  <SelectItem value="mayorMenor">Mayor a Menor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={onResetFiltros} className="w-full">
                Limpiar Filtros
              </Button>
            </div>
          </div>

          {/* tabla */}
          {!transaccionesFiltradas || transaccionesFiltradas.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {todasTransacciones && todasTransacciones.length > 0
                  ? "No se encontraron transacciones con los filtros seleccionados."
                  : "No hay transacciones registradas."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha Creación</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Tipo Ingreso</TableHead>
                    <TableHead className="text-right">Monto Total</TableHead>
                    <TableHead className="text-right">Descuento</TableHead>
                    <TableHead className="text-right">Monto Neto</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    <TableHead>Tipo Pago</TableHead>
                    <TableHead>Método Pago</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead className="text-center">Detalle Contable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transaccionesFiltradas.map((transaccion: any) => {
                    const porcentajePagado = transaccion.monto_neto > 0
                      ? (transaccion.monto_pagado / transaccion.monto_neto) * 100
                      : 0;

                    return (
                      <TableRow key={transaccion.id}>
                        <TableCell className="font-medium">
                          {safeFormatDate(transaccion.created_at, "dd MMM yyyy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>{transaccion.cliente_nombre || "Sin especificar"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{transaccion.descripcion}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{transaccion.tipo_ingreso}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(transaccion.monto_total)}</TableCell>
                        <TableCell className="text-right">
                          {transaccion.monto_descuento > 0 ? (
                            <span className="text-destructive">-{formatCurrency(transaccion.monto_descuento)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(transaccion.monto_neto)}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-success font-semibold">{formatCurrency(transaccion.monto_pagado)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {transaccion.monto_pendiente > 0 ? (
                            <span className="text-destructive font-semibold">{formatCurrency(transaccion.monto_pendiente)}</span>
                          ) : (
                            <span className="text-muted-foreground">$0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {transaccion.tipo_pago === 'contado' ? (
                            <Badge variant="secondary">Contado</Badge>
                          ) : transaccion.tipo_pago === 'credito' ? (
                            <Badge variant="outline">Crédito</Badge>
                          ) : (
                            <Badge className="bg-amber-500">Parcial</Badge>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{transaccion.metodo_pago || "-"}</TableCell>
                        <TableCell>
                          {transaccion.monto_pendiente === 0 ? (
                            <Badge className="bg-success">Completado</Badge>
                          ) : transaccion.monto_pagado > 0 ? (
                            <Badge className="bg-warning">En Progreso</Badge>
                          ) : (
                            <Badge variant="destructive">Sin Pagar</Badge>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[150px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>{porcentajePagado.toFixed(0)}%</span>
                              <span className="text-muted-foreground">
                                {transaccion.monto_pagado > 0 && transaccion.monto_pendiente > 0
                                  ? 'Parcial'
                                  : transaccion.monto_pendiente === 0
                                    ? 'Completo'
                                    : 'Sin pago'}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${porcentajePagado === 100
                                  ? 'bg-success'
                                  : porcentajePagado > 0
                                    ? 'bg-warning'
                                    : 'bg-destructive'
                                  }`}
                                style={{ width: `${porcentajePagado}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenDetalleContable(transaccion.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}