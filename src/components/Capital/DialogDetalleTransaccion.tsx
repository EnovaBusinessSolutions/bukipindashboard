import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DetalleAsientoCapital } from "./DetalleAsientoCapital";
import { useAsientosCapital } from "@/hooks/useAsientosCapital";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUp, TrendingDown, User, Calendar, DollarSign, FileText } from "lucide-react";

interface TransaccionCapital {
  id: string;
  fecha: string;
  tipo_movimiento: string;
  socio: string;
  monto: number;
  descripcion: string;
  estado: string;
  fecha_cancelacion?: string;
  motivo_cancelacion?: string;
  journalEntryId?: string | null;
  reversalJournalEntryId?: string | null;
}

interface DialogDetalleTransaccionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaccion: TransaccionCapital | null;
}

export const DialogDetalleTransaccion = ({
  open,
  onOpenChange,
  transaccion,
}: DialogDetalleTransaccionProps) => {
  const { data: asiento, isLoading } = useAsientosCapital({
    transaccionId: transaccion?.id ?? null,
    asientoId:
      (transaccion?.estado === "cancelado"
        ? transaccion?.reversalJournalEntryId
        : transaccion?.journalEntryId) ?? null,
  });

  if (!transaccion) return null;

  const esAportacion = transaccion.tipo_movimiento === "aportacion";
  const fechaCancelacionValida =
    transaccion.fecha_cancelacion &&
    !Number.isNaN(new Date(transaccion.fecha_cancelacion).getTime());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalle de Transacción de Capital
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información General */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-medium">
                    {format(new Date(transaccion.fecha), "dd 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Socio</p>
                  <p className="font-medium">{transaccion.socio}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Monto</p>
                  <p className="text-xl font-bold">
                    ${Number(transaccion.monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Tipo de Movimiento</p>
                {esAportacion ? (
                  <Badge className="bg-green-500">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Aportación de Capital
                  </Badge>
                ) : (
                  <Badge className="bg-red-500">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    Pago de Dividendo
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Descripción */}
          {transaccion.descripcion && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Descripción</p>
              <p className="text-sm">{transaccion.descripcion}</p>
            </div>
          )}

          {/* Estado de Cancelación (si aplica) */}
          {transaccion.estado === "cancelado" && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500 rounded">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-red-900 dark:text-red-100 mb-1">
                    Transacción Cancelada
                  </p>

                  {fechaCancelacionValida && (
                    <p className="text-sm text-red-700 dark:text-red-300">
                      <strong>Fecha de cancelación:</strong>{" "}
                      {format(new Date(transaccion.fecha_cancelacion as string), "dd/MM/yyyy", {
                        locale: es,
                      })}
                    </p>
                  )}

                  {transaccion.motivo_cancelacion && (
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      <strong>Motivo:</strong> {transaccion.motivo_cancelacion}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Asiento Contable */}
          <div>
            <h3 className="font-semibold mb-3">Asiento Contable</h3>
            <DetalleAsientoCapital asiento={asiento} isLoading={isLoading} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
