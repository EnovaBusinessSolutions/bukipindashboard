import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, TrendingUp, TrendingDown, PieChart, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const RegistroCapital = () => {
  const [tipoMovimiento, setTipoMovimiento] = useState<"aportacion" | "dividendo">("aportacion");
  const [fecha, setFecha] = useState<Date>(new Date());
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [socio, setSocio] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!monto || parseFloat(monto) <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser mayor a 0",
        variant: "destructive"
      });
      return;
    }

    // Aquí iría la lógica para guardar en la base de datos
    toast({
      title: "Registro exitoso",
      description: `Se ha registrado ${tipoMovimiento === "aportacion" ? "la aportación de capital" : "el dividendo"} correctamente`,
    });

    // Limpiar formulario
    setMonto("");
    setDescripcion("");
    setSocio("");
    setFecha(new Date());
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Registro de Capital</h1>
        <p className="text-muted-foreground">Registra aportaciones de capital y distribución de dividendos</p>
      </div>

      <Tabs defaultValue="registro" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="registro">Registros de Capital</TabsTrigger>
          <TabsTrigger value="resumen">Resumen de Transacciones</TabsTrigger>
          <TabsTrigger value="analitica">Analítica</TabsTrigger>
        </TabsList>

        {/* Pestaña 1: Registros de Capital */}
        <TabsContent value="registro" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nuevo Movimiento de Capital</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tipo de Movimiento */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant={tipoMovimiento === "aportacion" ? "default" : "outline"}
                  onClick={() => setTipoMovimiento("aportacion")}
                  className="h-20 flex flex-col items-center justify-center gap-2"
                >
                  <TrendingUp className="h-6 w-6" />
                  <span>Aportación de Capital</span>
                </Button>
                <Button
                  type="button"
                  variant={tipoMovimiento === "dividendo" ? "default" : "outline"}
                  onClick={() => setTipoMovimiento("dividendo")}
                  className="h-20 flex flex-col items-center justify-center gap-2"
                >
                  <TrendingDown className="h-6 w-6" />
                  <span>Pago de Dividendos</span>
                </Button>
              </div>

              {/* Fecha */}
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fecha && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fecha ? format(fecha, "PPP", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fecha}
                      onSelect={(date) => date && setFecha(date)}
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Socio */}
              <div className="space-y-2">
                <Label htmlFor="socio">Socio / Accionista</Label>
                <Input
                  id="socio"
                  placeholder="Nombre del socio o accionista"
                  value={socio}
                  onChange={(e) => setSocio(e.target.value)}
                  required
                />
              </div>

              {/* Monto */}
              <div className="space-y-2">
                <Label htmlFor="monto">
                  {tipoMovimiento === "aportacion" ? "Monto de Aportación" : "Monto del Dividendo"}
                </Label>
                <Input
                  id="monto"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                />
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción / Notas</Label>
                <Textarea
                  id="descripcion"
                  placeholder={
                    tipoMovimiento === "aportacion"
                      ? "Ej: Aportación inicial de capital social"
                      : "Ej: Distribución de utilidades del ejercicio 2024"
                  }
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Botón Submit */}
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Registrar {tipoMovimiento === "aportacion" ? "Aportación" : "Dividendo"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resumen e Información */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tipoMovimiento === "aportacion" ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Aportación de Capital</p>
                      <p className="text-xs text-muted-foreground">
                        Incrementa el capital social de la empresa. Se registra en la cuenta de capital contable.
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Registro contable:</p>
                    <p>• Debe: Bancos / Caja</p>
                    <p>• Haber: Capital Social</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <TrendingDown className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Pago de Dividendos</p>
                      <p className="text-xs text-muted-foreground">
                        Distribución de utilidades a los socios. Reduce el capital contable de la empresa.
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Registro contable:</p>
                    <p>• Debe: Utilidades Retenidas</p>
                    <p>• Haber: Bancos / Caja</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historial Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay movimientos registrados
              </p>
            </CardContent>
          </Card>
          </div>
        </div>
      </TabsContent>

      {/* Pestaña 2: Resumen de Transacciones */}
      <TabsContent value="resumen" className="mt-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Movimientos de Capital</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Capital Social Total
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-primary">$0.00</p>
                    <p className="text-xs text-muted-foreground mt-1">Aportaciones acumuladas</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Aportaciones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">$0.00</p>
                    <p className="text-xs text-muted-foreground mt-1">En el periodo</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Dividendos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-600">$0.00</p>
                    <p className="text-xs text-muted-foreground mt-1">Distribuidos en el periodo</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabla de transacciones */}
              <div className="border rounded-lg">
                <div className="p-4 border-b bg-muted/50">
                  <h3 className="font-semibold">Historial de Transacciones</h3>
                </div>
                <div className="p-8 text-center text-muted-foreground">
                  <p>No hay transacciones registradas</p>
                  <p className="text-sm mt-2">Las transacciones aparecerán aquí una vez que las registres</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumen por Socio */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen por Socio / Accionista</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <div className="p-4 border-b bg-muted/50">
                  <div className="grid grid-cols-4 gap-4 font-semibold text-sm">
                    <div>Socio</div>
                    <div className="text-right">Aportaciones</div>
                    <div className="text-right">Dividendos</div>
                    <div className="text-right">Balance</div>
                  </div>
                </div>
                <div className="p-8 text-center text-muted-foreground">
                  <p>No hay datos disponibles</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Pestaña 3: Analítica */}
      <TabsContent value="analitica" className="mt-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Capital</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <PieChart className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Composición del Capital</h3>
                  </div>
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <p>Gráfica de composición del capital por socio</p>
                  </div>
                </div>

                <div className="border rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Evolución del Capital</h3>
                  </div>
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <p>Gráfica de evolución del capital en el tiempo</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retorno sobre Capital (ROE)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      ROE Anual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">0.0%</p>
                    <p className="text-xs text-muted-foreground mt-1">Utilidad / Capital</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Dividendos / Capital
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">0.0%</p>
                    <p className="text-xs text-muted-foreground mt-1">Tasa de distribución</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Capital / Activos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">0.0%</p>
                    <p className="text-xs text-muted-foreground mt-1">Apalancamiento</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Indicadores Clave</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Número de Socios</p>
                    <p className="text-sm text-muted-foreground">Accionistas activos</p>
                  </div>
                  <p className="text-2xl font-bold">0</p>
                </div>

                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Última Aportación</p>
                    <p className="text-sm text-muted-foreground">Fecha del último movimiento</p>
                  </div>
                  <p className="text-lg font-semibold text-muted-foreground">N/A</p>
                </div>

                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Último Dividendo</p>
                    <p className="text-sm text-muted-foreground">Fecha de última distribución</p>
                  </div>
                  <p className="text-lg font-semibold text-muted-foreground">N/A</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
    </div>
  );
};

export default RegistroCapital;
