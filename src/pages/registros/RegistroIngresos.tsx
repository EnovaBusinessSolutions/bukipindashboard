import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Plus, ShoppingCart, Package, FileText, Gift, CreditCard, Wallet, Calculator } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useVentasResumen } from "@/hooks/useVentasResumen";
import { useTransaccionesRecientes } from "@/hooks/useTransaccionesRecientes";

const RegistroIngresos = () => {
  const { ventasResumen, loading: loadingVentas } = useVentasResumen();
  const { transacciones, loading: loadingTransacciones } = useTransaccionesRecientes(10);
  const [selectedIncomeType, setSelectedIncomeType] = useState("");
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [montoTotal, setMontoTotal] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Función para registrar el ingreso
  const handleSubmitIngreso = async () => {
    if (!selectedIncomeType || !descripcion || !montoTotal || !paymentMethod || !paymentStatus) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('registrar-ingreso', {
        body: {
          tipoIngreso: selectedIncomeType,
          descripcion: descripcion,
          montoTotal: parseFloat(montoTotal),
          montoDescuento: hasDiscount ? parseFloat(discountAmount || '0') : 0,
          cuentaPrincipalCodigo: selectedIncomeType === 'otros' ? '4004' : '4001',
          metodoPago: paymentMethod,
          tipoPago: paymentStatus,
          montoPagado: paymentStatus === 'contado' ? parseFloat(montoTotal) - (hasDiscount ? parseFloat(discountAmount || '0') : 0) : 0
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Ingreso registrado",
        description: `Asiento ${data.numeroAsiento} creado correctamente`
      });

      // Limpiar formulario
      setSelectedIncomeType("");
      setDescripcion("");
      setMontoTotal("");
      setDiscountAmount("");
      setHasDiscount(false);
      setPaymentMethod("");
      setPaymentStatus("");

    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Error al registrar el ingreso",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const renderIncomeTypeForm = (type: string) => {
    switch (type) {
      case "precargados":
        return (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Recordatorio:</strong> Para registrar ventas de productos precargados, primero debes agregar los productos al catálogo desde la pestaña "Catálogo de Productos".
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="producto-precargado">Seleccionar Producto Precargado</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Buscar en catálogo plantilla 3" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="producto1">Producto Ejemplo 1</SelectItem>
                  <SelectItem value="producto2">Producto Ejemplo 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input id="cantidad" type="number" placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="precio-unitario">Precio Unitario</Label>
                <Input id="precio-unitario" type="number" placeholder="0.00" disabled />
              </div>
            </div>
          </div>
        );
      
      case "inventariados":
        return (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Solo se mostrarán productos previamente cargados en el inventario.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="producto-inventario">Seleccionar Producto del Inventario</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto inventariado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inv1">Sin productos en inventario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cantidad-inv">Cantidad</Label>
                <Input id="cantidad-inv" type="number" placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="precio-inv">Precio Unitario</Label>
                <Input id="precio-inv" type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock-disponible">Stock Disponible</Label>
                <Input id="stock-disponible" type="number" disabled placeholder="0" />
              </div>
            </div>
          </div>
        );
      
      case "general":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="descripcion-general">Descripción del Ingreso</Label>
              <Input 
                id="descripcion-general" 
                placeholder="Ej: Servicio de consultoría"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cuenta-contable">Cuenta Contable</Label>
                <Select defaultValue="4001">
                  <SelectTrigger>
                    <SelectValue placeholder="4001 - Ventas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4001">4001 - Ventas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcuenta">Subcuenta (Opcional)</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar subcuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sub1">Subcuenta ejemplo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monto-general">Monto</Label>
              <Input 
                id="monto-general" 
                type="number" 
                placeholder="0.00"
                value={montoTotal}
                onChange={(e) => setMontoTotal(e.target.value)}
              />
            </div>
          </div>
        );
      
      case "otros":
        return (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este ingreso se ligará a la cuenta 4004 - Ventas inventarios.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="descripcion-otros">Descripción del Ingreso Extraordinario</Label>
              <Textarea 
                id="descripcion-otros" 
                placeholder="Ej: Venta extraordinaria de equipo usado, donación recibida, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monto-otros">Monto</Label>
              <Input id="monto-otros" type="number" placeholder="0.00" />
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Registro de Ingresos</h1>
        <p className="text-muted-foreground mt-2">
          Registra ventas, gestiona catálogos y analiza ingresos de la empresa
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="registro" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="registro">Registro de Ingresos</TabsTrigger>
            <TabsTrigger value="resumen">Resumen de Ventas</TabsTrigger>
            <TabsTrigger value="catalogo">Catálogo de Productos</TabsTrigger>
          </TabsList>

          {/* TAB 1: REGISTRO DE INGRESOS */}
          <TabsContent value="registro" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Nuevo Registro de Ingreso</CardTitle>
                <CardDescription>
                  Selecciona el tipo de ingreso y completa la información requerida
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Selección del tipo de ingreso */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Tipo de Ingreso</Label>
                  <RadioGroup value={selectedIncomeType} onValueChange={setSelectedIncomeType}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="precargados" id="precargados" />
                        <div className="flex items-center space-x-2">
                          <ShoppingCart className="h-5 w-5 text-primary" />
                          <Label htmlFor="precargados" className="cursor-pointer flex-1">
                            <div className="font-medium">Productos Precargados</div>
                          </Label>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="inventariados" id="inventariados" />
                        <div className="flex items-center space-x-2">
                          <Package className="h-5 w-5 text-primary" />
                          <Label htmlFor="inventariados" className="cursor-pointer flex-1">
                            <div className="font-medium">Productos Inventariados</div>
                            <div className="text-sm text-muted-foreground">Del inventario registrado</div>
                          </Label>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="general" id="general" />
                        <div className="flex items-center space-x-2">
                          <FileText className="h-5 w-5 text-primary" />
                          <Label htmlFor="general" className="cursor-pointer flex-1">
                            <div className="font-medium">Ingreso General</div>
                            <div className="text-sm text-muted-foreground">Operación no inventariada</div>
                          </Label>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="otros" id="otros" />
                        <div className="flex items-center space-x-2">
                          <Gift className="h-5 w-5 text-primary" />
                          <Label htmlFor="otros" className="cursor-pointer flex-1">
                            <div className="font-medium">Otros Ingresos</div>
                            <div className="text-sm text-muted-foreground">Extraordinarios, donaciones</div>
                          </Label>
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Formulario dinámico según el tipo seleccionado */}
                {selectedIncomeType && (
                  <div className="space-y-6 p-4 border rounded-lg bg-muted/20">
                    {/* Campos específicos por tipo de ingreso */}
                    {renderIncomeTypeForm(selectedIncomeType)}
                    
                    <Separator />
                    
                    {/* Sección de descuentos */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="discount" 
                          checked={hasDiscount} 
                          onCheckedChange={(checked) => setHasDiscount(checked === true)}
                        />
                        <Label htmlFor="discount" className="font-medium">¿Aplicar descuento?</Label>
                      </div>
                      
                      {hasDiscount && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                          <div className="space-y-2">
                            <Label htmlFor="discount-amount">Monto del descuento</Label>
                            <Input
                              id="discount-amount"
                              type="number"
                              placeholder="0.00"
                              value={discountAmount}
                              onChange={(e) => setDiscountAmount(e.target.value)}
                            />
                          </div>
                          <div className="flex items-end">
                            <Alert className="mt-4">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                <strong>Contabilización automática:</strong><br />
                                • Ventas: +${montoTotal || '0'}<br />
                                {hasDiscount && discountAmount && <span>• Descuento sobre ventas: +${discountAmount}<br /></span>}
                                • {paymentMethod === 'efectivo' ? 'Caja' : 'Bancos'}: +${((parseFloat(montoTotal || '0') - parseFloat(discountAmount || '0'))).toFixed(2)}
                              </AlertDescription>
                            </Alert>
                          </div>
                          <div className="mt-4 p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                            <div className="text-center">
                              <p className="text-sm font-medium text-muted-foreground mb-1">Total a cobrar al cliente</p>
                              <p className="text-2xl font-bold text-primary">
                                ${((parseFloat(montoTotal || '0') - parseFloat(discountAmount || '0'))).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Método de pago */}
                    <div className="space-y-4">
                      <Label className="font-medium">Método de Pago</Label>
                      <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
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
                            <CreditCard className="h-4 w-4 text-blue-600" />
                            <Label htmlFor="tarjeta" className="cursor-pointer">
                              Tarjeta <span className="text-sm text-muted-foreground">(se registra en Bancos)</span>
                            </Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    <Separator />

                    {/* Estado del pago */}
                    <div className="space-y-4">
                      <Label className="font-medium">Estado del Pago</Label>
                      <RadioGroup value={paymentStatus} onValueChange={setPaymentStatus}>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="contado" id="contado" />
                          <Label htmlFor="contado" className="cursor-pointer">Pago de contado</Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="parcial" id="parcial" />
                          <Label htmlFor="parcial" className="cursor-pointer">Pago parcial</Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="credito" id="credito" />
                          <Label htmlFor="credito" className="cursor-pointer">Quedó a deber</Label>
                        </div>
                      </RadioGroup>

                      {(paymentStatus === "parcial" || paymentStatus === "credito") && (
                        <div className="space-y-4 ml-6 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Se registrará en Cuentas por Cobrar para análisis de vencimientos
                            </AlertDescription>
                          </Alert>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="cliente-nombre">Nombre del cliente</Label>
                              <Input id="cliente-nombre" placeholder="Nombre completo" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="cliente-contacto">Contacto</Label>
                              <Input id="cliente-contacto" placeholder="Teléfono o email" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="fecha-vencimiento">Fecha de vencimiento</Label>
                              <Input id="fecha-vencimiento" type="date" />
                            </div>
                            {paymentStatus === "parcial" && (
                              <div className="space-y-2">
                                <Label htmlFor="monto-abonado">Monto abonado</Label>
                                <Input id="monto-abonado" type="number" placeholder="0.00" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button 
                        size="lg" 
                        className="px-8"
                        onClick={handleSubmitIngreso}
                        disabled={isSubmitting}
                      >
                        <Calculator className="mr-2 h-4 w-4" />
                        {isSubmitting ? "Registrando..." : "Registrar Ingreso"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: RESUMEN DE VENTAS */}
          <TabsContent value="resumen" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Ventas del Día</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingVentas ? "Cargando..." : `$${ventasResumen.ventasDelDia.toFixed(2)}`}
                  </div>
                  <p className="text-xs text-muted-foreground">Total de hoy</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Ventas del Mes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingVentas ? "Cargando..." : `$${ventasResumen.ventasDelMes.toFixed(2)}`}
                  </div>
                  <p className="text-xs text-muted-foreground">Acumulado mensual</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Ventas del Año</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingVentas ? "Cargando..." : `$${ventasResumen.ventasDelAno.toFixed(2)}`}
                  </div>
                  <p className="text-xs text-muted-foreground">Acumulado anual</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Descuentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {loadingVentas ? "Cargando..." : `$${ventasResumen.descuentosDelMes.toFixed(2)}`}
                  </div>
                  <p className="text-xs text-muted-foreground">Este mes</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de barras - Ventas por día */}
              <Card>
                <CardHeader>
                  <CardTitle>Ventas por Tipo</CardTitle>
                  <CardDescription>Distribución de ingresos por categoría</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Cargando gráfico...
                    </div>
                  ) : transacciones.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={
                          Object.entries(
                            transacciones.reduce((acc, t) => {
                              acc[t.tipo_ingreso] = (acc[t.tipo_ingreso] || 0) + t.monto_total;
                              return acc;
                            }, {} as Record<string, number>)
                          ).map(([tipo, monto]) => ({ tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1), monto }))
                        }>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="tipo" />
                          <YAxis />
                          <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Monto']} />
                          <Bar dataKey="monto" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Gráfico circular - Métodos de pago */}
              <Card>
                <CardHeader>
                  <CardTitle>Métodos de Pago</CardTitle>
                  <CardDescription>Distribución por forma de pago</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransacciones ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Cargando gráfico...
                    </div>
                  ) : transacciones.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={
                              Object.entries(
                                transacciones.reduce((acc, t) => {
                                  acc[t.metodo_pago] = (acc[t.metodo_pago] || 0) + t.monto_total;
                                  return acc;
                                }, {} as Record<string, number>)
                              ).map(([metodo, monto]) => ({ 
                                metodo: metodo.charAt(0).toUpperCase() + metodo.slice(1), 
                                monto,
                                porcentaje: ((monto / transacciones.reduce((sum, t) => sum + t.monto_total, 0)) * 100).toFixed(1)
                              }))
                            }
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ metodo, porcentaje }) => `${metodo} ${porcentaje}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="monto"
                          >
                            {Object.entries(
                              transacciones.reduce((acc, t) => {
                                acc[t.metodo_pago] = (acc[t.metodo_pago] || 0) + t.monto_total;
                                return acc;
                              }, {} as Record<string, number>)
                            ).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--secondary))"} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Monto']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Lista de transacciones detallada */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Registro Detallado de Ventas</CardTitle>
                <CardDescription>
                  Historial completo de transacciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransacciones ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Cargando transacciones...
                  </div>
                ) : transacciones.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay ventas registradas aún
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm font-medium text-muted-foreground mb-4">
                      Últimas {transacciones.length} transacciones
                    </div>
                    <div className="space-y-3">
                      {transacciones.map((transaccion) => (
                        <div key={transaccion.id} className="border rounded-lg p-4 hover:bg-muted/50">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <p className="font-medium">{transaccion.descripcion}</p>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <span className="capitalize">{transaccion.tipo_ingreso}</span>
                                <span>•</span>
                                <span className="capitalize">{transaccion.metodo_pago}</span>
                                <span>•</span>
                                <span className="capitalize">{transaccion.tipo_pago}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary">${transaccion.monto_total.toFixed(2)}</p>
                              {transaccion.monto_descuento > 0 && (
                                <p className="text-sm text-red-600">
                                  -${transaccion.monto_descuento.toFixed(2)} desc.
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>
                              {new Date(transaccion.created_at).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="font-medium text-green-600">
                              Neto: ${transaccion.monto_neto.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: CATÁLOGO DE PRODUCTOS */}
          <TabsContent value="catalogo" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Catálogo de Productos
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Producto
                  </Button>
                </CardTitle>
                <CardDescription>
                  Gestiona el catálogo de productos y servicios con cuentas contables asignadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Recomendación:</strong> Asignar subcuentas a cada producto ayuda a llevar un mejor control contable. 
                    La cuenta predeterminada es "4001 - Ventas".
                  </AlertDescription>
                </Alert>
                
                <div className="text-center py-8 text-muted-foreground">
                  Catálogo de productos próximamente...
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegistroIngresos;