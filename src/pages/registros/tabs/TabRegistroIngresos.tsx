import React from "react";

// Icons (ajusta si tu proyecto los importa desde otro lado)
import {
  AlertCircle,
  Calculator,
  CreditCard,
  FileText,
  Gift,
  Package,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

// UI components (ajusta paths si aplica)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Types mínimos (puedes moverlos a types.ts después)
type IncomeType = "" | "precargados" | "inventariados" | "general" | "otros";

type ClienteLite = {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  rfc?: string;
  source?: string;
};

type Props = {
  // navegación del tab
  selectedIncomeType: IncomeType;
  setSelectedIncomeType: (v: IncomeType) => void;

  // render del form por tipo (NO mover lógica)
  renderIncomeTypeForm: (tipo: string) => React.ReactNode;

  // para cálculo automático (productos)
  selectedProductId: string;
  selectedInventoryProductId: string;
  productQuantity: string | number;
  inventoryQuantity: string | number;
  productUnitPrice: string | number;
  inventoryProductPrice: string | number;
  montoTotal: string;

  // validaciones
  hasFieldError: (field: string) => boolean;
  formatMonto: (v: any) => string;

  // pago
  paymentStatus: string;
  setPaymentStatus: (v: string) => void;
  montoAbonado: string;
  setMontoAbonado: (v: string) => void;

  // cliente
  tipoCliente: string;
  setTipoCliente: (v: string) => void;

  clienteSeleccionado: string;
  setClienteSeleccionado: (v: string) => void;

  clienteNombre: string;
  setClienteNombre: (v: string) => void;

  clienteTelefono: string;
  setClienteTelefono: (v: string) => void;

  clienteEmail: string;
  setClienteEmail: (v: string) => void;

  clienteRFC: string;
  setClienteRFC: (v: string) => void;

  clientes: ClienteLite[];
  loadingClientes: boolean;

  duplicateWarnings: string[];
  setDuplicateWarnings: (v: string[]) => void;

  // vencimiento
  fechaVencimiento: string;
  setFechaVencimiento: (v: string) => void;

  // método de pago
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;

  // comentarios
  comentarios: string;
  setComentarios: (v: string) => void;

  // submit
  handleSubmitIngreso: () => void;
  isSubmitting: boolean;
};

export default function TabRegistroIngresos(props: Props) {
  const {
    selectedIncomeType,
    setSelectedIncomeType,
    renderIncomeTypeForm,

    selectedProductId,
    selectedInventoryProductId,
    productQuantity,
    inventoryQuantity,
    productUnitPrice,
    inventoryProductPrice,
    montoTotal,

    hasFieldError,
    formatMonto,

    paymentStatus,
    setPaymentStatus,
    montoAbonado,
    setMontoAbonado,

    tipoCliente,
    setTipoCliente,
    clienteSeleccionado,
    setClienteSeleccionado,
    clienteNombre,
    setClienteNombre,
    clienteTelefono,
    setClienteTelefono,
    clienteEmail,
    setClienteEmail,
    clienteRFC,
    setClienteRFC,
    clientes,
    loadingClientes,
    duplicateWarnings,
    setDuplicateWarnings,

    fechaVencimiento,
    setFechaVencimiento,

    paymentMethod,
    setPaymentMethod,

    comentarios,
    setComentarios,

    handleSubmitIngreso,
    isSubmitting,
  } = props;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo Registro de Ingreso</CardTitle>
        <CardDescription>Selecciona el tipo de ingreso y completa la información requerida</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ✅ VISTA 1: MENÚ DE SELECCIÓN */}
        {!selectedIncomeType && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">
              Selecciona el tipo de ingreso que deseas registrar
            </Label>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {/* Productos Precargados */}
              <button
                type="button"
                onClick={() => setSelectedIncomeType("precargados")}
                className="border rounded-2xl bg-muted/20 hover:bg-muted/40 transition p-8 min-h-[180px] flex flex-col items-center justify-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <ShoppingCart className="h-7 w-7 text-primary" />
                </div>
                <div className="font-semibold text-base">Productos Precargados</div>
                <div className="text-sm text-muted-foreground mt-1">Del catálogo de servicios/productos</div>
              </button>

              {/* Productos Inventariados */}
              <button
                type="button"
                onClick={() => setSelectedIncomeType("inventariados")}
                className="border rounded-2xl bg-muted/20 hover:bg-muted/40 transition p-8 min-h-[180px] flex flex-col items-center justify-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Package className="h-7 w-7 text-primary" />
                </div>
                <div className="font-semibold text-base">Productos Inventariados</div>
                <div className="text-sm text-muted-foreground mt-1">Del inventario registrado</div>
              </button>

              {/* Ingreso General */}
              <button
                type="button"
                onClick={() => setSelectedIncomeType("general")}
                className="border rounded-2xl bg-muted/20 hover:bg-muted/40 transition p-8 min-h-[180px] flex flex-col items-center justify-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <div className="font-semibold text-base">Ingreso General</div>
                <div className="text-sm text-muted-foreground mt-1">Operación no inventariada</div>
              </button>

              {/* Otros Ingresos */}
              <button
                type="button"
                onClick={() => setSelectedIncomeType("otros")}
                className="border rounded-2xl bg-muted/20 hover:bg-muted/40 transition p-8 min-h-[180px] flex flex-col items-center justify-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Gift className="h-7 w-7 text-primary" />
                </div>
                <div className="font-semibold text-base">Otros Ingresos</div>
                <div className="text-sm text-muted-foreground mt-1">Extraordinarios, donaciones</div>
              </button>
            </div>
          </div>
        )}

        {/* ✅ VISTA 2: FORMULARIO */}
        {selectedIncomeType && (
          <div className="space-y-6">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0"
              onClick={() => setSelectedIncomeType("")}
            >
              ← Volver al menú de selección
            </Button>

            <div className="space-y-6 p-4 border rounded-lg bg-muted/20">
              {/* Campos específicos por tipo de ingreso */}
              {renderIncomeTypeForm(selectedIncomeType)}

              <Separator />

              {/* Sección de cálculos y descuentos */}
              <div className="space-y-4">
                {(selectedIncomeType === "precargados" && selectedProductId) ||
                (selectedIncomeType === "inventariados" && selectedInventoryProductId) ? (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Cálculo Automático</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Cantidad:</span>
                        <span>{selectedIncomeType === "precargados" ? productQuantity : inventoryQuantity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Precio Unitario:</span>
                        <span>
                          $
                          {selectedIncomeType === "precargados" ? productUnitPrice : inventoryProductPrice}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Subtotal:</span>
                        <span>${montoTotal}</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Estado del pago */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Label className="font-medium">Estado del Pago</Label>
                  {hasFieldError("Tipo de Pago") && (
                    <div className="flex items-center text-destructive">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs">Requerido</span>
                    </div>
                  )}
                </div>

                <RadioGroup
                  value={paymentStatus}
                  onValueChange={setPaymentStatus}
                  className={hasFieldError("Tipo de Pago") ? "border border-destructive rounded-lg p-2" : ""}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="contado" id="contado" />
                    <Label htmlFor="contado" className="cursor-pointer">
                      Pago Total
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="parcial" id="parcial" />
                    <Label htmlFor="parcial" className="cursor-pointer">
                      Pago parcial
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="credito" id="credito" />
                    <Label htmlFor="credito" className="cursor-pointer">
                      Adeudo Total
                    </Label>
                  </div>
                </RadioGroup>

                {/* Pago parcial */}
                {paymentStatus === "parcial" && (
                  <div className="ml-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="monto-abonado">Monto que se va a pagar</Label>
                        <span className="text-destructive text-sm">*</span>
                        {hasFieldError("Monto Abonado") && (
                          <div className="flex items-center text-destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            <span className="text-xs">Requerido</span>
                          </div>
                        )}
                      </div>
                      <Input
                        id="monto-abonado"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={montoAbonado}
                        onChange={(e) => setMontoAbonado(e.target.value)}
                        className={hasFieldError("Monto Abonado") ? "border-destructive" : ""}
                      />
                    </div>

                    {montoTotal && montoAbonado && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-white dark:bg-gray-900 rounded border">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Total de la venta</p>
                          <p className="text-lg font-semibold text-primary">${formatMonto(montoTotal)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Se pagará ahora</p>
                          <p className="text-lg font-semibold text-green-600">${formatMonto(montoAbonado)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Queda pendiente</p>
                          <p className="text-lg font-semibold text-orange-600">
                            ${formatMonto(parseFloat(montoTotal) - parseFloat(montoAbonado))}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Datos del cliente */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <Label className="font-medium">Datos del Cliente</Label>
                  <span className="text-xs text-muted-foreground">
                    {paymentStatus === "contado"
                      ? "Opcional - Para analíticas y comentarios"
                      : "Obligatorio para cuentas por cobrar"}
                  </span>
                </div>

                {paymentStatus === "contado" && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Asignar cliente es opcional para pagos totales. Útil para analíticas de ventas y seguimiento de
                      clientes.
                    </AlertDescription>
                  </Alert>
                )}

                {(paymentStatus === "parcial" || paymentStatus === "credito") && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Se registrará en Cuentas por Cobrar para análisis de vencimientos
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label className="font-medium">Tipo de Cliente</Label>
                  <Select
                    value={tipoCliente}
                    onValueChange={(value) => {
                      setTipoCliente(value);
                      setClienteSeleccionado("");
                      setClienteNombre("");
                      setClienteTelefono("");
                      setClienteEmail("");
                      setClienteRFC("");
                      setDuplicateWarnings([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          paymentStatus === "contado"
                            ? "Opcional - Selecciona para analíticas"
                            : "Selecciona el tipo de cliente"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nuevo">Cliente Nuevo</SelectItem>
                      <SelectItem value="recurrente">Cliente Recurrente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Cliente recurrente */}
                {tipoCliente === "recurrente" && (
                  <div className="space-y-2">
                    <Label htmlFor="cliente-existente">Seleccionar Cliente</Label>

                    {(() => {
                      const selectedCliente = clientes.find((c) => c.id === clienteSeleccionado);

                      return (
                        <Select
                          value={clienteSeleccionado ?? ""}
                          onValueChange={(value) => {
                            setClienteSeleccionado(value);

                            const cliente = clientes.find((c) => c.id === value);
                            if (cliente) {
                              setClienteNombre(cliente.nombre);
                              setClienteTelefono(cliente.telefono || "");
                              setClienteEmail(cliente.email || "");
                              setClienteRFC(cliente.rfc || "");
                            }
                          }}
                        >
                          <SelectTrigger className="h-auto py-2">
                            {selectedCliente ? (
                              <div className="flex flex-col text-left leading-tight">
                                <span className="font-medium">{selectedCliente.nombre}</span>
                                <span className="text-xs text-muted-foreground">
                                  {selectedCliente.telefono ? `Tel: ${selectedCliente.telefono}` : ""}
                                  {selectedCliente.telefono && selectedCliente.email ? " • " : ""}
                                  {selectedCliente.email ? `Email: ${selectedCliente.email}` : ""}
                                  {selectedCliente.source === "transaction" ? " • (De transacción)" : ""}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Buscar cliente existente...</span>
                            )}
                          </SelectTrigger>

                          <SelectContent className="p-1">
                            {loadingClientes ? (
                              <div className="px-2 py-2 text-sm text-muted-foreground">Cargando clientes...</div>
                            ) : clientes.length === 0 ? (
                              <div className="px-2 py-2 text-sm text-muted-foreground">No hay clientes registrados</div>
                            ) : (
                              clientes.map((cliente) => (
                                <SelectItem key={cliente.id} value={cliente.id} className="py-2">
                                  <div className="flex flex-col text-left leading-tight">
                                    <span className="font-medium">{cliente.nombre}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {cliente.telefono ? `Tel: ${cliente.telefono}` : ""}
                                      {cliente.telefono && cliente.email ? " • " : ""}
                                      {cliente.email ? `Email: ${cliente.email}` : ""}
                                      {cliente.source === "transaction" ? " • (De transacción)" : ""}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      );
                    })()}

                    {!!clienteSeleccionado && <p className="text-xs text-green-600">✓ Datos del cliente cargados automáticamente</p>}
                  </div>
                )}

                {/* Campos cliente */}
                {(tipoCliente === "nuevo" || (tipoCliente === "recurrente" && clienteSeleccionado)) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cliente-nombre">Nombre del Cliente</Label>
                      <Input
                        id="cliente-nombre"
                        type="text"
                        placeholder="Nombre completo"
                        value={clienteNombre}
                        onChange={(e) => setClienteNombre(e.target.value)}
                        disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="cliente-telefono">Número de Teléfono</Label>
                        {(paymentStatus === "parcial" || paymentStatus === "credito") && (
                          <span className="text-destructive text-sm">*</span>
                        )}
                        {hasFieldError("Teléfono del Cliente") && (
                          <div className="flex items-center text-destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            <span className="text-xs">Requerido</span>
                          </div>
                        )}
                      </div>
                      <Input
                        id="cliente-telefono"
                        type="tel"
                        placeholder="Ej: +52 55 1234 5678"
                        value={clienteTelefono}
                        onChange={(e) => setClienteTelefono(e.target.value)}
                        className={hasFieldError("Teléfono del Cliente") ? "border-destructive" : ""}
                        disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""}
                      />

                      {tipoCliente === "nuevo" &&
                        duplicateWarnings.some((w) => w.includes(clienteTelefono) && w.includes("teléfono")) && (
                          <div className="flex items-center text-amber-600 bg-amber-50 p-2 rounded">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            <span className="text-xs">
                              {duplicateWarnings.find(
                                (w) => w.includes(clienteTelefono) && w.includes("teléfono")
                              )}
                            </span>
                          </div>
                        )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="cliente-email">Correo Electrónico</Label>
                        {(paymentStatus === "parcial" || paymentStatus === "credito") && (
                          <span className="text-destructive text-sm">*</span>
                        )}
                        {hasFieldError("Email del Cliente") && (
                          <div className="flex items-center text-destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            <span className="text-xs">Requerido</span>
                          </div>
                        )}
                      </div>
                      <Input
                        id="cliente-email"
                        type="email"
                        placeholder="cliente@ejemplo.com"
                        value={clienteEmail}
                        onChange={(e) => setClienteEmail(e.target.value)}
                        className={hasFieldError("Email del Cliente") ? "border-destructive" : ""}
                        disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""}
                      />

                      {tipoCliente === "nuevo" &&
                        duplicateWarnings.some((w) => w.includes(clienteEmail) && w.includes("correo")) && (
                          <div className="flex items-center text-amber-600 bg-amber-50 p-2 rounded">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            <span className="text-xs">
                              {duplicateWarnings.find((w) => w.includes(clienteEmail) && w.includes("correo"))}
                            </span>
                          </div>
                        )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cliente-rfc">RFC (ID Fiscal) - Opcional</Label>
                      <Input
                        id="cliente-rfc"
                        type="text"
                        placeholder="RFC123456ABC1"
                        value={clienteRFC}
                        onChange={(e) => setClienteRFC(e.target.value.toUpperCase())}
                        maxLength={13}
                        disabled={tipoCliente === "recurrente" && clienteSeleccionado !== ""}
                      />

                      {tipoCliente === "nuevo" &&
                        duplicateWarnings.some((w) => w.includes(clienteRFC) && w.includes("RFC")) && (
                          <div className="flex items-center text-amber-600 bg-amber-50 p-2 rounded">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            <span className="text-xs">
                              {duplicateWarnings.find((w) => w.includes(clienteRFC) && w.includes("RFC"))}
                            </span>
                          </div>
                        )}
                    </div>

                    {(paymentStatus === "parcial" || paymentStatus === "credito") && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="fecha-vencimiento">Fecha de Vencimiento</Label>
                          <span className="text-destructive text-sm">*</span>
                          {hasFieldError("Fecha de Vencimiento") && (
                            <div className="flex items-center text-destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              <span className="text-xs">Requerido</span>
                            </div>
                          )}
                        </div>
                        <Input
                          id="fecha-vencimiento"
                          type="date"
                          value={fechaVencimiento}
                          onChange={(e) => setFechaVencimiento(e.target.value)}
                          className={hasFieldError("Fecha de Vencimiento") ? "border-destructive" : ""}
                          min={new Date().toISOString().split("T")[0]}
                        />
                        <p className="text-xs text-muted-foreground">
                          Fecha límite para el pago {paymentStatus === "parcial" ? "del monto pendiente" : "completo"}
                        </p>
                      </div>
                    )}

                    {paymentStatus === "contado" && tipoCliente && (
                      <div className="col-span-full space-y-2">
                        <Label htmlFor="comentario-venta">Comentarios de la venta (Opcional)</Label>
                        <Textarea
                          id="comentario-venta"
                          placeholder="Detalles adicionales sobre esta venta, preferencias del cliente, etc."
                          value={comentarios}
                          onChange={(e) => setComentarios(e.target.value)}
                          rows={2}
                        />
                        <p className="text-xs text-muted-foreground">
                          Información útil para futuras ventas y análisis del cliente
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {(paymentStatus === "contado" || paymentStatus === "parcial") && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Label className="font-medium">Método de Pago</Label>
                      {hasFieldError("Método de Pago") && (
                        <div className="flex items-center text-destructive">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <span className="text-xs">Requerido</span>
                        </div>
                      )}
                    </div>

                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                      className={hasFieldError("Método de Pago") ? "border border-destructive rounded-lg p-2" : ""}
                    >
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="efectivo" id="efectivo" />
                        <div className="flex items-center space-x-2">
                          <Wallet className="h-4 w-4 text-green-600" />
                          <Label htmlFor="efectivo" className="cursor-pointer">
                            Efectivo <span className="text-sm text-muted-foreground">(se registra en Caja)</span>
                          </Label>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="tarjeta" id="tarjeta" />
                        <div className="flex items-center space-x-2">
                          <CreditCard className="h-4 w-4 text-blue-800" />
                          <Label htmlFor="tarjeta" className="cursor-pointer">
                            Tarjeta <span className="text-sm text-muted-foreground">(se registra en Bancos)</span>
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}

              {/* Comentarios */}
              <div className="space-y-2">
                <Label htmlFor="comentarios">Comentarios de la venta (Opcional)</Label>
                <Textarea
                  id="comentarios"
                  placeholder="Agrega cualquier comentario o nota sobre esta venta..."
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button size="lg" className="px-8" onClick={handleSubmitIngreso} disabled={isSubmitting}>
                  <Calculator className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Registrando..." : "Registrar Ingreso"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}