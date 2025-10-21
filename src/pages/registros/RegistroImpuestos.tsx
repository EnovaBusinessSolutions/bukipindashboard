import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";

const RegistroImpuestos = () => {
  const [tasaISR, setTasaISR] = useState<string>("");
  const [utilidadAntesImpuestos, setUtilidadAntesImpuestos] = useState<string>("");
  const [isrCalculado, setIsrCalculado] = useState<number>(0);
  const [isrReal, setIsrReal] = useState<string>("");

  const calcularISR = () => {
    const utilidad = parseFloat(utilidadAntesImpuestos) || 0;
    const tasa = parseFloat(tasaISR) || 0;
    const calculado = (utilidad * tasa) / 100;
    setIsrCalculado(calculado);
    setIsrReal(calculado.toFixed(2));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Registro de Impuestos</h1>
          <p className="text-muted-foreground mt-2">
            Calcula y registra el ISR basado en la utilidad antes de impuestos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Cálculo de ISR
            </CardTitle>
            <CardDescription>
              Ingresa la tasa de ISR y la utilidad antes de impuestos para calcular el impuesto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="tasa-isr">Tasa de ISR (%)</Label>
                <Input
                  id="tasa-isr"
                  type="number"
                  placeholder="Ej: 30"
                  value={tasaISR}
                  onChange={(e) => setTasaISR(e.target.value)}
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="utilidad">Utilidad Antes de Impuestos</Label>
                <Input
                  id="utilidad"
                  type="number"
                  placeholder="Ej: 100000"
                  value={utilidadAntesImpuestos}
                  onChange={(e) => setUtilidadAntesImpuestos(e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <Button onClick={calcularISR} className="w-full md:w-auto">
              <Calculator className="h-4 w-4 mr-2" />
              Calcular ISR
            </Button>

            {isrCalculado > 0 && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">ISR Calculado:</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(isrCalculado)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ISR Real a Pagar</CardTitle>
            <CardDescription>
              Ingresa el monto real de ISR que pagarás (puede diferir del cálculo)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="isr-real">Monto Real de ISR</Label>
              <Input
                id="isr-real"
                type="number"
                placeholder="Ingresa el monto real"
                value={isrReal}
                onChange={(e) => setIsrReal(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>

            {isrReal && parseFloat(isrReal) !== isrCalculado && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  El monto real difiere del calculado por{" "}
                  <span className="font-semibold">
                    {formatCurrency(Math.abs(parseFloat(isrReal) - isrCalculado))}
                  </span>
                </p>
              </div>
            )}

            <Button className="w-full" disabled={!isrReal}>
              Registrar ISR
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegistroImpuestos;
