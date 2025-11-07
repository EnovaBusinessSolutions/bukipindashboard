import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PreviewCuentasContablesProps {
  categoriaActivo: string;
  valorTotal: number;
  tipoPago: string;
  metodoPago: string;
  montoPagado: number;
  montoPendiente: number;
  anosDepreciacion: number | null;
  fechaAdquisicion: Date;
}

const PreviewCuentasContables = ({
  categoriaActivo,
  valorTotal,
  tipoPago,
  metodoPago,
  montoPagado,
  montoPendiente,
  anosDepreciacion,
  fechaAdquisicion,
}: PreviewCuentasContablesProps) => {
  // Determinar cuenta de activo según categoría
  const getCuentaActivo = () => {
    const cuentas: Record<string, { codigo: string; nombre: string }> = {
      equipo_computo: { codigo: "1201", nombre: "Activos Fijos" },
      maquinaria: { codigo: "1201", nombre: "Activos Fijos" },
      vehiculos: { codigo: "1201", nombre: "Activos Fijos" },
      mobiliario: { codigo: "1201", nombre: "Activos Fijos" },
      edificios: { codigo: "1201", nombre: "Activos Fijos" },
      equipo_oficina: { codigo: "1201", nombre: "Activos Fijos" },
      otro: { codigo: "1201", nombre: "Activos Fijos" },
    };
    return cuentas[categoriaActivo] || { codigo: "1201", nombre: "Activos Fijos" };
  };

  // Determinar cuenta de pago según método
  const getCuentaPago = () => {
    if (metodoPago === "efectivo") {
      return { codigo: "1001", nombre: "Caja" };
    } else if (metodoPago === "transferencia") {
      return { codigo: "1002", nombre: "Bancos" };
    } else if (metodoPago?.startsWith("tarjeta_credito_")) {
      return { codigo: "2002", nombre: "Cuentas por Pagar" };
    }
    return null;
  };

  const cuentaActivo = getCuentaActivo();
  const cuentaPago = getCuentaPago();
  
  // Calcular depreciación
  const depreciacionAnual = anosDepreciacion ? valorTotal / anosDepreciacion : 0;
  const depreciacionMensual = depreciacionAnual / 12;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  };

  const totalDebe = valorTotal;
  const totalHaber = montoPagado + montoPendiente;
  const cuadra = Math.abs(totalDebe - totalHaber) < 0.01;

  if (!categoriaActivo || !valorTotal || !tipoPago) {
    return (
      <Card className="border-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Preview Asiento Contable</CardTitle>
          <CardDescription className="text-xs">
            Completa los campos para ver el impacto contable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            Selecciona categoría, valor y tipo de pago
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-lg">Preview Asiento Contable</CardTitle>
        <CardDescription className="text-xs">
          Impacto en la balanza de comprobación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Información del Asiento */}
        <div className="space-y-2 p-3 bg-muted rounded-lg">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Número:</span>
            <span className="font-mono">INV-[nuevo]</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Fecha:</span>
            <span>{format(fechaAdquisicion, "dd/MM/yyyy", { locale: es })}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Tipo:</span>
            <span>Inversión CAPEX</span>
          </div>
        </div>

        {/* DEBE */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">DEBE</h4>
            <Badge variant="outline" className="text-xs">
              {formatCurrency(valorTotal)}
            </Badge>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg space-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium">{cuentaActivo.codigo} - {cuentaActivo.nombre}</p>
                <p className="text-xs text-muted-foreground">Adquisición de activo fijo</p>
              </div>
              <p className="text-xs font-bold text-green-600">{formatCurrency(valorTotal)}</p>
            </div>
          </div>
        </div>

        {/* HABER */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">HABER</h4>
            <Badge variant="outline" className="text-xs">
              {formatCurrency(montoPagado + montoPendiente)}
            </Badge>
          </div>

          {/* Monto Pagado */}
          {montoPagado > 0 && cuentaPago && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg space-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium">{cuentaPago.codigo} - {cuentaPago.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {tipoPago === "parcial" ? "Pago parcial" : "Pago total"} ({metodoPago === "efectivo" ? "efectivo" : metodoPago === "transferencia" ? "transferencia" : "tarjeta crédito"})
                  </p>
                </div>
                <p className="text-xs font-bold text-blue-600">{formatCurrency(montoPagado)}</p>
              </div>
            </div>
          )}

          {/* Monto Pendiente */}
          {montoPendiente > 0 && (
            <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg space-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium">2002 - Cuentas por Pagar</p>
                  <p className="text-xs text-muted-foreground">Saldo pendiente por pagar</p>
                </div>
                <p className="text-xs font-bold text-orange-600">{formatCurrency(montoPendiente)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Validación */}
        <div className="flex items-center justify-center gap-2 p-2 bg-muted rounded-lg">
          {cuadra ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">El asiento cuadra</span>
            </>
          ) : (
            <>
              <span className="text-xs font-medium text-destructive">⚠️ El asiento NO cuadra</span>
            </>
          )}
        </div>

        {/* Depreciación */}
        {anosDepreciacion && (
          <>
            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-purple-600" />
                <h4 className="text-sm font-semibold">Depreciación Mensual</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Se generarán automáticamente {anosDepreciacion * 12} asientos de depreciación
              </p>
              
              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg space-y-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium">5003 - Gasto por Depreciación</p>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">DEBE (mensual)</span>
                    <span className="text-xs font-bold text-purple-600">{formatCurrency(depreciacionMensual)}</span>
                  </div>
                </div>
                
                <div className="border-t pt-2 space-y-1">
                  <p className="text-xs font-medium">1202 - Depreciación Acumulada</p>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">HABER (mensual)</span>
                    <span className="text-xs font-bold text-purple-600">{formatCurrency(depreciacionMensual)}</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                Depreciación anual: {formatCurrency(depreciacionAnual)}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PreviewCuentasContables;
