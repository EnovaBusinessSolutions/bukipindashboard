import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Calendar, ChevronDown, ChevronRight, DollarSign, FileText, History, Search, User, Users } from "lucide-react";
import { es } from "date-fns/locale";

type Props = {
  // data
  bucket: null | "1003" | "1009";
  menuTotals: any;
  highlights: any;
  cuentasAgrupadasPorCliente: any[];
  expandedClientes: Set<string>;

  // filtros
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filtroEstado: string;
  setFiltroEstado: (v: string) => void;
  ordenMonto: string;
  setOrdenMonto: (v: string) => void;

  // helpers
  formatCurrency: (n: number) => string;
  safeFormatDate: (value: any, fmt: string, opts?: any) => string;
  safeDate: (value: any) => Date | null;
  getEstadoBadge: (fechaVencimiento: string | null, montoPendiente: number) => JSX.Element;

  // acciones
  setBucket: (v: null | "1003" | "1009") => void;
  setExpandedClientes: (s: Set<string>) => void;
  toggleClienteExpansion: (cliente: string) => void;

  openHistorialPagos: (facturaId: string) => void;
  openPagoDialog: (cuenta: any) => void;
};

export default function PanelListaCuentas({
  bucket,
  menuTotals,
  highlights,
  cuentasAgrupadasPorCliente,
  expandedClientes,
  searchTerm,
  setSearchTerm,
  filtroEstado,
  setFiltroEstado,
  ordenMonto,
  setOrdenMonto,
  formatCurrency,
  safeFormatDate,
  safeDate,
  getEstadoBadge,
  setBucket,
  setExpandedClientes,
  toggleClienteExpansion,
  openHistorialPagos,
  openPagoDialog,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Métricas Resumen (NO cambian con filtros) */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total por Cobrar</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(highlights.totalPorCobrar)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cuentas Vencidas</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{highlights.vencidas}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Vencer</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highlights.porVencer}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cuentas</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highlights.totalCuentas}</div>
          </CardContent>
        </Card>
      </div>

      {/* MENÚ 1003 / 1009 */}
      {bucket === null && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card
            onClick={() => {
              setExpandedClientes(new Set());
              setBucket("1003");
            }}
            className={[
              "relative overflow-hidden group cursor-pointer",
              "border border-[#0b3a5a]/25",
              "bg-gradient-to-br from-[#0b3a5a] via-[#072c44] to-[#051b2c]",
              "text-white shadow-sm transition-all",
              "hover:-translate-y-[1px] hover:shadow-lg",
            ].join(" ")}
          >
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-cyan-200/10 blur-3xl" />
            </div>

            <CardHeader className="relative flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg text-white">1003 - Cuentas por Cobrar Clientes</CardTitle>
                <p className="text-white/70 text-sm">Facturas pendientes de clientes</p>
              </div>

              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-white/70" />
                <span className="text-xs text-white/70 group-hover:text-white transition-colors">
                  Ver detalle →
                </span>
              </div>
            </CardHeader>

            <CardContent className="relative space-y-2">
              <div className="text-3xl font-bold">{formatCurrency(menuTotals["1003"].total)}</div>

              <div className="text-sm text-white/75">
                Facturas pendientes: <span className="font-semibold text-white">{menuTotals["1003"].pendientes}</span>
              </div>

              <div className="text-sm text-white/75">
                Clientes: <span className="font-semibold text-white">{menuTotals["1003"].clientes}</span>
              </div>

              <div className="mt-3 h-px bg-white/10" />
              <div className="text-xs text-white/60">Haz click para ver el listado y registrar pagos</div>
            </CardContent>
          </Card>

          <Card
            onClick={() => {
              setExpandedClientes(new Set());
              setBucket("1009");
            }}
            className={[
              "relative overflow-hidden group cursor-pointer",
              "border border-[#0a5560]/25",
              "bg-gradient-to-br from-[#0a5560] via-[#08424b] to-[#052a2f]",
              "text-white shadow-sm transition-all",
              "hover:-translate-y-[1px] hover:shadow-lg",
            ].join(" ")}
          >
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-emerald-200/10 blur-3xl" />
            </div>

            <CardHeader className="relative flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg text-white">1009 - Deudores Diversos</CardTitle>
                <p className="text-white/70 text-sm">Pendientes de “Otros ingresos” (4102)</p>
              </div>

              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-white/70" />
                <span className="text-xs text-white/70 group-hover:text-white transition-colors">
                  Ver detalle →
                </span>
              </div>
            </CardHeader>

            <CardContent className="relative space-y-2">
              <div className="text-3xl font-bold">{formatCurrency(menuTotals["1009"].total)}</div>

              <div className="text-sm text-white/75">
                Registros pendientes:{" "}
                <span className="font-semibold text-white">{menuTotals["1009"].pendientes}</span>
              </div>

              <div className="text-sm text-white/75">
                Deudores: <span className="font-semibold text-white">{menuTotals["1009"].clientes}</span>
              </div>

              <div className="mt-3 h-px bg-white/10" />
              <div className="text-xs text-white/60">Haz click para ver el listado y registrar pagos</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* HERO + Breadcrumb cuando ya estás dentro del bucket */}
      {bucket !== null && (() => {
        const is1003 = bucket === "1003";

        const shellClass = is1003
          ? "relative overflow-hidden rounded-xl border border-[#0b3a5a]/25 bg-gradient-to-br from-[#0b3a5a] via-[#072c44] to-[#051b2c] text-white shadow-sm"
          : "relative overflow-hidden rounded-xl border border-[#0a5560]/25 bg-gradient-to-br from-[#0a5560] via-[#08424b] to-[#052a2f] text-white shadow-sm";

        const glowB = is1003 ? "bg-cyan-200/10" : "bg-emerald-200/10";

        const title = is1003 ? "1003 - Cuentas por Cobrar Clientes" : "1009 - Deudores Diversos";
        const subtitle = is1003 ? "Facturas pendientes de clientes" : "Pendientes de “Otros ingresos” (4102)";
        const metrics = menuTotals[bucket];

        return (
          <div className={shellClass}>
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
              <div className={`absolute -left-16 -bottom-16 h-56 w-56 rounded-full ${glowB} blur-3xl`} />
            </div>

            <div className="relative p-5 md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setExpandedClientes(new Set());
                        setBucket(null);
                      }}
                      className="border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                    >
                      ← Regresar al menú
                    </Button>

                    <div className="text-sm text-white/70">
                      / <span className="font-semibold text-white">{title}</span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <h2 className="text-xl md:text-2xl font-semibold leading-tight">{title}</h2>
                    <p className="text-sm text-white/70">{subtitle}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                  <div className="text-xs text-white/70">Total pendiente</div>
                  <div className="text-2xl md:text-3xl font-bold">{formatCurrency(metrics?.total || 0)}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/15 bg-white/10 p-3">
                  <div className="text-xs text-white/70">{is1003 ? "Facturas pendientes" : "Registros pendientes"}</div>
                  <div className="text-lg font-semibold">{metrics?.pendientes || 0}</div>
                </div>

                <div className="rounded-lg border border-white/15 bg-white/10 p-3">
                  <div className="text-xs text-white/70">{is1003 ? "Clientes" : "Deudores"}</div>
                  <div className="text-lg font-semibold">{metrics?.clientes || 0}</div>
                </div>

                <div className="rounded-lg border border-white/15 bg-white/10 p-3">
                  <div className="text-xs text-white/70">Tip</div>
                  <div className="text-sm text-white/85">Usa búsqueda + estado para encontrar rápido.</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Filtros + Tabla solo dentro del bucket */}
      {bucket !== null && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Filtrar Cuentas
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="w-full md:max-w-md">
                  <Label htmlFor="busqueda-general" className="mb-2 block text-sm">
                    Búsqueda
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="busqueda-general"
                      className="pl-9"
                      placeholder="Cliente, descripción, teléfono, email o RFC..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="w-full md:w-56">
                  <Label htmlFor="filtro-estado" className="mb-2 block text-sm">
                    Estado
                  </Label>
                  <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                    <SelectTrigger id="filtro-estado" className="bg-background">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="vencida">Vencida</SelectItem>
                      <SelectItem value="porVencer">Por vencer</SelectItem>
                      <SelectItem value="sinVencimiento">Sin vencimiento</SelectItem>
                      <SelectItem value="cobrado">Cobrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full md:w-64">
                  <Label htmlFor="orden-monto" className="mb-2 block text-sm">
                    Orden
                  </Label>
                  <Select value={ordenMonto} onValueChange={setOrdenMonto}>
                    <SelectTrigger id="orden-monto" className="bg-background">
                      <SelectValue placeholder="Sin ordenar" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="ninguno">Por fecha</SelectItem>
                      <SelectItem value="menorMayor">Menor a Mayor (pendiente)</SelectItem>
                      <SelectItem value="mayorMenor">Mayor a Menor (pendiente)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full md:w-auto md:pl-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setFiltroEstado("todos");
                      setOrdenMonto("ninguno");
                    }}
                    className="w-full md:w-auto"
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Listado de Cuentas por Cobrar</CardTitle>
            </CardHeader>

            <CardContent>
              {cuentasAgrupadasPorCliente.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No se encontraron cuentas por cobrar.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Información de Contacto</TableHead>
                        <TableHead>Total Pendiente</TableHead>
                        <TableHead>Facturas</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {cuentasAgrupadasPorCliente.map((grupo) => (
                        <>
                          <TableRow
                            key={`cliente-${grupo.cliente}`}
                            className="bg-muted/50 hover:bg-muted cursor-pointer font-medium"
                            onClick={() => toggleClienteExpansion(grupo.cliente)}
                          >
                            <TableCell>
                              {expandedClientes.has(grupo.cliente) ? (
                                <ChevronDown className="w-5 h-5" />
                              ) : (
                                <ChevronRight className="w-5 h-5" />
                              )}
                            </TableCell>

                            <TableCell className="font-semibold">{grupo.cliente}</TableCell>

                            <TableCell className="min-w-[200px]">
                              <div className="space-y-1">
                                {grupo.contacto.telefono && (
                                  <div className="text-sm flex items-center gap-2">
                                    <span className="text-pink-600">📞</span>
                                    <span className="font-medium">{grupo.contacto.telefono}</span>
                                  </div>
                                )}
                                {grupo.contacto.email && (
                                  <div className="text-sm flex items-center gap-2">
                                    <span className="text-blue-600">✉️</span>
                                    <span className="font-medium">{grupo.contacto.email}</span>
                                  </div>
                                )}
                                {grupo.contacto.rfc && (
                                  <div className="text-sm flex items-center gap-2">
                                    <span className="text-purple-600">🆔</span>
                                    <span className="font-medium">{grupo.contacto.rfc}</span>
                                  </div>
                                )}

                                {!grupo.contacto.telefono && !grupo.contacto.email && !grupo.contacto.rfc && (
                                  <span className="text-muted-foreground text-sm">Sin información de contacto</span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="space-y-1">
                                <div className="text-lg font-bold text-primary">{formatCurrency(grupo.totalPendiente)}</div>
                                <div className="text-sm text-muted-foreground">
                                  Total: {formatCurrency(grupo.totalOriginal)}
                                </div>
                                {grupo.totalPagado > 0 && (
                                  <div className="text-sm text-success">Pagado: {formatCurrency(grupo.totalPagado)}</div>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge variant="outline">
                                {grupo.facturas.length} {grupo.facturas.length === 1 ? "factura" : "facturas"}
                              </Badge>
                            </TableCell>
                          </TableRow>

                          {expandedClientes.has(grupo.cliente) &&
                            grupo.facturas.map((cuenta: any) => (
                              <TableRow key={cuenta.id} className="bg-background">
                                <TableCell></TableCell>
                                <TableCell colSpan={5}>
                                  <div className="pl-4 border-l-2 border-primary/30 ml-4">
                                    <div className="grid grid-cols-12 gap-4 items-center">
                                      <div className="col-span-3">
                                        <div className="font-medium">{cuenta.descripcion}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {safeFormatDate(cuenta.created_at, "dd/MM/yyyy", { locale: es })}
                                        </div>
                                      </div>

                                      <div className="col-span-3">
                                        <div className="space-y-1 text-sm">
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Total:</span>
                                            <span className="font-medium">{formatCurrency(cuenta.monto_total)}</span>
                                          </div>

                                          {cuenta.monto_descuento && cuenta.monto_descuento > 0 && (
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Descuento:</span>
                                              <span className="text-destructive">-{formatCurrency(cuenta.monto_descuento)}</span>
                                            </div>
                                          )}

                                          {cuenta.monto_pagado > 0 && (
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Pagado:</span>
                                              <span className="text-success">{formatCurrency(cuenta.monto_pagado)}</span>
                                            </div>
                                          )}

                                          <div className="flex justify-between border-t pt-1">
                                            <span className="font-medium">Pendiente:</span>
                                            <span className="font-bold text-primary">{formatCurrency(cuenta.monto_pendiente || 0)}</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="col-span-2">
                                        <div className="space-y-1">
                                          <Badge
                                            variant={
                                              cuenta.tipo_pago === "contado"
                                                ? "default"
                                                : cuenta.tipo_pago === "parcial"
                                                  ? "secondary"
                                                  : "outline"
                                            }
                                          >
                                            {cuenta.tipo_pago === "contado"
                                              ? "Contado"
                                              : cuenta.tipo_pago === "parcial"
                                                ? "Parcial"
                                                : "Crédito"}
                                          </Badge>

                                          {cuenta.metodo_pago && (
                                            <div className="text-xs text-muted-foreground">
                                              {cuenta.metodo_pago === "efectivo" ? "Efectivo" : "Tarjeta/Banco"}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="col-span-2">
                                        {cuenta.fecha_vencimiento ? (
                                          <div className="space-y-1">
                                            <div className="text-sm font-medium">
                                              {safeFormatDate(cuenta.fecha_vencimiento, "dd/MM/yyyy", { locale: es })}
                                            </div>

                                            <div className="text-xs">
                                              {(() => {
                                                const today = new Date();
                                                const dueDate = safeDate(cuenta.fecha_vencimiento);
                                                if (!dueDate) return <span className="text-muted-foreground">Fecha inválida</span>;

                                                const diffTime = dueDate.getTime() - today.getTime();
                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                                if (diffDays < 0) {
                                                  return (
                                                    <span className="text-destructive font-medium">
                                                      Vencida hace {Math.abs(diffDays)} día(s)
                                                    </span>
                                                  );
                                                }
                                                if (diffDays === 0) return <span className="text-warning font-medium">Vence hoy</span>;
                                                if (diffDays <= 7) {
                                                  return <span className="text-warning font-medium">Vence en {diffDays} día(s)</span>;
                                                }
                                                return <span className="text-muted-foreground">Vence en {diffDays} día(s)</span>;
                                              })()}
                                            </div>

                                            {getEstadoBadge(cuenta.fecha_vencimiento, cuenta.monto_pendiente || 0)}
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground text-sm">Sin fecha límite</span>
                                        )}
                                      </div>

                                      <div className="col-span-2 flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => openHistorialPagos(cuenta.id)}
                                          title="Ver historial de pagos"
                                        >
                                          <History className="w-4 h-4" />
                                        </Button>

                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() => openPagoDialog(cuenta)}
                                          disabled={cuenta.monto_pendiente <= 0}
                                        >
                                          Pagar
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}