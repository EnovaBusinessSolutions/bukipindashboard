import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DetalleAsiento {
  id: string;
  cuenta_codigo: string;
  debe: number;
  haber: number;
  descripcion: string;
  cuenta?: {
    nombre: string;
  };
}

interface AsientoCapital {
  id: string;
  numero_asiento: string;
  descripcion: string;
  fecha: string;
  detalle_asientos: DetalleAsiento[];
}

interface DetalleAsientoCapitalProps {
  asiento: AsientoCapital | null | undefined;
  isLoading: boolean;
}

export const DetalleAsientoCapital = ({ asiento, isLoading }: DetalleAsientoCapitalProps) => {
  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p className="text-sm">Cargando asiento contable...</p>
      </div>
    );
  }

  if (!asiento) {
    return (
      <div className="p-4 border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <div>
            <p className="font-medium text-orange-900 dark:text-orange-100">
              Asiento contable no encontrado
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
              Este movimiento no tiene asiento contable asociado. Esto puede ocurrir si la transacción 
              fue creada antes de activar el trigger automático.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalDebe = asiento.detalle_asientos.reduce((sum, d) => sum + Number(d.debe), 0);
  const totalHaber = asiento.detalle_asientos.reduce((sum, d) => sum + Number(d.haber), 0);
  const cuadra = Math.abs(totalDebe - totalHaber) < 0.01;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Asiento Contable
              {cuadra ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Cuadrado
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Descuadrado
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <span><strong>No. Asiento:</strong> {asiento.numero_asiento}</span>
              <span><strong>Fecha:</strong> {format(new Date(asiento.fecha), "dd/MM/yyyy", { locale: es })}</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{asiento.descripcion}</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Cuenta</TableHead>
              <TableHead>Nombre de Cuenta</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">DEBE</TableHead>
              <TableHead className="text-right">HABER</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {asiento.detalle_asientos.map((detalle) => (
              <TableRow key={detalle.id}>
                <TableCell className="font-mono text-sm">{detalle.cuenta_codigo}</TableCell>
                <TableCell className="font-medium">{detalle.cuenta?.nombre}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{detalle.descripcion}</TableCell>
                <TableCell className="text-right font-mono">
                  {detalle.debe > 0 ? (
                    <span className="text-blue-600 font-semibold">
                      ${Number(detalle.debe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {detalle.haber > 0 ? (
                    <span className="text-green-600 font-semibold">
                      ${Number(detalle.haber).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold bg-muted/50">
              <TableCell colSpan={3} className="text-right">TOTALES:</TableCell>
              <TableCell className="text-right text-blue-600">
                ${totalDebe.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right text-green-600">
                ${totalHaber.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
